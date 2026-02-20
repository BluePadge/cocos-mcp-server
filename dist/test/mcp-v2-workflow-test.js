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
    console.log('mcp-v2-workflow-test: PASS');
}
main().catch((error) => {
    console.error('mcp-v2-workflow-test: FAIL');
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXYyLXdvcmtmbG93LXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC9tY3AtdjItd29ya2Zsb3ctdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUVqQyxpRUFBbUU7QUFDbkUsa0VBQWtFO0FBQ2xFLG9EQUF3RDtBQUV4RCxTQUFTLFlBQVksQ0FBQyxhQUF1QjtJQUN6QyxNQUFNLEtBQUssR0FBOEIsRUFBRSxDQUFDO0lBQzVDLEtBQUssTUFBTSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7UUFDOUIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDVCxHQUFHO1lBQ0gsT0FBTyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQztZQUMvQixNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1lBQy9CLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxJQUFJO1lBQ2QsV0FBVyxFQUFFLEdBQUc7WUFDaEIsU0FBUyxFQUFFLElBQUk7WUFDZixTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7WUFDbkMsTUFBTSxFQUFFLElBQUk7U0FDZixDQUFDO0lBQ04sQ0FBQztJQUVELE9BQU87UUFDSCxXQUFXLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7UUFDckMsS0FBSztRQUNMLE9BQU8sRUFBRTtZQUNMLEtBQUssRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMzQixTQUFTLEVBQUUsYUFBYSxDQUFDLE1BQU07WUFDL0IsV0FBVyxFQUFFLENBQUM7WUFDZCxPQUFPLEVBQUU7Z0JBQ0wsUUFBUSxFQUFFO29C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Q0FBQztJQUNILE1BQU0sQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDekIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxhQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDakUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxhQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztJQUVqRixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVELElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ25CLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztJQUM1QyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhcGFiaWxpdHlNYXRyaXggfSBmcm9tICcuLi9uZXh0L21vZGVscyc7XG5pbXBvcnQgeyBjcmVhdGVPZmZpY2lhbFRvb2xzIH0gZnJvbSAnLi4vbmV4dC90b29scy9vZmZpY2lhbC10b29scyc7XG5pbXBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmltcG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3JvdXRlcic7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdHJpeChhdmFpbGFibGVLZXlzOiBzdHJpbmdbXSk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIGNvbnN0IGJ5S2V5OiBDYXBhYmlsaXR5TWF0cml4WydieUtleSddID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgb2YgYXZhaWxhYmxlS2V5cykge1xuICAgICAgICBjb25zdCBmaXJzdERvdCA9IGtleS5pbmRleE9mKCcuJyk7XG4gICAgICAgIGJ5S2V5W2tleV0gPSB7XG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICBjaGFubmVsOiBrZXkuc2xpY2UoMCwgZmlyc3REb3QpLFxuICAgICAgICAgICAgbWV0aG9kOiBrZXkuc2xpY2UoZmlyc3REb3QgKyAxKSxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjoga2V5LFxuICAgICAgICAgICAgYXZhaWxhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBkZXRhaWw6ICdvaydcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBieUtleSxcbiAgICAgICAgc3VtbWFyeToge1xuICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHVuYXZhaWxhYmxlOiAwLFxuICAgICAgICAgICAgYnlMYXllcjoge1xuICAgICAgICAgICAgICAgIG9mZmljaWFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXh0ZW5kZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHN0YXRlID0ge1xuICAgICAgICBub2RlVXVpZDogJ25vZGUtY3JlYXRlZC0xJyxcbiAgICAgICAgY29tcG9uZW50VXVpZDogJ2NvbXBvbmVudC1sYWJlbC0xJyxcbiAgICAgICAgc2V0UHJvcGVydHlDYWxsczogW10gYXMgQXJyYXk8YW55PlxuICAgIH07XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdjcmVhdGUtbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5ub2RlVXVpZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdjcmVhdGUtY29tcG9uZW50Jykge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1dWlkOiB7IHZhbHVlOiBzdGF0ZS5ub2RlVXVpZCB9LFxuICAgICAgICAgICAgICAgIF9fY29tcHNfXzogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfX3R5cGVfXzogeyB2YWx1ZTogJ2NjLkxhYmVsJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogeyB2YWx1ZTogc3RhdGUuY29tcG9uZW50VXVpZCB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3NldC1wcm9wZXJ0eScpIHtcbiAgICAgICAgICAgIHN0YXRlLnNldFByb3BlcnR5Q2FsbHMucHVzaChhcmdzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnYXNzZXQtZGInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWFzc2V0LWRlcGVuZGVuY2llcycpIHtcbiAgICAgICAgICAgIHJldHVybiBbJ2RlcC0xJywgJ2RlcC0yJ107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdhc3NldC1kYicgJiYgbWV0aG9kID09PSAncXVlcnktYXNzZXQtaW5mbycpIHtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgIHVybDogYGRiOi8vYXNzZXRzLyR7dXVpZH0ucHJlZmFiYFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgcmVxdWVzdDogJHtjaGFubmVsfS4ke21ldGhvZH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgJ3NjZW5lLmNyZWF0ZS1jb21wb25lbnQnLFxuICAgICAgICAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgICdzY2VuZS5zZXQtcHJvcGVydHknLFxuICAgICAgICAnYXNzZXQtZGIucXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICBjb25zdCBsaXN0UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiAxLFxuICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgIH0pO1xuICAgIGFzc2VydC5vayhsaXN0UmVzcG9uc2UpO1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IGxpc3RSZXNwb25zZSEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ3NjZW5lX2NyZWF0ZV9nYW1lX29iamVjdCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdjb21wb25lbnRfYWRkX2NvbXBvbmVudCcpKTtcbiAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdjb21wb25lbnRfc2V0X3Byb3BlcnR5JykpO1xuICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2Fzc2V0X3F1ZXJ5X2RlcGVuZGVuY2llcycpKTtcblxuICAgIGNvbnN0IGNyZWF0ZU5vZGVSZXNwb25zZSA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgaWQ6IDIsXG4gICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9jcmVhdGVfZ2FtZV9vYmplY3QnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ1VJUm9vdCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhjcmVhdGVOb2RlUmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVOb2RlUmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZU5vZGVSZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubm9kZVV1aWQsIHN0YXRlLm5vZGVVdWlkKTtcblxuICAgIGNvbnN0IGFkZENvbXBvbmVudFJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMyxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2NvbXBvbmVudF9hZGRfY29tcG9uZW50JyxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkOiBzdGF0ZS5ub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiAnY2MuTGFiZWwnXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soYWRkQ29tcG9uZW50UmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChhZGRDb21wb25lbnRSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcblxuICAgIGNvbnN0IHNldFByb3BlcnR5UmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA0LFxuICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tcG9uZW50X3NldF9wcm9wZXJ0eScsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogc3RhdGUubm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogJ2NjLkxhYmVsJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAnSGVsbG8gV29ya2Zsb3cnLFxuICAgICAgICAgICAgICAgIHZhbHVlVHlwZTogJ1N0cmluZydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGFzc2VydC5vayhzZXRQcm9wZXJ0eVJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UHJvcGVydHlSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc3RhdGUuc2V0UHJvcGVydHlDYWxscy5sZW5ndGgsIDEpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzdGF0ZS5zZXRQcm9wZXJ0eUNhbGxzWzBdLnBhdGgsICdfX2NvbXBzX18uMC5zdHJpbmcnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc3RhdGUuc2V0UHJvcGVydHlDYWxsc1swXS5kdW1wLnZhbHVlLCAnSGVsbG8gV29ya2Zsb3cnKTtcblxuICAgIGNvbnN0IGRlcGVuZGVuY2llc1Jlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogNSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X2RlcGVuZGVuY2llcycsXG4gICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICB1cmxPclV1aWQ6ICdkYjovL2Fzc2V0cy9wcmVmYWJzL3BsYXllci5wcmVmYWInLFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uVHlwZTogJ2Fzc2V0JyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlQXNzZXRJbmZvOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhc3NlcnQub2soZGVwZW5kZW5jaWVzUmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChkZXBlbmRlbmNpZXNSZXNwb25zZSEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZGVwZW5kZW5jaWVzUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmNvdW50LCAyKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZGVwZW5kZW5jaWVzUmVzcG9uc2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmRlcGVuZGVuY3lJbmZvcy5sZW5ndGgsIDIpO1xuXG4gICAgY29uc3QgdHJhY2VJZCA9IGRlcGVuZGVuY2llc1Jlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQubWV0YS50cmFjZUlkO1xuICAgIGNvbnN0IHRyYWNlUmVzcG9uc2UgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgIGlkOiA2LFxuICAgICAgICBtZXRob2Q6ICdnZXRfdHJhY2VfYnlfaWQnLFxuICAgICAgICBwYXJhbXM6IHsgdHJhY2VJZCB9XG4gICAgfSk7XG4gICAgYXNzZXJ0Lm9rKHRyYWNlUmVzcG9uc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0cmFjZVJlc3BvbnNlIS5yZXN1bHQudHJhY2UudHJhY2VJZCwgdHJhY2VJZCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNlUmVzcG9uc2UhLnJlc3VsdC50cmFjZS50b29sLCAnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJyk7XG5cbiAgICBjb25zb2xlLmxvZygnbWNwLXYyLXdvcmtmbG93LXRlc3Q6IFBBU1MnKTtcbn1cblxubWFpbigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ21jcC12Mi13b3JrZmxvdy10ZXN0OiBGQUlMJyk7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=