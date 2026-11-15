---
title: Knowledge Lifecycle Correctness PRD
type: prd-tracker
prd_id: VAUM-KLC-001
version: "0.1"
date: 2026-11-15
owner: Gregory Mifsud
status: acceptance_pending
execution_approved: true
scope: codex-pilot-and-shared-correctness
tags: [prd, knowledge-lifecycle, remediation]
---

# Knowledge Lifecycle Correctness

**Canonical PRD:** [docs/prd-knowledge-lifecycle-correctness.md](../../docs/prd-knowledge-lifecycle-correctness.md). This note tracks its state; requirements live in that document only.

**Objective:** prove native session → evidence-linked draft → human-reviewed knowledge → fresh, correctly scoped context for a later task.

The implemented first source is Codex. Shared persistence, permissions, archival, configuration and retrieval corrections are included. The other five providers remain unqualified until a follow-on increment supplies native-format evidence.

## Execution state

| Milestone | State |
| --- | --- |
| M1 — Identity and safe persistence | Implemented; correctness regressions pass |
| M2 — Qualified Codex ingestion | Implemented; synthetic and inspected native 0.166.0 shapes qualified |
| M3 — Draft and review lifecycle | Implemented; exact-revision review regressions pass |
| M4 — Fresh and scoped context | Implemented; isolation, freshness, bounds and fixed evaluation pass |
| M5 — Thin adapters and pilot proof | Implemented; HTTP and actual Codex MCP pass; visual form and human usefulness pending |

## Activity

- 2026-11-15: Drafted PRD v0.1 with requirements FR-01–FR-10, acceptance cases AC-01–AC-20 and traceability to review findings F1–F11. No execution code changed.
- 2026-11-15: Gregory approved v0.1 with “go ahead”. M1–M5 execution authorised and started.
- 2026-11-15: Implemented M1–M5. 122 Python tests, 20 Node tests, TypeScript and a sanitised production build pass. Generated Engine binding exercised through actual Codex 0.165.0 without a model turn. [[2026-11-15 - Knowledge Lifecycle Implementation Evidence]] records all acceptance cases and the two pending manual gates. No commit/push/merge.

## Validation and acceptance

- YAML frontmatter and local document links passed inspection.
- Ten requirement IDs, twenty acceptance-case IDs and five milestone IDs are unique and complete.
- Engine `validate` passed layout, MOC-link and frontmatter checks; `git diff --check` passed.
- Application tests and actual client checks now cover the implemented contract; complete evidence and limits are recorded in [[2026-11-15 - Knowledge Lifecycle Implementation Evidence]].
- Status remains `acceptance_pending`: API evidence does not replace the remaining visual form exercise, and automated fixture review does not replace Gregory's usefulness judgement.

## Related

- [[2026-11-15 - Knowledge Lifecycle Objective Review]]
- [[2026-11-15 - Knowledge Lifecycle Implementation Evidence]]
- [[MEMORY]]
