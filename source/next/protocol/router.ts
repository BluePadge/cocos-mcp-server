import { randomUUID } from 'crypto';
import { JsonRpcRequestMessage, JsonRpcResponseMessage, NextToolResult } from '../models';
import { NextToolRegistry } from './tool-registry';

interface NextTraceRecord {
    traceId: string;
    tool: string;
    timestamp: string;
    durationMs: number;
    success: boolean;
    errorCode: string | null;
    argsSummary: Record<string, string>;
}

function makeError(id: string | number | null, code: number, message: string, data?: any): JsonRpcResponseMessage {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            data
        }
    };
}

export class NextMcpRouter {
    private readonly registry: NextToolRegistry;
    private readonly traces = new Map<string, NextTraceRecord>();
    private readonly traceOrder: string[] = [];
    private readonly maxTraceRecords: number;

    constructor(registry: NextToolRegistry, maxTraceRecords: number = 300) {
        this.registry = registry;
        this.maxTraceRecords = maxTraceRecords;
    }

    public async handle(message: JsonRpcRequestMessage): Promise<JsonRpcResponseMessage | null> {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            return makeError(null, -32600, 'Invalid Request');
        }

        const isNotification = message.id === undefined;
        if (isNotification) {
            return null;
        }

        const id = message.id ?? null;

        switch (message.method) {
            case 'tools/list':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: this.registry.listTools()
                    }
                };

            case 'tools/call':
                return await this.handleToolCall(id, message.params);

            case 'get_tool_manifest':
                return this.handleGetManifest(id, message.params);

            case 'get_trace_by_id':
                return this.handleGetTraceById(id, message.params);

            case 'get_capability_matrix':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: this.registry.getCapabilityMatrix()
                };

            default:
                return makeError(id, -32601, `Method not found: ${message.method}`);
        }
    }

    private async handleToolCall(id: string | number | null, params: any): Promise<JsonRpcResponseMessage> {
        const name = params?.name;
        const args = params?.arguments ?? {};

        if (typeof name !== 'string' || name.trim() === '') {
            return makeError(id, -32602, 'Invalid params: name is required');
        }

        const tool = this.registry.getTool(name);
        if (!tool) {
            return makeError(id, -32602, `Unknown or unavailable tool: ${name}`);
        }

        try {
            const startedAt = Date.now();
            const timestamp = new Date(startedAt).toISOString();
            const traceId = randomUUID();
            const result = await tool.run(args);
            const wrapped = this.wrapToolResult(name, traceId, startedAt, timestamp, result);
            this.recordTrace({
                traceId,
                tool: name,
                timestamp,
                durationMs: wrapped.structuredContent.meta.durationMs,
                success: result.success,
                errorCode: result.success ? null : (result.error?.code ?? 'E_UNKNOWN'),
                argsSummary: this.summarizeArgs(args)
            });
            return {
                jsonrpc: '2.0',
                id,
                result: wrapped
            };
        } catch (error: any) {
            return makeError(id, -32603, error?.message || String(error));
        }
    }

    private handleGetManifest(id: string | number | null, params: any): JsonRpcResponseMessage {
        const name = params?.name;
        if (typeof name !== 'string' || name.trim() === '') {
            return makeError(id, -32602, 'Invalid params: name is required');
        }

        const manifest = this.registry.getManifest(name);
        if (!manifest) {
            return makeError(id, -32602, `Unknown tool: ${name}`);
        }

        return {
            jsonrpc: '2.0',
            id,
            result: manifest
        };
    }

    private handleGetTraceById(id: string | number | null, params: any): JsonRpcResponseMessage {
        const traceId = params?.traceId;
        if (typeof traceId !== 'string' || traceId.trim() === '') {
            return makeError(id, -32602, 'Invalid params: traceId is required');
        }

        return {
            jsonrpc: '2.0',
            id,
            result: {
                trace: this.traces.get(traceId) || null
            }
        };
    }

    private wrapToolResult(
        toolName: string,
        traceId: string,
        startedAt: number,
        timestamp: string,
        result: NextToolResult
    ): any {
        const durationMs = Date.now() - startedAt;
        const meta = {
            traceId,
            tool: toolName,
            version: 'next-0.1.0',
            durationMs,
            timestamp
        };

        const structuredContent = result.success
            ? {
                success: true,
                data: result.data,
                meta
            }
            : {
                success: false,
                error: result.error,
                meta
            };

        return {
            content: [
                {
                    type: 'text',
                    text: result.success ? `工具执行成功: ${toolName}` : `工具执行失败: ${toolName}`
                }
            ],
            structuredContent,
            isError: !result.success
        };
    }

    private recordTrace(trace: NextTraceRecord): void {
        this.traces.set(trace.traceId, trace);
        this.traceOrder.push(trace.traceId);

        while (this.traceOrder.length > this.maxTraceRecords) {
            const oldest = this.traceOrder.shift();
            if (oldest) {
                this.traces.delete(oldest);
            }
        }
    }

    private summarizeArgs(args: any): Record<string, string> {
        if (!args || typeof args !== 'object' || Array.isArray(args)) {
            return {};
        }

        const summary: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') {
                summary[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
                continue;
            }
            if (typeof value === 'number' || typeof value === 'boolean') {
                summary[key] = String(value);
                continue;
            }
            if (value === null) {
                summary[key] = 'null';
                continue;
            }
            if (Array.isArray(value)) {
                summary[key] = `array(${value.length})`;
                continue;
            }
            summary[key] = 'object';
        }
        return summary;
    }
}
