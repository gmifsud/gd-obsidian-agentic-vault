"""Checks on the repository-level files that agents load before working here."""

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BOOTLOADERS = ("CLAUDE.md", "GEMINI.md", "AGENTS.md")
TEMPLATE_PLACEHOLDERS = ("<fill in>", "<build>", "<test>", "<run>", "@src/index.ts")
REQUIRED_REFERENCES = (
    "vault/vault.config.yaml",
    "CONTEXT.md",
    "backend/vault_manager.py",
    "backend/query.py",
    "frontend/server.js",
)


@pytest.mark.parametrize("name", BOOTLOADERS)
def test_bootloader_has_no_template_placeholders(name):
    text = (REPO_ROOT / name).read_text(encoding="utf-8")
    left = [p for p in TEMPLATE_PLACEHOLDERS if p in text]
    assert left == [], f"{name} still contains template placeholders: {left}"


@pytest.mark.parametrize("name", BOOTLOADERS)
def test_bootloader_points_at_the_real_files(name):
    text = (REPO_ROOT / name).read_text(encoding="utf-8")
    missing = [ref for ref in REQUIRED_REFERENCES if ref not in text]
    assert missing == [], f"{name} does not reference: {missing}"
