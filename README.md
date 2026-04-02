# 🧠 Agentic Personal OS: Second Brain Architecture

Welcome to the **Agentic Personal OS**, a hybrid knowledge graph, local Obsidian vault, and dynamic React web application designed to be co-managed by a human and an AI Agent.

This document outlines what we have built so far (Current State) and our ultimate architectural destination (Future State) based on the target Claude Code + Agent SDK architecture.

---

## 🏗️ What We Have Built (Current State)

We have successfully laid the foundation for an AI-native workspace using a **Split-Brain Architecture** and a custom **React Vault Engine**.

### 1. The Split-Brain Obsidian Vault
The file system is strictly divided to prevent AI from overwriting human thoughts while giving the AI a dedicated workspace to build and organize.
*   **Left Hemisphere (Human / Read-Only for AI):**
    *   `01_Daily_Notes/`: Daily logs, tasks, and raw inputs.
    *   `02_Human_Thoughts/`: Hobbies, career ambitions, and unstructured ideas.
*   **Right Hemisphere (AI / Read & Write):**
    *   `00_MOCs/`: Maps of Content (dynamically synced).
    *   `15_Prototype_Designs/`: The AI's output folder for architectural drafts, code concepts, and system designs.
    *   `10_Repositories/`, `20_DevOps/`, `30_Git/`: Technical documentation.
    *   `80_Templates/`: Strict YAML frontmatter templates (e.g., `Media_Resource_Template.md`) to ensure structured data ingestion.

### 2. The React Vault Engine
We transformed the static Obsidian vault into a dynamic web application.
*   Built with **React, Vite, and Tailwind CSS**.
*   Dynamically parses Markdown, YAML frontmatter, and `[[WikiLinks]]` into a navigable web UI.
*   Allows the vault to be published or viewed as a seamless dashboard.

### 3. Agentic Protocols (`CLAUDE.md`)
The AI is currently governed by strict prompt-based protocols:
*   **`/new`**: Ingests data, applies templates, and auto-updates MOCs.
*   **`/today` & `/weekly`**: Scans daily notes to extract tasks, blockers, and accomplishments, cross-referencing them with active `Prototype Designs`.
*   **Data Ingestion Protocol**: Automatically summarizes, tags, and interlinks new Informational VODs and articles.

---

## 🚀 Where We Are Going (Target Architecture)

The next evolution of this project transitions from a passive file system to an **Active, Proactive Agentic OS** powered by Claude Code, an Agent SDK, and a Python API layer. 

Based on our target architecture diagram, here is the roadmap:

### 1. Advanced Memory Layer (Core)
We will upgrade the vault from simple markdown files to a fully queryable memory engine.
*   **Core Files:** Introduce `SOUL.md` (Identity & rules), `USER.md` (User profile), `MEMORY.md` (Decisions & lessons), and `HEARTBEAT.md` (Checklists).
*   **Hybrid Search:** Implement a local search engine using **SQLite + sqlite-vec + FTS5**. It will use a 0.7 vector / 0.3 keyword weighting (via FastEmbed ONNX `all-MiniLM-L6-v2`) to allow the AI to instantly recall past context.

### 2. Lifecycle Hooks (Claude Code)
We will implement automated memory management tied to session lifecycles:
*   **SessionStart:** Automatically loads `SOUL.md`, `USER.md`, and `MEMORY.md` into the AI's context.
*   **PreCompact:** Saves context before the context window fills up, flushing it to a daily log.
*   **SessionEnd:** Saves the final context of the session to the daily log.

### 3. Direct Integrations (Python API Layer)
The AI needs to interact with the outside world. We will build a Python API layer (`query.py`) to feed external data into the Memory Layer:
*   **Integrations:** Gmail, Calendar, Asana, Slack, Google Sheets, Docs, Drive, and Circle.
*   **CLI Usage:** e.g., `query.py calendar today` or `query.py asana overdue`.

### 4. Proactive Agents (Agent SDK)
Currently, the AI only acts when prompted. We will introduce background agents:
*   **Heartbeat Agent:** Runs every 30 minutes (8 AM - 10 PM). Gathers APIs, reasons about the data, and sends proactive notifications (Toast + Slack + daily log updates).
*   **Daily Reflection Agent:** Runs at 8 AM daily. Extracts key decisions, lessons learned, and active projects from the raw Daily Logs, and promotes them to long-term memory (`MEMORY.md`).

### 5. Chat Interface & Skills
*   **Slack Integration:** Move from terminal/IDE chats to a persistent Slack DM interface connected to a Session DB.
*   **Skills Framework:** Expand our current templates into a robust 22-skill framework (Infrastructure, Utility, Content) invoked via `/skill-name`.

---

## 🛠️ Next Steps (Phase 7)

To bridge the gap between our current state and the target architecture, our immediate next steps are:
1.  **Initialize Core Memory Files:** Create `SOUL.md`, `USER.md`, and `MEMORY.md`.
2.  **Setup the Python Environment:** Scaffold the `query.py` CLI and SQLite vector database for Hybrid Search.
3.  **Draft the Heartbeat Script:** Create the initial cron job/script for the 30-minute proactive monitoring loop.
