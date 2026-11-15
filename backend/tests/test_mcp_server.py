"""Tests for the Vau-M Engine stdio JSON-RPC MCP server."""

import sys
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIRECTORY))

from mcp_server import (  # noqa: E402
    call_vault_tool,
    get_tool_definitions,
    handle_jsonrpc_message,
)
from vault_layout import VaultLayout  # noqa: E402

REPO_ROOT = BACKEND_DIRECTORY.parent
BLUEPRINT_VAULT = REPO_ROOT / "vault"


def test_mcp_server_exposes_core_vault_tools():
    names = {tool["name"] for tool in get_tool_definitions()}
    assert {
        "vault_brief",
        "vault_search",
        "vault_may_write",
        "vault_distill_session",
        "vault_catalogue_sessions",
    }.issubset(names)
    assert not any('review' in name for name in names)


def test_catalogue_reports_unavailable_provider_as_partial(tmp_path, monkeypatch):
    import json
    from test_native_lifecycle import pilot_vault
    layout = pilot_vault(tmp_path)
    monkeypatch.setenv('CODEX_SESSIONS_PATH', str(tmp_path / 'absent'))
    response = call_vault_tool('vault_catalogue_sessions', {'providers': ['codex']}, layout)
    assert response['isError']
    result = json.loads(response['content'][0]['text'])
    assert result['status'] == 'partial' and result['outcomes'][0]['status'] == 'error'


def test_call_vault_may_write_respects_hemisphere_permissions():
    layout = VaultLayout.load(BLUEPRINT_VAULT)
    allowed = call_vault_tool("vault_may_write", {"path": "25_Knowledge_Base/note.md"}, layout=layout)
    denied = call_vault_tool("vault_may_write", {"path": "01_Journal/private.md"}, layout=layout)

    assert allowed["isError"] is False
    assert "ALLOWED" in allowed["content"][0]["text"]
    assert denied["isError"] is False
    assert "DENIED" in denied["content"][0]["text"]


def test_jsonrpc_tools_list_and_call_roundtrip(tmp_path: Path):
    layout = VaultLayout.load(BLUEPRINT_VAULT)
    db_path = tmp_path / "mcp_test.db"

    list_resp = handle_jsonrpc_message({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, layout=layout, db_path=db_path)
    assert list_resp is not None
    assert list_resp["id"] == 1
    assert any(t["name"] == "vault_brief" for t in list_resp["result"]["tools"])

    call_resp = handle_jsonrpc_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "vault_brief",
                "arguments": {"query": "GitKraken Husky", "directory": "30_Git", "limit": 2, "include_unreviewed": True},
            },
        },
        layout=layout,
        db_path=db_path,
    )
    assert call_resp is not None
    assert call_resp["id"] == 2
    text = call_resp["result"]["content"][0]["text"]
    assert "# Vault Context Briefing" in text
    assert "GitKraken Hooks Troubleshooting" in text
