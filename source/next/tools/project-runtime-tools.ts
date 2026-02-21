import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString } from './common';

type ProjectProtocol = 'default' | 'project';
type PreferencesProtocol = 'default' | 'global' | 'local';

function normalizeProjectProtocol(value: any): ProjectProtocol | null {
    if (value === 'default' || value === 'project') {
        return value;
    }
    return null;
}

function normalizePreferencesProtocol(value: any): PreferencesProtocol | null {
    if (value === 'default' || value === 'global' || value === 'local') {
        return value;
    }
    return null;
}

function parseOptionalPath(value: any): string | null {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    return null;
}

function parseExtraArgs(value: any): any[] | null {
    if (value === undefined || value === null) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    return null;
}

export function createProjectRuntimeTools(requester: EditorRequester): NextToolDefinition[] {
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
            run: async (args: any) => {
                const configType = toNonEmptyString(args?.configType) || 'project';
                const key = toNonEmptyString(args?.key);
                const protocol = normalizeProjectProtocol(args?.protocol);
                if (args?.protocol !== undefined && !protocol) {
                    return fail('protocol 仅支持 default/project', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    let config: any;
                    if (protocol) {
                        config = await requester('project', 'query-config', configType, key || undefined, protocol);
                    } else if (key) {
                        config = await requester('project', 'query-config', configType, key);
                    } else {
                        config = await requester('project', 'query-config', configType);
                    }
                    return ok({ configType, key: key || null, protocol, config });
                } catch (error: any) {
                    return fail('查询项目配置失败', normalizeError(error));
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
            run: async (args: any) => {
                const tab = toNonEmptyString(args?.tab) || 'project';
                const subTab = typeof args?.subTab === 'string' ? args.subTab : '';
                const extraArgs = parseExtraArgs(args?.args);
                if (!extraArgs) {
                    return fail('args 必须为数组', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('project', 'open-settings', tab, subTab, ...extraArgs);
                    return ok({
                        opened: true,
                        tab,
                        subTab,
                        args: extraArgs
                    });
                } catch (error: any) {
                    return fail('打开项目设置失败', normalizeError(error));
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
            run: async (args: any) => {
                const configType = toNonEmptyString(args?.configType) || 'project';
                const path = parseOptionalPath(args?.path);
                if (path === null) {
                    return fail('path 必须为字符串', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!Object.prototype.hasOwnProperty.call(args || {}, 'value')) {
                    return fail('value 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const updated = await requester('project', 'set-config', configType, path, args.value);
                    return ok({
                        configType,
                        path,
                        value: args.value,
                        updated: updated === true
                    });
                } catch (error: any) {
                    return fail('修改项目配置失败', normalizeError(error));
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
            run: async (args: any) => {
                const configType = toNonEmptyString(args?.configType) || 'general';
                const key = toNonEmptyString(args?.key);
                const protocol = normalizePreferencesProtocol(args?.protocol);
                if (args?.protocol !== undefined && !protocol) {
                    return fail('protocol 仅支持 default/global/local', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    let config: any;
                    if (protocol) {
                        config = await requester('preferences', 'query-config', configType, key || undefined, protocol);
                    } else if (key) {
                        config = await requester('preferences', 'query-config', configType, key);
                    } else {
                        config = await requester('preferences', 'query-config', configType);
                    }
                    return ok({ configType, key: key || null, protocol, config });
                } catch (error: any) {
                    return fail('查询偏好设置失败', normalizeError(error));
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
            run: async (args: any) => {
                const tab = toNonEmptyString(args?.tab) || 'general';
                const extraArgs = parseExtraArgs(args?.args);
                if (!extraArgs) {
                    return fail('args 必须为数组', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('preferences', 'open-settings', tab, ...extraArgs);
                    return ok({
                        opened: true,
                        tab,
                        args: extraArgs
                    });
                } catch (error: any) {
                    return fail('打开偏好设置失败', normalizeError(error));
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
            run: async (args: any) => {
                const configType = toNonEmptyString(args?.configType) || 'general';
                const path = parseOptionalPath(args?.path);
                if (path === null) {
                    return fail('path 必须为字符串', undefined, 'E_INVALID_ARGUMENT');
                }
                if (!Object.prototype.hasOwnProperty.call(args || {}, 'value')) {
                    return fail('value 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const protocol = normalizePreferencesProtocol(args?.protocol);
                if (args?.protocol !== undefined && !protocol) {
                    return fail('protocol 仅支持 default/global/local', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const updated = protocol
                        ? await requester('preferences', 'set-config', configType, path, args.value, protocol)
                        : await requester('preferences', 'set-config', configType, path, args.value);
                    return ok({
                        configType,
                        path,
                        value: args.value,
                        protocol: protocol || null,
                        updated: updated === true
                    });
                } catch (error: any) {
                    return fail('修改偏好配置失败', normalizeError(error));
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
            run: async (args: any) => {
                const hasCheckAvailable = typeof args?.checkAvailable === 'boolean';
                try {
                    const isNative = hasCheckAvailable
                        ? await requester('scene', 'is-native', { checkAvailable: args.checkAvailable })
                        : await requester('scene', 'is-native');
                    return ok({
                        isNative: isNative === true,
                        checkAvailable: hasCheckAvailable ? args.checkAvailable : null
                    });
                } catch (error: any) {
                    return fail('查询原生编辑器模式失败', normalizeError(error));
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
            run: async (args: any) => {
                const tag = toNonEmptyString(args?.tag);
                if (!tag) {
                    return fail('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const hasDialogOptions = args?.dialogOptions !== undefined;
                if (hasDialogOptions && (!args.dialogOptions || typeof args.dialogOptions !== 'object' || Array.isArray(args.dialogOptions))) {
                    return fail('dialogOptions 必须为对象', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const action = hasDialogOptions
                        ? await requester('information', 'open-information-dialog', tag, args.dialogOptions)
                        : await requester('information', 'open-information-dialog', tag);
                    return ok({
                        opened: true,
                        tag,
                        action: action || null
                    });
                } catch (error: any) {
                    return fail('打开 information 对话框失败', normalizeError(error));
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
            run: async (args: any) => {
                const tag = toNonEmptyString(args?.tag);
                if (!tag) {
                    return fail('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const hasDialog = await requester('information', 'has-dialog', tag);
                    return ok({
                        tag,
                        hasDialog: hasDialog === true
                    });
                } catch (error: any) {
                    return fail('检查 information 对话框失败', normalizeError(error));
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
            run: async (args: any) => {
                const tag = toNonEmptyString(args?.tag);
                if (!tag) {
                    return fail('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('information', 'close-dialog', tag);
                    return ok({
                        closed: true,
                        tag
                    });
                } catch (error: any) {
                    return fail('关闭 information 对话框失败', normalizeError(error));
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
            run: async (args: any) => {
                const programId = toNonEmptyString(args?.programId);
                if (!programId) {
                    return fail('programId 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const options = args?.options && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const opened = options
                        ? await requester('program', 'open-program', programId, options)
                        : await requester('program', 'open-program', programId);
                    return ok({
                        programId,
                        options: options || null,
                        opened: opened === true
                    });
                } catch (error: any) {
                    return fail('打开程序失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const options = args?.options && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const opened = options
                        ? await requester('program', 'open-url', url, options)
                        : await requester('program', 'open-url', url);
                    return ok({
                        url,
                        options: options || null,
                        opened: opened === true
                    });
                } catch (error: any) {
                    return fail('打开链接失败', normalizeError(error));
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
                    return ok({
                        ipList: Array.isArray(ipList) ? ipList : [],
                        port: typeof port === 'number' ? port : null
                    });
                } catch (error: any) {
                    return fail('查询网络信息失败', normalizeError(error));
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
            run: async (args: any) => {
                const engineName = toNonEmptyString(args?.engineName);
                try {
                    const info = engineName
                        ? await requester('engine', 'query-engine-info', engineName)
                        : await requester('engine', 'query-engine-info');
                    return ok({
                        engineName: engineName || null,
                        // 统一走 query-engine-info，避免触发 query-info 废弃告警
                        runtime: info,
                        info
                    });
                } catch (error: any) {
                    return fail('查询引擎运行信息失败', normalizeError(error));
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
            run: async (args: any) => {
                const engineName = toNonEmptyString(args?.engineName);
                try {
                    const info = engineName
                        ? await requester('engine', 'query-engine-info', engineName)
                        : await requester('engine', 'query-engine-info');
                    return ok({ engineName: engineName || null, info });
                } catch (error: any) {
                    return fail('查询引擎详细信息失败', normalizeError(error));
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
                    return ok({ ready: ready === true });
                } catch (error: any) {
                    return fail('查询构建 worker 状态失败', normalizeError(error));
                }
            }
        }
    ];
}
