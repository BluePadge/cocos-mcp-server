## 本仓库测试与验证要求

### 适用范围
- 适用于本仓库所有 TypeScript 代码改动（`source/`、`README` 中命令说明、`.agentdocs` 任务文档除外）。

### 必跑检查
- `npm run build`
- `npm run test:mcp`

### 约束
- 不引入新的测试框架；测试基于 Node 原生能力与现有构建链。
- 修改 MCP 协议/传输行为时，必须同时更新：
  - `.agentdocs/backend/mcp-transport.md`
  - `.agentdocs/index.md`
  - 对外 README 的相关接入说明（中英文）
