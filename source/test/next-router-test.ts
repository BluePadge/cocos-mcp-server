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

    const tools = createOfficialTools(requester);
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
        callLog.some((item) => item.channel === 'asset-db' && item.method === 'open-asset'),
        '应调用 asset-db.open-asset'
    );
}

async function testSceneViewTools(): Promise<void> {
    const state = {
        is2D: false,
        gizmoTool: 'move',
        gizmoPivot: 'center',
        gizmoCoordinate: 'local',
        isGridVisible: true,
        isIconGizmo3D: true,
        iconGizmoSize: 1
    };
    const alignCalls: string[] = [];

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

    const tools = createOfficialTools(requester);
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
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(queryState!.result.isError, false);
    assert.strictEqual(queryState!.result.structuredContent.data.state.is2D, false);
    assert.strictEqual(queryState!.result.structuredContent.data.state.gizmoTool, 'move');

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
    assert.strictEqual(setMode!.result.isError, false);
    assert.strictEqual(setMode!.result.structuredContent.data.current, true);

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
    assert.strictEqual(setTool!.result.isError, false);
    assert.strictEqual(setTool!.result.structuredContent.data.current, 'rotate');

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
    assert.strictEqual(setGrid!.result.isError, false);
    assert.strictEqual(setGrid!.result.structuredContent.data.current, false);

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
    assert.strictEqual(setIconSize!.result.isError, false);
    assert.strictEqual(setIconSize!.result.structuredContent.data.current, 2);

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
    assert.strictEqual(alignWithView!.result.isError, false);

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
    assert.strictEqual(alignViewWithNode!.result.isError, false);
    assert.deepStrictEqual(alignCalls, ['align-with-view', 'align-view-with-node']);
}

async function testUiAutomationTools(): Promise<void> {
    interface MockNode {
        uuid: string;
        name: string;
        parent: string | null;
        children: string[];
        components: string[];
    }

    const nodes = new Map<string, MockNode>();
    const createdNodeCalls: any[] = [];
    const createdComponentCalls: any[] = [];
    const setPropertyCalls: any[] = [];
    let nodeCounter = 0;

    const ensureNode = (node: MockNode): void => {
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

    const createNodeDump = (uuid: string): any => {
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

    const createTreeDump = (uuid: string): any => {
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

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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

            const node: MockNode = {
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

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.query-node-tree',
        'scene.query-node',
        'scene.create-node',
        'scene.create-component',
        'scene.set-property'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 300,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(createElement!.result.isError, false);
    const createdNodeUuid = createElement!.result.structuredContent.data.nodeUuid as string;
    assert.strictEqual(createdNodeCalls.length, 1);
    assert.strictEqual(createdNodeCalls[0].parent, 'canvas-1');
    assert.strictEqual(createdNodeCalls[0].name, 'Title');
    assert.ok(createElement!.result.structuredContent.data.ensuredComponents.includes('cc.UITransform'));
    assert.ok(createElement!.result.structuredContent.data.ensuredComponents.includes('cc.Label'));

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
    assert.strictEqual(setRect!.result.isError, false);

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
    assert.strictEqual(setText!.result.isError, false);

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
    assert.strictEqual(setLayout!.result.isError, false);

    assert.ok(createdComponentCalls.some((item) => item.component === 'cc.Label'));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('contentSize')));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('.string')));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('.type')));
    assert.ok(setPropertyCalls.some((item) => item.path.includes('paddingLeft')));
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

async function testPrefabLifecycleTools(): Promise<void> {
    const restoreCalls: string[] = [];
    const resetNodeCalls: any[] = [];
    const resetComponentCalls: any[] = [];
    const createNodeCalls: any[] = [];
    const removeNodeCalls: any[] = [];
    const applyCalls: any[] = [];
    const createPrefabCalls: any[] = [];
    const linkPrefabCalls: any[] = [];
    const unlinkPrefabCalls: any[] = [];
    const queriedAssetUuids: string[] = [];
    let createAttempt = 0;

    const prefabNodeStates: Record<string, { state: number; assetUuid: string } | null> = {
        'node-prefab-1': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-prefab-2': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-ref-only': null,
        'node-created-invalid': null,
        'node-created-from-prefab': { state: 1, assetUuid: 'asset-prefab-1' },
        'node-link-target': null
    };
    const createdPrefabAssets: Record<string, string> = {};

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
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
            const prefabState = prefabNodeStates[nodeUuid as string];
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
            let nodeUuid: string | undefined;
            let targetUrl: string | undefined;
            if (typeof firstArg === 'string' && typeof secondArg === 'string') {
                nodeUuid = firstArg;
                targetUrl = secondArg;
            } else if (firstArg && typeof firstArg === 'object') {
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
            let nodeUuid: string | undefined;
            let assetUuid: string | undefined;
            if (typeof firstArg === 'string' && typeof secondArg === 'string') {
                nodeUuid = firstArg;
                assetUuid = secondArg;
            } else if (firstArg && typeof firstArg === 'object') {
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
            let nodeUuid: string | undefined;
            let removeNested = false;
            if (typeof firstArg === 'string') {
                nodeUuid = firstArg;
                removeNested = Boolean(secondArg);
            } else if (firstArg && typeof firstArg === 'object') {
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

    const tools = createOfficialTools(requester);
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
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    const listResponse = await router.handle({
        jsonrpc: '2.0',
        id: 40,
        method: 'tools/list'
    });
    assert.ok(listResponse);
    const toolNames = listResponse!.result.tools.map((item: any) => item.name);
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
    assert.strictEqual(createInstance!.result.isError, false);
    assert.strictEqual(createInstance!.result.structuredContent.data.nodeUuid, 'node-created-from-prefab');
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
    assert.strictEqual(createPrefabAsset!.result.isError, false);
    assert.strictEqual(createPrefabCalls.length, 1);
    assert.strictEqual(createPrefabAsset!.result.structuredContent.data.prefabUuid, 'asset-created-prefab-1');

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
    assert.strictEqual(linkNode!.result.isError, false);
    assert.strictEqual(linkPrefabCalls.length, 1);
    assert.strictEqual(linkNode!.result.structuredContent.data.after.prefabAssetUuid, 'asset-prefab-link-1');

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
    assert.strictEqual(unlinkNode!.result.isError, false);
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
    assert.strictEqual(queryNodes!.result.isError, false);
    assert.strictEqual(queryNodes!.result.structuredContent.data.count, 3);

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
    assert.strictEqual(queryInstanceNodes!.result.isError, false);
    assert.strictEqual(queryInstanceNodes!.result.structuredContent.data.count, 2);
    assert.strictEqual(queryInstanceNodes!.result.structuredContent.data.skipped.length, 1);
    assert.strictEqual(queryInstanceNodes!.result.structuredContent.data.skipped[0].nodeUuid, 'node-ref-only');

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
    assert.strictEqual(instanceInfo!.result.isError, false);
    assert.strictEqual(instanceInfo!.result.structuredContent.data.isPrefabInstance, true);
    assert.strictEqual(instanceInfo!.result.structuredContent.data.prefabAssetUuid, 'asset-prefab-1');

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
    assert.strictEqual(applySingle!.result.isError, false);

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
    assert.strictEqual(applyBatch!.result.isError, false);
    assert.strictEqual(applyBatch!.result.structuredContent.data.successCount, 2);
    assert.strictEqual(applyBatch!.result.structuredContent.data.failureCount, 1);
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
    assert.strictEqual(restoreSingle!.result.isError, false);

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
    assert.strictEqual(restoreBatch!.result.isError, false);
    assert.strictEqual(restoreBatch!.result.structuredContent.data.successCount, 3);

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
    assert.strictEqual(resetNode!.result.isError, false);
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
    assert.strictEqual(resetComponent!.result.isError, false);
    assert.strictEqual(resetComponentCalls.length, 1);
    assert.ok(restoreCalls.length >= 4);
    assert.ok(restoreCalls.includes('node-prefab-1'));
    assert.ok(restoreCalls.includes('node-prefab-2'));
    assert.ok(restoreCalls.includes('node-ref-only'));
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
