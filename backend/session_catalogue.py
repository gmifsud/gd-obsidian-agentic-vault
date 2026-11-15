"""Catalogue AI harness conversations as short Vault notes in ``35_Sessions/``.

External harnesses (Claude Code, Codex CLI, Cursor, Gemini / Antigravity,
Kilo Code) and Obsidian Copilot (`vault/copilot/`) keep their own transcript
files. This module writes one short pointer note per session into
``35_Sessions/`` and indexes it in ``Sessions_MOC.md``. Repeated scans use the scoped source key, conservatively adopting exact legacy source pointers.
"""

from __future__ import annotations

import re
import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml

from session_providers import SessionRecord
from vault_layout import VaultLayout
from vault_io import atomic_write, digest, fingerprint, moc_text, preflight, vault_lock

CATALOGUE_DIRECTORY = "35_Sessions"
CONVERSATIONS_RELATIVE = Path("copilot") / "copilot-conversations"
_INVALID_FILENAME = re.compile(r'[\\/:*?"<>|]')

_PROVIDER_LABELS = {
    "claude": "Claude",
    "codex": "Codex",
    "cursor": "Cursor",
    "gemini": "Gemini",
    "kilocode": "KiloCode",
    "copilot": "Copilot",
}


@dataclass
class CatalogueResult:
    written: list[Path] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)
    updated: list[Path] = field(default_factory=list)


def catalogue_records(layout: VaultLayout, records: Iterable[SessionRecord], limit: int | None = None) -> CatalogueResult:
    """Create pointers and refresh source metadata, preserving authored text and new-note limits."""
    result = CatalogueResult()
    with vault_lock(layout):
        for rec in records:
            if limit is not None and len(result.written) >= limit:
                break
            persisted = []
            try:
                path, content, revision = plan_catalogue(layout, rec)
                moc = layout.moc_for(path)
                preflight(layout, [path] + ([moc] if moc else []))
                moc_revision = fingerprint(moc) if moc else None
                moc_content = moc_text(moc.read_text(encoding='utf-8') if moc and moc.exists() else '# Sessions\n', path.stem, rec.topic)
                if revision is None:
                    atomic_write(layout, path, content, None)
                    persisted.append(str(path))
                    result.written.append(path)
                elif digest(content) != revision:
                    atomic_write(layout, path, content, revision)
                    persisted.append(str(path))
                    result.updated.append(path)
                else:
                    result.skipped.append(rec.source_path)
                if moc and digest(moc_content) != moc_revision:
                    atomic_write(layout, moc, moc_content, moc_revision)
            except (OSError, ValueError) as exc:
                result.problems.append(f'{rec.source_key}: {exc}; persisted={persisted}')
    return result


def plan_catalogue(layout: VaultLayout, rec: SessionRecord) -> tuple[Path, str, str | None]:
    """Conservatively adopt only an exact legacy source; never a title or bare ID."""
    directory = layout.root / CATALOGUE_DIRECTORY
    matches = []
    for note in sorted(directory.glob('*.md')):
        data = _frontmatter(note) if note.read_text(encoding='utf-8').startswith('---\n') else {}
        if data.get('source_key') == rec.source_key or (not data.get('source_key') and data.get('source') == rec.source_path):
            matches.append(note)
    if len(matches) > 1:
        raise ValueError(f'Ambiguous catalogue identity: {rec.source_key}')
    if matches:
        path = matches[0]
        revision = fingerprint(path)
        text = path.read_text(encoding='utf-8')
        current = yaml.safe_load(text.split('---\n', 2)[1])
        if current.get('source_key') != rec.source_key and (current.get('source_key') or current.get('source') != rec.source_path):
            raise ValueError('Catalogue identity changed during lookup')
        return path, update_catalogue_fields(text, _source_fields(rec)), revision
    label = _PROVIDER_LABELS.get(rec.provider.lower(), rec.provider.capitalize())
    path = _note_path(directory, rec.topic, rec.source_key, label)
    if path.exists():
        raise ValueError(f'Catalogue filename collision: {path}')
    return path, _record_note_text(rec), None


def catalogue_copilot_conversations(layout: VaultLayout) -> CatalogueResult:
    """Write a catalogue note for each Copilot conversation that does not have one yet."""
    result = CatalogueResult()
    source_dir = layout.root / CONVERSATIONS_RELATIVE
    if not source_dir.is_dir():
        result.problems.append(f"No Copilot conversations folder at {source_dir}")
        return result

    records = []
    for path in sorted(source_dir.glob("*.md")):
        if path.name.startswith("."):
            continue
        source = path.relative_to(layout.root).as_posix()
        try:
            data = _frontmatter(path)
        except ValueError as exc:
            result.problems.append(f"{source}: {exc}")
            continue
        topic = _topic(data, path)
        records.append(SessionRecord('copilot', path.stem, 'vault', topic,
                                     str(data.get('modelKey') or ''), _when(data), '', 0,
                                     path.stat().st_size, source, str(source_dir.resolve())))
    published = catalogue_records(layout, records)
    result.written.extend(published.written)
    result.skipped.extend(published.skipped)
    result.problems.extend(published.problems)
    result.updated.extend(published.updated)
    return result


def update_catalogue_fields(text: str, updates: dict) -> str:
    """Change owned scalar values only; keep body, comments and unrelated YAML verbatim."""
    _, front, body = text.split('---\n', 2)
    tree = yaml.compose(front, Loader=yaml.SafeLoader)
    if not isinstance(tree, yaml.MappingNode):
        raise ValueError('Catalogue frontmatter must be a mapping')
    current = yaml.safe_load(front)
    anchors = [token.start_mark.index for token in yaml.scan(front)
               if isinstance(token, (yaml.AnchorToken, yaml.AliasToken))]
    edits, seen = [], set()
    for key, value in tree.value:
        name = key.value
        if name not in updates:
            continue
        if name in seen or not isinstance(value, yaml.ScalarNode):
            raise ValueError(f'Ambiguous/non-scalar catalogue field: {name}')
        seen.add(name)
        if current[name] != updates[name]:
            start, end = value.start_mark.index, value.end_mark.index
            if start < key.end_mark.index or any(start <= position < end for position in anchors):
                raise ValueError(f'Anchored/aliased catalogue field requires explicit editing: {name}')
            replacement = json.dumps(updates[name], ensure_ascii=False)
            if front[start:end].endswith('\n'):
                replacement += '\n'
            edits.append((start, end, replacement))
    for start, end, replacement in reversed(edits):
        front = front[:start] + replacement + front[end:]
    for name, value in updates.items():
        if name not in seen:
            front += f'{name}: {json.dumps(value, ensure_ascii=False)}\n'
    return '---\n' + front + '---\n' + body


def _source_fields(rec: SessionRecord) -> dict:
    return {'harness': rec.provider.lower(), 'session_id': rec.session_id,
            'source_key': rec.source_key, 'source_scope': rec.source_scope,
            'source_revision': rec.source_revision, 'parse_status': rec.parse_status,
            'source': rec.source_path, 'project': rec.project, 'repo': rec.repository,
            'model': rec.model, 'started_at': rec.started_at, 'last_modified': rec.last_modified,
            'message_count': rec.message_count, 'size_bytes': rec.size_bytes}


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


def _note_path(catalogue_dir: Path, topic: str, source_name: str, prefix: str = "Copilot") -> Path:
    cleaned = _INVALID_FILENAME.sub("", topic)
    cleaned = re.sub(r"\s+", " ", cleaned).strip() or "untitled"
    candidate = catalogue_dir / f"{prefix} - {cleaned}.md"
    if not candidate.exists():
        return candidate
    suffix = digest(source_name)[:16]
    return catalogue_dir / f"{prefix} - {cleaned} ({suffix}).md"


def _record_note_text(rec: SessionRecord) -> str:
    recorded = {
        "type": "harness-session",
        **_source_fields(rec),
        "topic": rec.topic,
        "catalogued": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "distilled": False,
    }
    front = yaml.safe_dump(recorded, sort_keys=False, allow_unicode=True).strip()
    model_line = f"\n- **Model:** {rec.model}" if rec.model else ""
    return (
        f"---\n{front}\n---\n\n"
        f"# {rec.topic}\n\n"
        f"Catalogued from a **{rec.provider}** session. "
        "The full transcript stays in the harness store.\n\n"
        f"- **Session ID:** `{rec.session_id}`\n"
        f"- **Project:** `{rec.project}`\n"
        f"- **Started:** {rec.started_at}\n"
        f"- **Messages:** {rec.message_count}\n"
        f"- **Source:** `{rec.source_path}`{model_line}\n"
    )


def _when(data: dict) -> str:
    epoch = data.get("epoch")
    if isinstance(epoch, (int, float)) and epoch > 0:
        seconds = epoch / 1000 if epoch > 1_000_000_000_000 else epoch
        return datetime.fromtimestamp(seconds, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return ""
