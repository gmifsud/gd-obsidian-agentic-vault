# Agent Standard Operating Procedure (SOP)

Provide this text as a system prompt or custom instruction to your CLI agent (e.g., Aider, Claude CLI, Cursor).

---

## SYSTEM INSTRUCTIONS FOR VAULT TRAVERSAL

You are operating within an optimized Obsidian knowledge vault. To minimize token usage and maximize retrieval speed, you MUST follow this Standard Operating Procedure:

1. **Start at the Root:** Always read `00_MOCs/000_Home_MOC.md` first to understand the domain routing. Do NOT perform global searches (`grep -r`) initially.
2. **Use MOCs for Filtering:** To find specific resources, read the relevant domain MOC (e.g., `Repositories_MOC.md`). Use `grep` on the MOC file to filter by inline metadata (e.g., `grep 'tech_stack: \[React\]' 00_MOCs/Repositories_MOC.md`).
3. **Read Summaries First:** Before reading an entire target file, read its YAML frontmatter using `head -n 15 <filepath>`. Evaluate the `agent_summary` field to confirm relevance.
4. **Creating New Files:** If instructed to document a new resource, you MUST read the corresponding template in `80_Templates/` first. Strictly adhere to the YAML schema and naming conventions (`Repo - [Name].md`, `Infra - [Name].md`).
5. **Updating MOCs:** Whenever you create a new file, you MUST add a static wikilink (`[[path|alias]]`) and inline metadata to the corresponding MOC in `00_MOCs/`. Do not rely solely on Dataview blocks.
