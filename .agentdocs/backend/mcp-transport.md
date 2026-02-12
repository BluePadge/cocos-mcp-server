# MCP 传输与生命周期约束

## 适用范围
- 修改 `/mcp` 路由行为
- 修改 JSON-RPC 分发与错误码
- 调整初始化握手（`initialize` / `notifications/initialized`）
- 修改 SSE 或 stdio 桥接逻辑

## 当前实现约束（2026-02-12）

### 1) HTTP 路由
- `POST /mcp`：JSON-RPC request/notification 入口。
- `GET /mcp`：
  - `Accept: text/event-stream`：建立 SSE 通道；
  - 非 SSE：返回服务信息（`200`）。

### 2) 会话头与生命周期
- `initialize` 必须是 request（带 `id`），成功后服务端返回 `MCP-Session-Id` header。
- 除 `initialize` 外，所有 `/mcp` 请求必须携带 `MCP-Session-Id`：
  - 缺失或无效 => HTTP `400`。
- 会话阶段：
  - `awaiting_initialized_notification`
  - `ready`
- `notifications/initialized` 仅用于将会话切换到 `ready`，不返回 JSON-RPC 响应体。

### 3) JSON-RPC 兼容约束
- 解析失败 => `-32700`
- 非法请求（含空 batch）=> `-32600`
- 未知方法 => `-32601`
- 参数错误 / 未知工具 => `-32602`
- 服务器内部异常 => `-32603`
- 对 response 消息（客户端回包）应忽略，不产生响应。
- notification-only 请求（含 batch）返回 `202` 且无 body。

### 4) 工具结果语义
- 工具协议成功：`result.content` 返回文本结果。
- 工具业务失败（如 `{ success: false }`）：
  - 仍返回 `result`，并设置 `result.isError = true`；
  - 不应误用 JSON-RPC `error`。

### 5) SSE 约束
- 仅 `ready` 会话允许建立 SSE。
- 支持同会话多连接。
- 连接关闭时必须及时释放，避免泄漏。
- 空闲连接发送心跳注释帧（`: heartbeat`）。

### 6) stdio 桥接约束
- `stdio-http-bridge` 输入输出均为标准换行协议：每行一条 JSON-RPC 消息。
- 桥接不再解析或输出 `Content-Length` 帧。
- notification 不期待响应；request 在上游错误时生成 JSON-RPC `error` 回包。

## 设计说明
- 插件现定位为“规范 MCP server + 兼容本地 Cocos 工具执行器”。
- 工具业务逻辑应保持稳定，协议层负责标准化校验、会话和错误语义。
- 如需未来支持更多 MCP 能力（resources/prompts 等），应在 `source/mcp/*` 层扩展，不要把协议逻辑回灌进工具模块。
