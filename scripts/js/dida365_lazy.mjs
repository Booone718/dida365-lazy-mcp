#!/usr/bin/env node
/**
 * Node.js lazy Dida365/TickTick MCP wrapper for Hermes Agent.
 *
 * This implementation is useful for users who prefer a Node runtime or want a
 * wrapper that does not import Hermes' Python modules. It still expects either
 * a Hermes-style MCP config/token store or an explicit access token via env.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_SERVER_CANDIDATES = ['dida365', 'ticktick'];
const DEFAULT_MCP_URL = 'https://mcp.dida365.com';
const DEFAULT_ALLOWED_TOOLS = new Set([
  'list_projects',
  'create_task',
  'batch_add_tasks',
  'search_task',
  'get_task_by_id',
  'update_task',
  'complete_task',
  'complete_tasks_in_project',
  'list_undone_tasks_by_time_query',
  'list_undone_tasks_by_date',
  'get_project_with_undone_tasks',
]);

const __filename = fileURLToPath(import.meta.url);
const JS_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(JS_DIR, '..', '..');
const HERMES_HOME = path.resolve(process.env.HERMES_HOME || path.join(os.homedir(), '.hermes'));
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnvFile(path.join(PROJECT_ROOT, '.env'));

function jsonPrint(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function redact(text) {
  return String(text)
    .replace(/(bearer\s+)[a-z0-9._~+\-/]+=*/gi, '$1[REDACTED]')
    .replace(/(token|api[_-]?key|secret|password|authorization)(\s*[=:]\s*)[^\s,}\]]+/gi, '$1$2[REDACTED]');
}

function parseArgs(argv) {
  const out = {
    tool: null,
    server: null,
    argsJson: null,
    argsFile: null,
    raw: false,
    dryRun: false,
    limit: 80,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--server') out.server = argv[++i];
    else if (arg === '--args-json') out.argsJson = argv[++i];
    else if (arg === '--args-file') out.argsFile = argv[++i];
    else if (arg === '--raw') out.raw = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--limit') out.limit = Number(argv[++i] || '80');
    else if (arg === '-h' || arg === '--help') {
      out.help = true;
    } else if (!out.tool) {
      out.tool = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return out;
}

function usage() {
  return `Usage: dida365_lazy.mjs <tool> [--server dida365] [--args-json JSON | --args-file FILE] [--dry-run] [--raw] [--limit N]\n`;
}

function loadToolArgs(argsJson, argsFile) {
  if (argsJson && argsFile) throw new Error('Use only one of --args-json or --args-file');
  if (!argsJson && !argsFile) return {};
  const text = argsFile ? fs.readFileSync(path.resolve(argsFile), 'utf8') : argsJson;
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tool args must be a JSON object');
  }
  return value;
}

function loadHermesConfig() {
  const configPath = process.env.HERMES_CONFIG || path.join(HERMES_HOME, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const text = fs.readFileSync(configPath, 'utf8');
  return YAML.parse(text) || {};
}

function standaloneServerConfig(requestedServer) {
  const name = requestedServer || process.env.DIDA365_MCP_SERVER || process.env.TICKTICK_MCP_SERVER || 'dida365';
  const url = process.env.DIDA365_MCP_URL || process.env.TICKTICK_MCP_URL || process.env.MCP_SERVER_URL || DEFAULT_MCP_URL;
  return [name, {
    url,
    auth: 'oauth',
    enabled: true,
    tools: {
      include: Array.from(DEFAULT_ALLOWED_TOOLS).sort(),
      resources: false,
      prompts: false,
    },
  }];
}

function selectServerConfig(config, requestedServer) {
  const servers = config.mcp_servers || {};
  if (!servers || typeof servers !== 'object') throw new Error('No mcp_servers mapping found in Hermes config');

  if (requestedServer) {
    if (!servers[requestedServer] || typeof servers[requestedServer] !== 'object') {
      throw new Error(`No mcp_servers.${requestedServer} config found in Hermes config`);
    }
    return [requestedServer, structuredClone(servers[requestedServer])];
  }

  const envServer = process.env.DIDA365_MCP_SERVER || process.env.TICKTICK_MCP_SERVER;
  if (envServer && servers[envServer] && typeof servers[envServer] === 'object') {
    return [envServer, structuredClone(servers[envServer])];
  }

  for (const candidate of DEFAULT_SERVER_CANDIDATES) {
    if (servers[candidate] && typeof servers[candidate] === 'object') {
      return [candidate, structuredClone(servers[candidate])];
    }
  }

  for (const [name, serverConfig] of Object.entries(servers)) {
    if (!serverConfig || typeof serverConfig !== 'object') continue;
    const url = String(serverConfig.url || '').toLowerCase();
    if (url.includes('mcp.dida365.com') || url.includes('dida365') || url.includes('ticktick')) {
      return [name, structuredClone(serverConfig)];
    }
  }
  throw new Error('No Dida365/TickTick MCP server config found. Expected mcp_servers.dida365 or a server URL containing mcp.dida365.com');
}

function getServerConfig(serverName) {
  const config = loadHermesConfig();
  if (!config || !config.mcp_servers) {
    return standaloneServerConfig(serverName);
  }
  const [name, serverConfig] = selectServerConfig(config, serverName);
  serverConfig.enabled = true;
  serverConfig.auth ||= 'oauth';
  serverConfig.tools ||= {};
  if (!serverConfig.tools.include) serverConfig.tools.include = Array.from(DEFAULT_ALLOWED_TOOLS).sort();
  if (serverConfig.tools.resources === undefined) serverConfig.tools.resources = false;
  if (serverConfig.tools.prompts === undefined) serverConfig.tools.prompts = false;
  return [name, serverConfig];
}

function validateToolAllowed(tool, serverConfig) {
  if (!DEFAULT_ALLOWED_TOOLS.has(tool)) {
    return { ok: false, error: `Tool not allowed by lazy wrapper: ${tool}`, allowed: Array.from(DEFAULT_ALLOWED_TOOLS).sort() };
  }
  const include = serverConfig.tools && Array.isArray(serverConfig.tools.include) ? serverConfig.tools.include : null;
  if (include && include.length && !new Set(include).has(tool)) {
    return { ok: false, error: `Tool '${tool}' is not included in mcp_servers.<server>.tools.include`, include };
  }
  return null;
}

function loadAccessToken(serverName) {
  const explicit = process.env.DIDA365_MCP_ACCESS_TOKEN || process.env.TICKTICK_MCP_ACCESS_TOKEN || process.env.MCP_ACCESS_TOKEN;
  if (explicit) return { accessToken: explicit, source: 'env' };

  const explicitPath = process.env.DIDA365_MCP_TOKEN_FILE;
  const tokenPaths = [
    explicitPath,
    path.join(XDG_CONFIG_HOME, 'dida365-lazy-mcp', 'tokens', `${serverName}.json`),
    path.join(HERMES_HOME, 'mcp-tokens', `${serverName}.json`),
  ].filter(Boolean);

  for (const tokenPath of tokenPaths) {
    if (!fs.existsSync(tokenPath)) continue;
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const accessToken = token.access_token;
    if (!accessToken) return { accessToken: null, source: tokenPath, warning: `No access_token in token file: ${tokenPath}` };
    if (token.expires_at && Number(token.expires_at) < Date.now() / 1000) {
      return {
        accessToken,
        source: tokenPath,
        warning: 'Access token appears expired. Run a compatible OAuth refresh/login flow or provide DIDA365_MCP_ACCESS_TOKEN after refreshing authorization.',
      };
    }
    return { accessToken, source: tokenPath };
  }

  return { accessToken: null, source: tokenPaths[tokenPaths.length - 1], warning: `No access token available. Set DIDA365_MCP_ACCESS_TOKEN or run a compatible OAuth login flow.` };
}

function parseJsonish(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return value;
  }
}

function stripProject(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return project;
  const keys = ['id', 'name', 'kind', 'viewMode', 'closed', 'groupId'];
  return Object.fromEntries(keys.filter((k) => k in project).map((k) => [k, project[k]]));
}

function stripTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) return task;
  const keys = [
    'id', 'taskId', 'projectId', 'title', 'content', 'desc', 'status', 'priority',
    'startDate', 'dueDate', 'completedTime', 'timeZone', 'isAllDay', 'kind', 'url',
    'tags', 'repeatFlag', 'items',
  ];
  const out = {};
  for (const key of keys) {
    if (task[key] !== undefined && task[key] !== null) out[key] = task[key];
  }
  if (Array.isArray(out.items)) {
    out.items = out.items.slice(0, 20).map((item) => {
      if (!item || typeof item !== 'object') return item;
      const itemKeys = ['id', 'title', 'status', 'startDate', 'dueDate', 'isAllDay'];
      return Object.fromEntries(itemKeys.filter((k) => k in item).map((k) => [k, item[k]]));
    });
    if (task.items.length > 20) out.items_truncated = task.items.length - 20;
  }
  return out;
}

function genericCompact(value, limit = 80, depth = 0) {
  if (depth > 6) return '[TRUNCATED_DEPTH]';
  if (Array.isArray(value)) {
    const items = value.slice(0, limit).map((v) => genericCompact(v, limit, depth + 1));
    if (value.length > limit) items.push({ truncated: value.length - limit });
    return items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 120).map(([k, v]) => [k, genericCompact(v, limit, depth + 1)]));
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}...[TRUNCATED ${value.length - 2000} chars]`;
  return value;
}

function unwrapPayload(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload.task || payload.data || payload.result || payload;
  }
  return payload;
}

function tasksFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['tasks', 'items', 'result', 'data']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return null;
}

function compactValue(tool, payload, limit = 80) {
  if (tool === 'list_projects') {
    const projects = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.result) ? payload.result : []);
    return { projects: projects.map(stripProject), count: projects.length };
  }
  if (['search_task', 'list_undone_tasks_by_time_query', 'list_undone_tasks_by_date'].includes(tool)) {
    const tasks = tasksFromPayload(payload);
    if (Array.isArray(tasks)) {
      return { tasks: tasks.slice(0, limit).map(stripTask), count: tasks.length, truncated: Math.max(0, tasks.length - limit) };
    }
  }
  if (tool === 'get_project_with_undone_tasks' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const project = payload.project || payload.projectInfo || payload;
    const tasks = payload.tasks || payload.undoneTasks || payload.result || [];
    return {
      project: stripProject(project),
      tasks: Array.isArray(tasks) ? tasks.slice(0, limit).map(stripTask) : tasks,
      count: Array.isArray(tasks) ? tasks.length : null,
      truncated: Array.isArray(tasks) ? Math.max(0, tasks.length - limit) : 0,
    };
  }
  if (['get_task_by_id', 'create_task', 'update_task', 'complete_task'].includes(tool)) {
    const inner = unwrapPayload(payload);
    if (Array.isArray(inner)) return { items: inner.slice(0, limit).map(stripTask), count: inner.length, truncated: Math.max(0, inner.length - limit) };
    return stripTask(inner);
  }
  if (['batch_add_tasks', 'complete_tasks_in_project'].includes(tool)) {
    const tasks = tasksFromPayload(payload);
    if (Array.isArray(tasks)) return { items: tasks.slice(0, limit).map(stripTask), count: tasks.length, truncated: Math.max(0, tasks.length - limit) };
  }
  return genericCompact(payload, limit);
}

function extractPayload(result) {
  if (result && typeof result === 'object') {
    if (result.structuredContent && typeof result.structuredContent === 'object') {
      if ('result' in result.structuredContent) return result.structuredContent.result;
      return result.structuredContent;
    }
    if (Array.isArray(result.content)) {
      const textItems = result.content.filter((item) => item && item.type === 'text' && typeof item.text === 'string');
      if (textItems.length === 1) return parseJsonish(textItems[0].text);
      if (textItems.length > 1) return textItems.map((item) => parseJsonish(item.text));
    }
    if ('result' in result) return parseJsonish(result.result);
  }
  return result;
}

async function callMcp(serverName, serverConfig, tool, toolArgs) {
  if (!serverConfig.url) throw new Error('The JS wrapper currently supports HTTP/StreamableHTTP MCP servers only; mcp_servers.<server>.url is required.');
  const tokenInfo = loadAccessToken(serverName);
  if (!tokenInfo.accessToken) throw new Error(tokenInfo.warning || 'No access token available');

  const headers = {
    ...(serverConfig.headers || {}),
    Authorization: `Bearer ${tokenInfo.accessToken}`,
  };

  const transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), {
    requestInit: { headers },
  });
  const client = new Client({ name: 'dida365-lazy-mcp-js', version: '1.1.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const toolNames = new Set((listed.tools || []).map((t) => t.name));
    if (!toolNames.has(tool)) {
      return { ok: false, tool, server: serverName, error: `MCP tool not available: ${tool}`, available: Array.from(toolNames).filter((name) => DEFAULT_ALLOWED_TOOLS.has(name)).sort() };
    }
    const result = await client.callTool({ name: tool, arguments: toolArgs });
    if (result && result.isError) {
      return { ok: false, tool, server: serverName, error: redact(JSON.stringify(result)) };
    }
    return { ok: true, tool, server: serverName, payload: extractPayload(result), warning: tokenInfo.warning };
  } finally {
    try { await client.close(); } catch (_) {}
    try { await transport.close(); } catch (_) {}
  }
}

async function main() {
  const ns = parseArgs(process.argv.slice(2));
  if (ns.help || !ns.tool) {
    process.stdout.write(usage());
    return ns.help ? 0 : 2;
  }
  const toolArgs = loadToolArgs(ns.argsJson, ns.argsFile);
  const [serverName, serverConfig] = getServerConfig(ns.server);
  const validation = validateToolAllowed(ns.tool, serverConfig);
  if (validation) {
    jsonPrint({ ...validation, tool: ns.tool, server: serverName });
    return 2;
  }
  if (ns.dryRun) {
    jsonPrint({ ok: true, dry_run: true, tool: ns.tool, server: serverName, args: toolArgs, configured: true, transport: serverConfig.url ? 'http' : 'stdio' });
    return 0;
  }
  const result = await callMcp(serverName, serverConfig, ns.tool, toolArgs);
  if (result.ok && !ns.raw) {
    const out = { ok: true, tool: ns.tool, server: result.server, data: compactValue(ns.tool, result.payload, ns.limit) };
    if (result.warning) out.warning = result.warning;
    jsonPrint(out);
  } else if (result.ok && ns.raw) {
    const out = { ok: true, tool: ns.tool, server: result.server, data: result.payload };
    if (result.warning) out.warning = result.warning;
    jsonPrint(out);
  } else {
    jsonPrint(result);
  }
  return result.ok ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  jsonPrint({ ok: false, error: redact(`${err.name || 'Error'}: ${err.message || err}`) });
  process.exit(1);
});
