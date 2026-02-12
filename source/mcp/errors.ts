export enum JsonRpcErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603
}

export interface JsonRpcErrorObject {
    code: number;
    message: string;
    data?: unknown;
}

export interface JsonRpcErrorResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    error: JsonRpcErrorObject;
}

export function createJsonRpcError(
    code: JsonRpcErrorCode | number,
    message: string,
    data?: unknown
): JsonRpcErrorObject {
    const error: JsonRpcErrorObject = {
        code,
        message
    };

    if (data !== undefined) {
        error.data = data;
    }

    return error;
}

export function createJsonRpcErrorResponse(
    id: string | number | null,
    code: JsonRpcErrorCode | number,
    message: string,
    data?: unknown
): JsonRpcErrorResponse {
    return {
        jsonrpc: '2.0',
        id,
        error: createJsonRpcError(code, message, data)
    };
}
