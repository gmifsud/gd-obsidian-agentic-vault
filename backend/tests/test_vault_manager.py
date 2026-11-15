"""Tests for vault_manager helpers: wikilinks, frontmatter checks, MOC indexing, and Blueprint MOCs."""

import sys
from pathlib import Path

import yaml

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIRECTORY))

from vault_layout import VaultLayout  # noqa: E402
from vault_manager import (  # noqa: E402
    BLUEPRINT_VAULT,
    STATIC_AGENT_INDEX_HEADER,
    _append_to_moc_index,
    _check_frontmatter_problems,
    _extract_wikilinks,
    _validate_mocs,
)


def test_extract_wikilinks_ignores_fenced_code_and_inline_code():
    text = (
        "See [[Real Note|alias]] for details.\n"
        "Syntax reminder: `[[path|alias]]` is how links look.\n"
        "```markdown\n"
        "[[Fenced Example]]\n"
        "```\n"
    )

    assert _extract_wikilinks(text) == ["Real Note"]


def test_blueprint_mocs_have_zero_broken_links():
    broken = {
        result["moc"]: result["broken_links"]
        for result in _validate_mocs(BLUEPRINT_VAULT)
        if result["broken_links"]
    }

    assert broken == {}


def test_frontmatter_validator_flags_malformed_yaml(tmp_path: Path):
    bad = tmp_path / "bad.md"
    bad.write_text("---\ntype: [unclosed\n---\n# Bad\n", encoding="utf-8")

    unclosed = tmp_path / "unclosed.md"
    unclosed.write_text("---\ntype: note\n# Missing closing fence\n", encoding="utf-8")

    good = tmp_path / "good.md"
    good.write_text("---\ntype: note\ntags: [ok]\n---\n# Good\n", encoding="utf-8")

    no_frontmatter = tmp_path / "plain.md"
    no_frontmatter.write_text("# Plain Note\n", encoding="utf-8")

    problems = _check_frontmatter_problems(tmp_path, [bad, unclosed, good, no_frontmatter])

    assert any("bad.md" in problem for problem in problems)
    assert any("unclosed.md" in problem for problem in problems)
    assert not any("good.md" in problem for problem in problems)
    assert not any("plain.md" in problem for problem in problems)


def test_append_to_moc_index_inserts_under_header_and_skips_duplicates(tmp_path: Path):
    moc = tmp_path / "Knowledge_Base_MOC.md"
    moc.write_text(
        f"---\ntype: moc\n---\n# Knowledge Base MOC\n\n{STATIC_AGENT_INDEX_HEADER}\n",
        encoding="utf-8",
    )

    first = _append_to_moc_index(moc, "- [[Concept A]] | type: knowledge", "Concept A")
    duplicate = _append_to_moc_index(moc, "- [[Concept A]] | type: knowledge", "Concept A")

    assert first is True
    assert duplicate is False
    content = moc.read_text(encoding="utf-8")
    assert content.count("[[Concept A]]") == 1
    assert f"{STATIC_AGENT_INDEX_HEADER}\n- [[Concept A]] | type: knowledge" in content


def test_append_to_moc_index_creates_section_when_missing(tmp_path: Path):
    moc = tmp_path / "Custom_MOC.md"
    moc.write_text("---\ntype: moc\n---\n# Custom MOC\n", encoding="utf-8")

    added = _append_to_moc_index(moc, "- [[Note B]] - Summary", "Note B")

    assert added is True
    content = moc.read_text(encoding="utf-8")
    assert STATIC_AGENT_INDEX_HEADER in content
    assert "- [[Note B]] - Summary" in content


def test_blueprint_knowledge_base_has_registered_moc():
    layout = VaultLayout.load(BLUEPRINT_VAULT)
    moc_path = layout.moc_for(BLUEPRINT_VAULT / "25_Knowledge_Base" / "example.md")

    assert moc_path == BLUEPRINT_VAULT / "00_MOCs" / "Knowledge_Base_MOC.md"
    assert moc_path.is_file()


def test_distillation_templates_exist_and_have_valid_frontmatter():
    templates_dir = BLUEPRINT_VAULT / "80_Templates"
    for name in ("Troubleshooting_Template.md", "Session_Synthesis_Template.md", "ADR_Template.md"):
        path = templates_dir / name
        assert path.is_file(), f"Missing template: {name}"
        text = path.read_text(encoding="utf-8")
        assert text.startswith("---\n")
        parts = text.split("---\n", 2)
        data = yaml.safe_load(parts[1])
        assert isinstance(data, dict) and "type" in data and "tags" in data
