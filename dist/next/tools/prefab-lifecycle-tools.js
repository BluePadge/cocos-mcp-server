"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrefabLifecycleTools = createPrefabLifecycleTools;
const common_1 = require("./common");
function unwrapValue(value) {
    if (value && typeof value === 'object' && 'value' in value) {
        return value.value;
    }
    return value;
}
function readNodeName(node) {
    return (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.name) || null;
}
function readPrefabState(prefab) {
    const raw = unwrapValue(prefab === null || prefab === void 0 ? void 0 : prefab.state);
    return typeof raw === 'number' ? raw : null;
}
function readPrefabAssetUuid(prefab) {
    const direct = (0, common_1.readDumpString)(prefab === null || prefab === void 0 ? void 0 : prefab.assetUuid)
        || (0, common_1.readDumpString)(prefab === null || prefab === void 0 ? void 0 : prefab.prefabUuid)
        || (0, common_1.readDumpString)(prefab === null || prefab === void 0 ? void 0 : prefab.uuid)
        || (0, common_1.readDumpString)(prefab === null || prefab === void 0 ? void 0 : prefab.__uuid__);
    if (direct) {
        return direct;
    }
    const nestedAsset = prefab === null || prefab === void 0 ? void 0 : prefab.asset;
    const nested = (0, common_1.readDumpString)(nestedAsset === null || nestedAsset === void 0 ? void 0 : nestedAsset.uuid)
        || (0, common_1.readDumpString)(nestedAsset === null || nestedAsset === void 0 ? void 0 : nestedAsset.__uuid__)
        || (0, common_1.readDumpString)(nestedAsset === null || nestedAsset === void 0 ? void 0 : nestedAsset.assetUuid)
        || (0, common_1.readDumpString)(unwrapValue(nestedAsset));
    return nested || null;
}
function resolveNodeUuid(result) {
    var _a, _b;
    if (typeof result === 'string' && result.trim() !== '') {
        return result.trim();
    }
    if (Array.isArray(result) && typeof result[0] === 'string' && result[0].trim() !== '') {
        return result[0].trim();
    }
    if (result && typeof result === 'object') {
        const direct = (0, common_1.readDumpString)(result.uuid)
            || (0, common_1.readDumpString)(result.nodeUuid)
            || (0, common_1.readDumpString)(result.id)
            || (0, common_1.readDumpString)(result.value);
        if (direct) {
            return direct;
        }
        const nested = (0, common_1.readDumpString)((_a = result.node) === null || _a === void 0 ? void 0 : _a.uuid)
            || (0, common_1.readDumpString)((_b = result.node) === null || _b === void 0 ? void 0 : _b.nodeUuid);
        if (nested) {
            return nested;
        }
    }
    return null;
}
function readPrefabContainer(node) {
    if (!node || typeof node !== 'object') {
        return null;
    }
    return node.prefab
        || node._prefabInstance
        || node.__prefab__
        || node._prefab
        || null;
}
async function queryPrefabInstanceInfo(requester, nodeUuid) {
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
function buildCreateNodeCandidates(baseOptions, assetType) {
    const candidates = [];
    const seen = new Set();
    const tryAdd = (candidate) => {
        const key = JSON.stringify(candidate);
        if (!seen.has(key)) {
            seen.add(key);
            candidates.push(candidate);
        }
    };
    tryAdd(Object.assign({}, baseOptions));
    if (assetType) {
        tryAdd(Object.assign(Object.assign({}, baseOptions), { type: assetType }));
    }
    const rawAssetUuid = baseOptions.assetUuid;
    if (typeof rawAssetUuid === 'string' && rawAssetUuid.trim() !== '') {
        const wrappedValue = { value: rawAssetUuid };
        if (assetType) {
            wrappedValue.type = assetType;
        }
        tryAdd(Object.assign(Object.assign({}, baseOptions), { assetUuid: wrappedValue }));
        const wrappedUuid = { uuid: rawAssetUuid };
        if (assetType) {
            wrappedUuid.type = assetType;
        }
        tryAdd(Object.assign(Object.assign({}, baseOptions), { assetUuid: wrappedUuid }));
    }
    return candidates;
}
async function removeNodeQuietly(requester, nodeUuid) {
    try {
        await requester('scene', 'remove-node', { uuid: nodeUuid });
        return null;
    }
    catch (error) {
        return (0, common_1.normalizeError)(error);
    }
}
async function tryLinkPrefabToNode(requester, nodeUuid, expectedAssetUuid) {
    const attempts = [
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
    const errors = [];
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
            errors.push(`${attempt.label} => 已调用但未建立关联（prefabAssetUuid=${verification.prefabAssetUuid || 'null'}）`);
        }
        catch (error) {
            errors.push(`${attempt.label} => ${(0, common_1.normalizeError)(error)}`);
        }
    }
    return {
        linked: false,
        method: null,
        errors
    };
}
async function createVerifiedPrefabInstance(requester, baseOptions, expectedAssetUuid, assetType) {
    const attempts = [];
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
        }
        catch (error) {
            attempts.push({
                index: index + 1,
                options: candidate,
                verified: false,
                detail: (0, common_1.normalizeError)(error)
            });
        }
    }
    const summary = attempts.map((item) => `#${item.index} ${item.detail}`).join(' | ');
    throw new Error(summary || '所有 create-node 方案都未成功建立 Prefab 关联');
}
function normalizePrefabCreateOptions(args) {
    const options = {};
    const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
    if (assetUuid) {
        options.assetUuid = assetUuid;
    }
    const parentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.parentUuid);
    if (parentUuid) {
        options.parent = parentUuid;
    }
    const name = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.name);
    if (name) {
        options.name = name;
    }
    if (typeof (args === null || args === void 0 ? void 0 : args.keepWorldTransform) === 'boolean') {
        options.keepWorldTransform = args.keepWorldTransform;
    }
    if (typeof (args === null || args === void 0 ? void 0 : args.unlinkPrefab) === 'boolean') {
        options.unlinkPrefab = args.unlinkPrefab;
    }
    if ((args === null || args === void 0 ? void 0 : args.position) && typeof args.position === 'object') {
        options.position = args.position;
    }
    return options;
}
async function applyPrefabToNode(requester, nodeUuid, prefabAssetUuid) {
    const attempts = [
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
    const errors = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', attempt.method, ...attempt.args);
            return { method: `${attempt.method}:${attempt.label}` };
        }
        catch (error) {
            errors.push(`${attempt.label} => ${(0, common_1.normalizeError)(error)}`);
        }
    }
    throw new Error(errors.join('; '));
}
function createPrefabLifecycleTools(requester) {
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
            run: async (args) => {
                const options = normalizePrefabCreateOptions(args);
                if (!options.assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    let assetType = null;
                    try {
                        const assetInfo = await requester('asset-db', 'query-asset-info', options.assetUuid);
                        assetType = (0, common_1.toNonEmptyString)(assetInfo === null || assetInfo === void 0 ? void 0 : assetInfo.type);
                    }
                    catch (_a) {
                        assetType = null;
                    }
                    const created = await createVerifiedPrefabInstance(requester, options, options.assetUuid, assetType);
                    return (0, common_1.ok)({
                        created: true,
                        verified: true,
                        nodeUuid: created.nodeUuid,
                        options: created.options,
                        prefabAssetUuid: created.verification.prefabAssetUuid,
                        prefabState: created.verification.prefabState,
                        attempts: created.attempts
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('创建 Prefab 实例失败（未建立有效 Prefab 关联）', (0, common_1.normalizeError)(error), 'E_PREFAB_CREATE_NOT_LINKED');
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
            run: async (args) => {
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                if (!assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    return (0, common_1.ok)({
                        assetUuid,
                        nodeUuids,
                        count: nodeUuids.length
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询 Prefab 实例节点失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                if (!nodeUuid) {
                    return (0, common_1.fail)('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const info = await queryPrefabInstanceInfo(requester, nodeUuid);
                    return (0, common_1.ok)(Object.assign({}, info));
                }
                catch (error) {
                    return (0, common_1.fail)('查询 Prefab 实例信息失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const prefabUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.prefabUuid);
                if (!nodeUuid) {
                    return (0, common_1.fail)('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const before = await queryPrefabInstanceInfo(requester, nodeUuid);
                    if (!before.isPrefabInstance) {
                        return (0, common_1.fail)('目标节点当前不是 Prefab 实例，无法 apply', undefined, 'E_PREFAB_INSTANCE_REQUIRED');
                    }
                    if (prefabUuid && before.prefabAssetUuid && before.prefabAssetUuid !== prefabUuid) {
                        return (0, common_1.fail)('prefabUuid 与节点当前关联资源不一致，官方 API 不支持跨 Prefab 直接关联', undefined, 'E_INVALID_ARGUMENT');
                    }
                    const applied = await applyPrefabToNode(requester, nodeUuid, before.prefabAssetUuid || prefabUuid);
                    const after = await queryPrefabInstanceInfo(requester, nodeUuid);
                    if (!after.isPrefabInstance) {
                        return (0, common_1.fail)('apply 返回成功但节点未保持 Prefab 实例状态', undefined, 'E_PREFAB_APPLY_VERIFY_FAILED');
                    }
                    return (0, common_1.ok)({
                        applied: true,
                        nodeUuid,
                        prefabUuid: before.prefabAssetUuid || prefabUuid || null,
                        method: applied.method,
                        before,
                        after
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('应用 Prefab 失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                const targetPrefabUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.targetPrefabUuid) || assetUuid;
                if (!assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                if (targetPrefabUuid !== assetUuid) {
                    return (0, common_1.fail)('官方 API 不支持按 targetPrefabUuid 跨资源批量关联，targetPrefabUuid 必须等于 assetUuid', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const applied = [];
                    const failed = [];
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
                        }
                        catch (error) {
                            failed.push({ nodeUuid, error: (0, common_1.normalizeError)(error) });
                        }
                    }
                    return (0, common_1.ok)({
                        assetUuid,
                        targetPrefabUuid,
                        requested: nodeUuids.length,
                        applied,
                        failed,
                        successCount: applied.length,
                        failureCount: failed.length
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('批量应用 Prefab 失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                if (!nodeUuid) {
                    return (0, common_1.fail)('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'restore-prefab', { uuid: nodeUuid });
                    return (0, common_1.ok)({ restored: true, nodeUuid });
                }
                catch (error) {
                    return (0, common_1.fail)('还原 Prefab 实例失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                if (!assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const restored = [];
                    const failed = [];
                    for (const nodeUuid of nodeUuids) {
                        try {
                            await requester('scene', 'restore-prefab', { uuid: nodeUuid });
                            restored.push(nodeUuid);
                        }
                        catch (error) {
                            failed.push({ nodeUuid, error: (0, common_1.normalizeError)(error) });
                        }
                    }
                    return (0, common_1.ok)({
                        assetUuid,
                        requested: nodeUuids.length,
                        restored,
                        failed,
                        successCount: restored.length,
                        failureCount: failed.length
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('批量还原 Prefab 实例失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const nodeUuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.nodeUuids);
                if (nodeUuids.length === 0) {
                    return (0, common_1.fail)('nodeUuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'reset-node', {
                        uuid: nodeUuids.length === 1 ? nodeUuids[0] : nodeUuids
                    });
                    return (0, common_1.ok)({ reset: true, nodeUuids });
                }
                catch (error) {
                    return (0, common_1.fail)('重置节点失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const componentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentUuid);
                if (!componentUuid) {
                    return (0, common_1.fail)('componentUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'reset-component', { uuid: componentUuid });
                    return (0, common_1.ok)({ reset: true, componentUuid });
                }
                catch (error) {
                    return (0, common_1.fail)('重置组件失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmFiLWxpZmVjeWNsZS10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL3ByZWZhYi1saWZlY3ljbGUtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFxWUEsZ0VBMlhDO0FBL3ZCRCxxQ0FBb0c7QUFFcEcsU0FBUyxXQUFXLENBQUMsS0FBVTtJQUMzQixJQUFJLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ3pELE9BQVEsS0FBd0IsQ0FBQyxLQUFLLENBQUM7SUFDM0MsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxJQUFTO0lBQzNCLE9BQU8sSUFBQSx1QkFBYyxFQUFDLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUM7QUFDOUMsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLE1BQVc7SUFDaEMsTUFBTSxHQUFHLEdBQUcsV0FBVyxDQUFDLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxLQUFLLENBQUMsQ0FBQztJQUN2QyxPQUFPLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDaEQsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsTUFBVztJQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFBLHVCQUFjLEVBQUMsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLFNBQVMsQ0FBQztXQUN6QyxJQUFBLHVCQUFjLEVBQUMsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLFVBQVUsQ0FBQztXQUNsQyxJQUFBLHVCQUFjLEVBQUMsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLElBQUksQ0FBQztXQUM1QixJ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dUJBQXVCLENBQUM7WUFDL0MsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFTLEVBQUUsRUFBRTtnQkFDckIsTUFBTSxhQUFhLEdBQUcsSUFBQSx5QkFBZ0IsRUFBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQzVELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztvQkFDakIsT0FBTyxJQUFBLGFBQUksRUFBQyxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztnQkFDckUsQ0FBQztnQkFFRCxJQUFJLENBQUM7b0JBQ0QsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7b0JBQ3JFLE9BQU8sSUFBQSxXQUFFLEVBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7Z0JBQzlDLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyxRQUFRLEVBQUUsSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2pELENBQUM7WUFDTCxDQUFDO1NBQ0o7S0FDSixDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgcmVhZER1bXBTdHJpbmcsIHRvTm9uRW1wdHlTdHJpbmcsIHRvU3RyaW5nTGlzdCB9IGZyb20gJy4vY29tbW9uJztcblxuZnVuY3Rpb24gdW53cmFwVmFsdWUodmFsdWU6IGFueSk6IGFueSB7XG4gICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gKHZhbHVlIGFzIHsgdmFsdWU6IGFueSB9KS52YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiByZWFkTm9kZU5hbWUobm9kZTogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHJlYWREdW1wU3RyaW5nKG5vZGU/Lm5hbWUpIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWRQcmVmYWJTdGF0ZShwcmVmYWI6IGFueSk6IG51bWJlciB8IG51bGwge1xuICAgIGNvbnN0IHJhdyA9IHVud3JhcFZhbHVlKHByZWZhYj8uc3RhdGUpO1xuICAgIHJldHVybiB0eXBlb2YgcmF3ID09PSAnbnVtYmVyJyA/IHJhdyA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWRQcmVmYWJBc3NldFV1aWQocHJlZmFiOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBkaXJlY3QgPSByZWFkRHVtcFN0cmluZyhwcmVmYWI/LmFzc2V0VXVpZClcbiAgICAgICAgfHwgcmVhZER1bXBTdHJpbmcocHJlZmFiPy5wcmVmYWJVdWlkKVxuICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhwcmVmYWI/LnV1aWQpXG4gICAgICAgIHx8IHJlYWREdW1wU3RyaW5nKHByZWZhYj8uX191dWlkX18pO1xuICAgIGlmIChkaXJlY3QpIHtcbiAgICAgICAgcmV0dXJuIGRpcmVjdDtcbiAgICB9XG5cbiAgICBjb25zdCBuZXN0ZWRBc3NldCA9IHByZWZhYj8uYXNzZXQ7XG4gICAgY29uc3QgbmVzdGVkID0gcmVhZER1bXBTdHJpbmcobmVzdGVkQXNzZXQ/LnV1aWQpXG4gICAgICAgIHx8IHJlYWREdW1wU3RyaW5nKG5lc3RlZEFzc2V0Py5fX3V1aWRfXylcbiAgICAgICAgfHwgcmVhZER1bXBTdHJpbmcobmVzdGVkQXNzZXQ/LmFzc2V0VXVpZClcbiAgICAgICAgfHwgcmVhZER1bXBTdHJpbmcodW53cmFwVmFsdWUobmVzdGVkQXNzZXQpKTtcbiAgICByZXR1cm4gbmVzdGVkIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOb2RlVXVpZChyZXN1bHQ6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJyAmJiByZXN1bHQudHJpbSgpICE9PSAnJykge1xuICAgICAgICByZXR1cm4gcmVzdWx0LnRyaW0oKTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHQpICYmIHR5cGVvZiByZXN1bHRbMF0gPT09ICdzdHJpbmcnICYmIHJlc3VsdFswXS50cmltKCkgIT09ICcnKSB7XG4gICAgICAgIHJldHVybiByZXN1bHRbMF0udHJpbSgpO1xuICAgIH1cblxuICAgIGlmIChyZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgY29uc3QgZGlyZWN0ID0gcmVhZER1bXBTdHJpbmcocmVzdWx0LnV1aWQpXG4gICAgICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhyZXN1bHQubm9kZVV1aWQpXG4gICAgICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhyZXN1bHQuaWQpXG4gICAgICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhyZXN1bHQudmFsdWUpO1xuICAgICAgICBpZiAoZGlyZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gZGlyZWN0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmVzdGVkID0gcmVhZER1bXBTdHJpbmcocmVzdWx0Lm5vZGU/LnV1aWQpXG4gICAgICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhyZXN1bHQubm9kZT8ubm9kZVV1aWQpO1xuICAgICAgICBpZiAobmVzdGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWRQcmVmYWJDb250YWluZXIobm9kZTogYW55KTogYW55IHtcbiAgICBpZiAoIW5vZGUgfHwgdHlwZW9mIG5vZGUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBub2RlLnByZWZhYlxuICAgICAgICB8fCBub2RlLl9wcmVmYWJJbnN0YW5jZVxuICAgICAgICB8fCBub2RlLl9fcHJlZmFiX19cbiAgICAgICAgfHwgbm9kZS5fcHJlZmFiXG4gICAgICAgIHx8IG51bGw7XG59XG5cbmludGVyZmFjZSBQcmVmYWJJbnN0YW5jZUluZm8ge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7XG4gICAgbm9kZU5hbWU6IHN0cmluZyB8IG51bGw7XG4gICAgaXNQcmVmYWJJbnN0YW5jZTogYm9vbGVhbjtcbiAgICBwcmVmYWJTdGF0ZTogbnVtYmVyIHwgbnVsbDtcbiAgICBwcmVmYWJBc3NldFV1aWQ6IHN0cmluZyB8IG51bGw7XG4gICAgcHJlZmFiOiBhbnk7XG4gICAgbm9kZTogYW55O1xufVxuXG5hc3luYyBmdW5jdGlvbiBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlciwgbm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8UHJlZmFiSW5zdGFuY2VJbmZvPiB7XG4gICAgY29uc3Qgbm9kZSA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICBjb25zdCBwcmVmYWIgPSByZWFkUHJlZmFiQ29udGFpbmVyKG5vZGUpO1xuICAgIGNvbnN0IHByZWZhYkFzc2V0VXVpZCA9IHJlYWRQcmVmYWJBc3NldFV1aWQocHJlZmFiKTtcbiAgICBjb25zdCBwcmVmYWJTdGF0ZSA9IHJlYWRQcmVmYWJTdGF0ZShwcmVmYWIpO1xuICAgIGNvbnN0IGhhc1ByZWZhYlNpZ25hbCA9IEJvb2xlYW4ocHJlZmFiKVxuICAgICAgICB8fCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobm9kZSB8fCB7fSwgJ3ByZWZhYicpXG4gICAgICAgIHx8IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChub2RlIHx8IHt9LCAnX3ByZWZhYkluc3RhbmNlJylcbiAgICAgICAgfHwgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG5vZGUgfHwge30sICdfX3ByZWZhYl9fJylcbiAgICAgICAgfHwgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG5vZGUgfHwge30sICdfcHJlZmFiJyk7XG4gICAgY29uc3QgaXNQcmVmYWJJbnN0YW5jZSA9IEJvb2xlYW4ocHJlZmFiQXNzZXRVdWlkKVxuICAgICAgICB8fCAodHlwZW9mIHByZWZhYlN0YXRlID09PSAnbnVtYmVyJyAmJiBwcmVmYWJTdGF0ZSA+IDApXG4gICAgICAgIHx8IGhhc1ByZWZhYlNpZ25hbDtcblxuICAgIHJldHVybiB7XG4gICAgICAgIG5vZGVVdWlkLFxuICAgICAgICBub2RlTmFtZTogcmVhZE5vZGVOYW1lKG5vZGUpLFxuICAgICAgICBpc1ByZWZhYkluc3RhbmNlLFxuICAgICAgICBwcmVmYWJTdGF0ZSxcbiAgICAgICAgcHJlZmFiQXNzZXRVdWlkLFxuICAgICAgICBwcmVmYWIsXG4gICAgICAgIG5vZGVcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZENyZWF0ZU5vZGVDYW5kaWRhdGVzKGJhc2VPcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LCBhc3NldFR5cGU6IHN0cmluZyB8IG51bGwpOiBBcnJheTxSZWNvcmQ8c3RyaW5nLCBhbnk+PiB7XG4gICAgY29uc3QgY2FuZGlkYXRlczogQXJyYXk8UmVjb3JkPHN0cmluZywgYW55Pj4gPSBbXTtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBjb25zdCB0cnlBZGQgPSAoY2FuZGlkYXRlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IGtleSA9IEpTT04uc3RyaW5naWZ5KGNhbmRpZGF0ZSk7XG4gICAgICAgIGlmICghc2Vlbi5oYXMoa2V5KSkge1xuICAgICAgICAgICAgc2Vlbi5hZGQoa2V5KTtcbiAgICAgICAgICAgIGNhbmRpZGF0ZXMucHVzaChjYW5kaWRhdGUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRyeUFkZCh7IC4uLmJhc2VPcHRpb25zIH0pO1xuXG4gICAgaWYgKGFzc2V0VHlwZSkge1xuICAgICAgICB0cnlBZGQoeyAuLi5iYXNlT3B0aW9ucywgdHlwZTogYXNzZXRUeXBlIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHJhd0Fzc2V0VXVpZCA9IGJhc2VPcHRpb25zLmFzc2V0VXVpZDtcbiAgICBpZiAodHlwZW9mIHJhd0Fzc2V0VXVpZCA9PT0gJ3N0cmluZycgJiYgcmF3QXNzZXRVdWlkLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgY29uc3Qgd3JhcHBlZFZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0geyB2YWx1ZTogcmF3QXNzZXRVdWlkIH07XG4gICAgICAgIGlmIChhc3NldFR5cGUpIHtcbiAgICAgICAgICAgIHdyYXBwZWRWYWx1ZS50eXBlID0gYXNzZXRUeXBlO1xuICAgICAgICB9XG4gICAgICAgIHRyeUFkZCh7IC4uLmJhc2VPcHRpb25zLCBhc3NldFV1aWQ6IHdyYXBwZWRWYWx1ZSB9KTtcblxuICAgICAgICBjb25zdCB3cmFwcGVkVXVpZDogUmVjb3JkPHN0cmluZywgYW55PiA9IHsgdXVpZDogcmF3QXNzZXRVdWlkIH07XG4gICAgICAgIGlmIChhc3NldFR5cGUpIHtcbiAgICAgICAgICAgIHdyYXBwZWRVdWlkLnR5cGUgPSBhc3NldFR5cGU7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5QWRkKHsgLi4uYmFzZU9wdGlvbnMsIGFzc2V0VXVpZDogd3JhcHBlZFV1aWQgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbmRpZGF0ZXM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZU5vZGVRdWlldGx5KHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLCBub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZW1vdmUtbm9kZScsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZUVycm9yKGVycm9yKTtcbiAgICB9XG59XG5cbmludGVyZmFjZSBDcmVhdGVWZXJpZmllZFByZWZhYlJlc3VsdCB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZztcbiAgICBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICAgIHZlcmlmaWNhdGlvbjogUHJlZmFiSW5zdGFuY2VJbmZvO1xuICAgIGF0dGVtcHRzOiBBcnJheTx7XG4gICAgICAgIGluZGV4OiBudW1iZXI7XG4gICAgICAgIG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gICAgICAgIG5vZGVVdWlkPzogc3RyaW5nO1xuICAgICAgICB2ZXJpZmllZDogYm9vbGVhbjtcbiAgICAgICAgZGV0YWlsOiBzdHJpbmc7XG4gICAgICAgIGNsZWFudXBFcnJvcj86IHN0cmluZyB8IG51bGw7XG4gICAgfT47XG59XG5cbmludGVyZmFjZSBQcmVmYWJMaW5rQXR0ZW1wdFJlc3VsdCB7XG4gICAgbGlua2VkOiBib29sZWFuO1xuICAgIG1ldGhvZDogc3RyaW5nIHwgbnVsbDtcbiAgICB2ZXJpZmljYXRpb24/OiBQcmVmYWJJbnN0YW5jZUluZm87XG4gICAgZXJyb3JzOiBzdHJpbmdbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJ5TGlua1ByZWZhYlRvTm9kZShcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGV4cGVjdGVkQXNzZXRVdWlkOiBzdHJpbmdcbik6IFByb21pc2U8UHJlZmFiTGlua0F0dGVtcHRSZXN1bHQ+IHtcbiAgICBjb25zdCBhdHRlbXB0czogQXJyYXk8eyBtZXRob2Q6IHN0cmluZzsgYXJnczogYW55W107IGxhYmVsOiBzdHJpbmcgfT4gPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ2xpbmstcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFtub2RlVXVpZCwgZXhwZWN0ZWRBc3NldFV1aWRdLFxuICAgICAgICAgICAgbGFiZWw6ICdsaW5rLXByZWZhYihub2RlVXVpZCwgYXNzZXRVdWlkKSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAnbGluay1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgdXVpZDogbm9kZVV1aWQsIGFzc2V0VXVpZDogZXhwZWN0ZWRBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ2xpbmstcHJlZmFiKHt1dWlkLGFzc2V0VXVpZH0pJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdsaW5rLXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBleHBlY3RlZEFzc2V0VXVpZCB9XSxcbiAgICAgICAgICAgIGxhYmVsOiAnbGluay1wcmVmYWIoe25vZGUscHJlZmFifSknXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ3Jlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkLCBhc3NldFV1aWQ6IGV4cGVjdGVkQXNzZXRVdWlkIH1dLFxuICAgICAgICAgICAgbGFiZWw6ICdyZXN0b3JlLXByZWZhYih7dXVpZCxhc3NldFV1aWR9KSdcbiAgICAgICAgfVxuICAgIF07XG5cbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBhdHRlbXB0IG9mIGF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgYXR0ZW1wdC5tZXRob2QsIC4uLmF0dGVtcHQuYXJncyk7XG4gICAgICAgICAgICBjb25zdCB2ZXJpZmljYXRpb24gPSBhd2FpdCBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0TWF0Y2hlZCA9ICF2ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkIHx8IHZlcmlmaWNhdGlvbi5wcmVmYWJBc3NldFV1aWQgPT09IGV4cGVjdGVkQXNzZXRVdWlkO1xuICAgICAgICAgICAgaWYgKHZlcmlmaWNhdGlvbi5pc1ByZWZhYkluc3RhbmNlICYmIGFzc2V0TWF0Y2hlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGxpbmtlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBgJHthdHRlbXB0Lm1ldGhvZH06JHthdHRlbXB0LmxhYmVsfWAsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgICAgIGAke2F0dGVtcHQubGFiZWx9ID0+IOW3suiwg+eUqOS9huacquW7uueri+WFs+iBlO+8iHByZWZhYkFzc2V0VXVpZD0ke3ZlcmlmaWNhdGlvbi5wcmVmYWJBc3NldFV1aWQgfHwgJ251bGwnfe+8iWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGAke2F0dGVtcHQubGFiZWx9ID0+ICR7bm9ybWFsaXplRXJyb3IoZXJyb3IpfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbGlua2VkOiBmYWxzZSxcbiAgICAgICAgbWV0aG9kOiBudWxsLFxuICAgICAgICBlcnJvcnNcbiAgICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVWZXJpZmllZFByZWZhYkluc3RhbmNlKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIGJhc2VPcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICAgIGV4cGVjdGVkQXNzZXRVdWlkOiBzdHJpbmcsXG4gICAgYXNzZXRUeXBlOiBzdHJpbmcgfCBudWxsXG4pOiBQcm9taXNlPENyZWF0ZVZlcmlmaWVkUHJlZmFiUmVzdWx0PiB7XG4gICAgY29uc3QgYXR0ZW1wdHM6IENyZWF0ZVZlcmlmaWVkUHJlZmFiUmVzdWx0WydhdHRlbXB0cyddID0gW107XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IGJ1aWxkQ3JlYXRlTm9kZUNhbmRpZGF0ZXMoYmFzZU9wdGlvbnMsIGFzc2V0VHlwZSk7XG5cbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY2FuZGlkYXRlcy5sZW5ndGg7IGluZGV4ICs9IDEpIHtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlID0gY2FuZGlkYXRlc1tpbmRleF07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjcmVhdGUtbm9kZScsIGNhbmRpZGF0ZSk7XG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHJlc29sdmVOb2RlVXVpZChjcmVhdGVkKTtcbiAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogJ2NyZWF0ZS1ub2RlIOacqui/lOWbnuacieaViOiKgueCuSBVVUlEJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB2ZXJpZmljYXRpb24gPSBhd2FpdCBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0TWF0Y2hlZCA9ICF2ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkIHx8IHZlcmlmaWNhdGlvbi5wcmVmYWJBc3NldFV1aWQgPT09IGV4cGVjdGVkQXNzZXRVdWlkO1xuICAgICAgICAgICAgaWYgKHZlcmlmaWNhdGlvbi5pc1ByZWZhYkluc3RhbmNlICYmIGFzc2V0TWF0Y2hlZCkge1xuICAgICAgICAgICAgICAgIGF0dGVtcHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXggKyAxLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiAn5bey6aqM6K+B5Li6IFByZWZhYiDlrp7kvosnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uLFxuICAgICAgICAgICAgICAgICAgICBhdHRlbXB0c1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGxpbmtlZCA9IGF3YWl0IHRyeUxpbmtQcmVmYWJUb05vZGUocmVxdWVzdGVyLCBub2RlVXVpZCwgZXhwZWN0ZWRBc3NldFV1aWQpO1xuICAgICAgICAgICAgaWYgKGxpbmtlZC5saW5rZWQgJiYgbGlua2VkLnZlcmlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIGF0dGVtcHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXggKyAxLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiBg5Yib5bu65ZCO57uPICR7bGlua2VkLm1ldGhvZH0g5bu656uLIFByZWZhYiDlhbPogZRgXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uOiBsaW5rZWQudmVyaWZpY2F0aW9uLFxuICAgICAgICAgICAgICAgICAgICBhdHRlbXB0c1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNsZWFudXBFcnJvciA9IGF3YWl0IHJlbW92ZU5vZGVRdWlldGx5KHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogYOiKgueCueacquW7uueriyBQcmVmYWIg5YWz6IGU77yIcHJlZmFiQXNzZXRVdWlkPSR7dmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCB8fCAnbnVsbCd977yJYFxuICAgICAgICAgICAgICAgICAgICArIChsaW5rZWQuZXJyb3JzLmxlbmd0aCA+IDAgPyBg77yb6ZO+5o6l5Zue5aGr5aSx6LSl77yaJHtsaW5rZWQuZXJyb3JzLmpvaW4oJzsgJyl9YCA6ICcnKSxcbiAgICAgICAgICAgICAgICBjbGVhbnVwRXJyb3JcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICBpbmRleDogaW5kZXggKyAxLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiBub3JtYWxpemVFcnJvcihlcnJvcilcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgc3VtbWFyeSA9IGF0dGVtcHRzLm1hcCgoaXRlbSkgPT4gYCMke2l0ZW0uaW5kZXh9ICR7aXRlbS5kZXRhaWx9YCkuam9pbignIHwgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKHN1bW1hcnkgfHwgJ+aJgOaciSBjcmVhdGUtbm9kZSDmlrnmoYjpg73mnKrmiJDlip/lu7rnq4sgUHJlZmFiIOWFs+iBlCcpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQcmVmYWJDcmVhdGVPcHRpb25zKGFyZ3M6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGNvbnN0IG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgaWYgKGFzc2V0VXVpZCkge1xuICAgICAgICBvcHRpb25zLmFzc2V0VXVpZCA9IGFzc2V0VXVpZDtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJlbnRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wYXJlbnRVdWlkKTtcbiAgICBpZiAocGFyZW50VXVpZCkge1xuICAgICAgICBvcHRpb25zLnBhcmVudCA9IHBhcmVudFV1aWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbmFtZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubmFtZSk7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lID0gbmFtZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZ3M/LmtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIG9wdGlvbnMua2VlcFdvcmxkVHJhbnNmb3JtID0gYXJncy5rZWVwV29ybGRUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzPy51bmxpbmtQcmVmYWIgPT09ICdib29sZWFuJykge1xuICAgICAgICBvcHRpb25zLnVubGlua1ByZWZhYiA9IGFyZ3MudW5saW5rUHJlZmFiO1xuICAgIH1cblxuICAgIGlmIChhcmdzPy5wb3NpdGlvbiAmJiB0eXBlb2YgYXJncy5wb3NpdGlvbiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0aW9ucy5wb3NpdGlvbiA9IGFyZ3MucG9zaXRpb247XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJlZmFiVG9Ob2RlKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJlZmFiQXNzZXRVdWlkOiBzdHJpbmcgfCBudWxsXG4pOiBQcm9taXNlPHsgbWV0aG9kOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IGF0dGVtcHRzOiBBcnJheTx7IG1ldGhvZDogc3RyaW5nOyBhcmdzOiBhbnlbXTsgbGFiZWw6IHN0cmluZyB9PiA9IFtcbiAgICAgICAgeyBtZXRob2Q6ICdhcHBseS1wcmVmYWInLCBhcmdzOiBbbm9kZVV1aWRdLCBsYWJlbDogJ2FwcGx5LXByZWZhYihzdHJpbmcpJyB9LFxuICAgICAgICB7IG1ldGhvZDogJ2FwcGx5LXByZWZhYicsIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkIH1dLCBsYWJlbDogJ2FwcGx5LXByZWZhYih7dXVpZH0pJyB9XG4gICAgXTtcblxuICAgIGlmIChwcmVmYWJBc3NldFV1aWQpIHtcbiAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICBtZXRob2Q6ICdhcHBseS1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiQXNzZXRVdWlkIH1dLFxuICAgICAgICAgICAgbGFiZWw6ICdhcHBseS1wcmVmYWIoe25vZGUscHJlZmFifSknXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGF0dGVtcHRzLnB1c2goeyBtZXRob2Q6ICdhcHBseS1wcmVmYWItbGluaycsIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkIH1dLCBsYWJlbDogJ2FwcGx5LXByZWZhYi1saW5rKHt1dWlkfSknIH0pO1xuICAgIGlmIChwcmVmYWJBc3NldFV1aWQpIHtcbiAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICBtZXRob2Q6ICdhcHBseS1wcmVmYWItbGluaycsXG4gICAgICAgICAgICBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ2FwcGx5LXByZWZhYi1saW5rKHtub2RlLHByZWZhYn0pJ1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBhdHRlbXB0IG9mIGF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgYXR0ZW1wdC5tZXRob2QsIC4uLmF0dGVtcHQuYXJncyk7XG4gICAgICAgICAgICByZXR1cm4geyBtZXRob2Q6IGAke2F0dGVtcHQubWV0aG9kfToke2F0dGVtcHQubGFiZWx9YCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgJHthdHRlbXB0LmxhYmVsfSA9PiAke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuam9pbignOyAnKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcmVmYWJMaWZlY3ljbGVUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2NyZWF0ZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WfuuS6jiBQcmVmYWIg6LWE5rqQIFVVSUQg5Yib5bu65a6e5L6L6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcmVmYWIg6LWE5rqQIFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM54i26IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5a6e5L6L6IqC54K55ZCN56ewJyB9LFxuICAgICAgICAgICAgICAgICAgICB1bmxpbmtQcmVmYWI6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWIm+W7uuWQjuaYr+WQpuino+mZpCBQcmVmYWIg5YWz6IGUJyB9LFxuICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaYr+WQpuS/neaMgeS4lueVjOWPmOaNoicgfSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzlrp7kvovliJ3lp4vkvY3nva4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuY3JlYXRlLW5vZGUnLCAnc2NlbmUucXVlcnktbm9kZScsICdhc3NldC1kYi5xdWVyeS1hc3NldC1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplUHJlZmFiQ3JlYXRlT3B0aW9ucyhhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMuYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhc3NldFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFzc2V0VHlwZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBvcHRpb25zLmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFR5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFzc2V0SW5mbz8udHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRUeXBlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBjcmVhdGVWZXJpZmllZFByZWZhYkluc3RhbmNlKHJlcXVlc3Rlciwgb3B0aW9ucywgb3B0aW9ucy5hc3NldFV1aWQsIGFzc2V0VHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogY3JlYXRlZC5ub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNyZWF0ZWQub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYkFzc2V0VXVpZDogY3JlYXRlZC52ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiU3RhdGU6IGNyZWF0ZWQudmVyaWZpY2F0aW9uLnByZWZhYlN0YXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0ZW1wdHM6IGNyZWF0ZWQuYXR0ZW1wdHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yib5bu6IFByZWZhYiDlrp7kvovlpLHotKXvvIjmnKrlu7rnq4vmnInmlYggUHJlZmFiIOWFs+iBlO+8iScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSwgJ0VfUFJFRkFCX0NSRUFURV9OT1RfTElOS0VEJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3F1ZXJ5X25vZGVzX2J5X2Fzc2V0X3V1aWQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlvJXnlKjmjIflrpogUHJlZmFiIOi1hOa6kOeahOiKgueCuSBVVUlEIOWIl+ihqCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUHJlZmFiIOi1hOa6kCBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnYXNzZXRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWRzID0gQXJyYXkuaXNBcnJheSh1dWlkcykgPyB1dWlkcyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IG5vZGVVdWlkcy5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIFByZWZhYiDlrp7kvovoioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9nZXRfaW5zdGFuY2VfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMieiKgueCuSBVVUlEIOafpeivoiBQcmVmYWIg5a6e5L6L5L+h5oGvJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5pbmZvXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBQcmVmYWIg5a6e5L6L5L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2UnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIYgUHJlZmFiIOWunuS+i+iKgueCueeahOaUueWKqOW6lOeUqOWbnuWFs+iBlOi1hOa6kO+8iOWunumqjOiDveWKm++8iScsXG4gICAgICAgICAgICBsYXllcjogJ2V4cGVyaW1lbnRhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5LuF55So5LqO5qCh6aqM5b2T5YmN5YWz6IGU6LWE5rqQIFVVSUQg5piv5ZCm5LiA6Ie0JyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuYXBwbHktcHJlZmFiJywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZmFiVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucHJlZmFiVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmVmb3JlID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYmVmb3JlLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfnm67moIfoioLngrnlvZPliY3kuI3mmK8gUHJlZmFiIOWunuS+i++8jOaXoOazlSBhcHBseScsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX0lOU1RBTkNFX1JFUVVJUkVEJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJlZmFiVXVpZCAmJiBiZWZvcmUucHJlZmFiQXNzZXRVdWlkICYmIGJlZm9yZS5wcmVmYWJBc3NldFV1aWQgIT09IHByZWZhYlV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwcmVmYWJVdWlkIOS4juiKgueCueW9k+WJjeWFs+iBlOi1hOa6kOS4jeS4gOiHtO+8jOWumOaWuSBBUEkg5LiN5pSv5oyB6LeoIFByZWZhYiDnm7TmjqXlhbPogZQnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQgPSBhd2FpdCBhcHBseVByZWZhYlRvTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBiZWZvcmUucHJlZmFiQXNzZXRVdWlkIHx8IHByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhZnRlciA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFmdGVyLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhcHBseSDov5Tlm57miJDlip/kvYboioLngrnmnKrkv53mjIEgUHJlZmFiIOWunuS+i+eKtuaAgScsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX0FQUExZX1ZFUklGWV9GQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiBiZWZvcmUucHJlZmFiQXNzZXRVdWlkIHx8IHByZWZhYlV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogYXBwbGllZC5tZXRob2QsXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWZvcmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZnRlclxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflupTnlKggUHJlZmFiIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2FwcGx5X2luc3RhbmNlc19ieV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMiSBQcmVmYWIg6LWE5rqQIFVVSUQg5om56YeP5bqU55So5a6e5L6L77yI5a6e6aqM6IO95Yqb77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXhwZXJpbWVudGFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55So5LqO562b6YCJ5a6e5L6L6IqC54K555qEIFByZWZhYiDotYTmupAgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UHJlZmFiVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzku4XnlKjkuo7moKHpqozvvIzoi6XkvKDlhaXlv4XpobvnrYnkuo4gYXNzZXRVdWlkJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCAnc2NlbmUuYXBwbHktcHJlZmFiJywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQcmVmYWJVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YXJnZXRQcmVmYWJVdWlkKSB8fCBhc3NldFV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFByZWZhYlV1aWQgIT09IGFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5a6Y5pa5IEFQSSDkuI3mlK/mjIHmjIkgdGFyZ2V0UHJlZmFiVXVpZCDot6jotYTmupDmibnph4/lhbPogZTvvIx0YXJnZXRQcmVmYWJVdWlkIOW/hemhu+etieS6jiBhc3NldFV1aWQnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IEFycmF5LmlzQXJyYXkodXVpZHMpID8gdXVpZHMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwbGllZDogQXJyYXk8eyBub2RlVXVpZDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZyB9PiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQ6IEFycmF5PHsgbm9kZVV1aWQ6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZVV1aWQgb2Ygbm9kZVV1aWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghYmVmb3JlLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLnB1c2goeyBub2RlVXVpZCwgZXJyb3I6ICfoioLngrnkuI3mmK8gUHJlZmFiIOWunuS+i++8jOi3s+i/hyBhcHBseScgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiZWZvcmUucHJlZmFiQXNzZXRVdWlkICYmIGJlZm9yZS5wcmVmYWJBc3NldFV1aWQgIT09IGFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBg6IqC54K55YWz6IGU6LWE5rqQ5LiO562b6YCJ6LWE5rqQ5LiN5LiA6Ie077yIZXhwZWN0ZWQ9JHthc3NldFV1aWR9LCBhY3R1YWw9JHtiZWZvcmUucHJlZmFiQXNzZXRVdWlkfe+8iWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwcGx5UHJlZmFiVG9Ob2RlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIHRhcmdldFByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFmdGVyID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFhZnRlci5pc1ByZWZhYkluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZC5wdXNoKHsgbm9kZVV1aWQsIGVycm9yOiAnYXBwbHkg5ZCO6IqC54K55aSx5Y67IFByZWZhYiDlrp7kvovnirbmgIEnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkLnB1c2goeyBub2RlVXVpZCwgbWV0aG9kOiByZXN1bHQubWV0aG9kIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZC5wdXNoKHsgbm9kZVV1aWQsIGVycm9yOiBub3JtYWxpemVFcnJvcihlcnJvcikgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZDogbm9kZVV1aWRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcGxpZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQ6IGFwcGxpZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50OiBmYWlsZWQubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJuemHj+W6lOeUqCBQcmVmYWIg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+i/mOWOn+aMh+WumiBQcmVmYWIg5a6e5L6L6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+mcgOimgei/mOWOn+eahOiKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzdG9yZS1wcmVmYWInXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHJlc3RvcmVkOiB0cnVlLCBub2RlVXVpZCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfov5jljp8gUHJlZmFiIOWunuS+i+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2VzX2J5X2Fzc2V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJIFByZWZhYiDotYTmupAgVVVJRCDmibnph4/ov5jljp/lrp7kvovoioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1ByZWZhYiDotYTmupAgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgJ3NjZW5lLnJlc3RvcmUtcHJlZmFiJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IEFycmF5LmlzQXJyYXkodXVpZHMpID8gdXVpZHMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdG9yZWQ6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZDogQXJyYXk8eyBub2RlVXVpZDogc3RyaW5nOyBlcnJvcjogc3RyaW5nIH0+ID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBub2RlVXVpZCBvZiBub2RlVXVpZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdG9yZWQucHVzaChub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLnB1c2goeyBub2RlVXVpZCwgZXJyb3I6IG5vcm1hbGl6ZUVycm9yKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWQ6IG5vZGVVdWlkcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN0b3JlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudDogcmVzdG9yZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50OiBmYWlsZWQubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJuemHj+i/mOWOnyBQcmVmYWIg5a6e5L6L5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzZXRfbm9kZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjee9ruiKgueCueWIsOm7mOiupOeKtuaAgScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfoioLngrkgVVVJRCDmiJYgVVVJRCDliJfooagnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkcyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzZXQtbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWRzID0gdG9TdHJpbmdMaXN0KGFyZ3M/Lm5vZGVVdWlkcyk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVVdWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkcyDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3Jlc2V0LW5vZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZHMubGVuZ3RoID09PSAxID8gbm9kZVV1aWRzWzBdIDogbm9kZVV1aWRzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZXNldDogdHJ1ZSwgbm9kZVV1aWRzIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+mHjee9ruiKgueCueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc2V0X2NvbXBvbmVudCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjee9rue7hOS7tuWIsOm7mOiupOeKtuaAgScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+e7hOS7tiBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydjb21wb25lbnRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZXNldC1jb21wb25lbnQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29tcG9uZW50VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3Jlc2V0LWNvbXBvbmVudCcsIHsgdXVpZDogY29tcG9uZW50VXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgcmVzZXQ6IHRydWUsIGNvbXBvbmVudFV1aWQgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6YeN572u57uE5Lu25aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBdO1xufVxuIl19