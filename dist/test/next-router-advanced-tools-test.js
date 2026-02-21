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
        byKey[key] = {
            key,
            channel: key.slice(0, firstDot),
            method: key.slice(firstDot + 1),
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
async function testSceneClipboardAndSaveAsTools() {
    const callLog = [];
    const requester = async (channel, method, ...args) => {
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        callLog.push({ method, args });
        if (method === 'copy-node') {
            return ['node-copy-1'];
        }
        if (method === 'cut-node') {
            return undefined;
        }
        if (method === 'paste-node') {
            return ['node-paste-1'];
        }
        if (method === 'save-as-scene') {
            return 'db://assets/scenes/new-scene.scene';
        }
        throw new Error(`Unexpected method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.copy-node',
        'scene.cut-node',
        'scene.paste-node',
        'scene.save-as-scene'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('scene_copy_game_object'));
    assert.ok(toolNames.includes('scene_cut_game_object'));
    assert.ok(toolNames.includes('scene_paste_game_object'));
    assert.ok(toolNames.includes('scene_save_as_scene'));
    const copy = await router.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'scene_copy_game_object',
            arguments: {
                uuids: 'node-copy-1'
            }
        }
    });
    assert.ok(copy);
    assert.strictEqual(copy.result.isError, false);
    const cut = await router.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
            name: 'scene_cut_game_object',
            arguments: {
                uuids: ['node-cut-1', 'node-cut-2']
            }
        }
    });
    assert.ok(cut);
    assert.strictEqual(cut.result.isError, false);
    const paste = await router.handle({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
            name: 'scene_paste_game_object',
            arguments: {
                targetUuid: 'node-target-1',
                uuids: ['node-copy-1'],
                keepWorldTransform: true
            }
        }
    });
    assert.ok(paste);
    assert.strictEqual(paste.result.isError, false);
    assert.strictEqual(paste.result.structuredContent.data.pastedUuids.length, 1);
    const saveAs = await router.handle({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
            name: 'scene_save_as_scene',
            arguments: {}
        }
    });
    assert.ok(saveAs);
    assert.strictEqual(saveAs.result.isError, false);
    assert.strictEqual(saveAs.result.structuredContent.data.sceneUrl, 'db://assets/scenes/new-scene.scene');
    assert.ok(callLog.some((item) => item.method === 'copy-node'));
    assert.ok(callLog.some((item) => item.method === 'cut-node'));
    assert.ok(callLog.some((item) => item.method === 'paste-node'));
}
async function testComponentAdvancedTools() {
    const dirtyStates = [false, false, false, false, false, false, false];
    let softReloadCalls = 0;
    let spawnCounter = 0;
    const rootChildren = ['node-base-1'];
    const toNode = (uuid) => ({
        uuid: { value: uuid },
        name: { value: uuid },
        children: []
    });
    const toTree = () => ({
        uuid: { value: 'scene-root' },
        name: { value: 'MainScene' },
        children: rootChildren.map((uuid) => toNode(uuid))
    });
    const requester = async (channel, method, ...args) => {
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'query-component') {
            return { uuid: args[0], __type__: { value: 'cc.Label' } };
        }
        if (method === 'query-classes') {
            return [{ name: 'cc.Label' }, { name: 'cc.Sprite' }];
        }
        if (method === 'query-component-has-script') {
            return args[0] === 'cc.Label';
        }
        if (method === 'execute-component-method') {
            const payload = args[0] || {};
            if (payload.name === 'spawnOne') {
                spawnCounter += 1;
                rootChildren.push(`node-spawn-${spawnCounter}`);
            }
            return { success: true, input: args[0] };
        }
        if (method === 'query-node-tree') {
            return toTree();
        }
        if (method === 'query-dirty') {
            if (dirtyStates.length === 0) {
                return false;
            }
            return dirtyStates.shift();
        }
        if (method === 'remove-node') {
            const payload = args[0] || {};
            const uuid = payload.uuid || payload;
            const index = rootChildren.findIndex((item) => item === uuid);
            if (index >= 0) {
                rootChildren.splice(index, 1);
                return true;
            }
            throw new Error(`node not found: ${String(uuid)}`);
        }
        if (method === 'soft-reload') {
            softReloadCalls += 1;
            return true;
        }
        if (method === 'move-array-element') {
            return true;
        }
        if (method === 'remove-array-element') {
            return true;
        }
        if (method === 'reset-property') {
            return true;
        }
        throw new Error(`Unexpected method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.query-component',
        'scene.query-classes',
        'scene.query-component-has-script',
        'scene.execute-component-method',
        'scene.move-array-element',
        'scene.remove-array-element',
        'scene.reset-property'
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
    assert.ok(toolNames.includes('component_get_component_info'));
    assert.ok(toolNames.includes('component_query_classes'));
    assert.ok(toolNames.includes('component_has_script'));
    assert.ok(toolNames.includes('component_execute_method'));
    assert.ok(toolNames.includes('component_move_array_element'));
    assert.ok(toolNames.includes('component_remove_array_element'));
    assert.ok(toolNames.includes('component_reset_property'));
    const queryComponent = await router.handle({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
            name: 'component_get_component_info',
            arguments: {
                componentUuid: 'comp-1'
            }
        }
    });
    assert.ok(queryComponent);
    assert.strictEqual(queryComponent.result.isError, false);
    const execute = await router.handle({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
            name: 'component_execute_method',
            arguments: {
                componentUuid: 'comp-1',
                methodName: 'refresh',
                args: [1, true]
            }
        }
    });
    assert.ok(execute);
    assert.strictEqual(execute.result.isError, false);
    assert.strictEqual(execute.result.structuredContent.data.executed, true);
    const executeWithoutRollbackMutation = await router.handle({
        jsonrpc: '2.0',
        id: 121,
        method: 'tools/call',
        params: {
            name: 'component_execute_method',
            arguments: {
                componentUuid: 'comp-1',
                methodName: 'spawnOne',
                args: []
            }
        }
    });
    assert.ok(executeWithoutRollbackMutation);
    assert.strictEqual(executeWithoutRollbackMutation.result.isError, false);
    assert.strictEqual(executeWithoutRollbackMutation.result.structuredContent.data.rollbackRequested, false);
    assert.strictEqual(executeWithoutRollbackMutation.result.structuredContent.data.sceneMutated, true);
    assert.strictEqual(executeWithoutRollbackMutation.result.structuredContent.data.rollbackApplied, false);
    rootChildren.splice(1);
    const executeWithRollback = await router.handle({
        jsonrpc: '2.0',
        id: 120,
        method: 'tools/call',
        params: {
            name: 'component_execute_method',
            arguments: {
                componentUuid: 'comp-1',
                methodName: 'spawnOne',
                args: [],
                rollbackAfterCall: true
            }
        }
    });
    assert.ok(executeWithRollback);
    assert.strictEqual(executeWithRollback.result.isError, false);
    assert.strictEqual(executeWithRollback.result.structuredContent.data.rollbackRequested, true);
    assert.strictEqual(executeWithRollback.result.structuredContent.data.rollbackApplied, true);
    assert.strictEqual(executeWithRollback.result.structuredContent.data.rollbackMethod, 'remove-node');
    assert.strictEqual(executeWithRollback.result.structuredContent.data.rollbackVerified, true);
    assert.strictEqual(executeWithRollback.result.structuredContent.data.sceneMutated, true);
    assert.strictEqual(executeWithRollback.result.structuredContent.data.requiresSave, false);
    assert.strictEqual(softReloadCalls, 0);
    assert.deepStrictEqual(rootChildren, ['node-base-1']);
    const reset = await router.handle({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
            name: 'component_reset_property',
            arguments: {
                uuid: 'node-1',
                path: '__comps__.0.string',
                value: 'default'
            }
        }
    });
    assert.ok(reset);
    assert.strictEqual(reset.result.isError, false);
}
async function testAssetExtendedTools() {
    const requester = async (channel, method, ...args) => {
        if (channel !== 'asset-db') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'generate-available-url') {
            return `${args[0]}.001`;
        }
        if (method === 'query-asset-meta') {
            return { uuid: 'meta-1', userData: {} };
        }
        if (method === 'query-missing-asset-info') {
            return { missing: true, url: args[0] };
        }
        if (method === 'create-asset') {
            return { uuid: 'asset-new-1', url: args[0] };
        }
        if (method === 'import-asset') {
            return { uuid: 'asset-import-1', url: args[1] };
        }
        if (method === 'save-asset') {
            return { uuid: 'asset-save-1', url: args[0] };
        }
        if (method === 'save-asset-meta') {
            return { uuid: 'asset-save-meta-1', url: args[0] };
        }
        throw new Error(`Unexpected method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'asset-db.generate-available-url',
        'asset-db.query-asset-meta',
        'asset-db.query-missing-asset-info',
        'asset-db.create-asset',
        'asset-db.import-asset',
        'asset-db.save-asset',
        'asset-db.save-asset-meta'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const createAsset = await router.handle({
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: {
            name: 'asset_create_asset',
            arguments: {
                url: 'db://assets/data/config.json',
                content: '{\"ok\":true}'
            }
        }
    });
    assert.ok(createAsset);
    assert.strictEqual(createAsset.result.isError, false);
    const importAsset = await router.handle({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
            name: 'asset_import_asset',
            arguments: {
                sourcePath: '/tmp/a.png',
                targetUrl: 'db://assets/textures/a.png'
            }
        }
    });
    assert.ok(importAsset);
    assert.strictEqual(importAsset.result.isError, false);
    const saveMeta = await router.handle({
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: {
            name: 'asset_save_asset_meta',
            arguments: {
                url: 'db://assets/data/config.json',
                meta: {
                    userData: {
                        source: 'test'
                    }
                }
            }
        }
    });
    assert.ok(saveMeta);
    assert.strictEqual(saveMeta.result.isError, false);
}
async function testEditorIntegrationTools() {
    const callLog = [];
    const requester = async (channel, method, ...args) => {
        callLog.push({ channel, method, args });
        if (channel === 'project' && method === 'open-settings') {
            return undefined;
        }
        if (channel === 'project' && method === 'set-config') {
            return true;
        }
        if (channel === 'preferences' && method === 'open-settings') {
            return undefined;
        }
        if (channel === 'preferences' && method === 'set-config') {
            return true;
        }
        if (channel === 'scene' && method === 'is-native') {
            return true;
        }
        if (channel === 'information' && method === 'open-information-dialog') {
            return { action: 'confirm' };
        }
        if (channel === 'information' && method === 'has-dialog') {
            return true;
        }
        if (channel === 'information' && method === 'close-dialog') {
            return undefined;
        }
        if (channel === 'program' && method === 'open-program') {
            return true;
        }
        if (channel === 'program' && method === 'open-url') {
            return true;
        }
        throw new Error(`Unexpected call: ${channel}.${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'project.open-settings',
        'project.set-config',
        'preferences.open-settings',
        'preferences.set-config',
        'scene.is-native',
        'information.open-information-dialog',
        'information.has-dialog',
        'information.close-dialog',
        'program.open-program',
        'program.open-url'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse.result.tools.map((item) => item.name);
    assert.ok(toolNames.includes('project_open_settings'));
    assert.ok(toolNames.includes('project_set_config'));
    assert.ok(toolNames.includes('preferences_open_settings'));
    assert.ok(toolNames.includes('preferences_set_config'));
    assert.ok(toolNames.includes('scene_query_is_native'));
    assert.ok(toolNames.includes('information_open_dialog'));
    assert.ok(toolNames.includes('information_has_dialog'));
    assert.ok(toolNames.includes('information_close_dialog'));
    assert.ok(toolNames.includes('program_open_program'));
    assert.ok(toolNames.includes('program_open_url'));
    const projectSettings = await router.handle({
        jsonrpc: '2.0',
        id: 31,
        method: 'tools/call',
        params: {
            name: 'project_open_settings',
            arguments: {
                tab: 'project',
                subTab: 'engine',
                args: ['physics']
            }
        }
    });
    assert.ok(projectSettings);
    assert.strictEqual(projectSettings.result.isError, false);
    const queryNative = await router.handle({
        jsonrpc: '2.0',
        id: 32,
        method: 'tools/call',
        params: {
            name: 'scene_query_is_native',
            arguments: {
                checkAvailable: true
            }
        }
    });
    assert.ok(queryNative);
    assert.strictEqual(queryNative.result.isError, false);
    assert.strictEqual(queryNative.result.structuredContent.data.isNative, true);
    const openUrl = await router.handle({
        jsonrpc: '2.0',
        id: 33,
        method: 'tools/call',
        params: {
            name: 'program_open_url',
            arguments: {
                url: 'https://example.com'
            }
        }
    });
    assert.ok(openUrl);
    assert.strictEqual(openUrl.result.isError, false);
    assert.strictEqual(openUrl.result.structuredContent.data.opened, true);
    assert.ok(callLog.some((item) => item.channel === 'program' && item.method === 'open-url'));
}
async function testPrefabLinkFallbackByReplacement() {
    const nodes = new Map();
    nodes.set('root', {
        uuid: 'root',
        name: 'Root',
        parentUuid: null,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        children: ['old-node'],
        prefab: null
    });
    nodes.set('old-node', {
        uuid: 'old-node',
        name: 'OldNode',
        parentUuid: 'root',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 10, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        children: ['old-child'],
        prefab: null
    });
    nodes.set('old-child', {
        uuid: 'old-child',
        name: 'OldChild',
        parentUuid: 'old-node',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        children: [],
        prefab: null
    });
    let counter = 0;
    function makeNodeDump(node) {
        const parent = node.parentUuid
            ? { value: { uuid: node.parentUuid }, type: 'cc.Node' }
            : { value: null, type: 'cc.Node' };
        const dump = {
            name: { value: node.name, type: 'String' },
            parent,
            position: { value: node.position, type: 'cc.Vec3' },
            rotation: { value: node.rotation, type: 'cc.Vec3' },
            scale: { value: node.scale, type: 'cc.Vec3' },
            children: node.children.map((uuid) => ({ uuid }))
        };
        if (node.prefab) {
            dump.prefab = {
                state: { value: node.prefab.state },
                assetUuid: { value: node.prefab.assetUuid }
            };
        }
        return dump;
    }
    const requester = async (channel, method, ...args) => {
        var _a, _b;
        if (channel !== 'scene') {
            throw new Error(`Unexpected channel: ${channel}`);
        }
        if (method === 'query-node') {
            const node = nodes.get(args[0]);
            if (!node) {
                throw new Error(`Node not found: ${args[0]}`);
            }
            return makeNodeDump(node);
        }
        if (method === 'link-prefab') {
            // 模拟 3.8.8 的“调用不报错，但不会把节点变成 Prefab 实例”
            return true;
        }
        if (method === 'create-node') {
            const options = args[0] || {};
            counter += 1;
            const uuid = `replacement-${counter}`;
            const parentUuid = options.parent || 'root';
            const parentNode = nodes.get(parentUuid);
            if (!parentNode) {
                throw new Error(`Parent not found: ${parentUuid}`);
            }
            nodes.set(uuid, {
                uuid,
                name: options.name || uuid,
                parentUuid,
                position: options.position || { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                children: [],
                prefab: {
                    state: 1,
                    assetUuid: typeof options.assetUuid === 'string'
                        ? options.assetUuid
                        : (_a = options.assetUuid) === null || _a === void 0 ? void 0 : _a.value
                }
            });
            parentNode.children.push(uuid);
            return uuid;
        }
        if (method === 'set-property') {
            const payload = args[0];
            const node = nodes.get(payload.uuid);
            if (!node) {
                throw new Error(`Node not found: ${payload.uuid}`);
            }
            const value = (_b = payload === null || payload === void 0 ? void 0 : payload.dump) === null || _b === void 0 ? void 0 : _b.value;
            if (payload.path === 'rotation' && value) {
                node.rotation = value;
            }
            if (payload.path === 'scale' && value) {
                node.scale = value;
            }
            return true;
        }
        if (method === 'set-parent') {
            const payload = args[0];
            const parentUuid = payload.parent;
            const uuids = Array.isArray(payload.uuids) ? payload.uuids : [payload.uuids];
            const parentNode = nodes.get(parentUuid);
            if (!parentNode) {
                throw new Error(`Parent not found: ${parentUuid}`);
            }
            for (const uuid of uuids) {
                const node = nodes.get(uuid);
                if (!node) {
                    continue;
                }
                if (node.parentUuid) {
                    const oldParent = nodes.get(node.parentUuid);
                    if (oldParent) {
                        oldParent.children = oldParent.children.filter((item) => item !== uuid);
                    }
                }
                node.parentUuid = parentUuid;
                if (!parentNode.children.includes(uuid)) {
                    parentNode.children.push(uuid);
                }
            }
            return uuids;
        }
        if (method === 'remove-node') {
            const payload = args[0];
            const uuid = payload === null || payload === void 0 ? void 0 : payload.uuid;
            const target = nodes.get(uuid);
            if (!target) {
                return true;
            }
            if (target.parentUuid) {
                const parent = nodes.get(target.parentUuid);
                if (parent) {
                    parent.children = parent.children.filter((item) => item !== uuid);
                }
            }
            nodes.delete(uuid);
            return true;
        }
        throw new Error(`Unexpected method: ${method}`);
    };
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.link-prefab',
        'scene.query-node'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    const response = await router.handle({
        jsonrpc: '2.0',
        id: 50,
        method: 'tools/call',
        params: {
            name: 'prefab_link_node_to_asset',
            arguments: {
                nodeUuid: 'old-node',
                assetUuid: 'asset-prefab-fallback'
            }
        }
    });
    assert.ok(response);
    assert.strictEqual(response.result.isError, false);
    assert.strictEqual(response.result.structuredContent.data.replaced, true);
    assert.strictEqual(response.result.structuredContent.data.originalNodeUuid, 'old-node');
    assert.ok(typeof response.result.structuredContent.data.nodeUuid === 'string');
    assert.notStrictEqual(response.result.structuredContent.data.nodeUuid, 'old-node');
}
async function run() {
    await testSceneClipboardAndSaveAsTools();
    await testComponentAdvancedTools();
    await testAssetExtendedTools();
    await testEditorIntegrationTools();
    await testPrefabLinkFallbackByReplacement();
    console.log('next-router-advanced-tools-test: PASS');
}
run().catch((error) => {
    console.error('next-router-advanced-tools-test: FAIL', error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1yb3V0ZXItYWR2YW5jZWQtdG9vbHMtdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcm91dGVyLWFkdmFuY2VkLXRvb2xzLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUM7WUFDL0IsTUFBTSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztZQUMvQixLQUFLLEVBQUUsVUFBVTtZQUNqQixRQUFRLEVBQUUsSUFBSTtZQUNkLFdBQVcsRUFBRSxHQUFHO1lBQ2hCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1lBQ25DLE1BQU0sRUFBRSxJQUFJO1NBQ2YsQ0FBQztJQUNOLENBQUM7SUFFRCxPQUFPO1FBQ0gsV0FBVyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1FBQ3JDLEtBQUs7UUFDTCxPQUFPLEVBQUU7WUFDTCxLQUFLLEVBQUUsYUFBYSxDQUFDLE1BQU07WUFDM0IsU0FBUyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQy9CLFdBQVcsRUFBRSxDQUFDO1lBQ2QsT0FBTyxF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QUFDO0lBQy9CLE1BQU0sMEJBQTBCLEVBQUUsQ0FBQztJQUNuQyxNQUFNLG1DQUFtQyxFQUFFLENBQUM7SUFDNUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0FBQ3pELENBQUM7QUFFRCxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzlELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhcGFiaWxpdHlNYXRyaXggfSBmcm9tICcuLi9uZXh0L21vZGVscyc7XG5pbXBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmltcG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3JvdXRlcic7XG5pbXBvcnQgeyBjcmVhdGVPZmZpY2lhbFRvb2xzIH0gZnJvbSAnLi4vbmV4dC90b29scy9vZmZpY2lhbC10b29scyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdHJpeChhdmFpbGFibGVLZXlzOiBzdHJpbmdbXSk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIGNvbnN0IGJ5S2V5OiBDYXBhYmlsaXR5TWF0cml4WydieUtleSddID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgb2YgYXZhaWxhYmxlS2V5cykge1xuICAgICAgICBjb25zdCBmaXJzdERvdCA9IGtleS5pbmRleE9mKCcuJyk7XG4gICAgICAgIGJ5S2V5W2tleV0gPSB7XG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICBjaGFubmVsOiBrZXkuc2xpY2UoMCwgZmlyc3REb3QpLFxuICAgICAgICAgICAgbWV0aG9kOiBrZXkuc2xpY2UoZmlyc3REb3QgKyAxKSxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjoga2V5LFxuICAgICAgICAgICAgYXZhaWxhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBkZXRhaWw6ICdvaydcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBieUtleSxcbiAgICAgICAgc3VtbWFyeToge1xuICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHVuYXZhaWxhYmxlOiAwLFxuICAgICAgICAgICAgYnlMYXllcjoge1xuICAgICAgICAgICAgICAgIG9mZmljaWFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXh0ZW5kZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0U2NlbmVDbGlwYm9hcmRBbmRTYXZlQXNUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjYWxsTG9nOiBBcnJheTx7IG1ldGhvZDogc3RyaW5nOyBhcmdzOiBhbnlbXSB9PiA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdzY2VuZScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbExvZy5wdXNoKHsgbWV0aG9kLCBhcmdzIH0pO1xuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjb3B5LW5vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gWydub2RlLWNvcHktMSddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjdXQtbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Bhc3RlLW5vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gWydub2RlLXBhc3RlLTEnXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2F2ZS1hcy1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGI6Ly9hc3NldHMvc2NlbmVzL25ldy1zY2VuZS5zY2VuZSc7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLmNvcHktbm9kZScsXG4gICAgICAgICdzY2VuZS5jdXQtbm9kZScsXG4gICAgICAgICdzY2VuZS5wYXN0ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnNhdmUtYXMtc2NlbmUnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2NvcHlfZ2FtZV9vYmplY3QnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfY3V0X2dhbWVfb2JqZWN0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3Bhc3RlX2dhbWVfb2JqZWN0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3NhdmVfYXNfc2NlbmUnKSk7XG5cbiAgICBjb25zdCBjb3B5ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2NvcHlfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXVpZHM6ICdub2RlLWNvcHktMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhjb3B5KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY29weSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGN1dCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9jdXRfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXVpZHM6IFsnbm9kZS1jdXQtMScsICdub2RlLWN1dC0yJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhjdXQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjdXQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBwYXN0ZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9wYXN0ZV9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRVdWlkOiAnbm9kZS10YXJnZXQtMScsXG4gICAgICAgICAgICAgICAgdXVpZHM6IFsnbm9kZS1jb3B5LTEnXSxcbiAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhwYXN0ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHBhc3RlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChwYXN0ZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucGFzdGVkVXVpZHMubGVuZ3RoLCAxKTtcblxuICAgIGNvbnN0IHNhdmVBcyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDUsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9zYXZlX2FzX3NjZW5lJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzYXZlQXMpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzYXZlQXMhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVBcyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc2NlbmVVcmwsICdkYjovL2Fzc2V0cy9zY2VuZXMvbmV3LXNjZW5lLnNjZW5lJyk7XG5cbiAgICBhc3NlcnQub2soY2FsbExvZy5zb21lKChpdGVtKSA9PiBpdGVtLm1ldGhvZCA9PT0gJ2NvcHktbm9kZScpKTtcbiAgICBhc3NlcnQub2soY2FsbExvZy5zb21lKChpdGVtKSA9PiBpdGVtLm1ldGhvZCA9PT0gJ2N1dC1ub2RlJykpO1xuICAgIGFzc2VydC5vayhjYWxsTG9nLnNvbWUoKGl0ZW0pID0+IGl0ZW0ubWV0aG9kID09PSAncGFzdGUtbm9kZScpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdENvbXBvbmVudEFkdmFuY2VkVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZGlydHlTdGF0ZXMgPSBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdO1xuICAgIGxldCBzb2Z0UmVsb2FkQ2FsbHMgPSAwO1xuICAgIGxldCBzcGF3bkNvdW50ZXIgPSAwO1xuICAgIGNvbnN0IHJvb3RDaGlsZHJlbiA9IFsnbm9kZS1iYXNlLTEnXTtcblxuICAgIGNvbnN0IHRvTm9kZSA9ICh1dWlkOiBzdHJpbmcpOiBhbnkgPT4gKHtcbiAgICAgICAgdXVpZDogeyB2YWx1ZTogdXVpZCB9LFxuICAgICAgICBuYW1lOiB7IHZhbHVlOiB1dWlkIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbXVxuICAgIH0pO1xuXG4gICAgY29uc3QgdG9UcmVlID0gKCk6IGFueSA9PiAoe1xuICAgICAgICB1dWlkOiB7IHZhbHVlOiAnc2NlbmUtcm9vdCcgfSxcbiAgICAgICAgbmFtZTogeyB2YWx1ZTogJ01haW5TY2VuZScgfSxcbiAgICAgICAgY2hpbGRyZW46IHJvb3RDaGlsZHJlbi5tYXAoKHV1aWQpID0+IHRvTm9kZSh1dWlkKSlcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsICE9PSAnc2NlbmUnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2hhbm5lbDogJHtjaGFubmVsfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWNvbXBvbmVudCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6IGFyZ3NbMF0sIF9fdHlwZV9fOiB7IHZhbHVlOiAnY2MuTGFiZWwnIH0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktY2xhc3NlcycpIHtcbiAgICAgICAgICAgIHJldHVybiBbeyBuYW1lOiAnY2MuTGFiZWwnIH0sIHsgbmFtZTogJ2NjLlNwcml0ZScgfV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWNvbXBvbmVudC1oYXMtc2NyaXB0Jykge1xuICAgICAgICAgICAgcmV0dXJuIGFyZ3NbMF0gPT09ICdjYy5MYWJlbCc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2V4ZWN1dGUtY29tcG9uZW50LW1ldGhvZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBhcmdzWzBdIHx8IHt9O1xuICAgICAgICAgICAgaWYgKHBheWxvYWQubmFtZSA9PT0gJ3NwYXduT25lJykge1xuICAgICAgICAgICAgICAgIHNwYXduQ291bnRlciArPSAxO1xuICAgICAgICAgICAgICAgIHJvb3RDaGlsZHJlbi5wdXNoKGBub2RlLXNwYXduLSR7c3Bhd25Db3VudGVyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgaW5wdXQ6IGFyZ3NbMF0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZS10cmVlJykge1xuICAgICAgICAgICAgcmV0dXJuIHRvVHJlZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1kaXJ0eScpIHtcbiAgICAgICAgICAgIGlmIChkaXJ0eVN0YXRlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlydHlTdGF0ZXMuc2hpZnQoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVtb3ZlLW5vZGUnKSB7XG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gYXJnc1swXSB8fCB7fTtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBwYXlsb2FkLnV1aWQgfHwgcGF5bG9hZDtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gcm9vdENoaWxkcmVuLmZpbmRJbmRleCgoaXRlbSkgPT4gaXRlbSA9PT0gdXVpZCk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHJvb3RDaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBub2RlIG5vdCBmb3VuZDogJHtTdHJpbmcodXVpZCl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NvZnQtcmVsb2FkJykge1xuICAgICAgICAgICAgc29mdFJlbG9hZENhbGxzICs9IDE7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnbW92ZS1hcnJheS1lbGVtZW50Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlbW92ZS1hcnJheS1lbGVtZW50Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Jlc2V0LXByb3BlcnR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudCcsXG4gICAgICAgICdzY2VuZS5xdWVyeS1jbGFzc2VzJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudC1oYXMtc2NyaXB0JyxcbiAgICAgICAgJ3NjZW5lLmV4ZWN1dGUtY29tcG9uZW50LW1ldGhvZCcsXG4gICAgICAgICdzY2VuZS5tb3ZlLWFycmF5LWVsZW1lbnQnLFxuICAgICAgICAnc2NlbmUucmVtb3ZlLWFycmF5LWVsZW1lbnQnLFxuICAgICAgICAnc2NlbmUucmVzZXQtcHJvcGVydHknXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdjb21wb25lbnRfZ2V0X2NvbXBvbmVudF9pbmZvJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9xdWVyeV9jbGFzc2VzJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9oYXNfc2NyaXB0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9leGVjdXRlX21ldGhvZCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdjb21wb25lbnRfbW92ZV9hcnJheV9lbGVtZW50JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9yZW1vdmVfYXJyYXlfZWxlbWVudCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdjb21wb25lbnRfcmVzZXRfcHJvcGVydHknKSk7XG5cbiAgICBjb25zdCBxdWVyeUNvbXBvbmVudCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDExLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2dldF9jb21wb25lbnRfaW5mbycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkOiAnY29tcC0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5Q29tcG9uZW50KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlDb21wb25lbnQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBleGVjdXRlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfZXhlY3V0ZV9tZXRob2QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogJ2NvbXAtMScsXG4gICAgICAgICAgICAgICAgbWV0aG9kTmFtZTogJ3JlZnJlc2gnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFsxLCB0cnVlXVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGV4ZWN1dGUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChleGVjdXRlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChleGVjdXRlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5leGVjdXRlZCwgdHJ1ZSk7XG5cbiAgICBjb25zdCBleGVjdXRlV2l0aG91dFJvbGxiYWNrTXV0YXRpb24gPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMjEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfZXhlY3V0ZV9tZXRob2QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogJ2NvbXAtMScsXG4gICAgICAgICAgICAgICAgbWV0aG9kTmFtZTogJ3NwYXduT25lJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbXVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGV4ZWN1dGVXaXRob3V0Um9sbGJhY2tNdXRhdGlvbik7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVXaXRob3V0Um9sbGJhY2tNdXRhdGlvbiEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZXhlY3V0ZVdpdGhvdXRSb2xsYmFja011dGF0aW9uIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5yb2xsYmFja1JlcXVlc3RlZCwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChleGVjdXRlV2l0aG91dFJvbGxiYWNrTXV0YXRpb24hLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnNjZW5lTXV0YXRlZCwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVXaXRob3V0Um9sbGJhY2tNdXRhdGlvbiEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucm9sbGJhY2tBcHBsaWVkLCBmYWxzZSk7XG4gICAgcm9vdENoaWxkcmVuLnNwbGljZSgxKTtcblxuICAgIGNvbnN0IGV4ZWN1dGVXaXRoUm9sbGJhY2sgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMjAsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfZXhlY3V0ZV9tZXRob2QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogJ2NvbXAtMScsXG4gICAgICAgICAgICAgICAgbWV0aG9kTmFtZTogJ3NwYXduT25lJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgICAgICAgICByb2xsYmFja0FmdGVyQ2FsbDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGV4ZWN1dGVXaXRoUm9sbGJhY2spO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChleGVjdXRlV2l0aFJvbGxiYWNrIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChleGVjdXRlV2l0aFJvbGxiYWNrIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5yb2xsYmFja1JlcXVlc3RlZCwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVXaXRoUm9sbGJhY2shLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJvbGxiYWNrQXBwbGllZCwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVXaXRoUm9sbGJhY2shLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJvbGxiYWNrTWV0aG9kLCAncmVtb3ZlLW5vZGUnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZXhlY3V0ZVdpdGhSb2xsYmFjayEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucm9sbGJhY2tWZXJpZmllZCwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVXaXRoUm9sbGJhY2shLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnNjZW5lTXV0YXRlZCwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVXaXRoUm9sbGJhY2shLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJlcXVpcmVzU2F2ZSwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzb2Z0UmVsb2FkQ2FsbHMsIDApO1xuICAgIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocm9vdENoaWxkcmVuLCBbJ25vZGUtYmFzZS0xJ10pO1xuXG4gICAgY29uc3QgcmVzZXQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9yZXNldF9wcm9wZXJ0eScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkOiAnbm9kZS0xJyxcbiAgICAgICAgICAgICAgICBwYXRoOiAnX19jb21wc19fLjAuc3RyaW5nJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogJ2RlZmF1bHQnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzZXQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNldCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdEFzc2V0RXh0ZW5kZWRUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ2Fzc2V0LWRiJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdnZW5lcmF0ZS1hdmFpbGFibGUtdXJsJykge1xuICAgICAgICAgICAgcmV0dXJuIGAke2FyZ3NbMF19LjAwMWA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWFzc2V0LW1ldGEnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiAnbWV0YS0xJywgdXNlckRhdGE6IHt9IH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LW1pc3NpbmctYXNzZXQtaW5mbycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG1pc3Npbmc6IHRydWUsIHVybDogYXJnc1swXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiAnYXNzZXQtbmV3LTEnLCB1cmw6IGFyZ3NbMF0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnaW1wb3J0LWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogJ2Fzc2V0LWltcG9ydC0xJywgdXJsOiBhcmdzWzFdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NhdmUtYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiAnYXNzZXQtc2F2ZS0xJywgdXJsOiBhcmdzWzBdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NhdmUtYXNzZXQtbWV0YScpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6ICdhc3NldC1zYXZlLW1ldGEtMScsIHVybDogYXJnc1swXSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdhc3NldC1kYi5nZW5lcmF0ZS1hdmFpbGFibGUtdXJsJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LW1ldGEnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktbWlzc2luZy1hc3NldC1pbmZvJyxcbiAgICAgICAgJ2Fzc2V0LWRiLmNyZWF0ZS1hc3NldCcsXG4gICAgICAgICdhc3NldC1kYi5pbXBvcnQtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIuc2F2ZS1hc3NldCcsXG4gICAgICAgICdhc3NldC1kYi5zYXZlLWFzc2V0LW1ldGEnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBjcmVhdGVBc3NldCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfY3JlYXRlX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybDogJ2RiOi8vYXNzZXRzL2RhdGEvY29uZmlnLmpzb24nLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICd7XFxcIm9rXFxcIjp0cnVlfSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhjcmVhdGVBc3NldCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZUFzc2V0IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgaW1wb3J0QXNzZXQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X2ltcG9ydF9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBzb3VyY2VQYXRoOiAnL3RtcC9hLnBuZycsXG4gICAgICAgICAgICAgICAgdGFyZ2V0VXJsOiAnZGI6Ly9hc3NldHMvdGV4dHVyZXMvYS5wbmcnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soaW1wb3J0QXNzZXQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbXBvcnRBc3NldCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHNhdmVNZXRhID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9zYXZlX2Fzc2V0X21ldGEnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsOiAnZGI6Ly9hc3NldHMvZGF0YS9jb25maWcuanNvbicsXG4gICAgICAgICAgICAgICAgbWV0YToge1xuICAgICAgICAgICAgICAgICAgICB1c2VyRGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiAndGVzdCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzYXZlTWV0YSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVNZXRhIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0RWRpdG9ySW50ZWdyYXRpb25Ub29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjYWxsTG9nOiBBcnJheTx7IGNoYW5uZWw6IHN0cmluZzsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdIH0+ID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBjYWxsTG9nLnB1c2goeyBjaGFubmVsLCBtZXRob2QsIGFyZ3MgfSk7XG5cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcm9qZWN0JyAmJiBtZXRob2QgPT09ICdvcGVuLXNldHRpbmdzJykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3Byb2plY3QnICYmIG1ldGhvZCA9PT0gJ3NldC1jb25maWcnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3ByZWZlcmVuY2VzJyAmJiBtZXRob2QgPT09ICdvcGVuLXNldHRpbmdzJykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3ByZWZlcmVuY2VzJyAmJiBtZXRob2QgPT09ICdzZXQtY29uZmlnJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnaXMtbmF0aXZlJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdpbmZvcm1hdGlvbicgJiYgbWV0aG9kID09PSAnb3Blbi1pbmZvcm1hdGlvbi1kaWFsb2cnKSB7XG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdjb25maXJtJyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnaW5mb3JtYXRpb24nICYmIG1ldGhvZCA9PT0gJ2hhcy1kaWFsb2cnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2luZm9ybWF0aW9uJyAmJiBtZXRob2QgPT09ICdjbG9zZS1kaWFsb2cnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvZ3JhbScgJiYgbWV0aG9kID09PSAnb3Blbi1wcm9ncmFtJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcm9ncmFtJyAmJiBtZXRob2QgPT09ICdvcGVuLXVybCcpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhbGw6ICR7Y2hhbm5lbH0uJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdwcm9qZWN0Lm9wZW4tc2V0dGluZ3MnLFxuICAgICAgICAncHJvamVjdC5zZXQtY29uZmlnJyxcbiAgICAgICAgJ3ByZWZlcmVuY2VzLm9wZW4tc2V0dGluZ3MnLFxuICAgICAgICAncHJlZmVyZW5jZXMuc2V0LWNvbmZpZycsXG4gICAgICAgICdzY2VuZS5pcy1uYXRpdmUnLFxuICAgICAgICAnaW5mb3JtYXRpb24ub3Blbi1pbmZvcm1hdGlvbi1kaWFsb2cnLFxuICAgICAgICAnaW5mb3JtYXRpb24uaGFzLWRpYWxvZycsXG4gICAgICAgICdpbmZvcm1hdGlvbi5jbG9zZS1kaWFsb2cnLFxuICAgICAgICAncHJvZ3JhbS5vcGVuLXByb2dyYW0nLFxuICAgICAgICAncHJvZ3JhbS5vcGVuLXVybCdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3Byb2plY3Rfb3Blbl9zZXR0aW5ncycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcm9qZWN0X3NldF9jb25maWcnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmVyZW5jZXNfb3Blbl9zZXR0aW5ncycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmZXJlbmNlc19zZXRfY29uZmlnJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3F1ZXJ5X2lzX25hdGl2ZScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdpbmZvcm1hdGlvbl9vcGVuX2RpYWxvZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdpbmZvcm1hdGlvbl9oYXNfZGlhbG9nJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2luZm9ybWF0aW9uX2Nsb3NlX2RpYWxvZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcm9ncmFtX29wZW5fcHJvZ3JhbScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcm9ncmFtX29wZW5fdXJsJykpO1xuXG4gICAgY29uc3QgcHJvamVjdFNldHRpbmdzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdwcm9qZWN0X29wZW5fc2V0dGluZ3MnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdGFiOiAncHJvamVjdCcsXG4gICAgICAgICAgICAgICAgc3ViVGFiOiAnZW5naW5lJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbJ3BoeXNpY3MnXVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHByb2plY3RTZXR0aW5ncyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHByb2plY3RTZXR0aW5ncyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHF1ZXJ5TmF0aXZlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9xdWVyeV9pc19uYXRpdmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgY2hlY2tBdmFpbGFibGU6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeU5hdGl2ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5TmF0aXZlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeU5hdGl2ZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuaXNOYXRpdmUsIHRydWUpO1xuXG4gICAgY29uc3Qgb3BlblVybCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJvZ3JhbV9vcGVuX3VybCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmw6ICdodHRwczovL2V4YW1wbGUuY29tJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKG9wZW5VcmwpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuVXJsIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuVXJsIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5vcGVuZWQsIHRydWUpO1xuXG4gICAgYXNzZXJ0Lm9rKGNhbGxMb2cuc29tZSgoaXRlbSkgPT4gaXRlbS5jaGFubmVsID09PSAncHJvZ3JhbScgJiYgaXRlbS5tZXRob2QgPT09ICdvcGVuLXVybCcpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdFByZWZhYkxpbmtGYWxsYmFja0J5UmVwbGFjZW1lbnQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaW50ZXJmYWNlIE1vY2tOb2RlIHtcbiAgICAgICAgdXVpZDogc3RyaW5nO1xuICAgICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICAgIHBhcmVudFV1aWQ6IHN0cmluZyB8IG51bGw7XG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6OiBudW1iZXIgfTtcbiAgICAgICAgcm90YXRpb246IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlciB9O1xuICAgICAgICBzY2FsZTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyIH07XG4gICAgICAgIGNoaWxkcmVuOiBzdHJpbmdbXTtcbiAgICAgICAgcHJlZmFiOiBudWxsIHwge1xuICAgICAgICAgICAgc3RhdGU6IG51bWJlcjtcbiAgICAgICAgICAgIGFzc2V0VXVpZDogc3RyaW5nO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVzID0gbmV3IE1hcDxzdHJpbmcsIE1vY2tOb2RlPigpO1xuICAgIG5vZGVzLnNldCgncm9vdCcsIHtcbiAgICAgICAgdXVpZDogJ3Jvb3QnLFxuICAgICAgICBuYW1lOiAnUm9vdCcsXG4gICAgICAgIHBhcmVudFV1aWQ6IG51bGwsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgcm90YXRpb246IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICBzY2FsZTogeyB4OiAxLCB5OiAxLCB6OiAxIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbJ29sZC1ub2RlJ10sXG4gICAgICAgIHByZWZhYjogbnVsbFxuICAgIH0pO1xuICAgIG5vZGVzLnNldCgnb2xkLW5vZGUnLCB7XG4gICAgICAgIHV1aWQ6ICdvbGQtbm9kZScsXG4gICAgICAgIG5hbWU6ICdPbGROb2RlJyxcbiAgICAgICAgcGFyZW50VXVpZDogJ3Jvb3QnLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAxLCB5OiAyLCB6OiAzIH0sXG4gICAgICAgIHJvdGF0aW9uOiB7IHg6IDAsIHk6IDEwLCB6OiAwIH0sXG4gICAgICAgIHNjYWxlOiB7IHg6IDEsIHk6IDEsIHo6IDEgfSxcbiAgICAgICAgY2hpbGRyZW46IFsnb2xkLWNoaWxkJ10sXG4gICAgICAgIHByZWZhYjogbnVsbFxuICAgIH0pO1xuICAgIG5vZGVzLnNldCgnb2xkLWNoaWxkJywge1xuICAgICAgICB1dWlkOiAnb2xkLWNoaWxkJyxcbiAgICAgICAgbmFtZTogJ09sZENoaWxkJyxcbiAgICAgICAgcGFyZW50VXVpZDogJ29sZC1ub2RlJyxcbiAgICAgICAgcG9zaXRpb246IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICByb3RhdGlvbjogeyB4OiAwLCB5OiAwLCB6OiAwIH0sXG4gICAgICAgIHNjYWxlOiB7IHg6IDEsIHk6IDEsIHo6IDEgfSxcbiAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICBwcmVmYWI6IG51bGxcbiAgICB9KTtcblxuICAgIGxldCBjb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIG1ha2VOb2RlRHVtcChub2RlOiBNb2NrTm9kZSk6IGFueSB7XG4gICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGUucGFyZW50VXVpZFxuICAgICAgICAgICAgPyB7IHZhbHVlOiB7IHV1aWQ6IG5vZGUucGFyZW50VXVpZCB9LCB0eXBlOiAnY2MuTm9kZScgfVxuICAgICAgICAgICAgOiB7IHZhbHVlOiBudWxsLCB0eXBlOiAnY2MuTm9kZScgfTtcbiAgICAgICAgY29uc3QgZHVtcDogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgIG5hbWU6IHsgdmFsdWU6IG5vZGUubmFtZSwgdHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICAgIHBhcmVudCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7IHZhbHVlOiBub2RlLnBvc2l0aW9uLCB0eXBlOiAnY2MuVmVjMycgfSxcbiAgICAgICAgICAgIHJvdGF0aW9uOiB7IHZhbHVlOiBub2RlLnJvdGF0aW9uLCB0eXBlOiAnY2MuVmVjMycgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7IHZhbHVlOiBub2RlLnNjYWxlLCB0eXBlOiAnY2MuVmVjMycgfSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBub2RlLmNoaWxkcmVuLm1hcCgodXVpZCkgPT4gKHsgdXVpZCB9KSlcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAobm9kZS5wcmVmYWIpIHtcbiAgICAgICAgICAgIGR1bXAucHJlZmFiID0ge1xuICAgICAgICAgICAgICAgIHN0YXRlOiB7IHZhbHVlOiBub2RlLnByZWZhYi5zdGF0ZSB9LFxuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogeyB2YWx1ZTogbm9kZS5wcmVmYWIuYXNzZXRVdWlkIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZHVtcDtcbiAgICB9XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ3NjZW5lJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1ub2RlJykge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzLmdldChhcmdzWzBdKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSBub3QgZm91bmQ6ICR7YXJnc1swXX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtYWtlTm9kZUR1bXAobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAnbGluay1wcmVmYWInKSB7XG4gICAgICAgICAgICAvLyDmqKHmi58gMy44Ljgg55qE4oCc6LCD55So5LiN5oql6ZSZ77yM5L2G5LiN5Lya5oqK6IqC54K55Y+Y5oiQIFByZWZhYiDlrp7kvovigJ1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NyZWF0ZS1ub2RlJykge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IGFyZ3NbMF0gfHwge307XG4gICAgICAgICAgICBjb3VudGVyICs9IDE7XG4gICAgICAgICAgICBjb25zdCB1dWlkID0gYHJlcGxhY2VtZW50LSR7Y291bnRlcn1gO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IG9wdGlvbnMucGFyZW50IHx8ICdyb290JztcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSBub2Rlcy5nZXQocGFyZW50VXVpZCk7XG4gICAgICAgICAgICBpZiAoIXBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCBub3QgZm91bmQ6ICR7cGFyZW50VXVpZH1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZXMuc2V0KHV1aWQsIHtcbiAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSB8fCB1dWlkLFxuICAgICAgICAgICAgICAgIHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG9wdGlvbnMucG9zaXRpb24gfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH0sXG4gICAgICAgICAgICAgICAgcm90YXRpb246IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICAgICAgICAgIHNjYWxlOiB7IHg6IDEsIHk6IDEsIHo6IDEgfSxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgICAgICAgcHJlZmFiOiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiAxLFxuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHR5cGVvZiBvcHRpb25zLmFzc2V0VXVpZCA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgICAgICAgICAgICAgID8gb3B0aW9ucy5hc3NldFV1aWRcbiAgICAgICAgICAgICAgICAgICAgICAgIDogb3B0aW9ucy5hc3NldFV1aWQ/LnZhbHVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwYXJlbnROb2RlLmNoaWxkcmVuLnB1c2godXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gdXVpZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzZXQtcHJvcGVydHknKSB7XG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlcy5nZXQocGF5bG9hZC51dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSBub3QgZm91bmQ6ICR7cGF5bG9hZC51dWlkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBwYXlsb2FkPy5kdW1wPy52YWx1ZTtcbiAgICAgICAgICAgIGlmIChwYXlsb2FkLnBhdGggPT09ICdyb3RhdGlvbicgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBub2RlLnJvdGF0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGF5bG9hZC5wYXRoID09PSAnc2NhbGUnICYmIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zY2FsZSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2V0LXBhcmVudCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IHBheWxvYWQucGFyZW50O1xuICAgICAgICAgICAgY29uc3QgdXVpZHMgPSBBcnJheS5pc0FycmF5KHBheWxvYWQudXVpZHMpID8gcGF5bG9hZC51dWlkcyA6IFtwYXlsb2FkLnV1aWRzXTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSBub2Rlcy5nZXQocGFyZW50VXVpZCk7XG4gICAgICAgICAgICBpZiAoIXBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCBub3QgZm91bmQ6ICR7cGFyZW50VXVpZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgdXVpZCBvZiB1dWlkcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlcy5nZXQodXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobm9kZS5wYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhcmVudCA9IG5vZGVzLmdldChub2RlLnBhcmVudFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2xkUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRQYXJlbnQuY2hpbGRyZW4gPSBvbGRQYXJlbnQuY2hpbGRyZW4uZmlsdGVyKChpdGVtKSA9PiBpdGVtICE9PSB1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBub2RlLnBhcmVudFV1aWQgPSBwYXJlbnRVdWlkO1xuICAgICAgICAgICAgICAgIGlmICghcGFyZW50Tm9kZS5jaGlsZHJlbi5pbmNsdWRlcyh1dWlkKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnROb2RlLmNoaWxkcmVuLnB1c2godXVpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHV1aWRzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlbW92ZS1ub2RlJykge1xuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBjb25zdCB1dWlkID0gcGF5bG9hZD8udXVpZDtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IG5vZGVzLmdldCh1dWlkKTtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGFyZ2V0LnBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBub2Rlcy5nZXQodGFyZ2V0LnBhcmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkcmVuID0gcGFyZW50LmNoaWxkcmVuLmZpbHRlcigoaXRlbSkgPT4gaXRlbSAhPT0gdXVpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZXMuZGVsZXRlKHV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLmxpbmstcHJlZmFiJyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDUwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmFiX2xpbmtfbm9kZV90b19hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogJ29sZC1ub2RlJyxcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6ICdhc3NldC1wcmVmYWItZmFsbGJhY2snXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJlcGxhY2VkLCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm9yaWdpbmFsTm9kZVV1aWQsICdvbGQtbm9kZScpO1xuICAgIGFzc2VydC5vayh0eXBlb2YgcmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm5vZGVVdWlkID09PSAnc3RyaW5nJyk7XG4gICAgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ub2RlVXVpZCwgJ29sZC1ub2RlJyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0U2NlbmVDbGlwYm9hcmRBbmRTYXZlQXNUb29scygpO1xuICAgIGF3YWl0IHRlc3RDb21wb25lbnRBZHZhbmNlZFRvb2xzKCk7XG4gICAgYXdhaXQgdGVzdEFzc2V0RXh0ZW5kZWRUb29scygpO1xuICAgIGF3YWl0IHRlc3RFZGl0b3JJbnRlZ3JhdGlvblRvb2xzKCk7XG4gICAgYXdhaXQgdGVzdFByZWZhYkxpbmtGYWxsYmFja0J5UmVwbGFjZW1lbnQoKTtcbiAgICBjb25zb2xlLmxvZygnbmV4dC1yb3V0ZXItYWR2YW5jZWQtdG9vbHMtdGVzdDogUEFTUycpO1xufVxuXG5ydW4oKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKCduZXh0LXJvdXRlci1hZHZhbmNlZC10b29scy10ZXN0OiBGQUlMJywgZXJyb3IpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbn0pO1xuIl19