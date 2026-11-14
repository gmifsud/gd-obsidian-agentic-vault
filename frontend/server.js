import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import sessionsRouter from './sessions.js';
import { readVaultLayout, VaultLayoutError, isHiddenEntry } from './vaultLayout.js';
import { parseNote } from './note.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables from root first, then local override from frontend folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.VITE_API_PORT || process.env.PORT || 3001;

// Parse VAULT_PATH (resolve relative to frontend directory)
const vaultPath = path.resolve(__dirname, process.env.VAULT_PATH || '../vault');
console.log(`[Vault Server] Target Vault directory: ${vaultPath}`);

app.use(express.json());

// Mount the AI Session Explorer API
app.use(sessionsRouter);

// Every Vault endpoint works from the Vault layout. A Vault without a usable
// layout is an error the caller sees, not something to paper over with defaults.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/orchestrator')) return next();
  try {
    req.vaultLayout = readVaultLayout(vaultPath);
    next();
  } catch (error) {
    if (error instanceof VaultLayoutError) {
      console.error(`[Vault Server] ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
    next(error);
  }
});

// --- GET /api/layout ---
app.get('/api/layout', (req, res) => {
  res.json(req.vaultLayout);
});

// Markdown files the Control Panel may read: those at the Vault root and those
// inside directories the layout declares. Unmanaged and undeclared directories
// are never read, nor is a dot-directory or dot-file at any depth.
function vaultMarkdownFiles(layout) {
  const rootFiles = fs.readdirSync(vaultPath)
    .filter(name => name.endsWith('.md') && fs.statSync(path.join(vaultPath, name)).isFile())
    .map(name => path.join(vaultPath, name));
  const directoryFiles = Object.keys(layout.directories)
    .flatMap(name => walkDir(path.join(vaultPath, name)));
  return [...rootFiles, ...directoryFiles];
}

// Warn about a note once per server run, or again if its problem changes,
// rather than on every request that reads it.
const warned = new Map();
function warnOnce(key, message) {
  if (warned.get(key) === message) return;
  warned.set(key, message);
  console.warn(`[Vault Server] ${message}`);
}

// Helper function to recursively retrieve all markdown files
function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || isHiddenEntry(file)) {
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
    const mdFiles = vaultMarkdownFiles(req.vaultLayout);
    const files = [];

    for (const fpath of mdFiles) {
      const rawContent = fs.readFileSync(fpath, 'utf-8');
      const { data, content, frontmatterError } = parseNote(rawContent);
      
      const relativePath = path.relative(vaultPath, fpath).replace(/\\/g, '/');
      const name = path.basename(fpath);
      const basename = name.replace(/\.md$/, '');

      const file = {
        path: relativePath,
        name,
        basename,
        content,
        frontmatter: data
      };
      if (frontmatterError) {
        warnOnce(relativePath, `Invalid frontmatter in ${relativePath}: ${frontmatterError}`);
        file.frontmatter_error = frontmatterError;
      }
      files.push(file);
    }

    res.json(files);
  } catch (error) {
    console.error('[Vault Server] Error parsing vault files:', error);
    res.status(500).json({ error: 'Failed to read vault files' });
  }
});

// --- Helper: build nested directory tree ---
function buildTree(dir, rootDir, layout) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === 'node_modules' || isHiddenEntry(entry)) {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    const isTopLevel = dir === rootDir;
    if (stat.isDirectory()) {
      // At the top level, show only directories the layout declares
      if (isTopLevel && !Object.hasOwn(layout.directories, entry)) continue;
      const node = { name: entry, type: 'folder', children: buildTree(fullPath, rootDir, layout) };
      // Tag top-level folders with their Zone
      if (isTopLevel) {
        node.hemisphere = layout.zoneOf(entry);
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
    const layout = req.vaultLayout;

    // Total markdown files
    const mdFiles = vaultMarkdownFiles(layout);
    const totalFiles = mdFiles.length;

    // System files check
    const systemFilesStatus = {};
    for (const sf of layout.systemFiles.all) {
      systemFilesStatus[sf] = fs.existsSync(path.join(vaultPath, sf));
    }

    // File counts per Zone
    const hemispheres = {
      left: { folders: [...layout.zones.left], file_count: 0 },
      right: { folders: [...layout.zones.right], file_count: 0 },
      assets: { folders: [...layout.zones.assets], file_count: 0 }
    };
    for (const fpath of mdFiles) {
      const zone = layout.zoneOf(path.relative(vaultPath, fpath));
      if (hemispheres[zone]) hemispheres[zone].file_count++;
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
      children: buildTree(vaultPath, vaultPath, req.vaultLayout)
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
    const requestedRelative = path.relative(vaultPath, fullPath);
    if (requestedRelative.startsWith('..') || path.isAbsolute(requestedRelative)) {
      return res.status(403).json({ error: 'Path escapes vault directory' });
    }
    // Only root files and directories the layout declares are served
    if (!req.vaultLayout.isReadable(requestedRelative)) {
      return res.status(403).json({ error: 'Path is not in a directory declared by the Vault layout' });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const { data, content, frontmatterError } = parseNote(rawContent);
    const name = path.basename(fullPath);
    const basename = name.replace(/\.md$/, '');
    const relativePath = path.relative(vaultPath, fullPath).replace(/\\/g, '/');
    const hemisphere = req.vaultLayout.zoneOf(relativePath);

    res.json({
      path: relativePath,
      name,
      basename,
      content,
      frontmatter: data,
      hemisphere,
      ...(frontmatterError ? { frontmatter_error: frontmatterError } : {})
    });
  } catch (error) {
    console.error('[Vault Server] Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// --- GET /api/hemispheres ---
app.get('/api/hemispheres', (req, res) => {
  try {
    const layout = req.vaultLayout;
    const mdFiles = vaultMarkdownFiles(layout);

    const result = {
      left: { label: '🧠 Left Hemisphere', permission: 'READ-ONLY', description: 'Human Domain', folders: {} },
      right: { label: '🤖 Right Hemisphere', permission: 'READ/WRITE', description: 'AI Domain', folders: {} },
      assets: { label: '🗄️ Assets', permission: 'READ/WRITE', description: 'Static Files', folders: {} }
    };

    // Initialize folder buckets
    for (const zone of Object.keys(result)) {
      for (const f of layout.zones[zone]) result[zone].folders[f] = [];
    }

    for (const fpath of mdFiles) {
      const rawContent = fs.readFileSync(fpath, 'utf-8');
      const { data } = parseNote(rawContent);
      const relativePath = path.relative(vaultPath, fpath).replace(/\\/g, '/');
      const topFolder = relativePath.split('/')[0];
      const zone = layout.zoneOf(relativePath);
      const name = path.basename(fpath);
      const basename = name.replace(/\.md$/, '');

      const entry = { path: relativePath, name, basename, frontmatter: data };

      if (result[zone] && result[zone].folders[topFolder]) {
        result[zone].folders[topFolder].push(entry);
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
      const { content } = parseNote(rawContent);
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
      const { data } = parseNote(rawContent);
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
      const { content } = parseNote(rawContent);
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
    for (const sf of req.vaultLayout.systemFiles.all) {
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

// --- POST /api/orchestrator/run ---
app.post('/api/orchestrator/run', (req, res) => {
  const { command, args = [] } = req.body;

  const allowedScripts = {
    generator: '../backend/architect_generator.py',
    manager: '../backend/vault_manager.py',
    query: '../backend/query.py'
  };

  const scriptKey = command;
  if (!allowedScripts[scriptKey]) {
    return res.status(400).json({ error: 'Invalid orchestrator command' });
  }

  const scriptPath = path.resolve(__dirname, allowedScripts[scriptKey]);

  // Resolve Python virtual environment interpreter if exists, else fallback to standard python
  const pythonPath = process.platform === 'win32'
    ? path.resolve(__dirname, '../backend/venv/Scripts/python.exe')
    : path.resolve(__dirname, '../backend/venv/bin/python');
  const interpreter = fs.existsSync(pythonPath) ? pythonPath : 'python';

  // Basic argument validation and formatting
  const safeArgs = args.map(arg => {
    // Basic sanitization: strip dangerous shell characters
    return `"${String(arg).replace(/["`$\\]/g, '')}"`;
  }).join(' ');

  const cmd = `"${interpreter}" "${scriptPath}" ${safeArgs}`;
  console.log(`[Orchestrator API] Executing: ${cmd}`);

  exec(cmd, { cwd: vaultPath }, (error, stdout, stderr) => {
    res.json({
      success: !error || error.code === 0,
      code: error ? error.code : 0,
      stdout: stdout,
      stderr: stderr
    });
  });
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
