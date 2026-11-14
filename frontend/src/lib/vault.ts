// ============================================
// Vault API Layer — Typed functions for all endpoints
// ============================================

export interface VaultFile {
  path: string;
  name: string;
  basename: string;
  content: string;
  frontmatter: Record<string, any>;
  hemisphere?: string;
  /** Set by the server when the note's frontmatter is not valid YAML. */
  frontmatter_error?: string;
}

export interface VaultStatus {
  vault_path: string;
  total_files: number;
  system_files: Record<string, boolean>;
  hemispheres: {
    left: { folders: string[]; file_count: number };
    right: { folders: string[]; file_count: number };
    assets: { folders: string[]; file_count: number };
  };
  memory_focus: string;
  heartbeat_checked: number;
  heartbeat_total: number;
}

export interface HemisphereData {
  label: string;
  permission: string;
  description: string;
  folders: Record<string, VaultFile[]>;
}

export interface HemispheresResponse {
  left: HemisphereData;
  right: HemisphereData;
  assets: HemisphereData;
}

export interface MOCFile {
  name: string;
  basename: string;
  content: string;
  links: string[];
  link_count: number;
}

export interface TemplateFile {
  name: string;
  basename: string;
  fields: Record<string, any>;
  raw_content: string;
}

export interface SkillEntry {
  name: string;
  skill_file: string;
  description: string;
  content: string;
}

export interface SystemFiles {
  [key: string]: {
    content: string;
    exists: boolean;
  };
}

export interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  hemisphere?: string;
  size?: number;
  children?: TreeNode[];
}

// ============================================
// API Functions
// ============================================

async function apiFetch<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
    console.warn(`[Vault API] ${url} returned ${response.status}`);
    return null;
  } catch (error) {
    console.warn(`[Vault API] Failed to fetch ${url}:`, error);
    return null;
  }
}

export async function getVaultFiles(): Promise<VaultFile[]> {
  // 1. Try fetching from the dynamic Express API server
  const apiFiles = await apiFetch<VaultFile[]>('/api/files');
  if (apiFiles && apiFiles.length > 0) {
    console.log('[Vault Loader] Successfully loaded vault files from API server.');
    return apiFiles;
  }

  // 2. Fallback to build-time static glob (for static hosting/previews)
  // Paths containing '#' are left out: the bundler reads '#' as the start of a
  // URL fragment and cannot resolve them, which fails the whole build.
  const rootModules = import.meta.glob(
    ['../../../vault/**/*.md', '!../../../vault/**/*#*', '!../../../vault/**/*#*/**'],
    { query: '?raw', import: 'default' }
  );
  const files: VaultFile[] = [];

  for (const path in rootModules) {
    if (path.includes('node_modules') || path.includes('.obsidian')) continue;
    
    try {
      const rawContent = await rootModules[path]() as string;
      const { data, content } = parseFrontmatter(rawContent);
      const cleanPath = path.replace('../../../vault/', '');
      const name = cleanPath.split('/').pop() || '';
      const basename = name.replace(/\.md$/, '');

      files.push({ path: cleanPath, name, basename, content, frontmatter: data });
    } catch (e) {
      console.error(`Failed to parse ${path}`, e);
    }
  }
  
  return files;
}

export async function getVaultStatus(): Promise<VaultStatus | null> {
  return apiFetch<VaultStatus>('/api/status');
}

export async function getHemispheres(): Promise<HemispheresResponse | null> {
  return apiFetch<HemispheresResponse>('/api/hemispheres');
}

export async function getMOCs(): Promise<MOCFile[] | null> {
  return apiFetch<MOCFile[]>('/api/mocs');
}

export async function getTemplates(): Promise<TemplateFile[] | null> {
  return apiFetch<TemplateFile[]>('/api/templates');
}

export async function getSkills(): Promise<SkillEntry[] | null> {
  return apiFetch<SkillEntry[]>('/api/skills');
}

export async function getSystemFiles(): Promise<SystemFiles | null> {
  return apiFetch<SystemFiles>('/api/system-files');
}

export async function getFileByPath(filePath: string): Promise<VaultFile | null> {
  return apiFetch<VaultFile>(`/api/file/${encodeURIComponent(filePath)}`);
}

export async function getTree(): Promise<TreeNode | null> {
  return apiFetch<TreeNode>('/api/tree');
}

export interface OrchestratorResult {
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export async function runOrchestratorCommand(command: string, args: string[]): Promise<OrchestratorResult | null> {
  try {
    const response = await fetch('/api/orchestrator/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command, args }),
    });
    if (response.ok) {
      return await response.json();
    }
    console.warn(`[Vault API] Run orchestrator command failed with status ${response.status}`);
    return null;
  } catch (error) {
    console.warn('[Vault API] Failed to run orchestrator command:', error);
    return null;
  }
}

// ============================================
// Session Explorer API Layer
// ============================================

export type SessionProvider = 'claude' | 'codex' | 'cursor' | 'gemini' | 'kilocode';

export interface SessionSummary {
  id: string;
  provider: SessionProvider;
  project: string;
  startedAt: string;
  lastModified: string;
  messageCount: number;
  sizeBytes: number;
  sourcePath: string;
}

export interface SessionListResponse {
  total: number;
  providers_scanned: string[];
  cursor_available: boolean;
  sessions: SessionSummary[];
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'tool' | 'system' | string;
  content: string;
  timestamp: string;
}

export interface SessionDetail {
  messages: SessionMessage[];
  sourcePath: string;
}

export async function fetchSessions(providers?: SessionProvider[]): Promise<SessionListResponse | null> {
  const params = providers ? `?provider=${providers.join(',')}` : '';
  return apiFetch<SessionListResponse>(`/api/sessions${params}`);
}

export async function fetchSessionDetail(provider: string, id: string): Promise<SessionDetail | null> {
  return apiFetch<SessionDetail>(`/api/sessions/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`);
}

export interface BackupResponse {
  success: boolean;
  backedUpCount?: number;
  totalScannedProviders?: number;
  error?: string;
  errors?: string[] | null;
}

export async function backupSessions(providers: SessionProvider[], targetPath: string): Promise<BackupResponse | null> {
  try {
    const res = await fetch('/api/sessions/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers, targetPath }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || 'Server error' };
    }
    return res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network connection error' };
  }
}

// ============================================
// Frontmatter Parser (browser-safe fallback)
// ============================================

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  
  const yaml = match[1];
  const content = match[2];
  const data: Record<string, any> = {};
  
  let currentKey = '';
  const lines = yaml.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Multi-line array item (starts with -)
    if (trimmed.startsWith('- ') && currentKey && Array.isArray(data[currentKey])) {
      data[currentKey].push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.slice(0, colonIndex).trim();
      let value: any = line.slice(colonIndex + 1).trim();
      
      if (!value || value === '') {
        // Could be a multi-line array — initialize as empty array
        data[key] = [];
        currentKey = key;
        continue;
      }
      
      // Inline array [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        value = value.replace(/^["']|["']$/g, '');
        // Boolean parsing
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
      }
      
      data[key] = value;
      currentKey = key;
    }
  }
  
  return { data, content };
}

// ============================================
// Vault layout: Zone classification
// ============================================
// The layout comes from the Vault's vault.config.yaml via the API server.
// The browser holds no directory lists of its own.

export type Zone = 'left' | 'right' | 'assets';

export interface VaultLayoutInfo {
  directories: Record<string, Zone>;
  zones: Record<Zone, string[]>;
  unmanaged: string[];
  system_files: { required: string[]; optional: string[] };
}

let vaultLayout: VaultLayoutInfo | null = null;

/**
 * Fetch the Vault layout once, before rendering.
 * - Throws if the server reports that the Vault's layout is missing or invalid.
 * - Resolves to null when there is no API server (static hosting); paths then
 *   have no Zone and are classified as 'system'.
 */
export async function loadVaultLayout(): Promise<VaultLayoutInfo | null> {
  let response: Response;
  try {
    response = await fetch('/api/layout');
  } catch {
    return null;
  }
  const body = await response.json().catch(() => null);
  if (response.ok && body?.directories) {
    vaultLayout = body as VaultLayoutInfo;
    return vaultLayout;
  }
  if (body?.error) {
    throw new Error(body.error);
  }
  return null;
}

export function getHemisphereForPath(filePath: string): Zone | 'system' {
  const topFolder = filePath.split('/')[0];
  return vaultLayout?.directories[topFolder] ?? 'system';
}

/** The directories the layout places in a Zone (empty when no layout is loaded). */
export function getZoneDirectories(zone: Zone): string[] {
  return vaultLayout?.zones[zone] ?? [];
}

export function getHemisphereColor(hemisphere: string): string {
  switch (hemisphere) {
    case 'left': return 'var(--color-left-hemisphere)';
    case 'right': return 'var(--color-right-hemisphere)';
    case 'assets': return 'var(--color-archive)';
    case 'system': return 'var(--color-system)';
    default: return 'var(--color-text-muted)';
  }
}
