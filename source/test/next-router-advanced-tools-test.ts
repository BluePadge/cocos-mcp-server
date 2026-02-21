import * as assert from 'assert';
import { CapabilityMatrix } from '../next/models';
import { NextToolRegistry } from '../next/protocol/tool-registry';
import { NextMcpRouter } from '../next/protocol/router';
import { createOfficialTools } from '../next/tools/official-tools';

function createMatrix(availableKeys: string[]): CapabilityMatrix {
    const byKey: CapabilityMatrix['byKey'] = {};
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

async function testSceneClipboardAndSaveAsTools(): Promise<void> {
    const callLog: Array<{ method: string; args: any[] }> = [];

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.copy-node',
        'scene.cut-node',
        'scene.paste-node',
        'scene.save-as-scene'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(copy!.result.isError, false);

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
    assert.strictEqual(cut!.result.isError, false);

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
    assert.strictEqual(paste!.result.isError, false);
    assert.strictEqual(paste!.result.structuredContent.data.pastedUuids.length, 1);

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
    assert.strictEqual(saveAs!.result.isError, false);
    assert.strictEqual(saveAs!.result.structuredContent.data.sceneUrl, 'db://assets/scenes/new-scene.scene');

    assert.ok(callLog.some((item) => item.method === 'copy-node'));
    assert.ok(callLog.some((item) => item.method === 'cut-node'));
    assert.ok(callLog.some((item) => item.method === 'paste-node'));
}

async function testComponentAdvancedTools(): Promise<void> {
    const dirtyStates = [false, false, false, false, false, false, false];
    let softReloadCalls = 0;
    let spawnCounter = 0;
    const rootChildren = ['node-base-1'];

    const toNode = (uuid: string): any => ({
        uuid: { value: uuid },
        name: { value: uuid },
        children: []
    });

    const toTree = (): any => ({
        uuid: { value: 'scene-root' },
        name: { value: 'MainScene' },
        children: rootChildren.map((uuid) => toNode(uuid))
    });

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.query-component',
        'scene.query-classes',
        'scene.query-component-has-script',
        'scene.execute-component-method',
        'scene.move-array-element',
        'scene.remove-array-element',
        'scene.reset-property'
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
    assert.strictEqual(queryComponent!.result.isError, false);

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
    assert.strictEqual(execute!.result.isError, false);
    assert.strictEqual(execute!.result.structuredContent.data.executed, true);

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
    assert.strictEqual(executeWithoutRollbackMutation!.result.isError, false);
    assert.strictEqual(executeWithoutRollbackMutation!.result.structuredContent.data.rollbackRequested, false);
    assert.strictEqual(executeWithoutRollbackMutation!.result.structuredContent.data.sceneMutated, true);
    assert.strictEqual(executeWithoutRollbackMutation!.result.structuredContent.data.rollbackApplied, false);
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
    assert.strictEqual(executeWithRollback!.result.isError, false);
    assert.strictEqual(executeWithRollback!.result.structuredContent.data.rollbackRequested, true);
    assert.strictEqual(executeWithRollback!.result.structuredContent.data.rollbackApplied, true);
    assert.strictEqual(executeWithRollback!.result.structuredContent.data.rollbackMethod, 'remove-node');
    assert.strictEqual(executeWithRollback!.result.structuredContent.data.rollbackVerified, true);
    assert.strictEqual(executeWithRollback!.result.structuredContent.data.sceneMutated, true);
    assert.strictEqual(executeWithRollback!.result.structuredContent.data.requiresSave, false);
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
    assert.strictEqual(reset!.result.isError, false);
}

async function testAssetExtendedTools(): Promise<void> {
    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'asset-db.generate-available-url',
        'asset-db.query-asset-meta',
        'asset-db.query-missing-asset-info',
        'asset-db.create-asset',
        'asset-db.import-asset',
        'asset-db.save-asset',
        'asset-db.save-asset-meta'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

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
    assert.strictEqual(createAsset!.result.isError, false);

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
    assert.strictEqual(importAsset!.result.isError, false);

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
    assert.strictEqual(saveMeta!.result.isError, false);
}

async function testEditorIntegrationTools(): Promise<void> {
    const callLog: Array<{ channel: string; method: string; args: any[] }> = [];

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
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
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(projectSettings!.result.isError, false);

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
    assert.strictEqual(queryNative!.result.isError, false);
    assert.strictEqual(queryNative!.result.structuredContent.data.isNative, true);

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
    assert.strictEqual(openUrl!.result.isError, false);
    assert.strictEqual(openUrl!.result.structuredContent.data.opened, true);

    assert.ok(callLog.some((item) => item.channel === 'program' && item.method === 'open-url'));
}

async function testPrefabLinkFallbackByReplacement(): Promise<void> {
    interface MockNode {
        uuid: string;
        name: string;
        parentUuid: string | null;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
        children: string[];
        prefab: null | {
            state: number;
            assetUuid: string;
        };
    }

    const nodes = new Map<string, MockNode>();
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

    function makeNodeDump(node: MockNode): any {
        const parent = node.parentUuid
            ? { value: { uuid: node.parentUuid }, type: 'cc.Node' }
            : { value: null, type: 'cc.Node' };
        const dump: Record<string, any> = {
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

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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
                        : options.assetUuid?.value
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
            const value = payload?.dump?.value;
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
            const uuid = payload?.uuid;
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.link-prefab',
        'scene.query-node'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

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
    assert.strictEqual(response!.result.isError, false);
    assert.strictEqual(response!.result.structuredContent.data.replaced, true);
    assert.strictEqual(response!.result.structuredContent.data.originalNodeUuid, 'old-node');
    assert.ok(typeof response!.result.structuredContent.data.nodeUuid === 'string');
    assert.notStrictEqual(response!.result.structuredContent.data.nodeUuid, 'old-node');
}

async function run(): Promise<void> {
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
