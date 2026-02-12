import { ToolDefinition } from '../types';

export type V2ToolLayer = 'core' | 'advanced' | 'internal';
export type V2ToolSafety = 'readonly' | 'mutating' | 'destructive';
export type V2RiskLevel = 'low' | 'medium' | 'high';

export interface V2BusinessError {
    code: string;
    message: string;
    details?: unknown;
    suggestion?: string;
    retryable: boolean;
    stage?: string;
}

export interface V2ResponseMeta {
    traceId: string;
    tool: string;
    version: string;
    durationMs: number;
    timestamp: string;
}

export interface V2StructuredResponse<T = unknown> {
    success: boolean;
    data: T | null;
    error: V2BusinessError | null;
    meta: V2ResponseMeta;
}

export interface V2ToolManifest {
    name: string;
    layer: V2ToolLayer;
    category: string;
    safety: V2ToolSafety;
    idempotent: boolean;
    supportsDryRun: boolean;
    prerequisites: string[];
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    examples: Array<Record<string, unknown>>;
    description: string;
}

export interface V2ListedTool extends ToolDefinition {
    outputSchema: Record<string, unknown>;
    _meta: {
        layer: V2ToolLayer;
        category: string;
        safety: V2ToolSafety;
        idempotent: boolean;
        supportsDryRun: boolean;
    };
}

export interface V2ToolExecutionOutput {
    isError: boolean;
    structuredContent: V2StructuredResponse;
    contentText: string;
}

export interface V2TraceRecord {
    traceId: string;
    tool: string;
    timestamp: string;
    durationMs: number;
    success: boolean;
    errorCode: string | null;
    argsSummary: Record<string, unknown>;
}

export interface V2ToolExecutionContext {
    traceId: string;
    tool: string;
    now: () => number;
    callLegacyTool: (legacyName: string, args: any) => Promise<any>;
    getManifest: (toolName: string) => V2ToolManifest | null;
    getTraceById: (traceId: string) => V2TraceRecord | null;
}

export interface V2ToolDescriptor {
    manifest: V2ToolManifest;
    execute: (args: Record<string, unknown>, context: V2ToolExecutionContext) => Promise<unknown>;
}
