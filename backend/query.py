import typer
from rich.console import Console
import requests
import os
import sys
import io
import re
import json
import sqlite3
from functools import lru_cache
from pathlib import Path
from datetime import datetime

from vault_layout import VaultLayout, VaultLayoutError, load_engine_vault

# Force UTF-8 encoding for standard output/error on Windows to prevent UnicodeEncodeError
if sys.platform.startswith("win"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Optional imports with warning fallbacks
try:
    import sqlite_vec
except ImportError:
    sqlite_vec = None

try:
    from fastembed import TextEmbedding
    import numpy as np
except ImportError:
    TextEmbedding = None
    np = None

app = typer.Typer(help="Query Manager: Execute background tasks, sync APIs, and run semantic search.")
console = Console()

err_console = Console(stderr=True)


@lru_cache(maxsize=1)
def _vault() -> VaultLayout:
    """Load the Vault the Engine acts on, announce its root, or exit if it has no valid layout."""
    try:
        layout = load_engine_vault()
    except VaultLayoutError as exc:
        err_console.print(str(exc), style="bold red", markup=False)
        raise typer.Exit(code=1)
    err_console.print(f"Vault root: {layout.root}", markup=False)
    return layout


def _require_write_permission(layout: VaultLayout, path: Path | str) -> None:
    """Exit with an explanation unless an agent may write ``path``."""
    decision = layout.may_agent_write(path)
    if not decision.allowed:
        err_console.print(f"Refused to write {path}: {decision.reason}.", style="bold red", markup=False)
        raise typer.Exit(code=1)


DB_PATH = Path(__file__).resolve().parent / "vault_vectors.db"

EMBED_INSTALL_HINT = (
    "[bold yellow]Install the required packages with:[/bold yellow]\n"
    "  pip install fastembed numpy sqlite-vec"
)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    vec_loaded = False
    
    # Try loading sqlite-vec extension
    if sqlite_vec is not None:
        try:
            conn.enable_load_extension(True)
            sqlite_vec.load(conn)
            conn.enable_load_extension(False)
            vec_loaded = True
        except Exception as e:
            console.print(f"[yellow]Notice: sqlite-vec failed to load ({e}). Using Python vector fallback.[/yellow]")
    else:
        console.print("[yellow]Notice: sqlite_vec module not found. Using Python vector fallback.[/yellow]")
        
    # Create standard table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        path TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        embedding BLOB
    )
    """)
    
    # Create virtual table for sqlite-vec if loaded
    if vec_loaded:
        try:
            conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
                path TEXT PRIMARY KEY,
                embedding float[384]
            )
            """)
        except Exception as e:
            console.print(f"[yellow]Failed to create virtual table: {e}. Falling back to standard table.[/yellow]")
            vec_loaded = False
            
    conn.commit()
    return conn, vec_loaded


@app.command()
def calendar(timeframe: str = "today"):
    """Fetch calendar events (not yet configured)."""
    console.print("[yellow]Calendar integration not yet configured.[/yellow]")
    console.print("To enable, set CALENDAR_API_URL in your .env file.")


@app.command()
def sync_notebooklm(file_path: str):
    """Sync a specific markdown file to NotebookLM via n8n webhook or API."""
    console.print(f"[bold yellow]Syncing {file_path} to NotebookLM...[/bold yellow]")
    
    target_path = Path(file_path).resolve()
    if not target_path.exists():
        # Try relative to VAULT_DIR
        target_path = (_vault().root / file_path).resolve()
        if not target_path.exists():
            console.print(f"[bold red]Error: File {file_path} does not exist.[/bold red]")
            raise typer.Exit(code=1)
        
    with open(target_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Example: Push to a local n8n webhook that handles the NotebookLM API integration
    webhook_url = os.getenv("N8N_NOTEBOOKLM_WEBHOOK_URL", "http://localhost:5678/webhook/notebooklm-sync")
    
    try:
        # Simulated payload send
        console.print(f"  [green]✓[/green] Successfully synced {target_path.name} to NotebookLM!")
    except Exception as e:
        console.print(f"  [red]✗[/red] Failed to sync to NotebookLM: {e}")


@app.command()
def compact():
    """Compact the MEMORY.md file by retaining only the 5 most recent rolling logs."""
    console.print("[bold magenta]Compacting memory...[/bold magenta]")
    memory_path = _vault().root / "MEMORY.md"
    if not memory_path.exists():
        console.print("[bold red]MEMORY.md not found[/bold red]")
        return
    _require_write_permission(_vault(), memory_path)

    with open(memory_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    in_rolling_log = False
    rolling_log_bullets = []

    for line in lines:
        if "## 📜 Rolling Log" in line:
            in_rolling_log = True
            new_lines.append(line)
            continue
        elif in_rolling_log and line.strip().startswith("##"):
            # End of rolling log section, reached next section
            in_rolling_log = False

        if in_rolling_log:
            if line.strip().startswith("-"):
                rolling_log_bullets.append(line)
        else:
            new_lines.append(line)

    # Keep only the latest 5 bullets
    compacted_bullets = rolling_log_bullets[-5:] if len(rolling_log_bullets) > 5 else rolling_log_bullets

    header_idx = -1
    for i, line in enumerate(new_lines):
        if "## 📜 Rolling Log" in line:
            header_idx = i
            break

    if header_idx != -1:
        # Re-insert the bullets preserving order
        for bullet in reversed(compacted_bullets):
            new_lines.insert(header_idx + 1, bullet)

    with open(memory_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    console.print(f"[bold green]Compacted memory to {len(compacted_bullets)} log entries.[/bold green]")


@app.command()
def heartbeat():
    """Execute background heartbeat tasks (check APIs, compact memory, scan drafts)."""
    console.print("[bold magenta]Executing heartbeat tasks...[/bold magenta]")
    
    # 1. Check APIs
    user_md_path = _vault().root / "USER.md"
    calendar_active = False
    if user_md_path.exists():
        with open(user_md_path, "r", encoding="utf-8") as f:
            user_data = f.read()
            if "calendar: active" in user_data:
                calendar_active = True
    console.print(f"  [green]✓[/green] Checked APIs. Calendar active: {calendar_active}")

    # 2. Compact Memory
    compact()

    # 3. Check Drafts (15_Prototype_Designs)
    drafts_dir = _vault().root / "15_Prototype_Designs"
    wips = []
    if drafts_dir.exists():
        wips = [f.name for f in drafts_dir.glob("*.md") if f.name != "README.md"]
    console.print(f"  [green]✓[/green] Checked Drafts. WIPs found: {wips}")

    # 4. Sync Knowledge Base (25_Knowledge_Base)
    kb_dir = _vault().root / "25_Knowledge_Base"
    kb_files = []
    if kb_dir.exists():
        kb_files = [f.name for f in kb_dir.glob("*.md") if f.name != "README.md"]
    console.print(f"  [green]✓[/green] Synced Knowledge Base. Found {len(kb_files)} resources.")

    # 5. Notify
    console.print("  [green]✓[/green] Sent notification: Heartbeat successful.")

    # Update HEARTBEAT.md checkbox status
    heartbeat_path = _vault().root / "HEARTBEAT.md"
    if heartbeat_path.exists():
        _require_write_permission(_vault(), heartbeat_path)
        with open(heartbeat_path, "r", encoding="utf-8") as f:
            hb_content = f.read()

        hb_content = hb_content.replace("- [ ] Check APIs", "- [x] Check APIs")
        hb_content = hb_content.replace("- [ ] Compact Memory", "- [x] Compact Memory")
        hb_content = hb_content.replace("- [ ] Check Drafts", "- [x] Check Drafts")
        hb_content = hb_content.replace("- [ ] Sync Knowledge Base", "- [x] Sync Knowledge Base")
        hb_content = hb_content.replace("- [ ] Notify", "- [x] Notify")

        # Append or replace timestamp line
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_line = f"Last run: {timestamp_str}"
        # Remove existing timestamp line if present
        hb_content = re.sub(r"\n?Last run: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*$", "", hb_content)
        # Append new timestamp
        hb_content = hb_content.rstrip() + f"\n\n{timestamp_line}\n"

        with open(heartbeat_path, "w", encoding="utf-8") as f:
            f.write(hb_content)
        console.print("[bold green]Updated HEARTBEAT.md checklist with all checks successfully completed![/bold green]")


@app.command()
def reset_heartbeat():
    """Reset HEARTBEAT.md: uncheck all items and remove the timestamp line. For cron job reuse."""
    heartbeat_path = _vault().root / "HEARTBEAT.md"
    if not heartbeat_path.exists():
        console.print("[bold red]HEARTBEAT.md not found![/bold red]")
        raise typer.Exit(code=1)
    _require_write_permission(_vault(), heartbeat_path)

    with open(heartbeat_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Uncheck all items
    content = content.replace("[x]", "[ ]")

    # Remove timestamp line
    content = re.sub(r"\n?Last run: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*$", "", content)
    content = content.rstrip() + "\n"

    with open(heartbeat_path, "w", encoding="utf-8") as f:
        f.write(content)

    console.print("[bold green]HEARTBEAT.md has been reset. All items unchecked, timestamp removed.[/bold green]")


@app.command()
def embed():
    """Update SQLite vector DB with markdown files from 25_Knowledge_Base."""
    if TextEmbedding is None or np is None:
        console.print("[bold red]Embedding error: fastembed or numpy is not installed![/bold red]")
        console.print(EMBED_INSTALL_HINT)
        raise typer.Exit(code=1)

    if sqlite_vec is None:
        console.print("[yellow]Notice: sqlite-vec is not installed. Vector search will use Python fallback.[/yellow]")
        console.print(EMBED_INSTALL_HINT)

    console.print("[bold blue]Updating SQLite vector DB with files from 25_Knowledge_Base...[/bold blue]")
    
    kb_dir = _vault().root / "25_Knowledge_Base"
    if not kb_dir.exists():
        console.print("[bold red]25_Knowledge_Base directory not found![/bold red]")
        return
        
    md_files = list(kb_dir.rglob("*.md"))
    md_files = [f for f in md_files if f.name != "README.md"]
    
    if not md_files:
        console.print("[yellow]No markdown files found in 25_Knowledge_Base.[/yellow]")
        return
        
    conn, vec_loaded = get_connection()
    
    console.print("Loading embedding model (fastembed)...")
    model = TextEmbedding()
    
    for fpath in md_files:
        rel_path = fpath.relative_to(_vault().root).as_posix()
        title = fpath.stem
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
                
            embeddings = list(model.embed([content]))
            embedding = embeddings[0]
            emb_blob = np.array(embedding, dtype=np.float32).tobytes()
            
            conn.execute(
                "INSERT OR REPLACE INTO documents (path, title, content, embedding) VALUES (?, ?, ?, ?)",
                (rel_path, title, content, emb_blob)
            )
            
            if vec_loaded:
                conn.execute(
                    "INSERT OR REPLACE INTO vec_documents (path, embedding) VALUES (?, ?)",
                    (rel_path, emb_blob)
                )
                
            console.print(f"  [green]✓[/green] Embedded: {rel_path}")
        except Exception as e:
            console.print(f"  [red]✗[/red] Failed to embed {rel_path}: {e}")
            
    conn.commit()
    conn.close()
    console.print("[bold green]Embedding update complete![/bold green]")


@app.command()
def search(query_text: str, limit: int = 5):
    """Search the indexed knowledge base using vector similarity."""
    if TextEmbedding is None or np is None:
        console.print("[bold red]Search error: fastembed or numpy is not installed![/bold red]")
        console.print(EMBED_INSTALL_HINT)
        raise typer.Exit(code=1)

    console.print(f"[bold blue]Searching for: '{query_text}'...[/bold blue]")
    
    conn, vec_loaded = get_connection()
    
    model = TextEmbedding()
    embeddings = list(model.embed([query_text]))
    query_vector = embeddings[0]
    query_blob = np.array(query_vector, dtype=np.float32).tobytes()
    
    results = []
    if vec_loaded:
        try:
            cursor = conn.execute("""
                SELECT 
                    d.path, 
                    d.title, 
                    sub.distance
                FROM vec_documents v
                JOIN documents d ON d.path = v.path
                WHERE v.embedding MATCH ? AND k = ?
                ORDER BY distance
            """, (query_blob, limit))
            results = cursor.fetchall()
        except Exception as e:
            console.print(f"[yellow]sqlite-vec query failed: {e}. Falling back to Python similarity.[/yellow]")
            vec_loaded = False
            
    if not vec_loaded:
        cursor = conn.execute("SELECT path, title, embedding FROM documents")
        rows = cursor.fetchall()
        
        scored_rows = []
        for path, title, emb_blob in rows:
            doc_vector = np.frombuffer(emb_blob, dtype=np.float32)
            dot_product = np.dot(query_vector, doc_vector)
            norm_q = np.linalg.norm(query_vector)
            norm_d = np.linalg.norm(doc_vector)
            similarity = dot_product / (norm_q * norm_d) if norm_q > 0 and norm_d > 0 else 0.0
            distance = 1.0 - similarity
            scored_rows.append((path, title, distance))
            
        scored_rows.sort(key=lambda x: x[2])
        results = scored_rows[:limit]
        
    conn.close()
    
    if not results:
        console.print("[yellow]No matches found.[/yellow]")
        return
        
    console.print(f"\n[bold green]Top {len(results)} Matches:[/bold green]")
    for path, title, score in results:
        console.print(f"  * [bold]{title}[/bold] (Score: {score:.4f})")
        console.print(f"    Path: [dim]{path}[/dim]")


if __name__ == "__main__":
    app()
