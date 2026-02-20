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
        if (channel === 'engine' && method === 'query-info') {
            return { version: '3.8.8', path: '/engine', nativeVersion: 'builtin', nativePath: '/native', editor: '3.8.8' };
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
        'engine.query-info',
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
    await testAssetManagementTools();
    await testUnknownTool();
    console.log('next-router-test: PASS');
}
run().catch((error) => {
    console.error('next-router-test: FAIL', error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1yb3V0ZXItdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcm91dGVyLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU87WUFDUCxNQUFNO1lBQ04sS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZ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TUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ2pDLE9BQU8sRUFBRSxLQUFLO1FBQ2QsRUFBRSxFQUFFLENBQUM7UUFDTCxNQUFNLEVBQUUsWUFBWTtRQUNwQixNQUFNLEVBQUU7WUFDSixJQUFJLEVBQUUsWUFBWTtZQUNsQixTQUFTLEVBQUUsRUFBRTtTQUNoQjtLQUNKLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDcEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFBLFFBQVMsQ0FBQyxLQUFLLDBDQUFFLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFFRCxLQUFLLFVBQVUsR0FBRztJQUNkLE1BQU0sMEJBQTBCLEVBQUUsQ0FBQztJQUNuQyxNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFDMUIsTUFBTSw0QkFBNEIsRUFBRSxDQUFDO0lBQ3JDLE1BQU0sd0JBQXdCLEVBQUUsQ0FBQztJQUNqQyxNQUFNLGVBQWUsRUFBRSxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQztBQUMxQyxDQUFDO0FBRUQsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYXBhYmlsaXR5TWF0cml4IH0gZnJvbSAnLi4vbmV4dC9tb2RlbHMnO1xuaW1wb3J0IHsgTmV4dFRvb2xSZWdpc3RyeSB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvdG9vbC1yZWdpc3RyeSc7XG5pbXBvcnQgeyBOZXh0TWNwUm91dGVyIH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC9yb3V0ZXInO1xuaW1wb3J0IHsgY3JlYXRlT2ZmaWNpYWxUb29scyB9IGZyb20gJy4uL25leHQvdG9vbHMvb2ZmaWNpYWwtdG9vbHMnO1xuXG5mdW5jdGlvbiBjcmVhdGVNYXRyaXgoYXZhaWxhYmxlS2V5czogc3RyaW5nW10pOiBDYXBhYmlsaXR5TWF0cml4IHtcbiAgICBjb25zdCBieUtleTogQ2FwYWJpbGl0eU1hdHJpeFsnYnlLZXknXSA9IHt9O1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGF2YWlsYWJsZUtleXMpIHtcbiAgICAgICAgY29uc3QgZmlyc3REb3QgPSBrZXkuaW5kZXhPZignLicpO1xuICAgICAgICBjb25zdCBjaGFubmVsID0ga2V5LnNsaWNlKDAsIGZpcnN0RG90KTtcbiAgICAgICAgY29uc3QgbWV0aG9kID0ga2V5LnNsaWNlKGZpcnN0RG90ICsgMSk7XG4gICAgICAgIGJ5S2V5W2tleV0gPSB7XG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICBjaGFubmVsLFxuICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBrZXksXG4gICAgICAgICAgICBhdmFpbGFibGU6IHRydWUsXG4gICAgICAgICAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGRldGFpbDogJ29rJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIGJ5S2V5LFxuICAgICAgICBzdW1tYXJ5OiB7XG4gICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgdW5hdmFpbGFibGU6IDAsXG4gICAgICAgICAgICBieUxheWVyOiB7XG4gICAgICAgICAgICAgICAgb2ZmaWNpYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHRlbmRlZDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHBlcmltZW50YWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RMaXN0QW5kUmVhZERvbWFpbkNhbGxzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUtdHJlZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6ICdyb290JywgbmFtZTogeyB2YWx1ZTogJ01haW5TY2VuZScgfSwgY2hpbGRyZW46IFtdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogJ25vZGUtMScgfSxcbiAgICAgICAgICAgICAgICBfX2NvbXBzX186IFtcbiAgICAgICAgICAgICAgICAgICAgeyBfX3R5cGVfXzogeyB2YWx1ZTogJ2NjLkxhYmVsJyB9LCB1dWlkOiB7IHZhbHVlOiAnY29tcC0xJyB9IH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWFzc2V0cycpIHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgeyB1cmw6ICdkYjovL2Fzc2V0cy9hLnByZWZhYicsIHV1aWQ6ICd1dWlkLWEnIH0sXG4gICAgICAgICAgICAgICAgeyB1cmw6ICdkYjovL2Fzc2V0cy9iLnByZWZhYicsIHV1aWQ6ICd1dWlkLWInIH1cbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJykge1xuICAgICAgICAgICAgcmV0dXJuIFsnZGVwLXV1aWQtMScsICdkZXAtdXVpZC0yJ107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtaW5mbycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6IGFyZ3NbMF0sIHVybDogYGRiOi8vYXNzZXRzLyR7YXJnc1swXX0ucHJlZmFiYCB9O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfSgke0pTT04uc3RyaW5naWZ5KGFyZ3MpfSlgKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LW5vZGUtdHJlZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0cycsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1hc3NldC1pbmZvJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWRlcGVuZGVuY2llcydcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBhc3NlcnQub2soQXJyYXkuaXNBcnJheShsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scykpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2xpc3RfZ2FtZV9vYmplY3RzJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2dldF9nYW1lX29iamVjdF9pbmZvJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9saXN0X29uX25vZGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJykpO1xuICAgIGFzc2VydC5vayghdG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9jcmVhdGVfZ2FtZV9vYmplY3QnKSwgJ+WGmeaTjeS9nOiDveWKm+acquaOoua1i+aXtuS4jeW6lOaatOmcsuWGmeW3peWFtycpO1xuXG4gICAgY29uc3QgY2FsbFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X2RlcGVuZGVuY2llcycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmxPclV1aWQ6ICdkYjovL2Fzc2V0cy9wbGF5ZXIucHJlZmFiJyxcbiAgICAgICAgICAgICAgICByZWxhdGlvblR5cGU6ICdhbGwnLFxuICAgICAgICAgICAgICAgIGluY2x1ZGVBc3NldEluZm86IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKGNhbGxSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEuZXJyb3IsIHVuZGVmaW5lZCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbFJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuc3VjY2VzcywgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmRlcGVuZGVuY3lJbmZvcy5sZW5ndGgsIDIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0V3JpdGVUb29sQ2FsbCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBzZXRQcm9wZXJ0eVBheWxvYWRzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IHJlbW92ZUNvbXBvbmVudFBheWxvYWRzOiBhbnlbXSA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogJ25vZGUtMScgfSxcbiAgICAgICAgICAgICAgICBfX2NvbXBzX186IFtcbiAgICAgICAgICAgICAgICAgICAgeyBfX3R5cGVfXzogeyB2YWx1ZTogJ2NjLkxhYmVsJyB9LCB1dWlkOiB7IHZhbHVlOiAnY29tcC11dWlkLWxhYmVsJyB9IH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3NldC1wcm9wZXJ0eScpIHtcbiAgICAgICAgICAgIHNldFByb3BlcnR5UGF5bG9hZHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3JlbW92ZS1jb21wb25lbnQnKSB7XG4gICAgICAgICAgICByZW1vdmVDb21wb25lbnRQYXlsb2Fkcy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2FsbDogJHtjaGFubmVsfS4ke21ldGhvZH0oJHtKU09OLnN0cmluZ2lmeShhcmdzKX0pYCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnNldC1wcm9wZXJ0eScsXG4gICAgICAgICdzY2VuZS5yZW1vdmUtY29tcG9uZW50J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3Qgc2V0UHJvcGVydHlSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS0xJyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiAnY2MuTGFiZWwnLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgdmFsdWU6ICdIZWxsbyBOZXh0JyxcbiAgICAgICAgICAgICAgICB2YWx1ZVR5cGU6ICdTdHJpbmcnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eVJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlQYXlsb2Fkcy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVBheWxvYWRzWzBdLnBhdGgsICdfX2NvbXBzX18uMC5zdHJpbmcnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlQYXlsb2Fkc1swXS5kdW1wLnZhbHVlLCAnSGVsbG8gTmV4dCcpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVBheWxvYWRzWzBdLmR1bXAudHlwZSwgJ1N0cmluZycpO1xuXG4gICAgY29uc3QgcmVtb3ZlQ29tcG9uZW50UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3JlbW92ZV9jb21wb25lbnQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLTEnLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6ICdjYy5MYWJlbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKHJlbW92ZUNvbXBvbmVudFJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlQ29tcG9uZW50UmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZUNvbXBvbmVudFBheWxvYWRzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZUNvbXBvbmVudFBheWxvYWRzWzBdLnV1aWQsICdjb21wLXV1aWQtbGFiZWwnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdExpZmVjeWNsZUFuZFJ1bnRpbWVUb29scygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjYWxsTG9nOiBBcnJheTx7IGNoYW5uZWw6IHN0cmluZzsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdIH0+ID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBjYWxsTG9nLnB1c2goeyBjaGFubmVsLCBtZXRob2QsIGFyZ3MgfSk7XG5cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnb3Blbi1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnc2F2ZS1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2Nsb3NlLXNjZW5lJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktaXMtcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1kaXJ0eScpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1zY2VuZS1ib3VuZHMnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB4OiAwLCB5OiAwLCB3aWR0aDogMTI4MCwgaGVpZ2h0OiA3MjAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdmb2N1cy1jYW1lcmEnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvamVjdCcgJiYgbWV0aG9kID09PSAncXVlcnktY29uZmlnJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgbmFtZTogJ0hlbGxvV29ybGQnLCBsYW5ndWFnZTogJ3poJyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJlZmVyZW5jZXMnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWNvbmZpZycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGxhbmd1YWdlOiAnemgtQ04nIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzZXJ2ZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWlwLWxpc3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gWycxMjcuMC4wLjEnXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NlcnZlcicgJiYgbWV0aG9kID09PSAncXVlcnktcG9ydCcpIHtcbiAgICAgICAgICAgIHJldHVybiA3NDU2O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnZW5naW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1pbmZvJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmVyc2lvbjogJzMuOC44JywgcGF0aDogJy9lbmdpbmUnLCBuYXRpdmVWZXJzaW9uOiAnYnVpbHRpbicsIG5hdGl2ZVBhdGg6ICcvbmF0aXZlJywgZWRpdG9yOiAnMy44LjgnIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdlbmdpbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWVuZ2luZS1pbmZvJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmVyc2lvbjogJzMuOC44JywgbW9kdWxlczogW10gfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2J1aWxkZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXdvcmtlci1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhbGw6ICR7Y2hhbm5lbH0uJHttZXRob2R9KCR7SlNPTi5zdHJpbmdpZnkoYXJncyl9KWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUub3Blbi1zY2VuZScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1pcy1yZWFkeScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1kaXJ0eScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1zY2VuZS1ib3VuZHMnLFxuICAgICAgICAnc2NlbmUuZm9jdXMtY2FtZXJhJyxcbiAgICAgICAgJ3Byb2plY3QucXVlcnktY29uZmlnJyxcbiAgICAgICAgJ3ByZWZlcmVuY2VzLnF1ZXJ5LWNvbmZpZycsXG4gICAgICAgICdzZXJ2ZXIucXVlcnktaXAtbGlzdCcsXG4gICAgICAgICdzZXJ2ZXIucXVlcnktcG9ydCcsXG4gICAgICAgICdlbmdpbmUucXVlcnktaW5mbycsXG4gICAgICAgICdlbmdpbmUucXVlcnktZW5naW5lLWluZm8nLFxuICAgICAgICAnYnVpbGRlci5xdWVyeS13b3JrZXItcmVhZHknXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdFJlc3BvbnNlKTtcbiAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0UmVzcG9uc2UhLnJlc3VsdC50b29scy5tYXAoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdzY2VuZV9vcGVuX3NjZW5lJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX3NhdmVfc2NlbmUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfY2xvc2Vfc2NlbmUnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfcXVlcnlfc3RhdHVzJykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2ZvY3VzX2NhbWVyYScpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcm9qZWN0X3F1ZXJ5X2NvbmZpZycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdwcmVmZXJlbmNlc19xdWVyeV9jb25maWcnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2VydmVyX3F1ZXJ5X25ldHdvcmsnKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZW5naW5lX3F1ZXJ5X3J1bnRpbWVfaW5mbycpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdlbmdpbmVfcXVlcnlfZW5naW5lX2luZm8nKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnYnVpbGRlcl9xdWVyeV93b3JrZXJfcmVhZHknKSk7XG5cbiAgICBjb25zdCBzY2VuZVN0YXR1cyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDExLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfcXVlcnlfc3RhdHVzJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVCb3VuZHM6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzY2VuZVN0YXR1cyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzY2VuZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuaXNSZWFkeSwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pc0RpcnR5LCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNjZW5lU3RhdHVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ib3VuZHMud2lkdGgsIDEyODApO1xuXG4gICAgY29uc3Qgb3BlblNjZW5lID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9vcGVuX3NjZW5lJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHNjZW5lVXJsOiAnZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sob3BlblNjZW5lKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3BlblNjZW5lIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuU2NlbmUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm9wZW5lZCwgdHJ1ZSk7XG5cbiAgICBjb25zdCBzYXZlU2NlbmUgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3NhdmVfc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgZm9yY2U6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzYXZlU2NlbmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzYXZlU2NlbmUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVTY2VuZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc2NlbmVVcmwsICdkYjovL2Fzc2V0cy9zY2VuZXMvYm9vdC5zY2VuZScpO1xuXG4gICAgY29uc3QgY2xvc2VTY2VuZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfY2xvc2Vfc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNsb3NlU2NlbmUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjbG9zZVNjZW5lIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjbG9zZVNjZW5lIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5jbG9zZWQsIHRydWUpO1xuXG4gICAgY29uc3QgZm9jdXNDYW1lcmEgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2ZvY3VzX2NhbWVyYScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkczogJ25vZGUtMSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhmb2N1c0NhbWVyYSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzQ2FtZXJhIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZm9jdXNDYW1lcmEhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnV1aWRzLCBbJ25vZGUtMSddKTtcblxuICAgIGNvbnN0IHByb2plY3RDb25maWcgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3Byb2plY3RfcXVlcnlfY29uZmlnJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6ICdwcm9qZWN0JyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbDogJ3Byb2plY3QnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socHJvamVjdENvbmZpZyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHByb2plY3RDb25maWchLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBwcmVmZXJlbmNlc0NvbmZpZyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE3LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmVyZW5jZXNfcXVlcnlfY29uZmlnJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6ICdnZW5lcmFsJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHByZWZlcmVuY2VzQ29uZmlnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocHJlZmVyZW5jZXNDb25maWchLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBuZXR3b3JrID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTgsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzZXJ2ZXJfcXVlcnlfbmV0d29yaycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sobmV0d29yayk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG5ldHdvcmshLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG5ldHdvcmshLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnBvcnQsIDc0NTYpO1xuXG4gICAgY29uc3QgcnVudGltZUluZm8gPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxOSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2VuZ2luZV9xdWVyeV9ydW50aW1lX2luZm8nLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHJ1bnRpbWVJbmZvKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocnVudGltZUluZm8hLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJ1bnRpbWVJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pbmZvLnZlcnNpb24sICczLjguOCcpO1xuXG4gICAgY29uc3QgZW5naW5lSW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnZW5naW5lX3F1ZXJ5X2VuZ2luZV9pbmZvJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhlbmdpbmVJbmZvKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZW5naW5lSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHdvcmtlclJlYWR5ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMjEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdidWlsZGVyX3F1ZXJ5X3dvcmtlcl9yZWFkeScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sod29ya2VyUmVhZHkpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXJSZWFkeSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VyUmVhZHkhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJlYWR5LCB0cnVlKTtcblxuICAgIGFzc2VydC5vayhcbiAgICAgICAgY2FsbExvZy5zb21lKChpdGVtKSA9PiBpdGVtLmNoYW5uZWwgPT09ICdzY2VuZScgJiYgaXRlbS5tZXRob2QgPT09ICdvcGVuLXNjZW5lJyksXG4gICAgICAgICflupTosIPnlKggc2NlbmUub3Blbi1zY2VuZSdcbiAgICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0QXNzZXRNYW5hZ2VtZW50VG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgIT09ICdhc3NldC1kYicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjaGFubmVsOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSAnbW92ZS1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNvdXJjZTogYXJnc1swXSwgdGFyZ2V0OiBhcmdzWzFdIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LXBhdGgnKSB7XG4gICAgICAgICAgICByZXR1cm4gJy9Vc2Vycy9ibHVlL0RldmVsb3Blci9Db2Nvc1Byb2plY3RzL0hlbGxvV29ybGQvYXNzZXRzL2EucHJlZmFiJztcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktdXJsJykge1xuICAgICAgICAgICAgcmV0dXJuICdkYjovL2Fzc2V0cy9hLnByZWZhYic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LXV1aWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3V1aWQtYSc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3JlaW1wb3J0LWFzc2V0Jykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAncmVmcmVzaC1hc3NldCcpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ29wZW4tYXNzZXQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGFzc2V0IG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdhc3NldC1kYi5tb3ZlLWFzc2V0JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LXBhdGgnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktdXJsJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LXV1aWQnLFxuICAgICAgICAnYXNzZXQtZGIucmVpbXBvcnQtYXNzZXQnLFxuICAgICAgICAnYXNzZXQtZGIucmVmcmVzaC1hc3NldCcsXG4gICAgICAgICdhc3NldC1kYi5vcGVuLWFzc2V0J1xuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIG1hdHJpeCk7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IE5leHRNY3BSb3V0ZXIocmVnaXN0cnkpO1xuXG4gICAgY29uc3QgbW92ZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfbW92ZV9hc3NldCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBzb3VyY2U6ICdkYjovL2Fzc2V0cy9hLnByZWZhYicsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnZGI6Ly9hc3NldHMvYi5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sobW92ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG1vdmUhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBxdWVyeVBhdGggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3BhdGgnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsT3JVdWlkOiAndXVpZC1hJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5UGF0aCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5UGF0aCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQub2socXVlcnlQYXRoIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wYXRoLmluY2x1ZGVzKCcvYXNzZXRzL2EucHJlZmFiJykpO1xuXG4gICAgY29uc3QgcXVlcnlVcmwgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3VybCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1dWlkT3JQYXRoOiAndXVpZC1hJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5VXJsKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlVcmwhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VXJsIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS51cmwsICdkYjovL2Fzc2V0cy9hLnByZWZhYicpO1xuXG4gICAgY29uc3QgcXVlcnlVdWlkID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV91dWlkJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yUGF0aDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5VXVpZCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VXVpZCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlVdWlkIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS51dWlkLCAndXVpZC1hJyk7XG5cbiAgICBjb25zdCByZWltcG9ydCA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDM0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcmVpbXBvcnRfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVpbXBvcnQpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZWltcG9ydCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHJlZnJlc2ggPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3JlZnJlc2hfYXNzZXQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdXJsOiAnZGI6Ly9hc3NldHMvYS5wcmVmYWInXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2socmVmcmVzaCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlZnJlc2ghLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBvcGVuID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMzYsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9vcGVuX2Fzc2V0JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yVXVpZDogJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKG9wZW4pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0VW5rbm93blRvb2woKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKGFzeW5jICgpID0+IHVuZGVmaW5lZCk7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ25vdC1leGlzdHMnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhc3NlcnQub2socmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEuZXJyb3I/LmNvZGUsIC0zMjYwMik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0TGlzdEFuZFJlYWREb21haW5DYWxscygpO1xuICAgIGF3YWl0IHRlc3RXcml0ZVRvb2xDYWxsKCk7XG4gICAgYXdhaXQgdGVzdExpZmVjeWNsZUFuZFJ1bnRpbWVUb29scygpO1xuICAgIGF3YWl0IHRlc3RBc3NldE1hbmFnZW1lbnRUb29scygpO1xuICAgIGF3YWl0IHRlc3RVbmtub3duVG9vbCgpO1xuICAgIGNvbnNvbGUubG9nKCduZXh0LXJvdXRlci10ZXN0OiBQQVNTJyk7XG59XG5cbnJ1bigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ25leHQtcm91dGVyLXRlc3Q6IEZBSUwnLCBlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=