import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString } from './common';

type AssetRelationType = 'asset' | 'script' | 'all';

function normalizeRelationType(value: any): AssetRelationType {
    if (value === 'script' || value === 'all') {
        return value;
    }
    return 'asset';
}

function buildAssetOperationOptions(overwrite: boolean): { overwrite: boolean; rename: boolean } {
    return {
        overwrite,
        rename: !overwrite
    };
}

function parseAssetOperationOptions(args: any): { overwrite: boolean; rename: boolean } {
    if (typeof args?.overwrite === 'boolean') {
        if (typeof args?.rename === 'boolean') {
            return {
                overwrite: args.overwrite,
                rename: args.rename
            };
        }
        return buildAssetOperationOptions(args.overwrite);
    }

    if (typeof args?.rename === 'boolean') {
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

function parseAssetContent(content: any, encoding: any): string | Buffer | null {
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

async function enrichAssetInfos(
    requester: EditorRequester,
    uuids: string[],
    includeInfo: boolean
): Promise<Array<{ uuid: string; info: any | null }>> {
    if (!includeInfo || uuids.length === 0) {
        return [];
    }

    const result: Array<{ uuid: string; info: any | null }> = [];
    for (const uuid of uuids) {
        try {
            const info = await requester('asset-db', 'query-asset-info', uuid);
            result.push({ uuid, info: info || null });
        } catch {
            result.push({ uuid, info: null });
        }
    }
    return result;
}

export function createAssetDependencyTools(requester: EditorRequester): NextToolDefinition[] {
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
            run: async (args: any) => {
                const urlOrUuid = toNonEmptyString(args?.urlOrUuid);
                if (!urlOrUuid) {
                    return fail('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const assetInfo = await requester('asset-db', 'query-asset-info', urlOrUuid);
                    return ok({ urlOrUuid, assetInfo });
                } catch (error: any) {
                    return fail('查询资源详情失败', normalizeError(error));
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
            run: async (args: any) => {
                const pattern = toNonEmptyString(args?.pattern) || 'db://assets/**/*';
                try {
                    const assets = await requester('asset-db', 'query-assets', { pattern });
                    return ok({
                        pattern,
                        assets,
                        count: Array.isArray(assets) ? assets.length : 0
                    });
                } catch (error: any) {
                    return fail('查询资源列表失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrUuid = toNonEmptyString(args?.urlOrUuid);
                if (!urlOrUuid) {
                    return fail('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const relationType = normalizeRelationType(args?.relationType);
                const includeAssetInfo = args?.includeAssetInfo === true;
                try {
                    const dependencies = await requester('asset-db', 'query-asset-dependencies', urlOrUuid, relationType);
                    const dependencyUuids = Array.isArray(dependencies) ? dependencies : [];
                    const dependencyInfos = await enrichAssetInfos(requester, dependencyUuids, includeAssetInfo);
                    return ok({
                        urlOrUuid,
                        relationType,
                        dependencies: dependencyUuids,
                        count: dependencyUuids.length,
                        dependencyInfos
                    });
                } catch (error: any) {
                    return fail('查询资源依赖失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrUuid = toNonEmptyString(args?.urlOrUuid);
                if (!urlOrUuid) {
                    return fail('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const relationType = normalizeRelationType(args?.relationType);
                const includeAssetInfo = args?.includeAssetInfo === true;
                try {
                    const users = await requester('asset-db', 'query-asset-users', urlOrUuid, relationType);
                    const userUuids = Array.isArray(users) ? users : [];
                    const userInfos = await enrichAssetInfos(requester, userUuids, includeAssetInfo);
                    return ok({
                        urlOrUuid,
                        relationType,
                        users: userUuids,
                        count: userUuids.length,
                        userInfos
                    });
                } catch (error: any) {
                    return fail('查询资源引用方失败', normalizeError(error));
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
            run: async (args: any) => {
                const source = toNonEmptyString(args?.source);
                const target = toNonEmptyString(args?.target);
                if (!source || !target) {
                    return fail('source/target 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester('asset-db', 'copy-asset', source, target, buildAssetOperationOptions(args?.overwrite === true));
                    return ok({ source, target, result });
                } catch (error: any) {
                    return fail('复制资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const source = toNonEmptyString(args?.source);
                const target = toNonEmptyString(args?.target);
                if (!source || !target) {
                    return fail('source/target 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester('asset-db', 'move-asset', source, target, buildAssetOperationOptions(args?.overwrite === true));
                    return ok({ moved: true, source, target, result });
                } catch (error: any) {
                    return fail('移动资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester('asset-db', 'delete-asset', url);
                    return ok({ deleted: true, url, result });
                } catch (error: any) {
                    return fail('删除资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrUuid = toNonEmptyString(args?.urlOrUuid);
                if (!urlOrUuid) {
                    return fail('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const path = await requester('asset-db', 'query-path', urlOrUuid);
                    return ok({ urlOrUuid, path: path || null });
                } catch (error: any) {
                    return fail('查询资源路径失败', normalizeError(error));
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
            run: async (args: any) => {
                const uuidOrPath = toNonEmptyString(args?.uuidOrPath);
                if (!uuidOrPath) {
                    return fail('uuidOrPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const url = await requester('asset-db', 'query-url', uuidOrPath);
                    return ok({ uuidOrPath, url: url || null });
                } catch (error: any) {
                    return fail('查询资源 URL 失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrPath = toNonEmptyString(args?.urlOrPath);
                if (!urlOrPath) {
                    return fail('urlOrPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const uuid = await requester('asset-db', 'query-uuid', urlOrPath);
                    return ok({ urlOrPath, uuid: uuid || null });
                } catch (error: any) {
                    return fail('查询资源 UUID 失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('asset-db', 'reimport-asset', url);
                    return ok({ reimported: true, url });
                } catch (error: any) {
                    return fail('重导入资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('asset-db', 'refresh-asset', url);
                    return ok({ refreshed: true, url });
                } catch (error: any) {
                    return fail('刷新资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrUuid = toNonEmptyString(args?.urlOrUuid);
                if (!urlOrUuid) {
                    return fail('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('asset-db', 'open-asset', urlOrUuid);
                    return ok({ opened: true, urlOrUuid });
                } catch (error: any) {
                    return fail('打开资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const availableUrl = await requester('asset-db', 'generate-available-url', url);
                    return ok({
                        inputUrl: url,
                        availableUrl
                    });
                } catch (error: any) {
                    return fail('生成可用 URL 失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrUuid = toNonEmptyString(args?.urlOrUuid);
                if (!urlOrUuid) {
                    return fail('urlOrUuid 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const meta = await requester('asset-db', 'query-asset-meta', urlOrUuid);
                    return ok({
                        urlOrUuid,
                        meta
                    });
                } catch (error: any) {
                    return fail('查询资源 meta 失败', normalizeError(error));
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
            run: async (args: any) => {
                const urlOrPath = toNonEmptyString(args?.urlOrPath);
                if (!urlOrPath) {
                    return fail('urlOrPath 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const missingInfo = await requester('asset-db', 'query-missing-asset-info', urlOrPath);
                    return ok({
                        urlOrPath,
                        missingInfo
                    });
                } catch (error: any) {
                    return fail('查询丢失资源信息失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const contentEncoding = toNonEmptyString(args?.contentEncoding) || 'utf8';
                if (contentEncoding !== 'utf8' && contentEncoding !== 'base64') {
                    return fail('contentEncoding 仅支持 utf8/base64', undefined, 'E_INVALID_ARGUMENT');
                }

                const content = parseAssetContent(args?.content, contentEncoding);
                if (args?.content !== null && args?.content !== undefined && content === null) {
                    return fail('content 必须为字符串或 null', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester(
                        'asset-db',
                        'create-asset',
                        url,
                        content,
                        parseAssetOperationOptions(args)
                    );
                    return ok({
                        created: true,
                        url,
                        contentEncoding,
                        result
                    });
                } catch (error: any) {
                    return fail('创建资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const sourcePath = toNonEmptyString(args?.sourcePath);
                const targetUrl = toNonEmptyString(args?.targetUrl);
                if (!sourcePath || !targetUrl) {
                    return fail('sourcePath/targetUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester(
                        'asset-db',
                        'import-asset',
                        sourcePath,
                        targetUrl,
                        parseAssetOperationOptions(args)
                    );
                    return ok({
                        imported: true,
                        sourcePath,
                        targetUrl,
                        result
                    });
                } catch (error: any) {
                    return fail('导入资源失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url || typeof args?.content !== 'string') {
                    return fail('url/content 必填且 content 必须为字符串', undefined, 'E_INVALID_ARGUMENT');
                }

                const contentEncoding = toNonEmptyString(args?.contentEncoding) || 'utf8';
                if (contentEncoding !== 'utf8' && contentEncoding !== 'base64') {
                    return fail('contentEncoding 仅支持 utf8/base64', undefined, 'E_INVALID_ARGUMENT');
                }

                const content = parseAssetContent(args.content, contentEncoding);
                if (content === null) {
                    return fail('content 解析失败', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester('asset-db', 'save-asset', url, content);
                    return ok({
                        saved: true,
                        url,
                        contentEncoding,
                        result
                    });
                } catch (error: any) {
                    return fail('保存资源内容失败', normalizeError(error));
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
            run: async (args: any) => {
                const url = toNonEmptyString(args?.url);
                if (!url) {
                    return fail('url 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                let metaContent: string | null = null;
                if (typeof args?.meta === 'string') {
                    metaContent = args.meta;
                } else if (args?.meta && typeof args.meta === 'object') {
                    try {
                        metaContent = JSON.stringify(args.meta, null, 2);
                    } catch (error: any) {
                        return fail('meta 对象序列化失败', normalizeError(error), 'E_INVALID_ARGUMENT');
                    }
                }

                if (!metaContent) {
                    return fail('meta 必须为对象或 JSON 字符串', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const result = await requester('asset-db', 'save-asset-meta', url, metaContent);
                    return ok({
                        saved: true,
                        url,
                        result
                    });
                } catch (error: any) {
                    return fail('保存资源 meta 失败', normalizeError(error));
                }
            }
        }
    ];
}
