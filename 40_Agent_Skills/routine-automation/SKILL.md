# SKILL: Routine Automation (/daily-plan & /weekly-review)

When the user triggers the custom routine commands, execute the following strict logic:

## Command: /daily-plan
**Objective:** Provide a terminal-based situational awareness brief.
**Execution:**
1. Silently read the most recent markdown file in `01_Daily_Notes/`.
2. Silently query `10_Repositories/` and `15_Prototype_Designs/` for any files with YAML `status: active` or `status: WIP`.
3. Do NOT create any files. Print a formatted Markdown checklist to the terminal detailing:
   - **Yesterday's Carryover:** Unfinished tasks from the journal.
   - **Active Projects:** 2-3 active prototypes or repos to focus on.
   - **Knowledge Processing:** Any raw notes that still need Summarization, Tagging, or Interlinking.

## Command: /weekly-review
**Objective:** Synthesize the week's output and draft the weekly review.
**Execution:**
1. Analyze the past 7 days of entries in `01_Daily_Notes/`.
2. Analyze new files added to the vault over the last 7 days.
3. Draft a comprehensive summary of wins, blockers, and ingested knowledge.
4. Format this summary using the exact structure found in `.obsidian/templates/Weekly_Review_Template.md`.
5. Save the generated file to `01_Daily_Notes/Reviews/Weekly_Review_[YYYY-MM-DD].md` and alert the user it is ready for their final human edits.
