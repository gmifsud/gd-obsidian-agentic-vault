// Read Obsidian Copilot conversations for the Sessions page.
//
// The plugin writes these files under copilot/copilot-conversations/. Skills
// and custom prompts live in other folders and are not read here.

import fs from 'fs';
import path from 'path';

import { parseNote } from './note.js';

const ROLE = /\*\*(user|ai|assistant)\*\*:\s*/gi;

/**
 * Split a Copilot conversation into its topic and messages.
 * A conversation whose frontmatter does not parse is still returned, with
 * the file name as the topic and the whole text as one message.
 */
export function parseCopilotConversation(raw, fallbackTopic = 'Copilot conversation') {
  const note = parseNote(raw);
  const data = note.frontmatterError ? {} : note.data;
  const topic = stringField(data, 'topic') || stringField(data, 'agentLabel') || fallbackTopic;
  const body = note.frontmatterError ? raw : note.content;
  return {
    topic,
    model: stringField(data, 'modelKey'),
    startedAt: epochToIso(data.epoch),
    lastModified: epochToIso(data.lastAccessedAt),
    messages: splitMessages(body),
  };
}

/** List the conversations in a Copilot conversations directory. */
export function discoverCopilotSessions(directory) {
  if (!fs.existsSync(directory)) return [];
  const sessions = [];
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith('.md') || name.startsWith('.')) continue;
    const full = path.join(directory, name);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    const parsed = parseCopilotConversation(fs.readFileSync(full, 'utf-8'), name.slice(0, -3));
    sessions.push({
      id: name.slice(0, -3),
      provider: 'copilot',
      project: parsed.topic,
      startedAt: parsed.startedAt || stat.mtime.toISOString(),
      lastModified: parsed.lastModified || stat.mtime.toISOString(),
      messageCount: parsed.messages.length,
      sizeBytes: stat.size,
      sourcePath: full,
    });
  }
  return sessions;
}

/** The messages of one conversation. `id` is the file name without `.md`. */
export function getCopilotSessionDetail(directory, id) {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) return null;
  const root = path.resolve(directory);
  const full = path.resolve(root, `${id}.md`);
  const relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const parsed = parseCopilotConversation(fs.readFileSync(full, 'utf-8'), id);
  return { messages: parsed.messages, sourcePath: full };
}

function stringField(data, key) {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function epochToIso(epoch) {
  const n = Number(epoch);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

function splitMessages(body) {
  ROLE.lastIndex = 0;
  const messages = [];
  let match = ROLE.exec(body);
  if (!match) {
    const text = body.trim();
    return text ? [{ role: 'assistant', content: text, timestamp: '' }] : [];
  }
  while (match) {
    const role = match[1].toLowerCase() === 'user' ? 'user' : 'assistant';
    const start = match.index + match[0].length;
    const next = ROLE.exec(body);
    const content = body.slice(start, next ? next.index : body.length).trim();
    messages.push({ role, content, timestamp: '' });
    match = next;
  }
  ROLE.lastIndex = 0;
  return messages;
}
