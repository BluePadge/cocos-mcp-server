# Cocos MCP Server (Next Runtime)

> A standards-compliant MCP extension for Cocos Creator 3.8.x. In `2.0.0`, the repository was fully cleaned to a single MCP runtime path with no legacy tool stack.

## Version Notes (2.0.0 Breaking Changes)
- Removed non-standard HTTP routes: `/api/*`, `/api/tools`.
- Removed legacy tool-management configuration system and related extension messages.
- Removed `contributions.scene` bypass methods (`createNewScene/addComponentToNode/...`).
- Kept standardized MCP behavior: `POST/GET/DELETE /mcp`, `MCP-Session-Id` lifecycle, `tools/list`, `tools/call`, `get_tool_manifest`, `get_trace_by_id`, `get_capability_matrix`.

## Relationship to the Original Project
This repository is a continuous evolution of the original work by **LiDaxian**. The refactor focuses on maintainability, protocol correctness, and regression testability.

Original release channel:
- Cocos Store: <https://store.cocos.com/app/detail/7941>

## Quick Start

### 1) Install into a Cocos project
```bash
<your-project>/extensions/cocos-mcp-server
```

### 2) Install dependencies and build
```bash
npm install
npm run build
```

### 3) Start in Cocos Creator
1. Open your project
2. Open panel `Cocos MCP Server`
3. Start MCP HTTP service (default: `http://127.0.0.1:3000/mcp`)

## MCP Client Setup

### Claude / Generic HTTP MCP
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

### Codex CLI (stdio bridge)
```bash
codex -C "/your-project-root" \
  -c 'mcp_servers.cocos_creator.command="node"' \
  -c 'mcp_servers.cocos_creator.args=["/your-project-root/extensions/cocos-mcp-server/dist/stdio-http-bridge.js","--url","http://127.0.0.1:3000/mcp"]'
```

## Protocol Behavior (Next)
- `POST /mcp`: single JSON-RPC message (no batch support)
- `GET /mcp`: SSE (Streamable HTTP)
- `DELETE /mcp`: close session
- After `initialize`, all requests must include `MCP-Session-Id`
- `tools/call` always returns `structuredContent` (`E_*` for business errors)

## Capability Domains
- Scene hierarchy/lifecycle: `scene_*`
- Scene View: `scene_view_*`
- Component properties/advanced ops: `component_*`
- Asset dependencies/management: `asset_*`
- Prefab lifecycle and asset workflows: `prefab_*`
- UI automation: `ui_*`
- Diagnostics/runtime control: `diagnostic_*`, `runtime_*`
- Project/preferences/program info: `project_*`, `preferences_*`, `information_*`, `program_*`

## Key Tool Semantics (2.0.0+)
- `scene_open_scene`:
  - Implemented as a direct official call to `asset-db.open-asset` (with URL candidate retry).
  - Accepts only `sceneUrl`; `verifyTimeoutMs` / `verifyIntervalMs` are no longer supported.
- `prefab_query_nodes_by_asset_uuid`:
  - This is a "reference-node query" and may include nodes that are not Prefab instances.
  - For instance-only results, use `prefab_query_instance_nodes_by_asset_uuid`.
- `diagnostic_get_log_file_info` / `diagnostic_check_compile_status`:
  - When `projectPath` is omitted, they now default to the currently opened project path to locate `temp/logs/project.log`.

## Development Commands
```bash
npm run build
npm run test:mcp
npm run smoke:mcp:online
npm run mcp:stdio
```

## Online Debug Workflow
### Restart a target project instance
```bash
./scripts/restart-cocos-project.sh --project /Users/blue/Developer/CocosProjects/HelloWorld
```

### Run online smoke
```bash
npm run smoke:mcp:online
```

## Repository Structure (Final)
```text
source/
  mcp-server.ts               # MCP server entry
  next/                       # Capability probing, router, tools
  mcp/                        # JSON-RPC, lifecycle, session, SSE
  panels/default/             # Minimal server-control panel
  settings.ts
  types/
scripts/
  clean-dist.js
  mcp-online-smoke.js
  restart-cocos-project.sh
```

## Docs and Archive
- Main docs: `README.md`, `README.EN.md`
- Historical feature guides are archived at:
  - `docs/archive/FEATURE_GUIDE_CN.md`
  - `docs/archive/FEATURE_GUIDE_EN.md`

## Known Limitations
- Cocos extension does not hot-load updated `dist` in the current process. Restart Cocos after code changes.
- Tool visibility is capability-gated; `tools/list` may vary by project/editor state.

## Quality Gate
```bash
npm run build
npm run test:mcp
```

For online integration changes, also run:
```bash
npm run smoke:mcp:online
```
