"""Local vault identity, serialised Engine operations and optimistic atomic writes."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import os
from pathlib import Path
import threading

from vault_layout import VaultLayout

CACHE_ROOT = Path(__file__).resolve().parent / 'runtime-cache'
_locks: dict[str, threading.RLock] = {}
_state = threading.local()


class WriteConflict(ValueError):
    """The caller must preview the current revision before replacing it."""


def digest(data: bytes | str) -> str:
    return hashlib.sha256(data.encode('utf-8') if isinstance(data, str) else data).hexdigest()


def vault_identity(layout: VaultLayout) -> str:
    return os.path.normcase(str(layout.root.resolve()))


def cache_directory(layout: VaultLayout) -> Path:
    return CACHE_ROOT / digest(vault_identity(layout))


@contextmanager
def vault_lock(layout: VaultLayout):
    """Reentrant within one thread, OS-locked across Engine processes; bounded wait."""
    key = vault_identity(layout)
    lock = _locks.setdefault(key, threading.RLock())
    with lock:
        held = getattr(_state, 'held', set())
        if key in held:
            yield
            return
        directory = cache_directory(layout)
        directory.mkdir(parents=True, exist_ok=True)
        with (directory / 'engine.lock').open('a+b') as handle:
            handle.seek(0, 2)
            if handle.tell() == 0:
                handle.write(b'0')
                handle.flush()
            handle.seek(0)
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX)
            _state.held = held | {key}
            try:
                yield
            finally:
                _state.held = held
                handle.seek(0)
                if os.name == 'nt':
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(handle, fcntl.LOCK_UN)


def verify_layout(layout: VaultLayout) -> None:
    loaded = getattr(layout, 'config_revision', None)
    if loaded and fingerprint(layout.root / 'vault.config.yaml') != loaded:
        raise WriteConflict('Vault policy changed; reload the layout before continuing')


def staging_path(layout: VaultLayout, path: Path) -> Path:
    name = path.name + '.stage.tmp'
    stage = path.with_name(name)
    if path.parent == layout.root:
        stage = next((layout.root / d / name for d in layout.directories
                      if layout.may_agent_write(layout.root / d / name).allowed), stage)
    return stage


def preflight(layout: VaultLayout, paths) -> None:
    verify_layout(layout)
    for path in paths:
        stage = staging_path(layout, path)
        for destination in (path, stage):
            verdict = layout.may_agent_write(destination)
            if not verdict.allowed:
                raise PermissionError(f'{destination}: {verdict.reason}')
        if stage.exists() or stage.is_symlink():
            raise WriteConflict(f'Staging file already exists; inspect before retrying: {stage}')


def fingerprint(path: Path) -> str | None:
    return digest(path.read_bytes()) if path.is_file() else None


def atomic_write(layout: VaultLayout, path: Path, text: str, expected: str | None) -> None:
    """Replace one file, refusing stale callers; no claim of multi-file atomicity."""
    stage = staging_path(layout, path)
    preflight(layout, [path])
    if fingerprint(path) != expected:
        raise WriteConflict(f'Content changed: {path}')
    path.parent.mkdir(parents=True, exist_ok=True)
    stage.parent.mkdir(parents=True, exist_ok=True)
    created = False
    try:
        with stage.open('x', encoding='utf-8', newline='') as handle:
            created = True
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        verify_layout(layout)
        for destination in (path, stage):
            verdict = layout.may_agent_write(destination)
            if not verdict.allowed:
                raise PermissionError(f'{destination}: {verdict.reason}')
        if fingerprint(path) != expected:
            raise WriteConflict(f'Content changed: {path}')
        os.replace(stage, path)
    finally:
        if created and stage.exists():
            stage.unlink()


def moc_text(existing: str, target: str, title: str) -> str:
    link = f'[[{target}]]'
    if link in existing:
        return existing
    header = '## Static Agent Index'
    entry = f'- {link} | topic: {title.replace(chr(10), " ").replace("|", "/")}\n'
    if header in existing:
        return existing.replace(header, header + '\n' + entry, 1)
    return existing.rstrip() + '\n\n' + header + '\n' + entry
