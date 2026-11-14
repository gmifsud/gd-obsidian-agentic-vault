# Vau-M: The Agentic Personal OS & Vault Generator

Vau-M is a premium, three-tier framework for generating, managing, and visualizing structured Obsidian vaults designed for AI agents. It implements a strict **"Split-Brain" model** to cleanly partition human-authored thoughts (Read-Only to AI) from agent-authored knowledge (Read-Write to AI), allowing agents to safely navigate, search, and document tasks inside a Zettelkasten-inspired knowledge graph.

---

## 🏗️ Three-Tier Architecture

Vau-M enforces a clean separation of concerns:

```
├── vault/                 <- Tier 1: Canonical Vault (Golden Image/Blueprint)
├── backend/               <- Tier 2: Operational Engine (Python CLIs & Daemons)
└── frontend/              <- Tier 3: Control Panel Dashboard (React, Vite, Express)
```

1. **The Vault (`/vault/`)**: The database layer. Contains system files (`CLAUDE.md`, `SOUL.md`, `MEMORY.md`), Maps of Content (`00_MOCs/`), templates, and active Agent Skills.
2. **The Engine (`/backend/`)**: The operational CLI layer. Contains python tools to generate vaults, run vector search, run heartbeat tasks, compact memory ledger files, and validate architectural integrity.
3. **The Control Panel (`/frontend/`)**: The visualization layer. A concurrently managed React/Vite dashboard paired with an Express API server to inspect vault health, browse skills, analyze hemisphere files, and preview notes.

---

## 🛠️ Usage Mode A: Local Development

Use this mode if you are developing new dashboard features, modifying backend CLI commands, or extending the vault generator logic.

### 1. Prerequisites
- **Node.js** (v20+ recommended)
- **Python 3.10+** (with `pip` and `venv`)

### 2. Setup
Clone the repository and install dependencies for both the backend and frontend:

```bash
# Install frontend & concurrently scripts
cd frontend
npm install

# Set up Python virtual environment
cd ../backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

### 2.5 Configuration & Port Customization (Optional)
If ports `3000` (Vite UI dev server) or `3001` (Express API server) conflict with other services on your machine, you can customize them by editing the `.env` file at the root of the repository. You can also configure custom directories for the AI Session Explorer:

```env
# Port where Express API runs
PORT=3001

# Port where Vite React dashboard runs
VITE_PORT=3000

# Optional: Override AI tool session directories if installed in non-standard paths
# CLAUDE_SESSIONS_PATH=%USERPROFILE%\.claude\projects
# CURSOR_SESSIONS_PATH=%APPDATA%\Cursor\User\workspaceStorage
# KILOCODE_SESSIONS_PATH=%APPDATA%\Code\User\globalStorage\kilocode.kilo-code\tasks
```

Both the Express backend and the Vite dev server proxy are configured to automatically load these variables and coordinate on the specified ports.

### 3. Run Development Servers
Vau-M uses a concurrently configured runner at the root level. To start both the Express API server (port `3001` by default) and the Vite React dashboard (port `3000` by default) with Hot Module Replacement (HMR):

```bash
# Run from the repository root
npm run dev
```

- **Dashboard:** Navigate to [http://localhost:3000](http://localhost:3000)
- **Express API Port:** [http://localhost:3001](http://localhost:3001)

### 4. Build & Production Preview
To compile the React dashboard into a production bundle and preview it served directly by the Express server:

```bash
# Run from repository root
npm run build
npm run server
```

---

## 🚀 Usage Mode B: Runtime & Vault Generation

Use this mode to spin out new vaults from this blueprint and manage them programmatically.

### 1. Generating a New Vault
The `architect_generator.py` CLI copies directories, system files, and active agent skills from the "golden image" `/vault/` into a pristine target folder of your choice:

```bash
# Run from repository root
python backend/architect_generator.py <path/to/new/vault>

# Example:
python backend/architect_generator.py C:\Users\YourName\Documents\SecondBrain
```

#### Optional Arguments:
- `--from-vault <blueprint_path>`: Provide an alternative blueprint vault directory (defaults to the local `/vault/` folder).

### 2. Vault Health & Purity Validation (`vault_manager.py`)
Interact with and validate your active vault to ensure no broken internal wikilinks exist and files reside in their correct hemispheres:

```bash
cd backend

# Validate structural integrity (exit codes compatible with CI/CD pipelines)
python vault_manager.py validate

# Inspect overall vault status (JSON health report)
python vault_manager.py vault-status

# List available templates with their parsed YAML schema fields
python vault_manager.py list-templates
```

### 3. Vector Database & Background Tasks (`query.py`)
Run semantic searches, index your knowledge base, and maintain the agent's rolling memory ledger:

```bash
cd backend

# Run background heartbeat tasks (check API integrations, check active drafts)
python query.py heartbeat

# Index Markdown files under 25_Knowledge_Base/ into the SQLite vector database
python query.py embed

# Run a semantic search over the vector database
python query.py search "active development plans"

# Compact MEMORY.md to keep only the 5 most recent rolling session logs
python query.py compact

# Reset HEARTBEAT.md checkbox status (for scheduled cron reuse)
python query.py reset-heartbeat
```

---

## 🔌 Obsidian & Agent Integration

### 1. Opening in Obsidian
1. Open the **Obsidian** desktop app.
2. Select **Open folder as vault**.
3. Choose either the golden image `/vault/` directory or any new vault directory you created with `architect_generator.py`.

### 2. Recommended Community Plugins
Ensure the following community plugins (located in `.obsidian/community-plugins.json`) are enabled inside Obsidian for full layout and automation support:
- `vaultman` — Programmatic vault state management.
- `bulk-tag-manager` — Frontmatter tag reorganization.
- `obsidian-style-settings` — Vault customization.
- `ace-code-editor` — Code formatting inside notes.

### 3. Claude Code / MCP Server Hooks
Vau-M automatically scaffolds a `claude.json` configuration file at the root of every generated vault. This allows Model Context Protocol (MCP) clients to auto-discover and load:
- **Obsidian Vault Search MCP:** Allows agents to query and retrieve files inside the vault.
- **Pieces Memory MCP:** Integrates with Pieces OS for active code snippet caching.

In addition, the vault contains a `.claude-plugin/` metadata folder that allows compatible clients to auto-initialize the vault's active skills.
