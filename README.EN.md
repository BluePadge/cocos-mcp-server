# Cocos MCP Server

A standards-compliant MCP (Model Context Protocol) extension for **Cocos Creator 3.8.x**.  
Since `v2.0.0`, this repository has been streamlined to a single Next Runtime path, focused on protocol correctness, automation, and maintainability.

## Contents
- [Project Scope](#project-scope)
- [Core Capabilities](#core-capabilities)
- [Requirements](#requirements)
- [Install and Start](#install-and-start)
- [MCP Client Setup](#mcp-client-setup)
- [Protocol Behavior](#protocol-behavior)
- [Key Tool Semantics](#key-tool-semantics)
- [Development and Testing](#development-and-testing)
- [FAQ](#faq)
- [Fork Attribution](#fork-attribution)

## Project Scope
- Exposes Cocos Creator editor operations through MCP tools.
- Uses `tools/list` and `tools/call` as the primary interaction model.
- Applies capability-gated tool exposure to reduce invalid calls across different editor/project states.

## Core Capabilities
The current runtime covers these tool domains (visibility is dynamic via `tools/list`):

- Scene hierarchy and lifecycle: `scene_*`
- Scene View operations: `scene_view_*`
- Component property and advanced operations: `component_*`
- Asset management and dependency graph: `asset_*`
- Prefab lifecycle: `prefab_*`
- UI automation: `ui_*`
- Diagnostics and logs: `diagnostic_*`
- Runtime control: `runtime_*`
- Project/editor/program config: `project_*`, `preferences_*`, `information_*`, `program_*`

## Requirements
- Cocos Creator: `>= 3.8.6` (recommended: `3.8.8`)
- Node.js: `18+` recommended
- npm: `9+` recommended

## Install and Start
### 1) Place this extension in your Cocos project
```bash
<your-project>/extensions/cocos-mcp-server
```

### 2) Install dependencies and build
```bash
npm install
npm run build
```

### 3) Start from Cocos Creator
1. Open your target project.
2. Open the `Cocos MCP Server` panel.
3. Start the MCP HTTP service (default: `http://127.0.0.1:3000/mcp`).

## MCP Client Setup
### Generic HTTP MCP (`mcpServers` config shape)
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

### Cursor (or other MCP-compatible IDEs)
```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### Codex CLI (recommended, direct HTTP)
```bash
codex mcp add cocos-creator --url http://127.0.0.1:3000/mcp
```

Inspect the registered server:
```bash
codex mcp list
codex mcp get cocos-creator
```

## Protocol Behavior
This project follows standard MCP Streamable HTTP behavior:

- `POST /mcp`: single JSON-RPC request (batch not supported)
- `GET /mcp`: SSE stream
- `DELETE /mcp`: close session
- `GET /health`: health check endpoint

Session and error rules:
- After `initialize`, all subsequent requests must include `MCP-Session-Id`.
- `tools/call` always returns `structuredContent`.
- Business failures use `E_*` error codes, separate from JSON-RPC protocol errors.

## Key Tool Semantics
- `scene_open_scene`
  - Implemented via official `asset-db.open-asset`.
  - Accepts `sceneUrl` only. Legacy `verifyTimeoutMs/verifyIntervalMs` are removed.

- `prefab_query_nodes_by_asset_uuid`
  - Returns nodes referencing a prefab and may include non-instance nodes.
  - Use `prefab_query_instance_nodes_by_asset_uuid` for instance-only results.

- `diagnostic_get_log_file_info` / `diagnostic_check_compile_status`
  - If `projectPath` is omitted, the current opened project path is used to resolve `temp/logs/project.log`.

## Development and Testing
Common commands:
```bash
npm run build
npm run test:mcp
npm run smoke:mcp:online
```

Recommended online debug workflow:
```bash
./scripts/restart-cocos-project.sh --project /Users/blue/Developer/CocosProjects/HelloWorld
npm run smoke:mcp:online
```

## FAQ
- Q: Why do my code changes not take effect immediately?
  - A: The Cocos extension does not hot-reload updated `dist` files in the current process. Restart the Cocos instance.

- Q: Why does `tools/list` vary across projects?
  - A: Tool exposure is capability-gated and depends on editor/project runtime availability.

## Fork Attribution
This repository is an evolved fork of the original work by **LiDaxian**.  
The current version focuses on standardized MCP behavior, capability layering, and regression-friendly automation.

Original release channel:
- Cocos Store: [https://store.cocos.com/app/detail/7941](https://store.cocos.com/app/detail/7941)
