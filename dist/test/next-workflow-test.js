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
const official_tools_1 = require("../next/tools/official-tools");
const tool_registry_1 = require("../next/protocol/tool-registry");
const router_1 = require("../next/protocol/router");
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
async function main() {
    const state = {
        nodeUuid: 'node-created-1',
        componentUuid: 'component-label-1',
        setPropertyCalls: []
    };
    const requester = async (channel, method, ...args) => {
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
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'scene.create-node',
        'scene.create-component',
        'scene.query-node',
        'scene.set-property',
        'asset-db.query-asset-dependencies',
        'asset-db.query-asset-info'
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
    assert.strictEqual(createNodeResponse.result.isError, false);
    assert.strictEqual(createNodeResponse.result.structuredContent.data.nodeUuid, state.nodeUuid);
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
    assert.strictEqual(addComponentResponse.result.isError, false);
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
    assert.strictEqual(setPropertyResponse.result.isError, false);
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
    assert.strictEqual(dependenciesResponse.result.isError, false);
    assert.strictEqual(dependenciesResponse.result.structuredContent.data.count, 2);
    assert.strictEqual(dependenciesResponse.result.structuredContent.data.dependencyInfos.length, 2);
    const traceId = dependenciesResponse.result.structuredContent.meta.traceId;
    const traceResponse = await router.handle({
        jsonrpc: '2.0',
        id: 6,
        method: 'get_trace_by_id',
        params: { traceId }
    });
    assert.ok(traceResponse);
    assert.strictEqual(traceResponse.result.trace.traceId, traceId);
    assert.strictEqual(traceResponse.result.trace.tool, 'asset_query_dependencies');
    console.log('next-workflow-test: PASS');
}
main().catch((error) => {
    console.error('next-workflow-test: FAIL');
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC13b3JrZmxvdy10ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rlc3QvbmV4dC13b3JrZmxvdy10ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsK0NBQWlDO0FBRWpDLGlFQUFtRTtBQUNuRSxrRUFBa0U7QUFDbEUsb0RBQXdEO0FBRXhELFNBQVMsWUFBWSxDQUFDLGFBQXVCO0lBQ3pDLE1BQU0sS0FBSyxHQUE4QixFQUFFLENBQUM7SUFDNUMsS0FBSyxNQUFNLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztRQUM5QixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRztZQUNULEdBQUc7WUFDSCxPQUFPLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDO1lBQy9CLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFDL0IsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZQUNkLE9BQU8sRUFBRTtnQkFDTCxRQUFRLEVBQUU7b0JBQ04s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O0lBQ0gsTUFBTSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUN6QixNQUFNLENBQUMsV0FBVyxDQUFDLGFBQWMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNqRSxNQUFNLENBQUMsV0FBVyxDQUFDLGFBQWMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0lBRWpGLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDbkIsT0FBTyxDQUFDLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQzFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDckIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FwYWJpbGl0eU1hdHJpeCB9IGZyb20gJy4uL25leHQvbW9kZWxzJztcbmltcG9ydCB7IGNyZWF0ZU9mZmljaWFsVG9vbHMgfSBmcm9tICcuLi9uZXh0L3Rvb2xzL29mZmljaWFsLXRvb2xzJztcbmltcG9ydCB7IE5leHRUb29sUmVnaXN0cnkgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3Rvb2wtcmVnaXN0cnknO1xuaW1wb3J0IHsgTmV4dE1jcFJvdXRlciB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvcm91dGVyJztcblxuZnVuY3Rpb24gY3JlYXRlTWF0cml4KGF2YWlsYWJsZUtleXM6IHN0cmluZ1tdKTogQ2FwYWJpbGl0eU1hdHJpeCB7XG4gICAgY29uc3QgYnlLZXk6IENhcGFiaWxpdHlNYXRyaXhbJ2J5S2V5J10gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBhdmFpbGFibGVLZXlzKSB7XG4gICAgICAgIGNvbnN0IGZpcnN0RG90ID0ga2V5LmluZGV4T2YoJy4nKTtcbiAgICAgICAgYnlLZXlba2V5XSA9IHtcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGNoYW5uZWw6IGtleS5zbGljZSgwLCBmaXJzdERvdCksXG4gICAgICAgICAgICBtZXRob2Q6IGtleS5zbGljZShmaXJzdERvdCArIDEpLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBrZXksXG4gICAgICAgICAgICBhdmFpbGFibGU6IHRydWUsXG4gICAgICAgICAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGRldGFpbDogJ29rJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIGJ5S2V5LFxuICAgICAgICBzdW1tYXJ5OiB7XG4gICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgdW5hdmFpbGFibGU6IDAsXG4gICAgICAgICAgICBieUxheWVyOiB7XG4gICAgICAgICAgICAgICAgb2ZmaWNpYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHRlbmRlZDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHBlcmltZW50YWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICAgIG5vZGVVdWlkOiAnbm9kZS1jcmVhdGVkLTEnLFxuICAgICAgICBjb21wb25lbnRVdWlkOiAnY29tcG9uZW50LWxhYmVsLTEnLFxuICAgICAgICBzZXRQcm9wZXJ0eUNhbGxzOiBbXSBhcyBBcnJheTxhbnk+XG4gICAgfTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2NyZWF0ZS1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlLm5vZGVVdWlkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2NyZWF0ZS1jb21wb25lbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LW5vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHV1aWQ6IHsgdmFsdWU6IHN0YXRlLm5vZGVVdWlkIH0sXG4gICAgICAgICAgICAgICAgX19jb21wc19fOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9fdHlwZV9fOiB7IHZhbHVlOiAnY2MuTGFiZWwnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiBzdGF0ZS5jb21wb25lbnRVdWlkIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAnc2V0LXByb3BlcnR5Jykge1xuICAgICAgICAgICAgc3RhdGUuc2V0UHJvcGVydHlDYWxscy5wdXNoKGFyZ3NbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJykge1xuICAgICAgICAgICAgcmV0dXJuIFsnZGVwLTEnLCAnZGVwLTInXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdxdWVyeS1hc3NldC1pbmZvJykge1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgdXJsOiBgZGI6Ly9hc3NldHMvJHt1dWlkfS5wcmVmYWJgXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCByZXF1ZXN0OiAke2NoYW5uZWx9LiR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCB0b29scyA9IGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBjcmVhdGVNYXRyaXgoW1xuICAgICAgICAnc2NlbmUuY3JlYXRlLW5vZGUnLFxuICAgICAgICAnc2NlbmUuY3JlYXRlLWNvbXBvbmVudCcsXG4gICAgICAgICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLnNldC1wcm9wZXJ0eScsXG4gICAgICAgICdhc3NldC1kYi5xdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktYXNzZXQtaW5mbydcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDEsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGxpc3RSZXNwb25zZSk7XG4gICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdFJlc3BvbnNlIS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnc2NlbmVfY3JlYXRlX2dhbWVfb2JqZWN0JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9hZGRfY29tcG9uZW50JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2NvbXBvbmVudF9zZXRfcHJvcGVydHknKSk7XG4gICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJykpO1xuXG4gICAgY29uc3QgY3JlYXRlTm9kZVJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMixcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX2NyZWF0ZV9nYW1lX29iamVjdCcsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnVUlSb290J1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKGNyZWF0ZU5vZGVSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZU5vZGVSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlTm9kZVJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5ub2RlVXVpZCwgc3RhdGUubm9kZVV1aWQpO1xuXG4gICAgY29uc3QgYWRkQ29tcG9uZW50UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAzLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X2FkZF9jb21wb25lbnQnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHN0YXRlLm5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6ICdjYy5MYWJlbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhhZGRDb21wb25lbnRSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGFkZENvbXBvbmVudFJlc3BvbnNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuXG4gICAgY29uc3Qgc2V0UHJvcGVydHlSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDQsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21wb25lbnRfc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiBzdGF0ZS5ub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiAnY2MuTGFiZWwnLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgdmFsdWU6ICdIZWxsbyBXb3JrZmxvdycsXG4gICAgICAgICAgICAgICAgdmFsdWVUeXBlOiAnU3RyaW5nJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHNldFByb3BlcnR5UmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZXRQcm9wZXJ0eVJlc3BvbnNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzdGF0ZS5zZXRQcm9wZXJ0eUNhbGxzLmxlbmd0aCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHN0YXRlLnNldFByb3BlcnR5Q2FsbHNbMF0ucGF0aCwgJ19fY29tcHNfXy4wLnN0cmluZycpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzdGF0ZS5zZXRQcm9wZXJ0eUNhbGxzWzBdLmR1bXAudmFsdWUsICdIZWxsbyBXb3JrZmxvdycpO1xuXG4gICAgY29uc3QgZGVwZW5kZW5jaWVzUmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA1LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHVybE9yVXVpZDogJ2RiOi8vYXNzZXRzL3ByZWZhYnMvcGxheWVyLnByZWZhYicsXG4gICAgICAgICAgICAgICAgcmVsYXRpb25UeXBlOiAnYXNzZXQnLFxuICAgICAgICAgICAgICAgIGluY2x1ZGVBc3NldEluZm86IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhkZXBlbmRlbmNpZXNSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGRlcGVuZGVuY2llc1Jlc3BvbnNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChkZXBlbmRlbmNpZXNSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChkZXBlbmRlbmNpZXNSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuZGVwZW5kZW5jeUluZm9zLmxlbmd0aCwgMik7XG5cbiAgICBjb25zdCB0cmFjZUlkID0gZGVwZW5kZW5jaWVzUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5tZXRhLnRyYWNlSWQ7XG4gICAgY29uc3QgdHJhY2VSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDYsXG4gICAgICAgIG1ldGhvZDogJ2dldF90cmFjZV9ieV9pZCcsXG4gICAgICAgIHBhcmFtczogeyB0cmFjZUlkIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2sodHJhY2VSZXNwb25zZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNlUmVzcG9uc2UhLnJlc3VsdC50cmFjZS50cmFjZUlkLCB0cmFjZUlkKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2VSZXNwb25zZSEucmVzdWx0LnRyYWNlLnRvb2wsICdhc3NldF9xdWVyeV9kZXBlbmRlbmNpZXMnKTtcblxuICAgIGNvbnNvbGUubG9nKCduZXh0LXdvcmtmbG93LXRlc3Q6IFBBU1MnKTtcbn1cblxubWFpbigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ25leHQtd29ya2Zsb3ctdGVzdDogRkFJTCcpO1xuICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbn0pO1xuIl19