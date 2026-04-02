$VaultName = "Agentic_Personal_OS"

Write-Host "Initializing Comprehensive Vault Build: $VaultName..." -ForegroundColor Cyan

# ---------------------------------------------------------
# Phase 1: The Expanded Hemisphere Directory Structure
# ---------------------------------------------------------
Write-Host "Building Expanded Hemisphere Architecture..."
$directories = @(
    "$VaultName\00_MOCs",
    
    # 🧠 Left Hemisphere (Human)
    "$VaultName\01_Journal",          
    "$VaultName\02_Human_Thoughts",   
    
    # 🤖 Right Hemisphere (AI Workspaces)
    "$VaultName\10_Repositories",     
    "$VaultName\20_DevOps",           
    "$VaultName\30_Git",              
    "$VaultName\40_Agent_Skills",     
    "$VaultName\50_Databases",        # <-- NEW: Rescuing your .base files
    "$VaultName\60_Canvas_Maps",      # <-- NEW: Rescuing your .canvas files
    "$VaultName\99_AI_Templates",     
    
    # 🗄️ Toolkit & Reference (Read-Only)
    "$VaultName\80_Human_Templates",  # <-- NEW: Keeping them visible but protected
    "$VaultName\81_Snippets",         # <-- NEW: MetaBind snippets
    "$VaultName\82_Images",           # <-- NEW: All your thumbnails/assets
    
    # 📦 The Vault Archive (Hidden from AI workflows)
    "$VaultName\90_Archive\NoteLab",
    "$VaultName\90_Archive\MOCs_Legacy",
    "$VaultName\90_Archive\Cards",
    "$VaultName\90_Archive\Learning",
    "$VaultName\90_Archive\Vault_YouTube"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

# ---------------------------------------------------------
# Phase 2: Surgical Data Extraction & Migration
# ---------------------------------------------------------
if (Test-Path ".\ToInclude") {
    Write-Host "Extracting and Routing Data from 'ToInclude'..." -ForegroundColor Yellow
    
    # --- System & Web Frontend ---
    if (Test-Path ".\ToInclude\.obsidian") { Copy-Item -Path ".\ToInclude\.obsidian" -Destination "$VaultName\" -Recurse -Force }
    if (Test-Path ".\ToInclude\.claude-plugin") { Copy-Item -Path ".\ToInclude\.claude-plugin" -Destination "$VaultName\" -Recurse -Force }
    if (Test-Path ".\ToInclude\src") { Copy-Item -Path ".\ToInclude\src" -Destination "$VaultName\" -Recurse -Force }
    if (Test-Path ".\ToInclude\scripts") { Copy-Item -Path ".\ToInclude\scripts" -Destination "$VaultName\" -Recurse -Force }
    
    $rootFiles = @("package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "index.html", "metadata.json", "README.md", "START HERE.md", "LICENSE")
    foreach ($file in $rootFiles) {
        if (Test-Path ".\ToInclude\$file") { Copy-Item -Path ".\ToInclude\$file" -Destination "$VaultName\" -Force }
    }

    # --- Right Hemisphere AI Workspaces ---
    if (Test-Path ".\ToInclude\skills") { Copy-Item -Path ".\ToInclude\skills\*" -Destination "$VaultName\40_Agent_Skills\" -Recurse -Force }
    if (Test-Path ".\ToInclude\03 Spaces\Bases") { Copy-Item -Path ".\ToInclude\03 Spaces\Bases\*" -Destination "$VaultName\50_Databases\" -Recurse -Force }
    if (Test-Path ".\ToInclude\03 Spaces\Canvas Mind Maps") { Copy-Item -Path ".\ToInclude\03 Spaces\Canvas Mind Maps\*" -Destination "$VaultName\60_Canvas_Maps\" -Recurse -Force }
    
    # --- Left Hemisphere (Human) ---
    if (Test-Path ".\ToInclude\05 Journal") { Copy-Item -Path ".\ToInclude\05 Journal\*" -Destination "$VaultName\01_Journal\" -Recurse -Force }
    
    # --- Toolkit & Assets ---
    if (Test-Path ".\ToInclude\06 Toolkit\Templates") { Copy-Item -Path ".\ToInclude\06 Toolkit\Templates\*" -Destination "$VaultName\80_Human_Templates\" -Recurse -Force }
    if (Test-Path ".\ToInclude\06 Toolkit\Snippets") { Copy-Item -Path ".\ToInclude\06 Toolkit\Snippets\*" -Destination "$VaultName\81_Snippets\" -Recurse -Force }
    if (Test-Path ".\ToInclude\06 Toolkit\Images") { Copy-Item -Path ".\ToInclude\06 Toolkit\Images\*" -Destination "$VaultName\82_Images\" -Recurse -Force }

    # --- Archiving the Rest ---
    if (Test-Path ".\ToInclude\00 NoteLab") { Copy-Item -Path ".\ToInclude\00 NoteLab\*" -Destination "$VaultName\90_Archive\NoteLab\" -Recurse -Force }
    if (Test-Path ".\ToInclude\01 MOCs") { Copy-Item -Path ".\ToInclude\01 MOCs\*" -Destination "$VaultName\90_Archive\MOCs_Legacy\" -Recurse -Force }
    if (Test-Path ".\ToInclude\02 Cards") { Copy-Item -Path ".\ToInclude\02 Cards\*" -Destination "$VaultName\90_Archive\Cards\" -Recurse -Force }
    if (Test-Path ".\ToInclude\03 Spaces\Learning") { Copy-Item -Path ".\ToInclude\03 Spaces\Learning\*" -Destination "$VaultName\90_Archive\Learning\" -Recurse -Force }
    if (Test-Path ".\ToInclude\04 Vault") { Copy-Item -Path ".\ToInclude\04 Vault\*" -Destination "$VaultName\90_Archive\Vault_YouTube\" -Recurse -Force }

} else {
    Write-Host "Warning: No 'ToInclude' folder found. Proceeding with blank vault." -ForegroundColor Red
}

# ---------------------------------------------------------
# Phase 3: AI DevOps Templates
# ---------------------------------------------------------
Write-Host "Generating AI DevOps Templates..."

$repoTemplate = @'
---
type: repository
repo_name: ""
url: ""
tech_stack: []
primary_language: ""
related_devops: []
agent_summary: ""
status: active
tags:
  - repo
aliases: []
---
'@
Set-Content -Path "$VaultName\99_AI_Templates\Repository_Template.md" -Value $repoTemplate -Encoding UTF8

$devopsTemplate = @'
---
type: devops_resource
resource_name: ""
category: ""
related_repos: []
key_commands: []
agent_summary: ""
tags:
  - devops
  - infra
aliases: []
---
'@
Set-Content -Path "$VaultName\99_AI_Templates\DevOps_Resource_Template.md" -Value $devopsTemplate -Encoding UTF8

# ---------------------------------------------------------
# Phase 4: Dynamic MOCs
# ---------------------------------------------------------
Write-Host "Generating Hub MOCs..."

$homeMoc = @'
# The Personal OS Hub

## 🧠 Human Workspace (Read-Only AI)
- [[01_Journal]]
- [[02_Human_Thoughts]]

## 🤖 AI Workspace (Read/Write AI)
- [[Repositories_MOC]]
- [[DevOps_MOC]]
- [[Git_MOC]]
- [[50_Databases]] (Obsidian Bases)
- [[60_Canvas_Maps]]

## 🗄️ Toolkit & Reference
- [[80_Human_Templates]]
- [[81_Snippets]]
- [[82_Images]]
- [[90_Archive]] (Legacy & Learning)
'@
Set-Content -Path "$VaultName\00_MOCs\000_Home_MOC.md" -Value $homeMoc -Encoding UTF8

# ---------------------------------------------------------
# Phase 5: Comprehensive Master AI Instructions
# ---------------------------------------------------------
Write-Host "Writing Master AI Context (CLAUDE.md)..."

$claudeMemory = @'
# Claude Code System Configuration & Memory

## Architectural Overview & Read/Write Permissions
You are functioning as the operating agent for a Personal OS built on Obsidian, React, and local file storage. Adhere strictly to these zone permissions:

### 🧠 Left Hemisphere (READ-ONLY)
- `01_Journal/`
- `02_Human_Thoughts/`
**Rule:** Human thoughts and daily planning. Read for context, NEVER edit or overwrite.

### 🤖 Right Hemisphere (YOUR WORKSPACE: READ/WRITE)
- `10_Repositories/`, `20_DevOps/`, `30_Git/`
- `40_Agent_Skills/`: **CRITICAL.** Contains documentation (`SKILL.md`) on how you must format markdown, interact with JSON Canvases, and use Obsidian Bases. Always consult these skills before generating complex notes.
- `50_Databases/`: Contains `.base` files utilized by the Obsidian Bases plugin.
- `60_Canvas_Maps/`: Contains `.canvas` files.
- `99_AI_Templates/`: Use these YAML structures when documenting codebases.
**Rule:** You have full autonomy to create, update, and manage data here. 

### 🗄️ Toolkit & Assets (READ-ONLY)
- `80_Human_Templates/`, `81_Snippets/`, `82_Images/`
**Rule:** These are resources (like MetaBind snippets and UI images) used by the human. Do not alter them. 

### 📦 The Archive (IGNORE)
- `90_Archive/`
**Rule:** Contains legacy tutorials, YouTube notes, and old starter-kit boilerplate. Do not query or reference this folder unless specifically instructed to retrieve historical data.

### 🌐 Web Frontend Workspace (READ/WRITE)
- `src/`, `scripts/`, `package.json`, `vite.config.ts`
**Rule:** A custom React/Vite web application used to view/manipulate the markdown. You may debug and edit this codebase.

## Core Workflows
1. **The `/new` Protocol:** Analyze raw user input, format it appropriately (consulting `40_Agent_Skills` if creating a Canvas or Base), and route it silently into the Right Hemisphere.
2. **The `/today` Protocol:** Read `01_Journal/`, cross-reference with `10_Repositories/` and `20_DevOps/`, and output a terminal-based prioritized task list.
'@
Set-Content -Path "$VaultName\CLAUDE.md" -Value $claudeMemory -Encoding UTF8

Write-Host "Vault migration and generation complete! Open '$VaultName' in Obsidian." -ForegroundColor Green