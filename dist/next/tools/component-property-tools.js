"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponentPropertyTools = createComponentPropertyTools;
const common_1 = require("./common");
function normalizeComponentType(raw) {
    const candidates = [
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.__type__),
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.cid),
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.type),
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.name)
    ];
    const matched = candidates.find((item) => Boolean(item));
    return matched || 'Unknown';
}
function normalizeComponentUuid(raw) {
    var _a;
    const candidates = [
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.uuid),
        (0, common_1.readDumpString)((_a = raw === null || raw === void 0 ? void 0 : raw.value) === null || _a === void 0 ? void 0 : _a.uuid)
    ];
    const matched = candidates.find((item) => Boolean(item));
    return matched || undefined;
}
function normalizeComponentName(raw) {
    var _a;
    const candidates = [
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.name),
        (0, common_1.readDumpString)((_a = raw === null || raw === void 0 ? void 0 : raw.value) === null || _a === void 0 ? void 0 : _a.name)
    ];
    const matched = candidates.find((item) => Boolean(item));
    return matched || undefined;
}
function extractNodeComponents(node) {
    const rawComponents = Array.isArray(node === null || node === void 0 ? void 0 : node.__comps__) ? node.__comps__ : [];
    return rawComponents.map((item, index) => ({
        index,
        type: normalizeComponentType(item),
        name: normalizeComponentName(item),
        uuid: normalizeComponentUuid(item)
    }));
}
async function queryNodeComponents(requester, nodeUuid) {
    const node = await requester('scene', 'query-node', nodeUuid);
    return extractNodeComponents(node);
}
function resolveComponentIndex(components, args) {
    if (typeof (args === null || args === void 0 ? void 0 : args.componentIndex) === 'number' && Number.isInteger(args.componentIndex) && args.componentIndex >= 0) {
        return args.componentIndex;
    }
    const componentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentUuid);
    if (componentUuid) {
        const hitByUuid = components.find((item) => item.uuid === componentUuid);
        if (hitByUuid) {
            return hitByUuid.index;
        }
    }
    const componentType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentType);
    if (componentType) {
        const hitByType = components.find((item) => item.type === componentType);
        if (hitByType) {
            return hitByType.index;
        }
    }
    return -1;
}
function buildPropertyPath(componentIndex, propertyPath) {
    if (propertyPath.startsWith('__comps__.')) {
        return propertyPath;
    }
    return `__comps__.${componentIndex}.${propertyPath}`;
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
function normalizeValueKindByType(type) {
    const lowered = type.trim().toLowerCase();
    if (!lowered) {
        return null;
    }
    if (lowered.includes('boolean')) {
        return 'boolean';
    }
    if (lowered.includes('number') || lowered.includes('float') || lowered.includes('double') || lowered.includes('int')) {
        return 'number';
    }
    if (lowered.includes('string')) {
        return 'string';
    }
    return null;
}
function getDumpAtPath(componentDump, propertyPath) {
    const segments = propertyPath
        .split('.')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    if (segments.length === 0) {
        return componentDump;
    }
    let current = componentDump;
    for (const segment of segments) {
        if (!current || typeof current !== 'object') {
            return undefined;
        }
        if (Object.prototype.hasOwnProperty.call(current, segment)) {
            current = current[segment];
            continue;
        }
        if (current.value && typeof current.value === 'object' && Object.prototype.hasOwnProperty.call(current.value, segment)) {
            current = current.value[segment];
            continue;
        }
        return undefined;
    }
    return current;
}
async function inferValueKindForAuto(requester, components, componentIndex, propertyPath) {
    const target = components[componentIndex];
    const componentUuid = target === null || target === void 0 ? void 0 : target.uuid;
    if (!componentUuid) {
        return null;
    }
    try {
        const componentDump = await requester('scene', 'query-component', componentUuid);
        const propertyDump = getDumpAtPath(componentDump, propertyPath);
        if (propertyDump === undefined) {
            return null;
        }
        const explicitType = (0, common_1.readDumpString)(propertyDump === null || propertyDump === void 0 ? void 0 : propertyDump.type);
        if (explicitType) {
            const byType = normalizeValueKindByType(explicitType);
            if (byType) {
                return byType;
            }
        }
        const raw = (0, common_1.unwrapDumpValue)(propertyDump);
        if (typeof raw === 'boolean') {
            return 'boolean';
        }
        if (typeof raw === 'number') {
            return 'number';
        }
        if (typeof raw === 'string') {
            return 'string';
        }
        return null;
    }
    catch (_a) {
        return null;
    }
}
function readNodeUuidValue(node) {
    return (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.uuid) || (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.id) || null;
}
function buildSceneTreeSnapshot(node) {
    const uuids = new Set();
    const parentByUuid = new Map();
    const walk = (current, parentUuid) => {
        if (!current || typeof current !== 'object') {
            return;
        }
        const uuid = readNodeUuidValue(current);
        if (uuid) {
            uuids.add(uuid);
            parentByUuid.set(uuid, parentUuid);
        }
        const children = Array.isArray(current.children)
            ? current.children
            : [];
        for (const child of children) {
            walk(child, uuid);
        }
    };
    walk(node, null);
    return { uuids, parentByUuid };
}
async function querySceneTreeSnapshotSafe(requester) {
    try {
        const tree = await requester('scene', 'query-node-tree');
        if (!tree || typeof tree !== 'object') {
            return null;
        }
        return buildSceneTreeSnapshot(tree);
    }
    catch (_a) {
        return null;
    }
}
function areSnapshotsEqual(a, b) {
    if (a.uuids.size !== b.uuids.size) {
        return false;
    }
    for (const uuid of a.uuids) {
        if (!b.uuids.has(uuid)) {
            return false;
        }
    }
    return true;
}
function findAddedRootNodeUuids(before, after) {
    const added = new Set();
    for (const uuid of after.uuids) {
        if (!before.uuids.has(uuid)) {
            added.add(uuid);
        }
    }
    if (added.size === 0) {
        return [];
    }
    const roots = [];
    for (const uuid of added) {
        const parentUuid = after.parentByUuid.get(uuid) || null;
        if (!parentUuid || !added.has(parentUuid)) {
            roots.push(uuid);
        }
    }
    return roots;
}
function createComponentPropertyTools(requester) {
    return [
        {
            name: 'component_list_on_node',
            description: '查询节点上的组件列表',
            layer: 'official',
            category: 'component',
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
                    const components = await queryNodeComponents(requester, nodeUuid);
                    return (0, common_1.ok)({
                        nodeUuid,
                        components,
                        count: components.length
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询组件列表失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_add_component',
            description: '向节点添加组件',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '节点 UUID' },
                    componentType: { type: 'string', description: '组件类型，例如 cc.Sprite' }
                },
                required: ['nodeUuid', 'componentType']
            },
            requiredCapabilities: ['scene.create-component'],
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const componentType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentType);
                if (!nodeUuid || !componentType) {
                    return (0, common_1.fail)('nodeUuid/componentType 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'create-component', {
                        uuid: nodeUuid,
                        component: componentType
                    });
                    return (0, common_1.ok)({
                        added: true,
                        nodeUuid,
                        componentType
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('添加组件失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_remove_component',
            description: '从节点移除组件（优先按 componentUuid，次选 componentType）',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '节点 UUID' },
                    componentUuid: { type: 'string', description: '组件 UUID（推荐）' },
                    componentType: { type: 'string', description: '组件类型（用于查找 UUID）' }
                },
                required: ['nodeUuid']
            },
            requiredCapabilities: ['scene.remove-component', 'scene.query-node'],
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                if (!nodeUuid) {
                    return (0, common_1.fail)('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const componentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentUuid);
                const componentType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentType);
                if (!componentUuid && !componentType) {
                    return (0, common_1.fail)('componentUuid 或 componentType 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    let finalComponentUuid = componentUuid;
                    if (!finalComponentUuid) {
                        const components = await queryNodeComponents(requester, nodeUuid);
                        const matched = components.find((item) => item.type === componentType);
                        if (!matched) {
                            return (0, common_1.fail)(`未找到组件: ${componentType}`, undefined, 'E_COMPONENT_NOT_FOUND');
                        }
                        if (!matched.uuid) {
                            return (0, common_1.fail)(`组件缺少 UUID: ${componentType}`, undefined, 'E_COMPONENT_UUID_MISSING');
                        }
                        finalComponentUuid = matched.uuid;
                    }
                    await requester('scene', 'remove-component', { uuid: finalComponentUuid });
                    return (0, common_1.ok)({
                        removed: true,
                        nodeUuid,
                        componentUuid: finalComponentUuid,
                        componentType: componentType || undefined
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('移除组件失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_set_property',
            description: '设置节点组件属性（支持 type/value 形式）',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '节点 UUID' },
                    componentIndex: { type: 'number', description: '组件索引（与 componentUuid/componentType 二选一）' },
                    componentUuid: { type: 'string', description: '组件 UUID（推荐）' },
                    componentType: { type: 'string', description: '组件类型（例如 cc.Label）' },
                    propertyPath: { type: 'string', description: '组件属性路径，例：string 或 color.r' },
                    value: { description: '要写入的属性值' },
                    valueKind: {
                        type: 'string',
                        enum: ['auto', 'boolean', 'number', 'string', 'json'],
                        description: '可选，值类型转换策略（默认 auto）'
                    },
                    valueType: { type: 'string', description: '可选，属性值类型，例：cc.Color/cc.Vec3' },
                    record: { type: 'boolean', description: '可选，是否记录 undo' }
                },
                required: ['nodeUuid', 'propertyPath']
            },
            requiredCapabilities: ['scene.set-property', 'scene.query-node'],
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const propertyPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.propertyPath);
                if (!nodeUuid || !propertyPath) {
                    return (0, common_1.fail)('nodeUuid/propertyPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const valueKind = (0, common_1.normalizeValueKind)(args === null || args === void 0 ? void 0 : args.valueKind);
                    if (!valueKind) {
                        return (0, common_1.fail)('valueKind 仅支持 auto/boolean/number/string/json', undefined, 'E_INVALID_ARGUMENT');
                    }
                    const components = await queryNodeComponents(requester, nodeUuid);
                    const componentIndex = resolveComponentIndex(components, args);
                    if (componentIndex < 0) {
                        return (0, common_1.fail)('无法定位目标组件，请提供有效的 componentIndex/componentUuid/componentType', undefined, 'E_COMPONENT_NOT_FOUND');
                    }
                    const inferredAutoKind = valueKind === 'auto'
                        ? await inferValueKindForAuto(requester, components, componentIndex, propertyPath)
                        : null;
                    const effectiveValueKind = inferredAutoKind || valueKind;
                    let coerced = (0, common_1.coerceValueByKind)(args === null || args === void 0 ? void 0 : args.value, effectiveValueKind);
                    if (!coerced.ok && valueKind === 'auto' && effectiveValueKind !== 'auto') {
                        coerced = (0, common_1.coerceValueByKind)(args === null || args === void 0 ? void 0 : args.value, 'auto');
                    }
                    if (!coerced.ok) {
                        return (0, common_1.fail)('属性值类型转换失败', coerced.error, 'E_INVALID_ARGUMENT');
                    }
                    const path = buildPropertyPath(componentIndex, propertyPath);
                    const dump = { value: coerced.value };
                    const valueType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.valueType);
                    if (valueType) {
                        dump.type = valueType;
                    }
                    const dirtyBefore = await querySceneDirtySafe(requester);
                    const requestPayload = {
                        uuid: nodeUuid,
                        path,
                        dump
                    };
                    if (typeof (args === null || args === void 0 ? void 0 : args.record) === 'boolean') {
                        requestPayload.record = args.record;
                    }
                    const updated = await requester('scene', 'set-property', requestPayload);
                    const dirtyAfter = await querySceneDirtySafe(requester);
                    return (0, common_1.ok)({
                        updated: updated === true,
                        nodeUuid,
                        componentIndex,
                        path,
                        dump,
                        valueKind,
                        effectiveValueKind,
                        appliedType: coerced.appliedType,
                        dirtyBefore,
                        dirtyAfter,
                        dirtyChanged: dirtyBefore !== null && dirtyAfter !== null ? dirtyBefore !== dirtyAfter : null
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置组件属性失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_list_available_types',
            description: '查询编辑器可添加组件类型',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-components'],
            run: async () => {
                try {
                    const components = await requester('scene', 'query-components');
                    return (0, common_1.ok)({
                        components,
                        count: Array.isArray(components) ? components.length : 0
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询可用组件类型失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_get_component_info',
            description: '按组件 UUID 查询组件详情',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    componentUuid: { type: 'string', description: '组件 UUID' }
                },
                required: ['componentUuid']
            },
            requiredCapabilities: ['scene.query-component'],
            run: async (args) => {
                const componentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentUuid);
                if (!componentUuid) {
                    return (0, common_1.fail)('componentUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const component = await requester('scene', 'query-component', componentUuid);
                    return (0, common_1.ok)({
                        componentUuid,
                        component
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询组件详情失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_query_classes',
            description: '查询组件类元信息（scene.query-classes）',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    options: {
                        type: 'object',
                        description: '可选，query-classes 参数'
                    }
                }
            },
            requiredCapabilities: ['scene.query-classes'],
            run: async (args) => {
                const options = (args === null || args === void 0 ? void 0 : args.options) && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const classes = options
                        ? await requester('scene', 'query-classes', options)
                        : await requester('scene', 'query-classes');
                    const list = Array.isArray(classes) ? classes : [];
                    return (0, common_1.ok)({
                        options: options || null,
                        classes: list,
                        count: list.length
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询组件类信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_has_script',
            description: '检查指定组件名是否已存在脚本实现',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    componentName: { type: 'string', description: '组件名称' }
                },
                required: ['componentName']
            },
            requiredCapabilities: ['scene.query-component-has-script'],
            run: async (args) => {
                const componentName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentName);
                if (!componentName) {
                    return (0, common_1.fail)('componentName 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const hasScript = await requester('scene', 'query-component-has-script', componentName);
                    return (0, common_1.ok)({
                        componentName,
                        hasScript: hasScript === true
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询组件脚本状态失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_execute_method',
            description: '执行组件方法（scene.execute-component-method）',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    componentUuid: { type: 'string', description: '组件 UUID' },
                    methodName: { type: 'string', description: '方法名' },
                    args: {
                        type: 'array',
                        description: '可选，方法参数'
                    },
                    rollbackAfterCall: {
                        type: 'boolean',
                        description: '可选，执行后是否软重载回滚，默认 false'
                    },
                    transient: {
                        type: 'boolean',
                        description: '可选，等价于 rollbackAfterCall，用于临时调用不落盘'
                    }
                },
                required: ['componentUuid', 'methodName']
            },
            requiredCapabilities: ['scene.execute-component-method'],
            run: async (args) => {
                const componentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.componentUuid);
                const methodName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.methodName);
                if (!componentUuid || !methodName) {
                    return (0, common_1.fail)('componentUuid/methodName 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const methodArgs = Array.isArray(args === null || args === void 0 ? void 0 : args.args) ? args.args : [];
                const rollbackRequested = (args === null || args === void 0 ? void 0 : args.rollbackAfterCall) === true || (args === null || args === void 0 ? void 0 : args.transient) === true;
                try {
                    const dirtyBefore = await querySceneDirtySafe(requester);
                    const treeBefore = await querySceneTreeSnapshotSafe(requester);
                    const result = await requester('scene', 'execute-component-method', {
                        uuid: componentUuid,
                        name: methodName,
                        args: methodArgs
                    });
                    const dirtyAfterCall = await querySceneDirtySafe(requester);
                    const treeAfterCall = await querySceneTreeSnapshotSafe(requester);
                    const sceneMutated = treeBefore && treeAfterCall
                        ? !areSnapshotsEqual(treeBefore, treeAfterCall)
                        : (dirtyBefore !== null && dirtyAfterCall !== null
                            ? dirtyBefore !== dirtyAfterCall
                            : dirtyAfterCall === true ? true : null);
                    let rollbackApplied = false;
                    let rollbackMethod = null;
                    let rollbackVerified = rollbackRequested ? false : null;
                    const rollbackErrors = [];
                    let dirtyAfterRollback = dirtyAfterCall;
                    let treeAfterRollback = treeAfterCall;
                    if (rollbackRequested) {
                        if (treeBefore && treeAfterCall) {
                            const addedRoots = findAddedRootNodeUuids(treeBefore, treeAfterCall);
                            if (addedRoots.length > 0) {
                                rollbackMethod = 'remove-node';
                                for (const uuid of addedRoots) {
                                    try {
                                        await requester('scene', 'remove-node', { uuid });
                                    }
                                    catch (error) {
                                        rollbackErrors.push(`remove-node(${uuid}) 失败: ${(0, common_1.normalizeError)(error)}`);
                                    }
                                }
                            }
                        }
                        if (!rollbackMethod || rollbackErrors.length > 0) {
                            try {
                                await requester('scene', 'soft-reload');
                                rollbackMethod = 'soft-reload';
                            }
                            catch (error) {
                                rollbackErrors.push(`soft-reload 失败: ${(0, common_1.normalizeError)(error)}`);
                            }
                        }
                        dirtyAfterRollback = await querySceneDirtySafe(requester);
                        treeAfterRollback = await querySceneTreeSnapshotSafe(requester);
                        if (treeBefore && treeAfterRollback) {
                            rollbackVerified = areSnapshotsEqual(treeBefore, treeAfterRollback);
                        }
                        else if (dirtyAfterRollback !== null) {
                            rollbackVerified = dirtyAfterRollback === false;
                        }
                        else {
                            rollbackVerified = null;
                        }
                        if (rollbackVerified !== true) {
                            const detailParts = [
                                rollbackMethod ? `rollbackMethod=${rollbackMethod}` : 'rollbackMethod=none',
                                `rollbackVerified=${rollbackVerified === null ? 'unknown' : String(rollbackVerified)}`
                            ];
                            if (rollbackErrors.length > 0) {
                                detailParts.push(`errors=${rollbackErrors.join('; ')}`);
                            }
                            if (treeBefore && treeAfterRollback) {
                                detailParts.push(`treeBefore=${treeBefore.uuids.size}`);
                                detailParts.push(`treeAfterRollback=${treeAfterRollback.uuids.size}`);
                            }
                            return (0, common_1.fail)('执行组件方法成功，但回滚验证失败', detailParts.join(' | '), 'E_RUNTIME_ROLLBACK_FAILED');
                        }
                        rollbackApplied = true;
                    }
                    const requiresSave = rollbackRequested
                        ? (dirtyAfterRollback === true || rollbackVerified === false)
                        : dirtyAfterCall === true;
                    return (0, common_1.ok)({
                        executed: true,
                        componentUuid,
                        methodName,
                        args: methodArgs,
                        result,
                        rollbackRequested,
                        rollbackApplied,
                        rollbackMethod,
                        rollbackVerified,
                        rollbackErrors,
                        dirtyBefore,
                        dirtyAfterCall,
                        dirtyAfterRollback,
                        sceneMutated,
                        requiresSave
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('执行组件方法失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_move_array_element',
            description: '移动组件数组属性元素位置',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: { type: 'string', description: '对象 UUID（节点或组件）' },
                    path: { type: 'string', description: '数组属性路径' },
                    target: { type: 'number', description: '目标索引' },
                    offset: { type: 'number', description: '偏移量' }
                },
                required: ['uuid', 'path', 'target', 'offset']
            },
            requiredCapabilities: ['scene.move-array-element'],
            run: async (args) => {
                const uuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.uuid);
                const path = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.path);
                if (!uuid || !path || !Number.isInteger(args === null || args === void 0 ? void 0 : args.target) || !Number.isInteger(args === null || args === void 0 ? void 0 : args.offset)) {
                    return (0, common_1.fail)('uuid/path/target/offset 必填且 target/offset 必须为整数', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const moved = await requester('scene', 'move-array-element', {
                        uuid,
                        path,
                        target: args.target,
                        offset: args.offset
                    });
                    return (0, common_1.ok)({
                        moved: moved === true,
                        uuid,
                        path,
                        target: args.target,
                        offset: args.offset
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('移动数组元素失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_remove_array_element',
            description: '删除组件数组属性元素',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: { type: 'string', description: '对象 UUID（节点或组件）' },
                    path: { type: 'string', description: '数组属性路径' },
                    index: { type: 'number', description: '数组索引' }
                },
                required: ['uuid', 'path', 'index']
            },
            requiredCapabilities: ['scene.remove-array-element'],
            run: async (args) => {
                const uuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.uuid);
                const path = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.path);
                if (!uuid || !path || !Number.isInteger(args === null || args === void 0 ? void 0 : args.index)) {
                    return (0, common_1.fail)('uuid/path/index 必填且 index 必须为整数', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const removed = await requester('scene', 'remove-array-element', {
                        uuid,
                        path,
                        index: args.index
                    });
                    return (0, common_1.ok)({
                        removed: removed === true,
                        uuid,
                        path,
                        index: args.index
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('删除数组元素失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'component_reset_property',
            description: '重置属性到默认值（scene.reset-property）',
            layer: 'official',
            category: 'component',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: { type: 'string', description: '对象 UUID（节点或组件）' },
                    path: { type: 'string', description: '属性路径' },
                    value: { description: '可选，透传给 dump.value' },
                    valueType: { type: 'string', description: '可选，dump.type' },
                    record: { type: 'boolean', description: '可选，是否记录 undo' }
                },
                required: ['uuid', 'path']
            },
            requiredCapabilities: ['scene.reset-property'],
            run: async (args) => {
                const uuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.uuid);
                const path = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.path);
                if (!uuid || !path) {
                    return (0, common_1.fail)('uuid/path 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const dump = {
                    value: Object.prototype.hasOwnProperty.call(args || {}, 'value') ? args.value : null
                };
                const valueType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.valueType);
                if (valueType) {
                    dump.type = valueType;
                }
                const payload = {
                    uuid,
                    path,
                    dump
                };
                if (typeof (args === null || args === void 0 ? void 0 : args.record) === 'boolean') {
                    payload.record = args.record;
                }
                try {
                    const reset = await requester('scene', 'reset-property', payload);
                    return (0, common_1.ok)({
                        reset: reset === true,
                        uuid,
                        path,
                        dump
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('重置属性失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXByb3BlcnR5LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvY29tcG9uZW50LXByb3BlcnR5LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBcVJBLG9FQTZsQkM7QUFqM0JELHFDQVVrQjtBQVNsQixTQUFTLHNCQUFzQixDQUFDLEdBQVE7SUFDcEMsTUFBTSxVQUFVLEdBQUc7UUFDZixJQUFBLHVCQUFjLEVBQUMsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLFFBQVEsQ0FBQztRQUM3QixJQUFBLHVCQUFjLEVBQUMsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLEdBQUcsQ0FBQztRQUN4QixJQUFBLHVCQUFjLEVBQUMsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLElBQUksQ0FBQztRQUN6QixJQUFBLHVCQUFjLEVBQUMsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLElBQUksQ0FBQztLQUM1QixDQUFDO0lBQ0YsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDekQsT0FBTyxPQUFPLElBQUksU0FBUyxDQUFDO0FBQ2hDLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLEdBQVE7O0lBQ3BDLE1BQU0sVUFBVSxHQUFHO1FBQ2YsSUFBQSx1QkFBYyxFQUFDLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxJQUFJLENBQUM7UUFDekIsSUFBQSx1QkFBYyxFQUFDLE1BQUEsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLEtBQUssMENBQUUsSUFBSSxDQUFDO0tBQ25DLENBQUM7SUFDRixNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FB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QyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUk7aUJBQ3ZGLENBQUM7Z0JBQ0YsTUFBTSxTQUFTLEdBQUcsSUFBQSx5QkFBZ0IsRUFBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3BELElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ1osSUFBSSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7Z0JBQzFCLENBQUM7Z0JBRUQsTUFBTSxPQUFPLEdBQXdCO29CQUNqQyxJQUFJO29CQUNKLElBQUk7b0JBQ0osSUFBSTtpQkFDUCxDQUFDO2dCQUNGLElBQUksT0FBTyxDQUFBLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxNQUFNLENBQUEsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDcEMsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUNqQyxDQUFDO2dCQUVELElBQUksQ0FBQztvQkFDRCxNQUFNLEtBQUssR0FBRyxNQUFNLFNBQVMsQ0FBQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBQ2xFLE9BQU8sSUFBQSxXQUFFLEVBQUM7d0JBQ04sS0FBSyxFQUFFLEtBQUssS0FBSyxJQUFJO3dCQUNyQixJQUFJO3dCQUNKLElBQUk7d0JBQ0osSUFBSTtxQkFDUCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztnQkFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO29CQUNsQixPQUFPLElBQUEsYUFBSSxFQUFDLFFBQVEsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDakQsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWRpdG9yUmVxdWVzdGVyLCBOZXh0VG9vbERlZmluaXRpb24gfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHtcbiAgICBjb2VyY2VWYWx1ZUJ5S2luZCxcbiAgICBmYWlsLFxuICAgIG5vcm1hbGl6ZUVycm9yLFxuICAgIG5vcm1hbGl6ZVZhbHVlS2luZCxcbiAgICBvayxcbiAgICByZWFkRHVtcFN0cmluZyxcbiAgICB0b05vbkVtcHR5U3RyaW5nLFxuICAgIHVud3JhcER1bXBWYWx1ZSxcbiAgICBWYWx1ZUtpbmRcbn0gZnJvbSAnLi9jb21tb24nO1xuXG5pbnRlcmZhY2UgTm9ybWFsaXplZENvbXBvbmVudCB7XG4gICAgaW5kZXg6IG51bWJlcjtcbiAgICB0eXBlOiBzdHJpbmc7XG4gICAgbmFtZT86IHN0cmluZztcbiAgICB1dWlkPzogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb21wb25lbnRUeXBlKHJhdzogYW55KTogc3RyaW5nIHtcbiAgICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/Ll9fdHlwZV9fKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py5jaWQpLFxuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/LnR5cGUpLFxuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/Lm5hbWUpXG4gICAgXTtcbiAgICBjb25zdCBtYXRjaGVkID0gY2FuZGlkYXRlcy5maW5kKChpdGVtKSA9PiBCb29sZWFuKGl0ZW0pKTtcbiAgICByZXR1cm4gbWF0Y2hlZCB8fCAnVW5rbm93bic7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbXBvbmVudFV1aWQocmF3OiBhbnkpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8udXVpZCksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8udmFsdWU/LnV1aWQpXG4gICAgXTtcbiAgICBjb25zdCBtYXRjaGVkID0gY2FuZGlkYXRlcy5maW5kKChpdGVtKSA9PiBCb29sZWFuKGl0ZW0pKTtcbiAgICByZXR1cm4gbWF0Y2hlZCB8fCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbXBvbmVudE5hbWUocmF3OiBhbnkpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8ubmFtZSksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8udmFsdWU/Lm5hbWUpXG4gICAgXTtcbiAgICBjb25zdCBtYXRjaGVkID0gY2FuZGlkYXRlcy5maW5kKChpdGVtKSA9PiBCb29sZWFuKGl0ZW0pKTtcbiAgICByZXR1cm4gbWF0Y2hlZCB8fCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3ROb2RlQ29tcG9uZW50cyhub2RlOiBhbnkpOiBOb3JtYWxpemVkQ29tcG9uZW50W10ge1xuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSBBcnJheS5pc0FycmF5KG5vZGU/Ll9fY29tcHNfXykgPyBub2RlLl9fY29tcHNfXyA6IFtdO1xuICAgIHJldHVybiByYXdDb21wb25lbnRzLm1hcCgoaXRlbTogYW55LCBpbmRleDogbnVtYmVyKSA9PiAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgdHlwZTogbm9ybWFsaXplQ29tcG9uZW50VHlwZShpdGVtKSxcbiAgICAgICAgbmFtZTogbm9ybWFsaXplQ29tcG9uZW50TmFtZShpdGVtKSxcbiAgICAgICAgdXVpZDogbm9ybWFsaXplQ29tcG9uZW50VXVpZChpdGVtKVxuICAgIH0pKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcXVlcnlOb2RlQ29tcG9uZW50cyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlciwgbm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8Tm9ybWFsaXplZENvbXBvbmVudFtdPiB7XG4gICAgY29uc3Qgbm9kZSA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICByZXR1cm4gZXh0cmFjdE5vZGVDb21wb25lbnRzKG5vZGUpO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ29tcG9uZW50SW5kZXgoY29tcG9uZW50czogTm9ybWFsaXplZENvbXBvbmVudFtdLCBhcmdzOiBhbnkpOiBudW1iZXIge1xuICAgIGlmICh0eXBlb2YgYXJncz8uY29tcG9uZW50SW5kZXggPT09ICdudW1iZXInICYmIE51bWJlci5pc0ludGVnZXIoYXJncy5jb21wb25lbnRJbmRleCkgJiYgYXJncy5jb21wb25lbnRJbmRleCA+PSAwKSB7XG4gICAgICAgIHJldHVybiBhcmdzLmNvbXBvbmVudEluZGV4O1xuICAgIH1cblxuICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFV1aWQpO1xuICAgIGlmIChjb21wb25lbnRVdWlkKSB7XG4gICAgICAgIGNvbnN0IGhpdEJ5VXVpZCA9IGNvbXBvbmVudHMuZmluZCgoaXRlbSkgPT4gaXRlbS51dWlkID09PSBjb21wb25lbnRVdWlkKTtcbiAgICAgICAgaWYgKGhpdEJ5VXVpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGhpdEJ5VXVpZC5pbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFR5cGUpO1xuICAgIGlmIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGhpdEJ5VHlwZSA9IGNvbXBvbmVudHMuZmluZCgoaXRlbSkgPT4gaXRlbS50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKGhpdEJ5VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGhpdEJ5VHlwZS5pbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAtMTtcbn1cblxuZnVuY3Rpb24gYnVpbGRQcm9wZXJ0eVBhdGgoY29tcG9uZW50SW5kZXg6IG51bWJlciwgcHJvcGVydHlQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmIChwcm9wZXJ0eVBhdGguc3RhcnRzV2l0aCgnX19jb21wc19fLicpKSB7XG4gICAgICAgIHJldHVybiBwcm9wZXJ0eVBhdGg7XG4gICAgfVxuICAgIHJldHVybiBgX19jb21wc19fLiR7Y29tcG9uZW50SW5kZXh9LiR7cHJvcGVydHlQYXRofWA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHF1ZXJ5U2NlbmVEaXJ0eVNhZmUocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBQcm9taXNlPGJvb2xlYW4gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZGlydHkgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWRpcnR5Jyk7XG4gICAgICAgIHJldHVybiBkaXJ0eSA9PT0gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVWYWx1ZUtpbmRCeVR5cGUodHlwZTogc3RyaW5nKTogVmFsdWVLaW5kIHwgbnVsbCB7XG4gICAgY29uc3QgbG93ZXJlZCA9IHR5cGUudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKCFsb3dlcmVkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChsb3dlcmVkLmluY2x1ZGVzKCdib29sZWFuJykpIHtcbiAgICAgICAgcmV0dXJuICdib29sZWFuJztcbiAgICB9XG4gICAgaWYgKGxvd2VyZWQuaW5jbHVkZXMoJ251bWJlcicpIHx8IGxvd2VyZWQuaW5jbHVkZXMoJ2Zsb2F0JykgfHwgbG93ZXJlZC5pbmNsdWRlcygnZG91YmxlJykgfHwgbG93ZXJlZC5pbmNsdWRlcygnaW50JykpIHtcbiAgICAgICAgcmV0dXJuICdudW1iZXInO1xuICAgIH1cbiAgICBpZiAobG93ZXJlZC5pbmNsdWRlcygnc3RyaW5nJykpIHtcbiAgICAgICAgcmV0dXJuICdzdHJpbmcnO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0RHVtcEF0UGF0aChjb21wb25lbnREdW1wOiBhbnksIHByb3BlcnR5UGF0aDogc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5UGF0aFxuICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbSAhPT0gJycpO1xuICAgIGlmIChzZWdtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudER1bXA7XG4gICAgfVxuXG4gICAgbGV0IGN1cnJlbnQ6IGFueSA9IGNvbXBvbmVudER1bXA7XG4gICAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgICAgIGlmICghY3VycmVudCB8fCB0eXBlb2YgY3VycmVudCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGN1cnJlbnQsIHNlZ21lbnQpKSB7XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudFtzZWdtZW50XTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGN1cnJlbnQudmFsdWUgJiYgdHlwZW9mIGN1cnJlbnQudmFsdWUgPT09ICdvYmplY3QnICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjdXJyZW50LnZhbHVlLCBzZWdtZW50KSkge1xuICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQudmFsdWVbc2VnbWVudF07XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBjdXJyZW50O1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbmZlclZhbHVlS2luZEZvckF1dG8oXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgY29tcG9uZW50czogTm9ybWFsaXplZENvbXBvbmVudFtdLFxuICAgIGNvbXBvbmVudEluZGV4OiBudW1iZXIsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmdcbik6IFByb21pc2U8VmFsdWVLaW5kIHwgbnVsbD4ge1xuICAgIGNvbnN0IHRhcmdldCA9IGNvbXBvbmVudHNbY29tcG9uZW50SW5kZXhdO1xuICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0YXJnZXQ/LnV1aWQ7XG4gICAgaWYgKCFjb21wb25lbnRVdWlkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudER1bXAgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudCcsIGNvbXBvbmVudFV1aWQpO1xuICAgICAgICBjb25zdCBwcm9wZXJ0eUR1bXAgPSBnZXREdW1wQXRQYXRoKGNvbXBvbmVudER1bXAsIHByb3BlcnR5UGF0aCk7XG4gICAgICAgIGlmIChwcm9wZXJ0eUR1bXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBleHBsaWNpdFR5cGUgPSByZWFkRHVtcFN0cmluZygocHJvcGVydHlEdW1wIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pPy50eXBlKTtcbiAgICAgICAgaWYgKGV4cGxpY2l0VHlwZSkge1xuICAgICAgICAgICAgY29uc3QgYnlUeXBlID0gbm9ybWFsaXplVmFsdWVLaW5kQnlUeXBlKGV4cGxpY2l0VHlwZSk7XG4gICAgICAgICAgICBpZiAoYnlUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ5VHlwZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhdyA9IHVud3JhcER1bXBWYWx1ZShwcm9wZXJ0eUR1bXApO1xuICAgICAgICBpZiAodHlwZW9mIHJhdyA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2Jvb2xlYW4nO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgcmF3ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgcmV0dXJuICdudW1iZXInO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgcmF3ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcmV0dXJuICdzdHJpbmcnO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmludGVyZmFjZSBTY2VuZVRyZWVTbmFwc2hvdCB7XG4gICAgdXVpZHM6IFNldDxzdHJpbmc+O1xuICAgIHBhcmVudEJ5VXVpZDogTWFwPHN0cmluZywgc3RyaW5nIHwgbnVsbD47XG59XG5cbmZ1bmN0aW9uIHJlYWROb2RlVXVpZFZhbHVlKG5vZGU6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIHJldHVybiByZWFkRHVtcFN0cmluZyhub2RlPy51dWlkKSB8fCByZWFkRHVtcFN0cmluZyhub2RlPy5pZCkgfHwgbnVsbDtcbn1cblxuZnVuY3Rpb24gYnVpbGRTY2VuZVRyZWVTbmFwc2hvdChub2RlOiBhbnkpOiBTY2VuZVRyZWVTbmFwc2hvdCB7XG4gICAgY29uc3QgdXVpZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBwYXJlbnRCeVV1aWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgbnVsbD4oKTtcblxuICAgIGNvbnN0IHdhbGsgPSAoY3VycmVudDogYW55LCBwYXJlbnRVdWlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICghY3VycmVudCB8fCB0eXBlb2YgY3VycmVudCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHV1aWQgPSByZWFkTm9kZVV1aWRWYWx1ZShjdXJyZW50KTtcbiAgICAgICAgaWYgKHV1aWQpIHtcbiAgICAgICAgICAgIHV1aWRzLmFkZCh1dWlkKTtcbiAgICAgICAgICAgIHBhcmVudEJ5VXVpZC5zZXQodXVpZCwgcGFyZW50VXVpZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IEFycmF5LmlzQXJyYXkoKGN1cnJlbnQgYXMgUmVjb3JkPHN0cmluZywgYW55PikuY2hpbGRyZW4pXG4gICAgICAgICAgICA/IChjdXJyZW50IGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLmNoaWxkcmVuXG4gICAgICAgICAgICA6IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgICAgICB3YWxrKGNoaWxkLCB1dWlkKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB3YWxrKG5vZGUsIG51bGwpO1xuICAgIHJldHVybiB7IHV1aWRzLCBwYXJlbnRCeVV1aWQgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcXVlcnlTY2VuZVRyZWVTbmFwc2hvdFNhZmUocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBQcm9taXNlPFNjZW5lVHJlZVNuYXBzaG90IHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHRyZWUgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICBpZiAoIXRyZWUgfHwgdHlwZW9mIHRyZWUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnVpbGRTY2VuZVRyZWVTbmFwc2hvdCh0cmVlKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcmVTbmFwc2hvdHNFcXVhbChhOiBTY2VuZVRyZWVTbmFwc2hvdCwgYjogU2NlbmVUcmVlU25hcHNob3QpOiBib29sZWFuIHtcbiAgICBpZiAoYS51dWlkcy5zaXplICE9PSBiLnV1aWRzLnNpemUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHV1aWQgb2YgYS51dWlkcykge1xuICAgICAgICBpZiAoIWIudXVpZHMuaGFzKHV1aWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbmRBZGRlZFJvb3ROb2RlVXVpZHMoYmVmb3JlOiBTY2VuZVRyZWVTbmFwc2hvdCwgYWZ0ZXI6IFNjZW5lVHJlZVNuYXBzaG90KTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGFkZGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCB1dWlkIG9mIGFmdGVyLnV1aWRzKSB7XG4gICAgICAgIGlmICghYmVmb3JlLnV1aWRzLmhhcyh1dWlkKSkge1xuICAgICAgICAgICAgYWRkZWQuYWRkKHV1aWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGFkZGVkLnNpemUgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHJvb3RzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgdXVpZCBvZiBhZGRlZCkge1xuICAgICAgICBjb25zdCBwYXJlbnRVdWlkID0gYWZ0ZXIucGFyZW50QnlVdWlkLmdldCh1dWlkKSB8fCBudWxsO1xuICAgICAgICBpZiAoIXBhcmVudFV1aWQgfHwgIWFkZGVkLmhhcyhwYXJlbnRVdWlkKSkge1xuICAgICAgICAgICAgcm9vdHMucHVzaCh1dWlkKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcm9vdHM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnRQcm9wZXJ0eVRvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfbGlzdF9vbl9ub2RlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6IqC54K55LiK55qE57uE5Lu25YiX6KGoJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gYXdhaXQgcXVlcnlOb2RlQ29tcG9uZW50cyhyZXF1ZXN0ZXIsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiBjb21wb25lbnRzLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Lnu4Tku7bliJfooajlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9hZGRfY29tcG9uZW50JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5ZCR6IqC54K55re75Yqg57uE5Lu2JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+e7hOS7tuexu+Wei++8jOS+i+WmgiBjYy5TcHJpdGUnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJywgJ2NvbXBvbmVudFR5cGUnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmNyZWF0ZS1jb21wb25lbnQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQvY29tcG9uZW50VHlwZSDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50VHlwZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+a3u+WKoOe7hOS7tuWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3JlbW92ZV9jb21wb25lbnQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfku47oioLngrnnp7vpmaTnu4Tku7bvvIjkvJjlhYjmjIkgY29tcG9uZW50VXVpZO+8jOasoemAiSBjb21wb25lbnRUeXBl77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+e7hOS7tiBVVUlE77yI5o6o6I2Q77yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+e7hOS7tuexu+Wei++8iOeUqOS6juafpeaJviBVVUlE77yJJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVtb3ZlLWNvbXBvbmVudCcsICdzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50VXVpZCAmJiAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29tcG9uZW50VXVpZCDmiJYgY29tcG9uZW50VHlwZSDoh7PlsJHmj5DkvpvkuIDkuKonLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZmluYWxDb21wb25lbnRVdWlkID0gY29tcG9uZW50VXVpZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmaW5hbENvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBhd2FpdCBxdWVyeU5vZGVDb21wb25lbnRzKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlZCA9IGNvbXBvbmVudHMuZmluZCgoaXRlbSkgPT4gaXRlbS50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKGDmnKrmib7liLDnu4Tku7Y6ICR7Y29tcG9uZW50VHlwZX1gLCB1bmRlZmluZWQsICdFX0NPTVBPTkVOVF9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2hlZC51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoYOe7hOS7tue8uuWwkSBVVUlEOiAke2NvbXBvbmVudFR5cGV9YCwgdW5kZWZpbmVkLCAnRV9DT01QT05FTlRfVVVJRF9NSVNTSU5HJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5hbENvbXBvbmVudFV1aWQgPSBtYXRjaGVkLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7IHV1aWQ6IGZpbmFsQ29tcG9uZW50VXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IGZpbmFsQ29tcG9uZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGNvbXBvbmVudFR5cGUgfHwgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+enu+mZpOe7hOS7tuWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3NldF9wcm9wZXJ0eScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iuvue9ruiKgueCuee7hOS7tuWxnuaAp++8iOaUr+aMgSB0eXBlL3ZhbHVlIOW9ouW8j++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnY29tcG9uZW50JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfoioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50SW5kZXg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAn57uE5Lu257Si5byV77yI5LiOIGNvbXBvbmVudFV1aWQvY29tcG9uZW50VHlwZSDkuozpgInkuIDvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu2IFVVSUTvvIjmjqjojZDvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu257G75Z6L77yI5L6L5aaCIGNjLkxhYmVs77yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu25bGe5oCn6Lev5b6E77yM5L6L77yac3RyaW5nIOaIliBjb2xvci5yJyB9LFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogeyBkZXNjcmlwdGlvbjogJ+imgeWGmeWFpeeahOWxnuaAp+WAvCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVLaW5kOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnYXV0bycsICdib29sZWFuJywgJ251bWJlcicsICdzdHJpbmcnLCAnanNvbiddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzlgLznsbvlnovovazmjaLnrZbnlaXvvIjpu5jorqQgYXV0b++8iSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWxnuaAp+WAvOexu+Wei++8jOS+i++8mmNjLkNvbG9yL2NjLlZlYzMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlY29yZDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm6K6w5b2VIHVuZG8nIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJywgJ3Byb3BlcnR5UGF0aCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuc2V0LXByb3BlcnR5JywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcGVydHlQYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wcm9wZXJ0eVBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQgfHwgIXByb3BlcnR5UGF0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQvcHJvcGVydHlQYXRoIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlS2luZCA9IG5vcm1hbGl6ZVZhbHVlS2luZChhcmdzPy52YWx1ZUtpbmQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXZhbHVlS2luZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3ZhbHVlS2luZCDku4XmlK/mjIEgYXV0by9ib29sZWFuL251bWJlci9zdHJpbmcvanNvbicsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVzb2x2ZUNvbXBvbmVudEluZGV4KGNvbXBvbmVudHMsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50SW5kZXggPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5peg5rOV5a6a5L2N55uu5qCH57uE5Lu277yM6K+35o+Q5L6b5pyJ5pWI55qEIGNvbXBvbmVudEluZGV4L2NvbXBvbmVudFV1aWQvY29tcG9uZW50VHlwZScsIHVuZGVmaW5lZCwgJ0VfQ09NUE9ORU5UX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5mZXJyZWRBdXRvS2luZCA9IHZhbHVlS2luZCA9PT0gJ2F1dG8nXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IGluZmVyVmFsdWVLaW5kRm9yQXV0byhyZXF1ZXN0ZXIsIGNvbXBvbmVudHMsIGNvbXBvbmVudEluZGV4LCBwcm9wZXJ0eVBhdGgpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVmZmVjdGl2ZVZhbHVlS2luZCA9IGluZmVycmVkQXV0b0tpbmQgfHwgdmFsdWVLaW5kO1xuICAgICAgICAgICAgICAgICAgICBsZXQgY29lcmNlZCA9IGNvZXJjZVZhbHVlQnlLaW5kKGFyZ3M/LnZhbHVlLCBlZmZlY3RpdmVWYWx1ZUtpbmQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvZXJjZWQub2sgJiYgdmFsdWVLaW5kID09PSAnYXV0bycgJiYgZWZmZWN0aXZlVmFsdWVLaW5kICE9PSAnYXV0bycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZXJjZWQgPSBjb2VyY2VWYWx1ZUJ5S2luZChhcmdzPy52YWx1ZSwgJ2F1dG8nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvZXJjZWQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflsZ7mgKflgLznsbvlnovovazmjaLlpLHotKUnLCBjb2VyY2VkLmVycm9yLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gYnVpbGRQcm9wZXJ0eVBhdGgoY29tcG9uZW50SW5kZXgsIHByb3BlcnR5UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7IHZhbHVlOiBjb2VyY2VkLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlVHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udmFsdWVUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZHVtcC50eXBlID0gdmFsdWVUeXBlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlydHlCZWZvcmUgPSBhd2FpdCBxdWVyeVNjZW5lRGlydHlTYWZlKHJlcXVlc3Rlcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RQYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHVtcFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3M/LnJlY29yZCA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0UGF5bG9hZC5yZWNvcmQgPSBhcmdzLnJlY29yZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHJlcXVlc3RQYXlsb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlydHlBZnRlciA9IGF3YWl0IHF1ZXJ5U2NlbmVEaXJ0eVNhZmUocmVxdWVzdGVyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHVwZGF0ZWQgPT09IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudEluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1bXAsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZUtpbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICBlZmZlY3RpdmVWYWx1ZUtpbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkVHlwZTogY29lcmNlZC5hcHBsaWVkVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcnR5QmVmb3JlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlydHlBZnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcnR5Q2hhbmdlZDogZGlydHlCZWZvcmUgIT09IG51bGwgJiYgZGlydHlBZnRlciAhPT0gbnVsbCA/IGRpcnR5QmVmb3JlICE9PSBkaXJ0eUFmdGVyIDogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCforr7nva7nu4Tku7blsZ7mgKflpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9saXN0X2F2YWlsYWJsZV90eXBlcycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue8lui+keWZqOWPr+a3u+WKoOe7hOS7tuexu+WeiycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnY29tcG9uZW50JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1jb21wb25lbnRzJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1jb21wb25lbnRzJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IEFycmF5LmlzQXJyYXkoY29tcG9uZW50cykgPyBjb21wb25lbnRzLmxlbmd0aCA6IDBcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i5Y+v55So57uE5Lu257G75Z6L5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfZ2V0X2NvbXBvbmVudF9pbmZvJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJ57uE5Lu2IFVVSUQg5p+l6K+i57uE5Lu26K+m5oOFJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu2IFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2NvbXBvbmVudFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdjb21wb25lbnRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktY29tcG9uZW50JywgY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoue7hOS7tuivpuaDheWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3F1ZXJ5X2NsYXNzZXMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lnu4Tku7bnsbvlhYPkv6Hmga/vvIhzY2VuZS5xdWVyeS1jbGFzc2Vz77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxxdWVyeS1jbGFzc2VzIOWPguaVsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1jbGFzc2VzJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0gYXJncz8ub3B0aW9ucyAmJiB0eXBlb2YgYXJncy5vcHRpb25zID09PSAnb2JqZWN0JyA/IGFyZ3Mub3B0aW9ucyA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjbGFzc2VzID0gb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWNsYXNzZXMnLCBvcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWNsYXNzZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkoY2xhc3NlcykgPyBjbGFzc2VzIDogW107XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc2VzOiBsaXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoue7hOS7tuexu+S/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2hhc19zY3JpcHQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmo4Dmn6XmjIflrprnu4Tku7blkI3mmK/lkKblt7LlrZjlnKjohJrmnKzlrp7njrAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50TmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7blkI3np7AnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2NvbXBvbmVudE5hbWUnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudC1oYXMtc2NyaXB0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnROYW1lID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb21wb25lbnROYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2NvbXBvbmVudE5hbWUg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzU2NyaXB0ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQtaGFzLXNjcmlwdCcsIGNvbXBvbmVudE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc1NjcmlwdDogaGFzU2NyaXB0ID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoue7hOS7tuiEmuacrOeKtuaAgeWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2V4ZWN1dGVfbWV0aG9kJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5omn6KGM57uE5Lu25pa55rOV77yIc2NlbmUuZXhlY3V0ZS1jb21wb25lbnQtbWV0aG9k77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu2IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZE5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5pa55rOV5ZCNJyB9LFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzmlrnms5Xlj4LmlbAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJvbGxiYWNrQWZ0ZXJDYWxsOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaJp+ihjOWQjuaYr+WQpui9r+mHjei9veWbnua7mu+8jOm7mOiupCBmYWxzZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNpZW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOetieS7t+S6jiByb2xsYmFja0FmdGVyQ2FsbO+8jOeUqOS6juS4tOaXtuiwg+eUqOS4jeiQveebmCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY29tcG9uZW50VXVpZCcsICdtZXRob2ROYW1lJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5leGVjdXRlLWNvbXBvbmVudC1tZXRob2QnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGhvZE5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm1ldGhvZE5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50VXVpZCB8fCAhbWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29tcG9uZW50VXVpZC9tZXRob2ROYW1lIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGhvZEFyZ3MgPSBBcnJheS5pc0FycmF5KGFyZ3M/LmFyZ3MpID8gYXJncy5hcmdzIDogW107XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9sbGJhY2tSZXF1ZXN0ZWQgPSBhcmdzPy5yb2xsYmFja0FmdGVyQ2FsbCA9PT0gdHJ1ZSB8fCBhcmdzPy50cmFuc2llbnQgPT09IHRydWU7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlydHlCZWZvcmUgPSBhd2FpdCBxdWVyeVNjZW5lRGlydHlTYWZlKHJlcXVlc3Rlcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyZWVCZWZvcmUgPSBhd2FpdCBxdWVyeVNjZW5lVHJlZVNuYXBzaG90U2FmZShyZXF1ZXN0ZXIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2V4ZWN1dGUtY29tcG9uZW50LW1ldGhvZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXBvbmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBtZXRob2ROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJnczogbWV0aG9kQXJnc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlydHlBZnRlckNhbGwgPSBhd2FpdCBxdWVyeVNjZW5lRGlydHlTYWZlKHJlcXVlc3Rlcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyZWVBZnRlckNhbGwgPSBhd2FpdCBxdWVyeVNjZW5lVHJlZVNuYXBzaG90U2FmZShyZXF1ZXN0ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lTXV0YXRlZCA9IHRyZWVCZWZvcmUgJiYgdHJlZUFmdGVyQ2FsbFxuICAgICAgICAgICAgICAgICAgICAgICAgPyAhYXJlU25hcHNob3RzRXF1YWwodHJlZUJlZm9yZSwgdHJlZUFmdGVyQ2FsbClcbiAgICAgICAgICAgICAgICAgICAgICAgIDogKGRpcnR5QmVmb3JlICE9PSBudWxsICYmIGRpcnR5QWZ0ZXJDYWxsICE9PSBudWxsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXJ0eUJlZm9yZSAhPT0gZGlydHlBZnRlckNhbGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGRpcnR5QWZ0ZXJDYWxsID09PSB0cnVlID8gdHJ1ZSA6IG51bGwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCByb2xsYmFja0FwcGxpZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJvbGxiYWNrTWV0aG9kOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJvbGxiYWNrVmVyaWZpZWQ6IGJvb2xlYW4gfCBudWxsID0gcm9sbGJhY2tSZXF1ZXN0ZWQgPyBmYWxzZSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvbGxiYWNrRXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGlydHlBZnRlclJvbGxiYWNrOiBib29sZWFuIHwgbnVsbCA9IGRpcnR5QWZ0ZXJDYWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgdHJlZUFmdGVyUm9sbGJhY2s6IFNjZW5lVHJlZVNuYXBzaG90IHwgbnVsbCA9IHRyZWVBZnRlckNhbGw7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJvbGxiYWNrUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJlZUJlZm9yZSAmJiB0cmVlQWZ0ZXJDYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWRkZWRSb290cyA9IGZpbmRBZGRlZFJvb3ROb2RlVXVpZHModHJlZUJlZm9yZSwgdHJlZUFmdGVyQ2FsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFkZGVkUm9vdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb2xsYmFja01ldGhvZCA9ICdyZW1vdmUtbm9kZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdXVpZCBvZiBhZGRlZFJvb3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7IHV1aWQgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9sbGJhY2tFcnJvcnMucHVzaChgcmVtb3ZlLW5vZGUoJHt1dWlkfSkg5aSx6LSlOiAke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyb2xsYmFja01ldGhvZCB8fCByb2xsYmFja0Vycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzb2Z0LXJlbG9hZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb2xsYmFja01ldGhvZCA9ICdzb2Z0LXJlbG9hZCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb2xsYmFja0Vycm9ycy5wdXNoKGBzb2Z0LXJlbG9hZCDlpLHotKU6ICR7bm9ybWFsaXplRXJyb3IoZXJyb3IpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGlydHlBZnRlclJvbGxiYWNrID0gYXdhaXQgcXVlcnlTY2VuZURpcnR5U2FmZShyZXF1ZXN0ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJlZUFmdGVyUm9sbGJhY2sgPSBhd2FpdCBxdWVyeVNjZW5lVHJlZVNuYXBzaG90U2FmZShyZXF1ZXN0ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJlZUJlZm9yZSAmJiB0cmVlQWZ0ZXJSb2xsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvbGxiYWNrVmVyaWZpZWQgPSBhcmVTbmFwc2hvdHNFcXVhbCh0cmVlQmVmb3JlLCB0cmVlQWZ0ZXJSb2xsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRpcnR5QWZ0ZXJSb2xsYmFjayAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvbGxiYWNrVmVyaWZpZWQgPSBkaXJ0eUFmdGVyUm9sbGJhY2sgPT09IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb2xsYmFja1ZlcmlmaWVkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJvbGxiYWNrVmVyaWZpZWQgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXRhaWxQYXJ0cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9sbGJhY2tNZXRob2QgPyBgcm9sbGJhY2tNZXRob2Q9JHtyb2xsYmFja01ldGhvZH1gIDogJ3JvbGxiYWNrTWV0aG9kPW5vbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgcm9sbGJhY2tWZXJpZmllZD0ke3JvbGxiYWNrVmVyaWZpZWQgPT09IG51bGwgPyAndW5rbm93bicgOiBTdHJpbmcocm9sbGJhY2tWZXJpZmllZCl9YFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJvbGxiYWNrRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsUGFydHMucHVzaChgZXJyb3JzPSR7cm9sbGJhY2tFcnJvcnMuam9pbignOyAnKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRyZWVCZWZvcmUgJiYgdHJlZUFmdGVyUm9sbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsUGFydHMucHVzaChgdHJlZUJlZm9yZT0ke3RyZWVCZWZvcmUudXVpZHMuc2l6ZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsUGFydHMucHVzaChgdHJlZUFmdGVyUm9sbGJhY2s9JHt0cmVlQWZ0ZXJSb2xsYmFjay51dWlkcy5zaXplfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ+aJp+ihjOe7hOS7tuaWueazleaIkOWKn++8jOS9huWbnua7mumqjOivgeWksei0pScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbFBhcnRzLmpvaW4oJyB8ICcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRV9SVU5USU1FX1JPTExCQUNLX0ZBSUxFRCdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcm9sbGJhY2tBcHBsaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXF1aXJlc1NhdmUgPSByb2xsYmFja1JlcXVlc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgPyAoZGlydHlBZnRlclJvbGxiYWNrID09PSB0cnVlIHx8IHJvbGxiYWNrVmVyaWZpZWQgPT09IGZhbHNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBkaXJ0eUFmdGVyQ2FsbCA9PT0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhlY3V0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IG1ldGhvZEFyZ3MsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xsYmFja1JlcXVlc3RlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGxiYWNrQXBwbGllZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGxiYWNrTWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm9sbGJhY2tWZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGxiYWNrRXJyb3JzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlydHlCZWZvcmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJ0eUFmdGVyQ2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcnR5QWZ0ZXJSb2xsYmFjayxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lTXV0YXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVzU2F2ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmiafooYznu4Tku7bmlrnms5XlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9tb3ZlX2FycmF5X2VsZW1lbnQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnp7vliqjnu4Tku7bmlbDnu4TlsZ7mgKflhYPntKDkvY3nva4nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflr7nosaEgVVVJRO+8iOiKgueCueaIlue7hOS7tu+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmlbDnu4TlsZ7mgKfot6/lvoQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICfnm67moIfntKLlvJUnIH0sXG4gICAgICAgICAgICAgICAgICAgIG9mZnNldDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICflgY/np7vph48nIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3V1aWQnLCAncGF0aCcsICd0YXJnZXQnLCAnb2Zmc2V0J11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5tb3ZlLWFycmF5LWVsZW1lbnQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghdXVpZCB8fCAhcGF0aCB8fCAhTnVtYmVyLmlzSW50ZWdlcihhcmdzPy50YXJnZXQpIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKGFyZ3M/Lm9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWQvcGF0aC90YXJnZXQvb2Zmc2V0IOW/heWhq+S4lCB0YXJnZXQvb2Zmc2V0IOW/hemhu+S4uuaVtOaVsCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vdmVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdtb3ZlLWFycmF5LWVsZW1lbnQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogYXJncy50YXJnZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IGFyZ3Mub2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgbW92ZWQ6IG1vdmVkID09PSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IGFyZ3MudGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0OiBhcmdzLm9mZnNldFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfnp7vliqjmlbDnu4TlhYPntKDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9yZW1vdmVfYXJyYXlfZWxlbWVudCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WIoOmZpOe7hOS7tuaVsOe7hOWxnuaAp+WFg+e0oCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnY29tcG9uZW50JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+WvueixoSBVVUlE77yI6IqC54K55oiW57uE5Lu277yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+aVsOe7hOWxnuaAp+i3r+W+hCcgfSxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAn5pWw57uE57Si5byVJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1dWlkJywgJ3BhdGgnLCAnaW5kZXgnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnJlbW92ZS1hcnJheS1lbGVtZW50J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51dWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoIXV1aWQgfHwgIXBhdGggfHwgIU51bWJlci5pc0ludGVnZXIoYXJncz8uaW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1dWlkL3BhdGgvaW5kZXgg5b+F5aGr5LiUIGluZGV4IOW/hemhu+S4uuaVtOaVsCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZWQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3JlbW92ZS1hcnJheS1lbGVtZW50Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogYXJncy5pbmRleFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQgPT09IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBhcmdzLmluZGV4XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIoOmZpOaVsOe7hOWFg+e0oOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3Jlc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN572u5bGe5oCn5Yiw6buY6K6k5YC877yIc2NlbmUucmVzZXQtcHJvcGVydHnvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflr7nosaEgVVVJRO+8iOiKgueCueaIlue7hOS7tu+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflsZ7mgKfot6/lvoQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6YCP5Lyg57uZIGR1bXAudmFsdWUnIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlVHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIxkdW1wLnR5cGUnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlY29yZDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm6K6w5b2VIHVuZG8nIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3V1aWQnLCAncGF0aCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzZXQtcHJvcGVydHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghdXVpZCB8fCAhcGF0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXVpZC9wYXRoIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYXJncyB8fCB7fSwgJ3ZhbHVlJykgPyBhcmdzLnZhbHVlIDogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWVUeXBlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy52YWx1ZVR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZHVtcC50eXBlID0gdmFsdWVUeXBlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGR1bXBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncz8ucmVjb3JkID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5yZWNvcmQgPSBhcmdzLnJlY29yZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNldCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVzZXQtcHJvcGVydHknLCBwYXlsb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2V0OiByZXNldCA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHVtcFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfph43nva7lsZ7mgKflpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=