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
                    const components = await queryNodeComponents(requester, nodeUuid);
                    const componentIndex = resolveComponentIndex(components, args);
                    if (componentIndex < 0) {
                        return (0, common_1.fail)('无法定位目标组件，请提供有效的 componentIndex/componentUuid/componentType', undefined, 'E_COMPONENT_NOT_FOUND');
                    }
                    const path = buildPropertyPath(componentIndex, propertyPath);
                    const dump = { value: args === null || args === void 0 ? void 0 : args.value };
                    const valueType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.valueType);
                    if (valueType) {
                        dump.type = valueType;
                    }
                    const requestPayload = {
                        uuid: nodeUuid,
                        path,
                        dump
                    };
                    if (typeof (args === null || args === void 0 ? void 0 : args.record) === 'boolean') {
                        requestPayload.record = args.record;
                    }
                    const updated = await requester('scene', 'set-property', requestPayload);
                    return (0, common_1.ok)({
                        updated: updated === true,
                        nodeUuid,
                        componentIndex,
                        path,
                        dump
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
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXByb3BlcnR5LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvY29tcG9uZW50LXByb3BlcnR5LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBcUZBLG9FQWdOQztBQXBTRCxxQ0FBc0Y7QUFTdEYsU0FBUyxzQkFBc0IsQ0FBQyxHQUFRO0lBQ3BDLE1BQU0sVUFBVSxHQUFHO1FBQ2YsSUFBQSx1QkFBYyxFQUFDLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxRQUFRLENBQUM7UUFDN0IsSUFBQSx1QkFBYyxFQUFDLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxHQUFHLENBQUM7UUFDeEIsSUFBQSx1QkFBYyxFQUFDLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxJQUFJLENBQUM7UUFDekIsSUFBQSx1QkFBYyxFQUFDLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxJQUFJLENBQUM7S0FDNUIsQ0FBQztJQUNGLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pELE9BQU8sT0FBTyxJQUFJLFNBQVMsQ0FBQztBQUNoQyxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxHQUFROztJQUNwQyxNQUFNLFVBQVUsR0FBRztRQUNmLElBQUEsdUJBQWMsRUFBQyxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsSUFBSSxDQUFDO1FBQ3pCLElBQUEsdUJBQWMsRUFBQyxNQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxLQUFLLDBDQUFFLElBQUksQ0FBQztLQUNuQyxDQUFDO0lBQ0YsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMs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QUksRUFBRTtnQkFDWixJQUFJLENBQUM7b0JBQ0QsTUFBTSxVQUFVLEdBQUcsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLGtCQUFrQixDQUFDLENBQUM7b0JBQ2hFLE9BQU8sSUFBQSxXQUFFLEVBQUM7d0JBQ04sVUFBVTt3QkFDVixLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztxQkFDM0QsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyxZQUFZLEVBQUUsSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELENBQUM7WUFDTCxDQUFDO1NBQ0o7S0FDSixDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgcmVhZER1bXBTdHJpbmcsIHRvTm9uRW1wdHlTdHJpbmcgfSBmcm9tICcuL2NvbW1vbic7XG5cbmludGVyZmFjZSBOb3JtYWxpemVkQ29tcG9uZW50IHtcbiAgICBpbmRleDogbnVtYmVyO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIHV1aWQ/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbXBvbmVudFR5cGUocmF3OiBhbnkpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8uX190eXBlX18pLFxuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/LmNpZCksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8udHlwZSksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8ubmFtZSlcbiAgICBdO1xuICAgIGNvbnN0IG1hdGNoZWQgPSBjYW5kaWRhdGVzLmZpbmQoKGl0ZW0pID0+IEJvb2xlYW4oaXRlbSkpO1xuICAgIHJldHVybiBtYXRjaGVkIHx8ICdVbmtub3duJztcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29tcG9uZW50VXVpZChyYXc6IGFueSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py51dWlkKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py52YWx1ZT8udXVpZClcbiAgICBdO1xuICAgIGNvbnN0IG1hdGNoZWQgPSBjYW5kaWRhdGVzLmZpbmQoKGl0ZW0pID0+IEJvb2xlYW4oaXRlbSkpO1xuICAgIHJldHVybiBtYXRjaGVkIHx8IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29tcG9uZW50TmFtZShyYXc6IGFueSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py5uYW1lKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py52YWx1ZT8ubmFtZSlcbiAgICBdO1xuICAgIGNvbnN0IG1hdGNoZWQgPSBjYW5kaWRhdGVzLmZpbmQoKGl0ZW0pID0+IEJvb2xlYW4oaXRlbSkpO1xuICAgIHJldHVybiBtYXRjaGVkIHx8IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdE5vZGVDb21wb25lbnRzKG5vZGU6IGFueSk6IE5vcm1hbGl6ZWRDb21wb25lbnRbXSB7XG4gICAgY29uc3QgcmF3Q29tcG9uZW50cyA9IEFycmF5LmlzQXJyYXkobm9kZT8uX19jb21wc19fKSA/IG5vZGUuX19jb21wc19fIDogW107XG4gICAgcmV0dXJuIHJhd0NvbXBvbmVudHMubWFwKChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+ICh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICB0eXBlOiBub3JtYWxpemVDb21wb25lbnRUeXBlKGl0ZW0pLFxuICAgICAgICBuYW1lOiBub3JtYWxpemVDb21wb25lbnROYW1lKGl0ZW0pLFxuICAgICAgICB1dWlkOiBub3JtYWxpemVDb21wb25lbnRVdWlkKGl0ZW0pXG4gICAgfSkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBxdWVyeU5vZGVDb21wb25lbnRzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLCBub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxOb3JtYWxpemVkQ29tcG9uZW50W10+IHtcbiAgICBjb25zdCBub2RlID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgIHJldHVybiBleHRyYWN0Tm9kZUNvbXBvbmVudHMobm9kZSk7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVDb21wb25lbnRJbmRleChjb21wb25lbnRzOiBOb3JtYWxpemVkQ29tcG9uZW50W10sIGFyZ3M6IGFueSk6IG51bWJlciB7XG4gICAgaWYgKHR5cGVvZiBhcmdzPy5jb21wb25lbnRJbmRleCA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzSW50ZWdlcihhcmdzLmNvbXBvbmVudEluZGV4KSAmJiBhcmdzLmNvbXBvbmVudEluZGV4ID49IDApIHtcbiAgICAgICAgcmV0dXJuIGFyZ3MuY29tcG9uZW50SW5kZXg7XG4gICAgfVxuXG4gICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VXVpZCk7XG4gICAgaWYgKGNvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgY29uc3QgaGl0QnlVdWlkID0gY29tcG9uZW50cy5maW5kKChpdGVtKSA9PiBpdGVtLnV1aWQgPT09IGNvbXBvbmVudFV1aWQpO1xuICAgICAgICBpZiAoaGl0QnlVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gaGl0QnlVdWlkLmluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tcG9uZW50VHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgaGl0QnlUeXBlID0gY29tcG9uZW50cy5maW5kKChpdGVtKSA9PiBpdGVtLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICBpZiAoaGl0QnlUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gaGl0QnlUeXBlLmluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xufVxuXG5mdW5jdGlvbiBidWlsZFByb3BlcnR5UGF0aChjb21wb25lbnRJbmRleDogbnVtYmVyLCBwcm9wZXJ0eVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHByb3BlcnR5UGF0aC5zdGFydHNXaXRoKCdfX2NvbXBzX18uJykpIHtcbiAgICAgICAgcmV0dXJuIHByb3BlcnR5UGF0aDtcbiAgICB9XG4gICAgcmV0dXJuIGBfX2NvbXBzX18uJHtjb21wb25lbnRJbmRleH0uJHtwcm9wZXJ0eVBhdGh9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9saXN0X29uX25vZGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LoioLngrnkuIrnmoTnu4Tku7bliJfooagnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBhd2FpdCBxdWVyeU5vZGVDb21wb25lbnRzKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGNvbXBvbmVudHMubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoue7hOS7tuWIl+ihqOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2FkZF9jb21wb25lbnQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflkJHoioLngrnmt7vliqDnu4Tku7YnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu257G75Z6L77yM5L6L5aaCIGNjLlNwcml0ZScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnLCAnY29tcG9uZW50VHlwZSddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuY3JlYXRlLWNvbXBvbmVudCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZC9jb21wb25lbnRUeXBlIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5re75Yqg57uE5Lu25aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfcmVtb3ZlX2NvbXBvbmVudCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S7juiKgueCueenu+mZpOe7hOS7tu+8iOS8mOWFiOaMiSBjb21wb25lbnRVdWlk77yM5qyh6YCJIGNvbXBvbmVudFR5cGXvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu2IFVVSUTvvIjmjqjojZDvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu257G75Z6L77yI55So5LqO5p+l5om+IFVVSUTvvIknIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZW1vdmUtY29tcG9uZW50JywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnRVdWlkICYmICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdjb21wb25lbnRVdWlkIOaIliBjb21wb25lbnRUeXBlIOiHs+WwkeaPkOS+m+S4gOS4qicsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBmaW5hbENvbXBvbmVudFV1aWQgPSBjb21wb25lbnRVdWlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZpbmFsQ29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gY29tcG9uZW50cy5maW5kKChpdGVtKSA9PiBpdGVtLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoYOacquaJvuWIsOe7hOS7tjogJHtjb21wb25lbnRUeXBlfWAsIHVuZGVmaW5lZCwgJ0VfQ09NUE9ORU5UX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaGVkLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbChg57uE5Lu257y65bCRIFVVSUQ6ICR7Y29tcG9uZW50VHlwZX1gLCB1bmRlZmluZWQsICdFX0NPTVBPTkVOVF9VVUlEX01JU1NJTkcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmFsQ29tcG9uZW50VXVpZCA9IG1hdGNoZWQudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVtb3ZlLWNvbXBvbmVudCcsIHsgdXVpZDogZmluYWxDb21wb25lbnRVdWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogZmluYWxDb21wb25lbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogY29tcG9uZW50VHlwZSB8fCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn56e76Zmk57uE5Lu25aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u6IqC54K557uE5Lu25bGe5oCn77yI5pSv5oyBIHR5cGUvdmFsdWUg5b2i5byP77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRJbmRleDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICfnu4Tku7bntKLlvJXvvIjkuI4gY29tcG9uZW50VXVpZC9jb21wb25lbnRUeXBlIOS6jOmAieS4gO+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7YgVVVJRO+8iOaOqOiNkO+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7bnsbvlnovvvIjkvovlpoIgY2MuTGFiZWzvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7blsZ7mgKfot6/lvoTvvIzkvovvvJpzdHJpbmcg5oiWIGNvbG9yLnInIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAn6KaB5YaZ5YWl55qE5bGe5oCn5YC8JyB9LFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZVR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5bGe5oCn5YC857G75Z6L77yM5L6L77yaY2MuQ29sb3IvY2MuVmVjMycgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVjb3JkOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzmmK/lkKborrDlvZUgdW5kbycgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnLCAncHJvcGVydHlQYXRoJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5zZXQtcHJvcGVydHknLCAnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByb3BlcnR5UGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhcHJvcGVydHlQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZC9wcm9wZXJ0eVBhdGgg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVzb2x2ZUNvbXBvbmVudEluZGV4KGNvbXBvbmVudHMsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50SW5kZXggPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5peg5rOV5a6a5L2N55uu5qCH57uE5Lu277yM6K+35o+Q5L6b5pyJ5pWI55qEIGNvbXBvbmVudEluZGV4L2NvbXBvbmVudFV1aWQvY29tcG9uZW50VHlwZScsIHVuZGVmaW5lZCwgJ0VfQ09NUE9ORU5UX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IGJ1aWxkUHJvcGVydHlQYXRoKGNvbXBvbmVudEluZGV4LCBwcm9wZXJ0eVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkdW1wOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0geyB2YWx1ZTogYXJncz8udmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWVUeXBlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy52YWx1ZVR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wLnR5cGUgPSB2YWx1ZVR5cGU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0UGF5bG9hZDogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzPy5yZWNvcmQgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFBheWxvYWQucmVjb3JkID0gYXJncy5yZWNvcmQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtcHJvcGVydHknLCByZXF1ZXN0UGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkOiB1cGRhdGVkID09PSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iuvue9rue7hOS7tuWxnuaAp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2xpc3RfYXZhaWxhYmxlX3R5cGVzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5Zmo5Y+v5re75Yqg57uE5Lu257G75Z6LJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudHMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudHMnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogQXJyYXkuaXNBcnJheShjb21wb25lbnRzKSA/IGNvbXBvbmVudHMubGVuZ3RoIDogMFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Llj6/nlKjnu4Tku7bnsbvlnovlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=