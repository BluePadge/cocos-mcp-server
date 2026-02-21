"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSceneLifecycleTools = createSceneLifecycleTools;
const common_1 = require("./common");
function buildSceneOpenCandidates(sceneUrl) {
    const normalized = sceneUrl.trim();
    const candidates = [];
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
    }
    else {
        candidates.push(normalized);
    }
    if (normalized.startsWith('assets/')) {
        candidates.push(`db://${normalized}`);
    }
    return Array.from(new Set(candidates.filter((item) => item.trim() !== '')));
}
function createSceneLifecycleTools(requester) {
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
            run: async (args) => {
                const sceneUrl = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.sceneUrl);
                if (!sceneUrl) {
                    return (0, common_1.fail)('sceneUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const candidates = buildSceneOpenCandidates(sceneUrl);
                const attemptErrors = [];
                for (const candidate of candidates) {
                    try {
                        await requester('asset-db', 'open-asset', candidate);
                        return (0, common_1.ok)({
                            opened: true,
                            sceneUrl,
                            resolvedSceneUrl: candidate,
                            attempts: candidates.length,
                            openMethod: 'asset-db.open-asset'
                        });
                    }
                    catch (error) {
                        attemptErrors.push(`[${candidate}] ${(0, common_1.normalizeError)(error)}`);
                    }
                }
                return (0, common_1.fail)('打开场景失败', attemptErrors.join(' | '));
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
            run: async (args) => {
                try {
                    const hasForce = typeof (args === null || args === void 0 ? void 0 : args.force) === 'boolean';
                    const result = hasForce
                        ? await requester('scene', 'save-scene', args.force)
                        : await requester('scene', 'save-scene');
                    return (0, common_1.ok)({ saved: true, sceneUrl: result || null, force: hasForce ? args.force : undefined });
                }
                catch (error) {
                    return (0, common_1.fail)('保存场景失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({
                        saved: true,
                        sceneUrl: sceneUrl || null
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('场景另存失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ closed: result === true });
                }
                catch (error) {
                    return (0, common_1.fail)('关闭场景失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const includeBounds = (args === null || args === void 0 ? void 0 : args.includeBounds) !== false;
                try {
                    const isReady = await requester('scene', 'query-is-ready');
                    const isDirty = await requester('scene', 'query-dirty');
                    let bounds = null;
                    let boundsError = null;
                    if (includeBounds) {
                        try {
                            bounds = await requester('scene', 'query-scene-bounds');
                        }
                        catch (error) {
                            boundsError = (0, common_1.normalizeError)(error);
                        }
                    }
                    return (0, common_1.ok)({
                        isReady: isReady === true,
                        isDirty: isDirty === true,
                        bounds,
                        boundsError
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询场景状态失败', (0, common_1.normalizeError)(error));
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
                    return (0, common_1.ok)({ bounds });
                }
                catch (error) {
                    return (0, common_1.fail)('查询场景边界失败', (0, common_1.normalizeError)(error));
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
            run: async (args) => {
                const uuids = (0, common_1.toStringList)(args === null || args === void 0 ? void 0 : args.uuids);
                if (uuids.length === 0) {
                    return (0, common_1.fail)('uuids 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'focus-camera', uuids);
                    return (0, common_1.ok)({ focused: true, uuids });
                }
                catch (error) {
                    return (0, common_1.fail)('聚焦相机失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtbGlmZWN5Y2xlLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvc2NlbmUtbGlmZWN5Y2xlLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBcUNBLDhEQWdOQztBQXBQRCxxQ0FBb0Y7QUFFcEYsU0FBUyx3QkFBd0IsQ0FBQyxRQUFnQjtJQUM5QyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDbkMsTUFBTSxVQUFVLEdBQWEsRUFBRSxDQUFDO0lBRWhDLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1FBQ3hDLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0UsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM1QixJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2IsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLFVBQVUsRUFBRSxDQUFDLENBQUM7WUFDdEMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoQyxDQUFDO0lBQ0wsQ0FBQztJQUVELElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ2pDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDNUIsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN2RSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ1osVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMvQixDQUFDO0lBQ0wsQ0FBQztTQUFN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QUksdUJBQUosSUFBSSxDQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN4QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3JCLE9BQU8sSUFBQSxhQUFJLEVBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO2dCQUVELElBQUksQ0FBQztvQkFDRCxNQUFNLFNBQVMsQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUNoRCxPQUFPLElBQUEsV0FBRSxFQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO2dCQUN4QyxDQUFDO2dCQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7b0JBQ2xCLE9BQU8sSUFBQSxhQUFJLEVBQUMsUUFBUSxFQUFFLElBQUEsdUJBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNqRCxDQUFDO1lBQ0wsQ0FBQztTQUNKO0tBQ0osQ0FBQztBQUNOLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBmYWlsLCBub3JtYWxpemVFcnJvciwgb2ssIHRvTm9uRW1wdHlTdHJpbmcsIHRvU3RyaW5nTGlzdCB9IGZyb20gJy4vY29tbW9uJztcblxuZnVuY3Rpb24gYnVpbGRTY2VuZU9wZW5DYW5kaWRhdGVzKHNjZW5lVXJsOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IHNjZW5lVXJsLnRyaW0oKTtcbiAgICBjb25zdCBjYW5kaWRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgaWYgKG5vcm1hbGl6ZWQuc3RhcnRzV2l0aCgnaW1wb3J0Oi8vZGIvJykpIHtcbiAgICAgICAgY29uc3QgZnJvbUltcG9ydCA9IG5vcm1hbGl6ZWQuc2xpY2UoJ2ltcG9ydDovL2RiLycubGVuZ3RoKS5yZXBsYWNlKC9eXFwvKy8sICcnKTtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKG5vcm1hbGl6ZWQpO1xuICAgICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICAgICAgY2FuZGlkYXRlcy5wdXNoKGBkYjovLyR7ZnJvbUltcG9ydH1gKTtcbiAgICAgICAgICAgIGNhbmRpZGF0ZXMucHVzaChmcm9tSW1wb3J0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChub3JtYWxpemVkLnN0YXJ0c1dpdGgoJ2RiOi8vJykpIHtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKG5vcm1hbGl6ZWQpO1xuICAgICAgICBjb25zdCB3aXRob3V0RGIgPSBub3JtYWxpemVkLnNsaWNlKCdkYjovLycubGVuZ3RoKS5yZXBsYWNlKC9eXFwvKy8sICcnKTtcbiAgICAgICAgaWYgKHdpdGhvdXREYikge1xuICAgICAgICAgICAgY2FuZGlkYXRlcy5wdXNoKHdpdGhvdXREYik7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2gobm9ybWFsaXplZCk7XG4gICAgfVxuXG4gICAgaWYgKG5vcm1hbGl6ZWQuc3RhcnRzV2l0aCgnYXNzZXRzLycpKSB7XG4gICAgICAgIGNhbmRpZGF0ZXMucHVzaChgZGI6Ly8ke25vcm1hbGl6ZWR9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEFycmF5LmZyb20oXG4gICAgICAgIG5ldyBTZXQoXG4gICAgICAgICAgICBjYW5kaWRhdGVzLmZpbHRlcigoaXRlbSkgPT4gaXRlbS50cmltKCkgIT09ICcnKVxuICAgICAgICApXG4gICAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNjZW5lTGlmZWN5Y2xlVG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX29wZW5fc2NlbmUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIDmjIflrprlnLrmma/otYTmupAnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBzY2VuZVVybDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WcuuaZr+i1hOa6kCBVUkzvvIzkvovlpoIgZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3NjZW5lVXJsJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydhc3NldC1kYi5vcGVuLWFzc2V0J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZVVybCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uc2NlbmVVcmwpO1xuICAgICAgICAgICAgICAgIGlmICghc2NlbmVVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3NjZW5lVXJsIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBidWlsZFNjZW5lT3BlbkNhbmRpZGF0ZXMoc2NlbmVVcmwpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0dGVtcHRFcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBjYW5kaWRhdGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCBjYW5kaWRhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcGVuZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmVVcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWRTY2VuZVVybDogY2FuZGlkYXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF0dGVtcHRzOiBjYW5kaWRhdGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcGVuTWV0aG9kOiAnYXNzZXQtZGIub3Blbi1hc3NldCdcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRlbXB0RXJyb3JzLnB1c2goYFske2NhbmRpZGF0ZX1dICR7bm9ybWFsaXplRXJyb3IoZXJyb3IpfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aJk+W8gOWcuuaZr+Wksei0pScsIGF0dGVtcHRFcnJvcnMuam9pbignIHwgJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfc2F2ZV9zY2VuZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S/neWtmOW9k+WJjeWcuuaZrycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGZvcmNlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOS8oOe7mSBzY2VuZS5zYXZlLXNjZW5lIOeahCBmb3JjZSDlj4LmlbAnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktaXMtcmVhZHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc0ZvcmNlID0gdHlwZW9mIGFyZ3M/LmZvcmNlID09PSAnYm9vbGVhbic7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGhhc0ZvcmNlXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnc2F2ZS1zY2VuZScsIGFyZ3MuZm9yY2UpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnc2F2ZS1zY2VuZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBzYXZlZDogdHJ1ZSwgc2NlbmVVcmw6IHJlc3VsdCB8fCBudWxsLCBmb3JjZTogaGFzRm9yY2UgPyBhcmdzLmZvcmNlIDogdW5kZWZpbmVkIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+S/neWtmOWcuuaZr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfc2F2ZV9hc19zY2VuZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPpuWtmOW9k+WJjeWcuuaZr++8iOeUsee8lui+keWZqOS6pOS6kumAieaLqeebruagh++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnNhdmUtYXMtc2NlbmUnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lVXJsID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzYXZlLWFzLXNjZW5lJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzYXZlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lVXJsOiBzY2VuZVVybCB8fCBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WcuuaZr+WPpuWtmOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfY2xvc2Vfc2NlbmUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflhbPpl63lvZPliY3lnLrmma8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1yZWFkeSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdjbG9zZS1zY2VuZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBjbG9zZWQ6IHJlc3VsdCA9PT0gdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflhbPpl63lnLrmma/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3F1ZXJ5X3N0YXR1cycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWcuuaZr+eKtuaAge+8iHJlYWR5L2RpcnR577yM5Y+v6YCJIGJvdW5kc++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGVCb3VuZHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm6ZmE5bim5Zy65pmv6L6555WM5L+h5oGv77yM6buY6K6kIHRydWUnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktaXMtcmVhZHknLCAnc2NlbmUucXVlcnktZGlydHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVCb3VuZHMgPSBhcmdzPy5pbmNsdWRlQm91bmRzICE9PSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWR5ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1pcy1yZWFkeScpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0RpcnR5ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1kaXJ0eScpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYm91bmRzOiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYm91bmRzRXJyb3I6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlQm91bmRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvdW5kcyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktc2NlbmUtYm91bmRzJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm91bmRzRXJyb3IgPSBub3JtYWxpemVFcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNSZWFkeTogaXNSZWFkeSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRGlydHk6IGlzRGlydHkgPT09IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBib3VuZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBib3VuZHNFcnJvclxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LlnLrmma/nirbmgIHlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX3F1ZXJ5X2JvdW5kcycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWcuuaZr+i+ueeVjOS/oeaBrycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LXNjZW5lLWJvdW5kcyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1zY2VuZS1ib3VuZHMnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgYm91bmRzIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouWcuuaZr+i+ueeVjOWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfZm9jdXNfY2FtZXJhJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5bCG5Zy65pmv55u45py66IGa54Sm5Yiw5oyH5a6a6IqC54K5JyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnm67moIfoioLngrkgVVVJRCDmiJYgVVVJRCDliJfooagnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3V1aWRzJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5mb2N1cy1jYW1lcmEnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gdG9TdHJpbmdMaXN0KGFyZ3M/LnV1aWRzKTtcbiAgICAgICAgICAgICAgICBpZiAodXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd1dWlkcyDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2ZvY3VzLWNhbWVyYScsIHV1aWRzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgZm9jdXNlZDogdHJ1ZSwgdXVpZHMgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6IGa54Sm55u45py65aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBdO1xufVxuIl19