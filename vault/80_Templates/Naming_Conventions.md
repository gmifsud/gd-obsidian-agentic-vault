# Strict Naming Conventions

To ensure CLI agents can efficiently traverse and filter files using basic shell commands (`ls`, `find`), all files must adhere to the following strict naming conventions.

## 10_Repositories
Format: `Repo - [Service Name].md`
Example: `Repo - API Gateway.md`
Agent Benefit: `ls 10_Repositories/Repo\ -\ *.md`

## 20_DevOps
Format: `Infra - [Resource].md` or `Pipe - [Pipeline].md`
Example: `Infra - AWS Core.md`, `Pipe - GitHub Actions Deploy.md`
Agent Benefit: Instantly distinguish between infrastructure definitions and CI/CD pipelines.

## 25_Knowledge_Base
Format: `KB - [Topic].md`, `Fix - [Topic].md`, or `ADR - [Decision].md`
Example: `Fix - Sqlite Vec Distance Alias.md`, `ADR - Chunked FTS5 Search.md`
Agent Benefit: Distinguish general synthesis notes, troubleshooting fixes, and architectural decisions.

## 30_Git
Format: `Git - [Workflow Name].md`
Example: `Git - Hotfix Workflow.md`

## 35_Sessions
Format: `[Provider] - [Topic].md`
Example: `Claude - Refactor Vault Layout.md`, `Copilot - Render Obsidian URL.md`

## 00_MOCs
Format: `[Domain]_MOC.md`
Example: `Repositories_MOC.md`, `Knowledge_Base_MOC.md`
