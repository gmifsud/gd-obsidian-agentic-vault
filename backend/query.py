import typer
from rich.console import Console
import sys
import io
import re
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from knowledge_index import brief_current, search_current, ensure_index
from vault_layout import VaultLayout, VaultLayoutError, load_engine_vault

# Force UTF-8 encoding for standard output/error on Windows to prevent UnicodeEncodeError
if sys.platform.startswith("win"):
    # Reconfigure in place rather than replacing the streams, so importers (e.g. pytest capture) keep working.
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, io.UnsupportedOperation):
            pass


app = typer.Typer(help="Query Manager: Local maintenance and fresh, reviewed lexical context.")
console = Console()

err_console = Console(stderr=True)


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


@app.command()
def calendar(timeframe: str = "today"):
    """Fetch calendar events (not yet configured)."""
    console.print("[yellow]Calendar integration not yet configured.[/yellow]")
    console.print("Calendar integration requires implementation before it can be enabled.")


@app.command()
def sync_notebooklm(file_path: str):
    """Reserved integration; no remote synchronisation is implemented."""
    sys.stdout.write(json.dumps({'status': 'skipped', 'reason': 'NotebookLM sync not implemented', 'path': file_path}) + '\n')


MEMORY_ARCHIVE_RELATIVE = Path("35_Sessions") / "Memory_Ledger_Archive.md"


@dataclass(frozen=True)
class MemoryCompactResult:
    kept_count: int
    archived_count: int
    archive_path: Path | None


def compact_memory_file(layout: VaultLayout, keep: int = 5) -> MemoryCompactResult:
    """Persist complete log blocks before trimming; failures preserve MEMORY."""
    from vault_io import vault_lock, preflight, fingerprint, atomic_write, digest, moc_text
    if keep < 1:
        raise ValueError("keep must be positive")
    memory = layout.root / "MEMORY.md"
    if not memory.is_file():
        return MemoryCompactResult(0, 0, None)
    with vault_lock(layout):
        original_hash = fingerprint(memory)
        lines = memory.read_text(encoding="utf-8").splitlines(keepends=True)
        start = next((i + 1 for i, line in enumerate(lines) if line.startswith("## 📜 Rolling Log")), None)
        if start is None:
            return MemoryCompactResult(0, 0, None)
        end, entries, fence = len(lines), [], None
        for i in range(start, len(lines)):
            marker = re.match(r"^\s*(`{3,}|~{3,})", lines[i])
            if marker:
                token = marker.group(1)
                if fence is None:
                    fence = token
                elif token[0] == fence[0] and len(token) >= len(fence):
                    fence = None
                continue
            if fence is None and lines[i].startswith("## "):
                end = i
                break
            if fence is None and lines[i].startswith("- "):
                entries.append(i)
        if len(entries) <= keep:
            return MemoryCompactResult(len(entries), 0, None)
        boundaries = entries + [end]
        blocks = ["".join(lines[a:b]) for a, b in zip(boundaries, boundaries[1:])]
        archive = layout.root / MEMORY_ARCHIVE_RELATIVE
        moc = layout.moc_for(archive)
        preflight(layout, [memory, archive] + ([moc] if moc else []))
        archive_revision = fingerprint(archive)
        old = archive.read_text(encoding="utf-8") if archive.exists() else "---\ntype: memory-archive\ntags: [memory, archive]\n---\n# Memory Ledger Archive\n\n"
        updated, added = old, 0
        for block in blocks[:-keep]:
            marker = "<!-- entry:" + digest(block) + " -->\n"
            if marker not in updated:
                updated += marker + block + ("\n" if not block.endswith("\n") else "")
                added += 1
        if updated != old:
            atomic_write(layout, archive, updated, archive_revision)
        if archive.read_text(encoding="utf-8") != updated:
            raise OSError("Archive verification failed; MEMORY unchanged")
        if moc:
            moc_revision = fingerprint(moc)
            current = moc.read_text(encoding="utf-8") if moc.exists() else "# Sessions\n"
            changed = moc_text(current, archive.stem, "Memory Ledger Archive")
            if changed != current:
                atomic_write(layout, moc, changed, moc_revision)
        result = "".join(lines[:entries[0]]) + "".join(blocks[-keep:]) + "".join(lines[end:])
        atomic_write(layout, memory, result, original_hash)
        return MemoryCompactResult(keep, added, archive)


@app.command()
def compact():
    """Compact MEMORY.md to the 5 most recent Rolling Log entries and archive evicted ones."""
    console.print("[bold magenta]Compacting memory...[/bold magenta]")
    layout = _vault()
    memory_path = layout.root / "MEMORY.md"
    if not memory_path.exists():
        console.print("[bold red]MEMORY.md not found[/bold red]")
        return
    res = compact_memory_file(layout, keep=5)
    console.print(
        f"[bold green]Compacted memory to {res.kept_count} log entries (archived {res.archived_count}).[/bold green]"
    )


@app.command()
def heartbeat():
    """Run implemented local work and report every unimplemented action honestly."""
    layout = _vault()
    result = compact_memory_file(layout, keep=5)
    drafts = layout.root / '15_Prototype_Designs'
    report = {'api_checks': 'skipped: not implemented',
              'compaction': {'kept': result.kept_count, 'archived': result.archived_count},
              'draft_count': len(list(drafts.glob('*.md'))) if drafts.is_dir() else 0,
              'knowledge_sync': 'skipped: not implemented', 'notification': 'skipped: not implemented'}
    sys.stdout.write(json.dumps(report) + '\n')


@app.command()
def reset_heartbeat():
    """Reset HEARTBEAT.md: uncheck all items and remove the timestamp line. For cron job reuse."""
    heartbeat_path = _vault().root / "HEARTBEAT.md"
    if not heartbeat_path.exists():
        console.print("[bold red]HEARTBEAT.md not found![/bold red]")
        raise typer.Exit(code=1)
    _require_write_permission(_vault(), heartbeat_path)

    with open(heartbeat_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Uncheck all items
    content = content.replace("[x]", "[ ]")

    # Remove timestamp line
    content = re.sub(r"\n?Last run: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*$", "", content)
    content = content.rstrip() + "\n"

    with open(heartbeat_path, "w", encoding="utf-8") as f:
        f.write(content)

    console.print("[bold green]HEARTBEAT.md has been reset. All items unchecked, timestamp removed.[/bold green]")


@app.command()
def embed():
    """Refresh the vault-owned lexical index; no model downloads."""
    _, metrics = ensure_index(_vault())
    sys.stdout.write(json.dumps(metrics) + '\n')


@app.command()
def search(
    query_text: str,
    limit: int = 5,
    directory: str = typer.Option(None, '--directory', '-d'),
    tag: str = typer.Option(None, '--tag', '-t'),
    repo: str = typer.Option(None, '--repo'),
    include_unreviewed: bool = typer.Option(False, '--include-unreviewed'),
):
    """Search current reviewed knowledge; diagnostic inclusion is explicit."""
    from dataclasses import asdict
    hits, freshness = search_current(_vault(), query_text, directory=directory, tag=tag,
                                     limit=limit, repo=repo, include_unreviewed=include_unreviewed)
    sys.stdout.write(json.dumps({'hits': [asdict(h) for h in hits], 'freshness': freshness}) + '\n')


@app.command()
def brief(
    query_text: str,
    limit: int = typer.Option(5, '--limit', '-n'),
    directory: str = typer.Option(None, '--directory', '-d'),
    tag: str = typer.Option(None, '--tag', '-t'),
    repo: str = typer.Option(None, '--repo'),
    include_unreviewed: bool = typer.Option(False, '--include-unreviewed'),
    max_chars: int = typer.Option(12000, '--max-chars'),
    include_memory: bool = typer.Option(False, '--include-memory'),
    neighbours: bool = typer.Option(False, '--neighbours'),
):
    """Bounded briefing from fresh, scoped and currently reviewed notes."""
    packet, _ = brief_current(_vault(), query_text, directory=directory, tag=tag, limit=limit,
                              repo=repo, include_unreviewed=include_unreviewed, max_chars=max_chars,
                              include_memory=include_memory, neighbours=neighbours)
    sys.stdout.write(packet)


if __name__ == "__main__":
    app()
