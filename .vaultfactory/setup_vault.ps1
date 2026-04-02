$VaultName = "Knowledge.Agentic"

Write-Host "Creating AI-Powered Vault: $VaultName..." -ForegroundColor Cyan

# Phase 1: Create the Optimized Hemisphere Directories
Write-Host "Setting up Left/Right Hemisphere directory structure..."
$directories = @(
    "$VaultName\00_MOCs",
    "$VaultName\01_Journal",          # Left Hemisphere (Human) - UPDATED
    "$VaultName\02_Human_Thoughts",   # Left Hemisphere (Human)
    "$VaultName\10_Repositories",     # Right Hemisphere (AI)
    "$VaultName\20_DevOps",           # Right Hemisphere (AI)
    "$VaultName\30_Git",              # Right Hemisphere (AI)
    "$VaultName\40_Agent_Skills",     # Right Hemisphere (AI) - NEW
    "$VaultName\99_Templates",        # Right Hemisphere (AI)
    "$VaultName\.obsidian\templates"  # Hidden folder for Human Templates
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

# Phase 2: Migrate High-Value Data from 'ToInclude' (If it exists)
if (Test-Path ".\ToInclude") {
    Write-Host "Found 'ToInclude' folder. Cherry-picking high-value assets..." -ForegroundColor Yellow
    
    # Move Agent Skills
    if (Test-Path ".\ToInclude\skills") { Copy-Item -Path ".\ToInclude\skills\*" -Destination "$VaultName\40_Agent_Skills\" -Recurse -Force }
    
    # Move Core Obsidian Configurations and Plugins
    if (Test-Path ".\ToInclude\.obsidian") { Copy-Item -Path ".\ToInclude\.obsidian\*" -Destination "$VaultName\.obsidian\" -Recurse -Force }
    
    # Move Human Templates to hidden folder
    if (Test-Path ".\ToInclude\06 Toolkit\Templates") { Copy-Item -Path ".\ToInclude\06 Toolkit\Templates\*" -Destination "$VaultName\.obsidian\templates\" -Recurse -Force }
    
    # Move the React/Vite Web Frontend
    if (Test-Path ".\ToInclude\src") { Copy-Item -Path ".\ToInclude\src" -Destination "$VaultName\" -Recurse -Force }
    $webFiles = @("package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "index.html")
    foreach ($file in $webFiles) {
        if (Test-Path ".\ToInclude\$file") { Copy-Item -Path ".\ToInclude\$file" -Destination "$VaultName\" -Force }
    }
} else {
    Write-Host "No 'ToInclude' folder found in this directory. Proceeding with blank structural setup..." -ForegroundColor Gray
}

# Phase 3: Create AI YAML Templates
Write-Host "Generating LLM-optimized YAML Templates..."

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
Set-Content -Path "$VaultName\99_Templates\Repository_Template.md" -Value $repoTemplate -Encoding UTF8

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
Set-Content -Path "$VaultName\99_Templates\DevOps_Resource_Template.md" -Value $devopsTemplate -Encoding UTF8

# Phase 4: Create Maps of Content (MOCs)
Write-Host "Generating Maps of Content (MOCs)..."

$homeMoc = @'
# Personal Operating System

## 🧠 Left Hemisphere (Human Thoughts)
- [[01_Journal]]
- [[02_Human_Thoughts]]

## 🤖 Right Hemisphere (AI Workspaces & Workflows)
- [[Repositories_MOC]]
- [[DevOps_MOC]]
- [[Git_MOC]]
- [[40_Agent_Skills]]
'@
Set-Content -Path "$VaultName\00_MOCs\000_Home_MOC.md" -Value $homeMoc -Encoding UTF8

# Phase 5: The Updated Claude Code Memory (Master Instructions)
Write-Host "Initializing Claude Code Memory (claude.md)..."

$claudeMemory = @'
# Claude Code System Configuration & Memory

## The Hemisphere Model
You are operating within an Obsidian vault functioning as a Personal Operating System. You must strictly adhere to the following read/write permissions:

### 🧠 Left Hemisphere (READ-ONLY)
- `01_Journal/`
- `02_Human_Thoughts/`
**Rule:** These folders contain human-generated thoughts, journaling, and tasks. You may read these files for context, but you are **never** to modify, overwrite, or delete content in these folders unless explicitly forced by the user. 
*(Note: Human-centric templates are stored safely in `.obsidian/templates/`).*

### 🤖 Right Hemisphere (READ/WRITE)
- `10_Repositories/`
- `20_DevOps/`
- `30_Git/`
- `40_Agent_Skills/`
- `99_Templates/`
**Rule:** This is your primary workspace. You may create, update, and manage Markdown files here to document codebases, infrastructure, and standard operating procedures. 
- Always use the YAML templates found in `99_Templates/` when creating new codebase/infra files.
- Refer to `40_Agent_Skills/` for explicit instructions on how to format advanced Obsidian elements like JSON Canvas or specific CLI commands.

### 🌐 Web Frontend Workspace (READ/WRITE)
- `src/`
- `package.json`
- `vite.config.ts`
**Rule:** This vault contains a custom React/Vite web application used to view or manipulate these markdown files. You have full permission to build, edit, and debug this codebase when requested by the user.

## Core Workflows

### The `/new` Routing Protocol
When the user inputs a batch of raw information, tasks, or code snippets and asks you to process them:
1. Analyze the input.
2. Separate the items logically.
3. Automatically generate the appropriate Markdown files in the correct Right Hemisphere folders using the templates. Do not ask for permission to save them; just route and save them efficiently.

### The `/today` Planning Protocol
When the user runs the `/today` command:
1. Scan the most recent daily entry in `01_Journal/`.
2. Cross-reference any mentioned projects or tasks with the active files in `10_Repositories/` and `20_DevOps/`.
3. Output a concise, prioritized task list for the day directly into the terminal, highlighting dependencies and blocked items. Do not write this output to a file unless requested.
'@
Set-Content -Path "$VaultName\claude.md" -Value $claudeMemory -Encoding UTF8

Write-Host "Vault generation complete! Open '$VaultName' in Obsidian and run `/init` with Claude Code." -ForegroundColor Green