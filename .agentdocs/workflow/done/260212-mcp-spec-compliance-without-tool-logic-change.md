# 任务：MCP 规范化改造（不改工具功能实现）

## 背景
- 目标是在不修改 `source/tools/*` 业务逻辑与参数语义的前提下，将协议层升级为规范 MCP 实现。
- 规范基线固定为 `MCP 2025-11-25`。
- 传输范围覆盖 `POST /mcp` + `GET /mcp (SSE)` + `stdio -> HTTP` 桥接。

## 约束与边界
- 不重写工具业务实现，不改变工具集合。
- 不引入第三方测试框架。
- 仅允许协议包装、会话状态、错误语义、传输层与测试改造。

## 分阶段计划与状态
- [x] 阶段 0：创建任务文档与索引登记
- [x] 阶段 1：抽离协议核心层（`source/mcp/*`）
- [x] 阶段 2：实现严格生命周期与会话状态机
- [x] 阶段 3：补全 Streamable HTTP（SSE）
- [x] 阶段 4：修正错误码与工具失败语义
- [x] 阶段 5：stdio 桥接改为严格换行协议
- [x] 阶段 6：新增协议/传输测试并接入 `test:mcp`
- [x] 阶段 7：更新 README 与 `.agentdocs` 迁移说明
- [x] 阶段 8：人工验收后归档到 `workflow/done/`

## 已完成改动
- 新增 `source/mcp/errors.ts`
- 新增 `source/mcp/messages.ts`
- 新增 `source/mcp/jsonrpc.ts`
- 新增 `source/mcp/lifecycle.ts`
- 新增 `source/mcp/session-store.ts`
- 新增 `source/mcp/streamable-http.ts`
- 重构 `source/mcp-server.ts`
- 重写 `source/stdio-http-bridge.ts`（标准换行）
- 新增 `source/test/mcp-protocol-compliance-test.ts`
- 新增 `source/test/mcp-streamable-http-test.ts`
- 新增 `source/test/mcp-stdio-bridge-test.ts`
- 更新 `package.json` 新增 `test:mcp`

## 验证记录
- `npm run build`：通过
- `npm run test:mcp`：通过
  - `mcp-protocol-compliance-test: PASS`
  - `mcp-streamable-http-test: PASS`
  - `mcp-stdio-bridge-test: PASS`

## 验收清单
- [x] 非法 JSON 返回 `-32700`
- [x] 空 batch 返回 `-32600`
- [x] notification-only batch 返回 `202`
- [x] 混合 batch 仅返回 request 响应
- [x] 未就绪会话调用工具返回生命周期错误
- [x] `initialize` 返回 `MCP-Session-Id`
- [x] 非 initialize 缺失会话头返回 `400`
- [x] 未知方法返回 `-32601`
- [x] `tools/call` 参数错误返回 `-32602`
- [x] 工具业务失败映射到 `result.isError=true`
- [x] `GET /mcp` SSE 可建立并释放连接
- [x] stdio 严格换行链路可用

## 结论
- 用户已确认“测试通过且连接建立正确”，本任务按流程进入归档状态。
