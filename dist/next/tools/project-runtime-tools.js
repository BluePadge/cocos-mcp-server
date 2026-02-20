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
            requiredCapabilities: ['engine.query-info'],
            run: async (args) => {
                const engineName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.engineName);
                try {
                    const info = engineName
                        ? await requester('engine', 'query-info', engineName)
                        : await requester('engine', 'query-info');
                    return (0, common_1.ok)({ engineName: engineName || null, info });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdC1ydW50aW1lLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvcHJvamVjdC1ydW50aW1lLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBb0JBLDhEQWlNQztBQXBORCxxQ0FBc0U7QUFLdEUsU0FBUyx3QkFBd0IsQ0FBQyxLQUFVO0lBQ3hDLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDN0MsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLDRCQUE0QixDQUFDLEtBQVU7SUFDNUMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLE9BQU8sRUFBRSxDQUFDO1FBQ2pFLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBZ0IseUJBQXlCLENBQUMsU0FBMEI7SUFDaEUsT0FBTztRQUNIO1lBQ0ksSUFBSSxFQUFFLHNCQUFzQjtZQUM1QixXQUFXLEVBQUUsUUFBUTtZQUNyQixLQUFLLEVBQUUsVUFBVTtZQUNqQixRQUFRLEVBQUUsU0FBUztZQUNuQixXQUFXLEVBQUU7Z0JBQ1QsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsVUFBVSxFQUFFO29CQUNSLFVBQVUsRUFBRTt3QkFDUixJQUFJLEVBQUUsUUFBUTt3QkFDZCxXQUFXLEVBQUUsaUJBQWlCO3FCQUNqQztvQkFDRCxHQUFHLEVBQUU7d0JBQ0QsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsV0FBVyxFQUFFLFVBQVU7cUJBQzFCO29CQUNELFFBQVEsRUFBRTt3QkFDTixJQUFJLEVBQUUsUUFBUTt3QkFDZCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO3dCQUM1QixXQUFXLEVB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QUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHRvTm9uRW1wdHlTdHJpbmcgfSBmcm9tICcuL2NvbW1vbic7XG5cbnR5cGUgUHJvamVjdFByb3RvY29sID0gJ2RlZmF1bHQnIHwgJ3Byb2plY3QnO1xudHlwZSBQcmVmZXJlbmNlc1Byb3RvY29sID0gJ2RlZmF1bHQnIHwgJ2dsb2JhbCcgfCAnbG9jYWwnO1xuXG5mdW5jdGlvbiBub3JtYWxpemVQcm9qZWN0UHJvdG9jb2wodmFsdWU6IGFueSk6IFByb2plY3RQcm90b2NvbCB8IG51bGwge1xuICAgIGlmICh2YWx1ZSA9PT0gJ2RlZmF1bHQnIHx8IHZhbHVlID09PSAncHJvamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUHJlZmVyZW5jZXNQcm90b2NvbCh2YWx1ZTogYW55KTogUHJlZmVyZW5jZXNQcm90b2NvbCB8IG51bGwge1xuICAgIGlmICh2YWx1ZSA9PT0gJ2RlZmF1bHQnIHx8IHZhbHVlID09PSAnZ2xvYmFsJyB8fCB2YWx1ZSA9PT0gJ2xvY2FsJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUHJvamVjdFJ1bnRpbWVUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAncHJvamVjdF9xdWVyeV9jb25maWcnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lpobnnm67phY3nva4nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ1R5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfphY3nva7nsbvlnovvvIzpu5jorqQgcHJvamVjdCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAga2V5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6YWN572u6aG56ZSu5ZCNJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwcm90b2NvbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlZmF1bHQnLCAncHJvamVjdCddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxwcm9qZWN0LnF1ZXJ5LWNvbmZpZyDnmoQgcHJvdG9jb2wnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsncHJvamVjdC5xdWVyeS1jb25maWcnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbmZpZ1R5cGUpIHx8ICdwcm9qZWN0JztcbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmtleSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvdG9jb2wgPSBub3JtYWxpemVQcm9qZWN0UHJvdG9jb2woYXJncz8ucHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzPy5wcm90b2NvbCAhPT0gdW5kZWZpbmVkICYmICFwcm90b2NvbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncHJvdG9jb2wg5LuF5pSv5oyBIGRlZmF1bHQvcHJvamVjdCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjb25maWc6IGFueTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3RvY29sKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSwga2V5IHx8IHVuZGVmaW5lZCwgcHJvdG9jb2wpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ1R5cGUsIGtleSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgY29uZmlnVHlwZSwga2V5OiBrZXkgfHwgbnVsbCwgcHJvdG9jb2wsIGNvbmZpZyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Lpobnnm67phY3nva7lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3ByZWZlcmVuY2VzX3F1ZXJ5X2NvbmZpZycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue8lui+keWZqOWBj+Wlveiuvue9ricsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnVHlwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mFjee9ruexu+Wei++8jOm7mOiupCBnZW5lcmFsJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBrZXk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzphY3nva7pobnplK7lkI0nXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb3RvY29sOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnZGVmYXVsdCcsICdnbG9iYWwnLCAnbG9jYWwnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yMcHJlZmVyZW5jZXMucXVlcnktY29uZmlnIOeahCBwcm90b2NvbCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcmVmZXJlbmNlcy5xdWVyeS1jb25maWcnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbmZpZ1R5cGUpIHx8ICdnZW5lcmFsJztcbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmtleSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvdG9jb2wgPSBub3JtYWxpemVQcmVmZXJlbmNlc1Byb3RvY29sKGFyZ3M/LnByb3RvY29sKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJncz8ucHJvdG9jb2wgIT09IHVuZGVmaW5lZCAmJiAhcHJvdG9jb2wpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3Byb3RvY29sIOS7heaUr+aMgSBkZWZhdWx0L2dsb2JhbC9sb2NhbCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjb25maWc6IGFueTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3RvY29sKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3ByZWZlcmVuY2VzJywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ1R5cGUsIGtleSB8fCB1bmRlZmluZWQsIHByb3RvY29sKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZyA9IGF3YWl0IHJlcXVlc3RlcigncHJlZmVyZW5jZXMnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSwga2V5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZyA9IGF3YWl0IHJlcXVlc3RlcigncHJlZmVyZW5jZXMnLCAncXVlcnktY29uZmlnJywgY29uZmlnVHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgY29uZmlnVHlwZSwga2V5OiBrZXkgfHwgbnVsbCwgcHJvdG9jb2wsIGNvbmZpZyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LlgY/lpb3orr7nva7lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NlcnZlcl9xdWVyeV9uZXR3b3JrJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5Zmo572R57uc5L+h5oGv77yISVAg5YiX6KGo5LiO56uv5Y+j77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdwcm9qZWN0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzZXJ2ZXIucXVlcnktaXAtbGlzdCcsICdzZXJ2ZXIucXVlcnktcG9ydCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXBMaXN0ID0gYXdhaXQgcmVxdWVzdGVyKCdzZXJ2ZXInLCAncXVlcnktaXAtbGlzdCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3J0ID0gYXdhaXQgcmVxdWVzdGVyKCdzZXJ2ZXInLCAncXVlcnktcG9ydCcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgaXBMaXN0OiBBcnJheS5pc0FycmF5KGlwTGlzdCkgPyBpcExpc3QgOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvcnQ6IHR5cGVvZiBwb3J0ID09PSAnbnVtYmVyJyA/IHBvcnQgOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoue9kee7nOS/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZW5naW5lX3F1ZXJ5X3J1bnRpbWVfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouW9k+WJjeW8leaTjui/kOihjOS/oeaBr++8iOeJiOacrC/ot6/lvoTvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGVuZ2luZU5hbWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzlvJXmk47lkI3np7AnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnZW5naW5lLnF1ZXJ5LWluZm8nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuZ2luZU5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmVuZ2luZU5hbWUpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBlbmdpbmVOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcignZW5naW5lJywgJ3F1ZXJ5LWluZm8nLCBlbmdpbmVOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ2VuZ2luZScsICdxdWVyeS1pbmZvJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IGVuZ2luZU5hbWU6IGVuZ2luZU5hbWUgfHwgbnVsbCwgaW5mbyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LlvJXmk47ov5DooYzkv6Hmga/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2VuZ2luZV9xdWVyeV9lbmdpbmVfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouW8leaTjuivpue7huS/oeaBrycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgZW5naW5lTmFtZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOW8leaTjuWQjeensCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydlbmdpbmUucXVlcnktZW5naW5lLWluZm8nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuZ2luZU5hbWUgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmVuZ2luZU5hbWUpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBlbmdpbmVOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcignZW5naW5lJywgJ3F1ZXJ5LWVuZ2luZS1pbmZvJywgZW5naW5lTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdlbmdpbmUnLCAncXVlcnktZW5naW5lLWluZm8nKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgZW5naW5lTmFtZTogZW5naW5lTmFtZSB8fCBudWxsLCBpbmZvIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouW8leaTjuivpue7huS/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYnVpbGRlcl9xdWVyeV93b3JrZXJfcmVhZHknLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LmnoTlu7ogd29ya2VyIOaYr+WQpuWwsee7qicsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncHJvamVjdCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYnVpbGRlci5xdWVyeS13b3JrZXItcmVhZHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlYWR5ID0gYXdhaXQgcmVxdWVzdGVyKCdidWlsZGVyJywgJ3F1ZXJ5LXdvcmtlci1yZWFkeScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZWFkeTogcmVhZHkgPT09IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i5p6E5bu6IHdvcmtlciDnirbmgIHlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=