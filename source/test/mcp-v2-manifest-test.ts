import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { MCPServer } from '../mcp-server';
import { MCPServerSettings } from '../types';
import { CapabilityMatrix } from '../next/models';
import { createOfficialTools } from '../next/tools/official-tools';
import { NextToolRegistry } from '../next/protocol/tool-registry';
import { NextMcpRouter } from '../next/protocol/router';

interface HttpResult {
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
}

function createMatrix(availableKeys: string[]): CapabilityMatrix {
    const byKey: CapabilityMatrix['byKey'] = {};
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

function postJson(port: number, payload: unknown, sessionId?: string): Promise<HttpResult> {
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (sessionId) {
            headers['MCP-Session-Id'] = sessionId;
        }

        const req = http.request(
            {
                method: 'POST',
                host: '127.0.0.1',
                port,
                path: '/mcp',
                headers
            },
            (res) => {
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
            }
        );

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function parseJson(body: string): any {
    return JSON.parse(body);
}

async function main(): Promise<void> {
    const settings: MCPServerSettings = {
        port: 0,
        autoStart: false,
        enableDebugLog: false,
        allowedOrigins: ['*'],
        maxConnections: 10
    };

    const requester = async (channel: string, method: string, ..._args: any[]): Promise<any> => {
        if (channel === 'asset-db' && method === 'query-assets') {
            return [
                { url: 'db://assets/a.prefab', uuid: 'uuid-a' },
                { url: 'db://assets/b.prefab', uuid: 'uuid-b' }
            ];
        }
        throw new Error(`Unexpected request: ${channel}.${method}`);
    };

    const server = new MCPServer(settings, {
        sessionIdGenerator: () => 'session-manifest',
        nextRuntimeFactory: async () => {
            const tools = createOfficialTools(requester);
            const matrix = createMatrix(['asset-db.query-assets']);
            const registry = new NextToolRegistry(tools, matrix);
            const router = new NextMcpRouter(registry);
            return { registry, router };
        }
    });

    await server.start();

    const httpServer: http.Server = (server as any).httpServer;
    const address = httpServer.address() as AddressInfo;
    const port = address.port;

    try {
        const initialize = await postJson(port, {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-11-25' }
        });
        assert.strictEqual(initialize.statusCode, 200);
        const sessionId = initialize.headers['mcp-session-id'] as string;
        assert.ok(sessionId);

        const initialized = await postJson(
            port,
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            sessionId
        );
        assert.strictEqual(initialized.statusCode, 202);

        const toolsList = await postJson(
            port,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
            sessionId
        );
        assert.strictEqual(toolsList.statusCode, 200);
        const toolsListBody = parseJson(toolsList.body);
        const tools = toolsListBody.result.tools as Array<any>;
        const assetQueryTool = tools.find((item) => item.name === 'asset_query_assets');
        assert.ok(assetQueryTool, 'tools/list 中必须包含 asset_query_assets');
        assert.ok(assetQueryTool._meta, 'tools/list 中的工具必须包含 _meta');
        assert.strictEqual(assetQueryTool._meta.layer, 'official');

        const manifest = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 3,
                method: 'get_tool_manifest',
                params: { name: 'asset_query_assets' }
            },
            sessionId
        );
        assert.strictEqual(manifest.statusCode, 200);
        const manifestBody = parseJson(manifest.body);
        assert.strictEqual(manifestBody.result.name, 'asset_query_assets');
        assert.strictEqual(manifestBody.result._meta.layer, 'official');
        assert.strictEqual(manifestBody.result._meta.supportsDryRun, false);
        assert.ok(Array.isArray(manifestBody.result.requiredCapabilities));
        assert.ok(manifestBody.result.requiredCapabilities.includes('asset-db.query-assets'));

        const toolCall = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'asset_query_assets',
                    arguments: {
                        pattern: 'db://assets/**/*.prefab'
                    }
                }
            },
            sessionId
        );
        assert.strictEqual(toolCall.statusCode, 200);
        const toolCallBody = parseJson(toolCall.body);
        assert.strictEqual(toolCallBody.result.isError, false);
        assert.strictEqual(toolCallBody.result.structuredContent.success, true);
        assert.strictEqual(toolCallBody.result.structuredContent.meta.tool, 'asset_query_assets');
        assert.ok(typeof toolCallBody.result.structuredContent.meta.traceId === 'string');
        assert.strictEqual(toolCallBody.result.structuredContent.data.count, 2);

        const traceQuery = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 5,
                method: 'get_trace_by_id',
                params: {
                    traceId: toolCallBody.result.structuredContent.meta.traceId
                }
            },
            sessionId
        );
        assert.strictEqual(traceQuery.statusCode, 200);
        const traceBody = parseJson(traceQuery.body);
        assert.strictEqual(traceBody.result.trace.tool, 'asset_query_assets');

        console.log('mcp-v2-manifest-test: PASS');
    } finally {
        server.stop();
    }
}

main().catch((error) => {
    console.error('mcp-v2-manifest-test: FAIL');
    console.error(error);
    process.exit(1);
});
