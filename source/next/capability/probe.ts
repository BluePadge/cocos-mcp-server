import { CapabilityCheck, CapabilityMatrix, CapabilityRecord, EditorRequester } from '../models';
import { DEFAULT_CAPABILITY_CHECKS } from './method-catalog';
import { defaultEditorRequester } from '../editor-requester';

export interface ProbeOptions {
    checks?: CapabilityCheck[];
    includeWriteChecks?: boolean;
    requester?: EditorRequester;
}

const CREATE_NODE_CHECK_KEY = 'scene.create-node';

function isMethodMissingError(errorMessage: string): boolean {
    return /message does not exist|unknown method|cannot find|not exist|not found/i.test(errorMessage);
}

function normalizeError(error: any): string {
    if (error && typeof error === 'object' && typeof error.message === 'string') {
        return error.message;
    }
    return String(error);
}

export class CapabilityProbe {
    private readonly requester: EditorRequester;

    constructor(requester: EditorRequester = defaultEditorRequester) {
        this.requester = requester;
    }

    public async run(options: ProbeOptions = {}): Promise<CapabilityMatrix> {
        const checks = options.checks ?? DEFAULT_CAPABILITY_CHECKS;
        const includeWriteChecks = options.includeWriteChecks === true;
        const requester = options.requester ?? this.requester;

        const filteredChecks = checks.filter((item) => includeWriteChecks || item.readonly);
        const byKey: Record<string, CapabilityRecord> = {};

        for (const check of filteredChecks) {
            const checkedAt = new Date().toISOString();
            try {
                const result = await requester(check.channel, check.method, ...(check.args ?? []));
                const detail = await this.cleanupProbeSideEffects(check, result, requester);
                byKey[check.key] = {
                    key: check.key,
                    channel: check.channel,
                    method: check.method,
                    layer: check.layer,
                    readonly: check.readonly,
                    description: check.description,
                    available: true,
                    checkedAt,
                    detail
                };
            } catch (error: any) {
                const message = normalizeError(error);
                const methodMissing = isMethodMissingError(message);
                byKey[check.key] = {
                    key: check.key,
                    channel: check.channel,
                    method: check.method,
                    layer: check.layer,
                    readonly: check.readonly,
                    description: check.description,
                    // 运行时报错但非“方法不存在”时，仍视为方法可见（通常是参数或上下文限制）
                    available: !methodMissing,
                    checkedAt,
                    detail: message
                };
            }
        }

        const records = Object.values(byKey);
        const summary = {
            total: records.length,
            available: records.filter((item) => item.available).length,
            unavailable: records.filter((item) => !item.available).length,
            byLayer: {
                official: this.buildLayerSummary(records, 'official'),
                extended: this.buildLayerSummary(records, 'extended'),
                experimental: this.buildLayerSummary(records, 'experimental')
            }
        };

        return {
            generatedAt: new Date().toISOString(),
            byKey,
            summary
        };
    }

    private buildLayerSummary(records: CapabilityRecord[], layer: 'official' | 'extended' | 'experimental'): { total: number; available: number } {
        const sameLayer = records.filter((item) => item.layer === layer);
        return {
            total: sameLayer.length,
            available: sameLayer.filter((item) => item.available).length
        };
    }

    private async cleanupProbeSideEffects(
        check: CapabilityCheck,
        result: any,
        requester: EditorRequester
    ): Promise<string> {
        if (check.key !== CREATE_NODE_CHECK_KEY) {
            return 'ok';
        }

        const uuids = this.extractCreatedNodeUuids(result);
        if (uuids.length === 0) {
            return 'ok (create-node probe: no created node detected)';
        }

        const cleanupError = await this.removeProbeNodes(uuids, requester);
        if (!cleanupError) {
            return `ok (create-node probe rollback: removed ${uuids.length} node(s))`;
        }

        return `ok (create-node probe rollback failed: ${cleanupError})`;
    }

    private extractCreatedNodeUuids(result: any): string[] {
        if (typeof result === 'string' && result.trim() !== '') {
            return [result.trim()];
        }

        if (Array.isArray(result)) {
            return result
                .filter((item) => typeof item === 'string' && item.trim() !== '')
                .map((item) => item.trim());
        }

        return [];
    }

    private async removeProbeNodes(uuids: string[], requester: EditorRequester): Promise<string | null> {
        try {
            await requester('scene', 'remove-node', {
                uuid: uuids.length === 1 ? uuids[0] : uuids
            });
            return null;
        } catch (batchError: any) {
            const failed: string[] = [];
            for (const uuid of uuids) {
                try {
                    await requester('scene', 'remove-node', { uuid });
                } catch {
                    failed.push(uuid);
                }
            }

            if (failed.length === 0) {
                return null;
            }
            return `${normalizeError(batchError)}; still failed uuids: ${failed.join(', ')}`;
        }
    }
}
