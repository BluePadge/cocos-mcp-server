import { randomUUID } from 'crypto';
import { ToolDefinition } from '../types';
import { isRecord } from './messages';
import {
    V2ListedTool,
    V2ResponseMeta,
    V2StructuredResponse,
    V2ToolDescriptor,
    V2ToolExecutionContext,
    V2ToolExecutionOutput,
    V2ToolLayer,
    V2ToolManifest,
    V2ToolSafety,
    V2TraceRecord
} from './v2-models';
import {
    V2BusinessErrorException,
    V2_ERROR_CODES,
    createBusinessError
} from './v2-errors';
import { createWorkflowToolDescriptors } from './v2-workflow-tools';

type LegacyToolInvoker = (toolName: string, args: any) => Promise<any>;

interface V2ToolServiceOptions {
    version?: string;
    now?: () => number;
    traceIdGenerator?: () => string;
    visibleLayers?: V2ToolLayer[];
}

interface WriteCommonArgs {
    dryRun?: unknown;
    idempotencyKey?: unknown;
    timeoutMs?: unknown;
    clientTag?: unknown;
}

const WRITE_ARG_KEYS = new Set(['dryRun', 'idempotencyKey', 'timeoutMs', 'clientTag']);
const DEFAULT_VERSION = '2.0.0';
const TRACE_PREFIX = 'trc_';
const MAX_TRACE_RECORDS = 300;

export class V2ToolService {
    private readonly descriptors = new Map<string, V2ToolDescriptor>();
    private readonly traces = new Map<string, V2TraceRecord>();
    private readonly traceOrder: string[] = [];
    private readonly version: string;
    private readonly now: () => number;
    private readonly traceIdGenerator: () => string;
    private readonly visibleLayers: Set<V2ToolLayer>;
    private readonly legacyInvoker: LegacyToolInvoker;

    constructor(
        legacyTools: ToolDefinition[],
        legacyInvoker: LegacyToolInvoker,
        options: V2ToolServiceOptions = {}
    ) {
        this.version = options.version ?? DEFAULT_VERSION;
        this.now = options.now ?? (() => Date.now());
        this.traceIdGenerator = options.traceIdGenerator ?? (() => `${TRACE_PREFIX}${randomUUID()}`);
        this.visibleLayers = new Set(options.visibleLayers ?? ['core']);
        this.legacyInvoker = legacyInvoker;

        this.registerLegacyTools(legacyTools);
        this.registerWorkflowTools();
        this.registerInternalTools();
    }

    public listTools(): V2ListedTool[] {
        const result: V2ListedTool[] = [];

        for (const descriptor of this.descriptors.values()) {
            if (!this.visibleLayers.has(descriptor.manifest.layer)) {
                continue;
            }

            result.push(this.toListedTool(descriptor.manifest));
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }

    public hasTool(toolName: string): boolean {
        return this.descriptors.has(toolName);
    }

    public getManifest(toolName: string): V2ToolManifest | null {
        return this.descriptors.get(toolName)?.manifest ?? null;
    }

    public getTraceById(traceId: string): V2TraceRecord | null {
        return this.traces.get(traceId) ?? null;
    }

    public async callTool(rawToolName: string, rawArgs: unknown): Promise<V2ToolExecutionOutput> {
        const descriptor = this.descriptors.get(rawToolName);
        if (!descriptor) {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, `Unknown tool: ${rawToolName}`, {
                    details: { tool: rawToolName },
                    suggestion: '请先调用 tools/list 获取可用工具名称。',
                    retryable: false
                })
            );
        }

        const traceId = this.traceIdGenerator();
        const startedAt = this.now();
        const timestamp = new Date(startedAt).toISOString();
        const args = isRecord(rawArgs) ? rawArgs : {};

        const context: V2ToolExecutionContext = {
            traceId,
            tool: rawToolName,
            now: this.now,
            callLegacyTool: this.legacyInvoker,
            getManifest: (toolName: string) => this.getManifest(toolName),
            getTraceById: (id: string) => this.getTraceById(id)
        };

        try {
            const data = await descriptor.execute(args, context);
            const durationMs = this.now() - startedAt;
            const structuredContent = this.buildSuccessResponse(
                data,
                this.buildMeta(traceId, rawToolName, durationMs, timestamp)
            );

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
        } catch (error: any) {
            const durationMs = this.now() - startedAt;
            const businessError = this.toBusinessError(error);
            const structuredContent = this.buildFailureResponse(
                businessError,
                this.buildMeta(traceId, rawToolName, durationMs, timestamp)
            );

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

    public validateWriteCommonArgs(args: Record<string, unknown>): { dryRun: boolean } {
        const raw = args as WriteCommonArgs;

        if (raw.dryRun !== undefined && typeof raw.dryRun !== 'boolean') {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'dryRun 必须是 boolean 类型', {
                    details: { field: 'dryRun' },
                    suggestion: '请传入 true 或 false。',
                    retryable: false
                })
            );
        }

        if (raw.idempotencyKey !== undefined && typeof raw.idempotencyKey !== 'string') {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'idempotencyKey 必须是 string 类型', {
                    details: { field: 'idempotencyKey' },
                    retryable: false
                })
            );
        }

        if (raw.timeoutMs !== undefined && typeof raw.timeoutMs !== 'number') {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'timeoutMs 必须是 number 类型', {
                    details: { field: 'timeoutMs' },
                    retryable: false
                })
            );
        }

        if (raw.clientTag !== undefined && typeof raw.clientTag !== 'string') {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'clientTag 必须是 string 类型', {
                    details: { field: 'clientTag' },
                    retryable: false
                })
            );
        }

        return {
            dryRun: raw.dryRun === true
        };
    }

    public withWriteCommonFields(schema: unknown, supportsWrite: boolean): Record<string, unknown> {
        if (!isRecord(schema)) {
            return {
                type: 'object',
                properties: supportsWrite ? this.writeCommonFieldSchema() : {}
            };
        }

        const normalized = {
            ...schema,
            properties: isRecord(schema.properties) ? { ...schema.properties } : {}
        } as Record<string, unknown>;

        if (supportsWrite) {
            Object.assign(normalized.properties as Record<string, unknown>, this.writeCommonFieldSchema());
        }

        return normalized;
    }

    public ensureLegacySuccess(result: unknown, stage: string): void {
        if (!isRecord(result) || result.success !== false) {
            return;
        }

        const message = this.pickString(result, ['error', 'message']) ?? `阶段 ${stage} 执行失败`;
        const suggestion = this.pickString(result, ['instruction']);

        throw new V2BusinessErrorException(
            createBusinessError(this.inferBusinessCodeFromMessage(message), message, {
                stage,
                details: result,
                suggestion: suggestion ?? undefined,
                retryable: false
            })
        );
    }

    public inferBusinessCodeFromMessage(message: string): string {
        const normalized = message.toLowerCase();

        if (normalized.includes('not found') || normalized.includes('不存在')) {
            return V2_ERROR_CODES.NOT_FOUND;
        }

        if (normalized.includes('timeout') || normalized.includes('超时')) {
            return V2_ERROR_CODES.TIMEOUT;
        }

        if (normalized.includes('conflict') || normalized.includes('冲突') || normalized.includes('already exists')) {
            return V2_ERROR_CODES.CONFLICT;
        }

        if (normalized.includes('precondition') || normalized.includes('前置')) {
            return V2_ERROR_CODES.PRECONDITION_FAILED;
        }

        if (normalized.includes('invalid') || normalized.includes('required') || normalized.includes('参数')) {
            return V2_ERROR_CODES.INVALID_ARGUMENT;
        }

        if (normalized.includes('unavailable') || normalized.includes('not running') || normalized.includes('不可用')) {
            return V2_ERROR_CODES.UNAVAILABLE;
        }

        return V2_ERROR_CODES.INTERNAL;
    }

    public pickValue(source: unknown, paths: string[]): unknown {
        for (const path of paths) {
            const value = this.readPath(source, path);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }

    public pickString(source: unknown, paths: string[]): string | null {
        const value = this.pickValue(source, paths);
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
        return null;
    }

    private registerLegacyTools(legacyTools: ToolDefinition[]): void {
        for (const tool of legacyTools) {
            const manifest = this.buildLegacyManifest(tool);
            this.registerTool({
                manifest,
                execute: async (args) => this.executeLegacyTool(manifest, args)
            });
        }
    }

    private registerWorkflowTools(): void {
        const descriptors = createWorkflowToolDescriptors({
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

    private registerInternalTools(): void {
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
                    throw new V2BusinessErrorException(
                        createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'traceId is required', {
                            details: { field: 'traceId' },
                            retryable: false
                        })
                    );
                }

                return {
                    trace: context.getTraceById(traceId)
                };
            }
        });
    }

    private registerTool(descriptor: V2ToolDescriptor): void {
        this.descriptors.set(descriptor.manifest.name, descriptor);
    }

    private async executeLegacyTool(manifest: V2ToolManifest, args: Record<string, unknown>): Promise<unknown> {
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

        const data: Record<string, unknown> = {
            result: legacyResult
        };

        if (manifest.safety !== 'readonly') {
            data.riskLevel = this.toRiskLevel(manifest.safety);
            data.changes = this.buildGenericChanges(manifest.name, legacyArgs);
        }

        return data;
    }

    private stripWriteCommonArgs(args: Record<string, unknown>): Record<string, unknown> {
        const clean: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(args)) {
            if (WRITE_ARG_KEYS.has(key)) {
                continue;
            }
            clean[key] = value;
        }

        return clean;
    }

    private buildLegacyManifest(tool: ToolDefinition): V2ToolManifest {
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

    private toListedTool(manifest: V2ToolManifest): V2ListedTool {
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

    private buildMeta(traceId: string, toolName: string, durationMs: number, timestamp: string): V2ResponseMeta {
        return {
            traceId,
            tool: toolName,
            version: this.version,
            durationMs,
            timestamp
        };
    }

    private buildSuccessResponse(data: unknown, meta: V2ResponseMeta): V2StructuredResponse {
        return {
            success: true,
            data,
            error: null,
            meta
        };
    }

    private buildFailureResponse(error: ReturnType<V2ToolService['toBusinessError']>, meta: V2ResponseMeta): V2StructuredResponse {
        return {
            success: false,
            data: null,
            error,
            meta
        };
    }

    private toBusinessError(error: unknown): {
        code: string;
        message: string;
        details?: unknown;
        suggestion?: string;
        retryable: boolean;
        stage?: string;
    } {
        if (error instanceof V2BusinessErrorException) {
            return error.businessError;
        }

        const message = String((error as any)?.message ?? error ?? 'Unknown error');
        return createBusinessError(this.inferBusinessCodeFromMessage(message), message, {
            retryable: false
        });
    }

    private recordTrace(record: V2TraceRecord): void {
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

    private summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
        const summary: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') {
                summary[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
            } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                summary[key] = value;
            } else if (Array.isArray(value)) {
                summary[key] = `array(${value.length})`;
            } else if (isRecord(value)) {
                summary[key] = `object(${Object.keys(value).length})`;
            } else {
                summary[key] = typeof value;
            }
        }

        return summary;
    }

    private writeCommonFieldSchema(): Record<string, unknown> {
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

    private extractCategory(toolName: string): string {
        const index = toolName.indexOf('_');
        if (index <= 0) {
            return 'misc';
        }
        return toolName.slice(0, index);
    }

    private extractVerb(toolName: string): string {
        const segments = toolName.split('_');
        if (segments.length >= 2) {
            return segments[1];
        }
        return segments[0];
    }

    private inferLayer(category: string, toolName: string): V2ToolLayer {
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

    private inferSafety(verb: string): V2ToolSafety {
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

    private inferIdempotent(verb: string, safety: V2ToolSafety): boolean {
        if (safety === 'readonly') {
            return true;
        }

        const idempotentVerbs = new Set(['set', 'update', 'validate', 'check']);
        return idempotentVerbs.has(verb);
    }

    private toRiskLevel(safety: V2ToolSafety): 'low' | 'medium' | 'high' {
        if (safety === 'destructive') {
            return 'high';
        }

        if (safety === 'mutating') {
            return 'medium';
        }

        return 'low';
    }

    private buildGenericChanges(toolName: string, args: Record<string, unknown>): Array<Record<string, unknown>> {
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

    private readPath(source: unknown, path: string): unknown {
        const segments = path.split('.');
        let current: unknown = source;

        for (const segment of segments) {
            if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
                return undefined;
            }
            current = current[segment];
        }

        return current;
    }
}
