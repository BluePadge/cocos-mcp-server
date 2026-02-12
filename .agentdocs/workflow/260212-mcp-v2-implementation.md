# 任务：MCP V2 代码重构实施（无兼容包袱）

## 背景
- 用户已确认按 `backend/mcp-v2-spec-patch.md` 进入代码实施。
- 当前实现已具备 MCP 基础合规能力，但仍缺少 V2 的核心治理能力：
  - 统一业务响应与标准业务错误码
  - V2 manifest/工具分层
  - workflow 工具
  - 单消息 `POST /mcp`（禁用 batch）

## 目标
- 在不引入新测试框架的前提下，完成 V2 第一轮可运行重构。
- 以“可跑通 + 可回归”为优先，先落地框架与关键工具。

## 分阶段
- [x] 阶段 1：读取现状与约束，确定模块拆分方案
- [x] 阶段 2：实现 V2 工具服务（统一响应/错误/manifest/trace）
- [x] 阶段 3：接入 `mcp-server`（单消息 POST、DELETE 会话、V2 tools/list/tools/call）
- [x] 阶段 4：实现 6 个 workflow 工具（支持 dryRun 与 stage 错误）
- [x] 阶段 5：更新与补充测试（协议、manifest、workflow）
- [x] 阶段 6：更新 `.agentdocs` 与对外说明
- [x] 阶段 7：`build + test:mcp` 全量验证

## TODO
- [x] 新增 `source/mcp/v2-models.ts`
- [x] 新增 `source/mcp/v2-errors.ts`
- [x] 新增 `source/mcp/v2-tool-service.ts`
- [x] 重构 `source/mcp-server.ts` 对接 V2 工具层
- [x] 调整 `source/test/mcp-protocol-compliance-test.ts`（禁用 batch）
- [x] 新增 `source/test/mcp-v2-manifest-test.ts`
- [x] 新增 `source/test/mcp-v2-workflow-test.ts`
- [x] 更新 `package.json` 的 `test:mcp` 执行链

## 验收标准
- `POST /mcp` 对 batch 返回 `-32600`。
- `tools/list` 返回 V2 工具清单（含 `_meta/layer`）。
- `tools/call` 返回 `structuredContent`，业务失败使用 `result.isError`。
- `get_tool_manifest` 可查询单工具 manifest。
- 6 个 workflow 工具至少具备可执行骨架与 dryRun。
