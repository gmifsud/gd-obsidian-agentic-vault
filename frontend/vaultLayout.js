// Vault layout reader for the Control Panel.
//
// Reads the display facts from a Vault's vault.config.yaml: which Zone each
// directory is in, which directories are unmanaged, and which root files are
// system files. It holds no rules of its own: validation of the file and the
// write-permission question belong to the Engine (backend/vault_layout.py).
//
// There is no built-in default. A Vault without a usable layout is an error.

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export const CONFIG_FILENAME = 'vault.config.yaml';
export const ZONES = ['left', 'right', 'assets'];

export class VaultLayoutError extends Error {}

/** Dot-directories and dot-files are never Vault content, at any depth. */
export function isHiddenEntry(name) {
  return name.startsWith('.');
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read the layout of the Vault at `vaultPath`.
 * Throws VaultLayoutError if the file is missing or lacks the fields used here.
 */
export function readVaultLayout(vaultPath) {
  const configPath = path.join(vaultPath, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    throw new VaultLayoutError(
      `Vault layout missing: ${configPath} does not exist. ` +
      `Copy the 'layout' section from the Blueprint's ${CONFIG_FILENAME} and adjust it.`
    );
  }

  let config;
  try {
    config = yaml.safeLoad(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    throw new VaultLayoutError(`Vault layout unreadable: ${configPath} is not valid YAML: ${error.message}`);
  }

  const layout = isMapping(config) ? config.layout : undefined;
  if (!isMapping(layout)) {
    throw new VaultLayoutError(`Vault layout missing: ${configPath} has no 'layout' section.`);
  }
  if (!isMapping(layout.directories) || !isMapping(layout.system_files) ||
      !isMapping(layout.system_files.required) || !isMapping(layout.system_files.optional)) {
    throw new VaultLayoutError(
      `Vault layout invalid: ${configPath} must define layout.directories and layout.system_files ` +
      `(required and optional). Run "python backend/vault_manager.py validate" for details.`
    );
  }

  const directories = {};
  const zones = { left: [], right: [], assets: [] };
  for (const [name, spec] of Object.entries(layout.directories)) {
    const zone = isMapping(spec) ? spec.zone : undefined;
    if (!ZONES.includes(zone)) {
      throw new VaultLayoutError(
        `Vault layout invalid: ${configPath}: directories.${name}: zone must be one of ${ZONES.join(', ')}.`
      );
    }
    directories[name] = zone;
    zones[zone].push(name);
  }

  const unmanaged = Array.isArray(layout.unmanaged) ? layout.unmanaged : [];
  const required = Object.keys(layout.system_files.required);
  const optional = Object.keys(layout.system_files.optional);

  return {
    /** Top-level directory name → Zone. */
    directories,
    /** Zone → its directories, in file order. */
    zones,
    unmanaged,
    systemFiles: { required, optional, all: [...required, ...optional] },

    /** Classify a Vault-relative path: a Zone, or 'system' for anything outside the Zones. */
    zoneOf(relativePath) {
      const top = relativePath.replace(/\\/g, '/').split('/')[0];
      return directories[top] || 'system';
    },

    /**
     * Whether the Control Panel may read a Vault-relative path: files at the
     * root, and anything inside a declared directory. Unmanaged and undeclared
     * directories are never read, nor is a dot-directory or dot-file at any depth.
     */
    isReadable(relativePath) {
      const segments = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
      if (segments.length === 0 || segments.includes('..')) return false;
      if (segments.some(isHiddenEntry)) return false;
      if (segments.length === 1) return true;
      return Object.prototype.hasOwnProperty.call(directories, segments[0]);
    },

    /** The layout as sent to the browser. */
    toJSON() {
      return { directories, zones, unmanaged, system_files: { required, optional } };
    },
  };
}
