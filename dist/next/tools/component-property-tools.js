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
                try {
                    const result = await requester('scene', 'execute-component-method', {
                        uuid: componentUuid,
                        name: methodName,
                        args: methodArgs
                    });
                    return (0, common_1.ok)({
                        executed: true,
                        componentUuid,
                        methodName,
                        args: methodArgs,
                        result
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXByb3BlcnR5LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvY29tcG9uZW50LXByb3BlcnR5LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBcUZBLG9FQStkQztBQW5qQkQscUNBQXNGO0FBU3RGLFNBQVMsc0JBQXNCLENBQUMsR0FBUTtJQUNwQyxNQUFNLFVBQVUsR0FBRztRQUNmLElBQUEsdUJBQWMsRUFBQyxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsUUFBUSxDQUFDO1FBQzdCLElBQUEsdUJBQWMsRUFBQyxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsR0FBRyxDQUFDO1FBQ3hCLElBQUEsdUJBQWMsRUFBQyxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsSUFBSSxDQUFDO1FBQ3pCLElBQUEsdUJBQWMsRUFBQyxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsSUFBSSxDQUFDO0tBQzVCLENBQUM7SUFDRixNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6RCxPQUFPLE9BQU8sSUFBSSxTQUFTLENBQUM7QUFDaEMsQ0FBQztBQUVELFNBQVMsc0JBQXNCLENBQUMsR0FBUTs7SUFDcEMsTUFBTSxVQUFVLEdBQUc7UUFDZixJQUFBLHVCQUFjLEVBQUMsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLElBQUksQ0FBQztRQUN6QixJQUFBLHVCQUFjLEVBQUMsTUFBQSxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsS0FBSywwQ0FBRSxJQUFJLENBQUM7S0FDbkMsQ0FBQztJQUNGLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFD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QVMsQ0FBQyxDQUFDO2dCQUNwRCxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNaLElBQUksQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDO2dCQUMxQixDQUFDO2dCQUVELE1BQU0sT0FBTyxHQUF3QjtvQkFDakMsSUFBSTtvQkFDSixJQUFJO29CQUNKLElBQUk7aUJBQ1AsQ0FBQztnQkFDRixJQUFJLE9BQU8sQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsTUFBTSxDQUFBLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3BDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDakMsQ0FBQztnQkFFRCxJQUFJLENBQUM7b0JBQ0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUNsRSxPQUFPLElBQUEsV0FBRSxFQUFDO3dCQUNOLEtBQUssRUFBRSxLQUFLLEtBQUssSUFBSTt3QkFDckIsSUFBSTt3QkFDSixJQUFJO3dCQUNKLElBQUk7cUJBQ1AsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyxRQUFRLEVBQUUsSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2pELENBQUM7WUFDTCxDQUFDO1NBQ0o7S0FDSixDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgcmVhZER1bXBTdHJpbmcsIHRvTm9uRW1wdHlTdHJpbmcgfSBmcm9tICcuL2NvbW1vbic7XG5cbmludGVyZmFjZSBOb3JtYWxpemVkQ29tcG9uZW50IHtcbiAgICBpbmRleDogbnVtYmVyO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIHV1aWQ/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbXBvbmVudFR5cGUocmF3OiBhbnkpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8uX190eXBlX18pLFxuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/LmNpZCksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8udHlwZSksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8ubmFtZSlcbiAgICBdO1xuICAgIGNvbnN0IG1hdGNoZWQgPSBjYW5kaWRhdGVzLmZpbmQoKGl0ZW0pID0+IEJvb2xlYW4oaXRlbSkpO1xuICAgIHJldHVybiBtYXRjaGVkIHx8ICdVbmtub3duJztcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29tcG9uZW50VXVpZChyYXc6IGFueSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py51dWlkKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py52YWx1ZT8udXVpZClcbiAgICBdO1xuICAgIGNvbnN0IG1hdGNoZWQgPSBjYW5kaWRhdGVzLmZpbmQoKGl0ZW0pID0+IEJvb2xlYW4oaXRlbSkpO1xuICAgIHJldHVybiBtYXRjaGVkIHx8IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29tcG9uZW50TmFtZShyYXc6IGFueSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py5uYW1lKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py52YWx1ZT8ubmFtZSlcbiAgICBdO1xuICAgIGNvbnN0IG1hdGNoZWQgPSBjYW5kaWRhdGVzLmZpbmQoKGl0ZW0pID0+IEJvb2xlYW4oaXRlbSkpO1xuICAgIHJldHVybiBtYXRjaGVkIHx8IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdE5vZGVDb21wb25lbnRzKG5vZGU6IGFueSk6IE5vcm1hbGl6ZWRDb21wb25lbnRbXSB7XG4gICAgY29uc3QgcmF3Q29tcG9uZW50cyA9IEFycmF5LmlzQXJyYXkobm9kZT8uX19jb21wc19fKSA/IG5vZGUuX19jb21wc19fIDogW107XG4gICAgcmV0dXJuIHJhd0NvbXBvbmVudHMubWFwKChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+ICh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICB0eXBlOiBub3JtYWxpemVDb21wb25lbnRUeXBlKGl0ZW0pLFxuICAgICAgICBuYW1lOiBub3JtYWxpemVDb21wb25lbnROYW1lKGl0ZW0pLFxuICAgICAgICB1dWlkOiBub3JtYWxpemVDb21wb25lbnRVdWlkKGl0ZW0pXG4gICAgfSkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBxdWVyeU5vZGVDb21wb25lbnRzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLCBub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxOb3JtYWxpemVkQ29tcG9uZW50W10+IHtcbiAgICBjb25zdCBub2RlID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgIHJldHVybiBleHRyYWN0Tm9kZUNvbXBvbmVudHMobm9kZSk7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVDb21wb25lbnRJbmRleChjb21wb25lbnRzOiBOb3JtYWxpemVkQ29tcG9uZW50W10sIGFyZ3M6IGFueSk6IG51bWJlciB7XG4gICAgaWYgKHR5cGVvZiBhcmdzPy5jb21wb25lbnRJbmRleCA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzSW50ZWdlcihhcmdzLmNvbXBvbmVudEluZGV4KSAmJiBhcmdzLmNvbXBvbmVudEluZGV4ID49IDApIHtcbiAgICAgICAgcmV0dXJuIGFyZ3MuY29tcG9uZW50SW5kZXg7XG4gICAgfVxuXG4gICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VXVpZCk7XG4gICAgaWYgKGNvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgY29uc3QgaGl0QnlVdWlkID0gY29tcG9uZW50cy5maW5kKChpdGVtKSA9PiBpdGVtLnV1aWQgPT09IGNvbXBvbmVudFV1aWQpO1xuICAgICAgICBpZiAoaGl0QnlVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gaGl0QnlVdWlkLmluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tcG9uZW50VHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgaGl0QnlUeXBlID0gY29tcG9uZW50cy5maW5kKChpdGVtKSA9PiBpdGVtLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICBpZiAoaGl0QnlUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gaGl0QnlUeXBlLmluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xufVxuXG5mdW5jdGlvbiBidWlsZFByb3BlcnR5UGF0aChjb21wb25lbnRJbmRleDogbnVtYmVyLCBwcm9wZXJ0eVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHByb3BlcnR5UGF0aC5zdGFydHNXaXRoKCdfX2NvbXBzX18uJykpIHtcbiAgICAgICAgcmV0dXJuIHByb3BlcnR5UGF0aDtcbiAgICB9XG4gICAgcmV0dXJuIGBfX2NvbXBzX18uJHtjb21wb25lbnRJbmRleH0uJHtwcm9wZXJ0eVBhdGh9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9saXN0X29uX25vZGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LoioLngrnkuIrnmoTnu4Tku7bliJfooagnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZVV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBhd2FpdCBxdWVyeU5vZGVDb21wb25lbnRzKHJlcXVlc3Rlciwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGNvbXBvbmVudHMubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoue7hOS7tuWIl+ihqOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2FkZF9jb21wb25lbnQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflkJHoioLngrnmt7vliqDnu4Tku7YnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu257G75Z6L77yM5L6L5aaCIGNjLlNwcml0ZScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnLCAnY29tcG9uZW50VHlwZSddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuY3JlYXRlLWNvbXBvbmVudCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZC9jb21wb25lbnRUeXBlIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5re75Yqg57uE5Lu25aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfcmVtb3ZlX2NvbXBvbmVudCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S7juiKgueCueenu+mZpOe7hOS7tu+8iOS8mOWFiOaMiSBjb21wb25lbnRVdWlk77yM5qyh6YCJIGNvbXBvbmVudFR5cGXvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu2IFVVSUTvvIjmjqjojZDvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57uE5Lu257G75Z6L77yI55So5LqO5p+l5om+IFVVSUTvvIknIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZW1vdmUtY29tcG9uZW50JywgJ3NjZW5lLnF1ZXJ5LW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5ub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnRVdWlkICYmICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdjb21wb25lbnRVdWlkIOaIliBjb21wb25lbnRUeXBlIOiHs+WwkeaPkOS+m+S4gOS4qicsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBmaW5hbENvbXBvbmVudFV1aWQgPSBjb21wb25lbnRVdWlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZpbmFsQ29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gY29tcG9uZW50cy5maW5kKChpdGVtKSA9PiBpdGVtLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoYOacquaJvuWIsOe7hOS7tjogJHtjb21wb25lbnRUeXBlfWAsIHVuZGVmaW5lZCwgJ0VfQ09NUE9ORU5UX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaGVkLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbChg57uE5Lu257y65bCRIFVVSUQ6ICR7Y29tcG9uZW50VHlwZX1gLCB1bmRlZmluZWQsICdFX0NPTVBPTkVOVF9VVUlEX01JU1NJTkcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmFsQ29tcG9uZW50VXVpZCA9IG1hdGNoZWQudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVtb3ZlLWNvbXBvbmVudCcsIHsgdXVpZDogZmluYWxDb21wb25lbnRVdWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogZmluYWxDb21wb25lbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogY29tcG9uZW50VHlwZSB8fCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn56e76Zmk57uE5Lu25aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u6IqC54K557uE5Lu25bGe5oCn77yI5pSv5oyBIHR5cGUvdmFsdWUg5b2i5byP77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRJbmRleDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICfnu4Tku7bntKLlvJXvvIjkuI4gY29tcG9uZW50VXVpZC9jb21wb25lbnRUeXBlIOS6jOmAieS4gO+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7YgVVVJRO+8iOaOqOiNkO+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7bnsbvlnovvvIjkvovlpoIgY2MuTGFiZWzvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7blsZ7mgKfot6/lvoTvvIzkvovvvJpzdHJpbmcg5oiWIGNvbG9yLnInIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAn6KaB5YaZ5YWl55qE5bGe5oCn5YC8JyB9LFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZVR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5bGe5oCn5YC857G75Z6L77yM5L6L77yaY2MuQ29sb3IvY2MuVmVjMycgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVjb3JkOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzmmK/lkKborrDlvZUgdW5kbycgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbm9kZVV1aWQnLCAncHJvcGVydHlQYXRoJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5zZXQtcHJvcGVydHknLCAnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByb3BlcnR5UGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhcHJvcGVydHlQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZC9wcm9wZXJ0eVBhdGgg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVzb2x2ZUNvbXBvbmVudEluZGV4KGNvbXBvbmVudHMsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50SW5kZXggPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5peg5rOV5a6a5L2N55uu5qCH57uE5Lu277yM6K+35o+Q5L6b5pyJ5pWI55qEIGNvbXBvbmVudEluZGV4L2NvbXBvbmVudFV1aWQvY29tcG9uZW50VHlwZScsIHVuZGVmaW5lZCwgJ0VfQ09NUE9ORU5UX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IGJ1aWxkUHJvcGVydHlQYXRoKGNvbXBvbmVudEluZGV4LCBwcm9wZXJ0eVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkdW1wOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0geyB2YWx1ZTogYXJncz8udmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWVUeXBlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy52YWx1ZVR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wLnR5cGUgPSB2YWx1ZVR5cGU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0UGF5bG9hZDogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzPy5yZWNvcmQgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFBheWxvYWQucmVjb3JkID0gYXJncy5yZWNvcmQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtcHJvcGVydHknLCByZXF1ZXN0UGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkOiB1cGRhdGVkID09PSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iuvue9rue7hOS7tuWxnuaAp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2xpc3RfYXZhaWxhYmxlX3R5cGVzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5Zmo5Y+v5re75Yqg57uE5Lu257G75Z6LJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdjb21wb25lbnQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudHMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudHMnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogQXJyYXkuaXNBcnJheShjb21wb25lbnRzKSA/IGNvbXBvbmVudHMubGVuZ3RoIDogMFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Llj6/nlKjnu4Tku7bnsbvlnovlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9nZXRfY29tcG9uZW50X2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmjInnu4Tku7YgVVVJRCDmn6Xor6Lnu4Tku7bor6bmg4UnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7YgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY29tcG9uZW50VXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktY29tcG9uZW50J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb21wb25lbnRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2NvbXBvbmVudFV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQnLCBjb21wb25lbnRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i57uE5Lu26K+m5oOF5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfcXVlcnlfY2xhc3NlcycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue7hOS7tuexu+WFg+S/oeaBr++8iHNjZW5lLnF1ZXJ5LWNsYXNzZXPvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jHF1ZXJ5LWNsYXNzZXMg5Y+C5pWwJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWNsYXNzZXMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzPy5vcHRpb25zICYmIHR5cGVvZiBhcmdzLm9wdGlvbnMgPT09ICdvYmplY3QnID8gYXJncy5vcHRpb25zIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzZXMgPSBvcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktY2xhc3NlcycsIG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktY2xhc3NlcycpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ID0gQXJyYXkuaXNBcnJheShjbGFzc2VzKSA/IGNsYXNzZXMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnMgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzZXM6IGxpc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i57uE5Lu257G75L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfaGFzX3NjcmlwdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ajgOafpeaMh+Wumue7hOS7tuWQjeaYr+WQpuW3suWtmOWcqOiEmuacrOWunueOsCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnY29tcG9uZW50JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnROYW1lOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+e7hOS7tuWQjeensCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY29tcG9uZW50TmFtZSddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktY29tcG9uZW50LWhhcy1zY3JpcHQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudE5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudE5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50TmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29tcG9uZW50TmFtZSDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNTY3JpcHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudC1oYXMtc2NyaXB0JywgY29tcG9uZW50TmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzU2NyaXB0OiBoYXNTY3JpcHQgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i57uE5Lu26ISa5pys54q25oCB5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfZXhlY3V0ZV9tZXRob2QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmiafooYznu4Tku7bmlrnms5XvvIhzY2VuZS5leGVjdXRlLWNvbXBvbmVudC1tZXRob2TvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnu4Tku7YgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kTmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmlrnms5XlkI0nIH0sXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaWueazleWPguaVsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY29tcG9uZW50VXVpZCcsICdtZXRob2ROYW1lJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5leGVjdXRlLWNvbXBvbmVudC1tZXRob2QnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbXBvbmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGhvZE5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm1ldGhvZE5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50VXVpZCB8fCAhbWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29tcG9uZW50VXVpZC9tZXRob2ROYW1lIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGhvZEFyZ3MgPSBBcnJheS5pc0FycmF5KGFyZ3M/LmFyZ3MpID8gYXJncy5hcmdzIDogW107XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdleGVjdXRlLWNvbXBvbmVudC1tZXRob2QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBjb21wb25lbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogbWV0aG9kTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IG1ldGhvZEFyZ3NcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGVjdXRlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2ROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJnczogbWV0aG9kQXJncyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmiafooYznu4Tku7bmlrnms5XlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9tb3ZlX2FycmF5X2VsZW1lbnQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnp7vliqjnu4Tku7bmlbDnu4TlsZ7mgKflhYPntKDkvY3nva4nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflr7nosaEgVVVJRO+8iOiKgueCueaIlue7hOS7tu+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmlbDnu4TlsZ7mgKfot6/lvoQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICfnm67moIfntKLlvJUnIH0sXG4gICAgICAgICAgICAgICAgICAgIG9mZnNldDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICflgY/np7vph48nIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3V1aWQnLCAncGF0aCcsICd0YXJnZXQnLCAnb2Zmc2V0J11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5tb3ZlLWFycmF5LWVsZW1lbnQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghdXVpZCB8fCAhcGF0aCB8fCAhTnVtYmVyLmlzSW50ZWdlcihhcmdzPy50YXJnZXQpIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKGFyZ3M/Lm9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWQvcGF0aC90YXJnZXQvb2Zmc2V0IOW/heWhq+S4lCB0YXJnZXQvb2Zmc2V0IOW/hemhu+S4uuaVtOaVsCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vdmVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdtb3ZlLWFycmF5LWVsZW1lbnQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogYXJncy50YXJnZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IGFyZ3Mub2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgbW92ZWQ6IG1vdmVkID09PSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IGFyZ3MudGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0OiBhcmdzLm9mZnNldFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfnp7vliqjmlbDnu4TlhYPntKDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9yZW1vdmVfYXJyYXlfZWxlbWVudCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WIoOmZpOe7hOS7tuaVsOe7hOWxnuaAp+WFg+e0oCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnY29tcG9uZW50JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+WvueixoSBVVUlE77yI6IqC54K55oiW57uE5Lu277yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+aVsOe7hOWxnuaAp+i3r+W+hCcgfSxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAn5pWw57uE57Si5byVJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1dWlkJywgJ3BhdGgnLCAnaW5kZXgnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnJlbW92ZS1hcnJheS1lbGVtZW50J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51dWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoIXV1aWQgfHwgIXBhdGggfHwgIU51bWJlci5pc0ludGVnZXIoYXJncz8uaW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1dWlkL3BhdGgvaW5kZXgg5b+F5aGr5LiUIGluZGV4IOW/hemhu+S4uuaVtOaVsCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZWQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3JlbW92ZS1hcnJheS1lbGVtZW50Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogYXJncy5pbmRleFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQgPT09IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBhcmdzLmluZGV4XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIoOmZpOaVsOe7hOWFg+e0oOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3Jlc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN572u5bGe5oCn5Yiw6buY6K6k5YC877yIc2NlbmUucmVzZXQtcHJvcGVydHnvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflr7nosaEgVVVJRO+8iOiKgueCueaIlue7hOS7tu+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflsZ7mgKfot6/lvoQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6YCP5Lyg57uZIGR1bXAudmFsdWUnIH0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlVHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIxkdW1wLnR5cGUnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlY29yZDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm6K6w5b2VIHVuZG8nIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3V1aWQnLCAncGF0aCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucmVzZXQtcHJvcGVydHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghdXVpZCB8fCAhcGF0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXVpZC9wYXRoIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYXJncyB8fCB7fSwgJ3ZhbHVlJykgPyBhcmdzLnZhbHVlIDogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWVUeXBlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy52YWx1ZVR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZHVtcC50eXBlID0gdmFsdWVUeXBlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGR1bXBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncz8ucmVjb3JkID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5yZWNvcmQgPSBhcmdzLnJlY29yZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNldCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVzZXQtcHJvcGVydHknLCBwYXlsb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2V0OiByZXNldCA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHVtcFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfph43nva7lsZ7mgKflpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=