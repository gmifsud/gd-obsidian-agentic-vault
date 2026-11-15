// Tests for the Control Panel's Vault layout reader. Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readVaultLayout, VaultLayoutError, CONFIG_FILENAME } from './vaultLayout.js';

const LAYOUT_YAML = `
generated_by: test
layout:
  directories:
    01_Journal:      { zone: left,   agent_writable: false, moc: null }
    10_Repositories: { zone: right,  agent_writable: true,  moc: Repositories_MOC.md }
    90_Assets:       { zone: assets, agent_writable: true,  moc: null }
  overrides:
    01_Journal/Reviews: { agent_writable: true }
  unmanaged:
    - copilot
  system_files:
    required:
      SOUL.md:   { agent_writable: false }
      MEMORY.md: { agent_writable: true }
    optional:
      README.md: { agent_writable: false }
`;

function makeVault(configText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-layout-'));
  if (configText !== undefined) {
    fs.writeFileSync(path.join(dir, CONFIG_FILENAME), configText, 'utf-8');
  }
  return dir;
}

test('reads zones, unmanaged directories and system files', () => {
  const layout = readVaultLayout(makeVault(LAYOUT_YAML));

  assert.deepEqual(layout.zones, { left: ['01_Journal'], right: ['10_Repositories'], assets: ['90_Assets'] });
  assert.deepEqual(layout.unmanaged, ['copilot']);
  assert.deepEqual(layout.systemFiles.required, ['SOUL.md', 'MEMORY.md']);
  assert.deepEqual(layout.systemFiles.all, ['SOUL.md', 'MEMORY.md', 'README.md']);
});

test('classifies paths by zone', () => {
  const layout = readVaultLayout(makeVault(LAYOUT_YAML));

  assert.equal(layout.zoneOf('01_Journal/Reviews/week.md'), 'left');
  assert.equal(layout.zoneOf('10_Repositories\\repo.md'), 'right');
  assert.equal(layout.zoneOf('90_Assets/diagram.png'), 'assets');
  assert.equal(layout.zoneOf('SOUL.md'), 'system');
});

test('only root files and declared directories are readable', () => {
  const layout = readVaultLayout(makeVault(LAYOUT_YAML));

  assert.equal(layout.isReadable('SOUL.md'), true);
  assert.equal(layout.isReadable('10_Repositories/deep/repo.md'), true);
  assert.equal(layout.isReadable('copilot/chat.md'), false);
  assert.equal(layout.isReadable('Connections/Tokens/key.md'), false);
  assert.equal(layout.isReadable('.obsidian/app.json'), false);
  assert.equal(layout.isReadable('.env'), false);
  assert.equal(layout.isReadable('10_Repositories/repo/.cursor/skills/note.md'), false);
  assert.equal(layout.isReadable('10_Repositories/repo/.hidden.md'), false);
  assert.equal(layout.isReadable('10_Repositories/../../outside.md'), false);
  assert.equal(layout.isReadable(''), false);
});

test('serialises the display facts for the browser', () => {
  const sent = JSON.parse(JSON.stringify(readVaultLayout(makeVault(LAYOUT_YAML))));

  assert.deepEqual(sent.directories, { '01_Journal': 'left', '10_Repositories': 'right', '90_Assets': 'assets' });
  assert.deepEqual(sent.system_files, { required: ['SOUL.md', 'MEMORY.md'], optional: ['README.md'] });
});

test('fails loudly when the config file is missing', () => {
  assert.throws(() => readVaultLayout(makeVault()), (error) =>
    error instanceof VaultLayoutError && /Vault layout missing/.test(error.message));
});

test('fails loudly when the config has no layout section', () => {
  assert.throws(() => readVaultLayout(makeVault('generated_by: architect_generator\n')), (error) =>
    error instanceof VaultLayoutError && /no 'layout' section/.test(error.message));
});

test('fails loudly on invalid YAML', () => {
  assert.throws(() => readVaultLayout(makeVault('layout: [unclosed')), (error) =>
    error instanceof VaultLayoutError && /not valid YAML/.test(error.message));
});

test('fails loudly when a directory has no valid zone', () => {
  const broken = LAYOUT_YAML.replace('zone: assets', 'zone: archive');
  assert.throws(() => readVaultLayout(makeVault(broken)), (error) =>
    error instanceof VaultLayoutError && /90_Assets: zone must be one of/.test(error.message));
});

test('reads the Blueprint layout', () => {
  const blueprint = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vault');
  const layout = readVaultLayout(blueprint);

  assert.equal(layout.zoneOf('90_Assets/x.png'), 'assets');
  assert.deepEqual(layout.unmanaged, ['copilot']);
  assert.equal(layout.isReadable('Connections/Tokens'), false);
});
