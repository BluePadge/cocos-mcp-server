"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssetDependencyTools = createAssetDependencyTools;
const common_1 = require("./common");
function normalizeRelationType(value) {
    if (value === 'script' || value === 'all') {
        return value;
    }
    return 'asset';
}
function buildAssetOperationOptions(overwrite) {
    return {
        overwrite,
        rename: !overwrite
    };
}
async function enrichAssetInfos(requester, uuids, includeInfo) {
    if (!includeInfo || uuids.length === 0) {
        return [];
    }
    const result = [];
    for (const uuid of uuids) {
        try {
            const info = await requester('asset-db', 'query-asset-info', uuid);
            result.push({ uuid, info: info || null });
        }
        catch (_a) {
            result.push({ uuid, info: null });
        }
    }
    return result;
}
function createAssetDependencyTools(requester) {
    return [
        {
            name: 'asset_query_asset_info',
            description: '查询资源详情',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrUuid: { type: 'string', description: '资源 URL 或 UUID' }
                },
                required: ['urlOrUuid']
            },
            requiredCapabilities: ['asset-db.query-asset-info'],
            run: async (args) => {
                const urlOrUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrUuid);
                if (!urlOrUuid) {
                    return (0, common_1.fail)('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const assetInfo = await requester('asset-db', 'query-asset-info', urlOrUuid);
                    return (0, common_1.ok)({ urlOrUuid, assetInfo });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源详情失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_assets',
            description: '按 pattern 查询资源列表',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'glob 模式', default: 'db://assets/**/*' }
                }
            },
            requiredCapabilities: ['asset-db.query-assets'],
            run: async (args) => {
                const pattern = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.pattern) || 'db://assets/**/*';
                try {
                    const assets = await requester('asset-db', 'query-assets', { pattern });
                    return (0, common_1.ok)({
                        pattern,
                        assets,
                        count: Array.isArray(assets) ? assets.length : 0
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源列表失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_dependencies',
            description: '查询资源直接依赖',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrUuid: { type: 'string', description: '资源 URL 或 UUID' },
                    relationType: {
                        type: 'string',
                        enum: ['asset', 'script', 'all'],
                        description: '依赖关系类型，默认 asset'
                    },
                    includeAssetInfo: {
                        type: 'boolean',
                        description: '是否附带每个依赖的资产详情（需要额外查询）',
                        default: false
                    }
                },
                required: ['urlOrUuid']
            },
            requiredCapabilities: ['asset-db.query-asset-dependencies'],
            run: async (args) => {
                const urlOrUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrUuid);
                if (!urlOrUuid) {
                    return (0, common_1.fail)('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const relationType = normalizeRelationType(args === null || args === void 0 ? void 0 : args.relationType);
                const includeAssetInfo = (args === null || args === void 0 ? void 0 : args.includeAssetInfo) === true;
                try {
                    const dependencies = await requester('asset-db', 'query-asset-dependencies', urlOrUuid, relationType);
                    const dependencyUuids = Array.isArray(dependencies) ? dependencies : [];
                    const dependencyInfos = await enrichAssetInfos(requester, dependencyUuids, includeAssetInfo);
                    return (0, common_1.ok)({
                        urlOrUuid,
                        relationType,
                        dependencies: dependencyUuids,
                        count: dependencyUuids.length,
                        dependencyInfos
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源依赖失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_users',
            description: '查询直接引用此资源的用户',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrUuid: { type: 'string', description: '资源 URL 或 UUID' },
                    relationType: {
                        type: 'string',
                        enum: ['asset', 'script', 'all'],
                        description: '引用方类型，默认 asset'
                    },
                    includeAssetInfo: {
                        type: 'boolean',
                        description: '是否附带每个引用方的资产详情（需要额外查询）',
                        default: false
                    }
                },
                required: ['urlOrUuid']
            },
            requiredCapabilities: ['asset-db.query-asset-users'],
            run: async (args) => {
                const urlOrUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrUuid);
                if (!urlOrUuid) {
                    return (0, common_1.fail)('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const relationType = normalizeRelationType(args === null || args === void 0 ? void 0 : args.relationType);
                const includeAssetInfo = (args === null || args === void 0 ? void 0 : args.includeAssetInfo) === true;
                try {
                    const users = await requester('asset-db', 'query-asset-users', urlOrUuid, relationType);
                    const userUuids = Array.isArray(users) ? users : [];
                    const userInfos = await enrichAssetInfos(requester, userUuids, includeAssetInfo);
                    return (0, common_1.ok)({
                        urlOrUuid,
                        relationType,
                        users: userUuids,
                        count: userUuids.length,
                        userInfos
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源引用方失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_copy_asset',
            description: '复制资源',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: '源资源 URL' },
                    target: { type: 'string', description: '目标资源 URL' },
                    overwrite: { type: 'boolean', description: '是否覆盖目标资源', default: false }
                },
                required: ['source', 'target']
            },
            requiredCapabilities: ['asset-db.copy-asset'],
            run: async (args) => {
                const source = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.source);
                const target = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.target);
                if (!source || !target) {
                    return (0, common_1.fail)('source/target 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'copy-asset', source, target, buildAssetOperationOptions((args === null || args === void 0 ? void 0 : args.overwrite) === true));
                    return (0, common_1.ok)({ source, target, result });
                }
                catch (error) {
                    return (0, common_1.fail)('复制资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_move_asset',
            description: '移动或重命名资源',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: '源资源 URL' },
                    target: { type: 'string', description: '目标资源 URL' },
                    overwrite: { type: 'boolean', description: '是否覆盖目标资源', default: false }
                },
                required: ['source', 'target']
            },
            requiredCapabilities: ['asset-db.move-asset'],
            run: async (args) => {
                const source = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.source);
                const target = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.target);
                if (!source || !target) {
                    return (0, common_1.fail)('source/target 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'move-asset', source, target, buildAssetOperationOptions((args === null || args === void 0 ? void 0 : args.overwrite) === true));
                    return (0, common_1.ok)({ moved: true, source, target, result });
                }
                catch (error) {
                    return (0, common_1.fail)('移动资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_delete_asset',
            description: '删除资源',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '资源 URL' }
                },
                required: ['url']
            },
            requiredCapabilities: ['asset-db.delete-asset'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'delete-asset', url);
                    return (0, common_1.ok)({ deleted: true, url, result });
                }
                catch (error) {
                    return (0, common_1.fail)('删除资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_path',
            description: '将资源 URL/UUID 解析为文件路径',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrUuid: { type: 'string', description: '资源 URL 或 UUID' }
                },
                required: ['urlOrUuid']
            },
            requiredCapabilities: ['asset-db.query-path'],
            run: async (args) => {
                const urlOrUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrUuid);
                if (!urlOrUuid) {
                    return (0, common_1.fail)('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const path = await requester('asset-db', 'query-path', urlOrUuid);
                    return (0, common_1.ok)({ urlOrUuid, path: path || null });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源路径失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_url',
            description: '将资源 UUID/路径解析为 URL',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    uuidOrPath: { type: 'string', description: '资源 UUID 或路径' }
                },
                required: ['uuidOrPath']
            },
            requiredCapabilities: ['asset-db.query-url'],
            run: async (args) => {
                const uuidOrPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.uuidOrPath);
                if (!uuidOrPath) {
                    return (0, common_1.fail)('uuidOrPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const url = await requester('asset-db', 'query-url', uuidOrPath);
                    return (0, common_1.ok)({ uuidOrPath, url: url || null });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源 URL 失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_uuid',
            description: '将资源 URL/路径解析为 UUID',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrPath: { type: 'string', description: '资源 URL 或路径' }
                },
                required: ['urlOrPath']
            },
            requiredCapabilities: ['asset-db.query-uuid'],
            run: async (args) => {
                const urlOrPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrPath);
                if (!urlOrPath) {
                    return (0, common_1.fail)('urlOrPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const uuid = await requester('asset-db', 'query-uuid', urlOrPath);
                    return (0, common_1.ok)({ urlOrPath, uuid: uuid || null });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源 UUID 失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_reimport_asset',
            description: '重导入资源',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '资源 URL' }
                },
                required: ['url']
            },
            requiredCapabilities: ['asset-db.reimport-asset'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('asset-db', 'reimport-asset', url);
                    return (0, common_1.ok)({ reimported: true, url });
                }
                catch (error) {
                    return (0, common_1.fail)('重导入资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_refresh_asset',
            description: '刷新资源数据库中的资源状态',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '资源 URL' }
                },
                required: ['url']
            },
            requiredCapabilities: ['asset-db.refresh-asset'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('asset-db', 'refresh-asset', url);
                    return (0, common_1.ok)({ refreshed: true, url });
                }
                catch (error) {
                    return (0, common_1.fail)('刷新资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_open_asset',
            description: '在编辑器中打开资源',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrUuid: { type: 'string', description: '资源 URL 或 UUID' }
                },
                required: ['urlOrUuid']
            },
            requiredCapabilities: ['asset-db.open-asset'],
            run: async (args) => {
                const urlOrUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrUuid);
                if (!urlOrUuid) {
                    return (0, common_1.fail)('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('asset-db', 'open-asset', urlOrUuid);
                    return (0, common_1.ok)({ opened: true, urlOrUuid });
                }
                catch (error) {
                    return (0, common_1.fail)('打开资源失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtZGVwZW5kZW5jeS10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL2Fzc2V0LWRlcGVuZGVuY3ktdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF3Q0EsZ0VBK1lDO0FBdGJELHFDQUFzRTtBQUl0RSxTQUFTLHFCQUFxQixDQUFDLEtBQVU7SUFDckMsSUFBSSxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUN4QyxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBQ0QsT0FBTyxPQUFPLENBQUM7QUFDbkIsQ0FBQztBQUVELFNBQVMsMEJBQTBCLENBQUMsU0FBa0I7SUFDbEQsT0FBTztRQUNILFNBQVM7UUFDVCxNQUFNLEVBQUUsQ0FBQyxTQUFTO0tBQ3JCLENBQUM7QUFDTixDQUFDO0FBRUQsS0FBSyxVQUFVLGdCQUFnQixDQUMzQixTQUEwQixFQUMxQixLQUFlLEVBQ2YsV0FBb0I7SUFFcEIsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3JDLE9BQU8sRUFBRSxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU0sTUFBTSxHQUE4QyxFQUFFLENBQUM7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUM7WUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLFNBQVMsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbkUsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxD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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWRpdG9yUmVxdWVzdGVyLCBOZXh0VG9vbERlZmluaXRpb24gfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHsgZmFpbCwgbm9ybWFsaXplRXJyb3IsIG9rLCB0b05vbkVtcHR5U3RyaW5nIH0gZnJvbSAnLi9jb21tb24nO1xuXG50eXBlIEFzc2V0UmVsYXRpb25UeXBlID0gJ2Fzc2V0JyB8ICdzY3JpcHQnIHwgJ2FsbCc7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVJlbGF0aW9uVHlwZSh2YWx1ZTogYW55KTogQXNzZXRSZWxhdGlvblR5cGUge1xuICAgIGlmICh2YWx1ZSA9PT0gJ3NjcmlwdCcgfHwgdmFsdWUgPT09ICdhbGwnKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuICdhc3NldCc7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQXNzZXRPcGVyYXRpb25PcHRpb25zKG92ZXJ3cml0ZTogYm9vbGVhbik6IHsgb3ZlcndyaXRlOiBib29sZWFuOyByZW5hbWU6IGJvb2xlYW4gfSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgb3ZlcndyaXRlLFxuICAgICAgICByZW5hbWU6ICFvdmVyd3JpdGVcbiAgICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnJpY2hBc3NldEluZm9zKFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIHV1aWRzOiBzdHJpbmdbXSxcbiAgICBpbmNsdWRlSW5mbzogYm9vbGVhblxuKTogUHJvbWlzZTxBcnJheTx7IHV1aWQ6IHN0cmluZzsgaW5mbzogYW55IHwgbnVsbCB9Pj4ge1xuICAgIGlmICghaW5jbHVkZUluZm8gfHwgdXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQ6IEFycmF5PHsgdXVpZDogc3RyaW5nOyBpbmZvOiBhbnkgfCBudWxsIH0+ID0gW107XG4gICAgZm9yIChjb25zdCB1dWlkIG9mIHV1aWRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXVpZCk7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh7IHV1aWQsIGluZm86IGluZm8gfHwgbnVsbCB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh7IHV1aWQsIGluZm86IG51bGwgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFzc2V0RGVwZW5kZW5jeVRvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9hc3NldF9pbmZvJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ6K+m5oOFJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXJsT3JVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+i1hOa6kCBVUkwg5oiWIFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybE9yVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktYXNzZXQtaW5mbyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsT3JVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmxPclV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsT3JVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmxPclV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgdXJsT3JVdWlkLCBhc3NldEluZm8gfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i6LWE5rqQ6K+m5oOF5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9hc3NldHMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmjIkgcGF0dGVybiDmn6Xor6LotYTmupDliJfooagnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ2dsb2Ig5qih5byPJywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzLyoqLyonIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktYXNzZXRzJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wYXR0ZXJuKSB8fCAnZGI6Ly9hc3NldHMvKiovKic7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IEFycmF5LmlzQXJyYXkoYXNzZXRzKSA/IGFzc2V0cy5sZW5ndGggOiAwXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kOWIl+ihqOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ55u05o6l5L6d6LWWJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXJsT3JVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+i1hOa6kCBVUkwg5oiWIFVVSUQnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uVHlwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2Fzc2V0JywgJ3NjcmlwdCcsICdhbGwnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5L6d6LWW5YWz57O757G75Z6L77yM6buY6K6kIGFzc2V0J1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlQXNzZXRJbmZvOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpumZhOW4puavj+S4quS+nei1lueahOi1hOS6p+ivpuaDhe+8iOmcgOimgemineWkluafpeivou+8iScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmxPclV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWRlcGVuZGVuY2llcyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsT3JVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmxPclV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsT3JVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmxPclV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVsYXRpb25UeXBlID0gbm9ybWFsaXplUmVsYXRpb25UeXBlKGFyZ3M/LnJlbGF0aW9uVHlwZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZUFzc2V0SW5mbyA9IGFyZ3M/LmluY2x1ZGVBc3NldEluZm8gPT09IHRydWU7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVwZW5kZW5jaWVzID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLCB1cmxPclV1aWQsIHJlbGF0aW9uVHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVuY3lVdWlkcyA9IEFycmF5LmlzQXJyYXkoZGVwZW5kZW5jaWVzKSA/IGRlcGVuZGVuY2llcyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXBlbmRlbmN5SW5mb3MgPSBhd2FpdCBlbnJpY2hBc3NldEluZm9zKHJlcXVlc3RlciwgZGVwZW5kZW5jeVV1aWRzLCBpbmNsdWRlQXNzZXRJbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llczogZGVwZW5kZW5jeVV1aWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGRlcGVuZGVuY3lVdWlkcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXBlbmRlbmN5SW5mb3NcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i6LWE5rqQ5L6d6LWW5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV91c2VycycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouebtOaOpeW8leeUqOatpOi1hOa6kOeahOeUqOaItycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMIOaIliBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvblR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydhc3NldCcsICdzY3JpcHQnLCAnYWxsJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+W8leeUqOaWueexu+Wei++8jOm7mOiupCBhc3NldCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUFzc2V0SW5mbzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbpmYTluKbmr4/kuKrlvJXnlKjmlrnnmoTotYTkuqfor6bmg4XvvIjpnIDopoHpop3lpJbmn6Xor6LvvIknLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsT3JVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5xdWVyeS1hc3NldC11c2VycyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsT3JVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmxPclV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsT3JVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmxPclV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVsYXRpb25UeXBlID0gbm9ybWFsaXplUmVsYXRpb25UeXBlKGFyZ3M/LnJlbGF0aW9uVHlwZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZUFzc2V0SW5mbyA9IGFyZ3M/LmluY2x1ZGVBc3NldEluZm8gPT09IHRydWU7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlcnMgPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LXVzZXJzJywgdXJsT3JVdWlkLCByZWxhdGlvblR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VyVXVpZHMgPSBBcnJheS5pc0FycmF5KHVzZXJzKSA/IHVzZXJzIDogW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJJbmZvcyA9IGF3YWl0IGVucmljaEFzc2V0SW5mb3MocmVxdWVzdGVyLCB1c2VyVXVpZHMsIGluY2x1ZGVBc3NldEluZm8pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXJsT3JVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25UeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcnM6IHVzZXJVdWlkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiB1c2VyVXVpZHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlckluZm9zXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kOW8leeUqOaWueWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfY29weV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WkjeWItui1hOa6kCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmupDotYTmupAgVVJMJyB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICfmmK/lkKbopobnm5bnm67moIfotYTmupAnLCBkZWZhdWx0OiBmYWxzZSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzb3VyY2UnLCAndGFyZ2V0J11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5jb3B5LWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnNvdXJjZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YXJnZXQpO1xuICAgICAgICAgICAgICAgIGlmICghc291cmNlIHx8ICF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3NvdXJjZS90YXJnZXQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdjb3B5LWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIGJ1aWxkQXNzZXRPcGVyYXRpb25PcHRpb25zKGFyZ3M/Lm92ZXJ3cml0ZSA9PT0gdHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBzb3VyY2UsIHRhcmdldCwgcmVzdWx0IH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WkjeWItui1hOa6kOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfbW92ZV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+enu+WKqOaIlumHjeWRveWQjei1hOa6kCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfmupDotYTmupAgVVJMJyB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICfmmK/lkKbopobnm5bnm67moIfotYTmupAnLCBkZWZhdWx0OiBmYWxzZSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzb3VyY2UnLCAndGFyZ2V0J11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5tb3ZlLWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnNvdXJjZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YXJnZXQpO1xuICAgICAgICAgICAgICAgIGlmICghc291cmNlIHx8ICF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3NvdXJjZS90YXJnZXQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdtb3ZlLWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIGJ1aWxkQXNzZXRPcGVyYXRpb25PcHRpb25zKGFyZ3M/Lm92ZXJ3cml0ZSA9PT0gdHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBtb3ZlZDogdHJ1ZSwgc291cmNlLCB0YXJnZXQsIHJlc3VsdCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfnp7vliqjotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X2RlbGV0ZV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WIoOmZpOi1hOa6kCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmwnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLmRlbGV0ZS1hc3NldCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmwpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmwg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBkZWxldGVkOiB0cnVlLCB1cmwsIHJlc3VsdCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfliKDpmaTotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3BhdGgnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIbotYTmupAgVVJML1VVSUQg6Kej5p6Q5Li65paH5Lu26Lev5b6EJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXJsT3JVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+i1hOa6kCBVUkwg5oiWIFVVSUQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybE9yVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktcGF0aCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsT3JVdWlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmxPclV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsT3JVdWlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmxPclV1aWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktcGF0aCcsIHVybE9yVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHVybE9yVXVpZCwgcGF0aDogcGF0aCB8fCBudWxsIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kOi3r+W+hOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfdXJsJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCG6LWE5rqQIFVVSUQv6Lev5b6E6Kej5p6Q5Li6IFVSTCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWRPclBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVVSUQg5oiW6Lev5b6EJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1dWlkT3JQYXRoJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5xdWVyeS11cmwnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRPclBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnV1aWRPclBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghdXVpZE9yUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXVpZE9yUGF0aCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHV1aWRPclBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyB1dWlkT3JQYXRoLCB1cmw6IHVybCB8fCBudWxsIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kCBVUkwg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV91dWlkJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCG6LWE5rqQIFVSTC/ot6/lvoTop6PmnpDkuLogVVVJRCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybE9yUGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMIOaIlui3r+W+hCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsT3JQYXRoJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5xdWVyeS11dWlkJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxPclBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybE9yUGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmxPclBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybE9yUGF0aCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgdXJsT3JQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgdXJsT3JQYXRoLCB1dWlkOiB1dWlkIHx8IG51bGwgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i6LWE5rqQIFVVSUQg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9yZWltcG9ydF9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjeWvvOWFpei1hOa6kCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmwnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnJlaW1wb3J0LWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgcmVpbXBvcnRlZDogdHJ1ZSwgdXJsIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+mHjeWvvOWFpei1hOa6kOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcmVmcmVzaF9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WIt+aWsOi1hOa6kOaVsOaNruW6k+S4reeahOi1hOa6kOeKtuaAgScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmwnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnJlZnJlc2gtYXNzZXQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncmVmcmVzaC1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHJlZnJlc2hlZDogdHJ1ZSwgdXJsIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIt+aWsOi1hOa6kOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfb3Blbl9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WcqOe8lui+keWZqOS4reaJk+W8gOi1hOa6kCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMIOaIliBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmxPclV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLm9wZW4tYXNzZXQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybE9yVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybE9yVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsT3JVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAnb3Blbi1hc3NldCcsIHVybE9yVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IG9wZW5lZDogdHJ1ZSwgdXJsT3JVdWlkIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJk+W8gOi1hOa6kOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXTtcbn1cbiJdfQ==