export interface VaultFile {
  path: string;
  name: string;
  basename: string;
  content: string;
  frontmatter: Record<string, any>;
}

export async function getVaultFiles(): Promise<VaultFile[]> {
  // Fetch all markdown files in the project root
  const rootModules = import.meta.glob('../../../vault/**/*.md', { query: '?raw', import: 'default' });
  
  const files: VaultFile[] = [];

  for (const path in rootModules) {
    // Ignore node_modules and Obsidian internal files
    if (path.includes('node_modules') || path.includes('.obsidian')) continue;
    
    try {
      const rawContent = await rootModules[path]() as string;
      const { data, content } = parseFrontmatter(rawContent);
      // Get a clean path relative to the vault root
      const cleanPath = path.replace('../../../vault/', '');
      const name = cleanPath.split('/').pop() || '';
      const basename = name.replace(/\.md$/, '');

      files.push({
        path: cleanPath,
        name,
        basename,
        content,
        frontmatter: data
      });
    } catch (e) {
      console.error(`Failed to parse ${path}`, e);
    }
  }
  
  return files;
}

// A safe, browser-compatible frontmatter parser
function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  
  const yaml = match[1];
  const content = match[2];
  const data: Record<string, any> = {};
  
  yaml.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Basic array parsing
      if (value.startsWith('[') && value.endsWith(']')) {
         value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, '')) as any;
      } else {
         value = value.replace(/^"|"$/g, '') as any;
      }
      data[key] = value;
    }
  });
  
  return { data, content };
}
