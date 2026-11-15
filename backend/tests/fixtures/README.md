# Lifecycle fixtures

`codex-native-v1.jsonl` is a synthetic SQL-alias scenario using the native
`session_meta`, `response_item.payload` and mirrored `event_msg` structure observed
in local Codex rollout files during the 2026-11-15 review. It is not a recording of
a real SQL repair. The original scenario's producer version was not established.
The implementation was subsequently checked against local Codex 0.166.0 files:
native wrapped conversation, configuration updates, tool definitions, world state,
token accounting and explicit compaction records. The additional shapes have
sanitised regression coverage in `test_native_lifecycle.py`. Compaction stays
partial. This does not qualify every Codex version or every response-item type.
Unknown content types produce a partial parse. No private transcript text is copied.
