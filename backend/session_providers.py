"""Six harness catalogues; native Codex evidence qualified, other readers browsing-only."""

from __future__ import annotations

import json
import os
import re
import sqlite3
from dataclasses import dataclass, replace
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

import yaml

PROVIDER_NAMES = ("claude", "codex", "cursor", "gemini", "kilocode", "copilot")

_CODEX_ROLLOUT_RE = re.compile(
    r"^rollout-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(.+)\.jsonl$"
)
_COPILOT_TURN_RE = re.compile(r"^\*\*(user|ai)\*\*:\s*(.*?)(?=^\*\*(?:user|ai)\*\*:|\Z)", re.MULTILINE | re.DOTALL)
_WORKSPACE_RE = re.compile(r"workspace[s]?.*?([A-Za-z]:\\[^\s\"']+|/[^\s\"']+)", re.IGNORECASE)


@dataclass(frozen=True)
class SessionRecord:
    """Metadata summary for one discovered harness session."""

    provider: str
    session_id: str
    project: str
    topic: str
    model: str
    started_at: str
    last_modified: str
    message_count: int
    size_bytes: int
    source_path: str
    source_scope: str = ""
    source_revision: str = ""
    parse_status: str = "unqualified"
    diagnostics: tuple[str, ...] = ()
    ignored_events: int = 0
    repository: str = ""

    @property
    def source_key(self) -> str:
        scope = self.source_scope or os.path.normcase(str(Path(self.source_path).resolve().parent))
        return hashlib.sha256(json.dumps([self.provider, scope, self.session_id]).encode()).hexdigest()


@dataclass(frozen=True)
class SessionMessage:
    """One untruncated message turn inside a session transcript."""

    role: str
    content: str
    timestamp: str
    evidence_id: str = ""
    kind: str = "message"
    call_id: str = ""


@dataclass(frozen=True)
class SessionTranscript:
    """Full untruncated message history for a ``SessionRecord``."""

    record: SessionRecord
    messages: tuple[SessionMessage, ...]


def _iso_from_timestamp(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _clean_topic(raw: str, fallback: str) -> str:
    first_line = next((line.strip() for line in raw.splitlines() if line.strip()), "")
    cleaned = re.sub(r"^[#>*`\-\s]+", "", first_line)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return fallback
    return cleaned[:90]


def _human_readable_claude_project(encoded_name: str) -> str:
    decoded = re.sub(r"^([A-Za-z])--", r"\1:\\", encoded_name)
    return decoded.replace("--", "\\")


def default_provider_paths(vault_root: Path | None = None) -> dict[str, Path]:
    """Return the configured or default session root directories for all 6 harnesses."""
    home = Path.home()
    appdata = Path(os.environ.get("APPDATA") or (home / "AppData" / "Roaming"))

    def _resolve(env_key: str, default: Path) -> Path:
        raw = os.environ.get(env_key)
        if not raw:
            return default
        expanded = re.sub(r"%USERPROFILE%", lambda _: str(home), raw, flags=re.IGNORECASE)
        expanded = re.sub(r"%APPDATA%", lambda _: str(appdata), expanded, flags=re.IGNORECASE)
        return Path(expanded)

    copilot_default = (
        vault_root / "copilot" / "copilot-conversations"
        if vault_root is not None
        else Path(__file__).resolve().parent.parent / "vault" / "copilot" / "copilot-conversations"
    )
    return {
        "claude": _resolve("CLAUDE_SESSIONS_PATH", home / ".claude" / "projects"),
        "codex": _resolve("CODEX_SESSIONS_PATH", home / ".codex" / "sessions"),
        "cursor": _resolve("CURSOR_SESSIONS_PATH", appdata / "Cursor" / "User" / "workspaceStorage"),
        "gemini": _resolve("GEMINI_SESSIONS_PATH", home / ".gemini" / "antigravity-ide" / "brain"),
        "kilocode": _resolve(
            "KILOCODE_SESSIONS_PATH",
            appdata / "Code" / "User" / "globalStorage" / "kilocode.kilo-code" / "tasks",
        ),
        "copilot": _resolve("COPILOT_SESSIONS_PATH", copilot_default),
    }


def _extract_claude_text(payload: object) -> str:
    if isinstance(payload, str):
        return payload
    if isinstance(payload, dict):
        content = payload.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [
                str(item.get("text", ""))
                for item in content
                if isinstance(item, dict) and item.get("text")
            ]
            if parts:
                return "\n".join(parts)
        if "text" in payload and isinstance(payload["text"], str):
            return payload["text"]
    if isinstance(payload, list):
        parts = [
            str(item.get("text", ""))
            for item in payload
            if isinstance(item, dict) and item.get("text")
        ]
        if parts:
            return "\n".join(parts)
    return ""


def _parse_claude_entry(entry: dict) -> SessionMessage | None:
    entry_type = entry.get("type")
    role = entry.get("role")
    timestamp = str(entry.get("timestamp") or "")
    if entry_type == "human" or role == "user":
        text = _extract_claude_text(entry.get("message")) or _extract_claude_text(entry.get("content"))
        return SessionMessage(role="user", content=text, timestamp=timestamp) if text else None
    if entry_type == "assistant" or role == "assistant":
        text = _extract_claude_text(entry.get("message")) or _extract_claude_text(entry.get("content"))
        return SessionMessage(role="assistant", content=text, timestamp=timestamp) if text else None
    if entry_type in ("tool_use", "tool_result"):
        return SessionMessage(role="tool", content=json.dumps(entry, ensure_ascii=False), timestamp=timestamp)
    return None


def _read_jsonl_messages(path: Path, parser) -> list[SessionMessage]:
    messages: list[SessionMessage] = []
    if not path.is_file():
        return messages
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict):
            continue
        msg = parser(parsed)
        if msg is not None:
            messages.append(msg)
    return messages


def discover_claude_sessions(base_path: Path | str) -> list[SessionRecord]:
    """Discover Claude Code JSONL sessions under ``base_path``."""
    base = Path(base_path)
    if not base.is_dir():
        return []
    records: list[SessionRecord] = []
    for proj_dir in sorted(p for p in base.iterdir() if p.is_dir()):
        project_name = _human_readable_claude_project(proj_dir.name)
        for jsonl_file in sorted(proj_dir.rglob("*.jsonl")):
            stat = jsonl_file.stat()
            if stat.st_size == 0:
                continue
            messages = _read_jsonl_messages(jsonl_file, _parse_claude_entry)
            first_user = next((m.content for m in messages if m.role == "user"), "")
            topic = _clean_topic(first_user, jsonl_file.stem)
            rel_parent = jsonl_file.parent.relative_to(proj_dir).as_posix()
            label = f"{project_name} [subagent]" if "subagents" in rel_parent else project_name
            records.append(
                SessionRecord(
                    provider="claude",
                    session_id=jsonl_file.stem,
                    project=label,
                    topic=topic,
                    model="",
                    started_at=_iso_from_timestamp(stat.st_ctime),
                    last_modified=_iso_from_timestamp(stat.st_mtime),
                    message_count=len(messages) or 1,
                    size_bytes=stat.st_size,
                    source_path=jsonl_file.as_posix(),
                )
            )
    return records


def _parse_codex_entry(entry: dict) -> SessionMessage | None:
    role = entry.get("role") or entry.get("type")
    timestamp = str(entry.get("timestamp") or "")
    content = entry.get("content")
    if role in ("user", "assistant"):
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            text = "\n".join(str(c.get("text", "")) for c in content if isinstance(c, dict))
        else:
            text = json.dumps(content, ensure_ascii=False) if content is not None else ""
        return SessionMessage(role=str(role), content=text, timestamp=timestamp) if text else None
    if role in ("function_call", "tool_call"):
        return SessionMessage(role="tool", content=json.dumps(entry, ensure_ascii=False), timestamp=timestamp)
    return None


def discover_codex_sessions(base_path: Path | str) -> list[SessionRecord]:
    """Discover Codex CLI ``rollout-*.jsonl`` sessions under ``base_path``."""
    base = Path(base_path)
    if not base.is_dir():
        return []
    records: list[SessionRecord] = []
    for jsonl_file in sorted(base.rglob("rollout-*.jsonl")):
        stat = jsonl_file.stat()
        match = _CODEX_ROLLOUT_RE.match(jsonl_file.name)
        if match:
            date_part, h, m, s, uuid = match.groups()
            started_at = f"{date_part}T{h}:{m}:{s}Z"
            session_id = uuid
        else:
            started_at = _iso_from_timestamp(stat.st_ctime)
            session_id = jsonl_file.stem
        provisional = SessionRecord(
                provider="codex",
                session_id=session_id,
                project="",
                topic=session_id,
                model="",
                started_at=started_at,
                last_modified=_iso_from_timestamp(stat.st_mtime),
                message_count=0,
                size_bytes=stat.st_size,
                source_path=jsonl_file.as_posix(),
                source_scope=os.path.normcase(str(base.resolve())),
            )
        records.append(read_codex_transcript(provisional).record)
    return records


def read_codex_transcript(record: SessionRecord) -> SessionTranscript:
    """Codex native JSONL v1: response_item is authoritative; event_msg is telemetry.

    Locators use physical line numbers and the exact byte revision. Unknown content
    is a partial parse, never silently reported as a complete transcript.
    """
    path = Path(record.source_path)
    try:
        raw = path.read_bytes()
        changed = raw != path.read_bytes()
        lines = raw.decode('utf-8').splitlines()
    except (OSError, UnicodeError) as exc:
        return SessionTranscript(replace(record, message_count=0, parse_status='unreadable',
                                         diagnostics=(str(exc),)), ())
    revision = hashlib.sha256(raw).hexdigest()
    issues = ['Source changed during read'] if changed else []
    messages, mirrors = [], []
    meta, context, ignored = {}, {}, 0
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            if not isinstance(entry, dict):
                raise ValueError('record must be an object')
            kind, payload = entry.get('type'), entry.get('payload')
            if not isinstance(payload, dict):
                # Legacy flat records remain browsable but cannot qualify.
                legacy = _parse_codex_entry(entry)
                if legacy:
                    messages.append(replace(legacy, evidence_id=f'L{number}'))
                issues.append(f'L{number}: unsupported non-native envelope')
                continue
            if kind == 'session_meta':
                if meta and meta.get('id') != payload.get('id'):
                    issues.append(f'L{number}: conflicting session metadata')
                meta = payload
                ignored += 1
            elif kind == 'turn_context':
                context = payload
                ignored += 1
            elif kind == 'event_msg':
                if payload.get('type') in ('user_message', 'agent_message'):
                    mirrors.append(str(payload.get('message') or ''))
                ignored += 1
            elif kind == 'response_item':
                typ = payload.get('type')
                timestamp = str(entry.get('timestamp') or '')
                locator = f'L{number}'
                if typ == 'message':
                    role = str(payload.get('role') or 'unknown')
                    parts = payload.get('content')
                    if not isinstance(parts, list):
                        raise ValueError('message content must be an array')
                    texts = []
                    for part in parts:
                        if isinstance(part, dict) and part.get('type') in ('input_text', 'output_text') and isinstance(part.get('text'), str):
                            texts.append(part['text'])
                        else:
                            issues.append(f'{locator}: unsupported message content block')
                            texts.append(json.dumps(part, ensure_ascii=False))
                    messages.append(SessionMessage(role, '\n'.join(texts), timestamp, locator))
                elif typ in ('function_call', 'custom_tool_call', 'function_call_output', 'custom_tool_call_output'):
                    output = typ.endswith('_output')
                    text = payload.get('output') if output else payload
                    if not isinstance(text, str):
                        text = json.dumps(text, ensure_ascii=False, sort_keys=True)
                    messages.append(SessionMessage('tool', text, timestamp, locator,
                                                   'tool_result' if output else 'tool_call',
                                                   str(payload.get('call_id') or '')))
                elif typ == 'reasoning':
                    ignored += 1  # internal reasoning is not reusable evidence
                elif typ == 'additional_tools' and isinstance(payload.get('tools'), list):
                    ignored += 1  # tool definitions, not calls or results (Codex 0.166)
                elif typ == 'configuration_update' and set(payload) <= {'type', 'reasoning'} and isinstance(payload.get('reasoning'), dict):
                    ignored += 1
                elif typ == 'compaction':
                    issues.append(f'{locator}: compacted history is incomplete')
                else:
                    issues.append(f'{locator}: unsupported response item {typ}')
            elif kind == 'world_state' and isinstance(payload.get('state'), dict) and isinstance(payload.get('full'), bool):
                ignored += 1
            elif kind == 'token_usage_record' and isinstance(payload.get('usage'), dict):
                ignored += 1
            elif kind in ('compacted',):
                issues.append(f'L{number}: compacted history is incomplete')
            else:
                issues.append(f'L{number}: unsupported record {kind}')
        except (ValueError, TypeError) as exc:
            issues.append(f'L{number}: {exc}')
    canonical_texts = {m.content for m in messages if m.role in ('user', 'assistant')}
    if any(text and text not in canonical_texts for text in mirrors):
        issues.append('Content event has no canonical response_item')
    calls = {m.call_id for m in messages if m.kind == 'tool_call' and m.call_id}
    results = {m.call_id for m in messages if m.kind == 'tool_result' and m.call_id}
    if calls - results:
        issues.append('Tool call has no recorded result; history may be truncated or still active')
    for msg in messages:
        if msg.kind == 'tool_call' and not msg.call_id:
            issues.append(f'{msg.evidence_id}: tool call has no call_id')
        if msg.kind == 'tool_result' and (not msg.call_id or msg.call_id not in calls):
            issues.append(f'{msg.evidence_id}: result has no matching tool call')
    if not meta.get('id') or not meta.get('cwd'):
        issues.append('Missing native session id or workspace')
    status = 'complete' if messages and not issues else ('partial' if messages else ('unsupported' if issues else 'empty'))
    if not raw.strip():
        status, issues = 'empty', []
    first_user = next((m.content for m in messages if m.role == 'user'), '')
    repository = ''
    workspace = Path(str(meta.get('cwd') or ''))
    if workspace.is_absolute() and workspace.is_dir():
        for parent in (workspace, *workspace.parents):
            if (parent / '.git').is_dir() or (parent / '.git').is_file():
                repository = os.path.normcase(str(parent.resolve())).replace('\\', '/')
                break
    updated = replace(record, session_id=str(meta.get('id') or record.session_id),
                      project=str(meta.get('cwd') or ''), model=str(context.get('model') or meta.get('model') or ''),
                      started_at=str(meta.get('timestamp') or record.started_at),
                      topic=_clean_topic(first_user, record.session_id), message_count=len(messages),
                      size_bytes=len(raw), source_revision=revision, parse_status=status,
                      diagnostics=tuple(issues), ignored_events=ignored, repository=repository)
    return SessionTranscript(updated, tuple(messages))


def _read_cursor_messages(db_path: Path) -> list[SessionMessage]:
    messages: list[SessionMessage] = []
    if not db_path.is_file():
        return messages
    conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    try:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "ItemTable" not in tables:
            return messages
        rows = conn.execute(
            """
            SELECT key, value FROM ItemTable
            WHERE key LIKE '%aiChat%' OR key LIKE '%composer%' OR key LIKE '%cursor%chat%'
            ORDER BY key
            """
        ).fetchall()
        for _, raw_value in rows:
            if not raw_value:
                continue
            try:
                data = json.loads(raw_value)
            except json.JSONDecodeError:
                continue
            tabs = data if isinstance(data, list) else [data]
            for tab in tabs:
                if not isinstance(tab, dict):
                    continue
                turns = tab.get("conversation") or tab.get("messages") or []
                if not isinstance(turns, list):
                    continue
                for turn in turns:
                    if not isinstance(turn, dict):
                        continue
                    role = str(turn.get("role") or turn.get("type") or "unknown")
                    text = turn.get("text") if isinstance(turn.get("text"), str) else turn.get("content")
                    if not isinstance(text, str):
                        text = json.dumps(turn, ensure_ascii=False)
                    messages.append(
                        SessionMessage(
                            role=role,
                            content=text,
                            timestamp=str(turn.get("timestamp") or ""),
                        )
                    )
    finally:
        conn.close()
    return messages


def discover_cursor_sessions(base_path: Path | str) -> list[SessionRecord]:
    """Discover Cursor workspace SQLite chat sessions under ``base_path``."""
    base = Path(base_path)
    if not base.is_dir():
        return []
    records: list[SessionRecord] = []
    for ws_dir in sorted(p for p in base.iterdir() if p.is_dir()):
        db_path = ws_dir / "state.vscdb"
        if not db_path.is_file():
            continue
        try:
            messages = _read_cursor_messages(db_path)
        except sqlite3.Error:
            continue
        if not messages:
            continue
        project_name = ws_dir.name
        ws_json = ws_dir / "workspace.json"
        if ws_json.is_file():
            try:
                folder = json.loads(ws_json.read_text(encoding="utf-8")).get("folder", "")
                if isinstance(folder, str) and folder:
                    project_name = Path(unquote(re.sub(r"^file:///", "", folder))).name or project_name
            except (json.JSONDecodeError, OSError):
                pass
        first_user = next((m.content for m in messages if m.role == "user"), messages[0].content)
        stat = db_path.stat()
        records.append(
            SessionRecord(
                provider="cursor",
                session_id=ws_dir.name,
                project=project_name,
                topic=_clean_topic(first_user, ws_dir.name),
                model="",
                started_at=_iso_from_timestamp(stat.st_ctime),
                last_modified=_iso_from_timestamp(stat.st_mtime),
                message_count=len(messages),
                size_bytes=stat.st_size,
                source_path=db_path.as_posix(),
            )
        )
    return records


def _read_gemini_messages(transcript_path: Path) -> list[SessionMessage]:
    if not transcript_path.is_file():
        return []
    compact_lines = transcript_path.read_text(encoding="utf-8", errors="replace").splitlines()
    full_path = transcript_path.parent / "transcript_full.jsonl"
    full_lines: list[str] | None = None

    messages: list[SessionMessage] = []
    for idx, raw_line in enumerate(compact_lines):
        stripped = raw_line.strip()
        if not stripped:
            continue
        try:
            entry = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if not isinstance(entry, dict):
            continue

        # When truncated_fields is present in transcript.jsonl, resolve the full line from transcript_full.jsonl.
        if entry.get("truncated_fields") and full_path.is_file():
            if full_lines is None:
                full_lines = full_path.read_text(encoding="utf-8", errors="replace").splitlines()
            if idx < len(full_lines) and full_lines[idx].strip():
                try:
                    full_entry = json.loads(full_lines[idx])
                    if isinstance(full_entry, dict):
                        entry = full_entry
                except json.JSONDecodeError:
                    pass

        step_type = entry.get("type")
        source = entry.get("source")
        content = str(entry.get("content") or "")
        timestamp = str(entry.get("created_at") or "")
        if step_type == "USER_INPUT" or source == "USER_EXPLICIT":
            if content:
                messages.append(SessionMessage(role="user", content=content, timestamp=timestamp))
        elif step_type == "PLANNER_RESPONSE" or source == "MODEL":
            if content:
                messages.append(SessionMessage(role="assistant", content=content, timestamp=timestamp))
        elif step_type in ("RUN_COMMAND", "TOOL_RESPONSE"):
            if content:
                messages.append(SessionMessage(role="tool", content=content, timestamp=timestamp))
    return messages


def discover_gemini_sessions(base_path: Path | str) -> list[SessionRecord]:
    """Discover Gemini / Antigravity conversation logs under ``base_path``."""
    base = Path(base_path)
    if not base.is_dir():
        return []
    records: list[SessionRecord] = []
    for conv_dir in sorted(p for p in base.iterdir() if p.is_dir()):
        transcript_path = conv_dir / ".system_generated" / "logs" / "transcript.jsonl"
        if not transcript_path.is_file():
            continue
        stat = transcript_path.stat()
        messages = _read_gemini_messages(transcript_path)
        project_name = conv_dir.name
        for msg in messages[:5]:
            match = _WORKSPACE_RE.search(msg.content)
            if match:
                project_name = Path(match.group(1).replace("\\", "/")).name or project_name
                break
        first_user = next((m.content for m in messages if m.role == "user"), "")
        topic = _clean_topic(first_user, conv_dir.name)
        records.append(
            SessionRecord(
                provider="gemini",
                session_id=conv_dir.name,
                project=project_name,
                topic=topic,
                model="",
                started_at=_iso_from_timestamp(stat.st_ctime),
                last_modified=_iso_from_timestamp(stat.st_mtime),
                message_count=len(messages) or 1,
                size_bytes=stat.st_size,
                source_path=transcript_path.as_posix(),
            )
        )
    return records


def _read_kilocode_messages(task_dir: Path) -> list[SessionMessage]:
    ui_path = task_dir / "ui_messages.json"
    api_path = task_dir / "api_conversation_history.json"
    data_path = ui_path if ui_path.is_file() else api_path
    if not data_path.is_file():
        return []
    try:
        entries = json.loads(data_path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return []
    if not isinstance(entries, list):
        return []

    messages: list[SessionMessage] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        say = entry.get("say")
        entry_type = entry.get("type")
        ts = entry.get("ts")
        timestamp = _iso_from_timestamp(float(ts) / 1000.0) if isinstance(ts, (int, float)) else ""
        text = entry.get("text") if isinstance(entry.get("text"), str) else _extract_claude_text(entry)
        if role == "user" or (entry_type == "say" and say == "user_feedback"):
            if text:
                messages.append(SessionMessage(role="user", content=text, timestamp=timestamp))
        elif role == "assistant" or (entry_type == "say" and say == "text"):
            if text:
                messages.append(SessionMessage(role="assistant", content=text, timestamp=timestamp))
        elif role == "tool" or (entry_type == "say" and say in ("tool", "command")):
            messages.append(
                SessionMessage(
                    role="tool",
                    content=text or json.dumps(entry, ensure_ascii=False),
                    timestamp=timestamp,
                )
            )
    return messages


def discover_kilocode_sessions(base_path: Path | str) -> list[SessionRecord]:
    """Discover Kilo Code task conversations under ``base_path``."""
    base = Path(base_path)
    if not base.is_dir():
        return []
    records: list[SessionRecord] = []
    for task_dir in sorted(p for p in base.iterdir() if p.is_dir()):
        ui_path = task_dir / "ui_messages.json"
        api_path = task_dir / "api_conversation_history.json"
        meta_path = task_dir / "task_metadata.json"
        if not ui_path.is_file() and not api_path.is_file():
            continue
        project_name = task_dir.name
        started_at = ""
        if meta_path.is_file():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8", errors="replace"))
                if isinstance(meta, dict):
                    wp = meta.get("workspace_path") or meta.get("dirAbsolutePath")
                    if isinstance(wp, str) and wp:
                        project_name = Path(wp.replace("\\", "/")).name or project_name
                    ts = meta.get("ts")
                    if isinstance(ts, (int, float)):
                        started_at = _iso_from_timestamp(float(ts) / 1000.0)
            except json.JSONDecodeError:
                pass
        messages = _read_kilocode_messages(task_dir)
        first_user = next((m.content for m in messages if m.role == "user"), "")
        stat = task_dir.stat()
        total_size = sum(
            p.stat().st_size for p in (meta_path, api_path, ui_path) if p.is_file()
        )
        records.append(
            SessionRecord(
                provider="kilocode",
                session_id=task_dir.name,
                project=project_name,
                topic=_clean_topic(first_user, task_dir.name),
                model="",
                started_at=started_at or _iso_from_timestamp(stat.st_ctime),
                last_modified=_iso_from_timestamp(stat.st_mtime),
                message_count=len(messages) or 1,
                size_bytes=total_size,
                source_path=task_dir.as_posix(),
            )
        )
    return records


def _parse_copilot_file(md_path: Path) -> tuple[dict, list[SessionMessage]]:
    raw = md_path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    frontmatter: dict = {}
    body = raw
    if raw.startswith("---\n"):
        parts = raw.split("---\n", 2)
        if len(parts) >= 3:
            try:
                loaded = yaml.safe_load(parts[1])
                if isinstance(loaded, dict):
                    frontmatter = loaded
            except yaml.YAMLError:
                pass
            body = parts[2]
    messages: list[SessionMessage] = []
    for match in _COPILOT_TURN_RE.finditer(body):
        speaker, content = match.groups()
        role = "user" if speaker == "user" else "assistant"
        cleaned = content.strip()
        if cleaned:
            messages.append(SessionMessage(role=role, content=cleaned, timestamp=""))
    return frontmatter, messages


def discover_copilot_sessions(base_path: Path | str) -> list[SessionRecord]:
    """Discover Obsidian Copilot Markdown conversations in ``base_path``."""
    base = Path(base_path)
    if not base.is_dir():
        return []
    records: list[SessionRecord] = []
    for md_file in sorted(base.glob("*.md")):
        if md_file.name.startswith("."):
            continue
        stat = md_file.stat()
        frontmatter, messages = _parse_copilot_file(md_file)
        topic = str(frontmatter.get("topic") or frontmatter.get("agentLabel") or "").strip()
        if not topic:
            first_user = next((m.content for m in messages if m.role == "user"), "")
            topic = _clean_topic(first_user, md_file.stem)
        model = str(frontmatter.get("modelKey") or "").strip()
        epoch = frontmatter.get("epoch")
        if isinstance(epoch, (int, float)) and epoch > 0:
            seconds = float(epoch) / 1000.0 if epoch > 1_000_000_000_000 else float(epoch)
            started_at = _iso_from_timestamp(seconds)
        else:
            started_at = _iso_from_timestamp(stat.st_ctime)
        records.append(
            SessionRecord(
                provider="copilot",
                session_id=md_file.stem,
                project="vault",
                topic=topic,
                model=model,
                started_at=started_at,
                last_modified=_iso_from_timestamp(stat.st_mtime),
                message_count=len(messages) or 1,
                size_bytes=stat.st_size,
                source_path=md_file.as_posix(),
            )
        )
    return records


def read_session_transcript(record: SessionRecord) -> SessionTranscript:
    """Read the full untruncated message transcript for ``record``."""
    source = Path(record.source_path)
    if record.provider == "claude":
        messages = _read_jsonl_messages(source, _parse_claude_entry)
    elif record.provider == "codex":
        return read_codex_transcript(record)
    elif record.provider == "cursor":
        messages = _read_cursor_messages(source)
    elif record.provider == "gemini":
        messages = _read_gemini_messages(source)
    elif record.provider == "kilocode":
        messages = _read_kilocode_messages(source)
    elif record.provider == "copilot":
        _, messages = _parse_copilot_file(source)
    else:
        messages = []
    return SessionTranscript(record=record, messages=tuple(messages))


def discover_all_sessions(
    providers: list[str] | tuple[str, ...] | None = None,
    provider_paths: dict[str, Path] | None = None,
    vault_root: Path | None = None,
) -> list[SessionRecord]:
    """Discover sessions across the requested providers (defaults to all 6)."""
    paths = provider_paths or default_provider_paths(vault_root=vault_root)
    wanted = [p.lower().strip() for p in (providers or PROVIDER_NAMES)]
    if "all" in wanted:
        wanted = list(PROVIDER_NAMES)

    dispatch = {
        "claude": discover_claude_sessions,
        "codex": discover_codex_sessions,
        "cursor": discover_cursor_sessions,
        "gemini": discover_gemini_sessions,
        "kilocode": discover_kilocode_sessions,
        "copilot": discover_copilot_sessions,
    }
    records: list[SessionRecord] = []
    for name in wanted:
        fn = dispatch.get(name)
        root = paths.get(name)
        if fn is not None and root is not None:
            records.extend(fn(root))
    return records


def scan_sessions(providers=None, provider_paths=None, vault_root=None) -> tuple[list[SessionRecord], list[dict]]:
    """Report each source independently; legacy browsing does not imply qualification."""
    wanted = providers or list(PROVIDER_NAMES)
    if 'all' in wanted:
        wanted = list(PROVIDER_NAMES)
    paths = provider_paths or default_provider_paths(vault_root)
    records, outcomes = [], []
    for provider in wanted:
        qualified = provider == 'codex'
        try:
            if provider not in PROVIDER_NAMES:
                raise ValueError(f'Unknown provider: {provider}')
            if provider not in paths or not paths[provider].is_dir():
                raise OSError('Source directory unavailable')
            found = discover_all_sessions([provider], paths, vault_root)
            records.extend(found)
            outcomes.append({'provider': provider, 'status': 'complete', 'qualified_format': qualified,
                             'count': len(found), 'incomplete': sum(r.parse_status != 'complete' for r in found) if qualified else None})
        except (OSError, ValueError, sqlite3.Error) as exc:
            outcomes.append({'provider': provider, 'status': 'error', 'qualified_format': qualified, 'error': str(exc)})
    return records, outcomes


def find_session(provider: str, session_id: str, vault_root: Path, source_key: str | None = None) -> SessionTranscript:
    records, outcomes = scan_sessions([provider], vault_root=vault_root)
    matches = [r for r in records if r.session_id == session_id and (not source_key or r.source_key == source_key)]
    if len(matches) != 1:
        raise ValueError(f'Session missing or ambiguous: {provider}:{session_id}; outcomes={outcomes}')
    return read_session_transcript(matches[0])
