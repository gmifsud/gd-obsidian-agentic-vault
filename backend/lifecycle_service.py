"""Thin JSON boundary shared by the CLI, Control Panel and MCP adapters."""
from dataclasses import asdict
import json
from pathlib import Path
import sys

from knowledge_index import brief_current, search_current
from session_catalogue import catalogue_records
from session_distiller import (KINDS, artifact_revision, export_session, prepare_session,
                              review_artifact, review_state, submit_candidate, template_sections)
from session_providers import PROVIDER_NAMES, find_session, scan_sessions
from vault_io import WriteConflict, preflight
from vault_layout import load_engine_vault


def execute(operation: str, args: dict, layout, db_path=None):
    if not isinstance(args, dict):
        raise ValueError('Arguments must be an object')
    if operation == 'capabilities':
        targets = [d for d in layout.directories_in('right')
                   if d not in ('00_MOCs', '35_Sessions', '80_Templates')
                   and layout.may_agent_write(f'{d}/candidate.md').allowed
                   and (not layout.moc_for(f'{d}/candidate.md') or layout.may_agent_write(layout.moc_for(f'{d}/candidate.md')).allowed)]
        sections, errors = {}, {}
        for kind in KINDS:
            try:
                sections[kind] = template_sections(layout, kind)[1]
            except (ValueError, OSError) as exc:
                errors[kind] = str(exc)
        return {'schema_version': 1, 'vault_root': str(layout.root), 'targets': targets,
                'export_targets': [d for d in layout.directories if layout.may_agent_write(f'{d}/export.md').allowed],
                'sections': sections, 'template_errors': errors,
                'providers': {p: {'browse': True, 'knowledge_qualified': p == 'codex', 'full_export_qualified': p == 'codex'} for p in PROVIDER_NAMES}}
    if operation in ('sessions', 'catalogue', 'backup'):
        providers = args.get('providers') or ['codex']
        if not isinstance(providers, list):
            raise ValueError('providers must be an array')
        records, outcomes = scan_sessions(providers, vault_root=layout.root)
        if args.get('project'):
            records = [r for r in records if args['project'].lower() in r.project.lower()]
        records.sort(key=lambda r: (r.last_modified, r.source_key), reverse=True)
        if operation == 'sessions':
            return {'records': [{**asdict(r), 'source_key': r.source_key} for r in records], 'outcomes': outcomes}
        if operation == 'catalogue':
            limit = args.get('limit', 50)
            if not isinstance(limit, int) or not 1 <= limit <= 500:
                raise ValueError('limit must be 1–500')
            result = catalogue_records(layout, records, limit)
            complete = not result.problems and all(o['status'] == 'complete' for o in outcomes)
            return {'status': 'complete' if complete else 'partial',
                    'written': [p.relative_to(layout.root).as_posix() for p in result.written],
                    'updated': [p.relative_to(layout.root).as_posix() for p in result.updated],
                    'skipped_count': len(result.skipped), 'problems': result.problems, 'outcomes': outcomes}
        if any(p != 'codex' for p in providers):
            raise ValueError('Full evidence export is qualified only for Codex; other providers are browsing-only')
        results = []
        for rec in records:
            try:
                from session_providers import read_session_transcript
                results.append(export_session(layout, read_session_transcript(rec), args['target_dir']))
            except (ValueError, OSError) as exc:
                results.append({'status': 'error', 'source_key': rec.source_key, 'error': str(exc)})
        success = all(r['status'] != 'error' for r in results) and all(o['status'] == 'complete' for o in outcomes)
        return {'success': success, 'results': results, 'outcomes': outcomes,
                'backedUpCount': sum(r['status'] in ('created', 'updated', 'unchanged') for r in results),
                'errors': [r['error'] for r in results if r['status'] == 'error'] + [o['error'] for o in outcomes if o['status'] == 'error']}
    if operation in ('prepare', 'submit', 'export'):
        transcript = find_session(args['provider'], args['session_id'], layout.root, args.get('source_key'))
        if operation == 'prepare':
            return prepare_session(transcript, args.get('offset', 0), args.get('limit', 30))
        if operation == 'export':
            return export_session(layout, transcript, args['target_dir'], args.get('expected_revision'))
        candidate = args.get('candidate')
        if not isinstance(candidate, dict):
            raise ValueError('An evidence-linked candidate object is required; use prepare first')
        return submit_candidate(layout, transcript, candidate, args.get('target_dir', '25_Knowledge_Base'), args.get('expected_revision'),
                                repair_references=args.get('repair_references', False))
    if operation == 'preview':
        path = layout.root / args['path']
        preflight(layout, [path])
        text = path.read_text(encoding='utf-8')
        return {'path': args['path'], 'content': text, 'revision': artifact_revision(text), 'review_state': review_state(text)}
    if operation == 'review':
        if args.get('human_confirmed') is not True:
            raise ValueError('Explicit human confirmation of the preview is required')
        return review_artifact(layout, args['path'], args['expected_revision'], args['reviewer'], revoke=args.get('revoke', False))
    if operation in ('search', 'brief'):
        options = {key: args[key] for key in ('directory', 'tag', 'limit', 'repo', 'include_unreviewed') if key in args}
        if operation == 'search':
            hits, freshness = search_current(layout, args['query'], db_path, **options)
            return {'hits': [asdict(hit) for hit in hits], 'freshness': freshness}
        options.update({key: args[key] for key in ('max_chars', 'include_memory', 'neighbours') if key in args})
        packet, freshness = brief_current(layout, args['query'], db_path, **options)
        return {'briefing': packet, 'characters': len(packet), 'freshness': freshness}
    raise ValueError(f'Unknown operation: {operation}')


def main():
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    try:
        operation = sys.argv[1]
        args = json.loads(sys.stdin.read() or '{}')
        result = execute(operation, args, load_engine_vault())
        payload = {'ok': True, 'result': result}
    except Exception as exc:
        payload = {'ok': False, 'error': str(exc),
                   'code': 409 if isinstance(exc, WriteConflict) else 403 if isinstance(exc, PermissionError) else 400 if isinstance(exc, (ValueError, KeyError)) else 500}
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
