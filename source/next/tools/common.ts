import { NextToolResult } from '../models';

export type ValueKind = 'auto' | 'boolean' | 'number' | 'string' | 'json';

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

export function normalizeValueKind(value: any): ValueKind | null {
    if (value === undefined || value === null) {
        return 'auto';
    }
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'auto' || normalized === 'boolean' || normalized === 'number' || normalized === 'string' || normalized === 'json') {
        return normalized as ValueKind;
    }
    return null;
}

function detectValueType(value: any): string {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    return typeof value;
}

export function coerceValueByKind(
    value: any,
    valueKind: ValueKind
): { ok: true; value: any; appliedType: string } | { ok: false; error: string } {
    if (valueKind === 'auto') {
        return {
            ok: true,
            value,
            appliedType: detectValueType(value)
        };
    }

    if (valueKind === 'boolean') {
        if (typeof value === 'boolean') {
            return { ok: true, value, appliedType: 'boolean' };
        }
        if (typeof value === 'number' && (value === 0 || value === 1)) {
            return { ok: true, value: value === 1, appliedType: 'boolean' };
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1') {
                return { ok: true, value: true, appliedType: 'boolean' };
            }
            if (normalized === 'false' || normalized === '0') {
                return { ok: true, value: false, appliedType: 'boolean' };
            }
        }
        return { ok: false, error: 'valueKind=boolean 时仅支持 true/false/1/0' };
    }

    if (valueKind === 'number') {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return { ok: true, value, appliedType: 'number' };
        }
        if (typeof value === 'string') {
            const parsed = Number(value.trim());
            if (Number.isFinite(parsed)) {
                return { ok: true, value: parsed, appliedType: 'number' };
            }
        }
        return { ok: false, error: 'valueKind=number 时仅支持可解析为有限数字的值' };
    }

    if (valueKind === 'string') {
        if (typeof value === 'string') {
            return { ok: true, value, appliedType: 'string' };
        }
        return { ok: true, value: String(value), appliedType: 'string' };
    }

    if (valueKind === 'json') {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return {
                    ok: true,
                    value: parsed,
                    appliedType: detectValueType(parsed)
                };
            } catch (error: any) {
                return { ok: false, error: `valueKind=json 解析失败：${String(error?.message || error)}` };
            }
        }
        return {
            ok: true,
            value,
            appliedType: detectValueType(value)
        };
    }

    return { ok: false, error: `不支持的 valueKind: ${String(valueKind)}` };
}
