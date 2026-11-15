---
title: Knowledge Lifecycle Implementation Evidence
type: implementation-evidence
prd_id: VAUM-KLC-001
prd_version: "0.1"
date: 2026-11-15
owner: Gregory Mifsud
status: acceptance_pending
execution_approved: true
baseline_commit: c8c34c9
branch: main
python_tests_passed: 122
node_tests_passed: 20
human_usefulness_confirmed: false
ui_form_visual_acceptance: pending
tags: [knowledge-lifecycle, implementation, acceptance, codex]
---

# Knowledge Lifecycle Implementation Evidence

**Verdict:** M1–M4 correctness gates pass. M5 implementation, HTTP integration and actual Codex MCP-client checks pass; full visual form acceptance and the human usefulness confirmation remain pending. This is a qualified Codex pilot, not a claim that all six harnesses satisfy the original objective.

Gregory approved [VAUM-KLC-001 v0.1](../../../docs/prd-knowledge-lifecycle-correctness.md) with “go ahead” on 2026-11-15. Work was performed on `main` at `c8c34c9` with substantial pre-existing dirty/untracked implementation files; that work was preserved. No commit, push, merge or deployment was made. Evidence below describes this working tree, not a published revision.

## Implemented responsibilities

| Milestone | Result and source |
| --- | --- |
| M1 — Identity and safe persistence | `backend/vault_io.py`: per-vault serialisation, policy/revision preflight, staging and optimistic atomic replacement. `session_catalogue.py`: stable source references and advancing batches. `session_distiller.py`: primary-first publication, explicit partial outcomes and reference repair. `query.py`: verified multiline archival before trimming. |
| M2 — Qualified Codex ingestion | `session_providers.py`: native envelopes, stable scoped keys, exact source hashes, ordered locators, real counts, metadata/compaction diagnostics and verified repository scope. Non-Codex readers remain unqualified. |
| M3 — Draft and review | `session_distiller.py`: versioned candidate validation, saved excerpts, claim states, stable artifacts and exact-revision human review. `vault_manager.py`, `lifecycle_service.py` and the three vault templates expose the contract. |
| M4 — Fresh scoped context | `knowledge_index.py`: owned versioned FTS5 cache, content refresh, current-review/exact-repository filters, bounded chunks/briefs, safe limited neighbours and historical-source labels. |
| M5 — Adapters and proof | `frontend/lifecycle.js`, `sessions.js`, `server.js`, `KnowledgeDraft.tsx` and `SessionsPage.tsx`: shared Engine lifecycle and visible state. `mcp_server.py`: thin tools, no review tool. `architect_generator.py`: explicit interpreter/script/vault binding. `vite.config.ts` and `src/lib/vault.ts`: build fallback uses selected vault. |

See the [usage guide](../../../docs/knowledge-lifecycle-usage.md) for candidate shape, CLI commands, HTTP/MCP names, recovery and compatibility changes. The high-level architecture remains the PRD's native store → evidence → authored draft → reviewed note → fresh context flow; no orchestration platform or embedded model was introduced.

## Acceptance reconciliation

“Automated pass” means a regression on disposable fixture vaults, not a real transcript repair or a human endorsement.

| Case | Evidence | State |
| --- | --- | --- |
| AC-01 | `test_native_lifecycle.py`: native ordered turns/tools, mirrored event deduplication, metadata, 8 evidence items and scoped identity | Automated pass; real-format read-only check below |
| AC-02 | Same file: empty/corrupt/unsupported content, source revision change, unpaired calls, long text, metadata and explicit compaction | Automated pass |
| AC-03 | Windows `%USERPROFILE%` path with spaces; unavailable Claude alongside available Codex; MCP unavailable-provider outcome | Automated pass |
| AC-04 | Stable repeat catalogue, same-title sources, source metadata refresh preserving body/comments/custom YAML, alias refusal and advancing limit-one batches | Automated pass |
| AC-05 | Exact repeat, human edit, explicit update, two concurrent submissions and atomic stale-write conflict | Automated pass |
| AC-06 | Secondary MOC denial, hidden/outside destinations, actual escaping native symlink, existing staging file, policy revision change and denied archive | Automated pass, no skipped symlink test |
| AC-07 | `test_http_lifecycle.py`: denied Journal export preserves state; permitted export retains all supported evidence | Automated HTTP → Engine pass |
| AC-08 | Injected primary failure leaves notes unchanged; injected catalogue failure reports persisted artifact; retry/explicit repair preserves human edits | Automated pass |
| AC-09 | `test_lifecycle_persistence.py`, `test_memory_compact.py`: multiline/fenced entries, denied/failing archive, MEMORY byte preservation and idempotency | Automated pass |
| AC-10 | Synthetic alias scenario: failure, proposal, tool-limited verification, user acceptance, open task and conversational sign-off remain distinct; invented quotes/acceptance rejected | Automated pass |
| AC-11 | Review exact revision, stale after edit, revoke, legacy exclusion and malformed saved evidence refusal | Automated pass |
| AC-12 | A/B caches and exact owner mismatch refusal; separate scoped facts | Automated pass |
| AC-13 | Create/review/edit/revoke/delete reflected on next query; malformed refresh fails instead of stale success | Automated pass |
| AC-14 | Preamble/fence/oversized chunks, 32/1,500/default character bounds, two eligible neighbours, ambiguity and filtered links | Automated pass |
| AC-15 | Exact repository and unknown-scope handling; draft/legacy diagnostic inclusion; default exclusion | Automated pass |
| AC-16 | Real Express subprocess → Engine fixture workflow; malformed stdout, 409 conflicts, saved draft/review/search; visible session list exercised | HTTP/adapter pass; full visual draft/review form pending |
| AC-17 | Installed Codex client initialisation, list and real `vault_brief` call using generated explicit binding, unrelated cwd and misleading PATH | Actual client pass |
| AC-18 | Unsupported providers blocked; malformed lifecycle evidence rejected; catalogue unavailable-provider marked partial; actual calendar/sync/heartbeat CLI calls on the disposable vault report unconfigured/skipped operations | Automated schema/provider and local maintenance smoke pass |
| AC-19 | Fixed `EVALUATION` in `test_current_retrieval.py`: `SQL alias error`, `sub.distance v.distance`, `wider query audit`; no answers for `photosynthesis chlorophyll`, `volcanic stratigraphy` | 3 relevant queries and 2 no-answer cases pass |
| AC-20 | Later host response below uses the actual MCP result and preserves its limits | Human usefulness confirmation pending |

## Final verification

| Check | Observed result |
| --- | --- |
| Python suite | **122 passed**, 8.95 s; no failures or skips |
| Node tests | **20 passed**, no failures/skips |
| `npm --prefix frontend run lint` | TypeScript `tsc --noEmit` passed |
| Engine `validate` | Layout, MOC links and frontmatter passed; five existing empty-directory warnings |
| Sanitised production build | Vite 6.4.1, 1,974 modules, 3.63 s; synthetic generated vault only, ignored output |
| Documentation and diff | Four lifecycle documents parse as YAML/Markdown with no broken local links; `git diff --check` passed |
| Actual MCP client | Codex app-server client 0.165.0 on native Windows; Engine initialised, listed tools and returned the expected reviewed brief |

Commands used (temporary test path is unique per invocation):

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend\tests -q -p no:cacheprovider --basetemp "$env:TEMP\vaum-final-20261115-c"
# From frontend/:
node --test --test-isolation=none
# From repository root:
npm --prefix frontend run lint
.\backend\venv\Scripts\python.exe backend\vault_manager.py validate
.\backend\venv\Scripts\python.exe backend\tests\pilot_smoke.py 'C:\Users\grego\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe'
$env:VAULT_PATH = 'D:\Repos\gd-obsidian-agentic-vault\backend\runtime-cache\pilot-cw30vurd\generated-vault'
npm --prefix frontend run build
git diff --check
```

Sandbox qualification: normal pytest temp creation and subprocess spawning were denied in the restricted execution environment. The suite and actual client/build were run with approved native process/filesystem access against disposable fixtures. Node's default test process isolation received EPERM; `--test-isolation=none` exercised the same tests successfully. These are environment workarounds, not product test failures. No dependency installation, global harness configuration change, model turn or cloud/model download was used.

Final requirements reconciliation reproduced and corrected a missing catalogue metadata refresh. New regressions prove that refreshing changed sources preserves human text/comments/custom fields, does not block progress through limited batches, and refuses YAML aliases that would couple a machine field to another value. The final full-suite result above includes these corrections. Calendar's misleading configuration-only enablement instruction was also removed; its CLI now explicitly says implementation is required.

## Native source qualification

`backend/tests/fixtures/codex-native-v1.jsonl` is a sanitised synthetic repair scenario. Its companion README states its limits. Additional 0.166.0 records are covered in `test_codex_0166_metadata_is_counted_and_compaction_remains_partial`.

A read-only metadata/count audit inspected five recent local Codex 0.166.0 rollouts without copying private conversation text. Four were correctly partial due to explicit compaction; the active history also had an unmatched call. The complete 335,044-byte history yielded 16 evidence messages and 60 ignored metadata records in 4.31 ms. The largest inspected history was 6,143,979 bytes and parsed in 58.11 ms while remaining partial. These single-run observations qualify the inspected formats, not production throughput or every Codex variant.

Repository identity is only assigned when the recorded workspace leads to an existing Git root. Unknown workspaces remain explicitly unscoped. Paging an active source can legitimately change its revision; consumers must restart preparation rather than combine revisions.

## Actual MCP result and later-task response

The helper generated a fresh disposable vault and a single synthetic reviewed artifact. Its review is named **Automated pilot fixture reviewer**, explicitly test evidence rather than Gregory's approval. Invocation-only Codex configuration registered only the generated Engine. The Engine was launched from an unrelated directory with a deliberately unusable ambient PATH; absolute interpreter/script paths and target-vault environment were effective.

| Recorded field | Value |
| --- | --- |
| Local report | `backend/runtime-cache/pilot-cw30vurd/mcp-evidence.json` (ignored) |
| Target vault | `backend/runtime-cache/pilot-cw30vurd/generated-vault` |
| Artifact | `25_Knowledge_Base/TROUBLESHOOTING - ffb75f1a82e6faac9cb92603.md` |
| Source key | `26f298ae0844ec12e1aa91120cd34371b3e7bf856f3e1d6d12eec26001e418d3` |
| Source revision | `2f3d8815540637b6db96b441ce57111320de48a649fae2663f0328b88610804a` |
| Reviewed note revision | `f9028bbc0744d8bfab6dc764ed90b6f1bb2685898fcacd9fd66727e69a3cca55` |
| Index | 1 note, 10 chunks; initial refresh 42.72 ms; measured repeat fresh true/refreshed false, freshness check 2.56 ms |
| End-to-end brief call | 10.65 ms through the actual Codex MCP client on the warm index; single-run measurement |
| Brief | 2,017 characters, below default 12,000; source revision available |
| Model turns | 0 |

**Later host task:** explain the supported correction and what still needs checking, using the returned brief.

**Host response:** For this synthetic alias failure, replace undefined `sub.distance` with the declared `v.distance` (assistant proposal L6, accepted by the user at L9). Retrying the unchanged query failed (tool result L5). Only the targeted regression passed; the full suite was not run (tool result L8). The wider query audit remains open (user L9).

This response is grounded in the retrieved note and its retained excerpts, not a claim that a real repository bug was repaired. A human usefulness question was presented to Gregory for AC-20; no answer has yet been recorded.

## UI evidence and remaining boundary

The built synthetic Control Panel at temporary port 3101 was opened in a separate native browser tab. Its session list visibly showed one Codex session, eight messages, approximately 1.9 KB and the fixture workspace. The user's existing Control Panel at port 7001 was not modified. The temporary server was stopped after inspection.

The browser automation host was unavailable, and native interaction subsequently reported the window minimised without an available activation operation. Consequently, draft entry, saved preview, approve and revoke have **HTTP integration and type/build evidence but not a completed visual walkthrough**. Do not mark AC-16/M5 fully accepted on the strength of API tests alone.

Remaining manual exercise:

1. Open a disposable pilot vault's Sessions page and select the complete native fixture.
2. Enter an evidence-linked claim, save it as a draft, and read the saved preview.
3. Approve the exact preview, confirm retrieval eligibility, then revoke and confirm exclusion.
4. Confirm the AC-20 response above would help a later task, or record the specific usefulness gap.

## Limits and follow-on work

- Other five harnesses remain unqualified for distillation/full export; separate native fixtures and acceptance work are required.
- Retrieval is lexical and measured on a small corpus; full source/index scans remain a scaling question to measure before optimisation.
- Human review protects interpretation quality; structural evidence validation cannot prove semantic truth. Local review is not authenticated multi-user authorisation.
- Locks serialise Engine writers only. Per-file atomic replacement plus reported partial state does not make a multi-file transaction or lock arbitrary editors.
- Compacted/incomplete histories are intentionally blocked. Independent raw retention and additional content formats are separate increments.
- Build fallback still bundles the selected vault's Markdown; this run used only a synthetic vault. Do not distribute an unsanitised build.
- Windows was exercised. WSL/Linux/macOS behaviour and third-party MCP server entries were not qualified.

Related: [[2026-11-15 - Knowledge Lifecycle Objective Review]] · [[PRD - Knowledge Lifecycle Correctness]] · [[MEMORY]]
