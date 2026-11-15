# gd-obsidian-agentic-vault — AGENTS.md

> Generic agent runner contract. Auto-discovered by Codex CLI, Cursor, Kilo, and other AGENTS.md-aware tools.
> Index, not data dump. Keep <200 lines.

## Project
- **Name:** gd-obsidian-agentic-vault (Vau-M)
- **What it is:** a Blueprint Obsidian vault that agents can work in safely, plus the Engine that checks and modifies it and the Control Panel that displays it.
- **Stack:** Python 3.13 Engine (typer, rich, pyyaml; venv in `backend/venv`) · Node 20 Control Panel (Express API + React/Vite/TypeScript) · Obsidian vault in `vault/`
- **Owner:** grego
- **Repo root:** `D:\Repos\gd-obsidian-agentic-vault`
- **Bootstrapped:** 2026-11-14 via `agentforge`

## Operating Principles

### 95% Confidence Rule
1. Read the actual files involved — do not assume content.
2. Trace the full call chain from entry point to effect.
3. If confidence <95%, state what's missing and ask. Never guess.

### Determinism
Reproducibility across environments is required. Flag non-determinism explicitly.

### Surgical Changes
Target the specific file/function causing the issue. No cascading defensive refactors.

### Vault write rule
Before creating or editing a file under `vault/`, run `backend/vault_manager.py may-write <path>` (exit 0 = allowed). `01_Journal/` and `02_Human_Thoughts/` are read-only except `01_Journal/Reviews/`; `copilot/` is never written.

## Map
- Domain terms: `CONTEXT.md`
- Vault layout (single source of truth): `vault/vault.config.yaml`
- In-Vault agent instructions: `vault/CLAUDE.md`, `vault/SOUL.md`, `vault/AGENT_INSTRUCTIONS.md`, ledger `vault/MEMORY.md`
- Engine: `backend/vault_layout.py`, `backend/vault_manager.py`, `backend/query.py`, `backend/session_catalogue.py`, `backend/architect_generator.py`
- Control Panel: `frontend/server.js`, `frontend/vaultLayout.js`, `frontend/sessions.js`, `frontend/src/`
- Tests: `backend/tests/` (pytest), `frontend/*.test.js` (node --test)
- Decisions / plans: `docs/architecture-review-2026-11-14.md`, `docs/implementation-plan-knowledge-lifecycle.md`

## Build & Run
```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py validate
.\backend\venv\Scripts\python.exe -m pytest backend\tests -q
cd frontend; npm test; npm run lint
npm run dev      # Control Panel: API + Vite (http://localhost:3000)
```

## Conventions
- British English where natural.
- No committed build artifacts; no magic strings without constants.
- Review format: **Verdict → Location → Issue → Impact → Remediation → Verification**.
- Directory lists in prose must agree with `vault/vault.config.yaml`; `validate` checks this.

## Skills
Skill library symlinked at `.agents/skills/` (or `.codex/skills/` depending on target). Reference specific skills; do not bulk-load.

## Token Hygiene
- Batch instructions in a single prompt where possible.
- Use surgical file references (`@path/file.ts`), never "search the repo".
- Limit shell output (`head`, `--oneline`, `-n N`).
- Prefer cheaper models for sub-agents and formatting tasks.

## Lessons Learned
<!-- One-line bullets, <15 words, prune weekly -->
- Run the Engine with `backend\venv` Python, not system `python`.
- A relative `VAULT_PATH` resolves against `frontend/`; use absolute paths.

## Decisions Log
<!-- Stable architectural decisions. Link ADRs where they exist. -->
- Each Vault carries its own layout in `vault.config.yaml`; no built-in default.
- Zone and write permission are separate facts.
- Harness transcripts stay in the harness store; `35_Sessions/` holds catalogue notes.
