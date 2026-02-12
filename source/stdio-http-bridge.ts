import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

interface BridgeOptions {
    endpoint: string;
    timeoutMs: number;
    debug: boolean;
}

interface HttpResponse {
    statusCode: number;
    body: string;
    headers: http.IncomingHttpHeaders;
}

interface JsonRpcErrorResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    error: {
        code: number;
        message: string;
    };
}

const DEFAULT_ENDPOINT = process.env.COCOS_MCP_HTTP_URL || 'http://127.0.0.1:3000/mcp';
const DEFAULT_TIMEOUT_MS = Number(process.env.COCOS_MCP_HTTP_TIMEOUT_MS || 30000);

class StdioHttpBridge {
    private readonly options: BridgeOptions;
    private buffer = '';
    private processingQueue: Promise<void> = Promise.resolve();
    private sessionId: string | null = null;

    constructor(options: BridgeOptions) {
        this.options = options;
    }

    public start(): void {
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (chunk: string) => {
            this.onStdinData(chunk);
        });

        process.stdin.on('error', (error) => {
            this.logError(`读取 stdin 失败: ${error.message}`);
        });

        process.stdin.on('end', () => {
            this.logDebug('stdin 已结束，桥接进程即将退出。');
            process.exit(0);
        });

        process.on('SIGINT', () => process.exit(0));
        process.on('SIGTERM', () => process.exit(0));

        process.stdin.resume();
        this.logDebug(`桥接已启动（标准换行协议），目标 MCP 端点: ${this.options.endpoint}`);
    }

    private onStdinData(chunk: string): void {
        this.buffer += chunk;

        while (true) {
            const newlineIndex = this.buffer.indexOf('\n');
            if (newlineIndex === -1) {
                return;
            }

            const rawLine = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);

            const line = rawLine.replace(/\r$/, '').trim();
            if (!line) {
                continue;
            }

            this.enqueueMessage(line);
        }
    }

    private enqueueMessage(messageText: string): void {
        this.processingQueue = this.processingQueue
            .then(() => this.handleMessage(messageText))
            .catch((error: Error) => {
                this.logError(`处理消息失败: ${error.message}`);
            });
    }

    private async handleMessage(messageText: string): Promise<void> {
        let message: any;

        try {
            message = JSON.parse(messageText);
        } catch (error: any) {
            this.logError(`收到非法 JSON: ${error.message}`);
            const parseError: JsonRpcErrorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: `Parse error: ${error.message}`
                }
            };
            this.writeStdoutLine(JSON.stringify(parseError));
            return;
        }

        const expectsResponse = this.expectsResponse(message);

        try {
            const response = await this.forwardToHttp(messageText, message);

            this.captureSessionId(message, response.headers);

            if (!expectsResponse) {
                return;
            }

            if (!response.body.trim()) {
                const emptyResponseError = this.buildErrorResponse(
                    message,
                    -32603,
                    'Bridge error: upstream returned empty response body for request.'
                );
                if (emptyResponseError) {
                    this.writeStdoutLine(JSON.stringify(emptyResponseError));
                }
                return;
            }

            this.writeStdoutLine(response.body.trim());
        } catch (error: any) {
            this.logError(`转发到 HTTP 端点失败: ${error.message}`);
            const errorResponse = this.buildErrorResponse(
                message,
                -32603,
                `Bridge transport error: ${error.message}`
            );

            if (errorResponse) {
                this.writeStdoutLine(JSON.stringify(errorResponse));
            }
        }
    }

    private expectsResponse(message: any): boolean {
        if (Array.isArray(message)) {
            return message.some((item) => this.isRequestMessage(item));
        }

        return this.isRequestMessage(message);
    }

    private isRequestMessage(message: any): boolean {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return false;
        }

        return typeof message.method === 'string' && Object.prototype.hasOwnProperty.call(message, 'id');
    }

    private buildErrorResponse(
        message: any,
        code: number,
        errorMessage: string
    ): JsonRpcErrorResponse | JsonRpcErrorResponse[] | null {
        if (Array.isArray(message)) {
            const requestIds = message
                .filter((item) => this.isRequestMessage(item))
                .map((item) => item.id ?? null);

            if (requestIds.length === 0) {
                return null;
            }

            return requestIds.map((id) => ({
                jsonrpc: '2.0',
                id,
                error: {
                    code,
                    message: errorMessage
                }
            }));
        }

        if (!this.isRequestMessage(message)) {
            return null;
        }

        return {
            jsonrpc: '2.0',
            id: message.id ?? null,
            error: {
                code,
                message: errorMessage
            }
        };
    }

    private async forwardToHttp(rawBody: string, message: unknown): Promise<HttpResponse> {
        const endpointUrl = new URL(this.options.endpoint);
        const client = endpointUrl.protocol === 'https:' ? https : http;
        const payload = Buffer.from(rawBody, 'utf8');
        const headers = this.buildRequestHeaders(message, payload.length);

        return new Promise<HttpResponse>((resolve, reject) => {
            const request = client.request(
                endpointUrl,
                {
                    method: 'POST',
                    headers
                },
                (response) => {
                    const chunks: Buffer[] = [];

                    response.on('data', (chunk: Buffer | string) => {
                        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                    });

                    response.on('end', () => {
                        const body = Buffer.concat(chunks).toString('utf8');
                        const statusCode = response.statusCode || 0;

                        if (statusCode >= 400) {
                            reject(new Error(`upstream HTTP ${statusCode}: ${body || 'empty body'}`));
                            return;
                        }

                        resolve({
                            statusCode,
                            body,
                            headers: response.headers
                        });
                    });
                }
            );

            request.setTimeout(this.options.timeoutMs, () => {
                request.destroy(new Error(`request timeout after ${this.options.timeoutMs}ms`));
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.write(payload);
            request.end();
        });
    }

    private buildRequestHeaders(message: unknown, payloadLength: number): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Content-Length': String(payloadLength),
            Accept: 'application/json'
        };

        if (this.sessionId && this.requiresSessionHeader(message)) {
            headers['MCP-Session-Id'] = this.sessionId;
        }

        return headers;
    }

    private requiresSessionHeader(message: unknown): boolean {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return false;
        }

        const method = (message as any).method;
        if (typeof method !== 'string') {
            return false;
        }

        return method !== 'initialize';
    }

    private captureSessionId(message: unknown, headers: http.IncomingHttpHeaders): void {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return;
        }

        const method = (message as any).method;
        if (method !== 'initialize') {
            return;
        }

        const raw = headers['mcp-session-id'];
        if (Array.isArray(raw)) {
            this.sessionId = raw[0] || null;
            return;
        }

        if (typeof raw === 'string' && raw.trim()) {
            this.sessionId = raw;
        }
    }

    private writeStdoutLine(payload: string): void {
        process.stdout.write(`${payload}\n`);
        this.logDebug(`已写出响应消息，大小 ${Buffer.byteLength(payload, 'utf8')} 字节`);
    }

    private logDebug(message: string): void {
        if (this.options.debug) {
            process.stderr.write(`[stdio-http-bridge][debug] ${message}\n`);
        }
    }

    private logError(message: string): void {
        process.stderr.write(`[stdio-http-bridge][error] ${message}\n`);
    }
}

function parseArgs(argv: string[]): BridgeOptions {
    let endpoint = DEFAULT_ENDPOINT;
    let timeoutMs = Number.isFinite(DEFAULT_TIMEOUT_MS) ? DEFAULT_TIMEOUT_MS : 30000;
    let debug = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === '--help' || arg === '-h') {
            printHelpAndExit(0);
        } else if (arg === '--debug') {
            debug = true;
        } else if (arg === '--url') {
            const next = argv[i + 1];
            if (!next) {
                printHelpAndExit(1, '--url 缺少参数');
            }
            endpoint = next;
            i += 1;
        } else if (arg.startsWith('--url=')) {
            endpoint = arg.slice('--url='.length);
        } else if (arg === '--timeout') {
            const next = argv[i + 1];
            if (!next) {
                printHelpAndExit(1, '--timeout 缺少参数');
            }
            timeoutMs = Number(next);
            i += 1;
        } else if (arg.startsWith('--timeout=')) {
            timeoutMs = Number(arg.slice('--timeout='.length));
        } else {
            printHelpAndExit(1, `未知参数: ${arg}`);
        }
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        printHelpAndExit(1, `--timeout 参数无效: ${timeoutMs}`);
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(endpoint);
    } catch (error: any) {
        printHelpAndExit(1, `--url 参数无效: ${error.message}`);
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        printHelpAndExit(1, `仅支持 http/https URL，当前为: ${parsedUrl.protocol}`);
    }

    return {
        endpoint,
        timeoutMs,
        debug
    };
}

function printHelpAndExit(code: number, errorMessage?: string): never {
    if (errorMessage) {
        process.stderr.write(`[stdio-http-bridge][error] ${errorMessage}\n`);
    }

    process.stderr.write(
        [
            '用法: node dist/stdio-http-bridge.js [--url <mcp_http_url>] [--timeout <ms>] [--debug]',
            '',
            '协议:',
            '  stdin/stdout 均使用标准换行分隔（每行一条 JSON-RPC 消息）',
            '',
            '参数:',
            '  --url      MCP HTTP 端点，默认 http://127.0.0.1:3000/mcp',
            '  --timeout  请求超时毫秒，默认 30000',
            '  --debug    输出调试日志（stderr）',
            '',
            '环境变量:',
            '  COCOS_MCP_HTTP_URL         默认 HTTP 端点',
            '  COCOS_MCP_HTTP_TIMEOUT_MS  默认超时毫秒'
        ].join('\n') + '\n'
    );

    process.exit(code);
}

function main(): void {
    const options = parseArgs(process.argv.slice(2));
    const bridge = new StdioHttpBridge(options);
    bridge.start();
}

if (require.main === module) {
    main();
}

export { StdioHttpBridge, BridgeOptions };
