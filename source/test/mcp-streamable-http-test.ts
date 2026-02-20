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

function openSse(port: number, sessionId?: string): Promise<{
    req: http.ClientRequest;
    res: http.IncomingMessage;
    firstChunk: string;
}> {
    return new Promise((resolve, reject) => {
        const headers: Record<string, string> = {
            Accept: 'text/event-stream'
        };

        if (sessionId) {
            headers['MCP-Session-Id'] = sessionId;
        }

        const req = http.request(
            {
                method: 'GET',
                host: '127.0.0.1',
                port,
                path: '/mcp',
                headers
            },
            (res) => {
                res.setEncoding('utf8');

                let settled = false;
                res.on('data', (chunk: string) => {
                    if (!settled) {
                        settled = true;
                        resolve({ req, res, firstChunk: chunk });
                    }
                });

                // 非 SSE 响应可能没有 data 事件，直接在 end 兜底
                res.on('end', () => {
                    if (!settled) {
                        settled = true;
                        resolve({ req, res, firstChunk: '' });
                    }
                });
            }
        );

        req.on('error', reject);
        req.end();
    });
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
        sessionIdGenerator: () => 'session-sse',
        nextRuntimeFactory: async () => {
            const requester = async (channel: string, method: string, ..._args: any[]): Promise<any> => {
                if (channel === 'asset-db' && method === 'query-assets') {
                    return [];
                }
                throw new Error(`Unexpected request: ${channel}.${method}`);
            };
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
        assert.ok(sessionId, 'initialize 必须返回会话头');

        const initialized = await postJson(
            port,
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            sessionId
        );
        assert.strictEqual(initialized.statusCode, 202);

        const missingSession = await openSse(port);
        assert.strictEqual(missingSession.res.statusCode, 400);
        missingSession.res.resume();

        const sse = await openSse(port, sessionId);
        assert.strictEqual(sse.res.statusCode, 200);
        assert.ok(
            (sse.res.headers['content-type'] || '').includes('text/event-stream'),
            'SSE 响应必须是 text/event-stream'
        );
        assert.ok(sse.firstChunk.includes('event: ready'), 'SSE 首帧应包含 ready 事件');

        const streamableHttp = (server as any).streamableHttp;
        assert.strictEqual(streamableHttp.getSessionConnectionCount(sessionId), 1);

        sse.req.destroy();
        sse.res.destroy();

        await new Promise((resolve) => setTimeout(resolve, 80));
        assert.strictEqual(streamableHttp.getSessionConnectionCount(sessionId), 0);

        console.log('mcp-streamable-http-test: PASS');
    } finally {
        server.stop();
    }
}

main().catch((error) => {
    console.error('mcp-streamable-http-test: FAIL');
    console.error(error);
    process.exit(1);
});
