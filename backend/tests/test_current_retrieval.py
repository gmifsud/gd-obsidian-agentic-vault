"""Isolation, freshness and bounded later-task retrieval regression gates."""
from pathlib import Path
import pytest
from test_native_lifecycle import pilot_vault, source, candidate
from session_distiller import submit_candidate, review_artifact
from knowledge_index import brief_current, search_current, cache_path, ensure_index, chunk_markdown_note

EVALUATION = [('SQL alias error', True), ('sub.distance v.distance', True), ('wider query audit', True),
              ('photosynthesis chlorophyll', False), ('volcanic stratigraphy', False)]


def reviewed(layout, transcript):
    result = submit_candidate(layout, transcript, candidate(transcript))
    review_artifact(layout, result['path'], result['revision'], 'Automated fixture reviewer')
    return result


def test_create_review_edit_unreview_delete_reflected_next_query(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    db = tmp_path / 'index.db'
    assert search_current(layout, 'alias', db)[0] == []
    result = submit_candidate(layout, transcript, candidate(transcript))
    assert search_current(layout, 'alias', db)[0] == []
    assert search_current(layout, 'alias', db, include_unreviewed=True)[0][0].review_state == 'draft'
    review_artifact(layout, result['path'], result['revision'], 'Fixture reviewer')
    assert search_current(layout, 'alias', db)[0]
    path = layout.root / result['path']
    original = path.read_text(encoding='utf-8')
    path.write_text(original + '\nHuman update\n', encoding='utf-8')
    assert search_current(layout, 'alias', db)[0] == []
    path.write_text(original, encoding='utf-8')
    review_artifact(layout, result['path'], result['revision'], 'Fixture reviewer', revoke=True)
    assert search_current(layout, 'alias', db)[0] == []
    path.unlink()
    assert search_current(layout, 'alias', db, include_unreviewed=True)[0] == []


def test_cache_owner_and_repository_isolation(tmp_path):
    (tmp_path / 'a').mkdir(); (tmp_path / 'b').mkdir()
    a, b = pilot_vault(tmp_path / 'a'), pilot_vault(tmp_path / 'b')
    transcript = source(tmp_path)
    reviewed(a, transcript)
    db_a, db_b = tmp_path / 'a.db', tmp_path / 'b.db'
    assert cache_path(a) != cache_path(b)
    assert search_current(a, 'alias', db_a, repo=transcript.record.repository)[0]
    assert search_current(a, 'alias', db_a, repo='D:/Repos/other')[0] == []
    assert search_current(b, 'alias', db_b)[0] == []
    with pytest.raises(ValueError, match='owner/schema mismatch'):
        search_current(b, 'alias', db_a)
    assert search_current(a, 'alias', db_a)[0]


def test_refresh_failure_does_not_return_stale_success(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    result = reviewed(layout, transcript)
    db = tmp_path / 'index.db'
    assert search_current(layout, 'alias', db)[0]
    (layout.root / result['path']).write_text('---\ntags: [broken\n---\n', encoding='utf-8')
    with pytest.raises(Exception):
        search_current(layout, 'alias', db)


def test_preamble_fences_and_character_budget(tmp_path):
    raw = '# Title\nPreamble needle\n\n## Real\n```python\n## fake heading\n```\n' + ('long line ' * 1200)
    chunks = chunk_markdown_note('25_Knowledge_Base/test.md', raw)
    assert ''.join(c.content for c in chunks) == raw
    assert all(len(c.content) <= 4000 for c in chunks)
    assert all(c.heading != 'fake heading' for c in chunks)
    layout = pilot_vault(tmp_path)
    (layout.root / '25_Knowledge_Base/test.md').write_text(raw, encoding='utf-8')
    packet, _ = brief_current(layout, 'needle', tmp_path / 'index.db', max_chars=1500, include_unreviewed=True)
    assert len(packet) <= 1500 and 'Preamble needle' in packet and 'omitted' in packet
    tiny, _ = brief_current(layout, 'needle', tmp_path / 'index.db', max_chars=32, include_unreviewed=True)
    assert len(tiny) <= 32 and 'omitted' in tiny


def test_prespecified_evaluation_set_and_usefulness_content(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    result = reviewed(layout, transcript)
    db = tmp_path / 'index.db'
    for query, expected in EVALUATION:
        hits, _ = search_current(layout, query, db)
        assert bool(hits) is expected
        if expected:
            assert result['path'] in [hit.path for hit in hits[:5]]
    packet, metrics = brief_current(layout, 'alias correction', db)
    assert 'Retrying the unchanged query failed' in packet
    assert 'full suite unrun' in packet
    assert 'wider query audit remains open' in packet
    assert 'v.distance' in packet and transcript.record.source_revision in packet
    assert len(packet) <= 12000 and metrics['fresh']


def test_removed_or_changed_source_keeps_labelled_historical_knowledge(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    reviewed(layout, transcript)
    db = tmp_path / 'index.db'
    assert search_current(layout, 'alias', db)[0][0].provenance_status == 'source_revision_available'
    source_path = Path(transcript.record.source_path)
    source_path.write_text('changed', encoding='utf-8')
    assert 'source_changed' in search_current(layout, 'alias', db)[0][0].provenance_status
    source_path.unlink()
    packet, _ = brief_current(layout, 'alias', db)
    assert 'source_unavailable; retained excerpts only' in packet and 'v.distance' in packet


def test_neighbours_respect_scope_review_ambiguity_and_two_note_limit(tmp_path):
    from session_distiller import split_note, note_text, artifact_revision
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    result = reviewed(layout, transcript)
    path = layout.root / result['path']
    base, _ = split_note(path.read_text(encoding='utf-8'))
    def note(relative, text, repo=None, approved=True):
        data = dict(base)
        data['title'] = Path(relative).stem
        data['repo'] = transcript.record.repository if repo is None else repo
        data['review_state'] = 'draft'
        data['review'] = {}
        target = layout.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = note_text(data, text)
        target.write_text(raw, encoding='utf-8')
        if approved:
            review_artifact(layout, relative, artifact_revision(raw), 'Fixture reviewer')
    note('25_Knowledge_Base/RelatedOne.md', 'First related evidence')
    note('25_Knowledge_Base/RelatedTwo.md', 'Second related evidence')
    note('25_Knowledge_Base/Third.md', 'Third must not expand')
    note('25_Knowledge_Base/Other.md', 'Foreign repository fact', repo='D:/Repos/other')
    note('25_Knowledge_Base/Unknown.md', 'Unknown repository fact', repo='')
    note('25_Knowledge_Base/Draft.md', 'Draft fact', approved=False)
    note('25_Knowledge_Base/a/Ambiguous.md', 'Ambiguous first')
    note('25_Knowledge_Base/b/Ambiguous.md', 'Ambiguous second')
    note(result['path'], 'uniqueanchor [[RelatedOne]] [[RelatedTwo]] [[Third]] [[Other]] [[Unknown]] [[Draft]] [[Ambiguous]]')
    packet, _ = brief_current(layout, 'uniqueanchor', tmp_path / 'index.db', neighbours=True, repo=transcript.record.repository)
    assert packet.count('## Related:') == 2
    assert 'First related evidence' in packet and 'Second related evidence' in packet
    assert 'Third must not expand' not in packet and 'Foreign repository fact' not in packet
    assert 'Unknown repository fact' not in packet and 'Draft fact' not in packet
    assert 'Unresolved or ambiguous pointer: [[Ambiguous]]' in packet
