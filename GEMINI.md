# gd-obsidian-agentic-vault

> **Index, not data dump.** Point Gemini at the right files; don't paraphrase them here.
> Auto-loaded every turn — keep this file <200 lines.

## 1. Project Snapshot
- **Name:** gd-obsidian-agentic-vault (Vau-M)
- **What it is:** a Blueprint Obsidian vault that agents can work in safely, plus the Engine that checks and modifies it and the Control Panel that displays it.
- **Stack:** Python 3.13 Engine (typer, rich, pyyaml; venv in `backend/venv`) · Node 20 Control Panel (Express API + React/Vite/TypeScript) · Obsidian vault in `vault/`
- **Owner:** grego
- **Repo root:** `D:\Repos\gd-obsidian-agentic-vault`
- **Bootstrapped:** 2026-11-14 via `agentforge`

## 2. Non-Negotiables

### 95% Confidence Rule
Before modifying ANY code or suggesting changes:
1. Read the actual files involved — do not assume content.
2. Trace the full call chain from entry point to effect.
3. If confidence is below 95%, state what's missing and ask. Never guess.

Be surgical: target the specific file/function/chain causing the issue. No cascading defensive changes.

### Determinism
If it can't be reproduced reliably across environments, it's broken. Flag non-determinism explicitly.

### Isolation Boundaries
Tenant logic, module boundaries, plugin scopes — any change crossing a boundary gets extra scrutiny and explicit justification.

### Vault write rule
Before creating or editing a file under `vault/`, ask the Engine: `backend/vault_manager.py may-write <path>` (exit 0 = allowed). The Left Hemisphere (`01_Journal/`, `02_Human_Thoughts/`) is read-only except `01_Journal/Reviews/`; `copilot/` is unmanaged and never written.

## 3. Map (where things live)
- **Domain terms:** `@CONTEXT.md` (Vault, Zone, Hemisphere, MOC, System file, Vault layout)
- **Vault layout (single source of truth):** `@vault/vault.config.yaml`
- **Agent instructions inside the Vault:** `@vault/CLAUDE.md`, `@vault/SOUL.md`, `@vault/AGENT_INSTRUCTIONS.md`, ledger `@vault/MEMORY.md`
- **Engine (Python):**
  - `@backend/vault_layout.py` — loads the layout; Zone, write permission, MOC lookup
  - `@backend/vault_manager.py` — CLI: `may-write`, `inject-template`, `auto-update-moc`, `validate`, `vault-status`, `catalogue-copilot`
  - `@backend/query.py` — CLI: `compact`, `heartbeat`, `embed`, `search`
  - `@backend/session_catalogue.py` — catalogues harness conversations into `vault/35_Sessions/`
  - `@backend/architect_generator.py` — generates a new Vault from the Blueprint
- **Control Panel (Node):** `@frontend/server.js` (API), `@frontend/vaultLayout.js` (layout reader), `@frontend/sessions.js` (session explorer for six harnesses), `@frontend/src/` (React UI)
- **Tests:** `@backend/tests/` (pytest), `@frontend/*.test.js` (node --test)
- **Decisions / plans:** `@docs/architecture-review-2026-11-14.md`, `@docs/implementation-plan-knowledge-lifecycle.md`

## 4. Build & Run
```powershell
# Engine (from repo root, Windows)
.\backend\venv\Scripts\python.exe backend\vault_manager.py validate
.\backend\venv\Scripts\python.exe backend\vault_manager.py may-write 30_Git/note.md
# Tests
.\backend\venv\Scripts\python.exe -m pytest backend\tests -q
cd frontend; npm test; npm run lint
# Control Panel
npm run dev      # API + Vite with hot reload (http://localhost:3000)
npm run build    # rebuild frontend/dist
```

## 5. Conventions
- British English in prose and identifiers where natural (favour, behaviour, analyse).
- No committed build artifacts. No fragile path aliases. No magic strings without constants.
- Code review format: **Verdict → Location → Issue → Impact → Remediation → Verification**.
- Directory lists in prose must agree with `vault/vault.config.yaml`; `validate` checks this.

## 6. Skills
Skill library is junction-linked at `.gemini/skills/` → vault root. Reference a specific skill when invoking it; do not bulk-load.

## 7. Token Hygiene (operational)
- Use `/clear` when switching unrelated tasks.
- Disconnect MCP servers not needed for the current task (~18k tokens each).
- Batch prompts; edit + regenerate instead of follow-up corrections.
- Use Plan Mode for non-trivial work.
- Run `/context` and `/cost` periodically.
- Compact at ~60% context, not auto-trigger at 95%.
- Run `/compact` or `/clear` before breaks >5 min (prompt cache timeout).
- Surgical file refs (`@path/to/file.ts:fn`), never "search the repo".
- Limit shell output: `head`, `tail`, `--oneline`, `-n`. Deny heavy commands in permissions.
- Gemini Pro by default. Flash for sub-agents and formatting. Ultra only for deep architecture.

## 8. Lessons Learned
<!--
When something fails repeatedly, when I have to re-explain, or when a workaround is found
for a platform, tool, or limitation, add a one-line bullet here.
Keep each bullet under 15 words. No explanations. Only add things that will save time in future sessions.
Review weekly — prune anything stale.
-->
- Run the Engine with `backend\venv` Python, not system `python`.
- A relative `VAULT_PATH` resolves against `frontend/`; use absolute paths.
- Remove a symlink with `cmd /c rmdir`; recursive delete follows it.

## 9. Decisions Log
<!-- Stable architectural decisions. One line each. Link to ADR if it deserves more. -->
- Each Vault carries its own layout in `vault.config.yaml`; no built-in default (review decision 2–3).
- Zone and write permission are separate facts (review decision 1).
- Harness transcripts stay in the harness store; `35_Sessions/` holds catalogue notes (review 8.10).
