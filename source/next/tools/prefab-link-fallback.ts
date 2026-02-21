import { EditorRequester } from '../models';
import { normalizeError, readDumpString, unwrapDumpValue } from './common';
import { buildCreateNodeCandidates, queryPrefabInstanceInfo, resolveNodeAssetType, resolveNodeUuid } from './prefab-instance-utils';

interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

interface LinkAttempt {
    method: 'link-prefab' | 'restore-prefab';
    args: any[];
    label: string;
}

function readParentUuid(node: any): string | null {
    const candidates = [
        readDumpString(node?.parent?.value?.uuid),
        readDumpString(node?.parent?.uuid),
        readDumpString(node?._parent?.value?.uuid),
        readDumpString(node?._parent?.uuid),
        readDumpString(unwrapDumpValue(node?.parent)?.uuid),
        readDumpString(unwrapDumpValue(node?._parent)?.uuid)
    ];

    const matched = candidates.find((item) => Boolean(item));
    return matched || null;
}

function readNodeName(node: any): string | null {
    return readDumpString(node?.name)
        || readDumpString(node?._name)
        || null;
}

function readVec3(node: any, key: string): Vec3Like | null {
    const raw = unwrapDumpValue(node?.[key]);
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const x = Number(raw.x);
    const y = Number(raw.y);
    const z = Number(raw.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
    }

    return { x, y, z };
}

function readChildrenUuids(node: any): string[] {
    const children = Array.isArray(node?.children) ? node.children : [];
    const uuids: string[] = [];

    for (const child of children) {
        if (typeof child === 'string' && child.trim() !== '') {
            uuids.push(child.trim());
            continue;
        }

        const childUuid = readDumpString(child?.uuid)
            || readDumpString(child?.value?.uuid)
            || readDumpString(child?.nodeUuid)
            || readDumpString(child?.id);
        if (childUuid) {
            uuids.push(childUuid);
        }
    }

    return Array.from(new Set(uuids));
}

async function trySetVec3Property(
    requester: EditorRequester,
    nodeUuid: string,
    path: string,
    value: Vec3Like
): Promise<string | null> {
    try {
        await requester('scene', 'set-property', {
            uuid: nodeUuid,
            path,
            dump: {
                type: 'cc.Vec3',
                value
            }
        });
        return null;
    } catch (error: any) {
        return normalizeError(error);
    }
}

async function removeNodeQuietly(requester: EditorRequester, nodeUuid: string): Promise<void> {
    try {
        await requester('scene', 'remove-node', { uuid: nodeUuid });
    } catch {
        // ignore cleanup error
    }
}

function buildReplacementCreateCandidates(
    assetUuid: string,
    parentUuid: string | null,
    name: string | null,
    position: Vec3Like | null,
    assetType: string | null
): Array<{ options: Record<string, any>; label: string }> {
    const baseVariants: Array<Record<string, any>> = [
        {
            assetUuid,
            parent: parentUuid || undefined,
            keepWorldTransform: true
        },
        {
            assetUuid,
            parent: parentUuid || undefined,
            position: position || undefined,
            keepWorldTransform: true
        },
        {
            assetUuid,
            parent: parentUuid || undefined,
            name: name || undefined,
            keepWorldTransform: true
        },
        {
            assetUuid,
            parent: parentUuid || undefined,
            name: name || undefined,
            position: position || undefined,
            keepWorldTransform: true
        }
    ];

    const seen = new Set<string>();
    const candidates: Array<{ options: Record<string, any>; label: string }> = [];
    let counter = 0;

    for (let baseIndex = 0; baseIndex < baseVariants.length; baseIndex += 1) {
        const built = buildCreateNodeCandidates(baseVariants[baseIndex], assetType);
        for (const options of built) {
            const key = JSON.stringify(options);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            counter += 1;
            candidates.push({
                options,
                label: `create-node#${counter}(base:${baseIndex + 1})`
            });
        }
    }

    return candidates;
}

export async function linkPrefabToNodeByMessage(
    requester: EditorRequester,
    nodeUuid: string,
    assetUuid: string
): Promise<{ method: string }> {
    const attempts: LinkAttempt[] = [
        { method: 'link-prefab', args: [nodeUuid, assetUuid], label: 'link-prefab(nodeUuid, assetUuid)' },
        { method: 'link-prefab', args: [{ uuid: nodeUuid, assetUuid }], label: 'link-prefab({uuid,assetUuid})' },
        { method: 'link-prefab', args: [{ node: nodeUuid, prefab: assetUuid }], label: 'link-prefab({node,prefab})' },
        { method: 'restore-prefab', args: [nodeUuid, assetUuid], label: 'restore-prefab(nodeUuid, assetUuid)' },
        { method: 'restore-prefab', args: [{ uuid: nodeUuid, assetUuid }], label: 'restore-prefab({uuid,assetUuid})' },
        { method: 'restore-prefab', args: [nodeUuid], label: 'restore-prefab(nodeUuid)' },
        { method: 'restore-prefab', args: [{ uuid: nodeUuid }], label: 'restore-prefab({uuid})' }
    ];

    const errors: string[] = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', attempt.method, ...attempt.args);
            return { method: attempt.label };
        } catch (error: any) {
            errors.push(`${attempt.label} => ${normalizeError(error)}`);
        }
    }

    throw new Error(errors.join('; '));
}

export async function replaceNodeWithPrefabInstance(
    requester: EditorRequester,
    nodeUuid: string,
    assetUuid: string
): Promise<{
    originalNodeUuid: string;
    replacementNodeUuid: string;
    createMethod: string;
    warnings: string[];
}> {
    const node = await requester('scene', 'query-node', nodeUuid);
    const parentUuid = readParentUuid(node);
    const name = readNodeName(node);
    const position = readVec3(node, 'position');
    const rotation = readVec3(node, 'rotation');
    const scale = readVec3(node, 'scale');
    const childrenUuids = readChildrenUuids(node);

    let assetType: string | null = null;
    try {
        const assetInfo = await requester('asset-db', 'query-asset-info', assetUuid);
        assetType = resolveNodeAssetType(assetInfo);
    } catch {
        assetType = null;
    }
    const candidates = buildReplacementCreateCandidates(assetUuid, parentUuid, name, position, assetType);

    const createErrors: string[] = [];
    let replacementNodeUuid: string | null = null;
    let createMethod = '';
    for (const candidate of candidates) {
        try {
            const created = await requester('scene', 'create-node', candidate.options);
            const resolved = resolveNodeUuid(created);
            if (!resolved) {
                createErrors.push(`${candidate.label} => create-node 未返回有效节点 UUID`);
                continue;
            }

            let verification = await queryPrefabInstanceInfo(requester, resolved);
            const initialMatched = !verification.prefabAssetUuid || verification.prefabAssetUuid === assetUuid;
            if (!verification.isPrefabInstance || !initialMatched) {
                try {
                    const linked = await linkPrefabToNodeByMessage(requester, resolved, assetUuid);
                    verification = await queryPrefabInstanceInfo(requester, resolved);
                    const linkedMatched = !verification.prefabAssetUuid || verification.prefabAssetUuid === assetUuid;
                    if (verification.isPrefabInstance && linkedMatched) {
                        replacementNodeUuid = resolved;
                        createMethod = `${candidate.label} -> ${linked.method}`;
                        break;
                    }
                    createErrors.push(
                        `${candidate.label} => ${linked.method} 后仍未建立关联（prefabAssetUuid=${verification.prefabAssetUuid || 'null'}）`
                    );
                } catch (linkError: any) {
                    createErrors.push(`${candidate.label} => ${normalizeError(linkError)}`);
                }
                await removeNodeQuietly(requester, resolved);
                continue;
            }

            replacementNodeUuid = resolved;
            createMethod = candidate.label;
            break;
        } catch (error: any) {
            createErrors.push(`${candidate.label} => ${normalizeError(error)}`);
        }
    }

    if (!replacementNodeUuid) {
        throw new Error(createErrors.join('; ') || '创建替代 Prefab 实例失败');
    }

    const warnings: string[] = [];
    if (rotation) {
        const error = await trySetVec3Property(requester, replacementNodeUuid, 'rotation', rotation);
        if (error) {
            warnings.push(`恢复 rotation 失败：${error}`);
        }
    }
    if (scale) {
        const error = await trySetVec3Property(requester, replacementNodeUuid, 'scale', scale);
        if (error) {
            warnings.push(`恢复 scale 失败：${error}`);
        }
    }

    if (childrenUuids.length > 0) {
        try {
            await requester('scene', 'set-parent', {
                parent: replacementNodeUuid,
                uuids: childrenUuids,
                keepWorldTransform: true
            });
        } catch (error: any) {
            warnings.push(`迁移子节点失败：${normalizeError(error)}`);
        }
    }

    try {
        await requester('scene', 'remove-node', { uuid: nodeUuid });
    } catch (removeError: any) {
        await removeNodeQuietly(requester, replacementNodeUuid);
        throw new Error(`替换节点时删除原节点失败：${normalizeError(removeError)}`);
    }

    return {
        originalNodeUuid: nodeUuid,
        replacementNodeUuid,
        createMethod,
        warnings
    };
}
