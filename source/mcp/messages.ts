import { JsonRpcErrorObject } from './errors';

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: JsonRpcId;
    method: string;
    params?: unknown;
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}

export interface JsonRpcSuccessResponse {
    jsonrpc: '2.0';
    id: JsonRpcId;
    result: unknown;
}

export interface JsonRpcErrorResponseMessage {
    jsonrpc: '2.0';
    id: JsonRpcId;
    error: JsonRpcErrorObject;
}

export type JsonRpcResponseMessage = JsonRpcSuccessResponse | JsonRpcErrorResponseMessage;

export type JsonRpcIncomingMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponseMessage;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOwnProperty<T extends string>(
    value: Record<string, unknown>,
    key: T
): value is Record<string, unknown> & Record<T, unknown> {
    return Object.prototype.hasOwnProperty.call(value, key);
}

export function isValidJsonRpcId(value: unknown): value is JsonRpcId {
    return value === null || typeof value === 'string' || typeof value === 'number';
}

export function isJsonRpcEnvelope(value: unknown): value is Record<string, unknown> {
    if (!isRecord(value)) {
        return false;
    }

    if (!hasOwnProperty(value, 'jsonrpc')) {
        return false;
    }

    return value.jsonrpc === '2.0';
}

export function isRequestMessage(value: unknown): value is JsonRpcRequest {
    if (!isJsonRpcEnvelope(value)) {
        return false;
    }

    if (!hasOwnProperty(value, 'method') || typeof value.method !== 'string') {
        return false;
    }

    if (!hasOwnProperty(value, 'id') || !isValidJsonRpcId(value.id)) {
        return false;
    }

    // request 不能同时包含 result/error
    if (hasOwnProperty(value, 'result') || hasOwnProperty(value, 'error')) {
        return false;
    }

    return true;
}

export function isNotificationMessage(value: unknown): value is JsonRpcNotification {
    if (!isJsonRpcEnvelope(value)) {
        return false;
    }

    if (!hasOwnProperty(value, 'method') || typeof value.method !== 'string') {
        return false;
    }

    // notification 必须没有 id
    if (hasOwnProperty(value, 'id')) {
        return false;
    }

    if (hasOwnProperty(value, 'result') || hasOwnProperty(value, 'error')) {
        return false;
    }

    return true;
}

export function isResponseMessage(value: unknown): value is JsonRpcResponseMessage {
    if (!isJsonRpcEnvelope(value)) {
        return false;
    }

    if (!hasOwnProperty(value, 'id') || !isValidJsonRpcId(value.id)) {
        return false;
    }

    const hasResult = hasOwnProperty(value, 'result');
    const hasError = hasOwnProperty(value, 'error');
    const hasMethod = hasOwnProperty(value, 'method');

    if (hasMethod) {
        return false;
    }

    if (hasResult === hasError) {
        return false;
    }

    if (hasError && !isRecord(value.error)) {
        return false;
    }

    return true;
}
