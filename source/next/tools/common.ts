import { NextToolResult } from '../models';

export function ok(data: any): NextToolResult {
    return {
        success: true,
        data
    };
}

export function fail(message: string, detail?: string, code: string = 'E_EDITOR_CALL_FAILED'): NextToolResult {
    return {
        success: false,
        error: {
            code,
            message,
            detail
        }
    };
}

export function normalizeError(error: any): string {
    if (error && typeof error === 'object' && typeof error.message === 'string') {
        return error.message;
    }
    return String(error);
}

export function toNonEmptyString(value: any): string | null {
    if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
    }
    return null;
}

export function toStringList(value: any): string[] {
    if (typeof value === 'string' && value.trim() !== '') {
        return [value.trim()];
    }

    if (Array.isArray(value)) {
        const list = value
            .filter((item) => typeof item === 'string' && item.trim() !== '')
            .map((item) => item.trim());
        return Array.from(new Set(list));
    }

    return [];
}

export function unwrapDumpValue(value: any): any {
    if (value && typeof value === 'object' && 'value' in value) {
        return (value as { value: any }).value;
    }
    return value;
}

export function readDumpString(value: any): string | null {
    const raw = unwrapDumpValue(value);
    return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}
