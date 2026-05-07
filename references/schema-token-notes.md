# Dida365 Native MCP Schema Cost Notes

Session-derived measurements from a Hermes Agent setup with the official Dida365/TickTick MCP endpoint selected for 11 task tools.

## Why lazy loading matters

Native MCP tools are registered as normal agent tools. When a Dida365/TickTick MCP server is enabled, the selected `mcp_dida365_*` tool schemas are injected into the main-agent tool list on every LLM request, even when the current user turn is unrelated to task management.

A lazy wrapper avoids that cost by keeping the server configured but disabled in the main Hermes MCP registry, then launching a short-lived subprocess only when a task operation is needed.

## Example measurement

In one measured Hermes session:

- Total tools before disabling Dida365: 48
- Dida365 tools selected: 11
- Total tool schema size: about 78.1 KB / 19,858 tokens (`cl100k_base` estimate)
- Dida365 schema size: about 23.6 KB / 6,706 tokens
- Dida365 share of tool-schema tokens: about 33.8%
- Estimated tools after disabling Dida365: 37
- Estimated tool-schema tokens after disabling: about 13,153

The biggest individual schemas were write/update tools such as `batch_add_tasks`, `update_task`, and `create_task` because their input schemas are nested and verbose.

## Operational implication

For ordinary chat/planning/writing sessions, keep:

```yaml
mcp_servers:
  dida365:
    enabled: false
```

Then use `scripts/dida365-lazy.sh` or `scripts/dida365-lazy-js.sh` only when a task operation is actually needed.

After changing native MCP config, run `/reload-mcp` in the active gateway/session or restart the gateway. A fresh main-agent session should not expose `mcp_dida365_*` tools.

## Measurement caveat

Token counts depend on the current Hermes version, selected MCP tools, model tokenizer, and the other tools registered in the session. Treat the numbers above as order-of-magnitude evidence, not a universal constant. Re-measure after changing selected tools or Hermes MCP serialization.