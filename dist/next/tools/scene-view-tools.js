"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSceneViewTools = createSceneViewTools;
const common_1 = require("./common");
async function tryQuery(requester, method) {
    try {
        const value = await requester('scene', method);
        return { ok: true, value };
    }
    catch (error) {
        return { ok: false, error: (0, common_1.normalizeError)(error) };
    }
}
function createSceneViewTools(requester) {
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
                const state = {};
                const queryErrors = {};
                const mappings = [
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
                    }
                    else {
                        queryErrors[item.field] = result.error || 'unknown error';
                    }
                }
                return (0, common_1.ok)({
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
            run: async (args) => {
                if (typeof (args === null || args === void 0 ? void 0 : args.is2D) !== 'boolean') {
                    return (0, common_1.fail)('is2D 必填且必须为 boolean', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'change-is2D', args.is2D);
                    const current = await tryQuery(requester, 'query-is2D');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: args.is2D,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('切换 2D/3D 模式失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const toolName = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tool);
                if (!toolName) {
                    return (0, common_1.fail)('tool 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'change-gizmo-tool', toolName);
                    const current = await tryQuery(requester, 'query-gizmo-tool-name');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: toolName,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 Gizmo 工具失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const pivot = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.pivot);
                if (!pivot) {
                    return (0, common_1.fail)('pivot 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'change-gizmo-pivot', pivot);
                    const current = await tryQuery(requester, 'query-gizmo-pivot');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: pivot,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 Gizmo Pivot 失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const coordinate = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.coordinate);
                if (!coordinate) {
                    return (0, common_1.fail)('coordinate 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'change-gizmo-coordinate', coordinate);
                    const current = await tryQuery(requester, 'query-gizmo-coordinate');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: coordinate,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 Gizmo 坐标系失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                if (typeof (args === null || args === void 0 ? void 0 : args.visible) !== 'boolean') {
                    return (0, common_1.fail)('visible 必填且必须为 boolean', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'set-grid-visible', args.visible);
                    const current = await tryQuery(requester, 'query-is-grid-visible');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: args.visible,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置网格显隐失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                if (typeof (args === null || args === void 0 ? void 0 : args.enabled) !== 'boolean') {
                    return (0, common_1.fail)('enabled 必填且必须为 boolean', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'set-icon-gizmo-3d', args.enabled);
                    const current = await tryQuery(requester, 'query-is-icon-gizmo-3d');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: args.enabled,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 icon gizmo 显隐失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const size = Number(args === null || args === void 0 ? void 0 : args.size);
                if (!Number.isFinite(size) || size <= 0) {
                    return (0, common_1.fail)('size 必填且必须大于 0', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'set-icon-gizmo-size', size);
                    const current = await tryQuery(requester, 'query-icon-gizmo-size');
                    return (0, common_1.ok)({
                        changed: true,
                        requested: size,
                        current: current.ok ? current.value : null,
                        verifyError: current.ok ? null : current.error
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('设置 icon gizmo 大小失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ aligned: true, mode: 'align-with-view' });
                }
                catch (error) {
                    return (0, common_1.fail)('执行 align-with-view 失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ aligned: true, mode: 'align-view-with-node' });
                }
                catch (error) {
                    return (0, common_1.fail)('执行 align-view-with-node 失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtdmlldy10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL3NjZW5lLXZpZXctdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxvREF3VEM7QUFuVUQscUNBQXNFO0FBRXRFLEtBQUssVUFBVSxRQUFRLENBQUMsU0FBMEIsRUFBRSxNQUFjO0lBQzlELElBQUksQ0FBQztRQUNELE1BQU0sS0FBSyxHQUFHLE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMvQyxPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztRQUNsQixPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBQSx1QkFBYyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7SUFDdkQsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFnQixvQkFBb0IsQ0FBQyxTQUEwQjtJQUMzRCxPQUFPO1FBQ0g7WUFDSSxJQUFJLEVBQUUsd0JBQXdCO1lBQzlCLFdBQVcsRUFBRSx5Q0FBeUM7WUFDdEQsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLE9BQU87WUFDakIsV0FBVyxFQUFFO2dCQUNULElBQUksRUFBRSxRQUFRO2dCQUNkLFVBQVUsRUFBRSxFQUFFO2FBQ2pCO1lBQ0Qsb0JBQW9CLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztZQUMxQyxHQUFHLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQ1osTUFBTSxLQUFLLEdBQXdCLEVBQUUsQ0FBQztnQkFDdEMsTUFBTSxXQUFXLEdBQTJCLEVBQUUsQ0FBQztnQkFFL0MsTUFBTSxRQUFRLEdBQTZDO29CQUN2RCxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRTtvQkFDdkMsRUFBRSxLQUFLLEVBQUUs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T0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyw0QkFBNEIsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDckUsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWRpdG9yUmVxdWVzdGVyLCBOZXh0VG9vbERlZmluaXRpb24gfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHsgZmFpbCwgbm9ybWFsaXplRXJyb3IsIG9rLCB0b05vbkVtcHR5U3RyaW5nIH0gZnJvbSAnLi9jb21tb24nO1xuXG5hc3luYyBmdW5jdGlvbiB0cnlRdWVyeShyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlciwgbWV0aG9kOiBzdHJpbmcpOiBQcm9taXNlPHsgb2s6IGJvb2xlYW47IHZhbHVlPzogYW55OyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgbWV0aG9kKTtcbiAgICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIHZhbHVlIH07XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBub3JtYWxpemVFcnJvcihlcnJvcikgfTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTY2VuZVZpZXdUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19xdWVyeV9zdGF0ZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBTY2VuZSBWaWV3IOeKtuaAge+8iDJEL+e9keagvC9HaXptby9JY29uR2l6bW/vvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pczJEJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZTogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5RXJyb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtYXBwaW5nczogQXJyYXk8eyBmaWVsZDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZyB9PiA9IFtcbiAgICAgICAgICAgICAgICAgICAgeyBmaWVsZDogJ2lzMkQnLCBtZXRob2Q6ICdxdWVyeS1pczJEJyB9LFxuICAgICAgICAgICAgICAgICAgICB7IGZpZWxkOiAnZ2l6bW9Ub29sJywgbWV0aG9kOiAncXVlcnktZ2l6bW8tdG9vbC1uYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICB7IGZpZWxkOiAnZ2l6bW9QaXZvdCcsIG1ldGhvZDogJ3F1ZXJ5LWdpem1vLXBpdm90JyB9LFxuICAgICAgICAgICAgICAgICAgICB7IGZpZWxkOiAnZ2l6bW9Db29yZGluYXRlJywgbWV0aG9kOiAncXVlcnktZ2l6bW8tY29vcmRpbmF0ZScgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBmaWVsZDogJ2lzR3JpZFZpc2libGUnLCBtZXRob2Q6ICdxdWVyeS1pcy1ncmlkLXZpc2libGUnIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgZmllbGQ6ICdpc0ljb25HaXptbzNEJywgbWV0aG9kOiAncXVlcnktaXMtaWNvbi1naXptby0zZCcgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBmaWVsZDogJ2ljb25HaXptb1NpemUnLCBtZXRob2Q6ICdxdWVyeS1pY29uLWdpem1vLXNpemUnIH1cbiAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIG1hcHBpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyeVF1ZXJ5KHJlcXVlc3RlciwgaXRlbS5tZXRob2QpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0Lm9rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZVtpdGVtLmZpZWxkXSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5RXJyb3JzW2l0ZW0uZmllbGRdID0gcmVzdWx0LmVycm9yIHx8ICd1bmtub3duIGVycm9yJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLFxuICAgICAgICAgICAgICAgICAgICBxdWVyeUVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgaGFzUGFydGlhbEZhaWx1cmVzOiBPYmplY3Qua2V5cyhxdWVyeUVycm9ycykubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfbW9kZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WIh+aNoiBTY2VuZSBWaWV3IDJELzNEIOaooeW8jycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGlzMkQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAndHJ1ZT0yRCDmqKHlvI/vvIxmYWxzZT0zRCDmqKHlvI8nXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2lzMkQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWlzMkQnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncz8uaXMyRCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdpczJEIOW/heWhq+S4lOW/hemhu+S4uiBib29sZWFuJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjaGFuZ2UtaXMyRCcsIGFyZ3MuaXMyRCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCB0cnlRdWVyeShyZXF1ZXN0ZXIsICdxdWVyeS1pczJEJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkOiBhcmdzLmlzMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiBjdXJyZW50Lm9rID8gY3VycmVudC52YWx1ZSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZnlFcnJvcjogY3VycmVudC5vayA/IG51bGwgOiBjdXJyZW50LmVycm9yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WIh+aNoiAyRC8zRCDmqKHlvI/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X2dpem1vX3Rvb2wnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICforr7nva4gR2l6bW8g5bel5YW377yI5aaCIG1vdmUvcm90YXRlL3NjYWxlL3JlY3TvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB0b29sOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0dpem1vIOW3peWFt+WQjScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndG9vbCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktZ2l6bW8tdG9vbC1uYW1lJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29sTmFtZSA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udG9vbCk7XG4gICAgICAgICAgICAgICAgaWYgKCF0b29sTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndG9vbCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2NoYW5nZS1naXptby10b29sJywgdG9vbE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgdHJ5UXVlcnkocmVxdWVzdGVyLCAncXVlcnktZ2l6bW8tdG9vbC1uYW1lJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkOiB0b29sTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQ6IGN1cnJlbnQub2sgPyBjdXJyZW50LnZhbHVlIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcmlmeUVycm9yOiBjdXJyZW50Lm9rID8gbnVsbCA6IGN1cnJlbnQuZXJyb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6K6+572uIEdpem1vIOW3peWFt+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfZ2l6bW9fcGl2b3QnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICforr7nva4gR2l6bW8gUGl2b3TvvIjlpoIgY2VudGVyL3Bpdm9077yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcGl2b3Q6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUGl2b3Qg5ZCN56ewJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydwaXZvdCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktZ2l6bW8tcGl2b3QnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpdm90ID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5waXZvdCk7XG4gICAgICAgICAgICAgICAgaWYgKCFwaXZvdCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncGl2b3Qg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tcGl2b3QnLCBwaXZvdCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCB0cnlRdWVyeShyZXF1ZXN0ZXIsICdxdWVyeS1naXptby1waXZvdCcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZDogcGl2b3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiBjdXJyZW50Lm9rID8gY3VycmVudC52YWx1ZSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZnlFcnJvcjogY3VycmVudC5vayA/IG51bGwgOiBjdXJyZW50LmVycm9yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iuvue9riBHaXptbyBQaXZvdCDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X2dpem1vX2Nvb3JkaW5hdGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICforr7nva4gR2l6bW8g5Z2Q5qCH57O777yI5aaCIGxvY2FsL2dsb2JhbO+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvb3JkaW5hdGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAn5Z2Q5qCH57O75ZCN56ewJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydjb29yZGluYXRlJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1naXptby1jb29yZGluYXRlJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb29yZGluYXRlID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5jb29yZGluYXRlKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNvb3JkaW5hdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2Nvb3JkaW5hdGUg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tY29vcmRpbmF0ZScsIGNvb3JkaW5hdGUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgdHJ5UXVlcnkocmVxdWVzdGVyLCAncXVlcnktZ2l6bW8tY29vcmRpbmF0ZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZDogY29vcmRpbmF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQ6IGN1cnJlbnQub2sgPyBjdXJyZW50LnZhbHVlIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcmlmeUVycm9yOiBjdXJyZW50Lm9rID8gbnVsbCA6IGN1cnJlbnQuZXJyb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6K6+572uIEdpem1vIOWdkOagh+ezu+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19zZXRfZ3JpZF92aXNpYmxlJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572uIFNjZW5lIFZpZXcg572R5qC85pi+6ZqQJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAn5piv5ZCm5pi+56S6572R5qC8JyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWyd2aXNpYmxlJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1ncmlkLXZpc2libGUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncz8udmlzaWJsZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd2aXNpYmxlIOW/heWhq+S4lOW/hemhu+S4uiBib29sZWFuJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtZ3JpZC12aXNpYmxlJywgYXJncy52aXNpYmxlKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGF3YWl0IHRyeVF1ZXJ5KHJlcXVlc3RlciwgJ3F1ZXJ5LWlzLWdyaWQtdmlzaWJsZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZDogYXJncy52aXNpYmxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudDogY3VycmVudC5vayA/IGN1cnJlbnQudmFsdWUgOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyaWZ5RXJyb3I6IGN1cnJlbnQub2sgPyBudWxsIDogY3VycmVudC5lcnJvclxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCforr7nva7nvZHmoLzmmL7pmpDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfc2V0X2ljb25fZ2l6bW9fdmlzaWJsZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+iuvue9riBTY2VuZSBWaWV3IDNEIOWbvuaghyBHaXptbyDmmL7pmpAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICfmmK/lkKblkK/nlKggaWNvbiBnaXptbyAzRCcgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnZW5hYmxlZCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktaXMtaWNvbi1naXptby0zZCddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzPy5lbmFibGVkICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2VuYWJsZWQg5b+F5aGr5LiU5b+F6aG75Li6IGJvb2xlYW4nLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3NldC1pY29uLWdpem1vLTNkJywgYXJncy5lbmFibGVkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGF3YWl0IHRyeVF1ZXJ5KHJlcXVlc3RlciwgJ3F1ZXJ5LWlzLWljb24tZ2l6bW8tM2QnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWQ6IGFyZ3MuZW5hYmxlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQ6IGN1cnJlbnQub2sgPyBjdXJyZW50LnZhbHVlIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcmlmeUVycm9yOiBjdXJyZW50Lm9rID8gbnVsbCA6IGN1cnJlbnQuZXJyb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6K6+572uIGljb24gZ2l6bW8g5pi+6ZqQ5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3NldF9pY29uX2dpem1vX3NpemUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICforr7nva4gU2NlbmUgVmlldyAzRCDlm77moIcgR2l6bW8g5aSn5bCPJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgc2l6ZTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdpY29uIGdpem1vIOWkp+Wwj++8jOmcgOWkp+S6jiAwJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzaXplJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pY29uLWdpem1vLXNpemUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpemUgPSBOdW1iZXIoYXJncz8uc2l6ZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoc2l6ZSkgfHwgc2l6ZSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdzaXplIOW/heWhq+S4lOW/hemhu+Wkp+S6jiAwJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzZXQtaWNvbi1naXptby1zaXplJywgc2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCB0cnlRdWVyeShyZXF1ZXN0ZXIsICdxdWVyeS1pY29uLWdpem1vLXNpemUnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWQ6IHNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiBjdXJyZW50Lm9rID8gY3VycmVudC52YWx1ZSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZnlFcnJvcjogY3VycmVudC5vayA/IG51bGwgOiBjdXJyZW50LmVycm9yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+iuvue9riBpY29uIGdpem1vIOWkp+Wwj+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19hbGlnbl93aXRoX3ZpZXcnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIblvZPliY3pgInkuK3oioLngrnkuI7lvZPliY3op4blm77lr7npvZAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1yZWFkeSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdhbGlnbi13aXRoLXZpZXcnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgYWxpZ25lZDogdHJ1ZSwgbW9kZTogJ2FsaWduLXdpdGgtdmlldycgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5omn6KGMIGFsaWduLXdpdGgtdmlldyDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3ZpZXdfYWxpZ25fdmlld193aXRoX25vZGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIblvZPliY3op4blm77kuI7pgInkuK3oioLngrnlr7npvZAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1yZWFkeSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdhbGlnbi12aWV3LXdpdGgtbm9kZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBhbGlnbmVkOiB0cnVlLCBtb2RlOiAnYWxpZ24tdmlldy13aXRoLW5vZGUnIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJp+ihjCBhbGlnbi12aWV3LXdpdGgtbm9kZSDlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=