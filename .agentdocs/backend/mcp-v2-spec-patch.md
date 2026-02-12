# MCP 服务器规范化需求规格（V2 补丁版，可直接实施）

版本：`v2.0-draft`  
状态：`Draft`  
适用项目：`ArrowPuzzle-Coco`  
日期：`2026-02-12`  
基线规范：`MCP 2025-11-25`

## 0. 与 v1 Draft 的关键差异（本补丁优先级最高）
1. 本版不考虑向后兼容：不保留旧工具别名，不走 `active -> deprecated -> removed` 迁移周期。
2. 传输遵循 MCP 2025-11-25：`POST /mcp` 使用单 JSON-RPC 消息；不支持 batch。
3. 错误模型强制分层：
   - 协议错误：JSON-RPC `error`（`-32700/-32600/-32601/-32602/-32603`）。
   - 业务错误：`result.isError=true` + 业务错误码（`E_*`）。
4. 写操作幂等字段改为 `idempotencyKey`（替代 `requestId`）。
5. 工具返回必须包含 `structuredContent`，并为 `core/workflow` 提供 `outputSchema`。

## 1. 目标与范围
1. 将 MCP 从“工具清单”升级为“可预测、可组合、可回归验证”的标准能力层。
2. 降低 AI 选错工具、参数误用、调用链过长的问题。
3. 覆盖：工具定义、命名、参数、返回结构、错误码、workflow、manifest、测试与发布。
4. 非目标：本阶段不引入 resources/prompts 新能力，仅聚焦 tools。

## 2. 设计原则（强制）
1. 协议层与业务层完全分离，禁止混用错误语义。
2. 读写分离明确，写操作必须支持 `dryRun` 或在 manifest 明确 `supportsDryRun=false`。
3. 同类工具参数命名一致，避免同义多名。
4. 返回结构统一，错误信息必须可程序化处理。
5. 高频任务优先使用 workflow 工具减少调用链。

## 3. 传输与生命周期规范（MCP-first，强制）
### 3.1 HTTP
1. `POST /mcp`：仅接收单 JSON-RPC 消息；收到 batch 直接 `-32600`。
2. `GET /mcp` + `Accept: text/event-stream`：建立 SSE。
3. 非 `initialize` 的 HTTP 请求必须携带 `MCP-Session-Id`，缺失或无效返回 `HTTP 400`。
4. 建议支持 `DELETE /mcp` + `MCP-Session-Id` 关闭会话。

### 3.2 生命周期
1. 首个请求必须为 `initialize`（request，必须带 `id`）。
2. 客户端发送 `notifications/initialized` 后会话状态从 `awaiting_initialized_notification` 进入 `ready`。
3. `ready` 前调用业务方法返回 `-32600`（生命周期非法）。

### 3.3 stdio
1. 采用标准 newline-delimited JSON-RPC（每行一条消息）。
2. 不使用 `Content-Length` 帧头。

## 4. 工具分层规范
| 层级 | 说明 | 默认可见性 | 约束 |
|---|---|---|---|
| `core` | 高频、低歧义、稳定接口 | 默认暴露 | 必须含 `outputSchema`、示例、测试 |
| `advanced` | 低频、专业、可替代能力 | 可配置暴露 | 必须标注 `riskLevel` 与前置条件 |
| `internal` | 调试/迁移/内部运维 | 默认隐藏 | 不承诺稳定性 |

### 4.1 验收标准
1. 默认仅暴露 `core`，总数建议 `<= 40`。
2. 80% 常见任务无需启用 `advanced`。
3. 每个工具必须标注 `layer`（manifest 字段）。

## 5. 命名规范（强制）
### 5.1 工具名格式
`<verb>_<domain>_<object>[_<qualifier>]`

### 5.2 动词白名单
`get` `list` `find` `create` `set` `update` `delete` `move` `validate` `execute` `workflow`

### 5.3 约束
1. 禁止同义动词并存（如 `query/get` 混用）。
2. 读操作仅允许：`get/list/find/validate`。
3. 写操作仅允许：`create/set/update/delete/move/execute/workflow`。
4. 不再提供旧命名兼容别名。

## 6. 参数规范（强制）
### 6.1 写操作通用字段
- `dryRun: boolean`（默认 `false`）
- `idempotencyKey: string`（建议调用方生成）
- `timeoutMs?: number`
- `clientTag?: string`

### 6.2 统一命名
1. 节点标识：`nodeUuid`
2. 父节点：`parentUuid`
3. 场景路径：`scenePath`
4. 资产路径：`assetPath`
5. 资产 UUID：`assetUuid`
6. 布尔值必须为 `boolean`，禁止字符串布尔。
7. 坐标必须为对象结构，禁止逗号字符串。

### 6.3 坐标结构
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "rotation": { "x": 0, "y": 0, "z": 0 },
  "scale": { "x": 1, "y": 1, "z": 1 }
}
```

## 7. 响应与错误模型（强制）
### 7.1 协议层（JSON-RPC error）
- `-32700` Parse error
- `-32600` Invalid request
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error

### 7.2 业务层（tool result）
- 成功：`result.structuredContent.success = true`
- 失败：`result.isError = true` 且 `result.structuredContent.success = false`

### 7.3 统一业务响应结构（structuredContent）
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "traceId": "trc_01H...",
    "tool": "set_node_transform",
    "version": "2.0.0",
    "durationMs": 42,
    "timestamp": "2026-02-12T09:35:21.103Z"
  }
}
```

### 7.4 业务错误码最小集合
| 错误码 | 含义 | retryable |
|---|---|---|
| `E_INVALID_ARGUMENT` | 参数缺失或类型错误 | 否 |
| `E_NOT_FOUND` | 节点/资产/场景不存在 | 否 |
| `E_CONFLICT` | 状态冲突 | 否 |
| `E_PRECONDITION_FAILED` | 前置条件不满足 | 否 |
| `E_TIMEOUT` | 执行超时 | 是 |
| `E_INTERNAL` | 服务内部错误 | 视情况 |
| `E_UNAVAILABLE` | 编辑器或依赖服务不可用 | 是 |

## 8. 安全与写操作规范（强制）
1. 写操作支持 `dryRun=true`，返回拟变更摘要且不执行。
2. `delete_*` 与破坏性 `execute_*` 必须返回 `riskLevel`。
3. 所有写操作返回 `changes[]`（实际或拟变更对象）。
4. 批量写返回 `succeeded`、`failed`、`skipped`。

## 9. workflow 工具（P0 必做）
| 工具名 | 用途 | 最小输入 | 最小输出 |
|---|---|---|---|
| `workflow_create_ui_node_with_components` | 创建 UI 节点并挂常用组件 | `parentUuid,name,components` | `nodeUuid,appliedComponents` |
| `workflow_bind_script_to_node` | 挂脚本并设置公开属性 | `nodeUuid,scriptPath,properties` | `componentUuid,appliedProperties` |
| `workflow_safe_set_transform` | 安全设置变换并校验节点类型 | `nodeUuid,position/rotation/scale` | `before,after,warnings` |
| `workflow_import_and_assign_sprite` | 导入图片并绑定到 Sprite | `sourcePath,targetNodeUuid` | `assetUuid,spriteFrameUuid` |
| `workflow_open_scene_and_validate` | 打开场景并运行校验 | `scenePath` | `validationReport` |
| `workflow_create_or_update_prefab_instance` | 创建或更新 prefab 实例 | `prefabPath,parentUuid` | `nodeUuid,diffSummary` |

### 9.1 workflow 约束
1. 返回 `stages[]`（阶段名、耗时、状态、错误）。
2. 失败时必须给出 `stage` 与业务错误码。
3. 每个 workflow 至少附带 2 个可运行示例。
4. 必须支持 `dryRun`。

## 10. Manifest 规范（P1）
### 10.1 暴露方式
1. `tools/list` 返回每个工具的 `_meta`（最小 manifest）。
2. 提供 `get_tool_manifest` 返回完整 manifest（含示例、schema）。

### 10.2 字段
```json
{
  "name": "set_node_transform",
  "layer": "core",
  "category": "node",
  "safety": "mutating",
  "idempotent": true,
  "supportsDryRun": true,
  "prerequisites": ["sceneReady=true"],
  "inputSchema": {},
  "outputSchema": {},
  "examples": []
}
```

## 11. 可观测性与诊断（P1）
1. 每次调用必须返回 `traceId`。
2. 服务端日志按 `traceId` 聚合：入参摘要、耗时、结果、错误。
3. 提供 `get_trace_by_id` 诊断工具查询最近一次调用详情。

## 12. 性能与稳定性基线（P1）
| 指标 | 目标 |
|---|---|
| core 读工具 p95 | `<= 200ms` |
| core 写工具 p95 | `<= 500ms` |
| workflow 工具 p95 | `<= 1500ms` |
| 工具成功率（日） | `>= 99%` |
| 业务错误码覆盖率 | `100%` |

## 13. 测试要求（强制）
1. 单元：命名校验、参数校验、错误码映射、`dryRun` 分支。
2. 集成：至少 10 条真实任务链路。
3. 契约：`structuredContent` 与 `outputSchema` 完整性校验。
4. workflow：6 个工具至少各 2 条成功路径 + 1 条失败路径。
5. 性能：覆盖 core 前 20 高频工具。

## 14. 交付清单（DoD）
1. 工具重构与新增代码完成。
2. manifest 与 schema 文档完成。
3. 示例脚本不少于 10 个。
4. 测试报告与性能基线报告完成。
5. 发布说明包含协议/工具破坏性变更声明。

## 15. 建议实施节奏
1. 第 1 阶段（1-2 天）：响应模型、业务错误码、`traceId`、`dryRun`。
2. 第 2 阶段（2-3 天）：命名/参数规范 + manifest + schema。
3. 第 3 阶段（2-3 天）：6 个 workflow + 示例。
4. 第 4 阶段（1-2 天）：测试、性能基线、发布文档。
