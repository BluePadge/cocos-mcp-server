import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, readDumpString, toNonEmptyString } from './common';

interface NormalizedComponent {
    index: number;
    type: string;
    name?: string;
    uuid?: string;
}

function normalizeComponentType(raw: any): string {
    const candidates = [
        readDumpString(raw?.__type__),
        readDumpString(raw?.cid),
        readDumpString(raw?.type),
        readDumpString(raw?.name)
    ];
    const matched = candidates.find((item) => Boolean(item));
    return matched || 'Unknown';
}

function normalizeComponentUuid(raw: any): string | undefined {
    const candidates = [
        readDumpString(raw?.uuid),
        readDumpString(raw?.value?.uuid)
    ];
    const matched = candidates.find((item) => Boolean(item));
    return matched || undefined;
}

function normalizeComponentName(raw: any): string | undefined {
    const candidates = [
        readDumpString(raw?.name),
        readDumpString(raw?.value?.name)
    ];
    const matched = candidates.find((item) => Boolean(item));
    return matched || undefined;
}

function extractNodeComponents(node: any): NormalizedComponent[] {
    const rawComponents = Array.isArray(node?.__comps__) ? node.__comps__ : [];
    return rawComponents.map((item: any, index: number) => ({
        index,
        type: normalizeComponentType(item),
        name: normalizeComponentName(item),
        uuid: normalizeComponentUuid(item)
    }));
}

async function queryNodeComponents(requester: EditorRequester, nodeUuid: string): Promise<NormalizedComponent[]> {
    const node = await requester('scene', 'query-node', nodeUuid);
    return extractNodeComponents(node);
}

function resolveComponentIndex(components: NormalizedComponent[], args: any): number {
    if (typeof args?.componentIndex === 'number' && Number.isInteger(args.componentIndex) && args.componentIndex >= 0) {
        return args.componentIndex;
    }

    const componentUuid = toNonEmptyString(args?.componentUuid);
    if (componentUuid) {
        const hitByUuid = components.find((item) => item.uuid === componentUuid);
        if (hitByUuid) {
            return hitByUuid.index;
        }
    }

    const componentType = toNonEmptyString(args?.componentType);
    if (componentType) {
        const hitByType = components.find((item) => item.type === componentType);
        if (hitByType) {
            return hitByType.index;
        }
    }

    return -1;
}

function buildPropertyPath(componentIndex: number, propertyPath: string): string {
    if (propertyPath.startsWith('__comps__.')) {
        return propertyPath;
    }
    return `__comps__.${componentIndex}.${propertyPath}`;
}

export function createComponentPropertyTools(requester: EditorRequester): NextToolDefinition[] {
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const components = await queryNodeComponents(requester, nodeUuid);
                    return ok({
                        nodeUuid,
                        components,
                        count: components.length
                    });
                } catch (error: any) {
                    return fail('查询组件列表失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const componentType = toNonEmptyString(args?.componentType);
                if (!nodeUuid || !componentType) {
                    return fail('nodeUuid/componentType 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'create-component', {
                        uuid: nodeUuid,
                        component: componentType
                    });
                    return ok({
                        added: true,
                        nodeUuid,
                        componentType
                    });
                } catch (error: any) {
                    return fail('添加组件失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                if (!nodeUuid) {
                    return fail('nodeUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const componentUuid = toNonEmptyString(args?.componentUuid);
                const componentType = toNonEmptyString(args?.componentType);
                if (!componentUuid && !componentType) {
                    return fail('componentUuid 或 componentType 至少提供一个', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    let finalComponentUuid = componentUuid;
                    if (!finalComponentUuid) {
                        const components = await queryNodeComponents(requester, nodeUuid);
                        const matched = components.find((item) => item.type === componentType);
                        if (!matched) {
                            return fail(`未找到组件: ${componentType}`, undefined, 'E_COMPONENT_NOT_FOUND');
                        }
                        if (!matched.uuid) {
                            return fail(`组件缺少 UUID: ${componentType}`, undefined, 'E_COMPONENT_UUID_MISSING');
                        }
                        finalComponentUuid = matched.uuid;
                    }

                    await requester('scene', 'remove-component', { uuid: finalComponentUuid });
                    return ok({
                        removed: true,
                        nodeUuid,
                        componentUuid: finalComponentUuid,
                        componentType: componentType || undefined
                    });
                } catch (error: any) {
                    return fail('移除组件失败', normalizeError(error));
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const propertyPath = toNonEmptyString(args?.propertyPath);
                if (!nodeUuid || !propertyPath) {
                    return fail('nodeUuid/propertyPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const components = await queryNodeComponents(requester, nodeUuid);
                    const componentIndex = resolveComponentIndex(components, args);
                    if (componentIndex < 0) {
                        return fail('无法定位目标组件，请提供有效的 componentIndex/componentUuid/componentType', undefined, 'E_COMPONENT_NOT_FOUND');
                    }

                    const path = buildPropertyPath(componentIndex, propertyPath);
                    const dump: Record<string, any> = { value: args?.value };
                    const valueType = toNonEmptyString(args?.valueType);
                    if (valueType) {
                        dump.type = valueType;
                    }

                    const requestPayload: Record<string, any> = {
                        uuid: nodeUuid,
                        path,
                        dump
                    };
                    if (typeof args?.record === 'boolean') {
                        requestPayload.record = args.record;
                    }

                    const updated = await requester('scene', 'set-property', requestPayload);
                    return ok({
                        updated: updated === true,
                        nodeUuid,
                        componentIndex,
                        path,
                        dump
                    });
                } catch (error: any) {
                    return fail('设置组件属性失败', normalizeError(error));
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
                    return ok({
                        components,
                        count: Array.isArray(components) ? components.length : 0
                    });
                } catch (error: any) {
                    return fail('查询可用组件类型失败', normalizeError(error));
                }
            }
        }
    ];
}
