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
        if (channel === 'scene' && method === 'open-scene') {
            return undefined;
        }
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
        throw new Error(`Unexpected call: ${channel}.${method}(${JSON.stringify(args)})`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.open-scene',
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
    assert.ok(callLog.some((item) => item.channel === 'scene' && item.method === 'open-scene'), '应调用 scene.open-scene');
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
    const queriedAssetUuids = [];
    let createAttempt = 0;
    const prefabNodeStates = {
        'node-prefab-1': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-prefab-2': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-created-invalid': null,
        'node-created-from-prefab': { state: 1, assetUuid: 'asset-prefab-1' }
    };
    const requester = async (channel, method, ...args) => {
        if (channel === 'asset-db' && method === 'query-asset-info') {
            queriedAssetUuids.push(args[0]);
            return {
                uuid: args[0],
                type: 'cc.Prefab'
            };
        }
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'query-nodes-by-asset-uuid') {
            return ['node-prefab-1', 'node-prefab-2'];
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
    assert.ok(toolNames.includes('prefab_query_nodes_by_asset_uuid'));
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
    assert.strictEqual(queryNodes.result.structuredContent.data.count, 2);
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
    assert.strictEqual(restoreBatch.result.structuredContent.data.successCount, 2);
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
    assert.ok(restoreCalls.length >= 3);
    assert.ok(restoreCalls.includes('node-prefab-1'));
    assert.ok(restoreCalls.includes('node-prefab-2'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1yb3V0ZXItdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcm91dGVyLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU87WUFDUCxNQUFNO1lBQ04sS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZ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QUFNLEdBQUcsSUFBSSxzQkFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTNDLE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNqQyxPQUFPLEVBQUUsS0FBSztRQUNkLEVBQUUsRUFBRSxDQUFDO1FBQ0wsTUFBTSxFQUFFLFlBQVk7UUFDcEIsTUFBTSxFQUFFO1lBQ0osSUFBSSxFQUFFLFlBQVk7WUFDbEIsU0FBUyxFQUFFLEVBQUU7U0FDaEI7S0FDSixDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3BCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBQSxRQUFTLENBQUMsS0FBSywwQ0FBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN0RCxDQUFDO0FBRUQsS0FBSyxVQUFVLEdBQUc7SUFDZCxNQUFNLDBCQUEwQixFQUFFLENBQUM7SUFDbkMsTUFBTSxpQkFBaUIsRUFBRSxDQUFDO0lBQzFCLE1BQU0sNEJBQTRCLEVBQUUsQ0FBQztJQUNyQyxNQUFNLGtCQUFrQixFQUFFLENBQUM7SUFDM0IsTUFBTSxxQkFBcUIsRUFBRSxDQUFDO0lBQzlCLE1BQU0sd0JBQXdCLEVBQUUsQ0FBQztJQUNqQyxNQUFNLHdCQUF3QixFQUFFLENBQUM7SUFDakMsTUFBTSxlQUFlLEVBQUUsQ0FBQztJQUN4QixPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFDMUMsQ0FBQztBQUVELEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0JBQXdCLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDL0MsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FwYWJpbGl0eU1hdHJpeCB9IGZyb20gJy4uL25leHQvbW9kZWxzJztcbmltcG9ydCB7IE5leHRUb29sUmVnaXN0cnkgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3Rvb2wtcmVnaXN0cnknO1xuaW1wb3J0IHsgTmV4dE1jcFJvdXRlciB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvcm91dGVyJztcbmltcG9ydCB7IGNyZWF0ZU9mZmljaWFsVG9vbHMgfSBmcm9tICcuLi9uZXh0L3Rvb2xzL29mZmljaWFsLXRvb2xzJztcblxuZnVuY3Rpb24gY3JlYXRlTWF0cml4KGF2YWlsYWJsZUtleXM6IHN0cmluZ1tdKTogQ2FwYWJpbGl0eU1hdHJpeCB7XG4gICAgY29uc3QgYnlLZXk6IENhcGFiaWxpdHlNYXRyaXhbJ2J5S2V5J10gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBhdmFpbGFibGVLZXlzKSB7XG4gICAgICAgIGNvbnN0IGZpcnN0RG90ID0ga2V5LmluZGV4T2YoJy4nKTtcbiAgICAgICAgY29uc3QgY2hhbm5lbCA9IGtleS5zbGljZSgwLCBmaXJzdERvdCk7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IGtleS5zbGljZShmaXJzdERvdCArIDEpO1xuICAgICAgICBieUtleVtrZXldID0ge1xuICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgY2hhbm5lbCxcbiAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjoga2V5LFxuICAgICAgICAgICAgYXZhaWxhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBkZXRhaWw6ICdvaydcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBieUtleSxcbiAgICAgICAgc3VtbWFyeToge1xuICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHVuYXZhaWxhYmxlOiAwLFxuICAgICAgICAgICAgYnlMYXllcjoge1xuICAgICAgICAgICAgICAgIG9mZmljaWFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXh0ZW5kZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0TGlzdEFuZFJlYWREb21haW5DYWxscygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1ub2RlLXRyZWUnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiAncm9vdCcsIG5hbWU6IHsgdmFsdWU6ICdNYWluU2NlbmUnIH0sIGNoaWxkcmVuOiBbXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHV1aWQ6IHsgdmFsdWU6ICdub2RlLTEnIH0sXG4gICAgICAgICAgICAgICAgX19jb21wc19fOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgX190eXBlX186IHsgdmFsdWU6ICdjYy5MYWJlbCcgfSwgdXVpZDogeyB2YWx1ZTogJ2NvbXAtMScgfSB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1hc3NldHMnKSB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIHsgdXJsOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInLCB1dWlkOiAndXVpZC1hJyB9LFxuICAgICAgICAgICAgICAgIHsgdXJsOiAnZGI6Ly9hc3NldHMvYi5wcmVmYWInLCB1dWlkOiAndXVpZC1iJyB9XG4gICAgICAgICAgICBdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWFzc2V0LWRlcGVuZGVuY2llcycpIHtcbiAgICAgICAgICAgIHJldHVybiBbJ2RlcC11dWlkLTEnLCAnZGVwLXV1aWQtMiddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWFzc2V0LWluZm8nKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiBhcmdzWzBdLCB1cmw6IGBkYjovL2Fzc2V0cy8ke2FyZ3NbMF19LnByZWZhYmAgfTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2FsbDogJHtjaGFubmVsfS4ke21ldGhvZH0oJHtKU09OLnN0cmluZ2lmeShhcmdzKX0pYCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlLXRyZWUnLFxuICAgICAgICAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1hc3NldHMnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktYXNzZXQtaW5mbycsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKGxpc3RSZXNwb25zZSk7XG4gICAgYXNzZXJ0Lm9rKEFycmF5LmlzQXJyYXkobGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMpKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9saXN0X2dhbWVfb2JqZWN0cycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9nZXRfZ2FtZV9vYmplY3RfaW5mbycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdjb21wb25lbnRfbGlzdF9vbl9ub2RlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2Fzc2V0X3F1ZXJ5X2RlcGVuZGVuY2llcycpKTtcbiAgICBhc3NlcnQub2soIXRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfY3JlYXRlX2dhbWVfb2JqZWN0JyksICflhpnmk43kvZzog73lipvmnKrmjqLmtYvml7bkuI3lupTmmrTpnLLlhpnlt6XlhbcnKTtcblxuICAgIGNvbnN0IGNhbGxSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9kZXBlbmRlbmNpZXMnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsT3JVdWlkOiAnZGI6Ly9hc3NldHMvcGxheWVyLnByZWZhYicsXG4gICAgICAgICAgICAgICAgcmVsYXRpb25UeXBlOiAnYWxsJyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlQXNzZXRJbmZvOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGFzc2VydC5vayhjYWxsUmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsUmVzcG9uc2UhLmVycm9yLCB1bmRlZmluZWQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsUmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LnN1Y2Nlc3MsIHRydWUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmNvdW50LCAyKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbFJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5kZXBlbmRlbmN5SW5mb3MubGVuZ3RoLCAyKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdFdyaXRlVG9vbENhbGwoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc2V0UHJvcGVydHlQYXlsb2FkczogYW55W10gPSBbXTtcbiAgICBjb25zdCByZW1vdmVDb21wb25lbnRQYXlsb2FkczogYW55W10gPSBbXTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHV1aWQ6IHsgdmFsdWU6ICdub2RlLTEnIH0sXG4gICAgICAgICAgICAgICAgX19jb21wc19fOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgX190eXBlX186IHsgdmFsdWU6ICdjYy5MYWJlbCcgfSwgdXVpZDogeyB2YWx1ZTogJ2NvbXAtdXVpZC1sYWJlbCcgfSB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdzZXQtcHJvcGVydHknKSB7XG4gICAgICAgICAgICBzZXRQcm9wZXJ0eVBheWxvYWRzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdyZW1vdmUtY29tcG9uZW50Jykge1xuICAgICAgICAgICAgcmVtb3ZlQ29tcG9uZW50UGF5bG9hZHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhbGw6ICR7Y2hhbm5lbH0uJHttZXRob2R9KCR7SlNPTi5zdHJpbmdpZnkoYXJncyl9KWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgICdzY2VuZS5zZXQtcHJvcGVydHknLFxuICAgICAgICAnc2NlbmUucmVtb3ZlLWNvbXBvbmVudCdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IHNldFByb3BlcnR5UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3NldF9wcm9wZXJ0eScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtMScsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogJ2NjLkxhYmVsJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAnSGVsbG8gTmV4dCcsXG4gICAgICAgICAgICAgICAgdmFsdWVUeXBlOiAnU3RyaW5nJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2soc2V0UHJvcGVydHlSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFByb3BlcnR5UmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFByb3BlcnR5UGF5bG9hZHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlQYXlsb2Fkc1swXS5wYXRoLCAnX19jb21wc19fLjAuc3RyaW5nJyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFByb3BlcnR5UGF5bG9hZHNbMF0uZHVtcC52YWx1ZSwgJ0hlbGxvIE5leHQnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlQYXlsb2Fkc1swXS5kdW1wLnR5cGUsICdTdHJpbmcnKTtcblxuICAgIGNvbnN0IHJlbW92ZUNvbXBvbmVudFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9yZW1vdmVfY29tcG9uZW50JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS0xJyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiAnY2MuTGFiZWwnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGFzc2VydC5vayhyZW1vdmVDb21wb25lbnRSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZUNvbXBvbmVudFJlc3BvbnNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZW1vdmVDb21wb25lbnRQYXlsb2Fkcy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZW1vdmVDb21wb25lbnRQYXlsb2Fkc1swXS51dWlkLCAnY29tcC11dWlkLWxhYmVsJyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RMaWZlY3ljbGVBbmRSdW50aW1lVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY2FsbExvZzogQXJyYXk8eyBjaGFubmVsOiBzdHJpbmc7IG1ldGhvZDogc3RyaW5nOyBhcmdzOiBhbnlbXSB9PiA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgY2FsbExvZy5wdXNoKHsgY2hhbm5lbCwgbWV0aG9kLCBhcmdzIH0pO1xuXG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ29wZW4tc2NlbmUnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3NhdmUtc2NlbmUnKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2RiOi8vYXNzZXRzL3NjZW5lcy9ib290LnNjZW5lJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdjbG9zZS1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWlzLXJlYWR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktZGlydHknKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktc2NlbmUtYm91bmRzJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgeDogMCwgeTogMCwgd2lkdGg6IDEyODAsIGhlaWdodDogNzIwIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnZm9jdXMtY2FtZXJhJykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3Byb2plY3QnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWNvbmZpZycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG5hbWU6ICdIZWxsb1dvcmxkJywgbGFuZ3VhZ2U6ICd6aCcgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3ByZWZlcmVuY2VzJyAmJiBtZXRob2QgPT09ICdxdWVyeS1jb25maWcnKSB7XG4gICAgICAgICAgICByZXR1cm4geyBsYW5ndWFnZTogJ3poLUNOJyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2VydmVyJyAmJiBtZXRob2QgPT09ICdxdWVyeS1pcC1saXN0Jykge1xuICAgICAgICAgICAgcmV0dXJuIFsnMTI3LjAuMC4xJ107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzZXJ2ZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXBvcnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gNzQ1NjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2VuZ2luZScgJiYgbWV0aG9kID09PSAncXVlcnktZW5naW5lLWluZm8nKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2ZXJzaW9uOiAnMy44LjgnLCBtb2R1bGVzOiBbXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYnVpbGRlcicgJiYgbWV0aG9kID09PSAncXVlcnktd29ya2VyLXJlYWR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2FsbDogJHtjaGFubmVsfS4ke21ldGhvZH0oJHtKU09OLnN0cmluZ2lmeShhcmdzKX0pYCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5vcGVuLXNjZW5lJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWlzLXJlYWR5JyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWRpcnR5JyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LXNjZW5lLWJvdW5kcycsXG4gICAgICAgICdzY2VuZS5mb2N1cy1jYW1lcmEnLFxuICAgICAgICAncHJvamVjdC5xdWVyeS1jb25maWcnLFxuICAgICAgICAncHJlZmVyZW5jZXMucXVlcnktY29uZmlnJyxcbiAgICAgICAgJ3NlcnZlci5xdWVyeS1pcC1saXN0JyxcbiAgICAgICAgJ3NlcnZlci5xdWVyeS1wb3J0JyxcbiAgICAgICAgJ2VuZ2luZS5xdWVyeS1lbmdpbmUtaW5mbycsXG4gICAgICAgICdidWlsZGVyLnF1ZXJ5LXdvcmtlci1yZWFkeSdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX29wZW5fc2NlbmUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfc2F2ZV9zY2VuZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9jbG9zZV9zY2VuZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9xdWVyeV9zdGF0dXMnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfZm9jdXNfY2FtZXJhJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3Byb2plY3RfcXVlcnlfY29uZmlnJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZlcmVuY2VzX3F1ZXJ5X2NvbmZpZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzZXJ2ZXJfcXVlcnlfbmV0d29yaycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdlbmdpbmVfcXVlcnlfcnVudGltZV9pbmZvJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2VuZ2luZV9xdWVyeV9lbmdpbmVfaW5mbycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdidWlsZGVyX3F1ZXJ5X3dvcmtlcl9yZWFkeScpKTtcblxuICAgIGNvbnN0IHNjZW5lU3RhdHVzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9xdWVyeV9zdGF0dXMnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZUJvdW5kczogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNjZW5lU3RhdHVzKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2NlbmVTdGF0dXMhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pc1JlYWR5LCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2NlbmVTdGF0dXMhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmlzRGlydHksIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2NlbmVTdGF0dXMhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmJvdW5kcy53aWR0aCwgMTI4MCk7XG5cbiAgICBjb25zdCBvcGVuU2NlbmUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX29wZW5fc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgc2NlbmVVcmw6ICdkYjovL2Fzc2V0cy9zY2VuZXMvYm9vdC5zY2VuZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhvcGVuU2NlbmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuU2NlbmUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5TY2VuZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEub3BlbmVkLCB0cnVlKTtcblxuICAgIGNvbnN0IHNhdmVTY2VuZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfc2F2ZV9zY2VuZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBmb3JjZTogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNhdmVTY2VuZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVTY2VuZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZVNjZW5lIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zY2VuZVVybCwgJ2RiOi8vYXNzZXRzL3NjZW5lcy9ib290LnNjZW5lJyk7XG5cbiAgICBjb25zdCBjbG9zZVNjZW5lID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9jbG9zZV9zY2VuZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soY2xvc2VTY2VuZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNsb3NlU2NlbmUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNsb3NlU2NlbmUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmNsb3NlZCwgdHJ1ZSk7XG5cbiAgICBjb25zdCBmb2N1c0NhbWVyYSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfZm9jdXNfY2FtZXJhJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHV1aWRzOiAnbm9kZS0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGZvY3VzQ2FtZXJhKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZm9jdXNDYW1lcmEhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmb2N1c0NhbWVyYSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEudXVpZHMsIFsnbm9kZS0xJ10pO1xuXG4gICAgY29uc3QgcHJvamVjdENvbmZpZyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE2LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJvamVjdF9xdWVyeV9jb25maWcnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29uZmlnVHlwZTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgICAgIHByb3RvY29sOiAncHJvamVjdCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhwcm9qZWN0Q29uZmlnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocHJvamVjdENvbmZpZyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHByZWZlcmVuY2VzQ29uZmlnID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTcsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmZXJlbmNlc19xdWVyeV9jb25maWcnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29uZmlnVHlwZTogJ2dlbmVyYWwnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socHJlZmVyZW5jZXNDb25maWcpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChwcmVmZXJlbmNlc0NvbmZpZyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IG5ldHdvcmsgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxOCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NlcnZlcl9xdWVyeV9uZXR3b3JrJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhuZXR3b3JrKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobmV0d29yayEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobmV0d29yayEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucG9ydCwgNzQ1Nik7XG5cbiAgICBjb25zdCBydW50aW1lSW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE5LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnZW5naW5lX3F1ZXJ5X3J1bnRpbWVfaW5mbycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socnVudGltZUluZm8pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChydW50aW1lSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocnVudGltZUluZm8hLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmluZm8udmVyc2lvbiwgJzMuOC44Jyk7XG5cbiAgICBjb25zdCBlbmdpbmVJbmZvID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjAsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdlbmdpbmVfcXVlcnlfZW5naW5lX2luZm8nLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGVuZ2luZUluZm8pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChlbmdpbmVJbmZvIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3Qgd29ya2VyUmVhZHkgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2J1aWxkZXJfcXVlcnlfd29ya2VyX3JlYWR5JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayh3b3JrZXJSZWFkeSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlclJlYWR5IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXJSZWFkeSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucmVhZHksIHRydWUpO1xuXG4gICAgYXNzZXJ0Lm9rKFxuICAgICAgICBjYWxsTG9nLnNvbWUoKGl0ZW0pID0+IGl0ZW0uY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBpdGVtLm1ldGhvZCA9PT0gJ29wZW4tc2NlbmUnKSxcbiAgICAgICAgJ+W6lOiwg+eUqCBzY2VuZS5vcGVuLXNjZW5lJ1xuICAgICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RTY2VuZVZpZXdUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBzdGF0ZSA9IHtcbiAgICAgICAgaXMyRDogZmFsc2UsXG4gICAgICAgIGdpem1vVG9vbDogJ21vdmUnLFxuICAgICAgICBnaXptb1Bpdm90OiAnY2VudGVyJyxcbiAgICAgICAgZ2l6bW9Db29yZGluYXRlOiAnbG9jYWwnLFxuICAgICAgICBpc0dyaWRWaXNpYmxlOiB0cnVlLFxuICAgICAgICBpc0ljb25HaXptbzNEOiB0cnVlLFxuICAgICAgICBpY29uR2l6bW9TaXplOiAxXG4gICAgfTtcbiAgICBjb25zdCBhbGlnbkNhbGxzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdzY2VuZScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktaXMyRCcpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5pczJEO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1naXptby10b29sLW5hbWUnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuZ2l6bW9Ub29sO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1naXptby1waXZvdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5naXptb1Bpdm90O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1naXptby1jb29yZGluYXRlJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmdpem1vQ29vcmRpbmF0ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktaXMtZ3JpZC12aXNpYmxlJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmlzR3JpZFZpc2libGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWlzLWljb24tZ2l6bW8tM2QnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuaXNJY29uR2l6bW8zRDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktaWNvbi1naXptby1zaXplJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmljb25HaXptb1NpemU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWlzLXJlYWR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NoYW5nZS1pczJEJykge1xuICAgICAgICAgICAgc3RhdGUuaXMyRCA9IEJvb2xlYW4oYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjaGFuZ2UtZ2l6bW8tdG9vbCcpIHtcbiAgICAgICAgICAgIHN0YXRlLmdpem1vVG9vbCA9IGFyZ3NbMF07XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjaGFuZ2UtZ2l6bW8tcGl2b3QnKSB7XG4gICAgICAgICAgICBzdGF0ZS5naXptb1Bpdm90ID0gYXJnc1swXTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NoYW5nZS1naXptby1jb29yZGluYXRlJykge1xuICAgICAgICAgICAgc3RhdGUuZ2l6bW9Db29yZGluYXRlID0gYXJnc1swXTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NldC1ncmlkLXZpc2libGUnKSB7XG4gICAgICAgICAgICBzdGF0ZS5pc0dyaWRWaXNpYmxlID0gQm9vbGVhbihhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NldC1pY29uLWdpem1vLTNkJykge1xuICAgICAgICAgICAgc3RhdGUuaXNJY29uR2l6bW8zRCA9IEJvb2xlYW4oYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzZXQtaWNvbi1naXptby1zaXplJykge1xuICAgICAgICAgICAgc3RhdGUuaWNvbkdpem1vU2l6ZSA9IE51bWJlcihhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2FsaWduLXdpdGgtdmlldycgfHwgbWV0aG9kID09PSAnYWxpZ24tdmlldy13aXRoLW5vZGUnKSB7XG4gICAgICAgICAgICBhbGlnbkNhbGxzLnB1c2gobWV0aG9kKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc2NlbmUgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWlzMkQnLFxuICAgICAgICAnc2NlbmUucXVlcnktZ2l6bW8tdG9vbC1uYW1lJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWdpem1vLXBpdm90JyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWdpem1vLWNvb3JkaW5hdGUnLFxuICAgICAgICAnc2NlbmUucXVlcnktaXMtZ3JpZC12aXNpYmxlJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWlzLWljb24tZ2l6bW8tM2QnLFxuICAgICAgICAnc2NlbmUucXVlcnktaWNvbi1naXptby1zaXplJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWlzLXJlYWR5J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgbGlzdFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGxpc3RSZXNwb25zZSk7XG4gICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19xdWVyeV9zdGF0ZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9tb2RlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X2dpem1vX3Rvb2wnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfZ2l6bW9fcGl2b3QnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfZ2l6bW9fY29vcmRpbmF0ZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9ncmlkX3Zpc2libGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfaWNvbl9naXptb192aXNpYmxlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X2ljb25fZ2l6bW9fc2l6ZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X2FsaWduX3dpdGhfdmlldycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X2FsaWduX3ZpZXdfd2l0aF9ub2RlJykpO1xuXG4gICAgY29uc3QgcXVlcnlTdGF0ZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19xdWVyeV9zdGF0ZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlTdGF0ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5U3RhdGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5U3RhdGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnN0YXRlLmlzMkQsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlTdGF0ZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc3RhdGUuZ2l6bW9Ub29sLCAnbW92ZScpO1xuXG4gICAgY29uc3Qgc2V0TW9kZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDI0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfbW9kZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBpczJEOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0TW9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldE1vZGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldE1vZGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmN1cnJlbnQsIHRydWUpO1xuXG4gICAgY29uc3Qgc2V0VG9vbCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDI1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfZ2l6bW9fdG9vbCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB0b29sOiAncm90YXRlJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldFRvb2wpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRUb29sIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRUb29sIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jdXJyZW50LCAncm90YXRlJyk7XG5cbiAgICBjb25zdCBzZXRHcmlkID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3NldF9ncmlkX3Zpc2libGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRHcmlkKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0R3JpZCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0R3JpZCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY3VycmVudCwgZmFsc2UpO1xuXG4gICAgY29uc3Qgc2V0SWNvblNpemUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyNyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X2ljb25fZ2l6bW9fc2l6ZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBzaXplOiAyXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0SWNvblNpemUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRJY29uU2l6ZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0SWNvblNpemUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmN1cnJlbnQsIDIpO1xuXG4gICAgY29uc3QgYWxpZ25XaXRoVmlldyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDI4LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19hbGlnbl93aXRoX3ZpZXcnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGFsaWduV2l0aFZpZXcpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhbGlnbldpdGhWaWV3IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgYWxpZ25WaWV3V2l0aE5vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyOSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfYWxpZ25fdmlld193aXRoX25vZGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGFsaWduVmlld1dpdGhOb2RlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYWxpZ25WaWV3V2l0aE5vZGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhbGlnbkNhbGxzLCBbJ2FsaWduLXdpdGgtdmlldycsICdhbGlnbi12aWV3LXdpdGgtbm9kZSddKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdFVpQXV0b21hdGlvblRvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGludGVyZmFjZSBNb2NrTm9kZSB7XG4gICAgICAgIHV1aWQ6IHN0cmluZztcbiAgICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgICBwYXJlbnQ6IHN0cmluZyB8IG51bGw7XG4gICAgICAgIGNoaWxkcmVuOiBzdHJpbmdbXTtcbiAgICAgICAgY29tcG9uZW50czogc3RyaW5nW107XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBuZXcgTWFwPHN0cmluZywgTW9ja05vZGU+KCk7XG4gICAgY29uc3QgY3JlYXRlZE5vZGVDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBjcmVhdGVkQ29tcG9uZW50Q2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3Qgc2V0UHJvcGVydHlDYWxsczogYW55W10gPSBbXTtcbiAgICBsZXQgbm9kZUNvdW50ZXIgPSAwO1xuXG4gICAgY29uc3QgZW5zdXJlTm9kZSA9IChub2RlOiBNb2NrTm9kZSk6IHZvaWQgPT4ge1xuICAgICAgICBub2Rlcy5zZXQobm9kZS51dWlkLCBub2RlKTtcbiAgICB9O1xuXG4gICAgZW5zdXJlTm9kZSh7XG4gICAgICAgIHV1aWQ6ICdyb290JyxcbiAgICAgICAgbmFtZTogJ01haW5TY2VuZScsXG4gICAgICAgIHBhcmVudDogbnVsbCxcbiAgICAgICAgY2hpbGRyZW46IFsnY2FudmFzLTEnXSxcbiAgICAgICAgY29tcG9uZW50czogW11cbiAgICB9KTtcbiAgICBlbnN1cmVOb2RlKHtcbiAgICAgICAgdXVpZDogJ2NhbnZhcy0xJyxcbiAgICAgICAgbmFtZTogJ0NhbnZhcycsXG4gICAgICAgIHBhcmVudDogJ3Jvb3QnLFxuICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgIGNvbXBvbmVudHM6IFsnY2MuQ2FudmFzJywgJ2NjLlVJVHJhbnNmb3JtJ11cbiAgICB9KTtcblxuICAgIGNvbnN0IGNyZWF0ZU5vZGVEdW1wID0gKHV1aWQ6IHN0cmluZyk6IGFueSA9PiB7XG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlcy5nZXQodXVpZCk7XG4gICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlIG5vdCBmb3VuZDogJHt1dWlkfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHV1aWQ6IHsgdmFsdWU6IG5vZGUudXVpZCB9LFxuICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogbm9kZS5uYW1lIH0sXG4gICAgICAgICAgICBfX2NvbXBzX186IG5vZGUuY29tcG9uZW50cy5tYXAoKHR5cGUsIGluZGV4KSA9PiAoe1xuICAgICAgICAgICAgICAgIF9fdHlwZV9fOiB7IHZhbHVlOiB0eXBlIH0sXG4gICAgICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogYCR7dXVpZH0tY29tcC0ke2luZGV4fWAgfVxuICAgICAgICAgICAgfSkpXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIGNvbnN0IGNyZWF0ZVRyZWVEdW1wID0gKHV1aWQ6IHN0cmluZyk6IGFueSA9PiB7XG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlcy5nZXQodXVpZCk7XG4gICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUcmVlIG5vZGUgbm90IGZvdW5kOiAke3V1aWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHV1aWQ6IHsgdmFsdWU6IG5vZGUudXVpZCB9LFxuICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogbm9kZS5uYW1lIH0sXG4gICAgICAgICAgICBjaGlsZHJlbjogbm9kZS5jaGlsZHJlbi5tYXAoKGNoaWxkVXVpZCkgPT4gY3JlYXRlVHJlZUR1bXAoY2hpbGRVdWlkKSlcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdzY2VuZScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZS10cmVlJykge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZVRyZWVEdW1wKCdyb290Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlTm9kZUR1bXAoYXJnc1swXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NyZWF0ZS1ub2RlJykge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IGFyZ3NbMF0gfHwge307XG4gICAgICAgICAgICBjcmVhdGVkTm9kZUNhbGxzLnB1c2gob3B0aW9ucyk7XG5cbiAgICAgICAgICAgIG5vZGVDb3VudGVyICs9IDE7XG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGBub2RlLXVpLSR7bm9kZUNvdW50ZXJ9YDtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFV1aWQgPSBvcHRpb25zLnBhcmVudCB8fCAncm9vdCc7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBub2Rlcy5nZXQocGFyZW50VXVpZCk7XG4gICAgICAgICAgICBpZiAoIXBhcmVudCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IG5vdCBmb3VuZDogJHtwYXJlbnRVdWlkfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlOiBNb2NrTm9kZSA9IHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBvcHRpb25zLm5hbWUgfHwgYE5vZGUtJHtub2RlQ291bnRlcn1gLFxuICAgICAgICAgICAgICAgIHBhcmVudDogcGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBub2Rlcy5zZXQobm9kZVV1aWQsIG5vZGUpO1xuICAgICAgICAgICAgcGFyZW50LmNoaWxkcmVuLnB1c2gobm9kZVV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIG5vZGVVdWlkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtY29tcG9uZW50Jykge1xuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBjcmVhdGVkQ29tcG9uZW50Q2FsbHMucHVzaChwYXlsb2FkKTtcblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzLmdldChwYXlsb2FkLnV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDcmVhdGUgY29tcG9uZW50IHRhcmdldCBub3QgZm91bmQ6ICR7cGF5bG9hZC51dWlkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFub2RlLmNvbXBvbmVudHMuaW5jbHVkZXMocGF5bG9hZC5jb21wb25lbnQpKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5jb21wb25lbnRzLnB1c2gocGF5bG9hZC5jb21wb25lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2V0LXByb3BlcnR5Jykge1xuICAgICAgICAgICAgc2V0UHJvcGVydHlDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc2NlbmUgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUtdHJlZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLmNyZWF0ZS1jb21wb25lbnQnLFxuICAgICAgICAnc2NlbmUuc2V0LXByb3BlcnR5J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgbGlzdFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzAwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3VpX2NyZWF0ZV9lbGVtZW50JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3VpX3NldF9yZWN0X3RyYW5zZm9ybScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCd1aV9zZXRfdGV4dCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCd1aV9zZXRfbGF5b3V0JykpO1xuXG4gICAgY29uc3QgY3JlYXRlRWxlbWVudCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3VpX2NyZWF0ZV9lbGVtZW50JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGVsZW1lbnRUeXBlOiAnTGFiZWwnLFxuICAgICAgICAgICAgICAgIGVsZW1lbnROYW1lOiAnVGl0bGUnLFxuICAgICAgICAgICAgICAgIHBhcmVudFBhdGg6ICdDYW52YXMnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soY3JlYXRlRWxlbWVudCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZUVsZW1lbnQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgY29uc3QgY3JlYXRlZE5vZGVVdWlkID0gY3JlYXRlRWxlbWVudCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubm9kZVV1aWQgYXMgc3RyaW5nO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkTm9kZUNhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWROb2RlQ2FsbHNbMF0ucGFyZW50LCAnY2FudmFzLTEnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlZE5vZGVDYWxsc1swXS5uYW1lLCAnVGl0bGUnKTtcbiAgICBhc3NlcnQub2soY3JlYXRlRWxlbWVudCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuZW5zdXJlZENvbXBvbmVudHMuaW5jbHVkZXMoJ2NjLlVJVHJhbnNmb3JtJykpO1xuICAgIGFzc2VydC5vayhjcmVhdGVFbGVtZW50IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5lbnN1cmVkQ29tcG9uZW50cy5pbmNsdWRlcygnY2MuTGFiZWwnKSk7XG5cbiAgICBjb25zdCBzZXRSZWN0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzAyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAndWlfc2V0X3JlY3RfdHJhbnNmb3JtJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiBjcmVhdGVkTm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgc2l6ZTogeyB3aWR0aDogMzIwLCBoZWlnaHQ6IDgwIH0sXG4gICAgICAgICAgICAgICAgYW5jaG9yOiB7IHg6IDAuNSwgeTogMC41IH0sXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IHsgeDogMTAsIHk6IDIwLCB6OiAwIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRSZWN0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UmVjdCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHNldFRleHQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICd1aV9zZXRfdGV4dCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogY3JlYXRlZE5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIHRleHQ6ICdIZWxsbyBVSScsXG4gICAgICAgICAgICAgICAgZm9udFNpemU6IDMyLFxuICAgICAgICAgICAgICAgIGhvcml6b250YWxBbGlnbjogJ2NlbnRlcidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRUZXh0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0VGV4dCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHNldExheW91dCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3VpX3NldF9sYXlvdXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVBhdGg6ICdDYW52YXMnLFxuICAgICAgICAgICAgICAgIGxheW91dFR5cGU6ICd2ZXJ0aWNhbCcsXG4gICAgICAgICAgICAgICAgc3BhY2luZzogJzgsMTAnLFxuICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcxMiwxMiw4LDgnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0TGF5b3V0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0TGF5b3V0IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZWRDb21wb25lbnRDYWxscy5zb21lKChpdGVtKSA9PiBpdGVtLmNvbXBvbmVudCA9PT0gJ2NjLkxhYmVsJykpO1xuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eUNhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0ucGF0aC5pbmNsdWRlcygnY29udGVudFNpemUnKSkpO1xuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eUNhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0ucGF0aC5pbmNsdWRlcygnLnN0cmluZycpKSk7XG4gICAgYXNzZXJ0Lm9rKHNldFByb3BlcnR5Q2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5wYXRoLmluY2x1ZGVzKCcudHlwZScpKSk7XG4gICAgYXNzZXJ0Lm9rKHNldFByb3BlcnR5Q2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5wYXRoLmluY2x1ZGVzKCdwYWRkaW5nTGVmdCcpKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RBc3NldE1hbmFnZW1lbnRUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ2Fzc2V0LWRiJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdtb3ZlLWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHsgc291cmNlOiBhcmdzWzBdLCB0YXJnZXQ6IGFyZ3NbMV0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktcGF0aCcpIHtcbiAgICAgICAgICAgIHJldHVybiAnL1VzZXJzL2JsdWUvRGV2ZWxvcGVyL0NvY29zUHJvamVjdHMvSGVsbG9Xb3JsZC9hc3NldHMvYS5wcmVmYWInO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS11cmwnKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2RiOi8vYXNzZXRzL2EucHJlZmFiJztcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktdXVpZCcpIHtcbiAgICAgICAgICAgIHJldHVybiAndXVpZC1hJztcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVpbXBvcnQtYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdyZWZyZXNoLWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnb3Blbi1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgYXNzZXQgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ2Fzc2V0LWRiLm1vdmUtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktcGF0aCcsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS11cmwnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktdXVpZCcsXG4gICAgICAgICdhc3NldC1kYi5yZWltcG9ydC1hc3NldCcsXG4gICAgICAgICdhc3NldC1kYi5yZWZyZXNoLWFzc2V0JyxcbiAgICAgICAgJ2Fzc2V0LWRiLm9wZW4tYXNzZXQnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBtb3ZlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzAsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9tb3ZlX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHNvdXJjZTogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJyxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdkYjovL2Fzc2V0cy9iLnByZWZhYidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhtb3ZlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobW92ZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHF1ZXJ5UGF0aCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfcGF0aCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmxPclV1aWQ6ICd1dWlkLWEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlQYXRoKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlQYXRoIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5vayhxdWVyeVBhdGghLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnBhdGguaW5jbHVkZXMoJy9hc3NldHMvYS5wcmVmYWInKSk7XG5cbiAgICBjb25zdCBxdWVyeVVybCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfdXJsJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHV1aWRPclBhdGg6ICd1dWlkLWEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlVcmwpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVVybCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlVcmwhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnVybCwgJ2RiOi8vYXNzZXRzL2EucHJlZmFiJyk7XG5cbiAgICBjb25zdCBxdWVyeVV1aWQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3V1aWQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsT3JQYXRoOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlVdWlkKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlVdWlkIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVV1aWQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnV1aWQsICd1dWlkLWEnKTtcblxuICAgIGNvbnN0IHJlaW1wb3J0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9yZWltcG9ydF9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmw6ICdkYjovL2Fzc2V0cy9hLnByZWZhYidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhyZWltcG9ydCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlaW1wb3J0IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgcmVmcmVzaCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDM1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcmVmcmVzaF9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmw6ICdkYjovL2Fzc2V0cy9hLnByZWZhYidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhyZWZyZXNoKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVmcmVzaCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IG9wZW4gPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzNixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X29wZW5fYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsT3JVdWlkOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sob3Blbik7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG9wZW4hLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RQcmVmYWJMaWZlY3ljbGVUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXN0b3JlQ2FsbHM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgcmVzZXROb2RlQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgcmVzZXRDb21wb25lbnRDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBjcmVhdGVOb2RlQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgcmVtb3ZlTm9kZUNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGFwcGx5Q2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgcXVlcmllZEFzc2V0VXVpZHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGNyZWF0ZUF0dGVtcHQgPSAwO1xuXG4gICAgY29uc3QgcHJlZmFiTm9kZVN0YXRlczogUmVjb3JkPHN0cmluZywgeyBzdGF0ZTogbnVtYmVyOyBhc3NldFV1aWQ6IHN0cmluZyB9IHwgbnVsbD4gPSB7XG4gICAgICAgICdub2RlLXByZWZhYi0xJzogeyBzdGF0ZTogMSwgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnIH0sXG4gICAgICAgICdub2RlLXByZWZhYi0yJzogeyBzdGF0ZTogMSwgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnIH0sXG4gICAgICAgICdub2RlLWNyZWF0ZWQtaW52YWxpZCc6IG51bGwsXG4gICAgICAgICdub2RlLWNyZWF0ZWQtZnJvbS1wcmVmYWInOiB7IHN0YXRlOiAxLCBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMScgfVxuICAgIH07XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1hc3NldC1pbmZvJykge1xuICAgICAgICAgICAgcXVlcmllZEFzc2V0VXVpZHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdXVpZDogYXJnc1swXSxcbiAgICAgICAgICAgICAgICB0eXBlOiAnY2MuUHJlZmFiJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFubmVsICE9PSAnc2NlbmUnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2hhbm5lbDogJHtjaGFubmVsfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gWydub2RlLXByZWZhYi0xJywgJ25vZGUtcHJlZmFiLTInXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY3JlYXRlLW5vZGUnKSB7XG4gICAgICAgICAgICBjcmVhdGVOb2RlQ2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIGNyZWF0ZUF0dGVtcHQgKz0gMTtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVBdHRlbXB0ID09PSAxID8gJ25vZGUtY3JlYXRlZC1pbnZhbGlkJyA6ICdub2RlLWNyZWF0ZWQtZnJvbS1wcmVmYWInO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdyZW1vdmUtbm9kZScpIHtcbiAgICAgICAgICAgIHJlbW92ZU5vZGVDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUnKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBjb25zdCBwcmVmYWJTdGF0ZSA9IHByZWZhYk5vZGVTdGF0ZXNbbm9kZVV1aWQgYXMgc3RyaW5nXTtcbiAgICAgICAgICAgIGlmICghcHJlZmFiU3RhdGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiB7IHZhbHVlOiAnUGxheWVyUm9vdCcgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWU6IHsgdmFsdWU6ICdQbGF5ZXJSb290JyB9LFxuICAgICAgICAgICAgICAgIHByZWZhYjoge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZTogcHJlZmFiU3RhdGUuc3RhdGUsXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB2YWx1ZTogcHJlZmFiU3RhdGUuYXNzZXRVdWlkIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdhcHBseS1wcmVmYWInKSB7XG4gICAgICAgICAgICBhcHBseUNhbGxzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVzdG9yZS1wcmVmYWInKSB7XG4gICAgICAgICAgICByZXN0b3JlQ2FsbHMucHVzaChhcmdzWzBdLnV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Jlc2V0LW5vZGUnKSB7XG4gICAgICAgICAgICByZXNldE5vZGVDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Jlc2V0LWNvbXBvbmVudCcpIHtcbiAgICAgICAgICAgIHJlc2V0Q29tcG9uZW50Q2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHNjZW5lIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5jcmVhdGUtbm9kZScsXG4gICAgICAgICdzY2VuZS5yZW1vdmUtbm9kZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUnLFxuICAgICAgICAnc2NlbmUuYXBwbHktcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnJlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnJlc2V0LW5vZGUnLFxuICAgICAgICAnc2NlbmUucmVzZXQtY29tcG9uZW50JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfY3JlYXRlX2luc3RhbmNlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9xdWVyeV9ub2Rlc19ieV9hc3NldF91dWlkJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9nZXRfaW5zdGFuY2VfaW5mbycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfYXBwbHlfaW5zdGFuY2UnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX2FwcGx5X2luc3RhbmNlc19ieV9hc3NldCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZXNfYnlfYXNzZXQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3Jlc2V0X25vZGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3Jlc2V0X2NvbXBvbmVudCcpKTtcblxuICAgIGNvbnN0IGNyZWF0ZUluc3RhbmNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDAsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfY3JlYXRlX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogJ2Fzc2V0LXByZWZhYi0xJyxcbiAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiAncGFyZW50LTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soY3JlYXRlSW5zdGFuY2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVJbnN0YW5jZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlSW5zdGFuY2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm5vZGVVdWlkLCAnbm9kZS1jcmVhdGVkLWZyb20tcHJlZmFiJyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZU5vZGVDYWxscy5sZW5ndGgsIDIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZW1vdmVOb2RlQ2FsbHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlTm9kZUNhbGxzWzBdLnV1aWQsICdub2RlLWNyZWF0ZWQtaW52YWxpZCcpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyaWVkQXNzZXRVdWlkcy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyaWVkQXNzZXRVdWlkc1swXSwgJ2Fzc2V0LXByZWZhYi0xJyk7XG5cbiAgICBjb25zdCBxdWVyeU5vZGVzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcXVlcnlfbm9kZXNfYnlfYXNzZXRfdXVpZCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeU5vZGVzKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOb2RlcyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOb2RlcyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuXG4gICAgY29uc3QgaW5zdGFuY2VJbmZvID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfZ2V0X2luc3RhbmNlX2luZm8nLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLXByZWZhYi0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGluc3RhbmNlSW5mbyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2VJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pc1ByZWZhYkluc3RhbmNlLCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2VJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wcmVmYWJBc3NldFV1aWQsICdhc3NldC1wcmVmYWItMScpO1xuXG4gICAgY29uc3QgYXBwbHlTaW5nbGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MjUsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2UnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLXByZWZhYi0xJyxcbiAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiAnYXNzZXQtcHJlZmFiLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soYXBwbHlTaW5nbGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseVNpbmdsZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGFwcGx5QmF0Y2ggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MjYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2VzX2J5X2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogJ2Fzc2V0LXByZWZhYi0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGFwcGx5QmF0Y2gpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUJhdGNoIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUJhdGNoIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zdWNjZXNzQ291bnQsIDIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUNhbGxzLmxlbmd0aCwgMyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhcHBseUNhbGxzWzBdLCAnc3RyaW5nJyk7XG5cbiAgICBjb25zdCByZXN0b3JlU2luZ2xlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtcHJlZmFiLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzdG9yZVNpbmdsZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3RvcmVTaW5nbGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCByZXN0b3JlQmF0Y2ggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0NCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXN0b3JlX2luc3RhbmNlc19ieV9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhyZXN0b3JlQmF0Y2gpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlQmF0Y2ghLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3RvcmVCYXRjaCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc3VjY2Vzc0NvdW50LCAyKTtcblxuICAgIGNvbnN0IHJlc2V0Tm9kZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQ1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc2V0X25vZGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWRzOiBbJ25vZGUtcHJlZmFiLTEnLCAnbm9kZS1wcmVmYWItMiddXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzZXROb2RlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzZXROb2RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNldE5vZGVDYWxscy5sZW5ndGgsIDEpO1xuXG4gICAgY29uc3QgcmVzZXRDb21wb25lbnQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0NixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXNldF9jb21wb25lbnQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogJ2NvbXAtMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhyZXNldENvbXBvbmVudCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc2V0Q29tcG9uZW50IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNldENvbXBvbmVudENhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0Lm9rKHJlc3RvcmVDYWxscy5sZW5ndGggPj0gMyk7XG4gICAgYXNzZXJ0Lm9rKHJlc3RvcmVDYWxscy5pbmNsdWRlcygnbm9kZS1wcmVmYWItMScpKTtcbiAgICBhc3NlcnQub2socmVzdG9yZUNhbGxzLmluY2x1ZGVzKCdub2RlLXByZWZhYi0yJykpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0VW5rbm93blRvb2woKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKGFzeW5jICgpID0+IHVuZGVmaW5lZCk7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ25vdC1leGlzdHMnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2socmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEuZXJyb3I/LmNvZGUsIC0zMjYwMik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0TGlzdEFuZFJlYWREb21haW5DYWxscygpO1xuICAgIGF3YWl0IHRlc3RXcml0ZVRvb2xDYWxsKCk7XG4gICAgYXdhaXQgdGVzdExpZmVjeWNsZUFuZFJ1bnRpbWVUb29scygpO1xuICAgIGF3YWl0IHRlc3RTY2VuZVZpZXdUb29scygpO1xuICAgIGF3YWl0IHRlc3RVaUF1dG9tYXRpb25Ub29scygpO1xuICAgIGF3YWl0IHRlc3RBc3NldE1hbmFnZW1lbnRUb29scygpO1xuICAgIGF3YWl0IHRlc3RQcmVmYWJMaWZlY3ljbGVUb29scygpO1xuICAgIGF3YWl0IHRlc3RVbmtub3duVG9vbCgpO1xuICAgIGNvbnNvbGUubG9nKCduZXh0LXJvdXRlci10ZXN0OiBQQVNTJyk7XG59XG5cbnJ1bigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ25leHQtcm91dGVyLXRlc3Q6IEZBSUwnLCBlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=