"""Tests for distilling harness session transcripts into structured Right Hemisphere knowledge notes."""

import sys
from pathlib import Path

import yaml

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIRECTORY))

from session_catalogue import catalogue_records  # noqa: E402
from session_distiller import distill_transcript_to_vault  # noqa: E402
from session_providers import SessionMessage, SessionRecord, SessionTranscript  # noqa: E402
from vault_layout import CONFIG_FILENAME, VaultLayout  # noqa: E402


def _make_vault(tmp_path: Path) -> VaultLayout:
    root = tmp_path / "vault"
    for directory in ("00_MOCs", "25_Knowledge_Base", "35_Sessions"):
        (root / directory).mkdir(parents=True)
    (root / "00_MOCs" / "Knowledge_Base_MOC.md").write_text(
        "# Knowledge Base MOC\n\n## Static Agent Index\n",
        encoding="utf-8",
    )
    (root / "00_MOCs" / "Sessions_MOC.md").write_text(
        "# Sessions MOC\n\n## Static Agent Index\n",
        encoding="utf-8",
    )
    layout = {
        "directories": {
            "00_MOCs": {"zone": "right", "agent_writable": True, "moc": None},
            "25_Knowledge_Base": {"zone": "right", "agent_writable": True, "moc": "Knowledge_Base_MOC.md"},
            "35_Sessions": {"zone": "right", "agent_writable": True, "moc": "Sessions_MOC.md"},
        },
        "unmanaged": ["copilot"],
        "system_files": {"required": {"SOUL.md": {"agent_writable": False}}, "optional": {}},
    }
    (root / "SOUL.md").write_text("x", encoding="utf-8")
    (root / CONFIG_FILENAME).write_text(yaml.safe_dump({"layout": layout}), encoding="utf-8")
    return VaultLayout.load(root)


def test_unqualified_provider_is_not_distilled(tmp_path: Path):
    import pytest
    layout = _make_vault(tmp_path)
    record = SessionRecord('claude', 'sess-99', 'example', 'Title', '', '', '', 1, 10, 'missing.jsonl')
    transcript = SessionTranscript(record, (SessionMessage('assistant', 'Thanks, done.', ''),))
    with pytest.raises(ValueError, match='Unqualified'):
        distill_transcript_to_vault(layout, transcript)
    assert not list((layout.root / '25_Knowledge_Base').glob('*.md'))
