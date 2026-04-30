# Agentic Personal OS

Welcome to the Agentic Personal OS repository. This project has been refactored into a strict **Three-Tier Architecture** to completely separate the knowledge graph (Obsidian), the operational engine (Python), and the control panel (React/Vite).

## 🏗️ Architecture Overview

The workspace is divided into three isolated domains:

### 1. The Obsidian Blueprint (`/vault/`)
- **Role:** The pure knowledge graph and schema definition layer.
- **Contents:** Human thoughts `01_Journal`, `02_Human_Thoughts`, AI domains (`10_Repositories`, `20_DevOps`), Agent skills, Git workflows, and settings (`.obsidian/`).
- **Usage:** Point your local Obsidian application to this directory to use it as a standard Vault.

### 2. The Engine Layer (`/backend/`)
- **Role:** The AI orchestration and vault management engine.
- **Contents:** Python scripts (e.g., `vault_manager.py`), OpenClaw configurations, and Docker setups.
- **Usage:** Used to programmatically manipulate the vault (e.g., inject YAML templates, configure agents, update MOCs).

### 3. The Control Panel (`/frontend/`)
- **Role:** The web dashboard and configuration UI.
- **Contents:** A React/Vite application.
- **Usage:** Provides a UI interface that reads directly from the `/vault/` folder to present your knowledge base and files in an interactive explorer.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **Python 3.10+**
- **Obsidian** (optional, but recommended for native vault interaction)

### Setup & Installation

**1. Frontend (Control Panel)**
Navigate to the root directory or the frontend directory and install the Node dependencies:
```bash
cd frontend
npm install
```

**2. Backend (Engine Layer)**
Set up your Python virtual environment and install dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install typer pyyaml rich
```

**3. Obsidian Vault**
Open the desktop Obsidian app and choose **Open folder as vault**. Select the `/vault/` directory inside this repository.

---

## 💻 Running the Application

### Starting the Frontend UI
From the root directory, you can utilize the root `package.json` scripts to run the Vite dev server:
```bash
npm run dev
```
*(This commands delegates to the frontend directory and starts the app on port 3000)*

### Using the Backend Vault Manager
Navigate to the `backend` folder and use the Python CLI tool to safely modify your Vault schema:
```bash
cd backend
python vault_manager.py --help
```
*Available Commands:*
- `create-folder <path>`: Scaffolds a new structural directory in the Vault.
- `inject-template <template_name> <target_file>`: Hydrates templates with data.
- `update-moc <moc_filename> <title> <doc_reference>`: Safely appends an entry to a Map of Content.

---

## 📜 Historical Note
A legacy structural migration script (`refactor_architecture.ps1`) is kept at the root. This PowerShell script was responsible for untangling the original monolith into this strict three-tier architecture.
