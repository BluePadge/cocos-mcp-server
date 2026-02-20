"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuntimeControlTools = createRuntimeControlTools;
const common_1 = require("./common");
function toBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function clampInt(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    return Math.min(Math.max(Math.floor(num), min), max);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function parsePanel(value) {
    if (value === undefined || value === null || value === '') {
        return 'default';
    }
    if (value === 'default' || value === 'build-bundle') {
        return value;
    }
    return null;
}
function parseScriptArgs(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return [];
}
function buildPreviewUrls(ipList, port) {
    if (!port || port <= 0) {
        return [];
    }
    return ipList
        .filter((item) => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim())
        .map((ip) => `http://${ip}:${port}`);
}
async function queryRuntimeReadiness(requester) {
    const errors = {};
    let sceneReady = null;
    let builderReady = null;
    let assetDbReady = null;
    try {
        const sceneResult = await requester('scene', 'query-is-ready');
        sceneReady = sceneResult === true;
    }
    catch (error) {
        errors.sceneReady = (0, common_1.normalizeError)(error);
    }
    try {
        const builderResult = await requester('builder', 'query-worker-ready');
        builderReady = builderResult === true;
    }
    catch (error) {
        errors.builderReady = (0, common_1.normalizeError)(error);
    }
    try {
        const assetResult = await requester('asset-db', 'query-ready');
        assetDbReady = assetResult === true;
    }
    catch (error) {
        errors.assetDbReady = (0, common_1.normalizeError)(error);
    }
    return {
        timestamp: new Date().toISOString(),
        sceneReady,
        builderReady,
        assetDbReady,
        errors
    };
}
function evaluateReadiness(snapshot, options) {
    const scenePass = !options.requireSceneReady || snapshot.sceneReady === true;
    const builderPass = !options.requireBuilderReady || snapshot.builderReady === true;
    const assetDbPass = !options.requireAssetDbReady || snapshot.assetDbReady === true;
    return scenePass && builderPass && assetDbPass;
}
async function waitRuntimeReadiness(requester, options, timeoutMs, intervalMs) {
    const start = Date.now();
    const snapshots = [];
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
function createRuntimeControlTools(requester) {
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
                let sceneDirty = null;
                let ipList = [];
                let port = null;
                const extraErrors = {};
                try {
                    const dirty = await requester('scene', 'query-dirty');
                    sceneDirty = dirty === true;
                }
                catch (error) {
                    extraErrors.sceneDirty = (0, common_1.normalizeError)(error);
                }
                try {
                    const ips = await requester('server', 'query-ip-list');
                    ipList = Array.isArray(ips) ? ips : [];
                }
                catch (error) {
                    extraErrors.serverIpList = (0, common_1.normalizeError)(error);
                }
                try {
                    const queryPort = await requester('server', 'query-port');
                    port = typeof queryPort === 'number' && Number.isFinite(queryPort) ? queryPort : null;
                }
                catch (error) {
                    extraErrors.serverPort = (0, common_1.normalizeError)(error);
                }
                const errors = Object.assign(Object.assign({}, readiness.errors), extraErrors);
                return (0, common_1.ok)({
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
            run: async (args) => {
                const timeoutMs = clampInt(args === null || args === void 0 ? void 0 : args.timeoutMs, 15000, 500, 120000);
                const intervalMs = clampInt(args === null || args === void 0 ? void 0 : args.intervalMs, 500, 100, 5000);
                const options = {
                    requireSceneReady: toBoolean(args === null || args === void 0 ? void 0 : args.requireSceneReady, true),
                    requireBuilderReady: toBoolean(args === null || args === void 0 ? void 0 : args.requireBuilderReady, true),
                    requireAssetDbReady: toBoolean(args === null || args === void 0 ? void 0 : args.requireAssetDbReady, true)
                };
                const result = await waitRuntimeReadiness(requester, options, timeoutMs, intervalMs);
                return (0, common_1.ok)(result);
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
            run: async (args) => {
                const panel = parsePanel(args === null || args === void 0 ? void 0 : args.panel);
                if (!panel) {
                    return (0, common_1.fail)('panel 仅支持 default/build-bundle', undefined, 'E_INVALID_ARGUMENT');
                }
                const options = (args === null || args === void 0 ? void 0 : args.options) && typeof args.options === 'object' ? args.options : undefined;
                try {
                    await requester('builder', 'open', panel, options);
                    return (0, common_1.ok)({
                        opened: true,
                        panel,
                        options: options || null
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('打开构建面板失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ reloaded: true });
                }
                catch (error) {
                    return (0, common_1.fail)('场景软重载失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ started: true });
                }
                catch (error) {
                    return (0, common_1.fail)('触发场景快照失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ aborted: true });
                }
                catch (error) {
                    return (0, common_1.fail)('中止场景快照失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const name = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.name);
                const method = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.method);
                if (!name || !method) {
                    return (0, common_1.fail)('name 和 method 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const scriptArgs = parseScriptArgs(args === null || args === void 0 ? void 0 : args.args);
                try {
                    const result = await requester('scene', 'execute-scene-script', {
                        name,
                        method,
                        args: scriptArgs
                    });
                    return (0, common_1.ok)({
                        name,
                        method,
                        args: scriptArgs,
                        result
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('执行场景脚本失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const timeoutMs = clampInt(args === null || args === void 0 ? void 0 : args.timeoutMs, 8000, 500, 120000);
                const intervalMs = clampInt(args === null || args === void 0 ? void 0 : args.intervalMs, 400, 100, 5000);
                const options = {
                    requireSceneReady: toBoolean(args === null || args === void 0 ? void 0 : args.requireSceneReady, true),
                    requireBuilderReady: toBoolean(args === null || args === void 0 ? void 0 : args.requireBuilderReady, true),
                    requireAssetDbReady: toBoolean(args === null || args === void 0 ? void 0 : args.requireAssetDbReady, true)
                };
                const steps = [];
                let overallSuccess = true;
                const runSoftReloadBefore = toBoolean(args === null || args === void 0 ? void 0 : args.runSoftReloadBefore, false);
                if (runSoftReloadBefore) {
                    try {
                        await requester('scene', 'soft-reload');
                        steps.push({ name: 'soft_reload_before', success: true });
                    }
                    catch (error) {
                        overallSuccess = false;
                        steps.push({ name: 'soft_reload_before', success: false, detail: (0, common_1.normalizeError)(error) });
                    }
                }
                else {
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
                const script = (args === null || args === void 0 ? void 0 : args.sceneScript) && typeof args.sceneScript === 'object' ? args.sceneScript : null;
                if (script) {
                    const scriptName = (0, common_1.toNonEmptyString)(script.name);
                    const scriptMethod = (0, common_1.toNonEmptyString)(script.method);
                    if (!scriptName || !scriptMethod) {
                        overallSuccess = false;
                        steps.push({ name: 'execute_scene_script', success: false, detail: 'sceneScript.name/method 必填' });
                    }
                    else {
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
                        }
                        catch (error) {
                            overallSuccess = false;
                            steps.push({ name: 'execute_scene_script', success: false, detail: (0, common_1.normalizeError)(error) });
                        }
                    }
                }
                else {
                    steps.push({ name: 'execute_scene_script', success: true, skipped: true });
                }
                const runSoftReloadAfter = toBoolean(args === null || args === void 0 ? void 0 : args.runSoftReloadAfter, false);
                if (runSoftReloadAfter) {
                    try {
                        await requester('scene', 'soft-reload');
                        steps.push({ name: 'soft_reload_after', success: true });
                    }
                    catch (error) {
                        overallSuccess = false;
                        steps.push({ name: 'soft_reload_after', success: false, detail: (0, common_1.normalizeError)(error) });
                    }
                }
                else {
                    steps.push({ name: 'soft_reload_after', success: true, skipped: true });
                }
                const checkSceneDirty = toBoolean(args === null || args === void 0 ? void 0 : args.checkSceneDirty, true);
                const failOnDirty = toBoolean(args === null || args === void 0 ? void 0 : args.failOnDirty, false);
                let postSceneDirty = null;
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
                    }
                    catch (error) {
                        overallSuccess = false;
                        steps.push({ name: 'query_scene_dirty', success: false, detail: (0, common_1.normalizeError)(error) });
                    }
                }
                else {
                    steps.push({ name: 'query_scene_dirty', success: true, skipped: true });
                }
                return (0, common_1.ok)({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVudGltZS1jb250cm9sLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvcnVudGltZS1jb250cm9sLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBMkpBLDhEQXFiQztBQS9rQkQscUNBQXNFO0FBeUJ0RSxTQUFTLFNBQVMsQ0FBQyxLQUFVLEVBQUUsUUFBaUI7SUFDNUMsT0FBTyxPQUFPLEtBQUssS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3pELENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxLQUFVLEVBQUUsUUFBZ0IsRUFBRSxHQUFXLEVBQUUsR0FBVztJQUNwRSxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDMUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUN4QixPQUFPLFFBQVEsQ0FBQztJQUNwQixDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN6RCxDQUFDO0FBRUQsU0FBUyxLQUFLLENBQUMsRUFBVTtJQUNyQixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0QsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEtBQVU7SUFDMUIsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLEVBQUUsRUFBRSxDQUFDO1FBQ3hELE9BQU8sU0FBUyxDQUFDO0lBQ3JCLENBQUM7SUFDRCxJQUFJLEtBQUssS0FB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Q0FBQztvQkFDUCxDQUFDO29CQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7d0JBQ2xCLGNBQWMsR0FBRyxLQUFLLENBQUM7d0JBQ3ZCLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDN0YsQ0FBQztnQkFDTCxDQUFDO3FCQUFNLENBQUM7b0JBQ0osS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUM1RSxDQUFDO2dCQUVELE9BQU8sSUFBQSxXQUFFLEVBQUM7b0JBQ04sT0FBTyxFQUFFLGNBQWM7b0JBQ3ZCLFNBQVM7b0JBQ1QsVUFBVTtvQkFDVixTQUFTO29CQUNULGNBQWM7b0JBQ2QsS0FBSztpQkFDUixDQUFDLENBQUM7WUFDUCxDQUFDO1NBQ0o7S0FDSixDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgdG9Ob25FbXB0eVN0cmluZyB9IGZyb20gJy4vY29tbW9uJztcblxuaW50ZXJmYWNlIFJ1bnRpbWVSZWFkaW5lc3NPcHRpb25zIHtcbiAgICByZXF1aXJlU2NlbmVSZWFkeTogYm9vbGVhbjtcbiAgICByZXF1aXJlQnVpbGRlclJlYWR5OiBib29sZWFuO1xuICAgIHJlcXVpcmVBc3NldERiUmVhZHk6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBSdW50aW1lUmVhZGluZXNzU25hcHNob3Qge1xuICAgIHRpbWVzdGFtcDogc3RyaW5nO1xuICAgIHNjZW5lUmVhZHk6IGJvb2xlYW4gfCBudWxsO1xuICAgIGJ1aWxkZXJSZWFkeTogYm9vbGVhbiB8IG51bGw7XG4gICAgYXNzZXREYlJlYWR5OiBib29sZWFuIHwgbnVsbDtcbiAgICBlcnJvcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmludGVyZmFjZSBSdW50aW1lUmVhZGluZXNzUmVzdWx0IHtcbiAgICByZWFkeTogYm9vbGVhbjtcbiAgICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgICB0aW1lb3V0TXM6IG51bWJlcjtcbiAgICBvcHRpb25zOiBSdW50aW1lUmVhZGluZXNzT3B0aW9ucztcbiAgICBzbmFwc2hvdHM6IFJ1bnRpbWVSZWFkaW5lc3NTbmFwc2hvdFtdO1xuICAgIGZpbmFsU25hcHNob3Q6IFJ1bnRpbWVSZWFkaW5lc3NTbmFwc2hvdDtcbn1cblxuZnVuY3Rpb24gdG9Cb29sZWFuKHZhbHVlOiBhbnksIGZhbGxiYWNrOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nID8gdmFsdWUgOiBmYWxsYmFjaztcbn1cblxuZnVuY3Rpb24gY2xhbXBJbnQodmFsdWU6IGFueSwgZmFsbGJhY2s6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBudW0gPSBOdW1iZXIodmFsdWUpO1xuICAgIGlmICghTnVtYmVyLmlzRmluaXRlKG51bSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbGxiYWNrO1xuICAgIH1cbiAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgoTWF0aC5mbG9vcihudW0pLCBtaW4pLCBtYXgpO1xufVxuXG5mdW5jdGlvbiBzbGVlcChtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGFuZWwodmFsdWU6IGFueSk6ICdkZWZhdWx0JyB8ICdidWlsZC1idW5kbGUnIHwgbnVsbCB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09ICcnKSB7XG4gICAgICAgIHJldHVybiAnZGVmYXVsdCc7XG4gICAgfVxuICAgIGlmICh2YWx1ZSA9PT0gJ2RlZmF1bHQnIHx8IHZhbHVlID09PSAnYnVpbGQtYnVuZGxlJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBwYXJzZVNjcmlwdEFyZ3ModmFsdWU6IGFueSk6IGFueVtdIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gW107XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUHJldmlld1VybHMoaXBMaXN0OiBzdHJpbmdbXSwgcG9ydDogbnVtYmVyIHwgbnVsbCk6IHN0cmluZ1tdIHtcbiAgICBpZiAoIXBvcnQgfHwgcG9ydCA8PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgcmV0dXJuIGlwTGlzdFxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiB0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycgJiYgaXRlbS50cmltKCkgIT09ICcnKVxuICAgICAgICAubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSlcbiAgICAgICAgLm1hcCgoaXApID0+IGBodHRwOi8vJHtpcH06JHtwb3J0fWApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBxdWVyeVJ1bnRpbWVSZWFkaW5lc3MocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBQcm9taXNlPFJ1bnRpbWVSZWFkaW5lc3NTbmFwc2hvdD4ge1xuICAgIGNvbnN0IGVycm9yczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gICAgbGV0IHNjZW5lUmVhZHk6IGJvb2xlYW4gfCBudWxsID0gbnVsbDtcbiAgICBsZXQgYnVpbGRlclJlYWR5OiBib29sZWFuIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGFzc2V0RGJSZWFkeTogYm9vbGVhbiB8IG51bGwgPSBudWxsO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2NlbmVSZXN1bHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWlzLXJlYWR5Jyk7XG4gICAgICAgIHNjZW5lUmVhZHkgPSBzY2VuZVJlc3VsdCA9PT0gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIGVycm9ycy5zY2VuZVJlYWR5ID0gbm9ybWFsaXplRXJyb3IoZXJyb3IpO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkZXJSZXN1bHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ2J1aWxkZXInLCAncXVlcnktd29ya2VyLXJlYWR5Jyk7XG4gICAgICAgIGJ1aWxkZXJSZWFkeSA9IGJ1aWxkZXJSZXN1bHQgPT09IHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICBlcnJvcnMuYnVpbGRlclJlYWR5ID0gbm9ybWFsaXplRXJyb3IoZXJyb3IpO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFzc2V0UmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1yZWFkeScpO1xuICAgICAgICBhc3NldERiUmVhZHkgPSBhc3NldFJlc3VsdCA9PT0gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIGVycm9ycy5hc3NldERiUmVhZHkgPSBub3JtYWxpemVFcnJvcihlcnJvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNjZW5lUmVhZHksXG4gICAgICAgIGJ1aWxkZXJSZWFkeSxcbiAgICAgICAgYXNzZXREYlJlYWR5LFxuICAgICAgICBlcnJvcnNcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBldmFsdWF0ZVJlYWRpbmVzcyhzbmFwc2hvdDogUnVudGltZVJlYWRpbmVzc1NuYXBzaG90LCBvcHRpb25zOiBSdW50aW1lUmVhZGluZXNzT3B0aW9ucyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHNjZW5lUGFzcyA9ICFvcHRpb25zLnJlcXVpcmVTY2VuZVJlYWR5IHx8IHNuYXBzaG90LnNjZW5lUmVhZHkgPT09IHRydWU7XG4gICAgY29uc3QgYnVpbGRlclBhc3MgPSAhb3B0aW9ucy5yZXF1aXJlQnVpbGRlclJlYWR5IHx8IHNuYXBzaG90LmJ1aWxkZXJSZWFkeSA9PT0gdHJ1ZTtcbiAgICBjb25zdCBhc3NldERiUGFzcyA9ICFvcHRpb25zLnJlcXVpcmVBc3NldERiUmVhZHkgfHwgc25hcHNob3QuYXNzZXREYlJlYWR5ID09PSB0cnVlO1xuICAgIHJldHVybiBzY2VuZVBhc3MgJiYgYnVpbGRlclBhc3MgJiYgYXNzZXREYlBhc3M7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdhaXRSdW50aW1lUmVhZGluZXNzKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIG9wdGlvbnM6IFJ1bnRpbWVSZWFkaW5lc3NPcHRpb25zLFxuICAgIHRpbWVvdXRNczogbnVtYmVyLFxuICAgIGludGVydmFsTXM6IG51bWJlclxuKTogUHJvbWlzZTxSdW50aW1lUmVhZGluZXNzUmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IHNuYXBzaG90czogUnVudGltZVJlYWRpbmVzc1NuYXBzaG90W10gPSBbXTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgcXVlcnlSdW50aW1lUmVhZGluZXNzKHJlcXVlc3Rlcik7XG4gICAgICAgIHNuYXBzaG90cy5wdXNoKHNuYXBzaG90KTtcblxuICAgICAgICBjb25zdCByZWFkeSA9IGV2YWx1YXRlUmVhZGluZXNzKHNuYXBzaG90LCBvcHRpb25zKTtcbiAgICAgICAgY29uc3QgZWxhcHNlZE1zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuXG4gICAgICAgIGlmIChyZWFkeSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByZWFkeTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBlbGFwc2VkTXMsXG4gICAgICAgICAgICAgICAgdGltZW91dE1zLFxuICAgICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgICAgc25hcHNob3RzLFxuICAgICAgICAgICAgICAgIGZpbmFsU25hcHNob3Q6IHNuYXBzaG90XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVsYXBzZWRNcyA+PSB0aW1lb3V0TXMpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVsYXBzZWRNcyxcbiAgICAgICAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgICBzbmFwc2hvdHMsXG4gICAgICAgICAgICAgICAgZmluYWxTbmFwc2hvdDogc25hcHNob3RcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBzbGVlcChpbnRlcnZhbE1zKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSdW50aW1lQ29udHJvbFRvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdydW50aW1lX3F1ZXJ5X2NvbnRyb2xfc3RhdGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lov5DooYzmjqfliLbnirbmgIHvvIhzY2VuZS9idWlsZGVyL2Fzc2V0LWRiL3NlcnZlcu+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncnVudGltZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktaXMtcmVhZHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlYWRpbmVzcyA9IGF3YWl0IHF1ZXJ5UnVudGltZVJlYWRpbmVzcyhyZXF1ZXN0ZXIpO1xuXG4gICAgICAgICAgICAgICAgbGV0IHNjZW5lRGlydHk6IGJvb2xlYW4gfCBudWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICBsZXQgaXBMaXN0OiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGxldCBwb3J0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhRXJyb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXJ0eSA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktZGlydHknKTtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmVEaXJ0eSA9IGRpcnR5ID09PSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXh0cmFFcnJvcnMuc2NlbmVEaXJ0eSA9IG5vcm1hbGl6ZUVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpcHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NlcnZlcicsICdxdWVyeS1pcC1saXN0Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlwTGlzdCA9IEFycmF5LmlzQXJyYXkoaXBzKSA/IGlwcyA6IFtdO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXh0cmFFcnJvcnMuc2VydmVySXBMaXN0ID0gbm9ybWFsaXplRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UG9ydCA9IGF3YWl0IHJlcXVlc3Rlcignc2VydmVyJywgJ3F1ZXJ5LXBvcnQnKTtcbiAgICAgICAgICAgICAgICAgICAgcG9ydCA9IHR5cGVvZiBxdWVyeVBvcnQgPT09ICdudW1iZXInICYmIE51bWJlci5pc0Zpbml0ZShxdWVyeVBvcnQpID8gcXVlcnlQb3J0IDogbnVsbDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGV4dHJhRXJyb3JzLnNlcnZlclBvcnQgPSBub3JtYWxpemVFcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZXJyb3JzID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi5yZWFkaW5lc3MuZXJyb3JzLFxuICAgICAgICAgICAgICAgICAgICAuLi5leHRyYUVycm9yc1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICBzY2VuZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNSZWFkeTogcmVhZGluZXNzLnNjZW5lUmVhZHksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0RpcnR5OiBzY2VuZURpcnR5XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWR5OiByZWFkaW5lc3MuYnVpbGRlclJlYWR5XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0RGI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWR5OiByZWFkaW5lc3MuYXNzZXREYlJlYWR5XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNlcnZlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXBMaXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpZXdVcmxzOiBidWlsZFByZXZpZXdVcmxzKGlwTGlzdCwgcG9ydClcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgaGFzRXJyb3JzOiBPYmplY3Qua2V5cyhlcnJvcnMpLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV93YWl0X3VudGlsX3JlYWR5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn562J5b6F6L+Q6KGM546v5aKD5bCx57uq77yIc2NlbmUvYnVpbGRlci9hc3NldC1kYu+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncnVudGltZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dE1zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6LaF5pe25pe26Ze077yI5q+r56eS77yJ77yM6buY6K6kIDE1MDAw77yM6IyD5Zu0IDUwMC0xMjAwMDAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsTXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfova7or6Lpl7TpmpTvvIjmr6vnp5LvvInvvIzpu5jorqQgNTAw77yM6IyD5Zu0IDEwMC01MDAwJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlU2NlbmVSZWFkeToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbopoHmsYIgc2NlbmUucXVlcnktaXMtcmVhZHk9dHJ1Ze+8jOm7mOiupCB0cnVlJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlQnVpbGRlclJlYWR5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuimgeaxgiBidWlsZGVyLnF1ZXJ5LXdvcmtlci1yZWFkeT10cnVl77yM6buY6K6kIHRydWUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVBc3NldERiUmVhZHk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm6KaB5rGCIGFzc2V0LWRiLnF1ZXJ5LXJlYWR5PXRydWXvvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1yZWFkeSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGltZW91dE1zID0gY2xhbXBJbnQoYXJncz8udGltZW91dE1zLCAxNTAwMCwgNTAwLCAxMjAwMDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGludGVydmFsTXMgPSBjbGFtcEludChhcmdzPy5pbnRlcnZhbE1zLCA1MDAsIDEwMCwgNTAwMCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uczogUnVudGltZVJlYWRpbmVzc09wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVTY2VuZVJlYWR5OiB0b0Jvb2xlYW4oYXJncz8ucmVxdWlyZVNjZW5lUmVhZHksIHRydWUpLFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlQnVpbGRlclJlYWR5OiB0b0Jvb2xlYW4oYXJncz8ucmVxdWlyZUJ1aWxkZXJSZWFkeSwgdHJ1ZSksXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVBc3NldERiUmVhZHk6IHRvQm9vbGVhbihhcmdzPy5yZXF1aXJlQXNzZXREYlJlYWR5LCB0cnVlKVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3YWl0UnVudGltZVJlYWRpbmVzcyhyZXF1ZXN0ZXIsIG9wdGlvbnMsIHRpbWVvdXRNcywgaW50ZXJ2YWxNcyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9rKHJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdydW50aW1lX29wZW5fYnVpbGRlcl9wYW5lbCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOaehOW7uumdouadv++8iOm7mOiupCBkZWZhdWx077yM5Y+v6YCJIGJ1aWxkLWJ1bmRsZe+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncnVudGltZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcGFuZWw6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydkZWZhdWx0JywgJ2J1aWxkLWJ1bmRsZSddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmnoTlu7rpnaLmnb/nsbvlnovvvIzpu5jorqQgZGVmYXVsdCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmAj+S8oOe7mSBidWlsZGVyLm9wZW4g55qE6aKd5aSW5Y+C5pWwJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2J1aWxkZXIub3BlbiddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFuZWwgPSBwYXJzZVBhbmVsKGFyZ3M/LnBhbmVsKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBhbmVsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwYW5lbCDku4XmlK/mjIEgZGVmYXVsdC9idWlsZC1idW5kbGUnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0gYXJncz8ub3B0aW9ucyAmJiB0eXBlb2YgYXJncy5vcHRpb25zID09PSAnb2JqZWN0JyA/IGFyZ3Mub3B0aW9ucyA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ2J1aWxkZXInLCAnb3BlbicsIHBhbmVsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZW5lZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhbmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9ucyB8fCBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJk+W8gOaehOW7uumdouadv+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9zb2Z0X3JlbG9hZF9zY2VuZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+inpuWPkeWcuuaZr+i9r+mHjei9ve+8iHNjZW5lLnNvZnQtcmVsb2Fk77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdydW50aW1lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5zb2Z0LXJlbG9hZCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzb2Z0LXJlbG9hZCcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZWxvYWRlZDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflnLrmma/ova/ph43ovb3lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3J1bnRpbWVfdGFrZV9zY2VuZV9zbmFwc2hvdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+inpuWPkeWcuuaZr+W/q+eFp++8iHNjZW5lLnNuYXBzaG9077yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdydW50aW1lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5zbmFwc2hvdCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzbmFwc2hvdCcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBzdGFydGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+inpuWPkeWcuuaZr+W/q+eFp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9hYm9ydF9zY2VuZV9zbmFwc2hvdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S4reatouWcuuaZr+W/q+eFp++8iHNjZW5lLnNuYXBzaG90LWFib3J077yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdydW50aW1lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5zbmFwc2hvdC1hYm9ydCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzbmFwc2hvdC1hYm9ydCcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBhYm9ydGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+S4reatouWcuuaZr+W/q+eFp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9leGVjdXRlX3NjZW5lX3NjcmlwdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aJp+ihjOWcuuaZr+iEmuacrOaWueazle+8iHNjZW5lLmV4ZWN1dGUtc2NlbmUtc2NyaXB077yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdydW50aW1lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Zy65pmv6ISa5pys5ZCN56ewJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflnLrmma/ohJrmnKzmlrnms5XlkI0nXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaWueazleWPguaVsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbmFtZScsICdtZXRob2QnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmV4ZWN1dGUtc2NlbmUtc2NyaXB0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5uYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXRob2QgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/Lm1ldGhvZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFuYW1lIHx8ICFtZXRob2QpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ25hbWUg5ZKMIG1ldGhvZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHRBcmdzID0gcGFyc2VTY3JpcHRBcmdzKGFyZ3M/LmFyZ3MpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJnczogc2NyaXB0QXJnc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzOiBzY3JpcHRBcmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJp+ihjOWcuuaZr+iEmuacrOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncnVudGltZV9leGVjdXRlX3Rlc3RfY3ljbGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmiafooYzkuIDmrKHov5DooYzmtYvor5Xpl63njq/vvIjnrYnlvoXlsLHnu6ogLT4g5Y+v6YCJ6ISa5pysIC0+IOeKtuaAgeWbnuivu++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncnVudGltZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dE1zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn562J5b6F5bCx57uq6LaF5pe277yI5q+r56eS77yJ77yM6buY6K6kIDgwMDAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsTXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfova7or6Lpl7TpmpTvvIjmr6vnp5LvvInvvIzpu5jorqQgNDAwJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlU2NlbmVSZWFkeToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbopoHmsYLlnLrmma8gcmVhZHnvvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZUJ1aWxkZXJSZWFkeToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbopoHmsYIgYnVpbGRlciByZWFkee+8jOm7mOiupCB0cnVlJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlQXNzZXREYlJlYWR5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuimgeaxgiBhc3NldC1kYiByZWFkee+8jOm7mOiupCB0cnVlJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBydW5Tb2Z0UmVsb2FkQmVmb3JlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuWcqOa1i+ivleWJjeaJp+ihjCBzb2Z0LXJlbG9hZO+8jOm7mOiupCBmYWxzZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcnVuU29mdFJlbG9hZEFmdGVyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuWcqOa1i+ivleWQjuaJp+ihjCBzb2Z0LXJlbG9hZO+8jOm7mOiupCBmYWxzZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tTY2VuZURpcnR5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuWbnuivu+WcuuaZryBkaXJ0eSDnirbmgIHvvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZmFpbE9uRGlydHk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Zue6K+75YiwIGRpcnR5PXRydWUg5pe25piv5ZCm5Yik5a6a6Zet546v5aSx6LSl77yM6buY6K6kIGZhbHNlJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzY2VuZVNjcmlwdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaJp+ihjOWcuuaZr+iEmuacrOatpemqpCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IHsgdHlwZTogJ2FycmF5JyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktaXMtcmVhZHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVvdXRNcyA9IGNsYW1wSW50KGFyZ3M/LnRpbWVvdXRNcywgODAwMCwgNTAwLCAxMjAwMDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGludGVydmFsTXMgPSBjbGFtcEludChhcmdzPy5pbnRlcnZhbE1zLCA0MDAsIDEwMCwgNTAwMCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uczogUnVudGltZVJlYWRpbmVzc09wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVTY2VuZVJlYWR5OiB0b0Jvb2xlYW4oYXJncz8ucmVxdWlyZVNjZW5lUmVhZHksIHRydWUpLFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlQnVpbGRlclJlYWR5OiB0b0Jvb2xlYW4oYXJncz8ucmVxdWlyZUJ1aWxkZXJSZWFkeSwgdHJ1ZSksXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVBc3NldERiUmVhZHk6IHRvQm9vbGVhbihhcmdzPy5yZXF1aXJlQXNzZXREYlJlYWR5LCB0cnVlKVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdGVwczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHN1Y2Nlc3M6IGJvb2xlYW47IHNraXBwZWQ/OiBib29sZWFuOyBkZXRhaWw/OiBzdHJpbmc7IGRhdGE/OiBhbnkgfT4gPSBbXTtcbiAgICAgICAgICAgICAgICBsZXQgb3ZlcmFsbFN1Y2Nlc3MgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcnVuU29mdFJlbG9hZEJlZm9yZSA9IHRvQm9vbGVhbihhcmdzPy5ydW5Tb2Z0UmVsb2FkQmVmb3JlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHJ1blNvZnRSZWxvYWRCZWZvcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnc29mdC1yZWxvYWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBzLnB1c2goeyBuYW1lOiAnc29mdF9yZWxvYWRfYmVmb3JlJywgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmFsbFN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBzLnB1c2goeyBuYW1lOiAnc29mdF9yZWxvYWRfYmVmb3JlJywgc3VjY2VzczogZmFsc2UsIGRldGFpbDogbm9ybWFsaXplRXJyb3IoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3RlcHMucHVzaCh7IG5hbWU6ICdzb2Z0X3JlbG9hZF9iZWZvcmUnLCBzdWNjZXNzOiB0cnVlLCBza2lwcGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlYWRpbmVzcyA9IGF3YWl0IHdhaXRSdW50aW1lUmVhZGluZXNzKHJlcXVlc3Rlciwgb3B0aW9ucywgdGltZW91dE1zLCBpbnRlcnZhbE1zKTtcbiAgICAgICAgICAgICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3dhaXRfcmVhZHknLFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiByZWFkaW5lc3MucmVhZHksXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogcmVhZGluZXNzLnJlYWR5ID8gJ3JlYWR5JyA6ICd0aW1lb3V0JyxcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxhcHNlZE1zOiByZWFkaW5lc3MuZWxhcHNlZE1zLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmluYWxTbmFwc2hvdDogcmVhZGluZXNzLmZpbmFsU25hcHNob3RcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICghcmVhZGluZXNzLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgICAgIG92ZXJhbGxTdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gYXJncz8uc2NlbmVTY3JpcHQgJiYgdHlwZW9mIGFyZ3Muc2NlbmVTY3JpcHQgPT09ICdvYmplY3QnID8gYXJncy5zY2VuZVNjcmlwdCA6IG51bGw7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHROYW1lID0gdG9Ob25FbXB0eVN0cmluZyhzY3JpcHQubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdE1ldGhvZCA9IHRvTm9uRW1wdHlTdHJpbmcoc2NyaXB0Lm1ldGhvZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2NyaXB0TmFtZSB8fCAhc2NyaXB0TWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVyYWxsU3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcHMucHVzaCh7IG5hbWU6ICdleGVjdXRlX3NjZW5lX3NjcmlwdCcsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6ICdzY2VuZVNjcmlwdC5uYW1lL21ldGhvZCDlv4XloasnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0QXJncyA9IHBhcnNlU2NyaXB0QXJncyhzY3JpcHQuYXJncyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHNjcmlwdE5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogc2NyaXB0TWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzOiBzY3JpcHRBcmdzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RlcHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdleGVjdXRlX3NjZW5lX3NjcmlwdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHNjcmlwdE5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IHNjcmlwdE1ldGhvZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IHNjcmlwdEFyZ3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJhbGxTdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RlcHMucHVzaCh7IG5hbWU6ICdleGVjdXRlX3NjZW5lX3NjcmlwdCcsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IG5vcm1hbGl6ZUVycm9yKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ZXBzLnB1c2goeyBuYW1lOiAnZXhlY3V0ZV9zY2VuZV9zY3JpcHQnLCBzdWNjZXNzOiB0cnVlLCBza2lwcGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJ1blNvZnRSZWxvYWRBZnRlciA9IHRvQm9vbGVhbihhcmdzPy5ydW5Tb2Z0UmVsb2FkQWZ0ZXIsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAocnVuU29mdFJlbG9hZEFmdGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3NvZnQtcmVsb2FkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwcy5wdXNoKHsgbmFtZTogJ3NvZnRfcmVsb2FkX2FmdGVyJywgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmFsbFN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBzLnB1c2goeyBuYW1lOiAnc29mdF9yZWxvYWRfYWZ0ZXInLCBzdWNjZXNzOiBmYWxzZSwgZGV0YWlsOiBub3JtYWxpemVFcnJvcihlcnJvcikgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdGVwcy5wdXNoKHsgbmFtZTogJ3NvZnRfcmVsb2FkX2FmdGVyJywgc3VjY2VzczogdHJ1ZSwgc2tpcHBlZDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjaGVja1NjZW5lRGlydHkgPSB0b0Jvb2xlYW4oYXJncz8uY2hlY2tTY2VuZURpcnR5LCB0cnVlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsT25EaXJ0eSA9IHRvQm9vbGVhbihhcmdzPy5mYWlsT25EaXJ0eSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGxldCBwb3N0U2NlbmVEaXJ0eTogYm9vbGVhbiB8IG51bGwgPSBudWxsO1xuICAgICAgICAgICAgICAgIGlmIChjaGVja1NjZW5lRGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpcnR5ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1kaXJ0eScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdFNjZW5lRGlydHkgPSBkaXJ0eSA9PT0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpcnR5UGFzcyA9ICFmYWlsT25EaXJ0eSB8fCBwb3N0U2NlbmVEaXJ0eSAhPT0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZGlydHlQYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmFsbFN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdxdWVyeV9zY2VuZV9kaXJ0eScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZGlydHlQYXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNEaXJ0eTogcG9zdFNjZW5lRGlydHksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxPbkRpcnR5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJhbGxTdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwcy5wdXNoKHsgbmFtZTogJ3F1ZXJ5X3NjZW5lX2RpcnR5Jywgc3VjY2VzczogZmFsc2UsIGRldGFpbDogbm9ybWFsaXplRXJyb3IoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3RlcHMucHVzaCh7IG5hbWU6ICdxdWVyeV9zY2VuZV9kaXJ0eScsIHN1Y2Nlc3M6IHRydWUsIHNraXBwZWQ6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2Vzczogb3ZlcmFsbFN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXRNcyxcbiAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWxNcyxcbiAgICAgICAgICAgICAgICAgICAgcmVhZGluZXNzLFxuICAgICAgICAgICAgICAgICAgICBwb3N0U2NlbmVEaXJ0eSxcbiAgICAgICAgICAgICAgICAgICAgc3RlcHNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=