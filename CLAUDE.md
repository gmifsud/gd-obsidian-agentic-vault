# Agent Memory & System Prompt

You are an AI Agent (e.g., Gemini, Claude Code, Aider, Codex, Cursor) operating within a "Split-Brain" Obsidian Vault.

## Vault Architecture: The Split-Brain Model

### 🧠 Left Hemisphere (HUMAN DOMAIN - READ ONLY)
These directories contain the human's raw thoughts, daily logs, and unstructured ideas. 
**RULE:** You may READ these folders for context, but you MUST NEVER WRITE to or modify them.
- `01_Daily_Notes/`
- `02_Human_Thoughts/`

### 🤖 Right Hemisphere (AI DOMAIN - READ/WRITE)
These directories contain structured knowledge, SOPs, and documentation. 
**RULE:** You have full autonomy to WRITE, organize, and maintain these folders using strict YAML templates.
- `00_MOCs/`
- `10_Repositories/`
- `20_DevOps/`
- `30_Git/`
- `80_Templates/`
- `90_Assets/`

## Custom Workflows

### Command: `/new [input]`
**Trigger:** The user provides raw text, a thought, or points to a file.
**Action:**
1. Analyze the input to determine its domain (Repo, DevOps, Git).
2. Read the corresponding template from `80_Templates/`.
3. Generate a new, strictly formatted Markdown file.
4. Save the file in the correct Right Hemisphere folder following naming conventions (e.g., `10_Repositories/Repo - [Name].md`).
5. **MOC Update Protocol**: You MUST dynamically update the corresponding MOC.
   - **Automated**: Run `node scripts/update_moc.js <path/to/new/file.md>`
   - **Manual**: Open the relevant MOC (e.g., `00_MOCs/Repositories_MOC.md`), locate the `## Static Agent Index` section, and append: `- [[File Name]] | key: value`

### Command: `/today`
**Trigger:** The user asks for today's agenda or priorities.
**Action:**
1. Scan the most recent file in `01_Daily_Notes/`.
2. Extract open tasks, blockers, or mentions of specific repositories/infrastructure.
3. Cross-reference these mentions with the Right Hemisphere (`10_Repositories/`, `20_DevOps/`) to gather technical context.
4. Output a prioritized task list in the CLI, complete with technical context and suggested next steps. Do not write this list to the vault; output it to the console.

### Command: `/weekly`
**Trigger:** The user asks for a weekly review or issues the `/weekly` command.
**Action:**
1. Read all entries in the `01_Daily_Notes/` (and `02_Human_Thoughts/`) folders from the past 7 days.
2. Extract key accomplishments, blockers, and recurring themes.
3. Cross-reference these insights with active projects and drafts in `15_Prototype_Designs/`.
4. Output a structured "Weekly Review" summary to help the human align their upcoming week.

## Data Ingestion Protocol (Summarization, Tagging, Interlinking)
Whenever you ingest new data, especially "Informational VODs" or Articles, you MUST explicitly perform the following:
1. **Summarization:** Generate a concise `agent_summary` in the frontmatter and a detailed summary in the body.
2. **Tagging:** Apply relevant taxonomy tags and update the `core_concepts` array.
3. **Interlinking:** Actively search the vault for related concepts, existing MOCs, or related prototypes and create bidirectional `[[WikiLinks]]`.

## Prototype Generation Protocol
Whenever brainstorming results in architectural drafts, code concepts, or system designs, you MUST save these artifacts directly into the `15_Prototype_Designs/` directory. Use the appropriate templates and ensure they are linked back to the original context or project plan.
