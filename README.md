# dida365-lazy-mcp

English | [简体中文](README.zh-CN.md)

Standalone Node.js wrapper and Hermes Agent skill for calling the official Dida365 / TickTick MCP endpoint on demand.

The goal is to avoid loading large Dida365 MCP tool schemas into every AI-agent turn. Instead, the agent calls a small local command only when task operations are needed. The command returns compact JSON.

## Quick start for non-Hermes users

Requirements:

- Node.js 18+
- network access to `https://mcp.dida365.com`
- a valid Dida365 / TickTick MCP access token

No Hermes install and no `~/.hermes/config.yaml` are required for the standalone Node.js path. If a Hermes-style config exists, the wrapper can read it as an optional compatibility layer; otherwise it defaults to the official endpoint.

Install:

```bash
git clone https://github.com/Booone718/dida365-lazy-mcp.git
cd dida365-lazy-mcp
npm install
npm run doctor
```

Phase 1 standalone mode does not implement browser OAuth yet. Provide authorization locally with an environment variable:

```bash
export DIDA365_MCP_ACCESS_TOKEN="..."
```

Or use a local `.env` file:

```bash
cp .env.example .env
# Edit .env locally and fill DIDA365_MCP_ACCESS_TOKEN.
# Never commit .env or paste token values into chat.
```

Verify read-only access:

```bash
npm run list-projects:dry-run
npm run list-projects
```

Validate a write payload without creating anything:

```bash
npm run create-task:dry-run
```

## Current authorization status

This minimal open-source version can run outside Hermes, but it still needs an access token supplied by the user. It does not yet include:

```bash
npm run auth
```

The complete standalone experience is tracked in `references/open-source-readiness.md`. That future version should implement OAuth PKCE browser login, local token storage, refresh, logout, and clearer re-authentication flows.

## Using with an AI coding agent

If you send this repository to Claude Code, Codex, Cursor, or another AI coding agent, it should:

1. read `README.md` and `AGENTS.md`;
2. run `npm install`;
3. run `npm run doctor`;
4. report missing authorization if no token is configured;
5. ask you to set the token locally, not paste it into chat;
6. run `npm run list-projects` after authorization is ready.

Agent-specific notes are in `references/other-clients.md`.

## Commands

```bash
npm run doctor
node --no-warnings scripts/js/doctor.mjs --json
npm run list-projects:dry-run
npm run list-projects
npm run create-task:dry-run
```

Direct wrapper usage:

```bash
node scripts/js/dida365_lazy.mjs list_projects
node scripts/js/dida365_lazy.mjs create_task --dry-run --args-json '{"task":{"title":"Task title","projectId":"inbox","status":0,"kind":"TEXT"}}'
```

Shell wrapper usage:

```bash
./scripts/dida365-lazy-js.sh list_projects
```

## Hermes Agent usage

Hermes users can keep the native Dida365/TickTick MCP server configured but disabled, then call this skill's wrapper on demand.

Recommended Hermes config:

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

Python wrapper, best for Hermes users:

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects
```

Node.js wrapper, also works in Hermes:

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
npm install --prefix "$SKILL_DIR/scripts/js"
"$SKILL_DIR/scripts/dida365-lazy-js.sh" list_projects
```

`SKILL_DIR` is not fixed. It is only a shell variable pointing to wherever this package is installed.

## Available lazy tools

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

## Security

- Never print, log, commit, or summarize tokens.
- Do not commit `.env` or token files.
- Prefer `--dry-run` before write operations.
- Use compact output by default.
- Avoid `--raw` unless debugging.

More notes: `references/security.md`.

## Included files

- `package.json` — root scripts for standalone Node.js usage.
- `AGENTS.md` — instructions for Claude Code, Codex, Cursor, and similar agents.
- `.env.example` — local token variable template.
- `SKILL.md` — Hermes skill instructions.
- `scripts/js/dida365_lazy.mjs` — Node.js wrapper using the MCP TypeScript SDK.
- `scripts/js/doctor.mjs` — setup diagnostic command.
- `scripts/dida365-lazy-js.sh` — shell wrapper for the Node.js implementation.
- `scripts/dida365_lazy.py` — Python wrapper using Hermes' MCP client.
- `scripts/dida365-lazy.sh` — shell wrapper using Hermes' venv Python.
- `references/setup.md` — setup and verification notes.
- `references/other-clients.md` — standalone, Claude Code, Codex, and other-client usage notes.
- `references/open-source-readiness.md` — roadmap for the complete OAuth-based open-source experience.
- `references/payload-examples.md` — common JSON payloads.
- `references/security.md` — credential and output-safety notes.
- `templates/` — starter JSON payloads.

## Personal defaults

Keep this package generic. Put personal defaults such as preferred project names, priority rules, due-time heuristics, or tag policies in a separate overlay skill or agent instruction file.

## License

MIT
