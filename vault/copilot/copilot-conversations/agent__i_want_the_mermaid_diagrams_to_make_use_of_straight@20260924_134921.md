---
epoch: 1790250561822
mode: agent
backendId: opencode
projectId: "7a7f7384-6419-48c3-9979-6c7d9fd1123e"
sessionId: "ses_f2e1ca463ffeETGc2Tl3pVJfRX"
agentLabel: "Mermaid diagram orthogonal lines and layout styling"
usage: '{"usedTokens":39184,"contextWindow":1000000,"updatedAt":1790250873445}'
tags:
  - copilot-conversation
---

**user**: i want the mermaid diagrams to make use of straight 90 degree angle lines instead of curved and can we try and minimise crossing connectors or arrows pls
[Timestamp: 2026/09/24 13:49:21]

**ai**: I looked at both files in scope. The project's declared context note ([[04-authentication-flows-v2]]) only contains `sequenceDiagram` blocks — those already render with straight, non-curved arrows by default, so there's nothing to change there. The attached note, [[11-architecture-and-design]], has the one true `flowchart` diagram (§3, Container diagram / C4 L2), which is exactly the kind of diagram where Mermaid's default spline curves and dagre auto-layout create crossing, curvy edges. I'll update that one.

Changes I'm making:
1. Add a `%%{init: {'flowchart': {'curve': 'step'}}}%%` directive so all edges render as orthogonal 90° segments instead of curved splines.
2. Reorder/regroup nodes (grouping Key Vault + Log Analytics together, moving Redis/Relay/on-prem to cleaner branch points, keeping AGC declared once inside its subgraph) so the layout engine has fewer edges forced to cross subgraph boundaries diagonally.Done. Here's what changed in [[11-architecture-and-design]] §3 (Container diagram, C4 L2), which was the only true `flowchart` diagram in scope — [[04-authentication-flows-v2]] only contains `sequenceDiagram` blocks, and those already draw straight message arrows by default, so nothing needed touching there.

**What I changed and why:**

1. **Curve style → `step` (90° angles).** Added `%%{init: {'flowchart': {'curve': 'step'}}}%%` right above the `flowchart TB` line. This is the standard Mermaid directive to force orthogonal, right-angle edge routing instead of the default rounded splines.

2. **Regrouped floating nodes into subgraphs to cut crossings:**
   - `KV` and `LAW` (both "Layer 1" platform services) are now grouped under a new `layer1` subgraph, sitting side-by-side instead of scattered as loose top-level nodes that the layout engine had to route around independently.
   - `RELAY` and `ONP` are now grouped under a new `onprem` subgraph — previously they were loose nodes competing for the same horizontal band as `KV`/`REDIS`/`JOBAPI`, forcing several edges to cross.
   - `REDIS` stays standalone (only one inbound edge, from `API`) but is now positioned after the `SQL`/`TDB` block rather than sharing a combined `API --> SQL & REDIS` edge, which previously forced a shared crossing point.
   - `JOBAPI` moved to the end, right next to its single source (`JOBS`), rather than sitting mid-diagram where the JOBS→JOBAPI edge had to cross the KV/Redis/Relay lane.

3. **Split the original single mega fan-out line** (`NAVC & SATC & MOBC & TPC & LEG --> CF --> AGC --> API`) into two edges plus a `direction LR` inside the `clients` subgraph, so the five client nodes line up horizontally before converging on Cloudflare, rather than dagre trying to route five diagonal lines into one node and then chaining that into two more hops on the same edge definition.

The decision content, labels, and node relationships are all unchanged — only layout/routing hints. If you want, I can do the same pass on the other flowchart diagrams in this doc set (docs 02, 03, 05, 07, 10, 12, 13, 14), since several of those also use plain `flowchart` with default curves — just say which ones.
[Timestamp: 2026/09/24 13:49:21]