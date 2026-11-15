import os
import sys
import io
import re
import json
import yaml
from functools import lru_cache
from pathlib import Path
from datetime import datetime
import typer

from vault_layout import (
    MOC_DIRECTORY,
    ZONE_ASSETS,
    ZONE_LEFT,
    ZONE_RIGHT,
    VaultLayout,
    VaultLayoutError,
    load_engine_vault,
)

# Force UTF-8 encoding for standard output/error on Windows to prevent UnicodeEncodeError
if sys.platform.startswith("win"):
    # Reconfigure in place rather than replacing the streams, so importers (e.g. pytest capture) keep working.
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, io.UnsupportedOperation):
            pass
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Vault Manager: Manipulate the Obsidian Blueprint programmatically")
console = Console()
# Status lines go to stderr so that stdout stays parseable (e.g. the JSON from vault-status).
err_console = Console(stderr=True)

REPO_ROOT = Path(__file__).resolve().parent.parent
BLUEPRINT_VAULT = REPO_ROOT / "vault"
TEMPLATES_DIRECTORY = "80_Templates"
STATIC_AGENT_INDEX_HEADER = "## Static Agent Index"
# Prose files inside a Vault whose directory lists must agree with the layout.
VAULT_PROSE_FILES = ["SOUL.md", "AGENT_INSTRUCTIONS.md"]
# Prose file beside the Blueprint that describes it; checked only for the Blueprint.
BLUEPRINT_PROSE_FILE = REPO_ROOT / ".cursorrules"


@lru_cache(maxsize=1)
def _vault() -> VaultLayout:
    """Load the Vault the Engine acts on, announce its root, or exit if it has no valid layout."""
    try:
        layout = load_engine_vault()
    except VaultLayoutError as exc:
        err_console.print(str(exc), style="bold red", markup=False)
        raise typer.Exit(code=1)
    err_console.print(f"Vault root: {layout.root}", markup=False)
    return layout


def _require_write_permission(layout: VaultLayout, path: Path | str) -> None:
    """Exit with an explanation unless an agent may write ``path``."""
    decision = layout.may_agent_write(path)
    if not decision.allowed:
        err_console.print(f"Refused to write {path}: {decision.reason}.", style="bold red", markup=False)
        raise typer.Exit(code=1)


def _count_files_in_dir(dir_path: Path) -> int:
    """Recursively count all files in a directory."""
    if not dir_path.exists():
        return 0
    return sum(1 for _ in dir_path.rglob("*") if _.is_file())


# Code is documentation, not navigation: wikilinks shown inside it are examples, not links.
_FENCED_CODE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE = re.compile(r"`[^`\n]+`")
_WIKILINK = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]*?)?\]\]")


def _extract_wikilinks(text: str) -> list[str]:
    """Extract all [[wikilink]] targets from text, ignoring fenced and inline code."""
    prose = _INLINE_CODE.sub("", _FENCED_CODE.sub("", text))
    return _WIKILINK.findall(prose)


def _resolve_wikilink(link_target: str, vault_dir: Path) -> bool:
    """Check if a wikilink resolves to a real .md file or folder in the vault."""
    target = link_target.strip()
    if not target:
        return False
    # Check if it matches a directory name directly
    if (vault_dir / target).is_dir():
        return True
    # Wikilinks can omit the .md extension
    if not target.endswith(".md"):
        target += ".md"
    # Search anywhere in the vault for a file with that name
    # Handle paths like "20_DevOps/some-file" 
    if "/" in target or "\\" in target:
        return (vault_dir / target).exists()
    matches = list(vault_dir.rglob(target))
    return len(matches) > 0


def _validate_mocs(vault_dir: Path) -> list[dict]:
    """Validate all MOC files: extract wikilinks and check if they resolve."""
    moc_dir = vault_dir / MOC_DIRECTORY
    results = []
    if not moc_dir.exists():
        return results
    for moc_file in moc_dir.glob("*.md"):
        if moc_file.name == "README.md":
            continue
        content = moc_file.read_text(encoding="utf-8")
        links = _extract_wikilinks(content)
        broken = []
        for link in links:
            if not _resolve_wikilink(link, vault_dir):
                broken.append(link)
        results.append({
            "moc": moc_file.name,
            "total_links": len(links),
            "broken_links": broken,
        })
    return results


def _append_to_moc_index(moc_path: Path, entry_line: str, link_target: str) -> bool:
    """Insert ``entry_line`` under ``## Static Agent Index`` in ``moc_path`` unless ``[[link_target]]`` is already present."""
    content = moc_path.read_text(encoding="utf-8")
    if f"[[{link_target}]]" in content:
        return False
    normalized_entry = entry_line.strip()
    if STATIC_AGENT_INDEX_HEADER in content:
        content = content.replace(
            STATIC_AGENT_INDEX_HEADER,
            f"{STATIC_AGENT_INDEX_HEADER}\n{normalized_entry}",
            1,
        )
    else:
        content = content.rstrip() + f"\n\n{STATIC_AGENT_INDEX_HEADER}\n{normalized_entry}\n"
    moc_path.write_text(content, encoding="utf-8")
    return True


def _check_frontmatter_problems(vault_dir: Path, notes: list[Path]) -> list[str]:
    """Return human-readable errors for any Markdown note whose YAML frontmatter is malformed."""
    problems: list[str] = []
    for note in notes:
        try:
            raw = note.read_text(encoding="utf-8")
        except OSError as exc:
            problems.append(f"Could not read {note.name}: {exc}")
            continue
        normalized = raw.replace("\r\n", "\n")
        if not normalized.startswith("---\n"):
            continue
        parts = normalized.split("---\n", 2)
        rel = note.relative_to(vault_dir) if note.is_relative_to(vault_dir) else note
        if len(parts) < 3:
            problems.append(f"Unclosed YAML frontmatter fence in {rel}")
            continue
        try:
            parsed = yaml.safe_load(parts[1])
        except yaml.YAMLError as exc:
            first_line = str(exc).splitlines()[0]
            problems.append(f"Malformed YAML frontmatter in {rel}: {first_line}")
            continue
        if parsed is not None and not isinstance(parsed, dict):
            problems.append(f"YAML frontmatter in {rel} must be a mapping, got {type(parsed).__name__}")
    return problems


def _collect_managed_notes(layout: VaultLayout) -> list[Path]:
    """List Markdown notes inside managed Vault directories (excluding Templates placeholder files and dot-paths)."""
    notes: list[Path] = []
    for directory in layout.directories:
        if directory == TEMPLATES_DIRECTORY:
            continue
        dir_path = layout.root / directory
        if not dir_path.is_dir():
            continue
        for md_file in sorted(dir_path.rglob("*.md")):
            rel_parts = md_file.relative_to(layout.root).parts
            if any(part.startswith(".") for part in rel_parts):
                continue
            notes.append(md_file)
    return notes


def _get_last_rolling_log_timestamp(vault_dir: Path) -> str | None:
    """Parse MEMORY.md and extract the timestamp from the last rolling log entry."""
    memory_path = vault_dir / "MEMORY.md"
    if not memory_path.exists():
        return None
    content = memory_path.read_text(encoding="utf-8")
    # Look for lines like: - [2025-06-10 14:30] or - [2025-06-10] or ISO timestamps
    timestamps = re.findall(
        r"-\s*\[(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\]",
        content,
    )
    if timestamps:
        return timestamps[-1]
    return None


@app.command()
def create_folder(path: str):
    """Programmatically create a new folder structurally inside the vault."""
    layout = _vault()
    _require_write_permission(layout, path)
    target_path = layout.root / path
    if target_path.exists():
        console.print(f"[bold yellow]Folder already exists: {target_path}[/bold yellow]")
        return

    try:
        target_path.mkdir(parents=True, exist_ok=True)
        console.print(f"[bold green]Successfully created folder: {target_path}[/bold green]")

        # Add a README standard to initialize the folder
        readme_path = target_path / "README.md"
        if not readme_path.exists():
            readme_path.write_text(f"# {target_path.name}\n\nFolder automatically generated by Vault Manager.", encoding="utf-8")
    except Exception as e:
        console.print(f"[bold red]Failed to create folder: {e}[/bold red]")


@app.command()
def inject_template(
    template_name: str,
    target_file: str,
    title: str = "New Document",
    variables: list[str] = typer.Option(None, "--var", help="Variables to hydrate in template, e.g. key=value")
):
    """Inject an AI YAML template into a new markdown file."""
    layout = _vault()
    _require_write_permission(layout, target_file)
    template_path = layout.root / TEMPLATES_DIRECTORY / template_name
    
    if not template_path.exists():
        console.print(f"[bold red]Template not found: {template_path}[/bold red]")
        raise typer.Exit(code=1)
        
    output_path = layout.root / target_file
    if output_path.exists():
        console.print(f"[bold yellow]Target file already exists: {output_path}[/bold yellow]")
        raise typer.Exit(code=1)
        
    # Read template content
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse --var options into a dictionary
    var_dict = {}
    if variables:
        for var in variables:
            if "=" in var:
                k, v = var.split("=", 1)
                var_dict[k.strip()] = v.strip()

    # Add standard tokens
    current_date = datetime.now().strftime("%Y-%m-%d")
    var_dict.setdefault("date", current_date)
    var_dict.setdefault("title", title)

    # Separate frontmatter and body
    frontmatter_str = ""
    body_str = content
    if content.startswith("---\n"):
        parts = content.split("---\n", 2)
        if len(parts) >= 3:
            frontmatter_str = parts[1]
            body_str = parts[2]

    # Handle YAML frontmatter parsing and merging
    if frontmatter_str:
        try:
            frontmatter_data = yaml.safe_load(frontmatter_str) or {}
            for k, v in var_dict.items():
                # If key looks like a list/array in target frontmatter, parse it
                if k in ["tech_stack", "related_repos", "prerequisites"]:
                    if v.startswith("[") and v.endswith("]"):
                        import json as json_mod
                        try:
                            v = json_mod.loads(v)
                        except Exception:
                            v = [item.strip().strip('"').strip("'") for item in v[1:-1].split(",") if item.strip()]
                    else:
                        v = [item.strip() for item in v.split(",") if item.strip()]
                # Update key
                frontmatter_data[k] = v
            # Re-serialize frontmatter
            frontmatter_str = yaml.safe_dump(frontmatter_data, sort_keys=False).strip()
            content = f"---\n{frontmatter_str}\n---\n{body_str}"
        except Exception as e:
            console.print(f"[bold yellow]Failed to merge frontmatter YAML: {e}. Falling back to text replacement.[/bold yellow]")

    # Run generic token replacement in the entire file
    for k, v in var_dict.items():
        val_str = ", ".join(v) if isinstance(v, list) else str(v)
        content = content.replace(f"{{{{{k}}}}}", val_str)

    # Also make sure standard {{date}} and {{title}} are replaced if they weren't in var_dict keys
    content = content.replace("{{date}}", current_date)
    content = content.replace("{{title}}", title)
    
    # Write to target destination
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    console.print(f"[bold green]Successfully generated {target_file} using {template_name}[/bold green]")


@app.command()
def update_moc(moc_filename: str, title: str, doc_reference: str):
    """Update a Map of Content (MOC) with a new interlinked entry."""
    layout = _vault()
    full_path = layout.root / MOC_DIRECTORY / moc_filename
    _require_write_permission(layout, full_path)
    
    if not full_path.exists():
        console.print(f"[bold red]MOC not found: {full_path}[/bold red]")
        raise typer.Exit(code=1)
        
    entry = f"- [[{doc_reference}]] - {title}"
    if not _append_to_moc_index(full_path, entry, doc_reference):
        console.print(f"[bold yellow]Reference already exists in MOC: {title}[/bold yellow]")
        return

    console.print(f"[bold green]Successfully appended {title} to {moc_filename}[/bold green]")

@app.command()
def auto_update_moc(file_path: str):
    """Automatically route and append a new file reference to the correct MOC."""
    layout = _vault()
    target_path = Path(file_path).resolve()
    # If file_path is relative, resolve it relative to the Vault root or CWD
    if not target_path.exists():
        # Try relative to the Vault root
        target_path = (layout.root / file_path).resolve()
        if not target_path.exists():
            # Try relative to the Vault root's parent
            target_path = (layout.root.parent / file_path).resolve()
            if not target_path.exists():
                console.print(f"[bold red]File not found: {file_path}[/bold red]")
                raise typer.Exit(code=1)

    # The Vault layout says which MOC indexes each directory.
    moc_path = layout.moc_for(target_path)
    if moc_path is None:
        console.print(f"[yellow]The Vault layout names no MOC for {target_path}. Skipping MOC update.[/yellow]")
        return
    _require_write_permission(layout, moc_path)
    directory = target_path.relative_to(layout.root).parts[0]

    # Notes are linked by name; other files (e.g. assets) keep their extension.
    is_note = target_path.suffix == ".md"
    file_name = target_path.stem if is_note else target_path.name

    # Extract YAML frontmatter
    metadata = {}
    if is_note:
        content = target_path.read_text(encoding="utf-8")
        if content.startswith("---\n"):
            parts = content.split("---\n", 2)
            if len(parts) >= 3:
                try:
                    metadata = yaml.safe_load(parts[1]) or {}
                except Exception:
                    pass

    entry = f"- [[{file_name}]]"

    # Entry details depend on the directory
    if directory == "10_Repositories":
        tech_stack = metadata.get("tech_stack", "[]")
        status = metadata.get("status", "unknown")
        entry += f" | tech_stack: {tech_stack} | status: {status}"
    elif directory == "20_DevOps":
        env = metadata.get("environment", "[]")
        tech_stack = metadata.get("tech_stack", "[]")
        entry += f" | environment: {env} | tech_stack: {tech_stack}"
    elif directory == "30_Git":
        workflow_name = metadata.get("workflow_name", "unknown")
        entry += f" | workflow_name: {workflow_name}"
    elif directory == "25_Knowledge_Base":
        doc_type = metadata.get("type", "knowledge")
        topic = metadata.get("topic", file_name)
        entry += f" | type: {doc_type} | topic: {topic}"
    elif directory == "35_Sessions":
        harness = metadata.get("harness", "unknown")
        topic = metadata.get("topic", "unknown")
        entry += f" | harness: {harness} | topic: {topic}"

    if not moc_path.exists():
        console.print(f"[bold red]MOC file not found: {moc_path}[/bold red]")
        raise typer.Exit(code=1)

    if not _append_to_moc_index(moc_path, entry, file_name):
        console.print(f"Entry for {file_name} already exists in {moc_path.name}.")
        return

    console.print(f"[bold green]Successfully updated {moc_path.name} with {file_name}[/bold green]")


@app.command()
def catalogue_copilot():
    """Write a short catalogue note for each Obsidian Copilot conversation.

    Reads copilot/copilot-conversations/ only. The transcript stays in the
    plugin folder. Skills and custom prompts are not read. A conversation
    that already has a catalogue note is skipped.
    """
    from session_catalogue import catalogue_copilot_conversations

    layout = _vault()
    result = catalogue_copilot_conversations(layout)
    for problem in result.problems:
        err_console.print(problem, style="bold red", markup=False)
    for source in result.skipped:
        console.print(f"Already catalogued: {source}")
    for note in result.written:
        console.print(f"[bold green]Catalogued:[/bold green] {note.relative_to(layout.root).as_posix()}")
    if result.problems and not result.written:
        raise typer.Exit(code=1)


# ---------- NEW COMMANDS ----------


@app.command()
def vault_status():
    """Produce a JSON-formatted report of vault health."""
    layout = _vault()
    report: dict = {"vault_root": str(layout.root)}

    # --- File counts per zone ---
    zone_names = {
        ZONE_LEFT: "left_hemisphere",
        ZONE_RIGHT: "right_hemisphere",
        ZONE_ASSETS: "assets",
    }
    report["zone_file_counts"] = {
        name: {d: _count_files_in_dir(layout.root / d) for d in layout.directories_in(zone)}
        for zone, name in zone_names.items()
    }

    # --- System files ---
    report["system_files"] = {
        sf: (layout.root / sf).exists() for sf in layout.required_system_files
    }

    # --- Last rolling log timestamp ---
    report["last_rolling_log_timestamp"] = _get_last_rolling_log_timestamp(layout.root)

    # --- MOC integrity ---
    report["moc_integrity"] = _validate_mocs(layout.root)

    console.print_json(json.dumps(report, indent=2))


@app.command()
def may_write(path: str):
    """Say whether an agent may write PATH. Exit 0 if allowed, 1 if not."""
    decision = _vault().may_agent_write(path)
    verdict = "ALLOWED" if decision.allowed else "REFUSED"
    console.print(f"{verdict}: {decision.reason}", markup=False)
    raise typer.Exit(code=0 if decision.allowed else 1)


@app.command()
def list_templates():
    """List available templates from vault/80_Templates/ with their YAML frontmatter fields."""
    templates_dir = _vault().root / TEMPLATES_DIRECTORY
    if not templates_dir.exists():
        console.print("[bold red]80_Templates directory not found![/bold red]")
        raise typer.Exit(code=1)

    template_files = sorted(templates_dir.glob("*.md"))
    if not template_files:
        console.print("[yellow]No templates found in 80_Templates/.[/yellow]")
        return

    table = Table(title="Available Templates", show_lines=True)
    table.add_column("Template", style="cyan", no_wrap=True)
    table.add_column("Field", style="green")
    table.add_column("Default Value", style="yellow")

    for tpl in template_files:
        content = tpl.read_text(encoding="utf-8")
        fields: dict = {}
        if content.startswith("---\n"):
            parts = content.split("---\n", 2)
            if len(parts) >= 3:
                try:
                    fields = yaml.safe_load(parts[1]) or {}
                except Exception:
                    fields = {}

        if fields:
            first = True
            for key, value in fields.items():
                table.add_row(
                    tpl.name if first else "",
                    str(key),
                    str(value) if value is not None else "",
                )
                first = False
        else:
            table.add_row(tpl.name, "(no frontmatter)", "")

    console.print(table)


@app.command()
def validate():
    """Check architectural purity of the vault. Exit 0 if valid, 1 if issues found."""
    layout = _vault()
    warnings: list[str] = []

    # 1. Layout checks: the Vault on disk, and the prose agents read, against the Vault layout
    layout_issues = layout.problems()
    prose_files = [layout.root / name for name in VAULT_PROSE_FILES]
    if layout.root == BLUEPRINT_VAULT.resolve():
        prose_files.append(BLUEPRINT_PROSE_FILE)
    for prose_file in prose_files:
        if prose_file.is_file():
            layout_issues.extend(layout.prose_problems(prose_file))

    # 2. Empty hemisphere directories (only README.md or nothing)
    for d in layout.directories_in(ZONE_LEFT) + layout.directories_in(ZONE_RIGHT):
        dir_path = layout.root / d
        if dir_path.exists():
            md_files = [f for f in dir_path.rglob("*.md") if f.name != "README.md"]
            if not md_files:
                warnings.append(f"Empty hemisphere directory: {d}/ (contains only README.md or is empty)")

    # 3. MOC link checks
    moc_results = _validate_mocs(layout.root)
    link_issues = [
        f"Broken wikilink in {moc['moc']}: [[{bl}]]"
        for moc in moc_results
        for bl in moc["broken_links"]
    ]

    # 4. YAML frontmatter syntax checks across managed notes
    frontmatter_issues = _check_frontmatter_problems(layout.root, _collect_managed_notes(layout))
    issues = layout_issues + link_issues + frontmatter_issues

    # --- Output: one section per kind of check, each with its own verdict ---
    sections = (
        ("Layout checks", layout_issues),
        ("MOC link checks", link_issues),
        ("Frontmatter checks", frontmatter_issues),
    )
    for title, section_issues in sections:
        if section_issues:
            console.print(f"[bold red]FAIL: {title}[/bold red]")
            for issue in section_issues:
                console.print(f"  X {issue}", style="red", markup=False)
        else:
            console.print(f"[bold green]PASS: {title}[/bold green]")
        console.print()

    if warnings:
        console.print()
        console.print("[bold yellow]Warnings:[/bold yellow]")
        for w in warnings:
            console.print(f"  [yellow]![/yellow] {w}")

    if moc_results:
        console.print()
        console.print("[bold]MOC Link Summary:[/bold]")
        for moc in moc_results:
            broken_count = len(moc["broken_links"])
            status = "[green]OK[/green]" if broken_count == 0 else f"[red]{broken_count} broken[/red]"
            console.print(f"  {moc['moc']}: {moc['total_links']} links — {status}")

    raise typer.Exit(code=1 if issues else 0)


if __name__ == "__main__":
    app()
