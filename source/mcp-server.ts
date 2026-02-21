import * as http from 'http';
import { randomUUID } from 'crypto';
import { MCPServerSettings, ServerStatus, MCPClient, ToolDefinition } from './types';
import { createJsonRpcErrorResponse, JsonRpcErrorCode } from './mcp/errors';
import { parseJsonRpcBody, readRawBody } from './mcp/jsonrpc';
import {
    JsonRpcRequest,
    JsonRpcResponseMessage,
    isNotificationMessage,
    isRecord,
    isRequestMessage,
    isResponseMessage
} from './mcp/messages';
import {
    MCP_METHODS,
    canHandleBeforeReady,
    ensureInitializeIsRequest,
    isInitializeMethod,
    isInitializedNotification,
    isNotificationMethod,
    isSessionReady,
    requiresSessionHeader
} from './mcp/lifecycle';
import { McpSession, SessionStore } from './mcp/session-store';
import { StreamableHttpManager } from './mcp/streamable-http';
import { createNextRuntime, NextMcpRouter, NextToolRegistry } from './next';
import { CapabilityCheck, EditorRequester } from './next/models';

interface MCPServerDependencies {
    sessionIdGenerator?: () => string;
    now?: () => number;
    nextRequester?: EditorRequester;
    nextChecks?: CapabilityCheck[];
    nextIncludeWriteChecks?: boolean;
    nextRuntimeFactory?: () => Promise<{
        router: NextMcpRouter;
        registry: NextToolRegistry;
    }>;
}

interface MCPRequestContext {
    sessionId: string | null;
    session: McpSession | null;
}

interface MessageHandleResult {
    response: JsonRpcResponseMessage | null;
    sessionIdToReturn?: string;
}

export class MCPServer {
    private settings: MCPServerSettings;
    private httpServer: http.Server | null = null;
    private toolsList: ToolDefinition[] = [];
    private readonly sessionStore = new SessionStore();
    private readonly streamableHttp = new StreamableHttpManager();
    private readonly nextRuntimeFactory: () => Promise<{
        router: NextMcpRouter;
        registry: NextToolRegistry;
    }>;
    private nextRuntimePromise: Promise<{
        router: NextMcpRouter;
        registry: NextToolRegistry;
    }> | null = null;
    private nextRouter: NextMcpRouter | null = null;
    private nextRegistry: NextToolRegistry | null = null;
    private readonly sessionIdGenerator: () => string;
    private readonly now: () => number;

    constructor(settings: MCPServerSettings, dependencies: MCPServerDependencies = {}) {
        this.settings = settings;
        this.sessionIdGenerator = dependencies.sessionIdGenerator ?? (() => randomUUID());
        this.now = dependencies.now ?? (() => Date.now());
        this.nextRuntimeFactory = dependencies.nextRuntimeFactory ?? (() => createNextRuntime({
            requester: dependencies.nextRequester,
            checks: dependencies.nextChecks,
            includeWriteChecks: dependencies.nextIncludeWriteChecks ?? true
        }).then((runtime) => ({
            router: runtime.router,
            registry: runtime.registry
        })));
    }

    public async start(): Promise<void> {
        if (this.httpServer) {
            console.log('[MCPServer] Server is already running');
            return;
        }

        try {
            console.log(`[MCPServer] Starting HTTP server on port ${this.settings.port}...`);
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
            this.httpServer.maxConnections = this.settings.maxConnections;

            await new Promise<void>((resolve, reject) => {
                this.httpServer!.listen(this.settings.port, '127.0.0.1', () => {
                    console.log(`[MCPServer] ✅ HTTP server started successfully on http://127.0.0.1:${this.settings.port}`);
                    console.log(`[MCPServer] Health check: http://127.0.0.1:${this.settings.port}/health`);
                    console.log(`[MCPServer] MCP endpoint: http://127.0.0.1:${this.settings.port}/mcp`);
                    resolve();
                });
                this.httpServer!.on('error', (err: any) => {
                    console.error('[MCPServer] ❌ Failed to start server:', err);
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[MCPServer] Port ${this.settings.port} is already in use. Please change the port in settings.`);
                    }
                    reject(err);
                });
            });

            await this.ensureNextRuntime();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        } catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }

    private async ensureNextRuntime(): Promise<void> {
        if (this.nextRouter && this.nextRegistry) {
            return;
        }

        if (!this.nextRuntimePromise) {
            this.nextRuntimePromise = this.nextRuntimeFactory();
        }

        try {
            const runtime = await this.nextRuntimePromise;
            this.nextRouter = runtime.router;
            this.nextRegistry = runtime.registry;
            this.toolsList = this.nextRegistry.listTools().map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            }));
            console.log(`[MCPServer] Setup tools (next): ${this.toolsList.length} tools available`);
        } catch (error) {
            this.nextRuntimePromise = null;
            throw error;
        }
    }

    private async getNextRouter(): Promise<NextMcpRouter> {
        await this.ensureNextRuntime();
        if (!this.nextRouter) {
            throw new Error('Next router is not initialized');
        }
        return this.nextRouter;
    }

    public getClients(): MCPClient[] {
        return this.sessionStore.listSessions().map((session) => ({
            id: session.id,
            lastActivity: new Date(session.lastActivityAt)
        }));
    }

    public getAvailableTools(): ToolDefinition[] {
        return this.toolsList;
    }

    public getSettings(): MCPServerSettings {
        return this.settings;
    }

    private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
        const pathname = requestUrl.pathname;

        // 先校验 Origin，未通过时直接拒绝请求
        if (!this.isOriginAllowed(req)) {
            this.applyCorsHeaders(req, res);
            this.writeJsonResponse(res, 403, { error: 'Forbidden origin' });
            return;
        }

        // Set CORS headers
        this.applyCorsHeaders(req, res);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, MCP-Session-Id');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        try {
            if (pathname === '/mcp' && req.method === 'POST') {
                await this.handleMCPRequest(req, res);
            } else if (pathname === '/mcp' && req.method === 'GET') {
                this.handleMCPGet(req, res);
            } else if (pathname === '/mcp' && req.method === 'DELETE') {
                this.handleMCPDelete(req, res);
            } else if (pathname === '/health' && req.method === 'GET') {
                this.writeJsonResponse(res, 200, {
                    status: 'ok',
                    tools: this.toolsList.length,
                    sessions: this.sessionStore.size()
                });
            } else {
                this.writeJsonResponse(res, 404, { error: 'Not found' });
            }
        } catch (error) {
            console.error('HTTP request error:', error);
            this.writeJsonResponse(res, 500, { error: 'Internal server error' });
        }
    }

    private async handleMCPRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const rawBody = await readRawBody(req);
        const parseResult = parseJsonRpcBody(rawBody);

        if (!parseResult.ok) {
            this.writeJsonResponse(res, 400, parseResult.response);
            return;
        }

        // MCP 2025-11-25：POST /mcp 仅支持单消息，不支持 batch。
        if (Array.isArray(parseResult.payload)) {
            this.writeJsonResponse(
                res,
                200,
                createJsonRpcErrorResponse(
                    null,
                    JsonRpcErrorCode.InvalidRequest,
                    'Invalid Request: batch is not supported on POST /mcp'
                )
            );
            return;
        }

        const contextResult = this.buildMCPRequestContext(parseResult.payload, req);
        if (!contextResult.ok) {
            this.writeJsonResponse(res, contextResult.statusCode, { error: contextResult.message });
            return;
        }

        const messageResult = await this.handleIncomingMessage(parseResult.payload, contextResult.context);

        if (messageResult.sessionIdToReturn) {
            res.setHeader('MCP-Session-Id', messageResult.sessionIdToReturn);
        }

        if (!messageResult.response) {
            res.writeHead(202);
            res.end();
            return;
        }

        this.writeJsonResponse(res, 200, messageResult.response);
    }

    private buildMCPRequestContext(
        payload: unknown,
        req: http.IncomingMessage
    ):
        | { ok: true; context: MCPRequestContext }
        | { ok: false; statusCode: number; message: string } {
        const sessionId = this.getSessionIdFromHeader(req);

        if (!this.payloadRequiresSessionHeader(payload)) {
            return {
                ok: true,
                context: {
                    sessionId: null,
                    session: null
                }
            };
        }

        if (!sessionId) {
            return {
                ok: false,
                statusCode: 400,
                message: 'MCP-Session-Id header is required for non-initialize requests.'
            };
        }

        const session = this.sessionStore.getSession(sessionId);
        if (!session) {
            return {
                ok: false,
                statusCode: 400,
                message: `Invalid MCP-Session-Id: ${sessionId}`
            };
        }

        this.sessionStore.touch(sessionId, this.now());

        return {
            ok: true,
            context: {
                sessionId,
                session
            }
        };
    }

    private payloadRequiresSessionHeader(payload: unknown): boolean {
        if (!isRecord(payload) || typeof payload.method !== 'string') {
            return false;
        }

        return requiresSessionHeader(payload.method);
    }

    private async handleIncomingMessage(
        message: unknown,
        context: MCPRequestContext
    ): Promise<MessageHandleResult> {
        // 客户端可能会发送 response 消息（用于响应 server request），当前服务端无主动 request，直接忽略
        if (isResponseMessage(message)) {
            return { response: null };
        }

        if (!isRequestMessage(message) && !isNotificationMessage(message)) {
            return {
                response: createJsonRpcErrorResponse(
                    null,
                    JsonRpcErrorCode.InvalidRequest,
                    'Invalid Request: message must be a valid JSON-RPC 2.0 request or notification'
                )
            };
        }

        const method = message.method;
        const isNotification = isNotificationMessage(message);
        const requestId = isRequestMessage(message) ? message.id : null;

        if (isInitializeMethod(method)) {
            if (!ensureInitializeIsRequest(message)) {
                return {
                    response: createJsonRpcErrorResponse(
                        null,
                        JsonRpcErrorCode.InvalidRequest,
                        'Invalid Request: initialize must be a request with id'
                    )
                };
            }

            if (!isRequestMessage(message)) {
                return {
                    response: createJsonRpcErrorResponse(
                        null,
                        JsonRpcErrorCode.InvalidRequest,
                        'Invalid Request: initialize must be a request with id'
                    )
                };
            }

            return this.handleInitializeRequest(message);
        }

        if (!context.sessionId || !context.session) {
            return {
                response: createJsonRpcErrorResponse(
                    requestId,
                    JsonRpcErrorCode.InvalidRequest,
                    'Invalid Request: missing active session for this method'
                )
            };
        }

        if (isInitializedNotification(method)) {
            if (!isNotification) {
                return {
                    response: createJsonRpcErrorResponse(
                        requestId,
                        JsonRpcErrorCode.InvalidRequest,
                        'Invalid Request: notifications/initialized must be a notification without id'
                    )
                };
            }

            this.sessionStore.markReady(context.sessionId, this.now());
            return { response: null };
        }

        // 标准 notification：不应返回 JSON-RPC 响应
        if (isNotification && isNotificationMethod(method)) {
            return { response: null };
        }

        if (!isSessionReady(context.session) && !canHandleBeforeReady(method, isNotification)) {
            return {
                response: createJsonRpcErrorResponse(
                    requestId,
                    JsonRpcErrorCode.InvalidRequest,
                    'Invalid Request: session is not ready, send notifications/initialized first'
                )
            };
        }

        if (isNotification) {
            return { response: null };
        }

        return {
            response: await this.handleRequestMessage(message)
        };
    }

    private handleInitializeRequest(message: JsonRpcRequest): MessageHandleResult {
        if (message.params !== undefined && !isRecord(message.params)) {
            return {
                response: createJsonRpcErrorResponse(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Invalid params: initialize params must be an object when provided'
                )
            };
        }

        const sessionId = this.sessionIdGenerator();
        this.sessionStore.createSession(sessionId, this.now());

        const response: JsonRpcResponseMessage = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
                protocolVersion: '2025-11-25',
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: 'cocos-mcp-server',
                    version: '2.0.0'
                }
            }
        };

        return {
            response,
            sessionIdToReturn: sessionId
        };
    }

    private async handleRequestMessage(message: JsonRpcRequest): Promise<JsonRpcResponseMessage> {
        const { id, method, params } = message;
        if (method === MCP_METHODS.Ping) {
            return {
                jsonrpc: '2.0',
                id,
                result: {}
            };
        }

        const router = await this.getNextRouter();
        const routed = await router.handle({
            jsonrpc: '2.0',
            id,
            method,
            params
        });

        if (routed) {
            return routed as JsonRpcResponseMessage;
        }

        return createJsonRpcErrorResponse(
            id,
            JsonRpcErrorCode.InternalError,
            `Invalid router response for method: ${method}`
        );
    }

    private handleMCPGet(req: http.IncomingMessage, res: http.ServerResponse): void {
        const accept = (req.headers.accept || '').toLowerCase();
        const wantsSse = accept.includes('text/event-stream');

        if (!wantsSse) {
            this.writeJsonResponse(res, 200, {
                name: 'cocos-mcp-server',
                protocolVersion: '2025-11-25',
                transport: 'streamable-http',
                endpoint: '/mcp',
                supports: {
                    post: true,
                    postSingleMessageOnly: true,
                    sse: true,
                    delete: true
                }
            });
            return;
        }

        const sessionId = this.getSessionIdFromHeader(req);
        if (!sessionId) {
            this.writeJsonResponse(res, 400, {
                error: 'MCP-Session-Id header is required for SSE stream.'
            });
            return;
        }

        const session = this.sessionStore.getSession(sessionId);
        if (!session) {
            this.writeJsonResponse(res, 400, {
                error: `Invalid MCP-Session-Id: ${sessionId}`
            });
            return;
        }

        if (!isSessionReady(session)) {
            this.writeJsonResponse(res, 409, {
                error: 'Session is not ready. Send notifications/initialized before opening SSE stream.'
            });
            return;
        }

        this.sessionStore.touch(sessionId, this.now());
        this.streamableHttp.openSseStream(sessionId, req, res);
    }

    private handleMCPDelete(req: http.IncomingMessage, res: http.ServerResponse): void {
        const sessionId = this.getSessionIdFromHeader(req);
        if (!sessionId) {
            this.writeJsonResponse(res, 400, {
                error: 'MCP-Session-Id header is required for DELETE /mcp.'
            });
            return;
        }

        const removed = this.sessionStore.removeSession(sessionId);
        this.streamableHttp.closeSession(sessionId);

        if (!removed) {
            this.writeJsonResponse(res, 400, {
                error: `Invalid MCP-Session-Id: ${sessionId}`
            });
            return;
        }

        res.writeHead(204);
        res.end();
    }

    public stop(): void {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            console.log('[MCPServer] HTTP server stopped');
        }

        this.streamableHttp.dispose();
        this.sessionStore.clear();
    }

    public getStatus(): ServerStatus {
        return {
            running: !!this.httpServer,
            port: this.settings.port,
            clients: this.sessionStore.size()
        };
    }

    public updateSettings(settings: MCPServerSettings): void {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            void this.start();
        }
    }

    private getSessionIdFromHeader(req: http.IncomingMessage): string | null {
        const rawHeader = req.headers['mcp-session-id'];
        if (!rawHeader) {
            return null;
        }

        if (Array.isArray(rawHeader)) {
            return rawHeader[0] || null;
        }

        return rawHeader;
    }

    private isOriginAllowed(req: http.IncomingMessage): boolean {
        const allowedOrigins = this.settings.allowedOrigins && this.settings.allowedOrigins.length > 0
            ? this.settings.allowedOrigins
            : ['*'];
        const requestOrigin = req.headers.origin;

        if (!requestOrigin) {
            return true;
        }

        if (allowedOrigins.includes('*')) {
            return true;
        }

        return allowedOrigins.includes(requestOrigin);
    }

    private applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
        const allowedOrigins = this.settings.allowedOrigins && this.settings.allowedOrigins.length > 0
            ? this.settings.allowedOrigins
            : ['*'];
        const requestOrigin = req.headers.origin;

        if (allowedOrigins.includes('*')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return;
        }

        if (typeof requestOrigin === 'string' && allowedOrigins.includes(requestOrigin)) {
            res.setHeader('Access-Control-Allow-Origin', requestOrigin);
            res.setHeader('Vary', 'Origin');
            return;
        }

        // 未携带 Origin 时，允许首个白名单来源用于非浏览器客户端
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }

    private writeJsonResponse(res: http.ServerResponse, statusCode: number, payload: unknown): void {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    }
}

// HTTP transport doesn't need persistent client socket beyond SSE streams
