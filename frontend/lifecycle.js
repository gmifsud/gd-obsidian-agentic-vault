import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const interpreter = path.resolve(directory, process.platform === 'win32'
  ? '../backend/venv/Scripts/python.exe' : '../backend/venv/bin/python');
const script = path.resolve(directory, '../backend/lifecycle_service.py');

export function parseEngineOutput(stdout) {
  let payload;
  try { payload = JSON.parse(stdout); }
  catch { throw Object.assign(new Error('Engine returned malformed JSON'), { statusCode: 502 }); }
  if (!payload || typeof payload.ok !== 'boolean' || (payload.ok && (!payload.result || typeof payload.result !== 'object'))) {
    throw Object.assign(new Error('Engine returned an invalid response contract'), { statusCode: 502 });
  }
  if (!payload.ok) throw Object.assign(new Error(payload.error || 'Engine operation failed'), { statusCode: payload.code || 500 });
  return payload.result;
}

export function engineCall(operation, args, vaultRoot = path.resolve(directory, process.env.VAULT_PATH || '../vault')) {
  return new Promise((resolve, reject) => {
    const child = execFile(interpreter, [script, operation], {
      cwd: directory, env: { ...process.env, VAULT_PATH: path.resolve(vaultRoot), PYTHONIOENCODING: 'utf-8' },
      windowsHide: true, timeout: 60000, maxBuffer: 32 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) return reject(Object.assign(new Error(stderr.trim() || error.message), { statusCode: 502 }));
      try { resolve(parseEngineOutput(stdout)); } catch (failure) { reject(failure); }
    });
    child.stdin.on('error', () => { /* execFile callback reports launch/pipe failure */ });
    child.stdin.end(JSON.stringify(args));
  });
}

export function lifecycleError(res, error) {
  return res.status(error.statusCode || 500).json({ success: false, error: error.message });
}

export function sessionSummary(record) {
  return { id: record.session_id, provider: record.provider, project: record.project, topic: record.topic,
    startedAt: record.started_at, lastModified: record.last_modified, messageCount: record.message_count,
    sizeBytes: record.size_bytes, sourcePath: record.source_path, sourceKey: record.source_key,
    sourceRevision: record.source_revision, parseStatus: record.parse_status, diagnostics: record.diagnostics };
}
