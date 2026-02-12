import * as http from 'http';
import { randomUUID } from 'crypto';
import { MCPServerSettings, ServerStatus, MCPClient, ToolDefinition } from './types';
import { SceneTools } from './tools/scene-tools';
import { NodeTools } from './tools/node-tools';
import { ComponentTools } from './tools/component-tools';
import { PrefabTools } from './tools/prefab-tools';
import { ProjectTools } from './tools/project-tools';
import { DebugTools } from './tools/debug-tools';
import { PreferencesTools } from './tools/preferences-tools';
import { ServerTools } from './tools/server-tools';
import { BroadcastTools } from './tools/broadcast-tools';
import { SceneAdvancedTools } from './tools/scene-advanced-tools';
import { SceneViewTools } from './tools/scene-view-tools';
import { ReferenceImageTools } from './tools/reference-image-tools';
import { AssetAdvancedTools } from './tools/asset-advanced-tools';
import { ValidationTools } from './tools/validation-tools';
import { createJsonRpcErrorResponse, JsonRpcErrorCode } from './mcp/errors';
import { parseJsonRpcBody, readRawBody } from './mcp/jsonrpc';
import {
    JsonRpcNotification,
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

interface ToolExecutorLike {
    getTools(): ToolDefinition[];
    execute(toolName: string, args: any): Promise<any>;
}

interface MCPServerDependencies {
    toolExecutors?: Record<string, ToolExecutorLike>;
    sessionIdGenerator?: () => string;
    now?: () => number;
}

interface MCPRequestContext {
    sessionId: string | null;
    session: McpSession | null;
}

interface MessageHandleResult {
    response: JsonRpcResponseMessage | null;
    sessionIdToReturn?: string;
}

interface PayloadHandleResult {
    statusCode: number;
    body?: unknown;
    sessionIdToReturn?: string;
}

export class MCPServer {
    private settings: MCPServerSettings;
    private httpServer: http.Server | null = null;
    private tools: Record<string, ToolExecutorLike> = {};
    private toolsList: ToolDefinition[] = [];
    private enabledTools: any[] = []; // 存储启用的工具列表
    private readonly sessionStore = new SessionStore();
    private readonly streamableHttp = new StreamableHttpManager();
    private readonly sessionIdGenerator: () => string;
    private readonly now: () => number;

    constructor(settings: MCPServerSettings, dependencies: MCPServerDependencies = {}) {
        this.settings = settings;
        this.sessionIdGenerator = dependencies.sessionIdGenerator ?? (() => randomUUID());
        this.now = dependencies.now ?? (() => Date.now());
        this.initializeTools(dependencies.toolExecutors);
    }

    private initializeTools(customTools?: Record<string, ToolExecutorLike>): void {
        if (customTools) {
            this.tools = customTools;
            this.setupTools();
            console.log('[MCPServer] 使用注入工具执行器初始化完成');
            return;
        }

        try {
            console.log('[MCPServer] Initializing tools...');
            this.tools.scene = new SceneTools();
            this.tools.node = new NodeTools();
            this.tools.component = new ComponentTools();
            this.tools.prefab = new PrefabTools();
            this.tools.project = new ProjectTools();
            this.tools.debug = new DebugTools();
            this.tools.preferences = new PreferencesTools();
            this.tools.server = new ServerTools();
            this.tools.broadcast = new BroadcastTools();
            this.tools.sceneAdvanced = new SceneAdvancedTools();
            this.tools.sceneView = new SceneViewTools();
            this.tools.referenceImage = new ReferenceImageTools();
            this.tools.assetAdvanced = new AssetAdvancedTools();
            this.tools.validation = new ValidationTools();
            console.log('[MCPServer] Tools initialized successfully');
        } catch (error) {
            console.error('[MCPServer] Error initializing tools:', error);
            throw error;
        }
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

            this.setupTools();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        } catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }

    private setupTools(): void {
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
        } else {
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

    public getFilteredTools(enabledTools: any[]): ToolDefinition[] {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList; // 如果没有过滤配置，返回所有工具
        }

        const enabledToolNames = new Set(enabledTools.map(tool => `${tool.category}_${tool.name}`));
        return this.toolsList.filter(tool => enabledToolNames.has(tool.name));
    }

    public async executeToolCall(toolName: string, args: any): Promise<any> {
        const parts = toolName.split('_');
        const category = parts[0];
        const toolMethodName = parts.slice(1).join('_');

        if (this.tools[category]) {
            return await this.tools[category].execute(toolMethodName, args);
        }

        throw new Error(`Tool ${toolName} not found`);
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

    public updateEnabledTools(enabledTools: any[]): void {
        console.log(`[MCPServer] Updating enabled tools: ${enabledTools.length} tools`);
        this.enabledTools = enabledTools;
        this.setupTools(); // 重新设置工具列表
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
            } else if (pathname === '/mcp' && req.method === 'GET') {
                this.handleMCPGet(req, res);
            } else if (pathname === '/health' && req.method === 'GET') {
                this.writeJsonResponse(res, 200, {
                    status: 'ok',
                    tools: this.toolsList.length,
                    sessions: this.sessionStore.size()
                });
            } else if (pathname?.startsWith('/api/') && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            } else if (pathname === '/api/tools' && req.method === 'GET') {
                this.writeJsonResponse(res, 200, { tools: this.getSimplifiedToolsList() });
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
        if (Array.isArray(payload)) {
            return payload.some((item) => {
                if (!isRecord(item) || typeof item.method !== 'string') {
                    return false;
                }
                return requiresSessionHeader(item.method);
            });
        }

        if (!isRecord(payload) || typeof payload.method !== 'string') {
            return false;
        }

        return requiresSessionHeader(payload.method);
    }

    private async handleIncomingPayload(payload: unknown, context: MCPRequestContext): Promise<PayloadHandleResult> {
        if (Array.isArray(payload)) {
            if (payload.length === 0) {
                return {
                    statusCode: 200,
                    body: createJsonRpcErrorResponse(
                        null,
                        JsonRpcErrorCode.InvalidRequest,
                        'Invalid Request: batch request cannot be empty'
                    )
                };
            }

            const responses: JsonRpcResponseMessage[] = [];
            let sessionIdToReturn: string | undefined;

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

    private async handleIncomingMessage(
        message: unknown,
        context: MCPRequestContext,
        isBatch: boolean
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
            if (isBatch) {
                return {
                    response: createJsonRpcErrorResponse(
                        requestId,
                        JsonRpcErrorCode.InvalidRequest,
                        'Invalid Request: initialize must be sent as a single request'
                    )
                };
            }

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
                    version: '1.4.0'
                }
            }
        };

        return {
            response,
            sessionIdToReturn: sessionId
        };
    }

    private async handleRequestMessage(message: JsonRpcRequest): Promise<JsonRpcResponseMessage> {
        const { id, method } = message;

        switch (method) {
            case MCP_METHODS.ToolsList:
                return {
                    jsonrpc: '2.0',
                    id,
                    result: { tools: this.getAvailableTools() }
                };
            case MCP_METHODS.ToolsCall:
                return this.handleToolsCallRequest(message);
            case MCP_METHODS.Ping:
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {}
                };
            default:
                return createJsonRpcErrorResponse(
                    id,
                    JsonRpcErrorCode.MethodNotFound,
                    `Method not found: ${method}`
                );
        }
    }

    private async handleToolsCallRequest(message: JsonRpcRequest): Promise<JsonRpcResponseMessage> {
        const { id, params } = message;

        if (!isRecord(params)) {
            return createJsonRpcErrorResponse(
                id,
                JsonRpcErrorCode.InvalidParams,
                'Invalid params for tools/call: params must be an object'
            );
        }

        const name = params.name;
        if (typeof name !== 'string' || !name.trim()) {
            return createJsonRpcErrorResponse(
                id,
                JsonRpcErrorCode.InvalidParams,
                'Invalid params for tools/call: "name" is required'
            );
        }

        const args = params.arguments ?? {};

        try {
            const toolResult = await this.executeToolCall(name, args);
            const isBusinessError = this.isToolBusinessError(toolResult);

            return {
                jsonrpc: '2.0',
                id,
                result: {
                    content: [{ type: 'text', text: this.stringifyToolResult(toolResult) }],
                    ...(isBusinessError ? { isError: true } : {})
                }
            };
        } catch (error: any) {
            const messageText = String(error?.message ?? error);
            if (/not found/i.test(messageText)) {
                return createJsonRpcErrorResponse(
                    id,
                    JsonRpcErrorCode.InvalidParams,
                    messageText
                );
            }

            return createJsonRpcErrorResponse(
                id,
                JsonRpcErrorCode.InternalError,
                messageText
            );
        }
    }

    private isToolBusinessError(toolResult: unknown): boolean {
        if (!isRecord(toolResult)) {
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

    private stringifyToolResult(toolResult: unknown): string {
        if (typeof toolResult === 'string') {
            return toolResult;
        }

        try {
            const serialized = JSON.stringify(toolResult);
            if (typeof serialized === 'string') {
                return serialized;
            }
            return String(toolResult);
        } catch (error) {
            return String(toolResult);
        }
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

        if (!isSessionReady(session)) {
            this.writeJsonResponse(res, 409, {
                error: 'Session is not ready. Send notifications/initialized before opening SSE stream.'
            });
            return;
        }

        this.sessionStore.touch(sessionId, this.now());
        this.streamableHttp.openSseStream(sessionId, req, res);
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

    private async handleSimpleAPIRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
        const body = await readRawBody(req);

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
            } catch (parseError: any) {
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

        } catch (error: any) {
            console.error('Simple API error:', error);
            this.writeJsonResponse(res, 500, {
                success: false,
                error: error.message,
                tool: pathname
            });
        }
    }

    private getSimplifiedToolsList(): any[] {
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

    private generateCurlExample(category: string, toolName: string, schema: any): string {
        // Generate sample parameters based on schema
        const sampleParams = this.generateSampleParams(schema);
        const jsonString = JSON.stringify(sampleParams, null, 2);

        return `curl -X POST http://127.0.0.1:${this.settings.port}/api/${category}/${toolName} \\\n  -H "Content-Type: application/json" \\\n  -d '${jsonString}'`;
    }

    private generateSampleParams(schema: any): any {
        if (!schema || !schema.properties) return {};

        const sample: any = {};
        for (const [key, prop] of Object.entries(schema.properties as any)) {
            const propSchema = prop as any;
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

    private parseJsonBody(
        rawBody: string,
        options: { allowEmpty: boolean; routeName: string }
    ): any {
        const body = rawBody.trim();

        if (!body) {
            if (options.allowEmpty) {
                return {};
            }
            throw new Error(`${options.routeName} request body is empty`);
        }

        try {
            return JSON.parse(body);
        } catch (error: any) {
            throw new Error(
                `${options.routeName} JSON parse failed: ${error.message}. ` +
                '请确保请求体是合法 JSON；必要时可先调用 validation_validate_json_params 进行检查。'
            );
        }
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
