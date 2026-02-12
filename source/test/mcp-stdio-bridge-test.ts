import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

interface LineWaiter {
    resolve: (line: string) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

function createMockUpstreamServer(): Promise<{ server: http.Server; port: number }> {
    const server = http.createServer(async (req, res) => {
        if (req.method !== 'POST' || req.url !== '/mcp') {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
        }

        let body = '';
        for await (const chunk of req) {
            body += chunk.toString();
        }

        let message: any;
        try {
            message = JSON.parse(body);
        } catch (error: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: `Parse error: ${error.message}`
                }
            }));
            return;
        }

        if (message.method === 'initialize') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('MCP-Session-Id', 'bridge-session');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                    protocolVersion: '2025-11-25',
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: 'mock-upstream',
                        version: '1.0.0'
                    }
                }
            }));
            return;
        }

        if (message.method === 'notifications/initialized') {
            res.statusCode = 202;
            res.end();
            return;
        }

        if (message.method === 'tools/list') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                    tools: [{ name: 'mock_echo' }]
                }
            }));
            return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id ?? null,
            error: {
                code: -32601,
                message: 'Method not found'
            }
        }));
    });

    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address() as AddressInfo;
            resolve({ server, port: address.port });
        });
        server.on('error', reject);
    });
}

async function main(): Promise<void> {
    const upstream = await createMockUpstreamServer();
    const bridgePath = path.join(process.cwd(), 'dist', 'stdio-http-bridge.js');

    const child: ChildProcessWithoutNullStreams = spawn(
        process.execPath,
        [bridgePath, '--url', `http://127.0.0.1:${upstream.port}/mcp`],
        {
            stdio: ['pipe', 'pipe', 'pipe']
        }
    );

    const outputLines: string[] = [];
    let stdoutBuffer = '';
    const waiters: LineWaiter[] = [];

    const flushWaiter = (line: string) => {
        const waiter = waiters.shift();
        if (!waiter) {
            return;
        }
        clearTimeout(waiter.timeout);
        waiter.resolve(line);
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
        stdoutBuffer += chunk;

        while (true) {
            const newlineIndex = stdoutBuffer.indexOf('\n');
            if (newlineIndex === -1) {
                break;
            }

            const line = stdoutBuffer.slice(0, newlineIndex).trim();
            stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

            if (!line) {
                continue;
            }

            if (waiters.length > 0) {
                flushWaiter(line);
            } else {
                outputLines.push(line);
            }
        }
    });

    child.stderr.setEncoding('utf8');

    const waitForLine = (timeoutMs: number = 3000): Promise<string> => {
        if (outputLines.length > 0) {
            return Promise.resolve(outputLines.shift() as string);
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`等待桥接输出超时（${timeoutMs}ms）`));
            }, timeoutMs);

            waiters.push({ resolve, reject, timeout });
        });
    };

    const writeLine = (line: string): void => {
        child.stdin.write(`${line}\n`);
    };

    try {
        // 非法 JSON 行
        writeLine('not-json');
        const parseErrorLine = await waitForLine();
        const parseError = JSON.parse(parseErrorLine);
        assert.strictEqual(parseError.error.code, -32700);

        // initialize request
        writeLine(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-11-25' }
        }));

        const initializeLine = await waitForLine();
        assert.ok(!initializeLine.startsWith('Content-Length:'), 'stdout 不应输出 Content-Length 帧头');
        const initializeResponse = JSON.parse(initializeLine);
        assert.strictEqual(initializeResponse.id, 1);
        assert.ok(initializeResponse.result);

        // initialized notification（不应有回包）
        const lineCountBeforeNotification = outputLines.length;
        writeLine(JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        }));

        await new Promise((resolve) => setTimeout(resolve, 250));
        assert.strictEqual(outputLines.length, lineCountBeforeNotification);

        // tools/list request
        writeLine(JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list'
        }));

        const toolsListLine = await waitForLine();
        const toolsListResponse = JSON.parse(toolsListLine);
        assert.strictEqual(toolsListResponse.id, 2);
        assert.ok(Array.isArray(toolsListResponse.result.tools));
        assert.strictEqual(toolsListResponse.result.tools[0].name, 'mock_echo');

        console.log('mcp-stdio-bridge-test: PASS');
    } finally {
        child.kill('SIGTERM');
        upstream.server.close();
    }
}

main().catch((error) => {
    console.error('mcp-stdio-bridge-test: FAIL');
    console.error(error);
    process.exit(1);
});
