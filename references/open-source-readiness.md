# Open-source readiness notes

Use this when evolving `dida365-lazy-mcp` from a Hermes-local skill into a standalone open-source project that a non-Hermes user or AI coding agent can install from README alone.

## Target user experience

A standalone user should be able to run:

```bash
git clone <repo-url> dida365-lazy-mcp
cd dida365-lazy-mcp
npm install
npm run doctor
npm run auth      # once OAuth is implemented
npm run list-projects
```

If the user sends the repo URL to Claude Code, Codex, Cursor, or another coding agent, the agent should be able to:

1. inspect the README / AGENTS.md;
2. install dependencies;
3. run `doctor`;
4. report whether Node, network, dependencies, and Dida365 authorization are ready;
5. ask the user for the minimum missing human step, usually browser authorization;
6. avoid printing or committing tokens.

## Current architecture assessment

The current Node.js wrapper can work outside Hermes when dependencies are installed and an access token is provided. It can default to `https://mcp.dida365.com` without a Hermes config.

What remains for a complete open-source experience:

- README should be standalone-first, with Hermes compatibility as a later section.
- A root `package.json` should hide `scripts/js` internals behind `npm install`, `npm run doctor`, and task commands.
- Add `AGENTS.md` so AI coding agents know the install/verification protocol.
- Add `.env.example` and security notes for token handling.
- Add a real OAuth command instead of requiring users to discover/provide `DIDA365_MCP_ACCESS_TOKEN` manually.

## Estimated implementation cost

Approximate cost for a complete MVP:

- Root package/CLI/doctor/docs/agent instructions: 0.5–1 day.
- OAuth PKCE browser flow with local callback server: 1.5–3 days.
- Token storage, expiry checks, refresh-token handling, and 401 retry: 1–2 days.
- Cross-platform hardening, clear errors, security polish: 0.5–1 day.
- Tests, CI, README polish: 0.5–1 day.

Total: about 4–8 days for a complete MVP; 1–2 weeks for a stable cross-platform open-source release; 2–3 weeks for npm-package maturity.

## Recommended phased roadmap

### Phase 1 — Standalone-first without OAuth

Goal: make the repo understandable and installable by humans and AI agents, while still requiring an explicit access token.

Current local status: implemented. The package now has a root `package.json`, `npm run doctor`, `AGENTS.md`, `.env.example`, standalone-first README, and explicit missing-authorization guidance. It still requires `DIDA365_MCP_ACCESS_TOKEN` or a compatible token file.

Verification note: for machine-readable checks, call `node --no-warnings scripts/js/doctor.mjs --json` directly. Do not pipe `npm run doctor:json` into a parser unless the npm banner has been suppressed; npm lifecycle output and Node/Undici warnings can make stdout non-JSON.

Deliverables:

- root `package.json` with scripts such as `doctor`, `list-projects`, `create-task:dry-run`;
- README quick start based on `npm install`, not `npm install --prefix scripts/js`;
- `AGENTS.md` with Claude Code / Codex instructions;
- `.env.example` containing variable names only, never real values;
- `doctor` command that reports missing token and next steps.

### Phase 2 — OAuth MVP

Goal: non-Hermes users can authorize without installing Hermes or manually extracting tokens.

Deliverables:

- `npm run auth` or `dida365-lazy auth`;
- OAuth 2.1 PKCE code verifier/challenge;
- browser open + localhost callback server;
- token exchange and secure local persistence;
- `logout` command to delete local tokens;
- clear errors for timeout, denied authorization, port conflicts, and expired tokens.

### Phase 3 — Release maturity

Goal: stable open-source package.

Deliverables:

- npm package / `npx dida365-lazy-mcp` entry;
- GitHub Actions for lint/test;
- mock OAuth and mock MCP tests;
- cross-platform path handling for macOS/Linux/Windows;
- security review for token redaction and file permissions;
- versioned examples and troubleshooting.

## Key pitfall

Do not call the project “complete standalone” until OAuth is solved. Without `auth`, an AI agent can install and verify the package, but it still must ask the user to provide or obtain an access token. That is acceptable for Phase 1, but not for the complete open-source experience.
