import { EditorRequester } from '../models';
import { readDumpString, toNonEmptyString } from './common';

function unwrapValue(value: any): any {
    if (value && typeof value === 'object' && 'value' in value) {
        return (value as { value: any }).value;
    }
    return value;
}

function readNodeName(node: any): string | null {
    return readDumpString(node?.name) || null;
}

function readPrefabState(prefab: any): number | null {
    const raw = unwrapValue(prefab?.state);
    return typeof raw === 'number' ? raw : null;
}

function readPrefabAssetUuid(prefab: any): string | null {
    const direct = readDumpString(prefab?.assetUuid)
        || readDumpString(prefab?.prefabUuid)
        || readDumpString(prefab?.uuid)
        || readDumpString(prefab?.__uuid__);
    if (direct) {
        return direct;
    }

    const nestedAsset = prefab?.asset;
    const nested = readDumpString(nestedAsset?.uuid)
        || readDumpString(nestedAsset?.__uuid__)
        || readDumpString(nestedAsset?.assetUuid)
        || readDumpString(unwrapValue(nestedAsset));
    return nested || null;
}

function readPrefabContainer(node: any): any {
    if (!node || typeof node !== 'object') {
        return null;
    }

    return node.prefab
        || node._prefabInstance
        || node.__prefab__
        || node._prefab
        || null;
}

export function resolveNodeUuid(result: any): string | null {
    if (typeof result === 'string' && result.trim() !== '') {
        return result.trim();
    }

    if (Array.isArray(result) && typeof result[0] === 'string' && result[0].trim() !== '') {
        return result[0].trim();
    }

    if (result && typeof result === 'object') {
        const direct = readDumpString(result.uuid)
            || readDumpString(result.nodeUuid)
            || readDumpString(result.id)
            || readDumpString(result.value);
        if (direct) {
            return direct;
        }

        const nested = readDumpString(result.node?.uuid)
            || readDumpString(result.node?.nodeUuid);
        if (nested) {
            return nested;
        }
    }

    return null;
}

export interface PrefabInstanceInfo {
    nodeUuid: string;
    nodeName: string | null;
    isPrefabInstance: boolean;
    prefabState: number | null;
    prefabAssetUuid: string | null;
    prefab: any;
    node: any;
}

export async function queryPrefabInstanceInfo(requester: EditorRequester, nodeUuid: string): Promise<PrefabInstanceInfo> {
    const node = await requester('scene', 'query-node', nodeUuid);
    const prefab = readPrefabContainer(node);
    const prefabAssetUuid = readPrefabAssetUuid(prefab);
    const prefabState = readPrefabState(prefab);
    const hasPrefabSignal = Boolean(prefab)
        || Object.prototype.hasOwnProperty.call(node || {}, 'prefab')
        || Object.prototype.hasOwnProperty.call(node || {}, '_prefabInstance')
        || Object.prototype.hasOwnProperty.call(node || {}, '__prefab__')
        || Object.prototype.hasOwnProperty.call(node || {}, '_prefab');
    const isPrefabInstance = Boolean(prefabAssetUuid)
        || (typeof prefabState === 'number' && prefabState > 0)
        || hasPrefabSignal;

    return {
        nodeUuid,
        nodeName: readNodeName(node),
        isPrefabInstance,
        prefabState,
        prefabAssetUuid,
        prefab,
        node
    };
}

export function buildCreateNodeCandidates(baseOptions: Record<string, any>, assetType: string | null): Array<Record<string, any>> {
    const candidates: Array<Record<string, any>> = [];
    const seen = new Set<string>();

    const tryAdd = (candidate: Record<string, any>): void => {
        const key = JSON.stringify(candidate);
        if (!seen.has(key)) {
            seen.add(key);
            candidates.push(candidate);
        }
    };

    tryAdd({ ...baseOptions });

    if (assetType) {
        tryAdd({ ...baseOptions, type: assetType });
    }

    const rawAssetUuid = baseOptions.assetUuid;
    if (typeof rawAssetUuid === 'string' && rawAssetUuid.trim() !== '') {
        const wrappedValue: Record<string, any> = { value: rawAssetUuid };
        if (assetType) {
            wrappedValue.type = assetType;
        }
        tryAdd({ ...baseOptions, assetUuid: wrappedValue });

        const wrappedUuid: Record<string, any> = { uuid: rawAssetUuid };
        if (assetType) {
            wrappedUuid.type = assetType;
        }
        tryAdd({ ...baseOptions, assetUuid: wrappedUuid });
    }

    return candidates;
}

export function resolveNodeAssetType(assetInfo: any): string | null {
    return toNonEmptyString(assetInfo?.type);
}
