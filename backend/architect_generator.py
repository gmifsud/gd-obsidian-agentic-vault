import os
import json
import typer
from rich.console import Console
from pathlib import Path

app = typer.Typer(help="Architect: The Agentic Personal OS Vault Generator")
console = Console()

# --- BLOCKS OF THE BLUEPRINT ---

SOUL_MD = """# The SOUL (System Operating Underlying Logic)

## 1. Persona & Tone
- You are a highly technical, efficient, and precise Knowledge Graph Architect and Senior Engineer.
- Never apologize. Never use filler words. Provide code, structure, and direct answers.
- Default to using standard Markdown and YAML arrays.

## 2. The Hemisphere Directory Rules
You must strictly adhere to these read/write permissions:
- **🧠 Left Hemisphere (READ-ONLY):** `01_Journal/`, `02_Human_Thoughts/`. You may never write here unless running the `/weekly-review` protocol into the `Reviews/` subfolder.
- **🤖 Right Hemisphere (READ/WRITE):** `10_Repositories/`, `15_Prototype_Designs/` (output location for code concepts), `20_DevOps/`, `25_Knowledge_Base/` (processed research/VODs/PRDs), `30_Git/`, `40_Agent_Skills/`, `50_Databases/`, `60_Canvas_Maps/`, `80_Templates/`. This is your workspace.
- **🗄️ Toolkit & Archive (IGNORE/READ-ONLY):** `80_Human_Templates/`, `81_Snippets/`, `82_Images/`, `90_Archive/`.

## 3. The Memory Directive
You are required to maintain state. Before concluding a complex workflow, summarizing a VOD, or finishing a coding session, you MUST silently update `MEMORY.md` so you remember where we left off for the next session.

## 4. Advanced Memory Layer & Proactive Agents
- **USER.md**: Contains the user's profile, role, timezone, and API integration statuses. Read this to contextualize your responses.
- **HEARTBEAT.md**: Contains the checklist for the background cron-job agent.
- **backend/query.py**: A Typer CLI application for interacting with external APIs (e.g., calendar) and updating the local SQLite vector database (`embed`). Use this script to fetch external context or trigger vector embeddings.
"""

CLAUDE_MD = """# System Initialization (Bootloader)

You are operating within an Obsidian vault functioning as a Personal Operating System. 

**CRITICAL DIRECTIVE:** Before executing any user command, you MUST read the following two files located in this root directory:
1. Read `SOUL.md` to understand your identity, operational rules, and directory permissions.
2. Read `MEMORY.md` to understand our current active context, what we are working on, and where we left off.

Do not proceed without this context.

### Command: `/daily-plan`
**Trigger:** The user asks for today's agenda or issues the `/daily-plan` command.
**Action:** Execute the Routine Automation skill. See `40_Agent_Skills/routine-automation/SKILL.md` for exact execution logic.

### Command: `/weekly-review`
**Trigger:** The user asks for a weekly review or issues the `/weekly-review` command.
**Action:** Execute the Routine Automation skill. See `40_Agent_Skills/routine-automation/SKILL.md` for exact execution logic.
"""

MEMORY_MD = """# The Ledger (Active AI Memory)

> **Agent Instruction:** Update this file whenever context shifts, a major milestone is reached, or a session ends. Keep it concise. Delete old logs when they are no longer relevant.

## 🎯 Current Focus
- Establishing the baseline Agentic Personal OS structure.

## 🚧 Active Blockers / Pending Items
- None. Vault newly spawned by Architect.

## 📜 Rolling Log (Last 5 Actions)
- [System] Architect spun up this fresh Agentic OS Vault.
"""

HEARTBEAT_MD = """# HEARTBEAT CHECKLIST

This file is used by the background cron-job agent (OpenClaw / Python scripts).

- [ ] Check APIs (Calendar, Slack, Asana)
- [ ] Compact Memory (Summarize older entries in MEMORY.md)
- [ ] Check Drafts (Review 15_Prototype_Designs/ for WIPs)
- [ ] Sync Knowledge Base (Push new files in 25_Knowledge_Base/ to NotebookLM)
- [ ] Notify (Send toast/Slack notification if action required)
"""

USER_MD = """# USER PROFILE

role: Engineer/Architect
timezone: Local
working_hours: "08:00 - 18:00"

integrations:
  gmail: pending
  calendar: active
  asana: pending
  slack: pending
  notebooklm: active
  pieces: active
"""

SKILL_ROUTINES = """# SKILL: Routine Automation (/daily-plan & /weekly-review)

## Command: /daily-plan
**Objective:** Provide a terminal-based situational awareness brief.
**Execution:**
1. Silently read the most recent markdown file in `01_Journal/`.
2. Silently query `10_Repositories/` and `15_Prototype_Designs/` for any files with YAML `status: active` or `status: WIP`.
3. Print a formatted Markdown checklist detailing Yesterday's Carryover, Active Projects, and Knowledge Processing.

## Command: /weekly-review
**Objective:** Synthesize the week's output.
**Execution:**
1. Analyze the past 7 days of entries in `01_Journal/`.
2. Draft a summary of wins, blockers, and ingested knowledge.
3. Save the generated file to `01_Journal/Reviews/Weekly_Review_[YYYY-MM-DD].md` formatting via `.obsidian/templates/Weekly_Review_Template.md`.
"""

# --- DIRECTORY STRUCTURE BLUEPRINT ---

DIRECTORIES = [
    "00_MOCs",
    "01_Journal",
    "01_Journal/Reviews",
    "02_Human_Thoughts",
    "10_Repositories",
    "15_Prototype_Designs",
    "20_DevOps",
    "25_Knowledge_Base",
    "30_Git",
    "40_Agent_Skills/routine-automation",
    "40_Agent_Skills/create-second-brain-prd",
    "40_Agent_Skills/pieces-integration",
    "40_Agent_Skills/notebooklm-sync",
    "50_Databases",
    "60_Canvas_Maps",
    "80_Templates",
    "90_Assets",
    ".obsidian/templates",
    ".openclaw"
]

@app.command()
def generate(path: str = typer.Argument(..., help="Path to spin out the new Obsidian vault")):
    """
    Spin out a new, pristine Agentic Personal OS Obsidian Vault.
    """
    target_path = Path(path)
    console.print(f"[bold cyan]🏛️ Architect System Spinning out vault at:[/bold cyan] {target_path.absolute()}")

    # Scaffold directories
    for diff in DIRECTORIES:
        dir_path = target_path / diff
        dir_path.mkdir(parents=True, exist_ok=True)
        # Create a .gitkeep or README for structured folders
        if diff in ["50_Databases", "60_Canvas_Maps", "25_Knowledge_Base", "15_Prototype_Designs"]:
            (dir_path / "README.md").write_text(f"# {diff}\n\nAutomated tracking for {diff} objects.")
    
    # Write System Files
    (target_path / "SOUL.md").write_text(SOUL_MD, encoding="utf-8")
    (target_path / "CLAUDE.md").write_text(CLAUDE_MD, encoding="utf-8")
    (target_path / "MEMORY.md").write_text(MEMORY_MD, encoding="utf-8")
    (target_path / "USER.md").write_text(USER_MD, encoding="utf-8")
    (target_path / "HEARTBEAT.md").write_text(HEARTBEAT_MD, encoding="utf-8")
    
    # Write Default Skills
    (target_path / "40_Agent_Skills/routine-automation/SKILL.md").write_text(SKILL_ROUTINES, encoding="utf-8")

    # MCP Hooks
    claude_json = {
        "mcpServers": {
            "obsidian-vault-search": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-obsidian", "--dir", "."] },
            "pieces-memory": { "command": "npx", "args": ["-y", "@pieces-app/mcp-server"] }
        }
    }
    (target_path / "claude.json").write_text(json.dumps(claude_json, indent=2), encoding="utf-8")
    
    console.print("[bold green]✅ Blueprint generated successfully! 100% Architectural Purity achieved.[/bold green]")

if __name__ == "__main__":
    app()
