import { V2BusinessError } from './v2-models';

export const V2_ERROR_CODES = {
    INVALID_ARGUMENT: 'E_INVALID_ARGUMENT',
    NOT_FOUND: 'E_NOT_FOUND',
    CONFLICT: 'E_CONFLICT',
    PRECONDITION_FAILED: 'E_PRECONDITION_FAILED',
    TIMEOUT: 'E_TIMEOUT',
    INTERNAL: 'E_INTERNAL',
    UNAVAILABLE: 'E_UNAVAILABLE'
} as const;

export class V2BusinessErrorException extends Error {
    public readonly businessError: V2BusinessError;

    constructor(error: V2BusinessError) {
        super(error.message);
        this.businessError = error;
        this.name = 'V2BusinessErrorException';
    }
}

export function createBusinessError(
    code: string,
    message: string,
    options: {
        details?: unknown;
        suggestion?: string;
        retryable?: boolean;
        stage?: string;
    } = {}
): V2BusinessError {
    return {
        code,
        message,
        details: options.details,
        suggestion: options.suggestion,
        retryable: options.retryable ?? false,
        stage: options.stage
    };
}

export function toBusinessError(error: unknown): V2BusinessError {
    if (error instanceof V2BusinessErrorException) {
        return error.businessError;
    }

    const message = String((error as any)?.message ?? error ?? 'Unknown error');
    const normalized = message.toLowerCase();

    if (normalized.includes('timeout') || normalized.includes('超时')) {
        return createBusinessError(V2_ERROR_CODES.TIMEOUT, message, { retryable: true });
    }

    if (
        normalized.includes('not found')
        || normalized.includes('不存在')
        || normalized.includes('invalid mcp-session-id')
    ) {
        return createBusinessError(V2_ERROR_CODES.NOT_FOUND, message, { retryable: false });
    }

    if (normalized.includes('conflict') || normalized.includes('冲突') || normalized.includes('already exists')) {
        return createBusinessError(V2_ERROR_CODES.CONFLICT, message, { retryable: false });
    }

    if (
        normalized.includes('precondition')
        || normalized.includes('session is not ready')
        || normalized.includes('前置')
    ) {
        return createBusinessError(V2_ERROR_CODES.PRECONDITION_FAILED, message, { retryable: false });
    }

    if (normalized.includes('unavailable') || normalized.includes('不可用') || normalized.includes('not running')) {
        return createBusinessError(V2_ERROR_CODES.UNAVAILABLE, message, { retryable: true });
    }

    return createBusinessError(V2_ERROR_CODES.INTERNAL, message, { retryable: false });
}
