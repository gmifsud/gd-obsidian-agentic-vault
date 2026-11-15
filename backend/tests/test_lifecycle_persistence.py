import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_memory_compact import _make_vault
from query import compact_memory_file


def test_denied_archive_keeps_memory_unchanged(tmp_path):
    layout = _make_vault(tmp_path)
    layout._overrides[('35_Sessions',)] = False
    memory = layout.root / 'MEMORY.md'
    memory.write_text('# Memory\n## 📜 Rolling Log\n' + ''.join(f'- Entry {i}\n' for i in range(7)), encoding='utf-8')
    before = memory.read_bytes()
    with pytest.raises(PermissionError):
        compact_memory_file(layout)
    assert memory.read_bytes() == before


def test_compaction_preserves_multiline_blocks_and_is_idempotent(tmp_path):
    layout = _make_vault(tmp_path)
    memory = layout.root / 'MEMORY.md'
    entry = '- Old\n  Detail\n  ```text\n  - nested code\n  ```\n\n'
    memory.write_text('# Memory\n## 📜 Rolling Log\n' + entry + '- Keep\n  Keep detail\n## Next\nuntouched\n', encoding='utf-8')
    result = compact_memory_file(layout, keep=1)
    assert entry in result.archive_path.read_text(encoding='utf-8')
    assert '- Keep\n  Keep detail\n## Next\nuntouched\n' in memory.read_text(encoding='utf-8')
    before = result.archive_path.read_bytes()
    assert compact_memory_file(layout, keep=1).archived_count == 0
    assert result.archive_path.read_bytes() == before


def test_atomic_writer_detects_human_change(tmp_path):
    from vault_io import atomic_write, fingerprint, WriteConflict
    layout = _make_vault(tmp_path)
    path = layout.root / 'MEMORY.md'
    path.write_text('original', encoding='utf-8')
    expected = fingerprint(path)
    path.write_text('human edit', encoding='utf-8')
    with pytest.raises(WriteConflict):
        atomic_write(layout, path, 'replacement', expected)
    assert path.read_text(encoding='utf-8') == 'human edit'


def test_archive_write_failure_keeps_memory_bytes(tmp_path, monkeypatch):
    import vault_io
    layout = _make_vault(tmp_path)
    memory = layout.root / 'MEMORY.md'
    memory.write_text('# Memory\n## 📜 Rolling Log\n- Old\n  Details\n- Keep\n', encoding='utf-8')
    before = memory.read_bytes()
    def fail(*args, **kwargs):
        raise OSError('Injected archive write failure')
    monkeypatch.setattr(vault_io, 'atomic_write', fail)
    with pytest.raises(OSError, match='archive write'):
        compact_memory_file(layout, keep=1)
    assert memory.read_bytes() == before


def test_hidden_override_and_escaping_link_cannot_write(tmp_path):
    from vault_io import atomic_write
    layout = _make_vault(tmp_path)
    outside = tmp_path / 'outside'
    outside.mkdir()
    secret = outside / 'preserve.md'
    secret.write_text('Preserve', encoding='utf-8')
    for relative in ('35_Sessions/.hidden/note.md', '../outside/preserve.md'):
        with pytest.raises(PermissionError):
            atomic_write(layout, layout.root / relative, 'Changed', None)
    link = layout.root / '35_Sessions' / 'escape'
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f'Native symlink creation unavailable: {exc}')
    with pytest.raises(PermissionError):
        atomic_write(layout, link / 'preserve.md', 'Changed', None)
    assert secret.read_text(encoding='utf-8') == 'Preserve'
