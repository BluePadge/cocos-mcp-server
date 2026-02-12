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
const v2_tool_service_1 = require("./mcp/v2-tool-service");
class MCPServer {
    constructor(settings, dependencies = {}) {
        var _a, _b;
        this.httpServer = null;
        this.tools = {};
        this.toolsList = [];
        this.enabledTools = []; // 存储启用的工具列表
        this.sessionStore = new session_store_1.SessionStore();
        this.streamableHttp = new streamable_http_1.StreamableHttpManager();
        this.v2ToolService = null;
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
        this.v2ToolService = new v2_tool_service_1.V2ToolService(this.toolsList, this.executeToolCall.bind(this), {
            version: '2.0.0',
            now: this.now
        });
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
    getV2ToolService() {
        if (!this.v2ToolService) {
            this.setupTools();
        }
        if (!this.v2ToolService) {
            throw new Error('V2 tool service is not initialized');
        }
        return this.v2ToolService;
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
        const { id, method } = message;
        const v2ToolService = this.getV2ToolService();
        switch (method) {
            case lifecycle_1.MCP_METHODS.ToolsList:
                return {
                    jsonrpc: '2.0',
                    id,
                    result: { tools: v2ToolService.listTools() }
                };
            case lifecycle_1.MCP_METHODS.ToolsCall:
                return this.handleToolsCallRequest(message);
            case lifecycle_1.MCP_METHODS.GetToolManifest:
                return this.handleGetToolManifestRequest(message);
            case lifecycle_1.MCP_METHODS.GetTraceById:
                return this.handleGetTraceByIdRequest(message);
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
        var _a;
        const { id, params } = message;
        const v2ToolService = this.getV2ToolService();
        if (!(0, messages_1.isRecord)(params)) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for tools/call: params must be an object');
        }
        const name = params.name;
        if (typeof name !== 'string' || !name.trim()) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for tools/call: "name" is required');
        }
        const args = (0, messages_1.isRecord)(params.arguments) ? params.arguments : {};
        if (!v2ToolService.hasTool(name)) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, `Unknown tool: ${name}`);
        }
        try {
            const toolResult = await v2ToolService.callTool(name, args);
            return {
                jsonrpc: '2.0',
                id,
                result: Object.assign({ content: [{ type: 'text', text: toolResult.contentText }], structuredContent: toolResult.structuredContent }, (toolResult.isError ? { isError: true } : {}))
            };
        }
        catch (error) {
            const messageText = String((_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : error);
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InternalError, messageText);
        }
    }
    handleGetToolManifestRequest(message) {
        const { id, params } = message;
        if (!(0, messages_1.isRecord)(params)) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for get_tool_manifest: params must be an object');
        }
        const name = params.name;
        if (typeof name !== 'string' || !name.trim()) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for get_tool_manifest: "name" is required');
        }
        const manifest = this.getV2ToolService().getManifest(name);
        if (!manifest) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, `Unknown tool: ${name}`);
        }
        return {
            jsonrpc: '2.0',
            id,
            result: manifest
        };
    }
    handleGetTraceByIdRequest(message) {
        const { id, params } = message;
        if (!(0, messages_1.isRecord)(params)) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for get_trace_by_id: params must be an object');
        }
        const traceId = params.traceId;
        if (typeof traceId !== 'string' || !traceId.trim()) {
            return (0, errors_1.createJsonRpcErrorResponse)(id, errors_1.JsonRpcErrorCode.InvalidParams, 'Invalid params for get_trace_by_id: "traceId" is required');
        }
        return {
            jsonrpc: '2.0',
            id,
            result: {
                trace: this.getV2ToolService().getTraceById(traceId)
            }
        };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUE2QjtBQUM3QixtQ0FBb0M7QUFFcEMscURBQWlEO0FBQ2pELG1EQUErQztBQUMvQyw2REFBeUQ7QUFDekQsdURBQW1EO0FBQ25ELHlEQUFxRDtBQUNyRCxxREFBaUQ7QUFDakQsaUVBQTZEO0FBQzdELHVEQUFtRDtBQUNuRCw2REFBeUQ7QUFDekQsdUVBQWtFO0FBQ2xFLCtEQUEwRDtBQUMxRCx5RUFBb0U7QUFDcEUsdUVBQWtFO0FBQ2xFLCtEQUEyRDtBQUMzRCx5Q0FBNEU7QUFDNUUsMkNBQThEO0FBQzlELDZDQU93QjtBQUN4QiwrQ0FTeUI7QUFDekIsdURBQStEO0FBQy9ELDJEQUE4RDtBQUM5RCwyREFBc0Q7QUF1QnRELE1BQWEsU0FBUztJQVlsQixZQUFZLFFBQTJCLEVBQUUsZUFBc0MsRUFBRTs7UUFWekUsZUFBVSxHQUF1QixJQUFJLENBQUM7UUFDdEMsVUFBSyxHQUFxQyxFQUFFLENBQUM7UUFDN0MsY0FBUyxHQUFxQixFQUFFLENBQUM7UUFDakMsaUJBQVksR0FBVSxFQUFFLENBQUMsQ0FBQyxZQUFZO1FBQzdCLGlCQUFZLEdBQUcsSUFBSSw0QkFBWSxFQUFFLENBQUM7UUFDbEMsbUJBQWMsR0FBRyxJQUFJLHVDQUFxQixFQUFFLENBQUM7UUFDdEQsa0JBQWEsR0FBeUIsSUFBSSxDQUFDO1FBSy9DLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxNQUFBLFlBQVksQ0FBQyxrQkFBa0IsbUNBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFBLG1CQUFVLEdBQUUsQ0FBQyxDQUFDO1FBQ2xGLElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBQSxZQUFZLENBQUMs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LElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYztZQUM5QixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNaLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBRXpDLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQy9CLEdBQUcsQ0FBQyxTQUFTLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDbEQsT0FBTztRQUNYLENBQUM7UUFFRCxJQUFJLE9BQU8sYUFBYSxLQUFLLFFBQVEsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDOUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyw2QkFBNkIsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUM1RCxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNoQyxPQUFPO1FBQ1gsQ0FBQztRQUVELGtDQUFrQztRQUNsQyxHQUFHLENBQUMsU0FBUyxDQUFDLDZCQUE2QixFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxHQUF3QixFQUFFLFVBQWtCLEVBQUUsT0FBZ0I7UUFDcEYsR0FBRyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDNUIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxDQUFDO0NBQ0o7QUExM0JELDhCQTAzQkM7QUFFRCwwRUFBMEUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBNQ1BTZXJ2ZXJTZXR0aW5ncywgU2VydmVyU3RhdHVzLCBNQ1BDbGllbnQsIFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBTY2VuZVRvb2xzIH0gZnJvbSAnLi90b29scy9zY2VuZS10b29scyc7XG5pbXBvcnQgeyBOb2RlVG9vbHMgfSBmcm9tICcuL3Rvb2xzL25vZGUtdG9vbHMnO1xuaW1wb3J0IHsgQ29tcG9uZW50VG9vbHMgfSBmcm9tICcuL3Rvb2xzL2NvbXBvbmVudC10b29scyc7XG5pbXBvcnQgeyBQcmVmYWJUb29scyB9IGZyb20gJy4vdG9vbHMvcHJlZmFiLXRvb2xzJztcbmltcG9ydCB7IFByb2plY3RUb29scyB9IGZyb20gJy4vdG9vbHMvcHJvamVjdC10b29scyc7XG5pbXBvcnQgeyBEZWJ1Z1Rvb2xzIH0gZnJvbSAnLi90b29scy9kZWJ1Zy10b29scyc7XG5pbXBvcnQgeyBQcmVmZXJlbmNlc1Rvb2xzIH0gZnJvbSAnLi90b29scy9wcmVmZXJlbmNlcy10b29scyc7XG5pbXBvcnQgeyBTZXJ2ZXJUb29scyB9IGZyb20gJy4vdG9vbHMvc2VydmVyLXRvb2xzJztcbmltcG9ydCB7IEJyb2FkY2FzdFRvb2xzIH0gZnJvbSAnLi90b29scy9icm9hZGNhc3QtdG9vbHMnO1xuaW1wb3J0IHsgU2NlbmVBZHZhbmNlZFRvb2xzIH0gZnJvbSAnLi90b29scy9zY2VuZS1hZHZhbmNlZC10b29scyc7XG5pbXBvcnQgeyBTY2VuZVZpZXdUb29scyB9IGZyb20gJy4vdG9vbHMvc2NlbmUtdmlldy10b29scyc7XG5pbXBvcnQgeyBSZWZlcmVuY2VJbWFnZVRvb2xzIH0gZnJvbSAnLi90b29scy9yZWZlcmVuY2UtaW1hZ2UtdG9vbHMnO1xuaW1wb3J0IHsgQXNzZXRBZHZhbmNlZFRvb2xzIH0gZnJvbSAnLi90b29scy9hc3NldC1hZHZhbmNlZC10b29scyc7XG5pbXBvcnQgeyBWYWxpZGF0aW9uVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3ZhbGlkYXRpb24tdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UsIEpzb25ScGNFcnJvckNvZGUgfSBmcm9tICcuL21jcC9lcnJvcnMnO1xuaW1wb3J0IHsgcGFyc2VKc29uUnBjQm9keSwgcmVhZFJhd0JvZHkgfSBmcm9tICcuL21jcC9qc29ucnBjJztcbmltcG9ydCB7XG4gICAgSnNvblJwY1JlcXVlc3QsXG4gICAgSnNvblJwY1Jlc3BvbnNlTWVzc2FnZSxcbiAgICBpc05vdGlmaWNhdGlvbk1lc3NhZ2UsXG4gICAgaXNSZWNvcmQsXG4gICAgaXNSZXF1ZXN0TWVzc2FnZSxcbiAgICBpc1Jlc3BvbnNlTWVzc2FnZVxufSBmcm9tICcuL21jcC9tZXNzYWdlcyc7XG5pbXBvcnQge1xuICAgIE1DUF9NRVRIT0RTLFxuICAgIGNhbkhhbmRsZUJlZm9yZVJlYWR5LFxuICAgIGVuc3VyZUluaXRpYWxpemVJc1JlcXVlc3QsXG4gICAgaXNJbml0aWFsaXplTWV0aG9kLFxuICAgIGlzSW5pdGlhbGl6ZWROb3RpZmljYXRpb24sXG4gICAgaXNOb3RpZmljYXRpb25NZXRob2QsXG4gICAgaXNTZXNzaW9uUmVhZHksXG4gICAgcmVxdWlyZXNTZXNzaW9uSGVhZGVyXG59IGZyb20gJy4vbWNwL2xpZmVjeWNsZSc7XG5pbXBvcnQgeyBNY3BTZXNzaW9uLCBTZXNzaW9uU3RvcmUgfSBmcm9tICcuL21jcC9zZXNzaW9uLXN0b3JlJztcbmltcG9ydCB7IFN0cmVhbWFibGVIdHRwTWFuYWdlciB9IGZyb20gJy4vbWNwL3N0cmVhbWFibGUtaHR0cCc7XG5pbXBvcnQgeyBWMlRvb2xTZXJ2aWNlIH0gZnJvbSAnLi9tY3AvdjItdG9vbC1zZXJ2aWNlJztcblxuaW50ZXJmYWNlIFRvb2xFeGVjdXRvckxpa2Uge1xuICAgIGdldFRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW107XG4gICAgZXhlY3V0ZSh0b29sTmFtZTogc3RyaW5nLCBhcmdzOiBhbnkpOiBQcm9taXNlPGFueT47XG59XG5cbmludGVyZmFjZSBNQ1BTZXJ2ZXJEZXBlbmRlbmNpZXMge1xuICAgIHRvb2xFeGVjdXRvcnM/OiBSZWNvcmQ8c3RyaW5nLCBUb29sRXhlY3V0b3JMaWtlPjtcbiAgICBzZXNzaW9uSWRHZW5lcmF0b3I/OiAoKSA9PiBzdHJpbmc7XG4gICAgbm93PzogKCkgPT4gbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgTUNQUmVxdWVzdENvbnRleHQge1xuICAgIHNlc3Npb25JZDogc3RyaW5nIHwgbnVsbDtcbiAgICBzZXNzaW9uOiBNY3BTZXNzaW9uIHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIE1lc3NhZ2VIYW5kbGVSZXN1bHQge1xuICAgIHJlc3BvbnNlOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlIHwgbnVsbDtcbiAgICBzZXNzaW9uSWRUb1JldHVybj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1DUFNlcnZlciB7XG4gICAgcHJpdmF0ZSBzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3M7XG4gICAgcHJpdmF0ZSBodHRwU2VydmVyOiBodHRwLlNlcnZlciB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgdG9vbHM6IFJlY29yZDxzdHJpbmcsIFRvb2xFeGVjdXRvckxpa2U+ID0ge307XG4gICAgcHJpdmF0ZSB0b29sc0xpc3Q6IFRvb2xEZWZpbml0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGVuYWJsZWRUb29sczogYW55W10gPSBbXTsgLy8g5a2Y5YKo5ZCv55So55qE5bel5YW35YiX6KGoXG4gICAgcHJpdmF0ZSByZWFkb25seSBzZXNzaW9uU3RvcmUgPSBuZXcgU2Vzc2lvblN0b3JlKCk7XG4gICAgcHJpdmF0ZSByZWFkb25seSBzdHJlYW1hYmxlSHR0cCA9IG5ldyBTdHJlYW1hYmxlSHR0cE1hbmFnZXIoKTtcbiAgICBwcml2YXRlIHYyVG9vbFNlcnZpY2U6IFYyVG9vbFNlcnZpY2UgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25JZEdlbmVyYXRvcjogKCkgPT4gc3RyaW5nO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgbm93OiAoKSA9PiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3MsIGRlcGVuZGVuY2llczogTUNQU2VydmVyRGVwZW5kZW5jaWVzID0ge30pIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgICAgICB0aGlzLnNlc3Npb25JZEdlbmVyYXRvciA9IGRlcGVuZGVuY2llcy5zZXNzaW9uSWRHZW5lcmF0b3IgPz8gKCgpID0+IHJhbmRvbVVVSUQoKSk7XG4gICAgICAgIHRoaXMubm93ID0gZGVwZW5kZW5jaWVzLm5vdyA/PyAoKCkgPT4gRGF0ZS5ub3coKSk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVRvb2xzKGRlcGVuZGVuY2llcy50b29sRXhlY3V0b3JzKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGluaXRpYWxpemVUb29scyhjdXN0b21Ub29scz86IFJlY29yZDxzdHJpbmcsIFRvb2xFeGVjdXRvckxpa2U+KTogdm9pZCB7XG4gICAgICAgIGlmIChjdXN0b21Ub29scykge1xuICAgICAgICAgICAgdGhpcy50b29scyA9IGN1c3RvbVRvb2xzO1xuICAgICAgICAgICAgdGhpcy5zZXR1cFRvb2xzKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0g5L2/55So5rOo5YWl5bel5YW35omn6KGM5Zmo5Yid5aeL5YyW5a6M5oiQJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIEluaXRpYWxpemluZyB0b29scy4uLicpO1xuICAgICAgICAgICAgdGhpcy50b29scy5zY2VuZSA9IG5ldyBTY2VuZVRvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLm5vZGUgPSBuZXcgTm9kZVRvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLmNvbXBvbmVudCA9IG5ldyBDb21wb25lbnRUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5wcmVmYWIgPSBuZXcgUHJlZmFiVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMucHJvamVjdCA9IG5ldyBQcm9qZWN0VG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuZGVidWcgPSBuZXcgRGVidWdUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5wcmVmZXJlbmNlcyA9IG5ldyBQcmVmZXJlbmNlc1Rvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnNlcnZlciA9IG5ldyBTZXJ2ZXJUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5icm9hZGNhc3QgPSBuZXcgQnJvYWRjYXN0VG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuc2NlbmVBZHZhbmNlZCA9IG5ldyBTY2VuZUFkdmFuY2VkVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuc2NlbmVWaWV3ID0gbmV3IFNjZW5lVmlld1Rvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnJlZmVyZW5jZUltYWdlID0gbmV3IFJlZmVyZW5jZUltYWdlVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuYXNzZXRBZHZhbmNlZCA9IG5ldyBBc3NldEFkdmFuY2VkVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMudmFsaWRhdGlvbiA9IG5ldyBWYWxpZGF0aW9uVG9vbHMoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSBUb29scyBpbml0aWFsaXplZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIEVycm9yIGluaXRpYWxpemluZyB0b29sczonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIFNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gU3RhcnRpbmcgSFRUUCBzZXJ2ZXIgb24gcG9ydCAke3RoaXMuc2V0dGluZ3MucG9ydH0uLi5gKTtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMuaGFuZGxlSHR0cFJlcXVlc3QuYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIubWF4Q29ubmVjdGlvbnMgPSB0aGlzLnNldHRpbmdzLm1heENvbm5lY3Rpb25zO1xuXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyIS5saXN0ZW4odGhpcy5zZXR0aW5ncy5wb3J0LCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0g4pyFIEhUVFAgc2VydmVyIHN0YXJ0ZWQgc3VjY2Vzc2Z1bGx5IG9uIGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9YCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBIZWFsdGggY2hlY2s6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L2hlYWx0aGApO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gTUNQIGVuZHBvaW50OiBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fS9tY3BgKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciEub24oJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIOKdjCBGYWlsZWQgdG8gc3RhcnQgc2VydmVyOicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTUNQU2VydmVyXSBQb3J0ICR7dGhpcy5zZXR0aW5ncy5wb3J0fSBpcyBhbHJlYWR5IGluIHVzZS4gUGxlYXNlIGNoYW5nZSB0aGUgcG9ydCBpbiBzZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnNldHVwVG9vbHMoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSDwn5qAIE1DUCBTZXJ2ZXIgaXMgcmVhZHkgZm9yIGNvbm5lY3Rpb25zJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTUNQU2VydmVyXSDinYwgRmFpbGVkIHRvIHN0YXJ0IHNlcnZlcjonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0dXBUb29scygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy50b29sc0xpc3QgPSBbXTtcblxuICAgICAgICAvLyDlpoLmnpzmsqHmnInlkK/nlKjlt6XlhbfphY3nva7vvIzov5Tlm57miYDmnInlt6XlhbdcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWRUb29scyB8fCB0aGlzLmVuYWJsZWRUb29scy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2NhdGVnb3J5LCB0b29sU2V0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLnRvb2xzKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xzID0gdG9vbFNldC5nZXRUb29scygpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbCBvZiB0b29scykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2xzTGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGAke2NhdGVnb3J5fV8ke3Rvb2wubmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYTogdG9vbC5pbnB1dFNjaGVtYVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyDmoLnmja7lkK/nlKjnmoTlt6XlhbfphY3nva7ov4fmu6RcbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZWRUb29sTmFtZXMgPSBuZXcgU2V0KHRoaXMuZW5hYmxlZFRvb2xzLm1hcCh0b29sID0+IGAke3Rvb2wuY2F0ZWdvcnl9XyR7dG9vbC5uYW1lfWApKTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCBbY2F0ZWdvcnksIHRvb2xTZXRdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMudG9vbHMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbHMgPSB0b29sU2V0LmdldFRvb2xzKCk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lID0gYCR7Y2F0ZWdvcnl9XyR7dG9vbC5uYW1lfWA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlbmFibGVkVG9vbE5hbWVzLmhhcyh0b29sTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHNMaXN0LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRvb2xOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB0b29sLmlucHV0U2NoZW1hXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBTZXR1cCB0b29sczogJHt0aGlzLnRvb2xzTGlzdC5sZW5ndGh9IHRvb2xzIGF2YWlsYWJsZWApO1xuICAgICAgICB0aGlzLnYyVG9vbFNlcnZpY2UgPSBuZXcgVjJUb29sU2VydmljZShcbiAgICAgICAgICAgIHRoaXMudG9vbHNMaXN0LFxuICAgICAgICAgICAgdGhpcy5leGVjdXRlVG9vbENhbGwuYmluZCh0aGlzKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiAnMi4wLjAnLFxuICAgICAgICAgICAgICAgIG5vdzogdGhpcy5ub3dcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0RmlsdGVyZWRUb29scyhlbmFibGVkVG9vbHM6IGFueVtdKTogVG9vbERlZmluaXRpb25bXSB7XG4gICAgICAgIGlmICghZW5hYmxlZFRvb2xzIHx8IGVuYWJsZWRUb29scy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdDsgLy8g5aaC5p6c5rKh5pyJ6L+H5ruk6YWN572u77yM6L+U5Zue5omA5pyJ5bel5YW3XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBlbmFibGVkVG9vbE5hbWVzID0gbmV3IFNldChlbmFibGVkVG9vbHMubWFwKHRvb2wgPT4gYCR7dG9vbC5jYXRlZ29yeX1fJHt0b29sLm5hbWV9YCkpO1xuICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3QuZmlsdGVyKHRvb2wgPT4gZW5hYmxlZFRvb2xOYW1lcy5oYXModG9vbC5uYW1lKSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGV4ZWN1dGVUb29sQ2FsbCh0b29sTmFtZTogc3RyaW5nLCBhcmdzOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCBwYXJ0cyA9IHRvb2xOYW1lLnNwbGl0KCdfJyk7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gcGFydHNbMF07XG4gICAgICAgIGNvbnN0IHRvb2xNZXRob2ROYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignXycpO1xuXG4gICAgICAgIGlmICh0aGlzLnRvb2xzW2NhdGVnb3J5XSkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMudG9vbHNbY2F0ZWdvcnldLmV4ZWN1dGUodG9vbE1ldGhvZE5hbWUsIGFyZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUb29sICR7dG9vbE5hbWV9IG5vdCBmb3VuZGApO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRDbGllbnRzKCk6IE1DUENsaWVudFtdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Vzc2lvblN0b3JlLmxpc3RTZXNzaW9ucygpLm1hcCgoc2Vzc2lvbikgPT4gKHtcbiAgICAgICAgICAgIGlkOiBzZXNzaW9uLmlkLFxuICAgICAgICAgICAgbGFzdEFjdGl2aXR5OiBuZXcgRGF0ZShzZXNzaW9uLmxhc3RBY3Rpdml0eUF0KVxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEF2YWlsYWJsZVRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3Q7XG4gICAgfVxuXG4gICAgcHVibGljIHVwZGF0ZUVuYWJsZWRUb29scyhlbmFibGVkVG9vbHM6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBVcGRhdGluZyBlbmFibGVkIHRvb2xzOiAke2VuYWJsZWRUb29scy5sZW5ndGh9IHRvb2xzYCk7XG4gICAgICAgIHRoaXMuZW5hYmxlZFRvb2xzID0gZW5hYmxlZFRvb2xzO1xuICAgICAgICB0aGlzLnNldHVwVG9vbHMoKTsgLy8g6YeN5paw6K6+572u5bel5YW35YiX6KGoXG4gICAgfVxuXG4gICAgcHVibGljIGdldFNldHRpbmdzKCk6IE1DUFNlcnZlclNldHRpbmdzIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0dGluZ3M7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRWMlRvb2xTZXJ2aWNlKCk6IFYyVG9vbFNlcnZpY2Uge1xuICAgICAgICBpZiAoIXRoaXMudjJUb29sU2VydmljZSkge1xuICAgICAgICAgICAgdGhpcy5zZXR1cFRvb2xzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMudjJUb29sU2VydmljZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWMiB0b29sIHNlcnZpY2UgaXMgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy52MlRvb2xTZXJ2aWNlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSHR0cFJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RVcmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCAnaHR0cDovLzEyNy4wLjAuMScpO1xuICAgICAgICBjb25zdCBwYXRobmFtZSA9IHJlcXVlc3RVcmwucGF0aG5hbWU7XG5cbiAgICAgICAgLy8g5YWI5qCh6aqMIE9yaWdpbu+8jOacqumAmui/h+aXtuebtOaOpeaLkue7neivt+axglxuICAgICAgICBpZiAoIXRoaXMuaXNPcmlnaW5BbGxvd2VkKHJlcSkpIHtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAzLCB7IGVycm9yOiAnRm9yYmlkZGVuIG9yaWdpbicgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgQ09SUyBoZWFkZXJzXG4gICAgICAgIHRoaXMuYXBwbHlDb3JzSGVhZGVycyhyZXEsIHJlcyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VULCBQT1NULCBERUxFVEUsIE9QVElPTlMnKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24sIEFjY2VwdCwgTUNQLVNlc3Npb24tSWQnKTtcblxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwNCk7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHBhdGhuYW1lID09PSAnL21jcCcgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVNQ1BSZXF1ZXN0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTUNQR2V0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnREVMRVRFJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTUNQRGVsZXRlKHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvaGVhbHRoJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb2snLFxuICAgICAgICAgICAgICAgICAgICB0b29sczogdGhpcy50b29sc0xpc3QubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uczogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGhuYW1lPy5zdGFydHNXaXRoKCcvYXBpLycpICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlU2ltcGxlQVBJUmVxdWVzdChyZXEsIHJlcywgcGF0aG5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZSA9PT0gJy9hcGkvdG9vbHMnICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDIwMCwgeyB0b29sczogdGhpcy5nZXRTaW1wbGlmaWVkVG9vbHNMaXN0KCkgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDQsIHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignSFRUUCByZXF1ZXN0IGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA1MDAsIHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVNQ1BSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcbiAgICAgICAgY29uc3QgcGFyc2VSZXN1bHQgPSBwYXJzZUpzb25ScGNCb2R5KHJhd0JvZHkpO1xuXG4gICAgICAgIGlmICghcGFyc2VSZXN1bHQub2spIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHBhcnNlUmVzdWx0LnJlc3BvbnNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1DUCAyMDI1LTExLTI177yaUE9TVCAvbWNwIOS7heaUr+aMgeWNlea2iOaBr++8jOS4jeaUr+aMgSBiYXRjaOOAglxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZVJlc3VsdC5wYXlsb2FkKSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShcbiAgICAgICAgICAgICAgICByZXMsXG4gICAgICAgICAgICAgICAgMjAwLFxuICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBiYXRjaCBpcyBub3Qgc3VwcG9ydGVkIG9uIFBPU1QgL21jcCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGV4dFJlc3VsdCA9IHRoaXMuYnVpbGRNQ1BSZXF1ZXN0Q29udGV4dChwYXJzZVJlc3VsdC5wYXlsb2FkLCByZXEpO1xuICAgICAgICBpZiAoIWNvbnRleHRSZXN1bHQub2spIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCBjb250ZXh0UmVzdWx0LnN0YXR1c0NvZGUsIHsgZXJyb3I6IGNvbnRleHRSZXN1bHQubWVzc2FnZSB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VSZXN1bHQgPSBhd2FpdCB0aGlzLmhhbmRsZUluY29taW5nTWVzc2FnZShwYXJzZVJlc3VsdC5wYXlsb2FkLCBjb250ZXh0UmVzdWx0LmNvbnRleHQpO1xuXG4gICAgICAgIGlmIChtZXNzYWdlUmVzdWx0LnNlc3Npb25JZFRvUmV0dXJuKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdNQ1AtU2Vzc2lvbi1JZCcsIG1lc3NhZ2VSZXN1bHQuc2Vzc2lvbklkVG9SZXR1cm4pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtZXNzYWdlUmVzdWx0LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMik7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgMjAwLCBtZXNzYWdlUmVzdWx0LnJlc3BvbnNlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkTUNQUmVxdWVzdENvbnRleHQoXG4gICAgICAgIHBheWxvYWQ6IHVua25vd24sXG4gICAgICAgIHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2VcbiAgICApOlxuICAgICAgICB8IHsgb2s6IHRydWU7IGNvbnRleHQ6IE1DUFJlcXVlc3RDb250ZXh0IH1cbiAgICAgICAgfCB7IG9rOiBmYWxzZTsgc3RhdHVzQ29kZTogbnVtYmVyOyBtZXNzYWdlOiBzdHJpbmcgfSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXEpO1xuXG4gICAgICAgIGlmICghdGhpcy5wYXlsb2FkUmVxdWlyZXNTZXNzaW9uSGVhZGVyKHBheWxvYWQpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbnRleHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uOiBudWxsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ01DUC1TZXNzaW9uLUlkIGhlYWRlciBpcyByZXF1aXJlZCBmb3Igbm9uLWluaXRpYWxpemUgcmVxdWVzdHMuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25TdG9yZS5nZXRTZXNzaW9uKHNlc3Npb25JZCk7XG4gICAgICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBJbnZhbGlkIE1DUC1TZXNzaW9uLUlkOiAke3Nlc3Npb25JZH1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUudG91Y2goc2Vzc2lvbklkLCB0aGlzLm5vdygpKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IHRydWUsXG4gICAgICAgICAgICBjb250ZXh0OiB7XG4gICAgICAgICAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgIHNlc3Npb25cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBheWxvYWRSZXF1aXJlc1Nlc3Npb25IZWFkZXIocGF5bG9hZDogdW5rbm93bik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIWlzUmVjb3JkKHBheWxvYWQpIHx8IHR5cGVvZiBwYXlsb2FkLm1ldGhvZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXF1aXJlc1Nlc3Npb25IZWFkZXIocGF5bG9hZC5tZXRob2QpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW5jb21pbmdNZXNzYWdlKFxuICAgICAgICBtZXNzYWdlOiB1bmtub3duLFxuICAgICAgICBjb250ZXh0OiBNQ1BSZXF1ZXN0Q29udGV4dFxuICAgICk6IFByb21pc2U8TWVzc2FnZUhhbmRsZVJlc3VsdD4ge1xuICAgICAgICAvLyDlrqLmiLfnq6/lj6/og73kvJrlj5HpgIEgcmVzcG9uc2Ug5raI5oGv77yI55So5LqO5ZON5bqUIHNlcnZlciByZXF1ZXN077yJ77yM5b2T5YmN5pyN5Yqh56uv5peg5Li75YqoIHJlcXVlc3TvvIznm7TmjqXlv73nlaVcbiAgICAgICAgaWYgKGlzUmVzcG9uc2VNZXNzYWdlKG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1JlcXVlc3RNZXNzYWdlKG1lc3NhZ2UpICYmICFpc05vdGlmaWNhdGlvbk1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtZXNzYWdlIG11c3QgYmUgYSB2YWxpZCBKU09OLVJQQyAyLjAgcmVxdWVzdCBvciBub3RpZmljYXRpb24nXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IG1lc3NhZ2UubWV0aG9kO1xuICAgICAgICBjb25zdCBpc05vdGlmaWNhdGlvbiA9IGlzTm90aWZpY2F0aW9uTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgY29uc3QgcmVxdWVzdElkID0gaXNSZXF1ZXN0TWVzc2FnZShtZXNzYWdlKSA/IG1lc3NhZ2UuaWQgOiBudWxsO1xuXG4gICAgICAgIGlmIChpc0luaXRpYWxpemVNZXRob2QobWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFlbnN1cmVJbml0aWFsaXplSXNSZXF1ZXN0KG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBpbml0aWFsaXplIG11c3QgYmUgYSByZXF1ZXN0IHdpdGggaWQnXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWlzUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIFJlcXVlc3Q6IGluaXRpYWxpemUgbXVzdCBiZSBhIHJlcXVlc3Qgd2l0aCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjb250ZXh0LnNlc3Npb25JZCB8fCAhY29udGV4dC5zZXNzaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBtaXNzaW5nIGFjdGl2ZSBzZXNzaW9uIGZvciB0aGlzIG1ldGhvZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSW5pdGlhbGl6ZWROb3RpZmljYXRpb24obWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKCFpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIG11c3QgYmUgYSBub3RpZmljYXRpb24gd2l0aG91dCBpZCdcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2Vzc2lvblN0b3JlLm1hcmtSZWFkeShjb250ZXh0LnNlc3Npb25JZCwgdGhpcy5ub3coKSk7XG4gICAgICAgICAgICByZXR1cm4geyByZXNwb25zZTogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5qCH5YeGIG5vdGlmaWNhdGlvbu+8muS4jeW6lOi/lOWbniBKU09OLVJQQyDlk43lupRcbiAgICAgICAgaWYgKGlzTm90aWZpY2F0aW9uICYmIGlzTm90aWZpY2F0aW9uTWV0aG9kKG1ldGhvZCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzU2Vzc2lvblJlYWR5KGNvbnRleHQuc2Vzc2lvbikgJiYgIWNhbkhhbmRsZUJlZm9yZVJlYWR5KG1ldGhvZCwgaXNOb3RpZmljYXRpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiBzZXNzaW9uIGlzIG5vdCByZWFkeSwgc2VuZCBub3RpZmljYXRpb25zL2luaXRpYWxpemVkIGZpcnN0J1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOb3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGF3YWl0IHRoaXMuaGFuZGxlUmVxdWVzdE1lc3NhZ2UobWVzc2FnZSlcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUluaXRpYWxpemVSZXF1ZXN0KG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogTWVzc2FnZUhhbmRsZVJlc3VsdCB7XG4gICAgICAgIGlmIChtZXNzYWdlLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmICFpc1JlY29yZChtZXNzYWdlLnBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlLmlkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICdJbnZhbGlkIHBhcmFtczogaW5pdGlhbGl6ZSBwYXJhbXMgbXVzdCBiZSBhbiBvYmplY3Qgd2hlbiBwcm92aWRlZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5zZXNzaW9uSWRHZW5lcmF0b3IoKTtcbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUuY3JlYXRlU2Vzc2lvbihzZXNzaW9uSWQsIHRoaXMubm93KCkpO1xuXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlID0ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogJzIwMjUtMTEtMjUnLFxuICAgICAgICAgICAgICAgIGNhcGFiaWxpdGllczoge1xuICAgICAgICAgICAgICAgICAgICB0b29sczoge31cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNlcnZlckluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uOiAnMS40LjAnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZSxcbiAgICAgICAgICAgIHNlc3Npb25JZFRvUmV0dXJuOiBzZXNzaW9uSWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlcXVlc3RNZXNzYWdlKG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogUHJvbWlzZTxKc29uUnBjUmVzcG9uc2VNZXNzYWdlPiB7XG4gICAgICAgIGNvbnN0IHsgaWQsIG1ldGhvZCB9ID0gbWVzc2FnZTtcbiAgICAgICAgY29uc3QgdjJUb29sU2VydmljZSA9IHRoaXMuZ2V0VjJUb29sU2VydmljZSgpO1xuXG4gICAgICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICAgICAgICBjYXNlIE1DUF9NRVRIT0RTLlRvb2xzTGlzdDpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDogeyB0b29sczogdjJUb29sU2VydmljZS5saXN0VG9vbHMoKSB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgTUNQX01FVEhPRFMuVG9vbHNDYWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVRvb2xzQ2FsbFJlcXVlc3QobWVzc2FnZSk7XG4gICAgICAgICAgICBjYXNlIE1DUF9NRVRIT0RTLkdldFRvb2xNYW5pZmVzdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVHZXRUb29sTWFuaWZlc3RSZXF1ZXN0KG1lc3NhZ2UpO1xuICAgICAgICAgICAgY2FzZSBNQ1BfTUVUSE9EUy5HZXRUcmFjZUJ5SWQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlR2V0VHJhY2VCeUlkUmVxdWVzdChtZXNzYWdlKTtcbiAgICAgICAgICAgIGNhc2UgTUNQX01FVEhPRFMuUGluZzpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDoge31cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLk1ldGhvZE5vdEZvdW5kLFxuICAgICAgICAgICAgICAgICAgICBgTWV0aG9kIG5vdCBmb3VuZDogJHttZXRob2R9YFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVRvb2xzQ2FsbFJlcXVlc3QobWVzc2FnZTogSnNvblJwY1JlcXVlc3QpOiBQcm9taXNlPEpzb25ScGNSZXNwb25zZU1lc3NhZ2U+IHtcbiAgICAgICAgY29uc3QgeyBpZCwgcGFyYW1zIH0gPSBtZXNzYWdlO1xuICAgICAgICBjb25zdCB2MlRvb2xTZXJ2aWNlID0gdGhpcy5nZXRWMlRvb2xTZXJ2aWNlKCk7XG5cbiAgICAgICAgaWYgKCFpc1JlY29yZChwYXJhbXMpKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUGFyYW1zLFxuICAgICAgICAgICAgICAgICdJbnZhbGlkIHBhcmFtcyBmb3IgdG9vbHMvY2FsbDogcGFyYW1zIG11c3QgYmUgYW4gb2JqZWN0J1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXJhbXMubmFtZTtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJyB8fCAhbmFtZS50cmltKCkpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFyYW1zIGZvciB0b29scy9jYWxsOiBcIm5hbWVcIiBpcyByZXF1aXJlZCdcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcmdzID0gaXNSZWNvcmQocGFyYW1zLmFyZ3VtZW50cykgPyBwYXJhbXMuYXJndW1lbnRzIDoge307XG5cbiAgICAgICAgaWYgKCF2MlRvb2xTZXJ2aWNlLmhhc1Rvb2wobmFtZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgYFVua25vd24gdG9vbDogJHtuYW1lfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdG9vbFJlc3VsdCA9IGF3YWl0IHYyVG9vbFNlcnZpY2UuY2FsbFRvb2wobmFtZSwgYXJncyk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgcmVzdWx0OiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IFt7IHR5cGU6ICd0ZXh0JywgdGV4dDogdG9vbFJlc3VsdC5jb250ZW50VGV4dCB9XSxcbiAgICAgICAgICAgICAgICAgICAgc3RydWN0dXJlZENvbnRlbnQ6IHRvb2xSZXN1bHQuc3RydWN0dXJlZENvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIC4uLih0b29sUmVzdWx0LmlzRXJyb3IgPyB7IGlzRXJyb3I6IHRydWUgfSA6IHt9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VUZXh0ID0gU3RyaW5nKGVycm9yPy5tZXNzYWdlID8/IGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludGVybmFsRXJyb3IsXG4gICAgICAgICAgICAgICAgbWVzc2FnZVRleHRcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUdldFRvb2xNYW5pZmVzdFJlcXVlc3QobWVzc2FnZTogSnNvblJwY1JlcXVlc3QpOiBKc29uUnBjUmVzcG9uc2VNZXNzYWdlIHtcbiAgICAgICAgY29uc3QgeyBpZCwgcGFyYW1zIH0gPSBtZXNzYWdlO1xuXG4gICAgICAgIGlmICghaXNSZWNvcmQocGFyYW1zKSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFBhcmFtcyxcbiAgICAgICAgICAgICAgICAnSW52YWxpZCBwYXJhbXMgZm9yIGdldF90b29sX21hbmlmZXN0OiBwYXJhbXMgbXVzdCBiZSBhbiBvYmplY3QnXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcmFtcy5uYW1lO1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnIHx8ICFuYW1lLnRyaW0oKSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgIEpzb25ScGNFcnJvckNvZGUuSW52YWxpZFBhcmFtcyxcbiAgICAgICAgICAgICAgICAnSW52YWxpZCBwYXJhbXMgZm9yIGdldF90b29sX21hbmlmZXN0OiBcIm5hbWVcIiBpcyByZXF1aXJlZCdcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYW5pZmVzdCA9IHRoaXMuZ2V0VjJUb29sU2VydmljZSgpLmdldE1hbmlmZXN0KG5hbWUpO1xuICAgICAgICBpZiAoIW1hbmlmZXN0KSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUGFyYW1zLFxuICAgICAgICAgICAgICAgIGBVbmtub3duIHRvb2w6ICR7bmFtZX1gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICByZXN1bHQ6IG1hbmlmZXN0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVHZXRUcmFjZUJ5SWRSZXF1ZXN0KG1lc3NhZ2U6IEpzb25ScGNSZXF1ZXN0KTogSnNvblJwY1Jlc3BvbnNlTWVzc2FnZSB7XG4gICAgICAgIGNvbnN0IHsgaWQsIHBhcmFtcyB9ID0gbWVzc2FnZTtcblxuICAgICAgICBpZiAoIWlzUmVjb3JkKHBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVKc29uUnBjRXJyb3JSZXNwb25zZShcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLkludmFsaWRQYXJhbXMsXG4gICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFyYW1zIGZvciBnZXRfdHJhY2VfYnlfaWQ6IHBhcmFtcyBtdXN0IGJlIGFuIG9iamVjdCdcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0cmFjZUlkID0gcGFyYW1zLnRyYWNlSWQ7XG4gICAgICAgIGlmICh0eXBlb2YgdHJhY2VJZCAhPT0gJ3N0cmluZycgfHwgIXRyYWNlSWQudHJpbSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUGFyYW1zLFxuICAgICAgICAgICAgICAgICdJbnZhbGlkIHBhcmFtcyBmb3IgZ2V0X3RyYWNlX2J5X2lkOiBcInRyYWNlSWRcIiBpcyByZXF1aXJlZCdcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgIHRyYWNlOiB0aGlzLmdldFYyVG9vbFNlcnZpY2UoKS5nZXRUcmFjZUJ5SWQodHJhY2VJZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZU1DUEdldChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYWNjZXB0ID0gKHJlcS5oZWFkZXJzLmFjY2VwdCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgd2FudHNTc2UgPSBhY2NlcHQuaW5jbHVkZXMoJ3RleHQvZXZlbnQtc3RyZWFtJyk7XG5cbiAgICAgICAgaWYgKCF3YW50c1NzZSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDIwMCwge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbFZlcnNpb246ICcyMDI1LTExLTI1JyxcbiAgICAgICAgICAgICAgICB0cmFuc3BvcnQ6ICdzdHJlYW1hYmxlLWh0dHAnLFxuICAgICAgICAgICAgICAgIGVuZHBvaW50OiAnL21jcCcsXG4gICAgICAgICAgICAgICAgc3VwcG9ydHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcG9zdFNpbmdsZU1lc3NhZ2VPbmx5OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzc2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdGhpcy5nZXRTZXNzaW9uSWRGcm9tSGVhZGVyKHJlcSk7XG4gICAgICAgIGlmICghc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlSnNvblJlc3BvbnNlKHJlcywgNDAwLCB7XG4gICAgICAgICAgICAgICAgZXJyb3I6ICdNQ1AtU2Vzc2lvbi1JZCBoZWFkZXIgaXMgcmVxdWlyZWQgZm9yIFNTRSBzdHJlYW0uJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uU3RvcmUuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogYEludmFsaWQgTUNQLVNlc3Npb24tSWQ6ICR7c2Vzc2lvbklkfWBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1Nlc3Npb25SZWFkeShzZXNzaW9uKSkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwOSwge1xuICAgICAgICAgICAgICAgIGVycm9yOiAnU2Vzc2lvbiBpcyBub3QgcmVhZHkuIFNlbmQgbm90aWZpY2F0aW9ucy9pbml0aWFsaXplZCBiZWZvcmUgb3BlbmluZyBTU0Ugc3RyZWFtLidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXNzaW9uU3RvcmUudG91Y2goc2Vzc2lvbklkLCB0aGlzLm5vdygpKTtcbiAgICAgICAgdGhpcy5zdHJlYW1hYmxlSHR0cC5vcGVuU3NlU3RyZWFtKHNlc3Npb25JZCwgcmVxLCByZXMpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTUNQRGVsZXRlKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBzZXNzaW9uSWQgPSB0aGlzLmdldFNlc3Npb25JZEZyb21IZWFkZXIocmVxKTtcbiAgICAgICAgaWYgKCFzZXNzaW9uSWQpIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICBlcnJvcjogJ01DUC1TZXNzaW9uLUlkIGhlYWRlciBpcyByZXF1aXJlZCBmb3IgREVMRVRFIC9tY3AuJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZW1vdmVkID0gdGhpcy5zZXNzaW9uU3RvcmUucmVtb3ZlU2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICB0aGlzLnN0cmVhbWFibGVIdHRwLmNsb3NlU2Vzc2lvbihzZXNzaW9uSWQpO1xuXG4gICAgICAgIGlmICghcmVtb3ZlZCkge1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgIGVycm9yOiBgSW52YWxpZCBNQ1AtU2Vzc2lvbi1JZDogJHtzZXNzaW9uSWR9YFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXMud3JpdGVIZWFkKDIwNCk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIEhUVFAgc2VydmVyIHN0b3BwZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RyZWFtYWJsZUh0dHAuZGlzcG9zZSgpO1xuICAgICAgICB0aGlzLnNlc3Npb25TdG9yZS5jbGVhcigpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTdGF0dXMoKTogU2VydmVyU3RhdHVzIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJ1bm5pbmc6ICEhdGhpcy5odHRwU2VydmVyLFxuICAgICAgICAgICAgcG9ydDogdGhpcy5zZXR0aW5ncy5wb3J0LFxuICAgICAgICAgICAgY2xpZW50czogdGhpcy5zZXNzaW9uU3RvcmUuc2l6ZSgpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVTaW1wbGVBUElSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgcGF0aG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRXh0cmFjdCB0b29sIG5hbWUgZnJvbSBwYXRoIGxpa2UgL2FwaS9ub2RlL3NldF9wb3NpdGlvblxuICAgICAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gcGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIocCA9PiBwKTtcbiAgICAgICAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCA0MDAsIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdJbnZhbGlkIEFQSSBwYXRoLiBVc2UgL2FwaS97Y2F0ZWdvcnl9L3t0b29sX25hbWV9J1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXRoUGFydHNbMV07XG4gICAgICAgICAgICBjb25zdCB0b29sTmFtZSA9IHBhdGhQYXJ0c1syXTtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxUb29sTmFtZSA9IGAke2NhdGVnb3J5fV8ke3Rvb2xOYW1lfWA7XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtZXRlcnMgd2l0aCBlbmhhbmNlZCBlcnJvciBoYW5kbGluZ1xuICAgICAgICAgICAgbGV0IHBhcmFtcztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJzZUpzb25Cb2R5KGJvZHksIHtcbiAgICAgICAgICAgICAgICAgICAgYWxsb3dFbXB0eTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcm91dGVOYW1lOiAnU2ltcGxlQVBJJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDQwMCwge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0ludmFsaWQgSlNPTiBpbiByZXF1ZXN0IGJvZHknLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBwYXJzZUVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHJlY2VpdmVkQm9keTogYm9keS5zdWJzdHJpbmcoMCwgMjAwKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXhlY3V0ZSB0b29sXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVUb29sQ2FsbChmdWxsVG9vbE5hbWUsIHBhcmFtcyk7XG5cbiAgICAgICAgICAgIHRoaXMud3JpdGVKc29uUmVzcG9uc2UocmVzLCAyMDAsIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHRvb2w6IGZ1bGxUb29sTmFtZSxcbiAgICAgICAgICAgICAgICByZXN1bHRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NpbXBsZSBBUEkgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy53cml0ZUpzb25SZXNwb25zZShyZXMsIDUwMCwge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIHRvb2w6IHBhdGhuYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2ltcGxpZmllZFRvb2xzTGlzdCgpOiBhbnlbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5tYXAodG9vbCA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHRvb2wubmFtZS5zcGxpdCgnXycpO1xuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXJ0c1swXTtcbiAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignXycpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICBhcGlQYXRoOiBgL2FwaS8ke2NhdGVnb3J5fS8ke3Rvb2xOYW1lfWAsXG4gICAgICAgICAgICAgICAgY3VybEV4YW1wbGU6IHRoaXMuZ2VuZXJhdGVDdXJsRXhhbXBsZShjYXRlZ29yeSwgdG9vbE5hbWUsIHRvb2wuaW5wdXRTY2hlbWEpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybEV4YW1wbGUoY2F0ZWdvcnk6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgc2NoZW1hOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICAvLyBHZW5lcmF0ZSBzYW1wbGUgcGFyYW1ldGVycyBiYXNlZCBvbiBzY2hlbWFcbiAgICAgICAgY29uc3Qgc2FtcGxlUGFyYW1zID0gdGhpcy5nZW5lcmF0ZVNhbXBsZVBhcmFtcyhzY2hlbWEpO1xuICAgICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoc2FtcGxlUGFyYW1zLCBudWxsLCAyKTtcblxuICAgICAgICByZXR1cm4gYGN1cmwgLVggUE9TVCBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fS9hcGkvJHtjYXRlZ29yeX0vJHt0b29sTmFtZX0gXFxcXFxcbiAgLUggXCJDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cIiBcXFxcXFxuICAtZCAnJHtqc29uU3RyaW5nfSdgO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVTYW1wbGVQYXJhbXMoc2NoZW1hOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAoIXNjaGVtYSB8fCAhc2NoZW1hLnByb3BlcnRpZXMpIHJldHVybiB7fTtcblxuICAgICAgICBjb25zdCBzYW1wbGU6IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHByb3BdIG9mIE9iamVjdC5lbnRyaWVzKHNjaGVtYS5wcm9wZXJ0aWVzIGFzIGFueSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BTY2hlbWEgPSBwcm9wIGFzIGFueTtcbiAgICAgICAgICAgIHN3aXRjaCAocHJvcFNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgJ2V4YW1wbGVfc3RyaW5nJztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgNDI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSAnZXhhbXBsZV92YWx1ZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNhbXBsZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBhcnNlSnNvbkJvZHkoXG4gICAgICAgIHJhd0JvZHk6IHN0cmluZyxcbiAgICAgICAgb3B0aW9uczogeyBhbGxvd0VtcHR5OiBib29sZWFuOyByb3V0ZU5hbWU6IHN0cmluZyB9XG4gICAgKTogYW55IHtcbiAgICAgICAgY29uc3QgYm9keSA9IHJhd0JvZHkudHJpbSgpO1xuXG4gICAgICAgIGlmICghYm9keSkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxsb3dFbXB0eSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtvcHRpb25zLnJvdXRlTmFtZX0gcmVxdWVzdCBib2R5IGlzIGVtcHR5YCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJHtvcHRpb25zLnJvdXRlTmFtZX0gSlNPTiBwYXJzZSBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX0uIGAgK1xuICAgICAgICAgICAgICAgICfor7fnoa7kv53or7fmsYLkvZPmmK/lkIjms5UgSlNPTu+8m+W/heimgeaXtuWPr+WFiOiwg+eUqCB2YWxpZGF0aW9uX3ZhbGlkYXRlX2pzb25fcGFyYW1zIOi/m+ihjOajgOafpeOAgidcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlU2V0dGluZ3Moc2V0dGluZ3M6IE1DUFNlcnZlclNldHRpbmdzKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB2b2lkIHRoaXMuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2Vzc2lvbklkRnJvbUhlYWRlcihyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IHJhd0hlYWRlciA9IHJlcS5oZWFkZXJzWydtY3Atc2Vzc2lvbi1pZCddO1xuICAgICAgICBpZiAoIXJhd0hlYWRlcikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyYXdIZWFkZXIpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmF3SGVhZGVyWzBdIHx8IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmF3SGVhZGVyO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNPcmlnaW5BbGxvd2VkKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgYWxsb3dlZE9yaWdpbnMgPSB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zICYmIHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zXG4gICAgICAgICAgICA6IFsnKiddO1xuICAgICAgICBjb25zdCByZXF1ZXN0T3JpZ2luID0gcmVxLmhlYWRlcnMub3JpZ2luO1xuXG4gICAgICAgIGlmICghcmVxdWVzdE9yaWdpbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWxsb3dlZE9yaWdpbnMuaW5jbHVkZXMoJyonKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWxsb3dlZE9yaWdpbnMuaW5jbHVkZXMocmVxdWVzdE9yaWdpbik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhcHBseUNvcnNIZWFkZXJzKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBhbGxvd2VkT3JpZ2lucyA9IHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnMgJiYgdGhpcy5zZXR0aW5ncy5hbGxvd2VkT3JpZ2lucy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/IHRoaXMuc2V0dGluZ3MuYWxsb3dlZE9yaWdpbnNcbiAgICAgICAgICAgIDogWycqJ107XG4gICAgICAgIGNvbnN0IHJlcXVlc3RPcmlnaW4gPSByZXEuaGVhZGVycy5vcmlnaW47XG5cbiAgICAgICAgaWYgKGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKCcqJykpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3RPcmlnaW4gPT09ICdzdHJpbmcnICYmIGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKHJlcXVlc3RPcmlnaW4pKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCByZXF1ZXN0T3JpZ2luKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1ZhcnknLCAnT3JpZ2luJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDmnKrmkLrluKYgT3JpZ2luIOaXtu+8jOWFgeiuuOmmluS4queZveWQjeWNleadpea6kOeUqOS6jumdnua1j+iniOWZqOWuouaIt+err1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCBhbGxvd2VkT3JpZ2luc1swXSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZUpzb25SZXNwb25zZShyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHN0YXR1c0NvZGU6IG51bWJlciwgcGF5bG9hZDogdW5rbm93bik6IHZvaWQge1xuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHN0YXR1c0NvZGU7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xuICAgIH1cbn1cblxuLy8gSFRUUCB0cmFuc3BvcnQgZG9lc24ndCBuZWVkIHBlcnNpc3RlbnQgY2xpZW50IHNvY2tldCBiZXlvbmQgU1NFIHN0cmVhbXNcbiJdfQ==