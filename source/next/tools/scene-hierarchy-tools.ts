import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString, toStringList } from './common';

function normalizeCreateNodeOptions(args: any): Record<string, any> {
    const options: Record<string, any> = {};

    const name = toNonEmptyString(args?.name);
    if (name) {
        options.name = name;
    }

    const parentUuid = toNonEmptyString(args?.parentUuid);
    if (parentUuid) {
        options.parent = parentUuid;
    }

    const assetUuid = toNonEmptyString(args?.assetUuid);
    if (assetUuid) {
        options.assetUuid = assetUuid;
    }

    if (typeof args?.unlinkPrefab === 'boolean') {
        options.unlinkPrefab = args.unlinkPrefab;
    }

    if (typeof args?.keepWorldTransform === 'boolean') {
        options.keepWorldTransform = args.keepWorldTransform;
    }

    if (args?.position && typeof args.position === 'object') {
        options.position = args.position;
    }

    return options;
}

export function createSceneHierarchyTools(requester: EditorRequester): NextToolDefinition[] {
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
            run: async (args: any) => {
                try {
                    const rootUuid = toNonEmptyString(args?.rootUuid);
                    const tree = rootUuid
                        ? await requester('scene', 'query-node-tree', rootUuid)
                        : await requester('scene', 'query-node-tree');
                    return ok({ tree, rootUuid });
                } catch (error: any) {
                    return fail('获取场景层级失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuid = toNonEmptyString(args?.uuid);
                if (!uuid) {
                    return fail('uuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const node = await requester('scene', 'query-node', uuid);
                    return ok({ uuid, node });
                } catch (error: any) {
                    return fail('查询节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const options = normalizeCreateNodeOptions(args);
                if (!options.name && !options.assetUuid) {
                    return fail('name 或 assetUuid 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const nodeUuid = await requester('scene', 'create-node', options);
                    return ok({ created: true, nodeUuid, options });
                } catch (error: any) {
                    return fail('创建节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuids = toStringList(args?.uuids);
                if (uuids.length === 0) {
                    return fail('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = uuids.length === 1
                        ? await requester('scene', 'duplicate-node', uuids[0])
                        : await requester('scene', 'duplicate-node', uuids);
                    return ok({
                        sourceUuids: uuids,
                        duplicatedUuids: Array.isArray(result) ? result : [result]
                    });
                } catch (error: any) {
                    return fail('复制节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuids = toStringList(args?.uuids);
                if (uuids.length === 0) {
                    return fail('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const copied = uuids.length === 1
                        ? await requester('scene', 'copy-node', uuids[0])
                        : await requester('scene', 'copy-node', uuids);
                    const copiedUuids = Array.isArray(copied) ? copied : uuids;
                    return ok({
                        copied: true,
                        uuids,
                        copiedUuids
                    });
                } catch (error: any) {
                    return fail('复制节点到剪贴板失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuids = toStringList(args?.uuids);
                if (uuids.length === 0) {
                    return fail('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'cut-node', uuids.length === 1 ? uuids[0] : uuids);
                    return ok({
                        cut: true,
                        uuids
                    });
                } catch (error: any) {
                    return fail('剪切节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const targetUuid = toNonEmptyString(args?.targetUuid);
                const uuids = toStringList(args?.uuids);
                if (!targetUuid || uuids.length === 0) {
                    return fail('targetUuid/uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const pastedUuids = await requester('scene', 'paste-node', {
                        target: targetUuid,
                        uuids: uuids.length === 1 ? uuids[0] : uuids,
                        keepWorldTransform: args?.keepWorldTransform === true,
                        pasteAsChild: args?.pasteAsChild !== false
                    });
                    return ok({
                        pasted: true,
                        targetUuid,
                        sourceUuids: uuids,
                        pastedUuids: Array.isArray(pastedUuids) ? pastedUuids : []
                    });
                } catch (error: any) {
                    return fail('粘贴节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuids = toStringList(args?.uuids);
                if (uuids.length === 0) {
                    return fail('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'remove-node', {
                        uuid: uuids.length === 1 ? uuids[0] : uuids,
                        keepWorldTransform: args?.keepWorldTransform === true
                    });
                    return ok({ deleted: true, uuids });
                } catch (error: any) {
                    return fail('删除节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const parentUuid = toNonEmptyString(args?.parentUuid);
                const uuids = toStringList(args?.uuids);
                if (!parentUuid || uuids.length === 0) {
                    return fail('parentUuid/uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const moved = await requester('scene', 'set-parent', {
                        parent: parentUuid,
                        uuids,
                        keepWorldTransform: args?.keepWorldTransform === true
                    });
                    return ok({
                        parentUuid,
                        uuids,
                        movedUuids: Array.isArray(moved) ? moved : uuids
                    });
                } catch (error: any) {
                    return fail('调整父子关系失败', normalizeError(error));
                }
            }
        }
    ];
}
