# The Ledger (Active AI Memory)

> **Agent Instruction:** Update this file whenever context shifts, a major milestone is reached, or a session ends. Keep it concise. Delete old logs when they are no longer relevant.

## 🎯 Current Focus
- Establishing the baseline Agentic Personal OS structure.
- Preparing to ingest the first batch of Repositories and Informational VODs.

## 🚧 Active Blockers / Pending Items
- None. System is initializing.

## 📜 Rolling Log (Last 5 Actions)
- [2026-11-14 18:30] Control Panel now tolerates bad frontmatter (`frontend/note.js`; 19 notes flagged via `frontmatter_error`, not corrected); `API_BASE` fixed; `AGENT_INSTRUCTIONS.md` aligned. Uncommitted. See doc section 8.5.
- [2026-11-14 19:00] Dot-directories and dot-files now ignored at any depth (Control Panel reads, Engine writes); Blueprint `/api/files` 7,887 → 3,041 notes, 14 flagged. 53 pytest + 14 Node tests pass. Committed (aed99a0). See doc section 8.6.
- [2026-11-14 19:30] Control Panel bundle rebuilt (build was failing on a `#` path; glob now excludes them) and seven screens checked by screenshot; frontmatter warnings now once per run. Code committed (aed99a0); doc section 8.7 uncommitted. Open: static bundle includes `copilot/` and `Connections/` notes; nothing clicked. See doc section 8.7.
- [2026-11-14 20:05] Three symlinks into the Knowledge Vault removed (`10_Repositories/Projects`, `10_Repositories/ISL.Azure.Licensing`, `25_Knowledge_Base/Connections`); Blueprint now 51 notes, none flagged, bundle 0.7 MB. Two link deletions uncommitted. Open: `copilot/` and root `Connections/` still bundled by a local build. See doc section 8.8.
- [2026-11-14 23:50] Rewrote the repository README as a usage guide (layout, may-write, notes, frontmatter, sessions, symlinks, Control Panel dev versus built bundle) and corrected `vault/README.md`, which described a generator command that does not exist.
