import * as assert from 'assert';
import { ToolDefinition } from '../types';
import { V2ToolService } from '../mcp/v2-tool-service';

interface MockState {
    nodeInfo: {
        uuid: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
    };
}

function createLegacyTools(): ToolDefinition[] {
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

function createLegacyInvoker(state: MockState): (toolName: string, args: any) => Promise<any> {
    return async (toolName: string, args: any): Promise<any> => {
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
                data: {
                    ...state.nodeInfo
                }
            };
        }

        if (toolName === 'node_set_node_transform') {
            if (args.position) {
                state.nodeInfo.position = {
                    ...state.nodeInfo.position,
                    ...args.position
                };
            }
            if (args.rotation) {
                state.nodeInfo.rotation = {
                    ...state.nodeInfo.rotation,
                    ...args.rotation
                };
            }
            if (args.scale) {
                state.nodeInfo.scale = {
                    ...state.nodeInfo.scale,
                    ...args.scale
                };
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

async function main(): Promise<void> {
    const state: MockState = {
        nodeInfo: {
            uuid: 'node-target-1',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }
    };

    const service = new V2ToolService(
        createLegacyTools(),
        createLegacyInvoker(state),
        {
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
        }
    );

    const dryRunCreate = await service.callTool('workflow_create_ui_node_with_components', {
        parentUuid: 'parent-1',
        name: 'Panel',
        components: ['cc.UITransform'],
        dryRun: true
    });
    assert.strictEqual(dryRunCreate.isError, false);
    assert.strictEqual(dryRunCreate.structuredContent.success, true);
    assert.strictEqual((dryRunCreate.structuredContent.data as any).dryRun, true);

    const createNode = await service.callTool('workflow_create_ui_node_with_components', {
        parentUuid: 'parent-1',
        name: 'Panel',
        components: ['cc.UITransform', 'cc.Sprite']
    });
    assert.strictEqual(createNode.isError, false);
    assert.strictEqual((createNode.structuredContent.data as any).nodeUuid, 'node-created-1');

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
    assert.strictEqual((bindScript.structuredContent.data as any).appliedProperties.length, 1);

    const safeTransform = await service.callTool('workflow_safe_set_transform', {
        nodeUuid: 'node-target-1',
        position: { x: 100, y: 200, z: 0 }
    });
    assert.strictEqual(safeTransform.isError, false);
    const safeData = safeTransform.structuredContent.data as any;
    assert.strictEqual(safeData.before.position.x, 0);
    assert.strictEqual(safeData.after.position.x, 100);

    const importSprite = await service.callTool('workflow_import_and_assign_sprite', {
        sourcePath: '/tmp/icon.png',
        targetNodeUuid: 'node-target-1'
    });
    assert.strictEqual(importSprite.isError, false);
    assert.strictEqual((importSprite.structuredContent.data as any).assetUuid, 'asset-uuid-1');
    assert.strictEqual((importSprite.structuredContent.data as any).spriteFrameUuid, 'asset-uuid-1@f9941');

    const openAndValidate = await service.callTool('workflow_open_scene_and_validate', {
        scenePath: 'db://assets/scenes/Main.scene'
    });
    assert.strictEqual(openAndValidate.isError, false);
    assert.strictEqual((openAndValidate.structuredContent.data as any).validationReport.valid, true);

    const createPrefab = await service.callTool('workflow_create_or_update_prefab_instance', {
        prefabPath: 'db://assets/prefabs/Hud.prefab',
        parentUuid: 'canvas-1'
    });
    assert.strictEqual(createPrefab.isError, false);
    assert.strictEqual((createPrefab.structuredContent.data as any).nodeUuid, 'prefab-node-1');

    const failImport = await service.callTool('workflow_import_and_assign_sprite', {
        sourcePath: '/tmp/bad.png',
        targetNodeUuid: 'node-target-1'
    });
    assert.strictEqual(failImport.isError, true);
    assert.strictEqual(failImport.structuredContent.success, false);
    assert.strictEqual(failImport.structuredContent.error?.stage, 'import_asset');

    console.log('mcp-v2-workflow-test: PASS');
}

main().catch((error) => {
    console.error('mcp-v2-workflow-test: FAIL');
    console.error(error);
    process.exit(1);
});
