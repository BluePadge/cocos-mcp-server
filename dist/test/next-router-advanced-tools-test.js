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
            return { success: true, input: args[0] };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1yb3V0ZXItYWR2YW5jZWQtdG9vbHMtdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcm91dGVyLWFkdmFuY2VkLXRvb2xzLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUM7WUFDL0IsTUFBTSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztZQUMvQixLQUFLLEVBQUUsVUFBVTtZQUNqQixRQUFRLEVBQUUsSUFBSTtZQUNkLFdBQVcsRUFBRSxHQUFHO1lBQ2hCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1lBQ25DLE1BQU0sRUFBRSxJQUFJO1NBQ2YsQ0FBQztJQUNOLENBQUM7SUFFRCxPQUFPO1FBQ0gsV0FBVyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1FBQ3JDLEtBQUs7UUFDTCxPQUFPLEVBQUU7WUFDTCxLQUFLLEVBQUUsYUFBYSxDQUFDLE1BQU07WUFDM0IsU0FBUyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQy9CLFdBQVcsRUFBRSxDQUFDO1lBQ2QsT0FBTyxF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LENBQUMsT0FBTyxRQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDLENBQUM7SUFDaEYsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDeEYsQ0FBQztBQUVELEtBQUssVUFBVSxHQUFHO0lBQ2QsTUFBTSxnQ0FBZ0MsRUFBRSxDQUFDO0lBQ3pDLE1BQU0sMEJBQTBCLEVBQUUsQ0FBQztJQUNuQyxNQUFNLHNCQUFzQixFQUFFLENBQUM7SUFDL0IsTUFBTSwwQkFBMEIsRUFBRSxDQUFDO0lBQ25DLE1BQU0sbUNBQW1DLEVBQUUsQ0FBQztJQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7QUFDekQsQ0FBQztBQUVELEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUNBQXVDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FwYWJpbGl0eU1hdHJpeCB9IGZyb20gJy4uL25leHQvbW9kZWxzJztcbmltcG9ydCB7IE5leHRUb29sUmVnaXN0cnkgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3Rvb2wtcmVnaXN0cnknO1xuaW1wb3J0IHsgTmV4dE1jcFJvdXRlciB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvcm91dGVyJztcbmltcG9ydCB7IGNyZWF0ZU9mZmljaWFsVG9vbHMgfSBmcm9tICcuLi9uZXh0L3Rvb2xzL29mZmljaWFsLXRvb2xzJztcblxuZnVuY3Rpb24gY3JlYXRlTWF0cml4KGF2YWlsYWJsZUtleXM6IHN0cmluZ1tdKTogQ2FwYWJpbGl0eU1hdHJpeCB7XG4gICAgY29uc3QgYnlLZXk6IENhcGFiaWxpdHlNYXRyaXhbJ2J5S2V5J10gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBhdmFpbGFibGVLZXlzKSB7XG4gICAgICAgIGNvbnN0IGZpcnN0RG90ID0ga2V5LmluZGV4T2YoJy4nKTtcbiAgICAgICAgYnlLZXlba2V5XSA9IHtcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGNoYW5uZWw6IGtleS5zbGljZSgwLCBmaXJzdERvdCksXG4gICAgICAgICAgICBtZXRob2Q6IGtleS5zbGljZShmaXJzdERvdCArIDEpLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBrZXksXG4gICAgICAgICAgICBhdmFpbGFibGU6IHRydWUsXG4gICAgICAgICAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGRldGFpbDogJ29rJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIGJ5S2V5LFxuICAgICAgICBzdW1tYXJ5OiB7XG4gICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgdW5hdmFpbGFibGU6IDAsXG4gICAgICAgICAgICBieUxheWVyOiB7XG4gICAgICAgICAgICAgICAgb2ZmaWNpYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHRlbmRlZDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHBlcmltZW50YWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RTY2VuZUNsaXBib2FyZEFuZFNhdmVBc1Rvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNhbGxMb2c6IEFycmF5PHsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdIH0+ID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ3NjZW5lJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsTG9nLnB1c2goeyBtZXRob2QsIGFyZ3MgfSk7XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2NvcHktbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiBbJ25vZGUtY29weS0xJ107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2N1dC1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncGFzdGUtbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiBbJ25vZGUtcGFzdGUtMSddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzYXZlLWFzLXNjZW5lJykge1xuICAgICAgICAgICAgcmV0dXJuICdkYjovL2Fzc2V0cy9zY2VuZXMvbmV3LXNjZW5lLnNjZW5lJztcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUuY29weS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLmN1dC1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnBhc3RlLW5vZGUnLFxuICAgICAgICAnc2NlbmUuc2F2ZS1hcy1zY2VuZSdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGxpc3RSZXNwb25zZSk7XG4gICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfY29weV9nYW1lX29iamVjdCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9jdXRfZ2FtZV9vYmplY3QnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfcGFzdGVfZ2FtZV9vYmplY3QnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfc2F2ZV9hc19zY2VuZScpKTtcblxuICAgIGNvbnN0IGNvcHkgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfY29weV9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkczogJ25vZGUtY29weS0xJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNvcHkpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjb3B5IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3QgY3V0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2N1dF9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkczogWydub2RlLWN1dC0xJywgJ25vZGUtY3V0LTInXVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGN1dCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGN1dCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHBhc3RlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3Bhc3RlX2dhbWVfb2JqZWN0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHRhcmdldFV1aWQ6ICdub2RlLXRhcmdldC0xJyxcbiAgICAgICAgICAgICAgICB1dWlkczogWydub2RlLWNvcHktMSddLFxuICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHBhc3RlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGFzdGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHBhc3RlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wYXN0ZWRVdWlkcy5sZW5ndGgsIDEpO1xuXG4gICAgY29uc3Qgc2F2ZUFzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3NhdmVfYXNfc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNhdmVBcyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVBcyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZUFzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zY2VuZVVybCwgJ2RiOi8vYXNzZXRzL3NjZW5lcy9uZXctc2NlbmUuc2NlbmUnKTtcblxuICAgIGFzc2VydC5vayhjYWxsTG9nLnNvbWUoKGl0ZW0pID0+IGl0ZW0ubWV0aG9kID09PSAnY29weS1ub2RlJykpO1xuICAgIGFzc2VydC5vayhjYWxsTG9nLnNvbWUoKGl0ZW0pID0+IGl0ZW0ubWV0aG9kID09PSAnY3V0LW5vZGUnKSk7XG4gICAgYXNzZXJ0Lm9rKGNhbGxMb2cuc29tZSgoaXRlbSkgPT4gaXRlbS5tZXRob2QgPT09ICdwYXN0ZS1ub2RlJykpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0Q29tcG9uZW50QWR2YW5jZWRUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCAhPT0gJ3NjZW5lJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNoYW5uZWw6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1jb21wb25lbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiBhcmdzWzBdLCBfX3R5cGVfXzogeyB2YWx1ZTogJ2NjLkxhYmVsJyB9IH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWNsYXNzZXMnKSB7XG4gICAgICAgICAgICByZXR1cm4gW3sgbmFtZTogJ2NjLkxhYmVsJyB9LCB7IG5hbWU6ICdjYy5TcHJpdGUnIH1dO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1jb21wb25lbnQtaGFzLXNjcmlwdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBhcmdzWzBdID09PSAnY2MuTGFiZWwnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdleGVjdXRlLWNvbXBvbmVudC1tZXRob2QnKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBpbnB1dDogYXJnc1swXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdtb3ZlLWFycmF5LWVsZW1lbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVtb3ZlLWFycmF5LWVsZW1lbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVzZXQtcHJvcGVydHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUucXVlcnktY29tcG9uZW50JyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LWNsYXNzZXMnLFxuICAgICAgICAnc2NlbmUucXVlcnktY29tcG9uZW50LWhhcy1zY3JpcHQnLFxuICAgICAgICAnc2NlbmUuZXhlY3V0ZS1jb21wb25lbnQtbWV0aG9kJyxcbiAgICAgICAgJ3NjZW5lLm1vdmUtYXJyYXktZWxlbWVudCcsXG4gICAgICAgICdzY2VuZS5yZW1vdmUtYXJyYXktZWxlbWVudCcsXG4gICAgICAgICdzY2VuZS5yZXNldC1wcm9wZXJ0eSdcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9nZXRfY29tcG9uZW50X2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnY29tcG9uZW50X3F1ZXJ5X2NsYXNzZXMnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnY29tcG9uZW50X2hhc19zY3JpcHQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnY29tcG9uZW50X2V4ZWN1dGVfbWV0aG9kJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9tb3ZlX2FycmF5X2VsZW1lbnQnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnY29tcG9uZW50X3JlbW92ZV9hcnJheV9lbGVtZW50JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9yZXNldF9wcm9wZXJ0eScpKTtcblxuICAgIGNvbnN0IHF1ZXJ5Q29tcG9uZW50ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfZ2V0X2NvbXBvbmVudF9pbmZvJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6ICdjb21wLTEnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlDb21wb25lbnQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeUNvbXBvbmVudCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGV4ZWN1dGUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9leGVjdXRlX21ldGhvZCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkOiAnY29tcC0xJyxcbiAgICAgICAgICAgICAgICBtZXRob2ROYW1lOiAncmVmcmVzaCcsXG4gICAgICAgICAgICAgICAgYXJnczogWzEsIHRydWVdXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soZXhlY3V0ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmV4ZWN1dGVkLCB0cnVlKTtcblxuICAgIGNvbnN0IHJlc2V0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfcmVzZXRfcHJvcGVydHknLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXVpZDogJ25vZGUtMScsXG4gICAgICAgICAgICAgICAgcGF0aDogJ19fY29tcHNfXy4wLnN0cmluZycsXG4gICAgICAgICAgICAgICAgdmFsdWU6ICdkZWZhdWx0J1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJlc2V0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzZXQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RBc3NldEV4dGVuZGVkVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdhc3NldC1kYicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAnZ2VuZXJhdGUtYXZhaWxhYmxlLXVybCcpIHtcbiAgICAgICAgICAgIHJldHVybiBgJHthcmdzWzBdfS4wMDFgO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1hc3NldC1tZXRhJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogJ21ldGEtMScsIHVzZXJEYXRhOiB7fSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdxdWVyeS1taXNzaW5nLWFzc2V0LWluZm8nKSB7XG4gICAgICAgICAgICByZXR1cm4geyBtaXNzaW5nOiB0cnVlLCB1cmw6IGFyZ3NbMF0gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAnY3JlYXRlLWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogJ2Fzc2V0LW5ldy0xJywgdXJsOiBhcmdzWzBdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2ltcG9ydC1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6ICdhc3NldC1pbXBvcnQtMScsIHVybDogYXJnc1sxXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzYXZlLWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogJ2Fzc2V0LXNhdmUtMScsIHVybDogYXJnc1swXSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRob2QgPT09ICdzYXZlLWFzc2V0LW1ldGEnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB1dWlkOiAnYXNzZXQtc2F2ZS1tZXRhLTEnLCB1cmw6IGFyZ3NbMF0gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnYXNzZXQtZGIuZ2VuZXJhdGUtYXZhaWxhYmxlLXVybCcsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1hc3NldC1tZXRhJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LW1pc3NpbmctYXNzZXQtaW5mbycsXG4gICAgICAgICdhc3NldC1kYi5jcmVhdGUtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIuaW1wb3J0LWFzc2V0JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnNhdmUtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIuc2F2ZS1hc3NldC1tZXRhJ1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgY3JlYXRlQXNzZXQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X2NyZWF0ZV9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmw6ICdkYjovL2Fzc2V0cy9kYXRhL2NvbmZpZy5qc29uJyxcbiAgICAgICAgICAgICAgICBjb250ZW50OiAne1xcXCJva1xcXCI6dHJ1ZX0nXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soY3JlYXRlQXNzZXQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVBc3NldCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGltcG9ydEFzc2V0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9pbXBvcnRfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgc291cmNlUGF0aDogJy90bXAvYS5wbmcnLFxuICAgICAgICAgICAgICAgIHRhcmdldFVybDogJ2RiOi8vYXNzZXRzL3RleHR1cmVzL2EucG5nJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGltcG9ydEFzc2V0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW1wb3J0QXNzZXQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBzYXZlTWV0YSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfc2F2ZV9hc3NldF9tZXRhJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybDogJ2RiOi8vYXNzZXRzL2RhdGEvY29uZmlnLmpzb24nLFxuICAgICAgICAgICAgICAgIG1ldGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdXNlckRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZTogJ3Rlc3QnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soc2F2ZU1ldGEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzYXZlTWV0YSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdEVkaXRvckludGVncmF0aW9uVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY2FsbExvZzogQXJyYXk8eyBjaGFubmVsOiBzdHJpbmc7IG1ldGhvZDogc3RyaW5nOyBhcmdzOiBhbnlbXSB9PiA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgY2FsbExvZy5wdXNoKHsgY2hhbm5lbCwgbWV0aG9kLCBhcmdzIH0pO1xuXG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvamVjdCcgJiYgbWV0aG9kID09PSAnb3Blbi1zZXR0aW5ncycpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcm9qZWN0JyAmJiBtZXRob2QgPT09ICdzZXQtY29uZmlnJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcmVmZXJlbmNlcycgJiYgbWV0aG9kID09PSAnb3Blbi1zZXR0aW5ncycpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcmVmZXJlbmNlcycgJiYgbWV0aG9kID09PSAnc2V0LWNvbmZpZycpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2lzLW5hdGl2ZScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnaW5mb3JtYXRpb24nICYmIG1ldGhvZCA9PT0gJ29wZW4taW5mb3JtYXRpb24tZGlhbG9nJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnY29uZmlybScgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2luZm9ybWF0aW9uJyAmJiBtZXRob2QgPT09ICdoYXMtZGlhbG9nJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdpbmZvcm1hdGlvbicgJiYgbWV0aG9kID09PSAnY2xvc2UtZGlhbG9nJykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3Byb2dyYW0nICYmIG1ldGhvZCA9PT0gJ29wZW4tcHJvZ3JhbScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvZ3JhbScgJiYgbWV0aG9kID09PSAnb3Blbi11cmwnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAncHJvamVjdC5vcGVuLXNldHRpbmdzJyxcbiAgICAgICAgJ3Byb2plY3Quc2V0LWNvbmZpZycsXG4gICAgICAgICdwcmVmZXJlbmNlcy5vcGVuLXNldHRpbmdzJyxcbiAgICAgICAgJ3ByZWZlcmVuY2VzLnNldC1jb25maWcnLFxuICAgICAgICAnc2NlbmUuaXMtbmF0aXZlJyxcbiAgICAgICAgJ2luZm9ybWF0aW9uLm9wZW4taW5mb3JtYXRpb24tZGlhbG9nJyxcbiAgICAgICAgJ2luZm9ybWF0aW9uLmhhcy1kaWFsb2cnLFxuICAgICAgICAnaW5mb3JtYXRpb24uY2xvc2UtZGlhbG9nJyxcbiAgICAgICAgJ3Byb2dyYW0ub3Blbi1wcm9ncmFtJyxcbiAgICAgICAgJ3Byb2dyYW0ub3Blbi11cmwnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcm9qZWN0X29wZW5fc2V0dGluZ3MnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJvamVjdF9zZXRfY29uZmlnJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3ByZWZlcmVuY2VzX29wZW5fc2V0dGluZ3MnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJlZmVyZW5jZXNfc2V0X2NvbmZpZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9xdWVyeV9pc19uYXRpdmUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnaW5mb3JtYXRpb25fb3Blbl9kaWFsb2cnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnaW5mb3JtYXRpb25faGFzX2RpYWxvZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdpbmZvcm1hdGlvbl9jbG9zZV9kaWFsb2cnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJvZ3JhbV9vcGVuX3Byb2dyYW0nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygncHJvZ3JhbV9vcGVuX3VybCcpKTtcblxuICAgIGNvbnN0IHByb2plY3RTZXR0aW5ncyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJvamVjdF9vcGVuX3NldHRpbmdzJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHRhYjogJ3Byb2plY3QnLFxuICAgICAgICAgICAgICAgIHN1YlRhYjogJ2VuZ2luZScsXG4gICAgICAgICAgICAgICAgYXJnczogWydwaHlzaWNzJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhwcm9qZWN0U2V0dGluZ3MpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChwcm9qZWN0U2V0dGluZ3MhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBxdWVyeU5hdGl2ZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfcXVlcnlfaXNfbmF0aXZlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNoZWNrQXZhaWxhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socXVlcnlOYXRpdmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeU5hdGl2ZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlOYXRpdmUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmlzTmF0aXZlLCB0cnVlKTtcblxuICAgIGNvbnN0IG9wZW5VcmwgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3Byb2dyYW1fb3Blbl91cmwnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsOiAnaHR0cHM6Ly9leGFtcGxlLmNvbSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhvcGVuVXJsKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3BlblVybCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3BlblVybCEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEub3BlbmVkLCB0cnVlKTtcblxuICAgIGFzc2VydC5vayhjYWxsTG9nLnNvbWUoKGl0ZW0pID0+IGl0ZW0uY2hhbm5lbCA9PT0gJ3Byb2dyYW0nICYmIGl0ZW0ubWV0aG9kID09PSAnb3Blbi11cmwnKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RQcmVmYWJMaW5rRmFsbGJhY2tCeVJlcGxhY2VtZW50KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGludGVyZmFjZSBNb2NrTm9kZSB7XG4gICAgICAgIHV1aWQ6IHN0cmluZztcbiAgICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgICBwYXJlbnRVdWlkOiBzdHJpbmcgfCBudWxsO1xuICAgICAgICBwb3NpdGlvbjogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyIH07XG4gICAgICAgIHJvdGF0aW9uOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6OiBudW1iZXIgfTtcbiAgICAgICAgc2NhbGU6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlciB9O1xuICAgICAgICBjaGlsZHJlbjogc3RyaW5nW107XG4gICAgICAgIHByZWZhYjogbnVsbCB8IHtcbiAgICAgICAgICAgIHN0YXRlOiBudW1iZXI7XG4gICAgICAgICAgICBhc3NldFV1aWQ6IHN0cmluZztcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlcyA9IG5ldyBNYXA8c3RyaW5nLCBNb2NrTm9kZT4oKTtcbiAgICBub2Rlcy5zZXQoJ3Jvb3QnLCB7XG4gICAgICAgIHV1aWQ6ICdyb290JyxcbiAgICAgICAgbmFtZTogJ1Jvb3QnLFxuICAgICAgICBwYXJlbnRVdWlkOiBudWxsLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAwLCB5OiAwLCB6OiAwIH0sXG4gICAgICAgIHJvdGF0aW9uOiB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgc2NhbGU6IHsgeDogMSwgeTogMSwgejogMSB9LFxuICAgICAgICBjaGlsZHJlbjogWydvbGQtbm9kZSddLFxuICAgICAgICBwcmVmYWI6IG51bGxcbiAgICB9KTtcbiAgICBub2Rlcy5zZXQoJ29sZC1ub2RlJywge1xuICAgICAgICB1dWlkOiAnb2xkLW5vZGUnLFxuICAgICAgICBuYW1lOiAnT2xkTm9kZScsXG4gICAgICAgIHBhcmVudFV1aWQ6ICdyb290JyxcbiAgICAgICAgcG9zaXRpb246IHsgeDogMSwgeTogMiwgejogMyB9LFxuICAgICAgICByb3RhdGlvbjogeyB4OiAwLCB5OiAxMCwgejogMCB9LFxuICAgICAgICBzY2FsZTogeyB4OiAxLCB5OiAxLCB6OiAxIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbJ29sZC1jaGlsZCddLFxuICAgICAgICBwcmVmYWI6IG51bGxcbiAgICB9KTtcbiAgICBub2Rlcy5zZXQoJ29sZC1jaGlsZCcsIHtcbiAgICAgICAgdXVpZDogJ29sZC1jaGlsZCcsXG4gICAgICAgIG5hbWU6ICdPbGRDaGlsZCcsXG4gICAgICAgIHBhcmVudFV1aWQ6ICdvbGQtbm9kZScsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgcm90YXRpb246IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICBzY2FsZTogeyB4OiAxLCB5OiAxLCB6OiAxIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgcHJlZmFiOiBudWxsXG4gICAgfSk7XG5cbiAgICBsZXQgY291bnRlciA9IDA7XG5cbiAgICBmdW5jdGlvbiBtYWtlTm9kZUR1bXAobm9kZTogTW9ja05vZGUpOiBhbnkge1xuICAgICAgICBjb25zdCBwYXJlbnQgPSBub2RlLnBhcmVudFV1aWRcbiAgICAgICAgICAgID8geyB2YWx1ZTogeyB1dWlkOiBub2RlLnBhcmVudFV1aWQgfSwgdHlwZTogJ2NjLk5vZGUnIH1cbiAgICAgICAgICAgIDogeyB2YWx1ZTogbnVsbCwgdHlwZTogJ2NjLk5vZGUnIH07XG4gICAgICAgIGNvbnN0IGR1bXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgICAgICAgICBuYW1lOiB7IHZhbHVlOiBub2RlLm5hbWUsIHR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgICAgICBwYXJlbnQsXG4gICAgICAgICAgICBwb3NpdGlvbjogeyB2YWx1ZTogbm9kZS5wb3NpdGlvbiwgdHlwZTogJ2NjLlZlYzMnIH0sXG4gICAgICAgICAgICByb3RhdGlvbjogeyB2YWx1ZTogbm9kZS5yb3RhdGlvbiwgdHlwZTogJ2NjLlZlYzMnIH0sXG4gICAgICAgICAgICBzY2FsZTogeyB2YWx1ZTogbm9kZS5zY2FsZSwgdHlwZTogJ2NjLlZlYzMnIH0sXG4gICAgICAgICAgICBjaGlsZHJlbjogbm9kZS5jaGlsZHJlbi5tYXAoKHV1aWQpID0+ICh7IHV1aWQgfSkpXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG5vZGUucHJlZmFiKSB7XG4gICAgICAgICAgICBkdW1wLnByZWZhYiA9IHtcbiAgICAgICAgICAgICAgICBzdGF0ZTogeyB2YWx1ZTogbm9kZS5wcmVmYWIuc3RhdGUgfSxcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdmFsdWU6IG5vZGUucHJlZmFiLmFzc2V0VXVpZCB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGR1bXA7XG4gICAgfVxuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdzY2VuZScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlcy5nZXQoYXJnc1swXSk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgbm90IGZvdW5kOiAke2FyZ3NbMF19YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWFrZU5vZGVEdW1wKG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2xpbmstcHJlZmFiJykge1xuICAgICAgICAgICAgLy8g5qih5oufIDMuOC44IOeahOKAnOiwg+eUqOS4jeaKpemUme+8jOS9huS4jeS8muaKiuiKgueCueWPmOaIkCBQcmVmYWIg5a6e5L6L4oCdXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdjcmVhdGUtbm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdIHx8IHt9O1xuICAgICAgICAgICAgY291bnRlciArPSAxO1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IGByZXBsYWNlbWVudC0ke2NvdW50ZXJ9YDtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFV1aWQgPSBvcHRpb25zLnBhcmVudCB8fCAncm9vdCc7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnROb2RlID0gbm9kZXMuZ2V0KHBhcmVudFV1aWQpO1xuICAgICAgICAgICAgaWYgKCFwYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgbm90IGZvdW5kOiAke3BhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGVzLnNldCh1dWlkLCB7XG4gICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBvcHRpb25zLm5hbWUgfHwgdXVpZCxcbiAgICAgICAgICAgICAgICBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBvcHRpb25zLnBvc2l0aW9uIHx8IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgICAgICAgICBzY2FsZTogeyB4OiAxLCB5OiAxLCB6OiAxIH0sXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgICAgIHByZWZhYjoge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZTogMSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRVdWlkOiB0eXBlb2Ygb3B0aW9ucy5hc3NldFV1aWQgPT09ICdzdHJpbmcnXG4gICAgICAgICAgICAgICAgICAgICAgICA/IG9wdGlvbnMuYXNzZXRVdWlkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG9wdGlvbnMuYXNzZXRVdWlkPy52YWx1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGFyZW50Tm9kZS5jaGlsZHJlbi5wdXNoKHV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAnc2V0LXByb3BlcnR5Jykge1xuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXMuZ2V0KHBheWxvYWQudXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgbm90IGZvdW5kOiAke3BheWxvYWQudXVpZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcGF5bG9hZD8uZHVtcD8udmFsdWU7XG4gICAgICAgICAgICBpZiAocGF5bG9hZC5wYXRoID09PSAncm90YXRpb24nICYmIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5yb3RhdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBheWxvYWQucGF0aCA9PT0gJ3NjYWxlJyAmJiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIG5vZGUuc2NhbGUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3NldC1wYXJlbnQnKSB7XG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFV1aWQgPSBwYXlsb2FkLnBhcmVudDtcbiAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gQXJyYXkuaXNBcnJheShwYXlsb2FkLnV1aWRzKSA/IHBheWxvYWQudXVpZHMgOiBbcGF5bG9hZC51dWlkc107XG4gICAgICAgICAgICBjb25zdCBwYXJlbnROb2RlID0gbm9kZXMuZ2V0KHBhcmVudFV1aWQpO1xuICAgICAgICAgICAgaWYgKCFwYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgbm90IGZvdW5kOiAke3BhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHV1aWQgb2YgdXVpZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXMuZ2V0KHV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUucGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXJlbnQgPSBub2Rlcy5nZXQobm9kZS5wYXJlbnRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9sZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2xkUGFyZW50LmNoaWxkcmVuID0gb2xkUGFyZW50LmNoaWxkcmVuLmZpbHRlcigoaXRlbSkgPT4gaXRlbSAhPT0gdXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbm9kZS5wYXJlbnRVdWlkID0gcGFyZW50VXVpZDtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmVudE5vZGUuY2hpbGRyZW4uaW5jbHVkZXModXVpZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50Tm9kZS5jaGlsZHJlbi5wdXNoKHV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB1dWlkcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09ICdyZW1vdmUtbm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IHBheWxvYWQ/LnV1aWQ7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBub2Rlcy5nZXQodXVpZCk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRhcmdldC5wYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbm9kZXMuZ2V0KHRhcmdldC5wYXJlbnRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZHJlbiA9IHBhcmVudC5jaGlsZHJlbi5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0gIT09IHV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGVzLmRlbGV0ZSh1dWlkKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5saW5rLXByZWZhYicsXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJ1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA1MCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZhYl9saW5rX25vZGVfdG9fYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdvbGQtbm9kZScsXG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiAnYXNzZXQtcHJlZmFiLWZhbGxiYWNrJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5yZXBsYWNlZCwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5vcmlnaW5hbE5vZGVVdWlkLCAnb2xkLW5vZGUnKTtcbiAgICBhc3NlcnQub2sodHlwZW9mIHJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ub2RlVXVpZCA9PT0gJ3N0cmluZycpO1xuICAgIGFzc2VydC5ub3RTdHJpY3RFcXVhbChyZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubm9kZVV1aWQsICdvbGQtbm9kZScpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGVzdFNjZW5lQ2xpcGJvYXJkQW5kU2F2ZUFzVG9vbHMoKTtcbiAgICBhd2FpdCB0ZXN0Q29tcG9uZW50QWR2YW5jZWRUb29scygpO1xuICAgIGF3YWl0IHRlc3RBc3NldEV4dGVuZGVkVG9vbHMoKTtcbiAgICBhd2FpdCB0ZXN0RWRpdG9ySW50ZWdyYXRpb25Ub29scygpO1xuICAgIGF3YWl0IHRlc3RQcmVmYWJMaW5rRmFsbGJhY2tCeVJlcGxhY2VtZW50KCk7XG4gICAgY29uc29sZS5sb2coJ25leHQtcm91dGVyLWFkdmFuY2VkLXRvb2xzLXRlc3Q6IFBBU1MnKTtcbn1cblxucnVuKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcignbmV4dC1yb3V0ZXItYWR2YW5jZWQtdG9vbHMtdGVzdDogRkFJTCcsIGVycm9yKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG59KTtcbiJdfQ==