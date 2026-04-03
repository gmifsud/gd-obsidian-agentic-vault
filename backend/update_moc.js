const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/update_moc.js <path/to/new/file.md>");
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

const content = fs.readFileSync(absolutePath, 'utf-8');
const fileName = path.basename(absolutePath, '.md');
const dirName = path.dirname(absolutePath);

// Extract YAML frontmatter
const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
let metadata = {};
if (frontmatterMatch) {
  frontmatterMatch[1].split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      metadata[key] = value;
    }
  });
}

let mocPath = '';
let entry = `- [[${fileName}]]`;

// Route to the correct MOC and format inline metadata
if (dirName.includes('10_Repositories')) {
  mocPath = '00_MOCs/Repositories_MOC.md';
  entry += ` | tech_stack: ${metadata.tech_stack || '[]'} | status: ${metadata.status || 'unknown'}`;
} else if (dirName.includes('20_DevOps')) {
  mocPath = '00_MOCs/DevOps_MOC.md';
  entry += ` | environment: ${metadata.environment || '[]'} | tech_stack: ${metadata.tech_stack || '[]'}`;
} else if (dirName.includes('30_Git')) {
  mocPath = '00_MOCs/Git_MOC.md';
  entry += ` | workflow_name: ${metadata.workflow_name || 'unknown'}`;
} else {
  console.log("No matching MOC for this directory. Skipping MOC update.");
  process.exit(0);
}

const rootDir = path.resolve(__dirname, '..');
const mocFullPath = path.join(rootDir, mocPath);

if (fs.existsSync(mocFullPath)) {
  let mocContent = fs.readFileSync(mocFullPath, 'utf-8');
  
  // Prevent duplicate entries
  if (mocContent.includes(`[[${fileName}]]`)) {
    console.log(`Entry for ${fileName} already exists in ${mocPath}.`);
    process.exit(0);
  }

  // Append to the Static Agent Index section (or create it if missing)
  const indexHeader = '## Static Agent Index';
  if (mocContent.includes(indexHeader)) {
    mocContent = mocContent.replace(indexHeader, `${indexHeader}\n${entry}`);
  } else {
    mocContent += `\n${indexHeader}\n${entry}\n`;
  }
  
  fs.writeFileSync(mocFullPath, mocContent);
  console.log(`Successfully updated ${mocPath} with ${fileName}`);
} else {
  console.error(`MOC file not found: ${mocFullPath}`);
}
