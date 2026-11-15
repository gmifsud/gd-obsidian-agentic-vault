import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { discoverCopilotSessions, getCopilotSessionDetail, parseCopilotConversation } from './copilotSessions.js';

const CONVERSATION = `---
epoch: 1784789741044
modelKey: kimi-k2.7-code|github-copilot
topic: Render Obsidian URL
tags:
  - copilot-conversation
---

**user**: How do I open this URI?

**ai**: Use the Obsidian URI scheme.
`;

test('reads the topic and the messages, and not the frontmatter', () => {
  const parsed = parseCopilotConversation(CONVERSATION);

  assert.equal(parsed.topic, 'Render Obsidian URL');
  assert.equal(parsed.model, 'kimi-k2.7-code|github-copilot');
  assert.deepEqual(parsed.messages.map((message) => message.role), ['user', 'assistant']);
  assert.match(parsed.messages[0].content, /How do I open this URI\?/);
  assert.doesNotMatch(parsed.messages[0].content, /modelKey/);
});

test('uses the agent label when a conversation has no topic', () => {
  const raw = '---\nagentLabel: Mermaid diagrams\nmode: agent\n---\n\n**user**: Straighten the lines.\n';

  assert.equal(parseCopilotConversation(raw).topic, 'Mermaid diagrams');
});

test('lists only conversation files in the conversations directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-sessions-'));
  const conversations = path.join(root, 'copilot-conversations');
  const skills = path.join(root, 'skills');
  fs.mkdirSync(conversations);
  fs.mkdirSync(skills);
  fs.writeFileSync(path.join(conversations, 'chat.md'), CONVERSATION);
  fs.writeFileSync(path.join(skills, 'SKILL.md'), '---\nname: json-canvas\n---\n# Skill\n');

  const sessions = discoverCopilotSessions(conversations);

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].provider, 'copilot');
  assert.equal(sessions[0].project, 'Render Obsidian URL');
  assert.equal(sessions[0].messageCount, 2);
  assert.equal(getCopilotSessionDetail(conversations, '../skills/SKILL'), null);
  assert.equal(getCopilotSessionDetail(conversations, 'chat').messages.length, 2);
});
