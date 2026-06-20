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
}

export interface VaultStatus {
  vault_path: string;
  total_files: number;
  system_files: Record<string, boolean>;
  hemispheres: {
    left: { folders: string[]; file_count: number };
    right: { folders: string[]; file_count: number };
    archive: { folders: string[]; file_count: number };
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
  archive: HemisphereData;
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
  const rootModules = import.meta.glob('../../../vault/**/*.md', { query: '?raw', import: 'default' });
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
// Utility: Hemisphere classification
// ============================================

const LEFT_DIRS = ['01_Journal', '02_Human_Thoughts'];
const RIGHT_DIRS = [
  '00_MOCs', '10_Repositories', '15_Prototype_Designs', '20_DevOps',
  '25_Knowledge_Base', '30_Git', '40_Agent_Skills', '50_Databases',
  '60_Canvas_Maps', '80_Templates'
];
const ARCHIVE_DIRS = ['90_Assets'];

export function getHemisphereForPath(filePath: string): 'left' | 'right' | 'archive' | 'system' {
  const topFolder = filePath.split('/')[0];
  if (LEFT_DIRS.includes(topFolder)) return 'left';
  if (RIGHT_DIRS.includes(topFolder)) return 'right';
  if (ARCHIVE_DIRS.includes(topFolder)) return 'archive';
  return 'system';
}

export function getHemisphereColor(hemisphere: string): string {
  switch (hemisphere) {
    case 'left': return 'var(--color-left-hemisphere)';
    case 'right': return 'var(--color-right-hemisphere)';
    case 'archive': return 'var(--color-archive)';
    case 'system': return 'var(--color-system)';
    default: return 'var(--color-text-muted)';
  }
}
