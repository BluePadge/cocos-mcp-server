"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const http = __importStar(require("http"));
const mcp_server_1 = require("../mcp-server");
const official_tools_1 = require("../next/tools/official-tools");
const tool_registry_1 = require("../next/protocol/tool-registry");
const router_1 = require("../next/protocol/router");
function createMatrix(availableKeys) {
    const byKey = {};
    for (const key of availableKeys) {
        const firstDot = key.indexOf('.');
        byKey[key] = {
            key,
            channel: key.slice(0, firstDot),
            method: key.slice(firstDot + 1),
            layer: 'official',
            readonly: true,
            description: key,
            available: true,
            checkedAt: new Date().toISOString(),
            detail: 'ok'
        };
    }
    return {
        generatedAt: new Date().toISOString(),
        byKey,
        summary: {
            total: availableKeys.length,
            available: availableKeys.length,
            unavailable: 0,
            byLayer: {
                official: {
                    total: availableKeys.length,
                    available: availableKeys.length
                },
                extended: {
                    total: 0,
                    available: 0
                },
                experimental: {
                    total: 0,
                    available: 0
                }
            }
        }
    };
}
function postJson(port, payload, sessionId) {
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (sessionId) {
            headers['MCP-Session-Id'] = sessionId;
        }
        const req = http.request({
            method: 'POST',
            host: '127.0.0.1',
            port,
            path: '/mcp',
            headers
        }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 0,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
function parseJson(body) {
    return JSON.parse(body);
}
async function main() {
    const settings = {
        port: 0,
        autoStart: false,
        enableDebugLog: false,
        allowedOrigins: ['*'],
        maxConnections: 10
    };
    const requester = async (channel, method, ..._args) => {
        if (channel === 'asset-db' && method === 'query-assets') {
            return [
                { url: 'db://assets/a.prefab', uuid: 'uuid-a' },
                { url: 'db://assets/b.prefab', uuid: 'uuid-b' }
            ];
        }
        throw new Error(`Unexpected request: ${channel}.${method}`);
    };
    const server = new mcp_server_1.MCPServer(settings, {
        sessionIdGenerator: () => 'session-manifest',
        nextRuntimeFactory: async () => {
            const tools = (0, official_tools_1.createOfficialTools)(requester);
            const matrix = createMatrix(['asset-db.query-assets']);
            const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
            const router = new router_1.NextMcpRouter(registry);
            return { registry, router };
        }
    });
    await server.start();
    const httpServer = server.httpServer;
    const address = httpServer.address();
    const port = address.port;
    try {
        const initialize = await postJson(port, {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-11-25' }
        });
        assert.strictEqual(initialize.statusCode, 200);
        const sessionId = initialize.headers['mcp-session-id'];
        assert.ok(sessionId);
        const initialized = await postJson(port, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);
        assert.strictEqual(initialized.statusCode, 202);
        const toolsList = await postJson(port, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, sessionId);
        assert.strictEqual(toolsList.statusCode, 200);
        const toolsListBody = parseJson(toolsList.body);
        const tools = toolsListBody.result.tools;
        const assetQueryTool = tools.find((item) => item.name === 'asset_query_assets');
        assert.ok(assetQueryTool, 'tools/list 中必须包含 asset_query_assets');
        assert.ok(assetQueryTool._meta, 'tools/list 中的工具必须包含 _meta');
        assert.strictEqual(assetQueryTool._meta.layer, 'official');
        const manifest = await postJson(port, {
            jsonrpc: '2.0',
            id: 3,
            method: 'get_tool_manifest',
            params: { name: 'asset_query_assets' }
        }, sessionId);
        assert.strictEqual(manifest.statusCode, 200);
        const manifestBody = parseJson(manifest.body);
        assert.strictEqual(manifestBody.result.name, 'asset_query_assets');
        assert.strictEqual(manifestBody.result._meta.layer, 'official');
        assert.strictEqual(manifestBody.result._meta.supportsDryRun, false);
        assert.ok(Array.isArray(manifestBody.result.requiredCapabilities));
        assert.ok(manifestBody.result.requiredCapabilities.includes('asset-db.query-assets'));
        const toolCall = await postJson(port, {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'asset_query_assets',
                arguments: {
                    pattern: 'db://assets/**/*.prefab'
                }
            }
        }, sessionId);
        assert.strictEqual(toolCall.statusCode, 200);
        const toolCallBody = parseJson(toolCall.body);
        assert.strictEqual(toolCallBody.result.isError, false);
        assert.strictEqual(toolCallBody.result.structuredContent.success, true);
        assert.strictEqual(toolCallBody.result.structuredContent.meta.tool, 'asset_query_assets');
        assert.ok(typeof toolCallBody.result.structuredContent.meta.traceId === 'string');
        assert.strictEqual(toolCallBody.result.structuredContent.data.count, 2);
        const traceQuery = await postJson(port, {
            jsonrpc: '2.0',
            id: 5,
            method: 'get_trace_by_id',
            params: {
                traceId: toolCallBody.result.structuredContent.meta.traceId
            }
        }, sessionId);
        assert.strictEqual(traceQuery.statusCode, 200);
        const traceBody = parseJson(traceQuery.body);
        assert.strictEqual(traceBody.result.trace.tool, 'asset_query_assets');
        console.log('mcp-v2-manifest-test: PASS');
    }
    finally {
        server.stop();
    }
}
main().catch((error) => {
    console.error('mcp-v2-manifest-test: FAIL');
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXYyLW1hbmlmZXN0LXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC9tY3AtdjItbWFuaWZlc3QtdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUNqQywyQ0FBNkI7QUFFN0IsOENBQTBDO0FBRzFDLGlFQUFtRTtBQUNuRSxrRUFBa0U7QUFDbEUsb0RBQXdEO0FBUXhELFNBQVMsWUFBWSxDQUFDLGFBQXVCO0lBQ3pDLE1BQU0sS0FBSyxHQUE4QixFQUFFLENBQUM7SUFDNUMsS0FBSyxNQUFNLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztRQUM5QixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRztZQUNULEdBQUc7WUFDSCxPQUFPLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDO1lBQy9CLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFDL0IsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZQUNkLE9B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QixDQUFDLENBQUM7UUFFdEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0lBQzlDLENBQUM7WUFBUyxDQUFDO1FBQ1AsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2xCLENBQUM7QUFDTCxDQUFDO0FBRUQsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDbkIsT0FBTyxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0lBQzVDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDckIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbmV0JztcbmltcG9ydCB7IE1DUFNlcnZlciB9IGZyb20gJy4uL21jcC1zZXJ2ZXInO1xuaW1wb3J0IHsgTUNQU2VydmVyU2V0dGluZ3MgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBDYXBhYmlsaXR5TWF0cml4IH0gZnJvbSAnLi4vbmV4dC9tb2RlbHMnO1xuaW1wb3J0IHsgY3JlYXRlT2ZmaWNpYWxUb29scyB9IGZyb20gJy4uL25leHQvdG9vbHMvb2ZmaWNpYWwtdG9vbHMnO1xuaW1wb3J0IHsgTmV4dFRvb2xSZWdpc3RyeSB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvdG9vbC1yZWdpc3RyeSc7XG5pbXBvcnQgeyBOZXh0TWNwUm91dGVyIH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC9yb3V0ZXInO1xuXG5pbnRlcmZhY2UgSHR0cFJlc3VsdCB7XG4gICAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICAgIGhlYWRlcnM6IGh0dHAuSW5jb21pbmdIdHRwSGVhZGVycztcbiAgICBib2R5OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdHJpeChhdmFpbGFibGVLZXlzOiBzdHJpbmdbXSk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIGNvbnN0IGJ5S2V5OiBDYXBhYmlsaXR5TWF0cml4WydieUtleSddID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgb2YgYXZhaWxhYmxlS2V5cykge1xuICAgICAgICBjb25zdCBmaXJzdERvdCA9IGtleS5pbmRleE9mKCcuJyk7XG4gICAgICAgIGJ5S2V5W2tleV0gPSB7XG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICBjaGFubmVsOiBrZXkuc2xpY2UoMCwgZmlyc3REb3QpLFxuICAgICAgICAgICAgbWV0aG9kOiBrZXkuc2xpY2UoZmlyc3REb3QgKyAxKSxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjoga2V5LFxuICAgICAgICAgICAgYXZhaWxhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBkZXRhaWw6ICdvaydcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBieUtleSxcbiAgICAgICAgc3VtbWFyeToge1xuICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHVuYXZhaWxhYmxlOiAwLFxuICAgICAgICAgICAgYnlMYXllcjoge1xuICAgICAgICAgICAgICAgIG9mZmljaWFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXh0ZW5kZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBwb3N0SnNvbihwb3J0OiBudW1iZXIsIHBheWxvYWQ6IHVua25vd24sIHNlc3Npb25JZD86IHN0cmluZyk6IFByb21pc2U8SHR0cFJlc3VsdD4ge1xuICAgIGNvbnN0IGJvZHkgPSBKU09OLnN0cmluZ2lmeShwYXlsb2FkKTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHNlc3Npb25JZCkge1xuICAgICAgICAgICAgaGVhZGVyc1snTUNQLVNlc3Npb24tSWQnXSA9IHNlc3Npb25JZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlcSA9IGh0dHAucmVxdWVzdChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgICAgICBob3N0OiAnMTI3LjAuMC4xJyxcbiAgICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICAgIHBhdGg6ICcvbWNwJyxcbiAgICAgICAgICAgICAgICBoZWFkZXJzXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICAgICAgICAgICAgcmVzLnNldEVuY29kaW5nKCd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgcmVzLm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogcmVzLnN0YXR1c0NvZGUgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHJlcy5oZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICByZXEub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgICAgcmVxLndyaXRlKGJvZHkpO1xuICAgICAgICByZXEuZW5kKCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSnNvbihib2R5OiBzdHJpbmcpOiBhbnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGJvZHkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncyA9IHtcbiAgICAgICAgcG9ydDogMCxcbiAgICAgICAgYXV0b1N0YXJ0OiBmYWxzZSxcbiAgICAgICAgZW5hYmxlRGVidWdMb2c6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgIG1heENvbm5lY3Rpb25zOiAxMFxuICAgIH07XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uX2FyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXRzJykge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICB7IHVybDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJywgdXVpZDogJ3V1aWQtYScgfSxcbiAgICAgICAgICAgICAgICB7IHVybDogJ2RiOi8vYXNzZXRzL2IucHJlZmFiJywgdXVpZDogJ3V1aWQtYicgfVxuICAgICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgcmVxdWVzdDogJHtjaGFubmVsfS4ke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2VydmVyID0gbmV3IE1DUFNlcnZlcihzZXR0aW5ncywge1xuICAgICAgICBzZXNzaW9uSWRHZW5lcmF0b3I6ICgpID0+ICdzZXNzaW9uLW1hbmlmZXN0JyxcbiAgICAgICAgbmV4dFJ1bnRpbWVGYWN0b3J5OiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0cyddKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgICAgICAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG4gICAgICAgICAgICByZXR1cm4geyByZWdpc3RyeSwgcm91dGVyIH07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHNlcnZlci5zdGFydCgpO1xuXG4gICAgY29uc3QgaHR0cFNlcnZlcjogaHR0cC5TZXJ2ZXIgPSAoc2VydmVyIGFzIGFueSkuaHR0cFNlcnZlcjtcbiAgICBjb25zdCBhZGRyZXNzID0gaHR0cFNlcnZlci5hZGRyZXNzKCkgYXMgQWRkcmVzc0luZm87XG4gICAgY29uc3QgcG9ydCA9IGFkZHJlc3MucG9ydDtcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGluaXRpYWxpemUgPSBhd2FpdCBwb3N0SnNvbihwb3J0LCB7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiAxLFxuICAgICAgICAgICAgbWV0aG9kOiAnaW5pdGlhbGl6ZScsXG4gICAgICAgICAgICBwYXJhbXM6IHsgcHJvdG9jb2xWZXJzaW9uOiAnMjAyNS0xMS0yNScgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluaXRpYWxpemUuc3RhdHVzQ29kZSwgMjAwKTtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gaW5pdGlhbGl6ZS5oZWFkZXJzWydtY3Atc2Vzc2lvbi1pZCddIGFzIHN0cmluZztcbiAgICAgICAgYXNzZXJ0Lm9rKHNlc3Npb25JZCk7XG5cbiAgICAgICAgY29uc3QgaW5pdGlhbGl6ZWQgPSBhd2FpdCBwb3N0SnNvbihcbiAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICB7IGpzb25ycGM6ICcyLjAnLCBtZXRob2Q6ICdub3RpZmljYXRpb25zL2luaXRpYWxpemVkJyB9LFxuICAgICAgICAgICAgc2Vzc2lvbklkXG4gICAgICAgICk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbml0aWFsaXplZC5zdGF0dXNDb2RlLCAyMDIpO1xuXG4gICAgICAgIGNvbnN0IHRvb2xzTGlzdCA9IGF3YWl0IHBvc3RKc29uKFxuICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgIHsganNvbnJwYzogJzIuMCcsIGlkOiAyLCBtZXRob2Q6ICd0b29scy9saXN0JyB9LFxuICAgICAgICAgICAgc2Vzc2lvbklkXG4gICAgICAgICk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0b29sc0xpc3Quc3RhdHVzQ29kZSwgMjAwKTtcbiAgICAgICAgY29uc3QgdG9vbHNMaXN0Qm9keSA9IHBhcnNlSnNvbih0b29sc0xpc3QuYm9keSk7XG4gICAgICAgIGNvbnN0IHRvb2xzID0gdG9vbHNMaXN0Qm9keS5yZXN1bHQudG9vbHMgYXMgQXJyYXk8YW55PjtcbiAgICAgICAgY29uc3QgYXNzZXRRdWVyeVRvb2wgPSB0b29scy5maW5kKChpdGVtKSA9PiBpdGVtLm5hbWUgPT09ICdhc3NldF9xdWVyeV9hc3NldHMnKTtcbiAgICAgICAgYXNzZXJ0Lm9rKGFzc2V0UXVlcnlUb29sLCAndG9vbHMvbGlzdCDkuK3lv4XpobvljIXlkKsgYXNzZXRfcXVlcnlfYXNzZXRzJyk7XG4gICAgICAgIGFzc2VydC5vayhhc3NldFF1ZXJ5VG9vbC5fbWV0YSwgJ3Rvb2xzL2xpc3Qg5Lit55qE5bel5YW35b+F6aG75YyF5ZCrIF9tZXRhJyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChhc3NldFF1ZXJ5VG9vbC5fbWV0YS5sYXllciwgJ29mZmljaWFsJyk7XG5cbiAgICAgICAgY29uc3QgbWFuaWZlc3QgPSBhd2FpdCBwb3N0SnNvbihcbiAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgaWQ6IDMsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0X3Rvb2xfbWFuaWZlc3QnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogeyBuYW1lOiAnYXNzZXRfcXVlcnlfYXNzZXRzJyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2Vzc2lvbklkXG4gICAgICAgICk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChtYW5pZmVzdC5zdGF0dXNDb2RlLCAyMDApO1xuICAgICAgICBjb25zdCBtYW5pZmVzdEJvZHkgPSBwYXJzZUpzb24obWFuaWZlc3QuYm9keSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChtYW5pZmVzdEJvZHkucmVzdWx0Lm5hbWUsICdhc3NldF9xdWVyeV9hc3NldHMnKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKG1hbmlmZXN0Qm9keS5yZXN1bHQuX21ldGEubGF5ZXIsICdvZmZpY2lhbCcpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwobWFuaWZlc3RCb2R5LnJlc3VsdC5fbWV0YS5zdXBwb3J0c0RyeVJ1biwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQub2soQXJyYXkuaXNBcnJheShtYW5pZmVzdEJvZHkucmVzdWx0LnJlcXVpcmVkQ2FwYWJpbGl0aWVzKSk7XG4gICAgICAgIGFzc2VydC5vayhtYW5pZmVzdEJvZHkucmVzdWx0LnJlcXVpcmVkQ2FwYWJpbGl0aWVzLmluY2x1ZGVzKCdhc3NldC1kYi5xdWVyeS1hc3NldHMnKSk7XG5cbiAgICAgICAgY29uc3QgdG9vbENhbGwgPSBhd2FpdCBwb3N0SnNvbihcbiAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgaWQ6IDQsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9hc3NldHMnLFxuICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm46ICdkYjovL2Fzc2V0cy8qKi8qLnByZWZhYidcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXNzaW9uSWRcbiAgICAgICAgKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xDYWxsLnN0YXR1c0NvZGUsIDIwMCk7XG4gICAgICAgIGNvbnN0IHRvb2xDYWxsQm9keSA9IHBhcnNlSnNvbih0b29sQ2FsbC5ib2R5KTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xDYWxsQm9keS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwodG9vbENhbGxCb2R5LnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5zdWNjZXNzLCB0cnVlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xDYWxsQm9keS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQubWV0YS50b29sLCAnYXNzZXRfcXVlcnlfYXNzZXRzJyk7XG4gICAgICAgIGFzc2VydC5vayh0eXBlb2YgdG9vbENhbGxCb2R5LnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5tZXRhLnRyYWNlSWQgPT09ICdzdHJpbmcnKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xDYWxsQm9keS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jb3VudCwgMik7XG5cbiAgICAgICAgY29uc3QgdHJhY2VRdWVyeSA9IGF3YWl0IHBvc3RKc29uKFxuICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICBpZDogNSxcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRfdHJhY2VfYnlfaWQnLFxuICAgICAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgICAgICB0cmFjZUlkOiB0b29sQ2FsbEJvZHkucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50Lm1ldGEudHJhY2VJZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXNzaW9uSWRcbiAgICAgICAgKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNlUXVlcnkuc3RhdHVzQ29kZSwgMjAwKTtcbiAgICAgICAgY29uc3QgdHJhY2VCb2R5ID0gcGFyc2VKc29uKHRyYWNlUXVlcnkuYm9keSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0cmFjZUJvZHkucmVzdWx0LnRyYWNlLnRvb2wsICdhc3NldF9xdWVyeV9hc3NldHMnKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnbWNwLXYyLW1hbmlmZXN0LXRlc3Q6IFBBU1MnKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgICBzZXJ2ZXIuc3RvcCgpO1xuICAgIH1cbn1cblxubWFpbigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ21jcC12Mi1tYW5pZmVzdC10ZXN0OiBGQUlMJyk7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=