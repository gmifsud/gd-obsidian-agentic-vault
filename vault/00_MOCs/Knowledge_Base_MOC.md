---
type: moc
moc_name: "Knowledge Base"
agent_summary: "Index of distilled concepts, architecture specifications, research notes, and playbook items."
---
# Knowledge Base MOC

Distilled, reusable technical knowledge in `25_Knowledge_Base/`. Session digests and raw transcripts live in `35_Sessions/` until promoted here.

## Dataview Auto-Index (For Human Readers)
```dataview
TABLE type, topic, status, tags
FROM "25_Knowledge_Base"
WHERE file.name != "README"
SORT file.name ASC
```

## Static Agent Index
