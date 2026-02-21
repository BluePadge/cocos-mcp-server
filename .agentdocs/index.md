## 后端文档
`backend/mcp-transport.md` - MCP 传输与生命周期约束；修改 `/mcp` 路由、会话管理、JSON-RPC 分发、SSE/stdio 时必读
`backend/mcp-v2-spec-patch.md` - 面向调用方的 MCP V2 规格补丁（无兼容包袱版本），涉及工具分层、命名、参数、响应、workflow、manifest、测试与 DoD
`backend/coplay-cocos-capability-map.md` - `coplay_mcp` 到 Cocos 的能力映射、分层策略与重写边界；设计/重写 Next 工具层时必读

## 归档文档
`../docs/archive/FEATURE_GUIDE_CN.md` - 历史中文功能导览（仅用于追溯旧版本能力）
`../docs/archive/FEATURE_GUIDE_EN.md` - 历史英文功能导览（仅用于追溯旧版本能力）

## 当前任务文档
`workflow/260212-mcp-v2-spec-patch.md` - 将调用方 v1 Draft 重写为 MCP-first 的 V2 可实施规格补丁
`workflow/260212-mcp-v2-implementation.md` - 按 V2 规格进入代码重构实施（协议层、manifest、workflow、测试）

## 已完成任务文档
`workflow/done/260212-mcp-spec-compliance-without-tool-logic-change.md` - 在不改工具业务逻辑前提下完成 MCP 协议规范化改造
`workflow/done/260212-stdio-http-bridge-for-codex.md` - Codex stdio-HTTP 桥接历史任务（已被规范化版本覆盖）
`workflow/done/260220-coplay-cocos-mcp-rebuild.md` - 按 coplay 能力目标重写 Cocos MCP（新实现），已完成阶段 1-20（含 `prefab_link` fallback 闭环、probe 安全化与在线 smoke）
`workflow/done/260221-single-mcp-cleanup.md` - 终态清理完成：移除 legacy 工具与 `/api/*`，收敛为单一 MCP 运行面并升级 `2.0.0`

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
- Next 阶段 10 已将引擎查询统一到 `engine.query-engine-info`（移除 `engine.query-info` 调用路径），并新增 Prefab 生命周期首批工具域。
- Next 阶段 11 已新增 Prefab 生命周期第二批工具（实例创建/应用），并对 `apply-prefab` 提供回退调用策略。
- Next 阶段 12 已新增 Scene View 工具域（`scene_view_*`），覆盖 gizmo、2D/3D、网格、icon-gizmo、视角对齐。
- Next 阶段 13 已新增 UI 自动化工具域（`ui_create_element`/`ui_set_rect_transform`/`ui_set_text`/`ui_set_layout`），用于对齐 coplay 的 UI workflow 能力。
- Next 阶段 14 已新增调试与诊断工具域（`diagnostic_*`），覆盖编译状态、项目日志、program/programming 信息查询；`scene.query-performance` 不可用时按能力门控隐藏性能快照工具。
- Next 阶段 15 已新增运行控制与测试闭环工具域（`runtime_*`），覆盖就绪等待、构建面板打开、软重载、快照、场景脚本执行与单次闭环测试。
- Next 阶段 16 已完成 Prefab 调用专项修复：`prefab_create_instance` 新增“创建后强校验 + link/restore 回填 + 失败自动清理”，`prefab_apply_instance` 改为仅允许对已关联实例 apply，修复 3.8.8 的“假成功”问题。
- Next 阶段 17 已新增 Prefab 资产级首批工具：`prefab_create_asset_from_node`、`prefab_link_node_to_asset`、`prefab_unlink_instance`，并扩展能力探测键 `scene.create-prefab/link-prefab/unlink-prefab`。
- Next 阶段 18 已补齐剩余官方高价值能力：`scene.copy/cut/paste/save-as-scene`、组件高级操作、资产创建/导入/保存/meta、`project/preferences/information/program` 打开与配置能力、`scene.is-native`。
- Next 阶段 19 已修复自动化重启脚本稳定性：先关闭全部 Cocos 实例、按目标工程进程校验、使用 `open -na` 启动，避免被旧工程实例接管。
- Next 阶段 20 已修复 `prefab_link_node_to_asset` fallback：替换节点采用多候选 `create-node` + `link/restore` 二次校验，3.8.8 在线可闭环为真实 Prefab 实例。
- Next 阶段 20 已完成 probe 安全化：高副作用能力支持 `probeStrategy=assume_available`，启动探测默认不触发场景/设置/外部程序副作用调用。
- Next 阶段 20 已新增在线 smoke 命令：`npm run smoke:mcp:online`，覆盖握手、关键工具可见性、读写调用、清理四段流程。
- `source/mcp-server.ts` 已切换为 Next runtime 主入口：`tools/list` / `tools/call` / `get_tool_manifest` / `get_trace_by_id` 均由 Next router 处理（不再走 legacy `V2ToolService`）。
- MCP 端到端测试已统一为 `nextRuntimeFactory` 注入模式，用于在 Node 环境稳定验证 Next-only 协议链路。
- 能力探测已处理写探测副作用：`scene.create-node` probe 在成功后会自动回滚删除探测节点，避免污染当前场景。
- `@cocos/creator-types@3.8.7` 已声明资产依赖查询：`asset-db.query-asset-users` 与 `asset-db.query-asset-dependencies`，可作为官方资产关系能力基线。
- 升级到 `@cocos/creator-types@3.8.7` 后，`builder.open` 调用需显式传 `panel` 参数（如 `'default'`），否则 TypeScript 编译报参错。
- HelloWorld 在线实测中，Next 工具可见数已从 `17` 提升到 `78`，新增域工具可正常调用（含 `scene_view_*`、`ui_*`、`diagnostic_*`、`runtime_*` 与 Prefab 资产级首批工具）。
- HelloWorld 在线实测中，Next 工具可见数已提升到 `106`，新增官方能力域工具（scene/component/asset/project/preferences/information/program）可见且可调用。
- 工具元信息写操作识别已改为按工具名 token 精确匹配，避免 `settings` 等字段命中 `set` 子串导致 `_meta.safety/idempotent` 误判。
- 已新增并修复重启脚本 `scripts/restart-cocos-project.sh`，采用“关闭全部旧实例 + `open -na` 启动 + 目标工程校验 + health(tools>0)+MCP 握手”流程，规避实例接管与早就绪误判。
- HelloWorld 在线实测（3.8.8）中，`prefab_create_instance -> prefab_get_instance_info -> prefab_apply_instance -> prefab_query_nodes_by_asset_uuid` 链路已可闭环通过；`prefab_create_instance` 会在需要时自动调用 `link-prefab` 建立实例关联。
- HelloWorld 在线实测（3.8.8）中，`prefab_create_asset_from_node -> prefab_link_node_to_asset -> prefab_unlink_instance` 链路已可闭环通过。
- 本地自动化联调统一采用“按 `--project` 精确匹配 PID 关闭并重启实例 + MCP 三步握手（`initialize` -> `notifications/initialized` -> `tools/list/tools/call`）”流程；避免使用 `CocosCreator --help`（会拉起新实例）。
- Cocos 扩展不会在当前进程热更新 `dist` 代码；在线验证前必须重启目标工程实例（推荐 `scripts/restart-cocos-project.sh --project <path>`）。
- `2.0.0` 已完成仓库终态清理：移除 `source/tools/`、`source/scene.ts`、`source/panels/tool-manager/` 与 `source/mcp/v2-*`，仅保留 Next MCP 主链路。
- HTTP 路由已收敛为 `/mcp` 与 `/health`；`/api/*` 与 `/api/tools` 已下线。
- 构建流程改为先执行 `scripts/clean-dist.js` 再 `tsc`，避免 `dist` 残留旧产物。
- 历史功能导览已归档到 `docs/archive/FEATURE_GUIDE_CN.md` 与 `docs/archive/FEATURE_GUIDE_EN.md`。
