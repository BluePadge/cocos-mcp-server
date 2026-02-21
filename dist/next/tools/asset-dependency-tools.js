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
function parseAssetOperationOptions(args) {
    if (typeof (args === null || args === void 0 ? void 0 : args.overwrite) === 'boolean') {
        if (typeof (args === null || args === void 0 ? void 0 : args.rename) === 'boolean') {
            return {
                overwrite: args.overwrite,
                rename: args.rename
            };
        }
        return buildAssetOperationOptions(args.overwrite);
    }
    if (typeof (args === null || args === void 0 ? void 0 : args.rename) === 'boolean') {
        return {
            overwrite: false,
            rename: args.rename
        };
    }
    return {
        overwrite: false,
        rename: true
    };
}
function parseAssetContent(content, encoding) {
    if (content === null) {
        return null;
    }
    if (typeof content === 'string') {
        if (encoding === 'base64') {
            return Buffer.from(content, 'base64');
        }
        return content;
    }
    return null;
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
        },
        {
            name: 'asset_generate_available_url',
            description: '生成可用的资源 URL（避免重名冲突）',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '期望资源 URL' }
                },
                required: ['url']
            },
            requiredCapabilities: ['asset-db.generate-available-url'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const availableUrl = await requester('asset-db', 'generate-available-url', url);
                    return (0, common_1.ok)({
                        inputUrl: url,
                        availableUrl
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('生成可用 URL 失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_asset_meta',
            description: '查询资源 meta 信息',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrUuid: { type: 'string', description: '资源 URL 或 UUID' }
                },
                required: ['urlOrUuid']
            },
            requiredCapabilities: ['asset-db.query-asset-meta'],
            run: async (args) => {
                const urlOrUuid = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrUuid);
                if (!urlOrUuid) {
                    return (0, common_1.fail)('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const meta = await requester('asset-db', 'query-asset-meta', urlOrUuid);
                    return (0, common_1.ok)({
                        urlOrUuid,
                        meta
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询资源 meta 失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_query_missing_asset_info',
            description: '查询丢失资源信息',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    urlOrPath: { type: 'string', description: '资源 URL 或路径' }
                },
                required: ['urlOrPath']
            },
            requiredCapabilities: ['asset-db.query-missing-asset-info'],
            run: async (args) => {
                const urlOrPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.urlOrPath);
                if (!urlOrPath) {
                    return (0, common_1.fail)('urlOrPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const missingInfo = await requester('asset-db', 'query-missing-asset-info', urlOrPath);
                    return (0, common_1.ok)({
                        urlOrPath,
                        missingInfo
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询丢失资源信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_create_asset',
            description: '创建资源文件（asset-db.create-asset）',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '目标资源 URL' },
                    content: { description: '资源内容（字符串或 null）' },
                    contentEncoding: {
                        type: 'string',
                        enum: ['utf8', 'base64'],
                        description: 'content 编码，默认 utf8'
                    },
                    overwrite: { type: 'boolean', description: '是否覆盖同名资源' },
                    rename: { type: 'boolean', description: '冲突时是否自动重命名' }
                },
                required: ['url']
            },
            requiredCapabilities: ['asset-db.create-asset'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const contentEncoding = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.contentEncoding) || 'utf8';
                if (contentEncoding !== 'utf8' && contentEncoding !== 'base64') {
                    return (0, common_1.fail)('contentEncoding 仅支持 utf8/base64', undefined, 'E_INVALID_ARGUMENT');
                }
                const content = parseAssetContent(args === null || args === void 0 ? void 0 : args.content, contentEncoding);
                if ((args === null || args === void 0 ? void 0 : args.content) !== null && (args === null || args === void 0 ? void 0 : args.content) !== undefined && content === null) {
                    return (0, common_1.fail)('content 必须为字符串或 null', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'create-asset', url, content, parseAssetOperationOptions(args));
                    return (0, common_1.ok)({
                        created: true,
                        url,
                        contentEncoding,
                        result
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('创建资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_import_asset',
            description: '从本地路径导入资源到目标 URL',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    sourcePath: { type: 'string', description: '本地文件路径' },
                    targetUrl: { type: 'string', description: '目标资源 URL' },
                    overwrite: { type: 'boolean', description: '是否覆盖同名资源' },
                    rename: { type: 'boolean', description: '冲突时是否自动重命名' }
                },
                required: ['sourcePath', 'targetUrl']
            },
            requiredCapabilities: ['asset-db.import-asset'],
            run: async (args) => {
                const sourcePath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.sourcePath);
                const targetUrl = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.targetUrl);
                if (!sourcePath || !targetUrl) {
                    return (0, common_1.fail)('sourcePath/targetUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'import-asset', sourcePath, targetUrl, parseAssetOperationOptions(args));
                    return (0, common_1.ok)({
                        imported: true,
                        sourcePath,
                        targetUrl,
                        result
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('导入资源失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_save_asset',
            description: '保存资源内容（asset-db.save-asset）',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '资源 URL' },
                    content: { type: 'string', description: '资源内容' },
                    contentEncoding: {
                        type: 'string',
                        enum: ['utf8', 'base64'],
                        description: 'content 编码，默认 utf8'
                    }
                },
                required: ['url', 'content']
            },
            requiredCapabilities: ['asset-db.save-asset'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url || typeof (args === null || args === void 0 ? void 0 : args.content) !== 'string') {
                    return (0, common_1.fail)('url/content 必填且 content 必须为字符串', undefined, 'E_INVALID_ARGUMENT');
                }
                const contentEncoding = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.contentEncoding) || 'utf8';
                if (contentEncoding !== 'utf8' && contentEncoding !== 'base64') {
                    return (0, common_1.fail)('contentEncoding 仅支持 utf8/base64', undefined, 'E_INVALID_ARGUMENT');
                }
                const content = parseAssetContent(args.content, contentEncoding);
                if (content === null) {
                    return (0, common_1.fail)('content 解析失败', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'save-asset', url, content);
                    return (0, common_1.ok)({
                        saved: true,
                        url,
                        contentEncoding,
                        result
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('保存资源内容失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'asset_save_asset_meta',
            description: '保存资源 meta 内容（asset-db.save-asset-meta）',
            layer: 'official',
            category: 'asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '资源 URL' },
                    meta: {
                        description: 'meta 内容，支持对象或 JSON 字符串'
                    }
                },
                required: ['url', 'meta']
            },
            requiredCapabilities: ['asset-db.save-asset-meta'],
            run: async (args) => {
                const url = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.url);
                if (!url) {
                    return (0, common_1.fail)('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                let metaContent = null;
                if (typeof (args === null || args === void 0 ? void 0 : args.meta) === 'string') {
                    metaContent = args.meta;
                }
                else if ((args === null || args === void 0 ? void 0 : args.meta) && typeof args.meta === 'object') {
                    try {
                        metaContent = JSON.stringify(args.meta, null, 2);
                    }
                    catch (error) {
                        return (0, common_1.fail)('meta 对象序列化失败', (0, common_1.normalizeError)(error), 'E_INVALID_ARGUMENT');
                    }
                }
                if (!metaContent) {
                    return (0, common_1.fail)('meta 必须为对象或 JSON 字符串', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const result = await requester('asset-db', 'save-asset-meta', url, metaContent);
                    return (0, common_1.ok)({
                        saved: true,
                        url,
                        result
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('保存资源 meta 失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtZGVwZW5kZW5jeS10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL2Fzc2V0LWRlcGVuZGVuY3ktdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUErRUEsZ0VBNHFCQztBQTF2QkQscUNBQXNFO0FBSXRFLFNBQVMscUJBQXFCLENBQUMsS0FBVTtJQUNyQyxJQUFJLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRSxDQUFDO1FBQ3hDLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNuQixDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxTQUFrQjtJQUNsRCxPQUFPO1FBQ0gsU0FBUztRQUNULE1BQU0sRUFBRSxDQUFDLFNBQVM7S0FDckIsQ0FBQztBQUNOLENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUFDLElBQVM7SUFDekMsSUFBSSxPQUFPLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLFNBQVMsQ0FBQSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ3ZDLElBQUksT0FBTyxDQUFBLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxNQUFNLENBQUEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNwQyxPQUFPO2dCQUNILFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztnQkFDekIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO2FBQ3RCLENBQUM7UUFDTixDQUFDO1FBQ0QsT0FBTywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVELElBQUksT0FBTyxDQUFBLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxNQUFNLENBQUEsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNwQyxPQUFPO1lBQ0gsU0FBUyxFQUFFLEtBQUs7WUFDaEIsTUFBTSxFQUFFLElB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QUssRUFBRSxJQUFJO3dCQUNYLEdBQUc7d0JBQ0gsTUFBTTtxQkFDVCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztnQkFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO29CQUNsQixPQUFPLElBQUEsYUFBSSxFQUFDLGNBQWMsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDdkQsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWRpdG9yUmVxdWVzdGVyLCBOZXh0VG9vbERlZmluaXRpb24gfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHsgZmFpbCwgbm9ybWFsaXplRXJyb3IsIG9rLCB0b05vbkVtcHR5U3RyaW5nIH0gZnJvbSAnLi9jb21tb24nO1xuXG50eXBlIEFzc2V0UmVsYXRpb25UeXBlID0gJ2Fzc2V0JyB8ICdzY3JpcHQnIHwgJ2FsbCc7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVJlbGF0aW9uVHlwZSh2YWx1ZTogYW55KTogQXNzZXRSZWxhdGlvblR5cGUge1xuICAgIGlmICh2YWx1ZSA9PT0gJ3NjcmlwdCcgfHwgdmFsdWUgPT09ICdhbGwnKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuICdhc3NldCc7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQXNzZXRPcGVyYXRpb25PcHRpb25zKG92ZXJ3cml0ZTogYm9vbGVhbik6IHsgb3ZlcndyaXRlOiBib29sZWFuOyByZW5hbWU6IGJvb2xlYW4gfSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgb3ZlcndyaXRlLFxuICAgICAgICByZW5hbWU6ICFvdmVyd3JpdGVcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUFzc2V0T3BlcmF0aW9uT3B0aW9ucyhhcmdzOiBhbnkpOiB7IG92ZXJ3cml0ZTogYm9vbGVhbjsgcmVuYW1lOiBib29sZWFuIH0ge1xuICAgIGlmICh0eXBlb2YgYXJncz8ub3ZlcndyaXRlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhcmdzPy5yZW5hbWUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvdmVyd3JpdGU6IGFyZ3Mub3ZlcndyaXRlLFxuICAgICAgICAgICAgICAgIHJlbmFtZTogYXJncy5yZW5hbWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ1aWxkQXNzZXRPcGVyYXRpb25PcHRpb25zKGFyZ3Mub3ZlcndyaXRlKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZ3M/LnJlbmFtZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvdmVyd3JpdGU6IGZhbHNlLFxuICAgICAgICAgICAgcmVuYW1lOiBhcmdzLnJlbmFtZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIG92ZXJ3cml0ZTogZmFsc2UsXG4gICAgICAgIHJlbmFtZTogdHJ1ZVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlQXNzZXRDb250ZW50KGNvbnRlbnQ6IGFueSwgZW5jb2Rpbmc6IGFueSk6IHN0cmluZyB8IEJ1ZmZlciB8IG51bGwge1xuICAgIGlmIChjb250ZW50ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0Jykge1xuICAgICAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGNvbnRlbnQsICdiYXNlNjQnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5yaWNoQXNzZXRJbmZvcyhcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICB1dWlkczogc3RyaW5nW10sXG4gICAgaW5jbHVkZUluZm86IGJvb2xlYW5cbik6IFByb21pc2U8QXJyYXk8eyB1dWlkOiBzdHJpbmc7IGluZm86IGFueSB8IG51bGwgfT4+IHtcbiAgICBpZiAoIWluY2x1ZGVJbmZvIHx8IHV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0OiBBcnJheTx7IHV1aWQ6IHN0cmluZzsgaW5mbzogYW55IHwgbnVsbCB9PiA9IFtdO1xuICAgIGZvciAoY29uc3QgdXVpZCBvZiB1dWlkcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHV1aWQpO1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goeyB1dWlkLCBpbmZvOiBpbmZvIHx8IG51bGwgfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goeyB1dWlkLCBpbmZvOiBudWxsIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBc3NldERlcGVuZGVuY3lUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfYXNzZXRfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoui1hOa6kOivpuaDhScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMIOaIliBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmxPclV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybE9yVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybE9yVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsT3JVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybE9yVXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHVybE9yVXVpZCwgYXNzZXRJbmZvIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kOivpuaDheWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfYXNzZXRzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJIHBhdHRlcm4g5p+l6K+i6LWE5rqQ5YiX6KGoJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdnbG9iIOaooeW8jycsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0cyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucGF0dGVybikgfHwgJ2RiOi8vYXNzZXRzLyoqLyonO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGF0dGVybixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiBBcnJheS5pc0FycmF5KGFzc2V0cykgPyBhc3NldHMubGVuZ3RoIDogMFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LotYTmupDliJfooajlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X2RlcGVuZGVuY2llcycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoui1hOa6kOebtOaOpeS+nei1licsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMIOaIliBVVUlEJyB9LFxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvblR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydhc3NldCcsICdzY3JpcHQnLCAnYWxsJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S+nei1luWFs+ezu+exu+Wei++8jOm7mOiupCBhc3NldCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUFzc2V0SW5mbzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbpmYTluKbmr4/kuKrkvp3otZbnmoTotYTkuqfor6bmg4XvvIjpnIDopoHpop3lpJbmn6Xor6LvvIknLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsT3JVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5xdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybE9yVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybE9yVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsT3JVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlbGF0aW9uVHlwZSA9IG5vcm1hbGl6ZVJlbGF0aW9uVHlwZShhcmdzPy5yZWxhdGlvblR5cGUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVBc3NldEluZm8gPSBhcmdzPy5pbmNsdWRlQXNzZXRJbmZvID09PSB0cnVlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJywgdXJsT3JVdWlkLCByZWxhdGlvblR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXBlbmRlbmN5VXVpZHMgPSBBcnJheS5pc0FycmF5KGRlcGVuZGVuY2llcykgPyBkZXBlbmRlbmNpZXMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVwZW5kZW5jeUluZm9zID0gYXdhaXQgZW5yaWNoQXNzZXRJbmZvcyhyZXF1ZXN0ZXIsIGRlcGVuZGVuY3lVdWlkcywgaW5jbHVkZUFzc2V0SW5mbyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cmxPclV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvblR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXBlbmRlbmNpZXM6IGRlcGVuZGVuY3lVdWlkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiBkZXBlbmRlbmN5VXVpZHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVwZW5kZW5jeUluZm9zXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kOS+nei1luWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfdXNlcnMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lnm7TmjqXlvJXnlKjmraTotYTmupDnmoTnlKjmiLcnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmxPclV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCDmiJYgVVVJRCcgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25UeXBlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnYXNzZXQnLCAnc2NyaXB0JywgJ2FsbCddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflvJXnlKjmlrnnsbvlnovvvIzpu5jorqQgYXNzZXQnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGVBc3NldEluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm6ZmE5bim5q+P5Liq5byV55So5pa555qE6LWE5Lqn6K+m5oOF77yI6ZyA6KaB6aKd5aSW5p+l6K+i77yJJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybE9yVXVpZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktYXNzZXQtdXNlcnMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybE9yVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybE9yVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsT3JVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlbGF0aW9uVHlwZSA9IG5vcm1hbGl6ZVJlbGF0aW9uVHlwZShhcmdzPy5yZWxhdGlvblR5cGUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVBc3NldEluZm8gPSBhcmdzPy5pbmNsdWRlQXNzZXRJbmZvID09PSB0cnVlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJzID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1hc3NldC11c2VycycsIHVybE9yVXVpZCwgcmVsYXRpb25UeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlclV1aWRzID0gQXJyYXkuaXNBcnJheSh1c2VycykgPyB1c2VycyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VySW5mb3MgPSBhd2FpdCBlbnJpY2hBc3NldEluZm9zKHJlcXVlc3RlciwgdXNlclV1aWRzLCBpbmNsdWRlQXNzZXRJbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXJzOiB1c2VyVXVpZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogdXNlclV1aWRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXJJbmZvc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LotYTmupDlvJXnlKjmlrnlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X2NvcHlfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLbotYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5rqQ6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+i1hOa6kCBVUkwnIH0sXG4gICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5piv5ZCm6KaG55uW55uu5qCH6LWE5rqQJywgZGVmYXVsdDogZmFsc2UgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnc291cmNlJywgJ3RhcmdldCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIuY29weS1hc3NldCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc291cmNlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5zb3VyY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFyZ2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZSB8fCAhdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdzb3VyY2UvdGFyZ2V0IOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAnY29weS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCBidWlsZEFzc2V0T3BlcmF0aW9uT3B0aW9ucyhhcmdzPy5vdmVyd3JpdGUgPT09IHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgc291cmNlLCB0YXJnZXQsIHJlc3VsdCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflpI3liLbotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X21vdmVfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnp7vliqjmiJbph43lkb3lkI3otYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5rqQ6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+i1hOa6kCBVUkwnIH0sXG4gICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5piv5ZCm6KaG55uW55uu5qCH6LWE5rqQJywgZGVmYXVsdDogZmFsc2UgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnc291cmNlJywgJ3RhcmdldCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIubW92ZS1hc3NldCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc291cmNlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5zb3VyY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFyZ2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZSB8fCAhdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdzb3VyY2UvdGFyZ2V0IOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAnbW92ZS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCBidWlsZEFzc2V0T3BlcmF0aW9uT3B0aW9ucyhhcmdzPy5vdmVyd3JpdGUgPT09IHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgbW92ZWQ6IHRydWUsIHNvdXJjZSwgdGFyZ2V0LCByZXN1bHQgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn56e75Yqo6LWE5rqQ5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9kZWxldGVfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfliKDpmaTotYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5kZWxldGUtYXNzZXQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgZGVsZXRlZDogdHJ1ZSwgdXJsLCByZXN1bHQgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5Yig6Zmk6LWE5rqQ5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9wYXRoJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCG6LWE5rqQIFVSTC9VVUlEIOino+aekOS4uuaWh+S7tui3r+W+hCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupAgVVJMIOaIliBVVUlEJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmxPclV1aWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnF1ZXJ5LXBhdGgnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybE9yVXVpZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVybE9yVXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndXJsT3JVdWlkIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCB1cmxPclV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyB1cmxPclV1aWQsIHBhdGg6IHBhdGggfHwgbnVsbCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LotYTmupDot6/lvoTlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X3VybCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+Wwhui1hOa6kCBVVUlEL+i3r+W+hOino+aekOS4uiBVUkwnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkT3JQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+i1hOa6kCBVVUlEIOaIlui3r+W+hCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZE9yUGF0aCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktdXJsJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1dWlkT3JQYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51dWlkT3JQYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoIXV1aWRPclBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWRPclBhdGgg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS11cmwnLCB1dWlkT3JQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgdXVpZE9yUGF0aCwgdXJsOiB1cmwgfHwgbnVsbCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LotYTmupAgVVJMIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnlfdXVpZCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+Wwhui1hOa6kCBVUkwv6Lev5b6E6Kej5p6Q5Li6IFVVSUQnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmxPclBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCDmiJbot6/lvoQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybE9yUGF0aCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktdXVpZCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsT3JQYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmxPclBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsT3JQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmxPclBhdGgg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXVpZCA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktdXVpZCcsIHVybE9yUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHVybE9yUGF0aCwgdXVpZDogdXVpZCB8fCBudWxsIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoui1hOa6kCBVVUlEIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfcmVpbXBvcnRfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfph43lr7zlhaXotYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5yZWltcG9ydC1hc3NldCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmwpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmwg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHJlaW1wb3J0ZWQ6IHRydWUsIHVybCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfph43lr7zlhaXotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3JlZnJlc2hfYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfliLfmlrDotYTmupDmlbDmja7lupPkuK3nmoTotYTmupDnirbmgIEnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5yZWZyZXNoLWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyByZWZyZXNoZWQ6IHRydWUsIHVybCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfliLfmlrDotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X29wZW5fYXNzZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflnKjnvJbovpHlmajkuK3miZPlvIDotYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmxPclV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCDmiJYgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsT3JVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5vcGVuLWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxPclV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybE9yVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmxPclV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybE9yVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCB1cmxPclV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBvcGVuZWQ6IHRydWUsIHVybE9yVXVpZCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmiZPlvIDotYTmupDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X2dlbmVyYXRlX2F2YWlsYWJsZV91cmwnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnlJ/miJDlj6/nlKjnmoTotYTmupAgVVJM77yI6YG/5YWN6YeN5ZCN5Yay56qB77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+acn+acm+i1hOa6kCBVUkwnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIuZ2VuZXJhdGUtYXZhaWxhYmxlLXVybCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmwpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmwg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVXJsID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdnZW5lcmF0ZS1hdmFpbGFibGUtdXJsJywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0VXJsOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVVcmxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn55Sf5oiQ5Y+v55SoIFVSTCDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X3F1ZXJ5X2Fzc2V0X21ldGEnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LotYTmupAgbWV0YSDkv6Hmga8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmxPclV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCDmiJYgVVVJRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsT3JVdWlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5xdWVyeS1hc3NldC1tZXRhJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxPclV1aWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybE9yVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmxPclV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybE9yVXVpZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXRhID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgdXJsT3JVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybE9yVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGFcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i6LWE5rqQIG1ldGEg5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9xdWVyeV9taXNzaW5nX2Fzc2V0X2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LkuKLlpLHotYTmupDkv6Hmga8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmxPclBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCDmiJbot6/lvoQnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybE9yUGF0aCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIucXVlcnktbWlzc2luZy1hc3NldC1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxPclBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybE9yUGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmxPclBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3VybE9yUGF0aCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaXNzaW5nSW5mbyA9IGF3YWl0IHJlcXVlc3RlcignYXNzZXQtZGInLCAncXVlcnktbWlzc2luZy1hc3NldC1pbmZvJywgdXJsT3JQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybE9yUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pc3NpbmdJbmZvXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouS4ouWksei1hOa6kOS/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfY3JlYXRlX2Fzc2V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Yib5bu66LWE5rqQ5paH5Lu277yIYXNzZXQtZGIuY3JlYXRlLWFzc2V077yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldCcsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ+ebruagh+i1hOa6kCBVUkwnIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHsgZGVzY3JpcHRpb246ICfotYTmupDlhoXlrrnvvIjlrZfnrKbkuLLmiJYgbnVsbO+8iScgfSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudEVuY29kaW5nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsndXRmOCcsICdiYXNlNjQnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnY29udGVudCDnvJbnoIHvvIzpu5jorqQgdXRmOCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICfmmK/lkKbopobnm5blkIzlkI3otYTmupAnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlbmFtZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Yay56qB5pe25piv5ZCm6Ieq5Yqo6YeN5ZG95ZCNJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd1cmwnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLmNyZWF0ZS1hc3NldCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmwpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmwg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudEVuY29kaW5nID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb250ZW50RW5jb2RpbmcpIHx8ICd1dGY4JztcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudEVuY29kaW5nICE9PSAndXRmOCcgJiYgY29udGVudEVuY29kaW5nICE9PSAnYmFzZTY0Jykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29udGVudEVuY29kaW5nIOS7heaUr+aMgSB1dGY4L2Jhc2U2NCcsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBwYXJzZUFzc2V0Q29udGVudChhcmdzPy5jb250ZW50LCBjb250ZW50RW5jb2RpbmcpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzPy5jb250ZW50ICE9PSBudWxsICYmIGFyZ3M/LmNvbnRlbnQgIT09IHVuZGVmaW5lZCAmJiBjb250ZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdjb250ZW50IOW/hemhu+S4uuWtl+espuS4suaIliBudWxsJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Fzc2V0LWRiJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdjcmVhdGUtYXNzZXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlQXNzZXRPcGVyYXRpb25PcHRpb25zKGFyZ3MpXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudEVuY29kaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIm+W7uui1hOa6kOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfaW1wb3J0X2Fzc2V0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5LuO5pys5Zyw6Lev5b6E5a+85YWl6LWE5rqQ5Yiw55uu5qCHIFVSTCcsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXQnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5pys5Zyw5paH5Lu26Lev5b6EJyB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRVcmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn55uu5qCH6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICfmmK/lkKbopobnm5blkIzlkI3otYTmupAnIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlbmFtZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5Yay56qB5pe25piv5ZCm6Ieq5Yqo6YeN5ZG95ZCNJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzb3VyY2VQYXRoJywgJ3RhcmdldFVybCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYXNzZXQtZGIuaW1wb3J0LWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5zb3VyY2VQYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRVcmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2VQYXRoIHx8ICF0YXJnZXRVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3NvdXJjZVBhdGgvdGFyZ2V0VXJsIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3RlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICdhc3NldC1kYicsXG4gICAgICAgICAgICAgICAgICAgICAgICAnaW1wb3J0LWFzc2V0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRVcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUFzc2V0T3BlcmF0aW9uT3B0aW9ucyhhcmdzKVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1wb3J0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0VXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WvvOWFpei1hOa6kOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYXNzZXRfc2F2ZV9hc3NldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S/neWtmOi1hOa6kOWGheWuue+8iGFzc2V0LWRiLnNhdmUtYXNzZXTvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICfotYTmupDlhoXlrrknIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRFbmNvZGluZzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ3V0ZjgnLCAnYmFzZTY0J10sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ2NvbnRlbnQg57yW56CB77yM6buY6K6kIHV0ZjgnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3VybCcsICdjb250ZW50J11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5zYXZlLWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCF1cmwgfHwgdHlwZW9mIGFyZ3M/LmNvbnRlbnQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmwvY29udGVudCDlv4XloavkuJQgY29udGVudCDlv4XpobvkuLrlrZfnrKbkuLInLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50RW5jb2RpbmcgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmNvbnRlbnRFbmNvZGluZykgfHwgJ3V0ZjgnO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50RW5jb2RpbmcgIT09ICd1dGY4JyAmJiBjb250ZW50RW5jb2RpbmcgIT09ICdiYXNlNjQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdjb250ZW50RW5jb2Rpbmcg5LuF5pSv5oyBIHV0ZjgvYmFzZTY0JywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IHBhcnNlQXNzZXRDb250ZW50KGFyZ3MuY29udGVudCwgY29udGVudEVuY29kaW5nKTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnY29udGVudCDop6PmnpDlpLHotKUnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCB1cmwsIGNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgc2F2ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50RW5jb2RpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5L+d5a2Y6LWE5rqQ5YaF5a655aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhc3NldF9zYXZlX2Fzc2V0X21ldGEnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkv53lrZjotYTmupAgbWV0YSDlhoXlrrnvvIhhc3NldC1kYi5zYXZlLWFzc2V0LW1ldGHvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0JyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn6LWE5rqQIFVSTCcgfSxcbiAgICAgICAgICAgICAgICAgICAgbWV0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdtZXRhIOWGheWuue+8jOaUr+aMgeWvueixoeaIliBKU09OIOWtl+espuS4sidcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXJsJywgJ21ldGEnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2Fzc2V0LWRiLnNhdmUtYXNzZXQtbWV0YSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy51cmwpO1xuICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1cmwg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IG1ldGFDb250ZW50OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3M/Lm1ldGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGFDb250ZW50ID0gYXJncy5tZXRhO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXJncz8ubWV0YSAmJiB0eXBlb2YgYXJncy5tZXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWV0YUNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShhcmdzLm1ldGEsIG51bGwsIDIpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbWV0YSDlr7nosaHluo/liJfljJblpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvciksICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghbWV0YUNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ21ldGEg5b+F6aG75Li65a+56LGh5oiWIEpTT04g5a2X56ym5LiyJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCB1cmwsIG1ldGFDb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNhdmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+S/neWtmOi1hOa6kCBtZXRhIOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXTtcbn1cbiJdfQ==