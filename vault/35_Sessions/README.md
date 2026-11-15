# 35_Sessions

Catalogue notes for harness conversations. One note records the harness, the topic, the model, and the path of the transcript. The transcript stays where the harness wrote it.

Obsidian Copilot writes its chats to `copilot/copilot-conversations/`. Catalogue them from the repository root:

```powershell
.\backend\venv\Scripts\python.exe backend\vault_manager.py catalogue-copilot
```

The command reads that conversations folder only. It does not read the plugin's skills or custom prompts, and it does not modify the plugin folder.
