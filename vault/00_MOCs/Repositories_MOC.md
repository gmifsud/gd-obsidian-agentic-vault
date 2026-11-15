---
type: moc
moc_name: "Repositories"
agent_summary: "Index of all tracked codebases and services."
---
# Repositories MOC

## Active Services
_No repositories are tracked yet. Create one with `inject-template Repository_Template.md 10_Repositories/<name>.md`; it is then listed under the Static Agent Index below._

## Dataview Auto-Index (For Human Readers)
```dataview
TABLE agent_summary, tech_stack
FROM "10_Repositories"
WHERE type = "repository"
```

## Agent Scraping Guide
Agents: Parse the bulleted list under "Static Agent Index" using regex `\[\[(.*?)\]\]` to extract file paths. The pipe-separated fields provide immediate context filtering without opening the file.

## Static Agent Index
