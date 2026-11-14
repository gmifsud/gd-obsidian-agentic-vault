// Tests for Control Panel note parsing. Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseNote } from './note.js';

test('splits valid frontmatter from the body', () => {
  const note = parseNote('---\ntype: moc\ntags: [a, b]\n---\n# Title\n');

  assert.deepEqual(note.data, { type: 'moc', tags: ['a', 'b'] });
  assert.equal(note.content, '# Title\n');
  assert.equal(note.frontmatterError, null);
});

test('a note without frontmatter is all body', () => {
  const note = parseNote('# Title\n');

  assert.deepEqual(note.data, {});
  assert.equal(note.content, '# Title\n');
  assert.equal(note.frontmatterError, null);
});

test('invalid frontmatter is reported, and the note is still returned whole', () => {
  const raw = '---\nsummary: *Summary:** broken alias\n---\n# Title\n';

  const note = parseNote(raw);

  assert.deepEqual(note.data, {});
  assert.equal(note.content, raw);
  assert.match(note.frontmatterError, /alias/);
});

test('the same bad note is reported every time it is parsed', () => {
  const raw = '---\nsummary: *Summary:** repeated\n---\n# Title\n';

  const first = parseNote(raw);
  const second = parseNote(raw);

  assert.match(first.frontmatterError, /alias/);
  assert.equal(second.frontmatterError, first.frontmatterError);
});

test('a bad note does not affect the next note parsed', () => {
  parseNote('---\nsummary: *Summary:** broken alias\n---\n');

  assert.deepEqual(parseNote('---\ntype: moc\n---\nbody').data, { type: 'moc' });
});
