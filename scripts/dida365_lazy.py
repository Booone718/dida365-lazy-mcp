#!/usr/bin/env python3
"""Lazy Dida365/TickTick MCP wrapper for Hermes Agent.

This script calls the official Dida365/TickTick MCP server from a short-lived
subprocess so the main Hermes Agent session can keep the native MCP server
configured but disabled. It is intended to be used from the dida365-lazy-mcp
skill.

Examples:
  python dida365_lazy.py list_projects
  python dida365_lazy.py create_task --args-json '{"task":{"title":"Test","projectId":"inbox"}}'
  python dida365_lazy.py complete_task --args-json '{"project_id":"inbox","task_id":"..."}'
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

HERMES_HOME = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))).expanduser()
HERMES_REPO = Path(os.environ.get("HERMES_AGENT_REPO", str(HERMES_HOME / "hermes-agent"))).expanduser()
if HERMES_REPO.exists() and str(HERMES_REPO) not in sys.path:
    sys.path.insert(0, str(HERMES_REPO))

DEFAULT_SERVER_CANDIDATES = ("dida365", "ticktick")
DEFAULT_ALLOWED_TOOLS = {
    "list_projects",
    "create_task",
    "batch_add_tasks",
    "search_task",
    "get_task_by_id",
    "update_task",
    "complete_task",
    "complete_tasks_in_project",
    "list_undone_tasks_by_time_query",
    "list_undone_tasks_by_date",
    "get_project_with_undone_tasks",
}

SENSITIVE_RE = re.compile(
    r"(bearer\s+)[a-z0-9._~+\-/]+=*|"
    r"(token|api[_-]?key|secret|password|authorization)(\s*[=:]\s*)[^\s,}\]]+",
    re.IGNORECASE,
)


def redact(text: str) -> str:
    """Redact common credential-like substrings in error text."""

    def repl(match: re.Match[str]) -> str:
        if match.group(1):
            return match.group(1) + "[REDACTED]"
        return f"{match.group(2)}{match.group(3)}[REDACTED]"

    return SENSITIVE_RE.sub(repl, text)


def json_print(obj: Any) -> None:
    print(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def parse_jsonish(text: Any) -> Any:
    """Parse JSON, including concatenated JSON objects returned as text."""
    if not isinstance(text, str):
        return text
    s = text.strip()
    if not s:
        return s
    try:
        return json.loads(s)
    except Exception:
        pass

    decoder = json.JSONDecoder()
    items = []
    idx = 0
    n = len(s)
    while idx < n:
        while idx < n and s[idx].isspace():
            idx += 1
        if idx >= n:
            break
        try:
            obj, end = decoder.raw_decode(s, idx)
        except Exception:
            return text
        items.append(obj)
        idx = end
    return items if items else text


def load_args(args_json: str | None, args_file: str | None) -> dict:
    if args_json and args_file:
        raise SystemExit("Use only one of --args-json or --args-file")
    if args_file:
        text = Path(args_file).expanduser().read_text(encoding="utf-8")
    elif args_json:
        text = args_json
    else:
        return {}
    try:
        value = json.loads(text)
    except Exception as exc:
        raise SystemExit(f"Invalid JSON args: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit("Tool args must be a JSON object")
    return value


def strip_task(task: Any) -> Any:
    if not isinstance(task, dict):
        return task
    keys = [
        "id",
        "taskId",
        "projectId",
        "title",
        "content",
        "desc",
        "status",
        "priority",
        "startDate",
        "dueDate",
        "completedTime",
        "timeZone",
        "isAllDay",
        "kind",
        "url",
        "tags",
        "repeatFlag",
        "items",
    ]
    out = {k: task.get(k) for k in keys if k in task and task.get(k) is not None}
    if isinstance(out.get("items"), list):
        out["items"] = [
            {
                kk: item.get(kk)
                for kk in ["id", "title", "status", "startDate", "dueDate", "isAllDay"]
                if isinstance(item, dict) and kk in item
            }
            for item in out["items"][:20]
        ]
        if len(task.get("items") or []) > 20:
            out["items_truncated"] = len(task.get("items") or []) - 20
    return out


def strip_project(project: Any) -> Any:
    if not isinstance(project, dict):
        return project
    return {
        k: project.get(k)
        for k in ["id", "name", "kind", "viewMode", "closed", "groupId"]
        if k in project
    }


def generic_compact(value: Any, *, limit: int = 80, depth: int = 0) -> Any:
    if depth > 6:
        return "[TRUNCATED_DEPTH]"
    if isinstance(value, dict):
        return {
            str(k): generic_compact(v, limit=limit, depth=depth + 1)
            for k, v in list(value.items())[:120]
        }
    if isinstance(value, list):
        items = [generic_compact(v, limit=limit, depth=depth + 1) for v in value[:limit]]
        if len(value) > limit:
            items.append({"truncated": len(value) - limit})
        return items
    if isinstance(value, str) and len(value) > 2000:
        return value[:2000] + f"...[TRUNCATED {len(value) - 2000} chars]"
    return value


def _unwrap_payload(payload: Any) -> Any:
    if isinstance(payload, dict):
        return payload.get("task") or payload.get("data") or payload.get("result") or payload
    return payload


def _tasks_from_payload(payload: Any) -> list | None:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("tasks", "items", "result", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return None


def compact_value(tool: str, payload: Any, limit: int = 80) -> Any:
    """Return compact, model-friendly JSON for common Dida365 payloads."""
    if tool == "list_projects":
        projects = payload if isinstance(payload, list) else payload.get("result", []) if isinstance(payload, dict) else []
        if isinstance(projects, list):
            return {"projects": [strip_project(p) for p in projects], "count": len(projects)}

    if tool in {"search_task", "list_undone_tasks_by_time_query", "list_undone_tasks_by_date"}:
        tasks = _tasks_from_payload(payload)
        if isinstance(tasks, list):
            return {
                "tasks": [strip_task(t) for t in tasks[:limit]],
                "count": len(tasks),
                "truncated": max(0, len(tasks) - limit),
            }

    if tool == "get_project_with_undone_tasks" and isinstance(payload, dict):
        project = payload.get("project") or payload.get("projectInfo") or payload
        tasks = payload.get("tasks") or payload.get("undoneTasks") or payload.get("result") or []
        return {
            "project": strip_project(project),
            "tasks": [strip_task(t) for t in tasks[:limit]] if isinstance(tasks, list) else tasks,
            "count": len(tasks) if isinstance(tasks, list) else None,
            "truncated": max(0, len(tasks) - limit) if isinstance(tasks, list) else 0,
        }

    if tool in {"get_task_by_id", "create_task", "update_task", "complete_task"}:
        inner = _unwrap_payload(payload)
        if isinstance(inner, list):
            return {"items": [strip_task(x) for x in inner[:limit]], "count": len(inner), "truncated": max(0, len(inner) - limit)}
        return strip_task(inner)

    if tool in {"batch_add_tasks", "complete_tasks_in_project"}:
        tasks = _tasks_from_payload(payload)
        if isinstance(tasks, list):
            return {"items": [strip_task(x) for x in tasks[:limit]], "count": len(tasks), "truncated": max(0, len(tasks) - limit)}
        return generic_compact(payload, limit=limit)

    return generic_compact(payload, limit=limit)


def load_hermes_config() -> dict:
    try:
        from hermes_cli.config import load_config
    except Exception as exc:
        raise SystemExit(f"Failed to import Hermes config loader from {HERMES_REPO}: {exc}") from exc
    return load_config() or {}


def select_server_config(cfg: dict, requested_server: str | None) -> tuple[str, dict]:
    servers = cfg.get("mcp_servers") or {}
    if not isinstance(servers, dict):
        raise SystemExit("No mcp_servers mapping found in Hermes config")

    if requested_server:
        server_cfg = servers.get(requested_server)
        if not isinstance(server_cfg, dict):
            raise SystemExit(f"No mcp_servers.{requested_server} config found in Hermes config")
        return requested_server, copy.deepcopy(server_cfg)

    env_server = os.environ.get("DIDA365_MCP_SERVER") or os.environ.get("TICKTICK_MCP_SERVER")
    if env_server and isinstance(servers.get(env_server), dict):
        return env_server, copy.deepcopy(servers[env_server])

    for candidate in DEFAULT_SERVER_CANDIDATES:
        if isinstance(servers.get(candidate), dict):
            return candidate, copy.deepcopy(servers[candidate])

    for name, server_cfg in servers.items():
        if not isinstance(server_cfg, dict):
            continue
        url = str(server_cfg.get("url") or "")
        if "mcp.dida365.com" in url or "ticktick" in url.lower() or "dida365" in url.lower():
            return name, copy.deepcopy(server_cfg)

    raise SystemExit("No Dida365/TickTick MCP server config found. Expected mcp_servers.dida365 or a server URL containing mcp.dida365.com")


def get_server_config(server: str | None) -> tuple[str, dict]:
    cfg = load_hermes_config()
    server_name, server_cfg = select_server_config(cfg, server)

    # Lazy mode: the main Hermes process can keep this MCP server disabled.
    # This subprocess enables it only for one operation.
    server_cfg["enabled"] = True
    server_cfg.setdefault("auth", "oauth")

    # Keep resources/prompts out of this lazy path unless the user explicitly
    # configured them. They are not needed for task operations and can bloat
    # subprocess discovery output/logs.
    tools_cfg = server_cfg.setdefault("tools", {})
    if isinstance(tools_cfg, dict):
        tools_cfg.setdefault("include", sorted(DEFAULT_ALLOWED_TOOLS))
        tools_cfg.setdefault("resources", False)
        tools_cfg.setdefault("prompts", False)

    return server_name, server_cfg


def sanitize_component(value: str) -> str:
    try:
        from tools.mcp_tool import sanitize_mcp_name_component

        return sanitize_mcp_name_component(value)
    except Exception:
        return re.sub(r"[^A-Za-z0-9_]", "_", str(value or ""))


def validate_tool_allowed(tool: str, server_cfg: dict) -> dict | None:
    if tool not in DEFAULT_ALLOWED_TOOLS:
        return {"ok": False, "error": f"Tool not allowed by lazy wrapper: {tool}", "allowed": sorted(DEFAULT_ALLOWED_TOOLS)}

    tools_filter = server_cfg.get("tools") if isinstance(server_cfg.get("tools"), dict) else {}
    include = tools_filter.get("include") if isinstance(tools_filter, dict) else None
    if include and tool not in set(include):
        return {"ok": False, "error": f"Tool {tool!r} is not included in mcp_servers.<server>.tools.include", "include": include}
    return None


def call_mcp(server: str | None, tool: str, tool_args: dict) -> dict:
    try:
        server_name, server_cfg = get_server_config(server)
    except SystemExit as exc:
        return {"ok": False, "tool": tool, "error": str(exc)}

    validation_error = validate_tool_allowed(tool, server_cfg)
    if validation_error:
        return validation_error

    from tools.mcp_tool import register_mcp_servers, shutdown_mcp_servers
    from tools.registry import registry

    try:
        names = register_mcp_servers({server_name: server_cfg})
        full_name = f"mcp_{sanitize_component(server_name)}_{sanitize_component(tool)}"
        if full_name not in set(names) and registry.get_entry(full_name) is None:
            available = [n for n in names if n.startswith(f"mcp_{sanitize_component(server_name)}_")]
            return {"ok": False, "tool": tool, "error": f"MCP tool not registered: {full_name}", "registered": available}

        raw = registry.dispatch(full_name, tool_args)
        try:
            outer = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            outer = {"result": raw}

        if isinstance(outer, dict) and outer.get("error"):
            return {"ok": False, "tool": tool, "server": server_name, "error": redact(str(outer.get("error")))}

        payload: Any
        if isinstance(outer, dict):
            structured = outer.get("structuredContent")
            if isinstance(structured, dict) and "result" in structured:
                payload = structured.get("result")
            elif "result" in outer:
                payload = parse_jsonish(outer.get("result"))
            else:
                payload = outer
        else:
            payload = outer
        return {"ok": True, "tool": tool, "server": server_name, "payload": payload}
    except Exception as exc:
        return {"ok": False, "tool": tool, "server": server_name, "error": redact(f"{type(exc).__name__}: {exc}")}
    finally:
        try:
            shutdown_mcp_servers()
        except Exception:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Lazy Dida365/TickTick MCP caller for Hermes Agent")
    parser.add_argument("tool", help="Dida365/TickTick MCP tool name without the mcp_<server>_ prefix")
    parser.add_argument("--server", help="Hermes mcp_servers key to use. Defaults to dida365, ticktick, or URL autodetect.")
    parser.add_argument("--args-json", help="JSON object passed to the MCP tool")
    parser.add_argument("--args-file", help="Path to JSON file passed to the MCP tool")
    parser.add_argument("--raw", action="store_true", help="Return un-compacted payload")
    parser.add_argument("--dry-run", action="store_true", help="Validate args and config only; do not call MCP")
    parser.add_argument("--limit", type=int, default=80, help="Max list items in compact output")
    ns = parser.parse_args()

    tool_args = load_args(ns.args_json, ns.args_file)
    if ns.dry_run:
        try:
            server_name, cfg = get_server_config(ns.server)
            validation_error = validate_tool_allowed(ns.tool, cfg)
            transport = "http" if cfg.get("url") else "stdio" if cfg.get("command") else "unknown"
        except SystemExit as exc:
            json_print({"ok": False, "tool": ns.tool, "dry_run": True, "error": str(exc)})
            return 1
        if validation_error:
            json_print({**validation_error, "tool": ns.tool, "dry_run": True, "server": server_name})
            return 2
        json_print({"ok": True, "dry_run": True, "tool": ns.tool, "server": server_name, "args": tool_args, "configured": True, "transport": transport})
        return 0

    result = call_mcp(ns.server, ns.tool, tool_args)
    if result.get("ok") and not ns.raw:
        result = {"ok": True, "tool": ns.tool, "server": result.get("server"), "data": compact_value(ns.tool, result.get("payload"), limit=ns.limit)}
    elif result.get("ok") and ns.raw:
        result = {"ok": True, "tool": ns.tool, "server": result.get("server"), "data": result.get("payload")}
    json_print(result)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
