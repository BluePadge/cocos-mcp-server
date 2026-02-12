"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflowToolDescriptors = createWorkflowToolDescriptors;
const messages_1 = require("./messages");
const v2_errors_1 = require("./v2-errors");
function createWorkflowToolDescriptors(deps) {
    return [
        createWorkflowCreateUiNodeWithComponents(deps),
        createWorkflowBindScriptToNode(deps),
        createWorkflowSafeSetTransform(deps),
        createWorkflowImportAndAssignSprite(deps),
        createWorkflowOpenSceneAndValidate(deps),
        createWorkflowCreateOrUpdatePrefabInstance(deps)
    ];
}
function createWorkflowCreateUiNodeWithComponents(deps) {
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
            const stages = [];
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
function createWorkflowBindScriptToNode(deps) {
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
            var _a;
            const nodeUuid = requireString(args.nodeUuid, 'nodeUuid');
            const scriptPath = requireString(args.scriptPath, 'scriptPath');
            const writeArgs = deps.validateWriteCommonArgs(args);
            const propertyItems = normalizeWorkflowProperties(args.properties);
            const scriptClassName = getScriptClassName(scriptPath);
            const stages = [];
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
            const appliedProperties = [];
            for (const item of propertyItems) {
                const componentType = (_a = item.componentType) !== null && _a !== void 0 ? _a : scriptClassName;
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
function createWorkflowSafeSetTransform(deps) {
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
            var _a;
            const nodeUuid = requireString(args.nodeUuid, 'nodeUuid');
            const writeArgs = deps.validateWriteCommonArgs(args);
            const transform = extractTransformArgs(args);
            if (Object.keys(transform).length === 0) {
                throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'position/rotation/scale 至少需要提供一个', {
                    details: { field: 'position|rotation|scale' },
                    suggestion: '请至少传入一个变换字段。',
                    retryable: false
                }));
            }
            const stages = [];
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
                const result = await context.callLegacyTool('node_set_node_transform', Object.assign({ uuid: nodeUuid }, transform));
                deps.ensureLegacySuccess(result, 'set_transform');
                return result;
            });
            const afterResult = await runStage(stages, 'get_after_state', deps.now, async () => {
                const result = await context.callLegacyTool('node_get_node_info', { uuid: nodeUuid });
                deps.ensureLegacySuccess(result, 'get_after_state');
                return result;
            });
            const warningRaw = (_a = deps.pickString(setResult, ['warning'])) !== null && _a !== void 0 ? _a : '';
            return {
                before: deps.pickValue(beforeResult, ['data']),
                after: deps.pickValue(afterResult, ['data']),
                warnings: warningRaw ? [warningRaw] : [],
                stages
            };
        }
    };
}
function createWorkflowImportAndAssignSprite(deps) {
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
            var _a;
            const sourcePath = requireString(args.sourcePath, 'sourcePath');
            const targetNodeUuid = requireString(args.targetNodeUuid, 'targetNodeUuid');
            const targetFolder = (_a = optionalString(args.targetFolder)) !== null && _a !== void 0 ? _a : 'db://assets/workflow-imports';
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages = [];
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
                throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INTERNAL, '导入资源后未返回 assetPath', {
                    stage: 'import_asset',
                    details: importResult,
                    retryable: false
                }));
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
                throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.NOT_FOUND, '未找到可用的 spriteFrame 子资源', {
                    stage: 'resolve_sprite_frame',
                    details: { assetPath },
                    suggestion: '请确认图片资源已成功导入并生成 SpriteFrame。',
                    retryable: false
                }));
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
function createWorkflowOpenSceneAndValidate(deps) {
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
            var _a, _b;
            const scenePath = requireString(args.scenePath, 'scenePath');
            const checkMissingAssets = (_a = optionalBoolean(args.checkMissingAssets)) !== null && _a !== void 0 ? _a : true;
            const checkPerformance = (_b = optionalBoolean(args.checkPerformance)) !== null && _b !== void 0 ? _b : true;
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages = [];
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
function createWorkflowCreateOrUpdatePrefabInstance(deps) {
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
            var _a, _b;
            const prefabPath = requireString(args.prefabPath, 'prefabPath');
            const parentUuid = requireString(args.parentUuid, 'parentUuid');
            const nodeUuid = optionalString(args.nodeUuid);
            const writeArgs = deps.validateWriteCommonArgs(args);
            const stages = [];
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
                    diffSummary: (_a = deps.pickString(updateResult, ['message', 'data.message'])) !== null && _a !== void 0 ? _a : 'prefab updated',
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
                diffSummary: (_b = deps.pickString(instantiateResult, ['message', 'data.message'])) !== null && _b !== void 0 ? _b : 'prefab instantiated',
                stages
            };
        }
    };
}
async function runStage(stages, stage, now, action) {
    var _a;
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
    }
    catch (error) {
        const businessError = (0, v2_errors_1.toBusinessError)(error);
        businessError.stage = (_a = businessError.stage) !== null && _a !== void 0 ? _a : stage;
        stages.push({
            stage,
            status: 'failed',
            durationMs: now() - startedAt,
            error: {
                code: businessError.code,
                message: businessError.message
            }
        });
        throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(businessError.code, businessError.message, {
            stage,
            details: {
                error: businessError,
                stages
            },
            suggestion: businessError.suggestion,
            retryable: businessError.retryable
        }));
    }
}
function stageOutputSummary(value) {
    if (!(0, messages_1.isRecord)(value)) {
        return value;
    }
    if ((0, messages_1.isRecord)(value.data)) {
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
function requireString(value, field) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, `${field} is required`, {
            details: { field },
            retryable: false
        }));
    }
    return value;
}
function optionalString(value) {
    if (typeof value === 'string' && value.trim()) {
        return value;
    }
    return null;
}
function optionalBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    return null;
}
function requireStringArray(value, field) {
    if (!Array.isArray(value)) {
        throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, `${field} must be an array of string`, {
            details: { field },
            retryable: false
        }));
    }
    const result = [];
    for (const item of value) {
        if (typeof item !== 'string' || !item.trim()) {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, `${field} must be an array of string`, {
                details: { field },
                retryable: false
            }));
        }
        result.push(item);
    }
    return result;
}
function extractTransformArgs(args) {
    const transform = {};
    if ((0, messages_1.isRecord)(args.position)) {
        transform.position = args.position;
    }
    if ((0, messages_1.isRecord)(args.rotation)) {
        transform.rotation = args.rotation;
    }
    if ((0, messages_1.isRecord)(args.scale)) {
        transform.scale = args.scale;
    }
    return transform;
}
function extractPosition(args) {
    if ((0, messages_1.isRecord)(args.position)) {
        return args.position;
    }
    return undefined;
}
function normalizeWorkflowProperties(value) {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, 'properties 必须是数组', {
            details: { field: 'properties' },
            retryable: false
        }));
    }
    return value.map((item, index) => {
        var _a;
        if (!(0, messages_1.isRecord)(item)) {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, `properties[${index}] 必须是对象`, {
                details: { field: `properties[${index}]` },
                retryable: false
            }));
        }
        const property = requireString(item.property, `properties[${index}].property`);
        const propertyType = requireString(item.propertyType, `properties[${index}].propertyType`);
        if (!Object.prototype.hasOwnProperty.call(item, 'value')) {
            throw new v2_errors_1.V2BusinessErrorException((0, v2_errors_1.createBusinessError)(v2_errors_1.V2_ERROR_CODES.INVALID_ARGUMENT, `properties[${index}].value is required`, {
                details: { field: `properties[${index}].value` },
                retryable: false
            }));
        }
        return {
            componentType: (_a = optionalString(item.componentType)) !== null && _a !== void 0 ? _a : undefined,
            property,
            propertyType,
            value: item.value
        };
    });
}
function getScriptClassName(scriptPath) {
    var _a;
    const fileName = (_a = scriptPath.split('/').pop()) !== null && _a !== void 0 ? _a : scriptPath;
    return fileName.replace(/\.ts$/i, '').replace(/\.js$/i, '') || 'UnknownScript';
}
function resolveSpriteFrameUuid(detailsResult) {
    const subAssets = readPath(detailsResult, 'data.subAssets');
    if (!Array.isArray(subAssets)) {
        return null;
    }
    const spriteFrame = subAssets.find((item) => {
        if (!(0, messages_1.isRecord)(item)) {
            return false;
        }
        return optionalString(item.type) === 'spriteFrame';
    });
    if ((0, messages_1.isRecord)(spriteFrame) && typeof spriteFrame.uuid === 'string') {
        return spriteFrame.uuid;
    }
    const fallback = subAssets.find((item) => {
        if (!(0, messages_1.isRecord)(item)) {
            return false;
        }
        const uuid = optionalString(item.uuid);
        return typeof uuid === 'string' && uuid.includes('@f9941');
    });
    if ((0, messages_1.isRecord)(fallback) && typeof fallback.uuid === 'string') {
        return fallback.uuid;
    }
    return null;
}
function readPath(source, path) {
    const segments = path.split('.');
    let current = source;
    for (const segment of segments) {
        if (!(0, messages_1.isRecord)(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjItd29ya2Zsb3ctdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvbWNwL3YyLXdvcmtmbG93LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBd0JBLHNFQVNDO0FBakNELHlDQUFzQztBQUV0QywyQ0FBNkc7QUFzQjdHLFNBQWdCLDZCQUE2QixDQUFDLElBQXdCO0lBQ2xFLE9BQU87UUFDSCx3Q0FBd0MsQ0FBQyxJQUFJLENBQUM7UUFDOUMsOEJBQThCLENBQUMsSUFBSSxDQUFDO1FBQ3BDLDhCQUE4QixDQUFDLElBQUksQ0FBQztRQUNwQyxtQ0FBbUMsQ0FBQyxJQUFJLENBQUM7UUFDekMsa0NBQWtDLENBQUMsSUFBSSxDQUFDO1FBQ3hDLDBDQUEwQyxDQUFDLElBQUksQ0FBQztLQUNuRCxDQUFDO0FBQ04sQ0FBQztBQUNELFNBQVMsd0NBQXdDLENBQUMsSUFBd0I7SUFDdEUsT0FBTztRQUNILFFBQVEsRUFBRTtZQUNOLElBQUksRUFBRSx5Q0FBeUM7WUFDL0MsV0FBVyxFQUFFLHVCQUF1QjtZQUNwQyxLQUFLLEVBQUUsTUFBTTtZQUNiLFFBQVEsRUFBRSxVQUFVO1lBQ3BCLE1BQU0sRUFBRSxVQUFVO1lBQ2xCLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLGFBQWEsRUFBRSxDQUFDLGlCQUFpQixDQUFDO1lBQ2xDLFdBQVcsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUM7Z0JBQ3BDLElBQUksRUFBRSxRQUFRO2dCQUNkLFVBQVUsRUFBRTtvQkFDUixVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO29CQUM5QixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO29CQUN4QixVQUFVLEVBQUU7d0JBQ1IsSUFBSSxFQUFFLE9BQU87d0JBQ2IsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtxQkFDNUI7aUJBQ0o7Z0JBQ0QsUUFB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LENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0QsQ0FBQyxDQUFDLENBQUM7SUFDSCxJQUFJLElBQUEsbUJBQVEsRUFBQyxRQUFRLENBQUMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDMUQsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFDO0FBQ0QsU0FBUyxRQUFRLENBQUMsTUFBZSxFQUFFLElBQVk7SUFDM0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqQyxJQUFJLE9BQU8sR0FBWSxNQUFNLENBQUM7SUFDOUIsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBQSxtQkFBUSxFQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2hGLE9BQU8sU0FBUyxDQUFDO1FBQ3JCLENBQUM7UUFDRCxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNuQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNSZWNvcmQgfSBmcm9tICcuL21lc3NhZ2VzJztcbmltcG9ydCB7IFYyVG9vbERlc2NyaXB0b3IgfSBmcm9tICcuL3YyLW1vZGVscyc7XG5pbXBvcnQgeyBWMkJ1c2luZXNzRXJyb3JFeGNlcHRpb24sIFYyX0VSUk9SX0NPREVTLCBjcmVhdGVCdXNpbmVzc0Vycm9yLCB0b0J1c2luZXNzRXJyb3IgfSBmcm9tICcuL3YyLWVycm9ycyc7XG5pbnRlcmZhY2UgV29ya2Zsb3dTdGFnZVJlY29yZCB7XG4gICAgc3RhZ2U6IHN0cmluZztcbiAgICBzdGF0dXM6ICdzdWNjZXNzJyB8ICdmYWlsZWQnIHwgJ3NraXBwZWQnO1xuICAgIGR1cmF0aW9uTXM6IG51bWJlcjtcbiAgICBvdXRwdXQ/OiB1bmtub3duO1xuICAgIGVycm9yPzogdW5rbm93bjtcbn1cbmludGVyZmFjZSBXb3JrZmxvd1Byb3BlcnR5SXRlbSB7XG4gICAgY29tcG9uZW50VHlwZT86IHN0cmluZztcbiAgICBwcm9wZXJ0eTogc3RyaW5nO1xuICAgIHByb3BlcnR5VHlwZTogc3RyaW5nO1xuICAgIHZhbHVlOiB1bmtub3duO1xufVxuZXhwb3J0IGludGVyZmFjZSBXb3JrZmxvd0hlbHBlckRlcHMge1xuICAgIHdpdGhXcml0ZUNvbW1vbkZpZWxkczogKHNjaGVtYTogdW5rbm93biwgc3VwcG9ydHNXcml0ZTogYm9vbGVhbikgPT4gUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgdmFsaWRhdGVXcml0ZUNvbW1vbkFyZ3M6IChhcmdzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4geyBkcnlSdW46IGJvb2xlYW4gfTtcbiAgICBlbnN1cmVMZWdhY3lTdWNjZXNzOiAocmVzdWx0OiB1bmtub3duLCBzdGFnZTogc3RyaW5nKSA9PiB2b2lkO1xuICAgIHBpY2tTdHJpbmc6IChzb3VyY2U6IHVua25vd24sIHBhdGhzOiBzdHJpbmdbXSkgPT4gc3RyaW5nIHwgbnVsbDtcbiAgICBwaWNrVmFsdWU6IChzb3VyY2U6IHVua25vd24sIHBhdGhzOiBzdHJpbmdbXSkgPT4gdW5rbm93bjtcbiAgICBub3c6ICgpID0+IG51bWJlcjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXb3JrZmxvd1Rvb2xEZXNjcmlwdG9ycyhkZXBzOiBXb3JrZmxvd0hlbHBlckRlcHMpOiBWMlRvb2xEZXNjcmlwdG9yW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIGNyZWF0ZVdvcmtmbG93Q3JlYXRlVWlOb2RlV2l0aENvbXBvbmVudHMoZGVwcyksXG4gICAgICAgIGNyZWF0ZVdvcmtmbG93QmluZFNjcmlwdFRvTm9kZShkZXBzKSxcbiAgICAgICAgY3JlYXRlV29ya2Zsb3dTYWZlU2V0VHJhbnNmb3JtKGRlcHMpLFxuICAgICAgICBjcmVhdGVXb3JrZmxvd0ltcG9ydEFuZEFzc2lnblNwcml0ZShkZXBzKSxcbiAgICAgICAgY3JlYXRlV29ya2Zsb3dPcGVuU2NlbmVBbmRWYWxpZGF0ZShkZXBzKSxcbiAgICAgICAgY3JlYXRlV29ya2Zsb3dDcmVhdGVPclVwZGF0ZVByZWZhYkluc3RhbmNlKGRlcHMpXG4gICAgXTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVdvcmtmbG93Q3JlYXRlVWlOb2RlV2l0aENvbXBvbmVudHMoZGVwczogV29ya2Zsb3dIZWxwZXJEZXBzKTogVjJUb29sRGVzY3JpcHRvciB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICAgIG5hbWU6ICd3b3JrZmxvd19jcmVhdGVfdWlfbm9kZV93aXRoX2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfliJvlu7ogVUkg6IqC54K55bm25oyC6L2957uE5Lu277yM5YeP5bCR5aSa5qyh6LCD55So44CCJyxcbiAgICAgICAgICAgIGxheWVyOiAnY29yZScsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3dvcmtmbG93JyxcbiAgICAgICAgICAgIHNhZmV0eTogJ211dGF0aW5nJyxcbiAgICAgICAgICAgIGlkZW1wb3RlbnQ6IGZhbHNlLFxuICAgICAgICAgICAgc3VwcG9ydHNEcnlSdW46IHRydWUsXG4gICAgICAgICAgICBwcmVyZXF1aXNpdGVzOiBbJ3NjZW5lUmVhZHk9dHJ1ZSddLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IGRlcHMud2l0aFdyaXRlQ29tbW9uRmllbGRzKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydwYXJlbnRVdWlkJywgJ25hbWUnLCAnY29tcG9uZW50cyddXG4gICAgICAgICAgICB9LCB0cnVlKSxcbiAgICAgICAgICAgIG91dHB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgYXBwbGllZENvbXBvbmVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHN0YWdlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7IHR5cGU6ICdvYmplY3QnIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6ICdyb290LXVpLXV1aWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ1Njb3JlUGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogWydjYy5VSVRyYW5zZm9ybScsICdjYy5TcHJpdGUnXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiAncm9vdC11aS11dWlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdTY29yZVBhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IFsnY2MuVUlUcmFuc2Zvcm0nLCAnY2MuU3ByaXRlJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICBkcnlSdW46IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcbiAgICAgICAgZXhlY3V0ZTogYXN5bmMgKGFyZ3MsIGNvbnRleHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFV1aWQgPSByZXF1aXJlU3RyaW5nKGFyZ3MucGFyZW50VXVpZCwgJ3BhcmVudFV1aWQnKTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSByZXF1aXJlU3RyaW5nKGFyZ3MubmFtZSwgJ25hbWUnKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlU3RyaW5nQXJyYXkoYXJncy5jb21wb25lbnRzLCAnY29tcG9uZW50cycpO1xuICAgICAgICAgICAgY29uc3Qgd3JpdGVBcmdzID0gZGVwcy52YWxpZGF0ZVdyaXRlQ29tbW9uQXJncyhhcmdzKTtcbiAgICAgICAgICAgIGNvbnN0IHN0YWdlczogV29ya2Zsb3dTdGFnZVJlY29yZFtdID0gW107XG4gICAgICAgICAgICBpZiAod3JpdGVBcmdzLmRyeVJ1bikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGRyeVJ1bjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcmlza0xldmVsOiAnbWVkaXVtJyxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlczogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjcmVhdGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogYHBhcmVudDoke3BhcmVudFV1aWR9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogJ25vZGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG86IHsgbmFtZSwgY29tcG9uZW50cyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIHN0YWdlczogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YWdlOiAnY3JlYXRlX25vZGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ3NraXBwZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uTXM6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0OiAnZHJ5UnVuPXRydWXvvIzmnKrmiafooYwgY3JlYXRlX25vZGUnXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3RhZ2VSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICdjcmVhdGVfbm9kZScsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5jYWxsTGVnYWN5VG9vbCgnbm9kZV9jcmVhdGVfbm9kZScsIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlcHMuZW5zdXJlTGVnYWN5U3VjY2VzcyhyZXN1bHQsICdjcmVhdGVfbm9kZScpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6IGRlcHMucGlja1N0cmluZyhzdGFnZVJlc3VsdCwgWydkYXRhLnV1aWQnLCAnZGF0YS5ub2RlVXVpZCcsICd1dWlkJywgJ25vZGVVdWlkJ10pLFxuICAgICAgICAgICAgICAgIGFwcGxpZWRDb21wb25lbnRzOiBjb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHN0YWdlc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH07XG59XG5mdW5jdGlvbiBjcmVhdGVXb3JrZmxvd0JpbmRTY3JpcHRUb05vZGUoZGVwczogV29ya2Zsb3dIZWxwZXJEZXBzKTogVjJUb29sRGVzY3JpcHRvciB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICAgIG5hbWU6ICd3b3JrZmxvd19iaW5kX3NjcmlwdF90b19ub2RlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Li66IqC54K557uR5a6a6ISa5pys5bm25om56YeP6K6+572u5YWs5byA5bGe5oCn44CCJyxcbiAgICAgICAgICAgIGxheWVyOiAnY29yZScsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3dvcmtmbG93JyxcbiAgICAgICAgICAgIHNhZmV0eTogJ211dGF0aW5nJyxcbiAgICAgICAgICAgIGlkZW1wb3RlbnQ6IGZhbHNlLFxuICAgICAgICAgICAgc3VwcG9ydHNEcnlSdW46IHRydWUsXG4gICAgICAgICAgICBwcmVyZXF1aXNpdGVzOiBbJ25vZGVFeGlzdHM9dHJ1ZSddLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IGRlcHMud2l0aFdyaXRlQ29tbW9uRmllbGRzKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdFBhdGg6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VHlwZTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZToge31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Byb3BlcnR5JywgJ3Byb3BlcnR5VHlwZScsICd2YWx1ZSddXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJywgJ3NjcmlwdFBhdGgnXVxuICAgICAgICAgICAgfSwgdHJ1ZSksXG4gICAgICAgICAgICBvdXRwdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IHsgdHlwZTogWydzdHJpbmcnLCAnbnVsbCddIH0sXG4gICAgICAgICAgICAgICAgICAgIGFwcGxpZWRQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ29iamVjdCcgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzdGFnZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnb2JqZWN0JyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhhbXBsZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtdXVpZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRQYXRoOiAnZGI6Ly9hc3NldHMvc2NyaXB0cy9QbGF5ZXIudHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6ICdzcGVlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiA2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogJ25vZGUtdXVpZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRQYXRoOiAnZGI6Ly9hc3NldHMvc2NyaXB0cy9QbGF5ZXIudHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHJ5UnVuOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgICAgIGV4ZWN1dGU6IGFzeW5jIChhcmdzLCBjb250ZXh0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IHJlcXVpcmVTdHJpbmcoYXJncy5ub2RlVXVpZCwgJ25vZGVVdWlkJyk7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRQYXRoID0gcmVxdWlyZVN0cmluZyhhcmdzLnNjcmlwdFBhdGgsICdzY3JpcHRQYXRoJyk7XG4gICAgICAgICAgICBjb25zdCB3cml0ZUFyZ3MgPSBkZXBzLnZhbGlkYXRlV3JpdGVDb21tb25BcmdzKGFyZ3MpO1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlJdGVtcyA9IG5vcm1hbGl6ZVdvcmtmbG93UHJvcGVydGllcyhhcmdzLnByb3BlcnRpZXMpO1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0Q2xhc3NOYW1lID0gZ2V0U2NyaXB0Q2xhc3NOYW1lKHNjcmlwdFBhdGgpO1xuICAgICAgICAgICAgY29uc3Qgc3RhZ2VzOiBXb3JrZmxvd1N0YWdlUmVjb3JkW10gPSBbXTtcbiAgICAgICAgICAgIGlmICh3cml0ZUFyZ3MuZHJ5UnVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZHJ5UnVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBgbm9kZToke25vZGVVdWlkfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6ICdzY3JpcHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG86IHsgc2NyaXB0UGF0aCwgcHJvcGVydGllczogcHJvcGVydHlJdGVtcy5sZW5ndGggfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICBzdGFnZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFnZTogJ2F0dGFjaF9zY3JpcHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ3NraXBwZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uTXM6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0OiAnZHJ5UnVuPXRydWXvvIzmnKrmiafooYwgYXR0YWNoX3NjcmlwdCdcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhdHRhY2hSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICdhdHRhY2hfc2NyaXB0JywgZGVwcy5ub3csIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250ZXh0LmNhbGxMZWdhY3lUb29sKCdjb21wb25lbnRfYXR0YWNoX3NjcmlwdCcsIHsgbm9kZVV1aWQsIHNjcmlwdFBhdGggfSk7XG4gICAgICAgICAgICAgICAgZGVwcy5lbnN1cmVMZWdhY3lTdWNjZXNzKHJlc3VsdCwgJ2F0dGFjaF9zY3JpcHQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkUHJvcGVydGllczogQXJyYXk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+ID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcHJvcGVydHlJdGVtcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSBpdGVtLmNvbXBvbmVudFR5cGUgPz8gc2NyaXB0Q2xhc3NOYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YWdlTmFtZSA9IGBzZXRfcHJvcGVydHk6JHtpdGVtLnByb3BlcnR5fWA7XG4gICAgICAgICAgICAgICAgYXdhaXQgcnVuU3RhZ2Uoc3RhZ2VzLCBzdGFnZU5hbWUsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRleHQuY2FsbExlZ2FjeVRvb2woJ2NvbXBvbmVudF9zZXRfY29tcG9uZW50X3Byb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IGl0ZW0ucHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IGl0ZW0ucHJvcGVydHlUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGl0ZW0udmFsdWVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGRlcHMuZW5zdXJlTGVnYWN5U3VjY2VzcyhyZXN1bHQsIHN0YWdlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGFwcGxpZWRQcm9wZXJ0aWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiBpdGVtLnByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlUeXBlOiBpdGVtLnByb3BlcnR5VHlwZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50VXVpZDogZGVwcy5waWNrU3RyaW5nKGF0dGFjaFJlc3VsdCwgWydkYXRhLmNvbXBvbmVudFV1aWQnLCAnZGF0YS51dWlkJywgJ3V1aWQnXSksXG4gICAgICAgICAgICAgICAgYXBwbGllZFByb3BlcnRpZXMsXG4gICAgICAgICAgICAgICAgc3RhZ2VzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVdvcmtmbG93U2FmZVNldFRyYW5zZm9ybShkZXBzOiBXb3JrZmxvd0hlbHBlckRlcHMpOiBWMlRvb2xEZXNjcmlwdG9yIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBtYW5pZmVzdDoge1xuICAgICAgICAgICAgbmFtZTogJ3dvcmtmbG93X3NhZmVfc2V0X3RyYW5zZm9ybScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ivu+WPluWJjeWQjueKtuaAgeW5tuWuieWFqOiuvue9ruiKgueCueWPmOaNouOAgicsXG4gICAgICAgICAgICBsYXllcjogJ2NvcmUnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICd3b3JrZmxvdycsXG4gICAgICAgICAgICBzYWZldHk6ICdtdXRhdGluZycsXG4gICAgICAgICAgICBpZGVtcG90ZW50OiB0cnVlLFxuICAgICAgICAgICAgc3VwcG9ydHNEcnlSdW46IHRydWUsXG4gICAgICAgICAgICBwcmVyZXF1aXNpdGVzOiBbJ25vZGVFeGlzdHM9dHJ1ZSddLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IGRlcHMud2l0aFdyaXRlQ29tbW9uRmllbGRzKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sIHRydWUpLFxuICAgICAgICAgICAgb3V0cHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBiZWZvcmU6IHsgdHlwZTogWydvYmplY3QnLCAnbnVsbCddIH0sXG4gICAgICAgICAgICAgICAgICAgIGFmdGVyOiB7IHR5cGU6IFsnb2JqZWN0JywgJ251bGwnXSB9LFxuICAgICAgICAgICAgICAgICAgICB3YXJuaW5nczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ29iamVjdCcgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6ICdub2RlLXV1aWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHsgeDogMTAwLCB5OiA4MCwgejogMCB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiAnbm9kZS11dWlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiB7IHo6IDQ1IH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkcnlSdW46IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcbiAgICAgICAgZXhlY3V0ZTogYXN5bmMgKGFyZ3MsIGNvbnRleHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gcmVxdWlyZVN0cmluZyhhcmdzLm5vZGVVdWlkLCAnbm9kZVV1aWQnKTtcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlQXJncyA9IGRlcHMudmFsaWRhdGVXcml0ZUNvbW1vbkFyZ3MoYXJncyk7XG4gICAgICAgICAgICBjb25zdCB0cmFuc2Zvcm0gPSBleHRyYWN0VHJhbnNmb3JtQXJncyhhcmdzKTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyh0cmFuc2Zvcm0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBWMkJ1c2luZXNzRXJyb3JFeGNlcHRpb24oXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZUJ1c2luZXNzRXJyb3IoVjJfRVJST1JfQ09ERVMuSU5WQUxJRF9BUkdVTUVOVCwgJ3Bvc2l0aW9uL3JvdGF0aW9uL3NjYWxlIOiHs+WwkemcgOimgeaPkOS+m+S4gOS4qicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IHsgZmllbGQ6ICdwb3NpdGlvbnxyb3RhdGlvbnxzY2FsZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb246ICfor7foh7PlsJHkvKDlhaXkuIDkuKrlj5jmjaLlrZfmrrXjgIInLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0cnlhYmxlOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzdGFnZXM6IFdvcmtmbG93U3RhZ2VSZWNvcmRbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgYmVmb3JlUmVzdWx0ID0gYXdhaXQgcnVuU3RhZ2Uoc3RhZ2VzLCAnZ2V0X2JlZm9yZV9zdGF0ZScsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5jYWxsTGVnYWN5VG9vbCgnbm9kZV9nZXRfbm9kZV9pbmZvJywgeyB1dWlkOiBub2RlVXVpZCB9KTtcbiAgICAgICAgICAgICAgICBkZXBzLmVuc3VyZUxlZ2FjeVN1Y2Nlc3MocmVzdWx0LCAnZ2V0X2JlZm9yZV9zdGF0ZScpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICh3cml0ZUFyZ3MuZHJ5UnVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZHJ5UnVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBgbm9kZToke25vZGVVdWlkfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6ICd0cmFuc2Zvcm0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IGRlcHMucGlja1ZhbHVlKGJlZm9yZVJlc3VsdCwgWydkYXRhLnBvc2l0aW9uJywgJ2RhdGEucm90YXRpb24nLCAnZGF0YS5zY2FsZSddKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bzogdHJhbnNmb3JtXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIGJlZm9yZTogZGVwcy5waWNrVmFsdWUoYmVmb3JlUmVzdWx0LCBbJ2RhdGEnXSksXG4gICAgICAgICAgICAgICAgICAgIGFmdGVyOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICB3YXJuaW5nczogW10sXG4gICAgICAgICAgICAgICAgICAgIHN0YWdlc1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzZXRSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICdzZXRfdHJhbnNmb3JtJywgZGVwcy5ub3csIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250ZXh0LmNhbGxMZWdhY3lUb29sKCdub2RlX3NldF9ub2RlX3RyYW5zZm9ybScsIHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIC4uLnRyYW5zZm9ybVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlcHMuZW5zdXJlTGVnYWN5U3VjY2VzcyhyZXN1bHQsICdzZXRfdHJhbnNmb3JtJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgYWZ0ZXJSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICdnZXRfYWZ0ZXJfc3RhdGUnLCBkZXBzLm5vdywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRleHQuY2FsbExlZ2FjeVRvb2woJ25vZGVfZ2V0X25vZGVfaW5mbycsIHsgdXVpZDogbm9kZVV1aWQgfSk7XG4gICAgICAgICAgICAgICAgZGVwcy5lbnN1cmVMZWdhY3lTdWNjZXNzKHJlc3VsdCwgJ2dldF9hZnRlcl9zdGF0ZScpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHdhcm5pbmdSYXcgPSBkZXBzLnBpY2tTdHJpbmcoc2V0UmVzdWx0LCBbJ3dhcm5pbmcnXSkgPz8gJyc7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGJlZm9yZTogZGVwcy5waWNrVmFsdWUoYmVmb3JlUmVzdWx0LCBbJ2RhdGEnXSksXG4gICAgICAgICAgICAgICAgYWZ0ZXI6IGRlcHMucGlja1ZhbHVlKGFmdGVyUmVzdWx0LCBbJ2RhdGEnXSksXG4gICAgICAgICAgICAgICAgd2FybmluZ3M6IHdhcm5pbmdSYXcgPyBbd2FybmluZ1Jhd10gOiBbXSxcbiAgICAgICAgICAgICAgICBzdGFnZXNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlV29ya2Zsb3dJbXBvcnRBbmRBc3NpZ25TcHJpdGUoZGVwczogV29ya2Zsb3dIZWxwZXJEZXBzKTogVjJUb29sRGVzY3JpcHRvciB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICAgIG5hbWU6ICd3b3JrZmxvd19pbXBvcnRfYW5kX2Fzc2lnbl9zcHJpdGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflr7zlhaXlm77niYflubbnu5HlrprliLDnm67moIfoioLngrkgU3ByaXRlIOe7hOS7tuOAgicsXG4gICAgICAgICAgICBsYXllcjogJ2NvcmUnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICd3b3JrZmxvdycsXG4gICAgICAgICAgICBzYWZldHk6ICdtdXRhdGluZycsXG4gICAgICAgICAgICBpZGVtcG90ZW50OiBmYWxzZSxcbiAgICAgICAgICAgIHN1cHBvcnRzRHJ5UnVuOiB0cnVlLFxuICAgICAgICAgICAgcHJlcmVxdWlzaXRlczogWydzY2VuZVJlYWR5PXRydWUnLCAndGFyZ2V0Tm9kZUhhc1Nwcml0ZT10cnVlJ10sXG4gICAgICAgICAgICBpbnB1dFNjaGVtYTogZGVwcy53aXRoV3JpdGVDb21tb25GaWVsZHMoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgc291cmNlUGF0aDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXROb2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRGb2xkZXI6IHsgdHlwZTogJ3N0cmluZycsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy93b3JrZmxvdy1pbXBvcnRzJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzb3VyY2VQYXRoJywgJ3RhcmdldE5vZGVVdWlkJ11cbiAgICAgICAgICAgIH0sIHRydWUpLFxuICAgICAgICAgICAgb3V0cHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogWydzdHJpbmcnLCAnbnVsbCddIH0sXG4gICAgICAgICAgICAgICAgICAgIHNwcml0ZUZyYW1lVXVpZDogeyB0eXBlOiBbJ3N0cmluZycsICdudWxsJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ29iamVjdCcgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlUGF0aDogJy90bXAvaWNvbi5wbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0Tm9kZVV1aWQ6ICdub2RlLXV1aWQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGg6ICcvdG1wL2ljb24ucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldE5vZGVVdWlkOiAnbm9kZS11dWlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyeVJ1bjogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICBleGVjdXRlOiBhc3luYyAoYXJncywgY29udGV4dCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc291cmNlUGF0aCA9IHJlcXVpcmVTdHJpbmcoYXJncy5zb3VyY2VQYXRoLCAnc291cmNlUGF0aCcpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZVV1aWQgPSByZXF1aXJlU3RyaW5nKGFyZ3MudGFyZ2V0Tm9kZVV1aWQsICd0YXJnZXROb2RlVXVpZCcpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Rm9sZGVyID0gb3B0aW9uYWxTdHJpbmcoYXJncy50YXJnZXRGb2xkZXIpID8/ICdkYjovL2Fzc2V0cy93b3JrZmxvdy1pbXBvcnRzJztcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlQXJncyA9IGRlcHMudmFsaWRhdGVXcml0ZUNvbW1vbkFyZ3MoYXJncyk7XG4gICAgICAgICAgICBjb25zdCBzdGFnZXM6IFdvcmtmbG93U3RhZ2VSZWNvcmRbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHdyaXRlQXJncy5kcnlSdW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBkcnlSdW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY3JlYXRlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHRhcmdldEZvbGRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogJ2Fzc2V0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvOiB7IHNvdXJjZVBhdGggfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAndXBkYXRlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IGBub2RlOiR7dGFyZ2V0Tm9kZVV1aWR9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogJ2NjLlNwcml0ZS5zcHJpdGVGcmFtZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbTogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bzogJ3Nwcml0ZUZyYW1lVXVpZCdcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhZ2U6ICdpbXBvcnRfYXNzZXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ3NraXBwZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uTXM6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0OiAnZHJ5UnVuPXRydWXvvIzmnKrmiafooYwgaW1wb3J0X2Fzc2V0J1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGltcG9ydFJlc3VsdCA9IGF3YWl0IHJ1blN0YWdlKHN0YWdlcywgJ2ltcG9ydF9hc3NldCcsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5jYWxsTGVnYWN5VG9vbCgncHJvamVjdF9pbXBvcnRfYXNzZXQnLCB7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEZvbGRlclxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlcHMuZW5zdXJlTGVnYWN5U3VjY2VzcyhyZXN1bHQsICdpbXBvcnRfYXNzZXQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhc3NldFBhdGggPSBkZXBzLnBpY2tTdHJpbmcoaW1wb3J0UmVzdWx0LCBbJ2RhdGEucGF0aCcsICdwYXRoJ10pO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRVdWlkID0gZGVwcy5waWNrU3RyaW5nKGltcG9ydFJlc3VsdCwgWydkYXRhLnV1aWQnLCAndXVpZCddKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRQYXRoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlQnVzaW5lc3NFcnJvcihWMl9FUlJPUl9DT0RFUy5JTlRFUk5BTCwgJ+WvvOWFpei1hOa6kOWQjuacqui/lOWbniBhc3NldFBhdGgnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFnZTogJ2ltcG9ydF9hc3NldCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBpbXBvcnRSZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRldGFpbHNSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICdyZXNvbHZlX3Nwcml0ZV9mcmFtZScsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5jYWxsTGVnYWN5VG9vbCgncHJvamVjdF9nZXRfYXNzZXRfZGV0YWlscycsIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRQYXRoLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlU3ViQXNzZXRzOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZGVwcy5lbnN1cmVMZWdhY3lTdWNjZXNzKHJlc3VsdCwgJ3Jlc29sdmVfc3ByaXRlX2ZyYW1lJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3Qgc3ByaXRlRnJhbWVVdWlkID0gcmVzb2x2ZVNwcml0ZUZyYW1lVXVpZChkZXRhaWxzUmVzdWx0KTtcbiAgICAgICAgICAgIGlmICghc3ByaXRlRnJhbWVVdWlkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlQnVzaW5lc3NFcnJvcihWMl9FUlJPUl9DT0RFUy5OT1RfRk9VTkQsICfmnKrmib7liLDlj6/nlKjnmoQgc3ByaXRlRnJhbWUg5a2Q6LWE5rqQJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhZ2U6ICdyZXNvbHZlX3Nwcml0ZV9mcmFtZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7IGFzc2V0UGF0aCB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogJ+ivt+ehruiupOWbvueJh+i1hOa6kOW3suaIkOWKn+WvvOWFpeW5tueUn+aIkCBTcHJpdGVGcmFtZeOAgicsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IHJ1blN0YWdlKHN0YWdlcywgJ2Fzc2lnbl9zcHJpdGVfZnJhbWUnLCBkZXBzLm5vdywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRleHQuY2FsbExlZ2FjeVRvb2woJ2NvbXBvbmVudF9zZXRfY29tcG9uZW50X3Byb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogdGFyZ2V0Tm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6ICdjYy5TcHJpdGUnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogJ3Nwcml0ZUZyYW1lJyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlUeXBlOiAnc3ByaXRlRnJhbWUnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogc3ByaXRlRnJhbWVVdWlkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZGVwcy5lbnN1cmVMZWdhY3lTdWNjZXNzKHJlc3VsdCwgJ2Fzc2lnbl9zcHJpdGVfZnJhbWUnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICBzcHJpdGVGcmFtZVV1aWQsXG4gICAgICAgICAgICAgICAgc3RhZ2VzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVdvcmtmbG93T3BlblNjZW5lQW5kVmFsaWRhdGUoZGVwczogV29ya2Zsb3dIZWxwZXJEZXBzKTogVjJUb29sRGVzY3JpcHRvciB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICAgIG5hbWU6ICd3b3JrZmxvd19vcGVuX3NjZW5lX2FuZF92YWxpZGF0ZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOWcuuaZr+W5tuaJp+ihjOWfuuehgOagoemqjOOAgicsXG4gICAgICAgICAgICBsYXllcjogJ2NvcmUnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICd3b3JrZmxvdycsXG4gICAgICAgICAgICBzYWZldHk6ICdtdXRhdGluZycsXG4gICAgICAgICAgICBpZGVtcG90ZW50OiBmYWxzZSxcbiAgICAgICAgICAgIHN1cHBvcnRzRHJ5UnVuOiB0cnVlLFxuICAgICAgICAgICAgcHJlcmVxdWlzaXRlczogWydzY2VuZVBhdGhFeGlzdHM9dHJ1ZSddLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IGRlcHMud2l0aFdyaXRlQ29tbW9uRmllbGRzKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUGF0aDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICBjaGVja01pc3NpbmdBc3NldHM6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrUGVyZm9ybWFuY2U6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZWZhdWx0OiB0cnVlIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3NjZW5lUGF0aCddXG4gICAgICAgICAgICB9LCB0cnVlKSxcbiAgICAgICAgICAgIG91dHB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvblJlcG9ydDogeyB0eXBlOiBbJ29iamVjdCcsICdudWxsJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ29iamVjdCcgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmVQYXRoOiAnZGI6Ly9hc3NldHMvc2NlbmVzL01haW4uc2NlbmUnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lUGF0aDogJ2RiOi8vYXNzZXRzL3NjZW5lcy9NYWluLnNjZW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyeVJ1bjogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICBleGVjdXRlOiBhc3luYyAoYXJncywgY29udGV4dCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmVQYXRoID0gcmVxdWlyZVN0cmluZyhhcmdzLnNjZW5lUGF0aCwgJ3NjZW5lUGF0aCcpO1xuICAgICAgICAgICAgY29uc3QgY2hlY2tNaXNzaW5nQXNzZXRzID0gb3B0aW9uYWxCb29sZWFuKGFyZ3MuY2hlY2tNaXNzaW5nQXNzZXRzKSA/PyB0cnVlO1xuICAgICAgICAgICAgY29uc3QgY2hlY2tQZXJmb3JtYW5jZSA9IG9wdGlvbmFsQm9vbGVhbihhcmdzLmNoZWNrUGVyZm9ybWFuY2UpID8/IHRydWU7XG4gICAgICAgICAgICBjb25zdCB3cml0ZUFyZ3MgPSBkZXBzLnZhbGlkYXRlV3JpdGVDb21tb25BcmdzKGFyZ3MpO1xuICAgICAgICAgICAgY29uc3Qgc3RhZ2VzOiBXb3JrZmxvd1N0YWdlUmVjb3JkW10gPSBbXTtcbiAgICAgICAgICAgIGlmICh3cml0ZUFyZ3MuZHJ5UnVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZHJ5UnVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiAnc2NlbmU6YWN0aXZlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogJ3NjZW5lUGF0aCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbTogJ2N1cnJlbnQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvOiBzY2VuZVBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhZ2U6ICdvcGVuX3NjZW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdza2lwcGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbk1zOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dDogJ2RyeVJ1bj10cnVl77yM5pyq5omn6KGMIG9wZW5fc2NlbmUnXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgcnVuU3RhZ2Uoc3RhZ2VzLCAnb3Blbl9zY2VuZScsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5jYWxsTGVnYWN5VG9vbCgnc2NlbmVfb3Blbl9zY2VuZScsIHsgc2NlbmVQYXRoIH0pO1xuICAgICAgICAgICAgICAgIGRlcHMuZW5zdXJlTGVnYWN5U3VjY2VzcyhyZXN1bHQsICdvcGVuX3NjZW5lJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgdmFsaWRhdGVSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICd2YWxpZGF0ZV9zY2VuZScsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5jYWxsTGVnYWN5VG9vbCgnZGVidWdfdmFsaWRhdGVfc2NlbmUnLCB7XG4gICAgICAgICAgICAgICAgICAgIGNoZWNrTWlzc2luZ0Fzc2V0cyxcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tQZXJmb3JtYW5jZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlcHMuZW5zdXJlTGVnYWN5U3VjY2VzcyhyZXN1bHQsICd2YWxpZGF0ZV9zY2VuZScpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvblJlcG9ydDogZGVwcy5waWNrVmFsdWUodmFsaWRhdGVSZXN1bHQsIFsnZGF0YSddKSxcbiAgICAgICAgICAgICAgICBzdGFnZXNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlV29ya2Zsb3dDcmVhdGVPclVwZGF0ZVByZWZhYkluc3RhbmNlKGRlcHM6IFdvcmtmbG93SGVscGVyRGVwcyk6IFYyVG9vbERlc2NyaXB0b3Ige1xuICAgIHJldHVybiB7XG4gICAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgICAgICBuYW1lOiAnd29ya2Zsb3dfY3JlYXRlX29yX3VwZGF0ZV9wcmVmYWJfaW5zdGFuY2UnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfliJvlu7rmiJbmm7TmlrDpooTliLbkvZPlrp7kvovjgIInLFxuICAgICAgICAgICAgbGF5ZXI6ICdjb3JlJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnd29ya2Zsb3cnLFxuICAgICAgICAgICAgc2FmZXR5OiAnbXV0YXRpbmcnLFxuICAgICAgICAgICAgaWRlbXBvdGVudDogZmFsc2UsXG4gICAgICAgICAgICBzdXBwb3J0c0RyeVJ1bjogdHJ1ZSxcbiAgICAgICAgICAgIHByZXJlcXVpc2l0ZXM6IFsncHJlZmFiUGF0aEV4aXN0cz10cnVlJ10sXG4gICAgICAgICAgICBpbnB1dFNjaGVtYTogZGVwcy53aXRoV3JpdGVDb21tb25GaWVsZHMoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydwcmVmYWJQYXRoJywgJ3BhcmVudFV1aWQnXVxuICAgICAgICAgICAgfSwgdHJ1ZSksXG4gICAgICAgICAgICBvdXRwdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSB9LFxuICAgICAgICAgICAgICAgICAgICBkaWZmU3VtbWFyeTogeyB0eXBlOiBbJ3N0cmluZycsICdudWxsJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ29iamVjdCcgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aDogJ2RiOi8vYXNzZXRzL3ByZWZhYnMvSHVkLnByZWZhYicsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiAnY2FudmFzLXV1aWQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlBhdGg6ICdkYjovL2Fzc2V0cy9wcmVmYWJzL0h1ZC5wcmVmYWInLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogJ2NhbnZhcy11dWlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyeVJ1bjogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICBleGVjdXRlOiBhc3luYyAoYXJncywgY29udGV4dCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiUGF0aCA9IHJlcXVpcmVTdHJpbmcoYXJncy5wcmVmYWJQYXRoLCAncHJlZmFiUGF0aCcpO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IHJlcXVpcmVTdHJpbmcoYXJncy5wYXJlbnRVdWlkLCAncGFyZW50VXVpZCcpO1xuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBvcHRpb25hbFN0cmluZyhhcmdzLm5vZGVVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlQXJncyA9IGRlcHMudmFsaWRhdGVXcml0ZUNvbW1vbkFyZ3MoYXJncyk7XG4gICAgICAgICAgICBjb25zdCBzdGFnZXM6IFdvcmtmbG93U3RhZ2VSZWNvcmRbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHdyaXRlQXJncy5kcnlSdW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBkcnlSdW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBub2RlVXVpZCA/ICd1cGRhdGUnIDogJ2NyZWF0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBub2RlVXVpZCA/IGBub2RlOiR7bm9kZVV1aWR9YCA6IGBwYXJlbnQ6JHtwYXJlbnRVdWlkfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6ICdwcmVmYWInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IG5vZGVVdWlkID8gJ2V4aXN0aW5nLWluc3RhbmNlJyA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG86IHsgcHJlZmFiUGF0aCB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIHN0YWdlczogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YWdlOiBub2RlVXVpZCA/ICd1cGRhdGVfcHJlZmFiJyA6ICdpbnN0YW50aWF0ZV9wcmVmYWInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ3NraXBwZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uTXM6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0OiAnZHJ5UnVuPXRydWXvvIzmnKrmiafooYzpooTliLbkvZPlhpnlhaUnXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5vZGVVdWlkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlUmVzdWx0ID0gYXdhaXQgcnVuU3RhZ2Uoc3RhZ2VzLCAndXBkYXRlX3ByZWZhYicsIGRlcHMubm93LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRleHQuY2FsbExlZ2FjeVRvb2woJ3ByZWZhYl91cGRhdGVfcHJlZmFiJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkZXBzLmVuc3VyZUxlZ2FjeVN1Y2Nlc3MocmVzdWx0LCAndXBkYXRlX3ByZWZhYicpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICBkaWZmU3VtbWFyeTogZGVwcy5waWNrU3RyaW5nKHVwZGF0ZVJlc3VsdCwgWydtZXNzYWdlJywgJ2RhdGEubWVzc2FnZSddKSA/PyAncHJlZmFiIHVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgICAgICBzdGFnZXNcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgaW5zdGFudGlhdGVSZXN1bHQgPSBhd2FpdCBydW5TdGFnZShzdGFnZXMsICdpbnN0YW50aWF0ZV9wcmVmYWInLCBkZXBzLm5vdywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRleHQuY2FsbExlZ2FjeVRvb2woJ3ByZWZhYl9pbnN0YW50aWF0ZV9wcmVmYWInLCB7XG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBleHRyYWN0UG9zaXRpb24oYXJncylcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBkZXBzLmVuc3VyZUxlZ2FjeVN1Y2Nlc3MocmVzdWx0LCAnaW5zdGFudGlhdGVfcHJlZmFiJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogZGVwcy5waWNrU3RyaW5nKGluc3RhbnRpYXRlUmVzdWx0LCBbJ2RhdGEubm9kZVV1aWQnLCAnZGF0YS51dWlkJywgJ25vZGVVdWlkJywgJ3V1aWQnXSksXG4gICAgICAgICAgICAgICAgZGlmZlN1bW1hcnk6IGRlcHMucGlja1N0cmluZyhpbnN0YW50aWF0ZVJlc3VsdCwgWydtZXNzYWdlJywgJ2RhdGEubWVzc2FnZSddKSA/PyAncHJlZmFiIGluc3RhbnRpYXRlZCcsXG4gICAgICAgICAgICAgICAgc3RhZ2VzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIHJ1blN0YWdlPFQ+KFxuICAgIHN0YWdlczogV29ya2Zsb3dTdGFnZVJlY29yZFtdLFxuICAgIHN0YWdlOiBzdHJpbmcsXG4gICAgbm93OiAoKSA9PiBudW1iZXIsXG4gICAgYWN0aW9uOiAoKSA9PiBQcm9taXNlPFQ+XG4pOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCBzdGFydGVkQXQgPSBub3coKTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBhd2FpdCBhY3Rpb24oKTtcbiAgICAgICAgc3RhZ2VzLnB1c2goe1xuICAgICAgICAgICAgc3RhZ2UsXG4gICAgICAgICAgICBzdGF0dXM6ICdzdWNjZXNzJyxcbiAgICAgICAgICAgIGR1cmF0aW9uTXM6IG5vdygpIC0gc3RhcnRlZEF0LFxuICAgICAgICAgICAgb3V0cHV0OiBzdGFnZU91dHB1dFN1bW1hcnkob3V0cHV0KVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBidXNpbmVzc0Vycm9yID0gdG9CdXNpbmVzc0Vycm9yKGVycm9yKTtcbiAgICAgICAgYnVzaW5lc3NFcnJvci5zdGFnZSA9IGJ1c2luZXNzRXJyb3Iuc3RhZ2UgPz8gc3RhZ2U7XG4gICAgICAgIHN0YWdlcy5wdXNoKHtcbiAgICAgICAgICAgIHN0YWdlLFxuICAgICAgICAgICAgc3RhdHVzOiAnZmFpbGVkJyxcbiAgICAgICAgICAgIGR1cmF0aW9uTXM6IG5vdygpIC0gc3RhcnRlZEF0LFxuICAgICAgICAgICAgZXJyb3I6IHtcbiAgICAgICAgICAgICAgICBjb2RlOiBidXNpbmVzc0Vycm9yLmNvZGUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYnVzaW5lc3NFcnJvci5tZXNzYWdlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aHJvdyBuZXcgVjJCdXNpbmVzc0Vycm9yRXhjZXB0aW9uKFxuICAgICAgICAgICAgY3JlYXRlQnVzaW5lc3NFcnJvcihidXNpbmVzc0Vycm9yLmNvZGUsIGJ1c2luZXNzRXJyb3IubWVzc2FnZSwge1xuICAgICAgICAgICAgICAgIHN0YWdlLFxuICAgICAgICAgICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGJ1c2luZXNzRXJyb3IsXG4gICAgICAgICAgICAgICAgICAgIHN0YWdlc1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogYnVzaW5lc3NFcnJvci5zdWdnZXN0aW9uLFxuICAgICAgICAgICAgICAgIHJldHJ5YWJsZTogYnVzaW5lc3NFcnJvci5yZXRyeWFibGVcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgfVxufVxuZnVuY3Rpb24gc3RhZ2VPdXRwdXRTdW1tYXJ5KHZhbHVlOiB1bmtub3duKTogdW5rbm93biB7XG4gICAgaWYgKCFpc1JlY29yZCh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICBpZiAoaXNSZWNvcmQodmFsdWUuZGF0YSkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHZhbHVlLnN1Y2Nlc3MsXG4gICAgICAgICAgICBkYXRhS2V5czogT2JqZWN0LmtleXModmFsdWUuZGF0YSlcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdmFsdWUuc3VjY2VzcyxcbiAgICAgICAga2V5czogT2JqZWN0LmtleXModmFsdWUpXG4gICAgfTtcbn1cbmZ1bmN0aW9uIHJlcXVpcmVTdHJpbmcodmFsdWU6IHVua25vd24sIGZpZWxkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8ICF2YWx1ZS50cmltKCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgIGNyZWF0ZUJ1c2luZXNzRXJyb3IoVjJfRVJST1JfQ09ERVMuSU5WQUxJRF9BUkdVTUVOVCwgYCR7ZmllbGR9IGlzIHJlcXVpcmVkYCwge1xuICAgICAgICAgICAgICAgIGRldGFpbHM6IHsgZmllbGQgfSxcbiAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBvcHRpb25hbFN0cmluZyh2YWx1ZTogdW5rbm93bik6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLnRyaW0oKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuZnVuY3Rpb24gb3B0aW9uYWxCb29sZWFuKHZhbHVlOiB1bmtub3duKTogYm9vbGVhbiB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuZnVuY3Rpb24gcmVxdWlyZVN0cmluZ0FycmF5KHZhbHVlOiB1bmtub3duLCBmaWVsZDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgIGNyZWF0ZUJ1c2luZXNzRXJyb3IoVjJfRVJST1JfQ09ERVMuSU5WQUxJRF9BUkdVTUVOVCwgYCR7ZmllbGR9IG11c3QgYmUgYW4gYXJyYXkgb2Ygc3RyaW5nYCwge1xuICAgICAgICAgICAgICAgIGRldGFpbHM6IHsgZmllbGQgfSxcbiAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRlbSAhPT0gJ3N0cmluZycgfHwgIWl0ZW0udHJpbSgpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVjJCdXNpbmVzc0Vycm9yRXhjZXB0aW9uKFxuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1c2luZXNzRXJyb3IoVjJfRVJST1JfQ09ERVMuSU5WQUxJRF9BUkdVTUVOVCwgYCR7ZmllbGR9IG11c3QgYmUgYW4gYXJyYXkgb2Ygc3RyaW5nYCwge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7IGZpZWxkIH0sXG4gICAgICAgICAgICAgICAgICAgIHJldHJ5YWJsZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQucHVzaChpdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cbmZ1bmN0aW9uIGV4dHJhY3RUcmFuc2Zvcm1BcmdzKGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAgIGNvbnN0IHRyYW5zZm9ybTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgICBpZiAoaXNSZWNvcmQoYXJncy5wb3NpdGlvbikpIHtcbiAgICAgICAgdHJhbnNmb3JtLnBvc2l0aW9uID0gYXJncy5wb3NpdGlvbjtcbiAgICB9XG4gICAgaWYgKGlzUmVjb3JkKGFyZ3Mucm90YXRpb24pKSB7XG4gICAgICAgIHRyYW5zZm9ybS5yb3RhdGlvbiA9IGFyZ3Mucm90YXRpb247XG4gICAgfVxuICAgIGlmIChpc1JlY29yZChhcmdzLnNjYWxlKSkge1xuICAgICAgICB0cmFuc2Zvcm0uc2NhbGUgPSBhcmdzLnNjYWxlO1xuICAgIH1cbiAgICByZXR1cm4gdHJhbnNmb3JtO1xufVxuZnVuY3Rpb24gZXh0cmFjdFBvc2l0aW9uKGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQge1xuICAgIGlmIChpc1JlY29yZChhcmdzLnBvc2l0aW9uKSkge1xuICAgICAgICByZXR1cm4gYXJncy5wb3NpdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZVdvcmtmbG93UHJvcGVydGllcyh2YWx1ZTogdW5rbm93bik6IFdvcmtmbG93UHJvcGVydHlJdGVtW10ge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVjJCdXNpbmVzc0Vycm9yRXhjZXB0aW9uKFxuICAgICAgICAgICAgY3JlYXRlQnVzaW5lc3NFcnJvcihWMl9FUlJPUl9DT0RFUy5JTlZBTElEX0FSR1VNRU5ULCAncHJvcGVydGllcyDlv4XpobvmmK/mlbDnu4QnLCB7XG4gICAgICAgICAgICAgICAgZGV0YWlsczogeyBmaWVsZDogJ3Byb3BlcnRpZXMnIH0sXG4gICAgICAgICAgICAgICAgcmV0cnlhYmxlOiBmYWxzZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlLm1hcCgoaXRlbSwgaW5kZXgpID0+IHtcbiAgICAgICAgaWYgKCFpc1JlY29yZChpdGVtKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXNpbmVzc0Vycm9yKFYyX0VSUk9SX0NPREVTLklOVkFMSURfQVJHVU1FTlQsIGBwcm9wZXJ0aWVzWyR7aW5kZXh9XSDlv4XpobvmmK/lr7nosaFgLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IHsgZmllbGQ6IGBwcm9wZXJ0aWVzWyR7aW5kZXh9XWAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmV0cnlhYmxlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHByb3BlcnR5ID0gcmVxdWlyZVN0cmluZyhpdGVtLnByb3BlcnR5LCBgcHJvcGVydGllc1ske2luZGV4fV0ucHJvcGVydHlgKTtcbiAgICAgICAgY29uc3QgcHJvcGVydHlUeXBlID0gcmVxdWlyZVN0cmluZyhpdGVtLnByb3BlcnR5VHlwZSwgYHByb3BlcnRpZXNbJHtpbmRleH1dLnByb3BlcnR5VHlwZWApO1xuICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChpdGVtLCAndmFsdWUnKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFYyQnVzaW5lc3NFcnJvckV4Y2VwdGlvbihcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXNpbmVzc0Vycm9yKFYyX0VSUk9SX0NPREVTLklOVkFMSURfQVJHVU1FTlQsIGBwcm9wZXJ0aWVzWyR7aW5kZXh9XS52YWx1ZSBpcyByZXF1aXJlZGAsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogeyBmaWVsZDogYHByb3BlcnRpZXNbJHtpbmRleH1dLnZhbHVlYCB9LFxuICAgICAgICAgICAgICAgICAgICByZXRyeWFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IG9wdGlvbmFsU3RyaW5nKGl0ZW0uY29tcG9uZW50VHlwZSkgPz8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJvcGVydHksXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGUsXG4gICAgICAgICAgICB2YWx1ZTogaXRlbS52YWx1ZVxuICAgICAgICB9O1xuICAgIH0pO1xufVxuZnVuY3Rpb24gZ2V0U2NyaXB0Q2xhc3NOYW1lKHNjcmlwdFBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZmlsZU5hbWUgPSBzY3JpcHRQYXRoLnNwbGl0KCcvJykucG9wKCkgPz8gc2NyaXB0UGF0aDtcbiAgICByZXR1cm4gZmlsZU5hbWUucmVwbGFjZSgvXFwudHMkL2ksICcnKS5yZXBsYWNlKC9cXC5qcyQvaSwgJycpIHx8ICdVbmtub3duU2NyaXB0Jztcbn1cbmZ1bmN0aW9uIHJlc29sdmVTcHJpdGVGcmFtZVV1aWQoZGV0YWlsc1Jlc3VsdDogdW5rbm93bik6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IHN1YkFzc2V0cyA9IHJlYWRQYXRoKGRldGFpbHNSZXN1bHQsICdkYXRhLnN1YkFzc2V0cycpO1xuICAgIGlmICghQXJyYXkuaXNBcnJheShzdWJBc3NldHMpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzcHJpdGVGcmFtZSA9IHN1YkFzc2V0cy5maW5kKChpdGVtKSA9PiB7XG4gICAgICAgIGlmICghaXNSZWNvcmQoaXRlbSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3B0aW9uYWxTdHJpbmcoaXRlbS50eXBlKSA9PT0gJ3Nwcml0ZUZyYW1lJztcbiAgICB9KTtcbiAgICBpZiAoaXNSZWNvcmQoc3ByaXRlRnJhbWUpICYmIHR5cGVvZiBzcHJpdGVGcmFtZS51dWlkID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gc3ByaXRlRnJhbWUudXVpZDtcbiAgICB9XG4gICAgY29uc3QgZmFsbGJhY2sgPSBzdWJBc3NldHMuZmluZCgoaXRlbSkgPT4ge1xuICAgICAgICBpZiAoIWlzUmVjb3JkKGl0ZW0pKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdXVpZCA9IG9wdGlvbmFsU3RyaW5nKGl0ZW0udXVpZCk7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdXVpZCA9PT0gJ3N0cmluZycgJiYgdXVpZC5pbmNsdWRlcygnQGY5OTQxJyk7XG4gICAgfSk7XG4gICAgaWYgKGlzUmVjb3JkKGZhbGxiYWNrKSAmJiB0eXBlb2YgZmFsbGJhY2sudXVpZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGZhbGxiYWNrLnV1aWQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuZnVuY3Rpb24gcmVhZFBhdGgoc291cmNlOiB1bmtub3duLCBwYXRoOiBzdHJpbmcpOiB1bmtub3duIHtcbiAgICBjb25zdCBzZWdtZW50cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgICBsZXQgY3VycmVudDogdW5rbm93biA9IHNvdXJjZTtcbiAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2Ygc2VnbWVudHMpIHtcbiAgICAgICAgaWYgKCFpc1JlY29yZChjdXJyZW50KSB8fCAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGN1cnJlbnQsIHNlZ21lbnQpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W3NlZ21lbnRdO1xuICAgIH1cbiAgICByZXR1cm4gY3VycmVudDtcbn1cbiJdfQ==