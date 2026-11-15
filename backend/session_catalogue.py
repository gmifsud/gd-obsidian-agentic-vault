"""Catalogue Obsidian Copilot conversations as short Vault notes.

The plugin owns vault/copilot/ and writes the transcripts. This module reads
the conversations folder only, and writes one note per conversation into
35_Sessions/. Skills and custom prompts are left alone. Running it again
skips a conversation that is already catalogued.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml

from vault_layout import VaultLayout

CATALOGUE_DIRECTORY = "35_Sessions"
CONVERSATIONS_RELATIVE = Path("copilot") / "copilot-conversations"
_INVALID_FILENAME = re.compile(r'[\\/:*?"<>|]')


@dataclass
class CatalogueResult:
    written: list[Path] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)


def catalogue_copilot_conversations(layout: VaultLayout) -> CatalogueResult:
    """Write a catalogue note for each Copilot conversation that does not have one yet."""
    result = CatalogueResult()
    source_dir = layout.root / CONVERSATIONS_RELATIVE
    if not source_dir.is_dir():
        result.problems.append(f"No Copilot conversations folder at {source_dir}")
        return result

    catalogue_dir = layout.root / CATALOGUE_DIRECTORY
    decision = layout.may_agent_write(catalogue_dir / "note.md")
    if not decision.allowed:
        result.problems.append(decision.reason)
        return result

    already = _catalogued_sources(catalogue_dir)
    moc_path = layout.moc_for(catalogue_dir / "note.md")

    for path in sorted(source_dir.glob("*.md")):
        if path.name.startswith("."):
            continue
        source = path.relative_to(layout.root).as_posix()
        if source in already:
            result.skipped.append(source)
            continue
        try:
            data = _frontmatter(path)
        except ValueError as exc:
            result.problems.append(f"{source}: {exc}")
            continue
        topic = _topic(data, path)
        note_path = _note_path(catalogue_dir, topic, path.name)
        note_path.write_text(_note_text(topic, data, source), encoding="utf-8")
        _index(moc_path, note_path.stem, topic)
        already.add(source)
        result.written.append(note_path)
    return result


def _catalogued_sources(catalogue_dir: Path) -> set[str]:
    found: set[str] = set()
    if not catalogue_dir.is_dir():
        return found
    for note in catalogue_dir.glob("*.md"):
        try:
            data = _frontmatter(note)
        except ValueError:
            continue
        source = data.get("source")
        if isinstance(source, str):
            found.add(source)
    return found


def _frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("conversation has no frontmatter")
    parts = text.split("---\n", 2)
    if len(parts) < 3:
        raise ValueError("conversation frontmatter does not close")
    try:
        data = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError as exc:
        raise ValueError(f"frontmatter is not valid YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("frontmatter is not a mapping")
    return data


def _topic(data: dict, path: Path) -> str:
    for key in ("topic", "agentLabel"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return path.stem


def _note_path(catalogue_dir: Path, topic: str, source_name: str) -> Path:
    cleaned = _INVALID_FILENAME.sub("", topic)
    cleaned = re.sub(r"\s+", " ", cleaned).strip() or "untitled"
    candidate = catalogue_dir / f"Copilot - {cleaned}.md"
    if not candidate.exists():
        return candidate
    suffix = re.sub(r"[^A-Za-z0-9]+", "", source_name)[:12] or "2"
    return catalogue_dir / f"Copilot - {cleaned} ({suffix}).md"


def _note_text(topic: str, data: dict, source: str) -> str:
    model = data.get("modelKey")
    recorded = {
        "type": "harness-session",
        "harness": "copilot",
        "topic": topic,
        "model": model if isinstance(model, str) else "",
        "source": source,
        "catalogued": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    front = yaml.safe_dump(recorded, sort_keys=False, allow_unicode=True).strip()
    when = _when(data)
    when_line = f"\n- **When:** {when}" if when else ""
    model_line = f"\n- **Model:** {recorded['model']}" if recorded["model"] else ""
    return (
        f"---\n{front}\n---\n\n"
        f"# {topic}\n\n"
        "Catalogued from an Obsidian Copilot conversation. "
        "The transcript stays in the plugin folder.\n\n"
        f"- **Source:** `{source}`{when_line}{model_line}\n"
    )


def _when(data: dict) -> str:
    epoch = data.get("epoch")
    if isinstance(epoch, (int, float)) and epoch > 0:
        seconds = epoch / 1000 if epoch > 1_000_000_000_000 else epoch
        return datetime.fromtimestamp(seconds, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return ""


def _index(moc_path: Path | None, stem: str, topic: str) -> None:
    if moc_path is None or not moc_path.is_file():
        return
    content = moc_path.read_text(encoding="utf-8")
    if f"[[{stem}]]" in content:
        return
    safe_topic = topic.replace("|", "/")
    entry = f"- [[{stem}]] | harness: copilot | topic: {safe_topic}"
    header = "## Static Agent Index"
    if header in content:
        content = content.replace(header, f"{header}\n{entry}", 1)
    else:
        content = content.rstrip() + f"\n\n{header}\n{entry}\n"
    moc_path.write_text(content, encoding="utf-8")
