# Setup

## Standalone Node.js setup

For users who are not running Hermes Agent, use the root Node.js workflow. It does not require Hermes, `~/.hermes/config.yaml`, or a preconfigured native Dida365 MCP server:

```bash
git clone <repo-url> dida365-lazy-mcp
cd dida365-lazy-mcp
npm install
npm run doctor
```

Phase 1 standalone mode does not implement browser OAuth. Provide authorization locally:

```bash
export DIDA365_MCP_ACCESS_TOKEN="..."
```

Or use `.env`:

```bash
cp .env.example .env
# Edit .env locally and fill DIDA365_MCP_ACCESS_TOKEN.
```

Then verify:

```bash
npm run list-projects:dry-run
npm run list-projects
```

Expected:

- `doctor` reports Node.js and dependencies as OK.
- Before authorization, `doctor` reports authorization as missing and tells the user how to set it.
- After authorization, `list-projects` returns compact project metadata.

## Configure the official Dida365/TickTick MCP server for Hermes

Hermes users can add a server under `mcp_servers` in `~/.hermes/config.yaml`. The default key is `dida365`:

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

`enabled: false` is the key token-saving setting. It keeps the native MCP tool schemas out of normal main-agent requests. The wrapper temporarily enables or connects to this server only inside a short-lived subprocess.

## Complete OAuth in Hermes

Use Hermes' native MCP test flow once to authorize the official endpoint:

```bash
hermes mcp test dida365
```

If your Hermes version has an MCP CLI issue, edit config manually and trigger OAuth through an equivalent native MCP test/reload flow. Do not paste OAuth tokens into chat or commits.

The Node.js wrapper can reuse Hermes' token file:

```text
~/.hermes/mcp-tokens/<server>.json
```

It does not currently implement the full OAuth browser flow itself. If there is no Hermes token file, provide an access token explicitly:

```bash
export DIDA365_MCP_ACCESS_TOKEN="..."
```

## Find the skill directory in Hermes

Depending on how the skill was installed, the directory is usually one of:

```bash
$HOME/.hermes/skills/productivity/dida365-lazy-mcp
$HOME/.hermes/skills/dida365-lazy-mcp
```

When an agent loads the skill via `skill_view`, use the returned `skill_dir` path.

## Python wrapper verification for Hermes

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects --dry-run
"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects
hermes mcp list
```

Expected:

- `list_projects --dry-run` returns compact JSON with `ok: true`.
- `list_projects` returns compact project metadata.
- `hermes mcp list` may show the server as disabled; that is expected for token-saving lazy mode.

## Node.js wrapper verification inside Hermes

Install dependencies once if using the Node.js path from a Hermes skill directory:

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
npm install --prefix "$SKILL_DIR/scripts/js"
```

Verify:

```bash
"$SKILL_DIR/scripts/dida365-lazy-js.sh" list_projects --dry-run
"$SKILL_DIR/scripts/dida365-lazy-js.sh" list_projects
```

## After changing native MCP config

A running Hermes gateway or CLI process can keep old MCP tool registrations until reload/restart. Use `/reload-mcp`, start a new session, or restart the gateway before checking whether native `mcp_dida365_*` schemas are absent from the main-agent tool list.
