Write-Host "Migrating to Three-Tier Architecture: Frontend, Backend, Vault..." -ForegroundColor Cyan

$Root = "."
$VaultDir = "$Root\vault"
$FrontendDir = "$Root\frontend"
$BackendDir = "$Root\backend"

# 1. Create Directories
New-Item -ItemType Directory -Force -Path $VaultDir | Out-Null
New-Item -ItemType Directory -Force -Path $FrontendDir | Out-Null
if (-not (Test-Path $BackendDir)) {
    New-Item -ItemType Directory -Force -Path $BackendDir | Out-Null
}

# 2. Migrate Vault Files
Write-Host "Migrating Obsidian Blueprint to /vault/..." -ForegroundColor Yellow
$VaultItems = @(
    ".obsidian", "00_MOCs", "01_Journal", "02_Human_Thoughts", "10_Repositories", 
    "15_Prototype_Designs", "20_DevOps", "25_Knowledge_Base", "30_Git", 
    "40_Agent_Skills", "50_Databases", "60_Canvas_Maps", "80_Templates", 
    "90_Assets", "USER.md", "SOUL.md", "MEMORY.md", "HEARTBEAT.md", "CLAUDE.md",
    "AGENT_INSTRUCTIONS.md"
)

foreach ($item in $VaultItems) {
    if (Test-Path "$Root\$item") {
        Move-Item -Path "$Root\$item" -Destination $VaultDir -Force
        Write-Host "  -> Moved $item to /vault/" -ForegroundColor DarkGray
    }
}

# 3. Migrate Backend Files
Write-Host "Migrating Engine Layer to /backend/..." -ForegroundColor Yellow
$BackendItems = @(
    ".openclaw", "docker-compose.yml", "claude.json"
)

foreach ($item in $BackendItems) {
    if (Test-Path "$Root\$item") {
        Move-Item -Path "$Root\$item" -Destination $BackendDir -Force
        Write-Host "  -> Moved $item to /backend/" -ForegroundColor DarkGray
    }
}

# 4. Migrate Frontend Files
Write-Host "Migrating Control Panel Layer to /frontend/..." -ForegroundColor Yellow
$FrontendItems = @(
    "src", "index.html", "vite.config.ts", "package.json", 
    "package-lock.json", "tsconfig.json", "tsconfig.node.json", 
    "postcss.config.js", "components.json", ".eslintrc.cjs",
    "tailwind.config.js", "tailwind.config.ts", "index.css"
)

foreach ($item in $FrontendItems) {
    if (Test-Path "$Root\$item") {
        Move-Item -Path "$Root\$item" -Destination $FrontendDir -Force
        Write-Host "  -> Moved $item to /frontend/" -ForegroundColor DarkGray
    }
}

Write-Host "Architecture migration complete! The OS is now partitioned into three distinct pillars." -ForegroundColor Green
