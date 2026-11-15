"""Native evidence, publication and revision review acceptance regressions."""
import copy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import pytest
from test_session_distiller import _make_vault
from session_catalogue import catalogue_records
from session_distiller import artifact_revision, prepare_session, review_artifact, review_state, submit_candidate
from session_providers import discover_codex_sessions, read_session_transcript
from vault_io import WriteConflict

FIXTURE = Path(__file__).parent / 'fixtures' / 'codex-native-v1.jsonl'


def source(tmp_path, suffix='a'):
    import json
    store = tmp_path / ('store-' + suffix)
    store.mkdir()
    path = store / 'rollout-2026-11-15T01-00-00-fixture.jsonl'
    repository = tmp_path / 'example-repo'
    (repository / '.git').mkdir(parents=True, exist_ok=True)
    rows = [json.loads(line) for line in FIXTURE.read_text(encoding='utf-8').splitlines()]
    rows[0]['payload']['cwd'] = repository.as_posix()
    path.write_text('\n'.join(json.dumps(row) for row in rows), encoding='utf-8')
    return read_session_transcript(discover_codex_sessions(store)[0])


def pilot_vault(tmp_path):
    layout = _make_vault(tmp_path)
    templates = Path(__file__).parents[2] / 'vault' / '80_Templates'
    (layout.root / '80_Templates').mkdir()
    for name in ('Session_Synthesis_Template.md', 'Troubleshooting_Template.md', 'ADR_Template.md'):
        (layout.root / '80_Templates' / name).write_bytes((templates / name).read_bytes())
    return layout


def candidate(transcript):
    def claim(text, state, locator, quote):
        return {'text': text, 'state': state, 'evidence': [{'id': locator, 'quote': quote}]}
    return {'schema_version': 1, 'source_key': transcript.record.source_key,
            'source_revision': transcript.record.source_revision,
            'title': 'SQL alias correction', 'kind': 'troubleshooting', 'sections': {
                'Problem': [claim('SQL alias error in query.py', 'observation', 'L2', 'SQL alias error')],
                'Failed Attempts': [claim('Retrying the unchanged query failed.', 'observation', 'L5', 'Retrying the unchanged query did not fix it.')],
                'Fix': [claim('Replace sub.distance with v.distance.', 'proposal', 'L6', 'Replace undefined sub.distance with v.distance')],
                'Verification': [claim('Only the targeted alias regression passed; full suite unrun.', 'verified_result', 'L8', 'Only the targeted regression was run; the full suite was not run.')],
                'Root Cause': [claim('The query declares alias v.', 'proposal', 'L6', 'The query declares alias v.')],
                'Follow-Up Tasks': [claim('The user accepted the correction; the wider query audit remains open.', 'accepted_decision', 'L9', 'I accept the alias correction. Leave the wider query audit open.')],
            }}


def test_native_order_metadata_mirrors_and_source_scopes(tmp_path):
    transcript = source(tmp_path)
    assert transcript.record.parse_status == 'complete'
    assert transcript.record.session_id == 'native-sql-alias'
    assert transcript.record.project == (tmp_path / 'example-repo').as_posix()
    assert transcript.record.repository
    assert transcript.record.message_count == 8
    assert [m.evidence_id for m in transcript.messages] == ['L2', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']
    assert transcript.messages[1].call_id == transcript.messages[2].call_id
    assert source(tmp_path, 'b').record.source_key != transcript.record.source_key
    page = prepare_session(transcript, 2, 2)
    assert page['next_offset'] == 4 and len(page['evidence']) == 2


@pytest.mark.parametrize('tail,status', [('', 'empty'), ('{bad', 'unsupported')])
def test_empty_or_corrupt_has_no_fake_messages(tmp_path, tail, status):
    transcript = source(tmp_path)
    Path(transcript.record.source_path).write_text(tail, encoding='utf-8')
    reread = read_session_transcript(transcript.record)
    assert reread.record.parse_status == status
    assert reread.record.message_count == 0


def test_source_change_blocks_stale_candidate(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    draft = candidate(transcript)
    with Path(transcript.record.source_path).open('a', encoding='utf-8') as f:
        f.write('{broken')
    with pytest.raises(ValueError):
        submit_candidate(layout, transcript, draft)
    assert not list((layout.root / '25_Knowledge_Base').glob('*.md'))


def test_draft_review_edit_conflict_and_repeat(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    draft = candidate(transcript)
    result = submit_candidate(layout, transcript, draft)
    path = layout.root / result['path']
    assert result['review_state'] == 'draft'
    assert 'Thanks, done.' not in path.read_text(encoding='utf-8')
    assert submit_candidate(layout, transcript, draft)['status'] == 'unchanged'
    review_artifact(layout, result['path'], result['revision'], 'Fixture reviewer')
    assert review_state(path.read_text(encoding='utf-8')) == 'reviewed'
    with path.open('a', encoding='utf-8') as f:
        f.write('\nHuman correction\n')
    assert review_state(path.read_text(encoding='utf-8')) == 'stale'
    original = path.read_bytes()
    with pytest.raises(WriteConflict):
        submit_candidate(layout, transcript, draft)
    assert path.read_bytes() == original
    changed = copy.deepcopy(draft)
    changed['title'] = 'Revised SQL alias correction'
    revision = artifact_revision(path.read_text(encoding='utf-8'))
    updated = submit_candidate(layout, transcript, changed, expected_revision=revision)
    assert updated['path'] == result['path'] and updated['review_state'] == 'draft'


def test_concurrent_submission_and_same_title_distinct_sources(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit_candidate(layout, transcript, candidate(transcript)), range(2)))
    assert sorted(r['status'] for r in results) == ['created', 'unchanged']
    second = source(tmp_path, 'b')
    assert submit_candidate(layout, second, candidate(second))['path'] != results[0]['path']


def test_denied_secondary_destination_is_no_mutation(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    before = {str(p): p.read_bytes() for p in layout.root.rglob('*.md')}
    layout._overrides[('00_MOCs',)] = False
    with pytest.raises(PermissionError):
        submit_candidate(layout, transcript, candidate(transcript))
    assert before == {str(p): p.read_bytes() for p in layout.root.rglob('*.md')}


def test_partial_publication_retry_repairs_without_rewriting(tmp_path, monkeypatch):
    import session_distiller as module
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    write = module.atomic_write
    def fail_catalogue(layout, path, text, expected):
        if path.parent.name == '35_Sessions':
            raise OSError('Injected catalogue failure')
        return write(layout, path, text, expected)
    monkeypatch.setattr(module, 'atomic_write', fail_catalogue)
    result = submit_candidate(layout, transcript, candidate(transcript))
    assert result['status'] == 'partial' and len(result['persisted']) == 1
    path = layout.root / result['path']
    original = path.read_bytes()
    monkeypatch.setattr(module, 'atomic_write', write)
    assert submit_candidate(layout, transcript, candidate(transcript))['status'] == 'unchanged'
    assert path.read_bytes() == original
    assert 'distilled: true' in next((layout.root / '35_Sessions').glob('*.md')).read_text()


def test_false_acceptance_and_fabricated_quote_rejected(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    draft = candidate(transcript)
    draft['sections']['Fix'][0]['state'] = 'accepted_decision'
    with pytest.raises(ValueError, match='user evidence'):
        submit_candidate(layout, transcript, draft)
    draft = candidate(transcript)
    draft['sections']['Fix'][0]['evidence'][0]['quote'] = 'Full suite passed'
    with pytest.raises(ValueError, match='quote must match'):
        submit_candidate(layout, transcript, draft)


def test_catalogue_batch_progress(tmp_path):
    layout, a, b = pilot_vault(tmp_path), source(tmp_path), source(tmp_path, 'b')
    assert len(catalogue_records(layout, [a.record, b.record], limit=1).written) == 1
    assert len(catalogue_records(layout, [a.record, b.record], limit=1).written) == 1
    assert len(catalogue_records(layout, [a.record, b.record], limit=1).written) == 0


def test_catalogue_refresh_preserves_human_content_and_batch_progress(tmp_path):
    import json
    import yaml
    layout, first, second = pilot_vault(tmp_path), source(tmp_path), source(tmp_path, 'b')
    path = catalogue_records(layout, [first.record]).written[0]
    original = path.read_text(encoding='utf-8')
    authored = original.replace('source_revision:', '# Preserve source comment\nsource_revision:', 1)
    authored = authored.replace('---\n', '---\ncustom: "Keep exact formatting" # Human annotation\n', 1)
    authored += '\n## Human explanation\n  Keep this multiline text.\n'
    path.write_text(authored, encoding='utf-8')
    original_body = authored.split('---\n', 2)[2]
    with Path(first.record.source_path).open('a', encoding='utf-8') as handle:
        handle.write('\n' + json.dumps({'type': 'response_item', 'payload': {'type': 'message', 'role': 'assistant',
                       'content': [{'type': 'output_text', 'text': 'A new observation.'}]}}))
    changed = read_session_transcript(first.record)
    result = catalogue_records(layout, [changed.record, second.record], limit=1)
    assert result.updated == [path] and len(result.written) == 1
    current = path.read_text(encoding='utf-8')
    data = yaml.safe_load(current.split('---\n', 2)[1])
    assert data['source_revision'] == changed.record.source_revision
    assert data['message_count'] == 9 and data['parse_status'] == 'complete'
    assert current.split('---\n', 2)[2] == original_body
    assert '# Preserve source comment' in current
    assert 'custom: "Keep exact formatting" # Human annotation' in current
    repeated = catalogue_records(layout, [changed.record, second.record])
    assert repeated.updated == [] and path.read_text(encoding='utf-8') == current


def test_staging_denial_and_existing_stage_leave_authored_files_unchanged(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    from vault_io import staging_path
    moc = layout.root / '00_MOCs/Knowledge_Base_MOC.md'
    stage = staging_path(layout, moc)
    stage.write_text('Preserve this interrupted file', encoding='utf-8')
    before = {str(p): p.read_bytes() for p in layout.root.rglob('*') if p.is_file()}
    with pytest.raises(WriteConflict, match='Staging file already exists'):
        submit_candidate(layout, transcript, candidate(transcript))
    assert before == {str(p): p.read_bytes() for p in layout.root.rglob('*') if p.is_file()}


def test_reference_repair_preserves_human_edit(tmp_path, monkeypatch):
    import session_distiller as module
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    original_write = module.atomic_write
    def fail_secondary(layout, path, text, expected):
        if path.parent.name == '35_Sessions':
            raise OSError('Injected failure')
        return original_write(layout, path, text, expected)
    monkeypatch.setattr(module, 'atomic_write', fail_secondary)
    result = submit_candidate(layout, transcript, candidate(transcript))
    path = layout.root / result['path']
    with path.open('a', encoding='utf-8') as handle:
        handle.write('\nPreserve my authored explanation.\n')
    before = path.read_bytes()
    monkeypatch.setattr(module, 'atomic_write', original_write)
    result = submit_candidate(layout, transcript, candidate(transcript), repair_references=True)
    assert result['status'] == 'repaired' and path.read_bytes() == before


def test_windows_placeholder_and_independent_source_outcomes(tmp_path, monkeypatch):
    from session_providers import default_provider_paths, scan_sessions
    monkeypatch.setenv('CODEX_SESSIONS_PATH', r'%USERPROFILE%\Folder With Spaces\sessions')
    assert str(default_provider_paths()['codex']).endswith(r'Folder With Spaces\sessions')
    transcript = source(tmp_path)
    records, outcomes = scan_sessions(['codex', 'claude'], {'codex': Path(transcript.record.source_path).parent, 'claude': tmp_path / 'absent'})
    assert len(records) == 1 and [o['status'] for o in outcomes] == ['complete', 'error']


def test_long_message_unpaired_tool_and_unsupported_content(tmp_path):
    import json
    transcript = source(tmp_path)
    path = Path(transcript.record.source_path)
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    text = 'Full evidence text ' * 1000
    rows[-1]['payload']['content'][0]['text'] = text
    path.write_text('\n'.join(json.dumps(row) for row in rows), encoding='utf-8')
    parsed = read_session_transcript(transcript.record)
    assert parsed.record.parse_status == 'complete' and parsed.messages[-1].content == text
    rows.append({'type': 'response_item', 'payload': {'type': 'function_call', 'call_id': 'unfinished'}})
    path.write_text('\n'.join(json.dumps(row) for row in rows), encoding='utf-8')
    assert read_session_transcript(transcript.record).record.parse_status == 'partial'
    rows[-1]['payload'] = {'type': 'unsupported_content'}
    path.write_text('\n'.join(json.dumps(row) for row in rows), encoding='utf-8')
    assert read_session_transcript(transcript.record).record.parse_status == 'partial'


def test_policy_change_requires_reload(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    with (layout.root / 'vault.config.yaml').open('a') as handle:
        handle.write('\n# Changed policy revision\n')
    with pytest.raises(WriteConflict, match='policy changed'):
        submit_candidate(layout, transcript, candidate(transcript))


def test_primary_failure_has_no_catalogue_or_artifact(tmp_path, monkeypatch):
    import session_distiller as module
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    before = {str(p): p.read_bytes() for p in layout.root.rglob('*.md')}
    def fail(*args, **kwargs):
        raise OSError('Injected primary failure')
    monkeypatch.setattr(module, 'atomic_write', fail)
    with pytest.raises(OSError, match='primary failure'):
        submit_candidate(layout, transcript, candidate(transcript))
    assert before == {str(p): p.read_bytes() for p in layout.root.rglob('*.md')}


def test_invalid_saved_evidence_cannot_be_reviewed(tmp_path):
    from session_distiller import lifecycle_problems, split_note, note_text
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    result = submit_candidate(layout, transcript, candidate(transcript))
    path = layout.root / result['path']
    data, body = split_note(path.read_text(encoding='utf-8'))
    data['evidence'] = {}
    malformed = note_text(data, body)
    path.write_text(malformed, encoding='utf-8')
    assert 'Invalid saved evidence reference/quote' in lifecycle_problems(malformed)
    with pytest.raises(ValueError, match='saved evidence'):
        review_artifact(layout, result['path'], artifact_revision(malformed), 'Fixture reviewer')
    assert path.read_text(encoding='utf-8') == malformed


def test_unknown_workspace_does_not_invent_repository(tmp_path):
    import json
    transcript = source(tmp_path)
    path = Path(transcript.record.source_path)
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    rows[0]['payload']['cwd'] = str(tmp_path / 'unavailable-workspace')
    path.write_text('\n'.join(json.dumps(row) for row in rows), encoding='utf-8')
    parsed = read_session_transcript(transcript.record)
    assert parsed.record.project == str(tmp_path / 'unavailable-workspace')
    assert parsed.record.repository == ''


def test_codex_0166_metadata_is_counted_and_compaction_remains_partial(tmp_path):
    import json
    transcript = source(tmp_path)
    path = Path(transcript.record.source_path)
    records = [
        {'type': 'world_state', 'payload': {'full': True, 'state': {'cwd': 'synthetic'}}},
        {'type': 'token_usage_record', 'payload': {'usage': {'input_tokens': 1}}},
        {'type': 'response_item', 'payload': {'type': 'additional_tools', 'id': 'synthetic', 'role': 'system', 'tools': []}},
        {'type': 'response_item', 'payload': {'type': 'configuration_update', 'reasoning': {'effort': 'high'}}},
    ]
    with path.open('a', encoding='utf-8') as handle:
        handle.write('\n' + '\n'.join(json.dumps(record) for record in records))
    parsed = read_session_transcript(transcript.record)
    assert parsed.record.parse_status == 'complete' and parsed.record.ignored_events == 6
    with path.open('a', encoding='utf-8') as handle:
        handle.write('\n' + json.dumps({'type': 'response_item', 'payload': {'type': 'compaction', 'summary': 'Not a full history'}}))
    assert read_session_transcript(transcript.record).record.parse_status == 'partial'
