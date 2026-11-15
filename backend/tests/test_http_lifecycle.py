"""Actual Express -> selected interpreter -> Engine acceptance checks."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from test_native_lifecycle import pilot_vault, source, candidate


def test_http_native_browse_draft_review_conflict_and_export(tmp_path):
    layout, transcript = pilot_vault(tmp_path), source(tmp_path)
    with socket.socket() as reserve:
        reserve.bind(('127.0.0.1', 0))
        port = reserve.getsockname()[1]
    env = {**os.environ, 'VAULT_PATH': str(layout.root), 'VITE_API_PORT': str(port),
           'CODEX_SESSIONS_PATH': str(Path(transcript.record.source_path).parent)}
    for name in ('CLAUDE', 'CURSOR', 'GEMINI', 'KILOCODE'):
        env[name + '_SESSIONS_PATH'] = str(tmp_path / 'unavailable')
    server = Path(__file__).parents[2] / 'frontend' / 'server.js'
    process = subprocess.Popen([shutil.which('node'), str(server)], env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    def request(path, body=None):
        req = Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body is not None else None,
                      headers={'Content-Type': 'application/json'})
        try:
            with urlopen(req, timeout=15) as response:
                return response.status, json.load(response)
        except HTTPError as exc:
            return exc.code, json.load(exc)
    try:
        for _ in range(40):
            try:
                status, listing = request('/api/sessions?provider=codex')
                break
            except URLError:
                time.sleep(0.1)
        else:
            raise AssertionError('Fixture API did not start')
        assert status == 200 and listing['sessions'][0]['messageCount'] == 8
        item = listing['sessions'][0]
        assert item['id'] == 'native-sql-alias' and item['project'] == transcript.record.project
        status, detail = request(f"/api/sessions/codex/{item['id']}?sourceKey={item['sourceKey']}")
        assert status == 200 and detail['qualified'] and len(detail['messages']) == 8
        assert detail['messages'][2]['kind'] == 'tool_result'
        args = {'provider': 'codex', 'sessionId': item['id'], 'sourceKey': item['sourceKey'],
                'targetDir': '25_Knowledge_Base', 'candidate': candidate(transcript)}
        status, saved = request('/api/sessions/distill', args)
        assert status == 200 and saved['success'] and saved['review_state'] == 'draft'
        assert request('/api/sessions/distill', args)[1]['status'] == 'unchanged'
        path = layout.root / saved['notePath']
        with path.open('a', encoding='utf-8') as f:
            f.write('\nHuman clarification.\n')
        human = path.read_bytes()
        assert request('/api/sessions/distill', args)[0] == 409
        assert path.read_bytes() == human
        review = {'path': saved['notePath'], 'expected_revision': saved['revision'],
                  'reviewer': 'Automated HTTP fixture reviewer', 'human_confirmed': True}
        assert request('/api/lifecycle/review', review)[0] == 409
        preview = request('/api/lifecycle/preview', {'path': saved['notePath']})[1]
        review['expected_revision'] = preview['revision']
        assert request('/api/lifecycle/review', review)[0] == 200
        assert request('/api/lifecycle/search', {'query': 'alias'})[1]['hits'][0]['review_state'] == 'reviewed'
        export = {'provider': 'codex', 'session_id': item['id'], 'source_key': item['sourceKey'], 'target_dir': '01_Journal'}
        before = {str(p): p.read_bytes() for p in layout.root.rglob('*.md')}
        assert request('/api/lifecycle/export', export)[0] == 403
        assert before == {str(p): p.read_bytes() for p in layout.root.rglob('*.md')}
        export['target_dir'] = '35_Sessions'
        status, exported = request('/api/lifecycle/export', export)
        assert status == 200 and exported['message_count'] == 8
        text = (layout.root / exported['path']).read_text(encoding='utf-8')
        assert all(m.content in text for m in transcript.messages)
        assert request('/api/sessions/backup', {'providers': ['claude'], 'targetPath': '35_Sessions'})[0] == 400
    finally:
        process.terminate()
        process.wait(timeout=10)
