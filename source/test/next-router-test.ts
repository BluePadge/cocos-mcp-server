import * as assert from 'assert';
import { CapabilityMatrix } from '../next/models';
import { NextToolRegistry } from '../next/protocol/tool-registry';
import { NextMcpRouter } from '../next/protocol/router';
import { createOfficialTools } from '../next/tools/official-tools';

function createMatrix(availableKeys: string[]): CapabilityMatrix {
    const byKey: CapabilityMatrix['byKey'] = {};
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

async function testListAndReadDomainCalls(): Promise<void> {
    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.query-node-tree',
        'scene.query-node',
        'asset-db.query-assets',
        'asset-db.query-asset-info',
        'asset-db.query-asset-dependencies'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });

    assert.ok(listResponse);
    assert.ok(Array.isArray(listResponse!.result.tools));
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(callResponse!.error, undefined);
    assert.strictEqual(callResponse!.result.isError, false);
    assert.strictEqual(callResponse!.result.structuredContent.success, true);
    assert.strictEqual(callResponse!.result.structuredContent.data.count, 2);
    assert.strictEqual(callResponse!.result.structuredContent.data.dependencyInfos.length, 2);
}

async function testWriteToolCall(): Promise<void> {
    const setPropertyPayloads: any[] = [];
    const removeComponentPayloads: any[] = [];

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.query-node',
        'scene.set-property',
        'scene.remove-component'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

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
    assert.strictEqual(setPropertyResponse!.result.isError, false);
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
    assert.strictEqual(removeComponentResponse!.result.isError, false);
    assert.strictEqual(removeComponentPayloads.length, 1);
    assert.strictEqual(removeComponentPayloads[0].uuid, 'comp-uuid-label');
}

async function testLifecycleAndRuntimeTools(): Promise<void> {
    const callLog: Array<{ channel: string; method: string; args: any[] }> = [];

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
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
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(sceneStatus!.result.isError, false);
    assert.strictEqual(sceneStatus!.result.structuredContent.data.isReady, true);
    assert.strictEqual(sceneStatus!.result.structuredContent.data.isDirty, false);
    assert.strictEqual(sceneStatus!.result.structuredContent.data.bounds.width, 1280);

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
    assert.strictEqual(openScene!.result.isError, false);
    assert.strictEqual(openScene!.result.structuredContent.data.opened, true);

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
    assert.strictEqual(saveScene!.result.isError, false);
    assert.strictEqual(saveScene!.result.structuredContent.data.sceneUrl, 'db://assets/scenes/boot.scene');

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
    assert.strictEqual(closeScene!.result.isError, false);
    assert.strictEqual(closeScene!.result.structuredContent.data.closed, true);

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
    assert.strictEqual(focusCamera!.result.isError, false);
    assert.deepStrictEqual(focusCamera!.result.structuredContent.data.uuids, ['node-1']);

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
    assert.strictEqual(projectConfig!.result.isError, false);

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
    assert.strictEqual(preferencesConfig!.result.isError, false);

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
    assert.strictEqual(network!.result.isError, false);
    assert.strictEqual(network!.result.structuredContent.data.port, 7456);

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
    assert.strictEqual(runtimeInfo!.result.isError, false);
    assert.strictEqual(runtimeInfo!.result.structuredContent.data.info.version, '3.8.8');

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
    assert.strictEqual(engineInfo!.result.isError, false);

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
    assert.strictEqual(workerReady!.result.isError, false);
    assert.strictEqual(workerReady!.result.structuredContent.data.ready, true);

    assert.ok(
        callLog.some((item) => item.channel === 'scene' && item.method === 'open-scene'),
        '应调用 scene.open-scene'
    );
}

async function testAssetManagementTools(): Promise<void> {
    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'asset-db.move-asset',
        'asset-db.query-path',
        'asset-db.query-url',
        'asset-db.query-uuid',
        'asset-db.reimport-asset',
        'asset-db.refresh-asset',
        'asset-db.open-asset'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

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
    assert.strictEqual(move!.result.isError, false);

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
    assert.strictEqual(queryPath!.result.isError, false);
    assert.ok(queryPath!.result.structuredContent.data.path.includes('/assets/a.prefab'));

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
    assert.strictEqual(queryUrl!.result.isError, false);
    assert.strictEqual(queryUrl!.result.structuredContent.data.url, 'db://assets/a.prefab');

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
    assert.strictEqual(queryUuid!.result.isError, false);
    assert.strictEqual(queryUuid!.result.structuredContent.data.uuid, 'uuid-a');

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
    assert.strictEqual(reimport!.result.isError, false);

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
    assert.strictEqual(refresh!.result.isError, false);

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
    assert.strictEqual(open!.result.isError, false);
}

async function testUnknownTool(): Promise<void> {
    const tools = createOfficialTools(async () => undefined);
    const matrix = createMatrix([]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

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
    assert.strictEqual(response!.error?.code, -32602);
}

async function run(): Promise<void> {
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
