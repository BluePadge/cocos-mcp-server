## 后端文档
`backend/mcp-transport.md` - MCP 传输与生命周期约束；修改 `/mcp` 路由、会话管理、JSON-RPC 分发、SSE/stdio 时必读

## 当前任务文档
（暂无）

## 已完成任务文档
`workflow/done/260212-mcp-spec-compliance-without-tool-logic-change.md` - 在不改工具业务逻辑前提下完成 MCP 协议规范化改造
`workflow/done/260212-stdio-http-bridge-for-codex.md` - Codex stdio-HTTP 桥接历史任务（已被规范化版本覆盖）

## 全局重要记忆
- `cocos-mcp-server` 当前支持双通道：`POST /mcp`（JSON-RPC request/response）与 `GET /mcp`（SSE streamable-http）。
- `initialize` 成功后，后续非 initialize 的 `/mcp` 请求必须带 `MCP-Session-Id`，缺失或无效返回 `400`。
- 会话生命周期为 `awaiting_initialized_notification -> ready`；`notifications/initialized` 仅作状态确认，不返回 JSON-RPC body。
- `notifications/*` 在服务端保持 no-op 兼容，不应被当作未知方法报错。
- `tools/call` 的业务失败通过 `result.isError=true` 表达；协议错误通过 JSON-RPC `error`（`-32700/-32600/-32601/-32602/-32603`）表达。
- `source/stdio-http-bridge.ts` 采用标准换行协议（每行一条 JSON-RPC 消息），不再使用 `Content-Length` 帧。
