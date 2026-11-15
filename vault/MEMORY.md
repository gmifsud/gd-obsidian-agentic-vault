# The Ledger (Active AI Memory)

> **Agent Instruction:** Update this file whenever context shifts, a major milestone is reached, or a session ends. Keep it concise. Delete old logs when they are no longer relevant.

## 🎯 Current Focus
- PRD VAUM-KLC-001 v0.1 approved and implemented through M1–M5: [[PRD - Knowledge Lifecycle Correctness]]. Current state: acceptance_pending.
- Codex learning loop and shared correctness regressions pass; actual Codex MCP client exercised. See [[2026-11-15 - Knowledge Lifecycle Implementation Evidence]] and `docs/knowledge-lifecycle-usage.md`.

## 🚧 Active Blockers / Pending Items
- Complete the visual draft/save/approve/revoke walkthrough and record Gregory's AC-20 usefulness response. HTTP integration is proven; visual evidence currently covers the session list only.
- Other five harnesses remain browsing/catalogue-only and unqualified for knowledge/full export. Working tree remains uncommitted; preserve pre-existing WIP.

## 📜 Rolling Log (Last 5 Actions)
- [2026-11-14 23:50] Rewrote the repository README as a usage guide (layout, may-write, notes, frontmatter, sessions, symlinks, Control Panel dev versus built bundle) and corrected `vault/README.md`, which described a generator command that does not exist.
- [2026-11-15 01:20] Removed `Connections/` from the Vault layout and the prose that restates it. `copilot/` stays unmanaged and is not taken over by the Engine. See doc section 8.9.
- [2026-11-15 01:30] Catalogued the two Obsidian Copilot conversations as short notes in `35_Sessions/` (`catalogue-copilot`). The plugin keeps the transcripts, skills, and prompts. Sessions page now lists Copilot. See doc section 8.10.
- [2026-11-15 04:56] Completed Phase 1 (Tasks 1.1–1.4): populated root `CLAUDE.md`/`GEMINI.md`/`AGENTS.md`, fixed all broken MOC links and code-span false positives (`validate` exits 0), added `Knowledge_Base_MOC.md` + frontmatter syntax validation + `_append_to_moc_index`, and built `backend/knowledge_index.py` (heading-chunked FTS5 + optional vector search across the Right Hemisphere). 74 Python tests and 17 frontend tests pass.
- [2026-11-15 05:18] Completed Phases 2–4 (Tasks 2.1–4.2): added `backend/session_providers.py` + `catalogue-sessions` across all 6 harnesses, added distillation templates (`Troubleshooting_Template.md`, `Session_Synthesis_Template.md`, `ADR_Template.md`) + `backend/session_distiller.py` + Control Panel "Distill to Vault" action, upgraded `query.py compact` to archive evicted Ledger entries to `35_Sessions/Memory_Ledger_Archive.md`, added `query.py brief`, and exposed the stdio MCP server (`backend/mcp_server.py`). 87 Python tests and 17 frontend tests pass.
- [2026-11-15] Drafted corrective PRD VAUM-KLC-001 v0.1 with 20 acceptance cases and five data-first milestones, linked from [[PRD - Knowledge Lifecycle Correctness]]. Pending approval; execution code unchanged. Earlier completion entries are historical claims qualified by the objective review; existing log entries retained without compaction.
- [2026-11-15] Gregory approved “go ahead”; implemented M1–M5 with scoped native evidence, safe publication/recovery, explicit revision review, fresh lexical context and shared adapters. 122 Python/20 Node tests, TypeScript, vault validation, sanitised build and actual generated-config Codex MCP check passed. Final catalogue metadata refresh preserves human text/comments and batch progress. Full visual form and AC-20 human usefulness remain pending; see [[2026-11-15 - Knowledge Lifecycle Implementation Evidence]]. Historical entries retained without compaction.
