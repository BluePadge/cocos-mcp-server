import { EditorRequester, NextToolDefinition } from '../models';
import {
    coerceValueByKind,
    fail,
    normalizeError,
    normalizeValueKind,
    ok,
    readDumpString,
    toNonEmptyString,
    toStringList
} from './common';
import { linkPrefabToNodeByMessage, replaceNodeWithPrefabInstance } from './prefab-link-fallback';
import {
    buildCreateNodeCandidates,
    PrefabInstanceInfo,
    queryPrefabInstanceInfo,
    resolveNodeAssetType,
    resolveNodeUuid
} from './prefab-instance-utils';

async function removeNodeQuietly(requester: EditorRequester, nodeUuid: string): Promise<string | null> {
    try {
        await requester('scene', 'remove-node', { uuid: nodeUuid });
        return null;
    } catch (error: any) {
        return normalizeError(error);
    }
}

interface CreateVerifiedPrefabResult {
    nodeUuid: string;
    options: Record<string, any>;
    verification: PrefabInstanceInfo;
    attempts: Array<{
        index: number;
        options: Record<string, any>;
        nodeUuid?: string;
        verified: boolean;
        detail: string;
        cleanupError?: string | null;
    }>;
}

interface PrefabLinkAttemptResult {
    linked: boolean;
    method: string | null;
    verification?: PrefabInstanceInfo;
    errors: string[];
}

async function tryLinkPrefabToNode(
    requester: EditorRequester,
    nodeUuid: string,
    expectedAssetUuid: string
): Promise<PrefabLinkAttemptResult> {
    const attempts: Array<{ method: string; args: any[]; label: string }> = [
        {
            method: 'link-prefab',
            args: [nodeUuid, expectedAssetUuid],
            label: 'link-prefab(nodeUuid, assetUuid)'
        },
        {
            method: 'link-prefab',
            args: [{ uuid: nodeUuid, assetUuid: expectedAssetUuid }],
            label: 'link-prefab({uuid,assetUuid})'
        },
        {
            method: 'link-prefab',
            args: [{ node: nodeUuid, prefab: expectedAssetUuid }],
            label: 'link-prefab({node,prefab})'
        },
        {
            method: 'restore-prefab',
            args: [nodeUuid, expectedAssetUuid],
            label: 'restore-prefab(nodeUuid,assetUuid)'
        },
        {
            method: 'restore-prefab',
            args: [{ uuid: nodeUuid, assetUuid: expectedAssetUuid }],
            label: 'restore-prefab({uuid,assetUuid})'
        },
        {
            method: 'restore-prefab',
            args: [nodeUuid],
            label: 'restore-prefab(nodeUuid)'
        },
        {
            method: 'restore-prefab',
            args: [{ uuid: nodeUuid }],
            label: 'restore-prefab({uuid})'
        }
    ];

    const errors: string[] = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', attempt.method, ...attempt.args);
            const verification = await queryPrefabInstanceInfo(requester, nodeUuid);
            const assetMatched = !verification.prefabAssetUuid || verification.prefabAssetUuid === expectedAssetUuid;
            if (verification.isPrefabInstance && assetMatched) {
                return {
                    linked: true,
                    method: `${attempt.method}:${attempt.label}`,
                    verification,
                    errors
                };
            }
            errors.push(
                `${attempt.label} => 已调用但未建立关联（prefabAssetUuid=${verification.prefabAssetUuid || 'null'}）`
            );
        } catch (error: any) {
            errors.push(`${attempt.label} => ${normalizeError(error)}`);
        }
    }

    return {
        linked: false,
        method: null,
        errors
    };
}

async function createVerifiedPrefabInstance(
    requester: EditorRequester,
    baseOptions: Record<string, any>,
    expectedAssetUuid: string,
    assetType: string | null
): Promise<CreateVerifiedPrefabResult> {
    const attempts: CreateVerifiedPrefabResult['attempts'] = [];
    const candidates = buildCreateNodeCandidates(baseOptions, assetType);

    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        try {
            const created = await requester('scene', 'create-node', candidate);
            const nodeUuid = resolveNodeUuid(created);
            if (!nodeUuid) {
                attempts.push({
                    index: index + 1,
                    options: candidate,
                    verified: false,
                    detail: 'create-node 未返回有效节点 UUID'
                });
                continue;
            }

            const verification = await queryPrefabInstanceInfo(requester, nodeUuid);
            const assetMatched = !verification.prefabAssetUuid || verification.prefabAssetUuid === expectedAssetUuid;
            if (verification.isPrefabInstance && assetMatched) {
                attempts.push({
                    index: index + 1,
                    options: candidate,
                    nodeUuid,
                    verified: true,
                    detail: '已验证为 Prefab 实例'
                });
                return {
                    nodeUuid,
                    options: candidate,
                    verification,
                    attempts
                };
            }

            const linked = await tryLinkPrefabToNode(requester, nodeUuid, expectedAssetUuid);
            if (linked.linked && linked.verification) {
                attempts.push({
                    index: index + 1,
                    options: candidate,
                    nodeUuid,
                    verified: true,
                    detail: `创建后经 ${linked.method} 建立 Prefab 关联`
                });
                return {
                    nodeUuid,
                    options: candidate,
                    verification: linked.verification,
                    attempts
                };
            }

            const cleanupError = await removeNodeQuietly(requester, nodeUuid);
            attempts.push({
                index: index + 1,
                options: candidate,
                nodeUuid,
                verified: false,
                detail: `节点未建立 Prefab 关联（prefabAssetUuid=${verification.prefabAssetUuid || 'null'}）`
                    + (linked.errors.length > 0 ? `；链接回填失败：${linked.errors.join('; ')}` : ''),
                cleanupError
            });
        } catch (error: any) {
            attempts.push({
                index: index + 1,
                options: candidate,
                verified: false,
                detail: normalizeError(error)
            });
        }
    }

    const summary = attempts.map((item) => `#${item.index} ${item.detail}`).join(' | ');
    throw new Error(summary || '所有 create-node 方案都未成功建立 Prefab 关联');
}

function normalizePrefabCreateOptions(args: any): Record<string, any> {
    const options: Record<string, any> = {};
    const assetUuid = toNonEmptyString(args?.assetUuid);
    if (assetUuid) {
        options.assetUuid = assetUuid;
    }

    const parentUuid = toNonEmptyString(args?.parentUuid);
    if (parentUuid) {
        options.parent = parentUuid;
    }

    const name = toNonEmptyString(args?.name);
    if (name) {
        options.name = name;
    }

    if (typeof args?.keepWorldTransform === 'boolean') {
        options.keepWorldTransform = args.keepWorldTransform;
    }

    if (typeof args?.unlinkPrefab === 'boolean') {
        options.unlinkPrefab = args.unlinkPrefab;
    }

    if (args?.position && typeof args.position === 'object') {
        options.position = args.position;
    }

    return options;
}

function readNodeUuid(node: any): string | null {
    return readDumpString(node?.uuid) || readDumpString(node?.id) || null;
}

function readNodeName(node: any): string | null {
    return readDumpString(node?.name) || null;
}

function readNodeChildren(node: any): any[] {
    return Array.isArray(node?.children) ? node.children : [];
}

function resolveNodeUuidByPath(tree: any, rawNodePath: string): string | null {
    const segments = rawNodePath
        .split('/')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    if (segments.length === 0) {
        return null;
    }

    let current = tree;
    let startIndex = 0;
    const rootName = readNodeName(current);
    if (rootName && rootName === segments[0]) {
        startIndex = 1;
    }

    if (startIndex === 0) {
        const first = segments[0];
        const next = readNodeChildren(current).find((child) => readNodeName(child) === first);
        if (!next) {
            return null;
        }
        current = next;
        startIndex = 1;
    }

    for (let index = startIndex; index < segments.length; index += 1) {
        const seg = segments[index];
        const next = readNodeChildren(current).find((child) => readNodeName(child) === seg);
        if (!next) {
            return null;
        }
        current = next;
    }

    return readNodeUuid(current);
}

async function querySceneDirtySafe(requester: EditorRequester): Promise<boolean | null> {
    try {
        const dirty = await requester('scene', 'query-dirty');
        return dirty === true;
    } catch {
        return null;
    }
}

async function applyPrefabToNode(
    requester: EditorRequester,
    nodeUuid: string,
    prefabAssetUuid: string | null
): Promise<{ method: string }> {
    const attempts: Array<{ method: string; args: any[]; label: string }> = [
        { method: 'apply-prefab', args: [nodeUuid], label: 'apply-prefab(string)' },
        { method: 'apply-prefab', args: [{ uuid: nodeUuid }], label: 'apply-prefab({uuid})' }
    ];

    if (prefabAssetUuid) {
        attempts.push({
            method: 'apply-prefab',
            args: [{ node: nodeUuid, prefab: prefabAssetUuid }],
            label: 'apply-prefab({node,prefab})'
        });
    }

    attempts.push({ method: 'apply-prefab-link', args: [{ uuid: nodeUuid }], label: 'apply-prefab-link({uuid})' });
    if (prefabAssetUuid) {
        attempts.push({
            method: 'apply-prefab-link',
            args: [{ node: nodeUuid, prefab: prefabAssetUuid }],
            label: 'apply-prefab-link({node,prefab})'
        });
    }

    const errors: string[] = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', attempt.method, ...attempt.args);
            return { method: `${attempt.method}:${attempt.label}` };
        } catch (error: any) {
            errors.push(`${attempt.label} => ${normalizeError(error)}`);
        }
    }

    throw new Error(errors.join('; '));
}

function resolveAssetUuid(result: any): string | null {
    if (typeof result === 'string' && result.trim() !== '') {
        return result.trim();
    }

    if (Array.isArray(result) && typeof result[0] === 'string' && result[0].trim() !== '') {
        return result[0].trim();
    }

    if (result && typeof result === 'object') {
        const direct = readDumpString(result.uuid)
            || readDumpString(result.assetUuid)
            || readDumpString(result.prefabUuid)
            || readDumpString(result.value);
        if (direct) {
            return direct;
        }
    }

    return null;
}

async function createPrefabAssetFromNode(
    requester: EditorRequester,
    nodeUuid: string,
    targetUrl: string
): Promise<{ method: string; prefabUuid: string | null; rawResult: any }> {
    const attempts: Array<{ args: any[]; label: string }> = [
        { args: [nodeUuid, targetUrl], label: 'create-prefab(nodeUuid, targetUrl)' },
        { args: [{ uuid: nodeUuid, url: targetUrl }], label: 'create-prefab({uuid,url})' },
        { args: [{ nodeUuid, targetUrl }], label: 'create-prefab({nodeUuid,targetUrl})' },
        { args: [{ node: nodeUuid, url: targetUrl }], label: 'create-prefab({node,url})' }
    ];

    const errors: string[] = [];
    for (const attempt of attempts) {
        try {
            const result = await requester('scene', 'create-prefab', ...attempt.args);
            return {
                method: attempt.label,
                prefabUuid: resolveAssetUuid(result),
                rawResult: result
            };
        } catch (error: any) {
            errors.push(`${attempt.label} => ${normalizeError(error)}`);
        }
    }

    throw new Error(errors.join('; '));
}

async function unlinkPrefabFromNode(
    requester: EditorRequester,
    nodeUuid: string,
    removeNested: boolean
): Promise<{ method: string }> {
    const attempts: Array<{ args: any[]; label: string }> = [
        { args: [nodeUuid, removeNested], label: 'unlink-prefab(nodeUuid, removeNested)' },
        { args: [{ uuid: nodeUuid, removeNested }], label: 'unlink-prefab({uuid,removeNested})' },
        { args: [{ node: nodeUuid, removeNested }], label: 'unlink-prefab({node,removeNested})' },
        { args: [nodeUuid], label: 'unlink-prefab(nodeUuid)' }
    ];

    const errors: string[] = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', 'unlink-prefab', ...attempt.args);
            return { method: attempt.label };
        } catch (error: any) {
            errors.push(`${attempt.label} => ${normalizeError(error)}`);
        }
    }

    throw new Error(errors.join('; '));
}

async function queryAssetInfoWithRetry(
    requester: EditorRequester,
    targetUrl: string,
    maxAttempts = 5,
    intervalMs = 120
): Promise<any | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const info = await requester('asset-db', 'query-asset-info', targetUrl);
            if (info) {
                return info;
            }
        } catch {
            // ignore and retry
        }

        if (attempt < maxAttempts - 1) {
            await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
        }
    }

    return null;
}

export function createPrefabLifecycleTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        {
            name: 'prefab_create_instance',
            description: '基于 Prefab 资源 UUID 创建实例节点',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: 'string', description: 'Prefab 资源 UUID' },
                    parentUuid: { type: 'string', description: '可选，父节点 UUID' },
                    name: { type: 'string', description: '可选，实例节点名称' },
                    unlinkPrefab: { type: 'boolean', description: '可选，创建后是否解除 Prefab 关联' },
                    keepWorldTransform: { type: 'boolean', description: '可选，是否保持世界变换' },
                    position: {
                        type: 'object',
                        description: '可选，实例初始位置',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    }
                },
                required: ['assetUuid']
            },
            requiredCapabilities: ['scene.create-node', 'scene.query-node', 'asset-db.query-asset-info'],
            run: async (args: any) => {
                const options = normalizePrefabCreateOptions(args);
                if (!options.assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    let assetType: string | null = null;
                    try {
                        const assetInfo = await requester('asset-db', 'query-asset-info', options.assetUuid);
                        assetType = resolveNodeAssetType(assetInfo);
                    } catch {
                        assetType = null;
                    }

                    const created = await createVerifiedPrefabInstance(requester, options, options.assetUuid, assetType);
                    return ok({
                        created: true,
                        verified: true,
                        nodeUuid: created.nodeUuid,
                        options: created.options,
                        prefabAssetUuid: created.verification.prefabAssetUuid,
                        prefabState: created.verification.prefabState,
                        attempts: created.attempts
                    });
                } catch (error: any) {
                    return fail('创建 Prefab 实例失败（未建立有效 Prefab 关联）', normalizeError(error), 'E_PREFAB_CREATE_NOT_LINKED');
                }
            }
        },
        {
            name: 'prefab_create_asset_from_node',
            description: '将指定节点保存为 Prefab 资源',
            layer: 'extended',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '源节点 UUID' },
                    targetUrl: { type: 'string', description: '目标 Prefab URL（db://assets/**/*.prefab）' }
                },
                required: ['nodeUuid', 'targetUrl']
            },
            requiredCapabilities: ['scene.create-prefab', 'asset-db.query-asset-info'],
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const targetUrl = toNonEmptyString(args?.targetUrl);
                if (!nodeUuid || !targetUrl) {
                    return fail('nodeUuid 与 targetUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!targetUrl.startsWith('db://') || !targetUrl.endsWith('.prefab')) {
                    return fail('targetUrl 必须为 db:// 前缀且以 .prefab 结尾', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const created = await createPrefabAssetFromNode(requester, nodeUuid, targetUrl);
                    const assetInfo = await queryAssetInfoWithRetry(requester, targetUrl);
                    if (!assetInfo) {
                        return fail('创建 Prefab 资源后未能查询到资产信息', undefined, 'E_PREFAB_ASSET_VERIFY_FAILED');
                    }

                    return ok({
                        created: true,
                        nodeUuid,
                        targetUrl,
                        method: created.method,
                        prefabUuid: toNonEmptyString(assetInfo.uuid) || created.prefabUuid || null,
                        assetInfo
                    });
                } catch (error: any) {
                    return fail('创建 Prefab 资源失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_link_node_to_asset',
            description: '将节点与指定 Prefab 资源建立关联',
            layer: 'extended',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    assetUuid: { type: 'string', description: 'Prefab 资源 UUID' }
                },
                required: ['nodeUuid', 'assetUuid']
            },
            requiredCapabilities: ['scene.link-prefab', 'scene.query-node'],
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const assetUuid = toNonEmptyString(args?.assetUuid);
                if (!nodeUuid || !assetUuid) {
                    return fail('nodeUuid 与 assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const before = await queryPrefabInstanceInfo(requester, nodeUuid);
                    const linked = await linkPrefabToNodeByMessage(requester, nodeUuid, assetUuid);
                    const after = await queryPrefabInstanceInfo(requester, nodeUuid);
                    const assetMatched = !after.prefabAssetUuid || after.prefabAssetUuid === assetUuid;
                    if (after.isPrefabInstance && assetMatched) {
                        return ok({
                            linked: true,
                            nodeUuid,
                            assetUuid,
                            method: linked.method,
                            replaced: false,
                            before,
                            after
                        });
                    }

                    const fallbackErrors: string[] = [];
                    try {
                        const replacement = await replaceNodeWithPrefabInstance(requester, nodeUuid, assetUuid);
                        const replacementInfo = await queryPrefabInstanceInfo(requester, replacement.replacementNodeUuid);
                        const replacementAssetMatched = !replacementInfo.prefabAssetUuid || replacementInfo.prefabAssetUuid === assetUuid;
                        if (replacementInfo.isPrefabInstance && replacementAssetMatched) {
                            return ok({
                                linked: true,
                                nodeUuid: replacement.replacementNodeUuid,
                                originalNodeUuid: nodeUuid,
                                assetUuid,
                                method: `${linked.method} -> fallback:${replacement.createMethod}`,
                                replaced: true,
                                before,
                                after: replacementInfo,
                                fallbackWarnings: replacement.warnings
                            });
                        }

                        const rollbackError = await removeNodeQuietly(requester, replacement.replacementNodeUuid);
                        fallbackErrors.push(
                            `fallback 替换节点后仍未形成实例关联（replacementNodeUuid=${replacement.replacementNodeUuid}）`
                                + (rollbackError ? `；回滚失败：${rollbackError}` : '')
                        );
                    } catch (fallbackError: any) {
                        fallbackErrors.push(normalizeError(fallbackError));
                    }

                    return fail('节点链接后未形成期望的 Prefab 关联', fallbackErrors.join('; '), 'E_PREFAB_LINK_VERIFY_FAILED');
                } catch (error: any) {
                    return fail('链接 Prefab 失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_unlink_instance',
            description: '解除节点与 Prefab 资源的关联',
            layer: 'extended',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    removeNested: { type: 'boolean', description: '是否递归解除子节点关联，默认 false' }
                },
                required: ['nodeUuid']
            },
            requiredCapabilities: ['scene.unlink-prefab', 'scene.query-node'],
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const removeNested = typeof args?.removeNested === 'boolean' ? args.removeNested : false;
                try {
                    const before = await queryPrefabInstanceInfo(requester, nodeUuid);
                    if (!before.isPrefabInstance) {
                        return fail('目标节点当前不是 Prefab 实例，无法解除关联', undefined, 'E_PREFAB_INSTANCE_REQUIRED');
                    }

                    const unlinked = await unlinkPrefabFromNode(requester, nodeUuid, removeNested);
                    const after = await queryPrefabInstanceInfo(requester, nodeUuid);
                    const stillLinked = Boolean(after.prefabAssetUuid)
                        || (typeof after.prefabState === 'number' && after.prefabState > 0);
                    if (stillLinked) {
                        return fail('解除关联后节点仍保留 Prefab 关联', undefined, 'E_PREFAB_UNLINK_VERIFY_FAILED');
                    }

                    return ok({
                        unlinked: true,
                        nodeUuid,
                        removeNested,
                        method: unlinked.method,
                        before,
                        after
                    });
                } catch (error: any) {
                    return fail('解除 Prefab 关联失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_set_node_property',
            description: '在 Prefab 编辑上下文中设置节点属性（支持按 nodeUuid 或 nodePath 定位）',
            layer: 'extended',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: 'string', description: '可选，Prefab 资源 UUID（与 assetUrl 二选一）' },
                    assetUrl: { type: 'string', description: '可选，Prefab 资源 URL（与 assetUuid 二选一）' },
                    nodeUuid: { type: 'string', description: '可选，目标节点 UUID（与 nodePath 二选一）' },
                    nodePath: { type: 'string', description: '可选，目标节点路径，例如 MeteorRoot/Sub（与 nodeUuid 二选一）' },
                    propertyPath: { type: 'string', description: '节点属性路径，例如 _active 或 position.x' },
                    value: { description: '要写入的属性值' },
                    valueKind: {
                        type: 'string',
                        enum: ['auto', 'boolean', 'number', 'string', 'json'],
                        description: '可选，值类型转换策略（默认 auto）'
                    },
                    valueType: { type: 'string', description: '可选，dump.type（例如 cc.Vec3）' },
                    record: { type: 'boolean', description: '可选，是否记录 undo' }
                },
                required: ['propertyPath']
            },
            requiredCapabilities: ['asset-db.open-asset', 'scene.set-property'],
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                const assetUrl = toNonEmptyString(args?.assetUrl);
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const nodePath = toNonEmptyString(args?.nodePath);
                const propertyPath = toNonEmptyString(args?.propertyPath);
                if (!assetUuid && !assetUrl) {
                    return fail('assetUuid 或 assetUrl 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!nodeUuid && !nodePath) {
                    return fail('nodeUuid 或 nodePath 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!propertyPath) {
                    return fail('propertyPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const valueKind = normalizeValueKind(args?.valueKind);
                if (!valueKind) {
                    return fail('valueKind 仅支持 auto/boolean/number/string/json', undefined, 'E_INVALID_ARGUMENT');
                }
                const coerced = coerceValueByKind(args?.value, valueKind);
                if (!coerced.ok) {
                    return fail('属性值类型转换失败', coerced.error, 'E_INVALID_ARGUMENT');
                }

                const openTarget = assetUrl || assetUuid;
                try {
                    await requester('asset-db', 'open-asset', openTarget);

                    let resolvedNodeUuid = nodeUuid;
                    if (!resolvedNodeUuid && nodePath) {
                        const tree = await requester('scene', 'query-node-tree');
                        resolvedNodeUuid = resolveNodeUuidByPath(tree, nodePath) || null;
                        if (!resolvedNodeUuid) {
                            return fail(`按 nodePath 未找到目标节点: ${nodePath}`, undefined, 'E_NODE_NOT_FOUND');
                        }
                    }

                    if (!resolvedNodeUuid) {
                        return fail('无法定位目标节点', undefined, 'E_NODE_NOT_FOUND');
                    }

                    const dump: Record<string, any> = { value: coerced.value };
                    const valueType = toNonEmptyString(args?.valueType);
                    if (valueType) {
                        dump.type = valueType;
                    }

                    const payload: Record<string, any> = {
                        uuid: resolvedNodeUuid,
                        path: propertyPath,
                        dump
                    };
                    if (typeof args?.record === 'boolean') {
                        payload.record = args.record;
                    }

                    const dirtyBefore = await querySceneDirtySafe(requester);
                    const updated = await requester('scene', 'set-property', payload);
                    const dirtyAfter = await querySceneDirtySafe(requester);

                    return ok({
                        updated: updated === true,
                        openTarget,
                        assetUuid: assetUuid || null,
                        assetUrl: assetUrl || null,
                        nodeUuid: resolvedNodeUuid,
                        nodePath: nodePath || null,
                        propertyPath,
                        dump,
                        valueKind,
                        appliedType: coerced.appliedType,
                        dirtyBefore,
                        dirtyAfter,
                        dirtyChanged: dirtyBefore !== null && dirtyAfter !== null ? dirtyBefore !== dirtyAfter : null
                    });
                } catch (error: any) {
                    return fail('设置 Prefab 节点属性失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_query_nodes_by_asset_uuid',
            description: '查询引用指定 Prefab 资源的节点 UUID 列表（结果可能包含非 Prefab 实例节点）',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: 'string', description: 'Prefab 资源 UUID' }
                },
                required: ['assetUuid']
            },
            requiredCapabilities: ['scene.query-nodes-by-asset-uuid'],
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    return ok({
                        assetUuid,
                        nodeUuids,
                        count: nodeUuids.length
                    });
                } catch (error: any) {
                    return fail('查询 Prefab 引用节点失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_query_instance_nodes_by_asset_uuid',
            description: '查询指定 Prefab 资源对应的 Prefab 实例节点 UUID 列表（过滤非实例引用节点）',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: 'string', description: 'Prefab 资源 UUID' }
                },
                required: ['assetUuid']
            },
            requiredCapabilities: ['scene.query-nodes-by-asset-uuid', 'scene.query-node'],
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const queried = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const allNodeUuids = Array.isArray(queried) ? queried : [];
                    const instanceNodeUuids: string[] = [];
                    const skipped: Array<{ nodeUuid: string; reason: string }> = [];

                    for (const nodeUuid of allNodeUuids) {
                        try {
                            const info = await queryPrefabInstanceInfo(requester, nodeUuid);
                            if (!info.isPrefabInstance) {
                                skipped.push({ nodeUuid, reason: '节点不是 Prefab 实例' });
                                continue;
                            }
                            if (info.prefabAssetUuid && info.prefabAssetUuid !== assetUuid) {
                                skipped.push({
                                    nodeUuid,
                                    reason: `实例关联资源不匹配（expected=${assetUuid}, actual=${info.prefabAssetUuid})`
                                });
                                continue;
                            }
                            instanceNodeUuids.push(nodeUuid);
                        } catch (error: any) {
                            skipped.push({ nodeUuid, reason: normalizeError(error) });
                        }
                    }

                    return ok({
                        assetUuid,
                        allNodeUuids,
                        allCount: allNodeUuids.length,
                        nodeUuids: instanceNodeUuids,
                        count: instanceNodeUuids.length,
                        skipped
                    });
                } catch (error: any) {
                    return fail('查询 Prefab 实例节点失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_get_instance_info',
            description: '按节点 UUID 查询 Prefab 实例信息',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '节点 UUID' }
                },
                required: ['nodeUuid']
            },
            requiredCapabilities: ['scene.query-node'],
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const info = await queryPrefabInstanceInfo(requester, nodeUuid);
                    return ok({
                        ...info
                    });
                } catch (error: any) {
                    return fail('查询 Prefab 实例信息失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_apply_instance',
            description: '将 Prefab 实例节点的改动应用回关联资源（实验能力）',
            layer: 'experimental',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    prefabUuid: { type: 'string', description: '可选，仅用于校验当前关联资源 UUID 是否一致' }
                },
                required: ['nodeUuid']
            },
            requiredCapabilities: ['scene.apply-prefab', 'scene.query-node'],
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const prefabUuid = toNonEmptyString(args?.prefabUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const before = await queryPrefabInstanceInfo(requester, nodeUuid);
                    if (!before.isPrefabInstance) {
                        return fail('目标节点当前不是 Prefab 实例，无法 apply', undefined, 'E_PREFAB_INSTANCE_REQUIRED');
                    }

                    if (prefabUuid && before.prefabAssetUuid && before.prefabAssetUuid !== prefabUuid) {
                        return fail('prefabUuid 与节点当前关联资源不一致，官方 API 不支持跨 Prefab 直接关联', undefined, 'E_INVALID_ARGUMENT');
                    }

                    const applied = await applyPrefabToNode(requester, nodeUuid, before.prefabAssetUuid || prefabUuid);
                    const after = await queryPrefabInstanceInfo(requester, nodeUuid);
                    if (!after.isPrefabInstance) {
                        return fail('apply 返回成功但节点未保持 Prefab 实例状态', undefined, 'E_PREFAB_APPLY_VERIFY_FAILED');
                    }

                    return ok({
                        applied: true,
                        nodeUuid,
                        prefabUuid: before.prefabAssetUuid || prefabUuid || null,
                        method: applied.method,
                        before,
                        after
                    });
                } catch (error: any) {
                    return fail('应用 Prefab 失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_apply_instances_by_asset',
            description: '按 Prefab 资源 UUID 批量应用实例（实验能力）',
            layer: 'experimental',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: 'string', description: '用于筛选实例节点的 Prefab 资源 UUID' },
                    targetPrefabUuid: { type: 'string', description: '可选，仅用于校验，若传入必须等于 assetUuid' }
                },
                required: ['assetUuid']
            },
            requiredCapabilities: ['scene.query-nodes-by-asset-uuid', 'scene.apply-prefab', 'scene.query-node'],
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                const targetPrefabUuid = toNonEmptyString(args?.targetPrefabUuid) || assetUuid;
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                if (targetPrefabUuid !== assetUuid) {
                    return fail('官方 API 不支持按 targetPrefabUuid 跨资源批量关联，targetPrefabUuid 必须等于 assetUuid', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const applied: Array<{ nodeUuid: string; method: string }> = [];
                    const failed: Array<{ nodeUuid: string; error: string }> = [];

                    for (const nodeUuid of nodeUuids) {
                        try {
                            const before = await queryPrefabInstanceInfo(requester, nodeUuid);
                            if (!before.isPrefabInstance) {
                                failed.push({ nodeUuid, error: '节点不是 Prefab 实例，跳过 apply' });
                                continue;
                            }

                            if (before.prefabAssetUuid && before.prefabAssetUuid !== assetUuid) {
                                failed.push({
                                    nodeUuid,
                                    error: `节点关联资源与筛选资源不一致（expected=${assetUuid}, actual=${before.prefabAssetUuid}）`
                                });
                                continue;
                            }

                            const result = await applyPrefabToNode(requester, nodeUuid, targetPrefabUuid);
                            const after = await queryPrefabInstanceInfo(requester, nodeUuid);
                            if (!after.isPrefabInstance) {
                                failed.push({ nodeUuid, error: 'apply 后节点失去 Prefab 实例状态' });
                                continue;
                            }

                            applied.push({ nodeUuid, method: result.method });
                        } catch (error: any) {
                            failed.push({ nodeUuid, error: normalizeError(error) });
                        }
                    }

                    return ok({
                        assetUuid,
                        targetPrefabUuid,
                        requested: nodeUuids.length,
                        applied,
                        failed,
                        successCount: applied.length,
                        failureCount: failed.length
                    });
                } catch (error: any) {
                    return fail('批量应用 Prefab 失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_restore_instance',
            description: '还原指定 Prefab 实例节点',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '需要还原的节点 UUID' }
                },
                required: ['nodeUuid']
            },
            requiredCapabilities: ['scene.restore-prefab'],
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'restore-prefab', { uuid: nodeUuid });
                    return ok({ restored: true, nodeUuid });
                } catch (error: any) {
                    return fail('还原 Prefab 实例失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_restore_instances_by_asset',
            description: '按 Prefab 资源 UUID 批量还原实例节点',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: 'string', description: 'Prefab 资源 UUID' }
                },
                required: ['assetUuid']
            },
            requiredCapabilities: ['scene.query-nodes-by-asset-uuid', 'scene.restore-prefab'],
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const restored: string[] = [];
                    const failed: Array<{ nodeUuid: string; error: string }> = [];

                    for (const nodeUuid of nodeUuids) {
                        try {
                            await requester('scene', 'restore-prefab', { uuid: nodeUuid });
                            restored.push(nodeUuid);
                        } catch (error: any) {
                            failed.push({ nodeUuid, error: normalizeError(error) });
                        }
                    }

                    return ok({
                        assetUuid,
                        requested: nodeUuids.length,
                        restored,
                        failed,
                        successCount: restored.length,
                        failureCount: failed.length
                    });
                } catch (error: any) {
                    return fail('批量还原 Prefab 实例失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_reset_node',
            description: '重置节点到默认状态',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '节点 UUID 或 UUID 列表'
                    }
                },
                required: ['nodeUuids']
            },
            requiredCapabilities: ['scene.reset-node'],
            run: async (args: any) => {
                const nodeUuids = toStringList(args?.nodeUuids);
                if (nodeUuids.length === 0) {
                    return fail('nodeUuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'reset-node', {
                        uuid: nodeUuids.length === 1 ? nodeUuids[0] : nodeUuids
                    });
                    return ok({ reset: true, nodeUuids });
                } catch (error: any) {
                    return fail('重置节点失败', normalizeError(error));
                }
            }
        },
        {
            name: 'prefab_reset_component',
            description: '重置组件到默认状态',
            layer: 'official',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    componentUuid: { type: 'string', description: '组件 UUID' }
                },
                required: ['componentUuid']
            },
            requiredCapabilities: ['scene.reset-component'],
            run: async (args: any) => {
                const componentUuid = toNonEmptyString(args?.componentUuid);
                if (!componentUuid) {
                    return fail('componentUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'reset-component', { uuid: componentUuid });
                    return ok({ reset: true, componentUuid });
                } catch (error: any) {
                    return fail('重置组件失败', normalizeError(error));
                }
            }
        }
    ];
}
