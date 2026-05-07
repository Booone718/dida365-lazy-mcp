# Security Notes

## Credential handling

This skill does not ask the LLM to read OAuth token files. The Python wrapper reuses Hermes Agent's configured native MCP client and existing token storage. The Node.js wrapper can read a local `.env` file, environment variables, standalone token files, or Hermes-style token files.

Never paste, print, log, commit, or summarize any of these values:

- OAuth access tokens
- OAuth refresh tokens
- Bearer tokens
- API keys
- client secrets
- authorization headers
- credential file contents

If a credential-like value appears in an error, redact it as `[REDACTED]`.

## Node.js token source

The Node.js wrapper checks token sources in this order:

1. local `.env` is loaded first, without overriding already-set environment variables;
2. `DIDA365_MCP_ACCESS_TOKEN`;
3. `TICKTICK_MCP_ACCESS_TOKEN`;
4. `MCP_ACCESS_TOKEN`;
5. `DIDA365_MCP_TOKEN_FILE`;
6. `~/.config/dida365-lazy-mcp/tokens/<server>.json`;
7. `~/.hermes/mcp-tokens/<server>.json`.

It uses only the access token value and does not print it. It currently does not implement a full OAuth browser flow or refresh-token flow. If the token is expired, refresh it through Hermes' native MCP flow, another compatible MCP client, or provide a fresh access token via environment variable.

## Why native MCP stays disabled

When native Dida365/TickTick MCP is globally enabled, every main-agent LLM request can carry all selected `mcp_dida365_*` schemas. That is convenient, but expensive for ordinary conversations that do not touch task data.

This skill keeps the server configured but disabled in the main session. The wrapper connects inside a short-lived subprocess, calls one tool, compacts the result, and shuts down the MCP connection.

## Output discipline

Use compact output by default.

Avoid:

- `--raw` except for debugging;
- dumping full task lists into the chat;
- returning OAuth or HTTP headers;
- sending unrelated project/task metadata back to the LLM.

Prefer concise fields: `id`, `projectId`, `title`, `status`, `priority`, `startDate`, `dueDate`, `completedTime`, `timeZone`, `kind`, and `tags`.

## Side effects

Read operations:

- `list_projects`
- `search_task`
- `get_task_by_id`
- `list_undone_tasks_by_time_query`
- `list_undone_tasks_by_date`
- `get_project_with_undone_tasks`

Write operations:

- `create_task`
- `batch_add_tasks`
- `update_task`
- `complete_task`
- `complete_tasks_in_project`

Use `--dry-run` to validate create/update payloads before writing when the payload is complex or when testing the skill.
