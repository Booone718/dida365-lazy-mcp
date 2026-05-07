# Payload Examples

These examples use the official Dida365/TickTick MCP payload shapes as passed through the lazy wrapper.

## Create a basic task

```json
{
  "task": {
    "title": "Review discharge report template",
    "projectId": "inbox",
    "status": 0,
    "kind": "TEXT"
  }
}
```

## Create a scheduled task

```json
{
  "task": {
    "title": "Submit weekly project update",
    "content": "Prepare the weekly status summary and send it to the team.",
    "projectId": "inbox",
    "priority": 3,
    "startDate": "2026-05-07T09:00:00+08:00",
    "dueDate": "2026-05-07T18:00:00+08:00",
    "timeZone": "Asia/Shanghai",
    "isAllDay": false,
    "status": 0,
    "kind": "TEXT"
  }
}
```

## Search tasks

```json
{
  "query": "weekly project update"
}
```

## Get task by ID

```json
{
  "project_id": "<projectId>",
  "task_id": "<taskId>"
}
```

## Complete a task

```json
{
  "project_id": "<projectId>",
  "task_id": "<taskId>"
}
```

## List unfinished tasks by predefined query

```json
{
  "query_command": "today"
}
```

Common query commands include `today`, `last24hour`, `last7day`, `tomorrow`, `next24hour`, and `next7day`.

## List unfinished tasks by date range

```json
{
  "search": {
    "startDate": "2026-05-07T00:00:00+08:00",
    "endDate": "2026-05-08T00:00:00+08:00"
  }
}
```

Keep ranges small to avoid large outputs.
