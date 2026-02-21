# Cocos MCP Server（Next Runtime）

> 面向 Cocos Creator 3.8.x 的标准 MCP 扩展。仓库已在 `2.0.0` 完成终态清理：仅保留单一 MCP 主链路，不再包含 legacy 工具与旁路接口。

## 版本说明（2.0.0 Breaking Changes）
- 移除非标准 HTTP 接口：`/api/*`、`/api/tools`。
- 移除工具管理配置体系与相关消息接口（`getToolManagerState`、`updateToolStatus*` 等）。
- 移除 `contributions.scene` 旁路方法暴露（`createNewScene/addComponentToNode/...`）。
- MCP 保留并强化标准能力：`POST/GET/DELETE /mcp`、`MCP-Session-Id` 生命周期、`tools/list`、`tools/call`、`get_tool_manifest`、`get_trace_by_id`、`get_capability_matrix`。

## 与原项目的关系（保留指引）
本仓库基于原项目持续演进，原作者为 **LiDaxian**。本次重构目标是降低维护成本、提升协议一致性与自动化回归能力。

原项目发布渠道：
- Cocos 商城页面：<https://store.cocos.com/app/detail/7941>

## 快速开始

### 1. 安装到 Cocos 工程
```bash
<你的工程>/extensions/cocos-mcp-server
```

### 2. 安装依赖并构建
```bash
npm install
npm run build
```

### 3. 在 Cocos Creator 中启动扩展
1. 打开工程
2. 打开扩展面板 `Cocos MCP Server`
3. 启动 MCP HTTP 服务（默认 `http://127.0.0.1:3000/mcp`）

## MCP 客户端接入

### Claude / 通用 HTTP MCP
```json
{
  "mcpServers": {
    "cocos-creator": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### Cursor（或兼容 MCP 的 IDE）
```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### Codex CLI（stdio 桥接）
```bash
codex -C "/你的项目根目录" \
  -c 'mcp_servers.cocos_creator.command="node"' \
  -c 'mcp_servers.cocos_creator.args=["/你的项目根目录/extensions/cocos-mcp-server/dist/stdio-http-bridge.js","--url","http://127.0.0.1:3000/mcp"]'
```

## 协议行为（Next）
- `POST /mcp`：单条 JSON-RPC 请求（不支持 batch）
- `GET /mcp`：SSE（Streamable HTTP）
- `DELETE /mcp`：关闭会话
- `initialize` 成功后，后续请求必须携带 `MCP-Session-Id`
- `tools/call` 统一返回 `structuredContent`（业务错误使用 `E_*`）

## 能力域
- 场景层级与生命周期：`scene_*`
- Scene View：`scene_view_*`
- 组件属性与高级操作：`component_*`
- 资产依赖与资产管理：`asset_*`
- Prefab 生命周期与资产级工作流：`prefab_*`
- UI 自动化：`ui_*`
- 诊断与运行控制：`diagnostic_*`、`runtime_*`
- 工程/偏好/程序信息：`project_*`、`preferences_*`、`information_*`、`program_*`

## 开发命令
```bash
npm run build
npm run test:mcp
npm run smoke:mcp:online
npm run mcp:stdio
```

## 在线联调
### 一键重启目标工程
```bash
./scripts/restart-cocos-project.sh --project /Users/blue/Developer/CocosProjects/HelloWorld
```

### 冒烟验证
```bash
npm run smoke:mcp:online
```

## 目录结构（终态）
```text
source/
  mcp-server.ts               # MCP 服务入口（Next runtime）
  next/                       # 能力探测、协议分发、工具实现
  mcp/                        # JSON-RPC、生命周期、会话、SSE
  panels/default/             # 最小化面板（服务控制）
  settings.ts
  types/
scripts/
  clean-dist.js
  mcp-online-smoke.js
  restart-cocos-project.sh
```

## 文档与归档
- 主文档：`README.md`、`README.EN.md`
- 历史功能导览已归档：`docs/archive/FEATURE_GUIDE_CN.md`、`docs/archive/FEATURE_GUIDE_EN.md`

## 已知限制
- Cocos 扩展不会在当前进程热加载最新 `dist`：改代码后需重启 Cocos 实例。
- 工具数量受能力矩阵门控，不同工程/状态下 `tools/list` 结果会变化。

## 质量门槛
```bash
npm run build
npm run test:mcp
```

涉及在线联调能力时，额外执行：
```bash
npm run smoke:mcp:online
```
