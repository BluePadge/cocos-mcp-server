import { JsonRpcNotification, JsonRpcRequest } from './messages';
import { McpSession } from './session-store';

export const MCP_METHODS = {
    Initialize: 'initialize',
    InitializedNotification: 'notifications/initialized',
    ToolsList: 'tools/list',
    ToolsCall: 'tools/call',
    GetToolManifest: 'get_tool_manifest',
    GetTraceById: 'get_trace_by_id',
    Ping: 'ping'
} as const;

export function isInitializeMethod(method: string): boolean {
    return method === MCP_METHODS.Initialize;
}

export function isInitializedNotification(method: string): boolean {
    return method === MCP_METHODS.InitializedNotification;
}

export function isNotificationMethod(method: string): boolean {
    return method.startsWith('notifications/');
}

export function requiresSessionHeader(method: string): boolean {
    return !isInitializeMethod(method);
}

export function canHandleBeforeReady(method: string, isNotification: boolean): boolean {
    if (isInitializeMethod(method)) {
        return true;
    }

    if (isNotification && isInitializedNotification(method)) {
        return true;
    }

    return false;
}

export function ensureInitializeIsRequest(message: JsonRpcRequest | JsonRpcNotification): boolean {
    return Object.prototype.hasOwnProperty.call(message, 'id');
}

export function isSessionReady(session: McpSession): boolean {
    return session.phase === 'ready';
}
