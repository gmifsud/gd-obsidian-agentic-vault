# Architecture Review and Vault Layout Design — 14 November 2026

This document records an architecture review of the repository and the design session that followed for the first candidate, the **Vault layout module**. It covers what was examined, every decision that was made, the options that were rejected and why, what was changed in the working tree, and what remains to be done.

Status: **design agreed, Vault layout module built, tested and committed (`31be473`).** Sections 1 to 7 were written before the build and describe the design; section 8 records what was built and how it was checked.

Domain terms used here (Vault, Zone, Hemisphere, Assets, Unmanaged directory, MOC, System file, Vault layout) are defined in [`CONTEXT.md`](../CONTEXT.md).

## Contents

1. [How the session went](#1-how-the-session-went)
2. [The review](#2-the-review)
3. [Design decisions for the Vault layout module](#3-design-decisions-for-the-vault-layout-module)
4. [Changes made during the session](#4-changes-made-during-the-session)
5. [Side question: storing a session in the Vault](#5-side-question-storing-a-session-in-the-vault)
6. [What the build will consist of](#6-what-the-build-will-consist-of)
7. [Open items](#7-open-items)
8. [Build outcome](#8-build-outcome)

---

## 1. How the session went

```mermaid
flowchart TD
  A[Architecture review requested] --> B[Read the six code files and the Vault system files]
  B --> C[HTML report: 7 candidates and 5 defects]
  C --> D[Candidate 1 chosen: Vault layout]
  D --> E[Design interview: 15 questions, one at a time]
  E --> F[Terms recorded in CONTEXT.md as they were settled]
  E --> G[AGENT_INSTRUCTIONS.md restored]
  E --> H[backend/venv untracked and rebuilt]
  E --> I[Design agreed]
  I --> J[This document]
  J --> K[Build in five steps, with tests]
  K --> L[Smoke test of the Control Panel API]
  L --> M[Committed as 31be473]
```

| Step | What happened |
|---|---|
| Review | The six hand-written code files (about 2,870 lines) were read in full, along with `vault/CLAUDE.md`, `vault/SOUL.md`, `vault/MEMORY.md`, `README.md` and the deployment workflow. No sub-agent was used. |
| Report | A self-contained HTML report was written to the OS temp directory (`architecture-review-20261114-115732.html`). It is not in the repository and may be cleaned up by the operating system; section 2 below reproduces its findings. |
| Choice | Candidate 1 was chosen to start with. |
| Interview | Fifteen questions were asked one at a time, each with a recommendation. Where a question could be answered from the code or the Vault, it was answered by looking, not by asking. |
| Side effects | Decisions that changed the working tree were carried out as they were made (section 4). |

Gaps in the process, stated for the record:

- The review skill refers to a `/codebase-design` skill and a `/domain-modeling` skill. Neither was found on this machine, so the architecture vocabulary came from the report-format guide and `CONTEXT.md` was maintained by hand.
- There was no `CONTEXT.md` and there were no ADRs before this session.

---

## 2. The review

### 2.1 What was examined

| File | Lines | Role |
|---|---|---|
| `backend/vault_manager.py` | 457 | Engine CLI: scaffolding, templates, MOC updates, status, validation |
| `backend/query.py` | 381 | Engine CLI: Ledger compaction, Heartbeat, embedding and search |
| `backend/architect_generator.py` | 253 | Blueprint generator: creates new Vaults |
| `frontend/server.js` | 473 | Control Panel API server |
| `frontend/sessions.js` | 969 | Session Explorer: reads AI tool transcripts from five providers |
| `frontend/src/lib/vault.ts` | 337 | Control Panel browser-side data access |

There were no tests anywhere in the repository.

### 2.2 Candidates

| # | Candidate | Strength | Summary |
|---|---|---|---|
| 1 | One Vault layout module | Strong | The Hemisphere map was restated in six places that disagreed, and nothing prevented a write to the Left Hemisphere. |
| 2 | Explicit Session provider seam | Strong | Five providers are dispatched through four separate `if`/`switch` blocks in `sessions.js`; adding a provider means editing all four. |
| 3 | An owner for the Ledger and Heartbeat | Strong | `MEMORY.md` and `HEARTBEAT.md` are read and written by five pieces of code and by agents directly, each assuming its own format. |
| 4 | One MOC index module | Worth exploring | `update-moc` and `auto-update-moc` index notes in two different ways; frontmatter splitting is copied three times. |
| 5 | Deeper Knowledge Base index | Worth exploring | `embed` and `search` both branch on a flag returned by `get_connection`; neither can be tested without downloading a model. |
| 6 | One Vault reader for the Control Panel | Worth exploring | Seven endpoints each walk and parse the Vault themselves; the browser carries a third frontmatter parser. |
| 7 | A real seam between Engine and Control Panel | Speculative | Vault status is computed twice with different answers; Engine results reach the Control Panel only as console text. |

Candidate 1 was recommended first because it is the smallest change, the drift was already real, and candidates 3, 4, 6 and 7 depend on it.

### 2.3 Evidence for candidate 1

How the six copies disagreed before this session:

| Copy | `90_Assets` | `00_MOCs` | System files |
|---|---|---|---|
| `backend/vault_manager.py` | archive | Right | 5 |
| `frontend/server.js` | archive | Right | 7 |
| `frontend/src/lib/vault.ts` | archive | Right | not listed |
| `backend/architect_generator.py` | unclassified | unclassified | 5 |
| `.cursorrules` | Right (writable) | Right | 3 |
| `vault/SOUL.md` | not listed | not listed | not listed |

`vault/AGENT_INSTRUCTIONS.md`, restored during the session, is a seventh copy and omits five Right Hemisphere directories.

No code checked write permission: `create-folder` and `inject-template` accept any path, including one containing `..`.

### 2.4 Defects found while exploring

These were confirmed in the code. None is fixed by the Vault layout work unless noted.

| Location | Defect |
|---|---|
| `frontend/src/lib/vault.ts:240` | `API_BASE` is used but defined nowhere, so session backup from the Control Panel always fails with "API_BASE is not defined". |
| `backend/query.py:340` | The sqlite-vec query selects `sub.distance` with no `sub` alias, so that path always fails and the Python fallback always runs. |
| `backend/query.py:170-227` | `heartbeat` ticks all five checklist items unconditionally, including "Notify" and "Sync Knowledge Base", which only list files. |
| `backend/query.py:93-116` | `sync-notebooklm` prints "Successfully synced" without sending a request. |
| `backend/vault_manager.py:90-103` | The "last Rolling Log timestamp" expects bullets beginning `- [YYYY-MM-DD]`. Nothing wrote that format before this session. |
| `frontend/server.js:204` | The path guard uses `startsWith(vaultPath)`, which also accepts a sibling directory such as `vault-backup`. |
| `frontend/server.js:436-444` | The Orchestrator endpoint builds a shell string for `exec`. The server listens on `0.0.0.0`. |
| `frontend/sessions.js:960-967` | `POST /api/sessions/backup` writes to any path the caller names. |
| `frontend/server.js:49` | `/api/files` serves every Markdown file under the Vault, including `Connections/`. Decision 4 below addresses this. |
| Repository | `backend/venv` (6,647 files) and `__pycache__` were tracked in git. Addressed during the session (section 4). |

---

## 3. Design decisions for the Vault layout module

Each entry gives the question, the options, the decision and the reason. "Recommended" marks the option proposed during the interview.

### Decision 1 — Zone and write permission are separate facts

**Question.** Can agents write to `90_Assets`, and is it a Hemisphere at all?

**Evidence.** The code called it "archive"; `.cursorrules` listed it as Right Hemisphere with read/write; `SOUL.md` did not mention it and named four archive directories that do not exist (`80_Human_Templates`, `81_Snippets`, `82_Images`, `90_Archive`); `Assets_MOC.md` tells agents to append new assets.

| Option | Outcome |
|---|---|
| Make `90_Assets` part of the Right Hemisphere | Rejected |
| Keep it as its own Zone and record write permission separately (recommended) | **Chosen** |

**Decision.** Every directory has a Zone (Left Hemisphere, Right Hemisphere or Assets) and, separately, a write permission. `90_Assets` is the Assets Zone and is agent-writable. The four non-existent archive directories are removed from `SOUL.md`.

**Consequence.** "Right Hemisphere" is no longer shorthand for "agent-writable"; the write rule is checked per directory.

### Decision 2 — The layout belongs to each Vault

**Question.** Does the layout belong to the repository or to each Vault?

**Evidence.** The Engine CLIs are hard-wired to `vault/`; the Control Panel reads whichever Vault `VAULT_PATH` names; the generator already writes a `vault.config.yaml` into each generated Vault, holding provenance only.

| Option | Outcome |
|---|---|
| Per repository: one layout for every Vault | Rejected. A generated Vault that gains a directory could not say so. |
| Per Vault: a data file in the Vault root (recommended) | **Chosen** |

**Decision.** Each Vault carries its own layout. The Blueprint in `vault/` has one, and generated Vaults inherit it.

**Note.** The recommendation named `vault.config.yaml` as the file. The answer given was "per vault", which was taken to accept the file name as well.

### Decision 3 — A missing or invalid layout fails loudly

**Question.** What happens when a Vault has no layout, or an invalid one?

| Option | Outcome |
|---|---|
| Fall back to a built-in default | Rejected. The default would be another copy of the layout in code, and a Vault could be classified by a layout it does not have. |
| Fail loudly (recommended) | **Chosen** |

**Decision.** The Engine exits non-zero with a message naming the file and what is wrong. The Control Panel shows the same error instead of a dashboard. No layout exists anywhere except in a Vault.

**Consequence.** The Blueprint generator refuses to generate without a Blueprint that has a valid layout. Its hard-coded fallback blocks (`architect_generator.py:22-153`) are deleted.

### Decision 4 — Unmanaged directories, and default deny for anything undeclared

**Question.** How should the layout treat directories it does not declare?

**Evidence.** The Blueprint contains `copilot/` (created by the Obsidian Copilot plugin), `Connections/` (contains a `Tokens` entry, which was not opened) and several dot-directories. `validate` ignored them; the Control Panel's `/api/files` read every Markdown file in them. Both named directories are untracked in git.

| Option | Outcome |
|---|---|
| Tolerate silently | Rejected |
| Declare as unmanaged, with default deny (recommended) | **Chosen** |
| Reject any undeclared directory | Rejected |

**Decision.**

- `copilot` and `Connections` are named in the layout as unmanaged: the Engine never writes there and the Control Panel never reads there.
- Dot-directories are always ignored without being listed.
- Any other undeclared directory: agents may not write there, the Control Panel does not read it, and `validate` reports it.

### Decision 5 — A subdirectory can override its parent's permission

**Question.** Is write permission set per top-level directory only?

**Evidence.** `SOUL.md` allows agents to write to the `Reviews/` subfolder of the Left Hemisphere under the `/weekly-review` protocol. The generator creates `01_Journal/Reviews`. No code knew of the exception.

| Option | Outcome |
|---|---|
| Top-level only; weekly reviews move to a Right Hemisphere directory | Rejected |
| Subdirectory override, most specific entry wins (recommended) | **Chosen** |

**Decision.** `01_Journal/Reviews` is agent-writable and remains Left Hemisphere for display. It is the only override.

**Note.** The question offered two options and the answer was "yes". It was taken as acceptance of the recommendation and stated as such at the time; it can be reversed.

### Decision 6 — System files and their permissions

**Question.** Which root files are system files, and which may agents write?

| File | Required | Agent-writable |
|---|---|---|
| `MEMORY.md` | yes | yes |
| `HEARTBEAT.md` | yes | yes |
| `CLAUDE.md` | yes | no |
| `SOUL.md` | yes | no |
| `USER.md` | yes | no |
| `README.md` | no | no |
| `AGENT_INSTRUCTIONS.md` | no | no |

Any other Markdown file at the Vault root is a validation failure, as before.

**On `AGENT_INSTRUCTIONS.md`.** The file was deleted in the working tree, uncommitted. The deletion was not remembered and was believed to be unintentional. The committed version was inspected: it is an earlier form of `.cursorrules`, lists six Right Hemisphere directories and omits five, tells agents to run `node scripts/update_moc.js` (which does not exist), and defines `/new` and `/today` commands. Nothing reads it. The recommendation was to leave it deleted; **the decision was to restore it**, and it was restored from git.

**Known trade-off.** With `USER.md` read-only, an agent cannot update the user profile through the Engine when asked.

### Decision 7 — Prose copies are checked, not generated

**Question.** What happens to the prose copies of the layout in `.cursorrules`, `vault/SOUL.md` and `vault/AGENT_INSTRUCTIONS.md`?

| Option | Outcome |
|---|---|
| Hand-maintain | Rejected. This is how they drifted. |
| Generate from the layout | Rejected. The Engine would be writing files that are read-only to agents, and it adds a command to remember. |
| Check in `validate` (recommended) | **Chosen** |
| Replace the lists with a pointer to the layout | Rejected. Agents follow a list they can see more reliably than one they must fetch. |

**Decision.** The three files stay hand-written. `validate` fails if a directory list in any of them disagrees with the layout. They are corrected by hand once, as part of the build, so the check passes from the start.

### Decision 8 — Enforcement in Engine commands only

**Question.** Where is write permission actually enforced?

**Evidence.** Writes reach the Vault through Engine commands or through an agent editing files with its own tools. The Engine never sees the second kind.

| Option | Outcome |
|---|---|
| Engine commands only (recommended) | **Chosen** |
| Engine commands plus an editor hook that blocks direct edits | Deferred |

**Decision.** Every Engine command that writes asks the layout first, and refuses read-only paths, undeclared directories, unmanaged directories and anything resolving outside the Vault. The permission check is also exposed as an Engine command that exits non-zero when the answer is no, so a hook can be added cheaply later.

**Accepted consequences.**

- A human running a write command against a read-only path is refused too; the Engine cannot tell who is calling.
- The guarantee is partial. Until a hook exists, the rule is enforced for Engine writes and only requested, in prose, for direct edits.

The hook will be re-evaluated after the build has been tested.

### Decision 9 — The Control Panel reads the file directly

**Question.** How does the Control Panel get the layout?

**Evidence.** `server.js` and `vault.ts` each hold their own lists. The Control Panel needs only display facts: Zone per directory, the system file list and what to skip. `js-yaml` is installed as a dependency of `gray-matter` and would need declaring directly.

| Option | Outcome |
|---|---|
| Ask the Engine by shelling out to Python | Rejected. Every request pays for a Python start, and the Control Panel breaks when the venv does. |
| Read `vault.config.yaml` directly (recommended) | **Chosen** |

**Decision.**

- The Engine (Python) owns the rules: it validates the file's shape and answers the permission question.
- The Control Panel (JavaScript) has a small reader for display facts only. It fails loudly if the file is missing or lacks the fields it uses, and does not re-implement validation or permissions.
- The server exposes the layout at one endpoint; the browser fetches it from there. The lists in `server.js` and `vault.ts` are deleted.
- GitHub Pages, which has no server, is left as it is: files only, with no Zones from the layout.

### Decision 10 — The layout says which MOC each directory is indexed in

**Question.** Should the layout also record each directory's MOC?

**Decision.** Yes.

### Decision 11 — A MOC is optional but must be stated

**Question.** Must every agent-writable directory have a MOC?

**Evidence.**

| Directory | MOC before this session |
|---|---|
| `10_Repositories` | `Repositories_MOC.md` |
| `20_DevOps` | `DevOps_MOC.md` |
| `30_Git` | `Git_MOC.md` |
| `90_Assets` | `Assets_MOC.md`, though `auto-update-moc` did not route to it |
| `15_Prototype_Designs`, `25_Knowledge_Base`, `40_Agent_Skills`, `50_Databases`, `60_Canvas_Maps`, `80_Templates` | none |

| Option | Outcome |
|---|---|
| Required: six new MOCs must be created | Rejected |
| Optional but explicit (recommended) | **Chosen** |

**Decision.**

- Each directory either names its MOC or is marked as not indexed. Saying nothing is a validation failure.
- The four existing MOCs are recorded, including `Assets_MOC.md`. The six other directories are marked not indexed.
- `validate` checks that every MOC the layout names exists.
- `auto-update-moc` looks up the MOC file from the layout. Its per-directory entry formatting and duplicate check stay as they are; reworking those belongs to candidate 4.
- The sentence in `.cursorrules` becomes "index it in its MOC if the layout names one".

### Decision 12 — An explicit Vault root

**Question.** Which Vault do the Engine commands act on?

**Evidence.** The Engine hard-codes the repository's `vault/`. The Control Panel follows `VAULT_PATH`. If `VAULT_PATH` points elsewhere, the Control Panel shows one Vault while its Orchestrator page runs Engine commands against another.

| Option | Outcome |
|---|---|
| Keep the path fixed | Rejected |
| Explicit Vault root (recommended) | **Chosen** |

**Decision.** The layout module is given a Vault root and does not know where it came from. The CLIs resolve the root once: `VAULT_PATH` if set, otherwise the repository's `vault/`. Every Engine command prints the root it resolved as its first line, so a stale `VAULT_PATH` is visible.

### Decision 13 — Untrack the virtual environment, rebuild it, and add tests

**Question.** What is done about the Python environment so that tests can run?

**Evidence.** `backend/venv` pointed at a Python 3.11 installation that no longer exists. It was committed to git (6,647 files) and not excluded by `.gitignore`. Python 3.12 and 3.13 are installed. `pytest` is not in `requirements.txt`.

| Option | Outcome |
|---|---|
| Rebuild in place, leave it tracked | Rejected |
| Untrack, then rebuild (recommended) | **Chosen, and carried out** |

**Decision on tests.**

- Engine: `pytest`, listed in a development requirements file. Tests build a small Vault in a temp directory and cover Zone lookup, the permission question (including the `01_Journal/Reviews` override and paths that escape the Vault), the loud failures and the MOC lookup.
- Control Panel reader: Node's built-in test runner, covering the display facts and the loud failure.

### Decision 14 — Existing broken links are left alone

**Question.** `validate` already fails on the Blueprint. How is that baseline treated?

**Evidence.** After the venv was rebuilt, `validate` exited 1 with ten broken wikilinks:

| MOC | Broken link |
|---|---|
| `Agent_SOP.md` | `[]` (false positive: not a link) |
| `Assets_MOC.md` | `[[Filename.ext]]` (false positive: a format example) |
| `DevOps_MOC.md` | `[[20_DevOps/github-actions-deploy]]` |
| `DevOps_MOC.md` | `[[20_DevOps/gitlab-ci-test]]` |
| `DevOps_MOC.md` | `[[20_DevOps/terraform-aws-core]]` |
| `DevOps_MOC.md` | `[[20_DevOps/k8s-cluster-config]]` |
| `Git_MOC.md` | `[[30_Git/Git - Feature Branching]]` |
| `Repositories_MOC.md` | `[[10_Repositories/api-gateway]]` |
| `Repositories_MOC.md` | `[[10_Repositories/auth-service]]` |
| `Repositories_MOC.md` | `[[10_Repositories/frontend-web]]` |

| Option | Outcome |
|---|---|
| Fix the links first | Rejected. It edits MOC content and the link matcher, which is candidate 4's territory. |
| Leave them and separate the output (recommended) | **Chosen** |

**Decision.** `validate` reports layout checks and MOC link checks as two named sections, each with its own pass or fail. Success for this work is "the layout section passes and the layout tests pass". The overall exit code stays 1 until the links are dealt with.

**Note.** The question offered two options and the answer was "yes". It was taken as acceptance of the recommendation.

### Decision 15 — No migration; start clean

**Question.** What about Vaults generated before this change?

| Option | Outcome |
|---|---|
| A migration command that copies the layout from the Blueprint | Rejected |
| No command, a precise error message (recommended) | **Chosen** |

**Decision.** There are no older generated Vaults in use. The one existing external Vault, the Knowledge Vault, is large and will have its own analysis. The build assumes a clean start. The generator copies the layout from the Blueprint into each new Vault's `vault.config.yaml`, alongside the provenance fields it already writes.

---

## 4. Changes made during the session

These were uncommitted when this section was written. The venv untracking was later committed as `0fb8ffe` and the rest with the build as `31be473`.

| Change | Detail |
|---|---|
| `CONTEXT.md` created | Repository root. Defines Vault, Zone, Left Hemisphere, Right Hemisphere, Assets, Write permission, Unmanaged directory, Undeclared directory, MOC, System file and Vault layout. |
| `vault/AGENT_INSTRUCTIONS.md` restored | `git restore`; identical to the committed version. |
| `backend/venv` and `backend/__pycache__` untracked | `git rm -r --cached`: 6,650 staged deletions. The files remain on disk. |
| `.gitignore` updated | Added `backend/venv/`, `__pycache__/` and `*.pyc`. |
| `backend/venv` rebuilt | Python 3.13.14, installed from `backend/requirements.txt`. The Engine CLIs run again. |
| `vault/MEMORY.md` updated | Two Rolling Log entries added for this session; compacted with `query.py compact`. |
| `docs/architecture-review-2026-11-14.md` | This document. |

Not done, and worth knowing:

- The optional search packages (`fastembed`, `numpy`, `sqlite-vec`) are commented out in `requirements.txt` and were not installed, so `query.py embed` and `query.py search` do not work in the rebuilt environment.
- `requirements.txt` has no version numbers, so a rebuild on another day can produce a different environment.

---

## 5. Side question: storing a session in the Vault

During the interview a separate question came up: how to direct an agent to record a troubleshooting session (a GitKraken hooks problem, investigated in another chat) in the Vault.

The guidance given:

- **Where:** `vault/30_Git/Git - GitKraken Hooks Troubleshooting.md`, indexed under "Static Agent Index" in `vault/00_MOCs/Git_MOC.md`, with a dated bullet in the Rolling Log.
- **Template:** start from `Git_Resource_Template.md` for the frontmatter, but replace its body sections with Problem, Symptoms, Root Cause, Fix, How to Verify and Open Questions, and ask the agent to separate confirmed findings from guesses.
- **Manual steps:** at that moment `inject-template` and `auto-update-moc` could not run because the venv was broken, so the prompt asked the agent to create the file and the MOC line by hand.

Observations that came out of it:

- `Git_Resource_Template.md` is shaped for describing a tool, not for a problem write-up. A dedicated troubleshooting template would be worth adding if more such notes are expected.
- Only `25_Knowledge_Base/` is indexed for semantic search, so a note in `30_Git/` is found through its MOC and Obsidian search, not through `query.py search`.

The other agent's entry subsequently appeared in the Rolling Log, recording that the note was written and indexed.

---

## 6. What the build will consist of

Agreed order, so that each step can be checked on its own:

1. **Engine module and tests.** The Vault layout module in Python, reading `vault.config.yaml` from an explicit Vault root, with `pytest` tests. The Blueprint's `vault/vault.config.yaml` is written with the layout agreed above.
2. **Engine commands.** `create-folder`, `inject-template`, `update-moc` and `auto-update-moc` ask the layout before writing. `validate` and `vault-status` take directories, Zones and system files from it; `validate` gains the prose check and the separated output. `auto-update-moc` routes from it. A permission-check command is added. The Vault root is resolved from `VAULT_PATH` and printed. The constant lists in `vault_manager.py` are deleted.
3. **Blueprint generator.** Creates directories from the layout, copies the layout into the new Vault's `vault.config.yaml`, and refuses to run without a valid Blueprint layout. The hard-coded fallback blocks are deleted.
4. **Control Panel.** A small reader in the server, one endpoint exposing the layout, the lists in `server.js` and `vault.ts` deleted, unmanaged and undeclared directories no longer read, and a Node test for the reader. `js-yaml` declared in `package.json`.
5. **Prose.** `.cursorrules`, `vault/SOUL.md` and `vault/AGENT_INSTRUCTIONS.md` corrected by hand so the new check passes.

The layout the Blueprint will carry:

| Directory | Zone | Agent-writable | MOC |
|---|---|---|---|
| `01_Journal` | Left Hemisphere | no | not indexed |
| `01_Journal/Reviews` | Left Hemisphere | yes (override) | not indexed |
| `02_Human_Thoughts` | Left Hemisphere | no | not indexed |
| `00_MOCs` | Right Hemisphere | yes | not indexed |
| `10_Repositories` | Right Hemisphere | yes | `Repositories_MOC.md` |
| `15_Prototype_Designs` | Right Hemisphere | yes | not indexed |
| `20_DevOps` | Right Hemisphere | yes | `DevOps_MOC.md` |
| `25_Knowledge_Base` | Right Hemisphere | yes | not indexed |
| `30_Git` | Right Hemisphere | yes | `Git_MOC.md` |
| `40_Agent_Skills` | Right Hemisphere | yes | not indexed |
| `50_Databases` | Right Hemisphere | yes | not indexed |
| `60_Canvas_Maps` | Right Hemisphere | yes | not indexed |
| `80_Templates` | Right Hemisphere | yes | not indexed |
| `90_Assets` | Assets | yes | `Assets_MOC.md` |
| `copilot`, `Connections` | unmanaged | no | — |

The MOC entries for the Left Hemisphere directories and `00_MOCs` were not discussed individually; "not indexed" is the assumption, consistent with decision 11.

---

## 7. Open items

| Item | State |
|---|---|
| Go-ahead to start the build | Given; build complete (section 8) |
| Whether to commit the venv untracking on its own first | Done: committed separately as `0fb8ffe` |
| `AGENT_INSTRUCTIONS.md` and the prose check | Done (section 8.5): the `Reviews` exception is stated and the MOC command points at `vault_manager.py auto-update-moc`. |
| Notes with unparseable frontmatter | Server made tolerant (section 8.5); `/api/files` and `/api/hemispheres` load on the Blueprint. The 19 notes themselves are not corrected. |
| `API_BASE` in `vault.ts` | Done (section 8.5); `npm run lint` passes. Session backup itself has not been exercised. |
| Dot-directories nested inside a declared directory | Decided and done (section 8.6): ignored at any depth, by the Control Panel and the Engine. |
| Control Panel in a browser | First render of seven screens checked by screenshot (section 8.7). Nothing was clicked; Sessions and Orchestrator were not opened. |
| Static bundle ignores the layout | Found in section 8.7: a local `npm run build` bundles notes from `copilot/` and `Connections/`. Not decided. |
| Editor hook for direct agent edits | Deferred until the build has been tested (decision 8) |
| The ten broken MOC links | Left for candidate 4 (decision 14) |
| Analysis of the Knowledge Vault | Separate piece of work (decision 15) |
| Pinning `requirements.txt` | Raised, not decided |
| Troubleshooting note template | Suggested, not decided |
| Candidates 2 to 7 and the defects in section 2.4 | Not started, apart from the path guard in `server.js:204`, which was fixed during the build |

---

## 8. Build outcome

The build followed the order in section 6 and was committed as `31be473`.

### 8.1 What was built

| Area | Files | Result |
|---|---|---|
| Blueprint layout | `vault/vault.config.yaml` | The layout table from section 6, plus the unmanaged list and system files. |
| Engine module | `backend/vault_layout.py` | Loads and validates the layout; answers Zone, write permission and MOC questions; compares the Vault on disk and the prose files with the layout. |
| Engine commands | `backend/vault_manager.py`, `backend/query.py` | Every writing command asks the layout first. New `may-write <path>` command (exit 0 or 1). `validate` reports layout checks and MOC link checks separately. `auto-update-moc` routes from the layout, and now reaches `Assets_MOC.md`. The constant lists are deleted. |
| Blueprint generator | `backend/architect_generator.py` | Builds from the Blueprint's layout and copies it into the new Vault. The hard-coded fallbacks are deleted. |
| Control Panel reader | `frontend/vaultLayout.js` | Display facts only. Fails loudly. |
| Control Panel server | `frontend/server.js` | New `GET /api/layout`. All Vault endpoints work from the layout. Unmanaged, undeclared and dot-directories are not read. |
| Control Panel browser | `frontend/src/lib/vault.ts`, `App.tsx`, `DashboardPage.tsx`, `HemispherePage.tsx`, `HemisphereCard.tsx` | Directory lists deleted; Zones come from `/api/layout`. An error screen is shown when the server reports no usable layout. |
| Prose | `.cursorrules`, `vault/SOUL.md`, `vault/AGENT_INSTRUCTIONS.md` | Directory lists corrected; all three pass the new check. |
| Tests | `backend/tests/`, `frontend/vaultLayout.test.js`, `backend/requirements-dev.txt` | See 8.3. |

### 8.2 Where the build differs from the design

| Design | Built | Reason |
|---|---|---|
| Each Engine command prints the Vault root as its first line (decision 12) | Printed to stderr | Keeps stdout parseable, in particular the JSON from `vault-status`. |
| Not discussed | A missing `01_Journal/Reviews` directory is not a validation failure | Git does not track empty directories, so a fresh clone would fail. The override is a permission, not a required directory. The generator still creates it. |
| `validate` checks `.cursorrules`, `SOUL.md` and `AGENT_INSTRUCTIONS.md` (decision 7) | `.cursorrules` is checked only when the Vault is the repository's own Blueprint | That file lives outside the Vault and describes the Blueprint only. |
| Not discussed | The Control Panel's "archive" key and "Archive" label became "assets" and "Assets"; the badge changed from IGNORE to READ / WRITE | Follows from decision 1. The API responses of `/api/status` and `/api/hemispheres` changed key accordingly. |
| Not discussed | A relative `VAULT_PATH` is resolved against `frontend/` by the Engine | That is what the Control Panel does; decision 12 requires both to agree. |
| Not discussed | The Engine loads the repository's `.env` files | Needed for the Engine to see the same `VAULT_PATH` as the Control Panel when run from a terminal. |
| Out of scope | The path guard in the file endpoint of `server.js` was corrected | The layout check was being added to the same lines. A sibling directory such as `vault-backup` is now refused. |
| `js-yaml` declared in `package.json` (decision 9) | Declared, and npm moved the installed version from 3.14.2 to 3.15.2 | Side effect of `npm install`. Checked: it did not change which notes parse (8.4). |

### 8.3 How it was checked

| Check | Result |
|---|---|
| `pytest backend/tests` | 51 passed. Covers loading and its loud failures, Zone lookup, write permission (override, system files, unmanaged, dot-directories, undeclared, paths escaping the Vault, a sibling directory sharing the Vault's name prefix), MOC lookup, on-disk problems, the prose check, Vault root resolution, the Blueprint's own layout, and generation into a temp directory. |
| `npm test` in `frontend/` | 9 passed. Covers Zones, readability rules, what is sent to the browser, the loud failures, and the Blueprint's own layout. |
| `vault_manager.py validate` on the Blueprint | Layout checks: PASS. MOC link checks: FAIL on the ten known links (decision 14). Exit code 1, as expected. |
| Refused writes | `create-folder 01_Journal/Sneaky` and `inject-template ... ../escape.md` both exited 1 and created nothing. |
| `may-write` | Correct for `01_Journal/x.md` (refused), `01_Journal/Reviews/r.md` (allowed), `10_Repositories/a.md` (allowed), `../x.md` (refused), `SOUL.md` (refused), `MEMORY.md` (allowed), `copilot/a.md` (refused). |
| API smoke test: a freshly generated Vault with `copilot/`, an undeclared `Surprise/` and a dot-directory added | `/api/files` returned 36 files, none from those three directories. The tree showed only declared directories with their Zones. `/api/hemispheres` returned `left`, `right`, `assets`. File requests for the unmanaged directory, the undeclared directory, `../.env.example` and `../vault-backup/x.md` all returned 403. |
| API smoke test: a Vault with no layout | Every Vault endpoint returned 500 with the "Vault layout missing" message naming the file. |
| API smoke test: the Blueprint | `/api/layout`, `/api/status`, `/api/tree`, `/api/system-files` and the file endpoint behaved correctly. `/api/files` and `/api/hemispheres` returned 500; see 8.4. |
| `npm run lint` | Fails on one error, the `API_BASE` defect listed in section 2.4. No new errors. |

Not checked: the Control Panel was not opened in a browser, so the pages themselves and the new error screen have not been seen rendering.

### 8.4 Defect found during the smoke test

On the Blueprint, `/api/files` and `/api/hemispheres` return 500. Six notes under `10_Repositories/` have frontmatter that the YAML parser rejects, and the server abandons the whole response when one note fails:

- `10_Repositories/ISL.Azure.Licensing/Repo/ISL.Azure.Licensing/docs/architecture/04-authentication-flows.md`
- `10_Repositories/ISL.Azure.Licensing/Repo/ISL.Azure.Licensing/docs/architecture/05-apiconnectivity-library.md`
- `10_Repositories/ISL.Azure.Licensing/Repo/ISL.Azure.Licensing/docs/architecture/08-security-architecture-review.md`
- `10_Repositories/Projects/External Services/Containerisation/prd-platform-admin-portal.md`
- `10_Repositories/Projects/ISL.Azure.Infrastructure/Repo/ISL.Azure.Infrastructure/docs/prd-runbook-orchestration.md`
- `10_Repositories/Projects/QiSL.Platform/Frontend.Angular/Documentation/Repo/Reviews/15935-plt-components-data-grid-3.0.0.0001/R-01 - Review Data Grid Layout Feature.md`

This was not caused by the build. The same six notes are rejected by `js-yaml` 3.14.2, the version installed before, and the endpoints read `10_Repositories/` before and after the change. It has not been fixed. Two remedies, which are not exclusive: correct the frontmatter of the six notes, or make the server skip a note it cannot parse and report it, which belongs with candidate 6 (the Vault reader).

Its practical effect is that the Control Panel's file list and Hemispheres page do not load from the API for the Blueprint until one of those is done.

### 8.5 Follow-up after the build

Three open items were closed. This, section 8.6 and the code changes in section 8.7 were committed as `aed99a0`.

**Notes with unparseable frontmatter.** The server remedy was chosen. A new module, `frontend/note.js`, has one function, `parseNote`, and all six places in `frontend/server.js` that parsed a note now go through it. A note whose frontmatter is rejected is still served, with empty frontmatter and its full text as the body; this differs from the "skip it" wording in 8.4, because a note that vanishes from the Control Panel is harder to notice than one shown without properties. The server logs a warning naming the note, and `/api/files` and `/api/file` add a `frontmatter_error` field to it. Nothing in the browser displays that field yet.

Two corrections to 8.4 came out of this:

- The count is 19 notes, not six. The six are seven distinct texts (a `terminal.md` skill reference was missed) and several exist in more than one place: the Licensing documents under both `10_Repositories/ISL.Azure.Licensing/` and `10_Repositories/Projects/ISL.Azure.Licensing/`, `prd-runbook-orchestration.md` in five worktrees, and `terminal.md` under five tool directories.
- The under-count had a cause worth recording. `gray-matter` caches by note text, and stores the entry before parsing it. A note that fails once is therefore returned on the next call as a note with no frontmatter and no error. `parseNote` bypasses that cache; a test pins this. It also means the server no longer holds every note's text in memory for its lifetime.

**`AGENT_INSTRUCTIONS.md`.** No recommendation had been given for this item; the smallest edits consistent with decisions 5 and 10 were made. The Left Hemisphere rule now states the `/weekly-review` exception for `01_Journal/Reviews/`, and the automated MOC step is `python backend/vault_manager.py auto-update-moc <path>` in place of the missing `scripts/update_moc.js`. One mention of that script remains near the top of the file as an example of a tool name.

**`API_BASE`.** No recommendation had been given for this item either. The session backup call in `frontend/src/lib/vault.ts` now uses the relative `/api/sessions/backup`, as every other call in that file does.

| Check | Result |
|---|---|
| `npm test` in `frontend/` | 14 passed (9 layout, 5 note parsing). |
| `npm run lint` | Passes. |
| `pytest backend/tests` | 51 passed. |
| `vault_manager.py validate` on the Blueprint | Layout checks: PASS, including the edited `AGENT_INSTRUCTIONS.md`. MOC link checks: FAIL on the ten known links, as before. |
| API smoke test: the Blueprint | `/api/files` 200 with 7,887 notes, 19 flagged, the same 19 on a second request, none from unmanaged directories. `/api/hemispheres`, `/api/mocs`, `/api/templates`, `/api/skills`, `/api/status` all 200. A flagged note requested on its own carries its error. |

Not checked: the Control Panel in a browser, and session backup end to end.

### 8.6 Dot-directories at any depth

**Question.** Decision 4 ignored dot-directories at the Vault root only. Should a dot-directory inside a declared directory be ignored too?

**Decision.** Yes. They hold tool configuration and duplicated skill copies, not notes. The accepted cost is that anything deliberately kept in one no longer appears in the Control Panel.

**What changed.** The rule is "a path segment that begins with a dot", so it covers dot-files as well as dot-directories.

- Control Panel: `isHiddenEntry` in `frontend/vaultLayout.js` is used by `isReadable` and by both directory walks in `frontend/server.js`, replacing the fixed list of `.obsidian`, `.git` and `.generated`. `node_modules` is still skipped by name.
- Engine: `may_agent_write` in `backend/vault_layout.py` refuses such a path at any depth, so the Engine cannot write a note the Control Panel would not show. This goes one step beyond the question as asked, which was about reading.

**Effect on the Blueprint.** `/api/files` went from 7,887 notes to 3,041: 4,846 notes were inside nested dot-directories. Notes flagged for frontmatter went from 19 to 14 (the five `terminal.md` copies were in dot-directories).

| Check | Result |
|---|---|
| `npm test` in `frontend/` | 14 passed. |
| `npm run lint` | Passes. |
| `pytest backend/tests` | 53 passed (two new cases). |
| `vault_manager.py validate` on the Blueprint | Layout checks: PASS. MOC link checks: FAIL on the ten known links, as before. |
| `may-write 10_Repositories/x/.cursor/n.md` | Refused, exit 1. |
| API smoke test: the Blueprint | `/api/files` 200 with no path containing a dot segment; `/api/tree` shows no dot entries; a note in a nested dot-directory requested on its own returns 403; `/api/hemispheres`, `/api/status`, `/api/mocs`, `/api/templates`, `/api/skills` all 200. |

### 8.7 Browser check

`npm run server` serves the built bundle in `frontend/dist`, which is ignored by git. The bundle on disk dated from 07/03/2026, so it predated every browser-side change in this document and had to be rebuilt.

**The build was broken.** `npm run build` failed on a note under a directory named `#1837-SettingsViewErrors`: the static fallback in `frontend/src/lib/vault.ts` globs every Markdown file in the Vault into the bundle, and the bundler reads `#` as the start of a URL fragment. The glob now leaves out paths containing `#`. This touches the static fallback that decision 9 left alone, but only by exclusion. The build then succeeds: 2,878 files, 90 MB.

**Log noise.** The server now warns about a note with invalid frontmatter once per server run, or again if the reason changes, instead of on every request. Seven page loads produced 14 warnings in total.

**What was looked at.** Headless Chrome screenshots of the first render, against the rebuilt bundle and the current server, on the Blueprint:

| Screen | Seen |
|---|---|
| Dashboard | 3,041 notes; Left Hemisphere 2 files READ-ONLY; Right Hemisphere 3,031 files READ / WRITE with its ten directories; System 7 files. |
| Hemispheres | Tabs for Left Hemisphere (2), Right Hemisphere (3,031) and Assets (1); directory groups listed. |
| Templates, Agent Skills, System Files | Rendered with content. |
| A note (`Git_MOC`) | Rendered, tagged RIGHT HEMISPHERE. |
| A Vault with no layout | The error screen, "This Vault has no usable layout", with the message naming the missing file. |

Nothing was clicked: the Left Hemisphere and Assets tabs, the Vault Explorer, Sessions and Orchestrator were not opened, and session backup was not run. The first render took 15 to 30 seconds because `/api/files` sends the full text of every note.

**Found, not fixed.**

- The static bundle does not follow the layout. A local build includes 31 notes from `copilot/`, one from `Connections/` and the Left Hemisphere notes, and the server serves those bundle files to anyone who can reach its port. The published site is not affected in the same way, because it is built from tracked files only and both directories are untracked. Dot-directories are already left out by the bundler.
- The Dashboard has no card for the Assets Zone; its one file is counted in the total only.
- Cosmetic, and older than this work: system files on the Dashboard carry a trailing slash (`CLAUDE.md/`); the Dashboard counts five templates where the Templates page shows six cards; a link written as `[[target|label]]` renders as `target|label`.
