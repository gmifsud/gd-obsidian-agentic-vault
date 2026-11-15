"""Tests for unified Python session provider discovery and untruncated transcript reading."""

import json
import sqlite3
import sys
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIRECTORY))

from session_providers import (  # noqa: E402
    SessionMessage,
    SessionRecord,
    SessionTranscript,
    discover_claude_sessions,
    discover_codex_sessions,
    discover_copilot_sessions,
    discover_cursor_sessions,
    discover_gemini_sessions,
    discover_kilocode_sessions,
    read_session_transcript,
)


def test_discover_and_read_claude_jsonl_session(tmp_path: Path):
    proj_dir = tmp_path / "D--Repos-my-app"
    proj_dir.mkdir()
    long_reply = "Root cause is token expiry. " * 300  # > 5000 chars, must not be truncated
    session_file = proj_dir / "sess-123.jsonl"
    session_file.write_text(
        json.dumps({"type": "human", "message": "Fix the login bug", "timestamp": "2026-11-14T10:00:00Z"}) + "\n"
        + json.dumps({"type": "assistant", "message": long_reply, "timestamp": "2026-11-14T10:01:00Z"}) + "\n",
        encoding="utf-8",
    )

    sessions = discover_claude_sessions(tmp_path)
    assert len(sessions) == 1
    assert isinstance(sessions[0], SessionRecord)
    assert sessions[0].provider == "claude"
    assert sessions[0].session_id == "sess-123"
    assert sessions[0].topic == "Fix the login bug"

    detail = read_session_transcript(sessions[0])
    assert isinstance(detail, SessionTranscript)
    assert len(detail.messages) == 2
    assert isinstance(detail.messages[0], SessionMessage)
    assert detail.messages[0].role == "user"
    assert detail.messages[0].content == "Fix the login bug"
    assert detail.messages[1].content == long_reply


def test_gemini_provider_reads_full_line_when_truncated_fields_present(tmp_path: Path):
    conv_dir = tmp_path / "conv-abc" / ".system_generated" / "logs"
    conv_dir.mkdir(parents=True)
    (conv_dir / "transcript.jsonl").write_text(
        json.dumps({
            "step_index": 0,
            "type": "USER_INPUT",
            "content": "Investigate memory leak in worker pool",
            "created_at": "2026-11-14T11:59:00Z",
        }) + "\n"
        + json.dumps({
            "step_index": 1,
            "type": "PLANNER_RESPONSE",
            "content": "short...",
            "truncated_fields": ["content"],
            "created_at": "2026-11-14T12:00:00Z",
        }) + "\n",
        encoding="utf-8",
    )
    (conv_dir / "transcript_full.jsonl").write_text(
        json.dumps({
            "step_index": 0,
            "type": "USER_INPUT",
            "content": "Investigate memory leak in worker pool",
            "created_at": "2026-11-14T11:59:00Z",
        }) + "\n"
        + json.dumps({
            "step_index": 1,
            "type": "PLANNER_RESPONSE",
            "content": "FULL UNTRUNCATED ARCHITECTURAL ANALYSIS",
            "created_at": "2026-11-14T12:00:00Z",
        }) + "\n",
        encoding="utf-8",
    )

    sessions = discover_gemini_sessions(tmp_path)
    assert len(sessions) == 1
    assert sessions[0].topic == "Investigate memory leak in worker pool"

    detail = read_session_transcript(sessions[0])
    assert len(detail.messages) == 2
    assert detail.messages[1].content == "FULL UNTRUNCATED ARCHITECTURAL ANALYSIS"


def test_discover_and_read_codex_rollout_session(tmp_path: Path):
    day_dir = tmp_path / "2026" / "11" / "14"
    day_dir.mkdir(parents=True)
    rollout = day_dir / "rollout-2026-11-14T09-30-00-uuid-777.jsonl"
    rollout.write_text(
        json.dumps({"role": "user", "content": "Add FTS5 search index", "timestamp": "2026-11-14T09:30:00Z"}) + "\n"
        + json.dumps({"role": "assistant", "content": "Created note_chunks_fts.", "timestamp": "2026-11-14T09:31:00Z"}) + "\n",
        encoding="utf-8",
    )

    sessions = discover_codex_sessions(tmp_path)
    assert len(sessions) == 1
    assert sessions[0].provider == "codex"
    assert sessions[0].session_id == "uuid-777"
    assert sessions[0].topic == "Add FTS5 search index"

    detail = read_session_transcript(sessions[0])
    assert len(detail.messages) == 2
    assert detail.messages[1].content == "Created note_chunks_fts."


def test_discover_and_read_cursor_sqlite_session(tmp_path: Path):
    ws_dir = tmp_path / "ws-hash-1"
    ws_dir.mkdir()
    (ws_dir / "workspace.json").write_text(
        json.dumps({"folder": "file:///D:/Repos/gd-obsidian-agentic-vault"}),
        encoding="utf-8",
    )
    db_path = ws_dir / "state.vscdb"
    conn = sqlite3.connect(str(db_path))
    conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)")
    chat_payload = [
        {
            "messages": [
                {"role": "user", "text": "Configure Husky hooks on Windows", "timestamp": "2026-11-14T08:00:00Z"},
                {"role": "assistant", "text": "Export PATH in ~/.huskyrc", "timestamp": "2026-11-14T08:01:00Z"},
            ]
        }
    ]
    conn.execute("INSERT INTO ItemTable (key, value) VALUES (?, ?)", ("workbench.panel.aiChat.view", json.dumps(chat_payload)))
    conn.commit()
    conn.close()

    sessions = discover_cursor_sessions(tmp_path)
    assert len(sessions) == 1
    assert sessions[0].provider == "cursor"
    assert sessions[0].session_id == "ws-hash-1"
    assert sessions[0].topic == "Configure Husky hooks on Windows"

    detail = read_session_transcript(sessions[0])
    assert len(detail.messages) == 2
    assert detail.messages[1].content == "Export PATH in ~/.huskyrc"


def test_discover_and_read_kilocode_and_copilot_sessions(tmp_path: Path):
    # Kilo Code task
    kilo_root = tmp_path / "kilocode"
    task_dir = kilo_root / "task-42"
    task_dir.mkdir(parents=True)
    (task_dir / "task_metadata.json").write_text(
        json.dumps({"workspace_path": "D:\\Repos\\my-service", "ts": 1763110000000}),
        encoding="utf-8",
    )
    (task_dir / "ui_messages.json").write_text(
        json.dumps([
            {"role": "user", "text": "Refactor session provider seam", "ts": 1763110000000},
            {"role": "assistant", "text": "Extracted session_providers.py.", "ts": 1763110060000},
        ]),
        encoding="utf-8",
    )

    kilo_sessions = discover_kilocode_sessions(kilo_root)
    assert len(kilo_sessions) == 1
    assert kilo_sessions[0].provider == "kilocode"
    assert kilo_sessions[0].project == "my-service"
    assert kilo_sessions[0].topic == "Refactor session provider seam"
    kilo_detail = read_session_transcript(kilo_sessions[0])
    assert len(kilo_detail.messages) == 2

    # Copilot conversation markdown
    copilot_dir = tmp_path / "copilot-conversations"
    copilot_dir.mkdir()
    (copilot_dir / "conv-1.md").write_text(
        '---\nepoch: 1784789741044\nmodelKey: gpt-4o|github-copilot\ntopic: "Render Obsidian URI"\n---\n\n'
        "**user**: How do I open an Obsidian URI?\n\n"
        "**ai**: Use `obsidian://open?vault=...`.\n",
        encoding="utf-8",
    )

    copilot_sessions = discover_copilot_sessions(copilot_dir)
    assert len(copilot_sessions) == 1
    assert copilot_sessions[0].provider == "copilot"
    assert copilot_sessions[0].topic == "Render Obsidian URI"
    assert copilot_sessions[0].model == "gpt-4o|github-copilot"
    copilot_detail = read_session_transcript(copilot_sessions[0])
    assert len(copilot_detail.messages) == 2
    assert copilot_detail.messages[0].role == "user"
    assert "Obsidian URI" in copilot_detail.messages[0].content
