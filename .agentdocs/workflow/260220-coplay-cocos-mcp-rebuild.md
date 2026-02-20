# 任务：按 coplay 能力目标重写 Cocos MCP（新实现）

## 背景
- 现有 `cocos-mcp-server` 已具备 MCP V2 协议层能力，但工具层仍混有历史兼容调用与未声明 API，稳定性受 Cocos 版本差异影响。
- 新目标是“参考 coplay_mcp 的能力模型”，建设一个可扩展、可探测、可降级的新 MCP 实现。
- 约束：协议必须标准 MCP；Cocos API 使用优先官方声明，非官方能力必须受控（probe + fallback）。

## 目标
- 新建一套独立于现有工具实现的 Next 架构骨架（协议层 / 能力层 / 工具层）。
- 形成 `coplay -> cocos` 的能力映射与分层策略（官方、扩展、实验）。
- 交付首批可运行工具（以官方 API 为主）与配套测试，作为后续全面迁移基线。
- 第二轮迁移 `coplay` 高价值能力域：场景层级、组件属性、资产依赖。

## 分阶段
- [x] 阶段 1：任务建档、索引更新、范围与 DoD 明确
- [x] 阶段 2：能力映射文档（coplay 对标 + Cocos 可实现性）
- [x] 阶段 3：Next 架构骨架落地（`source/next`）
- [x] 阶段 4：首批工具与测试接入（build + test:mcp）
- [x] 阶段 5：阶段回顾与后续迁移计划
- [x] 阶段 6：第二轮高价值能力域迁移（场景层级/组件属性/资产依赖）
- [x] 阶段 7：Next runtime 挂接到 `mcp-server` 主入口（next-only）
- [x] 阶段 8：修复能力探测副作用（create-node probe 回滚）
- [x] 阶段 9：第三轮能力域迁移（项目/场景生命周期 + 编辑器诊断 + 资产管理补全）
- [x] 阶段 10：替换废弃引擎 API 并启动 Prefab 生命周期首批迁移
- [x] 阶段 11：Prefab 生命周期第二批迁移（实例创建/应用）
- [x] 阶段 12：Scene View/编辑器视图能力迁移（gizmo/2D3D/网格/icon-gizmo/视角对齐）
- [x] 阶段 13：UI 自动化能力域迁移（create/set-rect/set-text/set-layout）
- [x] 阶段 14：调试与诊断能力域迁移（编译状态/日志/插件信息/性能快照）
- [x] 阶段 15：运行控制与测试闭环能力域迁移（就绪等待/脚本执行/软重载/快照）
- [x] 阶段 16：Prefab 调用专项修复（去除假成功 + 3.8.8 在线回归）

## TODO
- [x] 产出 `backend/coplay-cocos-capability-map.md`
- [x] 定义 Next 的能力分层模型：`official / extended / experimental`
- [x] 新增 `source/next/protocol/*`（请求分发、工具调用骨架）
- [x] 新增 `source/next/capability/*`（能力探测与可用性矩阵）
- [x] 新增 `source/next/tools/*`（首批对标工具）
- [x] 新增 `source/test/next-*` 单元与集成测试
- [x] 将 `source/next/tools` 按能力域拆分（`scene-hierarchy` / `component-property` / `asset-dependency`）
- [x] 在 Next 工具层接入官方资产依赖 API（`query-asset-users` / `query-asset-dependencies`）
- [x] 更新 `source/next/capability/method-catalog.ts` 以覆盖第二轮能力键
- [x] 将 `source/mcp-server.ts` 的 `tools/list/tools/call/get_tool_manifest/get_trace_by_id` 切换为 Next router
- [x] 为 Next router 增加 trace 记录与 `get_trace_by_id`
- [x] 将 MCP 端到端测试改为 `nextRuntimeFactory` 注入模式（脱离 legacy `toolExecutors`）
- [x] 修复 `scene.create-node` 能力探测副作用：探测后自动回滚删除节点
- [x] 增加探测回滚单测（`next-capability-probe-test`）
- [x] 新增场景生命周期工具（`scene_open_scene` / `scene_save_scene` / `scene_close_scene` / `scene_query_status` / `scene_query_bounds` / `scene_focus_camera`）
- [x] 新增项目与运行时诊断工具（`project_query_config` / `preferences_query_config` / `server_query_network` / `engine_query_runtime_info` / `engine_query_engine_info` / `builder_query_worker_ready`）
- [x] 新增资产管理补全工具（`asset_move_asset` / `asset_query_path` / `asset_query_url` / `asset_query_uuid` / `asset_reimport_asset` / `asset_refresh_asset` / `asset_open_asset`）
- [x] 扩展能力目录 `method-catalog`，覆盖第三轮工具所需官方方法键
- [x] 扩展 `next-router-test` 覆盖新增能力域工具调用
- [x] 将 `engine(query-info)` 替换为 `engine(query-engine-info)`（含能力目录与测试）
- [x] 新增 Prefab 生命周期首批工具（实例查询、按资产查询实例、还原实例、重置节点/组件）
- [x] 扩展能力目录以覆盖 Prefab 首批工具所需官方方法键（`query-nodes-by-asset-uuid` / `restore-prefab` / `reset-node` / `reset-component`）
- [x] 扩展 `next-router-test` 覆盖 Prefab 首批工具调用
- [x] 新增 Prefab 第二批工具（`prefab_create_instance` / `prefab_apply_instance` / `prefab_apply_instances_by_asset`）
- [x] 扩展写操作识别（`apply`）以修正工具 idempotent/safety 元信息
- [x] 扩展 `next-router-test` 覆盖 Prefab 第二批工具调用
- [x] 新增 Scene View 工具域（`scene_view_*`）并接入 `official-tools.ts`
- [x] 扩展能力目录覆盖 Scene View 查询方法（只读 probe，避免启动副作用）
- [x] 扩展写操作识别（`change`/`close`/`focus`/`align`）修正 `_meta.idempotent/safety`
- [x] 扩展 `next-router-test` 覆盖 Scene View 工具调用
- [x] 沉淀本地“重启 Cocos 实例 + MCP 在线冒烟”标准流程
- [x] 新增 UI 自动化工具域（`ui_create_element` / `ui_set_rect_transform` / `ui_set_text` / `ui_set_layout`）
- [x] `official-tools.ts` 接入 UI 自动化工具聚合
- [x] 扩展 `next-router-test` 覆盖 UI 自动化工具调用
- [x] 在线冒烟验证 UI 自动化工具域可见性与基础调用
- [x] 新增调试与诊断工具域（`diagnostic_*`：编译状态/日志/插件/程序信息）
- [x] `official-tools.ts` 接入调试与诊断工具聚合
- [x] 扩展能力目录覆盖调试域官方方法键（`information/program/programming`）
- [x] 新增独立测试 `next-diagnostic-tools-test` 并接入 `test:mcp`
- [x] 修复工具元信息写操作识别误判（`settings` 不再误判为 `set`）
- [x] 在线冒烟验证诊断工具域可见性与基础调用
- [x] 新增运行控制与测试闭环工具域（`runtime_*`）
- [x] 扩展能力目录覆盖运行控制域官方方法键（`builder.open` / `scene.execute-scene-script` / `scene.soft-reload` / `scene.snapshot` / `scene.snapshot-abort`）
- [x] 新增独立测试 `next-runtime-control-tools-test` 并接入 `test:mcp`
- [x] 新增脚本 `scripts/restart-cocos-project.sh`，修复实例重启后“tools=0 误判就绪”问题
- [x] 在线冒烟验证运行控制与测试闭环工具可见性与调用
- [x] Prefab 专项修复：`prefab_create_instance` 增加“创建后强校验 + 自动清理 + 链接回填”流程
- [x] Prefab 专项修复：`prefab_apply_instance` 改为“仅允许对已关联实例 apply”，避免非实例假成功
- [x] 扩展 `next-router-test` 以覆盖 Prefab 新行为（多候选创建、`remove-node` 清理、`asset-db.query-asset-info`）
- [x] HelloWorld 在线回归：`prefab_create_instance -> prefab_get_instance_info -> prefab_apply_instance -> prefab_query_nodes_by_asset_uuid`
- [x] `npm run build`
- [x] `npm run test:mcp`

## 验收标准
- 新目录 `source/next` 可以独立承载新实现，不依赖旧工具内部逻辑。
- 可通过统一入口获取“当前编辑器能力矩阵”，并据此决定工具可见性。
- 至少有一组官方 API 工具在测试中可验证执行链路。
- 现有主流程无回归：`build + test:mcp` 全通过。

## 本地联调流程（重启实例 + MCP 冒烟）
1. 约定路径变量：
   - `COCOS_APP=/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator`
   - `PROJECT_PATH=/Users/blue/Developer/CocosProjects/HelloWorld`
2. 定位该工程实例 PID：
   - `pgrep -af \"CocosCreator.*--project ${PROJECT_PATH}\"`
3. 关闭该工程实例（仅关闭目标工程，不误杀其它 Cocos 项目）：
   - `pkill -TERM -f \"CocosCreator.*--project ${PROJECT_PATH}\"`
   - 循环等待退出；若超时，再执行：`pkill -KILL -f \"CocosCreator.*--project ${PROJECT_PATH}\"`
4. 启动目标工程实例：
   - `\"${COCOS_APP}\" --project \"${PROJECT_PATH}\" --can-show-upgrade-dialog true >/tmp/cocos-helloworld.log 2>&1 &`
   - 或直接使用脚本：`scripts/restart-cocos-project.sh --project \"${PROJECT_PATH}\"`
5. 等待 MCP 插件就绪：
   - 轮询 `curl -sS http://127.0.0.1:3000/health`
   - 判定条件：HTTP 成功且返回 `{\"status\":\"ok\",\"tools\":N}` 且 `N>0`（避免 `tools=0` 的早期误判）。
6. 执行标准 MCP 握手：
   - `initialize`（读取响应头 `MCP-Session-Id`）
   - `notifications/initialized`
7. 执行在线冒烟：
   - `tools/list`：检查新工具是否出现（例如 `scene_view_*`）
   - `tools/call`：至少覆盖一个读工具 + 一个写工具 + 一个回读校验（例如 `scene_view_set_mode` 后 `scene_view_query_state`）
8. 记录结果：
   - 记录 `tools` 数量、关键工具可见性、调用响应与异常信息。

> 注意：
> - `CocosCreator --help` 在 3.8.8 下不会输出参数帮助，反而会启动一个新实例，不要用它做参数探测。
> - 启动命令以 `--project <path>` 为准，可从现有进程参数中确认。

## 当前结果
- 已新增文档：`backend/coplay-cocos-capability-map.md`，明确 coplay 能力域映射与分层策略。
- 已将类型依赖升级至 `@cocos/creator-types@^3.8.7`，并修复 `builder.open` 新签名要求（需传 `panel`）。
- 已落地 Next 架构骨架：
  - `source/next/capability/*`：能力目录与探测器
  - `source/next/protocol/*`：工具注册器与 MCP router
  - `source/next/tools/official-tools.ts`：工具聚合入口
  - `source/next/tools/scene-hierarchy-tools.ts`：场景层级域
  - `source/next/tools/component-property-tools.ts`：组件属性域
  - `source/next/tools/asset-dependency-tools.ts`：资产依赖域
  - `source/next/tools/common.ts`：工具公共辅助
  - `source/next/index.ts`：统一创建入口
- 已新增测试：
  - `source/test/next-capability-probe-test.ts`
  - `source/test/next-router-test.ts`
  - `source/test/next-diagnostic-tools-test.ts`
  - `source/test/next-runtime-control-tools-test.ts`
- 第二轮新增覆盖点：
  - 读域：场景层级读取、节点详情、节点组件查询、资产依赖/引用查询
  - 写域：节点创建/复制/删除/父子调整、组件增删、组件属性写入
  - 通过能力矩阵门控写工具，未探测写能力时不暴露写操作
- 第三轮新增覆盖点：
  - 场景生命周期：场景打开/保存/关闭、场景状态查询、相机聚焦
  - 项目运行诊断：项目配置、偏好配置、网络信息、引擎信息、构建 worker 状态
  - 资产管理补全：移动（含重命名）、URL/UUID/路径解析、重导入、刷新、打开
- 阶段 10 新增覆盖点：
  - 引擎 API 收敛：`engine_query_runtime_info` 统一改走 `query-engine-info`，避免 `query-info` 废弃告警
  - Prefab 首批：`prefab_query_nodes_by_asset_uuid`、`prefab_get_instance_info`、`prefab_restore_instance`、`prefab_restore_instances_by_asset`、`prefab_reset_node`、`prefab_reset_component`
- 阶段 11 新增覆盖点：
  - Prefab 第二批：`prefab_create_instance`、`prefab_apply_instance`、`prefab_apply_instances_by_asset`
  - 为兼容编辑器差异，`prefab_apply_instance` 内置 `apply-prefab -> apply-prefab-link` 回退
- 阶段 12 新增覆盖点：
  - Scene View：`scene_view_query_state`、`scene_view_set_mode`、`scene_view_set_gizmo_tool`、`scene_view_set_gizmo_pivot`、`scene_view_set_gizmo_coordinate`
  - Scene View：`scene_view_set_grid_visible`、`scene_view_set_icon_gizmo_visible`、`scene_view_set_icon_gizmo_size`、`scene_view_align_with_view`、`scene_view_align_view_with_node`
  - 工具元信息写操作识别补强：新增 `change/close/focus/align` 关键词，避免将写工具误标为 `safe + idempotent`
- 阶段 13 新增覆盖点：
  - UI 自动化：`ui_create_element`、`ui_set_rect_transform`、`ui_set_text`、`ui_set_layout`
  - `ui_create_element` 支持 `parentUuid/parentPath` 双定位，未指定父节点时可自动挂载/创建 Canvas
  - UI 工具内部复用官方 `scene.create-node/query-node-tree/query-node/create-component/set-property` 组合实现，保持官方 API 基线
- 阶段 14 新增覆盖点：
  - 调试与诊断：`diagnostic_check_compile_status`、`diagnostic_get_project_logs`、`diagnostic_get_log_file_info`、`diagnostic_search_project_logs`
  - 调试与诊断：`diagnostic_query_information`、`diagnostic_query_program_info`、`diagnostic_query_shared_settings`、`diagnostic_query_sorted_plugins`
  - 性能快照：`diagnostic_query_performance_snapshot`（受 `scene.query-performance` 能力门控，缺失时不暴露）
  - 元信息识别修正：`source/next/protocol/tool-registry.ts` 改为按 `_` token 匹配写操作关键词，避免 `settings` 被误判为 `set`
- 阶段 15 新增覆盖点：
  - 运行控制：`runtime_query_control_state`、`runtime_wait_until_ready`、`runtime_open_builder_panel`
  - 执行与闭环：`runtime_soft_reload_scene`、`runtime_take_scene_snapshot`、`runtime_abort_scene_snapshot`、`runtime_execute_scene_script`、`runtime_execute_test_cycle`
  - 闭环工具支持“等待就绪 -> 可选脚本 -> 状态回读”单次测试流程，适配自动化迭代调试
  - 启动脚本：新增 `scripts/restart-cocos-project.sh`，内置 `health(tools>0) + MCP 握手` 双重就绪判定
- 阶段 16 新增覆盖点：
  - `prefab_create_instance` 增加创建后强校验：若未形成实例关联则自动回滚候选节点，并返回 `E_PREFAB_CREATE_NOT_LINKED`
  - 在 3.8.8 下新增链接回填策略：尝试 `link-prefab`（多参数形态）与 `restore-prefab({uuid,assetUuid})`，成功后再返回实例
  - `prefab_apply_instance` 增加前置校验：非 Prefab 实例直接返回 `E_PREFAB_INSTANCE_REQUIRED`，避免历史“假成功”
  - `prefab_apply_instances_by_asset` 限制 `targetPrefabUuid === assetUuid`，避免误导性“跨资源关联”语义
  - `resolveNodeUuid` 增强：兼容 `create-node` 的对象返回形态（`uuid/nodeUuid/id/value`）
- 主入口挂接结果：
  - `source/mcp-server.ts` 已不再依赖 `V2ToolService` 处理工具请求，改为 Next router 统一分发
  - `source/mcp-server.ts` 通过 `nextRuntimeFactory` 支持测试注入与生产默认 runtime
  - `source/next/protocol/router.ts` 已提供 `get_trace_by_id`，保持诊断链路可用
  - 协议回归测试已基于 Next 工具语义重写：`mcp-protocol-compliance` / `mcp-v2-manifest` / `mcp-v2-workflow`
- 探测副作用修复结果：
  - `source/next/capability/probe.ts` 对 `scene.create-node` 探测增加回滚删除逻辑（优先批量删除，失败时逐个删除）
  - `source/next/capability/method-catalog.ts` 探测节点名改为 `__mcp_probe_node__`
  - 现场验证（HelloWorld）两次新会话探测后均未出现 `__mcp_probe_node__`
- 在线验证（HelloWorld）：
  - 重启 Cocos 后 `GET /health` 显示工具数从 `17` 提升到 `59`
  - 新增工具在线调用成功：`scene_query_status`、`project_query_config`、`server_query_network`、`engine_query_runtime_info`、`asset_query_url`
  - Prefab 首批工具在线可见并可调用：`prefab_query_nodes_by_asset_uuid`、`prefab_restore_instance`、`prefab_reset_node`
  - Prefab 第二批工具在线可见并可调用：`prefab_create_instance`、`prefab_apply_instance`、`prefab_apply_instances_by_asset`
- 在线验证补充（Scene View 批次）：
  - 已按“本地联调流程”重启 HelloWorld 实例，`tools/list` 显示总数 `55`，`scene_view_*` 共 `10` 个工具全部可见
  - 在线调用通过：`scene_view_query_state`、`scene_view_set_mode`、`scene_view_set_grid_visible`、`scene_view_set_gizmo_tool`、`scene_view_align_with_view`、`scene_view_align_view_with_node`
  - `scene_view_query_state` 回读示例：`is2D=true`、`gizmoTool=position`、`isGridVisible=true`、`isIconGizmo3D=false`、`iconGizmoSize=2`
  - 工具元信息校验通过：`scene_close_scene` 已显示 `_meta.safety=cautious`、`_meta.idempotent=false`（写操作识别修正生效）
- 在线验证补充（UI 自动化批次）：
  - 重启后 `tools/list` 显示 `ui_*` 工具共 `4` 个：`ui_create_element`、`ui_set_rect_transform`、`ui_set_text`、`ui_set_layout`
  - 在线调用通过：创建 Label 节点、设置文本、设置 UITransform、创建 Layout 节点并设置布局参数
  - 冒烟后已调用 `scene_delete_game_object` 清理探测节点，避免污染场景
- 在线验证补充（调试与诊断批次）：
  - 重启后 `GET /health` 显示工具数 `67`
  - `tools/list` 可见 `diagnostic_*` 工具 `8` 个；`diagnostic_query_performance_snapshot` 因目标实例未暴露 `scene.query-performance` 而未显示（符合能力门控预期）
  - 在线调用通过：`diagnostic_check_compile_status`（含 `project.log` 摘要）、`diagnostic_get_project_logs`、`diagnostic_search_project_logs`
  - 元信息校验通过：`diagnostic_query_shared_settings` 已显示 `_meta.safety=safe`、`_meta.idempotent=true`（写操作识别误判已修复）
- 在线验证补充（运行控制与闭环批次）：
  - 使用 `scripts/restart-cocos-project.sh --project /Users/blue/Developer/CocosProjects/HelloWorld` 可稳定重启并就绪（避免 `tools=0` 误判）
  - 重启后 `GET /health` 显示工具数 `75`
  - `tools/list` 可见 `runtime_*` 工具 `8` 个
  - 在线调用通过：`runtime_query_control_state`、`runtime_execute_test_cycle`
- 在线验证补充（Prefab 专项修复批次）：
  - 重启后 `GET /health` 显示工具数 `75`，Prefab 工具可见
  - `prefab_create_instance` 对 `Empty.prefab(2e3822ac-c1f1-4a95-aaa5-2e0c116ca056)` 在线创建成功，并返回 `verified=true`
  - `prefab_create_instance` 回包显示通过 `link-prefab(nodeUuid, assetUuid)` 建立实例关联
  - 回读校验通过：`prefab_get_instance_info.isPrefabInstance=true`，`prefabAssetUuid=2e3822ac-c1f1-4a95-aaa5-2e0c116ca056`
  - 查询校验通过：`prefab_query_nodes_by_asset_uuid.count=1` 且包含新建节点 UUID
  - `prefab_apply_instance` 在线调用成功并保持实例状态；之后已用 `scene_delete_game_object` 清理测试节点
- 验证结果：
  - `npm run build` 通过
  - `npm run test:mcp` 通过（含新增 next 测试）
