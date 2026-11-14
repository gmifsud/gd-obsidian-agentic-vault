"""Tests for the Blueprint generator's use of the Vault layout.

The generator is run as a subprocess, as it is in use: importing it would rewrap
stdout on Windows and break pytest's output capture.
"""

import subprocess
import sys
from pathlib import Path

import yaml

BACKEND = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND.parent

sys.path.insert(0, str(BACKEND))

from vault_layout import CONFIG_FILENAME, VaultLayout  # noqa: E402


def run_generator(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(BACKEND / "architect_generator.py"), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def test_generated_vault_inherits_a_layout_it_satisfies(tmp_path):
    target = tmp_path / "NewVault"

    result = run_generator(str(target))

    assert result.returncode == 0, result.stdout + result.stderr
    generated = VaultLayout.load(target)
    assert generated.problems() == []
    assert generated.directories == VaultLayout.load(REPO_ROOT / "vault").directories
    assert (target / "01_Journal" / "Reviews").is_dir()
    config = yaml.safe_load((target / CONFIG_FILENAME).read_text(encoding="utf-8"))
    assert config["generated_by"] == "architect_generator"


def test_generation_refuses_a_blueprint_without_a_layout(tmp_path):
    blueprint = tmp_path / "blueprint"
    blueprint.mkdir()
    target = tmp_path / "NewVault"

    result = run_generator(str(target), "--from-vault", str(blueprint))

    assert result.returncode == 1
    assert "Vault layout missing" in result.stdout
    assert not target.exists()
