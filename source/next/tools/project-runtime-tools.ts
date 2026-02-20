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
