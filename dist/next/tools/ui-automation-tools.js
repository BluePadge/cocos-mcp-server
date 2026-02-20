"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUiAutomationTools = createUiAutomationTools;
const common_1 = require("./common");
function normalizeElementType(value) {
    var _a;
    const normalized = (_a = (0, common_1.toNonEmptyString)(value)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
function defaultNameByType(type) {
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
function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
function normalizeVec2(value) {
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
function normalizeVec3(value) {
    var _a;
    if (!value || typeof value !== 'object') {
        return null;
    }
    const x = toNumber(value.x);
    const y = toNumber(value.y);
    const z = toNumber((_a = value.z) !== null && _a !== void 0 ? _a : 0);
    if (x === null || y === null || z === null) {
        return null;
    }
    return { x, y, z };
}
function normalizeNodeUuid(node) {
    return (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.uuid) || null;
}
function normalizeNodeName(node) {
    const direct = (0, common_1.readDumpString)(node === null || node === void 0 ? void 0 : node.name);
    if (direct) {
        return direct;
    }
    if (typeof (node === null || node === void 0 ? void 0 : node.name) === 'string' && node.name.trim() !== '') {
        return node.name.trim();
    }
    return null;
}
function normalizeComponentType(raw) {
    const candidates = [
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.__type__),
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.cid),
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.type),
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.name)
    ];
    return candidates.find((item) => Boolean(item)) || 'Unknown';
}
function normalizeComponentUuid(raw) {
    var _a;
    const candidates = [
        (0, common_1.readDumpString)(raw === null || raw === void 0 ? void 0 : raw.uuid),
        (0, common_1.readDumpString)((_a = raw === null || raw === void 0 ? void 0 : raw.value) === null || _a === void 0 ? void 0 : _a.uuid)
    ];
    return candidates.find((item) => Boolean(item)) || undefined;
}
function extractNodeComponents(node) {
    const rawComponents = Array.isArray(node === null || node === void 0 ? void 0 : node.__comps__) ? node.__comps__ : [];
    return rawComponents.map((item, index) => ({
        index,
        type: normalizeComponentType(item),
        uuid: normalizeComponentUuid(item)
    }));
}
function parsePath(path) {
    return path
        .split('/')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
function collectChildren(node) {
    return Array.isArray(node === null || node === void 0 ? void 0 : node.children) ? node.children : [];
}
async function resolveNodeUuidByPath(requester, path) {
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
async function resolveNodeUuid(requester, nodeUuidArg, nodePathArg) {
    const nodeUuid = (0, common_1.toNonEmptyString)(nodeUuidArg);
    if (nodeUuid) {
        return { uuid: nodeUuid, source: 'uuid' };
    }
    const nodePath = (0, common_1.toNonEmptyString)(nodePathArg);
    if (!nodePath) {
        return { uuid: null, source: 'none' };
    }
    const resolved = await resolveNodeUuidByPath(requester, nodePath);
    return { uuid: resolved, source: 'path' };
}
async function queryNodeComponents(requester, nodeUuid) {
    const node = await requester('scene', 'query-node', nodeUuid);
    return extractNodeComponents(node);
}
async function ensureComponent(requester, nodeUuid, componentType) {
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
async function setComponentProperty(requester, nodeUuid, componentIndex, propertyPath, value, valueType) {
    const dump = { value };
    if (valueType) {
        dump.type = valueType;
    }
    await requester('scene', 'set-property', {
        uuid: nodeUuid,
        path: `__comps__.${componentIndex}.${propertyPath}`,
        dump
    });
}
async function setNodeProperty(requester, nodeUuid, propertyPath, value, valueType) {
    const dump = { value };
    if (valueType) {
        dump.type = valueType;
    }
    await requester('scene', 'set-property', {
        uuid: nodeUuid,
        path: propertyPath,
        dump
    });
}
function parseSpacing(value) {
    var _a, _b;
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
        const x = toNumber((_a = value.x) !== null && _a !== void 0 ? _a : value.horizontal);
        const y = toNumber((_b = value.y) !== null && _b !== void 0 ? _b : value.vertical);
        if (x !== null && y !== null) {
            return { x, y };
        }
    }
    return null;
}
function parsePadding(value, args) {
    var _a, _b, _c, _d;
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
    const left = toNumber((_a = args === null || args === void 0 ? void 0 : args.paddingLeft) !== null && _a !== void 0 ? _a : value === null || value === void 0 ? void 0 : value.left);
    const right = toNumber((_b = args === null || args === void 0 ? void 0 : args.paddingRight) !== null && _b !== void 0 ? _b : value === null || value === void 0 ? void 0 : value.right);
    const top = toNumber((_c = args === null || args === void 0 ? void 0 : args.paddingTop) !== null && _c !== void 0 ? _c : value === null || value === void 0 ? void 0 : value.top);
    const bottom = toNumber((_d = args === null || args === void 0 ? void 0 : args.paddingBottom) !== null && _d !== void 0 ? _d : value === null || value === void 0 ? void 0 : value.bottom);
    if (left !== null && right !== null && top !== null && bottom !== null) {
        return { left, right, top, bottom };
    }
    return null;
}
function normalizeLayoutType(value) {
    var _a;
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    const normalized = (_a = (0, common_1.toNonEmptyString)(value)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
function normalizeResizeMode(value) {
    var _a;
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    const normalized = (_a = (0, common_1.toNonEmptyString)(value)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
function normalizeHorizontalAlign(value) {
    var _a;
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    const normalized = (_a = (0, common_1.toNonEmptyString)(value)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
function normalizeVerticalAlign(value) {
    var _a;
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    const normalized = (_a = (0, common_1.toNonEmptyString)(value)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
async function findFirstCanvasUuid(requester) {
    const tree = await requester('scene', 'query-node-tree');
    const queue = [tree];
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
function createUiAutomationTools(requester) {
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
            run: async (args) => {
                try {
                    const elementType = normalizeElementType(args === null || args === void 0 ? void 0 : args.elementType);
                    const elementName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.elementName) || defaultNameByType(elementType);
                    const ensureCanvas = (args === null || args === void 0 ? void 0 : args.ensureCanvas) !== false;
                    const position = normalizeVec3(args === null || args === void 0 ? void 0 : args.position);
                    const parentResolved = await resolveNodeUuid(requester, args === null || args === void 0 ? void 0 : args.parentUuid, args === null || args === void 0 ? void 0 : args.parentPath);
                    let parentUuid = parentResolved.uuid;
                    const warnings = [];
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
                    const createOptions = { name: elementName };
                    if (parentUuid) {
                        createOptions.parent = parentUuid;
                    }
                    if (position) {
                        createOptions.position = position;
                    }
                    const nodeUuid = await requester('scene', 'create-node', createOptions);
                    const ensuredComponents = [];
                    const ensureAndMark = async (componentType) => {
                        await ensureComponent(requester, nodeUuid, componentType);
                        ensuredComponents.push(componentType);
                    };
                    if (elementType === 'Canvas') {
                        await ensureAndMark('cc.Canvas');
                        await ensureAndMark('cc.UITransform');
                    }
                    else if (elementType === 'Label') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Label');
                    }
                    else if (elementType === 'Sprite') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Sprite');
                    }
                    else if (elementType === 'Button') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Sprite');
                        await ensureAndMark('cc.Button');
                    }
                    else if (elementType === 'Layout') {
                        await ensureAndMark('cc.UITransform');
                        await ensureAndMark('cc.Layout');
                    }
                    else if (ensureCanvas) {
                        await ensureAndMark('cc.UITransform');
                    }
                    if (parentResolved.source === 'path' && !parentResolved.uuid) {
                        warnings.push('parentPath 未解析成功，已退回默认父节点策略');
                    }
                    return (0, common_1.ok)({
                        created: true,
                        nodeUuid,
                        elementType,
                        elementName,
                        parentUuid: parentUuid || null,
                        ensuredComponents,
                        warnings
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('创建 UI 元素失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                try {
                    const resolved = await resolveNodeUuid(requester, args === null || args === void 0 ? void 0 : args.nodeUuid, args === null || args === void 0 ? void 0 : args.nodePath);
                    if (!resolved.uuid) {
                        return (0, common_1.fail)('nodeUuid 或 nodePath 必填且必须可解析', undefined, 'E_INVALID_ARGUMENT');
                    }
                    const nodeUuid = resolved.uuid;
                    const warnings = [];
                    const updates = [];
                    const uiTransform = await ensureComponent(requester, nodeUuid, 'cc.UITransform');
                    const size = (args === null || args === void 0 ? void 0 : args.size) && typeof args.size === 'object'
                        ? { width: toNumber(args.size.width), height: toNumber(args.size.height) }
                        : null;
                    if (size && size.width !== null && size.height !== null) {
                        await setComponentProperty(requester, nodeUuid, uiTransform.index, 'contentSize', {
                            width: size.width,
                            height: size.height
                        }, 'cc.Size');
                        updates.push('contentSize');
                    }
                    const anchor = normalizeVec2(args === null || args === void 0 ? void 0 : args.anchor);
                    const anchorMin = normalizeVec2(args === null || args === void 0 ? void 0 : args.anchorMin);
                    const anchorMax = normalizeVec2(args === null || args === void 0 ? void 0 : args.anchorMax);
                    const pivot = normalizeVec2(args === null || args === void 0 ? void 0 : args.pivot);
                    let finalAnchor = anchor;
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
                    const position = normalizeVec3(args === null || args === void 0 ? void 0 : args.position);
                    if (position) {
                        await setNodeProperty(requester, nodeUuid, 'position', position, 'cc.Vec3');
                        updates.push('position');
                    }
                    return (0, common_1.ok)({
                        updated: updates.length > 0,
                        nodeUuid,
                        updates,
                        warnings
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 UITransform 失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                var _a;
                try {
                    const resolved = await resolveNodeUuid(requester, args === null || args === void 0 ? void 0 : args.nodeUuid, args === null || args === void 0 ? void 0 : args.nodePath);
                    if (!resolved.uuid) {
                        return (0, common_1.fail)('nodeUuid 或 nodePath 必填且必须可解析', undefined, 'E_INVALID_ARGUMENT');
                    }
                    const nodeUuid = resolved.uuid;
                    const label = await ensureComponent(requester, nodeUuid, 'cc.Label');
                    const updates = [];
                    const text = args === null || args === void 0 ? void 0 : args.text;
                    if (typeof text === 'string') {
                        await setComponentProperty(requester, nodeUuid, label.index, 'string', text);
                        updates.push('string');
                    }
                    const fontSize = toNumber(args === null || args === void 0 ? void 0 : args.fontSize);
                    if (fontSize !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'fontSize', fontSize);
                        updates.push('fontSize');
                    }
                    const lineHeight = toNumber(args === null || args === void 0 ? void 0 : args.lineHeight);
                    if (lineHeight !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'lineHeight', lineHeight);
                        updates.push('lineHeight');
                    }
                    const color = args === null || args === void 0 ? void 0 : args.color;
                    if (color && typeof color === 'object') {
                        const r = toNumber(color.r);
                        const g = toNumber(color.g);
                        const b = toNumber(color.b);
                        const a = toNumber((_a = color.a) !== null && _a !== void 0 ? _a : 255);
                        if (r !== null && g !== null && b !== null && a !== null) {
                            await setComponentProperty(requester, nodeUuid, label.index, 'color', { r, g, b, a }, 'cc.Color');
                            updates.push('color');
                        }
                    }
                    const horizontalAlign = normalizeHorizontalAlign(args === null || args === void 0 ? void 0 : args.horizontalAlign);
                    if (horizontalAlign !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'horizontalAlign', horizontalAlign);
                        updates.push('horizontalAlign');
                    }
                    const verticalAlign = normalizeVerticalAlign(args === null || args === void 0 ? void 0 : args.verticalAlign);
                    if (verticalAlign !== null) {
                        await setComponentProperty(requester, nodeUuid, label.index, 'verticalAlign', verticalAlign);
                        updates.push('verticalAlign');
                    }
                    return (0, common_1.ok)({
                        updated: updates.length > 0,
                        nodeUuid,
                        updates
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置文本属性失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                try {
                    const resolved = await resolveNodeUuid(requester, args === null || args === void 0 ? void 0 : args.nodeUuid, args === null || args === void 0 ? void 0 : args.nodePath);
                    if (!resolved.uuid) {
                        return (0, common_1.fail)('nodeUuid 或 nodePath 必填且必须可解析', undefined, 'E_INVALID_ARGUMENT');
                    }
                    const nodeUuid = resolved.uuid;
                    const layout = await ensureComponent(requester, nodeUuid, 'cc.Layout');
                    const updates = [];
                    const layoutType = normalizeLayoutType(args === null || args === void 0 ? void 0 : args.layoutType);
                    if (layoutType !== null) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'type', layoutType);
                        updates.push('type');
                    }
                    const resizeMode = normalizeResizeMode(args === null || args === void 0 ? void 0 : args.resizeMode);
                    if (resizeMode !== null) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'resizeMode', resizeMode);
                        updates.push('resizeMode');
                    }
                    const spacing = parseSpacing(args === null || args === void 0 ? void 0 : args.spacing);
                    if (spacing) {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'spacingX', spacing.x);
                        await setComponentProperty(requester, nodeUuid, layout.index, 'spacingY', spacing.y);
                        updates.push('spacingX');
                        updates.push('spacingY');
                    }
                    const padding = parsePadding(args === null || args === void 0 ? void 0 : args.padding, args);
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
                    if (typeof (args === null || args === void 0 ? void 0 : args.affectedByScale) === 'boolean') {
                        await setComponentProperty(requester, nodeUuid, layout.index, 'affectedByScale', args.affectedByScale);
                        updates.push('affectedByScale');
                    }
                    return (0, common_1.ok)({
                        updated: updates.length > 0,
                        nodeUuid,
                        updates
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 Layout 属性失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWktYXV0b21hdGlvbi10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL3VpLWF1dG9tYXRpb24tdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUEyYkEsMERBa2FDO0FBNTFCRCxxQ0FBc0Y7QUEwQnRGLFNBQVMsb0JBQW9CLENBQUMsS0FBVTs7SUFDcEMsTUFBTSxVQUFVLEdBQUcsTUFBQSxJQUFBLHlCQUFnQixFQUFDLEtBQUssQ0FBQywwQ0FBRSxXQUFXLEVBQUUsQ0FBQztJQUMxRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZCxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0lBRUQsUUFBUSxVQUFVLEVBQUUsQ0FBQztRQUNyQixLQUFLLFFBQVE7WUFDVCxPQUFPLFFBQVEsQ0FBQztRQUNwQixLQUFLLE9BQU87WUFDUixPQUFPLE9BQU8sQ0FBQztRQUNuQixLQUFLLFFBQVE7WUFDVCxPQUFPLFFBQVEsQ0FBQztRQUNwQixLQUFLLFFBQVE7WUFDVCxPQUFPLFFBQVEsQ0FBQztRQUNwQixLQUFLLFFBQVE7WUFDVCxPQUFPLFFBQVEsQ0FBQztRQUNwQjtZQUNJLE9BQU8sTUFBTSxDQUFDO0lBQ2xCLENBQUM7QUFDTCxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFtQjtJQUMxQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2YsS0FBSyxRQUFRO1lBQ1QsT0FBTyxRQUFRLENBQUM7UUFDcEIsS0FBSyxPQUFPO1lBQ1IsT0FBTyxPQUFPLENBQUM7UUFDbkIsS0FBSyxRQUFRO1lBQ1QsT0FBTyxRQUFRLENBQUM7UUFDcEIsS0FBSyxRQUFRO1lBQ1QsT0FBTyxRQUFRLENBQUM7UUFDcEIsS0FBSyxRQUFRO1lBQ1QsT0FBTyxRQUFRLENBQUM7UUFDcEI7WUFDSSxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLEtBQVU7SUFDeEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFCLE9BQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDN0MsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLEtBQVU7SUFDN0IsSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBQ0QsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVCLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDM0IsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUNELE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7QUFDcEIsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLEtBQVU7O0lBQzdCLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDdEMsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUNELE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUIsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBQSxLQUFLLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLENBQUMsQ0FBQztJQUNqQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDekMsT0FBTyxJQUFJLENBQUM7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RSxDQUFDO3dCQUM3QyxNQUFNLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBQ3ZHLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztvQkFDcEMsQ0FBQztvQkFFRCxPQUFPLElBQUEsV0FBRSxFQUFDO3dCQUNOLE9BQU8sRUFBRSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUM7d0JBQzNCLFFBQVE7d0JBQ1IsT0FBTztxQkFDVixDQUFDLENBQUM7Z0JBQ1AsQ0FBQztnQkFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO29CQUNsQixPQUFPLElBQUEsYUFBSSxFQUFDLGdCQUFnQixFQUFFLElBQUEsdUJBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxDQUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHJlYWREdW1wU3RyaW5nLCB0b05vbkVtcHR5U3RyaW5nIH0gZnJvbSAnLi9jb21tb24nO1xuXG50eXBlIFVpRWxlbWVudFR5cGUgPSAnTm9kZScgfCAnQ2FudmFzJyB8ICdMYWJlbCcgfCAnU3ByaXRlJyB8ICdCdXR0b24nIHwgJ0xheW91dCc7XG5cbmludGVyZmFjZSBVaUNvbXBvbmVudEluZm8ge1xuICAgIGluZGV4OiBudW1iZXI7XG4gICAgdHlwZTogc3RyaW5nO1xuICAgIHV1aWQ/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBWZWMyTGlrZSB7XG4gICAgeDogbnVtYmVyO1xuICAgIHk6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFZlYzNMaWtlIGV4dGVuZHMgVmVjMkxpa2Uge1xuICAgIHo6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFBhZGRpbmdMaWtlIHtcbiAgICBsZWZ0OiBudW1iZXI7XG4gICAgcmlnaHQ6IG51bWJlcjtcbiAgICB0b3A6IG51bWJlcjtcbiAgICBib3R0b206IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRWxlbWVudFR5cGUodmFsdWU6IGFueSk6IFVpRWxlbWVudFR5cGUge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0b05vbkVtcHR5U3RyaW5nKHZhbHVlKT8udG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcbiAgICAgICAgcmV0dXJuICdOb2RlJztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKG5vcm1hbGl6ZWQpIHtcbiAgICBjYXNlICdjYW52YXMnOlxuICAgICAgICByZXR1cm4gJ0NhbnZhcyc7XG4gICAgY2FzZSAnbGFiZWwnOlxuICAgICAgICByZXR1cm4gJ0xhYmVsJztcbiAgICBjYXNlICdzcHJpdGUnOlxuICAgICAgICByZXR1cm4gJ1Nwcml0ZSc7XG4gICAgY2FzZSAnYnV0dG9uJzpcbiAgICAgICAgcmV0dXJuICdCdXR0b24nO1xuICAgIGNhc2UgJ2xheW91dCc6XG4gICAgICAgIHJldHVybiAnTGF5b3V0JztcbiAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gJ05vZGUnO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGVmYXVsdE5hbWVCeVR5cGUodHlwZTogVWlFbGVtZW50VHlwZSk6IHN0cmluZyB7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnQ2FudmFzJzpcbiAgICAgICAgcmV0dXJuICdDYW52YXMnO1xuICAgIGNhc2UgJ0xhYmVsJzpcbiAgICAgICAgcmV0dXJuICdMYWJlbCc7XG4gICAgY2FzZSAnU3ByaXRlJzpcbiAgICAgICAgcmV0dXJuICdTcHJpdGUnO1xuICAgIGNhc2UgJ0J1dHRvbic6XG4gICAgICAgIHJldHVybiAnQnV0dG9uJztcbiAgICBjYXNlICdMYXlvdXQnOlxuICAgICAgICByZXR1cm4gJ0xheW91dCc7XG4gICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICdOb2RlJztcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlOiBhbnkpOiBudW1iZXIgfCBudWxsIHtcbiAgICBjb25zdCBudW0gPSBOdW1iZXIodmFsdWUpO1xuICAgIHJldHVybiBOdW1iZXIuaXNGaW5pdGUobnVtKSA/IG51bSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVZlYzIodmFsdWU6IGFueSk6IFZlYzJMaWtlIHwgbnVsbCB7XG4gICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB4ID0gdG9OdW1iZXIodmFsdWUueCk7XG4gICAgY29uc3QgeSA9IHRvTnVtYmVyKHZhbHVlLnkpO1xuICAgIGlmICh4ID09PSBudWxsIHx8IHkgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7IHgsIHkgfTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVmVjMyh2YWx1ZTogYW55KTogVmVjM0xpa2UgfCBudWxsIHtcbiAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHggPSB0b051bWJlcih2YWx1ZS54KTtcbiAgICBjb25zdCB5ID0gdG9OdW1iZXIodmFsdWUueSk7XG4gICAgY29uc3QgeiA9IHRvTnVtYmVyKHZhbHVlLnogPz8gMCk7XG4gICAgaWYgKHggPT09IG51bGwgfHwgeSA9PT0gbnVsbCB8fCB6ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4geyB4LCB5LCB6IH07XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZU5vZGVVdWlkKG5vZGU6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIHJldHVybiByZWFkRHVtcFN0cmluZyhub2RlPy51dWlkKSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVOb2RlTmFtZShub2RlOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBkaXJlY3QgPSByZWFkRHVtcFN0cmluZyhub2RlPy5uYW1lKTtcbiAgICBpZiAoZGlyZWN0KSB7XG4gICAgICAgIHJldHVybiBkaXJlY3Q7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBub2RlPy5uYW1lID09PSAnc3RyaW5nJyAmJiBub2RlLm5hbWUudHJpbSgpICE9PSAnJykge1xuICAgICAgICByZXR1cm4gbm9kZS5uYW1lLnRyaW0oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29tcG9uZW50VHlwZShyYXc6IGFueSk6IHN0cmluZyB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py5fX3R5cGVfXyksXG4gICAgICAgIHJlYWREdW1wU3RyaW5nKHJhdz8uY2lkKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py50eXBlKSxcbiAgICAgICAgcmVhZER1bXBTdHJpbmcocmF3Py5uYW1lKVxuICAgIF07XG4gICAgcmV0dXJuIGNhbmRpZGF0ZXMuZmluZCgoaXRlbSkgPT4gQm9vbGVhbihpdGVtKSkgfHwgJ1Vua25vd24nO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb21wb25lbnRVdWlkKHJhdzogYW55KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/LnV1aWQpLFxuICAgICAgICByZWFkRHVtcFN0cmluZyhyYXc/LnZhbHVlPy51dWlkKVxuICAgIF07XG4gICAgcmV0dXJuIGNhbmRpZGF0ZXMuZmluZCgoaXRlbSkgPT4gQm9vbGVhbihpdGVtKSkgfHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0Tm9kZUNvbXBvbmVudHMobm9kZTogYW55KTogVWlDb21wb25lbnRJbmZvW10ge1xuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSBBcnJheS5pc0FycmF5KG5vZGU/Ll9fY29tcHNfXykgPyBub2RlLl9fY29tcHNfXyA6IFtdO1xuICAgIHJldHVybiByYXdDb21wb25lbnRzLm1hcCgoaXRlbTogYW55LCBpbmRleDogbnVtYmVyKSA9PiAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgdHlwZTogbm9ybWFsaXplQ29tcG9uZW50VHlwZShpdGVtKSxcbiAgICAgICAgdXVpZDogbm9ybWFsaXplQ29tcG9uZW50VXVpZChpdGVtKVxuICAgIH0pKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYXRoKHBhdGg6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gcGF0aFxuICAgICAgICAuc3BsaXQoJy8nKVxuICAgICAgICAubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sZW5ndGggPiAwKTtcbn1cblxuZnVuY3Rpb24gY29sbGVjdENoaWxkcmVuKG5vZGU6IGFueSk6IGFueVtdIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShub2RlPy5jaGlsZHJlbikgPyBub2RlLmNoaWxkcmVuIDogW107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVOb2RlVXVpZEJ5UGF0aChyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlciwgcGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgY29uc3Qgc2VnbWVudHMgPSBwYXJzZVBhdGgocGF0aCk7XG4gICAgaWYgKHNlZ21lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB0cmVlID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICBsZXQgY3Vyc29yID0gdHJlZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgY29uc3Qgcm9vdE5hbWUgPSBub3JtYWxpemVOb2RlTmFtZShjdXJzb3IpO1xuICAgIGlmIChyb290TmFtZSAmJiBzZWdtZW50c1swXSA9PT0gcm9vdE5hbWUpIHtcbiAgICAgICAgaW5kZXggPSAxO1xuICAgIH1cblxuICAgIHdoaWxlIChpbmRleCA8IHNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gc2VnbWVudHNbaW5kZXhdO1xuICAgICAgICBjb25zdCBtYXRjaGVkID0gY29sbGVjdENoaWxkcmVuKGN1cnNvcikuZmluZCgoY2hpbGQpID0+IG5vcm1hbGl6ZU5vZGVOYW1lKGNoaWxkKSA9PT0gY3VycmVudCk7XG4gICAgICAgIGlmICghbWF0Y2hlZCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY3Vyc29yID0gbWF0Y2hlZDtcbiAgICAgICAgaW5kZXggKz0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gbm9ybWFsaXplTm9kZVV1aWQoY3Vyc29yKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZU5vZGVVdWlkKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkQXJnOiBhbnksXG4gICAgbm9kZVBhdGhBcmc6IGFueVxuKTogUHJvbWlzZTx7IHV1aWQ6IHN0cmluZyB8IG51bGw7IHNvdXJjZTogJ3V1aWQnIHwgJ3BhdGgnIHwgJ25vbmUnIH0+IHtcbiAgICBjb25zdCBub2RlVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcobm9kZVV1aWRBcmcpO1xuICAgIGlmIChub2RlVXVpZCkge1xuICAgICAgICByZXR1cm4geyB1dWlkOiBub2RlVXVpZCwgc291cmNlOiAndXVpZCcgfTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlUGF0aCA9IHRvTm9uRW1wdHlTdHJpbmcobm9kZVBhdGhBcmcpO1xuICAgIGlmICghbm9kZVBhdGgpIHtcbiAgICAgICAgcmV0dXJuIHsgdXVpZDogbnVsbCwgc291cmNlOiAnbm9uZScgfTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZEJ5UGF0aChyZXF1ZXN0ZXIsIG5vZGVQYXRoKTtcbiAgICByZXR1cm4geyB1dWlkOiByZXNvbHZlZCwgc291cmNlOiAncGF0aCcgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcXVlcnlOb2RlQ29tcG9uZW50cyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlciwgbm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8VWlDb21wb25lbnRJbmZvW10+IHtcbiAgICBjb25zdCBub2RlID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgIHJldHVybiBleHRyYWN0Tm9kZUNvbXBvbmVudHMobm9kZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUNvbXBvbmVudChcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZ1xuKTogUHJvbWlzZTx7IGluZGV4OiBudW1iZXI7IHV1aWQ/OiBzdHJpbmc7IGNyZWF0ZWQ6IGJvb2xlYW4gfT4ge1xuICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgY29uc3QgZXhpc3RlZCA9IGJlZm9yZS5maW5kKChpdGVtKSA9PiBpdGVtLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgIGlmIChleGlzdGVkKSB7XG4gICAgICAgIHJldHVybiB7IGluZGV4OiBleGlzdGVkLmluZGV4LCB1dWlkOiBleGlzdGVkLnV1aWQsIGNyZWF0ZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjcmVhdGUtY29tcG9uZW50Jywge1xuICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgfSk7XG5cbiAgICBjb25zdCBhZnRlciA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCBub2RlVXVpZCk7XG4gICAgY29uc3QgY3JlYXRlZCA9IGFmdGVyLmZpbmQoKGl0ZW0pID0+IGl0ZW0udHlwZSA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKCFjcmVhdGVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihg57uE5Lu25Yib5bu65ZCO5pyq5om+5YiwOiAke2NvbXBvbmVudFR5cGV9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgaW5kZXg6IGNyZWF0ZWQuaW5kZXgsIHV1aWQ6IGNyZWF0ZWQudXVpZCwgY3JlYXRlZDogdHJ1ZSB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZXRDb21wb25lbnRQcm9wZXJ0eShcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudEluZGV4OiBudW1iZXIsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmcsXG4gICAgdmFsdWU6IGFueSxcbiAgICB2YWx1ZVR5cGU/OiBzdHJpbmdcbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7IHZhbHVlIH07XG4gICAgaWYgKHZhbHVlVHlwZSkge1xuICAgICAgICBkdW1wLnR5cGUgPSB2YWx1ZVR5cGU7XG4gICAgfVxuXG4gICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICBwYXRoOiBgX19jb21wc19fLiR7Y29tcG9uZW50SW5kZXh9LiR7cHJvcGVydHlQYXRofWAsXG4gICAgICAgIGR1bXBcbiAgICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0Tm9kZVByb3BlcnR5KFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmcsXG4gICAgdmFsdWU6IGFueSxcbiAgICB2YWx1ZVR5cGU/OiBzdHJpbmdcbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7IHZhbHVlIH07XG4gICAgaWYgKHZhbHVlVHlwZSkge1xuICAgICAgICBkdW1wLnR5cGUgPSB2YWx1ZVR5cGU7XG4gICAgfVxuXG4gICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgIGR1bXBcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcGFyc2VTcGFjaW5nKHZhbHVlOiBhbnkpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0gfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB7IHg6IHZhbHVlLCB5OiB2YWx1ZSB9O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgY29uc3QgcGFydHMgPSB2YWx1ZVxuICAgICAgICAgICAgLnNwbGl0KCcsJylcbiAgICAgICAgICAgIC5tYXAoKGl0ZW0pID0+IGl0ZW0udHJpbSgpKVxuICAgICAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgLm1hcCgoaXRlbSkgPT4gTnVtYmVyKGl0ZW0pKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMSAmJiBOdW1iZXIuaXNGaW5pdGUocGFydHNbMF0pKSB7XG4gICAgICAgICAgICByZXR1cm4geyB4OiBwYXJ0c1swXSwgeTogcGFydHNbMF0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHMubGVuZ3RoID49IDIgJiYgTnVtYmVyLmlzRmluaXRlKHBhcnRzWzBdKSAmJiBOdW1iZXIuaXNGaW5pdGUocGFydHNbMV0pKSB7XG4gICAgICAgICAgICByZXR1cm4geyB4OiBwYXJ0c1swXSwgeTogcGFydHNbMV0gfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCB4ID0gdG9OdW1iZXIodmFsdWUueCA/PyB2YWx1ZS5ob3Jpem9udGFsKTtcbiAgICAgICAgY29uc3QgeSA9IHRvTnVtYmVyKHZhbHVlLnkgPz8gdmFsdWUudmVydGljYWwpO1xuICAgICAgICBpZiAoeCAhPT0gbnVsbCAmJiB5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4geyB4LCB5IH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYWRkaW5nKHZhbHVlOiBhbnksIGFyZ3M6IGFueSk6IFBhZGRpbmdMaWtlIHwgbnVsbCB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4geyBsZWZ0OiB2YWx1ZSwgcmlnaHQ6IHZhbHVlLCB0b3A6IHZhbHVlLCBib3R0b206IHZhbHVlIH07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudHJpbSgpICE9PSAnJykge1xuICAgICAgICBjb25zdCBwYXJ0cyA9IHZhbHVlXG4gICAgICAgICAgICAuc3BsaXQoJywnKVxuICAgICAgICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS50cmltKCkpXG4gICAgICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAubWFwKChpdGVtKSA9PiBOdW1iZXIoaXRlbSkpO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAxICYmIE51bWJlci5pc0Zpbml0ZShwYXJ0c1swXSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGxlZnQ6IHBhcnRzWzBdLCByaWdodDogcGFydHNbMF0sIHRvcDogcGFydHNbMF0sIGJvdHRvbTogcGFydHNbMF0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHMubGVuZ3RoID49IDQgJiYgcGFydHMuZXZlcnkoKGl0ZW0pID0+IE51bWJlci5pc0Zpbml0ZShpdGVtKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbGVmdDogcGFydHNbMF0sXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHBhcnRzWzFdLFxuICAgICAgICAgICAgICAgIHRvcDogcGFydHNbMl0sXG4gICAgICAgICAgICAgICAgYm90dG9tOiBwYXJ0c1szXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGxlZnQgPSB0b051bWJlcihhcmdzPy5wYWRkaW5nTGVmdCA/PyB2YWx1ZT8ubGVmdCk7XG4gICAgY29uc3QgcmlnaHQgPSB0b051bWJlcihhcmdzPy5wYWRkaW5nUmlnaHQgPz8gdmFsdWU/LnJpZ2h0KTtcbiAgICBjb25zdCB0b3AgPSB0b051bWJlcihhcmdzPy5wYWRkaW5nVG9wID8/IHZhbHVlPy50b3ApO1xuICAgIGNvbnN0IGJvdHRvbSA9IHRvTnVtYmVyKGFyZ3M/LnBhZGRpbmdCb3R0b20gPz8gdmFsdWU/LmJvdHRvbSk7XG4gICAgaWYgKGxlZnQgIT09IG51bGwgJiYgcmlnaHQgIT09IG51bGwgJiYgdG9wICE9PSBudWxsICYmIGJvdHRvbSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4geyBsZWZ0LCByaWdodCwgdG9wLCBib3R0b20gfTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplTGF5b3V0VHlwZSh2YWx1ZTogYW55KTogbnVtYmVyIHwgbnVsbCB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzSW50ZWdlcih2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0b05vbkVtcHR5U3RyaW5nKHZhbHVlKT8udG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKG5vcm1hbGl6ZWQgPT09ICdub25lJykge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgaWYgKG5vcm1hbGl6ZWQgPT09ICdob3Jpem9udGFsJykge1xuICAgICAgICByZXR1cm4gMTtcbiAgICB9XG4gICAgaWYgKG5vcm1hbGl6ZWQgPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgcmV0dXJuIDI7XG4gICAgfVxuICAgIGlmIChub3JtYWxpemVkID09PSAnZ3JpZCcpIHtcbiAgICAgICAgcmV0dXJuIDM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVSZXNpemVNb2RlKHZhbHVlOiBhbnkpOiBudW1iZXIgfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IHRvTm9uRW1wdHlTdHJpbmcodmFsdWUpPy50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghbm9ybWFsaXplZCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAobm9ybWFsaXplZCA9PT0gJ25vbmUnKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBpZiAobm9ybWFsaXplZCA9PT0gJ2NvbnRhaW5lcicpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGlmIChub3JtYWxpemVkID09PSAnY2hpbGRyZW4nKSB7XG4gICAgICAgIHJldHVybiAyO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplSG9yaXpvbnRhbEFsaWduKHZhbHVlOiBhbnkpOiBudW1iZXIgfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IHRvTm9uRW1wdHlTdHJpbmcodmFsdWUpPy50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghbm9ybWFsaXplZCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAobm9ybWFsaXplZCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBpZiAobm9ybWFsaXplZCA9PT0gJ2NlbnRlcicgfHwgbm9ybWFsaXplZCA9PT0gJ21pZGRsZScpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGlmIChub3JtYWxpemVkID09PSAncmlnaHQnKSB7XG4gICAgICAgIHJldHVybiAyO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVmVydGljYWxBbGlnbih2YWx1ZTogYW55KTogbnVtYmVyIHwgbnVsbCB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzSW50ZWdlcih2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0b05vbkVtcHR5U3RyaW5nKHZhbHVlKT8udG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKG5vcm1hbGl6ZWQgPT09ICd0b3AnKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBpZiAobm9ybWFsaXplZCA9PT0gJ2NlbnRlcicgfHwgbm9ybWFsaXplZCA9PT0gJ21pZGRsZScpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGlmIChub3JtYWxpemVkID09PSAnYm90dG9tJykge1xuICAgICAgICByZXR1cm4gMjtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbmRGaXJzdENhbnZhc1V1aWQocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICBjb25zdCB0cmVlID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICBjb25zdCBxdWV1ZTogYW55W10gPSBbdHJlZV07XG5cbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBub2RlID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgY29uc3QgdXVpZCA9IG5vcm1hbGl6ZU5vZGVVdWlkKG5vZGUpO1xuICAgICAgICBpZiAodXVpZCkge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGF3YWl0IHF1ZXJ5Tm9kZUNvbXBvbmVudHMocmVxdWVzdGVyLCB1dWlkKTtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzLnNvbWUoKGl0ZW0pID0+IGl0ZW0udHlwZSA9PT0gJ2NjLkNhbnZhcycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWUucHVzaCguLi5jb2xsZWN0Q2hpbGRyZW4obm9kZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVWlBdXRvbWF0aW9uVG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3VpX2NyZWF0ZV9lbGVtZW50JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Yib5bu6IFVJIOiKgueCueW5tuiHquWKqOihpem9kOW4uOeUqOe7hOS7tu+8iENhbnZhcy9MYWJlbC9TcHJpdGUvQnV0dG9uL0xheW91dO+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAndWknLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1VJIOWFg+e0oOexu+Wei++8mk5vZGUvQ2FudmFzL0xhYmVsL1Nwcml0ZS9CdXR0b24vTGF5b3V0JyB9LFxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50TmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdVSSDlhYPntKDlkI3np7AnIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn54i26IqC54K5IFVVSUTvvIjlj6/pgInvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn54i26IqC54K56Lev5b6E77yI5Y+v6YCJ77yM5qC85byP77yaQ2FudmFzL1BhbmVs77yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBlbnN1cmVDYW52YXM6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ+acquaMh+WumueItuiKgueCueaXtuaYr+WQpuiHquWKqOaMguWIsCBDYW52YXPvvIzpu5jorqQgdHJ1ZScgfSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZS10cmVlJywgJ3NjZW5lLnF1ZXJ5LW5vZGUnLCAnc2NlbmUuY3JlYXRlLW5vZGUnLCAnc2NlbmUuY3JlYXRlLWNvbXBvbmVudCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudFR5cGUgPSBub3JtYWxpemVFbGVtZW50VHlwZShhcmdzPy5lbGVtZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnROYW1lID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5lbGVtZW50TmFtZSkgfHwgZGVmYXVsdE5hbWVCeVR5cGUoZWxlbWVudFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnN1cmVDYW52YXMgPSBhcmdzPy5lbnN1cmVDYW52YXMgIT09IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncz8ucG9zaXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudFJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZU5vZGVVdWlkKHJlcXVlc3RlciwgYXJncz8ucGFyZW50VXVpZCwgYXJncz8ucGFyZW50UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRVdWlkID0gcGFyZW50UmVzb2x2ZWQudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJlbnRVdWlkICYmIGVuc3VyZUNhbnZhcyAmJiBlbGVtZW50VHlwZSAhPT0gJ0NhbnZhcycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjYW52YXNVdWlkID0gYXdhaXQgZmluZEZpcnN0Q2FudmFzVXVpZChyZXF1ZXN0ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW52YXNVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY3JlYXRlZENhbnZhc1V1aWQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgeyBuYW1lOiAnQ2FudmFzJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW52YXNVdWlkID0gU3RyaW5nKGNyZWF0ZWRDYW52YXNVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVDb21wb25lbnQocmVxdWVzdGVyLCBjYW52YXNVdWlkLCAnY2MuQ2FudmFzJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5zdXJlQ29tcG9uZW50KHJlcXVlc3RlciwgY2FudmFzVXVpZCwgJ2NjLlVJVHJhbnNmb3JtJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkID0gY2FudmFzVXVpZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZU9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7IG5hbWU6IGVsZW1lbnROYW1lIH07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVPcHRpb25zLnBhcmVudCA9IHBhcmVudFV1aWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVPcHRpb25zLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBjcmVhdGVPcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW5zdXJlZENvbXBvbmVudHM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW5zdXJlQW5kTWFyayA9IGFzeW5jIChjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuc3VyZUNvbXBvbmVudChyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuc3VyZWRDb21wb25lbnRzLnB1c2goY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGVsZW1lbnRUeXBlID09PSAnQ2FudmFzJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5zdXJlQW5kTWFyaygnY2MuQ2FudmFzJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVBbmRNYXJrKCdjYy5VSVRyYW5zZm9ybScpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSAnTGFiZWwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVBbmRNYXJrKCdjYy5VSVRyYW5zZm9ybScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5zdXJlQW5kTWFyaygnY2MuTGFiZWwnKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gJ1Nwcml0ZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuc3VyZUFuZE1hcmsoJ2NjLlVJVHJhbnNmb3JtJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVBbmRNYXJrKCdjYy5TcHJpdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gJ0J1dHRvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuc3VyZUFuZE1hcmsoJ2NjLlVJVHJhbnNmb3JtJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVBbmRNYXJrKCdjYy5TcHJpdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuc3VyZUFuZE1hcmsoJ2NjLkJ1dHRvbicpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSAnTGF5b3V0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5zdXJlQW5kTWFyaygnY2MuVUlUcmFuc2Zvcm0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuc3VyZUFuZE1hcmsoJ2NjLkxheW91dCcpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVuc3VyZUNhbnZhcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5zdXJlQW5kTWFyaygnY2MuVUlUcmFuc2Zvcm0nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRSZXNvbHZlZC5zb3VyY2UgPT09ICdwYXRoJyAmJiAhcGFyZW50UmVzb2x2ZWQudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCgncGFyZW50UGF0aCDmnKrop6PmnpDmiJDlip/vvIzlt7LpgIDlm57pu5jorqTniLboioLngrnnrZbnlaUnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogcGFyZW50VXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5zdXJlZENvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICB3YXJuaW5nc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfliJvlu7ogVUkg5YWD57Sg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICd1aV9zZXRfcmVjdF90cmFuc2Zvcm0nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICforr7nva4gVUlUcmFuc2Zvcm3vvIjlsLrlr7gv6ZSa54K577yJ5Y+K6IqC54K55L2N572uJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICd1aScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6IqC54K5IFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIG5vZGVQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+iKgueCuei3r+W+hO+8iOWPr+mAie+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgc2l6ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBhbmNob3I6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgYW5jaG9yTWluOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGFuY2hvck1heDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwaXZvdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1ub2RlLXRyZWUnLCAnc2NlbmUucXVlcnktbm9kZScsICdzY2VuZS5jcmVhdGUtY29tcG9uZW50JywgJ3NjZW5lLnNldC1wcm9wZXJ0eSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlTm9kZVV1aWQocmVxdWVzdGVyLCBhcmdzPy5ub2RlVXVpZCwgYXJncz8ubm9kZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlc29sdmVkLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdub2RlVXVpZCDmiJYgbm9kZVBhdGgg5b+F5aGr5LiU5b+F6aG75Y+v6Kej5p6QJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHJlc29sdmVkLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1aVRyYW5zZm9ybSA9IGF3YWl0IGVuc3VyZUNvbXBvbmVudChyZXF1ZXN0ZXIsIG5vZGVVdWlkLCAnY2MuVUlUcmFuc2Zvcm0nKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaXplID0gYXJncz8uc2l6ZSAmJiB0eXBlb2YgYXJncy5zaXplID09PSAnb2JqZWN0J1xuICAgICAgICAgICAgICAgICAgICAgICAgPyB7IHdpZHRoOiB0b051bWJlcihhcmdzLnNpemUud2lkdGgpLCBoZWlnaHQ6IHRvTnVtYmVyKGFyZ3Muc2l6ZS5oZWlnaHQpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpemUgJiYgc2l6ZS53aWR0aCAhPT0gbnVsbCAmJiBzaXplLmhlaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Q29tcG9uZW50UHJvcGVydHkocmVxdWVzdGVyLCBub2RlVXVpZCwgdWlUcmFuc2Zvcm0uaW5kZXgsICdjb250ZW50U2l6ZScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogc2l6ZS53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHNpemUuaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAnY2MuU2l6ZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdjb250ZW50U2l6ZScpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5jaG9yID0gbm9ybWFsaXplVmVjMihhcmdzPy5hbmNob3IpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbmNob3JNaW4gPSBub3JtYWxpemVWZWMyKGFyZ3M/LmFuY2hvck1pbik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFuY2hvck1heCA9IG5vcm1hbGl6ZVZlYzIoYXJncz8uYW5jaG9yTWF4KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGl2b3QgPSBub3JtYWxpemVWZWMyKGFyZ3M/LnBpdm90KTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbmFsQW5jaG9yOiBWZWMyTGlrZSB8IG51bGwgPSBhbmNob3I7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmaW5hbEFuY2hvciAmJiBhbmNob3JNaW4gJiYgYW5jaG9yTWF4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5hbEFuY2hvciA9IGFuY2hvck1pbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhhbmNob3JNaW4ueCAtIGFuY2hvck1heC54KSA+IDFlLTYgfHwgTWF0aC5hYnMoYW5jaG9yTWluLnkgLSBhbmNob3JNYXgueSkgPiAxZS02KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCgnQ29jb3MgVUlUcmFuc2Zvcm0g5LiN5pSv5oyBIGFuY2hvck1pbi9hbmNob3JNYXgg5YiG56a76K+t5LmJ77yM5bey5L2/55SoIGFuY2hvck1pbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmaW5hbEFuY2hvciAmJiBwaXZvdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmluYWxBbmNob3IgPSBwaXZvdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzLnB1c2goJ0NvY29zIFVJVHJhbnNmb3JtIOaXoOeLrOeriyBwaXZvdCDlsZ7mgKfvvIzlt7LlsIYgcGl2b3Qg5pig5bCE5Li6IGFuY2hvclBvaW50Jyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZmluYWxBbmNob3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIHVpVHJhbnNmb3JtLmluZGV4LCAnYW5jaG9yUG9pbnQnLCBmaW5hbEFuY2hvciwgJ2NjLlZlYzInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgnYW5jaG9yUG9pbnQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzPy5wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Tm9kZVByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsICdwb3NpdGlvbicsIHBvc2l0aW9uLCAnY2MuVmVjMycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdwb3NpdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHVwZGF0ZXMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iuvue9riBVSVRyYW5zZm9ybSDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3VpX3NldF90ZXh0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572uIExhYmVsIOaWh+acrOebuOWFs+WxnuaAp++8iOaWh+acrC/lrZflj7cv5a+56b2QL+minOiJsu+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAndWknLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+iKgueCuSBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICBub2RlUGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnm67moIfoioLngrnot6/lvoTvvIjlj6/pgInvvIknIH0sXG4gICAgICAgICAgICAgICAgICAgIHRleHQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5paH5pys5YaF5a65JyB9LFxuICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICflrZfkvZPlpKflsI8nIH0sXG4gICAgICAgICAgICAgICAgICAgIGxpbmVIZWlnaHQ6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAn6KGM6auYJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb2xvcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcjogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGc6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiOiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYTogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGhvcml6b250YWxBbGlnbjogeyB0eXBlOiBbJ3N0cmluZycsICdudW1iZXInXSwgZGVzY3JpcHRpb246ICfmsLTlubPlr7npvZDvvJpsZWZ0L2NlbnRlci9yaWdodCDmiJbmnprkuL7lgLwnIH0sXG4gICAgICAgICAgICAgICAgICAgIHZlcnRpY2FsQWxpZ246IHsgdHlwZTogWydzdHJpbmcnLCAnbnVtYmVyJ10sIGRlc2NyaXB0aW9uOiAn5Z6C55u05a+56b2Q77yadG9wL2NlbnRlci9ib3R0b20g5oiW5p6a5Li+5YC8JyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LW5vZGUtdHJlZScsICdzY2VuZS5xdWVyeS1ub2RlJywgJ3NjZW5lLmNyZWF0ZS1jb21wb25lbnQnLCAnc2NlbmUuc2V0LXByb3BlcnR5J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChyZXF1ZXN0ZXIsIGFyZ3M/Lm5vZGVVdWlkLCBhcmdzPy5ub2RlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzb2x2ZWQudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25vZGVVdWlkIOaIliBub2RlUGF0aCDlv4XloavkuJTlv4Xpobvlj6/op6PmnpAnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gcmVzb2x2ZWQudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBhd2FpdCBlbnN1cmVDb21wb25lbnQocmVxdWVzdGVyLCBub2RlVXVpZCwgJ2NjLkxhYmVsJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IGFyZ3M/LnRleHQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIGxhYmVsLmluZGV4LCAnc3RyaW5nJywgdGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ3N0cmluZycpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9udFNpemUgPSB0b051bWJlcihhcmdzPy5mb250U2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmb250U2l6ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Q29tcG9uZW50UHJvcGVydHkocmVxdWVzdGVyLCBub2RlVXVpZCwgbGFiZWwuaW5kZXgsICdmb250U2l6ZScsIGZvbnRTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgnZm9udFNpemUnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVIZWlnaHQgPSB0b051bWJlcihhcmdzPy5saW5lSGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpbmVIZWlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIGxhYmVsLmluZGV4LCAnbGluZUhlaWdodCcsIGxpbmVIZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdsaW5lSGVpZ2h0Jyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xvciA9IGFyZ3M/LmNvbG9yO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29sb3IgJiYgdHlwZW9mIGNvbG9yID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgciA9IHRvTnVtYmVyKGNvbG9yLnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZyA9IHRvTnVtYmVyKGNvbG9yLmcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYiA9IHRvTnVtYmVyKGNvbG9yLmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYSA9IHRvTnVtYmVyKGNvbG9yLmEgPz8gMjU1KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyICE9PSBudWxsICYmIGcgIT09IG51bGwgJiYgYiAhPT0gbnVsbCAmJiBhICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Q29tcG9uZW50UHJvcGVydHkocmVxdWVzdGVyLCBub2RlVXVpZCwgbGFiZWwuaW5kZXgsICdjb2xvcicsIHsgciwgZywgYiwgYSB9LCAnY2MuQ29sb3InKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ2NvbG9yJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBob3Jpem9udGFsQWxpZ24gPSBub3JtYWxpemVIb3Jpem9udGFsQWxpZ24oYXJncz8uaG9yaXpvbnRhbEFsaWduKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhvcml6b250YWxBbGlnbiAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Q29tcG9uZW50UHJvcGVydHkocmVxdWVzdGVyLCBub2RlVXVpZCwgbGFiZWwuaW5kZXgsICdob3Jpem9udGFsQWxpZ24nLCBob3Jpem9udGFsQWxpZ24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdob3Jpem9udGFsQWxpZ24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRpY2FsQWxpZ24gPSBub3JtYWxpemVWZXJ0aWNhbEFsaWduKGFyZ3M/LnZlcnRpY2FsQWxpZ24pO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGljYWxBbGlnbiAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Q29tcG9uZW50UHJvcGVydHkocmVxdWVzdGVyLCBub2RlVXVpZCwgbGFiZWwuaW5kZXgsICd2ZXJ0aWNhbEFsaWduJywgdmVydGljYWxBbGlnbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ3ZlcnRpY2FsQWxpZ24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkOiB1cGRhdGVzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6K6+572u5paH5pys5bGe5oCn5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICd1aV9zZXRfbGF5b3V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572uIExheW91dCDnu4Tku7bluLjnlKjlsZ7mgKfvvIjluIPlsYDnsbvlnosv6Ze06LedL+i+uei3nS/lsLrlr7jmqKHlvI/vvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3VpJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfnm67moIfoioLngrkgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgbm9kZVBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6IqC54K56Lev5b6E77yI5Y+v6YCJ77yJJyB9LFxuICAgICAgICAgICAgICAgICAgICBsYXlvdXRUeXBlOiB7IHR5cGU6IFsnc3RyaW5nJywgJ251bWJlciddLCBkZXNjcmlwdGlvbjogJ+W4g+WxgOexu+Wei++8mm5vbmUvaG9yaXpvbnRhbC92ZXJ0aWNhbC9ncmlkIOaIluaemuS4vuWAvCcgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVzaXplTW9kZTogeyB0eXBlOiBbJ3N0cmluZycsICdudW1iZXInXSwgZGVzY3JpcHRpb246ICflsLrlr7jmqKHlvI/vvJpub25lL2NvbnRhaW5lci9jaGlsZHJlbiDmiJbmnprkuL7lgLwnIH0sXG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+agvOW8j++8mngseSDmiJbljZXlgLwnIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFkZGluZzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmoLzlvI/vvJpsZWZ0LHJpZ2h0LHRvcCxib3R0b20g5oiW5Y2V5YC8JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQ6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJpZ2h0OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3A6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvdHRvbTogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmdMZWZ0OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmdSaWdodDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICBwYWRkaW5nVG9wOiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmdCb3R0b206IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgYWZmZWN0ZWRCeVNjYWxlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICfluIPlsYDorqHnrpfmmK/lkKblj5flrZDoioLngrnnvKnmlL7lvbHlk40nIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktbm9kZS10cmVlJywgJ3NjZW5lLnF1ZXJ5LW5vZGUnLCAnc2NlbmUuY3JlYXRlLWNvbXBvbmVudCcsICdzY2VuZS5zZXQtcHJvcGVydHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZU5vZGVVdWlkKHJlcXVlc3RlciwgYXJncz8ubm9kZVV1aWQsIGFyZ3M/Lm5vZGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXNvbHZlZC51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbm9kZVV1aWQg5oiWIG5vZGVQYXRoIOW/heWhq+S4lOW/hemhu+WPr+ino+aekCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSByZXNvbHZlZC51dWlkO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXlvdXQgPSBhd2FpdCBlbnN1cmVDb21wb25lbnQocmVxdWVzdGVyLCBub2RlVXVpZCwgJ2NjLkxheW91dCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheW91dFR5cGUgPSBub3JtYWxpemVMYXlvdXRUeXBlKGFyZ3M/LmxheW91dFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGF5b3V0VHlwZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2V0Q29tcG9uZW50UHJvcGVydHkocmVxdWVzdGVyLCBub2RlVXVpZCwgbGF5b3V0LmluZGV4LCAndHlwZScsIGxheW91dFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCd0eXBlJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNpemVNb2RlID0gbm9ybWFsaXplUmVzaXplTW9kZShhcmdzPy5yZXNpemVNb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc2l6ZU1vZGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIGxheW91dC5pbmRleCwgJ3Jlc2l6ZU1vZGUnLCByZXNpemVNb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgncmVzaXplTW9kZScpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3BhY2luZyA9IHBhcnNlU3BhY2luZyhhcmdzPy5zcGFjaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNwYWNpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIGxheW91dC5pbmRleCwgJ3NwYWNpbmdYJywgc3BhY2luZy54KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIGxheW91dC5pbmRleCwgJ3NwYWNpbmdZJywgc3BhY2luZy55KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgnc3BhY2luZ1gnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgnc3BhY2luZ1knKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhZGRpbmcgPSBwYXJzZVBhZGRpbmcoYXJncz8ucGFkZGluZywgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYWRkaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzZXRDb21wb25lbnRQcm9wZXJ0eShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBsYXlvdXQuaW5kZXgsICdwYWRkaW5nTGVmdCcsIHBhZGRpbmcubGVmdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzZXRDb21wb25lbnRQcm9wZXJ0eShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBsYXlvdXQuaW5kZXgsICdwYWRkaW5nUmlnaHQnLCBwYWRkaW5nLnJpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNldENvbXBvbmVudFByb3BlcnR5KHJlcXVlc3Rlciwgbm9kZVV1aWQsIGxheW91dC5pbmRleCwgJ3BhZGRpbmdUb3AnLCBwYWRkaW5nLnRvcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzZXRDb21wb25lbnRQcm9wZXJ0eShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBsYXlvdXQuaW5kZXgsICdwYWRkaW5nQm90dG9tJywgcGFkZGluZy5ib3R0b20pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdwYWRkaW5nTGVmdCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdwYWRkaW5nUmlnaHQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgncGFkZGluZ1RvcCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdwYWRkaW5nQm90dG9tJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3M/LmFmZmVjdGVkQnlTY2FsZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzZXRDb21wb25lbnRQcm9wZXJ0eShyZXF1ZXN0ZXIsIG5vZGVVdWlkLCBsYXlvdXQuaW5kZXgsICdhZmZlY3RlZEJ5U2NhbGUnLCBhcmdzLmFmZmVjdGVkQnlTY2FsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ2FmZmVjdGVkQnlTY2FsZScpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHVwZGF0ZXMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCforr7nva4gTGF5b3V0IOWxnuaAp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXTtcbn1cbiJdfQ==