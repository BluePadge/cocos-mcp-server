import * as assert from 'assert';
import { CapabilityMatrix } from '../next/models';
import { createOfficialTools } from '../next/tools/official-tools';
import { NextToolRegistry } from '../next/protocol/tool-registry';
import { NextMcpRouter } from '../next/protocol/router';

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

async function main(): Promise<void> {
    const state = {
        nodeUuid: 'node-created-1',
        componentUuid: 'component-label-1',
        setPropertyCalls: [] as Array<any>
    };

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
        if (channel === 'scene' && method === 'create-node') {
            return state.nodeUuid;
        }
        if (channel === 'scene' && method === 'create-component') {
            return undefined;
        }
        if (channel === 'scene' && method === 'query-node') {
            return {
                uuid: { value: state.nodeUuid },
                __comps__: [
                    {
                        __type__: { value: 'cc.Label' },
                        uuid: { value: state.componentUuid }
                    }
                ]
            };
        }
        if (channel === 'scene' && method === 'set-property') {
            state.setPropertyCalls.push(args[0]);
            return true;
        }
        if (channel === 'asset-db' && method === 'query-asset-dependencies') {
            return ['dep-1', 'dep-2'];
        }
        if (channel === 'asset-db' && method === 'query-asset-info') {
            const uuid = args[0];
            return {
                uuid,
                url: `db://assets/${uuid}.prefab`
            };
        }
        throw new Error(`Unexpected request: ${channel}.${method}`);
    };

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'scene.create-node',
        'scene.create-component',
        'scene.query-node',
        'scene.set-property',
        'asset-db.query-asset-dependencies',
        'asset-db.query-asset-info'
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
    assert.ok(toolNames.includes('scene_create_game_object'));
    assert.ok(toolNames.includes('component_add_component'));
    assert.ok(toolNames.includes('component_set_property'));
    assert.ok(toolNames.includes('asset_query_dependencies'));

    const createNodeResponse = await router.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'scene_create_game_object',
            arguments: {
                name: 'UIRoot'
            }
        }
    });
    assert.ok(createNodeResponse);
    assert.strictEqual(createNodeResponse!.result.isError, false);
    assert.strictEqual(createNodeResponse!.result.structuredContent.data.nodeUuid, state.nodeUuid);

    const addComponentResponse = await router.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
            name: 'component_add_component',
            arguments: {
                nodeUuid: state.nodeUuid,
                componentType: 'cc.Label'
            }
        }
    });
    assert.ok(addComponentResponse);
    assert.strictEqual(addComponentResponse!.result.isError, false);

    const setPropertyResponse = await router.handle({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
            name: 'component_set_property',
            arguments: {
                nodeUuid: state.nodeUuid,
                componentType: 'cc.Label',
                propertyPath: 'string',
                value: 'Hello Workflow',
                valueType: 'String'
            }
        }
    });
    assert.ok(setPropertyResponse);
    assert.strictEqual(setPropertyResponse!.result.isError, false);
    assert.strictEqual(state.setPropertyCalls.length, 1);
    assert.strictEqual(state.setPropertyCalls[0].path, '__comps__.0.string');
    assert.strictEqual(state.setPropertyCalls[0].dump.value, 'Hello Workflow');

    const dependenciesResponse = await router.handle({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
            name: 'asset_query_dependencies',
            arguments: {
                urlOrUuid: 'db://assets/prefabs/player.prefab',
                relationType: 'asset',
                includeAssetInfo: true
            }
        }
    });
    assert.ok(dependenciesResponse);
    assert.strictEqual(dependenciesResponse!.result.isError, false);
    assert.strictEqual(dependenciesResponse!.result.structuredContent.data.count, 2);
    assert.strictEqual(dependenciesResponse!.result.structuredContent.data.dependencyInfos.length, 2);

    const traceId = dependenciesResponse!.result.structuredContent.meta.traceId;
    const traceResponse = await router.handle({
        jsonrpc: '2.0',
        id: 6,
        method: 'get_trace_by_id',
        params: { traceId }
    });
    assert.ok(traceResponse);
    assert.strictEqual(traceResponse!.result.trace.traceId, traceId);
    assert.strictEqual(traceResponse!.result.trace.tool, 'asset_query_dependencies');

    console.log('next-workflow-test: PASS');
}

main().catch((error) => {
    console.error('next-workflow-test: FAIL');
    console.error(error);
    process.exit(1);
});
