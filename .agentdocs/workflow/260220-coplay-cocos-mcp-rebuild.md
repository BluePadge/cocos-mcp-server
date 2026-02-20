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
- [x] `npm run build`
- [x] `npm run test:mcp`

## 验收标准
- 新目录 `source/next` 可以独立承载新实现，不依赖旧工具内部逻辑。
- 可通过统一入口获取“当前编辑器能力矩阵”，并据此决定工具可见性。
- 至少有一组官方 API 工具在测试中可验证执行链路。
- 现有主流程无回归：`build + test:mcp` 全通过。

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
- 第二轮新增覆盖点：
  - 读域：场景层级读取、节点详情、节点组件查询、资产依赖/引用查询
  - 写域：节点创建/复制/删除/父子调整、组件增删、组件属性写入
  - 通过能力矩阵门控写工具，未探测写能力时不暴露写操作
- 第三轮新增覆盖点：
  - 场景生命周期：场景打开/保存/关闭、场景状态查询、相机聚焦
  - 项目运行诊断：项目配置、偏好配置、网络信息、引擎信息、构建 worker 状态
  - 资产管理补全：移动（含重命名）、URL/UUID/路径解析、重导入、刷新、打开
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
  - 重启 Cocos 后 `GET /health` 显示工具数从 `17` 提升到 `36`
  - 新增工具在线调用成功：`scene_query_status`、`project_query_config`、`server_query_network`、`engine_query_runtime_info`、`asset_query_url`
- 验证结果：
  - `npm run build` 通过
  - `npm run test:mcp` 通过（含新增 next 测试）
