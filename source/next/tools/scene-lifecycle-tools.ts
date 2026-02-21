import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString, toStringList } from './common';

function buildSceneOpenCandidates(sceneUrl: string): string[] {
    const normalized = sceneUrl.trim();
    const candidates: string[] = [];

    if (normalized.startsWith('import://db/')) {
        const fromImport = normalized.slice('import://db/'.length).replace(/^\/+/, '');
        candidates.push(normalized);
        if (fromImport) {
            candidates.push(`db://${fromImport}`);
            candidates.push(fromImport);
        }
    }

    if (normalized.startsWith('db://')) {
        candidates.push(normalized);
        const withoutDb = normalized.slice('db://'.length).replace(/^\/+/, '');
        if (withoutDb) {
            candidates.push(withoutDb);
        }
    } else {
        candidates.push(normalized);
    }

    if (normalized.startsWith('assets/')) {
        candidates.push(`db://${normalized}`);
    }

    return Array.from(
        new Set(
            candidates.filter((item) => item.trim() !== '')
        )
    );
}

export function createSceneLifecycleTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        {
            name: 'scene_open_scene',
            description: '打开指定场景资源',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    sceneUrl: {
                        type: 'string',
                        description: '场景资源 URL，例如 db://assets/scenes/boot.scene'
                    }
                },
                required: ['sceneUrl']
            },
            requiredCapabilities: ['asset-db.open-asset'],
            run: async (args: any) => {
                const sceneUrl = toNonEmptyString(args?.sceneUrl);
                if (!sceneUrl) {
                    return fail('sceneUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const candidates = buildSceneOpenCandidates(sceneUrl);
                const attemptErrors: string[] = [];

                for (const candidate of candidates) {
                    try {
                        await requester('asset-db', 'open-asset', candidate);
                        return ok({
                            opened: true,
                            sceneUrl,
                            resolvedSceneUrl: candidate,
                            attempts: candidates.length,
                            openMethod: 'asset-db.open-asset'
                        });
                    } catch (error: any) {
                        attemptErrors.push(`[${candidate}] ${normalizeError(error)}`);
                    }
                }

                return fail('打开场景失败', attemptErrors.join(' | '));
            }
        },
        {
            name: 'scene_save_scene',
            description: '保存当前场景',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    force: {
                        type: 'boolean',
                        description: '可选，传给 scene.save-scene 的 force 参数'
                    }
                }
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async (args: any) => {
                try {
                    const hasForce = typeof args?.force === 'boolean';
                    const result = hasForce
                        ? await requester('scene', 'save-scene', args.force)
                        : await requester('scene', 'save-scene');
                    return ok({ saved: true, sceneUrl: result || null, force: hasForce ? args.force : undefined });
                } catch (error: any) {
                    return fail('保存场景失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_save_as_scene',
            description: '另存当前场景（由编辑器交互选择目标）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.save-as-scene'],
            run: async () => {
                try {
                    const sceneUrl = await requester('scene', 'save-as-scene');
                    return ok({
                        saved: true,
                        sceneUrl: sceneUrl || null
                    });
                } catch (error: any) {
                    return fail('场景另存失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_close_scene',
            description: '关闭当前场景',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async () => {
                try {
                    const result = await requester('scene', 'close-scene');
                    return ok({ closed: result === true });
                } catch (error: any) {
                    return fail('关闭场景失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_query_status',
            description: '查询场景状态（ready/dirty，可选 bounds）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    includeBounds: {
                        type: 'boolean',
                        description: '是否附带场景边界信息，默认 true'
                    }
                }
            },
            requiredCapabilities: ['scene.query-is-ready', 'scene.query-dirty'],
            run: async (args: any) => {
                const includeBounds = args?.includeBounds !== false;
                try {
                    const isReady = await requester('scene', 'query-is-ready');
                    const isDirty = await requester('scene', 'query-dirty');
                    let bounds: any = null;
                    let boundsError: string | null = null;

                    if (includeBounds) {
                        try {
                            bounds = await requester('scene', 'query-scene-bounds');
                        } catch (error: any) {
                            boundsError = normalizeError(error);
                        }
                    }

                    return ok({
                        isReady: isReady === true,
                        isDirty: isDirty === true,
                        bounds,
                        boundsError
                    });
                } catch (error: any) {
                    return fail('查询场景状态失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_query_bounds',
            description: '查询场景边界信息',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-scene-bounds'],
            run: async () => {
                try {
                    const bounds = await requester('scene', 'query-scene-bounds');
                    return ok({ bounds });
                } catch (error: any) {
                    return fail('查询场景边界失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_focus_camera',
            description: '将场景相机聚焦到指定节点',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuids: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: '目标节点 UUID 或 UUID 列表'
                    }
                },
                required: ['uuids']
            },
            requiredCapabilities: ['scene.focus-camera'],
            run: async (args: any) => {
                const uuids = toStringList(args?.uuids);
                if (uuids.length === 0) {
                    return fail('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'focus-camera', uuids);
                    return ok({ focused: true, uuids });
                } catch (error: any) {
                    return fail('聚焦相机失败', normalizeError(error));
                }
            }
        }
    ];
}
