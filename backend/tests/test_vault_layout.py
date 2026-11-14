"""Tests for the Vault layout module. Each test builds a small Vault in a temp directory."""

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vault_layout import (  # noqa: E402
    CONFIG_FILENAME,
    VaultLayout,
    VaultLayoutError,
    resolve_vault_root,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

LAYOUT = {
    "directories": {
        "01_Journal": {"zone": "left", "agent_writable": False, "moc": None},
        "10_Repositories": {"zone": "right", "agent_writable": True, "moc": "Repositories_MOC.md"},
        "00_MOCs": {"zone": "right", "agent_writable": True, "moc": None},
        "90_Assets": {"zone": "assets", "agent_writable": True, "moc": None},
    },
    "overrides": {"01_Journal/Reviews": {"agent_writable": True}},
    "unmanaged": ["copilot"],
    "system_files": {
        "required": {
            "SOUL.md": {"agent_writable": False},
            "MEMORY.md": {"agent_writable": True},
        },
        "optional": {"README.md": {"agent_writable": False}},
    },
}


def make_vault(tmp_path: Path, layout: dict | None = LAYOUT) -> Path:
    """Create a Vault on disk that matches LAYOUT, and write the given layout to it."""
    root = tmp_path / "vault"
    for directory in ["01_Journal/Reviews", "10_Repositories", "00_MOCs", "90_Assets", "copilot", ".obsidian"]:
        (root / directory).mkdir(parents=True)
    for name in ["SOUL.md", "MEMORY.md"]:
        (root / name).write_text("x", encoding="utf-8")
    (root / "00_MOCs" / "Repositories_MOC.md").write_text("# MOC", encoding="utf-8")
    if layout is not None:
        (root / CONFIG_FILENAME).write_text(yaml.safe_dump({"layout": layout}), encoding="utf-8")
    return root


@pytest.fixture
def layout(tmp_path: Path) -> VaultLayout:
    return VaultLayout.load(make_vault(tmp_path))


# --- loading ---------------------------------------------------------------


def test_missing_config_fails_loudly(tmp_path):
    root = make_vault(tmp_path, layout=None)
    with pytest.raises(VaultLayoutError, match="Vault layout missing"):
        VaultLayout.load(root)


def test_config_without_layout_section_fails_loudly(tmp_path):
    root = make_vault(tmp_path, layout=None)
    (root / CONFIG_FILENAME).write_text("generated_by: architect_generator\n", encoding="utf-8")
    with pytest.raises(VaultLayoutError, match="no 'layout' section"):
        VaultLayout.load(root)


def test_invalid_yaml_fails_loudly(tmp_path):
    root = make_vault(tmp_path, layout=None)
    (root / CONFIG_FILENAME).write_text("layout: [unclosed", encoding="utf-8")
    with pytest.raises(VaultLayoutError, match="not valid YAML"):
        VaultLayout.load(root)


def test_directory_that_does_not_state_its_moc_is_invalid(tmp_path):
    broken = yaml.safe_load(yaml.safe_dump(LAYOUT))
    del broken["directories"]["90_Assets"]["moc"]
    with pytest.raises(VaultLayoutError, match="90_Assets: moc must be stated"):
        VaultLayout.load(make_vault(tmp_path, broken))


def test_all_shape_problems_are_reported_together(tmp_path):
    broken = yaml.safe_load(yaml.safe_dump(LAYOUT))
    broken["directories"]["01_Journal"]["zone"] = "archive"
    broken["directories"]["10_Repositories"]["agent_writable"] = "yes"
    broken["overrides"] = {"02_Missing/Sub": {"agent_writable": True}}
    with pytest.raises(VaultLayoutError) as excinfo:
        VaultLayout.load(make_vault(tmp_path, broken))
    message = str(excinfo.value)
    assert "01_Journal: zone must be one of" in message
    assert "10_Repositories: agent_writable must be true or false" in message
    assert "parent directory 02_Missing is not declared" in message


# --- zones -----------------------------------------------------------------


@pytest.mark.parametrize(
    "path, zone",
    [
        ("01_Journal/2026-11-14.md", "left"),
        ("01_Journal/Reviews/week.md", "left"),
        ("10_Repositories/repo.md", "right"),
        ("90_Assets/diagram.png", "assets"),
        ("SOUL.md", "system"),
        ("README.md", "system"),
        ("copilot/chat.md", "unmanaged"),
        ("Surprise/note.md", "undeclared"),
        ("stray.md", "undeclared"),
    ],
)
def test_zone_of(layout, path, zone):
    assert layout.zone_of(path) == zone


def test_directories_in_zone(layout):
    assert set(layout.directories_in("right")) == {"10_Repositories", "00_MOCs"}
    assert layout.directories_in("assets") == ("90_Assets",)


# --- write permission ------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "10_Repositories/new.md",
        "10_Repositories/deep/er/new.md",
        "90_Assets/diagram.png",
        "01_Journal/Reviews/Weekly_Review_2026-11-14.md",
        "MEMORY.md",
    ],
)
def test_agent_may_write(layout, path):
    assert layout.may_agent_write(path).allowed


@pytest.mark.parametrize(
    "path, reason",
    [
        ("01_Journal/today.md", "read-only"),
        ("01_Journal/Reviews/../today.md", "read-only"),
        ("SOUL.md", "read-only"),
        ("README.md", "read-only"),
        ("copilot/chat.md", "unmanaged"),
        (".obsidian/app.json", "dot-directory"),
        ("10_Repositories/repo/.cursor/skills/note.md", "dot-directory"),
        ("10_Repositories/repo/.hidden.md", "dot-directory"),
        ("Surprise/note.md", "not a directory declared"),
        ("stray.md", "not declared"),
        ("", "Vault root itself"),
        ("../outside.md", "outside the Vault"),
        ("10_Repositories/../../outside.md", "outside the Vault"),
    ],
)
def test_agent_may_not_write(layout, path, reason):
    decision = layout.may_agent_write(path)
    assert not decision.allowed
    assert reason in decision.reason


def test_absolute_paths_are_judged_like_relative_ones(layout):
    assert layout.may_agent_write(layout.root / "10_Repositories" / "new.md").allowed
    assert not layout.may_agent_write(layout.root / "01_Journal" / "today.md").allowed
    assert not layout.may_agent_write(layout.root.parent / "elsewhere.md").allowed


def test_sibling_directory_sharing_the_vault_name_prefix_is_outside(layout):
    sibling = layout.root.parent / (layout.root.name + "-backup") / "10_Repositories" / "x.md"
    assert "outside the Vault" in layout.may_agent_write(sibling).reason


# --- MOC lookup ------------------------------------------------------------


def test_moc_for_indexed_directory(layout):
    assert layout.moc_for("10_Repositories/repo.md") == layout.root / "00_MOCs" / "Repositories_MOC.md"


def test_moc_for_directory_marked_not_indexed(layout):
    assert layout.moc_for("90_Assets/diagram.png") is None


def test_moc_for_undeclared_path(layout):
    assert layout.moc_for("Surprise/note.md") is None


# --- comparing the Vault on disk with the layout ---------------------------


def test_matching_vault_has_no_problems(layout):
    assert layout.problems() == []


def test_problems_lists_every_mismatch(layout):
    (layout.root / "90_Assets").rmdir()
    (layout.root / "MEMORY.md").unlink()
    (layout.root / "Surprise").mkdir()
    (layout.root / "stray.md").write_text("x", encoding="utf-8")
    (layout.root / "00_MOCs" / "Repositories_MOC.md").unlink()

    problems = "\n".join(layout.problems())

    assert "Missing declared directory: 90_Assets/" in problems
    assert "Missing system file: MEMORY.md" in problems
    assert "Undeclared directory: Surprise/" in problems
    assert "Unexpected file at vault root: stray.md" in problems
    assert "MOC named for 10_Repositories/ does not exist" in problems


def test_dot_directories_unmanaged_directories_and_non_markdown_root_files_are_not_problems(layout):
    (layout.root / "claude.json").write_text("{}", encoding="utf-8")
    assert layout.problems() == []


def test_override_directory_that_does_not_exist_yet_is_not_a_problem(layout):
    (layout.root / "01_Journal" / "Reviews").rmdir()
    assert layout.problems() == []
    assert layout.may_agent_write("01_Journal/Reviews/first.md").allowed


# --- prose check -----------------------------------------------------------

PROSE_IN_AGREEMENT = """# Rules
### Left Hemisphere (READ-ONLY)
- `vault/01_Journal/`

### Right Hemisphere (READ/WRITE)
- `10_Repositories/`
- `00_MOCs/`

### Assets Zone
- `90_Assets/`

## Workflows
Read the latest file in `01_Journal/` and save to `10_Repositories/`.
"""


def write_prose(layout: VaultLayout, text: str) -> Path:
    path = layout.root / "SOUL.md"
    path.write_text(text, encoding="utf-8")
    return path


def test_prose_in_agreement_has_no_problems(layout):
    assert layout.prose_problems(write_prose(layout, PROSE_IN_AGREEMENT)) == []


def test_prose_with_inline_lists_is_understood(layout):
    text = (
        "- **Left Hemisphere (READ-ONLY):** `01_Journal/`.\n"
        "- **Right Hemisphere (READ/WRITE):** `10_Repositories/`, `00_MOCs/`.\n"
        "- **Assets Zone (READ/WRITE):** `90_Assets/`.\n"
    )
    assert layout.prose_problems(write_prose(layout, text)) == []


def test_prose_omitting_a_directory_is_a_problem(layout):
    text = PROSE_IN_AGREEMENT.replace("- `00_MOCs/`\n", "")
    assert layout.prose_problems(write_prose(layout, text)) == [
        "SOUL.md does not list 00_MOCs/ under Right Hemisphere"
    ]


def test_prose_listing_a_directory_under_the_wrong_zone_is_a_problem(layout):
    text = PROSE_IN_AGREEMENT.replace("### Assets Zone\n", "")
    problems = layout.prose_problems(write_prose(layout, text))
    assert "SOUL.md does not list 90_Assets/ under Assets Zone" in problems
    assert "SOUL.md lists 90_Assets/ under Right Hemisphere, but the layout puts it in Assets Zone" in problems


def test_prose_mentioning_an_undeclared_directory_is_a_problem(layout):
    text = PROSE_IN_AGREEMENT + "Ignore `90_Archive/`.\n"
    assert layout.prose_problems(write_prose(layout, text)) == [
        "SOUL.md mentions 90_Archive/, which the Vault layout does not declare"
    ]


# --- Vault root resolution -------------------------------------------------


def test_vault_root_defaults_to_the_repo_blueprint():
    assert resolve_vault_root({}) == REPO_ROOT / "vault"


def test_vault_root_follows_an_absolute_vault_path(tmp_path):
    assert resolve_vault_root({"VAULT_PATH": str(tmp_path)}) == tmp_path.resolve()


def test_relative_vault_path_is_resolved_like_the_control_panel_does():
    assert resolve_vault_root({"VAULT_PATH": "../vault"}) == (REPO_ROOT / "vault").resolve()


# --- the Blueprint itself --------------------------------------------------


def test_blueprint_layout_loads():
    blueprint = VaultLayout.load(REPO_ROOT / "vault")
    assert blueprint.may_agent_write("01_Journal/Reviews/review.md").allowed
    assert not blueprint.may_agent_write("01_Journal/entry.md").allowed
    assert blueprint.zone_of("90_Assets/x.png") == "assets"
