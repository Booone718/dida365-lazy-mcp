# AI agent instructions for dida365-lazy-mcp

This repository is a standalone Node.js wrapper plus a Hermes Agent skill for lazy-calling the official Dida365/TickTick MCP endpoint.

## Your job when a user gives you this repo

1. Inspect `README.md` first.
2. Check Node.js version:
   ```bash
   node -v
   ```
   Node.js 18+ is required.
3. Install dependencies from the repository root:
   ```bash
   npm install
   ```
4. Run diagnostics:
   ```bash
   npm run doctor
   ```
5. If authorization is missing, do not ask the user to paste a token into chat. Tell them to set `DIDA365_MCP_ACCESS_TOKEN` locally or copy `.env.example` to `.env` and fill it in on their machine.
6. After authorization is available, verify read-only access:
   ```bash
   npm run list-projects:dry-run
   npm run list-projects
   ```

## Security rules

- Never print, log, commit, or summarize OAuth tokens, bearer tokens, API keys, client secrets, or authorization headers.
- Do not commit `.env` or token files.
- Prefer `--dry-run` before write operations.
- Use compact JSON output. Avoid `--raw` unless debugging.

## Useful commands

```bash
npm run doctor
npm run list-projects:dry-run
npm run list-projects
npm run create-task:dry-run
```

Direct CLI examples:

```bash
node scripts/js/dida365_lazy.mjs list_projects
node scripts/js/dida365_lazy.mjs create_task --dry-run --args-json '{"task":{"title":"Task title","projectId":"inbox","status":0,"kind":"TEXT"}}'
```

## Current authorization status

This Phase 1 open-source version does not implement a browser OAuth command yet. If no Hermes token file or local access token is available, report the missing authorization and point the user to README instructions. The complete OAuth roadmap is in `references/open-source-readiness.md`.
