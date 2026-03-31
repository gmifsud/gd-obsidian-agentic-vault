---
type: git_workflow
workflow_name: "Hotfix Workflow"
agent_summary: "Emergency process for patching critical production issues directly from the main branch."
related_repos: []
prerequisites: ["Production Incident"]
---

# Hotfix Workflow

## Branching Rules
- Prefix: `hotfix/`

## Step-by-Step Commands
```bash
# 1. Checkout the production branch
git checkout main
git pull origin main

# 2. Create the hotfix branch
git checkout -b hotfix/issue-number-desc

# 3. Apply the fix and commit
git commit -m "fix(hotfix): description of the critical fix"

# 4. Push the branch and create a PR
git push -u origin HEAD
```

## Merge Strategy
- **Main Branch:** Squash and merge to `main` to deploy the fix immediately.
- **Backporting:** Immediately backport the hotfix to `develop` (or other active release branches) to ensure the fix is not overwritten by future releases.
