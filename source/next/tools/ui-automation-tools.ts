import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, readDumpString, toNonEmptyString } from './common';

type UiElementType = 'Node' | 'Canvas' | 'Label' | 'Sprite' | 'Button' | 'Layout';

interface UiComponentInfo {
    index: number;
    type: string;
    uuid?: string;
}

interface Vec2Like {
    x: number;
    y: number;
}

interface Vec3Like extends Vec2Like {
    z: number;
}

interface PaddingLike {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

function normalizeElementType(value: any): UiElementType {
    const normalized = toNonEmptyString(value)?.toLowerCase();
    if (!normalized) {
        return 'Node';
    }

    switch (normalized) {
    case 'canvas':
        return 'Canvas';
    case 'label':
        return 'Label';
    case 'sprite':
        return 'Sprite';
    case 'button':
        return 'Button';
    case 'layout':
        return 'Layout';
    default:
        return 'Node';
    }
}

function defaultNameByType(type: UiElementType): string {
    switch (type) {
    case 'Canvas':
        return 'Canvas';
    case 'Label':
        return 'Label';
    case 'Sprite':
        return 'Sprite';
    case 'Button':
        return 'Button';
    case 'Layout':
        return 'Layout';
    default:
        return 'Node';
    }
}

function toNumber(value: any): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function normalizeVec2(value: any): Vec2Like | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const x = toNumber(value.x);
    const y = toNumber(value.y);
    if (x === null || y === null) {
        return null;
    }
    return { x, y };
}

function normalizeVec3(value: any): Vec3Like | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const x = toNumber(value.x);
    const y = toNumber(value.y);
    const z = toNumber(value.z ?? 0);
    if (x === null || y === null || z === null) {
        return null;
    }
    return { x, y, z };
}

function normalizeNodeUuid(node: any): string | null {
    return readDumpString(node?.uuid) || null;
}

function normalizeNodeName(node: any): string | null {
    const direct = readDumpString(node?.name);
    if (direct) {
        return direct;
    }

    if (typeof node?.name === 'string' && node.name.trim() !== '') {
        return node.name.trim();
    }

    return null;
}

function normalizeComponentType(raw: any): string {
    const candidates = [
        readDumpString(raw?.__type__),
        readDumpString(raw?.cid),
        readDumpString(raw?.type),
        readDumpString(raw?.name)
    ];
    return candidates.find((item) => Boolean(item)) || 'Unknown';
}

function normalizeComponentUuid(raw: any): string | undefined {
    const candidates = [
        readDumpString(raw?.uuid),
        readDumpString(raw?.value?.uuid)
    ];
    return candidates.find((item) => Boolean(item)) || undefined;
}

function extractNodeComponents(node: any): UiComponentInfo[] {
    const rawComponents = Array.isArray(node?.__comps__) ? node.__comps__ : [];
    return rawComponents.map((item: any, index: number) => ({
        index,
        type: normalizeComponentType(item),
        uuid: normalizeComponentUuid(item)
    }));
}

function parsePath(path: string): string[] {
    return path
        .split('/')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function collectChildren(node: any): any[] {
    return Array.isArray(node?.children) ? node.children : [];
}

async function resolveNodeUuidByPath(requester: EditorRequester, path: string): Promise<string | null> {
    const segments = parsePath(path);
    if (segments.length === 0) {
        return null;
    }

    const tree = await requester('scene', 'query-node-tree');
    let cursor = tree;
    let index = 0;

    const rootName = normalizeNodeName(cursor);
    if (rootName && segments[0] === rootName) {
        index = 1;
    }

    while (index < segments.length) {
        const current = segments[index];
        const matched = collectChildren(cursor).find((child) => normalizeNodeName(child) === current);
        if (!matched) {
            return null;
        }
        cursor = matched;
        index += 1;
    }

    return normalizeNodeUuid(cursor);
}

async function resolveNodeUuid(
    requester: EditorRequester,
    nodeUuidArg: any,
    nodePathArg: any
): Promise<{ uuid: string | null; source: 'uuid' | 'path' | 'none' }> {
    const nodeUuid = toNonEmptyString(nodeUuidArg);
    if (nodeUuid) {
        return { uuid: nodeUuid, source: 'uuid' };
    }

    const nodePath = toNonEmptyString(nodePathArg);
    if (!nodePath) {
        return { uuid: null, source: 'none' };
    }

    const resolved = await resolveNodeUuidByPath(requester, nodePath);
    return { uuid: resolved, source: 'path' };
}

async function queryNodeComponents(requester: EditorRequester, nodeUuid: string): Promise<UiComponentInfo[]> {
    const node = await requester('scene', 'query-node', nodeUuid);
    return extractNodeComponents(node);
}

async function ensureComponent(
    requester: EditorRequester,
    nodeUuid: string,
    componentType: string
): Promise<{ index: number; uuid?: string; created: boolean }> {
    const before = await queryNodeComponents(requester, nodeUuid);
    const existed = before.find((item) => item.type === componentType);
    if (existed) {
        return { index: existed.index, uuid: existed.uuid, created: false };
    }

    await requester('scene', 'create-component', {
        uuid: nodeUuid,
        component: componentType
    });

    const after = await queryNodeComponents(requester, nodeUuid);
    const created = after.find((item) => item.type === componentType);
    if (!created) {
        throw new Error(`组件创建后未找到: ${componentType}`);
    }

    return { index: created.index, uuid: created.uuid, created: true };
}

async function setComponentProperty(
    requester: EditorRequester,
    nodeUuid: string,
    componentIndex: number,
    propertyPath: string,
    value: any,
    valueType?: string
): Promise<void> {
    const dump: Record<string, any> = { value };
    if (valueType) {
        dump.type = valueType;
    }

    await requester('scene', 'set-property', {
        uuid: nodeUuid,
        path: `__comps__.${componentIndex}.${propertyPath}`,
        dump
    });
}

async function setNodeProperty(
    requester: EditorRequester,
    nodeUuid: string,
    propertyPath: string,
    value: any,
    valueType?: string
): Promise<void> {
    const dump: Record<string, any> = { value };
    if (valueType) {
        dump.type = valueType;
    }

    await requester('scene', 'set-property', {
        uuid: nodeUuid,
        path: propertyPath,
        dump
    });
}

function parseSpacing(value: any): { x: number; y: number } | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return { x: value, y: value };
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parts = value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
            .map((item) => Number(item));
        if (parts.length === 1 && Number.isFinite(parts[0])) {
            return { x: parts[0], y: parts[0] };
        }
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            return { x: parts[0], y: parts[1] };
        }
        return null;
    }

    if (value && typeof value === 'object') {
        const x = toNumber(value.x ?? value.horizontal);
        const y = toNumber(value.y ?? value.vertical);
        if (x !== null && y !== null) {
            return { x, y };
        }
    }

    return null;
}

function parsePadding(value: any, args: any): PaddingLike | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return { left: value, right: value, top: value, bottom: value };
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parts = value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
            .map((item) => Number(item));
        if (parts.length === 1 && Number.isFinite(parts[0])) {
            return { left: parts[0], right: parts[0], top: parts[0], bottom: parts[0] };
        }
        if (parts.length >= 4 && parts.every((item) => Number.isFinite(item))) {
            return {
                left: parts[0],
                right: parts[1],
                top: parts[2],
                bottom: parts[3]
            };
        }
    }

    const left = toNumber(args?.paddingLeft ?? value?.left);
    const right = toNumber(args?.paddingRight ?? value?.right);
    const top = toNumber(args?.paddingTop ?? value?.top);
    const bottom = toNumber(args?.paddingBottom ?? value?.bottom);
    if (left !== null && right !== null && top !== null && bottom !== null) {
        return { left, right, top, bottom };
    }

    return null;
}

function normalizeLayoutType(value: any): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }

    const normalized = toNonEmptyString(value)?.toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized === 'none') {
        return 0;
    }
    if (normalized === 'horizontal') {
        return 1;
    }
    if (normalized === 'vertical') {
        return 2;
    }
    if (normalized === 'grid') {
        return 3;
    }
    return null;
}

function normalizeResizeMode(value: any): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }

    const normalized = toNonEmptyString(value)?.toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized === 'none') {
        return 0;
    }
    if (normalized === 'container') {
        return 1;
    }
    if (normalized === 'children') {
        return 2;
    }
    return null;
}

function normalizeHorizontalAlign(value: any): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }

    const normalized = toNonEmptyString(value)?.toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized === 'left') {
        return 0;
    }
    if (normalized === 'center' || normalized === 'middle') {
        return 1;
    }
    if (normalized === 'right') {
        return 2;
    }
    return null;
}

function normalizeVerticalAlign(value: any): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }

    const normalized = toNonEmptyString(value)?.toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized === 'top') {
        return 0;
    }
    if (normalized === 'center' || normalized === 'middle') {
        return 1;
    }
    if (normalized === 'bottom') {
        return 2;
    }
    return null;
}

async function findFirstCanvasUuid(requester: EditorRequester): Promise<string | null> {
    const tree = await requester('scene', 'query-node-tree');
    const queue: any[] = [tree];

    while (queue.length > 0) {
        const node = queue.shift();
        const uuid = normalizeNodeUuid(node);
        if (uuid) {
            const components = await queryNodeComponents(requester, uuid);
            if (components.some((item) => item.type === 'cc.Canvas')) {
                return uuid;
            }
        }
        queue.push(...collectChildren(node));
    }

    return null;
}

export function createUiAutomationTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        {
            name: 'ui_create_element',
            description: '创建 UI 节点并自动补齐常用组件（Canvas/Label/Sprite/Button/Layout）',
            layer: 'official',
            category: 'ui',
            inputSchema: {
                type: 'object',
                properties: {
                    elementType: { type: 'string', description: 'UI 元素类型：Node/Canvas/Label/Sprite/Button/Layout' },
                    elementName: { type: 'string', description: 'UI 元素名称' },
                    parentUuid: { type: 'string', description: '父节点 UUID（可选）' },
                    parentPath: { type: 'string', description: '父节点路径（可选，格式：Canvas/Panel）' },
                    ensureCanvas: { type: 'boolean', description: '未指定父节点时是否自动挂到 Canvas，默认 true' },
                    position: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    }
                }
            },
            requiredCapabilities: ['scene.query-node-tree', 'scene.query-node', 'scene.create-node', 'scene.create-component'],
            run: async (args: any) => {
                try {
                    const elementType = normalizeElementType(args?.elementType);
                    const elementName = toNonEmptyString(args?.elementName) || defaultNameByType(elementType);
                    const ensureCanvas = args?.ensureCanvas !== false;
                    const position = normalizeVec3(args?.position);

                    const parentResolved = await resolveNodeUuid(requester, args?.parentUuid, args?.parentPath);
                    let parentUuid = parentResolved.uuid;
                    const warnings: string[] = [];

                    if (!parentUuid && ensureCanvas && elementType !== 'Canvas') {
                        let canvasUuid = await findFirstCanvasUuid(requester);
                        if (!canvasUuid) {
                            const createdCanvasUuid = await requester('scene', 'create-node', { name: 'Canvas' });
                            canvasUuid = String(createdCanvasUuid);
                            await ensureComponent(requester, canvasUuid, 'cc.Canvas');
                            await ensureComponent(requester, canvasUuid, 'cc.UITransform');
                        }
                        parentUuid = canvasUuid;
                    }

                    const createOptions: Record<string, any> = { name: elementName };
                    if (parentUuid) {
                        createOptions.parent = parentUuid;
                    }
                    if (position) {
                        createOptions.position = position;
                    }

                    const nodeUuid = await requester('scene', 'create-node', createOptions);
                    const ensuredComponents: string[] = [];

                    const ensureAndMark = async (componentType: string): Promise<void> => {
                        await ensureComponent(requester, nodeUuid, componentType);
                        ensuredComponents.push(componentType);
                    };

                    if (elementType === 'Canvas') {
                        await ensureAndMark('cc.Canvas');
                        await ensureAndMark('cc.UITransform');
                    } else if (elementType === 'Label') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Label');
                    } else if (elementType === 'Sprite') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Sprite');
                    } else if (elementType === 'Button') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Sprite');
                        await ensureAndMark('cc.Button');
                    } else if (elementType === 'Layout') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Layout');
                    } else if (ensureCanvas) {
                        await ensureAndMark('cc.UITransform');
                    }

                    if (parentResolved.source === 'path' && !parentResolved.uuid) {
                        warnings.push('parentPath 未解析成功，已退回默认父节点策略');
                    }

                    return ok({
                        created: true,
                        nodeUuid,
                        elementType,
                        elementName,
                        parentUuid: parentUuid || null,
                        ensuredComponents,
                        warnings
                    });
                } catch (error: any) {
                    return fail('创建 UI 元素失败', normalizeError(error));
                }
            }
        },
        {
            name: 'ui_set_rect_transform',
            description: '设置 UITransform（尺寸/锚点）及节点位置',
            layer: 'official',
            category: 'ui',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    nodePath: { type: 'string', description: '目标节点路径（可选）' },
                    size: {
                        type: 'object',
                        properties: {
                            width: { type: 'number' },
                            height: { type: 'number' }
                        }
                    },
                    anchor: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' }
                        }
                    },
                    anchorMin: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' }
                        }
                    },
                    anchorMax: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' }
                        }
                    },
                    pivot: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' }
                        }
                    },
                    position: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    }
                }
            },
            requiredCapabilities: ['scene.query-node-tree', 'scene.query-node', 'scene.create-component', 'scene.set-property'],
            run: async (args: any) => {
                try {
                    const resolved = await resolveNodeUuid(requester, args?.nodeUuid, args?.nodePath);
                    if (!resolved.uuid) {
                        return fail('nodeUuid 或 nodePath 必填且必须可解析', undefined, 'E_INVALID_ARGUMENT');
                    }

                    const nodeUuid = resolved.uuid;
                    const warnings: string[] = [];
                    const updates: string[] = [];
                    const uiTransform = await ensureComponent(requester, nodeUuid, 'cc.UITransform');

                    const size = args?.size && typeof args.size === 'object'
                        ? { width: toNumber(args.size.width), height: toNumber(args.size.height) }
                        : null;
                    if (size && size.width !== null && size.height !== null) {
                        await setComponentProperty(requester, nodeUuid, uiTransform.index, 'contentSize', {
                            width: size.width,
                            height: size.height
                        }, 'cc.Size');
                        updates.push('contentSize');
                    }

                    const anchor = normalizeVec2(args?.anchor);
                    const anchorMin = normalizeVec2(args?.anchorMin);
                    const anchorMax = normalizeVec2(args?.anchorMax);
                    const pivot = normalizeVec2(args?.pivot);
                    let finalAnchor: Vec2Like | null = anchor;

                    if (!finalAnchor && anchorMin && anchorMax) {
                        finalAnchor = anchorMin;
                        if (Math.abs(anchorMin.x - anchorMax.x) > 1e-6 || Math.abs(anchorMin.y - anchorMax.y) > 1e-6) {
                            warnings.push('Cocos UITransform 不支持 anchorMin/anchorMax 分离语义，已使用 anchorMin');
                        }
                    }

                    if (!finalAnchor && pivot) {
                        finalAnchor = pivot;
                        warnings.push('Cocos UITransform 无独立 pivot 属性，已将 pivot 映射为 anchorPoint');
                    }

                    if (finalAnchor) {
                        await setComponentProperty(requester, nodeUuid, uiTransform.index, 'anchorPoint', finalAnchor, 'cc.Vec2');
                        updates.push('anchorPoint');
                    }

                    const position = normalizeVec3(args?.position);
                    if (position) {
                        await setNodeProperty(requester, nodeUuid, 'position', position, 'cc.Vec3');
                        updates.push('position');
                    }

                    return ok({
                        updated: updates.length > 0,
                        nodeUuid,
                        updates,
                        warnings
                    });
                } catch (error: any) {
                    return fail('设置 UITransform 失败', normalizeError(error));
                }
            }
        },
        {
            name: 'ui_set_text',
            description: '设置 Label 文本相关属性（文本/字号/对齐/颜色）',
            layer: 'official',
            category: 'ui',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    nodePath: { type: 'string', description: '目标节点路径（可选）' },
                    text: { type: 'string', description: '文本内容' },
                    fontSize: { type: 'number', description: '字体大小' },
                    lineHeight: { type: 'number', description: '行高' },
                    color: {
                        type: 'object',
                        properties: {
                            r: { type: 'number' },
                            g: { type: 'number' },
                            b: { type: 'number' },
                            a: { type: 'number' }
                        }
                    },
                    horizontalAlign: { type: ['string', 'number'], description: '水平对齐：left/center/right 或枚举值' },
                    verticalAlign: { type: ['string', 'number'], description: '垂直对齐：top/center/bottom 或枚举值' }
                }
            },
            requiredCapabilities: ['scene.query-node-tree', 'scene.query-node', 'scene.create-component', 'scene.set-property'],
            run: async (args: any) => {
                try {
                    const resolved = await resolveNodeUuid(requester, args?.nodeUuid, args?.nodePath);
                    if (!resolved.uuid) {
                        return fail('nodeUuid 或 nodePath 必填且必须可解析', undefined, 'E_INVALID_ARGUMENT');
                    }

                    const nodeUuid = resolved.uuid;
                    const label = await ensureComponent(requester, nodeUuid, 'cc.Label');
                    const updates: string[] = [];

                    const text = args?.text;
                    if (typeof text === 'string') {
                        await setComponentProperty(requester, nodeUuid, label.index, 'string', text);
                        updates.push('string');
                    }

                    const fontSize = toNumber(args?.fontSize);
                    if (fontSize !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'fontSize', fontSize);
                        updates.push('fontSize');
                    }

                    const lineHeight = toNumber(args?.lineHeight);
                    if (lineHeight !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'lineHeight', lineHeight);
                        updates.push('lineHeight');
                    }

                    const color = args?.color;
                    if (color && typeof color === 'object') {
                        const r = toNumber(color.r);
                        const g = toNumber(color.g);
                        const b = toNumber(color.b);
                        const a = toNumber(color.a ?? 255);
                        if (r !== null && g !== null && b !== null && a !== null) {
                            await setComponentProperty(requester, nodeUuid, label.index, 'color', { r, g, b, a }, 'cc.Color');
                            updates.push('color');
                        }
                    }

                    const horizontalAlign = normalizeHorizontalAlign(args?.horizontalAlign);
                    if (horizontalAlign !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'horizontalAlign', horizontalAlign);
                        updates.push('horizontalAlign');
                    }

                    const verticalAlign = normalizeVerticalAlign(args?.verticalAlign);
                    if (verticalAlign !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'verticalAlign', verticalAlign);
                        updates.push('verticalAlign');
                    }

                    return ok({
                        updated: updates.length > 0,
                        nodeUuid,
                        updates
                    });
                } catch (error: any) {
                    return fail('设置文本属性失败', normalizeError(error));
                }
            }
        },
        {
            name: 'ui_set_layout',
            description: '设置 Layout 组件常用属性（布局类型/间距/边距/尺寸模式）',
            layer: 'official',
            category: 'ui',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string', description: '目标节点 UUID' },
                    nodePath: { type: 'string', description: '目标节点路径（可选）' },
                    layoutType: { type: ['string', 'number'], description: '布局类型：none/horizontal/vertical/grid 或枚举值' },
                    resizeMode: { type: ['string', 'number'], description: '尺寸模式：none/container/children 或枚举值' },
                    spacing: {
                        oneOf: [
                            { type: 'number' },
                            {
                                type: 'object',
                                properties: {
                                    x: { type: 'number' },
                                    y: { type: 'number' }
                                }
                            },
                            { type: 'string', description: '格式：x,y 或单值' }
                        ]
                    },
                    padding: {
                        oneOf: [
                            { type: 'number' },
                            { type: 'string', description: '格式：left,right,top,bottom 或单值' },
                            {
                                type: 'object',
                                properties: {
                                    left: { type: 'number' },
                                    right: { type: 'number' },
                                    top: { type: 'number' },
                                    bottom: { type: 'number' }
                                }
                            }
                        ]
                    },
                    paddingLeft: { type: 'number' },
                    paddingRight: { type: 'number' },
                    paddingTop: { type: 'number' },
                    paddingBottom: { type: 'number' },
                    affectedByScale: { type: 'boolean', description: '布局计算是否受子节点缩放影响' }
                }
            },
            requiredCapabilities: ['scene.query-node-tree', 'scene.query-node', 'scene.create-component', 'scene.set-property'],
            run: async (args: any) => {
                try {
                    const resolved = await resolveNodeUuid(requester, args?.nodeUuid, args?.nodePath);
                    if (!resolved.uuid) {
                        return fail('nodeUuid 或 nodePath 必填且必须可解析', undefined, 'E_INVALID_ARGUMENT');
                    }

                    const nodeUuid = resolved.uuid;
                    const layout = await ensureComponent(requester, nodeUuid, 'cc.Layout');
                    const updates: string[] = [];

                    const layoutType = normalizeLayoutType(args?.layoutType);
                    if (layoutType !== null) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'type', layoutType);
                        updates.push('type');
                    }

                    const resizeMode = normalizeResizeMode(args?.resizeMode);
                    if (resizeMode !== null) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'resizeMode', resizeMode);
                        updates.push('resizeMode');
                    }

                    const spacing = parseSpacing(args?.spacing);
                    if (spacing) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'spacingX', spacing.x);
                        await setComponentProperty(requester, nodeUuid, layout.index, 'spacingY', spacing.y);
                        updates.push('spacingX');
                        updates.push('spacingY');
                    }

                    const padding = parsePadding(args?.padding, args);
                    if (padding) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'paddingLeft', padding.left);
                        await setComponentProperty(requester, nodeUuid, layout.index, 'paddingRight', padding.right);
                        await setComponentProperty(requester, nodeUuid, layout.index, 'paddingTop', padding.top);
                        await setComponentProperty(requester, nodeUuid, layout.index, 'paddingBottom', padding.bottom);
                        updates.push('paddingLeft');
                        updates.push('paddingRight');
                        updates.push('paddingTop');
                        updates.push('paddingBottom');
                    }

                    if (typeof args?.affectedByScale === 'boolean') {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'affectedByScale', args.affectedByScale);
                        updates.push('affectedByScale');
                    }

                    return ok({
                        updated: updates.length > 0,
                        nodeUuid,
                        updates
                    });
                } catch (error: any) {
                    return fail('设置 Layout 属性失败', normalizeError(error));
                }
            }
        }
    ];
}
