import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString, toStringList } from './common';

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
            requiredCapabilities: ['scene.open-scene'],
            run: async (args: any) => {
                const sceneUrl = toNonEmptyString(args?.sceneUrl);
                if (!sceneUrl) {
                    return fail('sceneUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'open-scene', sceneUrl);
                    return ok({ opened: true, sceneUrl });
                } catch (error: any) {
                    return fail('打开场景失败', normalizeError(error));
                }
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
