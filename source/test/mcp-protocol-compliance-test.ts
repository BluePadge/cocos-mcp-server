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
                description: 'Echo args for test',
                inputSchema: {
                    type: 'object',
                    properties: {
                        fail: { type: 'boolean' },
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

        if (args && args.fail) {
            return {
                success: false,
                error: 'mock failure'
            };
        }

        return {
            success: true,
            data: args
        };
    }
}

interface HttpResult {
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
}

function postRaw(port: number, body: string, sessionId?: string): Promise<HttpResult> {
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
    if (!body.trim()) {
        return null;
    }
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
        sessionIdGenerator: () => 'session-fixed'
    });

    await server.start();

    const httpServer: http.Server = (server as any).httpServer;
    const address = httpServer.address() as AddressInfo;
    const port = address.port;

    try {
        // 1. 非法 JSON => -32700
        const parseError = await postRaw(port, '{');
        assert.strictEqual(parseError.statusCode, 400);
        assert.strictEqual(parseJson(parseError.body).error.code, -32700);

        // 2. 空 batch => -32600
        const emptyBatch = await postRaw(port, '[]');
        assert.strictEqual(emptyBatch.statusCode, 200);
        assert.strictEqual(parseJson(emptyBatch.body).error.code, -32600);

        // initialize，确认返回 MCP-Session-Id
        const initialize = await postRaw(
            port,
            JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-11-25' }
            })
        );
        assert.strictEqual(initialize.statusCode, 200);
        const sessionId = initialize.headers['mcp-session-id'] as string;
        assert.ok(sessionId, 'initialize 必须返回 MCP-Session-Id');

        // 7. 初始化后缺失 session header => HTTP 400
        const missingHeader = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
        );
        assert.strictEqual(missingHeader.statusCode, 400);

        // 5. 未完成 initialized 前调用 tools/list => 生命周期错误
        const notReadyList = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
            sessionId
        );
        assert.strictEqual(notReadyList.statusCode, 200);
        assert.strictEqual(parseJson(notReadyList.body).error.code, -32600);

        // 完成 notifications/initialized
        const initializedNotification = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
            sessionId
        );
        assert.strictEqual(initializedNotification.statusCode, 202);
        assert.strictEqual(initializedNotification.body, '');

        // 3. 仅 notification batch => 202
        const notificationBatch = await postRaw(
            port,
            JSON.stringify([
                { jsonrpc: '2.0', method: 'notifications/progress', params: { value: 1 } },
                { jsonrpc: '2.0', method: 'notifications/custom' }
            ]),
            sessionId
        );
        assert.strictEqual(notificationBatch.statusCode, 202);
        assert.strictEqual(notificationBatch.body, '');

        // 4. request+notification 混合 batch => 仅返回 request 响应
        const mixedBatch = await postRaw(
            port,
            JSON.stringify([
                { jsonrpc: '2.0', id: 4, method: 'tools/list' },
                { jsonrpc: '2.0', method: 'notifications/progress', params: { value: 2 } }
            ]),
            sessionId
        );
        assert.strictEqual(mixedBatch.statusCode, 200);
        const mixedBody = parseJson(mixedBatch.body);
        assert.ok(Array.isArray(mixedBody));
        assert.strictEqual(mixedBody.length, 1);
        assert.strictEqual(mixedBody[0].id, 4);

        // 8. 未知方法 => -32601
        const unknownMethod = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'unknown/method' }),
            sessionId
        );
        assert.strictEqual(unknownMethod.statusCode, 200);
        assert.strictEqual(parseJson(unknownMethod.body).error.code, -32601);

        // 9. tools/call 缺少 name => -32602
        const missingName = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: {} }),
            sessionId
        );
        assert.strictEqual(missingName.statusCode, 200);
        assert.strictEqual(parseJson(missingName.body).error.code, -32602);

        // 10. 工具业务失败 => result.isError = true
        const businessFailure = await postRaw(
            port,
            JSON.stringify({
                jsonrpc: '2.0',
                id: 7,
                method: 'tools/call',
                params: {
                    name: 'mock_echo',
                    arguments: {
                        fail: true
                    }
                }
            }),
            sessionId
        );
        assert.strictEqual(businessFailure.statusCode, 200);
        const businessBody = parseJson(businessFailure.body);
        assert.strictEqual(businessBody.result.isError, true);

        console.log('mcp-protocol-compliance-test: PASS');
    } finally {
        server.stop();
    }
}

main().catch((error) => {
    console.error('mcp-protocol-compliance-test: FAIL');
    console.error(error);
    process.exit(1);
});
