# SKILL: NotebookLM Sync

**Objective:** Synchronize processed markdown files from `25_Knowledge_Base/` to Google's NotebookLM for advanced reasoning and RAG capabilities.

**Execution:**
1. When a new file is added to `25_Knowledge_Base/`, it must be synced to NotebookLM.
2. Execute the Python backend script to trigger the sync: `python backend/query.py sync-notebooklm --file <path_to_file>`
3. Alternatively, if using n8n, ensure the file triggers the local webhook that pushes the document to the NotebookLM API.
4. Log the successful sync in `MEMORY.md`.
