---
type: moc
moc_name: "Sessions"
agent_summary: "Index of catalogued harness conversations. The transcript stays with the harness."
---

# Sessions MOC

Short notes for harness conversations worth keeping. Each note records the harness, the topic, and where the transcript lives. The transcript itself stays in the harness's own store. For Obsidian Copilot that store is `copilot/copilot-conversations/`, which the plugin creates and owns.

```dataview
TABLE harness, topic, model
FROM "35_Sessions"
WHERE type = "harness-session"
SORT file.name ASC
```

## Static Agent Index
- [[Copilot - Render Obsidian URL in Obsidian]] | harness: copilot | topic: Render Obsidian URL in Obsidian
- [[Copilot - Mermaid diagram orthogonal lines and layout styling]] | harness: copilot | topic: Mermaid diagram orthogonal lines and layout styling
