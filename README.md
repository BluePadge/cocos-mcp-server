# Cocos MCP Server

面向 **Cocos Creator 3.8.x** 的标准 MCP（Model Context Protocol）扩展。  
本项目在 `v2.0.0` 后收敛为单一 Next Runtime：仅保留标准 MCP 链路，便于自动化、回归测试和长期维护。

## 目录
- [项目定位](#项目定位)
- [核心能力](#核心能力)
- [环境要求](#环境要求)
- [安装与启动](#安装与启动)
- [MCP 客户端接入](#mcp-客户端接入)
- [协议与行为](#协议与行为)
- [关键工具语义](#关键工具语义)
- [开发与测试](#开发与测试)
- [常见问题](#常见问题)
- [Fork 来源与致谢](#fork-来源与致谢)

## 项目定位
- 提供 Cocos Creator 编辑器能力的 MCP 化封装。
- 以 `tools/list` 与 `tools/call` 为中心，统一暴露场景、组件、资源、Prefab、UI、诊断与运行控制能力。
- 默认遵循“能力探测后暴露工具”（capability-gated）策略，减少不同工程状态下的误调用。

## 核心能力
当前实现覆盖以下工具域（`tools/list` 动态可见）：

- 场景层级与生命周期：`scene_*`
- Scene View：`scene_view_*`
- 组件属性与高级调用：`component_*`
- 资源与依赖：`asset_*`
- Prefab 生命周期：`prefab_*`
- UI 自动化：`ui_*`
- 诊断与日志：`diagnostic_*`
- 运行控制：`runtime_*`
- 工程与偏好配置：`project_*`、`preferences_*`、`information_*`、`program_*`

## 环境要求
- Cocos Creator：`>= 3.8.6`（建议 `3.8.8`）
- Node.js：建议 `18+`
- npm：建议 `9+`

## 安装与启动
### 1. 放入 Cocos 工程扩展目录
```bash
<你的项目>/extensions/cocos-mcp-server
```

### 2. 安装依赖并构建
```bash
npm install
npm run build
```

### 3. 在 Cocos Creator 中启动扩展
1. 打开目标工程。
2. 打开扩展面板 `Cocos MCP Server`。
3. 启动 MCP HTTP 服务（默认 `http://127.0.0.1:3000/mcp`）。

## MCP 客户端接入
### 通用 HTTP MCP（`mcpServers` 配置格式）
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

### Cursor（或其他兼容 MCP 的 IDE）
```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### Codex CLI（推荐，标准 HTTP 直连）
```bash
codex mcp add cocos-creator --url http://127.0.0.1:3000/mcp
```

查看配置：
```bash
codex mcp list
codex mcp get cocos-creator
```

## 协议与行为
项目遵循标准 MCP（Streamable HTTP）语义：

- `POST /mcp`：单条 JSON-RPC 请求（不支持 batch）
- `GET /mcp`：SSE
- `DELETE /mcp`：关闭会话
- `GET /health`：扩展健康检查

会话规则：
- `initialize` 成功后，后续请求必须携带 `MCP-Session-Id`。
- `tools/call` 统一返回 `structuredContent`。
- 业务失败走 `E_*` 错误码，不与 JSON-RPC 协议错误混用。

## 关键工具语义
- `scene_open_scene`
  - 当前实现走官方 `asset-db.open-asset` 主路径。
  - 仅接受 `sceneUrl`，不再支持旧版 `verifyTimeoutMs/verifyIntervalMs`。

- `prefab_query_nodes_by_asset_uuid`
  - 语义是“引用该 Prefab 的节点”，可能包含非实例节点。
  - 如需仅实例，请使用 `prefab_query_instance_nodes_by_asset_uuid`。

- `diagnostic_get_log_file_info` / `diagnostic_check_compile_status`
  - 不传 `projectPath` 时，默认优先使用当前打开工程路径定位 `temp/logs/project.log`。

## 开发与测试
常用命令：
```bash
npm run build
npm run test:mcp
npm run smoke:mcp:online
```

在线联调建议流程：
```bash
./scripts/restart-cocos-project.sh --project /Users/blue/Developer/CocosProjects/HelloWorld
npm run smoke:mcp:online
```

## 常见问题
- Q: 改完代码为什么工具行为没变？
  - A: Cocos 扩展不会热加载当前进程中的 `dist`，改动后请重启 Cocos 实例。

- Q: 为什么不同工程下 `tools/list` 数量不同？
  - A: 当前实现基于能力探测动态暴露工具，受工程状态与编辑器可用能力影响。

## Fork 来源与致谢
本仓库基于原项目持续演进，原作者为 **LiDaxian**。  
当前版本围绕标准 MCP 协议、能力分层和自动化回归能力进行了重构。

原项目发布渠道：
- Cocos 商城页面：[https://store.cocos.com/app/detail/7941](https://store.cocos.com/app/detail/7941)
