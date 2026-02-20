import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString } from './common';

async function tryQuery(requester: EditorRequester, method: string): Promise<{ ok: boolean; value?: any; error?: string }> {
    try {
        const value = await requester('scene', method);
        return { ok: true, value };
    } catch (error: any) {
        return { ok: false, error: normalizeError(error) };
    }
}

export function createSceneViewTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        {
            name: 'scene_view_query_state',
            description: '查询 Scene View 状态（2D/网格/Gizmo/IconGizmo）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-is2D'],
            run: async () => {
                const state: Record<string, any> = {};
                const queryErrors: Record<string, string> = {};

                const mappings: Array<{ field: string; method: string }> = [
                    { field: 'is2D', method: 'query-is2D' },
                    { field: 'gizmoTool', method: 'query-gizmo-tool-name' },
                    { field: 'gizmoPivot', method: 'query-gizmo-pivot' },
                    { field: 'gizmoCoordinate', method: 'query-gizmo-coordinate' },
                    { field: 'isGridVisible', method: 'query-is-grid-visible' },
                    { field: 'isIconGizmo3D', method: 'query-is-icon-gizmo-3d' },
                    { field: 'iconGizmoSize', method: 'query-icon-gizmo-size' }
                ];

                for (const item of mappings) {
                    const result = await tryQuery(requester, item.method);
                    if (result.ok) {
                        state[item.field] = result.value;
                    } else {
                        queryErrors[item.field] = result.error || 'unknown error';
                    }
                }

                return ok({
                    state,
                    queryErrors,
                    hasPartialFailures: Object.keys(queryErrors).length > 0
                });
            }
        },
        {
            name: 'scene_view_set_mode',
            description: '切换 Scene View 2D/3D 模式',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    is2D: {
                        type: 'boolean',
                        description: 'true=2D 模式，false=3D 模式'
                    }
                },
                required: ['is2D']
            },
            requiredCapabilities: ['scene.query-is2D'],
            run: async (args: any) => {
                if (typeof args?.is2D !== 'boolean') {
                    return fail('is2D 必填且必须为 boolean', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'change-is2D', args.is2D);
                    const current = await tryQuery(requester, 'query-is2D');
                    return ok({
                        changed: true,
                        requested: args.is2D,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('切换 2D/3D 模式失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_set_gizmo_tool',
            description: '设置 Gizmo 工具（如 move/rotate/scale/rect）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    tool: { type: 'string', description: 'Gizmo 工具名' }
                },
                required: ['tool']
            },
            requiredCapabilities: ['scene.query-gizmo-tool-name'],
            run: async (args: any) => {
                const toolName = toNonEmptyString(args?.tool);
                if (!toolName) {
                    return fail('tool 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'change-gizmo-tool', toolName);
                    const current = await tryQuery(requester, 'query-gizmo-tool-name');
                    return ok({
                        changed: true,
                        requested: toolName,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('设置 Gizmo 工具失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_set_gizmo_pivot',
            description: '设置 Gizmo Pivot（如 center/pivot）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    pivot: { type: 'string', description: 'Pivot 名称' }
                },
                required: ['pivot']
            },
            requiredCapabilities: ['scene.query-gizmo-pivot'],
            run: async (args: any) => {
                const pivot = toNonEmptyString(args?.pivot);
                if (!pivot) {
                    return fail('pivot 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'change-gizmo-pivot', pivot);
                    const current = await tryQuery(requester, 'query-gizmo-pivot');
                    return ok({
                        changed: true,
                        requested: pivot,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('设置 Gizmo Pivot 失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_set_gizmo_coordinate',
            description: '设置 Gizmo 坐标系（如 local/global）',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    coordinate: { type: 'string', description: '坐标系名称' }
                },
                required: ['coordinate']
            },
            requiredCapabilities: ['scene.query-gizmo-coordinate'],
            run: async (args: any) => {
                const coordinate = toNonEmptyString(args?.coordinate);
                if (!coordinate) {
                    return fail('coordinate 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'change-gizmo-coordinate', coordinate);
                    const current = await tryQuery(requester, 'query-gizmo-coordinate');
                    return ok({
                        changed: true,
                        requested: coordinate,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('设置 Gizmo 坐标系失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_set_grid_visible',
            description: '设置 Scene View 网格显隐',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    visible: { type: 'boolean', description: '是否显示网格' }
                },
                required: ['visible']
            },
            requiredCapabilities: ['scene.query-is-grid-visible'],
            run: async (args: any) => {
                if (typeof args?.visible !== 'boolean') {
                    return fail('visible 必填且必须为 boolean', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'set-grid-visible', args.visible);
                    const current = await tryQuery(requester, 'query-is-grid-visible');
                    return ok({
                        changed: true,
                        requested: args.visible,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('设置网格显隐失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_set_icon_gizmo_visible',
            description: '设置 Scene View 3D 图标 Gizmo 显隐',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    enabled: { type: 'boolean', description: '是否启用 icon gizmo 3D' }
                },
                required: ['enabled']
            },
            requiredCapabilities: ['scene.query-is-icon-gizmo-3d'],
            run: async (args: any) => {
                if (typeof args?.enabled !== 'boolean') {
                    return fail('enabled 必填且必须为 boolean', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'set-icon-gizmo-3d', args.enabled);
                    const current = await tryQuery(requester, 'query-is-icon-gizmo-3d');
                    return ok({
                        changed: true,
                        requested: args.enabled,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('设置 icon gizmo 显隐失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_set_icon_gizmo_size',
            description: '设置 Scene View 3D 图标 Gizmo 大小',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {
                    size: { type: 'number', description: 'icon gizmo 大小，需大于 0' }
                },
                required: ['size']
            },
            requiredCapabilities: ['scene.query-icon-gizmo-size'],
            run: async (args: any) => {
                const size = Number(args?.size);
                if (!Number.isFinite(size) || size <= 0) {
                    return fail('size 必填且必须大于 0', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    await requester('scene', 'set-icon-gizmo-size', size);
                    const current = await tryQuery(requester, 'query-icon-gizmo-size');
                    return ok({
                        changed: true,
                        requested: size,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                } catch (error: any) {
                    return fail('设置 icon gizmo 大小失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_align_with_view',
            description: '将当前选中节点与当前视图对齐',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async () => {
                try {
                    await requester('scene', 'align-with-view');
                    return ok({ aligned: true, mode: 'align-with-view' });
                } catch (error: any) {
                    return fail('执行 align-with-view 失败', normalizeError(error));
                }
            }
        },
        {
            name: 'scene_view_align_view_with_node',
            description: '将当前视图与选中节点对齐',
            layer: 'official',
            category: 'scene',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-is-ready'],
            run: async () => {
                try {
                    await requester('scene', 'align-view-with-node');
                    return ok({ aligned: true, mode: 'align-view-with-node' });
                } catch (error: any) {
                    return fail('执行 align-view-with-node 失败', normalizeError(error));
                }
            }
        }
    ];
}
