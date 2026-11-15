# Blueprint Vault

This folder is the Blueprint Vault. The repository [README](../README.md) explains how to use it, how to check it, and how to generate a new Vault from it.

The layout of this Vault is [`vault.config.yaml`](vault.config.yaml). That file states each directory's Zone, whether an agent may write there, and which Map of Content indexes it.

An agent reads these three files before doing anything:

1. [`CLAUDE.md`](CLAUDE.md) — what to do first.
2. [`SOUL.md`](SOUL.md) — identity and permissions.
3. [`MEMORY.md`](MEMORY.md) — the current focus and the last actions.

Before writing a path, check it from the repository root:

```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py may-write 30_Git/note.md
```

`01_Journal/` and `02_Human_Thoughts/` are read-only, apart from `01_Journal/Reviews/`. `copilot/` belongs to the Obsidian Copilot plugin. Dot-files and dot-directories are ignored at any depth.
