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
const scene_tools_1 = require("./tools/scene-tools");
const node_tools_1 = require("./tools/node-tools");
const component_tools_1 = require("./tools/component-tools");
const prefab_tools_1 = require("./tools/prefab-tools");
const project_tools_1 = require("./tools/project-tools");
const debug_tools_1 = require("./tools/debug-tools");
const preferences_tools_1 = require("./tools/preferences-tools");
const server_tools_1 = require("./tools/server-tools");
const broadcast_tools_1 = require("./tools/broadcast-tools");
const scene_advanced_tools_1 = require("./tools/scene-advanced-tools");
const scene_view_tools_1 = require("./tools/scene-view-tools");
const reference_image_tools_1 = require("./tools/reference-image-tools");
const asset_advanced_tools_1 = require("./tools/asset-advanced-tools");
const validation_tools_1 = require("./tools/validation-tools");
const errors_1 = require("./mcp/errors");
const jsonrpc_1 = require("./mcp/jsonrpc");
const messages_1 = require("./mcp/messages");
const lifecycle_1 = require("./mcp/lifecycle");
const session_store_1 = require("./mcp/session-store");
const streamable_http_1 = require("./mcp/streamable-http");
class MCPServer {
    constructor(settings, dependencies = {}) {
        var _a, _b;
        this.httpServer = null;
        this.tools = {};
        this.toolsList = [];
        this.enabledTools = []; // 存储启用的工具列表
        this.sessionStore = new session_store_1.SessionStore();
        this.streamableHttp = new streamable_http_1.StreamableHttpManager();
        this.settings = settings;
        this.sessionIdGenerator = (_a = dependencies.sessionIdGenerator) !== null && _a !== void 0 ? _a : (() => (0, crypto_1.randomUUID)());
        this.now = (_b = dependencies.now) !== null && _b !== void 0 ? _b : (() => Date.now());
        this.initializeTools(dependencies.toolExecutors);
    }
    initializeTools(customTools) {
        if (customTools) {
            this.tools = customTools;
            this.setupTools();
            console.log('[MCPServer] 使用注入工具执行器初始化完成');
            return;
        }
        try {
            console.log('[MCPServer] Initializing tools...');
            this.tools.scene = new scene_tools_1.SceneTools();
            this.tools.node = new node_tools_1.NodeTools();
            this.tools.component = new component_tools_1.ComponentTools();
            this.tools.prefab = new prefab_tools_1.PrefabTools();
            this.tools.project = new project_tools_1.ProjectTools();
            this.tools.debug = new debug_tools_1.DebugTools();
            this.tools.preferences = new preferences_tools_1.PreferencesTools();
            this.tools.server = new server_tools_1.ServerTools();
            this.tools.broadcast = new broadcast_tools_1.BroadcastTools();
            this.tools.sceneAdvanced = new scene_advanced_tools_1.SceneAdvancedTools();
            this.tools.sceneView = new scene_view_tools_1.SceneViewTools();
            this.tools.referenceImage = new reference_image_tools_1.ReferenceImageTools();
            this.tools.assetAdvanced = new asset_advanced_tools_1.AssetAdvancedTools();
            this.tools.validation = new validation_tools_1.ValidationTools();
            console.log('[MCPServer] Tools initialized successfully');
        }
        catch (error) {
            console.error('[MCPServer] Error initializing tools:', error);
            throw error;
        }
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
            this.setupTools();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        }
        catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }
    setupTools() {
        this.toolsList = [];
        // 如果没有启用工具配置，返回所有工具
        if (!this.enabledTools || this.enabledTools.length === 0) {
            for (const [category, toolSet] of Object.entries(this.tools)) {
                const tools = toolSet.getTools();
                for (const tool of tools) {
                    this.toolsList.push({
                        name: `${category}_${tool.name}`,
                        description: tool.description,
                        inputSchema: tool.inputSchema
                    });
                }
            }
        }
        else {
            // 根据启用的工具配置过滤
            const enabledToolNames = new Set(this.enabledTools.map(tool => `${tool.category}_${tool.name}`));
            for (const [category, toolSet] of Object.entries(this.tools)) {
                const tools = toolSet.getTools();
                for (const tool of tools) {
                    const toolName = `${category}_${tool.name}`;
                    if (enabledToolNames.has(toolName)) {
                        this.toolsList.push({
                            name: toolName,
                            description: tool.description,
                            inputSchema: tool.inputSchema
                        });
                    }
                }
            }
        }
        console.log(`[MCPServer] Setup tools: ${this.toolsList.length} tools available`);
    }
    getFilteredTools(enabledTools) {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList; // 如果没有过滤配置，返回所有工具
        }
        const enabledToolNames = new Set(enabledTools.map(tool => `${tool.category}_${tool.name}`));
        return this.toolsList.filter(tool => enabledToolNames.has(tool.name));
    }
    async executeToolCall(toolName, args) {
        const parts = toolName.split('_');
        const category = parts[0];
        const toolMethodName = parts.slice(1).join('_');
        if (this.tools[category]) {
            return await this.tools[category].execute(toolMethodName, args);
        }
        throw new Error(`Tool ${toolName} not found`);
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
        this.setupTools(); // 重新设置工具列表
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
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
        const contextResult = this.buildMCPRequestContext(parseResult.payload, req);
        if (!contextResult.ok) {
            this.writeJsonResponse(res, contextResult.statusCode, { error: contextResult.message });
            return;
        }
        const payloadResult = await this.handleIncomingPayload(parseResult.payload, contextResult.context);
        if (payloadResult.sessionIdToReturn) {
            res.setHeader('MCP-Session-Id', payloadResult.sessionIdToReturn);
        }
        if (payloadResult.body === undefined) {
            res.writeHead(payloadResult.statusCode);
            res.end();
            return;
        }
        this.writeJsonResponse(res, payloadResult.statusCode, payloadResult.body);
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
        if (Array.isArray(payload)) {
            return payload.some((item) => {
                if (!(0, messages_1.isRecord)(item) || typeof item.method !== 'string') {
                    return false;
                }
                return (0, lifecycle_1.requiresSessionHeader)(item.method);
            });
        }
        if (!(0, messages_1.isRecord)(payload) || typeof payload.method !== 'string') {
            return false;
        }
        return (0, lifecycle_1.requiresSessionHeader)(payload.method);
    }
    async handleIncomingPayload(payload, context) {
        if (Array.isArray(payload)) {
            if (payload.length === 0) {
                return {
                    statusCode: 200,
                    body: (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: batch request cannot be empty')
                };
            }
            const responses = [];
            let sessionIdToReturn;
            for (const item of payload) {
                const result = await this.handleIncomingMessage(item, context, true);
                if (result.sessionIdToReturn && !sessionIdToReturn) {
                    sessionIdToReturn = result.sessionIdToReturn;
                }
                if (result.response) {
                    responses.push(result.response);
                }
            }
            if (responses.length === 0) {
                return {
                    statusCode: 202,
                    sessionIdToReturn
                };
            }
            return {
                statusCode: 200,
                body: responses,
                sessionIdToReturn
            };
        }
        const result = await this.handleIncomingMessage(payload, context, false);
        if (!result.response) {
            return {
                statusCode: 202,
                sessionIdToReturn: result.sessionIdToReturn
            };
        }
        return {
            statusCode: 200,
            body: result.response,
            sessionIdToReturn: result.sessionIdToReturn
        };
    }
    async handleIncomingMessage(message, context, isBatch) {
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
            if (isBatch) {
                return {
                    response: (0, errors_1.createJsonRpcErrorResponse)(requestId, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: initialize must be sent as a single request')
                };
            }
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
        const { id, method } = message;
        switch (method) {
            case lifecycle_1.MCP_METHODS.ToolsList:
                return {
                    jsonrpc: '2.0',
                    id,
                    result: { tools: this.getAvailableTools() }
                };
            case lifecycle_1.MCP_METHODS.ToolsCall:
                return this.handleToolsCallRequest(message);
            case lifecycle_1.MCP_METHODS.Ping:
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {}
                };
            default:
                return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.MethodNotFound, `Method not found: ${method}`);
        }
    }
    async handleToolsCallRequest(message) {
        var _a, _b;
        const { id, params } = message;
        if (!(0, messages_1.isRecord)(params)) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for tools/call: params must be an object');
        }
        const name = params.name;
        if (typeof name !== 'string' || !name.trim()) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for tools/call: "name" is required');
        }
        const args = (_a = params.arguments) !== null && _a !== void 0 ? _a : {};
        try {
            const toolResult = await this.executeToolCall(name, args);
            const isBusinessError = this.isToolBusinessError(toolResult);
            return {
                jsonrpc: '2.0',
                id,
                result: Object.assign({ content: [{ type: 'text', text: this.stringifyToolResult(toolResult) }] }, (isBusinessError ? { isError: true } : {}))
            };
        }
        catch (error) {
            const messageText = String((_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : error);
            if (/not found/i.test(messageText)) {
                return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, messageText);
            }
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InternalError, messageText);
        }
    }
    isToolBusinessError(toolResult) {
        if (!(0, messages_1.isRecord)(toolResult)) {
            return false;
        }
        if (toolResult.success === false) {
            return true;
        }
        if (typeof toolResult.error === 'string' && toolResult.error.length > 0) {
            return true;
        }
        return false;
    }
    stringifyToolResult(toolResult) {
        if (typeof toolResult === 'string') {
            return toolResult;
        }
        try {
            const serialized = JSON.stringify(toolResult);
            if (typeof serialized === 'string') {
                return serialized;
            }
            return String(toolResult);
        }
        catch (error) {
            return String(toolResult);
        }
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
                    sse: true
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUE2QjtBQUM3QixtQ0FBb0M7QUFFcEMscURBQWlEO0FBQ2pELG1EQUErQztBQUMvQyw2REFBeUQ7QUFDekQsdURBQW1EO0FBQ25ELHlEQUFxRDtBQUNyRCxxREFBaUQ7QUFDakQsaUVBQTZEO0FBQzdELHVEQUFtRDtBQUNuRCw2REFBeUQ7QUFDekQsdUVBQWtFO0FBQ2xFLCtEQUEwRDtBQUMxRCx5RUFBb0U7QUFDcEUsdUVBQWtFO0FBQ2xFLCtEQUEyRDtBQUMzRCx5Q0FBNEU7QUFDNUUsMkNBQThEO0FBQzlELDZDQVF3QjtBQUN4QiwrQ0FTeUI7QUFDekIsdURBQStEO0FBQy9ELDJEQUE4RDtBQTZCOUQsTUFBYSxTQUFTO0lBV2xCLFlBQVksUUFBMkIsRUFBRSxlQUFzQyxFQUFFOztRQVR6RSxlQUFVLEdBQXVCLElBQUksQ0FBQztRQUN0QyxVQUFLLEdBQXFDLEVBQUUsQ0FBQztRQUM3QyxjQUFTLEdBQXFCLEVBQUUsQ0FBQztRQUNqQyxpQkFBWSxHQUFVLEVBQUUsQ0FBQyxDQUFDLFlBQVk7UUFDN0IsaUJBQVksR0FBRyxJQUFJLDRCQUFZLEVBQUUsQ0FBQztRQUNsQyxtQkFBYyxHQUFHLElBQUksdUNBQXFCLEVBQUUsQ0FBQztRQUsxRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsTUFBQSxZQUFZLENBQUMsa0JBQWtCLG1DQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBQSxtQkFBVSxHQUFFLENBQUMsQ0FBQztRQUNsRixJQUFJLENBQUMsR0FBRyxHQUFHLE1BQUEsWUFBWSxDQUFDLEdBQUcsbUNBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMs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QUNwRixHQUFHLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUM1QixHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2xELEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7Q0FDSjtBQWoyQkQsOEJBaTJCQztBQUVELDBFQUEwRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IE1DUFNlcnZlclNldHRpbmdzLCBTZXJ2ZXJTdGF0dXMsIE1DUENsaWVudCwgVG9vbERlZmluaXRpb24gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFNjZW5lVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3NjZW5lLXRvb2xzJztcbmltcG9ydCB7IE5vZGVUb29scyB9IGZyb20gJy4vdG9vbHMvbm9kZS10b29scyc7XG5pbXBvcnQgeyBDb21wb25lbnRUb29scyB9IGZyb20gJy4vdG9vbHMvY29tcG9uZW50LXRvb2xzJztcbmltcG9ydCB7IFByZWZhYlRvb2xzIH0gZnJvbSAnLi90b29scy9wcmVmYWItdG9vbHMnO1xuaW1wb3J0IHsgUHJvamVjdFRvb2xzIH0gZnJvbSAnLi90b29scy9wcm9qZWN0LXRvb2xzJztcbmltcG9ydCB7IERlYnVnVG9vbHMgfSBmcm9tICcuL3Rvb2xzL2RlYnVnLXRvb2xzJztcbmltcG9ydCB7IFByZWZlcmVuY2VzVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3ByZWZlcmVuY2VzLXRvb2xzJztcbmltcG9ydCB7IFNlcnZlclRvb2xzIH0gZnJvbSAnLi90b29scy9zZXJ2ZXItdG9vbHMnO1xuaW1wb3J0IHsgQnJvYWRjYXN0VG9vbHMgfSBmcm9tICcuL3Rvb2xzL2Jyb2FkY2FzdC10b29scyc7XG5pbXBvcnQgeyBTY2VuZUFkdmFuY2VkVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3NjZW5lLWFkdmFuY2VkLXRvb2xzJztcbmltcG9ydCB7IFNjZW5lVmlld1Rvb2xzIH0gZnJvbSAnLi90b29scy9zY2VuZS12aWV3LXRvb2xzJztcbmltcG9ydCB7IFJlZmVyZW5jZUltYWdlVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3JlZmVyZW5jZS1pbWFnZS10b29scyc7XG5pbXBvcnQgeyBBc3NldEFkdmFuY2VkVG9vbHMgfSBmcm9tICcuL3Rvb2xzL2Fzc2V0LWFkdmFuY2VkLXRvb2xzJztcbmltcG9ydCB7IFZhbGlkYXRpb25Ub29scyB9IGZyb20gJy4vdG9vbHMvdmFsaWRhdGlvbi10b29scyc7XG5pbXBvcnQgeyBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZSwgSnNvblJwY0Vycm9yQ29kZSB9IGZyb20gJy4vbWNwL2Vycm9ycyc7XG5pbXBvcnQgeyBwYXJzZUpzb25ScGNCb2R5LCByZWFkUmF3Qm9keSB9IGZyb20gJy4vbWNwL2pzb25ycGMnO1xuaW1wb3J0IHtcbiAgICBKc29uUnBjTm90aWZpY2F0aW9uLFxuICAgIEpzb25ScGNSZXF1ZXN0LFxuICAgIEpzb25ScGNSZXNwb25zZU1lc3NhZ2UsXG4gICAgaXNOb3RpZmljYXRpb25NZXNzYWdlLFxuICAgIGlzUmVjb3JkLFxuICAgIGlzUmVxdWVzdE1lc3NhZ2UsXG4gICAgaXNSZXNwb25zZU1lc3NhZ2Vcbn0gZnJvbSAnLi9tY3AvbWVzc2FnZXMnO1xuaW1wb3J0IHtcbiAgICBNQ1BfTUVUSE9EUyxcbiAgICBjYW5IYW5kbGVCZWZvcmVSZWFkeSxcbiAgICBlbnN1cmVJbml0aWFsaXplSXNSZXF1ZXN0LFxuICAgIGlzSW5pdGlhbGl6ZU1ldGhvZCxcbiAgICBpc0luaXRpYWxpemVkTm90aWZpY2F0aW9uLFxuICAgIGlzTm90aWZpY2F0aW9uTWV0aG9kLFxuICAgIGlzU2Vzc2lvblJlYWR5LFxuICAgIHJlcXVpcmVzU2Vzc2lvbkhlYWRlclxufSBmcm9tICcuL21jcC9saWZlY3ljbGUnO1xuaW1wb3J0IHsgTWNwU2Vzc2lvbiwgU2Vzc2lvblN0b3JlIH0gZnJvbSAnLi9tY3Avc2Vzc2lvbi1zdG9yZSc7XG5pbXBvcnQgeyBTdHJlYW1hYmxlSHR0cE1hbmFnZXIgfSBmcm9tICcuL21jcC9zdHJlYW1hYmxlLWh0dHAnO1xuXG5pbnRlcmZhY2UgVG9vbEV4ZWN1dG9yTGlrZSB7XG4gICAgZ2V0VG9vbHMoKTogVG9vbERlZmluaXRpb25bXTtcbiAgICBleGVjdXRlKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8YW55Pjtcbn1cblxuaW50ZXJmYWNlIE1DUFNlcnZlckRlcGVuZGVuY2llcyB7XG4gICAgdG9vbEV4ZWN1dG9ycz86IFJlY29yZDxzdHJpbmcsIFRvb2xFeGVjdXRvckxpa2U+O1xuICAgIHNlc3Npb25JZEdlbmVyYXRvcj86ICgpID0+IHN0cmluZztcbiAgICBub3c/OiAoKSA9PiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBNQ1BSZXF1ZXN0Q29udGV4dCB7XG4gICAgc2Vzc2lvbklkOiBzdHJpbmcgfCBudWxsO1xuICAgIHNlc3Npb246IE1jcFNlc3Npb24gfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgTWVzc2FnZUhhbmRsZVJlc3VsdCB7XG4gICAgcmVzcG9uc2U6IEpzb25ScGNSZXNwb25zZU1lc3NhZ2UgfCBudWxsO1xuICAgIHNlc3Npb25JZFRvUmV0dXJuPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUGF5bG9hZEhhbmRsZVJlc3VsdCB7XG4gICAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICAgIGJvZHk/OiB1bmtub3duO1xuICAgIHNlc3Npb25JZFRvUmV0dXJuPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTUNQU2VydmVyIHtcbiAgICBwcml2YXRlIHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncztcbiAgICBwcml2YXRlIGh0dHBTZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSB0b29sczogUmVjb3JkPHN0cmluZywgVG9vbEV4ZWN1dG9yTGlrZT4gPSB7fTtcbiAgICBwcml2YXRlIHRvb2xzTGlzdDogVG9vbERlZmluaXRpb25bXSA9IFtdO1xuICAgIHByaXZhdGUgZW5hYmxlZFRvb2xzOiBhbnlbXSA9IFtdOyAvLyDlrZjlgqjlkK/nlKjnmoTlt6XlhbfliJfooahcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25TdG9yZSA9IG5ldyBTZXNzaW9uU3RvcmUoKTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0cmVhbWFibGVIdHRwID0gbmV3IFN0cmVhbWFibGVIdHRwTWFuYWdlcigpO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbklkR2VuZXJhdG9yOiAoKSA9PiBzdHJpbmc7XG4gICAgcHJpdmF0ZSByZWFkb25seSBub3c6ICgpID0+IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncywgZGVwZW5kZW5jaWVzOiBNQ1BTZXJ2ZXJEZXBlbmRlbmNpZXMgPSB7fSkge1xuICAgICAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgICAgIHRoaXMuc2Vzc2lvbklkR2VuZXJhdG9yID0gZGVwZW5kZW5jaWVzLnNlc3Npb25JZEdlbmVyYXRvciA/PyAoKCkgPT4gcmFuZG9tVVVJRCgpKTtcbiAgICAgICAgdGhpcy5ub3cgPSBkZXBlbmRlbmNpZXMubm93ID8/ICgoKSA9PiBEYXRlLm5vdygpKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplVG9vbHMoZGVwZW5kZW5jaWVzLnRvb2xFeGVjdXRvcnMpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZVRvb2xzKGN1c3RvbVRvb2xzPzogUmVjb3JkPHN0cmluZywgVG9vbEV4ZWN1dG9yTGlrZT4pOiB2b2lkIHtcbiAgICAgICAgaWYgKGN1c3RvbVRvb2xzKSB7XG4gICAgICAgICAgICB0aGlzLnRvb2xzID0gY3VzdG9tVG9vbHM7XG4gICAgICAgICAgICB0aGlzLnNldHVwVG9vbHMoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSDkvb/nlKjms6jlhaXlt6XlhbfmiafooYzlmajliJ3lp4vljJblrozmiJAnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gSW5pdGlhbGl6aW5nIHRvb2xzLi4uJyk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnNjZW5lID0gbmV3IFNjZW5lVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMubm9kZSA9IG5ldyBOb2RlVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuY29tcG9uZW50ID0gbmV3IENvbXBvbmVudFRvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnByZWZhYiA9IG5ldyBQcmVmYWJUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5wcm9qZWN0ID0gbmV3IFByb2plY3RUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5kZWJ1ZyA9IG5ldyBEZWJ1Z1Rvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnByZWZlcmVuY2VzID0gbmV3IFByZWZlcmVuY2VzVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuc2VydmVyID0gbmV3IFNlcnZlclRvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLmJyb2FkY2FzdCA9IG5ldyBCcm9hZGNhc3RUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5zY2VuZUFkdmFuY2VkID0gbmV3IFNjZW5lQWR2YW5jZWRUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5zY2VuZVZpZXcgPSBuZXcgU2NlbmVWaWV3VG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMucmVmZXJlbmNlSW1hZ2UgPSBuZXcgUmVmZXJlbmNlSW1hZ2VUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5hc3NldEFkdmFuY2VkID0gbmV3IEFzc2V0QWR2YW5jZWRUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy52YWxpZGF0aW9uID0gbmV3IFZhbGlkYXRpb25Ub29scygpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIFRvb2xzIGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0gRXJyb3IgaW5pdGlhbGl6aW5nIHRvb2xzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gU2VydmVyIGlzIGFscmVhZHkgcnVubmluZycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBTdGFydGluZyBIVFRQIHNlcnZlciBvbiBwb3J0ICR7dGhpcy5zZXR0aW5ncy5wb3J0fS4uLmApO1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIodGhpcy5oYW5kbGVIdHRwUmVxdWVzdC5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlci5tYXhDb25uZWN0aW9ucyA9IHRoaXMuc2V0dGluZ3MubWF4Q29ubmVjdGlvbnM7XG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIhLmxpc3Rlbih0aGlzLnNldHRpbmdzLnBvcnQsICcxMjcuMC4wLjEnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSDinIUgSFRUUCBzZXJ2ZXIgc3RhcnRlZCBzdWNjZXNzZnVsbHkgb24gaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIEhlYWx0aCBjaGVjazogaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH0vaGVhbHRoYCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBNQ1AgZW5kcG9pbnQ6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L21jcGApO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyIS5vbignZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0g4p2MIEZhaWxlZCB0byBzdGFydCBzZXJ2ZXI6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyci5jb2RlID09PSAnRUFERFJJTlVTRScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNQ1BTZXJ2ZXJdIFBvcnQgJHt0aGlzLnNldHRpbmdzLnBvcnR9IGlzIGFscmVhZHkgaW4gdXNlLiBQbGVhc2UgY2hhbmdlIHRoZSBwb3J0IGluIHNldHRpbmdzLmApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0dXBUb29scygpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIPCfmoAgTUNQIFNlcnZlciBpcyByZWFkeSBmb3IgY29ubmVjdGlvbnMnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIOKdjCBGYWlsZWQgdG8gc3RhcnQgc2VydmVyOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXR1cFRvb2xzKCk6IHZvaWQge1xuICAgICAgICB0aGlzLnRvb2xzTGlzdCA9IFtdO1xuXG4gICAgICAgIC8vIOWmguaenOayoeacieWQr+eUqOW3peWFt+mFjee9ru+8jOi/lOWbnuaJgOacieW3peWFt1xuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZFRvb2xzIHx8IHRoaXMuZW5hYmxlZFRvb2xzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBbY2F0ZWdvcnksIHRvb2xTZXRdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMudG9vbHMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbHMgPSB0b29sU2V0LmdldFRvb2xzKCk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHNMaXN0LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogYCR7Y2F0ZWdvcnl9XyR7dG9vbC5uYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB0b29sLmlucHV0U2NoZW1hXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIOagueaNruWQr+eUqOeahOW3peWFt+mFjee9rui/h+a7pFxuICAgICAgICAgICAgY29uc3QgZW5hYmxlZFRvb2xOYW1lcyA9IG5ldyBTZXQodGhpcy5lbmFibGVkVG9vbHMubWFwKHRvb2wgPT4gYCR7dG9vbC5jYXRlZ29yeX1fJHt0b29sLm5hbWV9YCkpO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtjYXRlZ29yeSwgdG9vbFNldF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy50b29scykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29scyA9IHRvb2xTZXQuZ2V0VG9vbHMoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2wgb2YgdG9vbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9vbE5hbWUgPSBgJHtjYXRlZ29yeX1fJHt0b29sLm5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVuYWJsZWRUb29sTmFtZXMuaGFzKHRvb2xOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sc0xpc3QucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHRvb2wuaW5wdXRTY2hlbWFcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFNldHVwIHRvb2xzOiAke3RoaXMudG9vbHNMaXN0Lmxlbmd0aH0gdG9vbHMgYXZhaWxhYmxlYCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEZpbHRlcmVkVG9vbHMoZW5hYmxlZFRvb2xzOiBhbnlbXSk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICBpZiAoIWVuYWJsZWRUb29scyB8fCBlbmFibGVkVG9vbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3Q7IC8vIOWmguaenOayoeaciei/h+a7pOmFjee9ru+8jOi/lOWbnuaJgOacieW3peWFt1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZW5hYmxlZFRvb2xOYW1lcyA9IG5ldyBTZXQoZW5hYmxlZFRvb2xzLm1hcCh0b29sID0+IGAke3Rvb2wuY2F0ZWdvcnl9XyR7dG9vbC5uYW1lfWApKTtcbiAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0LmZpbHRlcih0b29sID0+IGVuYWJsZWRUb29sTmFtZXMuaGFzKHRvb2wubmFtZSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlVG9vbENhbGwodG9vbE5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcGFydHMgPSB0b29sTmFtZS5zcGxpdCgnXycpO1xuICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHBhcnRzWzBdO1xuICAgICAgICBjb25zdCB0b29sTWV0aG9kTmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJ18nKTtcblxuICAgICAgICBpZiAodGhpcy50b29sc1tjYXRlZ29yeV0pIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnRvb2xzW2NhdGVnb3J5XS5leGVjdXRlKHRvb2xNZXRob2ROYW1lLCBhcmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVG9vbCAke3Rvb2xOYW1lfSBub3QgZm91bmRgKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q2xpZW50cygpOiBNQ1BDbGllbnRbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlc3Npb25TdG9yZS5saXN0U2Vzc2lvbnMoKS5tYXAoKHNlc3Npb24pID0+ICh7XG4gICAgICAgICAgICBpZDogc2Vzc2lvbi5pZCxcbiAgICAgICAgICAgIGxhc3RBY3Rpdml0eTogbmV3IERhdGUoc2Vzc2lvbi5sYXN0QWN0aXZpdHlBdClcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRBdmFpbGFibGVUb29scygpOiBUb29sRGVmaW5pdGlvbltdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0O1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVFbmFibGVkVG9vbHMoZW5hYmxlZFRvb2xzOiBhbnlbXSk6IHZvaWQge1xuICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gVXBkYXRpbmcgZW5hYmxlZCB0b29sczogJHtlbmFibGVkVG9vbHMubGVuZ3RofSB0b29sc2ApO1xuICAgICAgICB0aGlzLmVuYWJsZWRUb29scyA9IGVuYWJsZWRUb29scztcbiAgICAgICAgdGhpcy5zZXR1cFRvb2xzKCk7IC8vIOmHjeaWsOiuvue9ruW3peWFt+WIl+ihqFxuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTZXR0aW5ncygpOiBNQ1BTZXJ2ZXJTZXR0aW5ncyB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldHRpbmdzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSHR0cFJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RVcmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCAnaHR0cDovLzEyNy4wLjAuMScpO1xuICAgICAgICBjb25zdCBwYXRobmFtZSA9IHJlcXVlc3RVcmwucGF0aG5hbWU7XG5cbiAgICAgICAgLy8g5YWI5qCh6aqMIE9yaWdpbu+8jOacqumAmui/h+aXtuebtOaOpeaLkue7neivt+axglxuICAgICAgICBpZiAoIXRoaXMuaXNPcmlnaW5BbGxvd2VkKHJlcSkpIHtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAzLCB7IGVycm9yOiAnRm9yYmlkZGVuIG9yaWdpbicgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgQ09SUyBoZWFkZXJzXG4gICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VULCBQT1NULCBPUFRJT05TJyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnLCAnQ29udGVudC1UeXBlLCBBdXRob3JpemF0aW9uLCBBY2NlcHQsIE1DUC1TZXNzaW9uLUlkJyk7XG5cbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDQpO1xuICAgICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy9tY3AnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlTUNQUmVxdWVzdChyZXEsIHJlcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGhuYW1lID09PSAnL21jcCcgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZU1DUEdldChyZXEsIHJlcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGhuYW1lID09PSAnL2hlYWx0aCcgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgMjAwLCB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ29rJyxcbiAgICAgICAgICAgICAgICAgICAgdG9vbHM6IHRoaXMudG9vbHNMaXN0Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbnM6IHRoaXMuc2Vzc2lvblN0b3JlLnNpemUoKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZT8uc3RhcnRzV2l0aCgnL2FwaS8nKSAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVNpbXBsZUFQSVJlcXVlc3QocmVxLCByZXMsIHBhdGhuYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvYXBpL3Rvb2xzJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHsgdG9vbHM6IHRoaXMuZ2V0U2ltcGxpZmllZFRvb2xzTGlzdCgpIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDA0LCB7IGVycm9yOiAnTm90IGZvdW5kJyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0hUVFAgcmVxdWVzdCBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNTAwLCB7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTUNQUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgcmF3Qm9keSA9IGF3YWl0IHJlYWRSYXdCb2R5KHJlcSk7XG4gICAgICAgIGNvbnN0IHBhcnNlUmVzdWx0ID0gcGFyc2VKc29uUnBjQm9keShyYXdCb2R5KTtcblxuICAgICAgICBpZiAoIXBhcnNlUmVzdWx0Lm9rKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAwLCBwYXJzZVJlc3VsdC5yZXNwb25zZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb250ZXh0UmVzdWx0ID0gdGhpcy5idWlsZE1DUFJlcXVlc3RDb250ZXh0KHBhcnNlUmVzdWx0LnBheWxvYWQsIHJlcSk7XG4gICAgICAgIGlmICghY29udGV4dFJlc3VsdC5vaykge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIGNvbnRleHRSZXN1bHQuc3RhdHVzQ29kZSwgeyBlcnJvcjogY29udGV4dFJlc3VsdC5tZXNzYWdlIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF5bG9hZFJlc3VsdCA9IGF3YWl0IHRoaXMuaGFuZGxlSW5jb21pbmdQYXlsb2FkKHBhcnNlUmVzdWx0LnBheWxvYWQsIGNvbnRleHRSZXN1bHQuY29udGV4dCk7XG5cbiAgICAgICAgaWYgKHBheWxvYWRSZXN1bHQuc2Vzc2lvbklkVG9SZXR1cm4pIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ01DUC1TZXNzaW9uLUlkJywgcGF5bG9hZFJlc3VsdC5zZXNzaW9uSWRUb1JldHVybik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGF5bG9hZFJlc3VsdC5ib2R5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlcy53cml0ZUhlYWQocGF5bG9hZFJlc3VsdC5zdGF0dXNDb2RlKTtcbiAgICAgICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCBwYXlsb2FkUmVzdWx0LnN0YXR1c0NvZGUsIHBheWxvYWRSZXN1bHQuYm9keSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBidWlsZE1DUFJlcXVlc3RDb250ZXh0KFxuICAgICAgICBwYXlsb2FkOiB1bmtub3duLFxuICAgICAgICByZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlXG4gICAgKTpcbiAgICAgICAgfCB7IG9rOiB0cnVlOyBjb250ZXh0OiBNQ1BSZXF1ZXN0Q29udGV4dCB9XG4gICAgICAgIHwgeyBvazogZmFsc2U7IHN0YXR1c0NvZGU6IG51bWJlcjsgbWVzc2FnZTogc3RyaW5nIH0ge1xuICAgICAgICBjb25zdCBzZXNzaW9uSWQgPSB0aGlzLmdldFNlc3Npb25JZEZyb21IZWFkZXIocmVxKTtcblxuICAgICAgICBpZiAoIXRoaXMucGF5bG9hZFJlcXVpcmVzU2Vzc2lvbkhlYWRlcihwYXlsb2FkKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0OiB7XG4gICAgICAgICAgICAgICAgICAgIHNlc3Npb25JZDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbjogbnVsbFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNlc3Npb25JZCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdNQ1AtU2Vzc2lvbi1JZCBoZWFkZXIgaXMgcmVxdWlyZWQgZm9yIG5vbi1pbml0aWFsaXplIHJlcXVlc3RzLidcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uU3RvcmUuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSW52YWxpZCBNQ1AtU2Vzc2lvbi1JZDogJHtzZXNzaW9uSWR9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2Vzc2lvblN0b3JlLnRvdWNoKHNlc3Npb25JZCwgdGhpcy5ub3coKSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgICAgY29udGV4dDoge1xuICAgICAgICAgICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICBzZXNzaW9uXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwYXlsb2FkUmVxdWlyZXNTZXNzaW9uSGVhZGVyKHBheWxvYWQ6IHVua25vd24pOiBib29sZWFuIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGF5bG9hZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXlsb2FkLnNvbWUoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzUmVjb3JkKGl0ZW0pIHx8IHR5cGVvZiBpdGVtLm1ldGhvZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVxdWlyZXNTZXNzaW9uSGVhZGVyKGl0ZW0ubWV0aG9kKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1JlY29yZChwYXlsb2FkKSB8fCB0eXBlb2YgcGF5bG9hZC5tZXRob2QgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVxdWlyZXNTZXNzaW9uSGVhZGVyKHBheWxvYWQubWV0aG9kKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUluY29taW5nUGF5bG9hZChwYXlsb2FkOiB1bmtub3duLCBjb250ZXh0OiBNQ1BSZXF1ZXN0Q29udGV4dCk6IFByb21pc2U8UGF5bG9hZEhhbmRsZVJlc3VsdD4ge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXlsb2FkKSkge1xuICAgICAgICAgICAgaWYgKHBheWxvYWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ludmFsaWQgUmVxdWVzdDogYmF0Y2ggcmVxdWVzdCBjYW5ub3QgYmUgZW1wdHknXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZXM6IEpzb25ScGNSZXNwb25zZU1lc3NhZ2VbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHNlc3Npb25JZFRvUmV0dXJuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBwYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5oYW5kbGVJbmNvbWluZ01lc3NhZ2UoaXRlbSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zZXNzaW9uSWRUb1JldHVybiAmJiAhc2Vzc2lvbklkVG9SZXR1cm4pIHtcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkVG9SZXR1cm4gPSByZXN1bHQuc2Vzc2lvbklkVG9SZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQucmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VzLnB1c2gocmVzdWx0LnJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAyLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uSWRUb1JldHVyblxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgIGJvZHk6IHJlc3BvbnNlcyxcbiAgICAgICAgICAgICAgICBzZXNzaW9uSWRUb1JldHVyblxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuaGFuZGxlSW5jb21pbmdNZXNzYWdlKHBheWxvYWQsIGNvbnRleHQsIGZhbHNlKTtcblxuICAgICAgICBpZiAoIXJlc3VsdC5yZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDIsXG4gICAgICAgICAgICAgICAgc2Vzc2lvbklkVG9SZXR1cm46IHJlc3VsdC5zZXNzaW9uSWRUb1JldHVyblxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBib2R5OiByZXN1bHQucmVzcG9uc2UsXG4gICAgICAgICAgICBzZXNzaW9uSWRUb1JldHVybjogcmVzdWx0LnNlc3Npb25JZFRvUmV0dXJuXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVJbmNvbWluZ01lc3NhZ2UoXG4gICAgICAgIG1lc3NhZ2U6IHVua25vd24sXG4gICAgICAgIGNvbnRleHQ6IE1DUFJlcXVlc3RDb250ZXh0LFxuICAgICAgICBpc0JhdGNoOiBib29sZWFuXG4gICAgKTogUHJvbWlzZTxNZXNzYWdlSGFuZGxlUmVzdWx0PiB7XG4gICAgICAgIC8vIOWuouaIt+err+WPr+iDveS8muWPkemAgSByZXNwb25zZSDmtojmga/vvIjnlKjkuo7lk43lupQgc2VydmVyIHJlcXVlc3TvvInvvIzlvZPliY3mnI3liqHnq6/ml6DkuLvliqggcmVxdWVzdO+8jOebtOaOpeW/veeVpVxuICAgICAgICBpZiAoaXNSZXNwb25zZU1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSkgJiYgIWlzTm90aWZpY2F0aW9uTWVzc2FnZShtZXNzYWdlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByZXNwb25zZTogY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIFJlcXVlc3Q6IG1lc3NhZ2UgbXVzdCBiZSBhIHZhbGlkIEpTT04tUlBDIDIuMCByZXF1ZXN0IG9yIG5vdGlmaWNhdGlvbidcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWV0aG9kID0gbWVzc2FnZS5tZXRob2Q7XG4gICAgICAgIGNvbnN0IGlzTm90aWZpY2F0aW9uID0gaXNOb3RpZmljYXRpb25NZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBpc1JlcXVlc3RNZXNzYWdlKG1lc3NhZ2UpID8gbWVzc2FnZS5pZCA6IG51bGw7XG5cbiAgICAgICAgaWYgKGlzSW5pdGlhbGl6ZU1ldGhvZChtZXRob2QpKSB7XG4gICAgICAgICAgICBpZiAoaXNCYXRjaCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBpbml0aWFsaXplIG11c3QgYmUgc2VudCBhcyBhIHNpbmdsZSByZXF1ZXN0J1xuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFlbnN1cmVJbml0aWFsaXplSXNSZXF1ZXN0KG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBpbml0aWFsaXplIG11c3QgYmUgYSByZXF1ZXN0IHdpdGggaWQnXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWlzUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIFJlcXVlc3Q6IGluaXRpYWxpemUgbXVzdCBiZSBhIHJlcXVlc3Qgd2l0aCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjb250ZXh0LnNlc3Npb25JZCB8fCAhY29udGV4dC5zZXNzaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtaXNzaW5nIGFjdGl2ZSBzZXNzaW9uIGZvciB0aGlzIG1ldGhvZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSW5pdGlhbGl6ZWROb3RpZmljYXRpb24obWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIG11c3QgYmUgYSBub3RpZmljYXRpb24gd2l0aG91dCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2Vzc2lvblN0b3JlLm1hcmtSZWFkeShjb250ZXh0LnNlc3Npb25JZCwgdGhpcy5ub3coKSk7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5qCH5YeGIG5vdGlmaWNhdGlvbu+8muS4jeW6lOi/lOWbniBKU09OLVJQQyDlk43lupRcbiAgICAgICAgaWYgKGlzTm90aWZpY2F0aW9uICYmIGlzTm90aWZpY2F0aW9uTWV0aG9kKG1ldGhvZCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzU2Vzc2lvblJlYWR5KGNvbnRleHQuc2Vzc2lvbikgJiYgIWNhbkhhbmRsZUJlZm9yZVJlYWR5KG1ldGhvZCwgaXNOb3RpZmljYXRpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBzZXNzaW9uIGlzIG5vdCByZWFkeSwgc2VuZCBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIGZpcnN0J1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOb3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGF3YWl0IHRoaXMuaGFuZGxlUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSlcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogTWVzc2FnZUhhbmRsZVJlc3VsdCB7XG4gICAgICAgIGlmIChtZXNzYWdlLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmICFpc1JlY29yZChtZXNzYWdlLnBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlLmlkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIHBhcmFtczogaW5pdGlhbGl6ZSBwYXJhbXMgbXVzdCBiZSBhbiBvYmplY3Qgd2hlbiBwcm92aWRlZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5zZXNzaW9uSWRHZW5lcmF0b3IoKTtcbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUuY3JlYXRlU2Vzc2lvbihzZXNzaW9uSWQsIHRoaXMubm93KCkpO1xuXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlID0ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogJzIwMjUtMTEtMjUnLFxuICAgICAgICAgICAgICAgIGNhcGFiaWxpdGllczoge1xuICAgICAgICAgICAgICAgICAgICB0b29sczoge31cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNlcnZlckluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uOiAnMS40LjAnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZSxcbiAgICAgICAgICAgIHNlc3Npb25JZFRvUmV0dXJuOiBzZXNzaW9uSWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlcXVlc3RNZXNzYWdlKG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogUHJvbWlzZTxKc29uUnBjUmVzcG9uc2VNZXNzYWdlPiB7XG4gICAgICAgIGNvbnN0IHsgaWQsIG1ldGhvZCB9ID0gbWVzc2FnZTtcblxuICAgICAgICBzd2l0Y2ggKG1ldGhvZCkge1xuICAgICAgICAgICAgY2FzZSBNQ1BfTUVUSE9EUy5Ub29sc0xpc3Q6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IHsgdG9vbHM6IHRoaXMuZ2V0QXZhaWxhYmxlVG9vbHMoKSB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgTUNQX01FVEhPRFMuVG9vbHNDYWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVRvb2xzQ2FsbFJlcXVlc3QobWVzc2FnZSk7XG4gICAgICAgICAgICBjYXNlIE1DUF9NRVRIT0RTLlBpbmc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IHt9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5NZXRob2ROb3RGb3VuZCxcbiAgICAgICAgICAgICAgICAgICAgYE1ldGhvZCBub3QgZm91bmQ6ICR7bWV0aG9kfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVUb29sc0NhbGxSZXF1ZXN0KG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogUHJvbWlzZTxKc29uUnBjUmVzcG9uc2VNZXNzYWdlPiB7XG4gICAgICAgIGNvbnN0IHsgaWQsIHBhcmFtcyB9ID0gbWVzc2FnZTtcblxuICAgICAgICBpZiAoIWlzUmVjb3JkKHBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFyYW1zIGZvciB0b29scy9jYWxsOiBwYXJhbXMgbXVzdCBiZSBhbiBvYmplY3QnXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcmFtcy5uYW1lO1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnIHx8ICFuYW1lLnRyaW0oKSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFBhcmFtcyxcbiAgICAgICAgICAgICAgICAnSW52YWxpZCBwYXJhbXMgZm9yIHRvb2xzL2NhbGw6IFwibmFtZVwiIGlzIHJlcXVpcmVkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBwYXJhbXMuYXJndW1lbnRzID8/IHt9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0b29sUmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlVG9vbENhbGwobmFtZSwgYXJncyk7XG4gICAgICAgICAgICBjb25zdCBpc0J1c2luZXNzRXJyb3IgPSB0aGlzLmlzVG9vbEJ1c2luZXNzRXJyb3IodG9vbFJlc3VsdCk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgcmVzdWx0OiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IFt7IHR5cGU6ICd0ZXh0JywgdGV4dDogdGhpcy5zdHJpbmdpZnlUb29sUmVzdWx0KHRvb2xSZXN1bHQpIH1dLFxuICAgICAgICAgICAgICAgICAgICAuLi4oaXNCdXNpbmVzc0Vycm9yID8geyBpc0Vycm9yOiB0cnVlIH0gOiB7fSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlVGV4dCA9IFN0cmluZyhlcnJvcj8ubWVzc2FnZSA/PyBlcnJvcik7XG4gICAgICAgICAgICBpZiAoL25vdCBmb3VuZC9pLnRlc3QobWVzc2FnZVRleHQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlVGV4dFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludGVybmFsRXJyb3IsXG4gICAgICAgICAgICAgICAgbWVzc2FnZVRleHRcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGlzVG9vbEJ1c2luZXNzRXJyb3IodG9vbFJlc3VsdDogdW5rbm93bik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIWlzUmVjb3JkKHRvb2xSZXN1bHQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9vbFJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHRvb2xSZXN1bHQuZXJyb3IgPT09ICdzdHJpbmcnICYmIHRvb2xSZXN1bHQuZXJyb3IubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdHJpbmdpZnlUb29sUmVzdWx0KHRvb2xSZXN1bHQ6IHVua25vd24pOiBzdHJpbmcge1xuICAgICAgICBpZiAodHlwZW9mIHRvb2xSZXN1bHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9vbFJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzZXJpYWxpemVkID0gSlNPTi5zdHJpbmdpZnkodG9vbFJlc3VsdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNlcmlhbGl6ZWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHRvb2xSZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh0b29sUmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTUNQR2V0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBhY2NlcHQgPSAocmVxLmhlYWRlcnMuYWNjZXB0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCB3YW50c1NzZSA9IGFjY2VwdC5pbmNsdWRlcygndGV4dC9ldmVudC1zdHJlYW0nKTtcblxuICAgICAgICBpZiAoIXdhbnRzU3NlKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgMjAwLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogJzIwMjUtMTEtMjUnLFxuICAgICAgICAgICAgICAgIHRyYW5zcG9ydDogJ3N0cmVhbWFibGUtaHR0cCcsXG4gICAgICAgICAgICAgICAgZW5kcG9pbnQ6ICcvbWNwJyxcbiAgICAgICAgICAgICAgICBzdXBwb3J0czoge1xuICAgICAgICAgICAgICAgICAgICBwb3N0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzc2U6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXEpO1xuICAgICAgICBpZiAoIXNlc3Npb25JZCkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgIGVycm9yOiAnTUNQLVNlc3Npb24tSWQgaGVhZGVyIGlzIHJlcXVpcmVkIGZvciBTU0Ugc3RyZWFtLidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvblN0b3JlLmdldFNlc3Npb24oc2Vzc2lvbklkKTtcbiAgICAgICAgaWYgKCFzZXNzaW9uKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAwLCB7XG4gICAgICAgICAgICAgICAgZXJyb3I6IGBJbnZhbGlkIE1DUC1TZXNzaW9uLUlkOiAke3Nlc3Npb25JZH1gXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNTZXNzaW9uUmVhZHkoc2Vzc2lvbikpIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDksIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogJ1Nlc3Npb24gaXMgbm90IHJlYWR5LiBTZW5kIG5vdGlmaWNhdGlvbnMvaW5pdGlhbGl6ZWQgYmVmb3JlIG9wZW5pbmcgU1NFIHN0cmVhbS4nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2Vzc2lvblN0b3JlLnRvdWNoKHNlc3Npb25JZCwgdGhpcy5ub3coKSk7XG4gICAgICAgIHRoaXMuc3RyZWFtYWJsZUh0dHAub3BlblNzZVN0cmVhbShzZXNzaW9uSWQsIHJlcSwgcmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIEhUVFAgc2VydmVyIHN0b3BwZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RyZWFtYWJsZUh0dHAuZGlzcG9zZSgpO1xuICAgICAgICB0aGlzLnNlc3Npb25TdG9yZS5jbGVhcigpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTdGF0dXMoKTogU2VydmVyU3RhdHVzIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJ1bm5pbmc6ICEhdGhpcy5odHRwU2VydmVyLFxuICAgICAgICAgICAgcG9ydDogdGhpcy5zZXR0aW5ncy5wb3J0LFxuICAgICAgICAgICAgY2xpZW50czogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVTaW1wbGVBUElSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgcGF0aG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRXh0cmFjdCB0b29sIG5hbWUgZnJvbSBwYXRoIGxpa2UgL2FwaS9ub2RlL3NldF9wb3NpdGlvblxuICAgICAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gcGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIocCA9PiBwKTtcbiAgICAgICAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdJbnZhbGlkIEFQSSBwYXRoLiBVc2UgL2FwaS97Y2F0ZWdvcnl9L3t0b29sX25hbWV9J1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXRoUGFydHNbMV07XG4gICAgICAgICAgICBjb25zdCB0b29sTmFtZSA9IHBhdGhQYXJ0c1syXTtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxUb29sTmFtZSA9IGAke2NhdGVnb3J5fV8ke3Rvb2xOYW1lfWA7XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtZXRlcnMgd2l0aCBlbmhhbmNlZCBlcnJvciBoYW5kbGluZ1xuICAgICAgICAgICAgbGV0IHBhcmFtcztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJzZUpzb25Cb2R5KGJvZHksIHtcbiAgICAgICAgICAgICAgICAgICAgYWxsb3dFbXB0eTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcm91dGVOYW1lOiAnU2ltcGxlQVBJJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0ludmFsaWQgSlNPTiBpbiByZXF1ZXN0IGJvZHknLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBwYXJzZUVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHJlY2VpdmVkQm9keTogYm9keS5zdWJzdHJpbmcoMCwgMjAwKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXhlY3V0ZSB0b29sXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVUb29sQ2FsbChmdWxsVG9vbE5hbWUsIHBhcmFtcyk7XG5cbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHRvb2w6IGZ1bGxUb29sTmFtZSxcbiAgICAgICAgICAgICAgICByZXN1bHRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NpbXBsZSBBUEkgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDUwMCwge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIHRvb2w6IHBhdGhuYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2ltcGxpZmllZFRvb2xzTGlzdCgpOiBhbnlbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5tYXAodG9vbCA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHRvb2wubmFtZS5zcGxpdCgnXycpO1xuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXJ0c1swXTtcbiAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignXycpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICBhcGlQYXRoOiBgL2FwaS8ke2NhdGVnb3J5fS8ke3Rvb2xOYW1lfWAsXG4gICAgICAgICAgICAgICAgY3VybEV4YW1wbGU6IHRoaXMuZ2VuZXJhdGVDdXJsRXhhbXBsZShjYXRlZ29yeSwgdG9vbE5hbWUsIHRvb2wuaW5wdXRTY2hlbWEpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybEV4YW1wbGUoY2F0ZWdvcnk6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgc2NoZW1hOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICAvLyBHZW5lcmF0ZSBzYW1wbGUgcGFyYW1ldGVycyBiYXNlZCBvbiBzY2hlbWFcbiAgICAgICAgY29uc3Qgc2FtcGxlUGFyYW1zID0gdGhpcy5nZW5lcmF0ZVNhbXBsZVBhcmFtcyhzY2hlbWEpO1xuICAgICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoc2FtcGxlUGFyYW1zLCBudWxsLCAyKTtcblxuICAgICAgICByZXR1cm4gYGN1cmwgLVggUE9TVCBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fS9hcGkvJHtjYXRlZ29yeX0vJHt0b29sTmFtZX0gXFxcXFxcbiAgLUggXCJDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cIiBcXFxcXFxuICAtZCAnJHtqc29uU3RyaW5nfSdgO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVTYW1wbGVQYXJhbXMoc2NoZW1hOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAoIXNjaGVtYSB8fCAhc2NoZW1hLnByb3BlcnRpZXMpIHJldHVybiB7fTtcblxuICAgICAgICBjb25zdCBzYW1wbGU6IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHByb3BdIG9mIE9iamVjdC5lbnRyaWVzKHNjaGVtYS5wcm9wZXJ0aWVzIGFzIGFueSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BTY2hlbWEgPSBwcm9wIGFzIGFueTtcbiAgICAgICAgICAgIHN3aXRjaCAocHJvcFNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgJ2V4YW1wbGVfc3RyaW5nJztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgNDI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSAnZXhhbXBsZV92YWx1ZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNhbXBsZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBhcnNlSnNvbkJvZHkoXG4gICAgICAgIHJhd0JvZHk6IHN0cmluZyxcbiAgICAgICAgb3B0aW9uczogeyBhbGxvd0VtcHR5OiBib29sZWFuOyByb3V0ZU5hbWU6IHN0cmluZyB9XG4gICAgKTogYW55IHtcbiAgICAgICAgY29uc3QgYm9keSA9IHJhd0JvZHkudHJpbSgpO1xuXG4gICAgICAgIGlmICghYm9keSkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxsb3dFbXB0eSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtvcHRpb25zLnJvdXRlTmFtZX0gcmVxdWVzdCBib2R5IGlzIGVtcHR5YCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJHtvcHRpb25zLnJvdXRlTmFtZX0gSlNPTiBwYXJzZSBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX0uIGAgK1xuICAgICAgICAgICAgICAgICfor7fnoa7kv53or7fmsYLkvZPmmK/lkIjms5UgSlNPTu+8m+W/heimgeaXtuWPr+WFiOiwg+eUqCB2YWxpZGF0aW9uX3ZhbGlkYXRlX2pzb25fcGFyYW1zIOi/m+ihjOajgOafpeOAgidcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlU2V0dGluZ3Moc2V0dGluZ3M6IE1DUFNlcnZlclNldHRpbmdzKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB2b2lkIHRoaXMuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IHJhd0hlYWRlciA9IHJlcS5oZWFkZXJzWydtY3Atc2Vzc2lvbi1pZCddO1xuICAgICAgICBpZiAoIXJhd0hlYWRlcikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyYXdIZWFkZXIpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmF3SGVhZGVyWzBdIHx8IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmF3SGVhZGVyO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNPcmlnaW5BbGxvd2VkKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgYWxsb3dlZE9yaWdpbnMgPSB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zICYmIHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zXG4gICAgICAgICAgICA6IFsnKiddO1xuICAgICAgICBjb25zdCByZXF1ZXN0T3JpZ2luID0gcmVxLmhlYWRlcnMub3JpZ2luO1xuXG4gICAgICAgIGlmICghcmVxdWVzdE9yaWdpbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWxsb3dlZE9yaWdpbnMuaW5jbHVkZXMoJyonKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWxsb3dlZE9yaWdpbnMuaW5jbHVkZXMocmVxdWVzdE9yaWdpbik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhcHBseUNvcnNIZWFkZXJzKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBhbGxvd2VkT3JpZ2lucyA9IHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMgJiYgdGhpcy5zZXR0aW5ncy5hbGxvd2VkT3JpZ2lucy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/IHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnNcbiAgICAgICAgICAgIDogWycqJ107XG4gICAgICAgIGNvbnN0IHJlcXVlc3RPcmlnaW4gPSByZXEuaGVhZGVycy5vcmlnaW47XG5cbiAgICAgICAgaWYgKGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKCcqJykpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3RPcmlnaW4gPT09ICdzdHJpbmcnICYmIGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKHJlcXVlc3RPcmlnaW4pKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCByZXF1ZXN0T3JpZ2luKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1ZhcnknLCAnT3JpZ2luJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDmnKrmkLrluKYgT3JpZ2luIOaXtu+8jOWFgeiuuOmmluS4queZveWQjeWNleadpea6kOeUqOS6jumdnua1j+iniOWZqOWuouaIt+err1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCBhbGxvd2VkT3JpZ2luc1swXSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZUpzb25SZXNwb25zZShyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHN0YXR1c0NvZGU6IG51bWJlciwgcGF5bG9hZDogdW5rbm93bik6IHZvaWQge1xuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHN0YXR1c0NvZGU7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xuICAgIH1cbn1cblxuLy8gSFRUUCB0cmFuc3BvcnQgZG9lc24ndCBuZWVkIHBlcnNpc3RlbnQgY2xpZW50IHNvY2tldCBiZXlvbmQgU1NFIHN0cmVhbXNcbiJdfQ==