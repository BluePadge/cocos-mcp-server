import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, readDumpString, toNonEmptyString, toStringList } from './common';

function unwrapValue(value: any): any {
    if (value && typeof value === 'object' && 'value' in value) {
        return (value as { value: any }).value;
    }
    return value;
}

function readNodeName(node: any): string | null {
    return readDumpString(node?.name) || null;
}

function readPrefabState(prefab: any): number | null {
    const raw = unwrapValue(prefab?.state);
    return typeof raw === 'number' ? raw : null;
}

function readPrefabAssetUuid(prefab: any): string | null {
    return readDumpString(prefab?.assetUuid) || null;
}

function normalizePrefabCreateOptions(args: any): Record<string, any> {
    const options: Record<string, any> = {};
    const assetUuid = toNonEmptyString(args?.assetUuid);
    if (assetUuid) {
        options.assetUuid = assetUuid;
    }

    const parentUuid = toNonEmptyString(args?.parentUuid);
    if (parentUuid) {
        options.parent = parentUuid;
    }

    const name = toNonEmptyString(args?.name);
    if (name) {
        options.name = name;
    }

    if (typeof args?.keepWorldTransform === 'boolean') {
        options.keepWorldTransform = args.keepWorldTransform;
    }

    if (typeof args?.unlinkPrefab === 'boolean') {
        options.unlinkPrefab = args.unlinkPrefab;
    }

    if (args?.position && typeof args.position === 'object') {
        options.position = args.position;
    }

    return options;
}

async function applyPrefabToNode(
    requester: EditorRequester,
    nodeUuid: string,
    prefabUuid: string | null
): Promise<{ method: string }> {
    const payload = prefabUuid
        ? { node: nodeUuid, prefab: prefabUuid }
        : { uuid: nodeUuid };

    try {
        await requester('scene', 'apply-prefab', payload);
        return { method: 'apply-prefab' };
    } catch (primaryError: any) {
        try {
            await requester('scene', 'apply-prefab-link', payload);
            return { method: 'apply-prefab-link' };
        } catch (fallbackError: any) {
            const detail = `${normalizeError(primaryError)}; fallback failed: ${normalizeError(fallbackError)}`;
            throw new Error(detail);
        }
    }
}

export function createPrefabLifecycleTools(requester: EditorRequester): NextToolDefinition[] {
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
            run: async (args: any) => {
                const options = normalizePrefabCreateOptions(args);
                if (!options.assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const nodeUuid = await requester('scene', 'create-node', options);
                    return ok({
                        created: true,
                        nodeUuid,
                        options
                    });
                } catch (error: any) {
                    return fail('创建 Prefab 实例失败', normalizeError(error));
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
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    return ok({
                        assetUuid,
                        nodeUuids,
                        count: nodeUuids.length
                    });
                } catch (error: any) {
                    return fail('查询 Prefab 实例节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const node = await requester('scene', 'query-node', nodeUuid);
                    const prefab = node?.prefab || null;
                    const prefabAssetUuid = readPrefabAssetUuid(prefab);
                    const prefabState = readPrefabState(prefab);
                    const isPrefabInstance = Boolean(prefabAssetUuid) || (typeof prefabState === 'number' && prefabState > 0);
                    return ok({
                        nodeUuid,
                        nodeName: readNodeName(node),
                        isPrefabInstance,
                        prefabState,
                        prefabAssetUuid,
                        prefab
                    });
                } catch (error: any) {
                    return fail('查询 Prefab 实例信息失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const prefabUuid = toNonEmptyString(args?.prefabUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const applied = await applyPrefabToNode(requester, nodeUuid, prefabUuid);
                    return ok({
                        applied: true,
                        nodeUuid,
                        prefabUuid,
                        method: applied.method
                    });
                } catch (error: any) {
                    return fail('应用 Prefab 失败', normalizeError(error));
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
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                const targetPrefabUuid = toNonEmptyString(args?.targetPrefabUuid) || assetUuid;
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const applied: Array<{ nodeUuid: string; method: string }> = [];
                    const failed: Array<{ nodeUuid: string; error: string }> = [];

                    for (const nodeUuid of nodeUuids) {
                        try {
                            const result = await applyPrefabToNode(requester, nodeUuid, targetPrefabUuid);
                            applied.push({ nodeUuid, method: result.method });
                        } catch (error: any) {
                            failed.push({ nodeUuid, error: normalizeError(error) });
                        }
                    }

                    return ok({
                        assetUuid,
                        targetPrefabUuid,
                        requested: nodeUuids.length,
                        applied,
                        failed,
                        successCount: applied.length,
                        failureCount: failed.length
                    });
                } catch (error: any) {
                    return fail('批量应用 Prefab 失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'restore-prefab', { uuid: nodeUuid });
                    return ok({ restored: true, nodeUuid });
                } catch (error: any) {
                    return fail('还原 Prefab 实例失败', normalizeError(error));
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
            run: async (args: any) => {
                const assetUuid = toNonEmptyString(args?.assetUuid);
                if (!assetUuid) {
                    return fail('assetUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuids = await requester('scene', 'query-nodes-by-asset-uuid', assetUuid);
                    const nodeUuids = Array.isArray(uuids) ? uuids : [];
                    const restored: string[] = [];
                    const failed: Array<{ nodeUuid: string; error: string }> = [];

                    for (const nodeUuid of nodeUuids) {
                        try {
                            await requester('scene', 'restore-prefab', { uuid: nodeUuid });
                            restored.push(nodeUuid);
                        } catch (error: any) {
                            failed.push({ nodeUuid, error: normalizeError(error) });
                        }
                    }

                    return ok({
                        assetUuid,
                        requested: nodeUuids.length,
                        restored,
                        failed,
                        successCount: restored.length,
                        failureCount: failed.length
                    });
                } catch (error: any) {
                    return fail('批量还原 Prefab 实例失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuids = toStringList(args?.nodeUuids);
                if (nodeUuids.length === 0) {
                    return fail('nodeUuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'reset-node', {
                        uuid: nodeUuids.length === 1 ? nodeUuids[0] : nodeUuids
                    });
                    return ok({ reset: true, nodeUuids });
                } catch (error: any) {
                    return fail('重置节点失败', normalizeError(error));
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
            run: async (args: any) => {
                const componentUuid = toNonEmptyString(args?.componentUuid);
                if (!componentUuid) {
                    return fail('componentUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'reset-component', { uuid: componentUuid });
                    return ok({ reset: true, componentUuid });
                } catch (error: any) {
                    return fail('重置组件失败', normalizeError(error));
                }
            }
        }
    ];
}
