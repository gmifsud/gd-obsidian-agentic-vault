"""Heading-chunked SQLite FTS5 and optional vector index for Right Hemisphere notes."""

from __future__ import annotations

import json
import math
import re
import sqlite3
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import yaml

from vault_layout import MOC_DIRECTORY, ZONE_RIGHT, VaultLayout

TEMPLATES_DIRECTORY = "80_Templates"
SKIPPED_RIGHT_DIRECTORIES = frozenset({MOC_DIRECTORY, TEMPLATES_DIRECTORY, "50_Databases", "60_Canvas_Maps"})

_H1_HEADING = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
_H2_SPLIT = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_FTS_TOKEN = re.compile(r"[A-Za-z0-9_]+")

EmbedFn = Callable[[list[str]], list[list[float]]]


@dataclass(frozen=True)
class NoteChunk:
    """One searchable section of a Vault Markdown note."""

    chunk_id: str
    path: str
    directory: str
    title: str
    heading: str
    doc_type: str
    tags: tuple[str, ...]
    content: str


@dataclass(frozen=True)
class SearchHit:
    """One ranked search match returned by ``search_vault_notes``."""

    chunk_id: str
    path: str
    directory: str
    title: str
    heading: str
    doc_type: str
    tags: tuple[str, ...]
    snippet: str
    score: float


def _parse_frontmatter_and_body(raw_text: str) -> tuple[dict, str]:
    normalized = raw_text.replace("\r\n", "\n")
    if not normalized.startswith("---\n"):
        return {}, normalized
    parts = normalized.split("---\n", 2)
    if len(parts) < 3:
        return {}, normalized
    try:
        parsed = yaml.safe_load(parts[1])
    except yaml.YAMLError:
        return {}, parts[2]
    return (parsed if isinstance(parsed, dict) else {}), parts[2]


def _normalize_tags(raw_tags: object) -> tuple[str, ...]:
    if isinstance(raw_tags, list):
        return tuple(str(tag).strip() for tag in raw_tags if str(tag).strip())
    if isinstance(raw_tags, str) and raw_tags.strip():
        return tuple(part.strip() for part in raw_tags.split(",") if part.strip())
    return ()


def chunk_markdown_note(rel_path: str, raw_text: str) -> list[NoteChunk]:
    """Split a Markdown note on ``## `` headings into searchable ``NoteChunk`` records."""
    posix_path = rel_path.replace("\\", "/")
    parts = Path(posix_path).parts
    directory = parts[0] if len(parts) > 1 else ""
    stem = Path(posix_path).stem

    frontmatter, body = _parse_frontmatter_and_body(raw_text)
    h1_match = _H1_HEADING.search(body)
    title = (
        str(
            frontmatter.get("title")
            or frontmatter.get("resource_name")
            or frontmatter.get("workflow_name")
            or frontmatter.get("topic")
            or (h1_match.group(1).strip() if h1_match else stem)
        ).strip()
        or stem
    )
    doc_type = str(frontmatter.get("type") or "note").strip()
    tags = _normalize_tags(frontmatter.get("tags"))

    h2_matches = list(_H2_SPLIT.finditer(body))
    if not h2_matches:
        cleaned = body.strip()
        return [
            NoteChunk(
                chunk_id=f"{posix_path}#0",
                path=posix_path,
                directory=directory,
                title=title,
                heading=title,
                doc_type=doc_type,
                tags=tags,
                content=cleaned,
            )
        ]

    chunks: list[NoteChunk] = []
    for idx, match in enumerate(h2_matches):
        heading = match.group(1).strip()
        start = match.end()
        end = h2_matches[idx + 1].start() if idx + 1 < len(h2_matches) else len(body)
        section_body = body[start:end].strip()
        chunks.append(
            NoteChunk(
                chunk_id=f"{posix_path}#{idx}",
                path=posix_path,
                directory=directory,
                title=title,
                heading=heading,
                doc_type=doc_type,
                tags=tags,
                content=section_body,
            )
        )
    return chunks


def collect_vault_chunks(layout: VaultLayout) -> list[NoteChunk]:
    """Collect ``NoteChunk`` records across all indexable Right Hemisphere directories."""
    chunks: list[NoteChunk] = []
    for directory in layout.directories_in(ZONE_RIGHT):
        if directory in SKIPPED_RIGHT_DIRECTORIES:
            continue
        dir_path = layout.root / directory
        if not dir_path.is_dir():
            continue
        for md_file in sorted(dir_path.rglob("*.md")):
            if md_file.name == "README.md":
                continue
            rel = md_file.relative_to(layout.root)
            if any(part.startswith(".") for part in rel.parts):
                continue
            raw = md_file.read_text(encoding="utf-8")
            chunks.extend(chunk_markdown_note(rel.as_posix(), raw))
    return chunks


def _pack_vector(vector: list[float]) -> bytes:
    return struct.pack(f"<{len(vector)}f", *[float(v) for v in vector])


def _unpack_vector(blob: bytes) -> list[float]:
    count = len(blob) // 4
    return list(struct.unpack(f"<{count}f", blob))


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS note_chunks (
            chunk_id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            directory TEXT NOT NULL,
            title TEXT NOT NULL,
            heading TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            tags TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB
        )
        """
    )
    conn.execute(
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS note_chunks_fts USING fts5(
            chunk_id UNINDEXED,
            title,
            heading,
            content,
            tags
        )
        """
    )


def index_vault_notes(
    db_path: Path | str,
    chunks: list[NoteChunk],
    embed_fn: EmbedFn | None = None,
) -> int:
    """Index ``chunks`` into SQLite FTS5 (and optional embeddings) at ``db_path``."""
    embeddings: list[list[float]] | None = None
    if embed_fn is not None and chunks:
        texts = [f"{c.title}\n{c.heading}\n{c.content}" for c in chunks]
        embeddings = list(embed_fn(texts))

    conn = sqlite3.connect(str(db_path))
    try:
        _ensure_schema(conn)
        conn.execute("DELETE FROM note_chunks")
        conn.execute("DELETE FROM note_chunks_fts")

        for idx, chunk in enumerate(chunks):
            tags_json = json.dumps(list(chunk.tags))
            tags_text = " ".join(chunk.tags)
            emb_blob = (
                _pack_vector(embeddings[idx])
                if embeddings is not None and idx < len(embeddings)
                else None
            )
            conn.execute(
                """
                INSERT INTO note_chunks (
                    chunk_id, path, directory, title, heading, doc_type, tags, content, embedding
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk.chunk_id,
                    chunk.path,
                    chunk.directory,
                    chunk.title,
                    chunk.heading,
                    chunk.doc_type,
                    tags_json,
                    chunk.content,
                    emb_blob,
                ),
            )
            conn.execute(
                """
                INSERT INTO note_chunks_fts (chunk_id, title, heading, content, tags)
                VALUES (?, ?, ?, ?, ?)
                """,
                (chunk.chunk_id, chunk.title, chunk.heading, chunk.content, tags_text),
            )
        conn.commit()
    finally:
        conn.close()
    return len(chunks)


def _build_fts_query(query: str) -> str:
    tokens = _FTS_TOKEN.findall(query)
    if not tokens:
        return ""
    return " OR ".join(f'"{token}"' for token in tokens)


def _matches_filters(
    row_directory: str,
    row_tags: tuple[str, ...],
    directory: str | None,
    tag: str | None,
) -> bool:
    if directory is not None and row_directory != directory:
        return False
    if tag is not None:
        wanted = tag.lower().strip()
        if all(existing.lower() != wanted for existing in row_tags):
            return False
    return True


def search_vault_notes(
    db_path: Path | str,
    query: str,
    directory: str | None = None,
    tag: str | None = None,
    limit: int = 5,
    embed_fn: EmbedFn | None = None,
) -> list[SearchHit]:
    """Search indexed ``NoteChunk`` rows via FTS5 BM25 and optional cosine similarity."""
    if not Path(db_path).is_file():
        return []

    conn = sqlite3.connect(str(db_path))
    try:
        _ensure_schema(conn)
        fts_scores: dict[str, float] = {}
        fts_query = _build_fts_query(query)
        if fts_query:
            cursor = conn.execute(
                """
                SELECT chunk_id, bm25(note_chunks_fts) AS rank
                FROM note_chunks_fts
                WHERE note_chunks_fts MATCH ?
                ORDER BY rank
                """,
                (fts_query,),
            )
            for chunk_id, rank in cursor.fetchall():
                # In SQLite FTS5, bm25() returns negative numbers where more negative is better.
                fts_scores[chunk_id] = max(0.0, -float(rank))

        query_vec: list[float] | None = None
        if embed_fn is not None:
            embedded = list(embed_fn([query]))
            if embedded:
                query_vec = [float(v) for v in embedded[0]]

        rows = conn.execute(
            """
            SELECT chunk_id, path, directory, title, heading, doc_type, tags, content, embedding
            FROM note_chunks
            """
        ).fetchall()

        hits: list[SearchHit] = []
        for chunk_id, path, row_dir, title, heading, doc_type, tags_json, content, emb_blob in rows:
            row_tags = tuple(json.loads(tags_json)) if tags_json else ()
            if not _matches_filters(row_dir, row_tags, directory, tag):
                continue

            lex_score = fts_scores.get(chunk_id, 0.0)
            vec_score = 0.0
            if query_vec is not None and emb_blob is not None:
                vec_score = max(0.0, _cosine_similarity(query_vec, _unpack_vector(emb_blob)))

            if lex_score <= 0.0 and vec_score <= 0.0:
                continue

            combined_score = lex_score + (vec_score * 2.0)
            snippet = content.strip().replace("\n", " ")[:200]
            hits.append(
                SearchHit(
                    chunk_id=chunk_id,
                    path=path,
                    directory=row_dir,
                    title=title,
                    heading=heading,
                    doc_type=doc_type,
                    tags=row_tags,
                    snippet=snippet,
                    score=combined_score,
                )
            )

        hits.sort(key=lambda hit: hit.score, reverse=True)
        return hits[:limit]
    finally:
        conn.close()
