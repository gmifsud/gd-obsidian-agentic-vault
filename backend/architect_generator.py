import sys
import io
import json
import shutil
import typer
import yaml
from rich.console import Console
from pathlib import Path
from datetime import datetime

from vault_layout import CONFIG_FILENAME, LAYOUT_KEY, VaultLayout, VaultLayoutError

# Force UTF-8 encoding for standard output/error on Windows to prevent UnicodeEncodeError
if sys.platform.startswith("win"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

app = typer.Typer(help="Architect: The Agentic Personal OS Vault Generator")
console = Console()

CANONICAL_VAULT = Path(__file__).resolve().parent.parent / "vault"

# Tooling directories every generated Vault gets. Dot-directories are outside the Vault layout.
TOOLING_DIRECTORIES = [".obsidian/templates", ".openclaw"]
# Directories whose contents are copied from the Blueprint.
COPIED_DIRECTORIES = ["40_Agent_Skills", "80_Templates", "00_MOCs"]
# Directories that start empty and get a placeholder README.
README_DIRECTORIES = ["50_Databases", "60_Canvas_Maps", "25_Knowledge_Base", "15_Prototype_Designs"]


def _copy_vault_directory(source_vault: Path, target_path: Path, rel_dir: str):
    """Copy an entire directory tree from the source vault to the target vault."""
    src = source_vault / rel_dir
    dst = target_path / rel_dir
    if src.exists() and src.is_dir():
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        return True
    return False


@app.command()
def generate(
    path: str = typer.Argument(..., help="Path to spin out the new Obsidian vault"),
    from_vault: str = typer.Option(None, help="Path to vault to use as blueprint (default: ../vault/)"),
):
    """
    Spin out a new, pristine Agentic Personal OS Obsidian Vault.

    Reads the Vault layout, system files, skills, templates, and MOCs from the
    Blueprint (or the vault specified via --from-vault). There are no built-in
    defaults: a Blueprint without a valid layout or with a missing system file
    is an error.
    """
    target_path = Path(path)
    source_vault = Path(from_vault).resolve() if from_vault else CANONICAL_VAULT

    try:
        layout = VaultLayout.load(source_vault)
    except VaultLayoutError as exc:
        console.print(str(exc), style="bold red", markup=False)
        raise typer.Exit(code=1)

    missing = [name for name in layout.required_system_files if not (source_vault / name).is_file()]
    if missing:
        console.print(
            f"Blueprint {source_vault} is missing system files: {', '.join(missing)}",
            style="bold red",
            markup=False,
        )
        raise typer.Exit(code=1)

    console.print(f"[bold cyan]🏛️ Architect System Spinning out vault at:[/bold cyan] {target_path.absolute()}")
    console.print(f"[dim]Source vault: {source_vault}[/dim]")

    # Scaffold the directories the Vault layout declares, plus tooling directories
    for directory in (*layout.directories, *layout.override_paths, *TOOLING_DIRECTORIES):
        (target_path / directory).mkdir(parents=True, exist_ok=True)
    for directory in README_DIRECTORIES:
        readme_path = target_path / directory / "README.md"
        if directory in layout.directories and not readme_path.exists():
            readme_path.write_text(f"# {directory}\n\nAutomated tracking for {directory} objects.", encoding="utf-8")

    # Copy system files from the Blueprint
    for filename in layout.required_system_files:
        shutil.copyfile(source_vault / filename, target_path / filename)

    # Copy skills, templates and MOCs from the Blueprint
    for directory in COPIED_DIRECTORIES:
        if not _copy_vault_directory(source_vault, target_path, directory):
            console.print(f"[dim]  {directory}/ not found in source vault; directory created empty.[/dim]")

    # MCP Hooks
    mcp_script = (Path(__file__).resolve().parent / "mcp_server.py").as_posix()
    claude_json = {
        "mcpServers": {
            "vau-m-engine": { "command": str(Path(sys.executable).resolve()), "args": [mcp_script],
                              "env": {"VAULT_PATH": str(target_path.resolve())} },
            "obsidian-vault-search": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-obsidian", "--dir", "."] },
            "pieces-memory": { "command": "npx", "args": ["-y", "@pieces-app/mcp-server"] }
        }
    }
    (target_path / "claude.json").write_text(json.dumps(claude_json, indent=2), encoding="utf-8")

    # Generate vault.config.yaml: provenance, plus the Vault layout inherited from the Blueprint
    vault_config = {
        "generated_by": "architect_generator",
        "generated_at": datetime.now().isoformat(),
        "source_vault": str(source_vault),
        "version": "1.0.0",
        LAYOUT_KEY: layout.raw,
    }
    (target_path / CONFIG_FILENAME).write_text(
        yaml.safe_dump(vault_config, sort_keys=False),
        encoding="utf-8",
    )

    console.print("[bold green]✅ Blueprint generated successfully! 100% Architectural Purity achieved.[/bold green]")

if __name__ == "__main__":
    app()
