import { createJsonRpcErrorResponse, JsonRpcErrorCode, JsonRpcErrorResponse } from './errors';

export interface JsonRpcParseSuccess {
    ok: true;
    payload: unknown;
}

export interface JsonRpcParseFailure {
    ok: false;
    response: JsonRpcErrorResponse;
}

export type JsonRpcParseResult = JsonRpcParseSuccess | JsonRpcParseFailure;

export function parseJsonRpcBody(rawBody: string): JsonRpcParseResult {
    const body = rawBody.trim();

    if (!body) {
        return {
            ok: false,
            response: createJsonRpcErrorResponse(
                null,
                JsonRpcErrorCode.InvalidRequest,
                'Invalid Request: request body cannot be empty'
            )
        };
    }

    try {
        return {
            ok: true,
            payload: JSON.parse(body)
        };
    } catch (error: any) {
        return {
            ok: false,
            response: createJsonRpcErrorResponse(
                null,
                JsonRpcErrorCode.ParseError,
                `Parse error: ${error.message}`
            )
        };
    }
}

export async function readRawBody(req: NodeJS.ReadableStream): Promise<string> {
    let body = '';

    for await (const chunk of req) {
        body += chunk.toString();
    }

    return body;
}
