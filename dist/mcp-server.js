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
        this.enabledTools = []; // 暂存面板配置（Next 版本不再用于过滤工具）
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
    getFilteredTools(enabledTools) {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList;
        }
        const enabledToolNames = new Set(enabledTools.map((tool) => `${tool.category}_${tool.name}`));
        return this.toolsList.filter((tool) => enabledToolNames.has(tool.name));
    }
    async executeToolCall(toolName, args) {
        var _a, _b;
        const router = await this.getNextRouter();
        const callResponse = await router.handle({
            jsonrpc: '2.0',
            id: `simple-api:${this.sessionIdGenerator()}`,
            method: lifecycle_1.MCP_METHODS.ToolsCall,
            params: {
                name: toolName,
                arguments: (0, messages_1.isRecord)(args) ? args : {}
            }
        });
        if (!callResponse) {
            throw new Error(`Tool ${toolName} returned empty response`);
        }
        if (callResponse.error) {
            throw new Error(callResponse.error.message);
        }
        const payload = callResponse.result;
        if ((payload === null || payload === void 0 ? void 0 : payload.isError) === true) {
            const businessError = (_a = payload === null || payload === void 0 ? void 0 : payload.structuredContent) === null || _a === void 0 ? void 0 : _a.error;
            throw new Error((businessError === null || businessError === void 0 ? void 0 : businessError.message) || `Tool ${toolName} execution failed`);
        }
        return (_b = payload === null || payload === void 0 ? void 0 : payload.structuredContent) === null || _b === void 0 ? void 0 : _b.data;
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
    updateEnabledTools(enabledTools) {
        console.log(`[MCPServer] Updating enabled tools: ${enabledTools.length} tools`);
        this.enabledTools = enabledTools;
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
            else if ((pathname === null || pathname === void 0 ? void 0 : pathname.startsWith('/api/')) && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            }
            else if (pathname === '/api/tools' && req.method === 'GET') {
                this.writeJsonResponse(res, 200, { tools: this.getSimplifiedToolsList() });
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
                    version: '1.4.0'
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
    async handleSimpleAPIRequest(req, res, pathname) {
        const body = await (0, jsonrpc_1.readRawBody)(req);
        try {
            // Extract tool name from path like /api/node/set_position
            const pathParts = pathname.split('/').filter(p => p);
            if (pathParts.length < 3) {
                this.writeJsonResponse(res, 400, {
                    error: 'Invalid API path. Use /api/{category}/{tool_name}'
                });
                return;
            }
            const category = pathParts[1];
            const toolName = pathParts[2];
            const fullToolName = `${category}_${toolName}`;
            // Parse parameters with enhanced error handling
            let params;
            try {
                params = this.parseJsonBody(body, {
                    allowEmpty: true,
                    routeName: 'SimpleAPI'
                });
            }
            catch (parseError) {
                this.writeJsonResponse(res, 400, {
                    error: 'Invalid JSON in request body',
                    details: parseError.message,
                    receivedBody: body.substring(0, 200)
                });
                return;
            }
            // Execute tool
            const result = await this.executeToolCall(fullToolName, params);
            this.writeJsonResponse(res, 200, {
                success: true,
                tool: fullToolName,
                result
            });
        }
        catch (error) {
            console.error('Simple API error:', error);
            this.writeJsonResponse(res, 500, {
                success: false,
                error: error.message,
                tool: pathname
            });
        }
    }
    getSimplifiedToolsList() {
        return this.toolsList.map(tool => {
            const parts = tool.name.split('_');
            const category = parts[0];
            const toolName = parts.slice(1).join('_');
            return {
                name: tool.name,
                category,
                toolName,
                description: tool.description,
                apiPath: `/api/${category}/${toolName}`,
                curlExample: this.generateCurlExample(category, toolName, tool.inputSchema)
            };
        });
    }
    generateCurlExample(category, toolName, schema) {
        // Generate sample parameters based on schema
        const sampleParams = this.generateSampleParams(schema);
        const jsonString = JSON.stringify(sampleParams, null, 2);
        return `curl -X POST http://127.0.0.1:${this.settings.port}/api/${category}/${toolName} \\\n  -H "Content-Type: application/json" \\\n  -d '${jsonString}'`;
    }
    generateSampleParams(schema) {
        if (!schema || !schema.properties)
            return {};
        const sample = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            const propSchema = prop;
            switch (propSchema.type) {
                case 'string':
                    sample[key] = propSchema.default || 'example_string';
                    break;
                case 'number':
                    sample[key] = propSchema.default || 42;
                    break;
                case 'boolean':
                    sample[key] = propSchema.default || true;
                    break;
                case 'object':
                    sample[key] = propSchema.default || { x: 0, y: 0, z: 0 };
                    break;
                default:
                    sample[key] = 'example_value';
            }
        }
        return sample;
    }
    parseJsonBody(rawBody, options) {
        const body = rawBody.trim();
        if (!body) {
            if (options.allowEmpty) {
                return {};
            }
            throw new Error(`${options.routeName} request body is empty`);
        }
        try {
            return JSON.parse(body);
        }
        catch (error) {
            throw new Error(`${options.routeName} JSON parse failed: ${error.message}. ` +
                '请确保请求体是合法 JSON；必要时可先调用 validation_validate_json_params 进行检查。');
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUE2QjtBQUM3QixtQ0FBb0M7QUFFcEMseUNBQTRFO0FBQzVFLDJDQUE4RDtBQUM5RCw2Q0FPd0I7QUFDeEIsK0NBU3lCO0FBQ3pCLHVEQUErRDtBQUMvRCwyREFBOEQ7QUFDOUQsaUNBQTRFO0FBeUI1RSxNQUFhLFNBQVM7SUFvQmxCLFlBQVksUUFBMkIsRUFBRSxlQUFzQyxFQUFFOztRQWxCekUsZUFBVSxHQUF1QixJQUFJLENBQUM7UUFDdEMsY0FBUyxHQUFxQixFQUFFLENBQUM7UUFDakMsaUJBQVksR0FBVSxFQUFFLENBQUMsQ0FBQywwQkFBMEI7UUFDM0MsaUJBQVksR0FBRyxJQUFJLDRCQUFZLEVBQUUsQ0FBQztRQUNsQyxtQkFBYyxHQUFHLElBQUksdUNBQXFCLEVBQUUsQ0FBQztRQUt0RCx1QkFBa0IsR0FHZCxJQUFJLENBQUM7UUFDVCxlQUFVLEdBQXlCLElBQUksQ0FBQztRQUN4QyxpQkFBWSxHQUE0QixJQUFJLENBQUM7UUFLakQsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE1BQUEsWUFBWSxDQUFDLGtCQUFrQixtQ0FBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUEsbUJBQVUsR0FBRSxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFBLFlBQVksQ0FBQyxHQUFHLG1DQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE1BQUEsWUFBWSxDQUFDLGtCQUFrQixtQ0FBSSxDQUFDLEdBQUcsRUFBRTs7WUFBQyxPQUFBLElBQUEsd0JB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RCxrQ0FBa0M7UUFDbEMsR0FBRyxDQUFDLFNBQVMsQ0FBQyw2QkFBNkIsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRU8saUJBQWlCLENBQUMsR0FBd0IsRUFBRSxVQUFrQixFQUFFLE9BQWdCO1FBQ3BGLEdBQUcsQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1FBQzVCLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDbEQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsQ0FBQztDQUNKO0FBeHVCRCw4QkF3dUJDO0FBRUQsMEVBQTBFIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgTUNQU2VydmVyU2V0dGluZ3MsIFNlcnZlclN0YXR1cywgTUNQQ2xpZW50LCBUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UsIEpzb25ScGNFcnJvckNvZGUgfSBmcm9tICcuL21jcC9lcnJvcnMnO1xuaW1wb3J0IHsgcGFyc2VKc29uUnBjQm9keSwgcmVhZFJhd0JvZHkgfSBmcm9tICcuL21jcC9qc29ucnBjJztcbmltcG9ydCB7XG4gICAgSnNvblJwY1JlcXVlc3QsXG4gICAgSnNvblJwY1Jlc3BvbnNlTWVzc2FnZSxcbiAgICBpc05vdGlmaWNhdGlvbk1lc3NhZ2UsXG4gICAgaXNSZWNvcmQsXG4gICAgaXNSZXF1ZXN0TWVzc2FnZSxcbiAgICBpc1Jlc3BvbnNlTWVzc2FnZVxufSBmcm9tICcuL21jcC9tZXNzYWdlcyc7XG5pbXBvcnQge1xuICAgIE1DUF9NRVRIT0RTLFxuICAgIGNhbkhhbmRsZUJlZm9yZVJlYWR5LFxuICAgIGVuc3VyZUluaXRpYWxpemVJc1JlcXVlc3QsXG4gICAgaXNJbml0aWFsaXplTWV0aG9kLFxuICAgIGlzSW5pdGlhbGl6ZWROb3RpZmljYXRpb24sXG4gICAgaXNOb3RpZmljYXRpb25NZXRob2QsXG4gICAgaXNTZXNzaW9uUmVhZHksXG4gICAgcmVxdWlyZXNTZXNzaW9uSGVhZGVyXG59IGZyb20gJy4vbWNwL2xpZmVjeWNsZSc7XG5pbXBvcnQgeyBNY3BTZXNzaW9uLCBTZXNzaW9uU3RvcmUgfSBmcm9tICcuL21jcC9zZXNzaW9uLXN0b3JlJztcbmltcG9ydCB7IFN0cmVhbWFibGVIdHRwTWFuYWdlciB9IGZyb20gJy4vbWNwL3N0cmVhbWFibGUtaHR0cCc7XG5pbXBvcnQgeyBjcmVhdGVOZXh0UnVudGltZSwgTmV4dE1jcFJvdXRlciwgTmV4dFRvb2xSZWdpc3RyeSB9IGZyb20gJy4vbmV4dCc7XG5pbXBvcnQgeyBDYXBhYmlsaXR5Q2hlY2ssIEVkaXRvclJlcXVlc3RlciB9IGZyb20gJy4vbmV4dC9tb2RlbHMnO1xuXG5pbnRlcmZhY2UgTUNQU2VydmVyRGVwZW5kZW5jaWVzIHtcbiAgICBzZXNzaW9uSWRHZW5lcmF0b3I/OiAoKSA9PiBzdHJpbmc7XG4gICAgbm93PzogKCkgPT4gbnVtYmVyO1xuICAgIG5leHRSZXF1ZXN0ZXI/OiBFZGl0b3JSZXF1ZXN0ZXI7XG4gICAgbmV4dENoZWNrcz86IENhcGFiaWxpdHlDaGVja1tdO1xuICAgIG5leHRJbmNsdWRlV3JpdGVDaGVja3M/OiBib29sZWFuO1xuICAgIG5leHRSdW50aW1lRmFjdG9yeT86ICgpID0+IFByb21pc2U8e1xuICAgICAgICByb3V0ZXI6IE5leHRNY3BSb3V0ZXI7XG4gICAgICAgIHJlZ2lzdHJ5OiBOZXh0VG9vbFJlZ2lzdHJ5O1xuICAgIH0+O1xufVxuXG5pbnRlcmZhY2UgTUNQUmVxdWVzdENvbnRleHQge1xuICAgIHNlc3Npb25JZDogc3RyaW5nIHwgbnVsbDtcbiAgICBzZXNzaW9uOiBNY3BTZXNzaW9uIHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIE1lc3NhZ2VIYW5kbGVSZXN1bHQge1xuICAgIHJlc3BvbnNlOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlIHwgbnVsbDtcbiAgICBzZXNzaW9uSWRUb1JldHVybj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1DUFNlcnZlciB7XG4gICAgcHJpdmF0ZSBzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3M7XG4gICAgcHJpdmF0ZSBodHRwU2VydmVyOiBodHRwLlNlcnZlciB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgdG9vbHNMaXN0OiBUb29sRGVmaW5pdGlvbltdID0gW107XG4gICAgcHJpdmF0ZSBlbmFibGVkVG9vbHM6IGFueVtdID0gW107IC8vIOaaguWtmOmdouadv+mFjee9ru+8iE5leHQg54mI5pys5LiN5YaN55So5LqO6L+H5ruk5bel5YW377yJXG4gICAgcHJpdmF0ZSByZWFkb25seSBzZXNzaW9uU3RvcmUgPSBuZXcgU2Vzc2lvblN0b3JlKCk7XG4gICAgcHJpdmF0ZSByZWFkb25seSBzdHJlYW1hYmxlSHR0cCA9IG5ldyBTdHJlYW1hYmxlSHR0cE1hbmFnZXIoKTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IG5leHRSdW50aW1lRmFjdG9yeTogKCkgPT4gUHJvbWlzZTx7XG4gICAgICAgIHJvdXRlcjogTmV4dE1jcFJvdXRlcjtcbiAgICAgICAgcmVnaXN0cnk6IE5leHRUb29sUmVnaXN0cnk7XG4gICAgfT47XG4gICAgcHJpdmF0ZSBuZXh0UnVudGltZVByb21pc2U6IFByb21pc2U8e1xuICAgICAgICByb3V0ZXI6IE5leHRNY3BSb3V0ZXI7XG4gICAgICAgIHJlZ2lzdHJ5OiBOZXh0VG9vbFJlZ2lzdHJ5O1xuICAgIH0+IHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBuZXh0Um91dGVyOiBOZXh0TWNwUm91dGVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBuZXh0UmVnaXN0cnk6IE5leHRUb29sUmVnaXN0cnkgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25JZEdlbmVyYXRvcjogKCkgPT4gc3RyaW5nO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgbm93OiAoKSA9PiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3MsIGRlcGVuZGVuY2llczogTUNQU2VydmVyRGVwZW5kZW5jaWVzID0ge30pIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgICAgICB0aGlzLnNlc3Npb25JZEdlbmVyYXRvciA9IGRlcGVuZGVuY2llcy5zZXNzaW9uSWRHZW5lcmF0b3IgPz8gKCgpID0+IHJhbmRvbVVVSUQoKSk7XG4gICAgICAgIHRoaXMubm93ID0gZGVwZW5kZW5jaWVzLm5vdyA/PyAoKCkgPT4gRGF0ZS5ub3coKSk7XG4gICAgICAgIHRoaXMubmV4dFJ1bnRpbWVGYWN0b3J5ID0gZGVwZW5kZW5jaWVzLm5leHRSdW50aW1lRmFjdG9yeSA/PyAoKCkgPT4gY3JlYXRlTmV4dFJ1bnRpbWUoe1xuICAgICAgICAgICAgcmVxdWVzdGVyOiBkZXBlbmRlbmNpZXMubmV4dFJlcXVlc3RlcixcbiAgICAgICAgICAgIGNoZWNrczogZGVwZW5kZW5jaWVzLm5leHRDaGVja3MsXG4gICAgICAgICAgICBpbmNsdWRlV3JpdGVDaGVja3M6IGRlcGVuZGVuY2llcy5uZXh0SW5jbHVkZVdyaXRlQ2hlY2tzID8/IHRydWVcbiAgICAgICAgfSkudGhlbigocnVudGltZSkgPT4gKHtcbiAgICAgICAgICAgIHJvdXRlcjogcnVudGltZS5yb3V0ZXIsXG4gICAgICAgICAgICByZWdpc3RyeTogcnVudGltZS5yZWdpc3RyeVxuICAgICAgICB9KSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIFNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gU3RhcnRpbmcgSFRUUCBzZXJ2ZXIgb24gcG9ydCAke3RoaXMuc2V0dGluZ3MucG9ydH0uLi5gKTtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMuaGFuZGxlSHR0cFJlcXVlc3QuYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIubWF4Q29ubmVjdGlvbnMgPSB0aGlzLnNldHRpbmdzLm1heENvbm5lY3Rpb25zO1xuXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyIS5saXN0ZW4odGhpcy5zZXR0aW5ncy5wb3J0LCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0g4pyFIEhUVFAgc2VydmVyIHN0YXJ0ZWQgc3VjY2Vzc2Z1bGx5IG9uIGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9YCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBIZWFsdGggY2hlY2s6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L2hlYWx0aGApO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gTUNQIGVuZHBvaW50OiBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fS9tY3BgKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciEub24oJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIOKdjCBGYWlsZWQgdG8gc3RhcnQgc2VydmVyOicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTUNQU2VydmVyXSBQb3J0ICR7dGhpcy5zZXR0aW5ncy5wb3J0fSBpcyBhbHJlYWR5IGluIHVzZS4gUGxlYXNlIGNoYW5nZSB0aGUgcG9ydCBpbiBzZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZU5leHRSdW50aW1lKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0g8J+agCBNQ1AgU2VydmVyIGlzIHJlYWR5IGZvciBjb25uZWN0aW9ucycpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0g4p2MIEZhaWxlZCB0byBzdGFydCBzZXJ2ZXI6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGVuc3VyZU5leHRSdW50aW1lKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5uZXh0Um91dGVyICYmIHRoaXMubmV4dFJlZ2lzdHJ5KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMubmV4dFJ1bnRpbWVQcm9taXNlKSB7XG4gICAgICAgICAgICB0aGlzLm5leHRSdW50aW1lUHJvbWlzZSA9IHRoaXMubmV4dFJ1bnRpbWVGYWN0b3J5KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcnVudGltZSA9IGF3YWl0IHRoaXMubmV4dFJ1bnRpbWVQcm9taXNlO1xuICAgICAgICAgICAgdGhpcy5uZXh0Um91dGVyID0gcnVudGltZS5yb3V0ZXI7XG4gICAgICAgICAgICB0aGlzLm5leHRSZWdpc3RyeSA9IHJ1bnRpbWUucmVnaXN0cnk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzTGlzdCA9IHRoaXMubmV4dFJlZ2lzdHJ5Lmxpc3RUb29scygpLm1hcCgodG9vbCkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHRvb2wuaW5wdXRTY2hlbWFcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBTZXR1cCB0b29scyAobmV4dCk6ICR7dGhpcy50b29sc0xpc3QubGVuZ3RofSB0b29scyBhdmFpbGFibGVgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFJ1bnRpbWVQcm9taXNlID0gbnVsbDtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROZXh0Um91dGVyKCk6IFByb21pc2U8TmV4dE1jcFJvdXRlcj4ge1xuICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZU5leHRSdW50aW1lKCk7XG4gICAgICAgIGlmICghdGhpcy5uZXh0Um91dGVyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05leHQgcm91dGVyIGlzIG5vdCBpbml0aWFsaXplZCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5leHRSb3V0ZXI7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEZpbHRlcmVkVG9vbHMoZW5hYmxlZFRvb2xzOiBhbnlbXSk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICBpZiAoIWVuYWJsZWRUb29scyB8fCBlbmFibGVkVG9vbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3Q7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBlbmFibGVkVG9vbE5hbWVzID0gbmV3IFNldChlbmFibGVkVG9vbHMubWFwKCh0b29sKSA9PiBgJHt0b29sLmNhdGVnb3J5fV8ke3Rvb2wubmFtZX1gKSk7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5maWx0ZXIoKHRvb2wpID0+IGVuYWJsZWRUb29sTmFtZXMuaGFzKHRvb2wubmFtZSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlVG9vbENhbGwodG9vbE5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3Qgcm91dGVyID0gYXdhaXQgdGhpcy5nZXROZXh0Um91dGVyKCk7XG4gICAgICAgIGNvbnN0IGNhbGxSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogYHNpbXBsZS1hcGk6JHt0aGlzLnNlc3Npb25JZEdlbmVyYXRvcigpfWAsXG4gICAgICAgICAgICBtZXRob2Q6IE1DUF9NRVRIT0RTLlRvb2xzQ2FsbCxcbiAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2xOYW1lLFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50czogaXNSZWNvcmQoYXJncykgPyBhcmdzIDoge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCFjYWxsUmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVG9vbCAke3Rvb2xOYW1lfSByZXR1cm5lZCBlbXB0eSByZXNwb25zZWApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsUmVzcG9uc2UuZXJyb3IpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihjYWxsUmVzcG9uc2UuZXJyb3IubWVzc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXlsb2FkID0gY2FsbFJlc3BvbnNlLnJlc3VsdCBhcyBhbnk7XG4gICAgICAgIGlmIChwYXlsb2FkPy5pc0Vycm9yID09PSB0cnVlKSB7XG4gICAgICAgICAgICBjb25zdCBidXNpbmVzc0Vycm9yID0gcGF5bG9hZD8uc3RydWN0dXJlZENvbnRlbnQ/LmVycm9yO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGJ1c2luZXNzRXJyb3I/Lm1lc3NhZ2UgfHwgYFRvb2wgJHt0b29sTmFtZX0gZXhlY3V0aW9uIGZhaWxlZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBheWxvYWQ/LnN0cnVjdHVyZWRDb250ZW50Py5kYXRhO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRDbGllbnRzKCk6IE1DUENsaWVudFtdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Vzc2lvblN0b3JlLmxpc3RTZXNzaW9ucygpLm1hcCgoc2Vzc2lvbikgPT4gKHtcbiAgICAgICAgICAgIGlkOiBzZXNzaW9uLmlkLFxuICAgICAgICAgICAgbGFzdEFjdGl2aXR5OiBuZXcgRGF0ZShzZXNzaW9uLmxhc3RBY3Rpdml0eUF0KVxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEF2YWlsYWJsZVRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3Q7XG4gICAgfVxuXG4gICAgcHVibGljIHVwZGF0ZUVuYWJsZWRUb29scyhlbmFibGVkVG9vbHM6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBVcGRhdGluZyBlbmFibGVkIHRvb2xzOiAke2VuYWJsZWRUb29scy5sZW5ndGh9IHRvb2xzYCk7XG4gICAgICAgIHRoaXMuZW5hYmxlZFRvb2xzID0gZW5hYmxlZFRvb2xzO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTZXR0aW5ncygpOiBNQ1BTZXJ2ZXJTZXR0aW5ncyB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldHRpbmdzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSHR0cFJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RVcmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCAnaHR0cDovLzEyNy4wLjAuMScpO1xuICAgICAgICBjb25zdCBwYXRobmFtZSA9IHJlcXVlc3RVcmwucGF0aG5hbWU7XG5cbiAgICAgICAgLy8g5YWI5qCh6aqMIE9yaWdpbu+8jOacqumAmui/h+aXtuebtOaOpeaLkue7neivt+axglxuICAgICAgICBpZiAoIXRoaXMuaXNPcmlnaW5BbGxvd2VkKHJlcSkpIHtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAzLCB7IGVycm9yOiAnRm9yYmlkZGVuIG9yaWdpbicgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgQ09SUyBoZWFkZXJzXG4gICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VULCBQT1NULCBERUxFVEUsIE9QVElPTlMnKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24sIEFjY2VwdCwgTUNQLVNlc3Npb24tSWQnKTtcblxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwNCk7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHBhdGhuYW1lID09PSAnL21jcCcgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVNQ1BSZXF1ZXN0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTUNQR2V0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnREVMRVRFJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTUNQRGVsZXRlKHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvaGVhbHRoJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb2snLFxuICAgICAgICAgICAgICAgICAgICB0b29sczogdGhpcy50b29sc0xpc3QubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uczogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGhuYW1lPy5zdGFydHNXaXRoKCcvYXBpLycpICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlU2ltcGxlQVBJUmVxdWVzdChyZXEsIHJlcywgcGF0aG5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZSA9PT0gJy9hcGkvdG9vbHMnICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDIwMCwgeyB0b29sczogdGhpcy5nZXRTaW1wbGlmaWVkVG9vbHNMaXN0KCkgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDQsIHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignSFRUUCByZXF1ZXN0IGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA1MDAsIHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVNQ1BSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcbiAgICAgICAgY29uc3QgcGFyc2VSZXN1bHQgPSBwYXJzZUpzb25ScGNCb2R5KHJhd0JvZHkpO1xuXG4gICAgICAgIGlmICghcGFyc2VSZXN1bHQub2spIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHBhcnNlUmVzdWx0LnJlc3BvbnNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1DUCAyMDI1LTExLTI177yaUE9TVCAvbWNwIOS7heaUr+aMgeWNlea2iOaBr++8jOS4jeaUr+aMgSBiYXRjaOOAglxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZVJlc3VsdC5wYXlsb2FkKSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShcbiAgICAgICAgICAgICAgICByZXMsXG4gICAgICAgICAgICAgICAgMjAwLFxuICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBiYXRjaCBpcyBub3Qgc3VwcG9ydGVkIG9uIFBPU1QgL21jcCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGV4dFJlc3VsdCA9IHRoaXMuYnVpbGRNQ1BSZXF1ZXN0Q29udGV4dChwYXJzZVJlc3VsdC5wYXlsb2FkLCByZXEpO1xuICAgICAgICBpZiAoIWNvbnRleHRSZXN1bHQub2spIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCBjb250ZXh0UmVzdWx0LnN0YXR1c0NvZGUsIHsgZXJyb3I6IGNvbnRleHRSZXN1bHQubWVzc2FnZSB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VSZXN1bHQgPSBhd2FpdCB0aGlzLmhhbmRsZUluY29taW5nTWVzc2FnZShwYXJzZVJlc3VsdC5wYXlsb2FkLCBjb250ZXh0UmVzdWx0LmNvbnRleHQpO1xuXG4gICAgICAgIGlmIChtZXNzYWdlUmVzdWx0LnNlc3Npb25JZFRvUmV0dXJuKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdNQ1AtU2Vzc2lvbi1JZCcsIG1lc3NhZ2VSZXN1bHQuc2Vzc2lvbklkVG9SZXR1cm4pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtZXNzYWdlUmVzdWx0LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMik7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgMjAwLCBtZXNzYWdlUmVzdWx0LnJlc3BvbnNlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkTUNQUmVxdWVzdENvbnRleHQoXG4gICAgICAgIHBheWxvYWQ6IHVua25vd24sXG4gICAgICAgIHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2VcbiAgICApOlxuICAgICAgICB8IHsgb2s6IHRydWU7IGNvbnRleHQ6IE1DUFJlcXVlc3RDb250ZXh0IH1cbiAgICAgICAgfCB7IG9rOiBmYWxzZTsgc3RhdHVzQ29kZTogbnVtYmVyOyBtZXNzYWdlOiBzdHJpbmcgfSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXEpO1xuXG4gICAgICAgIGlmICghdGhpcy5wYXlsb2FkUmVxdWlyZXNTZXNzaW9uSGVhZGVyKHBheWxvYWQpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbnRleHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uOiBudWxsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ01DUC1TZXNzaW9uLUlkIGhlYWRlciBpcyByZXF1aXJlZCBmb3Igbm9uLWluaXRpYWxpemUgcmVxdWVzdHMuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25TdG9yZS5nZXRTZXNzaW9uKHNlc3Npb25JZCk7XG4gICAgICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBJbnZhbGlkIE1DUC1TZXNzaW9uLUlkOiAke3Nlc3Npb25JZH1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUudG91Y2goc2Vzc2lvbklkLCB0aGlzLm5vdygpKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IHRydWUsXG4gICAgICAgICAgICBjb250ZXh0OiB7XG4gICAgICAgICAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgIHNlc3Npb25cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBheWxvYWRSZXF1aXJlc1Nlc3Npb25IZWFkZXIocGF5bG9hZDogdW5rbm93bik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIWlzUmVjb3JkKHBheWxvYWQpIHx8IHR5cGVvZiBwYXlsb2FkLm1ldGhvZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXF1aXJlc1Nlc3Npb25IZWFkZXIocGF5bG9hZC5tZXRob2QpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW5jb21pbmdNZXNzYWdlKFxuICAgICAgICBtZXNzYWdlOiB1bmtub3duLFxuICAgICAgICBjb250ZXh0OiBNQ1BSZXF1ZXN0Q29udGV4dFxuICAgICk6IFByb21pc2U8TWVzc2FnZUhhbmRsZVJlc3VsdD4ge1xuICAgICAgICAvLyDlrqLmiLfnq6/lj6/og73kvJrlj5HpgIEgcmVzcG9uc2Ug5raI5oGv77yI55So5LqO5ZON5bqUIHNlcnZlciByZXF1ZXN077yJ77yM5b2T5YmN5pyN5Yqh56uv5peg5Li75YqoIHJlcXVlc3TvvIznm7TmjqXlv73nlaVcbiAgICAgICAgaWYgKGlzUmVzcG9uc2VNZXNzYWdlKG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1JlcXVlc3RNZXNzYWdlKG1lc3NhZ2UpICYmICFpc05vdGlmaWNhdGlvbk1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtZXNzYWdlIG11c3QgYmUgYSB2YWxpZCBKU09OLVJQQyAyLjAgcmVxdWVzdCBvciBub3RpZmljYXRpb24nXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IG1lc3NhZ2UubWV0aG9kO1xuICAgICAgICBjb25zdCBpc05vdGlmaWNhdGlvbiA9IGlzTm90aWZpY2F0aW9uTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgY29uc3QgcmVxdWVzdElkID0gaXNSZXF1ZXN0TWVzc2FnZShtZXNzYWdlKSA/IG1lc3NhZ2UuaWQgOiBudWxsO1xuXG4gICAgICAgIGlmIChpc0luaXRpYWxpemVNZXRob2QobWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFlbnN1cmVJbml0aWFsaXplSXNSZXF1ZXN0KG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBpbml0aWFsaXplIG11c3QgYmUgYSByZXF1ZXN0IHdpdGggaWQnXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWlzUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIFJlcXVlc3Q6IGluaXRpYWxpemUgbXVzdCBiZSBhIHJlcXVlc3Qgd2l0aCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjb250ZXh0LnNlc3Npb25JZCB8fCAhY29udGV4dC5zZXNzaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtaXNzaW5nIGFjdGl2ZSBzZXNzaW9uIGZvciB0aGlzIG1ldGhvZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSW5pdGlhbGl6ZWROb3RpZmljYXRpb24obWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIG11c3QgYmUgYSBub3RpZmljYXRpb24gd2l0aG91dCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2Vzc2lvblN0b3JlLm1hcmtSZWFkeShjb250ZXh0LnNlc3Npb25JZCwgdGhpcy5ub3coKSk7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5qCH5YeGIG5vdGlmaWNhdGlvbu+8muS4jeW6lOi/lOWbniBKU09OLVJQQyDlk43lupRcbiAgICAgICAgaWYgKGlzTm90aWZpY2F0aW9uICYmIGlzTm90aWZpY2F0aW9uTWV0aG9kKG1ldGhvZCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzU2Vzc2lvblJlYWR5KGNvbnRleHQuc2Vzc2lvbikgJiYgIWNhbkhhbmRsZUJlZm9yZVJlYWR5KG1ldGhvZCwgaXNOb3RpZmljYXRpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBzZXNzaW9uIGlzIG5vdCByZWFkeSwgc2VuZCBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIGZpcnN0J1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOb3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGF3YWl0IHRoaXMuaGFuZGxlUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSlcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogTWVzc2FnZUhhbmRsZVJlc3VsdCB7XG4gICAgICAgIGlmIChtZXNzYWdlLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmICFpc1JlY29yZChtZXNzYWdlLnBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlLmlkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIHBhcmFtczogaW5pdGlhbGl6ZSBwYXJhbXMgbXVzdCBiZSBhbiBvYmplY3Qgd2hlbiBwcm92aWRlZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5zZXNzaW9uSWRHZW5lcmF0b3IoKTtcbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUuY3JlYXRlU2Vzc2lvbihzZXNzaW9uSWQsIHRoaXMubm93KCkpO1xuXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlID0ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogJzIwMjUtMTEtMjUnLFxuICAgICAgICAgICAgICAgIGNhcGFiaWxpdGllczoge1xuICAgICAgICAgICAgICAgICAgICB0b29sczoge31cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNlcnZlckluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uOiAnMS40LjAnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZSxcbiAgICAgICAgICAgIHNlc3Npb25JZFRvUmV0dXJuOiBzZXNzaW9uSWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlcXVlc3RNZXNzYWdlKG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogUHJvbWlzZTxKc29uUnBjUmVzcG9uc2VNZXNzYWdlPiB7XG4gICAgICAgIGNvbnN0IHsgaWQsIG1ldGhvZCwgcGFyYW1zIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAobWV0aG9kID09PSBNQ1BfTUVUSE9EUy5QaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgIHJlc3VsdDoge31cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByb3V0ZXIgPSBhd2FpdCB0aGlzLmdldE5leHRSb3V0ZXIoKTtcbiAgICAgICAgY29uc3Qgcm91dGVkID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgcGFyYW1zXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyb3V0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiByb3V0ZWQgYXMgSnNvblJwY1Jlc3BvbnNlTWVzc2FnZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnRlcm5hbEVycm9yLFxuICAgICAgICAgICAgYEludmFsaWQgcm91dGVyIHJlc3BvbnNlIGZvciBtZXRob2Q6ICR7bWV0aG9kfWBcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZU1DUEdldChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYWNjZXB0ID0gKHJlcS5oZWFkZXJzLmFjY2VwdCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgd2FudHNTc2UgPSBhY2NlcHQuaW5jbHVkZXMoJ3RleHQvZXZlbnQtc3RyZWFtJyk7XG5cbiAgICAgICAgaWYgKCF3YW50c1NzZSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDIwMCwge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbFZlcnNpb246ICcyMDI1LTExLTI1JyxcbiAgICAgICAgICAgICAgICB0cmFuc3BvcnQ6ICdzdHJlYW1hYmxlLWh0dHAnLFxuICAgICAgICAgICAgICAgIGVuZHBvaW50OiAnL21jcCcsXG4gICAgICAgICAgICAgICAgc3VwcG9ydHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcG9zdFNpbmdsZU1lc3NhZ2VPbmx5OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzc2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5nZXRTZXNzaW9uSWRGcm9tSGVhZGVyKHJlcSk7XG4gICAgICAgIGlmICghc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAwLCB7XG4gICAgICAgICAgICAgICAgZXJyb3I6ICdNQ1AtU2Vzc2lvbi1JZCBoZWFkZXIgaXMgcmVxdWlyZWQgZm9yIFNTRSBzdHJlYW0uJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uU3RvcmUuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogYEludmFsaWQgTUNQLVNlc3Npb24tSWQ6ICR7c2Vzc2lvbklkfWBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1Nlc3Npb25SZWFkeShzZXNzaW9uKSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwOSwge1xuICAgICAgICAgICAgICAgIGVycm9yOiAnU2Vzc2lvbiBpcyBub3QgcmVhZHkuIFNlbmQgbm90aWZpY2F0aW9ucy9pbml0aWFsaXplZCBiZWZvcmUgb3BlbmluZyBTU0Ugc3RyZWFtLidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUudG91Y2goc2Vzc2lvbklkLCB0aGlzLm5vdygpKTtcbiAgICAgICAgdGhpcy5zdHJlYW1hYmxlSHR0cC5vcGVuU3NlU3RyZWFtKHNlc3Npb25JZCwgcmVxLCByZXMpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTUNQRGVsZXRlKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBzZXNzaW9uSWQgPSB0aGlzLmdldFNlc3Npb25JZEZyb21IZWFkZXIocmVxKTtcbiAgICAgICAgaWYgKCFzZXNzaW9uSWQpIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogJ01DUC1TZXNzaW9uLUlkIGhlYWRlciBpcyByZXF1aXJlZCBmb3IgREVMRVRFIC9tY3AuJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZW1vdmVkID0gdGhpcy5zZXNzaW9uU3RvcmUucmVtb3ZlU2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICB0aGlzLnN0cmVhbWFibGVIdHRwLmNsb3NlU2Vzc2lvbihzZXNzaW9uSWQpO1xuXG4gICAgICAgIGlmICghcmVtb3ZlZCkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgIGVycm9yOiBgSW52YWxpZCBNQ1AtU2Vzc2lvbi1JZDogJHtzZXNzaW9uSWR9YFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXMud3JpdGVIZWFkKDIwNCk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIEhUVFAgc2VydmVyIHN0b3BwZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RyZWFtYWJsZUh0dHAuZGlzcG9zZSgpO1xuICAgICAgICB0aGlzLnNlc3Npb25TdG9yZS5jbGVhcigpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTdGF0dXMoKTogU2VydmVyU3RhdHVzIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJ1bm5pbmc6ICEhdGhpcy5odHRwU2VydmVyLFxuICAgICAgICAgICAgcG9ydDogdGhpcy5zZXR0aW5ncy5wb3J0LFxuICAgICAgICAgICAgY2xpZW50czogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVTaW1wbGVBUElSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgcGF0aG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRXh0cmFjdCB0b29sIG5hbWUgZnJvbSBwYXRoIGxpa2UgL2FwaS9ub2RlL3NldF9wb3NpdGlvblxuICAgICAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gcGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIocCA9PiBwKTtcbiAgICAgICAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdJbnZhbGlkIEFQSSBwYXRoLiBVc2UgL2FwaS97Y2F0ZWdvcnl9L3t0b29sX25hbWV9J1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXRoUGFydHNbMV07XG4gICAgICAgICAgICBjb25zdCB0b29sTmFtZSA9IHBhdGhQYXJ0c1syXTtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxUb29sTmFtZSA9IGAke2NhdGVnb3J5fV8ke3Rvb2xOYW1lfWA7XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtZXRlcnMgd2l0aCBlbmhhbmNlZCBlcnJvciBoYW5kbGluZ1xuICAgICAgICAgICAgbGV0IHBhcmFtcztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJzZUpzb25Cb2R5KGJvZHksIHtcbiAgICAgICAgICAgICAgICAgICAgYWxsb3dFbXB0eTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcm91dGVOYW1lOiAnU2ltcGxlQVBJJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0ludmFsaWQgSlNPTiBpbiByZXF1ZXN0IGJvZHknLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBwYXJzZUVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHJlY2VpdmVkQm9keTogYm9keS5zdWJzdHJpbmcoMCwgMjAwKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXhlY3V0ZSB0b29sXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVUb29sQ2FsbChmdWxsVG9vbE5hbWUsIHBhcmFtcyk7XG5cbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHRvb2w6IGZ1bGxUb29sTmFtZSxcbiAgICAgICAgICAgICAgICByZXN1bHRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NpbXBsZSBBUEkgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDUwMCwge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIHRvb2w6IHBhdGhuYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2ltcGxpZmllZFRvb2xzTGlzdCgpOiBhbnlbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5tYXAodG9vbCA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHRvb2wubmFtZS5zcGxpdCgnXycpO1xuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXJ0c1swXTtcbiAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignXycpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICBhcGlQYXRoOiBgL2FwaS8ke2NhdGVnb3J5fS8ke3Rvb2xOYW1lfWAsXG4gICAgICAgICAgICAgICAgY3VybEV4YW1wbGU6IHRoaXMuZ2VuZXJhdGVDdXJsRXhhbXBsZShjYXRlZ29yeSwgdG9vbE5hbWUsIHRvb2wuaW5wdXRTY2hlbWEpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybEV4YW1wbGUoY2F0ZWdvcnk6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgc2NoZW1hOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICAvLyBHZW5lcmF0ZSBzYW1wbGUgcGFyYW1ldGVycyBiYXNlZCBvbiBzY2hlbWFcbiAgICAgICAgY29uc3Qgc2FtcGxlUGFyYW1zID0gdGhpcy5nZW5lcmF0ZVNhbXBsZVBhcmFtcyhzY2hlbWEpO1xuICAgICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoc2FtcGxlUGFyYW1zLCBudWxsLCAyKTtcblxuICAgICAgICByZXR1cm4gYGN1cmwgLVggUE9TVCBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fS9hcGkvJHtjYXRlZ29yeX0vJHt0b29sTmFtZX0gXFxcXFxcbiAgLUggXCJDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cIiBcXFxcXFxuICAtZCAnJHtqc29uU3RyaW5nfSdgO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVTYW1wbGVQYXJhbXMoc2NoZW1hOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAoIXNjaGVtYSB8fCAhc2NoZW1hLnByb3BlcnRpZXMpIHJldHVybiB7fTtcblxuICAgICAgICBjb25zdCBzYW1wbGU6IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHByb3BdIG9mIE9iamVjdC5lbnRyaWVzKHNjaGVtYS5wcm9wZXJ0aWVzIGFzIGFueSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BTY2hlbWEgPSBwcm9wIGFzIGFueTtcbiAgICAgICAgICAgIHN3aXRjaCAocHJvcFNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgJ2V4YW1wbGVfc3RyaW5nJztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgNDI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSAnZXhhbXBsZV92YWx1ZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNhbXBsZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBhcnNlSnNvbkJvZHkoXG4gICAgICAgIHJhd0JvZHk6IHN0cmluZyxcbiAgICAgICAgb3B0aW9uczogeyBhbGxvd0VtcHR5OiBib29sZWFuOyByb3V0ZU5hbWU6IHN0cmluZyB9XG4gICAgKTogYW55IHtcbiAgICAgICAgY29uc3QgYm9keSA9IHJhd0JvZHkudHJpbSgpO1xuXG4gICAgICAgIGlmICghYm9keSkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxsb3dFbXB0eSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtvcHRpb25zLnJvdXRlTmFtZX0gcmVxdWVzdCBib2R5IGlzIGVtcHR5YCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJHtvcHRpb25zLnJvdXRlTmFtZX0gSlNPTiBwYXJzZSBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX0uIGAgK1xuICAgICAgICAgICAgICAgICfor7fnoa7kv53or7fmsYLkvZPmmK/lkIjms5UgSlNPTu+8m+W/heimgeaXtuWPr+WFiOiwg+eUqCB2YWxpZGF0aW9uX3ZhbGlkYXRlX2pzb25fcGFyYW1zIOi/m+ihjOajgOafpeOAgidcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlU2V0dGluZ3Moc2V0dGluZ3M6IE1DUFNlcnZlclNldHRpbmdzKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB2b2lkIHRoaXMuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IHJhd0hlYWRlciA9IHJlcS5oZWFkZXJzWydtY3Atc2Vzc2lvbi1pZCddO1xuICAgICAgICBpZiAoIXJhd0hlYWRlcikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyYXdIZWFkZXIpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmF3SGVhZGVyWzBdIHx8IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmF3SGVhZGVyO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNPcmlnaW5BbGxvd2VkKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgYWxsb3dlZE9yaWdpbnMgPSB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zICYmIHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zXG4gICAgICAgICAgICA6IFsnKiddO1xuICAgICAgICBjb25zdCByZXF1ZXN0T3JpZ2luID0gcmVxLmhlYWRlcnMub3JpZ2luO1xuXG4gICAgICAgIGlmICghcmVxdWVzdE9yaWdpbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWxsb3dlZE9yaWdpbnMuaW5jbHVkZXMoJyonKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWxsb3dlZE9yaWdpbnMuaW5jbHVkZXMocmVxdWVzdE9yaWdpbik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhcHBseUNvcnNIZWFkZXJzKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBhbGxvd2VkT3JpZ2lucyA9IHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMgJiYgdGhpcy5zZXR0aW5ncy5hbGxvd2VkT3JpZ2lucy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/IHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnNcbiAgICAgICAgICAgIDogWycqJ107XG4gICAgICAgIGNvbnN0IHJlcXVlc3RPcmlnaW4gPSByZXEuaGVhZGVycy5vcmlnaW47XG5cbiAgICAgICAgaWYgKGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKCcqJykpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3RPcmlnaW4gPT09ICdzdHJpbmcnICYmIGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKHJlcXVlc3RPcmlnaW4pKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCByZXF1ZXN0T3JpZ2luKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1ZhcnknLCAnT3JpZ2luJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDmnKrmkLrluKYgT3JpZ2luIOaXtu+8jOWFgeiuuOmmluS4queZveWQjeWNleadpea6kOeUqOS6jumdnua1j+iniOWZqOWuouaIt+err1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCBhbGxvd2VkT3JpZ2luc1swXSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZUpzb25SZXNwb25zZShyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHN0YXR1c0NvZGU6IG51bWJlciwgcGF5bG9hZDogdW5rbm93bik6IHZvaWQge1xuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHN0YXR1c0NvZGU7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xuICAgIH1cbn1cblxuLy8gSFRUUCB0cmFuc3BvcnQgZG9lc24ndCBuZWVkIHBlcnNpc3RlbnQgY2xpZW50IHNvY2tldCBiZXlvbmQgU1NFIHN0cmVhbXNcbiJdfQ==