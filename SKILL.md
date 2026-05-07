---
name: dida365-lazy-mcp
description: Use when managing Dida365/TickTick tasks from Hermes Agent without injecting native MCP tool schemas into every main-agent request. Calls the official Dida365/TickTick MCP endpoint through a short-lived local wrapper and returns compact JSON.
version: 1.1.0
author: Hermes Agent contributors
license: MIT
metadata:
  hermes:
    tags: [Dida365, TickTick, MCP, lazy-loading, tasks, productivity]
    related_skills: [native-mcp]
---

# Dida365 Lazy MCP

## Overview

This skill provides a progressive-disclosure pattern for Dida365 / TickTick task operations in Hermes Agent.

Instead of enabling the native Dida365 MCP server globally and sending `mcp_dida365_*` schemas with every main-agent LLM request, keep the MCP server configured but disabled. When task operations are actually needed, call one of the bundled wrapper scripts. The default Python wrapper starts a short-lived Python process, temporarily enables the configured Dida365/TickTick MCP server inside that process, dispatches one MCP tool, compacts the result, and shuts the MCP connection down. An optional Node.js wrapper is also included for users who prefer a JavaScript runtime or want to avoid importing Hermes' Python modules.

This is a Hermes Agent skill, not a generic Claude/Cursor MCP package. The Python wrapper reuses Hermes Agent's MCP client, OAuth token storage, config loading, and tool registry. The Node.js wrapper uses the official MCP TypeScript SDK and can reuse Hermes-style config/token files or an explicit access token from environment variables.

## When to Use

Use this when the user asks to:

- list Dida365/TickTick projects/lists;
- create or batch-create tasks;
- search tasks;
- inspect a task by ID;
- update, reschedule, or reprioritize tasks;
- complete one task or multiple tasks;
- list unfinished tasks for today, tomorrow, the next 7 days, or a date range.

Do not use this for:

- generic planning that does not need to touch Dida365/TickTick;
- habit/focus/project-admin operations outside the selected task tool subset;
- user-specific priority/scheduling rules. Put those in a separate private overlay skill.

## Installation Layout

The reusable wrapper lives inside this skill:

```text
<skill_dir>/package.json                    # standalone Node.js scripts
<skill_dir>/AGENTS.md                       # instructions for AI coding agents
<skill_dir>/.env.example                    # local token variable template
<skill_dir>/scripts/dida365_lazy.py          # Python/Hermes-native wrapper
<skill_dir>/scripts/dida365-lazy.sh         # Python wrapper shell entry
<skill_dir>/scripts/dida365-lazy-js.sh      # Node.js wrapper shell entry
<skill_dir>/scripts/js/dida365_lazy.mjs     # Node.js implementation
<skill_dir>/scripts/js/doctor.mjs           # standalone setup diagnostic
<skill_dir>/scripts/js/package.json         # legacy nested Node.js dependency manifest
```

In this local install, the skill directory is usually:

```bash
$HOME/.hermes/skills/productivity/dida365-lazy-mcp
```

If the skill is installed directly from a package, it may instead be:

```bash
$HOME/.hermes/skills/dida365-lazy-mcp
```

When using `skill_view`, prefer the returned `skill_dir` path if available.

## Prerequisites

1. Hermes Agent is installed and has a working Python environment if you use the Python wrapper.
2. The native MCP client dependencies are available in Hermes' Python environment if you use the Python wrapper.
3. Node.js 18+ and the dependencies under `scripts/js/package.json` are installed if you use the Node.js wrapper.
4. For Hermes users, `~/.hermes/config.yaml` contains a Dida365/TickTick MCP server config. The default server key is `dida365`; `ticktick` also works.
5. For standalone Node.js users, a Hermes-style config is optional if the wrapper receives an access token via `DIDA365_MCP_ACCESS_TOKEN` / `TICKTICK_MCP_ACCESS_TOKEN`; it defaults to `https://mcp.dida365.com`.
6. OAuth has already been completed for the official Dida365/TickTick MCP server, or the Node.js wrapper receives a valid access token.
7. For token savings in Hermes, the server should normally be configured with `enabled: false` so it is not injected into main-agent tool schemas.

Recommended config:

```yaml
mcp_servers:
  dida365:
    url: "https://mcp.dida365.com"
    auth: oauth
    enabled: false
    tools:
      include:
        - list_projects
        - create_task
        - batch_add_tasks
        - search_task
        - get_task_by_id
        - update_task
        - complete_task
        - complete_tasks_in_project
        - list_undone_tasks_by_time_query
        - list_undone_tasks_by_date
        - get_project_with_undone_tasks
      resources: false
      prompts: false
```

See `references/setup.md` for setup and verification notes. See `references/other-clients.md` for Claude Code, Codex, and non-Hermes usage. See `references/open-source-readiness.md` for the standalone-open-source roadmap and OAuth cost model. See `references/schema-token-notes.md` for measured schema-token savings and re-measurement caveats.

## Command Prefix

### Python wrapper, default for Hermes Agent users

Use the shell wrapper when possible because it resolves the script relative to the skill directory and uses Hermes' venv Python by default:

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
"$SKILL_DIR/scripts/dida365-lazy.sh" <tool> --args-json '<json>'
```

If the skill is installed without a category directory, use:

```bash
SKILL_DIR="$HOME/.hermes/skills/dida365-lazy-mcp"
"$SKILL_DIR/scripts/dida365-lazy.sh" <tool> --args-json '<json>'
```

You can override the Python binary:

```bash
HERMES_PYTHON="$HOME/.hermes/hermes-agent/venv/bin/python" "$SKILL_DIR/scripts/dida365-lazy.sh" list_projects
```

Or call the Python script directly:

```bash
$HOME/.hermes/hermes-agent/venv/bin/python "$SKILL_DIR/scripts/dida365_lazy.py" list_projects
```

### Node.js wrapper, default for standalone open-source users

From a cloned repository root, prefer the root scripts:

```bash
npm install
npm run doctor
npm run list-projects:dry-run
npm run list-projects
```

If authorization is missing, set it locally without printing it:

```bash
cp .env.example .env
# Edit .env and fill DIDA365_MCP_ACCESS_TOKEN, or export it in your shell.
```

The Node.js wrapper can also be called directly:

```bash
node scripts/js/dida365_lazy.mjs list_projects
./scripts/dida365-lazy-js.sh list_projects
```

For Hermes installs that only use the nested Node package, this remains valid:

```bash
npm install --prefix "$SKILL_DIR/scripts/js"
"$SKILL_DIR/scripts/dida365-lazy-js.sh" list_projects
"$SKILL_DIR/scripts/dida365-lazy-js.sh" create_task --dry-run --args-json '{"task":{"title":"Task title","projectId":"inbox","status":0,"kind":"TEXT"}}'
```

The Node.js wrapper currently supports the official HTTP/StreamableHTTP endpoint. It reads local `.env`, explicit environment variables, optional Hermes-style config/token files, and defaults to `https://mcp.dida365.com` when no config file exists. It does not perform a full OAuth browser flow itself. If no token file is available, provide an access token with:

```bash
export DIDA365_MCP_ACCESS_TOKEN="..."
```

## Available Lazy Tools

The wrapper intentionally allows a focused task-management subset:

- `list_projects`
- `create_task`
- `batch_add_tasks`
- `search_task`
- `get_task_by_id`
- `update_task`
- `complete_task`
- `complete_tasks_in_project`
- `list_undone_tasks_by_time_query`
- `list_undone_tasks_by_date`
- `get_project_with_undone_tasks`

If the user's `mcp_servers.<server>.tools.include` is narrower than this list, the wrapper respects the configured include list and returns an explicit error for excluded tools.

## Command Recipes

### Verify config without calling MCP

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects --dry-run
```

### List projects

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects
```

### Create one task

Use the same payload shape expected by the official MCP tool:

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" create_task --args-json '{"task":{"title":"Task title","projectId":"inbox","status":0,"kind":"TEXT"}}'
```

For due dates, first get current time with a tool. Do not infer dates mentally.

```bash
date '+%Y-%m-%d %H:%M:%S %Z %z'
```

Then set `startDate` / `dueDate` as ISO strings and include `timeZone` when appropriate.

### Validate a create payload without writing

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" create_task --dry-run --args-json '{"task":{"title":"Task title","projectId":"inbox","status":0,"kind":"TEXT"}}'
```

### Search tasks

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" search_task --args-json '{"query":"keyword"}'
```

### List unfinished tasks by predefined query

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" list_undone_tasks_by_time_query --args-json '{"query_command":"today"}'
```

Common `query_command` values: `today`, `last24hour`, `last7day`, `tomorrow`, `next24hour`, `next7day`.

### List unfinished tasks by date range

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" list_undone_tasks_by_date --args-json '{"search":{"startDate":"2026-05-07T00:00:00+08:00","endDate":"2026-05-08T00:00:00+08:00"}}'
```

The official API may limit date ranges. Keep queries small and summarize only relevant fields.

### Complete an existing task

When the user says an existing task is done, first locate the existing unfinished task. Do not create a new task and complete the new one.

Recommended flow:

1. Search/list unfinished tasks by keyword or date range.
2. Confirm the matching `task_id` and `project_id` with `get_task_by_id` when needed.
3. Call `complete_task` on that existing task.
4. Re-list unfinished tasks to verify the title disappeared from the open list.

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" complete_task --args-json '{"project_id":"<projectId>","task_id":"<taskId>"}'
```

## Server Name Options

By default the wrapper tries these configs in order:

1. `mcp_servers.dida365`
2. `mcp_servers.ticktick`
3. any MCP server whose URL contains `mcp.dida365.com`, `dida365`, or `ticktick`

To force a server key:

```bash
"$SKILL_DIR/scripts/dida365-lazy.sh" --server ticktick list_projects
```

or set:

```bash
export DIDA365_MCP_SERVER=ticktick
```

## Output Discipline

The wrapper defaults to compact output. Keep it that way unless debugging.

- Do not use `--raw` unless inspecting a wrapper/server issue.
- If a list is large, lower `--limit` or summarize only title/status/priority/due/project.
- For write operations, report action, task title, ID, project, status, priority, and due time.
- Never print OAuth tokens, bearer tokens, API keys, or credential file contents.

## Personalization Pattern

Keep this skill generic. Do not add personal defaults such as:

- default project/list names;
- personal priority rules;
- preferred due times;
- language-specific work-task templates;
- private labels/tags.

Create a separate overlay skill for those defaults. The overlay skill can call this wrapper for the actual task operations.

## Common Pitfalls

1. Enabling native `mcp_dida365_*` globally defeats the purpose. Keep the MCP server configured but disabled for normal sessions.
2. The running Hermes gateway may need `/reload-mcp` or restart after changing native MCP config.
3. Use Hermes' Python environment. System Python may not have Hermes modules or MCP dependencies.
4. Do not infer current date mentally before setting due dates; call a date/time tool.
5. For completion workflows, locate the existing task first. Creating a duplicate task and completing it leaves the original task open.
6. Avoid `--raw` in normal use. Large raw task JSON can erase the token savings.
7. For open-source positioning, do not present the package as fully standalone until the README has a root-level Node quick start and the Node path has either a built-in OAuth command or a very explicit access-token requirement. See `references/open-source-readiness.md`.
8. When validating JSON output from the Node doctor, prefer `node --no-warnings scripts/js/doctor.mjs --json` over `npm run doctor:json` in pipes or tests. `npm run` can prepend lifecycle/banner output and Node/Undici warnings can pollute stdout, causing JSON parsers to fail even when the doctor command itself is correct.

## Verification Checklist

- [ ] `"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects --dry-run` returns `ok: true`.
- [ ] `"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects` returns compact project JSON.
- [ ] Optional JS path: `npm install --prefix "$SKILL_DIR/scripts/js"`, then `"$SKILL_DIR/scripts/dida365-lazy-js.sh" list_projects` returns compact project JSON.
- [ ] For standalone-open-source readiness, README starts with Node.js quick start, root `package.json` exposes `npm install` / `npm run doctor`, and `AGENTS.md` tells Claude Code/Codex how to install and report missing authorization.
- [ ] If claiming complete non-Hermes support, `auth` exists and handles OAuth PKCE browser login, token storage, refresh, logout, and clear re-auth errors; otherwise document that users must provide `DIDA365_MCP_ACCESS_TOKEN`.
- [ ] `create_task --dry-run` validates a payload without writing.
- [ ] With native MCP disabled, `hermes mcp list` shows the Dida365/TickTick server as disabled.
- [ ] A fresh main-agent session has no `mcp_dida365_*` tools.
- [ ] Task completion is verified by re-listing unfinished tasks or fetching the task by ID.

## Linked Files

- `package.json` — root scripts for standalone Node.js usage (`doctor`, `list-projects`, dry-run helpers).
- `AGENTS.md` — instructions for Claude Code, Codex, Cursor, and similar coding agents.
- `.env.example` — local token variable template; never commit `.env`.
- `scripts/dida365_lazy.py` — Python wrapper that calls Hermes' MCP client in a short-lived process.
- `scripts/dida365-lazy.sh` — shell convenience wrapper that uses Hermes' venv Python by default.
- `scripts/dida365-lazy-js.sh` — shell convenience wrapper for the Node.js implementation.
- `scripts/js/dida365_lazy.mjs` — Node.js wrapper using the official MCP TypeScript SDK.
- `scripts/js/doctor.mjs` — standalone setup diagnostic command.
- `scripts/js/package.json` — legacy nested Node.js dependency manifest for category-installed Hermes skill layouts.
- `references/setup.md` — setup and configuration notes.
- `references/other-clients.md` — standalone Node.js, Claude Code, Codex, and other-client usage patterns.
- `references/open-source-readiness.md` — complete standalone OAuth roadmap and cost model.
- `references/payload-examples.md` — JSON payload examples.
- `references/security.md` — security and token-handling notes.
- `references/schema-token-notes.md` — measured native-MCP schema cost and lazy-loading savings notes.
