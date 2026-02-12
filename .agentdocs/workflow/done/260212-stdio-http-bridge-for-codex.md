# 任务：为 Codex 增加 stdio-HTTP MCP 桥接

> 状态说明（2026-02-12）：本任务产出已被 `260212-mcp-spec-compliance-without-tool-logic-change.md` 的规范化改造覆盖；该文档保留用于历史追溯。

## 背景
- 当前 `cocos-mcp-server` 在 Cocos Creator 内提供的是 HTTP 端点（`/mcp`）。
- Codex 在当前环境下使用 `streamable_http` 连接该端点仍发生握手失败（`initialized notification` 发送后通道关闭）。
- 目标是用最小改动实现“Codex 可稳定接入并调用工具”。

## 方案决策
- 采用方案 A（桥接版）：新增独立 `stdio -> HTTP` 代理进程。
- 原因：
  - 不改动 Cocos Creator 宿主内工具执行路径；
  - Codex 走 `command` 方式更稳定；
  - 改动范围小、风险低、回滚简单。

## 分阶段计划
- [x] 阶段 1：创建任务文档与索引登记
- [x] 阶段 2：实现 `stdio-http-bridge` 核心逻辑
- [x] 阶段 3：补充 package 启动入口与接入文档
- [x] 阶段 4：本地编译与握手冒烟验证

## TODO
- [x] 新增 `source/stdio-http-bridge.ts`
- [x] 支持 `Content-Length` 协议帧解析与写回
- [x] 支持 HTTP `POST /mcp` 转发（可配置 URL / timeout）
- [x] 将桥接错误转换为 JSON-RPC error 返回
- [x] 在 `package.json` 增加桥接启动脚本
- [x] 更新 README：Codex 项目级 `command/args` 配置示例
- [x] 完成本地验证并记录结果

## 验证记录
- `npm run build`：通过
- 本地冒烟（临时端口 `3114`）：
  - 发送 `initialize`（request）=> 收到响应
  - 发送 `notifications/initialized`（notification）=> 无响应（符合预期）
  - 发送 `tools/list`（request）=> 收到响应
  - 输出帧计数为 2（仅两个 request 有响应）
- 后续兼容修复（临时端口 `3135/3136/3138`）：
  - `stdio` 输入分隔符 `CRLF` 可正常回包
  - `stdio` 输入分隔符 `LF` 可正常回包
  - 默认输出分隔符为 `LF`，并支持通过 `COCOS_MCP_STDIO_SEPARATOR` 配置切换

## 后续问题修复（握手超时）
- 问题现象：`list_mcp_resources(server=\"cocos_creator\")` 在部分环境握手超时。
- 已完成修复：
  - 帧头解析同时支持 `\\r\\n\\r\\n` 和 `\\n\\n`
  - `Content-Length` 头解析支持 `\\r?\\n`
  - 回包分隔符支持可配置（默认 `LF`，可选 `crlf`、`mirror`）
  - 新增可选 trace（`COCOS_MCP_BRIDGE_TRACE_FILE`）用于定位现场问题
- 人工验收结果：
  - 用户已确认测试通过且链接建立正确

## 验证标准
- `npm run build` 通过
- 使用桥接脚本时，至少通过以下请求：
  - `initialize`
  - `notifications/initialized`
  - `tools/list`
