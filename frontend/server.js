import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import matter from 'gray-matter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Parse VAULT_PATH (resolve relative to frontend directory)
const vaultPath = path.resolve(__dirname, process.env.VAULT_PATH || '../vault');
console.log(`[Vault Server] Target Vault directory: ${vaultPath}`);

app.use(express.json());

// Helper function to recursively retrieve all markdown files
function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.obsidian' || file === '.git' || file === '.generated') {
      continue;
    }
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// API endpoint to retrieve all files and their parsed frontmatter
app.get('/api/files', (req, res) => {
  try {
    const mdFiles = walkDir(vaultPath);
    const files = [];

    for (const fpath of mdFiles) {
      const rawContent = fs.readFileSync(fpath, 'utf-8');
      const { data, content } = matter(rawContent);
      
      const relativePath = path.relative(vaultPath, fpath).replace(/\\/g, '/');
      const name = path.basename(fpath);
      const basename = name.replace(/\.md$/, '');

      files.push({
        path: relativePath,
        name,
        basename,
        content,
        frontmatter: data
      });
    }

    res.json(files);
  } catch (error) {
    console.error('[Vault Server] Error parsing vault files:', error);
    res.status(500).json({ error: 'Failed to read vault files' });
  }
});

// --- Hemisphere classification helper ---
const LEFT_FOLDERS = ['01_Journal', '02_Human_Thoughts'];
const RIGHT_FOLDERS = ['00_MOCs', '10_Repositories', '15_Prototype_Designs', '20_DevOps', '25_Knowledge_Base', '30_Git', '40_Agent_Skills', '50_Databases', '60_Canvas_Maps', '80_Templates'];
const ARCHIVE_FOLDERS = ['90_Assets'];
const SYSTEM_FILES = ['CLAUDE.md', 'SOUL.md', 'MEMORY.md', 'USER.md', 'HEARTBEAT.md', 'AGENT_INSTRUCTIONS.md', 'README.md'];

function getHemisphere(folderName) {
  if (LEFT_FOLDERS.includes(folderName)) return 'left';
  if (RIGHT_FOLDERS.includes(folderName)) return 'right';
  if (ARCHIVE_FOLDERS.includes(folderName)) return 'archive';
  return 'system';
}

// --- Helper: build nested directory tree ---
function buildTree(dir, rootDir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.obsidian' || entry === '.git' || entry === '.generated') {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const node = { name: entry, type: 'folder', children: buildTree(fullPath, rootDir) };
      // Tag top-level folders with hemisphere
      if (path.dirname(fullPath) === rootDir) {
        node.hemisphere = getHemisphere(entry);
      }
      result.push(node);
    } else {
      result.push({ name: entry, type: 'file', size: stat.size });
    }
  }
  return result;
}

// --- GET /api/status ---
app.get('/api/status', (req, res) => {
  try {
    // Total markdown files
    const mdFiles = walkDir(vaultPath);
    const totalFiles = mdFiles.length;

    // System files check
    const systemFilesStatus = {};
    for (const sf of SYSTEM_FILES) {
      systemFilesStatus[sf] = fs.existsSync(path.join(vaultPath, sf));
    }

    // Hemisphere file counts
    const hemispheres = {
      left: { folders: [...LEFT_FOLDERS], file_count: 0 },
      right: { folders: [...RIGHT_FOLDERS], file_count: 0 },
      archive: { folders: [...ARCHIVE_FOLDERS], file_count: 0 }
    };
    for (const fpath of mdFiles) {
      const rel = path.relative(vaultPath, fpath).replace(/\\/g, '/');
      const topFolder = rel.split('/')[0];
      const hemi = getHemisphere(topFolder);
      if (hemi === 'left') hemispheres.left.file_count++;
      else if (hemi === 'right') hemispheres.right.file_count++;
      else if (hemi === 'archive') hemispheres.archive.file_count++;
    }

    // Parse MEMORY.md for current focus
    let memoryFocus = null;
    const memoryPath = path.join(vaultPath, 'MEMORY.md');
    if (fs.existsSync(memoryPath)) {
      const memContent = fs.readFileSync(memoryPath, 'utf-8');
      const focusMatch = memContent.match(/## 🎯 Current Focus\s*\n([\s\S]*?)(?=\n## |\n---|\n$|$)/);
      if (focusMatch) {
        memoryFocus = focusMatch[1].trim();
      }
    }

    // Parse HEARTBEAT.md for checked items
    let heartbeatChecked = 0;
    let heartbeatTotal = 0;
    const heartbeatPath = path.join(vaultPath, 'HEARTBEAT.md');
    if (fs.existsSync(heartbeatPath)) {
      const hbContent = fs.readFileSync(heartbeatPath, 'utf-8');
      const checkedMatches = hbContent.match(/\[x\]/gi);
      const uncheckedMatches = hbContent.match(/\[ \]/g);
      heartbeatChecked = checkedMatches ? checkedMatches.length : 0;
      heartbeatTotal = heartbeatChecked + (uncheckedMatches ? uncheckedMatches.length : 0);
    }

    res.json({
      vault_path: vaultPath,
      total_files: totalFiles,
      system_files: systemFilesStatus,
      hemispheres,
      memory_focus: memoryFocus,
      heartbeat_checked: heartbeatChecked,
      heartbeat_total: heartbeatTotal
    });
  } catch (error) {
    console.error('[Vault Server] Error building status:', error);
    res.status(500).json({ error: 'Failed to build vault status' });
  }
});

// --- GET /api/tree ---
app.get('/api/tree', (req, res) => {
  try {
    const tree = {
      name: 'vault',
      type: 'folder',
      children: buildTree(vaultPath, vaultPath)
    };
    res.json(tree);
  } catch (error) {
    console.error('[Vault Server] Error building tree:', error);
    res.status(500).json({ error: 'Failed to build directory tree' });
  }
});

// --- GET /api/file/:path(*) ---
app.get('/api/file/:path(*)', (req, res) => {
  try {
    const requestedPath = req.params.path;
    const fullPath = path.resolve(vaultPath, requestedPath);

    // Security: prevent directory traversal outside vault
    if (!fullPath.startsWith(vaultPath)) {
      return res.status(403).json({ error: 'Path escapes vault directory' });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(rawContent);
    const name = path.basename(fullPath);
    const basename = name.replace(/\.md$/, '');
    const relativePath = path.relative(vaultPath, fullPath).replace(/\\/g, '/');
    const topFolder = relativePath.split('/')[0];
    const hemisphere = getHemisphere(topFolder);

    res.json({
      path: relativePath,
      name,
      basename,
      content,
      frontmatter: data,
      hemisphere
    });
  } catch (error) {
    console.error('[Vault Server] Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// --- GET /api/hemispheres ---
app.get('/api/hemispheres', (req, res) => {
  try {
    const mdFiles = walkDir(vaultPath);

    const result = {
      left: { label: '🧠 Left Hemisphere', permission: 'READ-ONLY', description: 'Human Domain', folders: {} },
      right: { label: '🤖 Right Hemisphere', permission: 'READ/WRITE', description: 'AI Domain', folders: {} },
      archive: { label: '🗄️ Archive', permission: 'IGNORE', description: 'Static Assets', folders: {} }
    };

    // Initialize folder buckets
    for (const f of LEFT_FOLDERS) result.left.folders[f] = [];
    for (const f of RIGHT_FOLDERS) result.right.folders[f] = [];
    for (const f of ARCHIVE_FOLDERS) result.archive.folders[f] = [];

    for (const fpath of mdFiles) {
      const rawContent = fs.readFileSync(fpath, 'utf-8');
      const { data } = matter(rawContent);
      const relativePath = path.relative(vaultPath, fpath).replace(/\\/g, '/');
      const topFolder = relativePath.split('/')[0];
      const hemi = getHemisphere(topFolder);
      const name = path.basename(fpath);
      const basename = name.replace(/\.md$/, '');

      const entry = { path: relativePath, name, basename, frontmatter: data };

      if (hemi === 'left' && result.left.folders[topFolder]) {
        result.left.folders[topFolder].push(entry);
      } else if (hemi === 'right' && result.right.folders[topFolder]) {
        result.right.folders[topFolder].push(entry);
      } else if (hemi === 'archive' && result.archive.folders[topFolder]) {
        result.archive.folders[topFolder].push(entry);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('[Vault Server] Error building hemispheres:', error);
    res.status(500).json({ error: 'Failed to build hemisphere data' });
  }
});

// --- GET /api/mocs ---
app.get('/api/mocs', (req, res) => {
  try {
    const mocsDir = path.join(vaultPath, '00_MOCs');
    if (!fs.existsSync(mocsDir)) {
      return res.json([]);
    }

    const mdFiles = walkDir(mocsDir);
    const mocs = [];

    for (const fpath of mdFiles) {
      const rawContent = fs.readFileSync(fpath, 'utf-8');
      const { content } = matter(rawContent);
      const name = path.basename(fpath);
      const basename = name.replace(/\.md$/, '');

      // Extract wikilinks
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      const links = [];
      let match;
      while ((match = linkRegex.exec(rawContent)) !== null) {
        // Strip alias (e.g. [[target|alias]] -> target)
        const linkTarget = match[1].split('|')[0].trim();
        links.push(linkTarget);
      }

      mocs.push({
        name,
        basename,
        content,
        links,
        link_count: links.length
      });
    }

    res.json(mocs);
  } catch (error) {
    console.error('[Vault Server] Error reading MOCs:', error);
    res.status(500).json({ error: 'Failed to read MOC files' });
  }
});

// --- GET /api/templates ---
app.get('/api/templates', (req, res) => {
  try {
    const templatesDir = path.join(vaultPath, '80_Templates');
    if (!fs.existsSync(templatesDir)) {
      return res.json([]);
    }

    const mdFiles = walkDir(templatesDir);
    const templates = [];

    for (const fpath of mdFiles) {
      const rawContent = fs.readFileSync(fpath, 'utf-8');
      const { data } = matter(rawContent);
      const name = path.basename(fpath);
      const basename = name.replace(/\.md$/, '');

      templates.push({
        name,
        basename,
        fields: data,
        raw_content: rawContent
      });
    }

    res.json(templates);
  } catch (error) {
    console.error('[Vault Server] Error reading templates:', error);
    res.status(500).json({ error: 'Failed to read template files' });
  }
});

// --- GET /api/skills ---
app.get('/api/skills', (req, res) => {
  try {
    const skillsDir = path.join(vaultPath, '40_Agent_Skills');
    if (!fs.existsSync(skillsDir)) {
      return res.json([]);
    }

    const entries = fs.readdirSync(skillsDir);
    const skills = [];

    for (const entry of entries) {
      const entryPath = path.join(skillsDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      const skillFile = path.join(entryPath, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      const rawContent = fs.readFileSync(skillFile, 'utf-8');
      const relativePath = path.relative(vaultPath, skillFile).replace(/\\/g, '/');

      // Extract description: first non-empty line after frontmatter, or first heading
      const { content } = matter(rawContent);
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      let description = lines.length > 0 ? lines[0].replace(/^#+\s*/, '').trim() : '';

      skills.push({
        name: entry,
        skill_file: relativePath,
        description,
        content: rawContent
      });
    }

    res.json(skills);
  } catch (error) {
    console.error('[Vault Server] Error reading skills:', error);
    res.status(500).json({ error: 'Failed to read agent skills' });
  }
});

// --- GET /api/system-files ---
app.get('/api/system-files', (req, res) => {
  try {
    const result = {};
    for (const sf of SYSTEM_FILES) {
      const filePath = path.join(vaultPath, sf);
      const exists = fs.existsSync(filePath);
      result[sf] = {
        content: exists ? fs.readFileSync(filePath, 'utf-8') : null,
        exists
      };
    }
    res.json(result);
  } catch (error) {
    console.error('[Vault Server] Error reading system files:', error);
    res.status(500).json({ error: 'Failed to read system files' });
  }
});

// Serve static assets in production mode
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[Vault Server] Production Mode: Serving static bundle from ${distPath}`);
  app.use(express.static(distPath));
  
  // Forward SPA routes to react-router-dom
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('[Vault Server] Development Mode: Running API-only server.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Vault Server] Listening on http://localhost:${PORT}`);
});
