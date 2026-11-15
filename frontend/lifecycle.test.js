import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEngineOutput, sessionSummary } from './lifecycle.js';

test('malformed or accidental log stdout cannot become HTTP success', () => {
  for (const stdout of ['saved.md', '{}', 'log\n{"ok":true,"result":{}}', '{"ok":true}']) {
    assert.throws(() => parseEngineOutput(stdout), error => error.statusCode === 502);
  }
});

test('Engine conflicts retain their conflict status and partial persistence remains visible', () => {
  assert.throws(() => parseEngineOutput('{"ok":false,"code":409,"error":"revision changed"}'),
    error => error.statusCode === 409 && error.message === 'revision changed');
  const partial = { status: 'partial', persisted: ['25_Knowledge_Base/a.md'], error: 'MOC denied' };
  assert.deepEqual(parseEngineOutput(JSON.stringify({ ok: true, result: partial })), partial);
});

test('Codex list adapter preserves identity, parse state and actual zero count', () => {
  const result = sessionSummary({ session_id: 'native-id', source_key: 'store-a', source_revision: 'hash',
    parse_status: 'empty', message_count: 0, project: 'D:/Repos/example' });
  assert.equal(result.id, 'native-id');
  assert.equal(result.sourceKey, 'store-a');
  assert.equal(result.messageCount, 0);
  assert.equal(result.parseStatus, 'empty');
});
