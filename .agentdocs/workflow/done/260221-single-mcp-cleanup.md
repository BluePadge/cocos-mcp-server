# 260221-single-mcp-cleanup

## 目标
将仓库收敛为单一标准 MCP 扩展：仅保留 Next 运行时、标准 `/mcp` 协议链路与最小面板控制能力。

## 范围
- 删除 legacy 工具体系与工具管理配置体系。
- 移除非标准 `/api/*` 路由。
- 清理旧测试命名与无效手工测试。
- 文档归档并升级版本到 `2.0.0`。

## 阶段 TODO
- [x] Phase 0：建立任务基线与索引
- [x] Phase 1：收敛 `source/main.ts`
- [x] Phase 2：收敛 `source/mcp-server.ts`
- [x] Phase 3：收敛面板与 `package.json` 扩展清单
- [x] Phase 4：删除 legacy 代码目录
- [x] Phase 5：清理设置/类型/i18n 残留
- [x] Phase 6：构建脚本与测试集规范化
- [x] Phase 7：文档归档与发布收口

## 验收清单
- [x] `npm run build`
- [x] `npm run test:mcp`
- [x] `npm run smoke:mcp:online`
- [x] 路由只保留 `/mcp` 与 `/health`
- [x] README 中英文完成 breaking changes 同步
