# coplay -> Cocos 能力映射与重写策略

## 适用范围
- 当需要按 `coplay_mcp` 的能力模型扩展/重写 Cocos MCP 工具层时必读。
- 当新增工具涉及 `Editor.Message` 非声明方法时必读。

## 设计目标
- 使用标准 MCP 协议提供工具。
- 能力优先于工具：先识别“当前 Editor 能力”，再暴露可用工具。
- 官方声明 API 优先，非官方 API 必须探测后再启用。

## 能力分层
- `official`：在 `@cocos/creator-types` `message.d.ts` 中可声明的方法。
- `extended`：官方未明确定义，但在目标版本可稳定调用的方法；需提供 probe。
- `experimental`：版本差异大或签名不稳定的方法；默认关闭，仅显式启用。

## coplay 能力域映射

### 1) 项目/会话生命周期
- coplay 参考：`list_unity_project_roots`、`set_unity_project_root`、`open_scene`、`play_game`、`stop_game`
- Cocos 对应：`project.query-config`、`scene.open-scene/save-scene/close-scene`
- 分层建议：`official`
- 备注：Cocos 无“多项目根扫描”官方等价物，需定义“当前打开项目”单实例模型。

### 2) 场景与节点原语
- coplay 参考：`list_game_objects_in_hierarchy`、`get_game_object_info`、`create/duplicate/delete/parent`
- Cocos 对应：`scene.query-node-tree/query-node/create-node/duplicate-node/remove-node/set-parent`
- 分层建议：`official`
- 备注：以“路径 + UUID”双定位模型替代 Unity 的层级路径语义。

### 3) 组件与属性编辑
- coplay 参考：`add_component/remove_component/set_property`
- Cocos 对应：`scene.create-component/remove-component/set-property`
- 分层建议：`official`
- 备注：组件属性需规范 dump/value 序列化格式，避免 UI/3D 类型差异导致失败。

### 4) 资源与资产管理
- coplay 参考：`duplicate_asset`、`rename_asset`、`export_package`
- Cocos 对应：`asset-db.create/copy/move/delete/save/reimport/query-*`
- 分层建议：`official`
- 备注：`query-asset-users/dependencies` 在 `creator-types@3.8.7` 新增，可作为依赖图能力基线。

### 5) 预制体生命周期
- coplay 参考：`create_prefab`、`create_prefab_variant`、`add_nested_object_to_prefab`
- Cocos 对应：`prefab_*` 工具（内部需用 `scene + asset-db` 组合）
- 分层建议：`extended`
- 备注：`apply-prefab/save-prefab/restore-prefab` 等在声明层不完整，必须 probe + fallback。

### 6) Scene View / 编辑器视图
- coplay 参考：`scene_view_functions`、`capture_scene_object`
- Cocos 对应：`scene.change/query-gizmo-*`、`focus-camera`
- 分层建议：`official + extended`
- 备注：存在命名差异风险（例如 `align-view-with-node` 签名问题），需统一别名表。

### 7) 调试与诊断
- coplay 参考：`check_compile_errors`、`get_unity_logs`、`get_worst_cpu_frames`
- Cocos 对应：`debug_*` + `run-native-api-self-test` + trace
- 分层建议：`extended`
- 备注：性能指标接口在 Cocos 编辑态可用性不稳定，默认降级为“可用则返回，不可用给出 skipped”。

### 8) UI 自动化
- coplay 参考：`create_ui_element`、`set_rect_transform`、`set_ui_text`
- Cocos 对应：可由节点/组件工具组合实现
- 分层建议：`official`
- 备注：应封装为 workflow 工具，减少调用方对底层属性路径的理解成本。

## 最小可行重写范围（MVP）
- 协议：`tools/list`、`tools/call`、`get_tool_manifest`、`get_trace_by_id`
- 能力探测：`scene`、`asset-db`、`project`、`server` 核心方法探测
- 工具：场景管理、节点 CRUD、组件增删改、资产 CRUD、基础 prefab 操作
- 测试：协议回归 + 能力探测 + 工具冒烟

## 明确不做
- 不把“未探测通过”的 experimental API 直接暴露给默认工具清单。
- 不在工具实现中硬编码项目绝对路径。
- 不把协议错误与业务错误混用（业务失败统一 `E_*`）。
