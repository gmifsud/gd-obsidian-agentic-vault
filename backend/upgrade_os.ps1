$VaultName = ".."

Write-Host "Upgrading Agentic Personal OS Architecture..." -ForegroundColor Cyan

# ==========================================
# Phase 1: Nomenclature & Structural Alignment
# ==========================================
Write-Host "Phase 1: Nomenclature & Structural Alignment..." -ForegroundColor Yellow

# Rename 01_Daily_Notes to 01_Journal
if (Test-Path "$VaultName\01_Daily_Notes") {
    Rename-Item -Path "$VaultName\01_Daily_Notes" -NewName "01_Journal"
    Write-Host "  -> Renamed 01_Daily_Notes to 01_Journal"
}

# Update Home MOC
$homeMocPath = "$VaultName\00_MOCs\000_Home_MOC.md"
if (Test-Path $homeMocPath) {
    $homeMocContent = Get-Content $homeMocPath -Raw
    if ($homeMocContent -match "01_Daily_Notes") {
        $homeMocContent = $homeMocContent -replace "01_Daily_Notes", "01_Journal"
    } elseif ($homeMocContent -notmatch "01_Journal") {
        $homeMocContent = $homeMocContent -replace "## Domain Routing", "## Domain Routing`n- [[01_Journal]] - Daily logs and weekly reviews"
    }
    Set-Content -Path $homeMocPath -Value $homeMocContent -Encoding UTF8
    Write-Host "  -> Updated 000_Home_MOC.md"
}

# Create 25_Knowledge_Base
New-Item -ItemType Directory -Force -Path "$VaultName\25_Knowledge_Base" | Out-Null
Write-Host "  -> Created 25_Knowledge_Base directory"


# ==========================================
# Phase 2: Second Brain Template Integration
# ==========================================
Write-Host "Phase 2: Second Brain Template Integration..." -ForegroundColor Yellow

$mediaTemplate = @'
---
type: knowledge_resource
format: "" # Options: Article, Video, Informational VOD, Book
title: ""
author_or_creator: ""
source_url: ""
date_processed: "{{date}}"
core_concepts: []
related_prototypes: []
agent_summary: ""
tags:
  - second_brain
  - resource
aliases: []
---

# {{title}}

## Agent Summary
[AI to generate concise summary here]

## Core Concepts
- 

## Interlinks
- 
'@
Set-Content -Path "$VaultName\80_Templates\Media_Resource_Template.md" -Value $mediaTemplate -Encoding UTF8
Write-Host "  -> Created Media_Resource_Template.md"


# ==========================================
# Phase 3: The Second Brain PRD Skill
# ==========================================
Write-Host "Phase 3: The Second Brain PRD Skill..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path "$VaultName\40_Agent_Skills\create-second-brain-prd" | Out-Null

$prdSkill = @'
# SKILL: Create Second Brain PRD

**Objective:** Analyze raw ideas from `02_Human_Thoughts/` and generate structured Product Requirements Documents (PRDs) into `25_Knowledge_Base/`.

**Execution:**
1. Read the specified raw thought file from `02_Human_Thoughts/`.
2. Extract the core problem, proposed solution, and key features.
3. Generate a structured PRD containing:
   - Title & Meta Data
   - Problem Statement
   - Target Audience
   - Proposed Solution
   - Key Features (MVP)
   - Future Enhancements
4. Save the generated PRD into `25_Knowledge_Base/PRD_[Project_Name].md`.
5. Update `MEMORY.md` to reflect the creation of the new PRD.
'@
Set-Content -Path "$VaultName\40_Agent_Skills\create-second-brain-prd\SKILL.md" -Value $prdSkill -Encoding UTF8
Write-Host "  -> Scaffolded create-second-brain-prd skill"


# ==========================================
# Phase 4: Advanced Memory Layer Scaffolding
# ==========================================
Write-Host "Phase 4: Advanced Memory Layer Scaffolding..." -ForegroundColor Yellow

$userProfile = @'
# USER PROFILE

role: Engineer/Architect
timezone: CEST
working_hours: "08:00 - 18:00"

integrations:
  gmail: pending
  calendar: active
  asana: pending
  slack: pending
'@
Set-Content -Path "$VaultName\USER.md" -Value $userProfile -Encoding UTF8
Write-Host "  -> Initialized USER.md"

$heartbeat = @'
# HEARTBEAT CHECKLIST

This file is used by the background cron-job agent.

- [ ] Check APIs (Calendar, Slack, Asana)
- [ ] Compact Memory (Summarize older entries in MEMORY.md)
- [ ] Check Drafts (Review 15_Prototype_Designs/ for WIPs)
- [ ] Notify (Send toast/Slack notification if action required)
'@
Set-Content -Path "$VaultName\HEARTBEAT.md" -Value $heartbeat -Encoding UTF8
Write-Host "  -> Initialized HEARTBEAT.md"

Write-Host "  -> (Python scripts and requirements are already located in the /backend directory)"


# ==========================================
# Phase 5: Update the SOUL
# ==========================================
Write-Host "Phase 5: Update the SOUL..." -ForegroundColor Yellow

$soulContent = @'
# The SOUL (System Operating Underlying Logic)

## 1. Persona & Tone
- You are a highly technical, efficient, and precise Knowledge Graph Architect and Senior Engineer.
- Never apologize. Never use filler words. Provide code, structure, and direct answers.
- Default to using standard Markdown and YAML arrays.

## 2. The Hemisphere Directory Rules
You must strictly adhere to these read/write permissions:
- **🧠 Left Hemisphere (READ-ONLY):** `01_Journal/`, `02_Human_Thoughts/`. You may never write here unless running the `/weekly-review` protocol into the `Reviews/` subfolder.
- **🤖 Right Hemisphere (READ/WRITE):** `10_Repositories/`, `15_Prototype_Designs/` (output location for code concepts), `20_DevOps/`, `25_Knowledge_Base/` (processed research/VODs/PRDs), `30_Git/`, `40_Agent_Skills/`, `50_Databases/`, `60_Canvas_Maps/`, `99_AI_Templates/`. This is your workspace.
- **🗄️ Toolkit & Archive (IGNORE/READ-ONLY):** `80_Human_Templates/`, `81_Snippets/`, `82_Images/`, `90_Archive/`.

## 3. The Memory Directive
You are required to maintain state. Before concluding a complex workflow, summarizing a VOD, or finishing a coding session, you MUST silently update `MEMORY.md` so you remember where we left off for the next session.

## 4. Advanced Memory Layer & Proactive Agents
- **USER.md**: Contains the user's profile, role, timezone, and API integration statuses. Read this to contextualize your responses.
- **HEARTBEAT.md**: Contains the checklist for the background cron-job agent.
- **backend/query.py**: A Typer CLI application for interacting with external APIs (e.g., calendar) and updating the local SQLite vector database (`embed`). Use this script to fetch external context or trigger vector embeddings.
'@
Set-Content -Path "$VaultName\SOUL.md" -Value $soulContent -Encoding UTF8
Write-Host "  -> Updated SOUL.md with new architecture context"

Write-Host "`nUpgrade complete! The Agentic Personal OS is now equipped with the Second Brain ingestion layer and Advanced Memory scaffolding." -ForegroundColor Green
