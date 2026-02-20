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
function createRuntimeMatrix() {
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
async function testRuntimeQueryAndWaitTools() {
    var _a, _b;
    let builderReadyCounter = 0;
    let assetReadyCounter = 0;
    const requester = async (channel, method) => {
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
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const registry = new tool_registry_1.NextToolRegistry(tools, createRuntimeMatrix());
    const router = new router_1.NextMcpRouter(registry);
    const list = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    assert.ok(list);
    const runtimeTools = list.result.tools.filter((item) => String(item.name).startsWith('runtime_'));
    const executeMeta = (_a = runtimeTools.find((item) => item.name === 'runtime_execute_scene_script')) === null || _a === void 0 ? void 0 : _a._meta;
    const queryMeta = (_b = runtimeTools.find((item) => item.name === 'runtime_query_control_state')) === null || _b === void 0 ? void 0 : _b._meta;
    assert.ok(runtimeTools.some((item) => item.name === 'runtime_query_control_state'));
    assert.ok(runtimeTools.some((item) => item.name === 'runtime_wait_until_ready'));
    assert.strictEqual(executeMeta === null || executeMeta === void 0 ? void 0 : executeMeta.safety, 'cautious');
    assert.strictEqual(executeMeta === null || executeMeta === void 0 ? void 0 : executeMeta.idempotent, false);
    assert.strictEqual(queryMeta === null || queryMeta === void 0 ? void 0 : queryMeta.safety, 'safe');
    assert.strictEqual(queryMeta === null || queryMeta === void 0 ? void 0 : queryMeta.idempotent, true);
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
    assert.strictEqual(query.result.isError, false);
    assert.strictEqual(query.result.structuredContent.data.scene.isReady, true);
    assert.strictEqual(query.result.structuredContent.data.server.port, 7456);
    assert.ok(query.result.structuredContent.data.server.previewUrls.includes('http://127.0.0.1:7456'));
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
    assert.strictEqual(waitReady.result.isError, false);
    assert.strictEqual(waitReady.result.structuredContent.data.ready, true);
    assert.ok(waitReady.result.structuredContent.data.snapshots.length >= 1);
    assert.strictEqual(waitReady.result.structuredContent.data.finalSnapshot.builderReady, true);
    assert.strictEqual(waitReady.result.structuredContent.data.finalSnapshot.assetDbReady, true);
}
async function testRuntimeActionsAndCycle() {
    const builderOpenCalls = [];
    const scriptCalls = [];
    let softReloadCount = 0;
    let snapshotCount = 0;
    let snapshotAbortCount = 0;
    const requester = async (channel, method, ...args) => {
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
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const registry = new tool_registry_1.NextToolRegistry(tools, createRuntimeMatrix());
    const router = new router_1.NextMcpRouter(registry);
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
    assert.strictEqual(openBuilder.result.isError, false);
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
    assert.strictEqual(softReload.result.isError, false);
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
    assert.strictEqual(snapshot.result.isError, false);
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
    assert.strictEqual(abortSnapshot.result.isError, false);
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
    assert.strictEqual(executeScript.result.isError, false);
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
    assert.strictEqual(testCycle.result.isError, false);
    assert.strictEqual(testCycle.result.structuredContent.data.success, true);
    assert.ok(Array.isArray(testCycle.result.structuredContent.data.steps));
    assert.ok(testCycle.result.structuredContent.data.steps.some((item) => item.name === 'wait_ready' && item.success));
    assert.ok(testCycle.result.structuredContent.data.steps.some((item) => item.name === 'execute_scene_script' && item.success));
    assert.strictEqual(snapshotCount, 1);
    assert.strictEqual(snapshotAbortCount, 1);
    assert.strictEqual(softReloadCount, 3);
}
async function run() {
    await testRuntimeQueryAndWaitTools();
    await testRuntimeActionsAndCycle();
    console.log('next-runtime-control-tools-test: PASS');
}
run().catch((error) => {
    console.error('next-runtime-control-tools-test: FAIL', error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1ydW50aW1lLWNvbnRyb2wtdG9vbHMtdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90ZXN0L25leHQtcnVudGltZS1jb250cm9sLXRvb2xzLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUN4RCxpRUFBbUU7QUFFbkUsU0FBUyxZQUFZLENBQUMsYUFBdUI7SUFDekMsTUFBTSxLQUFLLEdBQThCLEVBQUUsQ0FBQztJQUM1QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ1QsR0FBRztZQUNILE9BQU87WUFDUCxNQUFNO1lBQ04sS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQztZQUNySSxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtT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QUUsQ0FBQztJQUNyQyxNQUFNLDBCQUEwQixFQUFFLENBQUM7SUFDbkMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0FBQ3pELENBQUM7QUFFRCxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzlELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhcGFiaWxpdHlNYXRyaXggfSBmcm9tICcuLi9uZXh0L21vZGVscyc7XG5pbXBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmltcG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3JvdXRlcic7XG5pbXBvcnQgeyBjcmVhdGVPZmZpY2lhbFRvb2xzIH0gZnJvbSAnLi4vbmV4dC90b29scy9vZmZpY2lhbC10b29scyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdHJpeChhdmFpbGFibGVLZXlzOiBzdHJpbmdbXSk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIGNvbnN0IGJ5S2V5OiBDYXBhYmlsaXR5TWF0cml4WydieUtleSddID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgb2YgYXZhaWxhYmxlS2V5cykge1xuICAgICAgICBjb25zdCBmaXJzdERvdCA9IGtleS5pbmRleE9mKCcuJyk7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBrZXkuc2xpY2UoMCwgZmlyc3REb3QpO1xuICAgICAgICBjb25zdCBtZXRob2QgPSBrZXkuc2xpY2UoZmlyc3REb3QgKyAxKTtcbiAgICAgICAgYnlLZXlba2V5XSA9IHtcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGNoYW5uZWwsXG4gICAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIHJlYWRvbmx5OiAha2V5LmluY2x1ZGVzKCdvcGVuJykgJiYgIWtleS5pbmNsdWRlcygnc29mdC1yZWxvYWQnKSAmJiAha2V5LmluY2x1ZGVzKCdzbmFwc2hvdCcpICYmICFrZXkuaW5jbHVkZXMoJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0JyksXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjoga2V5LFxuICAgICAgICAgICAgYXZhaWxhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBkZXRhaWw6ICdvaydcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBieUtleSxcbiAgICAgICAgc3VtbWFyeToge1xuICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHVuYXZhaWxhYmxlOiAwLFxuICAgICAgICAgICAgYnlMYXllcjoge1xuICAgICAgICAgICAgICAgIG9mZmljaWFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXh0ZW5kZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVSdW50aW1lTWF0cml4KCk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIHJldHVybiBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUucXVlcnktaXMtcmVhZHknLFxuICAgICAgICAnc2NlbmUucXVlcnktZGlydHknLFxuICAgICAgICAnc2NlbmUuZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLFxuICAgICAgICAnc2NlbmUuc29mdC1yZWxvYWQnLFxuICAgICAgICAnc2NlbmUuc25hcHNob3QnLFxuICAgICAgICAnc2NlbmUuc25hcHNob3QtYWJvcnQnLFxuICAgICAgICAnYnVpbGRlci5vcGVuJyxcbiAgICAgICAgJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5JyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LXJlYWR5JyxcbiAgICAgICAgJ3NlcnZlci5xdWVyeS1pcC1saXN0JyxcbiAgICAgICAgJ3NlcnZlci5xdWVyeS1wb3J0J1xuICAgIF0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0UnVudGltZVF1ZXJ5QW5kV2FpdFRvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxldCBidWlsZGVyUmVhZHlDb3VudGVyID0gMDtcbiAgICBsZXQgYXNzZXRSZWFkeUNvdW50ZXIgPSAwO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcpOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1pcy1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWRpcnR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYnVpbGRlcicgJiYgbWV0aG9kID09PSAncXVlcnktd29ya2VyLXJlYWR5Jykge1xuICAgICAgICAgICAgYnVpbGRlclJlYWR5Q291bnRlciArPSAxO1xuICAgICAgICAgICAgcmV0dXJuIGJ1aWxkZXJSZWFkeUNvdW50ZXIgPj0gMjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1yZWFkeScpIHtcbiAgICAgICAgICAgIGFzc2V0UmVhZHlDb3VudGVyICs9IDE7XG4gICAgICAgICAgICByZXR1cm4gYXNzZXRSZWFkeUNvdW50ZXIgPj0gMztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NlcnZlcicgJiYgbWV0aG9kID09PSAncXVlcnktaXAtbGlzdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBbJzEyNy4wLjAuMSddO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2VydmVyJyAmJiBtZXRob2QgPT09ICdxdWVyeS1wb3J0Jykge1xuICAgICAgICAgICAgcmV0dXJuIDc0NTY7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2FsbDogJHtjaGFubmVsfS4ke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgY3JlYXRlUnVudGltZU1hdHJpeCgpKTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICB9KTtcbiAgICBhc3NlcnQub2sobGlzdCk7XG4gICAgY29uc3QgcnVudGltZVRvb2xzID0gbGlzdCEucmVzdWx0LnRvb2xzLmZpbHRlcigoaXRlbTogYW55KSA9PiBTdHJpbmcoaXRlbS5uYW1lKS5zdGFydHNXaXRoKCdydW50aW1lXycpKTtcbiAgICBjb25zdCBleGVjdXRlTWV0YSA9IHJ1bnRpbWVUb29scy5maW5kKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSA9PT0gJ3J1bnRpbWVfZXhlY3V0ZV9zY2VuZV9zY3JpcHQnKT8uX21ldGE7XG4gICAgY29uc3QgcXVlcnlNZXRhID0gcnVudGltZVRvb2xzLmZpbmQoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lID09PSAncnVudGltZV9xdWVyeV9jb250cm9sX3N0YXRlJyk/Ll9tZXRhO1xuICAgIGFzc2VydC5vayhydW50aW1lVG9vbHMuc29tZSgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUgPT09ICdydW50aW1lX3F1ZXJ5X2NvbnRyb2xfc3RhdGUnKSk7XG4gICAgYXNzZXJ0Lm9rKHJ1bnRpbWVUb29scy5zb21lKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSA9PT0gJ3J1bnRpbWVfd2FpdF91bnRpbF9yZWFkeScpKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZXhlY3V0ZU1ldGE/LnNhZmV0eSwgJ2NhdXRpb3VzJyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGV4ZWN1dGVNZXRhPy5pZGVtcG90ZW50LCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5TWV0YT8uc2FmZXR5LCAnc2FmZScpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeU1ldGE/LmlkZW1wb3RlbnQsIHRydWUpO1xuXG4gICAgY29uc3QgcXVlcnkgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAyLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9xdWVyeV9jb250cm9sX3N0YXRlJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhxdWVyeSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc2NlbmUuaXNSZWFkeSwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zZXJ2ZXIucG9ydCwgNzQ1Nik7XG4gICAgYXNzZXJ0Lm9rKHF1ZXJ5IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zZXJ2ZXIucHJldmlld1VybHMuaW5jbHVkZXMoJ2h0dHA6Ly8xMjcuMC4wLjE6NzQ1NicpKTtcblxuICAgIGNvbnN0IHdhaXRSZWFkeSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdydW50aW1lX3dhaXRfdW50aWxfcmVhZHknLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdGltZW91dE1zOiA1MDAwLFxuICAgICAgICAgICAgICAgIGludGVydmFsTXM6IDIwXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sod2FpdFJlYWR5KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwod2FpdFJlYWR5IS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh3YWl0UmVhZHkhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnJlYWR5LCB0cnVlKTtcbiAgICBhc3NlcnQub2sod2FpdFJlYWR5IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zbmFwc2hvdHMubGVuZ3RoID49IDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh3YWl0UmVhZHkhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmZpbmFsU25hcHNob3QuYnVpbGRlclJlYWR5LCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwod2FpdFJlYWR5IS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5maW5hbFNuYXBzaG90LmFzc2V0RGJSZWFkeSwgdHJ1ZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3RSdW50aW1lQWN0aW9uc0FuZEN5Y2xlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGJ1aWxkZXJPcGVuQ2FsbHM6IGFueVtdID0gW107XG4gICAgY29uc3Qgc2NyaXB0Q2FsbHM6IGFueVtdID0gW107XG4gICAgbGV0IHNvZnRSZWxvYWRDb3VudCA9IDA7XG4gICAgbGV0IHNuYXBzaG90Q291bnQgPSAwO1xuICAgIGxldCBzbmFwc2hvdEFib3J0Q291bnQgPSAwO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktaXMtcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1kaXJ0eScpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2J1aWxkZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXdvcmtlci1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXJlYWR5Jykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzZXJ2ZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWlwLWxpc3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gWycxMjcuMC4wLjEnXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NlcnZlcicgJiYgbWV0aG9kID09PSAncXVlcnktcG9ydCcpIHtcbiAgICAgICAgICAgIHJldHVybiA3NDU2O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYnVpbGRlcicgJiYgbWV0aG9kID09PSAnb3BlbicpIHtcbiAgICAgICAgICAgIGJ1aWxkZXJPcGVuQ2FsbHMucHVzaChhcmdzKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnc29mdC1yZWxvYWQnKSB7XG4gICAgICAgICAgICBzb2Z0UmVsb2FkQ291bnQgKz0gMTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnc25hcHNob3QnKSB7XG4gICAgICAgICAgICBzbmFwc2hvdENvdW50ICs9IDE7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3NuYXBzaG90LWFib3J0Jykge1xuICAgICAgICAgICAgc25hcHNob3RBYm9ydENvdW50ICs9IDE7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jykge1xuICAgICAgICAgICAgc2NyaXB0Q2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgb2s6IHRydWUsXG4gICAgICAgICAgICAgICAgZWNobzogYXJnc1swXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfSgke0pTT04uc3RyaW5naWZ5KGFyZ3MpfSlgKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgY3JlYXRlUnVudGltZU1hdHJpeCgpKTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBvcGVuQnVpbGRlciA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEwLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9vcGVuX2J1aWxkZXJfcGFuZWwnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgcGFuZWw6ICdidWlsZC1idW5kbGUnLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgZm9jdXM6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sob3BlbkJ1aWxkZXIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChvcGVuQnVpbGRlciEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYnVpbGRlck9wZW5DYWxscy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChidWlsZGVyT3BlbkNhbGxzWzBdWzBdLCAnYnVpbGQtYnVuZGxlJyk7XG5cbiAgICBjb25zdCBzb2Z0UmVsb2FkID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdydW50aW1lX3NvZnRfcmVsb2FkX3NjZW5lJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzb2Z0UmVsb2FkKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc29mdFJlbG9hZCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdydW50aW1lX3Rha2Vfc2NlbmVfc25hcHNob3QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNuYXBzaG90KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc25hcHNob3QhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG5cbiAgICBjb25zdCBhYm9ydFNuYXBzaG90ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMTMsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdydW50aW1lX2Fib3J0X3NjZW5lX3NuYXBzaG90JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge31cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhhYm9ydFNuYXBzaG90KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYWJvcnRTbmFwc2hvdCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IGV4ZWN1dGVTY3JpcHQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxNCxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3J1bnRpbWVfZXhlY3V0ZV9zY2VuZV9zY3JpcHQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ21jcC10ZXN0JyxcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdwaW5nJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbMSwgJ29rJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhleGVjdXRlU2NyaXB0KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZXhlY3V0ZVNjcmlwdCEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2NyaXB0Q2FsbHMubGVuZ3RoLCAxKTtcblxuICAgIGNvbnN0IHRlc3RDeWNsZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDE1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9leGVjdXRlX3Rlc3RfY3ljbGUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdGltZW91dE1zOiAyMDAwLFxuICAgICAgICAgICAgICAgIGludGVydmFsTXM6IDEwLFxuICAgICAgICAgICAgICAgIHJ1blNvZnRSZWxvYWRCZWZvcmU6IHRydWUsXG4gICAgICAgICAgICAgICAgcnVuU29mdFJlbG9hZEFmdGVyOiB0cnVlLFxuICAgICAgICAgICAgICAgIGZhaWxPbkRpcnR5OiB0cnVlLFxuICAgICAgICAgICAgICAgIHNjZW5lU2NyaXB0OiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdtY3AtdGVzdCcsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ3BpbmcnLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbJ2N5Y2xlJ11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sodGVzdEN5Y2xlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEN5Y2xlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0Q3ljbGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnN1Y2Nlc3MsIHRydWUpO1xuICAgIGFzc2VydC5vayhBcnJheS5pc0FycmF5KHRlc3RDeWNsZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc3RlcHMpKTtcbiAgICBhc3NlcnQub2sodGVzdEN5Y2xlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5zdGVwcy5zb21lKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSA9PT0gJ3dhaXRfcmVhZHknICYmIGl0ZW0uc3VjY2VzcykpO1xuICAgIGFzc2VydC5vayh0ZXN0Q3ljbGUhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnN0ZXBzLnNvbWUoKGl0ZW06IGFueSkgPT4gaXRlbS5uYW1lID09PSAnZXhlY3V0ZV9zY2VuZV9zY3JpcHQnICYmIGl0ZW0uc3VjY2VzcykpO1xuXG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90Q291bnQsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzbmFwc2hvdEFib3J0Q291bnQsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzb2Z0UmVsb2FkQ291bnQsIDMpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGVzdFJ1bnRpbWVRdWVyeUFuZFdhaXRUb29scygpO1xuICAgIGF3YWl0IHRlc3RSdW50aW1lQWN0aW9uc0FuZEN5Y2xlKCk7XG4gICAgY29uc29sZS5sb2coJ25leHQtcnVudGltZS1jb250cm9sLXRvb2xzLXRlc3Q6IFBBU1MnKTtcbn1cblxucnVuKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcignbmV4dC1ydW50aW1lLWNvbnRyb2wtdG9vbHMtdGVzdDogRkFJTCcsIGVycm9yKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG59KTtcbiJdfQ==