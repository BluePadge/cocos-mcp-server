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
const v2_tool_service_1 = require("../mcp/v2-tool-service");
function createLegacyTools() {
    return [
        { name: 'node_create_node', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'component_attach_script', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'component_set_component_property', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'node_get_node_info', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'node_set_node_transform', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'project_import_asset', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'project_get_asset_details', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'scene_open_scene', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'debug_validate_scene', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'prefab_instantiate_prefab', description: 'mock', inputSchema: { type: 'object', properties: {} } },
        { name: 'prefab_update_prefab', description: 'mock', inputSchema: { type: 'object', properties: {} } }
    ];
}
function createLegacyInvoker(state) {
    return async (toolName, args) => {
        if (toolName === 'node_create_node') {
            return {
                success: true,
                data: {
                    uuid: 'node-created-1',
                    name: args.name
                }
            };
        }
        if (toolName === 'component_attach_script') {
            return {
                success: true,
                data: {
                    componentUuid: 'component-script-1'
                }
            };
        }
        if (toolName === 'component_set_component_property') {
            return {
                success: true,
                data: {
                    applied: true
                }
            };
        }
        if (toolName === 'node_get_node_info') {
            return {
                success: true,
                data: Object.assign({}, state.nodeInfo)
            };
        }
        if (toolName === 'node_set_node_transform') {
            if (args.position) {
                state.nodeInfo.position = Object.assign(Object.assign({}, state.nodeInfo.position), args.position);
            }
            if (args.rotation) {
                state.nodeInfo.rotation = Object.assign(Object.assign({}, state.nodeInfo.rotation), args.rotation);
            }
            if (args.scale) {
                state.nodeInfo.scale = Object.assign(Object.assign({}, state.nodeInfo.scale), args.scale);
            }
            return {
                success: true,
                warning: ''
            };
        }
        if (toolName === 'project_import_asset') {
            if (args.sourcePath === '/tmp/bad.png') {
                return {
                    success: false,
                    error: 'Source file not found'
                };
            }
            return {
                success: true,
                data: {
                    uuid: 'asset-uuid-1',
                    path: 'db://assets/workflow-imports/icon.png'
                }
            };
        }
        if (toolName === 'project_get_asset_details') {
            return {
                success: true,
                data: {
                    subAssets: [
                        {
                            type: 'spriteFrame',
                            uuid: 'asset-uuid-1@f9941'
                        }
                    ]
                }
            };
        }
        if (toolName === 'scene_open_scene') {
            return {
                success: true,
                message: `opened: ${args.scenePath}`
            };
        }
        if (toolName === 'debug_validate_scene') {
            return {
                success: true,
                data: {
                    valid: true,
                    issueCount: 0,
                    issues: []
                }
            };
        }
        if (toolName === 'prefab_instantiate_prefab') {
            return {
                success: true,
                data: {
                    nodeUuid: 'prefab-node-1'
                },
                message: 'prefab instantiated'
            };
        }
        if (toolName === 'prefab_update_prefab') {
            return {
                success: true,
                message: 'prefab updated'
            };
        }
        throw new Error(`Unexpected tool call: ${toolName}`);
    };
}
async function main() {
    var _a;
    const state = {
        nodeInfo: {
            uuid: 'node-target-1',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }
    };
    const service = new v2_tool_service_1.V2ToolService(createLegacyTools(), createLegacyInvoker(state), {
        now: (() => {
            let tick = 0;
            return () => {
                tick += 10;
                return tick;
            };
        })(),
        traceIdGenerator: (() => {
            let id = 0;
            return () => {
                id += 1;
                return `trc_test_${id}`;
            };
        })(),
        visibleLayers: ['core', 'advanced', 'internal']
    });
    const dryRunCreate = await service.callTool('workflow_create_ui_node_with_components', {
        parentUuid: 'parent-1',
        name: 'Panel',
        components: ['cc.UITransform'],
        dryRun: true
    });
    assert.strictEqual(dryRunCreate.isError, false);
    assert.strictEqual(dryRunCreate.structuredContent.success, true);
    assert.strictEqual(dryRunCreate.structuredContent.data.dryRun, true);
    const createNode = await service.callTool('workflow_create_ui_node_with_components', {
        parentUuid: 'parent-1',
        name: 'Panel',
        components: ['cc.UITransform', 'cc.Sprite']
    });
    assert.strictEqual(createNode.isError, false);
    assert.strictEqual(createNode.structuredContent.data.nodeUuid, 'node-created-1');
    const bindScript = await service.callTool('workflow_bind_script_to_node', {
        nodeUuid: 'node-target-1',
        scriptPath: 'db://assets/scripts/Player.ts',
        properties: [
            {
                property: 'speed',
                propertyType: 'number',
                value: 7
            }
        ]
    });
    assert.strictEqual(bindScript.isError, false);
    assert.strictEqual(bindScript.structuredContent.data.appliedProperties.length, 1);
    const safeTransform = await service.callTool('workflow_safe_set_transform', {
        nodeUuid: 'node-target-1',
        position: { x: 100, y: 200, z: 0 }
    });
    assert.strictEqual(safeTransform.isError, false);
    const safeData = safeTransform.structuredContent.data;
    assert.strictEqual(safeData.before.position.x, 0);
    assert.strictEqual(safeData.after.position.x, 100);
    const importSprite = await service.callTool('workflow_import_and_assign_sprite', {
        sourcePath: '/tmp/icon.png',
        targetNodeUuid: 'node-target-1'
    });
    assert.strictEqual(importSprite.isError, false);
    assert.strictEqual(importSprite.structuredContent.data.assetUuid, 'asset-uuid-1');
    assert.strictEqual(importSprite.structuredContent.data.spriteFrameUuid, 'asset-uuid-1@f9941');
    const openAndValidate = await service.callTool('workflow_open_scene_and_validate', {
        scenePath: 'db://assets/scenes/Main.scene'
    });
    assert.strictEqual(openAndValidate.isError, false);
    assert.strictEqual(openAndValidate.structuredContent.data.validationReport.valid, true);
    const createPrefab = await service.callTool('workflow_create_or_update_prefab_instance', {
        prefabPath: 'db://assets/prefabs/Hud.prefab',
        parentUuid: 'canvas-1'
    });
    assert.strictEqual(createPrefab.isError, false);
    assert.strictEqual(createPrefab.structuredContent.data.nodeUuid, 'prefab-node-1');
    const failImport = await service.callTool('workflow_import_and_assign_sprite', {
        sourcePath: '/tmp/bad.png',
        targetNodeUuid: 'node-target-1'
    });
    assert.strictEqual(failImport.isError, true);
    assert.strictEqual(failImport.structuredContent.success, false);
    assert.strictEqual((_a = failImport.structuredContent.error) === null || _a === void 0 ? void 0 : _a.stage, 'import_asset');
    console.log('mcp-v2-workflow-test: PASS');
}
main().catch((error) => {
    console.error('mcp-v2-workflow-test: FAIL');
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXYyLXdvcmtmbG93LXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC9tY3AtdjItd29ya2Zsb3ctdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUVqQyw0REFBdUQ7QUFXdkQsU0FBUyxpQkFBaUI7SUFDdEIsT0FBTztRQUNILEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUU7UUFDbEcsRUFBRSxJQUFJLEVBQUUseUJBQXlCLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRTtRQUN6RyxFQUFFLElBQUksRUFBRSxrQ0FBa0MsRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxFQUFFO1FBQ2xILEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUU7UUFDcEcsRUFBRSxJQUFJLEVBQUUseUJBQXlCLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRTtRQUN6RyxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFB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TyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2hFLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBQSxVQUFVLENBQUMsaUJBQWlCLENBQUMsS0FBSywwQ0FBRSxLQUFLLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFOUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFFRCxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNuQixPQUFPLENBQUMsS0FBSyxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDNUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFYyVG9vbFNlcnZpY2UgfSBmcm9tICcuLi9tY3AvdjItdG9vbC1zZXJ2aWNlJztcblxuaW50ZXJmYWNlIE1vY2tTdGF0ZSB7XG4gICAgbm9kZUluZm86IHtcbiAgICAgICAgdXVpZDogc3RyaW5nO1xuICAgICAgICBwb3NpdGlvbjogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyIH07XG4gICAgICAgIHJvdGF0aW9uOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6OiBudW1iZXIgfTtcbiAgICAgICAgc2NhbGU6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlciB9O1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxlZ2FjeVRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHsgbmFtZTogJ25vZGVfY3JlYXRlX25vZGUnLCBkZXNjcmlwdGlvbjogJ21vY2snLCBpbnB1dFNjaGVtYTogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczoge30gfSB9LFxuICAgICAgICB7IG5hbWU6ICdjb21wb25lbnRfYXR0YWNoX3NjcmlwdCcsIGRlc2NyaXB0aW9uOiAnbW9jaycsIGlucHV0U2NoZW1hOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7fSB9IH0sXG4gICAgICAgIHsgbmFtZTogJ2NvbXBvbmVudF9zZXRfY29tcG9uZW50X3Byb3BlcnR5JywgZGVzY3JpcHRpb246ICdtb2NrJywgaW5wdXRTY2hlbWE6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHt9IH0gfSxcbiAgICAgICAgeyBuYW1lOiAnbm9kZV9nZXRfbm9kZV9pbmZvJywgZGVzY3JpcHRpb246ICdtb2NrJywgaW5wdXRTY2hlbWE6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHt9IH0gfSxcbiAgICAgICAgeyBuYW1lOiAnbm9kZV9zZXRfbm9kZV90cmFuc2Zvcm0nLCBkZXNjcmlwdGlvbjogJ21vY2snLCBpbnB1dFNjaGVtYTogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczoge30gfSB9LFxuICAgICAgICB7IG5hbWU6ICdwcm9qZWN0X2ltcG9ydF9hc3NldCcsIGRlc2NyaXB0aW9uOiAnbW9jaycsIGlucHV0U2NoZW1hOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7fSB9IH0sXG4gICAgICAgIHsgbmFtZTogJ3Byb2plY3RfZ2V0X2Fzc2V0X2RldGFpbHMnLCBkZXNjcmlwdGlvbjogJ21vY2snLCBpbnB1dFNjaGVtYTogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczoge30gfSB9LFxuICAgICAgICB7IG5hbWU6ICdzY2VuZV9vcGVuX3NjZW5lJywgZGVzY3JpcHRpb246ICdtb2NrJywgaW5wdXRTY2hlbWE6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHt9IH0gfSxcbiAgICAgICAgeyBuYW1lOiAnZGVidWdfdmFsaWRhdGVfc2NlbmUnLCBkZXNjcmlwdGlvbjogJ21vY2snLCBpbnB1dFNjaGVtYTogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczoge30gfSB9LFxuICAgICAgICB7IG5hbWU6ICdwcmVmYWJfaW5zdGFudGlhdGVfcHJlZmFiJywgZGVzY3JpcHRpb246ICdtb2NrJywgaW5wdXRTY2hlbWE6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHt9IH0gfSxcbiAgICAgICAgeyBuYW1lOiAncHJlZmFiX3VwZGF0ZV9wcmVmYWInLCBkZXNjcmlwdGlvbjogJ21vY2snLCBpbnB1dFNjaGVtYTogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczoge30gfSB9XG4gICAgXTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTGVnYWN5SW52b2tlcihzdGF0ZTogTW9ja1N0YXRlKTogKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4gUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gYXN5bmMgKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgIGlmICh0b29sTmFtZSA9PT0gJ25vZGVfY3JlYXRlX25vZGUnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiAnbm9kZS1jcmVhdGVkLTEnLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBhcmdzLm5hbWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvb2xOYW1lID09PSAnY29tcG9uZW50X2F0dGFjaF9zY3JpcHQnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkOiAnY29tcG9uZW50LXNjcmlwdC0xJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9vbE5hbWUgPT09ICdjb21wb25lbnRfc2V0X2NvbXBvbmVudF9wcm9wZXJ0eScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGxpZWQ6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvb2xOYW1lID09PSAnbm9kZV9nZXRfbm9kZV9pbmZvJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc3RhdGUubm9kZUluZm9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvb2xOYW1lID09PSAnbm9kZV9zZXRfbm9kZV90cmFuc2Zvcm0nKSB7XG4gICAgICAgICAgICBpZiAoYXJncy5wb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIHN0YXRlLm5vZGVJbmZvLnBvc2l0aW9uID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi5zdGF0ZS5ub2RlSW5mby5wb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgLi4uYXJncy5wb3NpdGlvblxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXJncy5yb3RhdGlvbikge1xuICAgICAgICAgICAgICAgIHN0YXRlLm5vZGVJbmZvLnJvdGF0aW9uID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi5zdGF0ZS5ub2RlSW5mby5yb3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgLi4uYXJncy5yb3RhdGlvblxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXJncy5zY2FsZSkge1xuICAgICAgICAgICAgICAgIHN0YXRlLm5vZGVJbmZvLnNjYWxlID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi5zdGF0ZS5ub2RlSW5mby5zY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgLi4uYXJncy5zY2FsZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgd2FybmluZzogJydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9vbE5hbWUgPT09ICdwcm9qZWN0X2ltcG9ydF9hc3NldCcpIHtcbiAgICAgICAgICAgIGlmIChhcmdzLnNvdXJjZVBhdGggPT09ICcvdG1wL2JhZC5wbmcnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiAnU291cmNlIGZpbGUgbm90IGZvdW5kJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6ICdhc3NldC11dWlkLTEnLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnZGI6Ly9hc3NldHMvd29ya2Zsb3ctaW1wb3J0cy9pY29uLnBuZydcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvb2xOYW1lID09PSAncHJvamVjdF9nZXRfYXNzZXRfZGV0YWlscycpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHN1YkFzc2V0czogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzcHJpdGVGcmFtZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogJ2Fzc2V0LXV1aWQtMUBmOTk0MSdcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9vbE5hbWUgPT09ICdzY2VuZV9vcGVuX3NjZW5lJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBvcGVuZWQ6ICR7YXJncy5zY2VuZVBhdGh9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b29sTmFtZSA9PT0gJ2RlYnVnX3ZhbGlkYXRlX3NjZW5lJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGlzc3VlQ291bnQ6IDAsXG4gICAgICAgICAgICAgICAgICAgIGlzc3VlczogW11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvb2xOYW1lID09PSAncHJlZmFiX2luc3RhbnRpYXRlX3ByZWZhYicpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAncHJlZmFiLW5vZGUtMSdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdwcmVmYWIgaW5zdGFudGlhdGVkJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b29sTmFtZSA9PT0gJ3ByZWZhYl91cGRhdGVfcHJlZmFiJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdwcmVmYWIgdXBkYXRlZCdcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgdG9vbCBjYWxsOiAke3Rvb2xOYW1lfWApO1xuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc3RhdGU6IE1vY2tTdGF0ZSA9IHtcbiAgICAgICAgbm9kZUluZm86IHtcbiAgICAgICAgICAgIHV1aWQ6ICdub2RlLXRhcmdldC0xJyxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgICAgIHJvdGF0aW9uOiB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7IHg6IDEsIHk6IDEsIHo6IDEgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHNlcnZpY2UgPSBuZXcgVjJUb29sU2VydmljZShcbiAgICAgICAgY3JlYXRlTGVnYWN5VG9vbHMoKSxcbiAgICAgICAgY3JlYXRlTGVnYWN5SW52b2tlcihzdGF0ZSksXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5vdzogKCgpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgdGljayA9IDA7XG4gICAgICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGljayArPSAxMDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRpY2s7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pKCksXG4gICAgICAgICAgICB0cmFjZUlkR2VuZXJhdG9yOiAoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBpZCA9IDA7XG4gICAgICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGB0cmNfdGVzdF8ke2lkfWA7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pKCksXG4gICAgICAgICAgICB2aXNpYmxlTGF5ZXJzOiBbJ2NvcmUnLCAnYWR2YW5jZWQnLCAnaW50ZXJuYWwnXVxuICAgICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGRyeVJ1bkNyZWF0ZSA9IGF3YWl0IHNlcnZpY2UuY2FsbFRvb2woJ3dvcmtmbG93X2NyZWF0ZV91aV9ub2RlX3dpdGhfY29tcG9uZW50cycsIHtcbiAgICAgICAgcGFyZW50VXVpZDogJ3BhcmVudC0xJyxcbiAgICAgICAgbmFtZTogJ1BhbmVsJyxcbiAgICAgICAgY29tcG9uZW50czogWydjYy5VSVRyYW5zZm9ybSddLFxuICAgICAgICBkcnlSdW46IHRydWVcbiAgICB9KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZHJ5UnVuQ3JlYXRlLmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZHJ5UnVuQ3JlYXRlLnN0cnVjdHVyZWRDb250ZW50LnN1Y2Nlc3MsIHRydWUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCgoZHJ5UnVuQ3JlYXRlLnN0cnVjdHVyZWRDb250ZW50LmRhdGEgYXMgYW55KS5kcnlSdW4sIHRydWUpO1xuXG4gICAgY29uc3QgY3JlYXRlTm9kZSA9IGF3YWl0IHNlcnZpY2UuY2FsbFRvb2woJ3dvcmtmbG93X2NyZWF0ZV91aV9ub2RlX3dpdGhfY29tcG9uZW50cycsIHtcbiAgICAgICAgcGFyZW50VXVpZDogJ3BhcmVudC0xJyxcbiAgICAgICAgbmFtZTogJ1BhbmVsJyxcbiAgICAgICAgY29tcG9uZW50czogWydjYy5VSVRyYW5zZm9ybScsICdjYy5TcHJpdGUnXVxuICAgIH0pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVOb2RlLmlzRXJyb3IsIGZhbHNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoKGNyZWF0ZU5vZGUuc3RydWN0dXJlZENvbnRlbnQuZGF0YSBhcyBhbnkpLm5vZGVVdWlkLCAnbm9kZS1jcmVhdGVkLTEnKTtcblxuICAgIGNvbnN0IGJpbmRTY3JpcHQgPSBhd2FpdCBzZXJ2aWNlLmNhbGxUb29sKCd3b3JrZmxvd19iaW5kX3NjcmlwdF90b19ub2RlJywge1xuICAgICAgICBub2RlVXVpZDogJ25vZGUtdGFyZ2V0LTEnLFxuICAgICAgICBzY3JpcHRQYXRoOiAnZGI6Ly9hc3NldHMvc2NyaXB0cy9QbGF5ZXIudHMnLFxuICAgICAgICBwcm9wZXJ0aWVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHk6ICdzcGVlZCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlUeXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogN1xuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRTY3JpcHQuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCgoYmluZFNjcmlwdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhIGFzIGFueSkuYXBwbGllZFByb3BlcnRpZXMubGVuZ3RoLCAxKTtcblxuICAgIGNvbnN0IHNhZmVUcmFuc2Zvcm0gPSBhd2FpdCBzZXJ2aWNlLmNhbGxUb29sKCd3b3JrZmxvd19zYWZlX3NldF90cmFuc2Zvcm0nLCB7XG4gICAgICAgIG5vZGVVdWlkOiAnbm9kZS10YXJnZXQtMScsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogMjAwLCB6OiAwIH1cbiAgICB9KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2FmZVRyYW5zZm9ybS5pc0Vycm9yLCBmYWxzZSk7XG4gICAgY29uc3Qgc2FmZURhdGEgPSBzYWZlVHJhbnNmb3JtLnN0cnVjdHVyZWRDb250ZW50LmRhdGEgYXMgYW55O1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChzYWZlRGF0YS5iZWZvcmUucG9zaXRpb24ueCwgMCk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNhZmVEYXRhLmFmdGVyLnBvc2l0aW9uLngsIDEwMCk7XG5cbiAgICBjb25zdCBpbXBvcnRTcHJpdGUgPSBhd2FpdCBzZXJ2aWNlLmNhbGxUb29sKCd3b3JrZmxvd19pbXBvcnRfYW5kX2Fzc2lnbl9zcHJpdGUnLCB7XG4gICAgICAgIHNvdXJjZVBhdGg6ICcvdG1wL2ljb24ucG5nJyxcbiAgICAgICAgdGFyZ2V0Tm9kZVV1aWQ6ICdub2RlLXRhcmdldC0xJ1xuICAgIH0pO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbXBvcnRTcHJpdGUuaXNFcnJvciwgZmFsc2UpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbCgoaW1wb3J0U3ByaXRlLnN0cnVjdHVyZWRDb250ZW50LmRhdGEgYXMgYW55KS5hc3NldFV1aWQsICdhc3NldC11dWlkLTEnKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoKGltcG9ydFNwcml0ZS5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhIGFzIGFueSkuc3ByaXRlRnJhbWVVdWlkLCAnYXNzZXQtdXVpZC0xQGY5OTQxJyk7XG5cbiAgICBjb25zdCBvcGVuQW5kVmFsaWRhdGUgPSBhd2FpdCBzZXJ2aWNlLmNhbGxUb29sKCd3b3JrZmxvd19vcGVuX3NjZW5lX2FuZF92YWxpZGF0ZScsIHtcbiAgICAgICAgc2NlbmVQYXRoOiAnZGI6Ly9hc3NldHMvc2NlbmVzL01haW4uc2NlbmUnXG4gICAgfSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5BbmRWYWxpZGF0ZS5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKChvcGVuQW5kVmFsaWRhdGUuc3RydWN0dXJlZENvbnRlbnQuZGF0YSBhcyBhbnkpLnZhbGlkYXRpb25SZXBvcnQudmFsaWQsIHRydWUpO1xuXG4gICAgY29uc3QgY3JlYXRlUHJlZmFiID0gYXdhaXQgc2VydmljZS5jYWxsVG9vbCgnd29ya2Zsb3dfY3JlYXRlX29yX3VwZGF0ZV9wcmVmYWJfaW5zdGFuY2UnLCB7XG4gICAgICAgIHByZWZhYlBhdGg6ICdkYjovL2Fzc2V0cy9wcmVmYWJzL0h1ZC5wcmVmYWInLFxuICAgICAgICBwYXJlbnRVdWlkOiAnY2FudmFzLTEnXG4gICAgfSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZVByZWZhYi5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKChjcmVhdGVQcmVmYWIuc3RydWN0dXJlZENvbnRlbnQuZGF0YSBhcyBhbnkpLm5vZGVVdWlkLCAncHJlZmFiLW5vZGUtMScpO1xuXG4gICAgY29uc3QgZmFpbEltcG9ydCA9IGF3YWl0IHNlcnZpY2UuY2FsbFRvb2woJ3dvcmtmbG93X2ltcG9ydF9hbmRfYXNzaWduX3Nwcml0ZScsIHtcbiAgICAgICAgc291cmNlUGF0aDogJy90bXAvYmFkLnBuZycsXG4gICAgICAgIHRhcmdldE5vZGVVdWlkOiAnbm9kZS10YXJnZXQtMSdcbiAgICB9KTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZmFpbEltcG9ydC5pc0Vycm9yLCB0cnVlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZmFpbEltcG9ydC5zdHJ1Y3R1cmVkQ29udGVudC5zdWNjZXNzLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGZhaWxJbXBvcnQuc3RydWN0dXJlZENvbnRlbnQuZXJyb3I/LnN0YWdlLCAnaW1wb3J0X2Fzc2V0Jyk7XG5cbiAgICBjb25zb2xlLmxvZygnbWNwLXYyLXdvcmtmbG93LXRlc3Q6IFBBU1MnKTtcbn1cblxubWFpbigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ21jcC12Mi13b3JrZmxvdy10ZXN0OiBGQUlMJyk7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=