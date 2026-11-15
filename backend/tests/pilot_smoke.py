"""Manual local pilot setup and actual Codex MCP-client check; no model turn.

Run with the repository interpreter. All products/logs live in ignored runtime-cache.
Synthetic fixture review here is automated test evidence, not human acceptance.
"""
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from test_native_lifecycle import pilot_vault, source, candidate
from session_distiller import submit_candidate, review_artifact
from vault_layout import VaultLayout


def setup():
    root = Path(tempfile.mkdtemp(prefix='pilot-', dir=BACKEND / 'runtime-cache'))
    (root / 'blueprint-parent').mkdir()
    blueprint = pilot_vault(root / 'blueprint-parent')
    target = root / 'generated-vault'
    generated = subprocess.run([sys.executable, str(BACKEND / 'architect_generator.py'), str(target),
                                '--from-vault', str(blueprint.root)], capture_output=True, text=True, encoding='utf-8')
    if generated.returncode:
        raise RuntimeError(generated.stderr + generated.stdout)
    transcript = source(root)
    layout = VaultLayout.load(target)
    draft = candidate(transcript)
    result = submit_candidate(layout, transcript, draft)
    review_artifact(layout, result['path'], result['revision'], 'Automated pilot fixture reviewer')
    (root / 'candidate.json').write_text(json.dumps(draft, indent=2), encoding='utf-8')
    metadata = {'root': str(root), 'vault': str(target), 'store': str(Path(transcript.record.source_path).parent),
                'session_id': transcript.record.session_id, 'source_key': transcript.record.source_key,
                'artifact': result['path'], 'revision': result['revision'], 'repository': transcript.record.repository}
    (root / 'pilot.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps(metadata), flush=True)
    return metadata


def toml(value):
    if isinstance(value, dict):
        return '{' + ','.join(json.dumps(k) + '=' + toml(v) for k, v in value.items()) + '}'
    if isinstance(value, list):
        return '[' + ','.join(toml(v) for v in value) + ']'
    return json.dumps(value)


def check_codex(metadata, executable):
    root, target = Path(metadata['root']), Path(metadata['vault'])
    generated = json.loads((target / 'claude.json').read_text())['mcpServers']['vau-m-engine']
    assert Path(generated['command']).resolve() == Path(sys.executable).resolve()
    assert Path(generated['env']['VAULT_PATH']).resolve() == target.resolve()
    generated['env']['PATH'] = str(root / 'deliberately-missing-path')
    args = [executable, '-c', 'mcp_servers=' + toml({'vau-m-engine': generated}),
            '-c', 'plugins={}', '-c', 'features.apps=false', '-c', 'features.plugins=false',
            'app-server', '--stdio']
    process = subprocess.Popen(args, cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, encoding='utf-8')
    messages, errors = queue.Queue(), []
    def stdout():
        for line in process.stdout:
            try: messages.put(json.loads(line))
            except ValueError: pass
    def stderr():
        for line in process.stderr:
            if len(errors) < 30: errors.append(line.strip())
    threading.Thread(target=stdout, daemon=True).start()
    threading.Thread(target=stderr, daemon=True).start()
    request_id = 0
    def request(method, params):
        nonlocal request_id
        request_id += 1
        process.stdin.write(json.dumps({'id': request_id, 'method': method, 'params': params}) + '\n')
        process.stdin.flush()
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            try: message = messages.get(timeout=1)
            except queue.Empty:
                if process.poll() is not None: raise RuntimeError('Codex exited: ' + '\n'.join(errors))
                continue
            if message.get('id') == request_id and ('result' in message or 'error' in message):
                if 'error' in message: raise RuntimeError(json.dumps(message['error']))
                return message['result']
            if 'method' in message and 'id' in message:
                # No approval/tool execution is authorised by this client test.
                process.stdin.write(json.dumps({'id': message['id'], 'error': {'code': -32601, 'message': 'Not supported by read-only pilot'}}) + '\n')
                process.stdin.flush()
        raise TimeoutError(f'{method}: no response; ' + '\n'.join(errors))
    try:
        init = request('initialize', {'clientInfo': {'name': 'vaum_pilot_check', 'version': '1.0'}, 'capabilities': {'experimentalApi': True}})
        process.stdin.write('{"method":"initialized","params":{}}\n'); process.stdin.flush()
        thread = request('thread/start', {'cwd': str(root), 'ephemeral': True, 'approvalPolicy': 'never',
                                         'sandbox': 'read-only', 'environments': [],
                                         'config': {'mcp_servers': {'vau-m-engine': generated}, 'plugins': {}}})
        thread_id = thread['thread']['id']
        inventory = request('mcpServerStatus/list', {'threadId': thread_id, 'serverName': 'vau-m-engine'})
        call_started = time.perf_counter()
        call = request('mcpServer/tool/call', {'threadId': thread_id, 'server': 'vau-m-engine',
                                             'tool': 'vault_brief', 'arguments': {'query': 'SQL alias correction', 'repo': metadata['repository']}})
        call_elapsed_ms = round((time.perf_counter() - call_started) * 1000, 2)
        assert not call.get('isError'), call
        output = json.loads(call['content'][0]['text'])
        assert 'v.distance' in output['briefing'] and metadata['artifact'] in output['briefing']
        report = {'client': init, 'inventory': inventory, 'call': call, 'model_turns': 0,
                  'target_vault': str(target), 'unrelated_cwd': str(root), 'misleading_engine_PATH': True,
                  'brief_call_elapsed_ms': call_elapsed_ms}
        (root / 'mcp-evidence.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps({'mcp_client': 'passed', 'report': str(root / 'mcp-evidence.json'), 'characters': output['characters'],
                          'brief_call_elapsed_ms': call_elapsed_ms, 'freshness': output['freshness']}), flush=True)
    finally:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill()


if __name__ == '__main__':
    metadata = setup() if len(sys.argv) < 3 else json.loads(Path(sys.argv[2]).read_text())
    if len(sys.argv) > 1:
        check_codex(metadata, sys.argv[1])
