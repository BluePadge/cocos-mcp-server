"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrefabLifecycleTools = createPrefabLifecycleTools;
const common_1 = require("./common");
const prefab_link_fallback_1 = require("./prefab-link-fallback");
const prefab_instance_utils_1 = require("./prefab-instance-utils");
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
    const errors = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', attempt.method, ...attempt.args);
            const verification = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
    const candidates = (0, prefab_instance_utils_1.buildCreateNodeCandidates)(baseOptions, assetType);
    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        try {
            const created = await requester('scene', 'create-node', candidate);
            const nodeUuid = (0, prefab_instance_utils_1.resolveNodeUuid)(created);
            if (!nodeUuid) {
                attempts.push({
                    index: index + 1,
                    options: candidate,
                    verified: false,
                    detail: 'create-node 未返回有效节点 UUID'
                });
                continue;
            }
            const verification = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
function resolveAssetUuid(result) {
    if (typeof result === 'string' && result.trim() !== '') {
        return result.trim();
    }
    if (Array.isArray(result) && typeof result[0] === 'string' && result[0].trim() !== '') {
        return result[0].trim();
    }
    if (result && typeof result === 'object') {
        const direct = (0, common_1.readDumpString)(result.uuid)
            || (0, common_1.readDumpString)(result.assetUuid)
            || (0, common_1.readDumpString)(result.prefabUuid)
            || (0, common_1.readDumpString)(result.value);
        if (direct) {
            return direct;
        }
    }
    return null;
}
async function createPrefabAssetFromNode(requester, nodeUuid, targetUrl) {
    const attempts = [
        { args: [nodeUuid, targetUrl], label: 'create-prefab(nodeUuid, targetUrl)' },
        { args: [{ uuid: nodeUuid, url: targetUrl }], label: 'create-prefab({uuid,url})' },
        { args: [{ nodeUuid, targetUrl }], label: 'create-prefab({nodeUuid,targetUrl})' },
        { args: [{ node: nodeUuid, url: targetUrl }], label: 'create-prefab({node,url})' }
    ];
    const errors = [];
    for (const attempt of attempts) {
        try {
            const result = await requester('scene', 'create-prefab', ...attempt.args);
            return {
                method: attempt.label,
                prefabUuid: resolveAssetUuid(result),
                rawResult: result
            };
        }
        catch (error) {
            errors.push(`${attempt.label} => ${(0, common_1.normalizeError)(error)}`);
        }
    }
    throw new Error(errors.join('; '));
}
async function unlinkPrefabFromNode(requester, nodeUuid, removeNested) {
    const attempts = [
        { args: [nodeUuid, removeNested], label: 'unlink-prefab(nodeUuid, removeNested)' },
        { args: [{ uuid: nodeUuid, removeNested }], label: 'unlink-prefab({uuid,removeNested})' },
        { args: [{ node: nodeUuid, removeNested }], label: 'unlink-prefab({node,removeNested})' },
        { args: [nodeUuid], label: 'unlink-prefab(nodeUuid)' }
    ];
    const errors = [];
    for (const attempt of attempts) {
        try {
            await requester('scene', 'unlink-prefab', ...attempt.args);
            return { method: attempt.label };
        }
        catch (error) {
            errors.push(`${attempt.label} => ${(0, common_1.normalizeError)(error)}`);
        }
    }
    throw new Error(errors.join('; '));
}
async function queryAssetInfoWithRetry(requester, targetUrl, maxAttempts = 5, intervalMs = 120) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const info = await requester('asset-db', 'query-asset-info', targetUrl);
            if (info) {
                return info;
            }
        }
        catch (_a) {
            // ignore and retry
        }
        if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
    }
    return null;
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
                        assetType = (0, prefab_instance_utils_1.resolveNodeAssetType)(assetInfo);
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
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const targetUrl = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.targetUrl);
                if (!nodeUuid || !targetUrl) {
                    return (0, common_1.fail)('nodeUuid 与 targetUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!targetUrl.startsWith('db://') || !targetUrl.endsWith('.prefab')) {
                    return (0, common_1.fail)('targetUrl 必须为 db:// 前缀且以 .prefab 结尾', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const created = await createPrefabAssetFromNode(requester, nodeUuid, targetUrl);
                    const assetInfo = await queryAssetInfoWithRetry(requester, targetUrl);
                    if (!assetInfo) {
                        return (0, common_1.fail)('创建 Prefab 资源后未能查询到资产信息', undefined, 'E_PREFAB_ASSET_VERIFY_FAILED');
                    }
                    return (0, common_1.ok)({
                        created: true,
                        nodeUuid,
                        targetUrl,
                        method: created.method,
                        prefabUuid: (0, common_1.toNonEmptyString)(assetInfo.uuid) || created.prefabUuid || null,
                        assetInfo
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('创建 Prefab 资源失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                if (!nodeUuid || !assetUuid) {
                    return (0, common_1.fail)('nodeUuid 与 assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const before = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
                    const linked = await (0, prefab_link_fallback_1.linkPrefabToNodeByMessage)(requester, nodeUuid, assetUuid);
                    const after = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
                    const assetMatched = !after.prefabAssetUuid || after.prefabAssetUuid === assetUuid;
                    if (after.isPrefabInstance && assetMatched) {
                        return (0, common_1.ok)({
                            linked: true,
                            nodeUuid,
                            assetUuid,
                            method: linked.method,
                            replaced: false,
                            before,
                            after
                        });
                    }
                    const fallbackErrors = [];
                    try {
                        const replacement = await (0, prefab_link_fallback_1.replaceNodeWithPrefabInstance)(requester, nodeUuid, assetUuid);
                        const replacementInfo = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, replacement.replacementNodeUuid);
                        const replacementAssetMatched = !replacementInfo.prefabAssetUuid || replacementInfo.prefabAssetUuid === assetUuid;
                        if (replacementInfo.isPrefabInstance && replacementAssetMatched) {
                            return (0, common_1.ok)({
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
                        fallbackErrors.push(`fallback 替换节点后仍未形成实例关联（replacementNodeUuid=${replacement.replacementNodeUuid}）`
                            + (rollbackError ? `；回滚失败：${rollbackError}` : ''));
                    }
                    catch (fallbackError) {
                        fallbackErrors.push((0, common_1.normalizeError)(fallbackError));
                    }
                    return (0, common_1.fail)('节点链接后未形成期望的 Prefab 关联', fallbackErrors.join('; '), 'E_PREFAB_LINK_VERIFY_FAILED');
                }
                catch (error) {
                    return (0, common_1.fail)('链接 Prefab 失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                if (!nodeUuid) {
                    return (0, common_1.fail)('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const removeNested = typeof (args === null || args === void 0 ? void 0 : args.removeNested) === 'boolean' ? args.removeNested : false;
                try {
                    const before = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
                    if (!before.isPrefabInstance) {
                        return (0, common_1.fail)('目标节点当前不是 Prefab 实例，无法解除关联', undefined, 'E_PREFAB_INSTANCE_REQUIRED');
                    }
                    const unlinked = await unlinkPrefabFromNode(requester, nodeUuid, removeNested);
                    const after = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
                    const stillLinked = Boolean(after.prefabAssetUuid)
                        || (typeof after.prefabState === 'number' && after.prefabState > 0);
                    if (stillLinked) {
                        return (0, common_1.fail)('解除关联后节点仍保留 Prefab 关联', undefined, 'E_PREFAB_UNLINK_VERIFY_FAILED');
                    }
                    return (0, common_1.ok)({
                        unlinked: true,
                        nodeUuid,
                        removeNested,
                        method: unlinked.method,
                        before,
                        after
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('解除 Prefab 关联失败', (0, common_1.normalizeError)(error));
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
                    const info = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
                    const before = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
                    if (!before.isPrefabInstance) {
                        return (0, common_1.fail)('目标节点当前不是 Prefab 实例，无法 apply', undefined, 'E_PREFAB_INSTANCE_REQUIRED');
                    }
                    if (prefabUuid && before.prefabAssetUuid && before.prefabAssetUuid !== prefabUuid) {
                        return (0, common_1.fail)('prefabUuid 与节点当前关联资源不一致，官方 API 不支持跨 Prefab 直接关联', undefined, 'E_INVALID_ARGUMENT');
                    }
                    const applied = await applyPrefabToNode(requester, nodeUuid, before.prefabAssetUuid || prefabUuid);
                    const after = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
                            const before = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
                            const after = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmFiLWxpZmVjeWNsZS10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL3ByZWZhYi1saWZlY3ljbGUtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFnWEEsZ0VBK2hCQztBQTk0QkQscUNBQW9HO0FBQ3BHLGlFQUFrRztBQUNsRyxtRUFNaUM7QUFFakMsS0FBSyxVQUFVLGlCQUFpQixDQUFDLFNBQTBCLEVBQUUsUUFBZ0I7SUFDekUsSUFBSSxDQUFDO1FBQ0QsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ2xCLE9BQU8sSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLENBQUM7QUFDTCxDQUFDO0FBdUJELEtBQUssVUFBVSxtQkFBbUIsQ0FDOUIsU0FBMEIsRUFDMUIsUUFBZ0IsRUFDaEIsaUJBQXlCO0lBRXpCLE1BQU0sUUFBUSxHQUEwRDtRQUNwRTtZQUNJLE1BQU0sRUFBRSxhQUFhO1lBQ3JCLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQztZQUNuQyxLQUFLLEVBQUUsa0NBQWtDO1NBQzVDO1FBQ0Q7WUFDSSxNQUFNLEVBQUUsYUFBYTtZQUNyQixJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFLENBQUM7WUFDeEQsS0FBSyxFQUFFLCtCQUErQjtTQUN6QztRQUNEO1lBQ0ksTUFBTSxFQUFFLGFBQWE7WUFDckIsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3JELEtBQUssRUFBRSw0QkFBNEI7U0FDdEM7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QzlCLFdBQVcsRUFBRSxXQUFXO1lBQ3hCLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLFdBQVcsRUFBRTtnQkFDVCxJQUFJLEVBQUUsUUFBUTtnQkFDZCxVQUFVLEVBQUU7b0JBQ1IsYUFBYSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFO2lCQUM1RDtnQkFDRCxRQUFRLEVBQUUsQ0FBQyxlQUFlLENBQUM7YUFDOUI7WUFDRCxvQkFBb0IsRUFBRSxDQUFDLHVCQUF1QixDQUFDO1lBQy9DLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBUyxFQUFFLEVBQUU7Z0JBQ3JCLE1BQU0sYUFBYSxHQUFHLElBQUEseUJBQWdCLEVBQUMsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLGFBQWEsQ0FBQyxDQUFDO2dCQUM1RCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQ2pCLE9BQU8sSUFBQSxhQUFJLEVBQUMsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7Z0JBQ3JFLENBQUM7Z0JBRUQsSUFBSSxDQUFDO29CQUNELE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO29CQUNyRSxPQUFPLElBQUEsV0FBRSxFQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDO2dCQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7b0JBQ2xCLE9BQU8sSUFBQSxhQUFJLEVBQUMsUUFBUSxFQUFFLElBQUEsdUJBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNqRCxDQUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHJlYWREdW1wU3RyaW5nLCB0b05vbkVtcHR5U3RyaW5nLCB0b1N0cmluZ0xpc3QgfSBmcm9tICcuL2NvbW1vbic7XG5pbXBvcnQgeyBsaW5rUHJlZmFiVG9Ob2RlQnlNZXNzYWdlLCByZXBsYWNlTm9kZVdpdGhQcmVmYWJJbnN0YW5jZSB9IGZyb20gJy4vcHJlZmFiLWxpbmstZmFsbGJhY2snO1xuaW1wb3J0IHtcbiAgICBidWlsZENyZWF0ZU5vZGVDYW5kaWRhdGVzLFxuICAgIFByZWZhYkluc3RhbmNlSW5mbyxcbiAgICBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyxcbiAgICByZXNvbHZlTm9kZUFzc2V0VHlwZSxcbiAgICByZXNvbHZlTm9kZVV1aWRcbn0gZnJvbSAnLi9wcmVmYWItaW5zdGFuY2UtdXRpbHMnO1xuXG5hc3luYyBmdW5jdGlvbiByZW1vdmVOb2RlUXVpZXRseShyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlciwgbm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7IHV1aWQ6IG5vZGVVdWlkIH0pO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIHJldHVybiBub3JtYWxpemVFcnJvcihlcnJvcik7XG4gICAgfVxufVxuXG5pbnRlcmZhY2UgQ3JlYXRlVmVyaWZpZWRQcmVmYWJSZXN1bHQge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7XG4gICAgb3B0aW9uczogUmVjb3JkPHN0cmluZywgYW55PjtcbiAgICB2ZXJpZmljYXRpb246IFByZWZhYkluc3RhbmNlSW5mbztcbiAgICBhdHRlbXB0czogQXJyYXk8e1xuICAgICAgICBpbmRleDogbnVtYmVyO1xuICAgICAgICBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICAgICAgICBub2RlVXVpZD86IHN0cmluZztcbiAgICAgICAgdmVyaWZpZWQ6IGJvb2xlYW47XG4gICAgICAgIGRldGFpbDogc3RyaW5nO1xuICAgICAgICBjbGVhbnVwRXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICAgIH0+O1xufVxuXG5pbnRlcmZhY2UgUHJlZmFiTGlua0F0dGVtcHRSZXN1bHQge1xuICAgIGxpbmtlZDogYm9vbGVhbjtcbiAgICBtZXRob2Q6IHN0cmluZyB8IG51bGw7XG4gICAgdmVyaWZpY2F0aW9uPzogUHJlZmFiSW5zdGFuY2VJbmZvO1xuICAgIGVycm9yczogc3RyaW5nW107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRyeUxpbmtQcmVmYWJUb05vZGUoXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBleHBlY3RlZEFzc2V0VXVpZDogc3RyaW5nXG4pOiBQcm9taXNlPFByZWZhYkxpbmtBdHRlbXB0UmVzdWx0PiB7XG4gICAgY29uc3QgYXR0ZW1wdHM6IEFycmF5PHsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdOyBsYWJlbDogc3RyaW5nIH0+ID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdsaW5rLXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbbm9kZVV1aWQsIGV4cGVjdGVkQXNzZXRVdWlkXSxcbiAgICAgICAgICAgIGxhYmVsOiAnbGluay1wcmVmYWIobm9kZVV1aWQsIGFzc2V0VXVpZCknXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ2xpbmstcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkLCBhc3NldFV1aWQ6IGV4cGVjdGVkQXNzZXRVdWlkIH1dLFxuICAgICAgICAgICAgbGFiZWw6ICdsaW5rLXByZWZhYih7dXVpZCxhc3NldFV1aWR9KSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAnbGluay1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogZXhwZWN0ZWRBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ2xpbmstcHJlZmFiKHtub2RlLHByZWZhYn0pJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdyZXN0b3JlLXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbbm9kZVV1aWQsIGV4cGVjdGVkQXNzZXRVdWlkXSxcbiAgICAgICAgICAgIGxhYmVsOiAncmVzdG9yZS1wcmVmYWIobm9kZVV1aWQsYXNzZXRVdWlkKSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAncmVzdG9yZS1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgdXVpZDogbm9kZVV1aWQsIGFzc2V0VXVpZDogZXhwZWN0ZWRBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ3Jlc3RvcmUtcHJlZmFiKHt1dWlkLGFzc2V0VXVpZH0pJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdyZXN0b3JlLXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbbm9kZVV1aWRdLFxuICAgICAgICAgICAgbGFiZWw6ICdyZXN0b3JlLXByZWZhYihub2RlVXVpZCknXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ3Jlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkIH1dLFxuICAgICAgICAgICAgbGFiZWw6ICdyZXN0b3JlLXByZWZhYih7dXVpZH0pJ1xuICAgICAgICB9XG4gICAgXTtcblxuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGF0dGVtcHQgb2YgYXR0ZW1wdHMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCBhdHRlbXB0Lm1ldGhvZCwgLi4uYXR0ZW1wdC5hcmdzKTtcbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbiA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRNYXRjaGVkID0gIXZlcmlmaWNhdGlvbi5wcmVmYWJBc3NldFV1aWQgfHwgdmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCA9PT0gZXhwZWN0ZWRBc3NldFV1aWQ7XG4gICAgICAgICAgICBpZiAodmVyaWZpY2F0aW9uLmlzUHJlZmFiSW5zdGFuY2UgJiYgYXNzZXRNYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgbGlua2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGAke2F0dGVtcHQubWV0aG9kfToke2F0dGVtcHQubGFiZWx9YCxcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcnNcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgICAgYCR7YXR0ZW1wdC5sYWJlbH0gPT4g5bey6LCD55So5L2G5pyq5bu656uL5YWz6IGU77yIcHJlZmFiQXNzZXRVdWlkPSR7dmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCB8fCAnbnVsbCd977yJYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goYCR7YXR0ZW1wdC5sYWJlbH0gPT4gJHtub3JtYWxpemVFcnJvcihlcnJvcil9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBsaW5rZWQ6IGZhbHNlLFxuICAgICAgICBtZXRob2Q6IG51bGwsXG4gICAgICAgIGVycm9yc1xuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVZlcmlmaWVkUHJlZmFiSW5zdGFuY2UoXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgYmFzZU9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT4sXG4gICAgZXhwZWN0ZWRBc3NldFV1aWQ6IHN0cmluZyxcbiAgICBhc3NldFR5cGU6IHN0cmluZyB8IG51bGxcbik6IFByb21pc2U8Q3JlYXRlVmVyaWZpZWRQcmVmYWJSZXN1bHQ+IHtcbiAgICBjb25zdCBhdHRlbXB0czogQ3JlYXRlVmVyaWZpZWRQcmVmYWJSZXN1bHRbJ2F0dGVtcHRzJ10gPSBbXTtcbiAgICBjb25zdCBjYW5kaWRhdGVzID0gYnVpbGRDcmVhdGVOb2RlQ2FuZGlkYXRlcyhiYXNlT3B0aW9ucywgYXNzZXRUeXBlKTtcblxuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjYW5kaWRhdGVzLmxlbmd0aDsgaW5kZXggKz0gMSkge1xuICAgICAgICBjb25zdCBjYW5kaWRhdGUgPSBjYW5kaWRhdGVzW2luZGV4XTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgY2FuZGlkYXRlKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gcmVzb2x2ZU5vZGVVdWlkKGNyZWF0ZWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgIGF0dGVtcHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXggKyAxLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiAnY3JlYXRlLW5vZGUg5pyq6L+U5Zue5pyJ5pWI6IqC54K5IFVVSUQnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbiA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRNYXRjaGVkID0gIXZlcmlmaWNhdGlvbi5wcmVmYWJBc3NldFV1aWQgfHwgdmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCA9PT0gZXhwZWN0ZWRBc3NldFV1aWQ7XG4gICAgICAgICAgICBpZiAodmVyaWZpY2F0aW9uLmlzUHJlZmFiSW5zdGFuY2UgJiYgYXNzZXRNYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCArIDEsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6ICflt7Lpqozor4HkuLogUHJlZmFiIOWunuS+iydcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGF0dGVtcHRzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbGlua2VkID0gYXdhaXQgdHJ5TGlua1ByZWZhYlRvTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBleHBlY3RlZEFzc2V0VXVpZCk7XG4gICAgICAgICAgICBpZiAobGlua2VkLmxpbmtlZCAmJiBsaW5rZWQudmVyaWZpY2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCArIDEsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IGDliJvlu7rlkI7nu48gJHtsaW5rZWQubWV0aG9kfSDlu7rnq4sgUHJlZmFiIOWFs+iBlGBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb246IGxpbmtlZC52ZXJpZmljYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGF0dGVtcHRzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2xlYW51cEVycm9yID0gYXdhaXQgcmVtb3ZlTm9kZVF1aWV0bHkocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICBpbmRleDogaW5kZXggKyAxLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiBg6IqC54K55pyq5bu656uLIFByZWZhYiDlhbPogZTvvIhwcmVmYWJBc3NldFV1aWQ9JHt2ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkIHx8ICdudWxsJ33vvIlgXG4gICAgICAgICAgICAgICAgICAgICsgKGxpbmtlZC5lcnJvcnMubGVuZ3RoID4gMCA/IGDvvJvpk77mjqXlm57loavlpLHotKXvvJoke2xpbmtlZC5lcnJvcnMuam9pbignOyAnKX1gIDogJycpLFxuICAgICAgICAgICAgICAgIGNsZWFudXBFcnJvclxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGF0dGVtcHRzLnB1c2goe1xuICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCArIDEsXG4gICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkZXRhaWw6IG5vcm1hbGl6ZUVycm9yKGVycm9yKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBzdW1tYXJ5ID0gYXR0ZW1wdHMubWFwKChpdGVtKSA9PiBgIyR7aXRlbS5pbmRleH0gJHtpdGVtLmRldGFpbH1gKS5qb2luKCcgfCAnKTtcbiAgICB0aHJvdyBuZXcgRXJyb3Ioc3VtbWFyeSB8fCAn5omA5pyJIGNyZWF0ZS1ub2RlIOaWueahiOmDveacquaIkOWKn+W7uueriyBQcmVmYWIg5YWz6IGUJyk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVByZWZhYkNyZWF0ZU9wdGlvbnMoYXJnczogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgY29uc3Qgb3B0aW9uczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICBpZiAoYXNzZXRVdWlkKSB7XG4gICAgICAgIG9wdGlvbnMuYXNzZXRVdWlkID0gYXNzZXRVdWlkO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhcmVudFV1aWQpO1xuICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgIG9wdGlvbnMucGFyZW50ID0gcGFyZW50VXVpZDtcbiAgICB9XG5cbiAgICBjb25zdCBuYW1lID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5uYW1lKTtcbiAgICBpZiAobmFtZSkge1xuICAgICAgICBvcHRpb25zLm5hbWUgPSBuYW1lO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJncz8ua2VlcFdvcmxkVHJhbnNmb3JtID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgb3B0aW9ucy5rZWVwV29ybGRUcmFuc2Zvcm0gPSBhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZ3M/LnVubGlua1ByZWZhYiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIG9wdGlvbnMudW5saW5rUHJlZmFiID0gYXJncy51bmxpbmtQcmVmYWI7XG4gICAgfVxuXG4gICAgaWYgKGFyZ3M/LnBvc2l0aW9uICYmIHR5cGVvZiBhcmdzLnBvc2l0aW9uID09PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRpb25zLnBvc2l0aW9uID0gYXJncy5wb3NpdGlvbjtcbiAgICB9XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlQcmVmYWJUb05vZGUoXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBwcmVmYWJBc3NldFV1aWQ6IHN0cmluZyB8IG51bGxcbik6IFByb21pc2U8eyBtZXRob2Q6IHN0cmluZyB9PiB7XG4gICAgY29uc3QgYXR0ZW1wdHM6IEFycmF5PHsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdOyBsYWJlbDogc3RyaW5nIH0+ID0gW1xuICAgICAgICB7IG1ldGhvZDogJ2FwcGx5LXByZWZhYicsIGFyZ3M6IFtub2RlVXVpZF0sIGxhYmVsOiAnYXBwbHktcHJlZmFiKHN0cmluZyknIH0sXG4gICAgICAgIHsgbWV0aG9kOiAnYXBwbHktcHJlZmFiJywgYXJnczogW3sgdXVpZDogbm9kZVV1aWQgfV0sIGxhYmVsOiAnYXBwbHktcHJlZmFiKHt1dWlkfSknIH1cbiAgICBdO1xuXG4gICAgaWYgKHByZWZhYkFzc2V0VXVpZCkge1xuICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgIG1ldGhvZDogJ2FwcGx5LXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ2FwcGx5LXByZWZhYih7bm9kZSxwcmVmYWJ9KSdcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXR0ZW1wdHMucHVzaCh7IG1ldGhvZDogJ2FwcGx5LXByZWZhYi1saW5rJywgYXJnczogW3sgdXVpZDogbm9kZVV1aWQgfV0sIGxhYmVsOiAnYXBwbHktcHJlZmFiLWxpbmsoe3V1aWR9KScgfSk7XG4gICAgaWYgKHByZWZhYkFzc2V0VXVpZCkge1xuICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgIG1ldGhvZDogJ2FwcGx5LXByZWZhYi1saW5rJyxcbiAgICAgICAgICAgIGFyZ3M6IFt7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYkFzc2V0VXVpZCB9XSxcbiAgICAgICAgICAgIGxhYmVsOiAnYXBwbHktcHJlZmFiLWxpbmsoe25vZGUscHJlZmFifSknXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGF0dGVtcHQgb2YgYXR0ZW1wdHMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCBhdHRlbXB0Lm1ldGhvZCwgLi4uYXR0ZW1wdC5hcmdzKTtcbiAgICAgICAgICAgIHJldHVybiB7IG1ldGhvZDogYCR7YXR0ZW1wdC5tZXRob2R9OiR7YXR0ZW1wdC5sYWJlbH1gIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGAke2F0dGVtcHQubGFiZWx9ID0+ICR7bm9ybWFsaXplRXJyb3IoZXJyb3IpfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5qb2luKCc7ICcpKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUFzc2V0VXVpZChyZXN1bHQ6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJyAmJiByZXN1bHQudHJpbSgpICE9PSAnJykge1xuICAgICAgICByZXR1cm4gcmVzdWx0LnRyaW0oKTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHQpICYmIHR5cGVvZiByZXN1bHRbMF0gPT09ICdzdHJpbmcnICYmIHJlc3VsdFswXS50cmltKCkgIT09ICcnKSB7XG4gICAgICAgIHJldHVybiByZXN1bHRbMF0udHJpbSgpO1xuICAgIH1cblxuICAgIGlmIChyZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgY29uc3QgZGlyZWN0ID0gcmVhZER1bXBTdHJpbmcocmVzdWx0LnV1aWQpXG4gICAgICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhyZXN1bHQuYXNzZXRVdWlkKVxuICAgICAgICAgICAgfHwgcmVhZER1bXBTdHJpbmcocmVzdWx0LnByZWZhYlV1aWQpXG4gICAgICAgICAgICB8fCByZWFkRHVtcFN0cmluZyhyZXN1bHQudmFsdWUpO1xuICAgICAgICBpZiAoZGlyZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gZGlyZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVByZWZhYkFzc2V0RnJvbU5vZGUoXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICB0YXJnZXRVcmw6IHN0cmluZ1xuKTogUHJvbWlzZTx7IG1ldGhvZDogc3RyaW5nOyBwcmVmYWJVdWlkOiBzdHJpbmcgfCBudWxsOyByYXdSZXN1bHQ6IGFueSB9PiB7XG4gICAgY29uc3QgYXR0ZW1wdHM6IEFycmF5PHsgYXJnczogYW55W107IGxhYmVsOiBzdHJpbmcgfT4gPSBbXG4gICAgICAgIHsgYXJnczogW25vZGVVdWlkLCB0YXJnZXRVcmxdLCBsYWJlbDogJ2NyZWF0ZS1wcmVmYWIobm9kZVV1aWQsIHRhcmdldFVybCknIH0sXG4gICAgICAgIHsgYXJnczogW3sgdXVpZDogbm9kZVV1aWQsIHVybDogdGFyZ2V0VXJsIH1dLCBsYWJlbDogJ2NyZWF0ZS1wcmVmYWIoe3V1aWQsdXJsfSknIH0sXG4gICAgICAgIHsgYXJnczogW3sgbm9kZVV1aWQsIHRhcmdldFVybCB9XSwgbGFiZWw6ICdjcmVhdGUtcHJlZmFiKHtub2RlVXVpZCx0YXJnZXRVcmx9KScgfSxcbiAgICAgICAgeyBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgdXJsOiB0YXJnZXRVcmwgfV0sIGxhYmVsOiAnY3JlYXRlLXByZWZhYih7bm9kZSx1cmx9KScgfVxuICAgIF07XG5cbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBhdHRlbXB0IG9mIGF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NyZWF0ZS1wcmVmYWInLCAuLi5hdHRlbXB0LmFyZ3MpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IGF0dGVtcHQubGFiZWwsXG4gICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogcmVzb2x2ZUFzc2V0VXVpZChyZXN1bHQpLFxuICAgICAgICAgICAgICAgIHJhd1Jlc3VsdDogcmVzdWx0XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgJHthdHRlbXB0LmxhYmVsfSA9PiAke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuam9pbignOyAnKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVubGlua1ByZWZhYkZyb21Ob2RlKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcmVtb3ZlTmVzdGVkOiBib29sZWFuXG4pOiBQcm9taXNlPHsgbWV0aG9kOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IGF0dGVtcHRzOiBBcnJheTx7IGFyZ3M6IGFueVtdOyBsYWJlbDogc3RyaW5nIH0+ID0gW1xuICAgICAgICB7IGFyZ3M6IFtub2RlVXVpZCwgcmVtb3ZlTmVzdGVkXSwgbGFiZWw6ICd1bmxpbmstcHJlZmFiKG5vZGVVdWlkLCByZW1vdmVOZXN0ZWQpJyB9LFxuICAgICAgICB7IGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkLCByZW1vdmVOZXN0ZWQgfV0sIGxhYmVsOiAndW5saW5rLXByZWZhYih7dXVpZCxyZW1vdmVOZXN0ZWR9KScgfSxcbiAgICAgICAgeyBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgcmVtb3ZlTmVzdGVkIH1dLCBsYWJlbDogJ3VubGluay1wcmVmYWIoe25vZGUscmVtb3ZlTmVzdGVkfSknIH0sXG4gICAgICAgIHsgYXJnczogW25vZGVVdWlkXSwgbGFiZWw6ICd1bmxpbmstcHJlZmFiKG5vZGVVdWlkKScgfVxuICAgIF07XG5cbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBhdHRlbXB0IG9mIGF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3VubGluay1wcmVmYWInLCAuLi5hdHRlbXB0LmFyZ3MpO1xuICAgICAgICAgICAgcmV0dXJuIHsgbWV0aG9kOiBhdHRlbXB0LmxhYmVsIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGAke2F0dGVtcHQubGFiZWx9ID0+ICR7bm9ybWFsaXplRXJyb3IoZXJyb3IpfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5qb2luKCc7ICcpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcXVlcnlBc3NldEluZm9XaXRoUmV0cnkoXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgdGFyZ2V0VXJsOiBzdHJpbmcsXG4gICAgbWF4QXR0ZW1wdHMgPSA1LFxuICAgIGludGVydmFsTXMgPSAxMjBcbik6IFByb21pc2U8YW55IHwgbnVsbD4ge1xuICAgIGZvciAobGV0IGF0dGVtcHQgPSAwOyBhdHRlbXB0IDwgbWF4QXR0ZW1wdHM7IGF0dGVtcHQgKz0gMSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHRhcmdldFVybCk7XG4gICAgICAgICAgICBpZiAoaW5mbykge1xuICAgICAgICAgICAgICAgIHJldHVybiBpbmZvO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGlnbm9yZSBhbmQgcmV0cnlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRlbXB0IDwgbWF4QXR0ZW1wdHMgLSAxKSB7XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBpbnRlcnZhbE1zKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByZWZhYkxpZmVjeWNsZVRvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfY3JlYXRlX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Z+65LqOIFByZWZhYiDotYTmupAgVVVJRCDliJvlu7rlrp7kvovoioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1ByZWZhYiDotYTmupAgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzniLboioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzlrp7kvovoioLngrnlkI3np7AnIH0sXG4gICAgICAgICAgICAgICAgICAgIHVubGlua1ByZWZhYjogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5Yib5bu65ZCO5piv5ZCm6Kej6ZmkIFByZWZhYiDlhbPogZQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm5L+d5oyB5LiW55WM5Y+Y5o2iJyB9LFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWunuS+i+WIneWni+S9jee9ricsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5jcmVhdGUtbm9kZScsICdzY2VuZS5xdWVyeS1ub2RlJywgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBub3JtYWxpemVQcmVmYWJDcmVhdGVPcHRpb25zKGFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5hc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgYXNzZXRUeXBlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIG9wdGlvbnMuYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSA9IHJlc29sdmVOb2RlQXNzZXRUeXBlKGFzc2V0SW5mbyk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRUeXBlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBjcmVhdGVWZXJpZmllZFByZWZhYkluc3RhbmNlKHJlcXVlc3Rlciwgb3B0aW9ucywgb3B0aW9ucy5hc3NldFV1aWQsIGFzc2V0VHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogY3JlYXRlZC5ub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNyZWF0ZWQub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYkFzc2V0VXVpZDogY3JlYXRlZC52ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiU3RhdGU6IGNyZWF0ZWQudmVyaWZpY2F0aW9uLnByZWZhYlN0YXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0ZW1wdHM6IGNyZWF0ZWQuYXR0ZW1wdHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yib5bu6IFByZWZhYiDlrp7kvovlpLHotKXvvIjmnKrlu7rnq4vmnInmlYggUHJlZmFiIOWFs+iBlO+8iScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSwgJ0VfUFJFRkFCX0NSRUFURV9OT1RfTElOS0VEJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2NyZWF0ZV9hc3NldF9mcm9tX25vZGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIbmjIflrproioLngrnkv53lrZjkuLogUHJlZmFiIOi1hOa6kCcsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmupDoioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0VXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruaghyBQcmVmYWIgVVJM77yIZGI6Ly9hc3NldHMvKiovKi5wcmVmYWLvvIknIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJywgJ3RhcmdldFVybCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuY3JlYXRlLXByZWZhYicsICdhc3NldC1kYi5xdWVyeS1hc3NldC1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldFVybCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICF0YXJnZXRVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOS4jiB0YXJnZXRVcmwg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsLnN0YXJ0c1dpdGgoJ2RiOi8vJykgfHwgIXRhcmdldFVybC5lbmRzV2l0aCgnLnByZWZhYicpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd0YXJnZXRVcmwg5b+F6aG75Li6IGRiOi8vIOWJjee8gOS4lOS7pSAucHJlZmFiIOe7k+WwvicsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBjcmVhdGVQcmVmYWJBc3NldEZyb21Ob2RlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IHF1ZXJ5QXNzZXRJbmZvV2l0aFJldHJ5KHJlcXVlc3RlciwgdGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfliJvlu7ogUHJlZmFiIOi1hOa6kOWQjuacquiDveafpeivouWIsOi1hOS6p+S/oeaBrycsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX0FTU0VUX1ZFUklGWV9GQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRVcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGNyZWF0ZWQubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogdG9Ob25FbXB0eVN0cmluZyhhc3NldEluZm8udXVpZCkgfHwgY3JlYXRlZC5wcmVmYWJVdWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldEluZm9cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yib5bu6IFByZWZhYiDotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9saW5rX25vZGVfdG9fYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIboioLngrnkuI7mjIflrpogUHJlZmFiIOi1hOa6kOW7uueri+WFs+iBlCcsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnm67moIfoioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1ByZWZhYiDotYTmupAgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnLCAnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5saW5rLXByZWZhYicsICdzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOS4jiBhc3NldFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmVmb3JlID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmtlZCA9IGF3YWl0IGxpbmtQcmVmYWJUb05vZGVCeU1lc3NhZ2UocmVxdWVzdGVyLCBub2RlVXVpZCwgYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWZ0ZXIgPSBhd2FpdCBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRNYXRjaGVkID0gIWFmdGVyLnByZWZhYkFzc2V0VXVpZCB8fCBhZnRlci5wcmVmYWJBc3NldFV1aWQgPT09IGFzc2V0VXVpZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFmdGVyLmlzUHJlZmFiSW5zdGFuY2UgJiYgYXNzZXRNYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmtlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBsaW5rZWQubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZWZvcmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFsbGJhY2tFcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXBsYWNlbWVudCA9IGF3YWl0IHJlcGxhY2VOb2RlV2l0aFByZWZhYkluc3RhbmNlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXBsYWNlbWVudEluZm8gPSBhd2FpdCBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXIsIHJlcGxhY2VtZW50LnJlcGxhY2VtZW50Tm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVwbGFjZW1lbnRBc3NldE1hdGNoZWQgPSAhcmVwbGFjZW1lbnRJbmZvLnByZWZhYkFzc2V0VXVpZCB8fCByZXBsYWNlbWVudEluZm8ucHJlZmFiQXNzZXRVdWlkID09PSBhc3NldFV1aWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZW1lbnRJbmZvLmlzUHJlZmFiSW5zdGFuY2UgJiYgcmVwbGFjZW1lbnRBc3NldE1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5rZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiByZXBsYWNlbWVudC5yZXBsYWNlbWVudE5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbE5vZGVVdWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGAke2xpbmtlZC5tZXRob2R9IC0+IGZhbGxiYWNrOiR7cmVwbGFjZW1lbnQuY3JlYXRlTWV0aG9kfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZWZvcmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFmdGVyOiByZXBsYWNlbWVudEluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhbGxiYWNrV2FybmluZ3M6IHJlcGxhY2VtZW50Lndhcm5pbmdzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvbGxiYWNrRXJyb3IgPSBhd2FpdCByZW1vdmVOb2RlUXVpZXRseShyZXF1ZXN0ZXIsIHJlcGxhY2VtZW50LnJlcGxhY2VtZW50Tm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZmFsbGJhY2tFcnJvcnMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgZmFsbGJhY2sg5pu/5o2i6IqC54K55ZCO5LuN5pyq5b2i5oiQ5a6e5L6L5YWz6IGU77yIcmVwbGFjZW1lbnROb2RlVXVpZD0ke3JlcGxhY2VtZW50LnJlcGxhY2VtZW50Tm9kZVV1aWR977yJYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArIChyb2xsYmFja0Vycm9yID8gYO+8m+Wbnua7muWksei0pe+8miR7cm9sbGJhY2tFcnJvcn1gIDogJycpXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChmYWxsYmFja0Vycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhbGxiYWNrRXJyb3JzLnB1c2gobm9ybWFsaXplRXJyb3IoZmFsbGJhY2tFcnJvcikpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iKgueCuemTvuaOpeWQjuacquW9ouaIkOacn+acm+eahCBQcmVmYWIg5YWz6IGUJywgZmFsbGJhY2tFcnJvcnMuam9pbignOyAnKSwgJ0VfUFJFRkFCX0xJTktfVkVSSUZZX0ZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+mTvuaOpSBQcmVmYWIg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfdW5saW5rX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6Kej6Zmk6IqC54K55LiOIFByZWZhYiDotYTmupDnmoTlhbPogZQnLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZU5lc3RlZDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5piv5ZCm6YCS5b2S6Kej6Zmk5a2Q6IqC54K55YWz6IGU77yM6buY6K6kIGZhbHNlJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUudW5saW5rLXByZWZhYicsICdzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZU5lc3RlZCA9IHR5cGVvZiBhcmdzPy5yZW1vdmVOZXN0ZWQgPT09ICdib29sZWFuJyA/IGFyZ3MucmVtb3ZlTmVzdGVkIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmVmb3JlID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYmVmb3JlLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfnm67moIfoioLngrnlvZPliY3kuI3mmK8gUHJlZmFiIOWunuS+i++8jOaXoOazleino+mZpOWFs+iBlCcsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX0lOU1RBTkNFX1JFUVVJUkVEJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCB1bmxpbmtlZCA9IGF3YWl0IHVubGlua1ByZWZhYkZyb21Ob2RlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIHJlbW92ZU5lc3RlZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFmdGVyID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0aWxsTGlua2VkID0gQm9vbGVhbihhZnRlci5wcmVmYWJBc3NldFV1aWQpXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCAodHlwZW9mIGFmdGVyLnByZWZhYlN0YXRlID09PSAnbnVtYmVyJyAmJiBhZnRlci5wcmVmYWJTdGF0ZSA+IDApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RpbGxMaW5rZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfop6PpmaTlhbPogZTlkI7oioLngrnku43kv53nlZkgUHJlZmFiIOWFs+iBlCcsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX1VOTElOS19WRVJJRllfRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgdW5saW5rZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZU5lc3RlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogdW5saW5rZWQubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgYmVmb3JlLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6Kej6ZmkIFByZWZhYiDlhbPogZTlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9xdWVyeV9ub2Rlc19ieV9hc3NldF91dWlkJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5byV55So5oyH5a6aIFByZWZhYiDotYTmupDnmoToioLngrkgVVVJRCDliJfooagnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1ByZWZhYiDotYTmupAgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IEFycmF5LmlzQXJyYXkodXVpZHMpID8gdXVpZHMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiBub2RlVXVpZHMubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBQcmVmYWIg5a6e5L6L6IqC54K55aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfZ2V0X2luc3RhbmNlX2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmjInoioLngrkgVVVJRCDmn6Xor6IgUHJlZmFiIOWunuS+i+S/oeaBrycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfoioLngrkgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uaW5mb1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6IgUHJlZmFiIOWunuS+i+S/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2FwcGx5X2luc3RhbmNlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCGIFByZWZhYiDlrp7kvovoioLngrnnmoTmlLnliqjlupTnlKjlm57lhbPogZTotYTmupDvvIjlrp7pqozog73lipvvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHBlcmltZW50YWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOS7heeUqOS6juagoemqjOW9k+WJjeWFs+iBlOi1hOa6kCBVVUlEIOaYr+WQpuS4gOiHtCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmFwcGx5LXByZWZhYicsICdzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZhYlV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWJlZm9yZS5pc1ByZWZhYkluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn55uu5qCH6IqC54K55b2T5YmN5LiN5pivIFByZWZhYiDlrp7kvovvvIzml6Dms5UgYXBwbHknLCB1bmRlZmluZWQsICdFX1BSRUZBQl9JTlNUQU5DRV9SRVFVSVJFRCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZhYlV1aWQgJiYgYmVmb3JlLnByZWZhYkFzc2V0VXVpZCAmJiBiZWZvcmUucHJlZmFiQXNzZXRVdWlkICE9PSBwcmVmYWJVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncHJlZmFiVXVpZCDkuI7oioLngrnlvZPliY3lhbPogZTotYTmupDkuI3kuIDoh7TvvIzlrpjmlrkgQVBJIOS4jeaUr+aMgei3qCBQcmVmYWIg55u05o6l5YWz6IGUJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhcHBsaWVkID0gYXdhaXQgYXBwbHlQcmVmYWJUb05vZGUocmVxdWVzdGVyLCBub2RlVXVpZCwgYmVmb3JlLnByZWZhYkFzc2V0VXVpZCB8fCBwcmVmYWJVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWZ0ZXIgPSBhd2FpdCBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhZnRlci5pc1ByZWZhYkluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnYXBwbHkg6L+U5Zue5oiQ5Yqf5L2G6IqC54K55pyq5L+d5oyBIFByZWZhYiDlrp7kvovnirbmgIEnLCB1bmRlZmluZWQsICdFX1BSRUZBQl9BUFBMWV9WRVJJRllfRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGllZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogYmVmb3JlLnByZWZhYkFzc2V0VXVpZCB8fCBwcmVmYWJVdWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGFwcGxpZWQubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgYmVmb3JlLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5bqU55SoIFByZWZhYiDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9hcHBseV9pbnN0YW5jZXNfYnlfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmjIkgUHJlZmFiIOi1hOa6kCBVVUlEIOaJuemHj+W6lOeUqOWunuS+i++8iOWunumqjOiDveWKm++8iScsXG4gICAgICAgICAgICBsYXllcjogJ2V4cGVyaW1lbnRhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+eUqOS6juetm+mAieWunuS+i+iKgueCueeahCBQcmVmYWIg6LWE5rqQIFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFByZWZhYlV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5LuF55So5LqO5qCh6aqM77yM6Iul5Lyg5YWl5b+F6aG7562J5LqOIGFzc2V0VXVpZCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgJ3NjZW5lLmFwcGx5LXByZWZhYicsICdzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UHJlZmFiVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFyZ2V0UHJlZmFiVXVpZCkgfHwgYXNzZXRVdWlkO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhc3NldFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRQcmVmYWJVdWlkICE9PSBhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WumOaWuSBBUEkg5LiN5pSv5oyB5oyJIHRhcmdldFByZWZhYlV1aWQg6Leo6LWE5rqQ5om56YeP5YWz6IGU77yMdGFyZ2V0UHJlZmFiVXVpZCDlv4XpobvnrYnkuo4gYXNzZXRVdWlkJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCBhc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZHMgPSBBcnJheS5pc0FycmF5KHV1aWRzKSA/IHV1aWRzIDogW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQ6IEFycmF5PHsgbm9kZVV1aWQ6IHN0cmluZzsgbWV0aG9kOiBzdHJpbmcgfT4gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFpbGVkOiBBcnJheTx7IG5vZGVVdWlkOiBzdHJpbmc7IGVycm9yOiBzdHJpbmcgfT4gPSBbXTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG5vZGVVdWlkIG9mIG5vZGVVdWlkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiZWZvcmUgPSBhd2FpdCBxdWVyeVByZWZhYkluc3RhbmNlSW5mbyhyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWJlZm9yZS5pc1ByZWZhYkluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZC5wdXNoKHsgbm9kZVV1aWQsIGVycm9yOiAn6IqC54K55LiN5pivIFByZWZhYiDlrp7kvovvvIzot7Pov4cgYXBwbHknIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmVmb3JlLnByZWZhYkFzc2V0VXVpZCAmJiBiZWZvcmUucHJlZmFiQXNzZXRVdWlkICE9PSBhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYOiKgueCueWFs+iBlOi1hOa6kOS4juetm+mAiei1hOa6kOS4jeS4gOiHtO+8iGV4cGVjdGVkPSR7YXNzZXRVdWlkfSwgYWN0dWFsPSR7YmVmb3JlLnByZWZhYkFzc2V0VXVpZH3vvIlgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcHBseVByZWZhYlRvTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCB0YXJnZXRQcmVmYWJVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhZnRlciA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghYWZ0ZXIuaXNQcmVmYWJJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQucHVzaCh7IG5vZGVVdWlkLCBlcnJvcjogJ2FwcGx5IOWQjuiKgueCueWkseWOuyBQcmVmYWIg5a6e5L6L54q25oCBJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGllZC5wdXNoKHsgbm9kZVV1aWQsIG1ldGhvZDogcmVzdWx0Lm1ldGhvZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQucHVzaCh7IG5vZGVVdWlkLCBlcnJvcjogbm9ybWFsaXplRXJyb3IoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWQ6IG5vZGVVdWlkcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50OiBhcHBsaWVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhaWx1cmVDb3VudDogZmFpbGVkLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmibnph4/lupTnlKggUHJlZmFiIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2UnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfov5jljp/mjIflrpogUHJlZmFiIOWunuS+i+iKgueCuScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfpnIDopoHov5jljp/nmoToioLngrkgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnJlc3RvcmUtcHJlZmFiJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCB7IHV1aWQ6IG5vZGVVdWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZXN0b3JlZDogdHJ1ZSwgbm9kZVV1aWQgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6L+Y5Y6fIFByZWZhYiDlrp7kvovlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXN0b3JlX2luc3RhbmNlc19ieV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMiSBQcmVmYWIg6LWE5rqQIFVVSUQg5om56YeP6L+Y5Y6f5a6e5L6L6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcmVmYWIg6LWE5rqQIFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsICdzY2VuZS5yZXN0b3JlLXByZWZhYiddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5hc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhc3NldFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCBhc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZHMgPSBBcnJheS5pc0FycmF5KHV1aWRzKSA/IHV1aWRzIDogW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3RvcmVkOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQ6IEFycmF5PHsgbm9kZVV1aWQ6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZVV1aWQgb2Ygbm9kZVV1aWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCB7IHV1aWQ6IG5vZGVVdWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3RvcmVkLnB1c2gobm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZC5wdXNoKHsgbm9kZVV1aWQsIGVycm9yOiBub3JtYWxpemVFcnJvcihlcnJvcikgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkOiBub2RlVXVpZHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdG9yZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQ6IHJlc3RvcmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhaWx1cmVDb3VudDogZmFpbGVkLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmibnph4/ov5jljp8gUHJlZmFiIOWunuS+i+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc2V0X25vZGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfph43nva7oioLngrnliLDpu5jorqTnirbmgIEnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQg5oiWIFVVSUQg5YiX6KGoJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnJlc2V0LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IHRvU3RyaW5nTGlzdChhcmdzPy5ub2RlVXVpZHMpO1xuICAgICAgICAgICAgICAgIGlmIChub2RlVXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZHMg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZXNldC1ub2RlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWRzLmxlbmd0aCA9PT0gMSA/IG5vZGVVdWlkc1swXSA6IG5vZGVVdWlkc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgcmVzZXQ6IHRydWUsIG5vZGVVdWlkcyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfph43nva7oioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXNldF9jb21wb25lbnQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfph43nva7nu4Tku7bliLDpu5jorqTnirbmgIEnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7YgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY29tcG9uZW50VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzZXQtY29tcG9uZW50J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb21wb25lbnRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2NvbXBvbmVudFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZXNldC1jb21wb25lbnQnLCB7IHV1aWQ6IGNvbXBvbmVudFV1aWQgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHJlc2V0OiB0cnVlLCBjb21wb25lbnRVdWlkIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+mHjee9rue7hOS7tuWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXTtcbn1cbiJdfQ==