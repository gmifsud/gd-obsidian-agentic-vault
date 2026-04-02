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
