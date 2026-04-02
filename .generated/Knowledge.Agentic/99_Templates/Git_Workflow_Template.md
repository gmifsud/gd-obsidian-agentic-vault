---
type: git_workflow
workflow_name: ""
agent_summary: "When and how an agent should use this specific Git workflow."
related_repos: [] # Empty if global
prerequisites: []
---

# {{workflow_name}}

## Branching Rules
- Prefix: `feat/`, `fix/`, `chore/`

## Step-by-Step Commands
```bash
git checkout -b type/issue-number-desc
git commit -m "type(scope): description"
git push -u origin HEAD
```

## Merge Strategy
- Squash and merge only.
