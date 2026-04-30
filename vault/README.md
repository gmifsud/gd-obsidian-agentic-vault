# 🏛️ Architect: Agentic Personal OS Generator

Welcome to **Architect** — a software solution and codebase designed to generate, manage, and scale AI-native "Agentic Personal OS" Obsidian Vaults. 

This repository is **NOT** just a single personal vault; it is the **Blueprint Generator**. It couples a custom React vault-parsing engine with Python orchestration scripts to autonomously spin out perfect, 100% architecturally pure obsidian environments.

## 🧬 The Blueprint Pattern (Generated Output)

When Architect spins out a new vault via the `backend/architect_generator.py`, it deploys a strictly validated Split-Brain Architecture:

### 1. Left Hemisphere (Human / Read-Only for AI)
*   **`01_Journal/`**: Daily logs, tasks, and raw inputs. (Replacing the old `01_Daily_Notes` naming convention).
*   **`02_Human_Thoughts/`**: Hobbies, career ambitions, unstructured ideas.

### 2. Right Hemisphere (AI Workspace)
*   **`15_Prototype_Designs/`**: The AI's output folder for code concepts and logic.
*   **`25_Knowledge_Base/`**: Processed research, PRDs, and NotebookLM-synced content.
*   **`40_Agent_Skills/`**: Standard execution skills (`/daily-plan`, `/weekly-review`).
*   **`50_Databases/`**: Vault databases (`.base` tracking).
*   **`60_Canvas_Maps/`**: Spatial logic diagrams (`.canvas` tracking).
*   **`80_Templates/`**: Strict YAML frontmatter templates (e.g., `Media_Resource_Template.md`).

### 3. The AI Triad
Every generated vault is injected with a 3-part identity layer for Claude Code:
*   **`CLAUDE.md`** (The Bootloader)
*   **`SOUL.md`** (The Identity, Persona, and Rules limit)
*   **`MEMORY.md`** (The Rolling Context Ledger)
*   **`HEARTBEAT.md`** (The Background Cron Checklist)

---

## ⚡ How to Spin Out a New Vault

Architect is equipped with a Python Typer CLI that acts as the vault generator. 

1. Navigate to the Architect workspace environment
2. Install the lightweight Python dependencies (if missing):
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Run the generator to clone the pristine blueprint into any target directory:
   ```bash
   python backend/architect_generator.py generate "/path/to/my-new-second-brain"
   ```

## 🌐 The React Vault Engine

Architect also includes a Next-Gen Vault Engine running out of `src/`. This provides a React, Vite, and Tailwind CSS web interface allowing you to statically host or securely browse the Vaults that you deploy via your CLI tools!
