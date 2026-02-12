import { isRecord } from './messages';
import { V2ToolDescriptor } from './v2-models';
import { V2BusinessErrorException, V2_ERROR_CODES, createBusinessError, toBusinessError } from './v2-errors';
interface WorkflowStageRecord {
    stage: string;
    status: 'success' | 'failed' | 'skipped';
    durationMs: number;
    output?: unknown;
    error?: unknown;
}
interface WorkflowPropertyItem {
    componentType?: string;
    property: string;
    propertyType: string;
    value: unknown;
}
export interface WorkflowHelperDeps {
    withWriteCommonFields: (schema: unknown, supportsWrite: boolean) => Record<string, unknown>;
    validateWriteCommonArgs: (args: Record<string, unknown>) => { dryRun: boolean };
    ensureLegacySuccess: (result: unknown, stage: string) => void;
    pickString: (source: unknown, paths: string[]) => string | null;
    pickValue: (source: unknown, paths: string[]) => unknown;
    now: () => number;
}
export function createWorkflowToolDescriptors(deps: WorkflowHelperDeps): V2ToolDescriptor[] {
    return [
        createWorkflowCreateUiNodeWithComponents(deps),
        createWorkflowBindScriptToNode(deps),
        createWorkflowSafeSetTransform(deps),
        createWorkflowImportAndAssignSprite(deps),
        createWorkflowOpenSceneAndValidate(deps),
        createWorkflowCreateOrUpdatePrefabInstance(deps)
    ];
}
function createWorkflowCreateUiNodeWithComponents(deps: WorkflowHelperDeps): V2ToolDescriptor {
    return {
        manifest: {
            name: 'workflow_create_ui_node_with_components',
            description: '创建 UI 节点并挂载组件，减少多次调用。',
            layer: 'core',
            category: 'workflow',
            safety: 'mutating',
            idempotent: false,
            supportsDryRun: true,
            prerequisites: ['sceneReady=true'],
            inputSchema: deps.withWriteCommonFields({
                type: 'object',
                properties: {
                    parentUuid: { type: 'string' },
                    name: { type: 'string' },
                    components: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                },
                required: ['parentUuid', 'name', 'components']
            }, true),
            outputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string' },
                    appliedComponents: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    stages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                }
            },
            examples: [
                {
                    input: {
                        parentUuid: 'root-ui-uuid',
                        name: 'ScorePanel',
                        components: ['cc.UITransform', 'cc.Sprite']
                    }
                },
                {
                    input: {
                        parentUuid: 'root-ui-uuid',
                        name: 'ScorePanel',
                        components: ['cc.UITransform', 'cc.Sprite'],
                        dryRun: true
                    }
                }
            ]
        },
        execute: async (args, context) => {
            const parentUuid = requireString(args.parentUuid, 'parentUuid');
            const name = requireString(args.name, 'name');
            const components = requireStringArray(args.components, 'components');
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages: WorkflowStageRecord[] = [];
            if (writeArgs.dryRun) {
                return {
                    dryRun: true,
                    riskLevel: 'medium',
                    changes: [
                        {
                            type: 'create',
                            target: `parent:${parentUuid}`,
                            field: 'node',
                            from: null,
                            to: { name, components }
                        }
                    ],
                    stages: [
                        {
                            stage: 'create_node',
                            status: 'skipped',
                            durationMs: 0,
                            output: 'dryRun=true，未执行 create_node'
                        }
                    ]
                };
            }
            const stageResult = await runStage(stages, 'create_node', deps.now, async () => {
                const result = await context.callLegacyTool('node_create_node', {
                    parentUuid,
                    name,
                    components
                });
                deps.ensureLegacySuccess(result, 'create_node');
                return result;
            });
            return {
                nodeUuid: deps.pickString(stageResult, ['data.uuid', 'data.nodeUuid', 'uuid', 'nodeUuid']),
                appliedComponents: components,
                stages
            };
        }
    };
}
function createWorkflowBindScriptToNode(deps: WorkflowHelperDeps): V2ToolDescriptor {
    return {
        manifest: {
            name: 'workflow_bind_script_to_node',
            description: '为节点绑定脚本并批量设置公开属性。',
            layer: 'core',
            category: 'workflow',
            safety: 'mutating',
            idempotent: false,
            supportsDryRun: true,
            prerequisites: ['nodeExists=true'],
            inputSchema: deps.withWriteCommonFields({
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string' },
                    scriptPath: { type: 'string' },
                    properties: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                componentType: { type: 'string' },
                                property: { type: 'string' },
                                propertyType: { type: 'string' },
                                value: {}
                            },
                            required: ['property', 'propertyType', 'value']
                        }
                    }
                },
                required: ['nodeUuid', 'scriptPath']
            }, true),
            outputSchema: {
                type: 'object',
                properties: {
                    componentUuid: { type: ['string', 'null'] },
                    appliedProperties: {
                        type: 'array',
                        items: { type: 'object' }
                    },
                    stages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                }
            },
            examples: [
                {
                    input: {
                        nodeUuid: 'node-uuid',
                        scriptPath: 'db://assets/scripts/Player.ts',
                        properties: [
                            {
                                property: 'speed',
                                propertyType: 'number',
                                value: 6
                            }
                        ]
                    }
                },
                {
                    input: {
                        nodeUuid: 'node-uuid',
                        scriptPath: 'db://assets/scripts/Player.ts',
                        dryRun: true
                    }
                }
            ]
        },
        execute: async (args, context) => {
            const nodeUuid = requireString(args.nodeUuid, 'nodeUuid');
            const scriptPath = requireString(args.scriptPath, 'scriptPath');
            const writeArgs = deps.validateWriteCommonArgs(args);
            const propertyItems = normalizeWorkflowProperties(args.properties);
            const scriptClassName = getScriptClassName(scriptPath);
            const stages: WorkflowStageRecord[] = [];
            if (writeArgs.dryRun) {
                return {
                    dryRun: true,
                    riskLevel: 'medium',
                    changes: [
                        {
                            type: 'update',
                            target: `node:${nodeUuid}`,
                            field: 'script',
                            from: null,
                            to: { scriptPath, properties: propertyItems.length }
                        }
                    ],
                    stages: [
                        {
                            stage: 'attach_script',
                            status: 'skipped',
                            durationMs: 0,
                            output: 'dryRun=true，未执行 attach_script'
                        }
                    ]
                };
            }
            const attachResult = await runStage(stages, 'attach_script', deps.now, async () => {
                const result = await context.callLegacyTool('component_attach_script', { nodeUuid, scriptPath });
                deps.ensureLegacySuccess(result, 'attach_script');
                return result;
            });
            const appliedProperties: Array<Record<string, unknown>> = [];
            for (const item of propertyItems) {
                const componentType = item.componentType ?? scriptClassName;
                const stageName = `set_property:${item.property}`;
                await runStage(stages, stageName, deps.now, async () => {
                    const result = await context.callLegacyTool('component_set_component_property', {
                        nodeUuid,
                        componentType,
                        property: item.property,
                        propertyType: item.propertyType,
                        value: item.value
                    });
                    deps.ensureLegacySuccess(result, stageName);
                    appliedProperties.push({
                        componentType,
                        property: item.property,
                        propertyType: item.propertyType
                    });
                    return result;
                });
            }
            return {
                componentUuid: deps.pickString(attachResult, ['data.componentUuid', 'data.uuid', 'uuid']),
                appliedProperties,
                stages
            };
        }
    };
}
function createWorkflowSafeSetTransform(deps: WorkflowHelperDeps): V2ToolDescriptor {
    return {
        manifest: {
            name: 'workflow_safe_set_transform',
            description: '读取前后状态并安全设置节点变换。',
            layer: 'core',
            category: 'workflow',
            safety: 'mutating',
            idempotent: true,
            supportsDryRun: true,
            prerequisites: ['nodeExists=true'],
            inputSchema: deps.withWriteCommonFields({
                type: 'object',
                properties: {
                    nodeUuid: { type: 'string' },
                    position: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    },
                    rotation: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    },
                    scale: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    }
                },
                required: ['nodeUuid']
            }, true),
            outputSchema: {
                type: 'object',
                properties: {
                    before: { type: ['object', 'null'] },
                    after: { type: ['object', 'null'] },
                    warnings: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    stages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                }
            },
            examples: [
                {
                    input: {
                        nodeUuid: 'node-uuid',
                        position: { x: 100, y: 80, z: 0 }
                    }
                },
                {
                    input: {
                        nodeUuid: 'node-uuid',
                        rotation: { z: 45 },
                        dryRun: true
                    }
                }
            ]
        },
        execute: async (args, context) => {
            const nodeUuid = requireString(args.nodeUuid, 'nodeUuid');
            const writeArgs = deps.validateWriteCommonArgs(args);
            const transform = extractTransformArgs(args);
            if (Object.keys(transform).length === 0) {
                throw new V2BusinessErrorException(
                    createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'position/rotation/scale 至少需要提供一个', {
                        details: { field: 'position|rotation|scale' },
                        suggestion: '请至少传入一个变换字段。',
                        retryable: false
                    })
                );
            }
            const stages: WorkflowStageRecord[] = [];
            const beforeResult = await runStage(stages, 'get_before_state', deps.now, async () => {
                const result = await context.callLegacyTool('node_get_node_info', { uuid: nodeUuid });
                deps.ensureLegacySuccess(result, 'get_before_state');
                return result;
            });
            if (writeArgs.dryRun) {
                return {
                    dryRun: true,
                    riskLevel: 'medium',
                    changes: [
                        {
                            type: 'update',
                            target: `node:${nodeUuid}`,
                            field: 'transform',
                            from: deps.pickValue(beforeResult, ['data.position', 'data.rotation', 'data.scale']),
                            to: transform
                        }
                    ],
                    before: deps.pickValue(beforeResult, ['data']),
                    after: null,
                    warnings: [],
                    stages
                };
            }
            const setResult = await runStage(stages, 'set_transform', deps.now, async () => {
                const result = await context.callLegacyTool('node_set_node_transform', {
                    uuid: nodeUuid,
                    ...transform
                });
                deps.ensureLegacySuccess(result, 'set_transform');
                return result;
            });
            const afterResult = await runStage(stages, 'get_after_state', deps.now, async () => {
                const result = await context.callLegacyTool('node_get_node_info', { uuid: nodeUuid });
                deps.ensureLegacySuccess(result, 'get_after_state');
                return result;
            });
            const warningRaw = deps.pickString(setResult, ['warning']) ?? '';
            return {
                before: deps.pickValue(beforeResult, ['data']),
                after: deps.pickValue(afterResult, ['data']),
                warnings: warningRaw ? [warningRaw] : [],
                stages
            };
        }
    };
}
function createWorkflowImportAndAssignSprite(deps: WorkflowHelperDeps): V2ToolDescriptor {
    return {
        manifest: {
            name: 'workflow_import_and_assign_sprite',
            description: '导入图片并绑定到目标节点 Sprite 组件。',
            layer: 'core',
            category: 'workflow',
            safety: 'mutating',
            idempotent: false,
            supportsDryRun: true,
            prerequisites: ['sceneReady=true', 'targetNodeHasSprite=true'],
            inputSchema: deps.withWriteCommonFields({
                type: 'object',
                properties: {
                    sourcePath: { type: 'string' },
                    targetNodeUuid: { type: 'string' },
                    targetFolder: { type: 'string', default: 'db://assets/workflow-imports' }
                },
                required: ['sourcePath', 'targetNodeUuid']
            }, true),
            outputSchema: {
                type: 'object',
                properties: {
                    assetUuid: { type: ['string', 'null'] },
                    spriteFrameUuid: { type: ['string', 'null'] },
                    stages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                }
            },
            examples: [
                {
                    input: {
                        sourcePath: '/tmp/icon.png',
                        targetNodeUuid: 'node-uuid'
                    }
                },
                {
                    input: {
                        sourcePath: '/tmp/icon.png',
                        targetNodeUuid: 'node-uuid',
                        dryRun: true
                    }
                }
            ]
        },
        execute: async (args, context) => {
            const sourcePath = requireString(args.sourcePath, 'sourcePath');
            const targetNodeUuid = requireString(args.targetNodeUuid, 'targetNodeUuid');
            const targetFolder = optionalString(args.targetFolder) ?? 'db://assets/workflow-imports';
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages: WorkflowStageRecord[] = [];
            if (writeArgs.dryRun) {
                return {
                    dryRun: true,
                    riskLevel: 'medium',
                    changes: [
                        {
                            type: 'create',
                            target: targetFolder,
                            field: 'asset',
                            from: null,
                            to: { sourcePath }
                        },
                        {
                            type: 'update',
                            target: `node:${targetNodeUuid}`,
                            field: 'cc.Sprite.spriteFrame',
                            from: null,
                            to: 'spriteFrameUuid'
                        }
                    ],
                    stages: [
                        {
                            stage: 'import_asset',
                            status: 'skipped',
                            durationMs: 0,
                            output: 'dryRun=true，未执行 import_asset'
                        }
                    ]
                };
            }
            const importResult = await runStage(stages, 'import_asset', deps.now, async () => {
                const result = await context.callLegacyTool('project_import_asset', {
                    sourcePath,
                    targetFolder
                });
                deps.ensureLegacySuccess(result, 'import_asset');
                return result;
            });
            const assetPath = deps.pickString(importResult, ['data.path', 'path']);
            const assetUuid = deps.pickString(importResult, ['data.uuid', 'uuid']);
            if (!assetPath) {
                throw new V2BusinessErrorException(
                    createBusinessError(V2_ERROR_CODES.INTERNAL, '导入资源后未返回 assetPath', {
                        stage: 'import_asset',
                        details: importResult,
                        retryable: false
                    })
                );
            }
            const detailsResult = await runStage(stages, 'resolve_sprite_frame', deps.now, async () => {
                const result = await context.callLegacyTool('project_get_asset_details', {
                    assetPath,
                    includeSubAssets: true
                });
                deps.ensureLegacySuccess(result, 'resolve_sprite_frame');
                return result;
            });
            const spriteFrameUuid = resolveSpriteFrameUuid(detailsResult);
            if (!spriteFrameUuid) {
                throw new V2BusinessErrorException(
                    createBusinessError(V2_ERROR_CODES.NOT_FOUND, '未找到可用的 spriteFrame 子资源', {
                        stage: 'resolve_sprite_frame',
                        details: { assetPath },
                        suggestion: '请确认图片资源已成功导入并生成 SpriteFrame。',
                        retryable: false
                    })
                );
            }
            await runStage(stages, 'assign_sprite_frame', deps.now, async () => {
                const result = await context.callLegacyTool('component_set_component_property', {
                    nodeUuid: targetNodeUuid,
                    componentType: 'cc.Sprite',
                    property: 'spriteFrame',
                    propertyType: 'spriteFrame',
                    value: spriteFrameUuid
                });
                deps.ensureLegacySuccess(result, 'assign_sprite_frame');
                return result;
            });
            return {
                assetUuid,
                spriteFrameUuid,
                stages
            };
        }
    };
}
function createWorkflowOpenSceneAndValidate(deps: WorkflowHelperDeps): V2ToolDescriptor {
    return {
        manifest: {
            name: 'workflow_open_scene_and_validate',
            description: '打开场景并执行基础校验。',
            layer: 'core',
            category: 'workflow',
            safety: 'mutating',
            idempotent: false,
            supportsDryRun: true,
            prerequisites: ['scenePathExists=true'],
            inputSchema: deps.withWriteCommonFields({
                type: 'object',
                properties: {
                    scenePath: { type: 'string' },
                    checkMissingAssets: { type: 'boolean', default: true },
                    checkPerformance: { type: 'boolean', default: true }
                },
                required: ['scenePath']
            }, true),
            outputSchema: {
                type: 'object',
                properties: {
                    validationReport: { type: ['object', 'null'] },
                    stages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                }
            },
            examples: [
                {
                    input: {
                        scenePath: 'db://assets/scenes/Main.scene'
                    }
                },
                {
                    input: {
                        scenePath: 'db://assets/scenes/Main.scene',
                        dryRun: true
                    }
                }
            ]
        },
        execute: async (args, context) => {
            const scenePath = requireString(args.scenePath, 'scenePath');
            const checkMissingAssets = optionalBoolean(args.checkMissingAssets) ?? true;
            const checkPerformance = optionalBoolean(args.checkPerformance) ?? true;
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages: WorkflowStageRecord[] = [];
            if (writeArgs.dryRun) {
                return {
                    dryRun: true,
                    riskLevel: 'medium',
                    changes: [
                        {
                            type: 'update',
                            target: 'scene:active',
                            field: 'scenePath',
                            from: 'current',
                            to: scenePath
                        }
                    ],
                    stages: [
                        {
                            stage: 'open_scene',
                            status: 'skipped',
                            durationMs: 0,
                            output: 'dryRun=true，未执行 open_scene'
                        }
                    ]
                };
            }
            await runStage(stages, 'open_scene', deps.now, async () => {
                const result = await context.callLegacyTool('scene_open_scene', { scenePath });
                deps.ensureLegacySuccess(result, 'open_scene');
                return result;
            });
            const validateResult = await runStage(stages, 'validate_scene', deps.now, async () => {
                const result = await context.callLegacyTool('debug_validate_scene', {
                    checkMissingAssets,
                    checkPerformance
                });
                deps.ensureLegacySuccess(result, 'validate_scene');
                return result;
            });
            return {
                validationReport: deps.pickValue(validateResult, ['data']),
                stages
            };
        }
    };
}
function createWorkflowCreateOrUpdatePrefabInstance(deps: WorkflowHelperDeps): V2ToolDescriptor {
    return {
        manifest: {
            name: 'workflow_create_or_update_prefab_instance',
            description: '创建或更新预制体实例。',
            layer: 'core',
            category: 'workflow',
            safety: 'mutating',
            idempotent: false,
            supportsDryRun: true,
            prerequisites: ['prefabPathExists=true'],
            inputSchema: deps.withWriteCommonFields({
                type: 'object',
                properties: {
                    prefabPath: { type: 'string' },
                    parentUuid: { type: 'string' },
                    nodeUuid: { type: 'string' },
                    position: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z: { type: 'number' }
                        }
                    }
                },
                required: ['prefabPath', 'parentUuid']
            }, true),
            outputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: { type: ['string', 'null'] },
                    diffSummary: { type: ['string', 'null'] },
                    stages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                }
            },
            examples: [
                {
                    input: {
                        prefabPath: 'db://assets/prefabs/Hud.prefab',
                        parentUuid: 'canvas-uuid'
                    }
                },
                {
                    input: {
                        prefabPath: 'db://assets/prefabs/Hud.prefab',
                        parentUuid: 'canvas-uuid',
                        dryRun: true
                    }
                }
            ]
        },
        execute: async (args, context) => {
            const prefabPath = requireString(args.prefabPath, 'prefabPath');
            const parentUuid = requireString(args.parentUuid, 'parentUuid');
            const nodeUuid = optionalString(args.nodeUuid);
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages: WorkflowStageRecord[] = [];
            if (writeArgs.dryRun) {
                return {
                    dryRun: true,
                    riskLevel: 'medium',
                    changes: [
                        {
                            type: nodeUuid ? 'update' : 'create',
                            target: nodeUuid ? `node:${nodeUuid}` : `parent:${parentUuid}`,
                            field: 'prefab',
                            from: nodeUuid ? 'existing-instance' : null,
                            to: { prefabPath }
                        }
                    ],
                    stages: [
                        {
                            stage: nodeUuid ? 'update_prefab' : 'instantiate_prefab',
                            status: 'skipped',
                            durationMs: 0,
                            output: 'dryRun=true，未执行预制体写入'
                        }
                    ]
                };
            }
            if (nodeUuid) {
                const updateResult = await runStage(stages, 'update_prefab', deps.now, async () => {
                    const result = await context.callLegacyTool('prefab_update_prefab', {
                        prefabPath,
                        nodeUuid
                    });
                    deps.ensureLegacySuccess(result, 'update_prefab');
                    return result;
                });
                return {
                    nodeUuid,
                    diffSummary: deps.pickString(updateResult, ['message', 'data.message']) ?? 'prefab updated',
                    stages
                };
            }
            const instantiateResult = await runStage(stages, 'instantiate_prefab', deps.now, async () => {
                const result = await context.callLegacyTool('prefab_instantiate_prefab', {
                    prefabPath,
                    parentUuid,
                    position: extractPosition(args)
                });
                deps.ensureLegacySuccess(result, 'instantiate_prefab');
                return result;
            });
            return {
                nodeUuid: deps.pickString(instantiateResult, ['data.nodeUuid', 'data.uuid', 'nodeUuid', 'uuid']),
                diffSummary: deps.pickString(instantiateResult, ['message', 'data.message']) ?? 'prefab instantiated',
                stages
            };
        }
    };
}
async function runStage<T>(
    stages: WorkflowStageRecord[],
    stage: string,
    now: () => number,
    action: () => Promise<T>
): Promise<T> {
    const startedAt = now();
    try {
        const output = await action();
        stages.push({
            stage,
            status: 'success',
            durationMs: now() - startedAt,
            output: stageOutputSummary(output)
        });
        return output;
    } catch (error) {
        const businessError = toBusinessError(error);
        businessError.stage = businessError.stage ?? stage;
        stages.push({
            stage,
            status: 'failed',
            durationMs: now() - startedAt,
            error: {
                code: businessError.code,
                message: businessError.message
            }
        });
        throw new V2BusinessErrorException(
            createBusinessError(businessError.code, businessError.message, {
                stage,
                details: {
                    error: businessError,
                    stages
                },
                suggestion: businessError.suggestion,
                retryable: businessError.retryable
            })
        );
    }
}
function stageOutputSummary(value: unknown): unknown {
    if (!isRecord(value)) {
        return value;
    }
    if (isRecord(value.data)) {
        return {
            success: value.success,
            dataKeys: Object.keys(value.data)
        };
    }
    return {
        success: value.success,
        keys: Object.keys(value)
    };
}
function requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new V2BusinessErrorException(
            createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, `${field} is required`, {
                details: { field },
                retryable: false
            })
        );
    }
    return value;
}
function optionalString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
        return value;
    }
    return null;
}
function optionalBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
        return value;
    }
    return null;
}
function requireStringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value)) {
        throw new V2BusinessErrorException(
            createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, `${field} must be an array of string`, {
                details: { field },
                retryable: false
            })
        );
    }
    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || !item.trim()) {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, `${field} must be an array of string`, {
                    details: { field },
                    retryable: false
                })
            );
        }
        result.push(item);
    }
    return result;
}
function extractTransformArgs(args: Record<string, unknown>): Record<string, unknown> {
    const transform: Record<string, unknown> = {};
    if (isRecord(args.position)) {
        transform.position = args.position;
    }
    if (isRecord(args.rotation)) {
        transform.rotation = args.rotation;
    }
    if (isRecord(args.scale)) {
        transform.scale = args.scale;
    }
    return transform;
}
function extractPosition(args: Record<string, unknown>): Record<string, unknown> | undefined {
    if (isRecord(args.position)) {
        return args.position;
    }
    return undefined;
}
function normalizeWorkflowProperties(value: unknown): WorkflowPropertyItem[] {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new V2BusinessErrorException(
            createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, 'properties 必须是数组', {
                details: { field: 'properties' },
                retryable: false
            })
        );
    }
    return value.map((item, index) => {
        if (!isRecord(item)) {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, `properties[${index}] 必须是对象`, {
                    details: { field: `properties[${index}]` },
                    retryable: false
                })
            );
        }
        const property = requireString(item.property, `properties[${index}].property`);
        const propertyType = requireString(item.propertyType, `properties[${index}].propertyType`);
        if (!Object.prototype.hasOwnProperty.call(item, 'value')) {
            throw new V2BusinessErrorException(
                createBusinessError(V2_ERROR_CODES.INVALID_ARGUMENT, `properties[${index}].value is required`, {
                    details: { field: `properties[${index}].value` },
                    retryable: false
                })
            );
        }
        return {
            componentType: optionalString(item.componentType) ?? undefined,
            property,
            propertyType,
            value: item.value
        };
    });
}
function getScriptClassName(scriptPath: string): string {
    const fileName = scriptPath.split('/').pop() ?? scriptPath;
    return fileName.replace(/\.ts$/i, '').replace(/\.js$/i, '') || 'UnknownScript';
}
function resolveSpriteFrameUuid(detailsResult: unknown): string | null {
    const subAssets = readPath(detailsResult, 'data.subAssets');
    if (!Array.isArray(subAssets)) {
        return null;
    }
    const spriteFrame = subAssets.find((item) => {
        if (!isRecord(item)) {
            return false;
        }
        return optionalString(item.type) === 'spriteFrame';
    });
    if (isRecord(spriteFrame) && typeof spriteFrame.uuid === 'string') {
        return spriteFrame.uuid;
    }
    const fallback = subAssets.find((item) => {
        if (!isRecord(item)) {
            return false;
        }
        const uuid = optionalString(item.uuid);
        return typeof uuid === 'string' && uuid.includes('@f9941');
    });
    if (isRecord(fallback) && typeof fallback.uuid === 'string') {
        return fallback.uuid;
    }
    return null;
}
function readPath(source: unknown, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = source;
    for (const segment of segments) {
        if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
