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
    const createPrefabCalls = [];
    const linkPrefabCalls = [];
    const unlinkPrefabCalls = [];
    const queriedAssetUuids = [];
    let createAttempt = 0;
    const prefabNodeStates = {
        'node-prefab-1': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-prefab-2': { state: 1, assetUuid: 'asset-prefab-1' },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1yb3V0ZXItdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcm91dGVyLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU87WUFDUCxNQUFNO1lBQ04sS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZ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QUUsWUFBWTtRQUNwQixNQUFNLEVBQUU7WUFDSixJQUFJLEVBQUUsWUFBWTtZQUNsQixTQUFTLEVBQUUsRUFBRTtTQUNoQjtLQUNKLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDcEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFBLFFBQVMsQ0FBQyxLQUFLLDBDQUFFLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFFRCxLQUFLLFVBQVUsR0FBRztJQUNkLE1BQU0sMEJBQTBCLEVBQUUsQ0FBQztJQUNuQyxNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFDMUIsTUFBTSw0QkFBNEIsRUFBRSxDQUFDO0lBQ3JDLE1BQU0sa0JBQWtCLEVBQUUsQ0FBQztJQUMzQixNQUFNLHFCQUFxQixFQUFFLENBQUM7SUFDOUIsTUFBTSx3QkFBd0IsRUFBRSxDQUFDO0lBQ2pDLE1BQU0sd0JBQXdCLEVBQUUsQ0FBQztJQUNqQyxNQUFNLGVBQWUsRUFBRSxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQztBQUMxQyxDQUFDO0FBRUQsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYXBhYmlsaXR5TWF0cml4IH0gZnJvbSAnLi4vbmV4dC9tb2RlbHMnO1xuaW1wb3J0IHsgTmV4dFRvb2xSZWdpc3RyeSB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvdG9vbC1yZWdpc3RyeSc7XG5pbXBvcnQgeyBOZXh0TWNwUm91dGVyIH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC9yb3V0ZXInO1xuaW1wb3J0IHsgY3JlYXRlT2ZmaWNpYWxUb29scyB9IGZyb20gJy4uL25leHQvdG9vbHMvb2ZmaWNpYWwtdG9vbHMnO1xuXG5mdW5jdGlvbiBjcmVhdGVNYXRyaXgoYXZhaWxhYmxlS2V5czogc3RyaW5nW10pOiBDYXBhYmlsaXR5TWF0cml4IHtcbiAgICBjb25zdCBieUtleTogQ2FwYWJpbGl0eU1hdHJpeFsnYnlLZXknXSA9IHt9O1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGF2YWlsYWJsZUtleXMpIHtcbiAgICAgICAgY29uc3QgZmlyc3REb3QgPSBrZXkuaW5kZXhPZignLicpO1xuICAgICAgICBjb25zdCBjaGFubmVsID0ga2V5LnNsaWNlKDAsIGZpcnN0RG90KTtcbiAgICAgICAgY29uc3QgbWV0aG9kID0ga2V5LnNsaWNlKGZpcnN0RG90ICsgMSk7XG4gICAgICAgIGJ5S2V5W2tleV0gPSB7XG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICBjaGFubmVsLFxuICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBrZXksXG4gICAgICAgICAgICBhdmFpbGFibGU6IHRydWUsXG4gICAgICAgICAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGRldGFpbDogJ29rJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIGJ5S2V5LFxuICAgICAgICBzdW1tYXJ5OiB7XG4gICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgdW5hdmFpbGFibGU6IDAsXG4gICAgICAgICAgICBieUxheWVyOiB7XG4gICAgICAgICAgICAgICAgb2ZmaWNpYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHRlbmRlZDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHBlcmltZW50YWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RMaXN0QW5kUmVhZERvbWFpbkNhbGxzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUtdHJlZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6ICdyb290JywgbmFtZTogeyB2YWx1ZTogJ01haW5TY2VuZScgfSwgY2hpbGRyZW46IFtdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogJ25vZGUtMScgfSxcbiAgICAgICAgICAgICAgICBfX2NvbXBzX186IFtcbiAgICAgICAgICAgICAgICAgICAgeyBfX3R5cGVfXzogeyB2YWx1ZTogJ2NjLkxhYmVsJyB9LCB1dWlkOiB7IHZhbHVlOiAnY29tcC0xJyB9IH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWFzc2V0cycpIHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgeyB1cmw6ICdkYjovL2Fzc2V0cy9hLnByZWZhYicsIHV1aWQ6ICd1dWlkLWEnIH0sXG4gICAgICAgICAgICAgICAgeyB1cmw6ICdkYjovL2Fzc2V0cy9iLnByZWZhYicsIHV1aWQ6ICd1dWlkLWInIH1cbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJykge1xuICAgICAgICAgICAgcmV0dXJuIFsnZGVwLXV1aWQtMScsICdkZXAtdXVpZC0yJ107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtaW5mbycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6IGFyZ3NbMF0sIHVybDogYGRiOi8vYXNzZXRzLyR7YXJnc1swXX0ucHJlZmFiYCB9O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfSgke0pTT04uc3RyaW5naWZ5KGFyZ3MpfSlgKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUtdHJlZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0cycsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1hc3NldC1pbmZvJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWRlcGVuZGVuY2llcydcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBhc3NlcnQub2soQXJyYXkuaXNBcnJheShsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scykpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2xpc3RfZ2FtZV9vYmplY3RzJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2dldF9nYW1lX29iamVjdF9pbmZvJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9saXN0X29uX25vZGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJykpO1xuICAgIGFzc2VydC5vayghdG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9jcmVhdGVfZ2FtZV9vYmplY3QnKSwgJ+WGmeaTjeS9nOiDveWKm+acquaOoua1i+aXtuS4jeW6lOaatOmcsuWGmeW3peWFtycpO1xuXG4gICAgY29uc3QgY2FsbFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X2RlcGVuZGVuY2llcycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmxPclV1aWQ6ICdkYjovL2Fzc2V0cy9wbGF5ZXIucHJlZmFiJyxcbiAgICAgICAgICAgICAgICByZWxhdGlvblR5cGU6ICdhbGwnLFxuICAgICAgICAgICAgICAgIGluY2x1ZGVBc3NldEluZm86IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKGNhbGxSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEuZXJyb3IsIHVuZGVmaW5lZCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbFJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuc3VjY2VzcywgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmRlcGVuZGVuY3lJbmZvcy5sZW5ndGgsIDIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0V3JpdGVUb29sQ2FsbCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBzZXRQcm9wZXJ0eVBheWxvYWRzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IHJlbW92ZUNvbXBvbmVudFBheWxvYWRzOiBhbnlbXSA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogJ25vZGUtMScgfSxcbiAgICAgICAgICAgICAgICBfX2NvbXBzX186IFtcbiAgICAgICAgICAgICAgICAgICAgeyBfX3R5cGVfXzogeyB2YWx1ZTogJ2NjLkxhYmVsJyB9LCB1dWlkOiB7IHZhbHVlOiAnY29tcC11dWlkLWxhYmVsJyB9IH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3NldC1wcm9wZXJ0eScpIHtcbiAgICAgICAgICAgIHNldFByb3BlcnR5UGF5bG9hZHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3JlbW92ZS1jb21wb25lbnQnKSB7XG4gICAgICAgICAgICByZW1vdmVDb21wb25lbnRQYXlsb2Fkcy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2FsbDogJHtjaGFubmVsfS4ke21ldGhvZH0oJHtKU09OLnN0cmluZ2lmeShhcmdzKX0pYCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnNldC1wcm9wZXJ0eScsXG4gICAgICAgICdzY2VuZS5yZW1vdmUtY29tcG9uZW50J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3Qgc2V0UHJvcGVydHlSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS0xJyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiAnY2MuTGFiZWwnLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgdmFsdWU6ICdIZWxsbyBOZXh0JyxcbiAgICAgICAgICAgICAgICB2YWx1ZVR5cGU6ICdTdHJpbmcnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eVJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlQYXlsb2Fkcy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVBheWxvYWRzWzBdLnBhdGgsICdfX2NvbXBzX18uMC5zdHJpbmcnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlQYXlsb2Fkc1swXS5kdW1wLnZhbHVlLCAnSGVsbG8gTmV4dCcpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVBheWxvYWRzWzBdLmR1bXAudHlwZSwgJ1N0cmluZycpO1xuXG4gICAgY29uc3QgcmVtb3ZlQ29tcG9uZW50UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3JlbW92ZV9jb21wb25lbnQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLTEnLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6ICdjYy5MYWJlbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKHJlbW92ZUNvbXBvbmVudFJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlQ29tcG9uZW50UmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZUNvbXBvbmVudFBheWxvYWRzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZUNvbXBvbmVudFBheWxvYWRzWzBdLnV1aWQsICdjb21wLXV1aWQtbGFiZWwnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdExpZmVjeWNsZUFuZFJ1bnRpbWVUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjYWxsTG9nOiBBcnJheTx7IGNoYW5uZWw6IHN0cmluZzsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdIH0+ID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBjYWxsTG9nLnB1c2goeyBjaGFubmVsLCBtZXRob2QsIGFyZ3MgfSk7XG5cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnb3Blbi1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnc2F2ZS1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2Nsb3NlLXNjZW5lJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktaXMtcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1kaXJ0eScpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1zY2VuZS1ib3VuZHMnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB4OiAwLCB5OiAwLCB3aWR0aDogMTI4MCwgaGVpZ2h0OiA3MjAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdmb2N1cy1jYW1lcmEnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvamVjdCcgJiYgbWV0aG9kID09PSAncXVlcnktY29uZmlnJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgbmFtZTogJ0hlbGxvV29ybGQnLCBsYW5ndWFnZTogJ3poJyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJlZmVyZW5jZXMnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWNvbmZpZycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGxhbmd1YWdlOiAnemgtQ04nIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzZXJ2ZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWlwLWxpc3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gWycxMjcuMC4wLjEnXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NlcnZlcicgJiYgbWV0aG9kID09PSAncXVlcnktcG9ydCcpIHtcbiAgICAgICAgICAgIHJldHVybiA3NDU2O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnZW5naW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1lbmdpbmUtaW5mbycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHZlcnNpb246ICczLjguOCcsIG1vZHVsZXM6IFtdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdidWlsZGVyJyAmJiBtZXRob2QgPT09ICdxdWVyeS13b3JrZXItcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfSgke0pTT04uc3RyaW5naWZ5KGFyZ3MpfSlgKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLm9wZW4tc2NlbmUnLFxuICAgICAgICAnc2NlbmUucXVlcnktaXMtcmVhZHknLFxuICAgICAgICAnc2NlbmUucXVlcnktZGlydHknLFxuICAgICAgICAnc2NlbmUucXVlcnktc2NlbmUtYm91bmRzJyxcbiAgICAgICAgJ3NjZW5lLmZvY3VzLWNhbWVyYScsXG4gICAgICAgICdwcm9qZWN0LnF1ZXJ5LWNvbmZpZycsXG4gICAgICAgICdwcmVmZXJlbmNlcy5xdWVyeS1jb25maWcnLFxuICAgICAgICAnc2VydmVyLnF1ZXJ5LWlwLWxpc3QnLFxuICAgICAgICAnc2VydmVyLnF1ZXJ5LXBvcnQnLFxuICAgICAgICAnZW5naW5lLnF1ZXJ5LWVuZ2luZS1pbmZvJyxcbiAgICAgICAgJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgbGlzdFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTAsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGxpc3RSZXNwb25zZSk7XG4gICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfb3Blbl9zY2VuZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9zYXZlX3NjZW5lJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2Nsb3NlX3NjZW5lJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3F1ZXJ5X3N0YXR1cycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9mb2N1c19jYW1lcmEnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJvamVjdF9xdWVyeV9jb25maWcnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmVyZW5jZXNfcXVlcnlfY29uZmlnJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NlcnZlcl9xdWVyeV9uZXR3b3JrJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2VuZ2luZV9xdWVyeV9ydW50aW1lX2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZW5naW5lX3F1ZXJ5X2VuZ2luZV9pbmZvJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2J1aWxkZXJfcXVlcnlfd29ya2VyX3JlYWR5JykpO1xuXG4gICAgY29uc3Qgc2NlbmVTdGF0dXMgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3F1ZXJ5X3N0YXR1cycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlQm91bmRzOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2NlbmVTdGF0dXMpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzY2VuZVN0YXR1cyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2NlbmVTdGF0dXMhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmlzUmVhZHksIHRydWUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzY2VuZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuaXNEaXJ0eSwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzY2VuZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuYm91bmRzLndpZHRoLCAxMjgwKTtcblxuICAgIGNvbnN0IG9wZW5TY2VuZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfb3Blbl9zY2VuZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBzY2VuZVVybDogJ2RiOi8vYXNzZXRzL3NjZW5lcy9ib290LnNjZW5lJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKG9wZW5TY2VuZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5TY2VuZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3BlblNjZW5lIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5vcGVuZWQsIHRydWUpO1xuXG4gICAgY29uc3Qgc2F2ZVNjZW5lID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9zYXZlX3NjZW5lJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGZvcmNlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2F2ZVNjZW5lKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZVNjZW5lIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzYXZlU2NlbmUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnNjZW5lVXJsLCAnZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnKTtcblxuICAgIGNvbnN0IGNsb3NlU2NlbmUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2Nsb3NlX3NjZW5lJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhjbG9zZVNjZW5lKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2xvc2VTY2VuZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2xvc2VTY2VuZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY2xvc2VkLCB0cnVlKTtcblxuICAgIGNvbnN0IGZvY3VzQ2FtZXJhID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTUsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9mb2N1c19jYW1lcmEnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXVpZHM6ICdub2RlLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soZm9jdXNDYW1lcmEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChmb2N1c0NhbWVyYSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZvY3VzQ2FtZXJhIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS51dWlkcywgWydub2RlLTEnXSk7XG5cbiAgICBjb25zdCBwcm9qZWN0Q29uZmlnID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcm9qZWN0X3F1ZXJ5X2NvbmZpZycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBjb25maWdUeXBlOiAncHJvamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvdG9jb2w6ICdwcm9qZWN0J1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHByb2plY3RDb25maWcpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChwcm9qZWN0Q29uZmlnIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgcHJlZmVyZW5jZXNDb25maWcgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZlcmVuY2VzX3F1ZXJ5X2NvbmZpZycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBjb25maWdUeXBlOiAnZ2VuZXJhbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhwcmVmZXJlbmNlc0NvbmZpZyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHByZWZlcmVuY2VzQ29uZmlnIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgbmV0d29yayA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE4LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2VydmVyX3F1ZXJ5X25ldHdvcmsnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKG5ldHdvcmspO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChuZXR3b3JrIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChuZXR3b3JrIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wb3J0LCA3NDU2KTtcblxuICAgIGNvbnN0IHJ1bnRpbWVJbmZvID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTksXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdlbmdpbmVfcXVlcnlfcnVudGltZV9pbmZvJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhydW50aW1lSW5mbyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJ1bnRpbWVJbmZvIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChydW50aW1lSW5mbyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuaW5mby52ZXJzaW9uLCAnMy44LjgnKTtcblxuICAgIGNvbnN0IGVuZ2luZUluZm8gPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2VuZ2luZV9xdWVyeV9lbmdpbmVfaW5mbycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soZW5naW5lSW5mbyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUluZm8hLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCB3b3JrZXJSZWFkeSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYnVpbGRlcl9xdWVyeV93b3JrZXJfcmVhZHknLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHdvcmtlclJlYWR5KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VyUmVhZHkhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlclJlYWR5IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5yZWFkeSwgdHJ1ZSk7XG5cbiAgICBhc3NlcnQub2soXG4gICAgICAgIGNhbGxMb2cuc29tZSgoaXRlbSkgPT4gaXRlbS5jaGFubmVsID09PSAnc2NlbmUnICYmIGl0ZW0ubWV0aG9kID09PSAnb3Blbi1zY2VuZScpLFxuICAgICAgICAn5bqU6LCD55SoIHNjZW5lLm9wZW4tc2NlbmUnXG4gICAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdFNjZW5lVmlld1Rvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHN0YXRlID0ge1xuICAgICAgICBpczJEOiBmYWxzZSxcbiAgICAgICAgZ2l6bW9Ub29sOiAnbW92ZScsXG4gICAgICAgIGdpem1vUGl2b3Q6ICdjZW50ZXInLFxuICAgICAgICBnaXptb0Nvb3JkaW5hdGU6ICdsb2NhbCcsXG4gICAgICAgIGlzR3JpZFZpc2libGU6IHRydWUsXG4gICAgICAgIGlzSWNvbkdpem1vM0Q6IHRydWUsXG4gICAgICAgIGljb25HaXptb1NpemU6IDFcbiAgICB9O1xuICAgIGNvbnN0IGFsaWduQ2FsbHM6IHN0cmluZ1tdID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ3NjZW5lJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1pczJEJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmlzMkQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWdpem1vLXRvb2wtbmFtZScpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5naXptb1Rvb2w7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWdpem1vLXBpdm90Jykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLmdpem1vUGl2b3Q7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWdpem1vLWNvb3JkaW5hdGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuZ2l6bW9Db29yZGluYXRlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1pcy1ncmlkLXZpc2libGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuaXNHcmlkVmlzaWJsZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktaXMtaWNvbi1naXptby0zZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5pc0ljb25HaXptbzNEO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1pY29uLWdpem1vLXNpemUnKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGUuaWNvbkdpem1vU2l6ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktaXMtcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY2hhbmdlLWlzMkQnKSB7XG4gICAgICAgICAgICBzdGF0ZS5pczJEID0gQm9vbGVhbihhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NoYW5nZS1naXptby10b29sJykge1xuICAgICAgICAgICAgc3RhdGUuZ2l6bW9Ub29sID0gYXJnc1swXTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NoYW5nZS1naXptby1waXZvdCcpIHtcbiAgICAgICAgICAgIHN0YXRlLmdpem1vUGl2b3QgPSBhcmdzWzBdO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY2hhbmdlLWdpem1vLWNvb3JkaW5hdGUnKSB7XG4gICAgICAgICAgICBzdGF0ZS5naXptb0Nvb3JkaW5hdGUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2V0LWdyaWQtdmlzaWJsZScpIHtcbiAgICAgICAgICAgIHN0YXRlLmlzR3JpZFZpc2libGUgPSBCb29sZWFuKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2V0LWljb24tZ2l6bW8tM2QnKSB7XG4gICAgICAgICAgICBzdGF0ZS5pc0ljb25HaXptbzNEID0gQm9vbGVhbihhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NldC1pY29uLWdpem1vLXNpemUnKSB7XG4gICAgICAgICAgICBzdGF0ZS5pY29uR2l6bW9TaXplID0gTnVtYmVyKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnYWxpZ24td2l0aC12aWV3JyB8fCBtZXRob2QgPT09ICdhbGlnbi12aWV3LXdpdGgtbm9kZScpIHtcbiAgICAgICAgICAgIGFsaWduQ2FsbHMucHVzaChtZXRob2QpO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBzY2VuZSBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUucXVlcnktaXMyRCcsXG4gICAgICAgICdzY2VuZS5xdWVyeS1naXptby10b29sLW5hbWUnLFxuICAgICAgICAnc2NlbmUucXVlcnktZ2l6bW8tcGl2b3QnLFxuICAgICAgICAnc2NlbmUucXVlcnktZ2l6bW8tY29vcmRpbmF0ZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1pcy1ncmlkLXZpc2libGUnLFxuICAgICAgICAnc2NlbmUucXVlcnktaXMtaWNvbi1naXptby0zZCcsXG4gICAgICAgICdzY2VuZS5xdWVyeS1pY29uLWdpem1vLXNpemUnLFxuICAgICAgICAnc2NlbmUucXVlcnktaXMtcmVhZHknXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3F1ZXJ5X3N0YXRlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X21vZGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfZ2l6bW9fdG9vbCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9naXptb19waXZvdCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9naXptb19jb29yZGluYXRlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfc2V0X2dyaWRfdmlzaWJsZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV92aWV3X3NldF9pY29uX2dpem1vX3Zpc2libGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfdmlld19zZXRfaWNvbl9naXptb19zaXplJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfYWxpZ25fd2l0aF92aWV3JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3ZpZXdfYWxpZ25fdmlld193aXRoX25vZGUnKSk7XG5cbiAgICBjb25zdCBxdWVyeVN0YXRlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3F1ZXJ5X3N0YXRlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeVN0YXRlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlTdGF0ZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlTdGF0ZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc3RhdGUuaXMyRCwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVN0YXRlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zdGF0ZS5naXptb1Rvb2wsICdtb3ZlJyk7XG5cbiAgICBjb25zdCBzZXRNb2RlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3NldF9tb2RlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGlzMkQ6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRNb2RlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0TW9kZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0TW9kZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY3VycmVudCwgdHJ1ZSk7XG5cbiAgICBjb25zdCBzZXRUb29sID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjUsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3NldF9naXptb190b29sJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHRvb2w6ICdyb3RhdGUnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2V0VG9vbCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFRvb2whLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldFRvb2whLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmN1cnJlbnQsICdyb3RhdGUnKTtcblxuICAgIGNvbnN0IHNldEdyaWQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyNixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X2dyaWRfdmlzaWJsZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldEdyaWQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRHcmlkIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRHcmlkIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jdXJyZW50LCBmYWxzZSk7XG5cbiAgICBjb25zdCBzZXRJY29uU2l6ZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDI3LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfaWNvbl9naXptb19zaXplJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHNpemU6IDJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRJY29uU2l6ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNldEljb25TaXplIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRJY29uU2l6ZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY3VycmVudCwgMik7XG5cbiAgICBjb25zdCBhbGlnbldpdGhWaWV3ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjgsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X2FsaWduX3dpdGhfdmlldycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soYWxpZ25XaXRoVmlldyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGFsaWduV2l0aFZpZXchLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBhbGlnblZpZXdXaXRoTm9kZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDI5LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19hbGlnbl92aWV3X3dpdGhfbm9kZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soYWxpZ25WaWV3V2l0aE5vZGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhbGlnblZpZXdXaXRoTm9kZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsaWduQ2FsbHMsIFsnYWxpZ24td2l0aC12aWV3JywgJ2FsaWduLXZpZXctd2l0aC1ub2RlJ10pO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0VWlBdXRvbWF0aW9uVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaW50ZXJmYWNlIE1vY2tOb2RlIHtcbiAgICAgICAgdXVpZDogc3RyaW5nO1xuICAgICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICAgIHBhcmVudDogc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgY2hpbGRyZW46IHN0cmluZ1tdO1xuICAgICAgICBjb21wb25lbnRzOiBzdHJpbmdbXTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlcyA9IG5ldyBNYXA8c3RyaW5nLCBNb2NrTm9kZT4oKTtcbiAgICBjb25zdCBjcmVhdGVkTm9kZUNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGNyZWF0ZWRDb21wb25lbnRDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBzZXRQcm9wZXJ0eUNhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGxldCBub2RlQ291bnRlciA9IDA7XG5cbiAgICBjb25zdCBlbnN1cmVOb2RlID0gKG5vZGU6IE1vY2tOb2RlKTogdm9pZCA9PiB7XG4gICAgICAgIG5vZGVzLnNldChub2RlLnV1aWQsIG5vZGUpO1xuICAgIH07XG5cbiAgICBlbnN1cmVOb2RlKHtcbiAgICAgICAgdXVpZDogJ3Jvb3QnLFxuICAgICAgICBuYW1lOiAnTWFpblNjZW5lJyxcbiAgICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgICBjaGlsZHJlbjogWydjYW52YXMtMSddLFxuICAgICAgICBjb21wb25lbnRzOiBbXVxuICAgIH0pO1xuICAgIGVuc3VyZU5vZGUoe1xuICAgICAgICB1dWlkOiAnY2FudmFzLTEnLFxuICAgICAgICBuYW1lOiAnQ2FudmFzJyxcbiAgICAgICAgcGFyZW50OiAncm9vdCcsXG4gICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgY29tcG9uZW50czogWydjYy5DYW52YXMnLCAnY2MuVUlUcmFuc2Zvcm0nXVxuICAgIH0pO1xuXG4gICAgY29uc3QgY3JlYXRlTm9kZUR1bXAgPSAodXVpZDogc3RyaW5nKTogYW55ID0+IHtcbiAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzLmdldCh1dWlkKTtcbiAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgbm90IGZvdW5kOiAke3V1aWR9YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogbm9kZS51dWlkIH0sXG4gICAgICAgICAgICBuYW1lOiB7IHZhbHVlOiBub2RlLm5hbWUgfSxcbiAgICAgICAgICAgIF9fY29tcHNfXzogbm9kZS5jb21wb25lbnRzLm1hcCgodHlwZSwgaW5kZXgpID0+ICh7XG4gICAgICAgICAgICAgICAgX190eXBlX186IHsgdmFsdWU6IHR5cGUgfSxcbiAgICAgICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiBgJHt1dWlkfS1jb21wLSR7aW5kZXh9YCB9XG4gICAgICAgICAgICB9KSlcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgY29uc3QgY3JlYXRlVHJlZUR1bXAgPSAodXVpZDogc3RyaW5nKTogYW55ID0+IHtcbiAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzLmdldCh1dWlkKTtcbiAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRyZWUgbm9kZSBub3QgZm91bmQ6ICR7dXVpZH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogbm9kZS51dWlkIH0sXG4gICAgICAgICAgICBuYW1lOiB7IHZhbHVlOiBub2RlLm5hbWUgfSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBub2RlLmNoaWxkcmVuLm1hcCgoY2hpbGRVdWlkKSA9PiBjcmVhdGVUcmVlRHVtcChjaGlsZFV1aWQpKVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ3NjZW5lJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1ub2RlLXRyZWUnKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlVHJlZUR1bXAoJ3Jvb3QnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVOb2RlRHVtcChhcmdzWzBdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY3JlYXRlLW5vZGUnKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0gYXJnc1swXSB8fCB7fTtcbiAgICAgICAgICAgIGNyZWF0ZWROb2RlQ2FsbHMucHVzaChvcHRpb25zKTtcblxuICAgICAgICAgICAgbm9kZUNvdW50ZXIgKz0gMTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYG5vZGUtdWktJHtub2RlQ291bnRlcn1gO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IG9wdGlvbnMucGFyZW50IHx8ICdyb290JztcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzLmdldChwYXJlbnRVdWlkKTtcbiAgICAgICAgICAgIGlmICghcGFyZW50KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgbm90IGZvdW5kOiAke3BhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGU6IE1vY2tOb2RlID0ge1xuICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSB8fCBgTm9kZS0ke25vZGVDb3VudGVyfWAsXG4gICAgICAgICAgICAgICAgcGFyZW50OiBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG5vZGVzLnNldChub2RlVXVpZCwgbm9kZSk7XG4gICAgICAgICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChub2RlVXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZVV1aWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NyZWF0ZS1jb21wb25lbnQnKSB7XG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNyZWF0ZWRDb21wb25lbnRDYWxscy5wdXNoKHBheWxvYWQpO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXMuZ2V0KHBheWxvYWQudXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENyZWF0ZSBjb21wb25lbnQgdGFyZ2V0IG5vdCBmb3VuZDogJHtwYXlsb2FkLnV1aWR9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW5vZGUuY29tcG9uZW50cy5pbmNsdWRlcyhwYXlsb2FkLmNvbXBvbmVudCkpIHtcbiAgICAgICAgICAgICAgICBub2RlLmNvbXBvbmVudHMucHVzaChwYXlsb2FkLmNvbXBvbmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzZXQtcHJvcGVydHknKSB7XG4gICAgICAgICAgICBzZXRQcm9wZXJ0eUNhbGxzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBzY2VuZSBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUucXVlcnktbm9kZS10cmVlJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUnLFxuICAgICAgICAnc2NlbmUuY3JlYXRlLW5vZGUnLFxuICAgICAgICAnc2NlbmUuY3JlYXRlLWNvbXBvbmVudCcsXG4gICAgICAgICdzY2VuZS5zZXQtcHJvcGVydHknXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMDAsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGxpc3RSZXNwb25zZSk7XG4gICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygndWlfY3JlYXRlX2VsZW1lbnQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygndWlfc2V0X3JlY3RfdHJhbnNmb3JtJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3VpX3NldF90ZXh0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3VpX3NldF9sYXlvdXQnKSk7XG5cbiAgICBjb25zdCBjcmVhdGVFbGVtZW50ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzAxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAndWlfY3JlYXRlX2VsZW1lbnQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgZWxlbWVudFR5cGU6ICdMYWJlbCcsXG4gICAgICAgICAgICAgICAgZWxlbWVudE5hbWU6ICdUaXRsZScsXG4gICAgICAgICAgICAgICAgcGFyZW50UGF0aDogJ0NhbnZhcydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhjcmVhdGVFbGVtZW50KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlRWxlbWVudCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBjb25zdCBjcmVhdGVkTm9kZVV1aWQgPSBjcmVhdGVFbGVtZW50IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ub2RlVXVpZCBhcyBzdHJpbmc7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWROb2RlQ2FsbHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlZE5vZGVDYWxsc1swXS5wYXJlbnQsICdjYW52YXMtMScpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkTm9kZUNhbGxzWzBdLm5hbWUsICdUaXRsZScpO1xuICAgIGFzc2VydC5vayhjcmVhdGVFbGVtZW50IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5lbnN1cmVkQ29tcG9uZW50cy5pbmNsdWRlcygnY2MuVUlUcmFuc2Zvcm0nKSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZUVsZW1lbnQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmVuc3VyZWRDb21wb25lbnRzLmluY2x1ZGVzKCdjYy5MYWJlbCcpKTtcblxuICAgIGNvbnN0IHNldFJlY3QgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICd1aV9zZXRfcmVjdF90cmFuc2Zvcm0nLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6IGNyZWF0ZWROb2RlVXVpZCxcbiAgICAgICAgICAgICAgICBzaXplOiB7IHdpZHRoOiAzMjAsIGhlaWdodDogODAgfSxcbiAgICAgICAgICAgICAgICBhbmNob3I6IHsgeDogMC41LCB5OiAwLjUgfSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogeyB4OiAxMCwgeTogMjAsIHo6IDAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldFJlY3QpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRSZWN0IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3Qgc2V0VGV4dCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3VpX3NldF90ZXh0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiBjcmVhdGVkTm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgdGV4dDogJ0hlbGxvIFVJJyxcbiAgICAgICAgICAgICAgICBmb250U2l6ZTogMzIsXG4gICAgICAgICAgICAgICAgaG9yaXpvbnRhbEFsaWduOiAnY2VudGVyJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldFRleHQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRUZXh0IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3Qgc2V0TGF5b3V0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzA0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAndWlfc2V0X2xheW91dCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlUGF0aDogJ0NhbnZhcycsXG4gICAgICAgICAgICAgICAgbGF5b3V0VHlwZTogJ3ZlcnRpY2FsJyxcbiAgICAgICAgICAgICAgICBzcGFjaW5nOiAnOCwxMCcsXG4gICAgICAgICAgICAgICAgcGFkZGluZzogJzEyLDEyLDgsOCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRMYXlvdXQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRMYXlvdXQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBhc3NlcnQub2soY3JlYXRlZENvbXBvbmVudENhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0uY29tcG9uZW50ID09PSAnY2MuTGFiZWwnKSk7XG4gICAgYXNzZXJ0Lm9rKHNldFByb3BlcnR5Q2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5wYXRoLmluY2x1ZGVzKCdjb250ZW50U2l6ZScpKSk7XG4gICAgYXNzZXJ0Lm9rKHNldFByb3BlcnR5Q2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5wYXRoLmluY2x1ZGVzKCcuc3RyaW5nJykpKTtcbiAgICBhc3NlcnQub2soc2V0UHJvcGVydHlDYWxscy5zb21lKChpdGVtKSA9PiBpdGVtLnBhdGguaW5jbHVkZXMoJy50eXBlJykpKTtcbiAgICBhc3NlcnQub2soc2V0UHJvcGVydHlDYWxscy5zb21lKChpdGVtKSA9PiBpdGVtLnBhdGguaW5jbHVkZXMoJ3BhZGRpbmdMZWZ0JykpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdEFzc2V0TWFuYWdlbWVudFRvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsICE9PSAnYXNzZXQtZGInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2hhbm5lbDogJHtjaGFubmVsfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ21vdmUtYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzb3VyY2U6IGFyZ3NbMF0sIHRhcmdldDogYXJnc1sxXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1wYXRoJykge1xuICAgICAgICAgICAgcmV0dXJuICcvVXNlcnMvYmx1ZS9EZXZlbG9wZXIvQ29jb3NQcm9qZWN0cy9IZWxsb1dvcmxkL2Fzc2V0cy9hLnByZWZhYic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LXVybCcpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS11dWlkJykge1xuICAgICAgICAgICAgcmV0dXJuICd1dWlkLWEnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdyZWltcG9ydC1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlZnJlc2gtYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdvcGVuLWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBhc3NldCBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnYXNzZXQtZGIubW92ZS1hc3NldCcsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1wYXRoJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LXVybCcsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS11dWlkJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnJlaW1wb3J0LWFzc2V0JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnJlZnJlc2gtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIub3Blbi1hc3NldCdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IG1vdmUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X21vdmVfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgc291cmNlOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInLFxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2RiOi8vYXNzZXRzL2IucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKG1vdmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChtb3ZlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgcXVlcnlQYXRoID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9wYXRoJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yVXVpZDogJ3V1aWQtYSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeVBhdGgpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVBhdGghLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5UGF0aCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucGF0aC5pbmNsdWRlcygnL2Fzc2V0cy9hLnByZWZhYicpKTtcblxuICAgIGNvbnN0IHF1ZXJ5VXJsID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV91cmwnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXVpZE9yUGF0aDogJ3V1aWQtYSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeVVybCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VXJsIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVVybCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEudXJsLCAnZGI6Ly9hc3NldHMvYS5wcmVmYWInKTtcblxuICAgIGNvbnN0IHF1ZXJ5VXVpZCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfdXVpZCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmxPclBhdGg6ICdkYjovL2Fzc2V0cy9hLnByZWZhYidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeVV1aWQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVV1aWQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VXVpZCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEudXVpZCwgJ3V1aWQtYScpO1xuXG4gICAgY29uc3QgcmVpbXBvcnQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3JlaW1wb3J0X2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJlaW1wb3J0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVpbXBvcnQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCByZWZyZXNoID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzUsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9yZWZyZXNoX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJlZnJlc2gpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZWZyZXNoIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3Qgb3BlbiA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDM2LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfb3Blbl9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmxPclV1aWQ6ICdkYjovL2Fzc2V0cy9hLnByZWZhYidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhvcGVuKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3BlbiEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdFByZWZhYkxpZmVjeWNsZVRvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3RvcmVDYWxsczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCByZXNldE5vZGVDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCByZXNldENvbXBvbmVudENhbGxzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGNyZWF0ZU5vZGVDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCByZW1vdmVOb2RlQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgYXBwbHlDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBjcmVhdGVQcmVmYWJDYWxsczogYW55W10gPSBbXTtcbiAgICBjb25zdCBsaW5rUHJlZmFiQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgdW5saW5rUHJlZmFiQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3QgcXVlcmllZEFzc2V0VXVpZHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGNyZWF0ZUF0dGVtcHQgPSAwO1xuXG4gICAgY29uc3QgcHJlZmFiTm9kZVN0YXRlczogUmVjb3JkPHN0cmluZywgeyBzdGF0ZTogbnVtYmVyOyBhc3NldFV1aWQ6IHN0cmluZyB9IHwgbnVsbD4gPSB7XG4gICAgICAgICdub2RlLXByZWZhYi0xJzogeyBzdGF0ZTogMSwgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnIH0sXG4gICAgICAgICdub2RlLXByZWZhYi0yJzogeyBzdGF0ZTogMSwgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLTEnIH0sXG4gICAgICAgICdub2RlLWNyZWF0ZWQtaW52YWxpZCc6IG51bGwsXG4gICAgICAgICdub2RlLWNyZWF0ZWQtZnJvbS1wcmVmYWInOiB7IHN0YXRlOiAxLCBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMScgfSxcbiAgICAgICAgJ25vZGUtbGluay10YXJnZXQnOiBudWxsXG4gICAgfTtcbiAgICBjb25zdCBjcmVhdGVkUHJlZmFiQXNzZXRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1hc3NldC1pbmZvJykge1xuICAgICAgICAgICAgcXVlcmllZEFzc2V0VXVpZHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycgJiYgY3JlYXRlZFByZWZhYkFzc2V0c1thcmdzWzBdXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNyZWF0ZWRQcmVmYWJBc3NldHNbYXJnc1swXV0sXG4gICAgICAgICAgICAgICAgICAgIHVybDogYXJnc1swXSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NjLlByZWZhYidcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBhcmdzWzBdLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdjYy5QcmVmYWInXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdzY2VuZScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBbJ25vZGUtcHJlZmFiLTEnLCAnbm9kZS1wcmVmYWItMiddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtbm9kZScpIHtcbiAgICAgICAgICAgIGNyZWF0ZU5vZGVDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgY3JlYXRlQXR0ZW1wdCArPSAxO1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUF0dGVtcHQgPT09IDEgPyAnbm9kZS1jcmVhdGVkLWludmFsaWQnIDogJ25vZGUtY3JlYXRlZC1mcm9tLXByZWZhYic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlbW92ZS1ub2RlJykge1xuICAgICAgICAgICAgcmVtb3ZlTm9kZUNhbGxzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlN0YXRlID0gcHJlZmFiTm9kZVN0YXRlc1tub2RlVXVpZCBhcyBzdHJpbmddO1xuICAgICAgICAgICAgaWYgKCFwcmVmYWJTdGF0ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHsgdmFsdWU6ICdQbGF5ZXJSb290JyB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogJ1BsYXllclJvb3QnIH0sXG4gICAgICAgICAgICAgICAgcHJlZmFiOiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiBwcmVmYWJTdGF0ZS5zdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHZhbHVlOiBwcmVmYWJTdGF0ZS5hc3NldFV1aWQgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2FwcGx5LXByZWZhYicpIHtcbiAgICAgICAgICAgIGFwcGx5Q2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtcHJlZmFiJykge1xuICAgICAgICAgICAgY3JlYXRlUHJlZmFiQ2FsbHMucHVzaChhcmdzKTtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0QXJnID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHNlY29uZEFyZyA9IGFyZ3NbMV07XG4gICAgICAgICAgICBsZXQgbm9kZVV1aWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGxldCB0YXJnZXRVcmw6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlyc3RBcmcgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBzZWNvbmRBcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQgPSBmaXJzdEFyZztcbiAgICAgICAgICAgICAgICB0YXJnZXRVcmwgPSBzZWNvbmRBcmc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpcnN0QXJnICYmIHR5cGVvZiBmaXJzdEFyZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCA9IGZpcnN0QXJnLnV1aWQgfHwgZmlyc3RBcmcubm9kZVV1aWQgfHwgZmlyc3RBcmcubm9kZTtcbiAgICAgICAgICAgICAgICB0YXJnZXRVcmwgPSBmaXJzdEFyZy51cmwgfHwgZmlyc3RBcmcudGFyZ2V0VXJsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICF0YXJnZXRVcmwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgY3JlYXRlLXByZWZhYiBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3QXNzZXRVdWlkID0gJ2Fzc2V0LWNyZWF0ZWQtcHJlZmFiLTEnO1xuICAgICAgICAgICAgY3JlYXRlZFByZWZhYkFzc2V0c1t0YXJnZXRVcmxdID0gbmV3QXNzZXRVdWlkO1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogbmV3QXNzZXRVdWlkIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2xpbmstcHJlZmFiJykge1xuICAgICAgICAgICAgY29uc3QgZmlyc3RBcmcgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kQXJnID0gYXJnc1sxXTtcbiAgICAgICAgICAgIGxldCBub2RlVXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgbGV0IGFzc2V0VXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaXJzdEFyZyA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIHNlY29uZEFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCA9IGZpcnN0QXJnO1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZCA9IHNlY29uZEFyZztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlyc3RBcmcgJiYgdHlwZW9mIGZpcnN0QXJnID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkID0gZmlyc3RBcmcudXVpZCB8fCBmaXJzdEFyZy5ub2RlO1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZCA9IGZpcnN0QXJnLmFzc2V0VXVpZCB8fCBmaXJzdEFyZy5wcmVmYWI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBsaW5rLXByZWZhYiBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub2RlVXVpZCA9PT0gJ25vZGUtY3JlYXRlZC1pbnZhbGlkJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbW9jayBsaW5rLXByZWZhYiBmYWlsZWQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGlua1ByZWZhYkNhbGxzLnB1c2goeyBub2RlVXVpZCwgYXNzZXRVdWlkIH0pO1xuICAgICAgICAgICAgcHJlZmFiTm9kZVN0YXRlc1tub2RlVXVpZF0gPSB7IHN0YXRlOiAxLCBhc3NldFV1aWQgfTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICd1bmxpbmstcHJlZmFiJykge1xuICAgICAgICAgICAgY29uc3QgZmlyc3RBcmcgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kQXJnID0gYXJnc1sxXTtcbiAgICAgICAgICAgIGxldCBub2RlVXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgbGV0IHJlbW92ZU5lc3RlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaXJzdEFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCA9IGZpcnN0QXJnO1xuICAgICAgICAgICAgICAgIHJlbW92ZU5lc3RlZCA9IEJvb2xlYW4oc2Vjb25kQXJnKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlyc3RBcmcgJiYgdHlwZW9mIGZpcnN0QXJnID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkID0gZmlyc3RBcmcudXVpZCB8fCBmaXJzdEFyZy5ub2RlO1xuICAgICAgICAgICAgICAgIHJlbW92ZU5lc3RlZCA9IEJvb2xlYW4oZmlyc3RBcmcucmVtb3ZlTmVzdGVkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFub2RlVXVpZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCB1bmxpbmstcHJlZmFiIGFyZ3VtZW50cycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1bmxpbmtQcmVmYWJDYWxscy5wdXNoKHsgbm9kZVV1aWQsIHJlbW92ZU5lc3RlZCB9KTtcbiAgICAgICAgICAgIHByZWZhYk5vZGVTdGF0ZXNbbm9kZVV1aWRdID0gbnVsbDtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdyZXN0b3JlLXByZWZhYicpIHtcbiAgICAgICAgICAgIHJlc3RvcmVDYWxscy5wdXNoKGFyZ3NbMF0udXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVzZXQtbm9kZScpIHtcbiAgICAgICAgICAgIHJlc2V0Tm9kZUNhbGxzLnB1c2goYXJnc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVzZXQtY29tcG9uZW50Jykge1xuICAgICAgICAgICAgcmVzZXRDb21wb25lbnRDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc2NlbmUgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnJlbW92ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLFxuICAgICAgICAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgICdzY2VuZS5hcHBseS1wcmVmYWInLFxuICAgICAgICAnc2NlbmUuY3JlYXRlLXByZWZhYicsXG4gICAgICAgICdzY2VuZS5saW5rLXByZWZhYicsXG4gICAgICAgICdzY2VuZS51bmxpbmstcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnJlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnJlc2V0LW5vZGUnLFxuICAgICAgICAnc2NlbmUucmVzZXQtY29tcG9uZW50JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfY3JlYXRlX2luc3RhbmNlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9jcmVhdGVfYXNzZXRfZnJvbV9ub2RlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9saW5rX25vZGVfdG9fYXNzZXQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3VubGlua19pbnN0YW5jZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfcXVlcnlfbm9kZXNfYnlfYXNzZXRfdXVpZCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmYWJfZ2V0X2luc3RhbmNlX2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX2FwcGx5X2luc3RhbmNlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9hcHBseV9pbnN0YW5jZXNfYnlfYXNzZXQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2UnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmFiX3Jlc3RvcmVfaW5zdGFuY2VzX2J5X2Fzc2V0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9yZXNldF9ub2RlJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZhYl9yZXNldF9jb21wb25lbnQnKSk7XG5cbiAgICBjb25zdCBjcmVhdGVJbnN0YW5jZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2NyZWF0ZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMScsXG4gICAgICAgICAgICAgICAgcGFyZW50VXVpZDogJ3BhcmVudC0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZUluc3RhbmNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlSW5zdGFuY2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZUluc3RhbmNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ub2RlVXVpZCwgJ25vZGUtY3JlYXRlZC1mcm9tLXByZWZhYicpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVOb2RlQ2FsbHMubGVuZ3RoLCAyKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlTm9kZUNhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZU5vZGVDYWxsc1swXS51dWlkLCAnbm9kZS1jcmVhdGVkLWludmFsaWQnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcmllZEFzc2V0VXVpZHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcmllZEFzc2V0VXVpZHNbMF0sICdhc3NldC1wcmVmYWItMScpO1xuXG4gICAgY29uc3QgY3JlYXRlUHJlZmFiQXNzZXQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfY3JlYXRlX2Fzc2V0X2Zyb21fbm9kZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtcHJlZmFiLTEnLFxuICAgICAgICAgICAgICAgIHRhcmdldFVybDogJ2RiOi8vYXNzZXRzL2dlbmVyYXRlZC9uZXcucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZVByZWZhYkFzc2V0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlUHJlZmFiQXNzZXQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZVByZWZhYkNhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZVByZWZhYkFzc2V0IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wcmVmYWJVdWlkLCAnYXNzZXQtY3JlYXRlZC1wcmVmYWItMScpO1xuXG4gICAgY29uc3QgbGlua05vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfbGlua19ub2RlX3RvX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS1saW5rLXRhcmdldCcsXG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLWxpbmstMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaW5rTm9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGxpbmtOb2RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChsaW5rUHJlZmFiQ2FsbHMubGVuZ3RoLCAxKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobGlua05vZGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmFmdGVyLnByZWZhYkFzc2V0VXVpZCwgJ2Fzc2V0LXByZWZhYi1saW5rLTEnKTtcblxuICAgIGNvbnN0IHVubGlua05vZGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfdW5saW5rX2luc3RhbmNlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS1saW5rLXRhcmdldCcsXG4gICAgICAgICAgICAgICAgcmVtb3ZlTmVzdGVkOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sodW5saW5rTm9kZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHVubGlua05vZGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHVubGlua1ByZWZhYkNhbGxzLmxlbmd0aCwgMSk7XG5cbiAgICBjb25zdCBxdWVyeU5vZGVzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcXVlcnlfbm9kZXNfYnlfYXNzZXRfdXVpZCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeU5vZGVzKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOb2RlcyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOb2RlcyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuXG4gICAgY29uc3QgaW5zdGFuY2VJbmZvID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfZ2V0X2luc3RhbmNlX2luZm8nLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLXByZWZhYi0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGluc3RhbmNlSW5mbyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2VJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pc1ByZWZhYkluc3RhbmNlLCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2VJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wcmVmYWJBc3NldFV1aWQsICdhc3NldC1wcmVmYWItMScpO1xuXG4gICAgY29uc3QgYXBwbHlTaW5nbGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MjUsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2UnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLXByZWZhYi0xJyxcbiAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiAnYXNzZXQtcHJlZmFiLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soYXBwbHlTaW5nbGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseVNpbmdsZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGFwcGx5QmF0Y2ggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0MjYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfYXBwbHlfaW5zdGFuY2VzX2J5X2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogJ2Fzc2V0LXByZWZhYi0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGFwcGx5QmF0Y2gpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUJhdGNoIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUJhdGNoIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zdWNjZXNzQ291bnQsIDIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUNhbGxzLmxlbmd0aCwgMyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhcHBseUNhbGxzWzBdLCAnc3RyaW5nJyk7XG5cbiAgICBjb25zdCByZXN0b3JlU2luZ2xlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmYWJfcmVzdG9yZV9pbnN0YW5jZScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtcHJlZmFiLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzdG9yZVNpbmdsZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3RvcmVTaW5nbGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCByZXN0b3JlQmF0Y2ggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0NCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXN0b3JlX2luc3RhbmNlc19ieV9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhyZXN0b3JlQmF0Y2gpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlQmF0Y2ghLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3RvcmVCYXRjaCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc3VjY2Vzc0NvdW50LCAyKTtcblxuICAgIGNvbnN0IHJlc2V0Tm9kZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQ1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX3Jlc2V0X25vZGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWRzOiBbJ25vZGUtcHJlZmFiLTEnLCAnbm9kZS1wcmVmYWItMiddXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzZXROb2RlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzZXROb2RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNldE5vZGVDYWxscy5sZW5ndGgsIDEpO1xuXG4gICAgY29uc3QgcmVzZXRDb21wb25lbnQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0NixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9yZXNldF9jb21wb25lbnQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogJ2NvbXAtMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhyZXNldENvbXBvbmVudCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc2V0Q29tcG9uZW50IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNldENvbXBvbmVudENhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0Lm9rKHJlc3RvcmVDYWxscy5sZW5ndGggPj0gMyk7XG4gICAgYXNzZXJ0Lm9rKHJlc3RvcmVDYWxscy5pbmNsdWRlcygnbm9kZS1wcmVmYWItMScpKTtcbiAgICBhc3NlcnQub2socmVzdG9yZUNhbGxzLmluY2x1ZGVzKCdub2RlLXByZWZhYi0yJykpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0VW5rbm93blRvb2woKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKGFzeW5jICgpID0+IHVuZGVmaW5lZCk7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ25vdC1leGlzdHMnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2socmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEuZXJyb3I/LmNvZGUsIC0zMjYwMik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0TGlzdEFuZFJlYWREb21haW5DYWxscygpO1xuICAgIGF3YWl0IHRlc3RXcml0ZVRvb2xDYWxsKCk7XG4gICAgYXdhaXQgdGVzdExpZmVjeWNsZUFuZFJ1bnRpbWVUb29scygpO1xuICAgIGF3YWl0IHRlc3RTY2VuZVZpZXdUb29scygpO1xuICAgIGF3YWl0IHRlc3RVaUF1dG9tYXRpb25Ub29scygpO1xuICAgIGF3YWl0IHRlc3RBc3NldE1hbmFnZW1lbnRUb29scygpO1xuICAgIGF3YWl0IHRlc3RQcmVmYWJMaWZlY3ljbGVUb29scygpO1xuICAgIGF3YWl0IHRlc3RVbmtub3duVG9vbCgpO1xuICAgIGNvbnNvbGUubG9nKCduZXh0LXJvdXRlci10ZXN0OiBQQVNTJyk7XG59XG5cbnJ1bigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ25leHQtcm91dGVyLXRlc3Q6IEZBSUwnLCBlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=