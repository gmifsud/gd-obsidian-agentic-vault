import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = express.Router();

// ============================================
// Session Source Paths (configurable via .env)
// ============================================

function resolveEnvPath(envKey, defaultPath) {
  const envValue = process.env[envKey];
  if (envValue) {
    return envValue.replace(/%USERPROFILE%/gi, os.homedir()).replace(/%APPDATA%/gi, process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'));
  }
  return defaultPath;
}

function getSessionPaths() {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

  return {
    claude: resolveEnvPath('CLAUDE_SESSIONS_PATH', path.join(home, '.claude', 'projects')),
    codex: resolveEnvPath('CODEX_SESSIONS_PATH', path.join(home, '.codex', 'sessions')),
    cursor: resolveEnvPath('CURSOR_SESSIONS_PATH', path.join(appData, 'Cursor', 'User', 'workspaceStorage')),
    gemini: resolveEnvPath('GEMINI_SESSIONS_PATH', path.join(home, '.gemini', 'antigravity-ide', 'brain')),
    kilocode: resolveEnvPath('KILOCODE_SESSIONS_PATH', path.join(appData, 'Code', 'User', 'globalStorage', 'kilocode.kilo-code', 'tasks')),
  };
}

// ============================================
// Utility helpers
// ============================================

function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function safeReadLines(p, maxLines = 50) {
  try {
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(16384); // 16KB should be enough for the first few lines
    const bytesRead = fs.readSync(fd, buf, 0, 16384, 0);
    fs.closeSync(fd);
    const content = buf.toString('utf-8', 0, bytesRead);
    const lines = content.split('\n').filter(l => l.trim());
    return maxLines ? lines.slice(0, maxLines) : lines;
  } catch { return []; }
}

function countJsonlLines(p) {
  try {
    // Use a streaming approach — count newlines in 64KB chunks instead of loading entire files
    const fd = fs.openSync(p, 'r');
    const stat = fs.fstatSync(fd);
    const bufSize = 65536;
    const buf = Buffer.alloc(bufSize);
    let count = 0;
    let pos = 0;
    while (pos < stat.size) {
      const bytesRead = fs.readSync(fd, buf, 0, bufSize, pos);
      for (let i = 0; i < bytesRead; i++) {
        if (buf[i] === 10) count++; // 10 = '\n'
      }
      pos += bytesRead;
    }
    fs.closeSync(fd);
    return count || 1; // at least 1 if file has content
  } catch { return 0; }
}

function parseJsonlMessages(filePath, parser) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const messages = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const msg = parser(parsed);
        if (msg) messages.push(msg);
      } catch { /* skip malformed lines */ }
    }
    return messages;
  } catch { return []; }
}

function humanReadableProjectName(encodedName) {
  // Claude encodes project paths: "C--Repos-gd-agileops" → "C:\Repos\gd-agileops"
  // Pattern: drive letter followed by -- is "X:\", subsequent -- are "\", single - stays as-is
  // But some names use single - between segments: "C--Repos-Frontend" → "C:\Repos\Frontend"
  // The encoding is: each path segment is joined by -, drive root uses --
  // Actually the real encoding maps / and \ to - and uses -- only for the drive colon-slash
  // Best approach: replace leading X-- with X:\, then - with \ for path reconstruction
  // BUT this mangles names with real hyphens. So let's just use it as-is for display
  // and only decode the drive prefix.
  return encodedName
    .replace(/^([a-zA-Z])-{2}/, '$1:\\')
    .replace(/-{2}/g, '\\');
}

// ============================================
// Provider: Claude Code
// ============================================

/**
 * Load project metadata from ~/.claude/.claude.json for enrichment.
 * Contains lastSessionId, lastCost, lastSessionFirstPrompt, etc.
 */
function loadClaudeProjectMeta(claudeRoot) {
  const configPath = path.join(claudeRoot, '.claude.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return data.projects || {};
  } catch { return {}; }
}

/**
 * Recursively find all .jsonl files under a directory.
 * Returns array of { filePath, relDir } objects.
 */
function findAllJsonlFiles(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = safeStat(fullPath);
      if (!stat) continue;
      if (stat.isDirectory()) {
        results.push(...findAllJsonlFiles(fullPath, baseDir));
      } else if (entry.endsWith('.jsonl') && stat.isFile()) {
        results.push({ filePath: fullPath, relDir: path.relative(baseDir, dir) });
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

/**
 * Recursively find all .md files under a directory.
 * Returns array of absolute file paths.
 */
function findAllMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = safeStat(fullPath);
      if (!stat) continue;
      if (stat.isDirectory()) {
        results.push(...findAllMdFiles(fullPath));
      } else if (entry.endsWith('.md') && stat.isFile()) {
        results.push(fullPath);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

function discoverClaudeSessions(basePath) {
  const sessions = [];
  const claudeRoot = path.dirname(basePath); // ~/.claude
  if (!fs.existsSync(basePath)) return sessions;

  // Load project metadata for enrichment
  const projectMeta = loadClaudeProjectMeta(claudeRoot);

  try {
    // 1. Scan the global history.jsonl at ~/.claude/history.jsonl
    const globalHistoryPath = path.join(claudeRoot, 'history.jsonl');
    if (fs.existsSync(globalHistoryPath)) {
      const stat = safeStat(globalHistoryPath);
      if (stat && stat.isFile() && stat.size > 0) {
        sessions.push({
          id: '__global_history__',
          provider: 'claude',
          project: '📜 Global History',
          startedAt: stat.birthtime.toISOString(),
          lastModified: stat.mtime.toISOString(),
          messageCount: Math.max(1, Math.round(stat.size / 2000)),
          sizeBytes: stat.size,
          sourcePath: globalHistoryPath,
        });
      }
    }

    // 2. Recursively scan all project directories for .jsonl files
    const projectDirs = fs.readdirSync(basePath).filter(d => {
      const s = safeStat(path.join(basePath, d));
      return s && s.isDirectory();
    });

    for (const projDir of projectDirs) {
      const projPath = path.join(basePath, projDir);
      const projectName = humanReadableProjectName(projDir);

      // Find all JSONL files recursively (catches subagent sessions too)
      const jsonlFiles = findAllJsonlFiles(projPath);

      for (const { filePath, relDir } of jsonlFiles) {
        const stat = safeStat(filePath);
        if (!stat || !stat.isFile() || stat.size === 0) continue;

        const fileName = path.basename(filePath, '.jsonl');
        const sessionId = fileName;

        // Determine if this is a subagent session
        const isSubagent = relDir.includes('subagents');
        const label = isSubagent
          ? `${projectName} [subagent]`
          : projectName;

        sessions.push({
          id: sessionId,
          provider: 'claude',
          project: label,
          startedAt: stat.birthtime.toISOString(),
          lastModified: stat.mtime.toISOString(),
          messageCount: Math.max(1, Math.round(stat.size / 2000)),
          sizeBytes: stat.size,
          sourcePath: filePath,
        });
      }

      // 3. Detect "Cowork" project directories (have MEMORY.md / project_*.md but no JSONL)
      //    These represent Claude Cowork sessions with persistent memory.
      //    MD files can be at root or inside a `memory/` subdirectory.
      if (jsonlFiles.length === 0) {
        const mdFiles = findAllMdFiles(projPath);
        if (mdFiles.length > 0) {
          const totalSize = mdFiles.reduce((sum, fp) => {
            const s = safeStat(fp);
            return sum + (s ? s.size : 0);
          }, 0);
          const dirStat = safeStat(projPath);

          sessions.push({
            id: `cowork-${projDir}`,
            provider: 'claude',
            project: `${projectName} [cowork memory]`,
            startedAt: dirStat ? dirStat.birthtime.toISOString() : new Date().toISOString(),
            lastModified: dirStat ? dirStat.mtime.toISOString() : new Date().toISOString(),
            messageCount: mdFiles.length,
            sizeBytes: totalSize,
            sourcePath: projPath,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Sessions] Error discovering Claude sessions:', err.message);
  }
  return sessions;
}

function getClaudeSessionDetail(basePath, sessionId) {
  const claudeRoot = path.dirname(basePath);

  // Handle global history
  if (sessionId === '__global_history__') {
    const historyPath = path.join(claudeRoot, 'history.jsonl');
    if (!fs.existsSync(historyPath)) return null;
    const messages = parseJsonlMessages(historyPath, claudeMessageParser);
    return { messages, sourcePath: historyPath };
  }

  // Handle cowork memory sessions (id starts with "cowork-")
  if (sessionId.startsWith('cowork-')) {
    const projDir = sessionId.replace('cowork-', '');
    const projPath = path.join(basePath, projDir);
    if (!fs.existsSync(projPath)) return null;

    const mdFiles = findAllMdFiles(projPath).sort();
    const messages = [];
    for (const mdFilePath of mdFiles) {
      try {
        const content = fs.readFileSync(mdFilePath, 'utf-8');
        const fileName = path.basename(mdFilePath);
        messages.push({
          role: 'system',
          content: `📄 **${fileName}**\n\n${content}`,
          timestamp: '',
        });
      } catch { /* skip unreadable */ }
    }
    return { messages, sourcePath: projPath };
  }

  // Standard session: recursively find the matching JSONL
  if (!fs.existsSync(basePath)) return null;

  const allJsonl = findAllJsonlFiles(basePath);
  const match = allJsonl.find(({ filePath }) =>
    path.basename(filePath, '.jsonl') === sessionId
  );

  if (!match) return null;

  const messages = parseJsonlMessages(match.filePath, claudeMessageParser);
  return { messages, sourcePath: match.filePath };
}

/** Shared Claude JSONL message parser */
function claudeMessageParser(entry) {
  if (entry.type === 'human' || entry.role === 'user') {
    const text = typeof entry.message === 'string' ? entry.message :
                 entry.message?.content?.[0]?.text || entry.content || JSON.stringify(entry.message || '');
    return { role: 'user', content: text, timestamp: entry.timestamp || '' };
  }
  if (entry.type === 'assistant' || entry.role === 'assistant') {
    const text = typeof entry.message === 'string' ? entry.message :
                 entry.message?.content?.[0]?.text || entry.content || JSON.stringify(entry.message || '');
    return { role: 'assistant', content: text, timestamp: entry.timestamp || '' };
  }
  if (entry.type === 'tool_use' || entry.type === 'tool_result') {
    return { role: 'tool', content: JSON.stringify(entry, null, 2).slice(0, 2000), timestamp: entry.timestamp || '' };
  }
  // Skip queue-operation and other meta entries
  return null;
}

// ============================================
// Provider: Codex CLI
// ============================================

function discoverCodexSessions(basePath) {
  const sessions = [];
  if (!fs.existsSync(basePath)) return sessions;

  try {
    // Walk YYYY/MM/DD structure
    function walkCodexDir(dir) {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = safeStat(fullPath);
        if (!stat) continue;

        if (stat.isDirectory()) {
          walkCodexDir(fullPath);
        } else if (entry.startsWith('rollout-') && entry.endsWith('.jsonl')) {
          // Parse date and session ID from filename: rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl
          const match = entry.match(/^rollout-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(.+)\.jsonl$/);
          let startedAt = stat.birthtime.toISOString();
          let sessionId = entry.replace('.jsonl', '');

          if (match) {
            const [, date, h, m, s, uuid] = match;
            startedAt = `${date}T${h}:${m}:${s}Z`;
            sessionId = uuid;
          }

          const messageCount = Math.max(1, Math.round(stat.size / 2000));

          sessions.push({
            id: sessionId,
            provider: 'codex',
            project: path.relative(basePath, dir).replace(/\\/g, '/') || 'root',
            startedAt,
            lastModified: stat.mtime.toISOString(),
            messageCount: messageCount,
            sizeBytes: stat.size,
            sourcePath: fullPath,
          });
        }
      }
    }

    walkCodexDir(basePath);
  } catch (err) {
    console.error('[Sessions] Error discovering Codex sessions:', err.message);
  }
  return sessions;
}

function getCodexSessionDetail(basePath, sessionId) {
  if (!fs.existsSync(basePath)) return null;

  // Recursively find the matching rollout file
  function findFile(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = safeStat(fullPath);
      if (!stat) continue;
      if (stat.isDirectory()) {
        const found = findFile(fullPath);
        if (found) return found;
      } else if (entry.includes(sessionId) && entry.endsWith('.jsonl')) {
        return fullPath;
      }
    }
    return null;
  }

  const filePath = findFile(basePath);
  if (!filePath) return null;

  const messages = parseJsonlMessages(filePath, (entry) => {
    if (entry.role === 'user' || entry.type === 'user') {
      const text = typeof entry.content === 'string' ? entry.content :
                   Array.isArray(entry.content) ? entry.content.map(c => c.text || '').join('\n') :
                   JSON.stringify(entry.content || '');
      return { role: 'user', content: text, timestamp: entry.timestamp || '' };
    }
    if (entry.role === 'assistant' || entry.type === 'assistant') {
      const text = typeof entry.content === 'string' ? entry.content :
                   Array.isArray(entry.content) ? entry.content.map(c => c.text || '').join('\n') :
                   JSON.stringify(entry.content || '');
      return { role: 'assistant', content: text, timestamp: entry.timestamp || '' };
    }
    if (entry.type === 'function_call' || entry.type === 'tool_call') {
      return { role: 'tool', content: JSON.stringify(entry, null, 2).slice(0, 2000), timestamp: entry.timestamp || '' };
    }
    return null;
  });

  return { messages, sourcePath: filePath };
}

// ============================================
// Provider: Cursor (SQLite — graceful fallback)
// ============================================

let Database = null;
try {
  Database = (await import('better-sqlite3')).default;
} catch {
  console.warn('[Sessions] better-sqlite3 not available — Cursor session reading disabled. Run: npm install better-sqlite3');
}

function discoverCursorSessions(basePath) {
  const sessions = [];
  if (!fs.existsSync(basePath) || !Database) return sessions;

  try {
    const workspaces = fs.readdirSync(basePath).filter(d => {
      const s = safeStat(path.join(basePath, d));
      return s && s.isDirectory();
    });

    for (const ws of workspaces) {
      const dbPath = path.join(basePath, ws, 'state.vscdb');
      if (!fs.existsSync(dbPath)) continue;

      try {
        const db = new Database(dbPath, { readonly: true, fileMustExist: true });

        // Try to extract workspace folder from workspace.json
        const workspaceJsonPath = path.join(basePath, ws, 'workspace.json');
        let projectName = ws; // fallback to hash
        if (fs.existsSync(workspaceJsonPath)) {
          try {
            const wsJson = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf-8'));
            if (wsJson.folder) {
              projectName = decodeURIComponent(wsJson.folder.replace(/^file:\/\/\//, ''));
            }
          } catch { /* keep hash name */ }
        }

        // Check if ItemTable exists and has chat data
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tableNames = tables.map(t => t.name);

        if (tableNames.includes('ItemTable')) {
          // Look for AI chat history keys
          const chatKeys = db.prepare(
            "SELECT key, length(value) as size FROM ItemTable WHERE key LIKE '%aiChat%' OR key LIKE '%composer%' OR key LIKE '%cursor%chat%'"
          ).all();

          if (chatKeys.length > 0) {
            const stat = safeStat(dbPath);
            const totalSize = chatKeys.reduce((sum, k) => sum + (k.size || 0), 0);

            sessions.push({
              id: ws,
              provider: 'cursor',
              project: projectName,
              startedAt: stat ? stat.birthtime.toISOString() : new Date().toISOString(),
              lastModified: stat ? stat.mtime.toISOString() : new Date().toISOString(),
              messageCount: chatKeys.length,
              sizeBytes: totalSize,
              sourcePath: dbPath,
            });
          }
        }

        db.close();
      } catch (dbErr) {
        // Skip corrupted or locked databases silently
      }
    }
  } catch (err) {
    console.error('[Sessions] Error discovering Cursor sessions:', err.message);
  }
  return sessions;
}

function getCursorSessionDetail(basePath, sessionId) {
  if (!Database) return null;

  const dbPath = path.join(basePath, sessionId, 'state.vscdb');
  if (!fs.existsSync(dbPath)) return null;

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare(
      "SELECT key, value FROM ItemTable WHERE key LIKE '%aiChat%' OR key LIKE '%composer%' OR key LIKE '%cursor%chat%' ORDER BY key"
    ).all();
    db.close();

    const messages = [];
    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        // Cursor stores chat tabs as JSON objects with messages arrays
        if (Array.isArray(data)) {
          for (const tab of data) {
            if (tab.conversation || tab.messages) {
              const msgs = tab.conversation || tab.messages || [];
              for (const m of msgs) {
                messages.push({
                  role: m.role || m.type || 'unknown',
                  content: typeof m.text === 'string' ? m.text : (m.content || JSON.stringify(m).slice(0, 1000)),
                  timestamp: m.timestamp || '',
                });
              }
            }
          }
        } else if (data.messages || data.conversation) {
          const msgs = data.messages || data.conversation || [];
          for (const m of msgs) {
            messages.push({
              role: m.role || m.type || 'unknown',
              content: typeof m.text === 'string' ? m.text : (m.content || JSON.stringify(m).slice(0, 1000)),
              timestamp: m.timestamp || '',
            });
          }
        }
      } catch { /* skip unparseable entries */ }
    }

    return { messages, sourcePath: dbPath };
  } catch {
    return null;
  }
}

// ============================================
// Provider: Gemini / Antigravity
// ============================================

function discoverGeminiSessions(basePath) {
  const sessions = [];
  if (!fs.existsSync(basePath)) return sessions;

  try {
    const convDirs = fs.readdirSync(basePath).filter(d => {
      const s = safeStat(path.join(basePath, d));
      return s && s.isDirectory();
    });

    for (const convId of convDirs) {
      const convPath = path.join(basePath, convId);
      const transcriptPath = path.join(convPath, '.system_generated', 'logs', 'transcript.jsonl');

      if (!fs.existsSync(transcriptPath)) continue;

      const stat = safeStat(transcriptPath);
      if (!stat) continue;

      // Try to read first few lines to get the project context
      const firstLines = safeReadLines(transcriptPath, 5);
      let projectName = convId;

      for (const line of firstLines) {
        try {
          const entry = JSON.parse(line);
          if (entry.content && typeof entry.content === 'string') {
            // Extract project name from early conversation context
            const projectMatch = entry.content.match(/workspace[s]?.*?([cC]:\\[^\s"']+|\/[^\s"']+)/);
            if (projectMatch) {
              projectName = path.basename(projectMatch[1]);
              break;
            }
          }
        } catch { /* skip */ }
      }

      const messageCount = Math.max(1, Math.round(stat.size / 2000));

      sessions.push({
        id: convId,
        provider: 'gemini',
        project: projectName,
        startedAt: stat.birthtime.toISOString(),
        lastModified: stat.mtime.toISOString(),
        messageCount: messageCount,
        sizeBytes: stat.size,
        sourcePath: transcriptPath,
      });
    }
  } catch (err) {
    console.error('[Sessions] Error discovering Gemini sessions:', err.message);
  }
  return sessions;
}

function getGeminiSessionDetail(basePath, sessionId) {
  const transcriptPath = path.join(basePath, sessionId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) return null;

  const messages = parseJsonlMessages(transcriptPath, (entry) => {
    if (entry.type === 'USER_INPUT' || entry.source === 'USER_EXPLICIT') {
      return {
        role: 'user',
        content: (entry.content || '').slice(0, 5000),
        timestamp: entry.created_at || '',
      };
    }
    if (entry.type === 'PLANNER_RESPONSE' || entry.source === 'MODEL') {
      return {
        role: 'assistant',
        content: (entry.content || '').slice(0, 5000),
        timestamp: entry.created_at || '',
      };
    }
    if (entry.type === 'RUN_COMMAND' || entry.type === 'TOOL_RESPONSE') {
      return {
        role: 'tool',
        content: (entry.content || '').slice(0, 2000),
        timestamp: entry.created_at || '',
      };
    }
    return null;
  });

  return { messages, sourcePath: transcriptPath };
}

// ============================================
// Provider: Kilo Code
// ============================================

function discoverKiloCodeSessions(basePath) {
  const sessions = [];
  if (!fs.existsSync(basePath)) return sessions;

  try {
    const taskDirs = fs.readdirSync(basePath).filter(d => {
      const s = safeStat(path.join(basePath, d));
      return s && s.isDirectory();
    });

    for (const taskId of taskDirs) {
      const taskPath = path.join(basePath, taskId);
      const metaPath = path.join(taskPath, 'task_metadata.json');
      const apiPath = path.join(taskPath, 'api_conversation_history.json');
      const uiPath = path.join(taskPath, 'ui_messages.json');

      // At minimum we need the api_conversation_history or ui_messages
      if (!fs.existsSync(apiPath) && !fs.existsSync(uiPath)) continue;

      let projectName = taskId;
      let startedAt = '';
      let messageCount = 0;

      // Read only the first 2KB of task metadata (avoid parsing huge files_in_context arrays)
      if (fs.existsSync(metaPath)) {
        try {
          const fd = fs.openSync(metaPath, 'r');
          const buf = Buffer.alloc(2048);
          const bytesRead = fs.readSync(fd, buf, 0, 2048, 0);
          fs.closeSync(fd);
          const head = buf.toString('utf-8', 0, bytesRead);

          const wpMatch = head.match(/"(?:workspace_path|dirAbsolutePath)"\s*:\s*"([^"]+)"/);
          if (wpMatch) projectName = path.basename(wpMatch[1].replace(/\\\\/g, '\\'));

          const tsMatch = head.match(/"ts"\s*:\s*(\d+)/);
          if (tsMatch) startedAt = new Date(parseInt(tsMatch[1])).toISOString();
        } catch { /* keep defaults */ }
      }

      // Estimate message count from file size (avoid parsing multi-MB JSON during discovery)
      // Each message in api_conversation_history.json averages ~4-6KB
      if (fs.existsSync(apiPath)) {
        const apiStat = safeStat(apiPath);
        if (apiStat) {
          messageCount = Math.max(1, Math.round(apiStat.size / 5000));
        }
      }

      const stat = safeStat(taskPath);
      const totalSize = [metaPath, apiPath, uiPath]
        .map(p => { const s = safeStat(p); return s ? s.size : 0; })
        .reduce((a, b) => a + b, 0);

      sessions.push({
        id: taskId,
        provider: 'kilocode',
        project: projectName,
        startedAt: startedAt || (stat ? stat.birthtime.toISOString() : new Date().toISOString()),
        lastModified: stat ? stat.mtime.toISOString() : new Date().toISOString(),
        messageCount,
        sizeBytes: totalSize,
        sourcePath: taskPath,
      });
    }
  } catch (err) {
    console.error('[Sessions] Error discovering Kilo Code sessions:', err.message);
  }
  return sessions;
}

function getKiloCodeSessionDetail(basePath, sessionId) {
  const taskPath = path.join(basePath, sessionId);
  const uiPath = path.join(taskPath, 'ui_messages.json');
  const apiPath = path.join(taskPath, 'api_conversation_history.json');

  // Prefer UI messages (more human-readable), fall back to API history
  const dataPath = fs.existsSync(uiPath) ? uiPath : apiPath;
  if (!fs.existsSync(dataPath)) return null;

  const data = safeReadJson(dataPath);
  if (!Array.isArray(data)) return null;

  const messages = [];
  for (const entry of data) {
    if (entry.role === 'user' || entry.type === 'say' && entry.say === 'user_feedback') {
      messages.push({
        role: 'user',
        content: typeof entry.text === 'string' ? entry.text :
                 typeof entry.content === 'string' ? entry.content :
                 Array.isArray(entry.content) ? entry.content.map(c => c.text || '').join('\n') :
                 JSON.stringify(entry).slice(0, 2000),
        timestamp: entry.ts ? new Date(entry.ts).toISOString() : '',
      });
    } else if (entry.role === 'assistant' || entry.type === 'say' && entry.say === 'text') {
      messages.push({
        role: 'assistant',
        content: typeof entry.text === 'string' ? entry.text :
                 typeof entry.content === 'string' ? entry.content :
                 Array.isArray(entry.content) ? entry.content.map(c => c.text || '').join('\n') :
                 JSON.stringify(entry).slice(0, 2000),
        timestamp: entry.ts ? new Date(entry.ts).toISOString() : '',
      });
    } else if (entry.role === 'tool' || (entry.type === 'say' && (entry.say === 'tool' || entry.say === 'command'))) {
      messages.push({
        role: 'tool',
        content: (entry.text || JSON.stringify(entry).slice(0, 2000)),
        timestamp: entry.ts ? new Date(entry.ts).toISOString() : '',
      });
    }
  }

  return { messages, sourcePath: dataPath };
}

// ============================================
// Routes
// ============================================

// GET /api/sessions — Unified session list
router.get('/api/sessions', (req, res) => {
  const paths = getSessionPaths();
  const providerFilter = req.query.provider; // optional: ?provider=claude,gemini

  let allSessions = [];

  const providers = providerFilter
    ? providerFilter.split(',').map(p => p.trim().toLowerCase())
    : ['claude', 'codex', 'cursor', 'gemini', 'kilocode'];

  if (providers.includes('claude')) {
    allSessions = allSessions.concat(discoverClaudeSessions(paths.claude));
  }
  if (providers.includes('codex')) {
    allSessions = allSessions.concat(discoverCodexSessions(paths.codex));
  }
  if (providers.includes('cursor')) {
    allSessions = allSessions.concat(discoverCursorSessions(paths.cursor));
  }
  if (providers.includes('gemini')) {
    allSessions = allSessions.concat(discoverGeminiSessions(paths.gemini));
  }
  if (providers.includes('kilocode')) {
    allSessions = allSessions.concat(discoverKiloCodeSessions(paths.kilocode));
  }

  // Sort by lastModified descending
  allSessions.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  res.json({
    total: allSessions.length,
    providers_scanned: providers,
    cursor_available: !!Database,
    sessions: allSessions,
  });
});

// GET /api/sessions/:provider/:id — Full session transcript
router.get('/api/sessions/:provider/:id', (req, res) => {
  const { provider, id } = req.params;
  const paths = getSessionPaths();

  let detail = null;
  switch (provider) {
    case 'claude':
      detail = getClaudeSessionDetail(paths.claude, id);
      break;
    case 'codex':
      detail = getCodexSessionDetail(paths.codex, id);
      break;
    case 'cursor':
      detail = getCursorSessionDetail(paths.cursor, id);
      break;
    case 'gemini':
      detail = getGeminiSessionDetail(paths.gemini, id);
      break;
    case 'kilocode':
      detail = getKiloCodeSessionDetail(paths.kilocode, id);
      break;
    default:
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  if (!detail) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(detail);
});

// ============================================
// Backup & Export Functionality
// ============================================

async function executeBackup(providersList, targetPath) {
  const paths = getSessionPaths();
  const activeProviders = Array.isArray(providersList) && providersList.length > 0
    ? providersList.map(p => p.toLowerCase())
    : ['claude', 'codex', 'cursor', 'gemini', 'kilocode'];

  let backedUpCount = 0;
  const errors = [];

  // Create base backup dir
  try {
    fs.mkdirSync(targetPath, { recursive: true });
  } catch (err) {
    return { success: false, error: `Could not create target directory: ${err.message}` };
  }

  const sanitizeFilename = (name) => name.replace(/[\\/:*?"<>|]/g, '_');

  for (const provider of activeProviders) {
    let sessions = [];
    switch (provider) {
      case 'claude':
        sessions = discoverClaudeSessions(paths.claude);
        break;
      case 'codex':
        sessions = discoverCodexSessions(paths.codex);
        break;
      case 'cursor':
        sessions = discoverCursorSessions(paths.cursor);
        break;
      case 'gemini':
        sessions = discoverGeminiSessions(paths.gemini);
        break;
      case 'kilocode':
        sessions = discoverKiloCodeSessions(paths.kilocode);
        break;
    }

    if (sessions.length > 0) {
      const providerDir = path.join(targetPath, provider);
      try {
        fs.mkdirSync(providerDir, { recursive: true });
      } catch (err) {
        errors.push(`Could not create directory for provider ${provider}: ${err.message}`);
        continue;
      }

      for (const session of sessions) {
        let detail = null;
        try {
          switch (provider) {
            case 'claude':
              detail = getClaudeSessionDetail(paths.claude, session.id);
              break;
            case 'codex':
              detail = getCodexSessionDetail(paths.codex, session.id);
              break;
            case 'cursor':
              detail = getCursorSessionDetail(paths.cursor, session.id);
              break;
            case 'gemini':
              detail = getGeminiSessionDetail(paths.gemini, session.id);
              break;
            case 'kilocode':
              detail = getKiloCodeSessionDetail(paths.kilocode, session.id);
              break;
          }

          if (detail && detail.messages && detail.messages.length > 0) {
            // Build Markdown with frontmatter
            const safeProjectName = sanitizeFilename(session.project);
            const safeSessionId = sanitizeFilename(session.id);
            const fileName = `${safeProjectName}_${safeSessionId}.md`;
            const fileDest = path.join(providerDir, fileName);

            let md = `---\ntype: session-backup\nprovider: ${provider}\nproject: "${session.project.replace(/"/g, '\\"')}"\nsessionId: "${session.id}"\nstartedAt: "${session.startedAt}"\nlastModified: "${session.lastModified}"\n---\n\n`;
            md += `# Session Backup: ${session.project}\n\n`;
            md += `- **Provider**: ${provider}\n`;
            md += `- **Session ID**: \`${session.id}\`\n`;
            md += `- **Date Started**: ${session.startedAt}\n`;
            md += `- **Last Activity**: ${session.lastModified}\n`;
            md += `- **Source Path**: \`${session.sourcePath}\`\n\n`;
            md += `---\n\n`;

            for (const msg of detail.messages) {
              const roleName = msg.role === 'user' ? 'Human' : msg.role === 'assistant' ? 'AI Agent' : msg.role.toUpperCase();
              md += `### 💬 ${roleName} (${msg.timestamp || 'No Timestamp'})\n\n`;
              md += `${msg.content}\n\n`;
              md += `---\n\n`;
            }

            fs.writeFileSync(fileDest, md, 'utf-8');
            backedUpCount++;
          }
        } catch (err) {
          errors.push(`Error backing up session ${session.id} (${provider}): ${err.message}`);
        }
      }
    }
  }

  return {
    success: true,
    backedUpCount,
    totalScannedProviders: activeProviders.length,
    errors: errors.length > 0 ? errors : null
  };
}

// POST /api/sessions/backup — Consolidated backup endpoint
router.post('/api/sessions/backup', async (req, res) => {
  const { providers, targetPath } = req.body;
  if (!targetPath) {
    return res.status(400).json({ error: 'targetPath parameter is required' });
  }
  const result = await executeBackup(providers, targetPath);
  res.json(result);
});

export default router;
