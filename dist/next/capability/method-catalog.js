"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CAPABILITY_CHECKS = void 0;
exports.DEFAULT_CAPABILITY_CHECKS = [
    {
        key: 'scene.query-node-tree',
        channel: 'scene',
        method: 'query-node-tree',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询场景节点树'
    },
    {
        key: 'scene.query-node',
        channel: 'scene',
        method: 'query-node',
        args: [''],
        layer: 'official',
        readonly: true,
        description: '查询节点详情'
    },
    {
        key: 'scene.query-components',
        channel: 'scene',
        method: 'query-components',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询可添加组件清单'
    },
    {
        key: 'scene.create-node',
        channel: 'scene',
        method: 'create-node',
        args: [{ name: '__mcp_probe_node__' }],
        layer: 'official',
        readonly: false,
        description: '创建节点'
    },
    {
        key: 'scene.duplicate-node',
        channel: 'scene',
        method: 'duplicate-node',
        args: ['__missing_uuid__'],
        layer: 'official',
        readonly: false,
        description: '复制节点'
    },
    {
        key: 'scene.remove-node',
        channel: 'scene',
        method: 'remove-node',
        args: [{ uuid: '__missing_uuid__' }],
        layer: 'official',
        readonly: false,
        description: '删除节点'
    },
    {
        key: 'scene.set-parent',
        channel: 'scene',
        method: 'set-parent',
        args: [{ parent: '__missing_uuid__', uuids: ['__missing_uuid__'], keepWorldTransform: false }],
        layer: 'official',
        readonly: false,
        description: '设置父节点'
    },
    {
        key: 'scene.create-component',
        channel: 'scene',
        method: 'create-component',
        args: [{ uuid: '__missing_uuid__', component: 'cc.Sprite' }],
        layer: 'official',
        readonly: false,
        description: '添加组件'
    },
    {
        key: 'scene.remove-component',
        channel: 'scene',
        method: 'remove-component',
        args: [{ uuid: '__missing_component_uuid__' }],
        layer: 'official',
        readonly: false,
        description: '移除组件'
    },
    {
        key: 'scene.set-property',
        channel: 'scene',
        method: 'set-property',
        args: [{ uuid: '__missing_uuid__', path: 'name', dump: { value: '__probe__' } }],
        layer: 'official',
        readonly: false,
        description: '设置属性'
    },
    {
        key: 'scene.open-scene',
        channel: 'scene',
        method: 'open-scene',
        args: ['db://assets/__mcp_probe_missing__.scene'],
        layer: 'official',
        readonly: false,
        description: '打开场景'
    },
    {
        key: 'scene.query-is-ready',
        channel: 'scene',
        method: 'query-is-ready',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询场景是否就绪'
    },
    {
        key: 'scene.query-dirty',
        channel: 'scene',
        method: 'query-dirty',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询场景是否有未保存修改'
    },
    {
        key: 'scene.query-scene-bounds',
        channel: 'scene',
        method: 'query-scene-bounds',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询场景边界'
    },
    {
        key: 'scene.focus-camera',
        channel: 'scene',
        method: 'focus-camera',
        args: [['__missing_uuid__']],
        layer: 'official',
        readonly: false,
        description: '聚焦场景相机'
    },
    {
        key: 'asset-db.query-ready',
        channel: 'asset-db',
        method: 'query-ready',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 asset-db 准备状态'
    },
    {
        key: 'asset-db.query-assets',
        channel: 'asset-db',
        method: 'query-assets',
        args: [{ pattern: 'db://assets/**/*' }],
        layer: 'official',
        readonly: true,
        description: '查询资源列表'
    },
    {
        key: 'asset-db.query-asset-info',
        channel: 'asset-db',
        method: 'query-asset-info',
        args: ['db://assets'],
        layer: 'official',
        readonly: true,
        description: '查询资源详情'
    },
    {
        key: 'asset-db.query-asset-users',
        channel: 'asset-db',
        method: 'query-asset-users',
        args: ['db://assets', 'asset'],
        layer: 'official',
        readonly: true,
        description: '查询资源被引用方'
    },
    {
        key: 'asset-db.query-asset-dependencies',
        channel: 'asset-db',
        method: 'query-asset-dependencies',
        args: ['db://assets', 'asset'],
        layer: 'official',
        readonly: true,
        description: '查询资源依赖'
    },
    {
        key: 'asset-db.copy-asset',
        channel: 'asset-db',
        method: 'copy-asset',
        args: ['db://assets/not-exist.asset', 'db://assets/not-exist-copy.asset'],
        layer: 'official',
        readonly: false,
        description: '复制资源'
    },
    {
        key: 'asset-db.move-asset',
        channel: 'asset-db',
        method: 'move-asset',
        args: ['db://assets/not-exist.asset', 'db://assets/not-exist-move.asset'],
        layer: 'official',
        readonly: false,
        description: '移动资源'
    },
    {
        key: 'asset-db.delete-asset',
        channel: 'asset-db',
        method: 'delete-asset',
        args: ['db://assets/not-exists.asset'],
        layer: 'official',
        readonly: false,
        description: '删除资源'
    },
    {
        key: 'asset-db.query-path',
        channel: 'asset-db',
        method: 'query-path',
        args: ['__missing_uuid__'],
        layer: 'official',
        readonly: true,
        description: '通过 UUID/URL 查询文件路径'
    },
    {
        key: 'asset-db.query-url',
        channel: 'asset-db',
        method: 'query-url',
        args: ['__missing_uuid__'],
        layer: 'official',
        readonly: true,
        description: '通过 UUID/路径查询 URL'
    },
    {
        key: 'asset-db.query-uuid',
        channel: 'asset-db',
        method: 'query-uuid',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: true,
        description: '通过 URL/路径查询 UUID'
    },
    {
        key: 'asset-db.reimport-asset',
        channel: 'asset-db',
        method: 'reimport-asset',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: false,
        description: '重导入资源'
    },
    {
        key: 'asset-db.refresh-asset',
        channel: 'asset-db',
        method: 'refresh-asset',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: false,
        description: '刷新资源'
    },
    {
        key: 'asset-db.open-asset',
        channel: 'asset-db',
        method: 'open-asset',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: false,
        description: '打开资源'
    },
    {
        key: 'project.query-config',
        channel: 'project',
        method: 'query-config',
        args: ['project'],
        layer: 'official',
        readonly: true,
        description: '查询项目配置'
    },
    {
        key: 'server.query-ip-list',
        channel: 'server',
        method: 'query-ip-list',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 IP 列表'
    },
    {
        key: 'server.query-port',
        channel: 'server',
        method: 'query-port',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询端口'
    },
    {
        key: 'preferences.query-config',
        channel: 'preferences',
        method: 'query-config',
        args: ['general'],
        layer: 'official',
        readonly: true,
        description: '查询编辑器偏好设置'
    },
    {
        key: 'engine.query-info',
        channel: 'engine',
        method: 'query-info',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询引擎运行信息'
    },
    {
        key: 'engine.query-engine-info',
        channel: 'engine',
        method: 'query-engine-info',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询引擎详细信息'
    },
    {
        key: 'builder.query-worker-ready',
        channel: 'builder',
        method: 'query-worker-ready',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询构建 worker 就绪状态'
    },
    {
        key: 'scene.query-hierarchy',
        channel: 'scene',
        method: 'query-hierarchy',
        args: [],
        layer: 'extended',
        readonly: true,
        description: '查询层级（历史扩展方法）'
    },
    {
        key: 'scene.query-performance',
        channel: 'scene',
        method: 'query-performance',
        args: [],
        layer: 'extended',
        readonly: true,
        description: '查询性能（历史扩展方法）'
    },
    {
        key: 'scene.apply-prefab',
        channel: 'scene',
        method: 'apply-prefab',
        args: [{ uuid: '' }],
        layer: 'experimental',
        readonly: false,
        description: '应用 prefab（实验方法）'
    },
    {
        key: 'asset-db.query-asset-data',
        channel: 'asset-db',
        method: 'query-asset-data',
        args: ['db://assets/a.prefab'],
        layer: 'experimental',
        readonly: true,
        description: '读取资产序列化内容（实验方法）'
    }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kLWNhdGFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvbmV4dC9jYXBhYmlsaXR5L21ldGhvZC1jYXRhbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVhLFFBQUEseUJBQXlCLEdBQXNCO0lBQ3hEO1FBQ0ksR0FBRyxFQUFFLHVCQUF1QjtRQUM1QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsaUJBQWlCO1FBQ3pCLElBQUksRUFBRSxFQUFFO1FBQ1IsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLElBQUk7UUFDZCxXQUFXLEVBQUUsU0FBUztLQUN6QjtJQUNEO1FBQ0ksR0FBRyxFQUFFLGtCQUFrQjtRQUN2QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsWUFBWTtRQUNwQixJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDVixLQUFLLEVBQUUsVUFBVTtRQUNqQixRQUFRLEVBQUUsSUFBSTtRQUNkLFdBQVcsRUFBRSxRQUFRO0tBQ3hCO0lBQ0Q7UUFDSSxHQUFHLEVBQUUsd0JBQXdCO1FBQzdCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSxrQkFBa0I7UUFDMUIsSUFBSSxFQUFFLEVBQUU7UUFDUixLQUFLLEVBQUUsVUFBVTtRQUNqQixRQUFRLEVBQUUsSUFBSTtRQUNkLFdBQVcsRUFBRSxXQUFXO0tBQzNCO0lBQ0Q7UUFDSSxHQUFHLEVBQUUsbUJBQW1CO1FBQ3hCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSxhQUFhO1FBQ3JCLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFFLENBQUM7UUFDdEMsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLEtBQUs7UUFDZixXQUFXLEVBQUUsTUFBTTtLQUN0QjtJQUNEO1FBQ0ksR0FBRyxFQUFFLHNCQUFzQjtRQUMzQixPQUFPLEVBQUUsT0FBTztRQUNoQixN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b250ZW50IjpbImltcG9ydCB7IENhcGFiaWxpdHlDaGVjayB9IGZyb20gJy4uL21vZGVscyc7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NBUEFCSUxJVFlfQ0hFQ0tTOiBDYXBhYmlsaXR5Q2hlY2tbXSA9IFtcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LW5vZGUtdHJlZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LW5vZGUtdHJlZScsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5Zy65pmv6IqC54K55qCRJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktbm9kZScsXG4gICAgICAgIGFyZ3M6IFsnJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LoioLngrnor6bmg4UnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudHMnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1jb21wb25lbnRzJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Llj6/mt7vliqDnu4Tku7bmuIXljZUnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnY3JlYXRlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyBuYW1lOiAnX19tY3BfcHJvYmVfbm9kZV9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfliJvlu7roioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmR1cGxpY2F0ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnZHVwbGljYXRlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLboioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnJlbW92ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncmVtb3ZlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX3V1aWRfXycgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Yig6Zmk6IqC54K5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5zZXQtcGFyZW50JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc2V0LXBhcmVudCcsXG4gICAgICAgIGFyZ3M6IFt7IHBhcmVudDogJ19fbWlzc2luZ191dWlkX18nLCB1dWlkczogWydfX21pc3NpbmdfdXVpZF9fJ10sIGtlZXBXb3JsZFRyYW5zZm9ybTogZmFsc2UgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u54i26IqC54K5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5jcmVhdGUtY29tcG9uZW50JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnY3JlYXRlLWNvbXBvbmVudCcsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJywgY29tcG9uZW50OiAnY2MuU3ByaXRlJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmt7vliqDnu4Tku7YnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnJlbW92ZS1jb21wb25lbnQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdyZW1vdmUtY29tcG9uZW50JyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJ19fbWlzc2luZ19jb21wb25lbnRfdXVpZF9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfnp7vpmaTnu4Tku7YnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNldC1wcm9wZXJ0eScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3NldC1wcm9wZXJ0eScsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJywgcGF0aDogJ25hbWUnLCBkdW1wOiB7IHZhbHVlOiAnX19wcm9iZV9fJyB9IH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+iuvue9ruWxnuaApydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUub3Blbi1zY2VuZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ29wZW4tc2NlbmUnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL19fbWNwX3Byb2JlX21pc3NpbmdfXy5zY2VuZSddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOWcuuaZrydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktaXMtcmVhZHknLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1pcy1yZWFkeScsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5Zy65pmv5piv5ZCm5bCx57uqJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1kaXJ0eScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWRpcnR5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlnLrmma/mmK/lkKbmnInmnKrkv53lrZjkv67mlLknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LXNjZW5lLWJvdW5kcycsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXNjZW5lLWJvdW5kcycsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5Zy65pmv6L6555WMJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5mb2N1cy1jYW1lcmEnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdmb2N1cy1jYW1lcmEnLFxuICAgICAgICBhcmdzOiBbWydfX21pc3NpbmdfdXVpZF9fJ11dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+iBmueEpuWcuuaZr+ebuOacuidcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktcmVhZHknLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1yZWFkeScsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIGFzc2V0LWRiIOWHhuWkh+eKtuaAgSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktYXNzZXRzJyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktYXNzZXRzJyxcbiAgICAgICAgYXJnczogW3sgcGF0dGVybjogJ2RiOi8vYXNzZXRzLyoqLyonIH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ5YiX6KGoJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldC1pbmZvJyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktYXNzZXQtaW5mbycsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoui1hOa6kOivpuaDhSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktYXNzZXQtdXNlcnMnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC11c2VycycsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMnLCAnYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoui1hOa6kOiiq+W8leeUqOaWuSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cycsICdhc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ5L6d6LWWJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5jb3B5LWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAnY29weS1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0JywgJ2RiOi8vYXNzZXRzL25vdC1leGlzdC1jb3B5LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5aSN5Yi26LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5tb3ZlLWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAnbW92ZS1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0JywgJ2RiOi8vYXNzZXRzL25vdC1leGlzdC1tb3ZlLmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn56e75Yqo6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5kZWxldGUtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdkZWxldGUtYXNzZXQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdHMuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfliKDpmaTotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LXBhdGgnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1wYXRoJyxcbiAgICAgICAgYXJnczogWydfX21pc3NpbmdfdXVpZF9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfpgJrov4cgVVVJRC9VUkwg5p+l6K+i5paH5Lu26Lev5b6EJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS11cmwnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS11cmwnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+mAmui/hyBVVUlEL+i3r+W+hOafpeivoiBVUkwnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LXV1aWQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS11dWlkJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+mAmui/hyBVUkwv6Lev5b6E5p+l6K+iIFVVSUQnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnJlaW1wb3J0LWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAncmVpbXBvcnQtYXNzZXQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdC5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjeWvvOWFpei1hOa6kCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucmVmcmVzaC1hc3NldCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3JlZnJlc2gtYXNzZXQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdC5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WIt+aWsOi1hOa6kCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIub3Blbi1hc3NldCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ29wZW4tYXNzZXQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdC5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOi1hOa6kCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJvamVjdC5xdWVyeS1jb25maWcnLFxuICAgICAgICBjaGFubmVsOiAncHJvamVjdCcsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWNvbmZpZycsXG4gICAgICAgIGFyZ3M6IFsncHJvamVjdCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6aG555uu6YWN572uJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzZXJ2ZXIucXVlcnktaXAtbGlzdCcsXG4gICAgICAgIGNoYW5uZWw6ICdzZXJ2ZXInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1pcC1saXN0JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgSVAg5YiX6KGoJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzZXJ2ZXIucXVlcnktcG9ydCcsXG4gICAgICAgIGNoYW5uZWw6ICdzZXJ2ZXInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1wb3J0JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lnq6/lj6MnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3ByZWZlcmVuY2VzLnF1ZXJ5LWNvbmZpZycsXG4gICAgICAgIGNoYW5uZWw6ICdwcmVmZXJlbmNlcycsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWNvbmZpZycsXG4gICAgICAgIGFyZ3M6IFsnZ2VuZXJhbCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5Zmo5YGP5aW96K6+572uJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdlbmdpbmUucXVlcnktaW5mbycsXG4gICAgICAgIGNoYW5uZWw6ICdlbmdpbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1pbmZvJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlvJXmk47ov5DooYzkv6Hmga8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2VuZ2luZS5xdWVyeS1lbmdpbmUtaW5mbycsXG4gICAgICAgIGNoYW5uZWw6ICdlbmdpbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1lbmdpbmUtaW5mbycsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5byV5pOO6K+m57uG5L+h5oGvJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdidWlsZGVyLnF1ZXJ5LXdvcmtlci1yZWFkeScsXG4gICAgICAgIGNoYW5uZWw6ICdidWlsZGVyJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktd29ya2VyLXJlYWR5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LmnoTlu7ogd29ya2VyIOWwsee7queKtuaAgSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktaGllcmFyY2h5JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktaGllcmFyY2h5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlsYLnuqfvvIjljoblj7LmianlsZXmlrnms5XvvIknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktcGVyZm9ybWFuY2UnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouaAp+iDve+8iOWOhuWPsuaJqeWxleaWueazle+8iSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUuYXBwbHktcHJlZmFiJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnYXBwbHktcHJlZmFiJyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJycgfV0sXG4gICAgICAgIGxheWVyOiAnZXhwZXJpbWVudGFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+W6lOeUqCBwcmVmYWLvvIjlrp7pqozmlrnms5XvvIknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWRhdGEnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1kYXRhJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9hLnByZWZhYiddLFxuICAgICAgICBsYXllcjogJ2V4cGVyaW1lbnRhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ivu+WPlui1hOS6p+W6j+WIl+WMluWGheWuue+8iOWunumqjOaWueazle+8iSdcbiAgICB9XG5dO1xuIl19