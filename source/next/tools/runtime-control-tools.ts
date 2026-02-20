import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString } from './common';

interface RuntimeReadinessOptions {
    requireSceneReady: boolean;
    requireBuilderReady: boolean;
    requireAssetDbReady: boolean;
}

interface RuntimeReadinessSnapshot {
    timestamp: string;
    sceneReady: boolean | null;
    builderReady: boolean | null;
    assetDbReady: boolean | null;
    errors: Record<string, string>;
}

interface RuntimeReadinessResult {
    ready: boolean;
    elapsedMs: number;
    timeoutMs: number;
    options: RuntimeReadinessOptions;
    snapshots: RuntimeReadinessSnapshot[];
    finalSnapshot: RuntimeReadinessSnapshot;
}

function toBoolean(value: any, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function clampInt(value: any, fallback: number, min: number, max: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    return Math.min(Math.max(Math.floor(num), min), max);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePanel(value: any): 'default' | 'build-bundle' | null {
    if (value === undefined || value === null || value === '') {
        return 'default';
    }
    if (value === 'default' || value === 'build-bundle') {
        return value;
    }
    return null;
}

function parseScriptArgs(value: any): any[] {
    if (Array.isArray(value)) {
        return value;
    }
    return [];
}

function buildPreviewUrls(ipList: string[], port: number | null): string[] {
    if (!port || port <= 0) {
        return [];
    }
    return ipList
        .filter((item) => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim())
        .map((ip) => `http://${ip}:${port}`);
}

async function queryRuntimeReadiness(requester: EditorRequester): Promise<RuntimeReadinessSnapshot> {
    const errors: Record<string, string> = {};

    let sceneReady: boolean | null = null;
    let builderReady: boolean | null = null;
    let assetDbReady: boolean | null = null;

    try {
        const sceneResult = await requester('scene', 'query-is-ready');
        sceneReady = sceneResult === true;
    } catch (error: any) {
        errors.sceneReady = normalizeError(error);
    }

    try {
        const builderResult = await requester('builder', 'query-worker-ready');
        builderReady = builderResult === true;
    } catch (error: any) {
        errors.builderReady = normalizeError(error);
    }

    try {
        const assetResult = await requester('asset-db', 'query-ready');
        assetDbReady = assetResult === true;
    } catch (error: any) {
        errors.assetDbReady = normalizeError(error);
    }

    return {
        timestamp: new Date().toISOString(),
        sceneReady,
        builderReady,
        assetDbReady,
        errors
    };
}

function evaluateReadiness(snapshot: RuntimeReadinessSnapshot, options: RuntimeReadinessOptions): boolean {
    const scenePass = !options.requireSceneReady || snapshot.sceneReady === true;
    const builderPass = !options.requireBuilderReady || snapshot.builderReady === true;
    const assetDbPass = !options.requireAssetDbReady || snapshot.assetDbReady === true;
    return scenePass && builderPass && assetDbPass;
}

async function waitRuntimeReadiness(
    requester: EditorRequester,
    options: RuntimeReadinessOptions,
    timeoutMs: number,
    intervalMs: number
): Promise<RuntimeReadinessResult> {
    const start = Date.now();
    const snapshots: RuntimeReadinessSnapshot[] = [];

    while (true) {
        const snapshot = await queryRuntimeReadiness(requester);
        snapshots.push(snapshot);

        const ready = evaluateReadiness(snapshot, options);
        const elapsedMs = Date.now() - start;

        if (ready) {
            return {
                ready: true,
                elapsedMs,
                timeoutMs,
                options,
                snapshots,
                finalSnapshot: snapshot
            };
        }

        if (elapsedMs >= timeoutMs) {
            return {
                ready: false,
                elapsedMs,
                timeoutMs,
                options,
                snapshots,
                finalSnapshot: snapshot
            };
        }

        await sleep(intervalMs);
    }
}

export function createRuntimeControlTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        {
            name: 'runtime_query_control_state',
            description: '查询运行控制状态（scene/builder/asset-db/server）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async () => {
                const readiness = await queryRuntimeReadiness(requester);

                let sceneDirty: boolean | null = null;
                let ipList: string[] = [];
                let port: number | null = null;

                const extraErrors: Record<string, string> = {};

                try {
                    const dirty = await requester('scene', 'query-dirty');
                    sceneDirty = dirty === true;
                } catch (error: any) {
                    extraErrors.sceneDirty = normalizeError(error);
                }

                try {
                    const ips = await requester('server', 'query-ip-list');
                    ipList = Array.isArray(ips) ? ips : [];
                } catch (error: any) {
                    extraErrors.serverIpList = normalizeError(error);
                }

                try {
                    const queryPort = await requester('server', 'query-port');
                    port = typeof queryPort === 'number' && Number.isFinite(queryPort) ? queryPort : null;
                } catch (error: any) {
                    extraErrors.serverPort = normalizeError(error);
                }

                const errors = {
                    ...readiness.errors,
                    ...extraErrors
                };

                return ok({
                    scene: {
                        isReady: readiness.sceneReady,
                        isDirty: sceneDirty
                    },
                    builder: {
                        ready: readiness.builderReady
                    },
                    assetDb: {
                        ready: readiness.assetDbReady
                    },
                    server: {
                        ipList,
                        port,
                        previewUrls: buildPreviewUrls(ipList, port)
                    },
                    hasErrors: Object.keys(errors).length > 0,
                    errors
                });
            }
        },
        {
            name: 'runtime_wait_until_ready',
            description: '等待运行环境就绪（scene/builder/asset-db）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {
                    timeoutMs: {
                        type: 'number',
                        description: '超时时间（毫秒），默认 15000，范围 500-120000'
                    },
                    intervalMs: {
                        type: 'number',
                        description: '轮询间隔（毫秒），默认 500，范围 100-5000'
                    },
                    requireSceneReady: {
                        type: 'boolean',
                        description: '是否要求 scene.query-is-ready=true，默认 true'
                    },
                    requireBuilderReady: {
                        type: 'boolean',
                        description: '是否要求 builder.query-worker-ready=true，默认 true'
                    },
                    requireAssetDbReady: {
                        type: 'boolean',
                        description: '是否要求 asset-db.query-ready=true，默认 true'
                    }
                }
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async (args: any) => {
                const timeoutMs = clampInt(args?.timeoutMs, 15000, 500, 120000);
                const intervalMs = clampInt(args?.intervalMs, 500, 100, 5000);
                const options: RuntimeReadinessOptions = {
                    requireSceneReady: toBoolean(args?.requireSceneReady, true),
                    requireBuilderReady: toBoolean(args?.requireBuilderReady, true),
                    requireAssetDbReady: toBoolean(args?.requireAssetDbReady, true)
                };

                const result = await waitRuntimeReadiness(requester, options, timeoutMs, intervalMs);
                return ok(result);
            }
        },
        {
            name: 'runtime_open_builder_panel',
            description: '打开构建面板（默认 default，可选 build-bundle）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {
                    panel: {
                        type: 'string',
                        enum: ['default', 'build-bundle'],
                        description: '构建面板类型，默认 default'
                    },
                    options: {
                        type: 'object',
                        description: '可选，透传给 builder.open 的额外参数'
                    }
                }
            },
            requiredCapabilities: ['builder.open'],
            run: async (args: any) => {
                const panel = parsePanel(args?.panel);
                if (!panel) {
                    return fail('panel 仅支持 default/build-bundle', undefined, 'E_INVALID_ARGUMENT');
                }

                const options = args?.options && typeof args.options === 'object' ? args.options : undefined;
                try {
                    await requester('builder', 'open', panel, options);
                    return ok({
                        opened: true,
                        panel,
                        options: options || null
                    });
                } catch (error: any) {
                    return fail('打开构建面板失败', normalizeError(error));
                }
            }
        },
        {
            name: 'runtime_soft_reload_scene',
            description: '触发场景软重载（scene.soft-reload）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.soft-reload'],
            run: async () => {
                try {
                    await requester('scene', 'soft-reload');
                    return ok({ reloaded: true });
                } catch (error: any) {
                    return fail('场景软重载失败', normalizeError(error));
                }
            }
        },
        {
            name: 'runtime_take_scene_snapshot',
            description: '触发场景快照（scene.snapshot）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.snapshot'],
            run: async () => {
                try {
                    await requester('scene', 'snapshot');
                    return ok({ started: true });
                } catch (error: any) {
                    return fail('触发场景快照失败', normalizeError(error));
                }
            }
        },
        {
            name: 'runtime_abort_scene_snapshot',
            description: '中止场景快照（scene.snapshot-abort）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.snapshot-abort'],
            run: async () => {
                try {
                    await requester('scene', 'snapshot-abort');
                    return ok({ aborted: true });
                } catch (error: any) {
                    return fail('中止场景快照失败', normalizeError(error));
                }
            }
        },
        {
            name: 'runtime_execute_scene_script',
            description: '执行场景脚本方法（scene.execute-scene-script）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: '场景脚本名称'
                    },
                    method: {
                        type: 'string',
                        description: '场景脚本方法名'
                    },
                    args: {
                        type: 'array',
                        description: '可选，方法参数'
                    }
                },
                required: ['name', 'method']
            },
            requiredCapabilities: ['scene.execute-scene-script'],
            run: async (args: any) => {
                const name = toNonEmptyString(args?.name);
                const method = toNonEmptyString(args?.method);
                if (!name || !method) {
                    return fail('name 和 method 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const scriptArgs = parseScriptArgs(args?.args);
                try {
                    const result = await requester('scene', 'execute-scene-script', {
                        name,
                        method,
                        args: scriptArgs
                    });
                    return ok({
                        name,
                        method,
                        args: scriptArgs,
                        result
                    });
                } catch (error: any) {
                    return fail('执行场景脚本失败', normalizeError(error));
                }
            }
        },
        {
            name: 'runtime_execute_test_cycle',
            description: '执行一次运行测试闭环（等待就绪 -> 可选脚本 -> 状态回读）',
            layer: 'official',
            category: 'runtime',
            inputSchema: {
                type: 'object',
                properties: {
                    timeoutMs: {
                        type: 'number',
                        description: '等待就绪超时（毫秒），默认 8000'
                    },
                    intervalMs: {
                        type: 'number',
                        description: '轮询间隔（毫秒），默认 400'
                    },
                    requireSceneReady: {
                        type: 'boolean',
                        description: '是否要求场景 ready，默认 true'
                    },
                    requireBuilderReady: {
                        type: 'boolean',
                        description: '是否要求 builder ready，默认 true'
                    },
                    requireAssetDbReady: {
                        type: 'boolean',
                        description: '是否要求 asset-db ready，默认 true'
                    },
                    runSoftReloadBefore: {
                        type: 'boolean',
                        description: '是否在测试前执行 soft-reload，默认 false'
                    },
                    runSoftReloadAfter: {
                        type: 'boolean',
                        description: '是否在测试后执行 soft-reload，默认 false'
                    },
                    checkSceneDirty: {
                        type: 'boolean',
                        description: '是否回读场景 dirty 状态，默认 true'
                    },
                    failOnDirty: {
                        type: 'boolean',
                        description: '回读到 dirty=true 时是否判定闭环失败，默认 false'
                    },
                    sceneScript: {
                        type: 'object',
                        description: '可选，执行场景脚本步骤',
                        properties: {
                            name: { type: 'string' },
                            method: { type: 'string' },
                            args: { type: 'array' }
                        }
                    }
                }
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async (args: any) => {
                const timeoutMs = clampInt(args?.timeoutMs, 8000, 500, 120000);
                const intervalMs = clampInt(args?.intervalMs, 400, 100, 5000);
                const options: RuntimeReadinessOptions = {
                    requireSceneReady: toBoolean(args?.requireSceneReady, true),
                    requireBuilderReady: toBoolean(args?.requireBuilderReady, true),
                    requireAssetDbReady: toBoolean(args?.requireAssetDbReady, true)
                };

                const steps: Array<{ name: string; success: boolean; skipped?: boolean; detail?: string; data?: any }> = [];
                let overallSuccess = true;

                const runSoftReloadBefore = toBoolean(args?.runSoftReloadBefore, false);
                if (runSoftReloadBefore) {
                    try {
                        await requester('scene', 'soft-reload');
                        steps.push({ name: 'soft_reload_before', success: true });
                    } catch (error: any) {
                        overallSuccess = false;
                        steps.push({ name: 'soft_reload_before', success: false, detail: normalizeError(error) });
                    }
                } else {
                    steps.push({ name: 'soft_reload_before', success: true, skipped: true });
                }

                const readiness = await waitRuntimeReadiness(requester, options, timeoutMs, intervalMs);
                steps.push({
                    name: 'wait_ready',
                    success: readiness.ready,
                    detail: readiness.ready ? 'ready' : 'timeout',
                    data: {
                        elapsedMs: readiness.elapsedMs,
                        finalSnapshot: readiness.finalSnapshot
                    }
                });
                if (!readiness.ready) {
                    overallSuccess = false;
                }

                const script = args?.sceneScript && typeof args.sceneScript === 'object' ? args.sceneScript : null;
                if (script) {
                    const scriptName = toNonEmptyString(script.name);
                    const scriptMethod = toNonEmptyString(script.method);
                    if (!scriptName || !scriptMethod) {
                        overallSuccess = false;
                        steps.push({ name: 'execute_scene_script', success: false, detail: 'sceneScript.name/method 必填' });
                    } else {
                        const scriptArgs = parseScriptArgs(script.args);
                        try {
                            const result = await requester('scene', 'execute-scene-script', {
                                name: scriptName,
                                method: scriptMethod,
                                args: scriptArgs
                            });
                            steps.push({
                                name: 'execute_scene_script',
                                success: true,
                                data: {
                                    name: scriptName,
                                    method: scriptMethod,
                                    args: scriptArgs,
                                    result
                                }
                            });
                        } catch (error: any) {
                            overallSuccess = false;
                            steps.push({ name: 'execute_scene_script', success: false, detail: normalizeError(error) });
                        }
                    }
                } else {
                    steps.push({ name: 'execute_scene_script', success: true, skipped: true });
                }

                const runSoftReloadAfter = toBoolean(args?.runSoftReloadAfter, false);
                if (runSoftReloadAfter) {
                    try {
                        await requester('scene', 'soft-reload');
                        steps.push({ name: 'soft_reload_after', success: true });
                    } catch (error: any) {
                        overallSuccess = false;
                        steps.push({ name: 'soft_reload_after', success: false, detail: normalizeError(error) });
                    }
                } else {
                    steps.push({ name: 'soft_reload_after', success: true, skipped: true });
                }

                const checkSceneDirty = toBoolean(args?.checkSceneDirty, true);
                const failOnDirty = toBoolean(args?.failOnDirty, false);
                let postSceneDirty: boolean | null = null;
                if (checkSceneDirty) {
                    try {
                        const dirty = await requester('scene', 'query-dirty');
                        postSceneDirty = dirty === true;
                        const dirtyPass = !failOnDirty || postSceneDirty !== true;
                        if (!dirtyPass) {
                            overallSuccess = false;
                        }
                        steps.push({
                            name: 'query_scene_dirty',
                            success: dirtyPass,
                            data: {
                                isDirty: postSceneDirty,
                                failOnDirty
                            }
                        });
                    } catch (error: any) {
                        overallSuccess = false;
                        steps.push({ name: 'query_scene_dirty', success: false, detail: normalizeError(error) });
                    }
                } else {
                    steps.push({ name: 'query_scene_dirty', success: true, skipped: true });
                }

                return ok({
                    success: overallSuccess,
                    timeoutMs,
                    intervalMs,
                    readiness,
                    postSceneDirty,
                    steps
                });
            }
        }
    ];
}
