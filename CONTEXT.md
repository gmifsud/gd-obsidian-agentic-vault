# Domain Glossary

Terms used when talking about this project. Keep entries short; update them when a term is sharpened.

- **Vault** — an Obsidian folder managed by this project. The one in `vault/` is the Blueprint from which new Vaults are generated.
- **Zone** — the classification of a top-level Vault directory. Every directory in the Vault layout belongs to exactly one Zone: Left Hemisphere, Right Hemisphere or Assets.
- **Left Hemisphere** — the Zone for human-authored notes (`01_Journal`, `02_Human_Thoughts`).
- **Right Hemisphere** — the Zone for agent-authored knowledge (`00_MOCs`, `10_Repositories`, … `80_Templates`).
- **Assets** — the Zone for static files referenced by notes (`90_Assets`). Not part of either Hemisphere.
- **Write permission** — whether agents may write to a directory. Recorded per directory, separately from its Zone: Left Hemisphere directories are read-only to agents; Right Hemisphere and Assets directories are writable. "Right Hemisphere" is not shorthand for "agent-writable". A subdirectory may override its parent's permission, and the most specific entry wins; the only such case is `01_Journal/Reviews`, which is agent-writable while remaining Left Hemisphere.
- **Unmanaged directory** — a top-level directory owned by another tool (currently `copilot`), named as such in the Vault layout. The Engine never writes there and the Control Panel never reads there. Dot-directories and dot-files are always ignored without being listed, at any depth: never read by the Control Panel, never written by the Engine.
- **Undeclared directory** — a top-level directory that is neither in a Zone nor unmanaged. Agents may not write there, the Control Panel does not read it, and validation reports it.
- **MOC (Map of Content)** — an index note in `00_MOCs` listing the notes of one directory. The Vault layout records which MOC each directory is indexed in, or states explicitly that the directory is not indexed; saying nothing is a validation failure.
- **System file** — a Markdown file at the Vault root that the Vault needs in order to operate. Five are required: `CLAUDE.md`, `SOUL.md`, `USER.md` (read-only to agents) and `MEMORY.md`, `HEARTBEAT.md` (agent-writable). `README.md` and `AGENT_INSTRUCTIONS.md` are optional root files, read-only to agents. Any other Markdown file at the root is a validation failure.
- **Vault layout** — the single description of a Vault's directories, their Zones, their write permissions, the MOC each directory is indexed in, and its system files. Each Vault carries its own layout in `vault.config.yaml` at its root; generated Vaults inherit it from the Blueprint.
