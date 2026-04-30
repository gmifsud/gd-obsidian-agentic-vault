---
type: moc
moc_name: "Repositories"
agent_summary: "Index of all tracked codebases and services."
---
# Repositories MOC

## Active Services
- [[10_Repositories/api-gateway|API Gateway]] - `tech_stack: [Node.js, Express]`
- [[10_Repositories/auth-service|Auth Service]] - `tech_stack: [Go, Redis]`
- [[10_Repositories/frontend-web|Frontend Web]] - `tech_stack: [React, TypeScript]`

## Dataview Auto-Index (For Human Readers)
```dataview
TABLE agent_summary, tech_stack
FROM "10_Repositories"
WHERE type = "repository"
```

## Agent Scraping Guide
Agents: Parse the bulleted list under "Active Services" using regex `\[\[(.*?)\]\]` to extract file paths. The inline code blocks provide immediate context filtering without opening the file.
