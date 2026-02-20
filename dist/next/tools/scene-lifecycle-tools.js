"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSceneLifecycleTools = createSceneLifecycleTools;
const common_1 = require("./common");
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
            requiredCapabilities: ['scene.open-scene'],
            run: async (args) => {
                const sceneUrl = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.sceneUrl);
                if (!sceneUrl) {
                    return (0, common_1.fail)('sceneUrl 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    await requester('scene', 'open-scene', sceneUrl);
                    return (0, common_1.ok)({ opened: true, sceneUrl });
                }
                catch (error) {
                    return (0, common_1.fail)('打开场景失败', (0, common_1.normalizeError)(error));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtbGlmZWN5Y2xlLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL25leHQvdG9vbHMvc2NlbmUtbGlmZWN5Y2xlLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0EsOERBNktDO0FBL0tELHFDQUFvRjtBQUVwRixTQUFnQix5QkFBeUIsQ0FBQyxTQUEwQjtJQUNoRSxPQUFPO1FBQ0g7WUFDSSxJQUFJLEVBQUUsa0JBQWtCO1lBQ3hCLFdBQVcsRUFBRSxVQUFVO1lBQ3ZCLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLFdBQVcsRUFBRTtnQkFDVCxJQUFJLEVBQUUsUUFBUTtnQkFDZCxVQUFVLEVBQUU7b0JBQ1IsUUFBUSxFQUFFO3dCQUNOLElBQUksRUFBRSxRQUFRO3dCQUNkLFdBQVcsRUFBRSwyQ0FBMkM7cUJBQzNEO2lCQUNKO2dCQUNELFFBQVEsRUFBRSxDQUFDLFVBQVUsQ0FBQzthQUN6QjtZQUNELG9CQUFvQixFQUFFLENBQUMsa0JBQWtCLENBQUM7WUFDMUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFTLEVBQUUsRUFBRTtnQkFDckIsTUFBTSxRQUFRLEdBQUcsSUFBQSx5QkFBZ0IsRUFBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ2xELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDWixPQUFPLElBQUEsYUFBSSxFQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztnQkFFRCxJQUFJLENBQUM7b0JBQ0QsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDakQsT0FBTyxJQUFBLFdBQUUsRUFBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDMUMsQ0FBQztnQkFB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RSxDQUFDO29CQUNyQixPQUFPLElBQUEsYUFBSSxFQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztnQkFDN0QsQ0FBQztnQkFFRCxJQUFJLENBQUM7b0JBQ0QsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDaEQsT0FBTyxJQUFBLFdBQUUsRUFBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDeEMsQ0FBQztnQkFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO29CQUNsQixPQUFPLElBQUEsYUFBSSxFQUFDLFFBQVEsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDakQsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWRpdG9yUmVxdWVzdGVyLCBOZXh0VG9vbERlZmluaXRpb24gfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHsgZmFpbCwgbm9ybWFsaXplRXJyb3IsIG9rLCB0b05vbkVtcHR5U3RyaW5nLCB0b1N0cmluZ0xpc3QgfSBmcm9tICcuL2NvbW1vbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTY2VuZUxpZmVjeWNsZVRvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9vcGVuX3NjZW5lJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5omT5byA5oyH5a6a5Zy65pmv6LWE5rqQJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmVVcmw6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflnLrmma/otYTmupAgVVJM77yM5L6L5aaCIGRiOi8vYXNzZXRzL3NjZW5lcy9ib290LnNjZW5lJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzY2VuZVVybCddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUub3Blbi1zY2VuZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmVVcmwgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnNjZW5lVXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoIXNjZW5lVXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdzY2VuZVVybCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ29wZW4tc2NlbmUnLCBzY2VuZVVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IG9wZW5lZDogdHJ1ZSwgc2NlbmVVcmwgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5omT5byA5Zy65pmv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9zYXZlX3NjZW5lJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5L+d5a2Y5b2T5YmN5Zy65pmvJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgZm9yY2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5Lyg57uZIHNjZW5lLnNhdmUtc2NlbmUg55qEIGZvcmNlIOWPguaVsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1yZWFkeSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzRm9yY2UgPSB0eXBlb2YgYXJncz8uZm9yY2UgPT09ICdib29sZWFuJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gaGFzRm9yY2VcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzYXZlLXNjZW5lJywgYXJncy5mb3JjZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdzYXZlLXNjZW5lJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHNhdmVkOiB0cnVlLCBzY2VuZVVybDogcmVzdWx0IHx8IG51bGwsIGZvcmNlOiBoYXNGb3JjZSA/IGFyZ3MuZm9yY2UgOiB1bmRlZmluZWQgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5L+d5a2Y5Zy65pmv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9jbG9zZV9zY2VuZScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WFs+mXreW9k+WJjeWcuuaZrycsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnc2NlbmUnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLnF1ZXJ5LWlzLXJlYWR5J10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ2Nsb3NlLXNjZW5lJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IGNsb3NlZDogcmVzdWx0ID09PSB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+WFs+mXreWcuuaZr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfcXVlcnlfc3RhdHVzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5Zy65pmv54q25oCB77yIcmVhZHkvZGlydHnvvIzlj6/pgIkgYm91bmRz77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUJvdW5kczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbpmYTluKblnLrmma/ovrnnlYzkv6Hmga/vvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1pcy1yZWFkeScsICdzY2VuZS5xdWVyeS1kaXJ0eSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZUJvdW5kcyA9IGFyZ3M/LmluY2x1ZGVCb3VuZHMgIT09IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhZHkgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWlzLXJlYWR5Jyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzRGlydHkgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LWRpcnR5Jyk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBib3VuZHM6IGFueSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBib3VuZHNFcnJvcjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVCb3VuZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm91bmRzID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1zY2VuZS1ib3VuZHMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3VuZHNFcnJvciA9IG5vcm1hbGl6ZUVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc1JlYWR5OiBpc1JlYWR5ID09PSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNEaXJ0eTogaXNEaXJ0eSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvdW5kcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvdW5kc0Vycm9yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouWcuuaZr+eKtuaAgeWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnc2NlbmVfcXVlcnlfYm91bmRzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5Zy65pmv6L6555WM5L+h5oGvJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdzY2VuZScsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktc2NlbmUtYm91bmRzJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBhd2FpdCByZXF1ZXN0ZXIoJ3NjZW5lJywgJ3F1ZXJ5LXNjZW5lLWJvdW5kcycpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBib3VuZHMgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i5Zy65pmv6L6555WM5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdzY2VuZV9mb2N1c19jYW1lcmEnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICflsIblnLrmma/nm7jmnLrogZrnhKbliLDmjIflrproioLngrknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ3NjZW5lJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ebruagh+iKgueCuSBVVUlEIOaIliBVVUlEIOWIl+ihqCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndXVpZHMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3NjZW5lLmZvY3VzLWNhbWVyYSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXVpZHMgPSB0b1N0cmluZ0xpc3QoYXJncz8udXVpZHMpO1xuICAgICAgICAgICAgICAgIGlmICh1dWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3V1aWRzIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAnZm9jdXMtY2FtZXJhJywgdXVpZHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soeyBmb2N1c2VkOiB0cnVlLCB1dWlkcyB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfogZrnhKbnm7jmnLrlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=