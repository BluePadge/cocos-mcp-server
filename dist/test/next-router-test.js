"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const tool_registry_1 = require("../next/protocol/tool-registry");
const router_1 = require("../next/protocol/router");
const official_tools_1 = require("../next/tools/official-tools");
function createMatrix(availableKeys) {
    const byKey = {};
    for (const key of availableKeys) {
        const firstDot = key.indexOf('.');
        const channel = key.slice(0, firstDot);
        const method = key.slice(firstDot + 1);
        byKey[key] = {
            key,
            channel,
            method,
            layer: 'official',
            readonly: true,
            description: key,
            available: true,
            checkedAt: new Date().toISOString(),
            detail: 'ok'
        };
    }
    return {
        generatedAt: new Date().toISOString(),
        byKey,
        summary: {
            total: availableKeys.length,
            available: availableKeys.length,
            unavailable: 0,
            byLayer: {
                official: {
                    total: availableKeys.length,
                    available: availableKeys.length
                },
                extended: {
                    total: 0,
                    available: 0
                },
                experimental: {
                    total: 0,
                    available: 0
                }
            }
        }
    };
}
async function testListAndReadDomainCalls() {
    const requester = async (channel, method, ...args) => {
        if (channel === 'scene' && method === 'query-node-tree') {
            return { uuid: 'root', name: { value: 'MainScene' }, children: [] };
        }
        if (channel === 'scene' && method === 'query-node') {
            return {
                uuid: { value: 'node-1' },
                __comps__: [
                    { __type__: { value: 'cc.Label' }, uuid: { value: 'comp-1' } }
                ]
            };
        }
        if (channel === 'asset-db' && method === 'query-assets') {
            return [
                { url: 'db://assets/a.prefab', uuid: 'uuid-a' },
                { url: 'db://assets/b.prefab', uuid: 'uuid-b' }
            ];
        }
        if (channel === 'asset-db' && method === 'query-asset-dependencies') {
            return ['dep-uuid-1', 'dep-uuid-2'];
        }
        if (channel === 'asset-db' && method === 'query-asset-info') {
            return { uuid: args[0], url: `db://assets/${args[0]}.prefab` };
        }
        throw new Error(`Unexpected call: ${channel}.${method}(${JSON.stringify(args)})`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.query-node-tree',
        'scene.query-node',
        'asset-db.query-assets',
        'asset-db.query-asset-info',
        'asset-db.query-asset-dependencies'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    assert.ok(Array.isArray(listResponse.result.tools));
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('scene_list_game_objects'));
    assert.ok(toolNames.includes('scene_get_game_object_info'));
    assert.ok(toolNames.includes('component_list_on_node'));
    assert.ok(toolNames.includes('asset_query_dependencies'));
    assert.ok(!toolNames.includes('scene_create_game_object'), '写操作能力未探测时不应暴露写工具');
    const callResponse = await router.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'asset_query_dependencies',
            arguments: {
                urlOrUuid: 'db://assets/player.prefab',
                relationType: 'all',
                includeAssetInfo: true
            }
        }
    });
    assert.ok(callResponse);
    assert.strictEqual(callResponse.error, undefined);
    assert.strictEqual(callResponse.result.isError, false);
    assert.strictEqual(callResponse.result.structuredContent.success, true);
    assert.strictEqual(callResponse.result.structuredContent.data.count, 2);
    assert.strictEqual(callResponse.result.structuredContent.data.dependencyInfos.length, 2);
}
async function testWriteToolCall() {
    const setPropertyPayloads = [];
    const removeComponentPayloads = [];
    const requester = async (channel, method, ...args) => {
        if (channel === 'scene' && method === 'query-node') {
            return {
                uuid: { value: 'node-1' },
                __comps__: [
                    { __type__: { value: 'cc.Label' }, uuid: { value: 'comp-uuid-label' } }
                ]
            };
        }
        if (channel === 'scene' && method === 'set-property') {
            setPropertyPayloads.push(args[0]);
            return true;
        }
        if (channel === 'scene' && method === 'remove-component') {
            removeComponentPayloads.push(args[0]);
            return undefined;
        }
        throw new Error(`Unexpected call: ${channel}.${method}(${JSON.stringify(args)})`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.query-node',
        'scene.set-property',
        'scene.remove-component'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const setPropertyResponse = await router.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
            name: 'component_set_property',
            arguments: {
                nodeUuid: 'node-1',
                componentType: 'cc.Label',
                propertyPath: 'string',
                value: 'Hello Next',
                valueType: 'String'
            }
        }
    });
    assert.ok(setPropertyResponse);
    assert.strictEqual(setPropertyResponse.result.isError, false);
    assert.strictEqual(setPropertyPayloads.length, 1);
    assert.strictEqual(setPropertyPayloads[0].path, '__comps__.0.string');
    assert.strictEqual(setPropertyPayloads[0].dump.value, 'Hello Next');
    assert.strictEqual(setPropertyPayloads[0].dump.type, 'String');
    const removeComponentResponse = await router.handle({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
            name: 'component_remove_component',
            arguments: {
                nodeUuid: 'node-1',
                componentType: 'cc.Label'
            }
        }
    });
    assert.ok(removeComponentResponse);
    assert.strictEqual(removeComponentResponse.result.isError, false);
    assert.strictEqual(removeComponentPayloads.length, 1);
    assert.strictEqual(removeComponentPayloads[0].uuid, 'comp-uuid-label');
}
async function testLifecycleAndRuntimeTools() {
    const callLog = [];
    const requester = async (channel, method, ...args) => {
        callLog.push({ channel, method, args });
        if (channel === 'scene' && method === 'save-scene') {
            return 'db://assets/scenes/boot.scene';
        }
        if (channel === 'scene' && method === 'close-scene') {
            return true;
        }
        if (channel === 'scene' && method === 'query-is-ready') {
            return true;
        }
        if (channel === 'scene' && method === 'query-dirty') {
            return false;
        }
        if (channel === 'scene' && method === 'query-scene-bounds') {
            return { x: 0, y: 0, width: 1280, height: 720 };
        }
        if (channel === 'scene' && method === 'focus-camera') {
            return undefined;
        }
        if (channel === 'project' && method === 'query-config') {
            return { name: 'HelloWorld', language: 'zh' };
        }
        if (channel === 'preferences' && method === 'query-config') {
            return { language: 'zh-CN' };
        }
        if (channel === 'server' && method === 'query-ip-list') {
            return ['127.0.0.1'];
        }
        if (channel === 'server' && method === 'query-port') {
            return 7456;
        }
        if (channel === 'engine' && method === 'query-engine-info') {
            return { version: '3.8.8', modules: [] };
        }
        if (channel === 'builder' && method === 'query-worker-ready') {
            return true;
        }
        if (channel === 'asset-db' && method === 'open-asset') {
            return undefined;
        }
        throw new Error(`Unexpected call: ${channel}.${method}(${JSON.stringify(args)})`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'asset-db.open-asset',
        'scene.query-is-ready',
        'scene.query-dirty',
        'scene.query-scene-bounds',
        'scene.focus-camera',
        'project.query-config',
        'preferences.query-config',
        'server.query-ip-list',
        'server.query-port',
        'engine.query-engine-info',
        'builder.query-worker-ready'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('scene_open_scene'));
    assert.ok(toolNames.includes('scene_save_scene'));
    assert.ok(toolNames.includes('scene_close_scene'));
    assert.ok(toolNames.includes('scene_query_status'));
    assert.ok(toolNames.includes('scene_focus_camera'));
    assert.ok(toolNames.includes('project_query_config'));
    assert.ok(toolNames.includes('preferences_query_config'));
    assert.ok(toolNames.includes('server_query_network'));
    assert.ok(toolNames.includes('engine_query_runtime_info'));
    assert.ok(toolNames.includes('engine_query_engine_info'));
    assert.ok(toolNames.includes('builder_query_worker_ready'));
    const sceneStatus = await router.handle({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
            name: 'scene_query_status',
            arguments: {
                includeBounds: true
            }
        }
    });
    assert.ok(sceneStatus);
    assert.strictEqual(sceneStatus.result.isError, false);
    assert.strictEqual(sceneStatus.result.structuredContent.data.isReady, true);
    assert.strictEqual(sceneStatus.result.structuredContent.data.isDirty, false);
    assert.strictEqual(sceneStatus.result.structuredContent.data.bounds.width, 1280);
    const openScene = await router.handle({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
            name: 'scene_open_scene',
            arguments: {
                sceneUrl: 'db://assets/scenes/boot.scene'
            }
        }
    });
    assert.ok(openScene);
    assert.strictEqual(openScene.result.isError, false);
    assert.strictEqual(openScene.result.structuredContent.data.opened, true);
    const saveScene = await router.handle({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
            name: 'scene_save_scene',
            arguments: {
                force: true
            }
        }
    });
    assert.ok(saveScene);
    assert.strictEqual(saveScene.result.isError, false);
    assert.strictEqual(saveScene.result.structuredContent.data.sceneUrl, 'db://assets/scenes/boot.scene');
    const closeScene = await router.handle({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
            name: 'scene_close_scene',
            arguments: {}
        }
    });
    assert.ok(closeScene);
    assert.strictEqual(closeScene.result.isError, false);
    assert.strictEqual(closeScene.result.structuredContent.data.closed, true);
    const focusCamera = await router.handle({
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
            name: 'scene_focus_camera',
            arguments: {
                uuids: 'node-1'
            }
        }
    });
    assert.ok(focusCamera);
    assert.strictEqual(focusCamera.result.isError, false);
    assert.deepStrictEqual(focusCamera.result.structuredContent.data.uuids, ['node-1']);
    const projectConfig = await router.handle({
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
            name: 'project_query_config',
            arguments: {
                configType: 'project',
                protocol: 'project'
            }
        }
    });
    assert.ok(projectConfig);
    assert.strictEqual(projectConfig.result.isError, false);
    const preferencesConfig = await router.handle({
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
            name: 'preferences_query_config',
            arguments: {
                configType: 'general'
            }
        }
    });
    assert.ok(preferencesConfig);
    assert.strictEqual(preferencesConfig.result.isError, false);
    const network = await router.handle({
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
            name: 'server_query_network',
            arguments: {}
        }
    });
    assert.ok(network);
    assert.strictEqual(network.result.isError, false);
    assert.strictEqual(network.result.structuredContent.data.port, 7456);
    const runtimeInfo = await router.handle({
        jsonrpc: '2.0',
        id: 19,
        method: 'tools/call',
        params: {
            name: 'engine_query_runtime_info',
            arguments: {}
        }
    });
    assert.ok(runtimeInfo);
    assert.strictEqual(runtimeInfo.result.isError, false);
    assert.strictEqual(runtimeInfo.result.structuredContent.data.info.version, '3.8.8');
    const engineInfo = await router.handle({
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: {
            name: 'engine_query_engine_info',
            arguments: {}
        }
    });
    assert.ok(engineInfo);
    assert.strictEqual(engineInfo.result.isError, false);
    const workerReady = await router.handle({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
            name: 'builder_query_worker_ready',
            arguments: {}
        }
    });
    assert.ok(workerReady);
    assert.strictEqual(workerReady.result.isError, false);
    assert.strictEqual(workerReady.result.structuredContent.data.ready, true);
    assert.ok(callLog.some((item) => item.channel === 'asset-db' && item.method === 'open-asset'), '应调用 asset-db.open-asset');
}
async function testSceneViewTools() {
    const state = {
        is2D: false,
        gizmoTool: 'move',
        gizmoPivot: 'center',
        gizmoCoordinate: 'local',
        isGridVisible: true,
        isIconGizmo3D: true,
        iconGizmoSize: 1
    };
    const alignCalls = [];
    const requester = async (channel, method, ...args) => {
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'query-is2D') {
            return state.is2D;
        }
        if (method === 'query-gizmo-tool-name') {
            return state.gizmoTool;
        }
        if (method === 'query-gizmo-pivot') {
            return state.gizmoPivot;
        }
        if (method === 'query-gizmo-coordinate') {
            return state.gizmoCoordinate;
        }
        if (method === 'query-is-grid-visible') {
            return state.isGridVisible;
        }
        if (method === 'query-is-icon-gizmo-3d') {
            return state.isIconGizmo3D;
        }
        if (method === 'query-icon-gizmo-size') {
            return state.iconGizmoSize;
        }
        if (method === 'query-is-ready') {
            return true;
        }
        if (method === 'change-is2D') {
            state.is2D = Boolean(args[0]);
            return undefined;
        }
        if (method === 'change-gizmo-tool') {
            state.gizmoTool = args[0];
            return undefined;
        }
        if (method === 'change-gizmo-pivot') {
            state.gizmoPivot = args[0];
            return undefined;
        }
        if (method === 'change-gizmo-coordinate') {
            state.gizmoCoordinate = args[0];
            return undefined;
        }
        if (method === 'set-grid-visible') {
            state.isGridVisible = Boolean(args[0]);
            return undefined;
        }
        if (method === 'set-icon-gizmo-3d') {
            state.isIconGizmo3D = Boolean(args[0]);
            return undefined;
        }
        if (method === 'set-icon-gizmo-size') {
            state.iconGizmoSize = Number(args[0]);
            return undefined;
        }
        if (method === 'align-with-view' || method === 'align-view-with-node') {
            alignCalls.push(method);
            return undefined;
        }
        throw new Error(`Unexpected scene method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.query-is2D',
        'scene.query-gizmo-tool-name',
        'scene.query-gizmo-pivot',
        'scene.query-gizmo-coordinate',
        'scene.query-is-grid-visible',
        'scene.query-is-icon-gizmo-3d',
        'scene.query-icon-gizmo-size',
        'scene.query-is-ready'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('scene_view_query_state'));
    assert.ok(toolNames.includes('scene_view_set_mode'));
    assert.ok(toolNames.includes('scene_view_set_gizmo_tool'));
    assert.ok(toolNames.includes('scene_view_set_gizmo_pivot'));
    assert.ok(toolNames.includes('scene_view_set_gizmo_coordinate'));
    assert.ok(toolNames.includes('scene_view_set_grid_visible'));
    assert.ok(toolNames.includes('scene_view_set_icon_gizmo_visible'));
    assert.ok(toolNames.includes('scene_view_set_icon_gizmo_size'));
    assert.ok(toolNames.includes('scene_view_align_with_view'));
    assert.ok(toolNames.includes('scene_view_align_view_with_node'));
    const queryState = await router.handle({
        jsonrpc: '2.0',
        id: 23,
        method: 'tools/call',
        params: {
            name: 'scene_view_query_state',
            arguments: {}
        }
    });
    assert.ok(queryState);
    assert.strictEqual(queryState.result.isError, false);
    assert.strictEqual(queryState.result.structuredContent.data.state.is2D, false);
    assert.strictEqual(queryState.result.structuredContent.data.state.gizmoTool, 'move');
    const setMode = await router.handle({
        jsonrpc: '2.0',
        id: 24,
        method: 'tools/call',
        params: {
            name: 'scene_view_set_mode',
            arguments: {
                is2D: true
            }
        }
    });
    assert.ok(setMode);
    assert.strictEqual(setMode.result.isError, false);
    assert.strictEqual(setMode.result.structuredContent.data.current, true);
    const setTool = await router.handle({
        jsonrpc: '2.0',
        id: 25,
        method: 'tools/call',
        params: {
            name: 'scene_view_set_gizmo_tool',
            arguments: {
                tool: 'rotate'
            }
        }
    });
    assert.ok(setTool);
    assert.strictEqual(setTool.result.isError, false);
    assert.strictEqual(setTool.result.structuredContent.data.current, 'rotate');
    const setGrid = await router.handle({
        jsonrpc: '2.0',
        id: 26,
        method: 'tools/call',
        params: {
            name: 'scene_view_set_grid_visible',
            arguments: {
                visible: false
            }
        }
    });
    assert.ok(setGrid);
    assert.strictEqual(setGrid.result.isError, false);
    assert.strictEqual(setGrid.result.structuredContent.data.current, false);
    const setIconSize = await router.handle({
        jsonrpc: '2.0',
        id: 27,
        method: 'tools/call',
        params: {
            name: 'scene_view_set_icon_gizmo_size',
            arguments: {
                size: 2
            }
        }
    });
    assert.ok(setIconSize);
    assert.strictEqual(setIconSize.result.isError, false);
    assert.strictEqual(setIconSize.result.structuredContent.data.current, 2);
    const alignWithView = await router.handle({
        jsonrpc: '2.0',
        id: 28,
        method: 'tools/call',
        params: {
            name: 'scene_view_align_with_view',
            arguments: {}
        }
    });
    assert.ok(alignWithView);
    assert.strictEqual(alignWithView.result.isError, false);
    const alignViewWithNode = await router.handle({
        jsonrpc: '2.0',
        id: 29,
        method: 'tools/call',
        params: {
            name: 'scene_view_align_view_with_node',
            arguments: {}
        }
    });
    assert.ok(alignViewWithNode);
    assert.strictEqual(alignViewWithNode.result.isError, false);
    assert.deepStrictEqual(alignCalls, ['align-with-view', 'align-view-with-node']);
}
async function testUiAutomationTools() {
    const nodes = new Map();
    const createdNodeCalls = [];
    const createdComponentCalls = [];
    const setPropertyCalls = [];
    let nodeCounter = 0;
    const ensureNode = (node) => {
        nodes.set(node.uuid, node);
    };
    ensureNode({
        uuid: 'root',
        name: 'MainScene',
        parent: null,
        children: ['canvas-1'],
        components: []
    });
    ensureNode({
        uuid: 'canvas-1',
        name: 'Canvas',
        parent: 'root',
        children: [],
        components: ['cc.Canvas', 'cc.UITransform']
    });
    const createNodeDump = (uuid) => {
        const node = nodes.get(uuid);
        if (!node) {
            throw new Error(`Node not found: ${uuid}`);
        }
        return {
            uuid: { value: node.uuid },
            name: { value: node.name },
            __comps__: node.components.map((type, index) => ({
                __type__: { value: type },
                uuid: { value: `${uuid}-comp-${index}` }
            }))
        };
    };
    const createTreeDump = (uuid) => {
        const node = nodes.get(uuid);
        if (!node) {
            throw new Error(`Tree node not found: ${uuid}`);
        }
        return {
            uuid: { value: node.uuid },
            name: { value: node.name },
            children: node.children.map((childUuid) => createTreeDump(childUuid))
        };
    };
    const requester = async (channel, method, ...args) => {
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'query-node-tree') {
            return createTreeDump('root');
        }
        if (method === 'query-node') {
            return createNodeDump(args[0]);
        }
        if (method === 'create-node') {
            const options = args[0] || {};
            createdNodeCalls.push(options);
            nodeCounter += 1;
            const nodeUuid = `node-ui-${nodeCounter}`;
            const parentUuid = options.parent || 'root';
            const parent = nodes.get(parentUuid);
            if (!parent) {
                throw new Error(`Parent not found: ${parentUuid}`);
            }
            const node = {
                uuid: nodeUuid,
                name: options.name || `Node-${nodeCounter}`,
                parent: parentUuid,
                children: [],
                components: []
            };
            nodes.set(nodeUuid, node);
            parent.children.push(nodeUuid);
            return nodeUuid;
        }
        if (method === 'create-component') {
            const payload = args[0];
            createdComponentCalls.push(payload);
            const node = nodes.get(payload.uuid);
            if (!node) {
                throw new Error(`Create component target not found: ${payload.uuid}`);
            }
            if (!node.components.includes(payload.component)) {
                node.components.push(payload.component);
            }
            return undefined;
        }
        if (method === 'set-property') {
            setPropertyCalls.push(args[0]);
            return true;
        }
        throw new Error(`Unexpected scene method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.query-node-tree',
        'scene.query-node',
        'scene.create-node',
        'scene.create-component',
        'scene.set-property'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 300,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('ui_create_element'));
    assert.ok(toolNames.includes('ui_set_rect_transform'));
    assert.ok(toolNames.includes('ui_set_text'));
    assert.ok(toolNames.includes('ui_set_layout'));
    const createElement = await router.handle({
        jsonrpc: '2.0',
        id: 301,
        method: 'tools/call',
        params: {
            name: 'ui_create_element',
            arguments: {
                elementType: 'Label',
                elementName: 'Title',
                parentPath: 'Canvas'
            }
        }
    });
    assert.ok(createElement);
    assert.strictEqual(createElement.result.isError, false);
    const createdNodeUuid = createElement.result.structuredContent.data.nodeUuid;
    assert.strictEqual(createdNodeCalls.length, 1);
    assert.strictEqual(createdNodeCalls[0].parent, 'canvas-1');
    assert.strictEqual(createdNodeCalls[0].name, 'Title');
    assert.ok(createElement.result.structuredContent.data.ensuredComponents.includes('cc.UITransform'));
    assert.ok(createElement.result.structuredContent.data.ensuredComponents.includes('cc.Label'));
    const setRect = await router.handle({
        jsonrpc: '2.0',
        id: 302,
        method: 'tools/call',
        params: {
            name: 'ui_set_rect_transform',
            arguments: {
                nodeUuid: createdNodeUuid,
                size: { width: 320, height: 80 },
                anchor: { x: 0.5, y: 0.5 },
                position: { x: 10, y: 20, z: 0 }
            }
        }
    });
    assert.ok(setRect);
    assert.strictEqual(setRect.result.isError, false);
    const setText = await router.handle({
        jsonrpc: '2.0',
        id: 303,
        method: 'tools/call',
        params: {
            name: 'ui_set_text',
            arguments: {
                nodeUuid: createdNodeUuid,
                text: 'Hello UI',
                fontSize: 32,
                horizontalAlign: 'center'
            }
        }
    });
    assert.ok(setText);
    assert.strictEqual(setText.result.isError, false);
    const setLayout = await router.handle({
        jsonrpc: '2.0',
        id: 304,
        method: 'tools/call',
        params: {
            name: 'ui_set_layout',
            arguments: {
                nodePath: 'Canvas',
                layoutType: 'vertical',
                spacing: '8,10',
                padding: '12,12,8,8'
            }
        }
    });
    assert.ok(setLayout);
    assert.strictEqual(setLayout.result.isError, false);
    assert.ok(createdComponentCalls.some((item) => item.component === 'cc.Label'));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('contentSize')));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('.string')));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('.type')));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('paddingLeft')));
}
async function testAssetManagementTools() {
    const requester = async (channel, method, ...args) => {
        if (channel !== 'asset-db') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'move-asset') {
            return { source: args[0], target: args[1] };
        }
        if (method === 'query-path') {
            return '/Users/blue/Developer/CocosProjects/HelloWorld/assets/a.prefab';
        }
        if (method === 'query-url') {
            return 'db://assets/a.prefab';
        }
        if (method === 'query-uuid') {
            return 'uuid-a';
        }
        if (method === 'reimport-asset') {
            return undefined;
        }
        if (method === 'refresh-asset') {
            return undefined;
        }
        if (method === 'open-asset') {
            return undefined;
        }
        throw new Error(`Unexpected asset method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'asset-db.move-asset',
        'asset-db.query-path',
        'asset-db.query-url',
        'asset-db.query-uuid',
        'asset-db.reimport-asset',
        'asset-db.refresh-asset',
        'asset-db.open-asset'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const move = await router.handle({
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/call',
        params: {
            name: 'asset_move_asset',
            arguments: {
                source: 'db://assets/a.prefab',
                target: 'db://assets/b.prefab'
            }
        }
    });
    assert.ok(move);
    assert.strictEqual(move.result.isError, false);
    const queryPath = await router.handle({
        jsonrpc: '2.0',
        id: 31,
        method: 'tools/call',
        params: {
            name: 'asset_query_path',
            arguments: {
                urlOrUuid: 'uuid-a'
            }
        }
    });
    assert.ok(queryPath);
    assert.strictEqual(queryPath.result.isError, false);
    assert.ok(queryPath.result.structuredContent.data.path.includes('/assets/a.prefab'));
    const queryUrl = await router.handle({
        jsonrpc: '2.0',
        id: 32,
        method: 'tools/call',
        params: {
            name: 'asset_query_url',
            arguments: {
                uuidOrPath: 'uuid-a'
            }
        }
    });
    assert.ok(queryUrl);
    assert.strictEqual(queryUrl.result.isError, false);
    assert.strictEqual(queryUrl.result.structuredContent.data.url, 'db://assets/a.prefab');
    const queryUuid = await router.handle({
        jsonrpc: '2.0',
        id: 33,
        method: 'tools/call',
        params: {
            name: 'asset_query_uuid',
            arguments: {
                urlOrPath: 'db://assets/a.prefab'
            }
        }
    });
    assert.ok(queryUuid);
    assert.strictEqual(queryUuid.result.isError, false);
    assert.strictEqual(queryUuid.result.structuredContent.data.uuid, 'uuid-a');
    const reimport = await router.handle({
        jsonrpc: '2.0',
        id: 34,
        method: 'tools/call',
        params: {
            name: 'asset_reimport_asset',
            arguments: {
                url: 'db://assets/a.prefab'
            }
        }
    });
    assert.ok(reimport);
    assert.strictEqual(reimport.result.isError, false);
    const refresh = await router.handle({
        jsonrpc: '2.0',
        id: 35,
        method: 'tools/call',
        params: {
            name: 'asset_refresh_asset',
            arguments: {
                url: 'db://assets/a.prefab'
            }
        }
    });
    assert.ok(refresh);
    assert.strictEqual(refresh.result.isError, false);
    const open = await router.handle({
        jsonrpc: '2.0',
        id: 36,
        method: 'tools/call',
        params: {
            name: 'asset_open_asset',
            arguments: {
                urlOrUuid: 'db://assets/a.prefab'
            }
        }
    });
    assert.ok(open);
    assert.strictEqual(open.result.isError, false);
}
async function testPrefabLifecycleTools() {
    const restoreCalls = [];
    const resetNodeCalls = [];
    const resetComponentCalls = [];
    const createNodeCalls = [];
    const removeNodeCalls = [];
    const applyCalls = [];
    const createPrefabCalls = [];
    const linkPrefabCalls = [];
    const unlinkPrefabCalls = [];
    const queriedAssetUuids = [];
    let createAttempt = 0;
    const prefabNodeStates = {
        'node-prefab-1': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-prefab-2': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-ref-only': null,
        'node-created-invalid': null,
        'node-created-from-prefab': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-link-target': null
    };
    const createdPrefabAssets = {};
    const requester = async (channel, method, ...args) => {
        if (channel === 'asset-db' && method === 'query-asset-info') {
            queriedAssetUuids.push(args[0]);
            if (typeof args[0] === 'string' && createdPrefabAssets[args[0]]) {
                return {
                    uuid: createdPrefabAssets[args[0]],
                    url: args[0],
                    type: 'cc.Prefab'
                };
            }
            return {
                uuid: args[0],
                type: 'cc.Prefab'
            };
        }
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'query-nodes-by-asset-uuid') {
            return ['node-prefab-1', 'node-ref-only', 'node-prefab-2'];
        }
        if (method === 'create-node') {
            createNodeCalls.push(args[0]);
            createAttempt += 1;
            return createAttempt === 1 ? 'node-created-invalid' : 'node-created-from-prefab';
        }
        if (method === 'remove-node') {
            removeNodeCalls.push(args[0]);
            return true;
        }
        if (method === 'query-node') {
            const nodeUuid = args[0];
            const prefabState = prefabNodeStates[nodeUuid];
            if (!prefabState) {
                return {
                    name: { value: 'PlayerRoot' }
                };
            }
            return {
                name: { value: 'PlayerRoot' },
                prefab: {
                    state: prefabState.state,
                    assetUuid: { value: prefabState.assetUuid }
                }
            };
        }
        if (method === 'apply-prefab') {
            applyCalls.push(args[0]);
            return true;
        }
        if (method === 'create-prefab') {
            createPrefabCalls.push(args);
            const firstArg = args[0];
            const secondArg = args[1];
            let nodeUuid;
            let targetUrl;
            if (typeof firstArg === 'string' && typeof secondArg === 'string') {
                nodeUuid = firstArg;
                targetUrl = secondArg;
            }
            else if (firstArg && typeof firstArg === 'object') {
                nodeUuid = firstArg.uuid || firstArg.nodeUuid || firstArg.node;
                targetUrl = firstArg.url || firstArg.targetUrl;
            }
            if (!nodeUuid || !targetUrl) {
                throw new Error('invalid create-prefab arguments');
            }
            const newAssetUuid = 'asset-created-prefab-1';
            createdPrefabAssets[targetUrl] = newAssetUuid;
            return { uuid: newAssetUuid };
        }
        if (method === 'link-prefab') {
            const firstArg = args[0];
            const secondArg = args[1];
            let nodeUuid;
            let assetUuid;
            if (typeof firstArg === 'string' && typeof secondArg === 'string') {
                nodeUuid = firstArg;
                assetUuid = secondArg;
            }
            else if (firstArg && typeof firstArg === 'object') {
                nodeUuid = firstArg.uuid || firstArg.node;
                assetUuid = firstArg.assetUuid || firstArg.prefab;
            }
            if (!nodeUuid || !assetUuid) {
                throw new Error('invalid link-prefab arguments');
            }
            if (nodeUuid === 'node-created-invalid') {
                throw new Error('mock link-prefab failed');
            }
            linkPrefabCalls.push({ nodeUuid, assetUuid });
            prefabNodeStates[nodeUuid] = { state: 1, assetUuid };
            return true;
        }
        if (method === 'unlink-prefab') {
            const firstArg = args[0];
            const secondArg = args[1];
            let nodeUuid;
            let removeNested = false;
            if (typeof firstArg === 'string') {
                nodeUuid = firstArg;
                removeNested = Boolean(secondArg);
            }
            else if (firstArg && typeof firstArg === 'object') {
                nodeUuid = firstArg.uuid || firstArg.node;
                removeNested = Boolean(firstArg.removeNested);
            }
            if (!nodeUuid) {
                throw new Error('invalid unlink-prefab arguments');
            }
            unlinkPrefabCalls.push({ nodeUuid, removeNested });
            prefabNodeStates[nodeUuid] = null;
            return true;
        }
        if (method === 'restore-prefab') {
            restoreCalls.push(args[0].uuid);
            return true;
        }
        if (method === 'reset-node') {
            resetNodeCalls.push(args[0]);
            return true;
        }
        if (method === 'reset-component') {
            resetComponentCalls.push(args[0]);
            return true;
        }
        throw new Error(`Unexpected scene method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.create-node',
        'scene.remove-node',
        'scene.query-nodes-by-asset-uuid',
        'scene.query-node',
        'scene.apply-prefab',
        'scene.create-prefab',
        'scene.link-prefab',
        'scene.unlink-prefab',
        'scene.restore-prefab',
        'scene.reset-node',
        'scene.reset-component',
        'asset-db.query-asset-info'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 40,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('prefab_create_instance'));
    assert.ok(toolNames.includes('prefab_create_asset_from_node'));
    assert.ok(toolNames.includes('prefab_link_node_to_asset'));
    assert.ok(toolNames.includes('prefab_unlink_instance'));
    assert.ok(toolNames.includes('prefab_query_nodes_by_asset_uuid'));
    assert.ok(toolNames.includes('prefab_query_instance_nodes_by_asset_uuid'));
    assert.ok(toolNames.includes('prefab_get_instance_info'));
    assert.ok(toolNames.includes('prefab_apply_instance'));
    assert.ok(toolNames.includes('prefab_apply_instances_by_asset'));
    assert.ok(toolNames.includes('prefab_restore_instance'));
    assert.ok(toolNames.includes('prefab_restore_instances_by_asset'));
    assert.ok(toolNames.includes('prefab_reset_node'));
    assert.ok(toolNames.includes('prefab_reset_component'));
    const createInstance = await router.handle({
        jsonrpc: '2.0',
        id: 40,
        method: 'tools/call',
        params: {
            name: 'prefab_create_instance',
            arguments: {
                assetUuid: 'asset-prefab-1',
                parentUuid: 'parent-1'
            }
        }
    });
    assert.ok(createInstance);
    assert.strictEqual(createInstance.result.isError, false);
    assert.strictEqual(createInstance.result.structuredContent.data.nodeUuid, 'node-created-from-prefab');
    assert.strictEqual(createNodeCalls.length, 2);
    assert.strictEqual(removeNodeCalls.length, 1);
    assert.strictEqual(removeNodeCalls[0].uuid, 'node-created-invalid');
    assert.strictEqual(queriedAssetUuids.length, 1);
    assert.strictEqual(queriedAssetUuids[0], 'asset-prefab-1');
    const createPrefabAsset = await router.handle({
        jsonrpc: '2.0',
        id: 401,
        method: 'tools/call',
        params: {
            name: 'prefab_create_asset_from_node',
            arguments: {
                nodeUuid: 'node-prefab-1',
                targetUrl: 'db://assets/generated/new.prefab'
            }
        }
    });
    assert.ok(createPrefabAsset);
    assert.strictEqual(createPrefabAsset.result.isError, false);
    assert.strictEqual(createPrefabCalls.length, 1);
    assert.strictEqual(createPrefabAsset.result.structuredContent.data.prefabUuid, 'asset-created-prefab-1');
    const linkNode = await router.handle({
        jsonrpc: '2.0',
        id: 402,
        method: 'tools/call',
        params: {
            name: 'prefab_link_node_to_asset',
            arguments: {
                nodeUuid: 'node-link-target',
                assetUuid: 'asset-prefab-link-1'
            }
        }
    });
    assert.ok(linkNode);
    assert.strictEqual(linkNode.result.isError, false);
    assert.strictEqual(linkPrefabCalls.length, 1);
    assert.strictEqual(linkNode.result.structuredContent.data.after.prefabAssetUuid, 'asset-prefab-link-1');
    const unlinkNode = await router.handle({
        jsonrpc: '2.0',
        id: 403,
        method: 'tools/call',
        params: {
            name: 'prefab_unlink_instance',
            arguments: {
                nodeUuid: 'node-link-target',
                removeNested: true
            }
        }
    });
    assert.ok(unlinkNode);
    assert.strictEqual(unlinkNode.result.isError, false);
    assert.strictEqual(unlinkPrefabCalls.length, 1);
    const queryNodes = await router.handle({
        jsonrpc: '2.0',
        id: 41,
        method: 'tools/call',
        params: {
            name: 'prefab_query_nodes_by_asset_uuid',
            arguments: {
                assetUuid: 'asset-prefab-1'
            }
        }
    });
    assert.ok(queryNodes);
    assert.strictEqual(queryNodes.result.isError, false);
    assert.strictEqual(queryNodes.result.structuredContent.data.count, 3);
    const queryInstanceNodes = await router.handle({
        jsonrpc: '2.0',
        id: 411,
        method: 'tools/call',
        params: {
            name: 'prefab_query_instance_nodes_by_asset_uuid',
            arguments: {
                assetUuid: 'asset-prefab-1'
            }
        }
    });
    assert.ok(queryInstanceNodes);
    assert.strictEqual(queryInstanceNodes.result.isError, false);
    assert.strictEqual(queryInstanceNodes.result.structuredContent.data.count, 2);
    assert.strictEqual(queryInstanceNodes.result.structuredContent.data.skipped.length, 1);
    assert.strictEqual(queryInstanceNodes.result.structuredContent.data.skipped[0].nodeUuid, 'node-ref-only');
    const instanceInfo = await router.handle({
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: {
            name: 'prefab_get_instance_info',
            arguments: {
                nodeUuid: 'node-prefab-1'
            }
        }
    });
    assert.ok(instanceInfo);
    assert.strictEqual(instanceInfo.result.isError, false);
    assert.strictEqual(instanceInfo.result.structuredContent.data.isPrefabInstance, true);
    assert.strictEqual(instanceInfo.result.structuredContent.data.prefabAssetUuid, 'asset-prefab-1');
    const applySingle = await router.handle({
        jsonrpc: '2.0',
        id: 425,
        method: 'tools/call',
        params: {
            name: 'prefab_apply_instance',
            arguments: {
                nodeUuid: 'node-prefab-1',
                prefabUuid: 'asset-prefab-1'
            }
        }
    });
    assert.ok(applySingle);
    assert.strictEqual(applySingle.result.isError, false);
    const applyBatch = await router.handle({
        jsonrpc: '2.0',
        id: 426,
        method: 'tools/call',
        params: {
            name: 'prefab_apply_instances_by_asset',
            arguments: {
                assetUuid: 'asset-prefab-1'
            }
        }
    });
    assert.ok(applyBatch);
    assert.strictEqual(applyBatch.result.isError, false);
    assert.strictEqual(applyBatch.result.structuredContent.data.successCount, 2);
    assert.strictEqual(applyBatch.result.structuredContent.data.failureCount, 1);
    assert.strictEqual(applyCalls.length, 3);
    assert.strictEqual(typeof applyCalls[0], 'string');
    const restoreSingle = await router.handle({
        jsonrpc: '2.0',
        id: 43,
        method: 'tools/call',
        params: {
            name: 'prefab_restore_instance',
            arguments: {
                nodeUuid: 'node-prefab-1'
            }
        }
    });
    assert.ok(restoreSingle);
    assert.strictEqual(restoreSingle.result.isError, false);
    const restoreBatch = await router.handle({
        jsonrpc: '2.0',
        id: 44,
        method: 'tools/call',
        params: {
            name: 'prefab_restore_instances_by_asset',
            arguments: {
                assetUuid: 'asset-prefab-1'
            }
        }
    });
    assert.ok(restoreBatch);
    assert.strictEqual(restoreBatch.result.isError, false);
    assert.strictEqual(restoreBatch.result.structuredContent.data.successCount, 3);
    const resetNode = await router.handle({
        jsonrpc: '2.0',
        id: 45,
        method: 'tools/call',
        params: {
            name: 'prefab_reset_node',
            arguments: {
                nodeUuids: ['node-prefab-1', 'node-prefab-2']
            }
        }
    });
    assert.ok(resetNode);
    assert.strictEqual(resetNode.result.isError, false);
    assert.strictEqual(resetNodeCalls.length, 1);
    const resetComponent = await router.handle({
        jsonrpc: '2.0',
        id: 46,
        method: 'tools/call',
        params: {
            name: 'prefab_reset_component',
            arguments: {
                componentUuid: 'comp-1'
            }
        }
    });
    assert.ok(resetComponent);
    assert.strictEqual(resetComponent.result.isError, false);
    assert.strictEqual(resetComponentCalls.length, 1);
    assert.ok(restoreCalls.length >= 4);
    assert.ok(restoreCalls.includes('node-prefab-1'));
    assert.ok(restoreCalls.includes('node-prefab-2'));
    assert.ok(restoreCalls.includes('node-ref-only'));
}
async function testUnknownTool() {
    var _a;
    const tools = (0, official_tools_1.createOfficialTools)(async () => undefined);
    const matrix = createMatrix([]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const response = await router.handle({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
            name: 'not-exists',
            arguments: {}
        }
    });
    assert.ok(response);
    assert.strictEqual((_a = response.error) === null || _a === void 0 ? void 0 : _a.code, -32602);
}
async function run() {
    await testListAndReadDomainCalls();
    await testWriteToolCall();
    await testLifecycleAndRuntimeTools();
    await testSceneViewTools();
    await testUiAutomationTools();
    await testAssetManagementTools();
    await testPrefabLifecycleTools();
    await testUnknownTool();
    console.log('next-router-test: PASS');
}
run().catch((error) => {
    console.error('next-router-test: FAIL', error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1yb3V0ZXItdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcm91dGVyLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU87WUFDUCxNQUFNO1lBQ04sS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZ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QU0sRUFBRSxZQUFZO1FBQ3BCLE1BQU0sRUFBRTtZQUNKLElBQUksRUFBRSxZQUFZO1lBQ2xCLFNBQVMsRUFBRSxFQUFFO1NBQ2hCO0tBQ0osQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNwQixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQUEsUUFBUyxDQUFDLEtBQUssMENBQUUsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUVELEtBQUssVUFBVSxHQUFHO0lBQ2QsTUFBTSwwQkFBMEIsRUFBRSxDQUFDO0lBQ25DLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUMxQixNQUFNLDRCQUE0QixFQUFFLENBQUM7SUFDckMsTUFBTSxrQkFBa0IsRUFBRSxDQUFDO0lBQzNCLE1BQU0scUJBQXFCLEVBQUUsQ0FBQztJQUM5QixNQUFNLHdCQUF3QixFQUFFLENBQUM7SUFDakMsTUFBTSx3QkFBd0IsRUFBRSxDQUFDO0lBQ2pDLE1BQU0sZUFBZSxFQUFFLENBQUM7SUFDeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQy9DLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhcGFiaWxpdHlNYXRyaXggfSBmcm9tICcuLi9uZXh0L21vZGVscyc7XG5pbXBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmltcG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3JvdXRlcic7XG5pbXBvcnQgeyBjcmVhdGVPZmZpY2lhbFRvb2xzIH0gZnJvbSAnLi4vbmV4dC90b29scy9vZmZpY2lhbC10b29scyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdHJpeChhdmFpbGFibGVLZXlzOiBzdHJpbmdbXSk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIGNvbnN0IGJ5S2V5OiBDYXBhYmlsaXR5TWF0cml4WydieUtleSddID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgb2YgYXZhaWxhYmxlS2V5cykge1xuICAgICAgICBjb25zdCBmaXJzdERvdCA9IGtleS5pbmRleE9mKCcuJyk7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBrZXkuc2xpY2UoMCwgZmlyc3REb3QpO1xuICAgICAgICBjb25zdCBtZXRob2QgPSBrZXkuc2xpY2UoZmlyc3REb3QgKyAxKTtcbiAgICAgICAgYnlLZXlba2V5XSA9IHtcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGNoYW5uZWwsXG4gICAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGtleSxcbiAgICAgICAgICAgIGF2YWlsYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNoZWNrZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgZGV0YWlsOiAnb2snXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ2VuZXJhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgYnlLZXksXG4gICAgICAgIHN1bW1hcnk6IHtcbiAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIGF2YWlsYWJsZTogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICB1bmF2YWlsYWJsZTogMCxcbiAgICAgICAgICAgIGJ5TGF5ZXI6IHtcbiAgICAgICAgICAgICAgICBvZmZpY2lhbDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogYXZhaWxhYmxlS2V5cy5sZW5ndGhcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGV4dGVuZGVkOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGV4cGVyaW1lbnRhbDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdExpc3RBbmRSZWFkRG9tYWluQ2FsbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktbm9kZS10cmVlJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogJ3Jvb3QnLCBuYW1lOiB7IHZhbHVlOiAnTWFpblNjZW5lJyB9LCBjaGlsZHJlbjogW10gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiAnbm9kZS0xJyB9LFxuICAgICAgICAgICAgICAgIF9fY29tcHNfXzogW1xuICAgICAgICAgICAgICAgICAgICB7IF9fdHlwZV9fOiB7IHZhbHVlOiAnY2MuTGFiZWwnIH0sIHV1aWQ6IHsgdmFsdWU6ICdjb21wLTEnIH0gfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXRzJykge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICB7IHVybDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJywgdXVpZDogJ3V1aWQtYScgfSxcbiAgICAgICAgICAgICAgICB7IHVybDogJ2RiOi8vYXNzZXRzL2IucHJlZmFiJywgdXVpZDogJ3V1aWQtYicgfVxuICAgICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnKSB7XG4gICAgICAgICAgICByZXR1cm4gWydkZXAtdXVpZC0xJywgJ2RlcC11dWlkLTInXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1hc3NldC1pbmZvJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogYXJnc1swXSwgdXJsOiBgZGI6Ly9hc3NldHMvJHthcmdzWzBdfS5wcmVmYWJgIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhbGw6ICR7Y2hhbm5lbH0uJHttZXRob2R9KCR7SlNPTi5zdHJpbmdpZnkoYXJncyl9KWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUucXVlcnktbm9kZS10cmVlJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktYXNzZXRzJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJ1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgbGlzdFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcblxuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGFzc2VydC5vayhBcnJheS5pc0FycmF5KGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzKSk7XG4gICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfbGlzdF9nYW1lX29iamVjdHMnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfZ2V0X2dhbWVfb2JqZWN0X2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnY29tcG9uZW50X2xpc3Rfb25fbm9kZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdhc3NldF9xdWVyeV9kZXBlbmRlbmNpZXMnKSk7XG4gICAgYXNzZXJ0Lm9rKCF0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2NyZWF0ZV9nYW1lX29iamVjdCcpLCAn5YaZ5pON5L2c6IO95Yqb5pyq5o6i5rWL5pe25LiN5bqU5pq06Zyy5YaZ5bel5YW3Jyk7XG5cbiAgICBjb25zdCBjYWxsUmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yVXVpZDogJ2RiOi8vYXNzZXRzL3BsYXllci5wcmVmYWInLFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uVHlwZTogJ2FsbCcsXG4gICAgICAgICAgICAgICAgaW5jbHVkZUFzc2V0SW5mbzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2soY2FsbFJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbFJlc3BvbnNlIS5lcnJvciwgdW5kZWZpbmVkKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbFJlc3BvbnNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5zdWNjZXNzLCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbFJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jb3VudCwgMik7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuZGVwZW5kZW5jeUluZm9zLmxlbmd0aCwgMik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RXcml0ZVRvb2xDYWxsKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHNldFByb3BlcnR5UGF5bG9hZHM6IGFueVtdID0gW107XG4gICAgY29uc3QgcmVtb3ZlQ29tcG9uZW50UGF5bG9hZHM6IGFueVtdID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiAnbm9kZS0xJyB9LFxuICAgICAgICAgICAgICAgIF9fY29tcHNfXzogW1xuICAgICAgICAgICAgICAgICAgICB7IF9fdHlwZV9fOiB7IHZhbHVlOiAnY2MuTGFiZWwnIH0sIHV1aWQ6IHsgdmFsdWU6ICdjb21wLXV1aWQtbGFiZWwnIH0gfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnc2V0LXByb3BlcnR5Jykge1xuICAgICAgICAgICAgc2V0UHJvcGVydHlQYXlsb2Fkcy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncmVtb3ZlLWNvbXBvbmVudCcpIHtcbiAgICAgICAgICAgIHJlbW92ZUNvbXBvbmVudFBheWxvYWRzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfSgke0pTT04uc3RyaW5naWZ5KGFyZ3MpfSlgKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUnLFxuICAgICAgICAnc2NlbmUuc2V0LXByb3BlcnR5JyxcbiAgICAgICAgJ3NjZW5lLnJlbW92ZS1jb21wb25lbnQnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBzZXRQcm9wZXJ0eVJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9zZXRfcHJvcGVydHknLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLTEnLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6ICdjYy5MYWJlbCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogJ0hlbGxvIE5leHQnLFxuICAgICAgICAgICAgICAgIHZhbHVlVHlwZTogJ1N0cmluZydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKHNldFByb3BlcnR5UmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVJlc3BvbnNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVBheWxvYWRzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFByb3BlcnR5UGF5bG9hZHNbMF0ucGF0aCwgJ19fY29tcHNfXy4wLnN0cmluZycpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVBheWxvYWRzWzBdLmR1bXAudmFsdWUsICdIZWxsbyBOZXh0Jyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFByb3BlcnR5UGF5bG9hZHNbMF0uZHVtcC50eXBlLCAnU3RyaW5nJyk7XG5cbiAgICBjb25zdCByZW1vdmVDb21wb25lbnRSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfcmVtb3ZlX2NvbXBvbmVudCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtMScsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogJ2NjLkxhYmVsJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2socmVtb3ZlQ29tcG9uZW50UmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZW1vdmVDb21wb25lbnRSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlQ29tcG9uZW50UGF5bG9hZHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlQ29tcG9uZW50UGF5bG9hZHNbMF0udXVpZCwgJ2NvbXAtdXVpZC1sYWJlbCcpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0TGlmZWN5Y2xlQW5kUnVudGltZVRvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNhbGxMb2c6IEFycmF5PHsgY2hhbm5lbDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZzsgYXJnczogYW55W10gfT4gPSBbXTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGNhbGxMb2cucHVzaCh7IGNoYW5uZWwsIG1ldGhvZCwgYXJncyB9KTtcblxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdzYXZlLXNjZW5lJykge1xuICAgICAgICAgICAgcmV0dXJuICdkYjovL2Fzc2V0cy9zY2VuZXMvYm9vdC5zY2VuZSc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnY2xvc2Utc2NlbmUnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1pcy1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWRpcnR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXNjZW5lLWJvdW5kcycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHg6IDAsIHk6IDAsIHdpZHRoOiAxMjgwLCBoZWlnaHQ6IDcyMCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2ZvY3VzLWNhbWVyYScpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcm9qZWN0JyAmJiBtZXRob2QgPT09ICdxdWVyeS1jb25maWcnKSB7XG4gICAgICAgICAgICByZXR1cm4geyBuYW1lOiAnSGVsbG9Xb3JsZCcsIGxhbmd1YWdlOiAnemgnIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcmVmZXJlbmNlcycgJiYgbWV0aG9kID09PSAncXVlcnktY29uZmlnJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgbGFuZ3VhZ2U6ICd6aC1DTicgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NlcnZlcicgJiYgbWV0aG9kID09PSAncXVlcnktaXAtbGlzdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBbJzEyNy4wLjAuMSddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2VydmVyJyAmJiBtZXRob2QgPT09ICdxdWVyeS1wb3J0Jykge1xuICAgICAgICAgICAgcmV0dXJuIDc0NTY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdlbmdpbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWVuZ2luZS1pbmZvJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmVyc2lvbjogJzMuOC44JywgbW9kdWxlczogW10gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2J1aWxkZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXdvcmtlci1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ29wZW4tYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhbGw6ICR7Y2hhbm5lbH0uJHttZXRob2R9KCR7SlNPTi5zdHJpbmdpZnkoYXJncyl9KWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnYXNzZXQtZGIub3Blbi1hc3NldCcsXG4gICAgICAgICdzY2VuZS5xdWVyeS1pcy1yZWFkeScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1kaXJ0eScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1zY2VuZS1ib3VuZHMnLFxuICAgICAgICAnc2NlbmUuZm9jdXMtY2FtZXJhJyxcbiAgICAgICAgJ3Byb2plY3QucXVlcnktY29uZmlnJyxcbiAgICAgICAgJ3ByZWZlcmVuY2VzLnF1ZXJ5LWNvbmZpZycsXG4gICAgICAgICdzZXJ2ZXIucXVlcnktaXAtbGlzdCcsXG4gICAgICAgICdzZXJ2ZXIucXVlcnktcG9ydCcsXG4gICAgICAgICdlbmdpbmUucXVlcnktZW5naW5lLWluZm8nLFxuICAgICAgICAnYnVpbGRlci5xdWVyeS13b3JrZXItcmVhZHknXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9vcGVuX3NjZW5lJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3NhdmVfc2NlbmUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfY2xvc2Vfc2NlbmUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfcXVlcnlfc3RhdHVzJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2ZvY3VzX2NhbWVyYScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcm9qZWN0X3F1ZXJ5X2NvbmZpZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmZXJlbmNlc19xdWVyeV9jb25maWcnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2VydmVyX3F1ZXJ5X25ldHdvcmsnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZW5naW5lX3F1ZXJ5X3J1bnRpbWVfaW5mbycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdlbmdpbmVfcXVlcnlfZW5naW5lX2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnYnVpbGRlcl9xdWVyeV93b3JrZXJfcmVhZHknKSk7XG5cbiAgICBjb25zdCBzY2VuZVN0YXR1cyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDExLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfcXVlcnlfc3RhdHVzJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVCb3VuZHM6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzY2VuZVN0YXR1cyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzY2VuZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuaXNSZWFkeSwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pc0RpcnR5LCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ib3VuZHMud2lkdGgsIDEyODApO1xuXG4gICAgY29uc3Qgb3BlblNjZW5lID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9vcGVuX3NjZW5lJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHNjZW5lVXJsOiAnZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sob3BlblNjZW5lKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3BlblNjZW5lIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuU2NlbmUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm9wZW5lZCwgdHJ1ZSk7XG5cbiAgICBjb25zdCBzYXZlU2NlbmUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3NhdmVfc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgZm9yY2U6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzYXZlU2NlbmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzYXZlU2NlbmUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVTY2VuZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc2NlbmVVcmwsICdkYjovL2Fzc2V0cy9zY2VuZXMvYm9vdC5zY2VuZScpO1xuXG4gICAgY29uc3QgY2xvc2VTY2VuZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfY2xvc2Vfc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNsb3NlU2NlbmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjbG9zZVNjZW5lIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjbG9zZVNjZW5lIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jbG9zZWQsIHRydWUpO1xuXG4gICAgY29uc3QgZm9jdXNDYW1lcmEgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2ZvY3VzX2NhbWVyYScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkczogJ25vZGUtMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhmb2N1c0NhbWVyYSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzQ2FtZXJhIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZm9jdXNDYW1lcmEhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnV1aWRzLCBbJ25vZGUtMSddKTtcblxuICAgIGNvbnN0IHByb2plY3RDb25maWcgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3Byb2plY3RfcXVlcnlfY29uZmlnJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6ICdwcm9qZWN0JyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbDogJ3Byb2plY3QnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socHJvamVjdENvbmZpZyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHByb2plY3RDb25maWchLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBwcmVmZXJlbmNlc0NvbmZpZyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE3LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmVyZW5jZXNfcXVlcnlfY29uZmlnJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6ICdnZW5lcmFsJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHByZWZlcmVuY2VzQ29uZmlnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocHJlZmVyZW5jZXNDb25maWchLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBuZXR3b3JrID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTgsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzZXJ2ZXJfcXVlcnlfbmV0d29yaycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sobmV0d29yayk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG5ldHdvcmshLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG5ldHdvcmshLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnBvcnQsIDc0NTYpO1xuXG4gICAgY29uc3QgcnVudGltZUluZm8gPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxOSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2VuZ2luZV9xdWVyeV9ydW50aW1lX2luZm8nLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJ1bnRpbWVJbmZvKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocnVudGltZUluZm8hLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJ1bnRpbWVJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pbmZvLnZlcnNpb24sICczLjguOCcpO1xuXG4gICAgY29uc3QgZW5naW5lSW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnZW5naW5lX3F1ZXJ5X2VuZ2luZV9pbmZvJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhlbmdpbmVJbmZvKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZW5naW5lSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHdvcmtlclJlYWR5ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdidWlsZGVyX3F1ZXJ5X3dvcmtlcl9yZWFkeScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sod29ya2VyUmVhZHkpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXJSZWFkeSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VyUmVhZHkhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJlYWR5LCB0cnVlKTtcblxuICAgIGFzc2VydC5vayhcbiAgICAgICAgY2FsbExvZy5zb21lKChpdGVtKSA9PiBpdGVtLmNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgaXRlbS5tZXRob2QgPT09ICdvcGVuLWFzc2V0JyksXG4gICAgICAgICflupTosIPnlKggYXNzZXQtZGIub3Blbi1hc3NldCdcbiAgICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0U2NlbmVWaWV3VG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICAgIGlzMkQ6IGZhbHNlLFxuICAgICAgICBnaXptb1Rvb2w6ICdtb3ZlJyxcbiAgICAgICAgZ2l6bW9QaXZvdDogJ2NlbnRlcicsXG4gICAgICAgIGdpem1vQ29vcmRpbmF0ZTogJ2xvY2FsJyxcbiAgICAgICAgaXNHcmlkVmlzaWJsZTogdHJ1ZSxcbiAgICAgICAgaXNJY29uR2l6bW8zRDogdHJ1ZSxcbiAgICAgICAgaWNvbkdpem1vU2l6ZTogMVxuICAgIH07XG4gICAgY29uc3QgYWxpZ25DYWxsczogc3RyaW5nW10gPSBbXTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsICE9PSAnc2NlbmUnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2hhbm5lbDogJHtjaGFubmVsfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWlzMkQnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuaXMyRDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktZ2l6bW8tdG9vbC1uYW1lJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmdpem1vVG9vbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktZ2l6bW8tcGl2b3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuZ2l6bW9QaXZvdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktZ2l6bW8tY29vcmRpbmF0ZScpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5naXptb0Nvb3JkaW5hdGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWlzLWdyaWQtdmlzaWJsZScpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5pc0dyaWRWaXNpYmxlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1pcy1pY29uLWdpem1vLTNkJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmlzSWNvbkdpem1vM0Q7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWljb24tZ2l6bW8tc2l6ZScpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5pY29uR2l6bW9TaXplO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1pcy1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjaGFuZ2UtaXMyRCcpIHtcbiAgICAgICAgICAgIHN0YXRlLmlzMkQgPSBCb29sZWFuKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY2hhbmdlLWdpem1vLXRvb2wnKSB7XG4gICAgICAgICAgICBzdGF0ZS5naXptb1Rvb2wgPSBhcmdzWzBdO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY2hhbmdlLWdpem1vLXBpdm90Jykge1xuICAgICAgICAgICAgc3RhdGUuZ2l6bW9QaXZvdCA9IGFyZ3NbMF07XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjaGFuZ2UtZ2l6bW8tY29vcmRpbmF0ZScpIHtcbiAgICAgICAgICAgIHN0YXRlLmdpem1vQ29vcmRpbmF0ZSA9IGFyZ3NbMF07XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzZXQtZ3JpZC12aXNpYmxlJykge1xuICAgICAgICAgICAgc3RhdGUuaXNHcmlkVmlzaWJsZSA9IEJvb2xlYW4oYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzZXQtaWNvbi1naXptby0zZCcpIHtcbiAgICAgICAgICAgIHN0YXRlLmlzSWNvbkdpem1vM0QgPSBCb29sZWFuKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2V0LWljb24tZ2l6bW8tc2l6ZScpIHtcbiAgICAgICAgICAgIHN0YXRlLmljb25HaXptb1NpemUgPSBOdW1iZXIoYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdhbGlnbi13aXRoLXZpZXcnIHx8IG1ldGhvZCA9PT0gJ2FsaWduLXZpZXctd2l0aC1ub2RlJykge1xuICAgICAgICAgICAgYWxpZ25DYWxscy5wdXNoKG1ldGhvZCk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHNjZW5lIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5xdWVyeS1pczJEJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWdpem1vLXRvb2wtbmFtZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1naXptby1waXZvdCcsXG4gICAgICAgICdzY2VuZS5xdWVyeS1naXptby1jb29yZGluYXRlJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWlzLWdyaWQtdmlzaWJsZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1pcy1pY29uLWdpem1vLTNkJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWljb24tZ2l6bW8tc2l6ZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1pcy1yZWFkeSdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfcXVlcnlfc3RhdGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfbW9kZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9naXptb190b29sJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X2dpem1vX3Bpdm90JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X2dpem1vX2Nvb3JkaW5hdGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfZ3JpZF92aXNpYmxlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X2ljb25fZ2l6bW9fdmlzaWJsZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9pY29uX2dpem1vX3NpemUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19hbGlnbl93aXRoX3ZpZXcnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19hbGlnbl92aWV3X3dpdGhfbm9kZScpKTtcblxuICAgIGNvbnN0IHF1ZXJ5U3RhdGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfcXVlcnlfc3RhdGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5U3RhdGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVN0YXRlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVN0YXRlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zdGF0ZS5pczJELCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5U3RhdGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnN0YXRlLmdpem1vVG9vbCwgJ21vdmUnKTtcblxuICAgIGNvbnN0IHNldE1vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X21vZGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgaXMyRDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldE1vZGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRNb2RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRNb2RlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jdXJyZW50LCB0cnVlKTtcblxuICAgIGNvbnN0IHNldFRvb2wgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X2dpem1vX3Rvb2wnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdG9vbDogJ3JvdGF0ZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRUb29sKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0VG9vbCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0VG9vbCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY3VycmVudCwgJ3JvdGF0ZScpO1xuXG4gICAgY29uc3Qgc2V0R3JpZCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDI2LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfZ3JpZF92aXNpYmxlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0R3JpZCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldEdyaWQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldEdyaWQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmN1cnJlbnQsIGZhbHNlKTtcblxuICAgIGNvbnN0IHNldEljb25TaXplID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjcsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3NldF9pY29uX2dpem1vX3NpemUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgc2l6ZTogMlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldEljb25TaXplKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0SWNvblNpemUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldEljb25TaXplIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jdXJyZW50LCAyKTtcblxuICAgIGNvbnN0IGFsaWduV2l0aFZpZXcgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyOCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfYWxpZ25fd2l0aF92aWV3JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhhbGlnbldpdGhWaWV3KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYWxpZ25XaXRoVmlldyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGFsaWduVmlld1dpdGhOb2RlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjksXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X2FsaWduX3ZpZXdfd2l0aF9ub2RlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhhbGlnblZpZXdXaXRoTm9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGFsaWduVmlld1dpdGhOb2RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWxpZ25DYWxscywgWydhbGlnbi13aXRoLXZpZXcnLCAnYWxpZ24tdmlldy13aXRoLW5vZGUnXSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RVaUF1dG9tYXRpb25Ub29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpbnRlcmZhY2UgTW9ja05vZGUge1xuICAgICAgICB1dWlkOiBzdHJpbmc7XG4gICAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgICAgcGFyZW50OiBzdHJpbmcgfCBudWxsO1xuICAgICAgICBjaGlsZHJlbjogc3RyaW5nW107XG4gICAgICAgIGNvbXBvbmVudHM6IHN0cmluZ1tdO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVzID0gbmV3IE1hcDxzdHJpbmcsIE1vY2tOb2RlPigpO1xuICAgIGNvbnN0IGNyZWF0ZWROb2RlQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgY3JlYXRlZENvbXBvbmVudENhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IHNldFByb3BlcnR5Q2FsbHM6IGFueVtdID0gW107XG4gICAgbGV0IG5vZGVDb3VudGVyID0gMDtcblxuICAgIGNvbnN0IGVuc3VyZU5vZGUgPSAobm9kZTogTW9ja05vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgbm9kZXMuc2V0KG5vZGUudXVpZCwgbm9kZSk7XG4gICAgfTtcblxuICAgIGVuc3VyZU5vZGUoe1xuICAgICAgICB1dWlkOiAncm9vdCcsXG4gICAgICAgIG5hbWU6ICdNYWluU2NlbmUnLFxuICAgICAgICBwYXJlbnQ6IG51bGwsXG4gICAgICAgIGNoaWxkcmVuOiBbJ2NhbnZhcy0xJ10sXG4gICAgICAgIGNvbXBvbmVudHM6IFtdXG4gICAgfSk7XG4gICAgZW5zdXJlTm9kZSh7XG4gICAgICAgIHV1aWQ6ICdjYW52YXMtMScsXG4gICAgICAgIG5hbWU6ICdDYW52YXMnLFxuICAgICAgICBwYXJlbnQ6ICdyb290JyxcbiAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICBjb21wb25lbnRzOiBbJ2NjLkNhbnZhcycsICdjYy5VSVRyYW5zZm9ybSddXG4gICAgfSk7XG5cbiAgICBjb25zdCBjcmVhdGVOb2RlRHVtcCA9ICh1dWlkOiBzdHJpbmcpOiBhbnkgPT4ge1xuICAgICAgICBjb25zdCBub2RlID0gbm9kZXMuZ2V0KHV1aWQpO1xuICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSBub3QgZm91bmQ6ICR7dXVpZH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiBub2RlLnV1aWQgfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdmFsdWU6IG5vZGUubmFtZSB9LFxuICAgICAgICAgICAgX19jb21wc19fOiBub2RlLmNvbXBvbmVudHMubWFwKCh0eXBlLCBpbmRleCkgPT4gKHtcbiAgICAgICAgICAgICAgICBfX3R5cGVfXzogeyB2YWx1ZTogdHlwZSB9LFxuICAgICAgICAgICAgICAgIHV1aWQ6IHsgdmFsdWU6IGAke3V1aWR9LWNvbXAtJHtpbmRleH1gIH1cbiAgICAgICAgICAgIH0pKVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBjb25zdCBjcmVhdGVUcmVlRHVtcCA9ICh1dWlkOiBzdHJpbmcpOiBhbnkgPT4ge1xuICAgICAgICBjb25zdCBub2RlID0gbm9kZXMuZ2V0KHV1aWQpO1xuICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVHJlZSBub2RlIG5vdCBmb3VuZDogJHt1dWlkfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiBub2RlLnV1aWQgfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdmFsdWU6IG5vZGUubmFtZSB9LFxuICAgICAgICAgICAgY2hpbGRyZW46IG5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZFV1aWQpID0+IGNyZWF0ZVRyZWVEdW1wKGNoaWxkVXVpZCkpXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsICE9PSAnc2NlbmUnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2hhbm5lbDogJHtjaGFubmVsfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUtdHJlZScpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVUcmVlRHVtcCgncm9vdCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZU5vZGVEdW1wKGFyZ3NbMF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtbm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdIHx8IHt9O1xuICAgICAgICAgICAgY3JlYXRlZE5vZGVDYWxscy5wdXNoKG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBub2RlQ291bnRlciArPSAxO1xuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBgbm9kZS11aS0ke25vZGVDb3VudGVyfWA7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRVdWlkID0gb3B0aW9ucy5wYXJlbnQgfHwgJ3Jvb3QnO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbm9kZXMuZ2V0KHBhcmVudFV1aWQpO1xuICAgICAgICAgICAgaWYgKCFwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCBub3QgZm91bmQ6ICR7cGFyZW50VXVpZH1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZTogTW9ja05vZGUgPSB7XG4gICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgbmFtZTogb3B0aW9ucy5uYW1lIHx8IGBOb2RlLSR7bm9kZUNvdW50ZXJ9YCxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbm9kZXMuc2V0KG5vZGVVdWlkLCBub2RlKTtcbiAgICAgICAgICAgIHBhcmVudC5jaGlsZHJlbi5wdXNoKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIHJldHVybiBub2RlVXVpZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY3JlYXRlLWNvbXBvbmVudCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY3JlYXRlZENvbXBvbmVudENhbGxzLnB1c2gocGF5bG9hZCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlcy5nZXQocGF5bG9hZC51dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ3JlYXRlIGNvbXBvbmVudCB0YXJnZXQgbm90IGZvdW5kOiAke3BheWxvYWQudXVpZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbm9kZS5jb21wb25lbnRzLmluY2x1ZGVzKHBheWxvYWQuY29tcG9uZW50KSkge1xuICAgICAgICAgICAgICAgIG5vZGUuY29tcG9uZW50cy5wdXNoKHBheWxvYWQuY29tcG9uZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NldC1wcm9wZXJ0eScpIHtcbiAgICAgICAgICAgIHNldFByb3BlcnR5Q2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHNjZW5lIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlLXRyZWUnLFxuICAgICAgICAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgICdzY2VuZS5jcmVhdGUtbm9kZScsXG4gICAgICAgICdzY2VuZS5jcmVhdGUtY29tcG9uZW50JyxcbiAgICAgICAgJ3NjZW5lLnNldC1wcm9wZXJ0eSdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCd1aV9jcmVhdGVfZWxlbWVudCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCd1aV9zZXRfcmVjdF90cmFuc2Zvcm0nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygndWlfc2V0X3RleHQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygndWlfc2V0X2xheW91dCcpKTtcblxuICAgIGNvbnN0IGNyZWF0ZUVsZW1lbnQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICd1aV9jcmVhdGVfZWxlbWVudCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBlbGVtZW50VHlwZTogJ0xhYmVsJyxcbiAgICAgICAgICAgICAgICBlbGVtZW50TmFtZTogJ1RpdGxlJyxcbiAgICAgICAgICAgICAgICBwYXJlbnRQYXRoOiAnQ2FudmFzJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZUVsZW1lbnQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVFbGVtZW50IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGNvbnN0IGNyZWF0ZWROb2RlVXVpZCA9IGNyZWF0ZUVsZW1lbnQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm5vZGVVdWlkIGFzIHN0cmluZztcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlZE5vZGVDYWxscy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkTm9kZUNhbGxzWzBdLnBhcmVudCwgJ2NhbnZhcy0xJyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWROb2RlQ2FsbHNbMF0ubmFtZSwgJ1RpdGxlJyk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZUVsZW1lbnQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmVuc3VyZWRDb21wb25lbnRzLmluY2x1ZGVzKCdjYy5VSVRyYW5zZm9ybScpKTtcbiAgICBhc3NlcnQub2soY3JlYXRlRWxlbWVudCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuZW5zdXJlZENvbXBvbmVudHMuaW5jbHVkZXMoJ2NjLkxhYmVsJykpO1xuXG4gICAgY29uc3Qgc2V0UmVjdCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3VpX3NldF9yZWN0X3RyYW5zZm9ybScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogY3JlYXRlZE5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIHNpemU6IHsgd2lkdGg6IDMyMCwgaGVpZ2h0OiA4MCB9LFxuICAgICAgICAgICAgICAgIGFuY2hvcjogeyB4OiAwLjUsIHk6IDAuNSB9LFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDEwLCB5OiAyMCwgejogMCB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0UmVjdCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFJlY3QhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBzZXRUZXh0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzAzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAndWlfc2V0X3RleHQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6IGNyZWF0ZWROb2RlVXVpZCxcbiAgICAgICAgICAgICAgICB0ZXh0OiAnSGVsbG8gVUknLFxuICAgICAgICAgICAgICAgIGZvbnRTaXplOiAzMixcbiAgICAgICAgICAgICAgICBob3Jpem9udGFsQWxpZ246ICdjZW50ZXInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0VGV4dCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFRleHQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBzZXRMYXlvdXQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMDQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICd1aV9zZXRfbGF5b3V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVQYXRoOiAnQ2FudmFzJyxcbiAgICAgICAgICAgICAgICBsYXlvdXRUeXBlOiAndmVydGljYWwnLFxuICAgICAgICAgICAgICAgIHNwYWNpbmc6ICc4LDEwJyxcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMTIsMTIsOCw4J1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldExheW91dCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldExheW91dCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGFzc2VydC5vayhjcmVhdGVkQ29tcG9uZW50Q2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5jb21wb25lbnQgPT09ICdjYy5MYWJlbCcpKTtcbiAgICBhc3NlcnQub2soc2V0UHJvcGVydHlDYWxscy5zb21lKChpdGVtKSA9PiBpdGVtLnBhdGguaW5jbHVkZXMoJ2NvbnRlbnRTaXplJykpKTtcbiAgICBhc3NlcnQub2soc2V0UHJvcGVydHlDYWxscy5zb21lKChpdGVtKSA9PiBpdGVtLnBhdGguaW5jbHVkZXMoJy5zdHJpbmcnKSkpO1xuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eUNhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0ucGF0aC5pbmNsdWRlcygnLnR5cGUnKSkpO1xuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eUNhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0ucGF0aC5pbmNsdWRlcygncGFkZGluZ0xlZnQnKSkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0QXNzZXRNYW5hZ2VtZW50VG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdhc3NldC1kYicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAnbW92ZS1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNvdXJjZTogYXJnc1swXSwgdGFyZ2V0OiBhcmdzWzFdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LXBhdGgnKSB7XG4gICAgICAgICAgICByZXR1cm4gJy9Vc2Vycy9ibHVlL0RldmVsb3Blci9Db2Nvc1Byb2plY3RzL0hlbGxvV29ybGQvYXNzZXRzL2EucHJlZmFiJztcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktdXJsJykge1xuICAgICAgICAgICAgcmV0dXJuICdkYjovL2Fzc2V0cy9hLnByZWZhYic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LXV1aWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3V1aWQtYSc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlaW1wb3J0LWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVmcmVzaC1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ29wZW4tYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGFzc2V0IG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdhc3NldC1kYi5tb3ZlLWFzc2V0JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LXBhdGgnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktdXJsJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LXV1aWQnLFxuICAgICAgICAnYXNzZXQtZGIucmVpbXBvcnQtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIucmVmcmVzaC1hc3NldCcsXG4gICAgICAgICdhc3NldC1kYi5vcGVuLWFzc2V0J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgbW92ZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfbW92ZV9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBzb3VyY2U6ICdkYjovL2Fzc2V0cy9hLnByZWZhYicsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnZGI6Ly9hc3NldHMvYi5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sobW92ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG1vdmUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBxdWVyeVBhdGggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3BhdGgnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsT3JVdWlkOiAndXVpZC1hJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5UGF0aCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5UGF0aCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQub2socXVlcnlQYXRoIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wYXRoLmluY2x1ZGVzKCcvYXNzZXRzL2EucHJlZmFiJykpO1xuXG4gICAgY29uc3QgcXVlcnlVcmwgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3VybCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkT3JQYXRoOiAndXVpZC1hJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5VXJsKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlVcmwhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VXJsIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS51cmwsICdkYjovL2Fzc2V0cy9hLnByZWZhYicpO1xuXG4gICAgY29uc3QgcXVlcnlVdWlkID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV91dWlkJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yUGF0aDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5VXVpZCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VXVpZCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlVdWlkIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS51dWlkLCAndXVpZC1hJyk7XG5cbiAgICBjb25zdCByZWltcG9ydCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDM0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcmVpbXBvcnRfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVpbXBvcnQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZWltcG9ydCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHJlZnJlc2ggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3JlZnJlc2hfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVmcmVzaCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlZnJlc2ghLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBvcGVuID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9vcGVuX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yVXVpZDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKG9wZW4pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0UHJlZmFiTGlmZWN5Y2xlVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVzdG9yZUNhbGxzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHJlc2V0Tm9kZUNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IHJlc2V0Q29tcG9uZW50Q2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgY3JlYXRlTm9kZUNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IHJlbW92ZU5vZGVDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBhcHBseUNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGNyZWF0ZVByZWZhYkNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGxpbmtQcmVmYWJDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCB1bmxpbmtQcmVmYWJDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBxdWVyaWVkQXNzZXRVdWlkczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgY3JlYXRlQXR0ZW1wdCA9IDA7XG5cbiAgICBjb25zdCBwcmVmYWJOb2RlU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCB7IHN0YXRlOiBudW1iZXI7IGFzc2V0VXVpZDogc3RyaW5nIH0gfCBudWxsPiA9IHtcbiAgICAgICAgJ25vZGUtcHJlZmFiLTEnOiB7IHN0YXRlOiAxLCBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMScgfSxcbiAgICAgICAgJ25vZGUtcHJlZmFiLTInOiB7IHN0YXRlOiAxLCBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMScgfSxcbiAgICAgICAgJ25vZGUtcmVmLW9ubHknOiBudWxsLFxuICAgICAgICAnbm9kZS1jcmVhdGVkLWludmFsaWQnOiBudWxsLFxuICAgICAgICAnbm9kZS1jcmVhdGVkLWZyb20tcHJlZmFiJzogeyBzdGF0ZTogMSwgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnIH0sXG4gICAgICAgICdub2RlLWxpbmstdGFyZ2V0JzogbnVsbFxuICAgIH07XG4gICAgY29uc3QgY3JlYXRlZFByZWZhYkFzc2V0czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtaW5mbycpIHtcbiAgICAgICAgICAgIHF1ZXJpZWRBc3NldFV1aWRzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnICYmIGNyZWF0ZWRQcmVmYWJBc3NldHNbYXJnc1swXV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBjcmVhdGVkUHJlZmFiQXNzZXRzW2FyZ3NbMF1dLFxuICAgICAgICAgICAgICAgICAgICB1cmw6IGFyZ3NbMF0sXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjYy5QcmVmYWInXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdXVpZDogYXJnc1swXSxcbiAgICAgICAgICAgICAgICB0eXBlOiAnY2MuUHJlZmFiJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFubmVsICE9PSAnc2NlbmUnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2hhbm5lbDogJHtjaGFubmVsfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gWydub2RlLXByZWZhYi0xJywgJ25vZGUtcmVmLW9ubHknLCAnbm9kZS1wcmVmYWItMiddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtbm9kZScpIHtcbiAgICAgICAgICAgIGNyZWF0ZU5vZGVDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgY3JlYXRlQXR0ZW1wdCArPSAxO1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUF0dGVtcHQgPT09IDEgPyAnbm9kZS1jcmVhdGVkLWludmFsaWQnIDogJ25vZGUtY3JlYXRlZC1mcm9tLXByZWZhYic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlbW92ZS1ub2RlJykge1xuICAgICAgICAgICAgcmVtb3ZlTm9kZUNhbGxzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlN0YXRlID0gcHJlZmFiTm9kZVN0YXRlc1tub2RlVXVpZCBhcyBzdHJpbmddO1xuICAgICAgICAgICAgaWYgKCFwcmVmYWJTdGF0ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHsgdmFsdWU6ICdQbGF5ZXJSb290JyB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogJ1BsYXllclJvb3QnIH0sXG4gICAgICAgICAgICAgICAgcHJlZmFiOiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiBwcmVmYWJTdGF0ZS5zdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHZhbHVlOiBwcmVmYWJTdGF0ZS5hc3NldFV1aWQgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2FwcGx5LXByZWZhYicpIHtcbiAgICAgICAgICAgIGFwcGx5Q2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtcHJlZmFiJykge1xuICAgICAgICAgICAgY3JlYXRlUHJlZmFiQ2FsbHMucHVzaChhcmdzKTtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0QXJnID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHNlY29uZEFyZyA9IGFyZ3NbMV07XG4gICAgICAgICAgICBsZXQgbm9kZVV1aWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGxldCB0YXJnZXRVcmw6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlyc3RBcmcgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBzZWNvbmRBcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQgPSBmaXJzdEFyZztcbiAgICAgICAgICAgICAgICB0YXJnZXRVcmwgPSBzZWNvbmRBcmc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpcnN0QXJnICYmIHR5cGVvZiBmaXJzdEFyZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCA9IGZpcnN0QXJnLnV1aWQgfHwgZmlyc3RBcmcubm9kZVV1aWQgfHwgZmlyc3RBcmcubm9kZTtcbiAgICAgICAgICAgICAgICB0YXJnZXRVcmwgPSBmaXJzdEFyZy51cmwgfHwgZmlyc3RBcmcudGFyZ2V0VXJsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICF0YXJnZXRVcmwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgY3JlYXRlLXByZWZhYiBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3QXNzZXRVdWlkID0gJ2Fzc2V0LWNyZWF0ZWQtcHJlZmFiLTEnO1xuICAgICAgICAgICAgY3JlYXRlZFByZWZhYkFzc2V0c1t0YXJnZXRVcmxdID0gbmV3QXNzZXRVdWlkO1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogbmV3QXNzZXRVdWlkIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2xpbmstcHJlZmFiJykge1xuICAgICAgICAgICAgY29uc3QgZmlyc3RBcmcgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kQXJnID0gYXJnc1sxXTtcbiAgICAgICAgICAgIGxldCBub2RlVXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgbGV0IGFzc2V0VXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaXJzdEFyZyA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIHNlY29uZEFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCA9IGZpcnN0QXJnO1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZCA9IHNlY29uZEFyZztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlyc3RBcmcgJiYgdHlwZW9mIGZpcnN0QXJnID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkID0gZmlyc3RBcmcudXVpZCB8fCBmaXJzdEFyZy5ub2RlO1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZCA9IGZpcnN0QXJnLmFzc2V0VXVpZCB8fCBmaXJzdEFyZy5wcmVmYWI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBsaW5rLXByZWZhYiBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub2RlVXVpZCA9PT0gJ25vZGUtY3JlYXRlZC1pbnZhbGlkJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbW9jayBsaW5rLXByZWZhYiBmYWlsZWQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGlua1ByZWZhYkNhbGxzLnB1c2goeyBub2RlVXVpZCwgYXNzZXRVdWlkIH0pO1xuICAgICAgICAgICAgcHJlZmFiTm9kZVN0YXRlc1tub2RlVXVpZF0gPSB7IHN0YXRlOiAxLCBhc3NldFV1aWQgfTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICd1bmxpbmstcHJlZmFiJykge1xuICAgICAgICAgICAgY29uc3QgZmlyc3RBcmcgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kQXJnID0gYXJnc1sxXTtcbiAgICAgICAgICAgIGxldCBub2RlVXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgbGV0IHJlbW92ZU5lc3RlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaXJzdEFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCA9IGZpcnN0QXJnO1xuICAgICAgICAgICAgICAgIHJlbW92ZU5lc3RlZCA9IEJvb2xlYW4oc2Vjb25kQXJnKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlyc3RBcmcgJiYgdHlwZW9mIGZpcnN0QXJnID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkID0gZmlyc3RBcmcudXVpZCB8fCBmaXJzdEFyZy5ub2RlO1xuICAgICAgICAgICAgICAgIHJlbW92ZU5lc3RlZCA9IEJvb2xlYW4oZmlyc3RBcmcucmVtb3ZlTmVzdGVkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCB1bmxpbmstcHJlZmFiIGFyZ3VtZW50cycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1bmxpbmtQcmVmYWJDYWxscy5wdXNoKHsgbm9kZVV1aWQsIHJlbW92ZU5lc3RlZCB9KTtcbiAgICAgICAgICAgIHByZWZhYk5vZGVTdGF0ZXNbbm9kZVV1aWRdID0gbnVsbDtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdyZXN0b3JlLXByZWZhYicpIHtcbiAgICAgICAgICAgIHJlc3RvcmVDYWxscy5wdXNoKGFyZ3NbMF0udXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVzZXQtbm9kZScpIHtcbiAgICAgICAgICAgIHJlc2V0Tm9kZUNhbGxzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVzZXQtY29tcG9uZW50Jykge1xuICAgICAgICAgICAgcmVzZXRDb21wb25lbnRDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc2NlbmUgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnJlbW92ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLFxuICAgICAgICAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgICdzY2VuZS5hcHBseS1wcmVmYWInLFxuICAgICAgICAnc2NlbmUuY3JlYXRlLXByZWZhYicsXG4gICAgICAgICdzY2VuZS5saW5rLXByZWZhYicsXG4gICAgICAgICdzY2VuZS51bmxpbmstcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnJlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnJlc2V0LW5vZGUnLFxuICAgICAgICAnc2NlbmUucmVzZXQtY29tcG9uZW50JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfY3JlYXRlX2luc3RhbmNlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9jcmVhdGVfYXNzZXRfZnJvbV9ub2RlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9saW5rX25vZGVfdG9fYXNzZXQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3VubGlua19pbnN0YW5jZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfcXVlcnlfbm9kZXNfYnlfYXNzZXRfdXVpZCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfcXVlcnlfaW5zdGFuY2Vfbm9kZXNfYnlfYXNzZXRfdXVpZCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfZ2V0X2luc3RhbmNlX2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX2FwcGx5X2luc3RhbmNlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9hcHBseV9pbnN0YW5jZXNfYnlfYXNzZXQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2UnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2VzX2J5X2Fzc2V0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9yZXNldF9ub2RlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9yZXNldF9jb21wb25lbnQnKSk7XG5cbiAgICBjb25zdCBjcmVhdGVJbnN0YW5jZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2NyZWF0ZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMScsXG4gICAgICAgICAgICAgICAgcGFyZW50VXVpZDogJ3BhcmVudC0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZUluc3RhbmNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlSW5zdGFuY2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZUluc3RhbmNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ub2RlVXVpZCwgJ25vZGUtY3JlYXRlZC1mcm9tLXByZWZhYicpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVOb2RlQ2FsbHMubGVuZ3RoLCAyKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlTm9kZUNhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZU5vZGVDYWxsc1swXS51dWlkLCAnbm9kZS1jcmVhdGVkLWludmFsaWQnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcmllZEFzc2V0VXVpZHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcmllZEFzc2V0VXVpZHNbMF0sICdhc3NldC1wcmVmYWItMScpO1xuXG4gICAgY29uc3QgY3JlYXRlUHJlZmFiQXNzZXQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfY3JlYXRlX2Fzc2V0X2Zyb21fbm9kZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtcHJlZmFiLTEnLFxuICAgICAgICAgICAgICAgIHRhcmdldFVybDogJ2RiOi8vYXNzZXRzL2dlbmVyYXRlZC9uZXcucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZVByZWZhYkFzc2V0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlUHJlZmFiQXNzZXQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZVByZWZhYkNhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZVByZWZhYkFzc2V0IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wcmVmYWJVdWlkLCAnYXNzZXQtY3JlYXRlZC1wcmVmYWItMScpO1xuXG4gICAgY29uc3QgbGlua05vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfbGlua19ub2RlX3RvX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS1saW5rLXRhcmdldCcsXG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLWxpbmstMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaW5rTm9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGxpbmtOb2RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChsaW5rUHJlZmFiQ2FsbHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobGlua05vZGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmFmdGVyLnByZWZhYkFzc2V0VXVpZCwgJ2Fzc2V0LXByZWZhYi1saW5rLTEnKTtcblxuICAgIGNvbnN0IHVubGlua05vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfdW5saW5rX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS1saW5rLXRhcmdldCcsXG4gICAgICAgICAgICAgICAgcmVtb3ZlTmVzdGVkOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sodW5saW5rTm9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHVubGlua05vZGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHVubGlua1ByZWZhYkNhbGxzLmxlbmd0aCwgMSk7XG5cbiAgICBjb25zdCBxdWVyeU5vZGVzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcXVlcnlfbm9kZXNfYnlfYXNzZXRfdXVpZCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeU5vZGVzKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOb2RlcyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOb2RlcyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDMpO1xuXG4gICAgY29uc3QgcXVlcnlJbnN0YW5jZU5vZGVzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDExLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3F1ZXJ5X2luc3RhbmNlX25vZGVzX2J5X2Fzc2V0X3V1aWQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlJbnN0YW5jZU5vZGVzKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlJbnN0YW5jZU5vZGVzIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeUluc3RhbmNlTm9kZXMhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmNvdW50LCAyKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlJbnN0YW5jZU5vZGVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5za2lwcGVkLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5SW5zdGFuY2VOb2RlcyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc2tpcHBlZFswXS5ub2RlVXVpZCwgJ25vZGUtcmVmLW9ubHknKTtcblxuICAgIGNvbnN0IGluc3RhbmNlSW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2dldF9pbnN0YW5jZV9pbmZvJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhpbnN0YW5jZUluZm8pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZUluZm8hLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlSW5mbyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuaXNQcmVmYWJJbnN0YW5jZSwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlSW5mbyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucHJlZmFiQXNzZXRVdWlkLCAnYXNzZXQtcHJlZmFiLTEnKTtcblxuICAgIGNvbnN0IGFwcGx5U2luZ2xlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDI1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2FwcGx5X2luc3RhbmNlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS1wcmVmYWItMScsXG4gICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogJ2Fzc2V0LXByZWZhYi0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGFwcGx5U2luZ2xlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlTaW5nbGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBhcHBseUJhdGNoID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDI2LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2FwcGx5X2luc3RhbmNlc19ieV9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhhcHBseUJhdGNoKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlCYXRjaCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlCYXRjaCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc3VjY2Vzc0NvdW50LCAyKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlCYXRjaCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuZmFpbHVyZUNvdW50LCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlDYWxscy5sZW5ndGgsIDMpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgYXBwbHlDYWxsc1swXSwgJ3N0cmluZycpO1xuXG4gICAgY29uc3QgcmVzdG9yZVNpbmdsZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2UnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLXByZWZhYi0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJlc3RvcmVTaW5nbGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlU2luZ2xlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgcmVzdG9yZUJhdGNoID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZXNfYnlfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzdG9yZUJhdGNoKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdG9yZUJhdGNoIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlQmF0Y2ghLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnN1Y2Nlc3NDb3VudCwgMyk7XG5cbiAgICBjb25zdCByZXNldE5vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0NSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXNldF9ub2RlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkczogWydub2RlLXByZWZhYi0xJywgJ25vZGUtcHJlZmFiLTInXVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJlc2V0Tm9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc2V0Tm9kZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzZXROb2RlQ2FsbHMubGVuZ3RoLCAxKTtcblxuICAgIGNvbnN0IHJlc2V0Q29tcG9uZW50ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzZXRfY29tcG9uZW50JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6ICdjb21wLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzZXRDb21wb25lbnQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNldENvbXBvbmVudCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzZXRDb21wb25lbnRDYWxscy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5vayhyZXN0b3JlQ2FsbHMubGVuZ3RoID49IDQpO1xuICAgIGFzc2VydC5vayhyZXN0b3JlQ2FsbHMuaW5jbHVkZXMoJ25vZGUtcHJlZmFiLTEnKSk7XG4gICAgYXNzZXJ0Lm9rKHJlc3RvcmVDYWxscy5pbmNsdWRlcygnbm9kZS1wcmVmYWItMicpKTtcbiAgICBhc3NlcnQub2socmVzdG9yZUNhbGxzLmluY2x1ZGVzKCdub2RlLXJlZi1vbmx5JykpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0VW5rbm93blRvb2woKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKGFzeW5jICgpID0+IHVuZGVmaW5lZCk7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ25vdC1leGlzdHMnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2socmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEuZXJyb3I/LmNvZGUsIC0zMjYwMik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0TGlzdEFuZFJlYWREb21haW5DYWxscygpO1xuICAgIGF3YWl0IHRlc3RXcml0ZVRvb2xDYWxsKCk7XG4gICAgYXdhaXQgdGVzdExpZmVjeWNsZUFuZFJ1bnRpbWVUb29scygpO1xuICAgIGF3YWl0IHRlc3RTY2VuZVZpZXdUb29scygpO1xuICAgIGF3YWl0IHRlc3RVaUF1dG9tYXRpb25Ub29scygpO1xuICAgIGF3YWl0IHRlc3RBc3NldE1hbmFnZW1lbnRUb29scygpO1xuICAgIGF3YWl0IHRlc3RQcmVmYWJMaWZlY3ljbGVUb29scygpO1xuICAgIGF3YWl0IHRlc3RVbmtub3duVG9vbCgpO1xuICAgIGNvbnNvbGUubG9nKCduZXh0LXJvdXRlci10ZXN0OiBQQVNTJyk7XG59XG5cbnJ1bigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ25leHQtcm91dGVyLXRlc3Q6IEZBSUwnLCBlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=