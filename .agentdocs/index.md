## 后端文档
`backend/mcp-transport.md` - MCP 传输与生命周期约束；修改 `/mcp` 路由、会话管理、JSON-RPC 分发、SSE/stdio 时必读
`backend/mcp-v2-spec-patch.md` - 面向调用方的 MCP V2 规格补丁（无兼容包袱版本），涉及工具分层、命名、参数、响应、workflow、manifest、测试与 DoD

## 当前任务文档
`workflow/260212-mcp-v2-spec-patch.md` - 将调用方 v1 Draft 重写为 MCP-first 的 V2 可实施规格补丁
`workflow/260212-mcp-v2-implementation.md` - 按 V2 规格进入代码重构实施（协议层、manifest、workflow、测试）

## 已完成任务文档
`workflow/done/260212-mcp-spec-compliance-without-tool-logic-change.md` - 在不改工具业务逻辑前提下完成 MCP 协议规范化改造
`workflow/done/260212-stdio-http-bridge-for-codex.md` - Codex stdio-HTTP 桥接历史任务（已被规范化版本覆盖）

## 全局重要记忆
- `cocos-mcp-server` 当前 MCP 传输为：`POST /mcp`（单 JSON-RPC 消息）、`GET /mcp`（SSE）、`DELETE /mcp`（关闭会话）。
- `POST /mcp` 不再支持 batch，收到数组消息统一返回 `-32600`。
- `initialize` 成功后，后续非 initialize 的 `/mcp` 请求必须带 `MCP-Session-Id`，缺失或无效返回 `400`。
- 会话生命周期为 `awaiting_initialized_notification -> ready`；`notifications/initialized` 仅作状态确认，不返回 JSON-RPC body。
- `tools/list` 返回 V2 工具定义，包含 `_meta.layer/category/safety/idempotent/supportsDryRun`。
- `tools/call` 统一返回 `structuredContent`；业务失败通过 `result.isError=true + structuredContent.error(E_*)`，协议错误仍使用 JSON-RPC `error`。
- 诊断方法：`get_tool_manifest`（查工具 manifest）与 `get_trace_by_id`（查最近调用轨迹）。
- `source/stdio-http-bridge.ts` 采用标准换行协议（每行一条 JSON-RPC 消息），不使用 `Content-Length` 帧，并自动透传 `MCP-Session-Id`。
