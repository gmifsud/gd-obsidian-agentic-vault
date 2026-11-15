"""Tests for archiving evicted MEMORY.md Rolling Log entries during compaction."""

import sys
from pathlib import Path

import yaml

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIRECTORY))

from query import compact_memory_file  # noqa: E402
from vault_layout import CONFIG_FILENAME, VaultLayout  # noqa: E402


def _make_vault(tmp_path: Path) -> VaultLayout:
    root = tmp_path / "vault"
    for directory in ("00_MOCs", "35_Sessions"):
        (root / directory).mkdir(parents=True)
    (root / "00_MOCs" / "Sessions_MOC.md").write_text(
        "# Sessions MOC\n\n## Static Agent Index\n",
        encoding="utf-8",
    )
    layout = {
        "directories": {
            "00_MOCs": {"zone": "right", "agent_writable": True, "moc": None},
            "35_Sessions": {"zone": "right", "agent_writable": True, "moc": "Sessions_MOC.md"},
        },
        "unmanaged": ["copilot"],
        "system_files": {
            "required": {
                "SOUL.md": {"agent_writable": False},
                "MEMORY.md": {"agent_writable": True},
            },
            "optional": {},
        },
    }
    (root / "SOUL.md").write_text("x", encoding="utf-8")
    (root / CONFIG_FILENAME).write_text(yaml.safe_dump({"layout": layout}), encoding="utf-8")
    return VaultLayout.load(root)


def test_compact_archives_evicted_entries_instead_of_losing_them(tmp_path: Path):
    layout = _make_vault(tmp_path)
    bullets = "\n".join(f"- [2026-11-1{i} 10:00] Action {i}" for i in range(1, 8))
    (layout.root / "MEMORY.md").write_text(
        f"# Memory\n\n## 📜 Rolling Log (Last 5 Actions)\n{bullets}\n",
        encoding="utf-8",
    )

    result = compact_memory_file(layout, keep=5)
    assert result.kept_count == 5
    assert result.archived_count == 2

    memory_text = (layout.root / "MEMORY.md").read_text(encoding="utf-8")
    assert "Action 1" not in memory_text
    assert "Action 2" not in memory_text
    assert "Action 7" in memory_text

    archive_file = layout.root / "35_Sessions" / "Memory_Ledger_Archive.md"
    assert archive_file.is_file()
    archive_text = archive_file.read_text(encoding="utf-8")
    assert "Action 1" in archive_text
    assert "Action 2" in archive_text

    moc_text = (layout.root / "00_MOCs" / "Sessions_MOC.md").read_text(encoding="utf-8")
    assert "[[Memory_Ledger_Archive]]" in moc_text
