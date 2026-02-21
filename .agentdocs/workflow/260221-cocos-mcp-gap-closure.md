# 260221-cocos-mcp-gap-closure

## 背景
- 来源：`/Users/blue/Developer/CocosProjects/HelloWorld/.agentdocs/guides/cocos-mcp-gap-log.md`
- 目标：在保持单一 Next MCP 架构下，收敛已复现能力缺口（GAP-001~005），并通过本仓库既有测试门槛。

## 范围
1. GAP-001：`component_set_property` 强类型写入与结果可观测性。
2. GAP-002：`diagnostic_check_compile_status` 的增量日志视图。
3. GAP-003：Prefab 节点属性直接写接口。
4. GAP-004：`component_execute_method` 的可选回滚执行模式。
5. GAP-005：`component_execute_method` 非回滚调用下 `sceneMutated` 元信息准确性。

## 分阶段计划

### Phase 1：Component 强类型写入（GAP-001）
- [x] 为 `component_set_property` 增加 `valueKind`（`auto|boolean|number|string|json`）参数。
- [x] MCP 侧执行显式类型转换，避免布尔值落成字符串。
- [x] 返回补充 `appliedType`、`dirtyBefore/dirtyAfter/dirtyChanged` 观测字段。
- [x] 补充对应单元测试。

### Phase 2：Diagnostic 增量视图（GAP-002）
- [x] 为日志相关工具补充 `sinceLine` 与 `sinceTimestamp` 过滤能力。
- [x] `diagnostic_check_compile_status` 支持基于增量窗口计算 `hasError`。
- [x] 补充对应单元测试。

### Phase 3：Prefab 节点属性写入（GAP-003）
- [x] 新增 `prefab_set_node_property` 工具。
- [x] 支持 `assetUuid|assetUrl` 与 `nodeUuid|nodePath` 双路定位。
- [x] 支持 `valueKind` 与 `valueType`。
- [x] 补充对应单元测试。

### Phase 4：组件方法调用回滚（GAP-004）
- [x] 为 `component_execute_method` 增加 `rollbackAfterCall|transient` 选项。
- [x] 支持执行后软重载回滚，并返回回滚状态字段。
- [x] 补充对应单元测试。

### Phase 5：统一验证与文档回写
- [x] 执行 `npm run build`。
- [x] 执行 `npm run test:mcp`。
- [x] 执行 `npm run smoke:mcp:online`。
- [x] 更新 `.agentdocs/index.md` 关键记忆。

## 验证记录
- `npm run build`：通过。
- `npm run test:mcp`：通过。
- `npm run smoke:mcp:online`：通过（tools=107）。

## 二次验收反馈与修正
- 调用侧反馈（2026-02-21）：GAP-001 在默认 `auto` 推断下仍存在布尔字符串写入漂移；GAP-004 出现 `rollbackApplied=true` 但节点仍新增的假阳性。
- 二次修正：
  - `component_set_property` 在 `auto` 模式下新增基于 `scene.query-component` 的属性类型推断，并返回 `effectiveValueKind`。
  - `component_execute_method` 回滚流程改为“新增节点差异删除优先，失败再 soft-reload”，并增加回滚验证，验证失败直接返回 `E_RUNTIME_ROLLBACK_FAILED`。
- 二次修正后复验：
  - `npm run build`：通过。
  - `npm run test:mcp`：通过。
  - `npm run smoke:mcp:online`：通过（tools=108）。

## 三次验收反馈与修正
- 调用侧反馈（2026-02-21）：GAP-005 在不启用回滚时，`component_execute_method` 返回 `sceneMutated=false`，但场景实际已新增节点。
- 三次修正：
  - `component_execute_method` 改为默认采集调用前后场景树快照，不再仅在回滚模式下采集；`sceneMutated` 优先由场景树差异判定，再回退到 dirty 状态推断。
  - 补充单元测试：覆盖“非回滚调用触发新增节点”场景，断言 `sceneMutated=true`。
- 三次修正后复验：
  - `npm run build`：通过。
  - `npm run test:mcp`：通过。
  - `npm run smoke:mcp:online`：通过（tools=108）。

## DoD
- 5 个 GAP 均有代码侧能力落地或语义补强。
- 变更通过仓库必跑检查：`build + test:mcp`。
- 在线冒烟通过，且无新增协议回归。
