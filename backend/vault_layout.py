"""Vault layout: the single description of a Vault's directories.

A Vault carries its layout in ``vault.config.yaml`` at its root. This module reads
that file and answers every question the Engine has about the Vault's structure:
which Zone a path is in, whether an agent may write to it, which MOC indexes it,
and whether the Vault on disk matches what the layout says.

There is no built-in default layout. A Vault without a valid layout is an error.
Terms (Zone, Unmanaged directory, System file, ...) are defined in CONTEXT.md.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import yaml

CONFIG_FILENAME = "vault.config.yaml"
LAYOUT_KEY = "layout"
VAULT_PATH_ENV = "VAULT_PATH"
MOC_DIRECTORY = "00_MOCs"

ZONE_LEFT = "left"
ZONE_RIGHT = "right"
ZONE_ASSETS = "assets"
ZONES = (ZONE_LEFT, ZONE_RIGHT, ZONE_ASSETS)

# Classifications for paths that are not inside a Zone.
ZONE_SYSTEM = "system"
ZONE_UNMANAGED = "unmanaged"
ZONE_UNDECLARED = "undeclared"

# How each Zone is named in the prose files that agents read.
ZONE_PROSE_MARKERS = {
    ZONE_LEFT: "Left Hemisphere",
    ZONE_RIGHT: "Right Hemisphere",
    ZONE_ASSETS: "Assets Zone",
}

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_VAULT_ROOT = _REPO_ROOT / "vault"
# The Control Panel resolves a relative VAULT_PATH against frontend/; the Engine must agree.
_RELATIVE_VAULT_PATH_BASE = _REPO_ROOT / "frontend"

# A backticked top-level directory in prose, e.g. `01_Journal/` or `vault/01_Journal/`.
_PROSE_DIRECTORY = re.compile(r"`(?:vault/)?(\d{2}_[A-Za-z0-9_]+)/`")


class VaultLayoutError(Exception):
    """The Vault has no layout, or the layout is invalid."""


@dataclass(frozen=True)
class WriteDecision:
    """The answer to "may an agent write this path?", with the reason."""

    allowed: bool
    reason: str

    def __bool__(self) -> bool:
        return self.allowed


@dataclass(frozen=True)
class _Directory:
    zone: str
    agent_writable: bool
    moc: str | None


def resolve_vault_root(env: Mapping[str, str] | None = None) -> Path:
    """Return the Vault the Engine acts on: VAULT_PATH if set, else the repo's vault/."""
    env = os.environ if env is None else env
    configured = (env.get(VAULT_PATH_ENV) or "").strip()
    if not configured:
        return _DEFAULT_VAULT_ROOT
    path = Path(configured)
    if not path.is_absolute():
        path = _RELATIVE_VAULT_PATH_BASE / path
    return path.resolve()


def load_engine_vault() -> "VaultLayout":
    """Load the layout of the Vault the Engine acts on.

    Reads the same .env files as the Control Panel (repo root first, then frontend/),
    so both follow the same VAULT_PATH. Raises VaultLayoutError if the layout is
    missing or invalid.
    """
    from dotenv import load_dotenv

    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / "frontend" / ".env")
    return VaultLayout.load(resolve_vault_root())


class VaultLayout:
    """The layout of one Vault. Build with :meth:`load`."""

    def __init__(self, root: Path, raw_layout: dict):
        self.root = Path(root).resolve()
        self.raw = raw_layout
        self._directories: dict[str, _Directory] = {
            name: _Directory(spec["zone"], spec["agent_writable"], spec["moc"])
            for name, spec in raw_layout["directories"].items()
        }
        self._overrides: dict[tuple[str, ...], bool] = {
            tuple(path.split("/")): spec["agent_writable"]
            for path, spec in raw_layout["overrides"].items()
        }
        self.unmanaged: tuple[str, ...] = tuple(raw_layout["unmanaged"])
        system_files = raw_layout["system_files"]
        self._required_files: dict[str, bool] = {
            name: spec["agent_writable"] for name, spec in system_files["required"].items()
        }
        self._optional_files: dict[str, bool] = {
            name: spec["agent_writable"] for name, spec in system_files["optional"].items()
        }

    # ------------------------------------------------------------------ loading

    @classmethod
    def load(cls, vault_root: Path | str) -> "VaultLayout":
        """Read and validate the layout of the Vault at ``vault_root``."""
        root = Path(vault_root)
        config_path = root / CONFIG_FILENAME
        if not root.is_dir():
            raise VaultLayoutError(f"Vault not found: {root}")
        if not config_path.is_file():
            raise VaultLayoutError(
                f"Vault layout missing: {config_path} does not exist. "
                f"Copy the '{LAYOUT_KEY}' section from the Blueprint's {CONFIG_FILENAME} and adjust it."
            )
        try:
            config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise VaultLayoutError(f"Vault layout unreadable: {config_path} is not valid YAML: {exc}") from exc
        if not isinstance(config, dict) or LAYOUT_KEY not in config:
            raise VaultLayoutError(
                f"Vault layout missing: {config_path} has no '{LAYOUT_KEY}' section. "
                f"Copy it from the Blueprint's {CONFIG_FILENAME} and adjust it."
            )
        raw = config[LAYOUT_KEY]
        problems = _shape_problems(raw)
        if problems:
            listed = "\n".join(f"  - {p}" for p in problems)
            raise VaultLayoutError(f"Vault layout invalid: {config_path}\n{listed}")
        # 'overrides' and 'unmanaged' may be omitted or left empty.
        raw = {**raw, "overrides": raw.get("overrides") or {}, "unmanaged": raw.get("unmanaged") or []}
        return cls(root, raw)

    # ------------------------------------------------------------------ facts

    @property
    def directories(self) -> tuple[str, ...]:
        """Every declared top-level directory."""
        return tuple(self._directories)

    def directories_in(self, zone: str) -> tuple[str, ...]:
        return tuple(name for name, d in self._directories.items() if d.zone == zone)

    @property
    def override_paths(self) -> tuple[str, ...]:
        """Subdirectories with their own write permission, e.g. ``01_Journal/Reviews``."""
        return tuple("/".join(parts) for parts in self._overrides)

    @property
    def required_system_files(self) -> tuple[str, ...]:
        return tuple(self._required_files)

    @property
    def optional_root_files(self) -> tuple[str, ...]:
        return tuple(self._optional_files)

    # ------------------------------------------------------------------ questions

    def zone_of(self, path: Path | str) -> str:
        """Classify a path: a Zone, or ``system`` / ``unmanaged`` / ``undeclared``."""
        parts = self._relative_parts(path)
        if parts is None or not parts:
            return ZONE_UNDECLARED
        top = parts[0]
        if top in self._directories:
            return self._directories[top].zone
        if top in self.unmanaged:
            return ZONE_UNMANAGED
        if len(parts) == 1 and (top in self._required_files or top in self._optional_files):
            return ZONE_SYSTEM
        return ZONE_UNDECLARED

    def may_agent_write(self, path: Path | str) -> WriteDecision:
        """Say whether an agent may write ``path`` (absolute, or relative to the Vault root)."""
        parts = self._relative_parts(path)
        if parts is None:
            return WriteDecision(False, f"path resolves outside the Vault ({self.root})")
        if not parts:
            return WriteDecision(False, "the Vault root itself is not a writable path")
        top = parts[0]
        hidden = next((part for part in parts if part.startswith(".")), None)
        if hidden is not None:
            return WriteDecision(False, f"'{hidden}' is a dot-directory or dot-file, which the Engine never writes to")
        if top in self.unmanaged:
            return WriteDecision(False, f"'{top}' is an unmanaged directory owned by another tool")
        if top in self._directories:
            return self._directory_decision(parts)
        if len(parts) == 1:
            writable = {**self._optional_files, **self._required_files}.get(top)
            if writable is True:
                return WriteDecision(True, f"'{top}' is an agent-writable system file")
            if writable is False:
                return WriteDecision(False, f"'{top}' is read-only to agents")
            return WriteDecision(False, f"'{top}' is not declared in the Vault layout")
        return WriteDecision(False, f"'{top}' is not a directory declared in the Vault layout")

    def moc_for(self, path: Path | str) -> Path | None:
        """Return the MOC file that indexes ``path``, or None if its directory is not indexed."""
        parts = self._relative_parts(path)
        if not parts or parts[0] not in self._directories:
            return None
        moc = self._directories[parts[0]].moc
        return self.root / MOC_DIRECTORY / moc if moc else None

    # ------------------------------------------------------------------ checks

    def problems(self) -> list[str]:
        """Compare the Vault on disk with the layout. An empty list means they agree."""
        found: list[str] = []
        for name in self.directories:
            if not (self.root / name).is_dir():
                found.append(f"Missing declared directory: {name}/")
        # Override paths are permissions, not required directories: they may not exist yet.
        for name in self.required_system_files:
            if not (self.root / name).is_file():
                found.append(f"Missing system file: {name}")
        allowed_root = set(self._required_files) | set(self._optional_files)
        for entry in sorted(self.root.iterdir(), key=lambda p: p.name):
            if entry.name.startswith("."):
                continue
            if entry.is_dir():
                if entry.name not in self._directories and entry.name not in self.unmanaged:
                    found.append(f"Undeclared directory: {entry.name}/ (declare it, list it as unmanaged, or remove it)")
            elif entry.suffix == ".md" and entry.name not in allowed_root:
                found.append(f"Unexpected file at vault root: {entry.name}")
        for name, directory in self._directories.items():
            if directory.moc and not (self.root / MOC_DIRECTORY / directory.moc).is_file():
                found.append(f"MOC named for {name}/ does not exist: {MOC_DIRECTORY}/{directory.moc}")
        return found

    def prose_problems(self, prose_file: Path | str) -> list[str]:
        """Check the directory lists in a prose file (e.g. SOUL.md) against the layout.

        A directory counts as listed under a Zone when it appears in backticks on, or
        below, a line naming that Zone ("Left Hemisphere", "Right Hemisphere",
        "Assets Zone"). A heading that names no Zone ends the list.
        """
        prose_file = Path(prose_file)
        label = prose_file.name
        listed: dict[str, set[str]] = {zone: set() for zone in ZONES}
        mentioned: set[str] = set()
        current: str | None = None
        for line in prose_file.read_text(encoding="utf-8").splitlines():
            named = next((z for z, marker in ZONE_PROSE_MARKERS.items() if marker in line), None)
            if named:
                current = named
            elif line.lstrip().startswith("#"):
                current = None
            for directory in _PROSE_DIRECTORY.findall(line):
                mentioned.add(directory)
                if current:
                    listed[current].add(directory)

        found: list[str] = []
        for directory in sorted(mentioned - set(self._directories)):
            found.append(f"{label} mentions {directory}/, which the Vault layout does not declare")
        for zone in ZONES:
            marker = ZONE_PROSE_MARKERS[zone]
            expected = set(self.directories_in(zone))
            for directory in sorted(expected - listed[zone]):
                found.append(f"{label} does not list {directory}/ under {marker}")
            for directory in sorted((listed[zone] - expected) & set(self._directories)):
                actual = ZONE_PROSE_MARKERS[self._directories[directory].zone]
                found.append(f"{label} lists {directory}/ under {marker}, but the layout puts it in {actual}")
        return found

    # ------------------------------------------------------------------ internals

    def _relative_parts(self, path: Path | str) -> tuple[str, ...] | None:
        """Path segments relative to the Vault root, or None if the path escapes the Vault."""
        candidate = Path(path)
        if not candidate.is_absolute():
            candidate = self.root / candidate
        resolved = candidate.resolve()
        try:
            return resolved.relative_to(self.root).parts
        except ValueError:
            return None

    def _directory_decision(self, parts: tuple[str, ...]) -> WriteDecision:
        top = parts[0]
        best: tuple[str, ...] | None = None
        for override in self._overrides:
            if parts[: len(override)] == override and (best is None or len(override) > len(best)):
                best = override
        if best is not None:
            where = "/".join(best)
            if self._overrides[best]:
                return WriteDecision(True, f"'{where}' is agent-writable")
            return WriteDecision(False, f"'{where}' is read-only to agents")
        if self._directories[top].agent_writable:
            return WriteDecision(True, f"'{top}' is agent-writable")
        return WriteDecision(False, f"'{top}' is read-only to agents")


def _shape_problems(raw: object) -> list[str]:
    """Describe everything wrong with the shape of a layout section."""
    if not isinstance(raw, dict):
        return [f"'{LAYOUT_KEY}' must be a mapping"]
    problems: list[str] = []

    directories = raw.get("directories")
    if not isinstance(directories, dict) or not directories:
        problems.append("'directories' must be a non-empty mapping")
        directories = {}
    for name, spec in directories.items():
        where = f"directories.{name}"
        if not isinstance(name, str) or "/" in name or "\\" in name:
            problems.append(f"{where}: must be a top-level directory name")
        if not isinstance(spec, dict):
            problems.append(f"{where}: must be a mapping with zone, agent_writable and moc")
            continue
        if spec.get("zone") not in ZONES:
            problems.append(f"{where}: zone must be one of {', '.join(ZONES)}")
        if not isinstance(spec.get("agent_writable"), bool):
            problems.append(f"{where}: agent_writable must be true or false")
        if "moc" not in spec:
            problems.append(f"{where}: moc must be stated (a MOC filename, or null for 'not indexed')")
        elif spec["moc"] is not None and not isinstance(spec["moc"], str):
            problems.append(f"{where}: moc must be a MOC filename or null")

    overrides = raw.get("overrides") or {}
    if not isinstance(overrides, dict):
        problems.append("'overrides' must be a mapping")
        overrides = {}
    for path, spec in overrides.items():
        where = f"overrides.{path}"
        segments = str(path).split("/")
        if len(segments) < 2 or any(s in ("", ".", "..") for s in segments):
            problems.append(f"{where}: must be a subdirectory path such as 01_Journal/Reviews")
        elif segments[0] not in directories:
            problems.append(f"{where}: parent directory {segments[0]} is not declared")
        if not isinstance(spec, dict) or not isinstance(spec.get("agent_writable"), bool):
            problems.append(f"{where}: agent_writable must be true or false")

    unmanaged = raw.get("unmanaged") or []
    if not isinstance(unmanaged, list) or not all(isinstance(u, str) for u in unmanaged):
        problems.append("'unmanaged' must be a list of directory names")
    else:
        for name in unmanaged:
            if name in directories:
                problems.append(f"unmanaged.{name}: also declared under directories")

    system_files = raw.get("system_files")
    if not isinstance(system_files, dict):
        problems.append("'system_files' must be a mapping with required and optional")
        system_files = {}
    for group in ("required", "optional"):
        files = system_files.get(group)
        if not isinstance(files, dict):
            problems.append(f"system_files.{group} must be a mapping")
            continue
        for name, spec in files.items():
            if not isinstance(spec, dict) or not isinstance(spec.get("agent_writable"), bool):
                problems.append(f"system_files.{group}.{name}: agent_writable must be true or false")
    return problems
