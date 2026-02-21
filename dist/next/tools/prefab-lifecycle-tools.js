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
function readNodeUuid(node) {
    return (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.uuid) || (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.id) || null;
}
function readNodeName(node) {
    return (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.name) || null;
}
function readNodeChildren(node) {
    return Array.isArray(node === null || node === void 0 ? void 0 : node.children) ? node.children : [];
}
function resolveNodeUuidByPath(tree, rawNodePath) {
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
async function querySceneDirtySafe(requester) {
    try {
        const dirty = await requester('scene', 'query-dirty');
        return dirty === true;
    }
    catch (_a) {
        return null;
    }
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
            run: async (args) => {
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                const assetUrl = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUrl);
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const nodePath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodePath);
                const propertyPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.propertyPath);
                if (!assetUuid && !assetUrl) {
                    return (0, common_1.fail)('assetUuid 或 assetUrl 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!nodeUuid && !nodePath) {
                    return (0, common_1.fail)('nodeUuid 或 nodePath 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!propertyPath) {
                    return (0, common_1.fail)('propertyPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const valueKind = (0, common_1.normalizeValueKind)(args === null || args === void 0 ? void 0 : args.valueKind);
                if (!valueKind) {
                    return (0, common_1.fail)('valueKind 仅支持 auto/boolean/number/string/json', undefined, 'E_INVALID_ARGUMENT');
                }
                const coerced = (0, common_1.coerceValueByKind)(args === null || args === void 0 ? void 0 : args.value, valueKind);
                if (!coerced.ok) {
                    return (0, common_1.fail)('属性值类型转换失败', coerced.error, 'E_INVALID_ARGUMENT');
                }
                const openTarget = assetUrl || assetUuid;
                try {
                    await requester('asset-db', 'open-asset', openTarget);
                    let resolvedNodeUuid = nodeUuid;
                    if (!resolvedNodeUuid && nodePath) {
                        const tree = await requester('scene', 'query-node-tree');
                        resolvedNodeUuid = resolveNodeUuidByPath(tree, nodePath) || null;
                        if (!resolvedNodeUuid) {
                            return (0, common_1.fail)(`按 nodePath 未找到目标节点: ${nodePath}`, undefined, 'E_NODE_NOT_FOUND');
                        }
                    }
                    if (!resolvedNodeUuid) {
                        return (0, common_1.fail)('无法定位目标节点', undefined, 'E_NODE_NOT_FOUND');
                    }
                    const dump = { value: coerced.value };
                    const valueType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.valueType);
                    if (valueType) {
                        dump.type = valueType;
                    }
                    const payload = {
                        uuid: resolvedNodeUuid,
                        path: propertyPath,
                        dump
                    };
                    if (typeof (args === null || args === void 0 ? void 0 : args.record) === 'boolean') {
                        payload.record = args.record;
                    }
                    const dirtyBefore = await querySceneDirtySafe(requester);
                    const updated = await requester('scene', 'set-property', payload);
                    const dirtyAfter = await querySceneDirtySafe(requester);
                    return (0, common_1.ok)({
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
                }
                catch (error) {
                    return (0, common_1.fail)('设置 Prefab 节点属性失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.fail)('查询 Prefab 引用节点失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                if (!assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const queried = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const allNodeUuids = Array.isArray(queried) ? queried : [];
                    const instanceNodeUuids = [];
                    const skipped = [];
                    for (const nodeUuid of allNodeUuids) {
                        try {
                            const info = await (0, prefab_instance_utils_1.queryPrefabInstanceInfo)(requester, nodeUuid);
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
                        }
                        catch (error) {
                            skipped.push({ nodeUuid, reason: (0, common_1.normalizeError)(error) });
                        }
                    }
                    return (0, common_1.ok)({
                        assetUuid,
                        allNodeUuids,
                        allCount: allNodeUuids.length,
                        nodeUuids: instanceNodeUuids,
                        count: instanceNodeUuids.length,
                        skipped
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmFiLWxpZmVjeWNsZS10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL3ByZWZhYi1saWZlY3ljbGUtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFvYkEsZ0VBbXNCQztBQXRuQ0QscUNBU2tCO0FBQ2xCLGlFQUFrRztBQUNsRyxtRUFNaUM7QUFFakMsS0FBSyxVQUFVLGlCQUFpQixDQUFDLFNBQTBCLEVBQUUsUUFBZ0I7SUFDekUsSUFBSSxDQUFDO1FBQ0QsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ2xCLE9BQU8sSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLENBQUM7QUFDTCxDQUFDO0FBdUJELEtBQUssVUFBVSxtQkFBbUIsQ0FDOUIsU0FBMEIsRUFDMUIsUUFBZ0IsRUFDaEIsaUJBQXlCO0lBRXpCLE1BQU0sUUFBUSxHQUEwRDtRQUNwRTtZQUNJLE1BQU0sRUFBRSxhQUFhO1lBQ3JCLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQztZQUNuQyxLQUFLLEVBQUUsa0NBQWtDO1NBQzVDO1FBQ0Q7WUFDSSxNQUFNLEVBQUUsYUFBYTtZQUNyQixJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFLENBQUM7WUFDeEQsS0FBSyxFQUFFLCtCQUErQjtTQUN6QztRQUNEO1lBQ0ksTUFBTSxFQUFFLGFBQWE7WUFDckIsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3JELEtBQUssRUFBRSw0QkFBNEI7U0FDdEM7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S0FBSyxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDO2dCQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7b0JBQ2xCLE9BQU8sSUFBQSxhQUFJLEVBQUMsUUFBUSxFQUFFLElBQUEsdUJBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNqRCxDQUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQge1xuICAgIGNvZXJjZVZhbHVlQnlLaW5kLFxuICAgIGZhaWwsXG4gICAgbm9ybWFsaXplRXJyb3IsXG4gICAgbm9ybWFsaXplVmFsdWVLaW5kLFxuICAgIG9rLFxuICAgIHJlYWREdW1wU3RyaW5nLFxuICAgIHRvTm9uRW1wdHlTdHJpbmcsXG4gICAgdG9TdHJpbmdMaXN0XG59IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB7IGxpbmtQcmVmYWJUb05vZGVCeU1lc3NhZ2UsIHJlcGxhY2VOb2RlV2l0aFByZWZhYkluc3RhbmNlIH0gZnJvbSAnLi9wcmVmYWItbGluay1mYWxsYmFjayc7XG5pbXBvcnQge1xuICAgIGJ1aWxkQ3JlYXRlTm9kZUNhbmRpZGF0ZXMsXG4gICAgUHJlZmFiSW5zdGFuY2VJbmZvLFxuICAgIHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvLFxuICAgIHJlc29sdmVOb2RlQXNzZXRUeXBlLFxuICAgIHJlc29sdmVOb2RlVXVpZFxufSBmcm9tICcuL3ByZWZhYi1pbnN0YW5jZS11dGlscyc7XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZU5vZGVRdWlldGx5KHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLCBub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZW1vdmUtbm9kZScsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZUVycm9yKGVycm9yKTtcbiAgICB9XG59XG5cbmludGVyZmFjZSBDcmVhdGVWZXJpZmllZFByZWZhYlJlc3VsdCB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZztcbiAgICBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICAgIHZlcmlmaWNhdGlvbjogUHJlZmFiSW5zdGFuY2VJbmZvO1xuICAgIGF0dGVtcHRzOiBBcnJheTx7XG4gICAgICAgIGluZGV4OiBudW1iZXI7XG4gICAgICAgIG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gICAgICAgIG5vZGVVdWlkPzogc3RyaW5nO1xuICAgICAgICB2ZXJpZmllZDogYm9vbGVhbjtcbiAgICAgICAgZGV0YWlsOiBzdHJpbmc7XG4gICAgICAgIGNsZWFudXBFcnJvcj86IHN0cmluZyB8IG51bGw7XG4gICAgfT47XG59XG5cbmludGVyZmFjZSBQcmVmYWJMaW5rQXR0ZW1wdFJlc3VsdCB7XG4gICAgbGlua2VkOiBib29sZWFuO1xuICAgIG1ldGhvZDogc3RyaW5nIHwgbnVsbDtcbiAgICB2ZXJpZmljYXRpb24/OiBQcmVmYWJJbnN0YW5jZUluZm87XG4gICAgZXJyb3JzOiBzdHJpbmdbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJ5TGlua1ByZWZhYlRvTm9kZShcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGV4cGVjdGVkQXNzZXRVdWlkOiBzdHJpbmdcbik6IFByb21pc2U8UHJlZmFiTGlua0F0dGVtcHRSZXN1bHQ+IHtcbiAgICBjb25zdCBhdHRlbXB0czogQXJyYXk8eyBtZXRob2Q6IHN0cmluZzsgYXJnczogYW55W107IGxhYmVsOiBzdHJpbmcgfT4gPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ2xpbmstcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFtub2RlVXVpZCwgZXhwZWN0ZWRBc3NldFV1aWRdLFxuICAgICAgICAgICAgbGFiZWw6ICdsaW5rLXByZWZhYihub2RlVXVpZCwgYXNzZXRVdWlkKSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAnbGluay1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgdXVpZDogbm9kZVV1aWQsIGFzc2V0VXVpZDogZXhwZWN0ZWRBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ2xpbmstcHJlZmFiKHt1dWlkLGFzc2V0VXVpZH0pJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdsaW5rLXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBleHBlY3RlZEFzc2V0VXVpZCB9XSxcbiAgICAgICAgICAgIGxhYmVsOiAnbGluay1wcmVmYWIoe25vZGUscHJlZmFifSknXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ3Jlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFtub2RlVXVpZCwgZXhwZWN0ZWRBc3NldFV1aWRdLFxuICAgICAgICAgICAgbGFiZWw6ICdyZXN0b3JlLXByZWZhYihub2RlVXVpZCxhc3NldFV1aWQpJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdyZXN0b3JlLXByZWZhYicsXG4gICAgICAgICAgICBhcmdzOiBbeyB1dWlkOiBub2RlVXVpZCwgYXNzZXRVdWlkOiBleHBlY3RlZEFzc2V0VXVpZCB9XSxcbiAgICAgICAgICAgIGxhYmVsOiAncmVzdG9yZS1wcmVmYWIoe3V1aWQsYXNzZXRVdWlkfSknXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ3Jlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgICAgIGFyZ3M6IFtub2RlVXVpZF0sXG4gICAgICAgICAgICBsYWJlbDogJ3Jlc3RvcmUtcHJlZmFiKG5vZGVVdWlkKSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAncmVzdG9yZS1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgdXVpZDogbm9kZVV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ3Jlc3RvcmUtcHJlZmFiKHt1dWlkfSknXG4gICAgICAgIH1cbiAgICBdO1xuXG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYXR0ZW1wdCBvZiBhdHRlbXB0cykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsIGF0dGVtcHQubWV0aG9kLCAuLi5hdHRlbXB0LmFyZ3MpO1xuICAgICAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBjb25zdCBhc3NldE1hdGNoZWQgPSAhdmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCB8fCB2ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkID09PSBleHBlY3RlZEFzc2V0VXVpZDtcbiAgICAgICAgICAgIGlmICh2ZXJpZmljYXRpb24uaXNQcmVmYWJJbnN0YW5jZSAmJiBhc3NldE1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBsaW5rZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogYCR7YXR0ZW1wdC5tZXRob2R9OiR7YXR0ZW1wdC5sYWJlbH1gLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGVycm9yc1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgICAgICBgJHthdHRlbXB0LmxhYmVsfSA9PiDlt7LosIPnlKjkvYbmnKrlu7rnq4vlhbPogZTvvIhwcmVmYWJBc3NldFV1aWQ9JHt2ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkIHx8ICdudWxsJ33vvIlgXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgJHthdHRlbXB0LmxhYmVsfSA9PiAke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGxpbmtlZDogZmFsc2UsXG4gICAgICAgIG1ldGhvZDogbnVsbCxcbiAgICAgICAgZXJyb3JzXG4gICAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlVmVyaWZpZWRQcmVmYWJJbnN0YW5jZShcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBiYXNlT3B0aW9uczogUmVjb3JkPHN0cmluZywgYW55PixcbiAgICBleHBlY3RlZEFzc2V0VXVpZDogc3RyaW5nLFxuICAgIGFzc2V0VHlwZTogc3RyaW5nIHwgbnVsbFxuKTogUHJvbWlzZTxDcmVhdGVWZXJpZmllZFByZWZhYlJlc3VsdD4ge1xuICAgIGNvbnN0IGF0dGVtcHRzOiBDcmVhdGVWZXJpZmllZFByZWZhYlJlc3VsdFsnYXR0ZW1wdHMnXSA9IFtdO1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBidWlsZENyZWF0ZU5vZGVDYW5kaWRhdGVzKGJhc2VPcHRpb25zLCBhc3NldFR5cGUpO1xuXG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGNhbmRpZGF0ZXMubGVuZ3RoOyBpbmRleCArPSAxKSB7XG4gICAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IGNhbmRpZGF0ZXNbaW5kZXhdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBjYW5kaWRhdGUpO1xuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSByZXNvbHZlTm9kZVV1aWQoY3JlYXRlZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCArIDEsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IGNhbmRpZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6ICdjcmVhdGUtbm9kZSDmnKrov5Tlm57mnInmlYjoioLngrkgVVVJRCdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBjb25zdCBhc3NldE1hdGNoZWQgPSAhdmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCB8fCB2ZXJpZmljYXRpb24ucHJlZmFiQXNzZXRVdWlkID09PSBleHBlY3RlZEFzc2V0VXVpZDtcbiAgICAgICAgICAgIGlmICh2ZXJpZmljYXRpb24uaXNQcmVmYWJJbnN0YW5jZSAmJiBhc3NldE1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogJ+W3sumqjOivgeS4uiBQcmVmYWIg5a6e5L6LJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgYXR0ZW1wdHNcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBsaW5rZWQgPSBhd2FpdCB0cnlMaW5rUHJlZmFiVG9Ob2RlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIGV4cGVjdGVkQXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGlmIChsaW5rZWQubGlua2VkICYmIGxpbmtlZC52ZXJpZmljYXRpb24pIHtcbiAgICAgICAgICAgICAgICBhdHRlbXB0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogYOWIm+W7uuWQjue7jyAke2xpbmtlZC5tZXRob2R9IOW7uueriyBQcmVmYWIg5YWz6IGUYFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbjogbGlua2VkLnZlcmlmaWNhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgYXR0ZW1wdHNcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjbGVhbnVwRXJyb3IgPSBhd2FpdCByZW1vdmVOb2RlUXVpZXRseShyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGF0dGVtcHRzLnB1c2goe1xuICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCArIDEsXG4gICAgICAgICAgICAgICAgb3B0aW9uczogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkZXRhaWw6IGDoioLngrnmnKrlu7rnq4sgUHJlZmFiIOWFs+iBlO+8iHByZWZhYkFzc2V0VXVpZD0ke3ZlcmlmaWNhdGlvbi5wcmVmYWJBc3NldFV1aWQgfHwgJ251bGwnfe+8iWBcbiAgICAgICAgICAgICAgICAgICAgKyAobGlua2VkLmVycm9ycy5sZW5ndGggPiAwID8gYO+8m+mTvuaOpeWbnuWhq+Wksei0pe+8miR7bGlua2VkLmVycm9ycy5qb2luKCc7ICcpfWAgOiAnJyksXG4gICAgICAgICAgICAgICAgY2xlYW51cEVycm9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBjYW5kaWRhdGUsXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogbm9ybWFsaXplRXJyb3IoZXJyb3IpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHN1bW1hcnkgPSBhdHRlbXB0cy5tYXAoKGl0ZW0pID0+IGAjJHtpdGVtLmluZGV4fSAke2l0ZW0uZGV0YWlsfWApLmpvaW4oJyB8ICcpO1xuICAgIHRocm93IG5ldyBFcnJvcihzdW1tYXJ5IHx8ICfmiYDmnIkgY3JlYXRlLW5vZGUg5pa55qGI6YO95pyq5oiQ5Yqf5bu656uLIFByZWZhYiDlhbPogZQnKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUHJlZmFiQ3JlYXRlT3B0aW9ucyhhcmdzOiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICBjb25zdCBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgY29uc3QgYXNzZXRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5hc3NldFV1aWQpO1xuICAgIGlmIChhc3NldFV1aWQpIHtcbiAgICAgICAgb3B0aW9ucy5hc3NldFV1aWQgPSBhc3NldFV1aWQ7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucGFyZW50VXVpZCk7XG4gICAgaWYgKHBhcmVudFV1aWQpIHtcbiAgICAgICAgb3B0aW9ucy5wYXJlbnQgPSBwYXJlbnRVdWlkO1xuICAgIH1cblxuICAgIGNvbnN0IG5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5hbWUpO1xuICAgIGlmIChuYW1lKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZSA9IG5hbWU7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzPy5rZWVwV29ybGRUcmFuc2Zvcm0gPT09ICdib29sZWFuJykge1xuICAgICAgICBvcHRpb25zLmtlZXBXb3JsZFRyYW5zZm9ybSA9IGFyZ3Mua2VlcFdvcmxkVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJncz8udW5saW5rUHJlZmFiID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgb3B0aW9ucy51bmxpbmtQcmVmYWIgPSBhcmdzLnVubGlua1ByZWZhYjtcbiAgICB9XG5cbiAgICBpZiAoYXJncz8ucG9zaXRpb24gJiYgdHlwZW9mIGFyZ3MucG9zaXRpb24gPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdGlvbnMucG9zaXRpb24gPSBhcmdzLnBvc2l0aW9uO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiByZWFkTm9kZVV1aWQobm9kZTogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHJlYWREdW1wU3RyaW5nKG5vZGU/LnV1aWQpIHx8IHJlYWREdW1wU3RyaW5nKG5vZGU/LmlkKSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiByZWFkTm9kZU5hbWUobm9kZTogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHJlYWREdW1wU3RyaW5nKG5vZGU/Lm5hbWUpIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWROb2RlQ2hpbGRyZW4obm9kZTogYW55KTogYW55W10ge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KG5vZGU/LmNoaWxkcmVuKSA/IG5vZGUuY2hpbGRyZW4gOiBbXTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vZGVVdWlkQnlQYXRoKHRyZWU6IGFueSwgcmF3Tm9kZVBhdGg6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IHNlZ21lbnRzID0gcmF3Tm9kZVBhdGhcbiAgICAgICAgLnNwbGl0KCcvJylcbiAgICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS50cmltKCkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0gIT09ICcnKTtcbiAgICBpZiAoc2VnbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBjdXJyZW50ID0gdHJlZTtcbiAgICBsZXQgc3RhcnRJbmRleCA9IDA7XG4gICAgY29uc3Qgcm9vdE5hbWUgPSByZWFkTm9kZU5hbWUoY3VycmVudCk7XG4gICAgaWYgKHJvb3ROYW1lICYmIHJvb3ROYW1lID09PSBzZWdtZW50c1swXSkge1xuICAgICAgICBzdGFydEluZGV4ID0gMTtcbiAgICB9XG5cbiAgICBpZiAoc3RhcnRJbmRleCA9PT0gMCkge1xuICAgICAgICBjb25zdCBmaXJzdCA9IHNlZ21lbnRzWzBdO1xuICAgICAgICBjb25zdCBuZXh0ID0gcmVhZE5vZGVDaGlsZHJlbihjdXJyZW50KS5maW5kKChjaGlsZCkgPT4gcmVhZE5vZGVOYW1lKGNoaWxkKSA9PT0gZmlyc3QpO1xuICAgICAgICBpZiAoIW5leHQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGN1cnJlbnQgPSBuZXh0O1xuICAgICAgICBzdGFydEluZGV4ID0gMTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpbmRleCA9IHN0YXJ0SW5kZXg7IGluZGV4IDwgc2VnbWVudHMubGVuZ3RoOyBpbmRleCArPSAxKSB7XG4gICAgICAgIGNvbnN0IHNlZyA9IHNlZ21lbnRzW2luZGV4XTtcbiAgICAgICAgY29uc3QgbmV4dCA9IHJlYWROb2RlQ2hpbGRyZW4oY3VycmVudCkuZmluZCgoY2hpbGQpID0+IHJlYWROb2RlTmFtZShjaGlsZCkgPT09IHNlZyk7XG4gICAgICAgIGlmICghbmV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY3VycmVudCA9IG5leHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlYWROb2RlVXVpZChjdXJyZW50KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcXVlcnlTY2VuZURpcnR5U2FmZShyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IFByb21pc2U8Ym9vbGVhbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBkaXJ0eSA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktZGlydHknKTtcbiAgICAgICAgcmV0dXJuIGRpcnR5ID09PSB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJlZmFiVG9Ob2RlKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJlZmFiQXNzZXRVdWlkOiBzdHJpbmcgfCBudWxsXG4pOiBQcm9taXNlPHsgbWV0aG9kOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IGF0dGVtcHRzOiBBcnJheTx7IG1ldGhvZDogc3RyaW5nOyBhcmdzOiBhbnlbXTsgbGFiZWw6IHN0cmluZyB9PiA9IFtcbiAgICAgICAgeyBtZXRob2Q6ICdhcHBseS1wcmVmYWInLCBhcmdzOiBbbm9kZVV1aWRdLCBsYWJlbDogJ2FwcGx5LXByZWZhYihzdHJpbmcpJyB9LFxuICAgICAgICB7IG1ldGhvZDogJ2FwcGx5LXByZWZhYicsIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkIH1dLCBsYWJlbDogJ2FwcGx5LXByZWZhYih7dXVpZH0pJyB9XG4gICAgXTtcblxuICAgIGlmIChwcmVmYWJBc3NldFV1aWQpIHtcbiAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICBtZXRob2Q6ICdhcHBseS1wcmVmYWInLFxuICAgICAgICAgICAgYXJnczogW3sgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiQXNzZXRVdWlkIH1dLFxuICAgICAgICAgICAgbGFiZWw6ICdhcHBseS1wcmVmYWIoe25vZGUscHJlZmFifSknXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGF0dGVtcHRzLnB1c2goeyBtZXRob2Q6ICdhcHBseS1wcmVmYWItbGluaycsIGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkIH1dLCBsYWJlbDogJ2FwcGx5LXByZWZhYi1saW5rKHt1dWlkfSknIH0pO1xuICAgIGlmIChwcmVmYWJBc3NldFV1aWQpIHtcbiAgICAgICAgYXR0ZW1wdHMucHVzaCh7XG4gICAgICAgICAgICBtZXRob2Q6ICdhcHBseS1wcmVmYWItbGluaycsXG4gICAgICAgICAgICBhcmdzOiBbeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJBc3NldFV1aWQgfV0sXG4gICAgICAgICAgICBsYWJlbDogJ2FwcGx5LXByZWZhYi1saW5rKHtub2RlLHByZWZhYn0pJ1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBhdHRlbXB0IG9mIGF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgYXR0ZW1wdC5tZXRob2QsIC4uLmF0dGVtcHQuYXJncyk7XG4gICAgICAgICAgICByZXR1cm4geyBtZXRob2Q6IGAke2F0dGVtcHQubWV0aG9kfToke2F0dGVtcHQubGFiZWx9YCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgJHthdHRlbXB0LmxhYmVsfSA9PiAke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuam9pbignOyAnKSk7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVBc3NldFV1aWQocmVzdWx0OiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycgJiYgcmVzdWx0LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC50cmltKCk7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0KSAmJiB0eXBlb2YgcmVzdWx0WzBdID09PSAnc3RyaW5nJyAmJiByZXN1bHRbMF0udHJpbSgpICE9PSAnJykge1xuICAgICAgICByZXR1cm4gcmVzdWx0WzBdLnRyaW0oKTtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IGRpcmVjdCA9IHJlYWREdW1wU3RyaW5nKHJlc3VsdC51dWlkKVxuICAgICAgICAgICAgfHwgcmVhZER1bXBTdHJpbmcocmVzdWx0LmFzc2V0VXVpZClcbiAgICAgICAgICAgIHx8IHJlYWREdW1wU3RyaW5nKHJlc3VsdC5wcmVmYWJVdWlkKVxuICAgICAgICAgICAgfHwgcmVhZER1bXBTdHJpbmcocmVzdWx0LnZhbHVlKTtcbiAgICAgICAgaWYgKGRpcmVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIGRpcmVjdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVQcmVmYWJBc3NldEZyb21Ob2RlKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgdGFyZ2V0VXJsOiBzdHJpbmdcbik6IFByb21pc2U8eyBtZXRob2Q6IHN0cmluZzsgcHJlZmFiVXVpZDogc3RyaW5nIHwgbnVsbDsgcmF3UmVzdWx0OiBhbnkgfT4ge1xuICAgIGNvbnN0IGF0dGVtcHRzOiBBcnJheTx7IGFyZ3M6IGFueVtdOyBsYWJlbDogc3RyaW5nIH0+ID0gW1xuICAgICAgICB7IGFyZ3M6IFtub2RlVXVpZCwgdGFyZ2V0VXJsXSwgbGFiZWw6ICdjcmVhdGUtcHJlZmFiKG5vZGVVdWlkLCB0YXJnZXRVcmwpJyB9LFxuICAgICAgICB7IGFyZ3M6IFt7IHV1aWQ6IG5vZGVVdWlkLCB1cmw6IHRhcmdldFVybCB9XSwgbGFiZWw6ICdjcmVhdGUtcHJlZmFiKHt1dWlkLHVybH0pJyB9LFxuICAgICAgICB7IGFyZ3M6IFt7IG5vZGVVdWlkLCB0YXJnZXRVcmwgfV0sIGxhYmVsOiAnY3JlYXRlLXByZWZhYih7bm9kZVV1aWQsdGFyZ2V0VXJsfSknIH0sXG4gICAgICAgIHsgYXJnczogW3sgbm9kZTogbm9kZVV1aWQsIHVybDogdGFyZ2V0VXJsIH1dLCBsYWJlbDogJ2NyZWF0ZS1wcmVmYWIoe25vZGUsdXJsfSknIH1cbiAgICBdO1xuXG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYXR0ZW1wdCBvZiBhdHRlbXB0cykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjcmVhdGUtcHJlZmFiJywgLi4uYXR0ZW1wdC5hcmdzKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBhdHRlbXB0LmxhYmVsLFxuICAgICAgICAgICAgICAgIHByZWZhYlV1aWQ6IHJlc29sdmVBc3NldFV1aWQocmVzdWx0KSxcbiAgICAgICAgICAgICAgICByYXdSZXN1bHQ6IHJlc3VsdFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goYCR7YXR0ZW1wdC5sYWJlbH0gPT4gJHtub3JtYWxpemVFcnJvcihlcnJvcil9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmpvaW4oJzsgJykpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB1bmxpbmtQcmVmYWJGcm9tTm9kZShcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIHJlbW92ZU5lc3RlZDogYm9vbGVhblxuKTogUHJvbWlzZTx7IG1ldGhvZDogc3RyaW5nIH0+IHtcbiAgICBjb25zdCBhdHRlbXB0czogQXJyYXk8eyBhcmdzOiBhbnlbXTsgbGFiZWw6IHN0cmluZyB9PiA9IFtcbiAgICAgICAgeyBhcmdzOiBbbm9kZVV1aWQsIHJlbW92ZU5lc3RlZF0sIGxhYmVsOiAndW5saW5rLXByZWZhYihub2RlVXVpZCwgcmVtb3ZlTmVzdGVkKScgfSxcbiAgICAgICAgeyBhcmdzOiBbeyB1dWlkOiBub2RlVXVpZCwgcmVtb3ZlTmVzdGVkIH1dLCBsYWJlbDogJ3VubGluay1wcmVmYWIoe3V1aWQscmVtb3ZlTmVzdGVkfSknIH0sXG4gICAgICAgIHsgYXJnczogW3sgbm9kZTogbm9kZVV1aWQsIHJlbW92ZU5lc3RlZCB9XSwgbGFiZWw6ICd1bmxpbmstcHJlZmFiKHtub2RlLHJlbW92ZU5lc3RlZH0pJyB9LFxuICAgICAgICB7IGFyZ3M6IFtub2RlVXVpZF0sIGxhYmVsOiAndW5saW5rLXByZWZhYihub2RlVXVpZCknIH1cbiAgICBdO1xuXG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYXR0ZW1wdCBvZiBhdHRlbXB0cykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICd1bmxpbmstcHJlZmFiJywgLi4uYXR0ZW1wdC5hcmdzKTtcbiAgICAgICAgICAgIHJldHVybiB7IG1ldGhvZDogYXR0ZW1wdC5sYWJlbCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgJHthdHRlbXB0LmxhYmVsfSA9PiAke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuam9pbignOyAnKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHF1ZXJ5QXNzZXRJbmZvV2l0aFJldHJ5KFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIHRhcmdldFVybDogc3RyaW5nLFxuICAgIG1heEF0dGVtcHRzID0gNSxcbiAgICBpbnRlcnZhbE1zID0gMTIwXG4pOiBQcm9taXNlPGFueSB8IG51bGw+IHtcbiAgICBmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IG1heEF0dGVtcHRzOyBhdHRlbXB0ICs9IDEpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB0YXJnZXRVcmwpO1xuICAgICAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBpZ25vcmUgYW5kIHJldHJ5XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0ZW1wdCA8IG1heEF0dGVtcHRzIC0gMSkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgaW50ZXJ2YWxNcykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcmVmYWJMaWZlY3ljbGVUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2NyZWF0ZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WfuuS6jiBQcmVmYWIg6LWE5rqQIFVVSUQg5Yib5bu65a6e5L6L6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcmVmYWIg6LWE5rqQIFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM54i26IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5a6e5L6L6IqC54K55ZCN56ewJyB9LFxuICAgICAgICAgICAgICAgICAgICB1bmxpbmtQcmVmYWI6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWIm+W7uuWQjuaYr+WQpuino+mZpCBQcmVmYWIg5YWz6IGUJyB9LFxuICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaYr+WQpuS/neaMgeS4lueVjOWPmOaNoicgfSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzlrp7kvovliJ3lp4vkvY3nva4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuY3JlYXRlLW5vZGUnLCAnc2NlbmUucXVlcnktbm9kZScsICdhc3NldC1kYi5xdWVyeS1hc3NldC1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplUHJlZmFiQ3JlYXRlT3B0aW9ucyhhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMuYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhc3NldFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFzc2V0VHlwZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBvcHRpb25zLmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFR5cGUgPSByZXNvbHZlTm9kZUFzc2V0VHlwZShhc3NldEluZm8pO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgY3JlYXRlVmVyaWZpZWRQcmVmYWJJbnN0YW5jZShyZXF1ZXN0ZXIsIG9wdGlvbnMsIG9wdGlvbnMuYXNzZXRVdWlkLCBhc3NldFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IGNyZWF0ZWQubm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBjcmVhdGVkLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJBc3NldFV1aWQ6IGNyZWF0ZWQudmVyaWZpY2F0aW9uLnByZWZhYkFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlN0YXRlOiBjcmVhdGVkLnZlcmlmaWNhdGlvbi5wcmVmYWJTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dGVtcHRzOiBjcmVhdGVkLmF0dGVtcHRzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIm+W7uiBQcmVmYWIg5a6e5L6L5aSx6LSl77yI5pyq5bu656uL5pyJ5pWIIFByZWZhYiDlhbPogZTvvIknLCBub3JtYWxpemVFcnJvcihlcnJvciksICdFX1BSRUZBQl9DUkVBVEVfTk9UX0xJTktFRCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9jcmVhdGVfYXNzZXRfZnJvbV9ub2RlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCG5oyH5a6a6IqC54K55L+d5a2Y5Li6IFByZWZhYiDotYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5rqQ6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnm67moIcgUHJlZmFiIFVSTO+8iGRiOi8vYXNzZXRzLyoqLyoucHJlZmFi77yJJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCcsICd0YXJnZXRVcmwnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmNyZWF0ZS1wcmVmYWInLCAnYXNzZXQtZGIucXVlcnktYXNzZXQtaW5mbyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRVcmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhdGFyZ2V0VXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDkuI4gdGFyZ2V0VXJsIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFVybC5zdGFydHNXaXRoKCdkYjovLycpIHx8ICF0YXJnZXRVcmwuZW5kc1dpdGgoJy5wcmVmYWInKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndGFyZ2V0VXJsIOW/hemhu+S4uiBkYjovLyDliY3nvIDkuJTku6UgLnByZWZhYiDnu5PlsL4nLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgY3JlYXRlUHJlZmFiQXNzZXRGcm9tTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCB0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBxdWVyeUFzc2V0SW5mb1dpdGhSZXRyeShyZXF1ZXN0ZXIsIHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yib5bu6IFByZWZhYiDotYTmupDlkI7mnKrog73mn6Xor6LliLDotYTkuqfkv6Hmga8nLCB1bmRlZmluZWQsICdFX1BSRUZBQl9BU1NFVF9WRVJJRllfRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0VXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBjcmVhdGVkLm1ldGhvZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQ6IHRvTm9uRW1wdHlTdHJpbmcoYXNzZXRJbmZvLnV1aWQpIHx8IGNyZWF0ZWQucHJlZmFiVXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRJbmZvXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIm+W7uiBQcmVmYWIg6LWE5rqQ5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfbGlua19ub2RlX3RvX2Fzc2V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCG6IqC54K55LiO5oyH5a6aIFByZWZhYiDotYTmupDlu7rnq4vlhbPogZQnLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcmVmYWIg6LWE5rqQIFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJywgJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUubGluay1wcmVmYWInLCAnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDkuI4gYXNzZXRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5rZWQgPSBhd2FpdCBsaW5rUHJlZmFiVG9Ob2RlQnlNZXNzYWdlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFmdGVyID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0TWF0Y2hlZCA9ICFhZnRlci5wcmVmYWJBc3NldFV1aWQgfHwgYWZ0ZXIucHJlZmFiQXNzZXRVdWlkID09PSBhc3NldFV1aWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhZnRlci5pc1ByZWZhYkluc3RhbmNlICYmIGFzc2V0TWF0Y2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5rZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogbGlua2VkLm1ldGhvZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmVmb3JlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFmdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZhbGxiYWNrRXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVwbGFjZW1lbnQgPSBhd2FpdCByZXBsYWNlTm9kZVdpdGhQcmVmYWJJbnN0YW5jZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVwbGFjZW1lbnRJbmZvID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCByZXBsYWNlbWVudC5yZXBsYWNlbWVudE5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50QXNzZXRNYXRjaGVkID0gIXJlcGxhY2VtZW50SW5mby5wcmVmYWJBc3NldFV1aWQgfHwgcmVwbGFjZW1lbnRJbmZvLnByZWZhYkFzc2V0VXVpZCA9PT0gYXNzZXRVdWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VtZW50SW5mby5pc1ByZWZhYkluc3RhbmNlICYmIHJlcGxhY2VtZW50QXNzZXRNYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlua2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogcmVwbGFjZW1lbnQucmVwbGFjZW1lbnROb2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxOb2RlVXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBgJHtsaW5rZWQubWV0aG9kfSAtPiBmYWxsYmFjazoke3JlcGxhY2VtZW50LmNyZWF0ZU1ldGhvZH1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmVmb3JlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZnRlcjogcmVwbGFjZW1lbnRJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxsYmFja1dhcm5pbmdzOiByZXBsYWNlbWVudC53YXJuaW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb2xsYmFja0Vycm9yID0gYXdhaXQgcmVtb3ZlTm9kZVF1aWV0bHkocmVxdWVzdGVyLCByZXBsYWNlbWVudC5yZXBsYWNlbWVudE5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhbGxiYWNrRXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYGZhbGxiYWNrIOabv+aNouiKgueCueWQjuS7jeacquW9ouaIkOWunuS+i+WFs+iBlO+8iHJlcGxhY2VtZW50Tm9kZVV1aWQ9JHtyZXBsYWNlbWVudC5yZXBsYWNlbWVudE5vZGVVdWlkfe+8iWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyAocm9sbGJhY2tFcnJvciA/IGDvvJvlm57mu5rlpLHotKXvvJoke3JvbGxiYWNrRXJyb3J9YCA6ICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZmFsbGJhY2tFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmYWxsYmFja0Vycm9ycy5wdXNoKG5vcm1hbGl6ZUVycm9yKGZhbGxiYWNrRXJyb3IpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfoioLngrnpk77mjqXlkI7mnKrlvaLmiJDmnJ/mnJvnmoQgUHJlZmFiIOWFs+iBlCcsIGZhbGxiYWNrRXJyb3JzLmpvaW4oJzsgJyksICdFX1BSRUZBQl9MSU5LX1ZFUklGWV9GQUlMRUQnKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfpk77mjqUgUHJlZmFiIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3VubGlua19pbnN0YW5jZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ino+mZpOiKgueCueS4jiBQcmVmYWIg6LWE5rqQ55qE5YWz6IGUJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVOZXN0ZWQ6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+aYr+WQpumAkuW9kuino+mZpOWtkOiKgueCueWFs+iBlO+8jOm7mOiupCBmYWxzZScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnVubGluay1wcmVmYWInLCAnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVOZXN0ZWQgPSB0eXBlb2YgYXJncz8ucmVtb3ZlTmVzdGVkID09PSAnYm9vbGVhbicgPyBhcmdzLnJlbW92ZU5lc3RlZCA6IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWJlZm9yZS5pc1ByZWZhYkluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn55uu5qCH6IqC54K55b2T5YmN5LiN5pivIFByZWZhYiDlrp7kvovvvIzml6Dms5Xop6PpmaTlhbPogZQnLCB1bmRlZmluZWQsICdFX1BSRUZBQl9JTlNUQU5DRV9SRVFVSVJFRCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdW5saW5rZWQgPSBhd2FpdCB1bmxpbmtQcmVmYWJGcm9tTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCByZW1vdmVOZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhZnRlciA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGlsbExpbmtlZCA9IEJvb2xlYW4oYWZ0ZXIucHJlZmFiQXNzZXRVdWlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgKHR5cGVvZiBhZnRlci5wcmVmYWJTdGF0ZSA9PT0gJ251bWJlcicgJiYgYWZ0ZXIucHJlZmFiU3RhdGUgPiAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0aWxsTGlua2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6Kej6Zmk5YWz6IGU5ZCO6IqC54K55LuN5L+d55WZIFByZWZhYiDlhbPogZQnLCB1bmRlZmluZWQsICdFX1BSRUZBQl9VTkxJTktfVkVSSUZZX0ZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVubGlua2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVOZXN0ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IHVubGlua2VkLm1ldGhvZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlZm9yZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFmdGVyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ino+mZpCBQcmVmYWIg5YWz6IGU5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfc2V0X25vZGVfcHJvcGVydHknLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflnKggUHJlZmFiIOe8lui+keS4iuS4i+aWh+S4reiuvue9ruiKgueCueWxnuaAp++8iOaUr+aMgeaMiSBub2RlVXVpZCDmiJYgbm9kZVBhdGgg5a6a5L2N77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIxQcmVmYWIg6LWE5rqQIFVVSUTvvIjkuI4gYXNzZXRVcmwg5LqM6YCJ5LiA77yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBhc3NldFVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIxQcmVmYWIg6LWE5rqQIFVSTO+8iOS4jiBhc3NldFV1aWQg5LqM6YCJ5LiA77yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIznm67moIfoioLngrkgVVVJRO+8iOS4jiBub2RlUGF0aCDkuozpgInkuIDvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIG5vZGVQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOebruagh+iKgueCuei3r+W+hO+8jOS+i+WmgiBNZXRlb3JSb290L1N1Yu+8iOS4jiBub2RlVXVpZCDkuozpgInkuIDvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfoioLngrnlsZ7mgKfot6/lvoTvvIzkvovlpoIgX2FjdGl2ZSDmiJYgcG9zaXRpb24ueCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHsgZGVzY3JpcHRpb246ICfopoHlhpnlhaXnmoTlsZ7mgKflgLwnIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlS2luZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2F1dG8nLCAnYm9vbGVhbicsICdudW1iZXInLCAnc3RyaW5nJywgJ2pzb24nXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5YC857G75Z6L6L2s5o2i562W55Wl77yI6buY6K6kIGF1dG/vvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlVHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIxkdW1wLnR5cGXvvIjkvovlpoIgY2MuVmVjM++8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVjb3JkOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzmmK/lkKborrDlvZUgdW5kbycgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncHJvcGVydHlQYXRoJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5vcGVuLWFzc2V0JywgJ3NjZW5lLnNldC1wcm9wZXJ0eSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5hc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXJsID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5hc3NldFVybCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlUGF0aCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5UGF0aCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucHJvcGVydHlQYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0VXVpZCAmJiAhYXNzZXRVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDmiJYgYXNzZXRVcmwg6Iez5bCR5o+Q5L6b5LiA5LiqJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQgJiYgIW5vZGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDmiJYgbm9kZVBhdGgg6Iez5bCR5o+Q5L6b5LiA5LiqJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcHJvcGVydHlQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwcm9wZXJ0eVBhdGgg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWVLaW5kID0gbm9ybWFsaXplVmFsdWVLaW5kKGFyZ3M/LnZhbHVlS2luZCk7XG4gICAgICAgICAgICAgICAgaWYgKCF2YWx1ZUtpbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3ZhbHVlS2luZCDku4XmlK/mjIEgYXV0by9ib29sZWFuL251bWJlci9zdHJpbmcvanNvbicsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gY29lcmNlVmFsdWVCeUtpbmQoYXJncz8udmFsdWUsIHZhbHVlS2luZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFjb2VyY2VkLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflsZ7mgKflgLznsbvlnovovazmjaLlpLHotKUnLCBjb2VyY2VkLmVycm9yLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlblRhcmdldCA9IGFzc2V0VXJsIHx8IGFzc2V0VXVpZDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCBvcGVuVGFyZ2V0KTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb2x2ZWROb2RlVXVpZCA9IG5vZGVVdWlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlc29sdmVkTm9kZVV1aWQgJiYgbm9kZVBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyZWUgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWROb2RlVXVpZCA9IHJlc29sdmVOb2RlVXVpZEJ5UGF0aCh0cmVlLCBub2RlUGF0aCkgfHwgbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmVzb2x2ZWROb2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKGDmjIkgbm9kZVBhdGgg5pyq5om+5Yiw55uu5qCH6IqC54K5OiAke25vZGVQYXRofWAsIHVuZGVmaW5lZCwgJ0VfTk9ERV9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzb2x2ZWROb2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aXoOazleWumuS9jeebruagh+iKgueCuScsIHVuZGVmaW5lZCwgJ0VfTk9ERV9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7IHZhbHVlOiBjb2VyY2VkLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlVHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udmFsdWVUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZHVtcC50eXBlID0gdmFsdWVUeXBlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZDogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IHJlc29sdmVkTm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncz8ucmVjb3JkID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBheWxvYWQucmVjb3JkID0gYXJncy5yZWNvcmQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXJ0eUJlZm9yZSA9IGF3YWl0IHF1ZXJ5U2NlbmVEaXJ0eVNhZmUocmVxdWVzdGVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnc2V0LXByb3BlcnR5JywgcGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpcnR5QWZ0ZXIgPSBhd2FpdCBxdWVyeVNjZW5lRGlydHlTYWZlKHJlcXVlc3Rlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHVwZGF0ZWQgPT09IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBvcGVuVGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiBhc3NldFV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXJsOiBhc3NldFVybCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHJlc29sdmVkTm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlUGF0aDogbm9kZVBhdGggfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1bXAsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZUtpbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkVHlwZTogY29lcmNlZC5hcHBsaWVkVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcnR5QmVmb3JlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlydHlBZnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcnR5Q2hhbmdlZDogZGlydHlCZWZvcmUgIT09IG51bGwgJiYgZGlydHlBZnRlciAhPT0gbnVsbCA/IGRpcnR5QmVmb3JlICE9PSBkaXJ0eUFmdGVyIDogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCforr7nva4gUHJlZmFiIOiKgueCueWxnuaAp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3F1ZXJ5X25vZGVzX2J5X2Fzc2V0X3V1aWQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlvJXnlKjmjIflrpogUHJlZmFiIOi1hOa6kOeahOiKgueCuSBVVUlEIOWIl+ihqO+8iOe7k+aenOWPr+iDveWMheWQq+mdniBQcmVmYWIg5a6e5L6L6IqC54K577yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcmVmYWIg6LWE5rqQIFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5hc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhc3NldFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCBhc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZHMgPSBBcnJheS5pc0FycmF5KHV1aWRzKSA/IHV1aWRzIDogW107XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogbm9kZVV1aWRzLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6IgUHJlZmFiIOW8leeUqOiKgueCueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3F1ZXJ5X2luc3RhbmNlX25vZGVzX2J5X2Fzc2V0X3V1aWQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LmjIflrpogUHJlZmFiIOi1hOa6kOWvueW6lOeahCBQcmVmYWIg5a6e5L6L6IqC54K5IFVVSUQg5YiX6KGo77yI6L+H5ruk6Z2e5a6e5L6L5byV55So6IqC54K577yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcmVmYWIg6LWE5rqQIFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsICdzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBxdWVyaWVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsTm9kZVV1aWRzID0gQXJyYXkuaXNBcnJheShxdWVyaWVkKSA/IHF1ZXJpZWQgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VOb2RlVXVpZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNraXBwZWQ6IEFycmF5PHsgbm9kZVV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT4gPSBbXTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG5vZGVVdWlkIG9mIGFsbE5vZGVVdWlkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpbmZvLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2tpcHBlZC5wdXNoKHsgbm9kZVV1aWQsIHJlYXNvbjogJ+iKgueCueS4jeaYryBQcmVmYWIg5a6e5L6LJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmZvLnByZWZhYkFzc2V0VXVpZCAmJiBpbmZvLnByZWZhYkFzc2V0VXVpZCAhPT0gYXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNraXBwZWQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbjogYOWunuS+i+WFs+iBlOi1hOa6kOS4jeWMuemFje+8iGV4cGVjdGVkPSR7YXNzZXRVdWlkfSwgYWN0dWFsPSR7aW5mby5wcmVmYWJBc3NldFV1aWR9KWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZU5vZGVVdWlkcy5wdXNoKG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBza2lwcGVkLnB1c2goeyBub2RlVXVpZCwgcmVhc29uOiBub3JtYWxpemVFcnJvcihlcnJvcikgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWxsTm9kZVV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWxsQ291bnQ6IGFsbE5vZGVVdWlkcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZHM6IGluc3RhbmNlTm9kZVV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGluc3RhbmNlTm9kZVV1aWRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNraXBwZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIFByZWZhYiDlrp7kvovoioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9nZXRfaW5zdGFuY2VfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMieiKgueCuSBVVUlEIOafpeivoiBQcmVmYWIg5a6e5L6L5L+h5oGvJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5pbmZvXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBQcmVmYWIg5a6e5L6L5L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2UnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIYgUHJlZmFiIOWunuS+i+iKgueCueeahOaUueWKqOW6lOeUqOWbnuWFs+iBlOi1hOa6kO+8iOWunumqjOiDveWKm++8iScsXG4gICAgICAgICAgICBsYXllcjogJ2V4cGVyaW1lbnRhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5LuF55So5LqO5qCh6aqM5b2T5YmN5YWz6IGU6LWE5rqQIFVVSUQg5piv5ZCm5LiA6Ie0JyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuYXBwbHktcHJlZmFiJywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZmFiVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucHJlZmFiVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmVmb3JlID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYmVmb3JlLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfnm67moIfoioLngrnlvZPliY3kuI3mmK8gUHJlZmFiIOWunuS+i++8jOaXoOazlSBhcHBseScsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX0lOU1RBTkNFX1JFUVVJUkVEJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJlZmFiVXVpZCAmJiBiZWZvcmUucHJlZmFiQXNzZXRVdWlkICYmIGJlZm9yZS5wcmVmYWJBc3NldFV1aWQgIT09IHByZWZhYlV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwcmVmYWJVdWlkIOS4juiKgueCueW9k+WJjeWFs+iBlOi1hOa6kOS4jeS4gOiHtO+8jOWumOaWuSBBUEkg5LiN5pSv5oyB6LeoIFByZWZhYiDnm7TmjqXlhbPogZQnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQgPSBhd2FpdCBhcHBseVByZWZhYlRvTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBiZWZvcmUucHJlZmFiQXNzZXRVdWlkIHx8IHByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhZnRlciA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFmdGVyLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhcHBseSDov5Tlm57miJDlip/kvYboioLngrnmnKrkv53mjIEgUHJlZmFiIOWunuS+i+eKtuaAgScsIHVuZGVmaW5lZCwgJ0VfUFJFRkFCX0FQUExZX1ZFUklGWV9GQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiBiZWZvcmUucHJlZmFiQXNzZXRVdWlkIHx8IHByZWZhYlV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogYXBwbGllZC5tZXRob2QsXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWZvcmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZnRlclxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflupTnlKggUHJlZmFiIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2FwcGx5X2luc3RhbmNlc19ieV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMiSBQcmVmYWIg6LWE5rqQIFVVSUQg5om56YeP5bqU55So5a6e5L6L77yI5a6e6aqM6IO95Yqb77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXhwZXJpbWVudGFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55So5LqO562b6YCJ5a6e5L6L6IqC54K555qEIFByZWZhYiDotYTmupAgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UHJlZmFiVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzku4XnlKjkuo7moKHpqozvvIzoi6XkvKDlhaXlv4XpobvnrYnkuo4gYXNzZXRVdWlkJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCAnc2NlbmUuYXBwbHktcHJlZmFiJywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQcmVmYWJVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YXJnZXRQcmVmYWJVdWlkKSB8fCBhc3NldFV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFByZWZhYlV1aWQgIT09IGFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5a6Y5pa5IEFQSSDkuI3mlK/mjIHmjIkgdGFyZ2V0UHJlZmFiVXVpZCDot6jotYTmupDmibnph4/lhbPogZTvvIx0YXJnZXRQcmVmYWJVdWlkIOW/hemhu+etieS6jiBhc3NldFV1aWQnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IEFycmF5LmlzQXJyYXkodXVpZHMpID8gdXVpZHMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwbGllZDogQXJyYXk8eyBub2RlVXVpZDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZyB9PiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQ6IEFycmF5PHsgbm9kZVV1aWQ6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZVV1aWQgb2Ygbm9kZVV1aWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IHF1ZXJ5UHJlZmFiSW5zdGFuY2VJbmZvKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghYmVmb3JlLmlzUHJlZmFiSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLnB1c2goeyBub2RlVXVpZCwgZXJyb3I6ICfoioLngrnkuI3mmK8gUHJlZmFiIOWunuS+i++8jOi3s+i/hyBhcHBseScgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiZWZvcmUucHJlZmFiQXNzZXRVdWlkICYmIGJlZm9yZS5wcmVmYWJBc3NldFV1aWQgIT09IGFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBg6IqC54K55YWz6IGU6LWE5rqQ5LiO562b6YCJ6LWE5rqQ5LiN5LiA6Ie077yIZXhwZWN0ZWQ9JHthc3NldFV1aWR9LCBhY3R1YWw9JHtiZWZvcmUucHJlZmFiQXNzZXRVdWlkfe+8iWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwcGx5UHJlZmFiVG9Ob2RlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIHRhcmdldFByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFmdGVyID0gYXdhaXQgcXVlcnlQcmVmYWJJbnN0YW5jZUluZm8ocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFhZnRlci5pc1ByZWZhYkluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZC5wdXNoKHsgbm9kZVV1aWQsIGVycm9yOiAnYXBwbHkg5ZCO6IqC54K55aSx5Y67IFByZWZhYiDlrp7kvovnirbmgIEnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkLnB1c2goeyBub2RlVXVpZCwgbWV0aG9kOiByZXN1bHQubWV0aG9kIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZC5wdXNoKHsgbm9kZVV1aWQsIGVycm9yOiBub3JtYWxpemVFcnJvcihlcnJvcikgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZDogbm9kZVV1aWRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcGxpZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQ6IGFwcGxpZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50OiBmYWlsZWQubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJuemHj+W6lOeUqCBQcmVmYWIg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+i/mOWOn+aMh+WumiBQcmVmYWIg5a6e5L6L6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+mcgOimgei/mOWOn+eahOiKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzdG9yZS1wcmVmYWInXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHJlc3RvcmVkOiB0cnVlLCBub2RlVXVpZCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfov5jljp8gUHJlZmFiIOWunuS+i+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2VzX2J5X2Fzc2V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJIFByZWZhYiDotYTmupAgVVVJRCDmibnph4/ov5jljp/lrp7kvovoioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1ByZWZhYiDotYTmupAgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgJ3NjZW5lLnJlc3RvcmUtcHJlZmFiJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IEFycmF5LmlzQXJyYXkodXVpZHMpID8gdXVpZHMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdG9yZWQ6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZDogQXJyYXk8eyBub2RlVXVpZDogc3RyaW5nOyBlcnJvcjogc3RyaW5nIH0+ID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBub2RlVXVpZCBvZiBub2RlVXVpZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdG9yZWQucHVzaChub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLnB1c2goeyBub2RlVXVpZCwgZXJyb3I6IG5vcm1hbGl6ZUVycm9yKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWQ6IG5vZGVVdWlkcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN0b3JlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudDogcmVzdG9yZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50OiBmYWlsZWQubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJuemHj+i/mOWOnyBQcmVmYWIg5a6e5L6L5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzZXRfbm9kZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjee9ruiKgueCueWIsOm7mOiupOeKtuaAgScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfoioLngrkgVVVJRCDmiJYgVVVJRCDliJfooagnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkcyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzZXQtbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWRzID0gdG9TdHJpbmdMaXN0KGFyZ3M/Lm5vZGVVdWlkcyk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVVdWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkcyDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3Jlc2V0LW5vZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZHMubGVuZ3RoID09PSAxID8gbm9kZVV1aWRzWzBdIDogbm9kZVV1aWRzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZXNldDogdHJ1ZSwgbm9kZVV1aWRzIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+mHjee9ruiKgueCueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc2V0X2NvbXBvbmVudCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjee9rue7hOS7tuWIsOm7mOiupOeKtuaAgScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+e7hOS7tiBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydjb21wb25lbnRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZXNldC1jb21wb25lbnQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29tcG9uZW50VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3Jlc2V0LWNvbXBvbmVudCcsIHsgdXVpZDogY29tcG9uZW50VXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgcmVzZXQ6IHRydWUsIGNvbXBvbmVudFV1aWQgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6YeN572u57uE5Lu25aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBdO1xufVxuIl19