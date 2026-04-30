---
type: git_resource
resource_name: "Log Formatting"
agent_summary: "Defines conventions for Git commit messages and log output for better traceability."
tech_stack: ["Git"]
environment: "all"
---

# Log Formatting

## Overview
This resource defines the conventions for Git commit messages and log output for better traceability. Standardizing commit messages and log formats ensures that automated tools (like changelog generators) and human reviewers can easily understand the history of the repository.

## Conventional Commits
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Common Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

## Log Filtering & Aliases
To view logs effectively, you can configure Git aliases for formatted, easily readable output.

**Setup Alias:**
```bash
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
```

**Usage:**
```bash
git lg
```

## Related Links
- [Conventional Commits](https://www.conventionalcommits.org/)
