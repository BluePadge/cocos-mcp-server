"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSceneHierarchyTools = createSceneHierarchyTools;
const common_1 = require("./common");
function normalizeCreateNodeOptions(args) {
    const options = {};
    const name = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.name);
    if (name) {
        options.name = name;
    }
    const parentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.parentUuid);
    if (parentUuid) {
        options.parent = parentUuid;
    }
    const assetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.assetUuid);
    if (assetUuid) {
        options.assetUuid = assetUuid;
    }
    if (typeof (args === null || args === void 0 ? void 0 : args.unlinkPrefab) === 'boolean') {
        options.unlinkPrefab = args.unlinkPrefab;
    }
    if (typeof (args === null || args === void 0 ? void 0 : args.keepWorldTransform) === 'boolean') {
        options.keepWorldTransform = args.keepWorldTransform;
    }
    if ((args === null || args === void 0 ? void 0 : args.position) && typeof args.position === 'object') {
        options.position = args.position;
    }
    return options;
}
function createSceneHierarchyTools(requester) {
    return [
        {
            name: 'scene_list_game_objects',
            description: '获取场景层级树，可选从指定节点开始',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    rootUuid: {
                        type: 'string',
                        description: '可选，指定层级树根节点 UUID'
                    }
                }
            },
            requiredCapabilities: ['scene.query-node-tree'],
            run: async (args) => {
                try {
                    const rootUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.rootUuid);
                    const tree = rootUuid
                        ? await requester('scene', 'query-node-tree', rootUuid)
                        : await requester('scene', 'query-node-tree');
                    return (0, common_1.ok)({ tree, rootUuid });
                }
                catch (error) {
                    return (0, common_1.fail)('获取场景层级失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_get_game_object_info',
            description: '按节点 UUID 查询节点详情',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: { type: 'string', description: '节点 UUID' }
                },
                required: ['uuid']
            },
            requiredCapabilities: ['scene.query-node'],
            run: async (args) => {
                const uuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.uuid);
                if (!uuid) {
                    return (0, common_1.fail)('uuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const node = await requester('scene', 'query-node', uuid);
                    return (0, common_1.ok)({ uuid, node });
                }
                catch (error) {
                    return (0, common_1.fail)('查询节点失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_create_game_object',
            description: '创建节点（支持父节点和基础创建选项）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: '节点名称' },
                    parentUuid: { type: 'string', description: '父节点 UUID' },
                    assetUuid: { type: 'string', description: '可选，按资源 UUID 实例化节点' },
                    unlinkPrefab: { type: 'boolean', description: '可选，是否取消 prefab 关联' },
                    keepWorldTransform: { type: 'boolean', description: '可选，是否保持世界坐标' },
                    position: {
                        type: 'object',
                        description: '可选，初始位置',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    }
                }
            },
            requiredCapabilities: ['scene.create-node'],
            run: async (args) => {
                const options = normalizeCreateNodeOptions(args);
                if (!options.name && !options.assetUuid) {
                    return (0, common_1.fail)('name 或 assetUuid 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const nodeUuid = await requester('scene', 'create-node', options);
                    return (0, common_1.ok)({ created: true, nodeUuid, options });
                }
                catch (error) {
                    return (0, common_1.fail)('创建节点失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_duplicate_game_object',
            description: '复制一个或多个节点',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '节点 UUID 或 UUID 列表'
                    }
                },
                required: ['uuids']
            },
            requiredCapabilities: ['scene.duplicate-node'],
            run: async (args) => {
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (uuids.length === 0) {
                    return (0, common_1.fail)('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = uuids.length === 1
                        ? await requester('scene', 'duplicate-node', uuids[0])
                        : await requester('scene', 'duplicate-node', uuids);
                    return (0, common_1.ok)({
                        sourceUuids: uuids,
                        duplicatedUuids: Array.isArray(result) ? result : [result]
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('复制节点失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_copy_game_object',
            description: '复制一个或多个节点到编辑器剪贴板',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '节点 UUID 或 UUID 列表'
                    }
                },
                required: ['uuids']
            },
            requiredCapabilities: ['scene.copy-node'],
            run: async (args) => {
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (uuids.length === 0) {
                    return (0, common_1.fail)('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const copied = uuids.length === 1
                        ? await requester('scene', 'copy-node', uuids[0])
                        : await requester('scene', 'copy-node', uuids);
                    const copiedUuids = Array.isArray(copied) ? copied : uuids;
                    return (0, common_1.ok)({
                        copied: true,
                        uuids,
                        copiedUuids
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('复制节点到剪贴板失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_cut_game_object',
            description: '剪切一个或多个节点到编辑器剪贴板',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '节点 UUID 或 UUID 列表'
                    }
                },
                required: ['uuids']
            },
            requiredCapabilities: ['scene.cut-node'],
            run: async (args) => {
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (uuids.length === 0) {
                    return (0, common_1.fail)('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'cut-node', uuids.length === 1 ? uuids[0] : uuids);
                    return (0, common_1.ok)({
                        cut: true,
                        uuids
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('剪切节点失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_paste_game_object',
            description: '将剪贴板中的节点粘贴到目标节点',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    targetUuid: { type: 'string', description: '粘贴目标节点 UUID' },
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '要粘贴的节点 UUID 或 UUID 列表'
                    },
                    keepWorldTransform: {
                        type: 'boolean',
                        description: '是否保持世界变换'
                    },
                    pasteAsChild: {
                        type: 'boolean',
                        description: '是否作为子节点粘贴，默认 true'
                    }
                },
                required: ['targetUuid', 'uuids']
            },
            requiredCapabilities: ['scene.paste-node'],
            run: async (args) => {
                const targetUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.targetUuid);
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (!targetUuid || uuids.length === 0) {
                    return (0, common_1.fail)('targetUuid/uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const pastedUuids = await requester('scene', 'paste-node', {
                        target: targetUuid,
                        uuids: uuids.length === 1 ? uuids[0] : uuids,
                        keepWorldTransform: (args === null || args === void 0 ? void 0 : args.keepWorldTransform) === true,
                        pasteAsChild: (args === null || args === void 0 ? void 0 : args.pasteAsChild) !== false
                    });
                    return (0, common_1.ok)({
                        pasted: true,
                        targetUuid,
                        sourceUuids: uuids,
                        pastedUuids: Array.isArray(pastedUuids) ? pastedUuids : []
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('粘贴节点失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_delete_game_object',
            description: '删除一个或多个节点',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '节点 UUID 或 UUID 列表'
                    },
                    keepWorldTransform: {
                        type: 'boolean',
                        description: '可选，删除时是否保持世界变换'
                    }
                },
                required: ['uuids']
            },
            requiredCapabilities: ['scene.remove-node'],
            run: async (args) => {
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (uuids.length === 0) {
                    return (0, common_1.fail)('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'remove-node', {
                        uuid: uuids.length === 1 ? uuids[0] : uuids,
                        keepWorldTransform: (args === null || args === void 0 ? void 0 : args.keepWorldTransform) === true
                    });
                    return (0, common_1.ok)({ deleted: true, uuids });
                }
                catch (error) {
                    return (0, common_1.fail)('删除节点失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_parent_game_object',
            description: '调整节点父子关系',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    parentUuid: { type: 'string', description: '目标父节点 UUID' },
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '要移动的节点 UUID 或 UUID 列表'
                    },
                    keepWorldTransform: {
                        type: 'boolean',
                        description: '是否保持世界变换，默认 false'
                    }
                },
                required: ['parentUuid', 'uuids']
            },
            requiredCapabilities: ['scene.set-parent'],
            run: async (args) => {
                const parentUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.parentUuid);
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (!parentUuid || uuids.length === 0) {
                    return (0, common_1.fail)('parentUuid/uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const moved = await requester('scene', 'set-parent', {
                        parent: parentUuid,
                        uuids,
                        keepWorldTransform: (args === null || args === void 0 ? void 0 : args.keepWorldTransform) === true
                    });
                    return (0, common_1.ok)({
                        parentUuid,
                        uuids,
                        movedUuids: Array.isArray(moved) ? moved : uuids
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('调整父子关系失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtaGllcmFyY2h5LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvc2NlbmUtaGllcmFyY2h5LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBb0NBLDhEQThWQztBQWpZRCxxQ0FBb0Y7QUFFcEYsU0FBUywwQkFBMEIsQ0FBQyxJQUFTO0lBQ3pDLE1BQU0sT0FBTyxHQUF3QixFQUFFLENBQUM7SUFFeEMsTUFBTSxJQUFJLEdBQUcsSUFBQSx5QkFBZ0IsRUFBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNQLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFBLHlCQUFnQixFQUFDLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxVQUFVLENBQUMsQ0FBQztJQUN0RCxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7SUFDaEMsQ0FBQztJQUVELE1BQU0sU0FBUyxHQUFHLElBQUEseUJBQWdCLEVBQUMsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BELElBQUksU0FBUyxFQUFFLENBQUM7UUFDWixPQUFPLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLFlBQVksQ0FBQSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzFDLE9BQU8sQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztJQUM3QyxDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLGtCQUFr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SyxHQUFHLElBQUEscUJBQVksRUFBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ3hDLElBQUksQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDcEMsT0FBTyxJQUFBLGFBQUksRUFBQyxxQkFBcUIsRUFBRSxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztnQkFDeEUsQ0FBQztnQkFFRCxJQUFJLENBQUM7b0JBQ0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRTt3QkFDakQsTUFBTSxFQUFFLFVBQVU7d0JBQ2xCLEtBQUs7d0JBQ0wsa0JBQWtCLEVBQUUsQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsa0JBQWtCLE1BQUssSUFBSTtxQkFDeEQsQ0FBQyxDQUFDO29CQUNILE9BQU8sSUFBQSxXQUFFLEVBQUM7d0JBQ04sVUFBVTt3QkFDVixLQUFLO3dCQUNMLFVBQVUsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUs7cUJBQ25ELENBQUMsQ0FBQztnQkFDUCxDQUFDO2dCQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7b0JBQ2xCLE9BQU8sSUFBQSxhQUFJLEVBQUMsVUFBVSxFQUFFLElBQUEsdUJBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNuRCxDQUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHRvTm9uRW1wdHlTdHJpbmcsIHRvU3RyaW5nTGlzdCB9IGZyb20gJy4vY29tbW9uJztcblxuZnVuY3Rpb24gbm9ybWFsaXplQ3JlYXRlTm9kZU9wdGlvbnMoYXJnczogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgY29uc3Qgb3B0aW9uczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuXG4gICAgY29uc3QgbmFtZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubmFtZSk7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lID0gbmFtZTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJlbnRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wYXJlbnRVdWlkKTtcbiAgICBpZiAocGFyZW50VXVpZCkge1xuICAgICAgICBvcHRpb25zLnBhcmVudCA9IHBhcmVudFV1aWQ7XG4gICAgfVxuXG4gICAgY29uc3QgYXNzZXRVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5hc3NldFV1aWQpO1xuICAgIGlmIChhc3NldFV1aWQpIHtcbiAgICAgICAgb3B0aW9ucy5hc3NldFV1aWQgPSBhc3NldFV1aWQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzPy51bmxpbmtQcmVmYWIgPT09ICdib29sZWFuJykge1xuICAgICAgICBvcHRpb25zLnVubGlua1ByZWZhYiA9IGFyZ3MudW5saW5rUHJlZmFiO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJncz8ua2VlcFdvcmxkVHJhbnNmb3JtID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgb3B0aW9ucy5rZWVwV29ybGRUcmFuc2Zvcm0gPSBhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBpZiAoYXJncz8ucG9zaXRpb24gJiYgdHlwZW9mIGFyZ3MucG9zaXRpb24gPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdGlvbnMucG9zaXRpb24gPSBhcmdzLnBvc2l0aW9uO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2NlbmVIaWVyYXJjaHlUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfbGlzdF9nYW1lX29iamVjdHMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfojrflj5blnLrmma/lsYLnuqfmoJHvvIzlj6/pgInku47mjIflrproioLngrnlvIDlp4snLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICByb290VXVpZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaMh+WumuWxgue6p+agkeagueiKgueCuSBVVUlEJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGUtdHJlZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm9vdFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnJvb3RVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHJlZSA9IHJvb3RVdWlkXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJywgcm9vdFV1aWQpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHRyZWUsIHJvb3RVdWlkIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iOt+WPluWcuuaZr+Wxgue6p+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfZ2V0X2dhbWVfb2JqZWN0X2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmjInoioLngrkgVVVJRCDmn6Xor6LoioLngrnor6bmg4UnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1dWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyB1dWlkLCBub2RlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouiKgueCueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfY3JlYXRlX2dhbWVfb2JqZWN0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Yib5bu66IqC54K577yI5pSv5oyB54i26IqC54K55ZKM5Z+656GA5Yib5bu66YCJ6aG577yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfoioLngrnlkI3np7AnIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn54i26IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICflj6/pgInvvIzmjInotYTmupAgVVVJRCDlrp7kvovljJboioLngrknIH0sXG4gICAgICAgICAgICAgICAgICAgIHVubGlua1ByZWZhYjogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm5Y+W5raIIHByZWZhYiDlhbPogZQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5piv5ZCm5L+d5oyB5LiW55WM5Z2Q5qCHJyB9LFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWIneWni+S9jee9ricsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5jcmVhdGUtbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZUNyZWF0ZU5vZGVPcHRpb25zKGFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5uYW1lICYmICFvcHRpb25zLmFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbmFtZSDmiJYgYXNzZXRVdWlkIOiHs+WwkeaPkOS+m+S4gOS4qicsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjcmVhdGUtbm9kZScsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBjcmVhdGVkOiB0cnVlLCBub2RlVXVpZCwgb3B0aW9ucyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfliJvlu7roioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2R1cGxpY2F0ZV9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WkjeWItuS4gOS4quaIluWkmuS4quiKgueCuScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6IqC54K5IFVVSUQg5oiWIFVVSUQg5YiX6KGoJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1dWlkcyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuZHVwbGljYXRlLW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gdG9TdHJpbmdMaXN0KGFyZ3M/LnV1aWRzKTtcbiAgICAgICAgICAgICAgICBpZiAodXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1dWlkcyDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB1dWlkcy5sZW5ndGggPT09IDFcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdkdXBsaWNhdGUtbm9kZScsIHV1aWRzWzBdKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2R1cGxpY2F0ZS1ub2RlJywgdXVpZHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlVXVpZHM6IHV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHVwbGljYXRlZFV1aWRzOiBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHQgOiBbcmVzdWx0XVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflpI3liLboioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2NvcHlfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLbkuIDkuKrmiJblpJrkuKroioLngrnliLDnvJbovpHlmajliarotLTmnb8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmNvcHktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSB0b1N0cmluZ0xpc3QoYXJncz8udXVpZHMpO1xuICAgICAgICAgICAgICAgIGlmICh1dWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWRzIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvcGllZCA9IHV1aWRzLmxlbmd0aCA9PT0gMVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NvcHktbm9kZScsIHV1aWRzWzBdKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NvcHktbm9kZScsIHV1aWRzKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29waWVkVXVpZHMgPSBBcnJheS5pc0FycmF5KGNvcGllZCkgPyBjb3BpZWQgOiB1dWlkcztcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcGllZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29waWVkVXVpZHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5aSN5Yi26IqC54K55Yiw5Ymq6LS05p2/5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9jdXRfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfliarliIfkuIDkuKrmiJblpJrkuKroioLngrnliLDnvJbovpHlmajliarotLTmnb8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmN1dC1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IHRvU3RyaW5nTGlzdChhcmdzPy51dWlkcyk7XG4gICAgICAgICAgICAgICAgaWYgKHV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXVpZHMg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjdXQtbm9kZScsIHV1aWRzLmxlbmd0aCA9PT0gMSA/IHV1aWRzWzBdIDogdXVpZHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3V0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Ymq5YiH6IqC54K55aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9wYXN0ZV9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WwhuWJqui0tOadv+S4reeahOiKgueCueeymOi0tOWIsOebruagh+iKgueCuScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn57KY6LS055uu5qCH6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHV1aWRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6KaB57KY6LS055qE6IqC54K5IFVVSUQg5oiWIFVVSUQg5YiX6KGoJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm5L+d5oyB5LiW55WM5Y+Y5o2iJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwYXN0ZUFzQ2hpbGQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm5L2c5Li65a2Q6IqC54K557KY6LS077yM6buY6K6kIHRydWUnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3RhcmdldFV1aWQnLCAndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnBhc3RlLW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnRhcmdldFV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gdG9TdHJpbmdMaXN0KGFyZ3M/LnV1aWRzKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFV1aWQgfHwgdXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd0YXJnZXRVdWlkL3V1aWRzIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhc3RlZFV1aWRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdwYXN0ZS1ub2RlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0YXJnZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZHM6IHV1aWRzLmxlbmd0aCA9PT0gMSA/IHV1aWRzWzBdIDogdXVpZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IGFyZ3M/LmtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhc3RlQXNDaGlsZDogYXJncz8ucGFzdGVBc0NoaWxkICE9PSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhc3RlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VVdWlkczogdXVpZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXN0ZWRVdWlkczogQXJyYXkuaXNBcnJheShwYXN0ZWRVdWlkcykgPyBwYXN0ZWRVdWlkcyA6IFtdXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+eymOi0tOiKgueCueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfZGVsZXRlX2dhbWVfb2JqZWN0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Yig6Zmk5LiA5Liq5oiW5aSa5Liq6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfoioLngrkgVVVJRCDmiJYgVVVJRCDliJfooagnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzliKDpmaTml7bmmK/lkKbkv53mjIHkuJbnlYzlj5jmjaInXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3V1aWRzJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5yZW1vdmUtbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSB0b1N0cmluZ0xpc3QoYXJncz8udXVpZHMpO1xuICAgICAgICAgICAgICAgIGlmICh1dWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWRzIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiB1dWlkcy5sZW5ndGggPT09IDEgPyB1dWlkc1swXSA6IHV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiBhcmdzPy5rZWVwV29ybGRUcmFuc2Zvcm0gPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IGRlbGV0ZWQ6IHRydWUsIHV1aWRzIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIoOmZpOiKgueCueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfcGFyZW50X2dhbWVfb2JqZWN0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6LCD5pW06IqC54K554i25a2Q5YWz57O7JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnm67moIfniLboioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdXVpZHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfopoHnp7vliqjnmoToioLngrkgVVVJRCDmiJYgVVVJRCDliJfooagnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbkv53mjIHkuJbnlYzlj5jmjaLvvIzpu5jorqQgZmFsc2UnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3BhcmVudFV1aWQnLCAndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnNldC1wYXJlbnQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudFV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhcmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gdG9TdHJpbmdMaXN0KGFyZ3M/LnV1aWRzKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmVudFV1aWQgfHwgdXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwYXJlbnRVdWlkL3V1aWRzIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vdmVkID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtcGFyZW50Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IGFyZ3M/LmtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVkVXVpZHM6IEFycmF5LmlzQXJyYXkobW92ZWQpID8gbW92ZWQgOiB1dWlkc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfosIPmlbTniLblrZDlhbPns7vlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=