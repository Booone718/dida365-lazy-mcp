# dida365-lazy-mcp

[English](README.md) | 简体中文

一个轻量的 Dida365 / TickTick MCP 调用封装。它既可以作为独立的 Node.js 命令使用，也可以作为 Hermes Agent skill 使用。

这个项目解决的问题很具体：不要把完整的 Dida365 MCP 工具 schema 放进每一次 AI Agent 对话里。平时不加载，只有真正需要操作任务时，才通过本地命令临时调用官方 MCP endpoint，并返回压缩后的 JSON。

## 适合谁用

适合这些场景：

- 你想让 Claude Code、Codex、Cursor 或其他 AI Agent 操作滴答清单 / TickTick；
- 你不想在主对话里长期暴露一大组 `mcp_dida365_*` 工具 schema；
- 你希望通过一个普通命令按需调用官方 MCP；
- 你正在使用 Hermes Agent，并希望保留 native MCP 的授权能力，但默认不把 schema 注入主会话。

不适合这些场景：

- 你需要完整 OAuth 登录闭环，包括浏览器登录、refresh token、logout；
- 你需要官方 MCP 的全部工具，而不是任务管理相关的精简子集；
- 你想要一个通用 MCP 客户端。本项目只围绕 Dida365 / TickTick 的任务操作做封装。

## 快速开始：非 Hermes 用户

要求：

- Node.js 18+
- 可以访问 `https://mcp.dida365.com`
- 一个有效的 Dida365 / TickTick MCP access token

独立 Node.js 路径不需要安装 Hermes，也不需要 `~/.hermes/config.yaml`。如果本机有 Hermes 风格的配置或 token 文件，wrapper 会尝试兼容读取；如果没有，就默认连接官方 endpoint。

安装：

```bash
git clone https://github.com/Booone718/dida365-lazy-mcp.git
cd dida365-lazy-mcp
npm install
npm run doctor
```

当前开源版还没有内置浏览器 OAuth 登录命令。你需要在本机提供 access token。

方式一：环境变量

```bash
export DIDA365_MCP_ACCESS_TOKEN="..."
```

方式二：本地 `.env` 文件

```bash
cp .env.example .env
# 在本机编辑 .env，填入 DIDA365_MCP_ACCESS_TOKEN
# 不要提交 .env，也不要把 token 粘贴到聊天里
```

只读验证：

```bash
npm run list-projects:dry-run
npm run list-projects
```

验证写入 payload，但不真正创建任务：

```bash
npm run create-task:dry-run
```

## 常用命令

```bash
npm run doctor
node --no-warnings scripts/js/doctor.mjs --json
npm run list-projects:dry-run
npm run list-projects
npm run create-task:dry-run
```

直接调用 wrapper：

```bash
node scripts/js/dida365_lazy.mjs list_projects
node scripts/js/dida365_lazy.mjs create_task --dry-run --args-json '{"task":{"title":"Task title","projectId":"inbox","status":0,"kind":"TEXT"}}'
```

Shell wrapper：

```bash
./scripts/dida365-lazy-js.sh list_projects
```

## 给 AI coding agent 使用

如果你把这个仓库交给 Claude Code、Codex、Cursor 或其他 AI coding agent，可以让它按这个流程做：

1. 先读 `README.md` / `README.zh-CN.md` 和 `AGENTS.md`；
2. 运行 `npm install`；
3. 运行 `npm run doctor`；
4. 如果缺少授权，只提示用户在本机配置 token；
5. 不要要求用户把 token 粘贴到聊天里；
6. 授权可用后，先运行 `npm run list-projects` 做只读验证；
7. 写操作前先跑 `--dry-run`。

更多说明见：`references/other-clients.md`。

## Hermes Agent 用法

Hermes 用户可以继续保留 native Dida365 / TickTick MCP server 配置，但把它设为 disabled。这样主会话不会加载 `mcp_dida365_*` 工具 schema，需要操作任务时再调用本项目的 wrapper。

推荐配置：

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

Python wrapper 更适合 Hermes 用户，因为它可以复用 Hermes 的 MCP client、OAuth token storage 和配置加载逻辑：

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
"$SKILL_DIR/scripts/dida365-lazy.sh" list_projects
```

Node.js wrapper 在 Hermes 环境里也能用：

```bash
SKILL_DIR="$HOME/.hermes/skills/productivity/dida365-lazy-mcp"
npm install --prefix "$SKILL_DIR/scripts/js"
"$SKILL_DIR/scripts/dida365-lazy-js.sh" list_projects
```

`SKILL_DIR` 不是固定路径，只是一个 shell 变量，指向你实际安装这个包的位置。

## 当前支持的 lazy tools

wrapper 有一层工具白名单，目前只开放任务管理相关的精简子集：

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

这样做的目的有两个：

1. 避免误调用与任务管理无关的能力；
2. 控制输出规模，保留 lazy loading 带来的 token 节省。

## 授权现状

这是最小可开源版，可以脱离 Hermes 运行，但还不是完整 OAuth 客户端。

目前没有：

```bash
npm run auth
```

后续完整版本应该补上：

- OAuth PKCE browser login
- 本地 token storage
- refresh token flow
- logout
- token 过期后的重新授权提示

路线图见：`references/open-source-readiness.md`。

## 安全规则

- 不要打印、记录、提交或总结 OAuth token、Bearer token、API key、client secret。
- 不要提交 `.env` 或 token 文件。
- 写操作前优先使用 `--dry-run`。
- 默认使用 compact JSON 输出。
- 不调试问题时，不要使用 `--raw`。

更多说明见：`references/security.md`。

## 文件说明

- `package.json`：根目录 npm scripts，适合独立 Node.js 使用。
- `AGENTS.md`：给 Claude Code、Codex、Cursor 等 AI Agent 的操作说明。
- `.env.example`：本地 token 配置模板。
- `SKILL.md`：Hermes Agent skill 说明。
- `scripts/js/dida365_lazy.mjs`：Node.js wrapper，使用官方 MCP TypeScript SDK。
- `scripts/js/doctor.mjs`：安装与授权诊断命令。
- `scripts/dida365-lazy-js.sh`：Node.js wrapper 的 shell 入口。
- `scripts/dida365_lazy.py`：复用 Hermes MCP client 的 Python wrapper。
- `scripts/dida365-lazy.sh`：使用 Hermes venv Python 的 shell 入口。
- `references/setup.md`：安装和验证说明。
- `references/other-clients.md`：Claude Code、Codex、Cursor 等客户端说明。
- `references/open-source-readiness.md`：完整 OAuth 开源体验路线图。
- `references/payload-examples.md`：常见 JSON payload。
- `references/security.md`：凭据和输出安全说明。
- `templates/`：JSON payload 模板。

## 个人规则放哪里

这个仓库保持通用，不放个人默认项目名、优先级规则、时间偏好或标签策略。

如果你有自己的任务捕获规则，建议放到单独的 agent instruction / overlay skill 里，再调用这个 wrapper 执行实际的 Dida365 / TickTick 操作。

## License

MIT
