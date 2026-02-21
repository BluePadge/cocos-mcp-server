import { EditorRequester, NextToolDefinition } from '../models';
import {
    coerceValueByKind,
    fail,
    normalizeError,
    normalizeValueKind,
    ok,
    readDumpString,
    toNonEmptyString,
    unwrapDumpValue,
    ValueKind
} from './common';

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

async function querySceneDirtySafe(requester: EditorRequester): Promise<boolean | null> {
    try {
        const dirty = await requester('scene', 'query-dirty');
        return dirty === true;
    } catch {
        return null;
    }
}

function normalizeValueKindByType(type: string): ValueKind | null {
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

function getDumpAtPath(componentDump: any, propertyPath: string): any {
    const segments = propertyPath
        .split('.')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    if (segments.length === 0) {
        return componentDump;
    }

    let current: any = componentDump;
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

async function inferValueKindForAuto(
    requester: EditorRequester,
    components: NormalizedComponent[],
    componentIndex: number,
    propertyPath: string
): Promise<ValueKind | null> {
    const target = components[componentIndex];
    const componentUuid = target?.uuid;
    if (!componentUuid) {
        return null;
    }

    try {
        const componentDump = await requester('scene', 'query-component', componentUuid);
        const propertyDump = getDumpAtPath(componentDump, propertyPath);
        if (propertyDump === undefined) {
            return null;
        }

        const explicitType = readDumpString((propertyDump as Record<string, any>)?.type);
        if (explicitType) {
            const byType = normalizeValueKindByType(explicitType);
            if (byType) {
                return byType;
            }
        }

        const raw = unwrapDumpValue(propertyDump);
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
    } catch {
        return null;
    }
}

interface SceneTreeSnapshot {
    uuids: Set<string>;
    parentByUuid: Map<string, string | null>;
}

function readNodeUuidValue(node: any): string | null {
    return readDumpString(node?.uuid) || readDumpString(node?.id) || null;
}

function buildSceneTreeSnapshot(node: any): SceneTreeSnapshot {
    const uuids = new Set<string>();
    const parentByUuid = new Map<string, string | null>();

    const walk = (current: any, parentUuid: string | null): void => {
        if (!current || typeof current !== 'object') {
            return;
        }

        const uuid = readNodeUuidValue(current);
        if (uuid) {
            uuids.add(uuid);
            parentByUuid.set(uuid, parentUuid);
        }

        const children = Array.isArray((current as Record<string, any>).children)
            ? (current as Record<string, any>).children
            : [];
        for (const child of children) {
            walk(child, uuid);
        }
    };

    walk(node, null);
    return { uuids, parentByUuid };
}

async function querySceneTreeSnapshotSafe(requester: EditorRequester): Promise<SceneTreeSnapshot | null> {
    try {
        const tree = await requester('scene', 'query-node-tree');
        if (!tree || typeof tree !== 'object') {
            return null;
        }
        return buildSceneTreeSnapshot(tree);
    } catch {
        return null;
    }
}

function areSnapshotsEqual(a: SceneTreeSnapshot, b: SceneTreeSnapshot): boolean {
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

function findAddedRootNodeUuids(before: SceneTreeSnapshot, after: SceneTreeSnapshot): string[] {
    const added = new Set<string>();
    for (const uuid of after.uuids) {
        if (!before.uuids.has(uuid)) {
            added.add(uuid);
        }
    }

    if (added.size === 0) {
        return [];
    }

    const roots: string[] = [];
    for (const uuid of added) {
        const parentUuid = after.parentByUuid.get(uuid) || null;
        if (!parentUuid || !added.has(parentUuid)) {
            roots.push(uuid);
        }
    }
    return roots;
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
            run: async (args: any) => {
                const nodeUuid = toNonEmptyString(args?.nodeUuid);
                const propertyPath = toNonEmptyString(args?.propertyPath);
                if (!nodeUuid || !propertyPath) {
                    return fail('nodeUuid/propertyPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const valueKind = normalizeValueKind(args?.valueKind);
                    if (!valueKind) {
                        return fail('valueKind 仅支持 auto/boolean/number/string/json', undefined, 'E_INVALID_ARGUMENT');
                    }

                    const components = await queryNodeComponents(requester, nodeUuid);
                    const componentIndex = resolveComponentIndex(components, args);
                    if (componentIndex < 0) {
                        return fail('无法定位目标组件，请提供有效的 componentIndex/componentUuid/componentType', undefined, 'E_COMPONENT_NOT_FOUND');
                    }

                    const inferredAutoKind = valueKind === 'auto'
                        ? await inferValueKindForAuto(requester, components, componentIndex, propertyPath)
                        : null;
                    const effectiveValueKind = inferredAutoKind || valueKind;
                    let coerced = coerceValueByKind(args?.value, effectiveValueKind);
                    if (!coerced.ok && valueKind === 'auto' && effectiveValueKind !== 'auto') {
                        coerced = coerceValueByKind(args?.value, 'auto');
                    }
                    if (!coerced.ok) {
                        return fail('属性值类型转换失败', coerced.error, 'E_INVALID_ARGUMENT');
                    }

                    const path = buildPropertyPath(componentIndex, propertyPath);
                    const dump: Record<string, any> = { value: coerced.value };
                    const valueType = toNonEmptyString(args?.valueType);
                    if (valueType) {
                        dump.type = valueType;
                    }

                    const dirtyBefore = await querySceneDirtySafe(requester);
                    const requestPayload: Record<string, any> = {
                        uuid: nodeUuid,
                        path,
                        dump
                    };
                    if (typeof args?.record === 'boolean') {
                        requestPayload.record = args.record;
                    }

                    const updated = await requester('scene', 'set-property', requestPayload);
                    const dirtyAfter = await querySceneDirtySafe(requester);
                    return ok({
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
            run: async (args: any) => {
                const componentUuid = toNonEmptyString(args?.componentUuid);
                if (!componentUuid) {
                    return fail('componentUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const component = await requester('scene', 'query-component', componentUuid);
                    return ok({
                        componentUuid,
                        component
                    });
                } catch (error: any) {
                    return fail('查询组件详情失败', normalizeError(error));
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
            run: async (args: any) => {
                const options = args?.options && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const classes = options
                        ? await requester('scene', 'query-classes', options)
                        : await requester('scene', 'query-classes');
                    const list = Array.isArray(classes) ? classes : [];
                    return ok({
                        options: options || null,
                        classes: list,
                        count: list.length
                    });
                } catch (error: any) {
                    return fail('查询组件类信息失败', normalizeError(error));
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
            run: async (args: any) => {
                const componentName = toNonEmptyString(args?.componentName);
                if (!componentName) {
                    return fail('componentName 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const hasScript = await requester('scene', 'query-component-has-script', componentName);
                    return ok({
                        componentName,
                        hasScript: hasScript === true
                    });
                } catch (error: any) {
                    return fail('查询组件脚本状态失败', normalizeError(error));
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
            run: async (args: any) => {
                const componentUuid = toNonEmptyString(args?.componentUuid);
                const methodName = toNonEmptyString(args?.methodName);
                if (!componentUuid || !methodName) {
                    return fail('componentUuid/methodName 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const methodArgs = Array.isArray(args?.args) ? args.args : [];
                const rollbackRequested = args?.rollbackAfterCall === true || args?.transient === true;
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
                    let rollbackMethod: string | null = null;
                    let rollbackVerified: boolean | null = rollbackRequested ? false : null;
                    const rollbackErrors: string[] = [];
                    let dirtyAfterRollback: boolean | null = dirtyAfterCall;
                    let treeAfterRollback: SceneTreeSnapshot | null = treeAfterCall;

                    if (rollbackRequested) {
                        if (treeBefore && treeAfterCall) {
                            const addedRoots = findAddedRootNodeUuids(treeBefore, treeAfterCall);
                            if (addedRoots.length > 0) {
                                rollbackMethod = 'remove-node';
                                for (const uuid of addedRoots) {
                                    try {
                                        await requester('scene', 'remove-node', { uuid });
                                    } catch (error: any) {
                                        rollbackErrors.push(`remove-node(${uuid}) 失败: ${normalizeError(error)}`);
                                    }
                                }
                            }
                        }

                        if (!rollbackMethod || rollbackErrors.length > 0) {
                            try {
                                await requester('scene', 'soft-reload');
                                rollbackMethod = 'soft-reload';
                            } catch (error: any) {
                                rollbackErrors.push(`soft-reload 失败: ${normalizeError(error)}`);
                            }
                        }

                        dirtyAfterRollback = await querySceneDirtySafe(requester);
                        treeAfterRollback = await querySceneTreeSnapshotSafe(requester);

                        if (treeBefore && treeAfterRollback) {
                            rollbackVerified = areSnapshotsEqual(treeBefore, treeAfterRollback);
                        } else if (dirtyAfterRollback !== null) {
                            rollbackVerified = dirtyAfterRollback === false;
                        } else {
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
                            return fail(
                                '执行组件方法成功，但回滚验证失败',
                                detailParts.join(' | '),
                                'E_RUNTIME_ROLLBACK_FAILED'
                            );
                        }
                        rollbackApplied = true;
                    }
                    const requiresSave = rollbackRequested
                        ? (dirtyAfterRollback === true || rollbackVerified === false)
                        : dirtyAfterCall === true;

                    return ok({
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
                } catch (error: any) {
                    return fail('执行组件方法失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuid = toNonEmptyString(args?.uuid);
                const path = toNonEmptyString(args?.path);
                if (!uuid || !path || !Number.isInteger(args?.target) || !Number.isInteger(args?.offset)) {
                    return fail('uuid/path/target/offset 必填且 target/offset 必须为整数', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const moved = await requester('scene', 'move-array-element', {
                        uuid,
                        path,
                        target: args.target,
                        offset: args.offset
                    });
                    return ok({
                        moved: moved === true,
                        uuid,
                        path,
                        target: args.target,
                        offset: args.offset
                    });
                } catch (error: any) {
                    return fail('移动数组元素失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuid = toNonEmptyString(args?.uuid);
                const path = toNonEmptyString(args?.path);
                if (!uuid || !path || !Number.isInteger(args?.index)) {
                    return fail('uuid/path/index 必填且 index 必须为整数', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const removed = await requester('scene', 'remove-array-element', {
                        uuid,
                        path,
                        index: args.index
                    });
                    return ok({
                        removed: removed === true,
                        uuid,
                        path,
                        index: args.index
                    });
                } catch (error: any) {
                    return fail('删除数组元素失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuid = toNonEmptyString(args?.uuid);
                const path = toNonEmptyString(args?.path);
                if (!uuid || !path) {
                    return fail('uuid/path 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const dump: Record<string, any> = {
                    value: Object.prototype.hasOwnProperty.call(args || {}, 'value') ? args.value : null
                };
                const valueType = toNonEmptyString(args?.valueType);
                if (valueType) {
                    dump.type = valueType;
                }

                const payload: Record<string, any> = {
                    uuid,
                    path,
                    dump
                };
                if (typeof args?.record === 'boolean') {
                    payload.record = args.record;
                }

                try {
                    const reset = await requester('scene', 'reset-property', payload);
                    return ok({
                        reset: reset === true,
                        uuid,
                        path,
                        dump
                    });
                } catch (error: any) {
                    return fail('重置属性失败', normalizeError(error));
                }
            }
        }
    ];
}
