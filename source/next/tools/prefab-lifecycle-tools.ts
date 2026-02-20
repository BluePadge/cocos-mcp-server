import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, readDumpString, toNonEmptyString, toStringList } from './common';

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

function resolveNodeUuid(result: any): string | null {
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

interface PrefabInstanceInfo {
    nodeUuid: string;
    nodeName: string | null;
    isPrefabInstance: boolean;
    prefabState: number | null;
    prefabAssetUuid: string | null;
    prefab: any;
    node: any;
}

async function queryPrefabInstanceInfo(requester: EditorRequester, nodeUuid: string): Promise<PrefabInstanceInfo> {
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

function buildCreateNodeCandidates(baseOptions: Record<string, any>, assetType: string | null): Array<Record<string, any>> {
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
            args: [{ uuid: nodeUuid, assetUuid: expectedAssetUuid }],
            label: 'restore-prefab({uuid,assetUuid})'
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
                        assetType = toNonEmptyString(assetInfo?.type);
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
            name: 'prefab_query_nodes_by_asset_uuid',
            description: '查询引用指定 Prefab 资源的节点 UUID 列表',
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
