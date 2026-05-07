# Using with non-Hermes clients

This package can be used as a standalone Node.js command from Claude Code, Codex, Cursor, other AI coding agents, or plain shell scripts. Hermes Agent support remains available, but it is not required for the Node.js path. Standalone users do not need `~/.hermes/config.yaml`; the wrapper defaults to the official endpoint and only needs local authorization.

## Is `SKILL_DIR` fixed?

No. `SKILL_DIR` is only a shell variable pointing to wherever this package is installed.

Common examples:

```bash
# Any cloned repo or manually downloaded package
SKILL_DIR="$HOME/tools/dida365-lazy-mcp"

# Hermes category install
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"

# Hermes direct install
SKILL_DIR="$HOME/.hermes/skills/dida365-lazy-mcp"
```

The only requirement is that these files exist under that directory:

```text
package.json
scripts/dida365-lazy-js.sh
scripts/js/dida365_lazy.mjs
```

## Standalone Node.js setup

```bash
git clone <repo-url> dida365-lazy-mcp
cd dida365-lazy-mcp
npm install
npm run doctor
```

Phase 1 does not include browser OAuth. Set authorization locally:

```bash
export DIDA365_MCP_ACCESS_TOKEN="[REDACTED]"
```

Or:

```bash
cp .env.example .env
# Edit .env locally and fill DIDA365_MCP_ACCESS_TOKEN.
```

Then verify:

```bash
npm run list-projects:dry-run
npm run list-projects
```

The wrapper defaults to the official endpoint:

```text
https://mcp.dida365.com
```

Optional overrides:

```bash
export DIDA365_MCP_URL="https://mcp.dida365.com"
export DIDA365_MCP_SERVER="dida365"
```

## Claude Code pattern

Claude Code can call the wrapper as a shell command. Put the package somewhere stable, for example:

```bash
mkdir -p "$HOME/tools"
git clone <repo-url> "$HOME/tools/dida365-lazy-mcp"
cd "$HOME/tools/dida365-lazy-mcp"
npm install
npm run doctor
```

Then add a concise instruction to `CLAUDE.md` or a Claude Code skill file:

```markdown
# Dida365 / TickTick tasks

Use this command for Dida365/TickTick task operations instead of enabling the native MCP server globally:

`$HOME/tools/dida365-lazy-mcp/scripts/dida365-lazy-js.sh`

Examples:

- Doctor: `cd $HOME/tools/dida365-lazy-mcp && npm run doctor`
- List projects: `$HOME/tools/dida365-lazy-mcp/scripts/dida365-lazy-js.sh list_projects`
- Validate create payload: `$HOME/tools/dida365-lazy-mcp/scripts/dida365-lazy-js.sh create_task --dry-run --args-json '<json>'`
- Create task: `$HOME/tools/dida365-lazy-mcp/scripts/dida365-lazy-js.sh create_task --args-json '<json>'`

Use compact output. Do not print tokens. Prefer `--dry-run` before writes. If authorization is missing, ask the user to set `DIDA365_MCP_ACCESS_TOKEN` locally or fill `.env`; do not ask them to paste token values into chat.
```

If Claude Code permissions are restricted, allow the wrapper command or the repository's `npm run ...` scripts via the installed absolute path.

## Codex pattern

Codex can use the wrapper as a normal shell command inside a repository. Put the package in a stable location or vendor it under a tools directory, then document usage in the repository's agent instructions, for example `AGENTS.md`:

```markdown
# Dida365 / TickTick tasks

For Dida365/TickTick task operations, call:

`$HOME/tools/dida365-lazy-mcp/scripts/dida365-lazy-js.sh`

The command returns compact JSON. Never print credentials. Use `--dry-run` before write operations. If authorization is missing, tell the user to set `DIDA365_MCP_ACCESS_TOKEN` locally or fill `.env`.
```

Make sure the Codex execution environment has:

- Node.js 18+
- dependencies installed with `npm install`
- network access to `https://mcp.dida365.com`
- `DIDA365_MCP_ACCESS_TOKEN`, a `.env` file, or a compatible token file available locally

## Direct official MCP vs lazy wrapper

Other clients may support connecting directly to the official Dida365/TickTick MCP endpoint. That is simpler, but it usually exposes native MCP tools directly to the agent and may reintroduce the schema/context overhead this package is designed to avoid.

Use direct MCP when convenience matters more than schema cost. Use this wrapper when you want explicit, on-demand, compact command calls.
