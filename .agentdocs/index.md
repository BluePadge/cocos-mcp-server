## 后端文档
`backend/mcp-transport.md` - MCP 传输与生命周期约束；修改 `/mcp` 路由、会话管理、JSON-RPC 分发、SSE/stdio 时必读
`backend/mcp-v2-spec-patch.md` - 面向调用方的 MCP V2 规格补丁（无兼容包袱版本），涉及工具分层、命名、参数、响应、workflow、manifest、测试与 DoD
`backend/coplay-cocos-capability-map.md` - `coplay_mcp` 到 Cocos 的能力映射、分层策略与重写边界；设计/重写 Next 工具层时必读

## 当前任务文档
`workflow/260212-mcp-v2-spec-patch.md` - 将调用方 v1 Draft 重写为 MCP-first 的 V2 可实施规格补丁
`workflow/260212-mcp-v2-implementation.md` - 按 V2 规格进入代码重构实施（协议层、manifest、workflow、测试）
`workflow/260220-coplay-cocos-mcp-rebuild.md` - 按 coplay 能力目标重写 Cocos MCP（新实现），已推进至第三轮能力域迁移

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
- 新增 `source/next` 作为“绿地重写”骨架：协议层（`protocol`）、能力层（`capability`）、工具层（`tools`）分离，避免把兼容逻辑散落在工具内部。
- Next 架构的工具可见性由能力矩阵驱动：先 probe（official/extended/experimental），再暴露工具，默认不直接暴露未探测通过的 experimental 方法。
- Next 第二轮工具迁移采用按域拆分：`scene-hierarchy`、`component-property`、`asset-dependency`，并以 `official-tools.ts` 统一聚合。
- Next 第三轮已补齐 `scene-lifecycle` 与 `project-runtime` 能力域，并扩展 `asset-dependency` 的资产管理子能力（移动/解析/重导入/刷新/打开）。
- `source/mcp-server.ts` 已切换为 Next runtime 主入口：`tools/list` / `tools/call` / `get_tool_manifest` / `get_trace_by_id` 均由 Next router 处理（不再走 legacy `V2ToolService`）。
- MCP 端到端测试已统一为 `nextRuntimeFactory` 注入模式，用于在 Node 环境稳定验证 Next-only 协议链路。
- 能力探测已处理写探测副作用：`scene.create-node` probe 在成功后会自动回滚删除探测节点，避免污染当前场景。
- `@cocos/creator-types@3.8.7` 已声明资产依赖查询：`asset-db.query-asset-users` 与 `asset-db.query-asset-dependencies`，可作为官方资产关系能力基线。
- 升级到 `@cocos/creator-types@3.8.7` 后，`builder.open` 调用需显式传 `panel` 参数（如 `'default'`），否则 TypeScript 编译报参错。
- HelloWorld 在线实测中，Next 工具可见数已从 `17` 提升到 `36`，新增域工具可正常调用。
