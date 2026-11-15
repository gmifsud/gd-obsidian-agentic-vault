"""Tests for cataloguing Obsidian Copilot conversations."""

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from session_catalogue import catalogue_copilot_conversations  # noqa: E402
from vault_layout import CONFIG_FILENAME, VaultLayout  # noqa: E402

CONVERSATION = """---
epoch: 1784789741044
modelKey: kimi-k2.7-code|github-copilot
topic: "Render Obsidian URL"
tags:
  - copilot-conversation
---

**user**: How do I open this URI?

**ai**: Use the Obsidian URI scheme.
"""

SKILL = """---
name: json-canvas
---

# A plugin skill, not a conversation
"""


def _vault(tmp_path: Path) -> VaultLayout:
    root = tmp_path / "vault"
    for directory in ("00_MOCs", "35_Sessions", "copilot/copilot-conversations", "copilot/skills/json-canvas"):
        (root / directory).mkdir(parents=True)
    (root / "00_MOCs" / "Sessions_MOC.md").write_text(
        "# Sessions\n\n## Static Agent Index\n", encoding="utf-8"
    )
    (root / "copilot" / "skills" / "json-canvas" / "SKILL.md").write_text(SKILL, encoding="utf-8")
    layout = {
        "directories": {
            "00_MOCs": {"zone": "right", "agent_writable": True, "moc": None},
            "35_Sessions": {"zone": "right", "agent_writable": True, "moc": "Sessions_MOC.md"},
        },
        "unmanaged": ["copilot"],
        "system_files": {"required": {"SOUL.md": {"agent_writable": False}}, "optional": {}},
    }
    (root / "SOUL.md").write_text("x", encoding="utf-8")
    (root / CONFIG_FILENAME).write_text(yaml.safe_dump({"layout": layout}), encoding="utf-8")
    return VaultLayout.load(root)


def _write_conversation(root: Path, name: str = "chat.md", text: str = CONVERSATION) -> None:
    (root / "copilot" / "copilot-conversations" / name).write_text(text, encoding="utf-8")


def test_writes_a_short_note_and_leaves_the_transcript_in_place(tmp_path):
    layout = _vault(tmp_path)
    _write_conversation(layout.root)

    result = catalogue_copilot_conversations(layout)

    assert len(result.written) == 1
    note = result.written[0].read_text(encoding="utf-8")
    assert "type: harness-session" in note
    assert "source: copilot/copilot-conversations/chat.md" in note
    assert "How do I open this URI?" not in note
    assert (layout.root / "copilot" / "copilot-conversations" / "chat.md").read_text(encoding="utf-8") == CONVERSATION
    assert "[[Copilot - Render Obsidian URL]]" in (layout.root / "00_MOCs" / "Sessions_MOC.md").read_text(encoding="utf-8")
    assert not list((layout.root / "copilot" / "skills").rglob("Copilot*"))


def test_a_second_run_skips_the_conversation(tmp_path):
    layout = _vault(tmp_path)
    _write_conversation(layout.root)
    catalogue_copilot_conversations(layout)

    again = catalogue_copilot_conversations(layout)

    assert again.written == []
    assert again.skipped == ["copilot/copilot-conversations/chat.md"]


def test_a_skill_note_is_not_catalogued(tmp_path):
    layout = _vault(tmp_path)

    result = catalogue_copilot_conversations(layout)

    assert result.written == []
    assert list((layout.root / "35_Sessions").glob("*.md")) == []


def test_invalid_frontmatter_is_reported_and_skipped(tmp_path):
    layout = _vault(tmp_path)
    _write_conversation(layout.root, "broken.md", "---\ntopic: *Summary:** broken\n---\n")

    result = catalogue_copilot_conversations(layout)

    assert result.written == []
    assert result.problems
    assert "broken.md" in result.problems[0]
