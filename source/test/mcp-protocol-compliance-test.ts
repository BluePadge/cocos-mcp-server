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

function deleteSession(port: number, sessionId?: string): Promise<HttpResult> {
    return new Promise((resolve, reject) => {
        const headers: Record<string, string> = {};
        if (sessionId) {
            headers['MCP-Session-Id'] = sessionId;
        }

        const req = http.request(
            {
                method: 'DELETE',
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

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
        if (channel === 'asset-db' && method === 'query-assets') {
            return [{ uuid: 'asset-1', url: 'db://assets/a.prefab' }];
        }
        if (channel === 'asset-db' && method === 'query-asset-info') {
            const query = args[0];
            if (query === 'bad://missing') {
                throw new Error('mock failure');
            }
            return { uuid: 'asset-1', url: String(query) };
        }
        throw new Error(`Unexpected request: ${channel}.${method}`);
    };

    const server = new MCPServer(settings, {
        sessionIdGenerator: () => 'session-fixed',
        nextRuntimeFactory: async () => {
            const tools = createOfficialTools(requester);
            const matrix = createMatrix([
                'asset-db.query-assets',
                'asset-db.query-asset-info'
            ]);
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
        // 1. 非法 JSON => -32700
        const parseError = await postRaw(port, '{');
        assert.strictEqual(parseError.statusCode, 400);
        assert.strictEqual(parseJson(parseError.body).error.code, -32700);

        // 2. POST batch 不支持 => -32600
        const emptyBatch = await postRaw(port, '[]');
        assert.strictEqual(emptyBatch.statusCode, 200);
        assert.strictEqual(parseJson(emptyBatch.body).error.code, -32600);

        // initialize 并提取会话
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

        // 缺失会话头 => HTTP 400
        const missingHeader = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
        );
        assert.strictEqual(missingHeader.statusCode, 400);

        // 未 ready 前调用 tools/list => -32600
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

        // 普通 notification => 202 且无 body
        const progressNotification = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: { value: 1 } }),
            sessionId
        );
        assert.strictEqual(progressNotification.statusCode, 202);
        assert.strictEqual(progressNotification.body, '');

        // tools/list 返回 next 工具并带 _meta
        const listResult = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list' }),
            sessionId
        );
        assert.strictEqual(listResult.statusCode, 200);
        const listBody = parseJson(listResult.body);
        assert.ok(Array.isArray(listBody.result.tools));
        assert.ok(listBody.result.tools.length > 0);
        assert.ok(listBody.result.tools[0]._meta);

        // 未知方法 => -32601
        const unknownMethod = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'unknown/method' }),
            sessionId
        );
        assert.strictEqual(unknownMethod.statusCode, 200);
        assert.strictEqual(parseJson(unknownMethod.body).error.code, -32601);

        // tools/call 缺少 name => -32602
        const missingName = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: {} }),
            sessionId
        );
        assert.strictEqual(missingName.statusCode, 200);
        assert.strictEqual(parseJson(missingName.body).error.code, -32602);

        // 业务失败 => result.isError = true
        const businessFailure = await postRaw(
            port,
            JSON.stringify({
                jsonrpc: '2.0',
                id: 7,
                method: 'tools/call',
                params: {
                    name: 'asset_query_asset_info',
                    arguments: {
                        urlOrUuid: 'bad://missing'
                    }
                }
            }),
            sessionId
        );
        assert.strictEqual(businessFailure.statusCode, 200);
        const businessBody = parseJson(businessFailure.body);
        assert.strictEqual(businessBody.result.isError, true);
        assert.strictEqual(businessBody.result.structuredContent.success, false);
        assert.ok(typeof businessBody.result.structuredContent.error.code === 'string');

        // get_tool_manifest
        const manifestResult = await postRaw(
            port,
            JSON.stringify({
                jsonrpc: '2.0',
                id: 8,
                method: 'get_tool_manifest',
                params: { name: 'asset_query_asset_info' }
            }),
            sessionId
        );
        assert.strictEqual(manifestResult.statusCode, 200);
        const manifestBody = parseJson(manifestResult.body);
        assert.strictEqual(manifestBody.result.name, 'asset_query_asset_info');
        assert.strictEqual(manifestBody.result._meta.layer, 'official');

        // get_trace_by_id
        const traceId = businessBody.result.structuredContent.meta.traceId;
        const traceResult = await postRaw(
            port,
            JSON.stringify({
                jsonrpc: '2.0',
                id: 9,
                method: 'get_trace_by_id',
                params: { traceId }
            }),
            sessionId
        );
        assert.strictEqual(traceResult.statusCode, 200);
        const traceBody = parseJson(traceResult.body);
        assert.strictEqual(traceBody.result.trace.traceId, traceId);
        assert.strictEqual(traceBody.result.trace.tool, 'asset_query_asset_info');

        // DELETE /mcp
        const deleteResult = await deleteSession(port, sessionId);
        assert.strictEqual(deleteResult.statusCode, 204);

        // 删除会话后请求 => HTTP 400
        const afterDelete = await postRaw(
            port,
            JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/list' }),
            sessionId
        );
        assert.strictEqual(afterDelete.statusCode, 400);

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
