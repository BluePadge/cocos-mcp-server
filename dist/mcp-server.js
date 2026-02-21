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
exports.MCPServer = void 0;
const http = __importStar(require("http"));
const crypto_1 = require("crypto");
const errors_1 = require("./mcp/errors");
const jsonrpc_1 = require("./mcp/jsonrpc");
const messages_1 = require("./mcp/messages");
const lifecycle_1 = require("./mcp/lifecycle");
const session_store_1 = require("./mcp/session-store");
const streamable_http_1 = require("./mcp/streamable-http");
const next_1 = require("./next");
class MCPServer {
    constructor(settings, dependencies = {}) {
        var _a, _b, _c;
        this.httpServer = null;
        this.toolsList = [];
        this.sessionStore = new session_store_1.SessionStore();
        this.streamableHttp = new streamable_http_1.StreamableHttpManager();
        this.nextRuntimePromise = null;
        this.nextRouter = null;
        this.nextRegistry = null;
        this.settings = settings;
        this.sessionIdGenerator = (_a = dependencies.sessionIdGenerator) !== null && _a !== void 0 ? _a : (() => (0, crypto_1.randomUUID)());
        this.now = (_b = dependencies.now) !== null && _b !== void 0 ? _b : (() => Date.now());
        this.nextRuntimeFactory = (_c = dependencies.nextRuntimeFactory) !== null && _c !== void 0 ? _c : (() => {
            var _a;
            return (0, next_1.createNextRuntime)({
                requester: dependencies.nextRequester,
                checks: dependencies.nextChecks,
                includeWriteChecks: (_a = dependencies.nextIncludeWriteChecks) !== null && _a !== void 0 ? _a : true
            }).then((runtime) => ({
                router: runtime.router,
                registry: runtime.registry
            }));
        });
    }
    async start() {
        if (this.httpServer) {
            console.log('[MCPServer] Server is already running');
            return;
        }
        try {
            console.log(`[MCPServer] Starting HTTP server on port ${this.settings.port}...`);
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
            this.httpServer.maxConnections = this.settings.maxConnections;
            await new Promise((resolve, reject) => {
                this.httpServer.listen(this.settings.port, '127.0.0.1', () => {
                    console.log(`[MCPServer] ✅ HTTP server started successfully on http://127.0.0.1:${this.settings.port}`);
                    console.log(`[MCPServer] Health check: http://127.0.0.1:${this.settings.port}/health`);
                    console.log(`[MCPServer] MCP endpoint: http://127.0.0.1:${this.settings.port}/mcp`);
                    resolve();
                });
                this.httpServer.on('error', (err) => {
                    console.error('[MCPServer] ❌ Failed to start server:', err);
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[MCPServer] Port ${this.settings.port} is already in use. Please change the port in settings.`);
                    }
                    reject(err);
                });
            });
            await this.ensureNextRuntime();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        }
        catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }
    async ensureNextRuntime() {
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
        }
        catch (error) {
            this.nextRuntimePromise = null;
            throw error;
        }
    }
    async getNextRouter() {
        await this.ensureNextRuntime();
        if (!this.nextRouter) {
            throw new Error('Next router is not initialized');
        }
        return this.nextRouter;
    }
    getClients() {
        return this.sessionStore.listSessions().map((session) => ({
            id: session.id,
            lastActivity: new Date(session.lastActivityAt)
        }));
    }
    getAvailableTools() {
        return this.toolsList;
    }
    getSettings() {
        return this.settings;
    }
    async handleHttpRequest(req, res) {
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
            }
            else if (pathname === '/mcp' && req.method === 'GET') {
                this.handleMCPGet(req, res);
            }
            else if (pathname === '/mcp' && req.method === 'DELETE') {
                this.handleMCPDelete(req, res);
            }
            else if (pathname === '/health' && req.method === 'GET') {
                this.writeJsonResponse(res, 200, {
                    status: 'ok',
                    tools: this.toolsList.length,
                    sessions: this.sessionStore.size()
                });
            }
            else {
                this.writeJsonResponse(res, 404, { error: 'Not found' });
            }
        }
        catch (error) {
            console.error('HTTP request error:', error);
            this.writeJsonResponse(res, 500, { error: 'Internal server error' });
        }
    }
    async handleMCPRequest(req, res) {
        const rawBody = await (0, jsonrpc_1.readRawBody)(req);
        const parseResult = (0, jsonrpc_1.parseJsonRpcBody)(rawBody);
        if (!parseResult.ok) {
            this.writeJsonResponse(res, 400, parseResult.response);
            return;
        }
        // MCP 2025-11-25：POST /mcp 仅支持单消息，不支持 batch。
        if (Array.isArray(parseResult.payload)) {
            this.writeJsonResponse(res, 200, (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: batch is not supported on POST /mcp'));
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
    buildMCPRequestContext(payload, req) {
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
    payloadRequiresSessionHeader(payload) {
        if (!(0, messages_1.isRecord)(payload) || typeof payload.method !== 'string') {
            return false;
        }
        return (0, lifecycle_1.requiresSessionHeader)(payload.method);
    }
    async handleIncomingMessage(message, context) {
        // 客户端可能会发送 response 消息（用于响应 server request），当前服务端无主动 request，直接忽略
        if ((0, messages_1.isResponseMessage)(message)) {
            return { response: null };
        }
        if (!(0, messages_1.isRequestMessage)(message) && !(0, messages_1.isNotificationMessage)(message)) {
            return {
                response: (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: message must be a valid JSON-RPC 2.0 request or notification')
            };
        }
        const method = message.method;
        const isNotification = (0, messages_1.isNotificationMessage)(message);
        const requestId = (0, messages_1.isRequestMessage)(message) ? message.id : null;
        if ((0, lifecycle_1.isInitializeMethod)(method)) {
            if (!(0, lifecycle_1.ensureInitializeIsRequest)(message)) {
                return {
                    response: (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: initialize must be a request with id')
                };
            }
            if (!(0, messages_1.isRequestMessage)(message)) {
                return {
                    response: (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: initialize must be a request with id')
                };
            }
            return this.handleInitializeRequest(message);
        }
        if (!context.sessionId || !context.session) {
            return {
                response: (0, errors_1.createJsonRpcErrorResponse)(requestId, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: missing active session for this method')
            };
        }
        if ((0, lifecycle_1.isInitializedNotification)(method)) {
            if (!isNotification) {
                return {
                    response: (0, errors_1.createJsonRpcErrorResponse)(requestId, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: notifications/initialized must be a notification without id')
                };
            }
            this.sessionStore.markReady(context.sessionId, this.now());
            return { response: null };
        }
        // 标准 notification：不应返回 JSON-RPC 响应
        if (isNotification && (0, lifecycle_1.isNotificationMethod)(method)) {
            return { response: null };
        }
        if (!(0, lifecycle_1.isSessionReady)(context.session) && !(0, lifecycle_1.canHandleBeforeReady)(method, isNotification)) {
            return {
                response: (0, errors_1.createJsonRpcErrorResponse)(requestId, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: session is not ready, send notifications/initialized first')
            };
        }
        if (isNotification) {
            return { response: null };
        }
        return {
            response: await this.handleRequestMessage(message)
        };
    }
    handleInitializeRequest(message) {
        if (message.params !== undefined && !(0, messages_1.isRecord)(message.params)) {
            return {
                response: (0, errors_1.createJsonRpcErrorResponse)(message.id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params: initialize params must be an object when provided')
            };
        }
        const sessionId = this.sessionIdGenerator();
        this.sessionStore.createSession(sessionId, this.now());
        const response = {
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
    async handleRequestMessage(message) {
        const { id, method, params } = message;
        if (method === lifecycle_1.MCP_METHODS.Ping) {
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
            return routed;
        }
        return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InternalError, `Invalid router response for method: ${method}`);
    }
    handleMCPGet(req, res) {
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
        if (!(0, lifecycle_1.isSessionReady)(session)) {
            this.writeJsonResponse(res, 409, {
                error: 'Session is not ready. Send notifications/initialized before opening SSE stream.'
            });
            return;
        }
        this.sessionStore.touch(sessionId, this.now());
        this.streamableHttp.openSseStream(sessionId, req, res);
    }
    handleMCPDelete(req, res) {
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
    stop() {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            console.log('[MCPServer] HTTP server stopped');
        }
        this.streamableHttp.dispose();
        this.sessionStore.clear();
    }
    getStatus() {
        return {
            running: !!this.httpServer,
            port: this.settings.port,
            clients: this.sessionStore.size()
        };
    }
    updateSettings(settings) {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            void this.start();
        }
    }
    getSessionIdFromHeader(req) {
        const rawHeader = req.headers['mcp-session-id'];
        if (!rawHeader) {
            return null;
        }
        if (Array.isArray(rawHeader)) {
            return rawHeader[0] || null;
        }
        return rawHeader;
    }
    isOriginAllowed(req) {
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
    applyCorsHeaders(req, res) {
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
    writeJsonResponse(res, statusCode, payload) {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    }
}
exports.MCPServer = MCPServer;
// HTTP transport doesn't need persistent client socket beyond SSE streams
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUE2QjtBQUM3QixtQ0FBb0M7QUFFcEMseUNBQTRFO0FBQzVFLDJDQUE4RDtBQUM5RCw2Q0FPd0I7QUFDeEIsK0NBU3lCO0FBQ3pCLHVEQUErRDtBQUMvRCwyREFBOEQ7QUFDOUQsaUNBQTRFO0FBeUI1RSxNQUFhLFNBQVM7SUFtQmxCLFlBQVksUUFBMkIsRUFBRSxlQUFzQyxFQUFFOztRQWpCekUsZUFBVSxHQUF1QixJQUFJLENBQUM7UUFDdEMsY0FBUyxHQUFxQixFQUFFLENBQUM7UUFDeEIsaUJBQVksR0FBRyxJQUFJLDRCQUFZLEVBQUUsQ0FBQztRQUNsQyxtQkFBYyxHQUFHLElBQUksdUNBQXFCLEVBQUUsQ0FBQztRQUt0RCx1QkFBa0IsR0FHZCxJQUFJLENBQUM7UUFDVCxlQUFVLEdBQXlCLElBQUksQ0FBQztRQUN4QyxpQkFBWSxHQUE0QixJQUFJLENBQUM7UUFLakQsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE1BQUEsWUFBWSxDQUFDLGtCQUFrQixtQ0FBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUEsbUJBQVUsR0FBRSxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFBLFlBQVksQ0FBQyxHQUFHLG1DQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE1BQUEsWUFBWSxDQUFDLGtCQUFrQixtQ0FBSSxDQUFDLEdBQUcsRUFBRTs7WUFBQyxPQUFBLElBQUEsd0JBQWlCLEVBQUM7Z0JBQ2xGLFNBQVMsRUFBRSxZQUFZLENBQUMsYUFB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U0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNoQyxPQUFPO1FBQ1gsQ0FBQztRQUVELGtDQUFrQztRQUNsQyxHQUFHLENBQUMsU0FBUyxDQUFDLDZCQUE2QixFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxHQUF3QixFQUFFLFVBQWtCLEVBQUUsT0FBZ0I7UUFDcEYsR0FBRyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDNUIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxDQUFDO0NBQ0o7QUEzakJELDhCQTJqQkM7QUFFRCwwRUFBMEUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBNQ1BTZXJ2ZXJTZXR0aW5ncywgU2VydmVyU3RhdHVzLCBNQ1BDbGllbnQsIFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZSwgSnNvblJwY0Vycm9yQ29kZSB9IGZyb20gJy4vbWNwL2Vycm9ycyc7XG5pbXBvcnQgeyBwYXJzZUpzb25ScGNCb2R5LCByZWFkUmF3Qm9keSB9IGZyb20gJy4vbWNwL2pzb25ycGMnO1xuaW1wb3J0IHtcbiAgICBKc29uUnBjUmVxdWVzdCxcbiAgICBKc29uUnBjUmVzcG9uc2VNZXNzYWdlLFxuICAgIGlzTm90aWZpY2F0aW9uTWVzc2FnZSxcbiAgICBpc1JlY29yZCxcbiAgICBpc1JlcXVlc3RNZXNzYWdlLFxuICAgIGlzUmVzcG9uc2VNZXNzYWdlXG59IGZyb20gJy4vbWNwL21lc3NhZ2VzJztcbmltcG9ydCB7XG4gICAgTUNQX01FVEhPRFMsXG4gICAgY2FuSGFuZGxlQmVmb3JlUmVhZHksXG4gICAgZW5zdXJlSW5pdGlhbGl6ZUlzUmVxdWVzdCxcbiAgICBpc0luaXRpYWxpemVNZXRob2QsXG4gICAgaXNJbml0aWFsaXplZE5vdGlmaWNhdGlvbixcbiAgICBpc05vdGlmaWNhdGlvbk1ldGhvZCxcbiAgICBpc1Nlc3Npb25SZWFkeSxcbiAgICByZXF1aXJlc1Nlc3Npb25IZWFkZXJcbn0gZnJvbSAnLi9tY3AvbGlmZWN5Y2xlJztcbmltcG9ydCB7IE1jcFNlc3Npb24sIFNlc3Npb25TdG9yZSB9IGZyb20gJy4vbWNwL3Nlc3Npb24tc3RvcmUnO1xuaW1wb3J0IHsgU3RyZWFtYWJsZUh0dHBNYW5hZ2VyIH0gZnJvbSAnLi9tY3Avc3RyZWFtYWJsZS1odHRwJztcbmltcG9ydCB7IGNyZWF0ZU5leHRSdW50aW1lLCBOZXh0TWNwUm91dGVyLCBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi9uZXh0JztcbmltcG9ydCB7IENhcGFiaWxpdHlDaGVjaywgRWRpdG9yUmVxdWVzdGVyIH0gZnJvbSAnLi9uZXh0L21vZGVscyc7XG5cbmludGVyZmFjZSBNQ1BTZXJ2ZXJEZXBlbmRlbmNpZXMge1xuICAgIHNlc3Npb25JZEdlbmVyYXRvcj86ICgpID0+IHN0cmluZztcbiAgICBub3c/OiAoKSA9PiBudW1iZXI7XG4gICAgbmV4dFJlcXVlc3Rlcj86IEVkaXRvclJlcXVlc3RlcjtcbiAgICBuZXh0Q2hlY2tzPzogQ2FwYWJpbGl0eUNoZWNrW107XG4gICAgbmV4dEluY2x1ZGVXcml0ZUNoZWNrcz86IGJvb2xlYW47XG4gICAgbmV4dFJ1bnRpbWVGYWN0b3J5PzogKCkgPT4gUHJvbWlzZTx7XG4gICAgICAgIHJvdXRlcjogTmV4dE1jcFJvdXRlcjtcbiAgICAgICAgcmVnaXN0cnk6IE5leHRUb29sUmVnaXN0cnk7XG4gICAgfT47XG59XG5cbmludGVyZmFjZSBNQ1BSZXF1ZXN0Q29udGV4dCB7XG4gICAgc2Vzc2lvbklkOiBzdHJpbmcgfCBudWxsO1xuICAgIHNlc3Npb246IE1jcFNlc3Npb24gfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgTWVzc2FnZUhhbmRsZVJlc3VsdCB7XG4gICAgcmVzcG9uc2U6IEpzb25ScGNSZXNwb25zZU1lc3NhZ2UgfCBudWxsO1xuICAgIHNlc3Npb25JZFRvUmV0dXJuPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTUNQU2VydmVyIHtcbiAgICBwcml2YXRlIHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncztcbiAgICBwcml2YXRlIGh0dHBTZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSB0b29sc0xpc3Q6IFRvb2xEZWZpbml0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25TdG9yZSA9IG5ldyBTZXNzaW9uU3RvcmUoKTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0cmVhbWFibGVIdHRwID0gbmV3IFN0cmVhbWFibGVIdHRwTWFuYWdlcigpO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgbmV4dFJ1bnRpbWVGYWN0b3J5OiAoKSA9PiBQcm9taXNlPHtcbiAgICAgICAgcm91dGVyOiBOZXh0TWNwUm91dGVyO1xuICAgICAgICByZWdpc3RyeTogTmV4dFRvb2xSZWdpc3RyeTtcbiAgICB9PjtcbiAgICBwcml2YXRlIG5leHRSdW50aW1lUHJvbWlzZTogUHJvbWlzZTx7XG4gICAgICAgIHJvdXRlcjogTmV4dE1jcFJvdXRlcjtcbiAgICAgICAgcmVnaXN0cnk6IE5leHRUb29sUmVnaXN0cnk7XG4gICAgfT4gfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIG5leHRSb3V0ZXI6IE5leHRNY3BSb3V0ZXIgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIG5leHRSZWdpc3RyeTogTmV4dFRvb2xSZWdpc3RyeSB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbklkR2VuZXJhdG9yOiAoKSA9PiBzdHJpbmc7XG4gICAgcHJpdmF0ZSByZWFkb25seSBub3c6ICgpID0+IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncywgZGVwZW5kZW5jaWVzOiBNQ1BTZXJ2ZXJEZXBlbmRlbmNpZXMgPSB7fSkge1xuICAgICAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgICAgIHRoaXMuc2Vzc2lvbklkR2VuZXJhdG9yID0gZGVwZW5kZW5jaWVzLnNlc3Npb25JZEdlbmVyYXRvciA/PyAoKCkgPT4gcmFuZG9tVVVJRCgpKTtcbiAgICAgICAgdGhpcy5ub3cgPSBkZXBlbmRlbmNpZXMubm93ID8/ICgoKSA9PiBEYXRlLm5vdygpKTtcbiAgICAgICAgdGhpcy5uZXh0UnVudGltZUZhY3RvcnkgPSBkZXBlbmRlbmNpZXMubmV4dFJ1bnRpbWVGYWN0b3J5ID8/ICgoKSA9PiBjcmVhdGVOZXh0UnVudGltZSh7XG4gICAgICAgICAgICByZXF1ZXN0ZXI6IGRlcGVuZGVuY2llcy5uZXh0UmVxdWVzdGVyLFxuICAgICAgICAgICAgY2hlY2tzOiBkZXBlbmRlbmNpZXMubmV4dENoZWNrcyxcbiAgICAgICAgICAgIGluY2x1ZGVXcml0ZUNoZWNrczogZGVwZW5kZW5jaWVzLm5leHRJbmNsdWRlV3JpdGVDaGVja3MgPz8gdHJ1ZVxuICAgICAgICB9KS50aGVuKChydW50aW1lKSA9PiAoe1xuICAgICAgICAgICAgcm91dGVyOiBydW50aW1lLnJvdXRlcixcbiAgICAgICAgICAgIHJlZ2lzdHJ5OiBydW50aW1lLnJlZ2lzdHJ5XG4gICAgICAgIH0pKSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gU2VydmVyIGlzIGFscmVhZHkgcnVubmluZycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBTdGFydGluZyBIVFRQIHNlcnZlciBvbiBwb3J0ICR7dGhpcy5zZXR0aW5ncy5wb3J0fS4uLmApO1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIodGhpcy5oYW5kbGVIdHRwUmVxdWVzdC5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlci5tYXhDb25uZWN0aW9ucyA9IHRoaXMuc2V0dGluZ3MubWF4Q29ubmVjdGlvbnM7XG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIhLmxpc3Rlbih0aGlzLnNldHRpbmdzLnBvcnQsICcxMjcuMC4wLjEnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSDinIUgSFRUUCBzZXJ2ZXIgc3RhcnRlZCBzdWNjZXNzZnVsbHkgb24gaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIEhlYWx0aCBjaGVjazogaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH0vaGVhbHRoYCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBNQ1AgZW5kcG9pbnQ6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L21jcGApO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyIS5vbignZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0g4p2MIEZhaWxlZCB0byBzdGFydCBzZXJ2ZXI6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyci5jb2RlID09PSAnRUFERFJJTlVTRScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNQ1BTZXJ2ZXJdIFBvcnQgJHt0aGlzLnNldHRpbmdzLnBvcnR9IGlzIGFscmVhZHkgaW4gdXNlLiBQbGVhc2UgY2hhbmdlIHRoZSBwb3J0IGluIHNldHRpbmdzLmApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlTmV4dFJ1bnRpbWUoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSDwn5qAIE1DUCBTZXJ2ZXIgaXMgcmVhZHkgZm9yIGNvbm5lY3Rpb25zJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTUNQU2VydmVyXSDinYwgRmFpbGVkIHRvIHN0YXJ0IHNlcnZlcjonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZW5zdXJlTmV4dFJ1bnRpbWUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICh0aGlzLm5leHRSb3V0ZXIgJiYgdGhpcy5uZXh0UmVnaXN0cnkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5uZXh0UnVudGltZVByb21pc2UpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFJ1bnRpbWVQcm9taXNlID0gdGhpcy5uZXh0UnVudGltZUZhY3RvcnkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBydW50aW1lID0gYXdhaXQgdGhpcy5uZXh0UnVudGltZVByb21pc2U7XG4gICAgICAgICAgICB0aGlzLm5leHRSb3V0ZXIgPSBydW50aW1lLnJvdXRlcjtcbiAgICAgICAgICAgIHRoaXMubmV4dFJlZ2lzdHJ5ID0gcnVudGltZS5yZWdpc3RyeTtcbiAgICAgICAgICAgIHRoaXMudG9vbHNMaXN0ID0gdGhpcy5uZXh0UmVnaXN0cnkubGlzdFRvb2xzKCkubWFwKCh0b29sKSA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYTogdG9vbC5pbnB1dFNjaGVtYVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFNldHVwIHRvb2xzIChuZXh0KTogJHt0aGlzLnRvb2xzTGlzdC5sZW5ndGh9IHRvb2xzIGF2YWlsYWJsZWApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5uZXh0UnVudGltZVByb21pc2UgPSBudWxsO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5leHRSb3V0ZXIoKTogUHJvbWlzZTxOZXh0TWNwUm91dGVyPiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlTmV4dFJ1bnRpbWUoKTtcbiAgICAgICAgaWYgKCF0aGlzLm5leHRSb3V0ZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTmV4dCByb3V0ZXIgaXMgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmV4dFJvdXRlcjtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q2xpZW50cygpOiBNQ1BDbGllbnRbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlc3Npb25TdG9yZS5saXN0U2Vzc2lvbnMoKS5tYXAoKHNlc3Npb24pID0+ICh7XG4gICAgICAgICAgICBpZDogc2Vzc2lvbi5pZCxcbiAgICAgICAgICAgIGxhc3RBY3Rpdml0eTogbmV3IERhdGUoc2Vzc2lvbi5sYXN0QWN0aXZpdHlBdClcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRBdmFpbGFibGVUb29scygpOiBUb29sRGVmaW5pdGlvbltdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0O1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTZXR0aW5ncygpOiBNQ1BTZXJ2ZXJTZXR0aW5ncyB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldHRpbmdzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSHR0cFJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RVcmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCAnaHR0cDovLzEyNy4wLjAuMScpO1xuICAgICAgICBjb25zdCBwYXRobmFtZSA9IHJlcXVlc3RVcmwucGF0aG5hbWU7XG5cbiAgICAgICAgLy8g5YWI5qCh6aqMIE9yaWdpbu+8jOacqumAmui/h+aXtuebtOaOpeaLkue7neivt+axglxuICAgICAgICBpZiAoIXRoaXMuaXNPcmlnaW5BbGxvd2VkKHJlcSkpIHtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAzLCB7IGVycm9yOiAnRm9yYmlkZGVuIG9yaWdpbicgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgQ09SUyBoZWFkZXJzXG4gICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VULCBQT1NULCBERUxFVEUsIE9QVElPTlMnKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24sIEFjY2VwdCwgTUNQLVNlc3Npb24tSWQnKTtcblxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwNCk7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHBhdGhuYW1lID09PSAnL21jcCcgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVNQ1BSZXF1ZXN0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTUNQR2V0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnREVMRVRFJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTUNQRGVsZXRlKHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvaGVhbHRoJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb2snLFxuICAgICAgICAgICAgICAgICAgICB0b29sczogdGhpcy50b29sc0xpc3QubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uczogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDQsIHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignSFRUUCByZXF1ZXN0IGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA1MDAsIHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVNQ1BSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcbiAgICAgICAgY29uc3QgcGFyc2VSZXN1bHQgPSBwYXJzZUpzb25ScGNCb2R5KHJhd0JvZHkpO1xuXG4gICAgICAgIGlmICghcGFyc2VSZXN1bHQub2spIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHBhcnNlUmVzdWx0LnJlc3BvbnNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1DUCAyMDI1LTExLTI177yaUE9TVCAvbWNwIOS7heaUr+aMgeWNlea2iOaBr++8jOS4jeaUr+aMgSBiYXRjaOOAglxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZVJlc3VsdC5wYXlsb2FkKSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShcbiAgICAgICAgICAgICAgICByZXMsXG4gICAgICAgICAgICAgICAgMjAwLFxuICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBiYXRjaCBpcyBub3Qgc3VwcG9ydGVkIG9uIFBPU1QgL21jcCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGV4dFJlc3VsdCA9IHRoaXMuYnVpbGRNQ1BSZXF1ZXN0Q29udGV4dChwYXJzZVJlc3VsdC5wYXlsb2FkLCByZXEpO1xuICAgICAgICBpZiAoIWNvbnRleHRSZXN1bHQub2spIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCBjb250ZXh0UmVzdWx0LnN0YXR1c0NvZGUsIHsgZXJyb3I6IGNvbnRleHRSZXN1bHQubWVzc2FnZSB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VSZXN1bHQgPSBhd2FpdCB0aGlzLmhhbmRsZUluY29taW5nTWVzc2FnZShwYXJzZVJlc3VsdC5wYXlsb2FkLCBjb250ZXh0UmVzdWx0LmNvbnRleHQpO1xuXG4gICAgICAgIGlmIChtZXNzYWdlUmVzdWx0LnNlc3Npb25JZFRvUmV0dXJuKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdNQ1AtU2Vzc2lvbi1JZCcsIG1lc3NhZ2VSZXN1bHQuc2Vzc2lvbklkVG9SZXR1cm4pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtZXNzYWdlUmVzdWx0LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMik7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgMjAwLCBtZXNzYWdlUmVzdWx0LnJlc3BvbnNlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkTUNQUmVxdWVzdENvbnRleHQoXG4gICAgICAgIHBheWxvYWQ6IHVua25vd24sXG4gICAgICAgIHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2VcbiAgICApOlxuICAgICAgICB8IHsgb2s6IHRydWU7IGNvbnRleHQ6IE1DUFJlcXVlc3RDb250ZXh0IH1cbiAgICAgICAgfCB7IG9rOiBmYWxzZTsgc3RhdHVzQ29kZTogbnVtYmVyOyBtZXNzYWdlOiBzdHJpbmcgfSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXEpO1xuXG4gICAgICAgIGlmICghdGhpcy5wYXlsb2FkUmVxdWlyZXNTZXNzaW9uSGVhZGVyKHBheWxvYWQpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbnRleHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uOiBudWxsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ01DUC1TZXNzaW9uLUlkIGhlYWRlciBpcyByZXF1aXJlZCBmb3Igbm9uLWluaXRpYWxpemUgcmVxdWVzdHMuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25TdG9yZS5nZXRTZXNzaW9uKHNlc3Npb25JZCk7XG4gICAgICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBJbnZhbGlkIE1DUC1TZXNzaW9uLUlkOiAke3Nlc3Npb25JZH1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUudG91Y2goc2Vzc2lvbklkLCB0aGlzLm5vdygpKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IHRydWUsXG4gICAgICAgICAgICBjb250ZXh0OiB7XG4gICAgICAgICAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgIHNlc3Npb25cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBheWxvYWRSZXF1aXJlc1Nlc3Npb25IZWFkZXIocGF5bG9hZDogdW5rbm93bik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIWlzUmVjb3JkKHBheWxvYWQpIHx8IHR5cGVvZiBwYXlsb2FkLm1ldGhvZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXF1aXJlc1Nlc3Npb25IZWFkZXIocGF5bG9hZC5tZXRob2QpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW5jb21pbmdNZXNzYWdlKFxuICAgICAgICBtZXNzYWdlOiB1bmtub3duLFxuICAgICAgICBjb250ZXh0OiBNQ1BSZXF1ZXN0Q29udGV4dFxuICAgICk6IFByb21pc2U8TWVzc2FnZUhhbmRsZVJlc3VsdD4ge1xuICAgICAgICAvLyDlrqLmiLfnq6/lj6/og73kvJrlj5HpgIEgcmVzcG9uc2Ug5raI5oGv77yI55So5LqO5ZON5bqUIHNlcnZlciByZXF1ZXN077yJ77yM5b2T5YmN5pyN5Yqh56uv5peg5Li75YqoIHJlcXVlc3TvvIznm7TmjqXlv73nlaVcbiAgICAgICAgaWYgKGlzUmVzcG9uc2VNZXNzYWdlKG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1JlcXVlc3RNZXNzYWdlKG1lc3NhZ2UpICYmICFpc05vdGlmaWNhdGlvbk1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtZXNzYWdlIG11c3QgYmUgYSB2YWxpZCBKU09OLVJQQyAyLjAgcmVxdWVzdCBvciBub3RpZmljYXRpb24nXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IG1lc3NhZ2UubWV0aG9kO1xuICAgICAgICBjb25zdCBpc05vdGlmaWNhdGlvbiA9IGlzTm90aWZpY2F0aW9uTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgY29uc3QgcmVxdWVzdElkID0gaXNSZXF1ZXN0TWVzc2FnZShtZXNzYWdlKSA/IG1lc3NhZ2UuaWQgOiBudWxsO1xuXG4gICAgICAgIGlmIChpc0luaXRpYWxpemVNZXRob2QobWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFlbnN1cmVJbml0aWFsaXplSXNSZXF1ZXN0KG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBpbml0aWFsaXplIG11c3QgYmUgYSByZXF1ZXN0IHdpdGggaWQnXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWlzUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIFJlcXVlc3Q6IGluaXRpYWxpemUgbXVzdCBiZSBhIHJlcXVlc3Qgd2l0aCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjb250ZXh0LnNlc3Npb25JZCB8fCAhY29udGV4dC5zZXNzaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtaXNzaW5nIGFjdGl2ZSBzZXNzaW9uIGZvciB0aGlzIG1ldGhvZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSW5pdGlhbGl6ZWROb3RpZmljYXRpb24obWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIG11c3QgYmUgYSBub3RpZmljYXRpb24gd2l0aG91dCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2Vzc2lvblN0b3JlLm1hcmtSZWFkeShjb250ZXh0LnNlc3Npb25JZCwgdGhpcy5ub3coKSk7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5qCH5YeGIG5vdGlmaWNhdGlvbu+8muS4jeW6lOi/lOWbniBKU09OLVJQQyDlk43lupRcbiAgICAgICAgaWYgKGlzTm90aWZpY2F0aW9uICYmIGlzTm90aWZpY2F0aW9uTWV0aG9kKG1ldGhvZCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzU2Vzc2lvblJlYWR5KGNvbnRleHQuc2Vzc2lvbikgJiYgIWNhbkhhbmRsZUJlZm9yZVJlYWR5KG1ldGhvZCwgaXNOb3RpZmljYXRpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBzZXNzaW9uIGlzIG5vdCByZWFkeSwgc2VuZCBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIGZpcnN0J1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOb3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGF3YWl0IHRoaXMuaGFuZGxlUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSlcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogTWVzc2FnZUhhbmRsZVJlc3VsdCB7XG4gICAgICAgIGlmIChtZXNzYWdlLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmICFpc1JlY29yZChtZXNzYWdlLnBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlLmlkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIHBhcmFtczogaW5pdGlhbGl6ZSBwYXJhbXMgbXVzdCBiZSBhbiBvYmplY3Qgd2hlbiBwcm92aWRlZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5zZXNzaW9uSWRHZW5lcmF0b3IoKTtcbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUuY3JlYXRlU2Vzc2lvbihzZXNzaW9uSWQsIHRoaXMubm93KCkpO1xuXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlID0ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogJzIwMjUtMTEtMjUnLFxuICAgICAgICAgICAgICAgIGNhcGFiaWxpdGllczoge1xuICAgICAgICAgICAgICAgICAgICB0b29sczoge31cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNlcnZlckluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uOiAnMi4wLjAnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZSxcbiAgICAgICAgICAgIHNlc3Npb25JZFRvUmV0dXJuOiBzZXNzaW9uSWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlcXVlc3RNZXNzYWdlKG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogUHJvbWlzZTxKc29uUnBjUmVzcG9uc2VNZXNzYWdlPiB7XG4gICAgICAgIGNvbnN0IHsgaWQsIG1ldGhvZCwgcGFyYW1zIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAobWV0aG9kID09PSBNQ1BfTUVUSE9EUy5QaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgIHJlc3VsdDoge31cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByb3V0ZXIgPSBhd2FpdCB0aGlzLmdldE5leHRSb3V0ZXIoKTtcbiAgICAgICAgY29uc3Qgcm91dGVkID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgcGFyYW1zXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyb3V0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiByb3V0ZWQgYXMgSnNvblJwY1Jlc3BvbnNlTWVzc2FnZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnRlcm5hbEVycm9yLFxuICAgICAgICAgICAgYEludmFsaWQgcm91dGVyIHJlc3BvbnNlIGZvciBtZXRob2Q6ICR7bWV0aG9kfWBcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZU1DUEdldChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYWNjZXB0ID0gKHJlcS5oZWFkZXJzLmFjY2VwdCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgd2FudHNTc2UgPSBhY2NlcHQuaW5jbHVkZXMoJ3RleHQvZXZlbnQtc3RyZWFtJyk7XG5cbiAgICAgICAgaWYgKCF3YW50c1NzZSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDIwMCwge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbFZlcnNpb246ICcyMDI1LTExLTI1JyxcbiAgICAgICAgICAgICAgICB0cmFuc3BvcnQ6ICdzdHJlYW1hYmxlLWh0dHAnLFxuICAgICAgICAgICAgICAgIGVuZHBvaW50OiAnL21jcCcsXG4gICAgICAgICAgICAgICAgc3VwcG9ydHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcG9zdFNpbmdsZU1lc3NhZ2VPbmx5OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzc2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5nZXRTZXNzaW9uSWRGcm9tSGVhZGVyKHJlcSk7XG4gICAgICAgIGlmICghc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAwLCB7XG4gICAgICAgICAgICAgICAgZXJyb3I6ICdNQ1AtU2Vzc2lvbi1JZCBoZWFkZXIgaXMgcmVxdWlyZWQgZm9yIFNTRSBzdHJlYW0uJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uU3RvcmUuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogYEludmFsaWQgTUNQLVNlc3Npb24tSWQ6ICR7c2Vzc2lvbklkfWBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1Nlc3Npb25SZWFkeShzZXNzaW9uKSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwOSwge1xuICAgICAgICAgICAgICAgIGVycm9yOiAnU2Vzc2lvbiBpcyBub3QgcmVhZHkuIFNlbmQgbm90aWZpY2F0aW9ucy9pbml0aWFsaXplZCBiZWZvcmUgb3BlbmluZyBTU0Ugc3RyZWFtLidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUudG91Y2goc2Vzc2lvbklkLCB0aGlzLm5vdygpKTtcbiAgICAgICAgdGhpcy5zdHJlYW1hYmxlSHR0cC5vcGVuU3NlU3RyZWFtKHNlc3Npb25JZCwgcmVxLCByZXMpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTUNQRGVsZXRlKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBzZXNzaW9uSWQgPSB0aGlzLmdldFNlc3Npb25JZEZyb21IZWFkZXIocmVxKTtcbiAgICAgICAgaWYgKCFzZXNzaW9uSWQpIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogJ01DUC1TZXNzaW9uLUlkIGhlYWRlciBpcyByZXF1aXJlZCBmb3IgREVMRVRFIC9tY3AuJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZW1vdmVkID0gdGhpcy5zZXNzaW9uU3RvcmUucmVtb3ZlU2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICB0aGlzLnN0cmVhbWFibGVIdHRwLmNsb3NlU2Vzc2lvbihzZXNzaW9uSWQpO1xuXG4gICAgICAgIGlmICghcmVtb3ZlZCkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgIGVycm9yOiBgSW52YWxpZCBNQ1AtU2Vzc2lvbi1JZDogJHtzZXNzaW9uSWR9YFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXMud3JpdGVIZWFkKDIwNCk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIEhUVFAgc2VydmVyIHN0b3BwZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RyZWFtYWJsZUh0dHAuZGlzcG9zZSgpO1xuICAgICAgICB0aGlzLnNlc3Npb25TdG9yZS5jbGVhcigpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTdGF0dXMoKTogU2VydmVyU3RhdHVzIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJ1bm5pbmc6ICEhdGhpcy5odHRwU2VydmVyLFxuICAgICAgICAgICAgcG9ydDogdGhpcy5zZXR0aW5ncy5wb3J0LFxuICAgICAgICAgICAgY2xpZW50czogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIHVwZGF0ZVNldHRpbmdzKHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncyk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgICAgIGlmICh0aGlzLmh0dHBTZXJ2ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgdm9pZCB0aGlzLnN0YXJ0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFNlc3Npb25JZEZyb21IZWFkZXIocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSk6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCByYXdIZWFkZXIgPSByZXEuaGVhZGVyc1snbWNwLXNlc3Npb24taWQnXTtcbiAgICAgICAgaWYgKCFyYXdIZWFkZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmF3SGVhZGVyKSkge1xuICAgICAgICAgICAgcmV0dXJuIHJhd0hlYWRlclswXSB8fCBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJhd0hlYWRlcjtcbiAgICB9XG5cbiAgICBwcml2YXRlIGlzT3JpZ2luQWxsb3dlZChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGFsbG93ZWRPcmlnaW5zID0gdGhpcy5zZXR0aW5ncy5hbGxvd2VkT3JpZ2lucyAmJiB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zLmxlbmd0aCA+IDBcbiAgICAgICAgICAgID8gdGhpcy5zZXR0aW5ncy5hbGxvd2VkT3JpZ2luc1xuICAgICAgICAgICAgOiBbJyonXTtcbiAgICAgICAgY29uc3QgcmVxdWVzdE9yaWdpbiA9IHJlcS5oZWFkZXJzLm9yaWdpbjtcblxuICAgICAgICBpZiAoIXJlcXVlc3RPcmlnaW4pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKCcqJykpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKHJlcXVlc3RPcmlnaW4pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXBwbHlDb3JzSGVhZGVycyhyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYWxsb3dlZE9yaWdpbnMgPSB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zICYmIHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zXG4gICAgICAgICAgICA6IFsnKiddO1xuICAgICAgICBjb25zdCByZXF1ZXN0T3JpZ2luID0gcmVxLmhlYWRlcnMub3JpZ2luO1xuXG4gICAgICAgIGlmIChhbGxvd2VkT3JpZ2lucy5pbmNsdWRlcygnKicpKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCAnKicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0T3JpZ2luID09PSAnc3RyaW5nJyAmJiBhbGxvd2VkT3JpZ2lucy5pbmNsdWRlcyhyZXF1ZXN0T3JpZ2luKSkge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgcmVxdWVzdE9yaWdpbik7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdWYXJ5JywgJ09yaWdpbicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5pyq5pC65bimIE9yaWdpbiDml7bvvIzlhYHorrjpppbkuKrnmb3lkI3ljZXmnaXmupDnlKjkuo7pnZ7mtY/op4jlmajlrqLmiLfnq69cbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgYWxsb3dlZE9yaWdpbnNbMF0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgd3JpdGVKc29uUmVzcG9uc2UocmVzOiBodHRwLlNlcnZlclJlc3BvbnNlLCBzdGF0dXNDb2RlOiBudW1iZXIsIHBheWxvYWQ6IHVua25vd24pOiB2b2lkIHtcbiAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcbiAgICB9XG59XG5cbi8vIEhUVFAgdHJhbnNwb3J0IGRvZXNuJ3QgbmVlZCBwZXJzaXN0ZW50IGNsaWVudCBzb2NrZXQgYmV5b25kIFNTRSBzdHJlYW1zXG4iXX0=