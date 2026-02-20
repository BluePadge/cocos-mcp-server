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
            readonly: !key.includes('open') && !key.includes('soft-reload') && !key.includes('snapshot') && !key.includes('execute-scene-script'),
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

function createRuntimeMatrix(): CapabilityMatrix {
    return createMatrix([
        'scene.query-is-ready',
        'scene.query-dirty',
        'scene.execute-scene-script',
        'scene.soft-reload',
        'scene.snapshot',
        'scene.snapshot-abort',
        'builder.open',
        'builder.query-worker-ready',
        'asset-db.query-ready',
        'server.query-ip-list',
        'server.query-port'
    ]);
}

async function testRuntimeQueryAndWaitTools(): Promise<void> {
    let builderReadyCounter = 0;
    let assetReadyCounter = 0;

    const requester = async (channel: string, method: string): Promise<any> => {
        if (channel === 'scene' && method === 'query-is-ready') {
            return true;
        }
        if (channel === 'scene' && method === 'query-dirty') {
            return false;
        }
        if (channel === 'builder' && method === 'query-worker-ready') {
            builderReadyCounter += 1;
            return builderReadyCounter >= 2;
        }
        if (channel === 'asset-db' && method === 'query-ready') {
            assetReadyCounter += 1;
            return assetReadyCounter >= 3;
        }
        if (channel === 'server' && method === 'query-ip-list') {
            return ['127.0.0.1'];
        }
        if (channel === 'server' && method === 'query-port') {
            return 7456;
        }

        throw new Error(`Unexpected call: ${channel}.${method}`);
    };

    const tools = createOfficialTools(requester);
    const registry = new NextToolRegistry(tools, createRuntimeMatrix());
    const router = new NextMcpRouter(registry);

    const list = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    assert.ok(list);
    const runtimeTools = list!.result.tools.filter((item: any) => String(item.name).startsWith('runtime_'));
    const executeMeta = runtimeTools.find((item: any) => item.name === 'runtime_execute_scene_script')?._meta;
    const queryMeta = runtimeTools.find((item: any) => item.name === 'runtime_query_control_state')?._meta;
    assert.ok(runtimeTools.some((item: any) => item.name === 'runtime_query_control_state'));
    assert.ok(runtimeTools.some((item: any) => item.name === 'runtime_wait_until_ready'));
    assert.strictEqual(executeMeta?.safety, 'cautious');
    assert.strictEqual(executeMeta?.idempotent, false);
    assert.strictEqual(queryMeta?.safety, 'safe');
    assert.strictEqual(queryMeta?.idempotent, true);

    const query = await router.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'runtime_query_control_state',
            arguments: {}
        }
    });
    assert.ok(query);
    assert.strictEqual(query!.result.isError, false);
    assert.strictEqual(query!.result.structuredContent.data.scene.isReady, true);
    assert.strictEqual(query!.result.structuredContent.data.server.port, 7456);
    assert.ok(query!.result.structuredContent.data.server.previewUrls.includes('http://127.0.0.1:7456'));

    const waitReady = await router.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
            name: 'runtime_wait_until_ready',
            arguments: {
                timeoutMs: 5000,
                intervalMs: 20
            }
        }
    });
    assert.ok(waitReady);
    assert.strictEqual(waitReady!.result.isError, false);
    assert.strictEqual(waitReady!.result.structuredContent.data.ready, true);
    assert.ok(waitReady!.result.structuredContent.data.snapshots.length >= 1);
    assert.strictEqual(waitReady!.result.structuredContent.data.finalSnapshot.builderReady, true);
    assert.strictEqual(waitReady!.result.structuredContent.data.finalSnapshot.assetDbReady, true);
}

async function testRuntimeActionsAndCycle(): Promise<void> {
    const builderOpenCalls: any[] = [];
    const scriptCalls: any[] = [];
    let softReloadCount = 0;
    let snapshotCount = 0;
    let snapshotAbortCount = 0;

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
        if (channel === 'scene' && method === 'query-is-ready') {
            return true;
        }
        if (channel === 'scene' && method === 'query-dirty') {
            return false;
        }
        if (channel === 'builder' && method === 'query-worker-ready') {
            return true;
        }
        if (channel === 'asset-db' && method === 'query-ready') {
            return true;
        }
        if (channel === 'server' && method === 'query-ip-list') {
            return ['127.0.0.1'];
        }
        if (channel === 'server' && method === 'query-port') {
            return 7456;
        }
        if (channel === 'builder' && method === 'open') {
            builderOpenCalls.push(args);
            return undefined;
        }
        if (channel === 'scene' && method === 'soft-reload') {
            softReloadCount += 1;
            return undefined;
        }
        if (channel === 'scene' && method === 'snapshot') {
            snapshotCount += 1;
            return undefined;
        }
        if (channel === 'scene' && method === 'snapshot-abort') {
            snapshotAbortCount += 1;
            return undefined;
        }
        if (channel === 'scene' && method === 'execute-scene-script') {
            scriptCalls.push(args[0]);
            return {
                ok: true,
                echo: args[0]
            };
        }

        throw new Error(`Unexpected call: ${channel}.${method}(${JSON.stringify(args)})`);
    };

    const tools = createOfficialTools(requester);
    const registry = new NextToolRegistry(tools, createRuntimeMatrix());
    const router = new NextMcpRouter(registry);

    const openBuilder = await router.handle({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
            name: 'runtime_open_builder_panel',
            arguments: {
                panel: 'build-bundle',
                options: {
                    focus: true
                }
            }
        }
    });
    assert.ok(openBuilder);
    assert.strictEqual(openBuilder!.result.isError, false);
    assert.strictEqual(builderOpenCalls.length, 1);
    assert.strictEqual(builderOpenCalls[0][0], 'build-bundle');

    const softReload = await router.handle({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
            name: 'runtime_soft_reload_scene',
            arguments: {}
        }
    });
    assert.ok(softReload);
    assert.strictEqual(softReload!.result.isError, false);

    const snapshot = await router.handle({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
            name: 'runtime_take_scene_snapshot',
            arguments: {}
        }
    });
    assert.ok(snapshot);
    assert.strictEqual(snapshot!.result.isError, false);

    const abortSnapshot = await router.handle({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
            name: 'runtime_abort_scene_snapshot',
            arguments: {}
        }
    });
    assert.ok(abortSnapshot);
    assert.strictEqual(abortSnapshot!.result.isError, false);

    const executeScript = await router.handle({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
            name: 'runtime_execute_scene_script',
            arguments: {
                name: 'mcp-test',
                method: 'ping',
                args: [1, 'ok']
            }
        }
    });
    assert.ok(executeScript);
    assert.strictEqual(executeScript!.result.isError, false);
    assert.strictEqual(scriptCalls.length, 1);

    const testCycle = await router.handle({
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
            name: 'runtime_execute_test_cycle',
            arguments: {
                timeoutMs: 2000,
                intervalMs: 10,
                runSoftReloadBefore: true,
                runSoftReloadAfter: true,
                failOnDirty: true,
                sceneScript: {
                    name: 'mcp-test',
                    method: 'ping',
                    args: ['cycle']
                }
            }
        }
    });
    assert.ok(testCycle);
    assert.strictEqual(testCycle!.result.isError, false);
    assert.strictEqual(testCycle!.result.structuredContent.data.success, true);
    assert.ok(Array.isArray(testCycle!.result.structuredContent.data.steps));
    assert.ok(testCycle!.result.structuredContent.data.steps.some((item: any) => item.name === 'wait_ready' && item.success));
    assert.ok(testCycle!.result.structuredContent.data.steps.some((item: any) => item.name === 'execute_scene_script' && item.success));

    assert.strictEqual(snapshotCount, 1);
    assert.strictEqual(snapshotAbortCount, 1);
    assert.strictEqual(softReloadCount, 3);
}

async function run(): Promise<void> {
    await testRuntimeQueryAndWaitTools();
    await testRuntimeActionsAndCycle();
    console.log('next-runtime-control-tools-test: PASS');
}

run().catch((error) => {
    console.error('next-runtime-control-tools-test: FAIL', error);
    process.exit(1);
});
