"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectRuntimeTools = createProjectRuntimeTools;
const common_1 = require("./common");
function normalizeProjectProtocol(value) {
    if (value === 'default' || value === 'project') {
        return value;
    }
    return null;
}
function normalizePreferencesProtocol(value) {
    if (value === 'default' || value === 'global' || value === 'local') {
        return value;
    }
    return null;
}
function parseOptionalPath(value) {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    return null;
}
function parseExtraArgs(value) {
    if (value === undefined || value === null) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    return null;
}
function createProjectRuntimeTools(requester) {
    return [
        {
            name: 'project_query_config',
            description: '查询项目配置',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    configType: {
                        type: 'string',
                        description: '配置类型，默认 project'
                    },
                    key: {
                        type: 'string',
                        description: '可选，配置项键名'
                    },
                    protocol: {
                        type: 'string',
                        enum: ['default', 'project'],
                        description: '可选，project.query-config 的 protocol'
                    }
                }
            },
            requiredCapabilities: ['project.query-config'],
            run: async (args) => {
                const configType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.configType) || 'project';
                const key = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.key);
                const protocol = normalizeProjectProtocol(args === null || args === void 0 ? void 0 : args.protocol);
                if ((args === null || args === void 0 ? void 0 : args.protocol) !== undefined && !protocol) {
                    return (0, common_1.fail)('protocol 仅支持 default/project', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    let config;
                    if (protocol) {
                        config = await requester('project', 'query-config', configType, key || undefined, protocol);
                    }
                    else if (key) {
                        config = await requester('project', 'query-config', configType, key);
                    }
                    else {
                        config = await requester('project', 'query-config', configType);
                    }
                    return (0, common_1.ok)({ configType, key: key || null, protocol, config });
                }
                catch (error) {
                    return (0, common_1.fail)('查询项目配置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'project_open_settings',
            description: '打开项目设置面板',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    tab: {
                        type: 'string',
                        description: '设置页签，默认 project'
                    },
                    subTab: {
                        type: 'string',
                        description: '子页签，默认空字符串'
                    },
                    args: {
                        type: 'array',
                        description: '可选，附加参数'
                    }
                }
            },
            requiredCapabilities: ['project.open-settings'],
            run: async (args) => {
                const tab = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tab) || 'project';
                const subTab = typeof (args === null || args === void 0 ? void 0 : args.subTab) === 'string' ? args.subTab : '';
                const extraArgs = parseExtraArgs(args === null || args === void 0 ? void 0 : args.args);
                if (!extraArgs) {
                    return (0, common_1.fail)('args 必须为数组', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('project', 'open-settings', tab, subTab, ...extraArgs);
                    return (0, common_1.ok)({
                        opened: true,
                        tab,
                        subTab,
                        args: extraArgs
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('打开项目设置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'project_set_config',
            description: '修改项目配置项',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    configType: {
                        type: 'string',
                        description: '配置类型，默认 project'
                    },
                    path: {
                        type: 'string',
                        description: '配置路径，默认空字符串'
                    },
                    value: {
                        description: '要写入的配置值'
                    }
                },
                required: ['value']
            },
            requiredCapabilities: ['project.set-config'],
            run: async (args) => {
                const configType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.configType) || 'project';
                const path = parseOptionalPath(args === null || args === void 0 ? void 0 : args.path);
                if (path === null) {
                    return (0, common_1.fail)('path 必须为字符串', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!Object.prototype.hasOwnProperty.call(args || {}, 'value')) {
                    return (0, common_1.fail)('value 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const updated = await requester('project', 'set-config', configType, path, args.value);
                    return (0, common_1.ok)({
                        configType,
                        path,
                        value: args.value,
                        updated: updated === true
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('修改项目配置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'preferences_query_config',
            description: '查询编辑器偏好设置',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    configType: {
                        type: 'string',
                        description: '配置类型，默认 general'
                    },
                    key: {
                        type: 'string',
                        description: '可选，配置项键名'
                    },
                    protocol: {
                        type: 'string',
                        enum: ['default', 'global', 'local'],
                        description: '可选，preferences.query-config 的 protocol'
                    }
                }
            },
            requiredCapabilities: ['preferences.query-config'],
            run: async (args) => {
                const configType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.configType) || 'general';
                const key = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.key);
                const protocol = normalizePreferencesProtocol(args === null || args === void 0 ? void 0 : args.protocol);
                if ((args === null || args === void 0 ? void 0 : args.protocol) !== undefined && !protocol) {
                    return (0, common_1.fail)('protocol 仅支持 default/global/local', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    let config;
                    if (protocol) {
                        config = await requester('preferences', 'query-config', configType, key || undefined, protocol);
                    }
                    else if (key) {
                        config = await requester('preferences', 'query-config', configType, key);
                    }
                    else {
                        config = await requester('preferences', 'query-config', configType);
                    }
                    return (0, common_1.ok)({ configType, key: key || null, protocol, config });
                }
                catch (error) {
                    return (0, common_1.fail)('查询偏好设置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'preferences_open_settings',
            description: '打开偏好设置面板',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    tab: {
                        type: 'string',
                        description: '偏好设置页签，默认 general'
                    },
                    args: {
                        type: 'array',
                        description: '可选，附加参数'
                    }
                }
            },
            requiredCapabilities: ['preferences.open-settings'],
            run: async (args) => {
                const tab = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tab) || 'general';
                const extraArgs = parseExtraArgs(args === null || args === void 0 ? void 0 : args.args);
                if (!extraArgs) {
                    return (0, common_1.fail)('args 必须为数组', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('preferences', 'open-settings', tab, ...extraArgs);
                    return (0, common_1.ok)({
                        opened: true,
                        tab,
                        args: extraArgs
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('打开偏好设置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'preferences_set_config',
            description: '修改编辑器偏好配置项',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    configType: {
                        type: 'string',
                        description: '配置类型，默认 general'
                    },
                    path: {
                        type: 'string',
                        description: '配置路径，默认空字符串'
                    },
                    value: {
                        description: '要写入的配置值'
                    },
                    protocol: {
                        type: 'string',
                        enum: ['default', 'global', 'local'],
                        description: '可选，偏好配置协议'
                    }
                },
                required: ['value']
            },
            requiredCapabilities: ['preferences.set-config'],
            run: async (args) => {
                const configType = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.configType) || 'general';
                const path = parseOptionalPath(args === null || args === void 0 ? void 0 : args.path);
                if (path === null) {
                    return (0, common_1.fail)('path 必须为字符串', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!Object.prototype.hasOwnProperty.call(args || {}, 'value')) {
                    return (0, common_1.fail)('value 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const protocol = normalizePreferencesProtocol(args === null || args === void 0 ? void 0 : args.protocol);
                if ((args === null || args === void 0 ? void 0 : args.protocol) !== undefined && !protocol) {
                    return (0, common_1.fail)('protocol 仅支持 default/global/local', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const updated = protocol
                        ? await requester('preferences', 'set-config', configType, path, args.value, protocol)
                        : await requester('preferences', 'set-config', configType, path, args.value);
                    return (0, common_1.ok)({
                        configType,
                        path,
                        value: args.value,
                        protocol: protocol || null,
                        updated: updated === true
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('修改偏好配置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'scene_query_is_native',
            description: '查询是否使用原生编辑器模式',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    checkAvailable: {
                        type: 'boolean',
                        description: '是否检查原生编辑器可用性，默认由编辑器决定'
                    }
                }
            },
            requiredCapabilities: ['scene.is-native'],
            run: async (args) => {
                const hasCheckAvailable = typeof (args === null || args === void 0 ? void 0 : args.checkAvailable) === 'boolean';
                try {
                    const isNative = hasCheckAvailable
                        ? await requester('scene', 'is-native', { checkAvailable: args.checkAvailable })
                        : await requester('scene', 'is-native');
                    return (0, common_1.ok)({
                        isNative: isNative === true,
                        checkAvailable: hasCheckAvailable ? args.checkAvailable : null
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询原生编辑器模式失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'information_open_dialog',
            description: '打开 information 对话框',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: '信息标签'
                    },
                    dialogOptions: {
                        type: 'object',
                        description: '可选，对话框参数'
                    }
                },
                required: ['tag']
            },
            requiredCapabilities: ['information.open-information-dialog'],
            run: async (args) => {
                const tag = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tag);
                if (!tag) {
                    return (0, common_1.fail)('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const hasDialogOptions = (args === null || args === void 0 ? void 0 : args.dialogOptions) !== undefined;
                if (hasDialogOptions && (!args.dialogOptions || typeof args.dialogOptions !== 'object' || Array.isArray(args.dialogOptions))) {
                    return (0, common_1.fail)('dialogOptions 必须为对象', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const action = hasDialogOptions
                        ? await requester('information', 'open-information-dialog', tag, args.dialogOptions)
                        : await requester('information', 'open-information-dialog', tag);
                    return (0, common_1.ok)({
                        opened: true,
                        tag,
                        action: action || null
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('打开 information 对话框失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'information_has_dialog',
            description: '检查 information 对话框是否已打开',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: '信息标签'
                    }
                },
                required: ['tag']
            },
            requiredCapabilities: ['information.has-dialog'],
            run: async (args) => {
                const tag = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tag);
                if (!tag) {
                    return (0, common_1.fail)('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const hasDialog = await requester('information', 'has-dialog', tag);
                    return (0, common_1.ok)({
                        tag,
                        hasDialog: hasDialog === true
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('检查 information 对话框失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'information_close_dialog',
            description: '关闭 information 对话框',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: '信息标签'
                    }
                },
                required: ['tag']
            },
            requiredCapabilities: ['information.close-dialog'],
            run: async (args) => {
                const tag = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tag);
                if (!tag) {
                    return (0, common_1.fail)('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('information', 'close-dialog', tag);
                    return (0, common_1.ok)({
                        closed: true,
                        tag
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('关闭 information 对话框失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'program_open_program',
            description: '调用 program.open-program 打开指定程序',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    programId: {
                        type: 'string',
                        description: '程序标识，例如 vscode'
                    },
                    options: {
                        type: 'object',
                        description: '可选，透传选项'
                    }
                },
                required: ['programId']
            },
            requiredCapabilities: ['program.open-program'],
            run: async (args) => {
                const programId = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.programId);
                if (!programId) {
                    return (0, common_1.fail)('programId 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const options = (args === null || args === void 0 ? void 0 : args.options) && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const opened = options
                        ? await requester('program', 'open-program', programId, options)
                        : await requester('program', 'open-program', programId);
                    return (0, common_1.ok)({
                        programId,
                        options: options || null,
                        opened: opened === true
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('打开程序失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'program_open_url',
            description: '调用 program.open-url 打开外部链接',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: '目标链接'
                    },
                    options: {
                        type: 'object',
                        description: '可选，透传选项'
                    }
                },
                required: ['url']
            },
            requiredCapabilities: ['program.open-url'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const options = (args === null || args === void 0 ? void 0 : args.options) && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const opened = options
                        ? await requester('program', 'open-url', url, options)
                        : await requester('program', 'open-url', url);
                    return (0, common_1.ok)({
                        url,
                        options: options || null,
                        opened: opened === true
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('打开链接失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'server_query_network',
            description: '查询编辑器网络信息（IP 列表与端口）',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['server.query-ip-list', 'server.query-port'],
            run: async () => {
                try {
                    const ipList = await requester('server', 'query-ip-list');
                    const port = await requester('server', 'query-port');
                    return (0, common_1.ok)({
                        ipList: Array.isArray(ipList) ? ipList : [],
                        port: typeof port === 'number' ? port : null
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询网络信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'engine_query_runtime_info',
            description: '查询当前引擎运行信息（版本/路径）',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    engineName: {
                        type: 'string',
                        description: '可选，引擎名称'
                    }
                }
            },
            requiredCapabilities: ['engine.query-engine-info'],
            run: async (args) => {
                const engineName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.engineName);
                try {
                    const info = engineName
                        ? await requester('engine', 'query-engine-info', engineName)
                        : await requester('engine', 'query-engine-info');
                    return (0, common_1.ok)({
                        engineName: engineName || null,
                        // 统一走 query-engine-info，避免触发 query-info 废弃告警
                        runtime: info,
                        info
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询引擎运行信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'engine_query_engine_info',
            description: '查询引擎详细信息',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {
                    engineName: {
                        type: 'string',
                        description: '可选，引擎名称'
                    }
                }
            },
            requiredCapabilities: ['engine.query-engine-info'],
            run: async (args) => {
                const engineName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.engineName);
                try {
                    const info = engineName
                        ? await requester('engine', 'query-engine-info', engineName)
                        : await requester('engine', 'query-engine-info');
                    return (0, common_1.ok)({ engineName: engineName || null, info });
                }
                catch (error) {
                    return (0, common_1.fail)('查询引擎详细信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'builder_query_worker_ready',
            description: '查询构建 worker 是否就绪',
            layer: 'official',
            category: 'project',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['builder.query-worker-ready'],
            run: async () => {
                try {
                    const ready = await requester('builder', 'query-worker-ready');
                    return (0, common_1.ok)({ ready: ready === true });
                }
                catch (error) {
                    return (0, common_1.fail)('查询构建 worker 状态失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdC1ydW50aW1lLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvcHJvamVjdC1ydW50aW1lLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBd0NBLDhEQWdtQkM7QUF2b0JELHFDQUFzRTtBQUt0RSxTQUFTLHdCQUF3QixDQUFDLEtBQVU7SUFDeEMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUM3QyxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQztBQUVELFNBQVMsNEJBQTRCLENBQUMsS0FBVTtJQUM1QyxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFLENBQUM7UUFDakUsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEtBQVU7SUFDakMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN4QyxPQUFPLEVBQUUsQ0FBQztJQUNkLENBQUM7SUFDRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVCLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsS0FBVTtJQUM5QixJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3hDLE9BQU8sRUFBRSxDQUFDO0lBQ2QsQ0FBQztJQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sS0FBSyxDQUFDO0lBQ2pC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QztvQkFDL0QsT0FBTyxJQUFBLFdBQUUsRUFBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDekMsQ0FBQztnQkFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO29CQUNsQixPQUFPLElBQUEsYUFBSSxFQUFDLGtCQUFrQixFQUFFLElBQUEsdUJBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUMzRCxDQUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHRvTm9uRW1wdHlTdHJpbmcgfSBmcm9tICcuL2NvbW1vbic7XG5cbnR5cGUgUHJvamVjdFByb3RvY29sID0gJ2RlZmF1bHQnIHwgJ3Byb2plY3QnO1xudHlwZSBQcmVmZXJlbmNlc1Byb3RvY29sID0gJ2RlZmF1bHQnIHwgJ2dsb2JhbCcgfCAnbG9jYWwnO1xuXG5mdW5jdGlvbiBub3JtYWxpemVQcm9qZWN0UHJvdG9jb2wodmFsdWU6IGFueSk6IFByb2plY3RQcm90b2NvbCB8IG51bGwge1xuICAgIGlmICh2YWx1ZSA9PT0gJ2RlZmF1bHQnIHx8IHZhbHVlID09PSAncHJvamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUHJlZmVyZW5jZXNQcm90b2NvbCh2YWx1ZTogYW55KTogUHJlZmVyZW5jZXNQcm90b2NvbCB8IG51bGwge1xuICAgIGlmICh2YWx1ZSA9PT0gJ2RlZmF1bHQnIHx8IHZhbHVlID09PSAnZ2xvYmFsJyB8fCB2YWx1ZSA9PT0gJ2xvY2FsJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBwYXJzZU9wdGlvbmFsUGF0aCh2YWx1ZTogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBwYXJzZUV4dHJhQXJncyh2YWx1ZTogYW55KTogYW55W10gfCBudWxsIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUHJvamVjdFJ1bnRpbWVUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJvamVjdF9xdWVyeV9jb25maWcnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lpobnnm67phY3nva4nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfphY3nva7nsbvlnovvvIzpu5jorqQgcHJvamVjdCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAga2V5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6YWN572u6aG56ZSu5ZCNJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwcm90b2NvbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlZmF1bHQnLCAncHJvamVjdCddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxwcm9qZWN0LnF1ZXJ5LWNvbmZpZyDnmoQgcHJvdG9jb2wnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsncHJvamVjdC5xdWVyeS1jb25maWcnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbmZpZ1R5cGUpIHx8ICdwcm9qZWN0JztcbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmtleSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvdG9jb2wgPSBub3JtYWxpemVQcm9qZWN0UHJvdG9jb2woYXJncz8ucHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzPy5wcm90b2NvbCAhPT0gdW5kZWZpbmVkICYmICFwcm90b2NvbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncHJvdG9jb2wg5LuF5pSv5oyBIGRlZmF1bHQvcHJvamVjdCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjb25maWc6IGFueTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3RvY29sKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSwga2V5IHx8IHVuZGVmaW5lZCwgcHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ1R5cGUsIGtleSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgY29uZmlnVHlwZSwga2V5OiBrZXkgfHwgbnVsbCwgcHJvdG9jb2wsIGNvbmZpZyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Lpobnnm67phY3nva7lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3Byb2plY3Rfb3Blbl9zZXR0aW5ncycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOmhueebruiuvue9rumdouadvycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdGFiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u6aG1562+77yM6buY6K6kIHByb2plY3QnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHN1YlRhYjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WtkOmhteetvu+8jOm7mOiupOepuuWtl+espuS4sidcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgYXJnczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6ZmE5Yqg5Y+C5pWwJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3Byb2plY3Qub3Blbi1zZXR0aW5ncyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFiID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YWIpIHx8ICdwcm9qZWN0JztcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJUYWIgPSB0eXBlb2YgYXJncz8uc3ViVGFiID09PSAnc3RyaW5nJyA/IGFyZ3Muc3ViVGFiIDogJyc7XG4gICAgICAgICAgICAgICAgY29uc3QgZXh0cmFBcmdzID0gcGFyc2VFeHRyYUFyZ3MoYXJncz8uYXJncyk7XG4gICAgICAgICAgICAgICAgaWYgKCFleHRyYUFyZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2FyZ3Mg5b+F6aG75Li65pWw57uEJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdwcm9qZWN0JywgJ29wZW4tc2V0dGluZ3MnLCB0YWIsIHN1YlRhYiwgLi4uZXh0cmFBcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZW5lZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhYixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YlRhYixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGV4dHJhQXJnc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmiZPlvIDpobnnm67orr7nva7lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3Byb2plY3Rfc2V0X2NvbmZpZycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S/ruaUuemhueebrumFjee9rumhuScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnVHlwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mFjee9ruexu+Wei++8jOm7mOiupCBwcm9qZWN0J1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6YWN572u6Lev5b6E77yM6buY6K6k56m65a2X56ym5LiyJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfopoHlhpnlhaXnmoTphY3nva7lgLwnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3ZhbHVlJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcm9qZWN0LnNldC1jb25maWcnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbmZpZ1R5cGUpIHx8ICdwcm9qZWN0JztcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gcGFyc2VPcHRpb25hbFBhdGgoYXJncz8ucGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3BhdGgg5b+F6aG75Li65a2X56ym5LiyJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFyZ3MgfHwge30sICd2YWx1ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd2YWx1ZSDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9qZWN0JywgJ3NldC1jb25maWcnLCBjb25maWdUeXBlLCBwYXRoLCBhcmdzLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGFyZ3MudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkOiB1cGRhdGVkID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+S/ruaUuemhueebrumFjee9ruWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmVyZW5jZXNfcXVlcnlfY29uZmlnJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5Zmo5YGP5aW96K6+572uJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcm9qZWN0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBjb25maWdUeXBlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6YWN572u57G75Z6L77yM6buY6K6kIGdlbmVyYWwnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGtleToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmFjee9rumhuemUruWQjSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcHJvdG9jb2w6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydkZWZhdWx0JywgJ2dsb2JhbCcsICdsb2NhbCddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxwcmVmZXJlbmNlcy5xdWVyeS1jb25maWcg55qEIHByb3RvY29sJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3ByZWZlcmVuY2VzLnF1ZXJ5LWNvbmZpZyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29uZmlnVHlwZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uY29uZmlnVHlwZSkgfHwgJ2dlbmVyYWwnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ua2V5KTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm90b2NvbCA9IG5vcm1hbGl6ZVByZWZlcmVuY2VzUHJvdG9jb2woYXJncz8ucHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzPy5wcm90b2NvbCAhPT0gdW5kZWZpbmVkICYmICFwcm90b2NvbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncHJvdG9jb2wg5LuF5pSv5oyBIGRlZmF1bHQvZ2xvYmFsL2xvY2FsJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbmZpZzogYW55O1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvdG9jb2wpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZyA9IGF3YWl0IHJlcXVlc3RlcigncHJlZmVyZW5jZXMnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSwga2V5IHx8IHVuZGVmaW5lZCwgcHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnID0gYXdhaXQgcmVxdWVzdGVyKCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBjb25maWdUeXBlLCBrZXkpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnID0gYXdhaXQgcmVxdWVzdGVyKCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBjb25maWdUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBjb25maWdUeXBlLCBrZXk6IGtleSB8fCBudWxsLCBwcm90b2NvbCwgY29uZmlnIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouWBj+Wlveiuvue9ruWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJlZmVyZW5jZXNfb3Blbl9zZXR0aW5ncycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOWBj+Wlveiuvue9rumdouadvycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdGFiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5YGP5aW96K6+572u6aG1562+77yM6buY6K6kIGdlbmVyYWwnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmZhOWKoOWPguaVsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcmVmZXJlbmNlcy5vcGVuLXNldHRpbmdzJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YWIgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnRhYikgfHwgJ2dlbmVyYWwnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhQXJncyA9IHBhcnNlRXh0cmFBcmdzKGFyZ3M/LmFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmICghZXh0cmFBcmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdhcmdzIOW/hemhu+S4uuaVsOe7hCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3RlcigncHJlZmVyZW5jZXMnLCAnb3Blbi1zZXR0aW5ncycsIHRhYiwgLi4uZXh0cmFBcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZW5lZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhYixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGV4dHJhQXJnc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmiZPlvIDlgY/lpb3orr7nva7lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZlcmVuY2VzX3NldF9jb25maWcnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkv67mlLnnvJbovpHlmajlgY/lpb3phY3nva7pobknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfphY3nva7nsbvlnovvvIzpu5jorqQgZ2VuZXJhbCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mFjee9rui3r+W+hO+8jOm7mOiupOepuuWtl+espuS4sidcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6KaB5YaZ5YWl55qE6YWN572u5YC8J1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwcm90b2NvbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlZmF1bHQnLCAnZ2xvYmFsJywgJ2xvY2FsJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOWBj+WlvemFjee9ruWNj+iuridcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndmFsdWUnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3ByZWZlcmVuY2VzLnNldC1jb25maWcnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbmZpZ1R5cGUpIHx8ICdnZW5lcmFsJztcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gcGFyc2VPcHRpb25hbFBhdGgoYXJncz8ucGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3BhdGgg5b+F6aG75Li65a2X56ym5LiyJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFyZ3MgfHwge30sICd2YWx1ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd2YWx1ZSDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwcm90b2NvbCA9IG5vcm1hbGl6ZVByZWZlcmVuY2VzUHJvdG9jb2woYXJncz8ucHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzPy5wcm90b2NvbCAhPT0gdW5kZWZpbmVkICYmICFwcm90b2NvbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncHJvdG9jb2wg5LuF5pSv5oyBIGRlZmF1bHQvZ2xvYmFsL2xvY2FsJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IHByb3RvY29sXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcigncHJlZmVyZW5jZXMnLCAnc2V0LWNvbmZpZycsIGNvbmZpZ1R5cGUsIHBhdGgsIGFyZ3MudmFsdWUsIHByb3RvY29sKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ3ByZWZlcmVuY2VzJywgJ3NldC1jb25maWcnLCBjb25maWdUeXBlLCBwYXRoLCBhcmdzLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGFyZ3MudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm90b2NvbDogcHJvdG9jb2wgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHVwZGF0ZWQgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5L+u5pS55YGP5aW96YWN572u5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9xdWVyeV9pc19uYXRpdmUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LmmK/lkKbkvb/nlKjljp/nlJ/nvJbovpHlmajmqKHlvI8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNoZWNrQXZhaWxhYmxlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuajgOafpeWOn+eUn+e8lui+keWZqOWPr+eUqOaAp++8jOm7mOiupOeUsee8lui+keWZqOWGs+WumidcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5pcy1uYXRpdmUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhc0NoZWNrQXZhaWxhYmxlID0gdHlwZW9mIGFyZ3M/LmNoZWNrQXZhaWxhYmxlID09PSAnYm9vbGVhbic7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNOYXRpdmUgPSBoYXNDaGVja0F2YWlsYWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2lzLW5hdGl2ZScsIHsgY2hlY2tBdmFpbGFibGU6IGFyZ3MuY2hlY2tBdmFpbGFibGUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdpcy1uYXRpdmUnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzTmF0aXZlOiBpc05hdGl2ZSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrQXZhaWxhYmxlOiBoYXNDaGVja0F2YWlsYWJsZSA/IGFyZ3MuY2hlY2tBdmFpbGFibGUgOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouWOn+eUn+e8lui+keWZqOaooeW8j+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnaW5mb3JtYXRpb25fb3Blbl9kaWFsb2cnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIAgaW5mb3JtYXRpb24g5a+56K+d5qGGJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcm9qZWN0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB0YWc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkv6Hmga/moIfnrb4nXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRpYWxvZ09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzlr7nor53moYblj4LmlbAnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3RhZyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnaW5mb3JtYXRpb24ub3Blbi1pbmZvcm1hdGlvbi1kaWFsb2cnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhZyA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFnKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndGFnIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGhhc0RpYWxvZ09wdGlvbnMgPSBhcmdzPy5kaWFsb2dPcHRpb25zICE9PSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0RpYWxvZ09wdGlvbnMgJiYgKCFhcmdzLmRpYWxvZ09wdGlvbnMgfHwgdHlwZW9mIGFyZ3MuZGlhbG9nT3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShhcmdzLmRpYWxvZ09wdGlvbnMpKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnZGlhbG9nT3B0aW9ucyDlv4XpobvkuLrlr7nosaEnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhY3Rpb24gPSBoYXNEaWFsb2dPcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcignaW5mb3JtYXRpb24nLCAnb3Blbi1pbmZvcm1hdGlvbi1kaWFsb2cnLCB0YWcsIGFyZ3MuZGlhbG9nT3B0aW9ucylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdpbmZvcm1hdGlvbicsICdvcGVuLWluZm9ybWF0aW9uLWRpYWxvZycsIHRhZyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcGVuZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWcsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IGFjdGlvbiB8fCBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJk+W8gCBpbmZvcm1hdGlvbiDlr7nor53moYblpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2luZm9ybWF0aW9uX2hhc19kaWFsb2cnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmo4Dmn6UgaW5mb3JtYXRpb24g5a+56K+d5qGG5piv5ZCm5bey5omT5byAJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcm9qZWN0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB0YWc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkv6Hmga/moIfnrb4nXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3RhZyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnaW5mb3JtYXRpb24uaGFzLWRpYWxvZyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFnID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YWcpO1xuICAgICAgICAgICAgICAgIGlmICghdGFnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd0YWcg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzRGlhbG9nID0gYXdhaXQgcmVxdWVzdGVyKCdpbmZvcm1hdGlvbicsICdoYXMtZGlhbG9nJywgdGFnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc0RpYWxvZzogaGFzRGlhbG9nID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ajgOafpSBpbmZvcm1hdGlvbiDlr7nor53moYblpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2luZm9ybWF0aW9uX2Nsb3NlX2RpYWxvZycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WFs+mXrSBpbmZvcm1hdGlvbiDlr7nor53moYYnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHRhZzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S/oeaBr+agh+etvidcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndGFnJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydpbmZvcm1hdGlvbi5jbG9zZS1kaWFsb2cnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhZyA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFnKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndGFnIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3RlcignaW5mb3JtYXRpb24nLCAnY2xvc2UtZGlhbG9nJywgdGFnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb3NlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhZ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflhbPpl60gaW5mb3JtYXRpb24g5a+56K+d5qGG5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdwcm9ncmFtX29wZW5fcHJvZ3JhbScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iwg+eUqCBwcm9ncmFtLm9wZW4tcHJvZ3JhbSDmiZPlvIDmjIflrprnqIvluo8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyYW1JZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+eoi+W6j+agh+ivhu+8jOS+i+WmgiB2c2NvZGUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzpgI/kvKDpgInpobknXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Byb2dyYW1JZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsncHJvZ3JhbS5vcGVuLXByb2dyYW0nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb2dyYW1JZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucHJvZ3JhbUlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXByb2dyYW1JZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncHJvZ3JhbUlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzPy5vcHRpb25zICYmIHR5cGVvZiBhcmdzLm9wdGlvbnMgPT09ICdvYmplY3QnID8gYXJncy5vcHRpb25zIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5lZCA9IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtJywgJ29wZW4tcHJvZ3JhbScsIHByb2dyYW1JZCwgb3B0aW9ucylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtJywgJ29wZW4tcHJvZ3JhbScsIHByb2dyYW1JZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9ncmFtSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBvcGVuZWQ6IG9wZW5lZCA9PT0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmiZPlvIDnqIvluo/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3Byb2dyYW1fb3Blbl91cmwnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfosIPnlKggcHJvZ3JhbS5vcGVuLXVybCDmiZPlvIDlpJbpg6jpk77mjqUnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ebruagh+mTvuaOpSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmAj+S8oOmAiemhuSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcm9ncmFtLm9wZW4tdXJsJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0gYXJncz8ub3B0aW9ucyAmJiB0eXBlb2YgYXJncy5vcHRpb25zID09PSAnb2JqZWN0JyA/IGFyZ3Mub3B0aW9ucyA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvcGVuZWQgPSBvcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcigncHJvZ3JhbScsICdvcGVuLXVybCcsIHVybCwgb3B0aW9ucylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtJywgJ29wZW4tdXJsJywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnMgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZW5lZDogb3BlbmVkID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJk+W8gOmTvuaOpeWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2VydmVyX3F1ZXJ5X25ldHdvcmsnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LnvJbovpHlmajnvZHnu5zkv6Hmga/vvIhJUCDliJfooajkuI7nq6/lj6PvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NlcnZlci5xdWVyeS1pcC1saXN0JywgJ3NlcnZlci5xdWVyeS1wb3J0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpcExpc3QgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NlcnZlcicsICdxdWVyeS1pcC1saXN0Jyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvcnQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NlcnZlcicsICdxdWVyeS1wb3J0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpcExpc3Q6IEFycmF5LmlzQXJyYXkoaXBMaXN0KSA/IGlwTGlzdCA6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9ydDogdHlwZW9mIHBvcnQgPT09ICdudW1iZXInID8gcG9ydCA6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i572R57uc5L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdlbmdpbmVfcXVlcnlfcnVudGltZV9pbmZvJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5b2T5YmN5byV5pOO6L+Q6KGM5L+h5oGv77yI54mI5pysL+i3r+W+hO+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgZW5naW5lTmFtZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOW8leaTjuWQjeensCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydlbmdpbmUucXVlcnktZW5naW5lLWluZm8nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuZ2luZU5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmVuZ2luZU5hbWUpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBlbmdpbmVOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcignZW5naW5lJywgJ3F1ZXJ5LWVuZ2luZS1pbmZvJywgZW5naW5lTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdlbmdpbmUnLCAncXVlcnktZW5naW5lLWluZm8nKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZ2luZU5hbWU6IGVuZ2luZU5hbWUgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOe7n+S4gOi1sCBxdWVyeS1lbmdpbmUtaW5mb++8jOmBv+WFjeinpuWPkSBxdWVyeS1pbmZvIOW6n+W8g+WRiuitplxuICAgICAgICAgICAgICAgICAgICAgICAgcnVudGltZTogaW5mbyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZm9cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i5byV5pOO6L+Q6KGM5L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdlbmdpbmVfcXVlcnlfZW5naW5lX2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlvJXmk47or6bnu4bkv6Hmga8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGVuZ2luZU5hbWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzlvJXmk47lkI3np7AnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnZW5naW5lLnF1ZXJ5LWVuZ2luZS1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbmdpbmVOYW1lID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5lbmdpbmVOYW1lKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gZW5naW5lTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCByZXF1ZXN0ZXIoJ2VuZ2luZScsICdxdWVyeS1lbmdpbmUtaW5mbycsIGVuZ2luZU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHJlcXVlc3RlcignZW5naW5lJywgJ3F1ZXJ5LWVuZ2luZS1pbmZvJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IGVuZ2luZU5hbWU6IGVuZ2luZU5hbWUgfHwgbnVsbCwgaW5mbyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LlvJXmk47or6bnu4bkv6Hmga/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2J1aWxkZXJfcXVlcnlfd29ya2VyX3JlYWR5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5p6E5bu6IHdvcmtlciDmmK/lkKblsLHnu6onLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5J10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFkeSA9IGF3YWl0IHJlcXVlc3RlcignYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgcmVhZHk6IHJlYWR5ID09PSB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouaehOW7uiB3b3JrZXIg54q25oCB5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBdO1xufVxuIl19