---
type: moc
moc_name: "Git"
agent_summary: "Index of Git workflows, branching strategies, and PR templates."
---
# Git MOC

## Workflows & Strategies
- [[30_Git/Git - Feature Branching|Feature Branching Workflow]] - `prerequisites: [Issue Tracker Ticket]`
- [[30_Git/Git - Hotfix Workflow|Hotfix Workflow]] - **Purpose:** Emergency process for patching critical production issues directly from the main branch. | **Prerequisites:** `[Production Incident]`
- [[30_Git/Git - PR Template|Standard PR Template]] - `prerequisites: []`

## Templates
Agents creating new Git workflows MUST use the [[80_Templates/Git_Workflow_Template|Git Workflow Template]].

## Dataview Auto-Index (For Human Readers)
```dataview
TABLE agent_summary, prerequisites
FROM "30_Git"
WHERE type = "git_workflow"
```

## Static Agent Index
- [[Git - Hotfix Workflow]] | workflow_name: Hotfix Workflow
- [[Git - Log Formatting]] | resource_name: Log Formatting
- [[Git - PR Template]] | resource_name: PR Template
