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
    return (0, common_1.readDumpString)(prefab === null || prefab === void 0 ? void 0 : prefab.assetUuid) || null;
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
async function applyPrefabToNode(requester, nodeUuid, prefabUuid) {
    const payload = prefabUuid
        ? { node: nodeUuid, prefab: prefabUuid }
        : { uuid: nodeUuid };
    try {
        await requester('scene', 'apply-prefab', payload);
        return { method: 'apply-prefab' };
    }
    catch (primaryError) {
        try {
            await requester('scene', 'apply-prefab-link', payload);
            return { method: 'apply-prefab-link' };
        }
        catch (fallbackError) {
            const detail = `${(0, common_1.normalizeError)(primaryError)}; fallback failed: ${(0, common_1.normalizeError)(fallbackError)}`;
            throw new Error(detail);
        }
    }
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
            requiredCapabilities: ['scene.create-node'],
            run: async (args) => {
                const options = normalizePrefabCreateOptions(args);
                if (!options.assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const nodeUuid = await requester('scene', 'create-node', options);
                    return (0, common_1.ok)({
                        created: true,
                        nodeUuid,
                        options
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('创建 Prefab 实例失败', (0, common_1.normalizeError)(error));
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
                    const node = await requester('scene', 'query-node', nodeUuid);
                    const prefab = (node === null || node === void 0 ? void 0 : node.prefab) || null;
                    const prefabAssetUuid = readPrefabAssetUuid(prefab);
                    const prefabState = readPrefabState(prefab);
                    const isPrefabInstance = Boolean(prefabAssetUuid) || (typeof prefabState === 'number' && prefabState > 0);
                    return (0, common_1.ok)({
                        nodeUuid,
                        nodeName: readNodeName(node),
                        isPrefabInstance,
                        prefabState,
                        prefabAssetUuid,
                        prefab
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询 Prefab 实例信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'prefab_apply_instance',
            description: '将节点应用/关联到指定 Prefab（实验能力）',
            layer: 'experimental',
            category: 'prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    prefabUuid: { type: 'string', description: '可选，目标 Prefab 资源 UUID；不传则按节点当前关联处理' }
                },
                required: ['nodeUuid']
            },
            requiredCapabilities: ['scene.apply-prefab'],
            run: async (args) => {
                const nodeUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.nodeUuid);
                const prefabUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.prefabUuid);
                if (!nodeUuid) {
                    return (0, common_1.fail)('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const applied = await applyPrefabToNode(requester, nodeUuid, prefabUuid);
                    return (0, common_1.ok)({
                        applied: true,
                        nodeUuid,
                        prefabUuid,
                        method: applied.method
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
                    targetPrefabUuid: { type: 'string', description: '可选，批量应用时的目标 Prefab UUID；默认使用 assetUuid' }
                },
                required: ['assetUuid']
            },
            requiredCapabilities: ['scene.query-nodes-by-asset-uuid', 'scene.apply-prefab'],
            run: async (args) => {
                const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
                const targetPrefabUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.targetPrefabUuid) || assetUuid;
                if (!assetUuid) {
                    return (0, common_1.fail)('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const applied = [];
                    const failed = [];
                    for (const nodeUuid of nodeUuids) {
                        try {
                            const result = await applyPrefabToNode(requester, nodeUuid, targetPrefabUuid);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmFiLWxpZmVjeWNsZS10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL3ByZWZhYi1saWZlY3ljbGUtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUE4RUEsZ0VBaVZDO0FBOVpELHFDQUFvRztBQUVwRyxTQUFTLFdBQVcsQ0FBQyxLQUFVO0lBQzNCLElBQUksS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksS0FBSyxFQUFFLENBQUM7UUFDekQsT0FBUSxLQUF3QixDQUFDLEtBQUssQ0FBQztJQUMzQyxDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDakIsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLElBQVM7SUFDM0IsT0FBTyxJQUFBLHVCQUFjLEVBQUMsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztBQUM5QyxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsTUFBVztJQUNoQyxNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sT0FBTyxHQUFHLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNoRCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxNQUFXO0lBQ3BDLE9BQU8sSUFBQSx1QkFBYyxFQUFDLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUM7QUFDckQsQ0FBQztBQUVELFNBQVMsNEJBQTRCLENBQUMsSUFBUztJQUMzQyxNQUFNLE9BQU8sR0FBd0IsRUFBRSxDQUFDO0lBQ3hDLE1BQU0sU0FBUyxHQUFHLElBQUEseUJBQWdCLEVBQUMsSUFBSSxhQUFKLElBQUksdUJBQUos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LENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHJlYWREdW1wU3RyaW5nLCB0b05vbkVtcHR5U3RyaW5nLCB0b1N0cmluZ0xpc3QgfSBmcm9tICcuL2NvbW1vbic7XG5cbmZ1bmN0aW9uIHVud3JhcFZhbHVlKHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuICh2YWx1ZSBhcyB7IHZhbHVlOiBhbnkgfSkudmFsdWU7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gcmVhZE5vZGVOYW1lKG5vZGU6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIHJldHVybiByZWFkRHVtcFN0cmluZyhub2RlPy5uYW1lKSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiByZWFkUHJlZmFiU3RhdGUocHJlZmFiOiBhbnkpOiBudW1iZXIgfCBudWxsIHtcbiAgICBjb25zdCByYXcgPSB1bndyYXBWYWx1ZShwcmVmYWI/LnN0YXRlKTtcbiAgICByZXR1cm4gdHlwZW9mIHJhdyA9PT0gJ251bWJlcicgPyByYXcgOiBudWxsO1xufVxuXG5mdW5jdGlvbiByZWFkUHJlZmFiQXNzZXRVdWlkKHByZWZhYjogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHJlYWREdW1wU3RyaW5nKHByZWZhYj8uYXNzZXRVdWlkKSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQcmVmYWJDcmVhdGVPcHRpb25zKGFyZ3M6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGNvbnN0IG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICBjb25zdCBhc3NldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmFzc2V0VXVpZCk7XG4gICAgaWYgKGFzc2V0VXVpZCkge1xuICAgICAgICBvcHRpb25zLmFzc2V0VXVpZCA9IGFzc2V0VXVpZDtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJlbnRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wYXJlbnRVdWlkKTtcbiAgICBpZiAocGFyZW50VXVpZCkge1xuICAgICAgICBvcHRpb25zLnBhcmVudCA9IHBhcmVudFV1aWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbmFtZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubmFtZSk7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lID0gbmFtZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZ3M/LmtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIG9wdGlvbnMua2VlcFdvcmxkVHJhbnNmb3JtID0gYXJncy5rZWVwV29ybGRUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzPy51bmxpbmtQcmVmYWIgPT09ICdib29sZWFuJykge1xuICAgICAgICBvcHRpb25zLnVubGlua1ByZWZhYiA9IGFyZ3MudW5saW5rUHJlZmFiO1xuICAgIH1cblxuICAgIGlmIChhcmdzPy5wb3NpdGlvbiAmJiB0eXBlb2YgYXJncy5wb3NpdGlvbiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0aW9ucy5wb3NpdGlvbiA9IGFyZ3MucG9zaXRpb247XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJlZmFiVG9Ob2RlKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJlZmFiVXVpZDogc3RyaW5nIHwgbnVsbFxuKTogUHJvbWlzZTx7IG1ldGhvZDogc3RyaW5nIH0+IHtcbiAgICBjb25zdCBwYXlsb2FkID0gcHJlZmFiVXVpZFxuICAgICAgICA/IHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiVXVpZCB9XG4gICAgICAgIDogeyB1dWlkOiBub2RlVXVpZCB9O1xuXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdhcHBseS1wcmVmYWInLCBwYXlsb2FkKTtcbiAgICAgICAgcmV0dXJuIHsgbWV0aG9kOiAnYXBwbHktcHJlZmFiJyB9O1xuICAgIH0gY2F0Y2ggKHByaW1hcnlFcnJvcjogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYi1saW5rJywgcGF5bG9hZCk7XG4gICAgICAgICAgICByZXR1cm4geyBtZXRob2Q6ICdhcHBseS1wcmVmYWItbGluaycgfTtcbiAgICAgICAgfSBjYXRjaCAoZmFsbGJhY2tFcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zdCBkZXRhaWwgPSBgJHtub3JtYWxpemVFcnJvcihwcmltYXJ5RXJyb3IpfTsgZmFsbGJhY2sgZmFpbGVkOiAke25vcm1hbGl6ZUVycm9yKGZhbGxiYWNrRXJyb3IpfWA7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZGV0YWlsKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByZWZhYkxpZmVjeWNsZVRvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfY3JlYXRlX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Z+65LqOIFByZWZhYiDotYTmupAgVVVJRCDliJvlu7rlrp7kvovoioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1ByZWZhYiDotYTmupAgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzniLboioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzlrp7kvovoioLngrnlkI3np7AnIH0sXG4gICAgICAgICAgICAgICAgICAgIHVubGlua1ByZWZhYjogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5Yib5bu65ZCO5piv5ZCm6Kej6ZmkIFByZWZhYiDlhbPogZQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm5L+d5oyB5LiW55WM5Y+Y5o2iJyB9LFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWunuS+i+WIneWni+S9jee9ricsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5jcmVhdGUtbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZVByZWZhYkNyZWF0ZU9wdGlvbnMoYXJncyk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLmFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnYXNzZXRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjcmVhdGUtbm9kZScsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfliJvlu7ogUHJlZmFiIOWunuS+i+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3F1ZXJ5X25vZGVzX2J5X2Fzc2V0X3V1aWQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlvJXnlKjmjIflrpogUHJlZmFiIOi1hOa6kOeahOiKgueCuSBVVUlEIOWIl+ihqCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUHJlZmFiIOi1hOa6kCBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnYXNzZXRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWRzID0gQXJyYXkuaXNBcnJheSh1dWlkcykgPyB1dWlkcyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IG5vZGVVdWlkcy5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIFByZWZhYiDlrp7kvovoioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9nZXRfaW5zdGFuY2VfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMieiKgueCuSBVVUlEIOafpeivoiBQcmVmYWIg5a6e5L6L5L+h5oGvJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmYWIgPSBub2RlPy5wcmVmYWIgfHwgbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZmFiQXNzZXRVdWlkID0gcmVhZFByZWZhYkFzc2V0VXVpZChwcmVmYWIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmYWJTdGF0ZSA9IHJlYWRQcmVmYWJTdGF0ZShwcmVmYWIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1ByZWZhYkluc3RhbmNlID0gQm9vbGVhbihwcmVmYWJBc3NldFV1aWQpIHx8ICh0eXBlb2YgcHJlZmFiU3RhdGUgPT09ICdudW1iZXInICYmIHByZWZhYlN0YXRlID4gMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVOYW1lOiByZWFkTm9kZU5hbWUobm9kZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1ByZWZhYkluc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiU3RhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIFByZWZhYiDlrp7kvovkv6Hmga/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9hcHBseV9pbnN0YW5jZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WwhuiKgueCueW6lOeUqC/lhbPogZTliLDmjIflrpogUHJlZmFi77yI5a6e6aqM6IO95Yqb77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXhwZXJpbWVudGFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnm67moIfoioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIznm67moIcgUHJlZmFiIOi1hOa6kCBVVUlE77yb5LiN5Lyg5YiZ5oyJ6IqC54K55b2T5YmN5YWz6IGU5aSE55CGJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydub2RlVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuYXBwbHktcHJlZmFiJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZhYlV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQgPSBhd2FpdCBhcHBseVByZWZhYlRvTm9kZShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBwcmVmYWJVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcGxpZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGFwcGxpZWQubWV0aG9kXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+W6lOeUqCBQcmVmYWIg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2VzX2J5X2Fzc2V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJIFByZWZhYiDotYTmupAgVVVJRCDmibnph4/lupTnlKjlrp7kvovvvIjlrp7pqozog73lipvvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHBlcmltZW50YWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnlKjkuo7nrZvpgInlrp7kvovoioLngrnnmoQgUHJlZmFiIOi1hOa6kCBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRQcmVmYWJVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaJuemHj+W6lOeUqOaXtueahOebruaghyBQcmVmYWIgVVVJRO+8m+m7mOiupOS9v+eUqCBhc3NldFV1aWQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsICdzY2VuZS5hcHBseS1wcmVmYWInXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQcmVmYWJVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YXJnZXRQcmVmYWJVdWlkKSB8fCBhc3NldFV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Fzc2V0VXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsIGFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkcyA9IEFycmF5LmlzQXJyYXkodXVpZHMpID8gdXVpZHMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwbGllZDogQXJyYXk8eyBub2RlVXVpZDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZyB9PiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQ6IEFycmF5PHsgbm9kZVV1aWQ6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZVV1aWQgb2Ygbm9kZVV1aWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwcGx5UHJlZmFiVG9Ob2RlKHJlcXVlc3Rlciwgbm9kZVV1aWQsIHRhcmdldFByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcGxpZWQucHVzaCh7IG5vZGVVdWlkLCBtZXRob2Q6IHJlc3VsdC5tZXRob2QgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLnB1c2goeyBub2RlVXVpZCwgZXJyb3I6IG5vcm1hbGl6ZUVycm9yKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRQcmVmYWJVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkOiBub2RlVXVpZHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGllZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudDogYXBwbGllZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWlsdXJlQ291bnQ6IGZhaWxlZC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5om56YeP5bqU55SoIFByZWZhYiDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXN0b3JlX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6L+Y5Y6f5oyH5a6aIFByZWZhYiDlrp7kvovoioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3ByZWZhYicsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6ZyA6KaB6L+Y5Y6f55qE6IqC54K5IFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZXN0b3JlLXByZWZhYiddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgeyB1dWlkOiBub2RlVXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgcmVzdG9yZWQ6IHRydWUsIG5vZGVVdWlkIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+i/mOWOnyBQcmVmYWIg5a6e5L6L5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZXNfYnlfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmjIkgUHJlZmFiIOi1hOa6kCBVVUlEIOaJuemHj+i/mOWOn+WunuS+i+iKgueCuScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJlZmFiJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUHJlZmFiIOi1hOa6kCBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCAnc2NlbmUucmVzdG9yZS1wcmVmYWInXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnYXNzZXRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJywgYXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWRzID0gQXJyYXkuaXNBcnJheSh1dWlkcykgPyB1dWlkcyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN0b3JlZDogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFpbGVkOiBBcnJheTx7IG5vZGVVdWlkOiBzdHJpbmc7IGVycm9yOiBzdHJpbmcgfT4gPSBbXTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG5vZGVVdWlkIG9mIG5vZGVVdWlkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgeyB1dWlkOiBub2RlVXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN0b3JlZC5wdXNoKG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWQucHVzaCh7IG5vZGVVdWlkLCBlcnJvcjogbm9ybWFsaXplRXJyb3IoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZDogbm9kZVV1aWRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3RvcmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50OiByZXN0b3JlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWlsdXJlQ291bnQ6IGZhaWxlZC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5om56YeP6L+Y5Y6fIFByZWZhYiDlrp7kvovlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXNldF9ub2RlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN572u6IqC54K55Yiw6buY6K6k54q25oCBJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWRzJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZXNldC1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZHMgPSB0b1N0cmluZ0xpc3QoYXJncz8ubm9kZVV1aWRzKTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZVV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWRzIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVzZXQtbm9kZScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkcy5sZW5ndGggPT09IDEgPyBub2RlVXVpZHNbMF0gOiBub2RlVXVpZHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHJlc2V0OiB0cnVlLCBub2RlVXVpZHMgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6YeN572u6IqC54K55aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzZXRfY29tcG9uZW50JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN572u57uE5Lu25Yiw6buY6K6k54q25oCBJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcmVmYWInLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu2IFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2NvbXBvbmVudFV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnJlc2V0LWNvbXBvbmVudCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdjb21wb25lbnRVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVzZXQtY29tcG9uZW50JywgeyB1dWlkOiBjb21wb25lbnRVdWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZXNldDogdHJ1ZSwgY29tcG9uZW50VXVpZCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfph43nva7nu4Tku7blpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=