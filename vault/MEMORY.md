# The Ledger (Active AI Memory)

> **Agent Instruction:** Update this file whenever context shifts, a major milestone is reached, or a session ends. Keep it concise. Delete old logs when they are no longer relevant.

## 🎯 Current Focus
- Implementing the 4-phase Knowledge Lifecycle plan (`docs/implementation-plan-knowledge-lifecycle.md`).
- Phase 1 complete (bootloaders, MOC link hygiene, frontmatter validator + `Knowledge_Base_MOC.md`, and heading-chunked FTS5/hybrid search across the Right Hemisphere).

## 🚧 Active Blockers / Pending Items
- None. Ready for Phase 2 (Unified Multi-Harness Session Discovery & Cataloguing).

## 📜 Rolling Log (Last 5 Actions)
- [2026-11-14 20:05] Three symlinks into the Knowledge Vault removed (`10_Repositories/Projects`, `10_Repositories/ISL.Azure.Licensing`, `25_Knowledge_Base/Connections`); Blueprint now 51 notes, none flagged, bundle 0.7 MB. Two link deletions uncommitted. Open: `copilot/` and root `Connections/` still bundled by a local build. See doc section 8.8.
- [2026-11-14 23:50] Rewrote the repository README as a usage guide (layout, may-write, notes, frontmatter, sessions, symlinks, Control Panel dev versus built bundle) and corrected `vault/README.md`, which described a generator command that does not exist.
- [2026-11-15 01:20] Removed `Connections/` from the Vault layout and the prose that restates it. `copilot/` stays unmanaged and is not taken over by the Engine. See doc section 8.9.
- [2026-11-15 01:30] Catalogued the two Obsidian Copilot conversations as short notes in `35_Sessions/` (`catalogue-copilot`). The plugin keeps the transcripts, skills, and prompts. Sessions page now lists Copilot. See doc section 8.10.
- [2026-11-15 04:56] Completed Phase 1 (Tasks 1.1–1.4): populated root `CLAUDE.md`/`GEMINI.md`/`AGENTS.md`, fixed all broken MOC links and code-span false positives (`validate` exits 0), added `Knowledge_Base_MOC.md` + frontmatter syntax validation + `_append_to_moc_index`, and built `backend/knowledge_index.py` (heading-chunked FTS5 + optional vector search across the Right Hemisphere). 74 Python tests and 17 frontend tests pass.
