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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtaGllcmFyY2h5LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvc2NlbmUtaGllcmFyY2h5LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBb0NBLDhEQTZOQztBQWhRRCxxQ0FBb0Y7QUFFcEYsU0FBUywwQkFBMEIsQ0FBQyxJQUFTO0lBQ3pDLE1BQU0sT0FBTyxHQUF3QixFQUFFLENBQUM7SUFFeEMsTUFBTSxJQUFJLEdBQUcsSUFBQSx5QkFBZ0IsRUFBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNQLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFBLHlCQUFnQixFQUFDLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxVQUFVLENBQUMsQ0FBQztJQUN0RCxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7SUFDaEMsQ0FBQztJQUVELE1BQU0sU0FBUyxHQUFHLElBQUEseUJBQWdCLEVBQUMsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BELElBQUksU0FBUyxFQUFFLENBQUM7UUFDWixPQUFPLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLFlBQVksQ0FBQSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzFDLE9BQU8sQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztJQUM3QyxDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLGtCQUFr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QUFDLENBQUM7Z0JBQ3hFLENBQUM7Z0JBRUQsSUFBSSxDQUFDO29CQUNELE1BQU0sS0FBSyxHQUFHLE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUU7d0JBQ2pELE1BQU0sRUFBRSxVQUFVO3dCQUNsQixLQUFLO3dCQUNMLGtCQUFrQixFQUFFLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLGtCQUFrQixNQUFLLElBQUk7cUJBQ3hELENBQUMsQ0FBQztvQkFDSCxPQUFPLElBQUEsV0FBRSxFQUFDO3dCQUNOLFVBQVU7d0JBQ1YsS0FBSzt3QkFDTCxVQUFVLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLO3FCQUNuRCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztnQkFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO29CQUNsQixPQUFPLElBQUEsYUFBSSxFQUFDLFVBQVUsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDbkQsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWRpdG9yUmVxdWVzdGVyLCBOZXh0VG9vbERlZmluaXRpb24gfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHsgZmFpbCwgbm9ybWFsaXplRXJyb3IsIG9rLCB0b05vbkVtcHR5U3RyaW5nLCB0b1N0cmluZ0xpc3QgfSBmcm9tICcuL2NvbW1vbic7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNyZWF0ZU5vZGVPcHRpb25zKGFyZ3M6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGNvbnN0IG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcblxuICAgIGNvbnN0IG5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm5hbWUpO1xuICAgIGlmIChuYW1lKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZSA9IG5hbWU7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucGFyZW50VXVpZCk7XG4gICAgaWYgKHBhcmVudFV1aWQpIHtcbiAgICAgICAgb3B0aW9ucy5wYXJlbnQgPSBwYXJlbnRVdWlkO1xuICAgIH1cblxuICAgIGNvbnN0IGFzc2V0VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uYXNzZXRVdWlkKTtcbiAgICBpZiAoYXNzZXRVdWlkKSB7XG4gICAgICAgIG9wdGlvbnMuYXNzZXRVdWlkID0gYXNzZXRVdWlkO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJncz8udW5saW5rUHJlZmFiID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgb3B0aW9ucy51bmxpbmtQcmVmYWIgPSBhcmdzLnVubGlua1ByZWZhYjtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZ3M/LmtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIG9wdGlvbnMua2VlcFdvcmxkVHJhbnNmb3JtID0gYXJncy5rZWVwV29ybGRUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgaWYgKGFyZ3M/LnBvc2l0aW9uICYmIHR5cGVvZiBhcmdzLnBvc2l0aW9uID09PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRpb25zLnBvc2l0aW9uID0gYXJncy5wb3NpdGlvbjtcbiAgICB9XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNjZW5lSGllcmFyY2h5VG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2xpc3RfZ2FtZV9vYmplY3RzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6I635Y+W5Zy65pmv5bGC57qn5qCR77yM5Y+v6YCJ5LuO5oyH5a6a6IqC54K55byA5aeLJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcm9vdFV1aWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzmjIflrprlsYLnuqfmoJHmoLnoioLngrkgVVVJRCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2RlLXRyZWUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvb3RVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5yb290VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyZWUgPSByb290VXVpZFxuICAgICAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScsIHJvb3RVdWlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyB0cmVlLCByb290VXVpZCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfojrflj5blnLrmma/lsYLnuqflpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2dldF9nYW1lX29iamVjdF9pbmZvJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJ6IqC54K5IFVVSUQg5p+l6K+i6IqC54K56K+m5oOFJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfoioLngrkgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1dWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgdXVpZCwgbm9kZSB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LoioLngrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2NyZWF0ZV9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WIm+W7uuiKgueCue+8iOaUr+aMgeeItuiKgueCueWSjOWfuuehgOWIm+W7uumAiemhue+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6IqC54K55ZCN56ewJyB9LFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+eItuiKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5oyJ6LWE5rqQIFVVSUQg5a6e5L6L5YyW6IqC54K5JyB9LFxuICAgICAgICAgICAgICAgICAgICB1bmxpbmtQcmVmYWI6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaYr+WQpuWPlua2iCBwcmVmYWIg5YWz6IGUJyB9LFxuICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaYr+WQpuS/neaMgeS4lueVjOWdkOaghycgfSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzliJ3lp4vkvY3nva4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuY3JlYXRlLW5vZGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBub3JtYWxpemVDcmVhdGVOb2RlT3B0aW9ucyhhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMubmFtZSAmJiAhb3B0aW9ucy5hc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25hbWUg5oiWIGFzc2V0VXVpZCDoh7PlsJHmj5DkvpvkuIDkuKonLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgY3JlYXRlZDogdHJ1ZSwgbm9kZVV1aWQsIG9wdGlvbnMgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yib5bu66IqC54K55aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9kdXBsaWNhdGVfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLbkuIDkuKrmiJblpJrkuKroioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmR1cGxpY2F0ZS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IHRvU3RyaW5nTGlzdChhcmdzPy51dWlkcyk7XG4gICAgICAgICAgICAgICAgaWYgKHV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXVpZHMg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdXVpZHMubGVuZ3RoID09PSAxXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnZHVwbGljYXRlLW5vZGUnLCB1dWlkc1swXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdkdXBsaWNhdGUtbm9kZScsIHV1aWRzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVV1aWRzOiB1dWlkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRVdWlkczogQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogW3Jlc3VsdF1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5aSN5Yi26IqC54K55aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9kZWxldGVfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfliKDpmaTkuIDkuKrmiJblpJrkuKroioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWIoOmZpOaXtuaYr+WQpuS/neaMgeS4lueVjOWPmOaNoidcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnJlbW92ZS1ub2RlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkcyA9IHRvU3RyaW5nTGlzdChhcmdzPy51dWlkcyk7XG4gICAgICAgICAgICAgICAgaWYgKHV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXVpZHMg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdyZW1vdmUtbm9kZScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IHV1aWRzLmxlbmd0aCA9PT0gMSA/IHV1aWRzWzBdIDogdXVpZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IGFyZ3M/LmtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgZGVsZXRlZDogdHJ1ZSwgdXVpZHMgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yig6Zmk6IqC54K55aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9wYXJlbnRfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfosIPmlbToioLngrnniLblrZDlhbPns7snLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+eItuiKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+imgeenu+WKqOeahOiKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuS/neaMgeS4lueVjOWPmOaNou+8jOm7mOiupCBmYWxzZSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncGFyZW50VXVpZCcsICd1dWlkcyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUuc2V0LXBhcmVudCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucGFyZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSB0b1N0cmluZ0xpc3QoYXJncz8udXVpZHMpO1xuICAgICAgICAgICAgICAgIGlmICghcGFyZW50VXVpZCB8fCB1dWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3BhcmVudFV1aWQvdXVpZHMg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW92ZWQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3NldC1wYXJlbnQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogYXJncz8ua2VlcFdvcmxkVHJhbnNmb3JtID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW92ZWRVdWlkczogQXJyYXkuaXNBcnJheShtb3ZlZCkgPyBtb3ZlZCA6IHV1aWRzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iwg+aVtOeItuWtkOWFs+ezu+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXTtcbn1cbiJdfQ==