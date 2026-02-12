import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { MCPServer } from '../mcp-server';
import { MCPServerSettings, ToolDefinition } from '../types';

class MockTools {
    public getTools(): ToolDefinition[] {
        return [
            {
                name: 'echo',
                description: 'Echo args for V2 manifest test',
                inputSchema: {
                    type: 'object',
                    properties: {
                        value: { type: 'string' }
                    }
                }
            }
        ];
    }

    public async execute(toolName: string, args: any): Promise<any> {
        if (toolName !== 'echo') {
            throw new Error(`Tool mock_${toolName} not found`);
        }

        return {
            success: true,
            data: {
                echo: args
            }
        };
    }
}

interface HttpResult {
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
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

    const server = new MCPServer(settings, {
        toolExecutors: {
            mock: new MockTools()
        },
        sessionIdGenerator: () => 'session-manifest'
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
        const mockEchoTool = tools.find((item) => item.name === 'mock_echo');
        assert.ok(mockEchoTool, 'tools/list 中必须包含 mock_echo');
        assert.ok(mockEchoTool._meta, 'tools/list 中的工具必须包含 _meta');
        assert.ok(mockEchoTool.outputSchema, 'tools/list 中的工具必须包含 outputSchema');

        const workflowTool = tools.find((item) => item.name === 'workflow_safe_set_transform');
        assert.ok(workflowTool, 'tools/list 必须包含 workflow 工具');

        const manifest = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 3,
                method: 'get_tool_manifest',
                params: { name: 'workflow_safe_set_transform' }
            },
            sessionId
        );
        assert.strictEqual(manifest.statusCode, 200);
        const manifestBody = parseJson(manifest.body);
        assert.strictEqual(manifestBody.result.name, 'workflow_safe_set_transform');
        assert.strictEqual(manifestBody.result.layer, 'core');
        assert.strictEqual(manifestBody.result.supportsDryRun, true);
        assert.ok(Array.isArray(manifestBody.result.examples));
        assert.ok(manifestBody.result.examples.length >= 2);

        const toolCall = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'mock_echo',
                    arguments: {
                        value: 'hello'
                    }
                }
            },
            sessionId
        );
        assert.strictEqual(toolCall.statusCode, 200);
        const toolCallBody = parseJson(toolCall.body);
        assert.strictEqual(toolCallBody.result.isError, undefined);
        assert.strictEqual(toolCallBody.result.structuredContent.success, true);
        assert.strictEqual(toolCallBody.result.structuredContent.meta.tool, 'mock_echo');
        assert.ok(typeof toolCallBody.result.structuredContent.meta.traceId === 'string');

        const unknownTool = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 5,
                method: 'tools/call',
                params: {
                    name: 'unknown_tool',
                    arguments: {}
                }
            },
            sessionId
        );
        assert.strictEqual(unknownTool.statusCode, 200);
        assert.strictEqual(parseJson(unknownTool.body).error.code, -32602);

        const traceQuery = await postJson(
            port,
            {
                jsonrpc: '2.0',
                id: 6,
                method: 'get_trace_by_id',
                params: {
                    traceId: toolCallBody.result.structuredContent.meta.traceId
                }
            },
            sessionId
        );
        assert.strictEqual(traceQuery.statusCode, 200);
        const traceBody = parseJson(traceQuery.body);
        assert.strictEqual(traceBody.result.trace.tool, 'mock_echo');

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
