# Vau-M

Vau-M is a Blueprint for an Obsidian vault that AI agents can work in safely, plus the tools that check and copy it.

The Vault is split into three Zones. The Left Hemisphere holds human writing and is read-only to agents. The Right Hemisphere holds agent-authored notes and is writable. The Assets Zone holds files that notes refer to, such as images and diagrams, and is writable. One file, `vault/vault.config.yaml`, states which directory is in which Zone, whether agents may write there, and which Map of Content indexes it. The words for all of this are defined in `CONTEXT.md`.

```
vault/       The Blueprint. Open this folder as an Obsidian vault.
backend/     The Engine. Python commands that check and modify a Vault.
frontend/    The Control Panel. A browser view of a Vault.
```

## Best practice

These are the rules that keep a Vault consistent. The layout file wins if anything else disagrees with it.

### Look up a path before writing it

Agents check a path before creating or editing it. From the repository root:

```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py may-write 30_Git/note.md
```

Exit 0 means the write is allowed, and the command prints the reason. Exit 1 means it is refused. The same command is the check for a person who is unsure where a note belongs.

The Engine refuses anything outside a directory the layout declares. It also refuses dot-files and dot-directories at any depth, the unmanaged directory `copilot/`, and the read-only system files.

### Put a note in the directory it belongs to

| Directory | Zone | Agents may write | Indexed in |
|---|---|---|---|
| `01_Journal/` | Left | No, except `01_Journal/Reviews/` | — |
| `02_Human_Thoughts/` | Left | No | — |
| `00_MOCs/` | Right | Yes | — |
| `10_Repositories/` | Right | Yes | `Repositories_MOC.md` |
| `15_Prototype_Designs/` | Right | Yes | — |
| `20_DevOps/` | Right | Yes | `DevOps_MOC.md` |
| `25_Knowledge_Base/` | Right | Yes | — |
| `30_Git/` | Right | Yes | `Git_MOC.md` |
| `35_Sessions/` | Right | Yes | `Sessions_MOC.md` |
| `40_Agent_Skills/` | Right | Yes | — |
| `50_Databases/` | Right | Yes | — |
| `60_Canvas_Maps/` | Right | Yes | — |
| `80_Templates/` | Right | Yes | — |
| `90_Assets/` | Assets | Yes | `Assets_MOC.md` |

`10_Repositories/` holds notes about repositories. It is a poor place to mount a checkout or another vault: the Control Panel reads every note under a declared directory, and an edit there lands in that other tree.

A new top-level directory belongs in `vault.config.yaml`, either under `directories` or under `unmanaged`. A directory that is present and undeclared fails validation.

### Create notes through the Engine

This creates a note from a template, then indexes it. `30_Git/` is used because the layout names a Map of Content for it. Paths are relative to the Vault root.

```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py inject-template Git_Resource_Template.md "30_Git/Git - Example.md" --title "Git - Example"
.\backend\venv\Scripts\python.exe backend\vault_manager.py auto-update-moc "30_Git/Git - Example.md"
```

`inject-template` refuses to overwrite an existing file. The template name is the file name in `vault/80_Templates/`, and `--var key=value` fills in a placeholder. `create-folder <path>` creates a directory and gives it a short README. `list-templates` prints the templates and the fields each one declares.

`auto-update-moc` reads the layout and appends the note to the Map of Content named there. Where the layout says `moc: null`, the command reports that and does nothing, which is the correct outcome.

### Write frontmatter that parses

A note's properties live in a YAML block between `---` lines at the top. Quote any value that contains a colon followed by a space:

```yaml
title: "PRD: platform admin portal"
```

A note with no properties should open with a heading. A `---` on the first line starts a properties block, so a horizontal rule there is read as YAML.

The Control Panel still serves a note whose properties do not parse, with empty properties, and prints one warning per note each time the server runs. `validate` does not currently check frontmatter.

### Close a session in the Ledger

`vault/MEMORY.md` is the rolling session ledger, and agents may write it. At the end of a session, append one line to the Rolling Log and then keep the file to its last five entries:

```powershell
.\backend\venv\Scripts\python.exe backend\query.py compact
```

`HEARTBEAT.md` is the checklist for `query.py heartbeat`, and `query.py reset-heartbeat` clears it for the next run. `CLAUDE.md`, `SOUL.md` and `USER.md` are read-only, as are `README.md` and `AGENT_INSTRUCTIONS.md`. Any other Markdown file at the Vault root fails validation.

### Keep other tools' files out of the notes

`copilot/` is unmanaged: the Obsidian Copilot plugin creates it and keeps writing there, and the Engine never writes there. The Control Panel's API does not list it as Vault notes. The Sessions page reads `copilot/copilot-conversations/` only, and `vault_manager.py catalogue-copilot` writes a short note per conversation into `35_Sessions/`. The transcript stays in the plugin folder. Skills and custom prompts in that folder are plugin configuration and are left alone. A local `npm run build` still bundles every Markdown file under `copilot/`, because the static fallback globs the whole Vault, so keep secrets out of it. Dot-directories and dot-files are ignored at any depth, which covers `.obsidian/`, `.git/` and tool directories such as `.cursor/`. The bundler already skips dot-directories.

Symlinks need care. A link inside a declared directory is followed, so the Control Panel reads the other tree and a local build of the Control Panel bundles it. The Blueprint previously linked the Knowledge Vault this way, and that vault now stays separate until it has had its own analysis. Remove a link by the link itself, for example `cmd /c rmdir` on Windows. A recursive delete follows the link and removes the target's contents.

### Check the Vault before trusting it

```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py validate
```

The command prints two sections. **Layout checks** cover the directories, the system files and the prose files that restate the directory lists. **MOC link checks** cover wikilinks in the Maps of Content. On this Blueprint the layout section passes, and the link section fails on ten known links; that failure is recorded in `docs/architecture-review-2026-11-14.md` and is left for a later change. Read the section headings to see which result you have.

Every command prints the Vault root it acted on, to standard error, so a command aimed at the wrong Vault is visible.

## Daily use

### Engine

Run commands from the repository root with the virtual environment's Python, so they read the same `.env` as the Control Panel:

```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py vault-status
```

On macOS or Linux the interpreter is `backend/venv/bin/python`. `vault-status` prints a JSON report. The root `package.json` scripts `backend:status`, `backend:validate` and `backend:templates` call `python` on the path rather than the virtual environment.

`VAULT_PATH` selects the Vault, and it defaults to this repository's `vault/`. Set it to an absolute path. A relative value is resolved against `frontend/`, which is rarely what you want. The variable may live in the repository `.env` or the environment.

`query.py embed` and `query.py search` index and search `25_Knowledge_Base/`. They need `fastembed` and `numpy`, which are listed as optional in `backend/requirements.txt` and are not installed by the setup below.

### Control Panel

```powershell
npm run dev      # API server and the Vite dashboard, with hot reload
npm run build    # rebuild frontend/dist
npm run server   # API server, and the built dashboard when frontend/dist exists
```

While developing, use the Vite address, `http://localhost:3000` unless `VITE_PORT` says otherwise. The API port (`PORT` or `VITE_API_PORT`, 3001 by default) serves `frontend/dist` whenever that directory exists, so a page opened there can be an old build. Rebuild after changing the dashboard, then restart `npm run server`.

The first load asks the API for the text of every note. On this Blueprint that is 51 notes and returns in well under a second. A Vault that mounts a large tree will take much longer, and a local build will bundle those notes into `frontend/dist`.

A Vault with no usable `vault.config.yaml` shows an error screen naming the missing file. Copy the `layout` section from this Blueprint and adjust it.

### Obsidian

Open `vault/` as a vault. The plugins to enable are listed in `vault/.obsidian/community-plugins.json`. The Copilot plugin writes `vault/copilot/`, which is unmanaged, so its notes stay out of the Control Panel.

### A new Vault

The generator copies this Blueprint. It requires a valid layout and all five required system files, and it has no built-in layout of its own.

```powershell
.\backend\venv\Scripts\python.exe backend\architect_generator.py D:\path\to\new-vault
```

The new Vault gets the declared directories, the required system files, and the contents of `00_MOCs/`, `40_Agent_Skills/` and `80_Templates/`. It also gets a `vault.config.yaml` containing this Blueprint's layout, and a `claude.json` describing two MCP servers. Point `VAULT_PATH` at it before running the Engine against it. `--from-vault` selects a different Blueprint.

## Setup

Node.js 20 or newer, and Python 3.13, which is the version this repository's virtual environment uses.

```powershell
cd frontend
npm install

cd ..\backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

`requirements-dev.txt` installs the runtime dependencies and pytest. Copy `.env.example` to `.env` to change ports. `GEMINI_API_KEY` in that example is not read by the Engine.

## Tests

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend\tests -q
cd frontend
npm test
npm run lint
```

## Further reading

- `CONTEXT.md` defines the terms used here.
- `vault/vault.config.yaml` is the layout these rules come from.
- `vault/CLAUDE.md`, `vault/SOUL.md` and `vault/AGENT_INSTRUCTIONS.md` are the instructions an agent reads.
- `docs/architecture-review-2026-11-14.md` records the decisions behind the layout and the results of building it.
