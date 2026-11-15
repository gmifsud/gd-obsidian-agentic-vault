"""Tests for heading-chunked FTS5 and optional vector search across the Right Hemisphere."""

import sys
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIRECTORY))

from knowledge_index import (  # noqa: E402
    NoteChunk,
    SearchHit,
    chunk_markdown_note,
    collect_vault_chunks,
    index_vault_notes,
    search_vault_notes,
)
from vault_layout import VaultLayout  # noqa: E402

REPO_ROOT = BACKEND_DIRECTORY.parent
BLUEPRINT_VAULT = REPO_ROOT / "vault"

SAMPLE_NOTE = """---
type: git_resource
resource_name: "GitKraken Hooks Troubleshooting"
tags: [git, gitkraken, hooks, husky]
---
# GitKraken Hooks Troubleshooting

## Problem
GitKraken Desktop fails to run Husky pre-commit hooks when Node is installed via fnm or nvm.

## Root Cause
GUI apps on Windows do not inherit the interactive shell PATH where fnm injects the Node binary.

## Solution
Add a `~/.huskyrc` file that exports the fnm Node path before the hook runs.
"""


def test_chunk_markdown_note_splits_h2_sections_and_extracts_frontmatter():
    chunks = chunk_markdown_note("30_Git/Git - GitKraken Hooks Troubleshooting.md", SAMPLE_NOTE)

    assert len(chunks) == 3
    assert all(isinstance(chunk, NoteChunk) for chunk in chunks)
    assert [chunk.heading for chunk in chunks] == ["Problem", "Root Cause", "Solution"]
    assert chunks[0].directory == "30_Git"
    assert chunks[0].doc_type == "git_resource"
    assert "husky" in chunks[0].tags


def test_chunk_markdown_note_falls_back_to_single_chunk_without_h2():
    raw = "---\ntype: note\ntags: [memo]\n---\n# Quick Memo\n\nSingle body paragraph.\n"
    chunks = chunk_markdown_note("25_Knowledge_Base/Quick Memo.md", raw)

    assert len(chunks) == 1
    assert chunks[0].heading == "Quick Memo"
    assert "Single body paragraph." in chunks[0].content


def test_fts5_search_finds_chunk_with_directory_and_tag_filter(tmp_path: Path):
    db_path = tmp_path / "index.db"
    chunks = chunk_markdown_note("30_Git/Git - GitKraken Hooks Troubleshooting.md", SAMPLE_NOTE)
    other = chunk_markdown_note(
        "20_DevOps/Pipe - CI.md",
        "---\ntype: devops_resource\ntags: [ci]\n---\n# CI\n\n## Problem\nHusky pre-commit cache miss.\n",
    )
    index_vault_notes(db_path, chunks + other)

    hits = search_vault_notes(db_path, "Husky pre-commit", directory="30_Git", tag="husky", limit=3)

    assert len(hits) >= 1
    assert isinstance(hits[0], SearchHit)
    assert hits[0].path == "30_Git/Git - GitKraken Hooks Troubleshooting.md"
    assert hits[0].heading == "Problem"


def test_hybrid_search_accepts_optional_embedding_function(tmp_path: Path):
    db_path = tmp_path / "hybrid.db"
    chunks = chunk_markdown_note("30_Git/Git - GitKraken Hooks Troubleshooting.md", SAMPLE_NOTE)

    def fake_embed(texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            lowered = text.lower()
            vectors.append([
                1.0 if "huskyrc" in lowered or "solution" in lowered else 0.1,
                1.0 if "fnm" in lowered else 0.1,
            ])
        return vectors

    index_vault_notes(db_path, chunks, embed_fn=fake_embed)
    hits = search_vault_notes(db_path, "huskyrc export", limit=2, embed_fn=fake_embed)

    assert len(hits) >= 1
    assert hits[0].heading == "Solution"


def test_collect_right_hemisphere_chunks_indexes_blueprint_vault(tmp_path: Path):
    layout = VaultLayout.load(BLUEPRINT_VAULT)
    chunks = collect_vault_chunks(layout)

    assert len(chunks) > 0
    directories = {chunk.directory for chunk in chunks}
    assert "20_DevOps" in directories
    assert "30_Git" in directories

    db_path = tmp_path / "blueprint.db"
    index_vault_notes(db_path, chunks)
    hits = search_vault_notes(db_path, "Kubernetes", directory="20_DevOps", limit=3)

    assert any("Infra - Kubernetes Cluster" in hit.path for hit in hits)
