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
