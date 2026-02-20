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
        key: 'scene.query-nodes-by-asset-uuid',
        channel: 'scene',
        method: 'query-nodes-by-asset-uuid',
        args: ['__missing_asset_uuid__'],
        layer: 'official',
        readonly: true,
        description: '查询引用指定资源的节点 UUID 列表'
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
        key: 'scene.query-gizmo-tool-name',
        channel: 'scene',
        method: 'query-gizmo-tool-name',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 Gizmo 工具'
    },
    {
        key: 'scene.query-gizmo-pivot',
        channel: 'scene',
        method: 'query-gizmo-pivot',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 Gizmo Pivot'
    },
    {
        key: 'scene.query-gizmo-coordinate',
        channel: 'scene',
        method: 'query-gizmo-coordinate',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 Gizmo 坐标系'
    },
    {
        key: 'scene.query-is2D',
        channel: 'scene',
        method: 'query-is2D',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 Scene View 2D 模式'
    },
    {
        key: 'scene.query-is-grid-visible',
        channel: 'scene',
        method: 'query-is-grid-visible',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询网格显示状态'
    },
    {
        key: 'scene.query-is-icon-gizmo-3d',
        channel: 'scene',
        method: 'query-is-icon-gizmo-3d',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 Icon Gizmo 3D 状态'
    },
    {
        key: 'scene.query-icon-gizmo-size',
        channel: 'scene',
        method: 'query-icon-gizmo-size',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 Icon Gizmo 大小'
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
        key: 'scene.reset-node',
        channel: 'scene',
        method: 'reset-node',
        args: [{ uuid: '__missing_uuid__' }],
        layer: 'official',
        readonly: false,
        description: '重置节点'
    },
    {
        key: 'scene.reset-component',
        channel: 'scene',
        method: 'reset-component',
        args: [{ uuid: '__missing_component_uuid__' }],
        layer: 'official',
        readonly: false,
        description: '重置组件'
    },
    {
        key: 'scene.restore-prefab',
        channel: 'scene',
        method: 'restore-prefab',
        args: [{ uuid: '__missing_uuid__' }],
        layer: 'official',
        readonly: false,
        description: '还原 Prefab'
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
        key: 'scene.execute-scene-script',
        channel: 'scene',
        method: 'execute-scene-script',
        args: [{ name: '__mcp_probe__', method: '__mcp_probe__', args: [] }],
        layer: 'official',
        readonly: false,
        description: '执行场景脚本方法'
    },
    {
        key: 'scene.snapshot',
        channel: 'scene',
        method: 'snapshot',
        args: [],
        layer: 'official',
        readonly: false,
        description: '触发场景快照'
    },
    {
        key: 'scene.snapshot-abort',
        channel: 'scene',
        method: 'snapshot-abort',
        args: [],
        layer: 'official',
        readonly: false,
        description: '中止场景快照'
    },
    {
        key: 'scene.soft-reload',
        channel: 'scene',
        method: 'soft-reload',
        args: [],
        layer: 'official',
        readonly: false,
        description: '场景软重载'
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
        key: 'engine.query-engine-info',
        channel: 'engine',
        method: 'query-engine-info',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询引擎详细信息'
    },
    {
        key: 'builder.open',
        channel: 'builder',
        method: 'open',
        args: ['default'],
        layer: 'official',
        readonly: false,
        description: '打开构建面板'
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
        key: 'information.query-information',
        channel: 'information',
        method: 'query-information',
        args: ['__mcp_probe__'],
        layer: 'official',
        readonly: true,
        description: '查询 information 信息项'
    },
    {
        key: 'program.query-program-info',
        channel: 'program',
        method: 'query-program-info',
        args: ['__mcp_probe__'],
        layer: 'official',
        readonly: true,
        description: '查询 program 信息'
    },
    {
        key: 'programming.query-shared-settings',
        channel: 'programming',
        method: 'query-shared-settings',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 programming 共享设置'
    },
    {
        key: 'programming.query-sorted-plugins',
        channel: 'programming',
        method: 'query-sorted-plugins',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询 programming 插件顺序'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kLWNhdGFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvbmV4dC9jYXBhYmlsaXR5L21ldGhvZC1jYXRhbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVhLFFBQUEseUJBQXlCLEdBQXNCO0lBQ3hEO1FBQ0ksR0FBRyxFQUFFLHVCQUF1QjtRQUM1QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsaUJBQWlCO1FBQ3pCLElBQUksRUFBRSxFQUFFO1FBQ1IsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLElBQUk7UUFDZCxXQUFXLEVBQUUsU0FBUztLQUN6QjtJQUNEO1FBQ0ksR0FBRyxFQUFFLGtCQUFrQjtRQUN2QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsWUFBWTtRQUNwQixJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDVixLQUFLLEVBQUUsVUFBVTtRQUNqQixRQUFRLEVBQUUsSUFBSTtRQUNkLFdBQVcsRUFBRSxRQUFRO0tBQ3hCO0lBQ0Q7UUFDSSxHQUFHLEVBQUUsaUNBQWlDO1FBQ3RDLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSwyQkFBMkI7UUFDbkMsSUFBSSxFQUFFLENBQUMsd0JBQXdCLENBQUM7UUFDaEMsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLElBQUk7UUFDZCxXQUFXLEVBQUUscUJBQXFCO0tBQ3JDO0lBQ0Q7UUFDSSxHQUFHLEVBQUUsd0JBQXdCO1FBQzdCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSxrQkFBa0I7UUFDMUIsSUFBSSxFQUFFLEVBQUU7UUFDUixLQUFLLEVBQUUsVUFBVTtRQUNqQixRQUFRLEVBQUUsSUFBSTtRQUNkLFdBQVcsRUFBRSxXQUFXO0tBQzNCO0lBQ0Q7UUFDSSxHQUFHLEVBQUUsNkJBQTZCO1FBQ2xDLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSx1QkFBdUI7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QUNEO1FBQ0ksR0FBRyxFQUFFLHlCQUF5QjtRQUM5QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsbUJBQW1CO1FBQzNCLElBQUksRUFBRSxFQUFFO1FBQ1IsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLElBQUk7UUFDZCxXQUFXLEVBQUUsY0FBYztLQUM5QjtJQUNEO1FBQ0ksR0FBRyxFQUFFLG9CQUFvQjtRQUN6QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsY0FBYztRQUN0QixJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUNwQixLQUFLLEVBQUUsY0FBYztRQUNyQixRQUFRLEVBQUUsS0FBSztRQUNmLFdBQVcsRUFBRSxpQkFBaUI7S0FDakM7SUFDRDtRQUNJLEdBQUcsRUFBRSwyQkFBMkI7UUFDaEMsT0FBTyxFQUFFLFVBQVU7UUFDbkIsTUFBTSxFQUFFLGtCQUFrQjtRQUMxQixJQUFJLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQztRQUM5QixLQUFLLEVBQUUsY0FBYztRQUNyQixRQUFRLEVBQUUsSUFBSTtRQUNkLFdBQVcsRUFBRSxpQkFBaUI7S0FDakM7Q0FDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2FwYWJpbGl0eUNoZWNrIH0gZnJvbSAnLi4vbW9kZWxzJztcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ0FQQUJJTElUWV9DSEVDS1M6IENhcGFiaWxpdHlDaGVja1tdID0gW1xuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktbm9kZS10cmVlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktbm9kZS10cmVlJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlnLrmma/oioLngrnmoJEnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LW5vZGUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1ub2RlJyxcbiAgICAgICAgYXJnczogWycnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouiKgueCueivpuaDhSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZCcsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ19hc3NldF91dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouW8leeUqOaMh+Wumui1hOa6kOeahOiKgueCuSBVVUlEIOWIl+ihqCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktY29tcG9uZW50cycsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWNvbXBvbmVudHMnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWPr+a3u+WKoOe7hOS7tua4heWNlSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktZ2l6bW8tdG9vbC1uYW1lJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktZ2l6bW8tdG9vbC1uYW1lJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgR2l6bW8g5bel5YW3J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1naXptby1waXZvdCcsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWdpem1vLXBpdm90JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgR2l6bW8gUGl2b3QnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWdpem1vLWNvb3JkaW5hdGUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1naXptby1jb29yZGluYXRlJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgR2l6bW8g5Z2Q5qCH57O7J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1pczJEJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktaXMyRCcsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIFNjZW5lIFZpZXcgMkQg5qih5byPJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1pcy1ncmlkLXZpc2libGUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1pcy1ncmlkLXZpc2libGUnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue9keagvOaYvuekuueKtuaAgSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktaXMtaWNvbi1naXptby0zZCcsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWlzLWljb24tZ2l6bW8tM2QnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBJY29uIEdpem1vIDNEIOeKtuaAgSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktaWNvbi1naXptby1zaXplJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktaWNvbi1naXptby1zaXplJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgSWNvbiBHaXptbyDlpKflsI8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnY3JlYXRlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyBuYW1lOiAnX19tY3BfcHJvYmVfbm9kZV9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfliJvlu7roioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmR1cGxpY2F0ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnZHVwbGljYXRlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLboioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnJlbW92ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncmVtb3ZlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX3V1aWRfXycgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Yig6Zmk6IqC54K5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5zZXQtcGFyZW50JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc2V0LXBhcmVudCcsXG4gICAgICAgIGFyZ3M6IFt7IHBhcmVudDogJ19fbWlzc2luZ191dWlkX18nLCB1dWlkczogWydfX21pc3NpbmdfdXVpZF9fJ10sIGtlZXBXb3JsZFRyYW5zZm9ybTogZmFsc2UgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u54i26IqC54K5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5jcmVhdGUtY29tcG9uZW50JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnY3JlYXRlLWNvbXBvbmVudCcsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJywgY29tcG9uZW50OiAnY2MuU3ByaXRlJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmt7vliqDnu4Tku7YnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnJlbW92ZS1jb21wb25lbnQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdyZW1vdmUtY29tcG9uZW50JyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJ19fbWlzc2luZ19jb21wb25lbnRfdXVpZF9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfnp7vpmaTnu4Tku7YnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNldC1wcm9wZXJ0eScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3NldC1wcm9wZXJ0eScsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJywgcGF0aDogJ25hbWUnLCBkdW1wOiB7IHZhbHVlOiAnX19wcm9iZV9fJyB9IH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+iuvue9ruWxnuaApydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucmVzZXQtbm9kZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3Jlc2V0LW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX3V1aWRfXycgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN572u6IqC54K5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5yZXNldC1jb21wb25lbnQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdyZXNldC1jb21wb25lbnQnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX2NvbXBvbmVudF91dWlkX18nIH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+mHjee9rue7hOS7tidcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucmVzdG9yZS1wcmVmYWInLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdyZXN0b3JlLXByZWZhYicsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfov5jljp8gUHJlZmFiJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5vcGVuLXNjZW5lJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnb3Blbi1zY2VuZScsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvX19tY3BfcHJvYmVfbWlzc2luZ19fLnNjZW5lJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5omT5byA5Zy65pmvJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1pcy1yZWFkeScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWlzLXJlYWR5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlnLrmma/mmK/lkKblsLHnu6onXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWRpcnR5JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktZGlydHknLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWcuuaZr+aYr+WQpuacieacquS/neWtmOS/ruaUuSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktc2NlbmUtYm91bmRzJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktc2NlbmUtYm91bmRzJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlnLrmma/ovrnnlYwnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmV4ZWN1dGUtc2NlbmUtc2NyaXB0JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLFxuICAgICAgICBhcmdzOiBbeyBuYW1lOiAnX19tY3BfcHJvYmVfXycsIG1ldGhvZDogJ19fbWNwX3Byb2JlX18nLCBhcmdzOiBbXSB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiafooYzlnLrmma/ohJrmnKzmlrnms5UnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNuYXBzaG90JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc25hcHNob3QnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfop6blj5HlnLrmma/lv6vnhacnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNuYXBzaG90LWFib3J0JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc25hcHNob3QtYWJvcnQnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfkuK3mraLlnLrmma/lv6vnhacnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNvZnQtcmVsb2FkJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc29mdC1yZWxvYWQnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflnLrmma/ova/ph43ovb0nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmZvY3VzLWNhbWVyYScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ2ZvY3VzLWNhbWVyYScsXG4gICAgICAgIGFyZ3M6IFtbJ19fbWlzc2luZ191dWlkX18nXV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6IGa54Sm5Zy65pmv55u45py6J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1yZWFkeScsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXJlYWR5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgYXNzZXQtZGIg5YeG5aSH54q25oCBJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldHMnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldHMnLFxuICAgICAgICBhcmdzOiBbeyBwYXR0ZXJuOiAnZGI6Ly9hc3NldHMvKiovKicgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LotYTmupDliJfooagnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1pbmZvJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ6K+m5oOFJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldC11c2VycycsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWFzc2V0LXVzZXJzJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cycsICdhc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ6KKr5byV55So5pa5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzJywgJ2Fzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LotYTmupDkvp3otZYnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLmNvcHktYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdjb3B5LWFzc2V0JyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnLCAnZGI6Ly9hc3NldHMvbm90LWV4aXN0LWNvcHkuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLbotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLm1vdmUtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdtb3ZlLWFzc2V0JyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnLCAnZGI6Ly9hc3NldHMvbm90LWV4aXN0LW1vdmUuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfnp7vliqjotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLmRlbGV0ZS1hc3NldCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ2RlbGV0ZS1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0cy5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WIoOmZpOi1hOa6kCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktcGF0aCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXBhdGgnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+mAmui/hyBVVUlEL1VSTCDmn6Xor6Lmlofku7bot6/lvoQnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LXVybCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXVybCcsXG4gICAgICAgIGFyZ3M6IFsnX19taXNzaW5nX3V1aWRfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YCa6L+HIFVVSUQv6Lev5b6E5p+l6K+iIFVSTCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktdXVpZCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXV1aWQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdC5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YCa6L+HIFVSTC/ot6/lvoTmn6Xor6IgVVVJRCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucmVpbXBvcnQtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdyZWltcG9ydC1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN5a+85YWl6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5yZWZyZXNoLWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAncmVmcmVzaC1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Yi35paw6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5vcGVuLWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAnb3Blbi1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5omT5byA6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdwcm9qZWN0LnF1ZXJ5LWNvbmZpZycsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9qZWN0JyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktY29uZmlnJyxcbiAgICAgICAgYXJnczogWydwcm9qZWN0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lpobnnm67phY3nva4nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NlcnZlci5xdWVyeS1pcC1saXN0JyxcbiAgICAgICAgY2hhbm5lbDogJ3NlcnZlcicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWlwLWxpc3QnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBJUCDliJfooagnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NlcnZlci5xdWVyeS1wb3J0JyxcbiAgICAgICAgY2hhbm5lbDogJ3NlcnZlcicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXBvcnQnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouerr+WPoydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJlZmVyZW5jZXMucXVlcnktY29uZmlnJyxcbiAgICAgICAgY2hhbm5lbDogJ3ByZWZlcmVuY2VzJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktY29uZmlnJyxcbiAgICAgICAgYXJnczogWydnZW5lcmFsJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LnvJbovpHlmajlgY/lpb3orr7nva4nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2VuZ2luZS5xdWVyeS1lbmdpbmUtaW5mbycsXG4gICAgICAgIGNoYW5uZWw6ICdlbmdpbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1lbmdpbmUtaW5mbycsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5byV5pOO6K+m57uG5L+h5oGvJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdidWlsZGVyLm9wZW4nLFxuICAgICAgICBjaGFubmVsOiAnYnVpbGRlcicsXG4gICAgICAgIG1ldGhvZDogJ29wZW4nLFxuICAgICAgICBhcmdzOiBbJ2RlZmF1bHQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIDmnoTlu7rpnaLmnb8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5JyxcbiAgICAgICAgY2hhbm5lbDogJ2J1aWxkZXInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS13b3JrZXItcmVhZHknLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouaehOW7uiB3b3JrZXIg5bCx57uq54q25oCBJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdpbmZvcm1hdGlvbi5xdWVyeS1pbmZvcm1hdGlvbicsXG4gICAgICAgIGNoYW5uZWw6ICdpbmZvcm1hdGlvbicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWluZm9ybWF0aW9uJyxcbiAgICAgICAgYXJnczogWydfX21jcF9wcm9iZV9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgaW5mb3JtYXRpb24g5L+h5oGv6aG5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdwcm9ncmFtLnF1ZXJ5LXByb2dyYW0taW5mbycsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9ncmFtJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktcHJvZ3JhbS1pbmZvJyxcbiAgICAgICAgYXJnczogWydfX21jcF9wcm9iZV9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgcHJvZ3JhbSDkv6Hmga8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3Byb2dyYW1taW5nLnF1ZXJ5LXNoYXJlZC1zZXR0aW5ncycsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9ncmFtbWluZycsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXNoYXJlZC1zZXR0aW5ncycsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIHByb2dyYW1taW5nIOWFseS6q+iuvue9ridcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJvZ3JhbW1pbmcucXVlcnktc29ydGVkLXBsdWdpbnMnLFxuICAgICAgICBjaGFubmVsOiAncHJvZ3JhbW1pbmcnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1zb3J0ZWQtcGx1Z2lucycsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIHByb2dyYW1taW5nIOaPkuS7tumhuuW6jydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktaGllcmFyY2h5JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktaGllcmFyY2h5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlsYLnuqfvvIjljoblj7LmianlsZXmlrnms5XvvIknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktcGVyZm9ybWFuY2UnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouaAp+iDve+8iOWOhuWPsuaJqeWxleaWueazle+8iSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUuYXBwbHktcHJlZmFiJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnYXBwbHktcHJlZmFiJyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJycgfV0sXG4gICAgICAgIGxheWVyOiAnZXhwZXJpbWVudGFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+W6lOeUqCBwcmVmYWLvvIjlrp7pqozmlrnms5XvvIknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWRhdGEnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1kYXRhJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9hLnByZWZhYiddLFxuICAgICAgICBsYXllcjogJ2V4cGVyaW1lbnRhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ivu+WPlui1hOS6p+W6j+WIl+WMluWGheWuue+8iOWunumqjOaWueazle+8iSdcbiAgICB9XG5dO1xuIl19