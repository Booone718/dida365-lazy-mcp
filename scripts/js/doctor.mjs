#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const JS_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(JS_DIR, '..', '..');
const HERMES_HOME = path.resolve(process.env.HERMES_HOME || path.join(os.homedir(), '.hermes'));
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const require = createRequire(import.meta.url);

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function valueLooksSet(value) {
  if (!value) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return !['...', 'your_access_token_here', '[REDACTED]', 'REDACTED'].includes(trimmed);
}

function packageAvailable(name) {
  try {
    require.resolve(name, { paths: [PROJECT_ROOT, JS_DIR] });
    return true;
  } catch (_) {
    return false;
  }
}

function tokenFileStatus(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { path: filePath, hasAccessToken: valueLooksSet(data.access_token), hasRefreshToken: valueLooksSet(data.refresh_token) };
  } catch (_) {
    return { path: filePath, hasAccessToken: false, parseError: true };
  }
}

function findAuthorization() {
  const dotenv = parseDotEnv(path.join(PROJECT_ROOT, '.env'));
  const envToken = process.env.DIDA365_MCP_ACCESS_TOKEN || process.env.TICKTICK_MCP_ACCESS_TOKEN || process.env.MCP_ACCESS_TOKEN;
  if (valueLooksSet(envToken)) return { ok: true, source: 'environment variable' };

  const dotenvToken = dotenv.DIDA365_MCP_ACCESS_TOKEN || dotenv.TICKTICK_MCP_ACCESS_TOKEN || dotenv.MCP_ACCESS_TOKEN;
  if (valueLooksSet(dotenvToken)) return { ok: true, source: '.env file' };

  const explicitTokenFile = process.env.DIDA365_MCP_TOKEN_FILE || dotenv.DIDA365_MCP_TOKEN_FILE;
  const candidates = [
    explicitTokenFile,
    path.join(XDG_CONFIG_HOME, 'dida365-lazy-mcp', 'tokens', 'dida365.json'),
    path.join(HERMES_HOME, 'mcp-tokens', 'dida365.json'),
    path.join(HERMES_HOME, 'mcp-tokens', 'ticktick.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const status = tokenFileStatus(candidate);
    if (status && status.hasAccessToken) return { ok: true, source: status.path, tokenFile: true };
  }
  return { ok: false, source: null };
}

function main() {
  const json = process.argv.includes('--json');
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const checks = {
    node: {
      ok: nodeMajor >= 18,
      detail: `Node.js ${process.version}`,
      next: nodeMajor >= 18 ? null : 'Install Node.js 18 or newer.',
    },
    dependencies: {
      ok: packageAvailable('@modelcontextprotocol/sdk') && packageAvailable('yaml'),
      detail: packageAvailable('@modelcontextprotocol/sdk') && packageAvailable('yaml') ? 'installed' : 'missing',
      next: 'Run `npm install` from the repository root.',
    },
    authorization: {
      ...findAuthorization(),
      next: 'Set `DIDA365_MCP_ACCESS_TOKEN` locally or copy `.env.example` to `.env` and fill it in. Do not paste tokens into chat or commit them.',
    },
    endpoint: {
      ok: true,
      detail: process.env.DIDA365_MCP_URL || process.env.TICKTICK_MCP_URL || process.env.MCP_SERVER_URL || 'https://mcp.dida365.com',
      next: null,
    },
  };
  const ready = Object.values(checks).every((check) => check.ok);
  const result = {
    ok: true,
    ready,
    projectRoot: PROJECT_ROOT,
    checks,
    nextSteps: ready
      ? ['Run `npm run list-projects` to verify read-only access.']
      : Object.entries(checks).filter(([, check]) => !check.ok && check.next).map(([name, check]) => `${name}: ${check.next}`),
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write('Dida365 Lazy MCP doctor\n\n');
  for (const [name, check] of Object.entries(checks)) {
    const mark = check.ok ? 'OK' : 'MISSING';
    const detail = check.detail || check.source || '';
    process.stdout.write(`- ${name}: ${mark}${detail ? ` (${detail})` : ''}\n`);
  }
  process.stdout.write(`\nReady: ${ready ? 'yes' : 'no'}\n`);
  if (result.nextSteps.length) {
    process.stdout.write('\nNext steps:\n');
    for (const step of result.nextSteps) process.stdout.write(`- ${step}\n`);
  }
}

main();
