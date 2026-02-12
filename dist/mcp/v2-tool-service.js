"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V2ToolService = void 0;
const crypto_1 = require("crypto");
const messages_1 = require("./messages");
const v2_errors_1 = require("./v2-errors");
const v2_workflow_tools_1 = require("./v2-workflow-tools");
const WRITE_ARG_KEYS = new Set(['dryRun', 'idempotencyKey', 'timeoutMs', 'clientTag']);
const DEFAULT_VERSION = '2.0.0';
const TRACE_PREFIX = 'trc_';
const MAX_TRACE_RECORDS = 300;
class V2ToolService {
    constructor(legacyTools, legacyInvoker, options = {}) {
        var _a, _b, _c, _d;
        this.descriptors = new Map();
        this.traces = new Map();
        this.traceOrder = [];
        this.version = (_a = options.version) !== null && _a !== void 0 ? _a : DEFAULT_VERSION;
        this.now = (_b = options.now) !== null && _b !== void 0 ? _b : (() => Date.now());
        this.traceIdGenerator = (_c = options.traceIdGenerator) !== null && _c !== void 0 ? _c : (() => `${TRACE_PREFIX}${(0, crypto_1.randomUUID)()}`);
        this.visibleLayers = new Set((_d = options.visibleLayers) !== null && _d !== void 0 ? _d : ['core']);
        this.legacyInvoker = legacyInvoker;
        this.registerLegacyTools(legacyTools);
        this.registerWorkflowTools();
        this.registerInternalTools();
    }
    listTools() {
        const result = [];
        for (const descriptor of this.descriptors.values()) {
            if (!this.visibleLayers.has(descriptor.manifest.layer)) {
                continue;
            }
            result.push(this.toListedTool(descriptor.manifest));
        }
        return result.sort((a, b) => a.name.localeCompare(b.name));
    }
    hasTool(toolName) {
        return this.descriptors.has(toolName);
    }
    getManifest(toolName) {
        var _a, _b;
        return (_b = (_a = this.descriptors.get(toolName)) === null || _a === void 0 ? void 0 : _a.manifest) !== null && _b !== void 0 ? _b : null;
    }
    getTraceById(traceId) {
        var _a;
        return (_a = this.traces.get(traceId)) !== null && _a !== void 0 ? _a : null;
    }
    async callTool(rawToolName, rawArgs) {
        const descriptor = this.descriptors.get(rawToolName);
        if (!descriptor) {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, `Unknown tool: ${rawToolName}`, {
                details: { tool: rawToolName },
                suggestion: '请先调用 tools/list 获取可用工具名称。',
                retryable: false
            }));
        }
        const traceId = this.traceIdGenerator();
        const startedAt = this.now();
        const timestamp = new Date(startedAt).toISOString();
        const args = (0, messages_1.isRecord)(rawArgs) ? rawArgs : {};
        const context = {
            traceId,
            tool: rawToolName,
            now: this.now,
            callLegacyTool: this.legacyInvoker,
            getManifest: (toolName) => this.getManifest(toolName),
            getTraceById: (id) => this.getTraceById(id)
        };
        try {
            const data = await descriptor.execute(args, context);
            const durationMs = this.now() - startedAt;
            const structuredContent = this.buildSuccessResponse(data, this.buildMeta(traceId, rawToolName, durationMs, timestamp));
            this.recordTrace({
                traceId,
                tool: rawToolName,
                timestamp,
                durationMs,
                success: true,
                errorCode: null,
                argsSummary: this.summarizeArgs(args)
            });
            return {
                isError: false,
                structuredContent,
                contentText: JSON.stringify(structuredContent)
            };
        }
        catch (error) {
            const durationMs = this.now() - startedAt;
            const businessError = this.toBusinessError(error);
            const structuredContent = this.buildFailureResponse(businessError, this.buildMeta(traceId, rawToolName, durationMs, timestamp));
            this.recordTrace({
                traceId,
                tool: rawToolName,
                timestamp,
                durationMs,
                success: false,
                errorCode: businessError.code,
                argsSummary: this.summarizeArgs(args)
            });
            return {
                isError: true,
                structuredContent,
                contentText: JSON.stringify(structuredContent)
            };
        }
    }
    validateWriteCommonArgs(args) {
        const raw = args;
        if (raw.dryRun !== undefined && typeof raw.dryRun !== 'boolean') {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'dryRun 必须是 boolean 类型', {
                details: { field: 'dryRun' },
                suggestion: '请传入 true 或 false。',
                retryable: false
            }));
        }
        if (raw.idempotencyKey !== undefined && typeof raw.idempotencyKey !== 'string') {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'idempotencyKey 必须是 string 类型', {
                details: { field: 'idempotencyKey' },
                retryable: false
            }));
        }
        if (raw.timeoutMs !== undefined && typeof raw.timeoutMs !== 'number') {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'timeoutMs 必须是 number 类型', {
                details: { field: 'timeoutMs' },
                retryable: false
            }));
        }
        if (raw.clientTag !== undefined && typeof raw.clientTag !== 'string') {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'clientTag 必须是 string 类型', {
                details: { field: 'clientTag' },
                retryable: false
            }));
        }
        return {
            dryRun: raw.dryRun === true
        };
    }
    withWriteCommonFields(schema, supportsWrite) {
        if (!(0, messages_1.isRecord)(schema)) {
            return {
                type: 'object',
                properties: supportsWrite ? this.writeCommonFieldSchema() : {}
            };
        }
        const normalized = Object.assign(Object.assign({}, schema), { properties: (0, messages_1.isRecord)(schema.properties) ? Object.assign({}, schema.properties) : {} });
        if (supportsWrite) {
            Object.assign(normalized.properties, this.writeCommonFieldSchema());
        }
        return normalized;
    }
    ensureLegacySuccess(result, stage) {
        var _a;
        if (!(0, messages_1.isRecord)(result) || result.success !== false) {
            return;
        }
        const message = (_a = this.pickString(result, ['error', 'message'])) !== null && _a !== void 0 ? _a : `阶段 ${stage} 执行失败`;
        const suggestion = this.pickString(result, ['instruction']);
        throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(this.inferBusinessCodeFromMessage(message), message, {
            stage,
            details: result,
            suggestion: suggestion !== null && suggestion !== void 0 ? suggestion : undefined,
            retryable: false
        }));
    }
    inferBusinessCodeFromMessage(message) {
        const normalized = message.toLowerCase();
        if (normalized.includes('not found') || normalized.includes('不存在')) {
            return v2_errors_1.V2_ERROR_CODES.NOT_FOUND;
        }
        if (normalized.includes('timeout') || normalized.includes('超时')) {
            return v2_errors_1.V2_ERROR_CODES.TIMEOUT;
        }
        if (normalized.includes('conflict') || normalized.includes('冲突') || normalized.includes('already exists')) {
            return v2_errors_1.V2_ERROR_CODES.CONFLICT;
        }
        if (normalized.includes('precondition') || normalized.includes('前置')) {
            return v2_errors_1.V2_ERROR_CODES.PRECONDITION_FAILED;
        }
        if (normalized.includes('invalid') || normalized.includes('required') || normalized.includes('参数')) {
            return v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT;
        }
        if (normalized.includes('unavailable') || normalized.includes('not running') || normalized.includes('不可用')) {
            return v2_errors_1.V2_ERROR_CODES.UNAVAILABLE;
        }
        return v2_errors_1.V2_ERROR_CODES.INTERNAL;
    }
    pickValue(source, paths) {
        for (const path of paths) {
            const value = this.readPath(source, path);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }
    pickString(source, paths) {
        const value = this.pickValue(source, paths);
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
        return null;
    }
    registerLegacyTools(legacyTools) {
        for (const tool of legacyTools) {
            const manifest = this.buildLegacyManifest(tool);
            this.registerTool({
                manifest,
                execute: async (args) => this.executeLegacyTool(manifest, args)
            });
        }
    }
    registerWorkflowTools() {
        const descriptors = (0, v2_workflow_tools_1.createWorkflowToolDescriptors)({
            withWriteCommonFields: this.withWriteCommonFields.bind(this),
            validateWriteCommonArgs: this.validateWriteCommonArgs.bind(this),
            ensureLegacySuccess: this.ensureLegacySuccess.bind(this),
            pickString: this.pickString.bind(this),
            pickValue: this.pickValue.bind(this),
            now: this.now
        });
        for (const descriptor of descriptors) {
            this.registerTool(descriptor);
        }
    }
    registerInternalTools() {
        this.registerTool({
            manifest: {
                name: 'get_trace_by_id',
                description: '根据 traceId 查询最近调用记录。',
                layer: 'internal',
                category: 'diagnostic',
                safety: 'readonly',
                idempotent: true,
                supportsDryRun: false,
                prerequisites: [],
                inputSchema: {
                    type: 'object',
                    properties: {
                        traceId: { type: 'string' }
                    },
                    required: ['traceId']
                },
                outputSchema: {
                    type: 'object',
                    properties: {
                        trace: { type: ['object', 'null'] }
                    }
                },
                examples: [{ input: { traceId: 'trc_xxx' } }]
            },
            execute: async (args, context) => {
                const traceId = args.traceId;
                if (typeof traceId !== 'string' || !traceId.trim()) {
                    throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'traceId is required', {
                        details: { field: 'traceId' },
                        retryable: false
                    }));
                }
                return {
                    trace: context.getTraceById(traceId)
                };
            }
        });
    }
    registerTool(descriptor) {
        this.descriptors.set(descriptor.manifest.name, descriptor);
    }
    async executeLegacyTool(manifest, args) {
        const writeArgs = this.validateWriteCommonArgs(args);
        const legacyArgs = this.stripWriteCommonArgs(args);
        if (manifest.supportsDryRun && writeArgs.dryRun) {
            return {
                dryRun: true,
                riskLevel: this.toRiskLevel(manifest.safety),
                changes: this.buildGenericChanges(manifest.name, legacyArgs),
                note: 'dryRun=true，未执行真实工具调用'
            };
        }
        const legacyResult = await this.legacyInvoker(manifest.name, legacyArgs);
        this.ensureLegacySuccess(legacyResult, manifest.name);
        const data = {
            result: legacyResult
        };
        if (manifest.safety !== 'readonly') {
            data.riskLevel = this.toRiskLevel(manifest.safety);
            data.changes = this.buildGenericChanges(manifest.name, legacyArgs);
        }
        return data;
    }
    stripWriteCommonArgs(args) {
        const clean = {};
        for (const [key, value] of Object.entries(args)) {
            if (WRITE_ARG_KEYS.has(key)) {
                continue;
            }
            clean[key] = value;
        }
        return clean;
    }
    buildLegacyManifest(tool) {
        const category = this.extractCategory(tool.name);
        const verb = this.extractVerb(tool.name);
        const safety = this.inferSafety(verb);
        const layer = this.inferLayer(category, tool.name);
        return {
            name: tool.name,
            description: tool.description,
            layer,
            category,
            safety,
            idempotent: this.inferIdempotent(verb, safety),
            supportsDryRun: safety !== 'readonly',
            prerequisites: [],
            inputSchema: this.withWriteCommonFields(tool.inputSchema, safety !== 'readonly'),
            outputSchema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    data: {},
                    error: { type: ['object', 'null'] },
                    meta: { type: 'object' }
                }
            },
            examples: []
        };
    }
    toListedTool(manifest) {
        return {
            name: manifest.name,
            description: manifest.description,
            inputSchema: manifest.inputSchema,
            outputSchema: manifest.outputSchema,
            _meta: {
                layer: manifest.layer,
                category: manifest.category,
                safety: manifest.safety,
                idempotent: manifest.idempotent,
                supportsDryRun: manifest.supportsDryRun
            }
        };
    }
    buildMeta(traceId, toolName, durationMs, timestamp) {
        return {
            traceId,
            tool: toolName,
            version: this.version,
            durationMs,
            timestamp
        };
    }
    buildSuccessResponse(data, meta) {
        return {
            success: true,
            data,
            error: null,
            meta
        };
    }
    buildFailureResponse(error, meta) {
        return {
            success: false,
            data: null,
            error,
            meta
        };
    }
    toBusinessError(error) {
        var _a, _b;
        if (error instanceof v2_errors_1.V2BusinessErrorException) {
            return error.businessError;
        }
        const message = String((_b = (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : error) !== null && _b !== void 0 ? _b : 'Unknown error');
        return (0, v2_errors_1.createBusinessError)(this.inferBusinessCodeFromMessage(message), message, {
            retryable: false
        });
    }
    recordTrace(record) {
        this.traces.set(record.traceId, record);
        this.traceOrder.push(record.traceId);
        while (this.traceOrder.length > MAX_TRACE_RECORDS) {
            const oldest = this.traceOrder.shift();
            if (!oldest) {
                break;
            }
            this.traces.delete(oldest);
        }
    }
    summarizeArgs(args) {
        const summary = {};
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') {
                summary[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
            }
            else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                summary[key] = value;
            }
            else if (Array.isArray(value)) {
                summary[key] = `array(${value.length})`;
            }
            else if ((0, messages_1.isRecord)(value)) {
                summary[key] = `object(${Object.keys(value).length})`;
            }
            else {
                summary[key] = typeof value;
            }
        }
        return summary;
    }
    writeCommonFieldSchema() {
        return {
            dryRun: {
                type: 'boolean',
                default: false,
                description: '为 true 时仅返回拟变更摘要，不执行实际写入。'
            },
            idempotencyKey: {
                type: 'string',
                description: '调用方提供的幂等键，用于追踪重复请求。'
            },
            timeoutMs: {
                type: 'number',
                description: '调用超时毫秒。'
            },
            clientTag: {
                type: 'string',
                description: '调用方标识。'
            }
        };
    }
    extractCategory(toolName) {
        const index = toolName.indexOf('_');
        if (index <= 0) {
            return 'misc';
        }
        return toolName.slice(0, index);
    }
    extractVerb(toolName) {
        const segments = toolName.split('_');
        if (segments.length >= 2) {
            return segments[1];
        }
        return segments[0];
    }
    inferLayer(category, toolName) {
        if (toolName.startsWith('workflow_')) {
            return 'core';
        }
        if (category === 'debug' || category === 'validation' || category === 'broadcast') {
            return 'internal';
        }
        if (category === 'sceneAdvanced' || category === 'assetAdvanced' || category === 'referenceImage' || category === 'preferences') {
            return 'advanced';
        }
        return 'core';
    }
    inferSafety(verb) {
        const readonlyVerbs = new Set(['get', 'list', 'find', 'query', 'validate', 'check']);
        const destructiveVerbs = new Set(['delete', 'remove', 'clear', 'cut']);
        if (readonlyVerbs.has(verb)) {
            return 'readonly';
        }
        if (destructiveVerbs.has(verb)) {
            return 'destructive';
        }
        return 'mutating';
    }
    inferIdempotent(verb, safety) {
        if (safety === 'readonly') {
            return true;
        }
        const idempotentVerbs = new Set(['set', 'update', 'validate', 'check']);
        return idempotentVerbs.has(verb);
    }
    toRiskLevel(safety) {
        if (safety === 'destructive') {
            return 'high';
        }
        if (safety === 'mutating') {
            return 'medium';
        }
        return 'low';
    }
    buildGenericChanges(toolName, args) {
        const fields = Object.keys(args);
        return [
            {
                type: 'update',
                target: toolName,
                field: fields.length > 0 ? fields.join(',') : 'unknown',
                from: null,
                to: this.summarizeArgs(args)
            }
        ];
    }
    readPath(source, path) {
        const segments = path.split('.');
        let current = source;
        for (const segment of segments) {
            if (!(0, messages_1.isRecord)(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
                return undefined;
            }
            current = current[segment];
        }
        return current;
    }
}
exports.V2ToolService = V2ToolService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjItdG9vbC1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL21jcC92Mi10b29sLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW9DO0FBRXBDLHlDQUFzQztBQWF0QywyQ0FJcUI7QUFDckIsMkRBQW9FO0FBa0JwRSxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUN2RixNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUM7QUFDaEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDO0FBQzVCLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBRTlCLE1BQWEsYUFBYTtJQVV0QixZQUNJLFdBQTZCLEVBQzdCLGFBQWdDLEVBQ2hDLFVBQWdDLEVBQUU7O1FBWnJCLGdCQUFXLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7UUFDbEQsV0FBTSxHQUFHLElBQUksR0FBRyxFQUF5QixDQUFDO1FBQzFDLGVBQVUsR0FBYSxFQUFFLENBQUM7UUFZdkMsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFBLE9BQU8sQ0FBQyxPQUFPLG1DQUFJLGVBQWUsQ0FBQztRQUNsRCxJQUFJLENBQUMsR0FBRyxHQUFHLE1BQUEsT0FBTyxDQUFDLEdBQUcsbUNBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsTUFBQSxPQUFPLENBQUMsZ0JBQWdCLG1DQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxZQUFZLEdBQUcsSUFBQSxtQkFBVSxHQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzdGLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBQSxPQUFPLENBQUMsYUFBYSxtQ0FBSSxDQUFDLE1BQU0s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QUM7UUFDakMsSUFBSSxPQUFPLEdBQVksTUFBTSxDQUFDO1FBRTlCLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLElBQUEsbUJBQVEsRUFBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDaEYsT0FBTyxTQUFTLENBQUM7WUFDckIsQ0FBQztZQUNELE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7Q0FDSjtBQXBtQkQsc0NBb21CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgVG9vbERlZmluaXRpb24gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBpc1JlY29yZCB9IGZyb20gJy4vbWVzc2FnZXMnO1xuaW1wb3J0IHtcbiAgICBWMkxpc3RlZFRvb2wsXG4gICAgVjJSZXNwb25zZU1ldGEsXG4gICAgVjJTdHJ1Y3R1cmVkUmVzcG9uc2UsXG4gICAgVjJUb29sRGVzY3JpcHRvcixcbiAgICBWMlRvb2xFeGVjdXRpb25Db250ZXh0LFxuICAgIFYyVG9vbEV4ZWN1dGlvbk91dHB1dCxcbiAgICBWMlRvb2xMYXllcixcbiAgICBWMlRvb2xNYW5pZmVzdCxcbiAgICBWMlRvb2xTYWZldHksXG4gICAgVjJUcmFjZVJlY29yZFxufSBmcm9tICcuL3YyLW1vZGVscyc7XG5pbXBvcnQge1xuICAgIFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbixcbiAgICBWMl9FUlJPUl9DT0RFUyxcbiAgICBjcmVhdGVCdXNpbmVzc0Vycm9yXG59IGZyb20gJy4vdjItZXJyb3JzJztcbmltcG9ydCB7IGNyZWF0ZVdvcmtmbG93VG9vbERlc2NyaXB0b3JzIH0gZnJvbSAnLi92Mi13b3JrZmxvdy10b29scyc7XG5cbnR5cGUgTGVnYWN5VG9vbEludm9rZXIgPSAodG9vbE5hbWU6IHN0cmluZywgYXJnczogYW55KSA9PiBQcm9taXNlPGFueT47XG5cbmludGVyZmFjZSBWMlRvb2xTZXJ2aWNlT3B0aW9ucyB7XG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICBub3c/OiAoKSA9PiBudW1iZXI7XG4gICAgdHJhY2VJZEdlbmVyYXRvcj86ICgpID0+IHN0cmluZztcbiAgICB2aXNpYmxlTGF5ZXJzPzogVjJUb29sTGF5ZXJbXTtcbn1cblxuaW50ZXJmYWNlIFdyaXRlQ29tbW9uQXJncyB7XG4gICAgZHJ5UnVuPzogdW5rbm93bjtcbiAgICBpZGVtcG90ZW5jeUtleT86IHVua25vd247XG4gICAgdGltZW91dE1zPzogdW5rbm93bjtcbiAgICBjbGllbnRUYWc/OiB1bmtub3duO1xufVxuXG5jb25zdCBXUklURV9BUkdfS0VZUyA9IG5ldyBTZXQoWydkcnlSdW4nLCAnaWRlbXBvdGVuY3lLZXknLCAndGltZW91dE1zJywgJ2NsaWVudFRhZyddKTtcbmNvbnN0IERFRkFVTFRfVkVSU0lPTiA9ICcyLjAuMCc7XG5jb25zdCBUUkFDRV9QUkVGSVggPSAndHJjXyc7XG5jb25zdCBNQVhfVFJBQ0VfUkVDT1JEUyA9IDMwMDtcblxuZXhwb3J0IGNsYXNzIFYyVG9vbFNlcnZpY2Uge1xuICAgIHByaXZhdGUgcmVhZG9ubHkgZGVzY3JpcHRvcnMgPSBuZXcgTWFwPHN0cmluZywgVjJUb29sRGVzY3JpcHRvcj4oKTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHRyYWNlcyA9IG5ldyBNYXA8c3RyaW5nLCBWMlRyYWNlUmVjb3JkPigpO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgdHJhY2VPcmRlcjogc3RyaW5nW10gPSBbXTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHZlcnNpb246IHN0cmluZztcbiAgICBwcml2YXRlIHJlYWRvbmx5IG5vdzogKCkgPT4gbnVtYmVyO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgdHJhY2VJZEdlbmVyYXRvcjogKCkgPT4gc3RyaW5nO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgdmlzaWJsZUxheWVyczogU2V0PFYyVG9vbExheWVyPjtcbiAgICBwcml2YXRlIHJlYWRvbmx5IGxlZ2FjeUludm9rZXI6IExlZ2FjeVRvb2xJbnZva2VyO1xuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGxlZ2FjeVRvb2xzOiBUb29sRGVmaW5pdGlvbltdLFxuICAgICAgICBsZWdhY3lJbnZva2VyOiBMZWdhY3lUb29sSW52b2tlcixcbiAgICAgICAgb3B0aW9uczogVjJUb29sU2VydmljZU9wdGlvbnMgPSB7fVxuICAgICkge1xuICAgICAgICB0aGlzLnZlcnNpb24gPSBvcHRpb25zLnZlcnNpb24gPz8gREVGQVVMVF9WRVJTSU9OO1xuICAgICAgICB0aGlzLm5vdyA9IG9wdGlvbnMubm93ID8/ICgoKSA9PiBEYXRlLm5vdygpKTtcbiAgICAgICAgdGhpcy50cmFjZUlkR2VuZXJhdG9yID0gb3B0aW9ucy50cmFjZUlkR2VuZXJhdG9yID8/ICgoKSA9PiBgJHtUUkFDRV9QUkVGSVh9JHtyYW5kb21VVUlEKCl9YCk7XG4gICAgICAgIHRoaXMudmlzaWJsZUxheWVycyA9IG5ldyBTZXQob3B0aW9ucy52aXNpYmxlTGF5ZXJzID8/IFsnY29yZSddKTtcbiAgICAgICAgdGhpcy5sZWdhY3lJbnZva2VyID0gbGVnYWN5SW52b2tlcjtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyTGVnYWN5VG9vbHMobGVnYWN5VG9vbHMpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyV29ya2Zsb3dUb29scygpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVySW50ZXJuYWxUb29scygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBsaXN0VG9vbHMoKTogVjJMaXN0ZWRUb29sW10ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IFYyTGlzdGVkVG9vbFtdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBkZXNjcmlwdG9yIG9mIHRoaXMuZGVzY3JpcHRvcnMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy52aXNpYmxlTGF5ZXJzLmhhcyhkZXNjcmlwdG9yLm1hbmlmZXN0LmxheWVyKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXN1bHQucHVzaCh0aGlzLnRvTGlzdGVkVG9vbChkZXNjcmlwdG9yLm1hbmlmZXN0KSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBoYXNUb29sKHRvb2xOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVzY3JpcHRvcnMuaGFzKHRvb2xOYW1lKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0TWFuaWZlc3QodG9vbE5hbWU6IHN0cmluZyk6IFYyVG9vbE1hbmlmZXN0IHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmRlc2NyaXB0b3JzLmdldCh0b29sTmFtZSk/Lm1hbmlmZXN0ID8/IG51bGw7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFRyYWNlQnlJZCh0cmFjZUlkOiBzdHJpbmcpOiBWMlRyYWNlUmVjb3JkIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLnRyYWNlcy5nZXQodHJhY2VJZCkgPz8gbnVsbDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2FsbFRvb2wocmF3VG9vbE5hbWU6IHN0cmluZywgcmF3QXJnczogdW5rbm93bik6IFByb21pc2U8VjJUb29sRXhlY3V0aW9uT3V0cHV0PiB7XG4gICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSB0aGlzLmRlc2NyaXB0b3JzLmdldChyYXdUb29sTmFtZSk7XG4gICAgICAgIGlmICghZGVzY3JpcHRvcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXNpbmVzc0Vycm9yKFYyX0VSUk9SX0NPREVTLklOVkFMSURfQVJHVU1FTlQsIGBVbmtub3duIHRvb2w6ICR7cmF3VG9vbE5hbWV9YCwge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7IHRvb2w6IHJhd1Rvb2xOYW1lIH0sXG4gICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb246ICfor7flhYjosIPnlKggdG9vbHMvbGlzdCDojrflj5blj6/nlKjlt6XlhbflkI3np7DjgIInLFxuICAgICAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0cmFjZUlkID0gdGhpcy50cmFjZUlkR2VuZXJhdG9yKCk7XG4gICAgICAgIGNvbnN0IHN0YXJ0ZWRBdCA9IHRoaXMubm93KCk7XG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKHN0YXJ0ZWRBdCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgY29uc3QgYXJncyA9IGlzUmVjb3JkKHJhd0FyZ3MpID8gcmF3QXJncyA6IHt9O1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHQ6IFYyVG9vbEV4ZWN1dGlvbkNvbnRleHQgPSB7XG4gICAgICAgICAgICB0cmFjZUlkLFxuICAgICAgICAgICAgdG9vbDogcmF3VG9vbE5hbWUsXG4gICAgICAgICAgICBub3c6IHRoaXMubm93LFxuICAgICAgICAgICAgY2FsbExlZ2FjeVRvb2w6IHRoaXMubGVnYWN5SW52b2tlcixcbiAgICAgICAgICAgIGdldE1hbmlmZXN0OiAodG9vbE5hbWU6IHN0cmluZykgPT4gdGhpcy5nZXRNYW5pZmVzdCh0b29sTmFtZSksXG4gICAgICAgICAgICBnZXRUcmFjZUJ5SWQ6IChpZDogc3RyaW5nKSA9PiB0aGlzLmdldFRyYWNlQnlJZChpZClcbiAgICAgICAgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGRlc2NyaXB0b3IuZXhlY3V0ZShhcmdzLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGNvbnN0IGR1cmF0aW9uTXMgPSB0aGlzLm5vdygpIC0gc3RhcnRlZEF0O1xuICAgICAgICAgICAgY29uc3Qgc3RydWN0dXJlZENvbnRlbnQgPSB0aGlzLmJ1aWxkU3VjY2Vzc1Jlc3BvbnNlKFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgdGhpcy5idWlsZE1ldGEodHJhY2VJZCwgcmF3VG9vbE5hbWUsIGR1cmF0aW9uTXMsIHRpbWVzdGFtcClcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHRoaXMucmVjb3JkVHJhY2Uoe1xuICAgICAgICAgICAgICAgIHRyYWNlSWQsXG4gICAgICAgICAgICAgICAgdG9vbDogcmF3VG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIGR1cmF0aW9uTXMsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBlcnJvckNvZGU6IG51bGwsXG4gICAgICAgICAgICAgICAgYXJnc1N1bW1hcnk6IHRoaXMuc3VtbWFyaXplQXJncyhhcmdzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaXNFcnJvcjogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RydWN0dXJlZENvbnRlbnQsXG4gICAgICAgICAgICAgICAgY29udGVudFRleHQ6IEpTT04uc3RyaW5naWZ5KHN0cnVjdHVyZWRDb250ZW50KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc3QgZHVyYXRpb25NcyA9IHRoaXMubm93KCkgLSBzdGFydGVkQXQ7XG4gICAgICAgICAgICBjb25zdCBidXNpbmVzc0Vycm9yID0gdGhpcy50b0J1c2luZXNzRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgY29uc3Qgc3RydWN0dXJlZENvbnRlbnQgPSB0aGlzLmJ1aWxkRmFpbHVyZVJlc3BvbnNlKFxuICAgICAgICAgICAgICAgIGJ1c2luZXNzRXJyb3IsXG4gICAgICAgICAgICAgICAgdGhpcy5idWlsZE1ldGEodHJhY2VJZCwgcmF3VG9vbE5hbWUsIGR1cmF0aW9uTXMsIHRpbWVzdGFtcClcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHRoaXMucmVjb3JkVHJhY2Uoe1xuICAgICAgICAgICAgICAgIHRyYWNlSWQsXG4gICAgICAgICAgICAgICAgdG9vbDogcmF3VG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIGR1cmF0aW9uTXMsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3JDb2RlOiBidXNpbmVzc0Vycm9yLmNvZGUsXG4gICAgICAgICAgICAgICAgYXJnc1N1bW1hcnk6IHRoaXMuc3VtbWFyaXplQXJncyhhcmdzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaXNFcnJvcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzdHJ1Y3R1cmVkQ29udGVudCxcbiAgICAgICAgICAgICAgICBjb250ZW50VGV4dDogSlNPTi5zdHJpbmdpZnkoc3RydWN0dXJlZENvbnRlbnQpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHZhbGlkYXRlV3JpdGVDb21tb25BcmdzKGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogeyBkcnlSdW46IGJvb2xlYW4gfSB7XG4gICAgICAgIGNvbnN0IHJhdyA9IGFyZ3MgYXMgV3JpdGVDb21tb25BcmdzO1xuXG4gICAgICAgIGlmIChyYXcuZHJ5UnVuICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJhdy5kcnlSdW4gIT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXNpbmVzc0Vycm9yKFYyX0VSUk9SX0NPREVTLklOVkFMSURfQVJHVU1FTlQsICdkcnlSdW4g5b+F6aG75pivIGJvb2xlYW4g57G75Z6LJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7IGZpZWxkOiAnZHJ5UnVuJyB9LFxuICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uOiAn6K+35Lyg5YWlIHRydWUg5oiWIGZhbHNl44CCJyxcbiAgICAgICAgICAgICAgICAgICAgcmV0cnlhYmxlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJhdy5pZGVtcG90ZW5jeUtleSAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiByYXcuaWRlbXBvdGVuY3lLZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVjJCdXNpbmVzc0Vycm9yRXhjZXB0aW9uKFxuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1c2luZXNzRXJyb3IoVjJfRVJST1JfQ09ERVMuSU5WQUxJRF9BUkdVTUVOVCwgJ2lkZW1wb3RlbmN5S2V5IOW/hemhu+aYryBzdHJpbmcg57G75Z6LJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7IGZpZWxkOiAnaWRlbXBvdGVuY3lLZXknIH0sXG4gICAgICAgICAgICAgICAgICAgIHJldHJ5YWJsZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyYXcudGltZW91dE1zICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJhdy50aW1lb3V0TXMgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVjJCdXNpbmVzc0Vycm9yRXhjZXB0aW9uKFxuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1c2luZXNzRXJyb3IoVjJfRVJST1JfQ09ERVMuSU5WQUxJRF9BUkdVTUVOVCwgJ3RpbWVvdXRNcyDlv4XpobvmmK8gbnVtYmVyIOexu+WeiycsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogeyBmaWVsZDogJ3RpbWVvdXRNcycgfSxcbiAgICAgICAgICAgICAgICAgICAgcmV0cnlhYmxlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJhdy5jbGllbnRUYWcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmF3LmNsaWVudFRhZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBWMkJ1c2luZXNzRXJyb3JFeGNlcHRpb24oXG4gICAgICAgICAgICAgICAgY3JlYXRlQnVzaW5lc3NFcnJvcihWMl9FUlJPUl9DT0RFUy5JTlZBTElEX0FSR1VNRU5ULCAnY2xpZW50VGFnIOW/hemhu+aYryBzdHJpbmcg57G75Z6LJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7IGZpZWxkOiAnY2xpZW50VGFnJyB9LFxuICAgICAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZHJ5UnVuOiByYXcuZHJ5UnVuID09PSB0cnVlXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIHdpdGhXcml0ZUNvbW1vbkZpZWxkcyhzY2hlbWE6IHVua25vd24sIHN1cHBvcnRzV3JpdGU6IGJvb2xlYW4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgICAgIGlmICghaXNSZWNvcmQoc2NoZW1hKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBzdXBwb3J0c1dyaXRlID8gdGhpcy53cml0ZUNvbW1vbkZpZWxkU2NoZW1hKCkgOiB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB7XG4gICAgICAgICAgICAuLi5zY2hlbWEsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBpc1JlY29yZChzY2hlbWEucHJvcGVydGllcykgPyB7IC4uLnNjaGVtYS5wcm9wZXJ0aWVzIH0gOiB7fVxuICAgICAgICB9IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG4gICAgICAgIGlmIChzdXBwb3J0c1dyaXRlKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKG5vcm1hbGl6ZWQucHJvcGVydGllcyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgdGhpcy53cml0ZUNvbW1vbkZpZWxkU2NoZW1hKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZWQ7XG4gICAgfVxuXG4gICAgcHVibGljIGVuc3VyZUxlZ2FjeVN1Y2Nlc3MocmVzdWx0OiB1bmtub3duLCBzdGFnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmICghaXNSZWNvcmQocmVzdWx0KSB8fCByZXN1bHQuc3VjY2VzcyAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLnBpY2tTdHJpbmcocmVzdWx0LCBbJ2Vycm9yJywgJ21lc3NhZ2UnXSkgPz8gYOmYtuautSAke3N0YWdlfSDmiafooYzlpLHotKVgO1xuICAgICAgICBjb25zdCBzdWdnZXN0aW9uID0gdGhpcy5waWNrU3RyaW5nKHJlc3VsdCwgWydpbnN0cnVjdGlvbiddKTtcblxuICAgICAgICB0aHJvdyBuZXcgVjJCdXNpbmVzc0Vycm9yRXhjZXB0aW9uKFxuICAgICAgICAgICAgY3JlYXRlQnVzaW5lc3NFcnJvcih0aGlzLmluZmVyQnVzaW5lc3NDb2RlRnJvbU1lc3NhZ2UobWVzc2FnZSksIG1lc3NhZ2UsIHtcbiAgICAgICAgICAgICAgICBzdGFnZSxcbiAgICAgICAgICAgICAgICBkZXRhaWxzOiByZXN1bHQsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogc3VnZ2VzdGlvbiA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgcmV0cnlhYmxlOiBmYWxzZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgaW5mZXJCdXNpbmVzc0NvZGVGcm9tTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbWVzc2FnZS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKCdub3QgZm91bmQnKSB8fCBub3JtYWxpemVkLmluY2x1ZGVzKCfkuI3lrZjlnKgnKSkge1xuICAgICAgICAgICAgcmV0dXJuIFYyX0VSUk9SX0NPREVTLk5PVF9GT1VORDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKCd0aW1lb3V0JykgfHwgbm9ybWFsaXplZC5pbmNsdWRlcygn6LaF5pe2JykpIHtcbiAgICAgICAgICAgIHJldHVybiBWMl9FUlJPUl9DT0RFUy5USU1FT1VUO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ2NvbmZsaWN0JykgfHwgbm9ybWFsaXplZC5pbmNsdWRlcygn5Yay56qBJykgfHwgbm9ybWFsaXplZC5pbmNsdWRlcygnYWxyZWFkeSBleGlzdHMnKSkge1xuICAgICAgICAgICAgcmV0dXJuIFYyX0VSUk9SX0NPREVTLkNPTkZMSUNUO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ3ByZWNvbmRpdGlvbicpIHx8IG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ+WJjee9ricpKSB7XG4gICAgICAgICAgICByZXR1cm4gVjJfRVJST1JfQ09ERVMuUFJFQ09ORElUSU9OX0ZBSUxFRDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKCdpbnZhbGlkJykgfHwgbm9ybWFsaXplZC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fCBub3JtYWxpemVkLmluY2x1ZGVzKCflj4LmlbAnKSkge1xuICAgICAgICAgICAgcmV0dXJuIFYyX0VSUk9SX0NPREVTLklOVkFMSURfQVJHVU1FTlQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9ybWFsaXplZC5pbmNsdWRlcygndW5hdmFpbGFibGUnKSB8fCBub3JtYWxpemVkLmluY2x1ZGVzKCdub3QgcnVubmluZycpIHx8IG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ+S4jeWPr+eUqCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gVjJfRVJST1JfQ09ERVMuVU5BVkFJTEFCTEU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gVjJfRVJST1JfQ09ERVMuSU5URVJOQUw7XG4gICAgfVxuXG4gICAgcHVibGljIHBpY2tWYWx1ZShzb3VyY2U6IHVua25vd24sIHBhdGhzOiBzdHJpbmdbXSk6IHVua25vd24ge1xuICAgICAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWFkUGF0aChzb3VyY2UsIHBhdGgpO1xuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBwdWJsaWMgcGlja1N0cmluZyhzb3VyY2U6IHVua25vd24sIHBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGlja1ZhbHVlKHNvdXJjZSwgcGF0aHMpO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZ2lzdGVyTGVnYWN5VG9vbHMobGVnYWN5VG9vbHM6IFRvb2xEZWZpbml0aW9uW10pOiB2b2lkIHtcbiAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIGxlZ2FjeVRvb2xzKSB7XG4gICAgICAgICAgICBjb25zdCBtYW5pZmVzdCA9IHRoaXMuYnVpbGRMZWdhY3lNYW5pZmVzdCh0b29sKTtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0ZXJUb29sKHtcbiAgICAgICAgICAgICAgICBtYW5pZmVzdCxcbiAgICAgICAgICAgICAgICBleGVjdXRlOiBhc3luYyAoYXJncykgPT4gdGhpcy5leGVjdXRlTGVnYWN5VG9vbChtYW5pZmVzdCwgYXJncylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZWdpc3RlcldvcmtmbG93VG9vbHMoKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGRlc2NyaXB0b3JzID0gY3JlYXRlV29ya2Zsb3dUb29sRGVzY3JpcHRvcnMoe1xuICAgICAgICAgICAgd2l0aFdyaXRlQ29tbW9uRmllbGRzOiB0aGlzLndpdGhXcml0ZUNvbW1vbkZpZWxkcy5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgdmFsaWRhdGVXcml0ZUNvbW1vbkFyZ3M6IHRoaXMudmFsaWRhdGVXcml0ZUNvbW1vbkFyZ3MuYmluZCh0aGlzKSxcbiAgICAgICAgICAgIGVuc3VyZUxlZ2FjeVN1Y2Nlc3M6IHRoaXMuZW5zdXJlTGVnYWN5U3VjY2Vzcy5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgcGlja1N0cmluZzogdGhpcy5waWNrU3RyaW5nLmJpbmQodGhpcyksXG4gICAgICAgICAgICBwaWNrVmFsdWU6IHRoaXMucGlja1ZhbHVlLmJpbmQodGhpcyksXG4gICAgICAgICAgICBub3c6IHRoaXMubm93XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgZGVzY3JpcHRvciBvZiBkZXNjcmlwdG9ycykge1xuICAgICAgICAgICAgdGhpcy5yZWdpc3RlclRvb2woZGVzY3JpcHRvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZ2lzdGVySW50ZXJuYWxUb29scygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5yZWdpc3RlclRvb2woe1xuICAgICAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZ2V0X3RyYWNlX2J5X2lkJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+agueaNriB0cmFjZUlkIOafpeivouacgOi/keiwg+eUqOiusOW9leOAgicsXG4gICAgICAgICAgICAgICAgbGF5ZXI6ICdpbnRlcm5hbCcsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgICAgICBzYWZldHk6ICdyZWFkb25seScsXG4gICAgICAgICAgICAgICAgaWRlbXBvdGVudDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzdXBwb3J0c0RyeVJ1bjogZmFsc2UsXG4gICAgICAgICAgICAgICAgcHJlcmVxdWlzaXRlczogW10sXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYWNlSWQ6IHsgdHlwZTogJ3N0cmluZycgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd0cmFjZUlkJ11cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG91dHB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2U6IHsgdHlwZTogWydvYmplY3QnLCAnbnVsbCddIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhhbXBsZXM6IFt7IGlucHV0OiB7IHRyYWNlSWQ6ICd0cmNfeHh4JyB9IH1dXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhlY3V0ZTogYXN5bmMgKGFyZ3MsIGNvbnRleHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFjZUlkID0gYXJncy50cmFjZUlkO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdHJhY2VJZCAhPT0gJ3N0cmluZycgfHwgIXRyYWNlSWQudHJpbSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBWMkJ1c2luZXNzRXJyb3JFeGNlcHRpb24oXG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVCdXNpbmVzc0Vycm9yKFYyX0VSUk9SX0NPREVTLklOVkFMSURfQVJHVU1FTlQsICd0cmFjZUlkIGlzIHJlcXVpcmVkJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IHsgZmllbGQ6ICd0cmFjZUlkJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHJ5YWJsZTogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhY2U6IGNvbnRleHQuZ2V0VHJhY2VCeUlkKHRyYWNlSWQpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZWdpc3RlclRvb2woZGVzY3JpcHRvcjogVjJUb29sRGVzY3JpcHRvcik6IHZvaWQge1xuICAgICAgICB0aGlzLmRlc2NyaXB0b3JzLnNldChkZXNjcmlwdG9yLm1hbmlmZXN0Lm5hbWUsIGRlc2NyaXB0b3IpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZXhlY3V0ZUxlZ2FjeVRvb2wobWFuaWZlc3Q6IFYyVG9vbE1hbmlmZXN0LCBhcmdzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8dW5rbm93bj4ge1xuICAgICAgICBjb25zdCB3cml0ZUFyZ3MgPSB0aGlzLnZhbGlkYXRlV3JpdGVDb21tb25BcmdzKGFyZ3MpO1xuICAgICAgICBjb25zdCBsZWdhY3lBcmdzID0gdGhpcy5zdHJpcFdyaXRlQ29tbW9uQXJncyhhcmdzKTtcblxuICAgICAgICBpZiAobWFuaWZlc3Quc3VwcG9ydHNEcnlSdW4gJiYgd3JpdGVBcmdzLmRyeVJ1bikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkcnlSdW46IHRydWUsXG4gICAgICAgICAgICAgICAgcmlza0xldmVsOiB0aGlzLnRvUmlza0xldmVsKG1hbmlmZXN0LnNhZmV0eSksXG4gICAgICAgICAgICAgICAgY2hhbmdlczogdGhpcy5idWlsZEdlbmVyaWNDaGFuZ2VzKG1hbmlmZXN0Lm5hbWUsIGxlZ2FjeUFyZ3MpLFxuICAgICAgICAgICAgICAgIG5vdGU6ICdkcnlSdW49dHJ1Ze+8jOacquaJp+ihjOecn+WunuW3peWFt+iwg+eUqCdcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZWdhY3lSZXN1bHQgPSBhd2FpdCB0aGlzLmxlZ2FjeUludm9rZXIobWFuaWZlc3QubmFtZSwgbGVnYWN5QXJncyk7XG4gICAgICAgIHRoaXMuZW5zdXJlTGVnYWN5U3VjY2VzcyhsZWdhY3lSZXN1bHQsIG1hbmlmZXN0Lm5hbWUpO1xuXG4gICAgICAgIGNvbnN0IGRhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAgICAgcmVzdWx0OiBsZWdhY3lSZXN1bHRcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAobWFuaWZlc3Quc2FmZXR5ICE9PSAncmVhZG9ubHknKSB7XG4gICAgICAgICAgICBkYXRhLnJpc2tMZXZlbCA9IHRoaXMudG9SaXNrTGV2ZWwobWFuaWZlc3Quc2FmZXR5KTtcbiAgICAgICAgICAgIGRhdGEuY2hhbmdlcyA9IHRoaXMuYnVpbGRHZW5lcmljQ2hhbmdlcyhtYW5pZmVzdC5uYW1lLCBsZWdhY3lBcmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RyaXBXcml0ZUNvbW1vbkFyZ3MoYXJnczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgICAgIGNvbnN0IGNsZWFuOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGFyZ3MpKSB7XG4gICAgICAgICAgICBpZiAoV1JJVEVfQVJHX0tFWVMuaGFzKGtleSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNsZWFuW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGVhbjtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkTGVnYWN5TWFuaWZlc3QodG9vbDogVG9vbERlZmluaXRpb24pOiBWMlRvb2xNYW5pZmVzdCB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gdGhpcy5leHRyYWN0Q2F0ZWdvcnkodG9vbC5uYW1lKTtcbiAgICAgICAgY29uc3QgdmVyYiA9IHRoaXMuZXh0cmFjdFZlcmIodG9vbC5uYW1lKTtcbiAgICAgICAgY29uc3Qgc2FmZXR5ID0gdGhpcy5pbmZlclNhZmV0eSh2ZXJiKTtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmluZmVyTGF5ZXIoY2F0ZWdvcnksIHRvb2wubmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgbGF5ZXIsXG4gICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgIHNhZmV0eSxcbiAgICAgICAgICAgIGlkZW1wb3RlbnQ6IHRoaXMuaW5mZXJJZGVtcG90ZW50KHZlcmIsIHNhZmV0eSksXG4gICAgICAgICAgICBzdXBwb3J0c0RyeVJ1bjogc2FmZXR5ICE9PSAncmVhZG9ubHknLFxuICAgICAgICAgICAgcHJlcmVxdWlzaXRlczogW10sXG4gICAgICAgICAgICBpbnB1dFNjaGVtYTogdGhpcy53aXRoV3JpdGVDb21tb25GaWVsZHModG9vbC5pbnB1dFNjaGVtYSwgc2FmZXR5ICE9PSAncmVhZG9ubHknKSxcbiAgICAgICAgICAgIG91dHB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogeyB0eXBlOiAnYm9vbGVhbicgfSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge30sXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiB7IHR5cGU6IFsnb2JqZWN0JywgJ251bGwnXSB9LFxuICAgICAgICAgICAgICAgICAgICBtZXRhOiB7IHR5cGU6ICdvYmplY3QnIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhhbXBsZXM6IFtdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0b0xpc3RlZFRvb2wobWFuaWZlc3Q6IFYyVG9vbE1hbmlmZXN0KTogVjJMaXN0ZWRUb29sIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5hbWU6IG1hbmlmZXN0Lm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogbWFuaWZlc3QuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICBpbnB1dFNjaGVtYTogbWFuaWZlc3QuaW5wdXRTY2hlbWEsXG4gICAgICAgICAgICBvdXRwdXRTY2hlbWE6IG1hbmlmZXN0Lm91dHB1dFNjaGVtYSxcbiAgICAgICAgICAgIF9tZXRhOiB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IG1hbmlmZXN0LmxheWVyLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBtYW5pZmVzdC5jYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBzYWZldHk6IG1hbmlmZXN0LnNhZmV0eSxcbiAgICAgICAgICAgICAgICBpZGVtcG90ZW50OiBtYW5pZmVzdC5pZGVtcG90ZW50LFxuICAgICAgICAgICAgICAgIHN1cHBvcnRzRHJ5UnVuOiBtYW5pZmVzdC5zdXBwb3J0c0RyeVJ1blxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYnVpbGRNZXRhKHRyYWNlSWQ6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgZHVyYXRpb25NczogbnVtYmVyLCB0aW1lc3RhbXA6IHN0cmluZyk6IFYyUmVzcG9uc2VNZXRhIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHRyYWNlSWQsXG4gICAgICAgICAgICB0b29sOiB0b29sTmFtZSxcbiAgICAgICAgICAgIHZlcnNpb246IHRoaXMudmVyc2lvbixcbiAgICAgICAgICAgIGR1cmF0aW9uTXMsXG4gICAgICAgICAgICB0aW1lc3RhbXBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkU3VjY2Vzc1Jlc3BvbnNlKGRhdGE6IHVua25vd24sIG1ldGE6IFYyUmVzcG9uc2VNZXRhKTogVjJTdHJ1Y3R1cmVkUmVzcG9uc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBlcnJvcjogbnVsbCxcbiAgICAgICAgICAgIG1ldGFcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkRmFpbHVyZVJlc3BvbnNlKGVycm9yOiBSZXR1cm5UeXBlPFYyVG9vbFNlcnZpY2VbJ3RvQnVzaW5lc3NFcnJvciddPiwgbWV0YTogVjJSZXNwb25zZU1ldGEpOiBWMlN0cnVjdHVyZWRSZXNwb25zZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGRhdGE6IG51bGwsXG4gICAgICAgICAgICBlcnJvcixcbiAgICAgICAgICAgIG1ldGFcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRvQnVzaW5lc3NFcnJvcihlcnJvcjogdW5rbm93bik6IHtcbiAgICAgICAgY29kZTogc3RyaW5nO1xuICAgICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgIGRldGFpbHM/OiB1bmtub3duO1xuICAgICAgICBzdWdnZXN0aW9uPzogc3RyaW5nO1xuICAgICAgICByZXRyeWFibGU6IGJvb2xlYW47XG4gICAgICAgIHN0YWdlPzogc3RyaW5nO1xuICAgIH0ge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBWMkJ1c2luZXNzRXJyb3JFeGNlcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvci5idXNpbmVzc0Vycm9yO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IFN0cmluZygoZXJyb3IgYXMgYW55KT8ubWVzc2FnZSA/PyBlcnJvciA/PyAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICByZXR1cm4gY3JlYXRlQnVzaW5lc3NFcnJvcih0aGlzLmluZmVyQnVzaW5lc3NDb2RlRnJvbU1lc3NhZ2UobWVzc2FnZSksIG1lc3NhZ2UsIHtcbiAgICAgICAgICAgIHJldHJ5YWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZWNvcmRUcmFjZShyZWNvcmQ6IFYyVHJhY2VSZWNvcmQpOiB2b2lkIHtcbiAgICAgICAgdGhpcy50cmFjZXMuc2V0KHJlY29yZC50cmFjZUlkLCByZWNvcmQpO1xuICAgICAgICB0aGlzLnRyYWNlT3JkZXIucHVzaChyZWNvcmQudHJhY2VJZCk7XG5cbiAgICAgICAgd2hpbGUgKHRoaXMudHJhY2VPcmRlci5sZW5ndGggPiBNQVhfVFJBQ0VfUkVDT1JEUykge1xuICAgICAgICAgICAgY29uc3Qgb2xkZXN0ID0gdGhpcy50cmFjZU9yZGVyLnNoaWZ0KCk7XG4gICAgICAgICAgICBpZiAoIW9sZGVzdCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy50cmFjZXMuZGVsZXRlKG9sZGVzdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHN1bW1hcml6ZUFyZ3MoYXJnczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgICAgIGNvbnN0IHN1bW1hcnk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoYXJncykpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgc3VtbWFyeVtrZXldID0gdmFsdWUubGVuZ3RoID4gMTIwID8gYCR7dmFsdWUuc2xpY2UoMCwgMTE3KX0uLi5gIDogdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicgfHwgdmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBzdW1tYXJ5W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBzdW1tYXJ5W2tleV0gPSBgYXJyYXkoJHt2YWx1ZS5sZW5ndGh9KWA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzUmVjb3JkKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHN1bW1hcnlba2V5XSA9IGBvYmplY3QoJHtPYmplY3Qua2V5cyh2YWx1ZSkubGVuZ3RofSlgO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdW1tYXJ5W2tleV0gPSB0eXBlb2YgdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3VtbWFyeTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHdyaXRlQ29tbW9uRmllbGRTY2hlbWEoKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZHJ5UnVuOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Li6IHRydWUg5pe25LuF6L+U5Zue5ouf5Y+Y5pu05pGY6KaB77yM5LiN5omn6KGM5a6e6ZmF5YaZ5YWl44CCJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGlkZW1wb3RlbmN5S2V5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfosIPnlKjmlrnmj5DkvpvnmoTluYLnrYnplK7vvIznlKjkuo7ov73ouKrph43lpI3or7fmsYLjgIInXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGltZW91dE1zOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfosIPnlKjotoXml7bmr6vnp5LjgIInXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2xpZW50VGFnOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfosIPnlKjmlrnmoIfor4bjgIInXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHRyYWN0Q2F0ZWdvcnkodG9vbE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdG9vbE5hbWUuaW5kZXhPZignXycpO1xuICAgICAgICBpZiAoaW5kZXggPD0gMCkge1xuICAgICAgICAgICAgcmV0dXJuICdtaXNjJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdG9vbE5hbWUuc2xpY2UoMCwgaW5kZXgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdFZlcmIodG9vbE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gdG9vbE5hbWUuc3BsaXQoJ18nKTtcbiAgICAgICAgaWYgKHNlZ21lbnRzLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VnbWVudHNbMV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNlZ21lbnRzWzBdO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5mZXJMYXllcihjYXRlZ29yeTogc3RyaW5nLCB0b29sTmFtZTogc3RyaW5nKTogVjJUb29sTGF5ZXIge1xuICAgICAgICBpZiAodG9vbE5hbWUuc3RhcnRzV2l0aCgnd29ya2Zsb3dfJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnY29yZSc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2F0ZWdvcnkgPT09ICdkZWJ1ZycgfHwgY2F0ZWdvcnkgPT09ICd2YWxpZGF0aW9uJyB8fCBjYXRlZ29yeSA9PT0gJ2Jyb2FkY2FzdCcpIHtcbiAgICAgICAgICAgIHJldHVybiAnaW50ZXJuYWwnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhdGVnb3J5ID09PSAnc2NlbmVBZHZhbmNlZCcgfHwgY2F0ZWdvcnkgPT09ICdhc3NldEFkdmFuY2VkJyB8fCBjYXRlZ29yeSA9PT0gJ3JlZmVyZW5jZUltYWdlJyB8fCBjYXRlZ29yeSA9PT0gJ3ByZWZlcmVuY2VzJykge1xuICAgICAgICAgICAgcmV0dXJuICdhZHZhbmNlZCc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJ2NvcmUnO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5mZXJTYWZldHkodmVyYjogc3RyaW5nKTogVjJUb29sU2FmZXR5IHtcbiAgICAgICAgY29uc3QgcmVhZG9ubHlWZXJicyA9IG5ldyBTZXQoWydnZXQnLCAnbGlzdCcsICdmaW5kJywgJ3F1ZXJ5JywgJ3ZhbGlkYXRlJywgJ2NoZWNrJ10pO1xuICAgICAgICBjb25zdCBkZXN0cnVjdGl2ZVZlcmJzID0gbmV3IFNldChbJ2RlbGV0ZScsICdyZW1vdmUnLCAnY2xlYXInLCAnY3V0J10pO1xuXG4gICAgICAgIGlmIChyZWFkb25seVZlcmJzLmhhcyh2ZXJiKSkge1xuICAgICAgICAgICAgcmV0dXJuICdyZWFkb25seSc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVzdHJ1Y3RpdmVWZXJicy5oYXModmVyYikpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGVzdHJ1Y3RpdmUnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICdtdXRhdGluZyc7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbmZlcklkZW1wb3RlbnQodmVyYjogc3RyaW5nLCBzYWZldHk6IFYyVG9vbFNhZmV0eSk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoc2FmZXR5ID09PSAncmVhZG9ubHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlkZW1wb3RlbnRWZXJicyA9IG5ldyBTZXQoWydzZXQnLCAndXBkYXRlJywgJ3ZhbGlkYXRlJywgJ2NoZWNrJ10pO1xuICAgICAgICByZXR1cm4gaWRlbXBvdGVudFZlcmJzLmhhcyh2ZXJiKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRvUmlza0xldmVsKHNhZmV0eTogVjJUb29sU2FmZXR5KTogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJyB7XG4gICAgICAgIGlmIChzYWZldHkgPT09ICdkZXN0cnVjdGl2ZScpIHtcbiAgICAgICAgICAgIHJldHVybiAnaGlnaCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2FmZXR5ID09PSAnbXV0YXRpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gJ21lZGl1bSc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJ2xvdyc7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBidWlsZEdlbmVyaWNDaGFuZ2VzKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogQXJyYXk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+IHtcbiAgICAgICAgY29uc3QgZmllbGRzID0gT2JqZWN0LmtleXMoYXJncyk7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiB0b29sTmFtZSxcbiAgICAgICAgICAgICAgICBmaWVsZDogZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHMuam9pbignLCcpIDogJ3Vua25vd24nLFxuICAgICAgICAgICAgICAgIGZyb206IG51bGwsXG4gICAgICAgICAgICAgICAgdG86IHRoaXMuc3VtbWFyaXplQXJncyhhcmdzKVxuICAgICAgICAgICAgfVxuICAgICAgICBdO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVhZFBhdGgoc291cmNlOiB1bmtub3duLCBwYXRoOiBzdHJpbmcpOiB1bmtub3duIHtcbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBjdXJyZW50OiB1bmtub3duID0gc291cmNlO1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VnbWVudCBvZiBzZWdtZW50cykge1xuICAgICAgICAgICAgaWYgKCFpc1JlY29yZChjdXJyZW50KSB8fCAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGN1cnJlbnQsIHNlZ21lbnQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W3NlZ21lbnRdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxufVxuIl19