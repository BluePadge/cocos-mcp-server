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
        key: 'scene.query-component',
        channel: 'scene',
        method: 'query-component',
        args: ['__missing_component_uuid__'],
        layer: 'official',
        readonly: true,
        description: '查询组件详情'
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
        key: 'scene.query-classes',
        channel: 'scene',
        method: 'query-classes',
        args: [{}],
        layer: 'official',
        readonly: true,
        description: '查询组件类元信息'
    },
    {
        key: 'scene.query-component-has-script',
        channel: 'scene',
        method: 'query-component-has-script',
        args: ['cc.MissingScript'],
        layer: 'official',
        readonly: true,
        description: '查询组件是否存在脚本'
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
        key: 'scene.is-native',
        channel: 'scene',
        method: 'is-native',
        args: [],
        layer: 'official',
        readonly: true,
        description: '查询是否为原生编辑器模式'
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
        key: 'scene.copy-node',
        channel: 'scene',
        method: 'copy-node',
        args: ['__missing_uuid__'],
        layer: 'official',
        readonly: false,
        description: '复制节点到剪贴板'
    },
    {
        key: 'scene.cut-node',
        channel: 'scene',
        method: 'cut-node',
        args: ['__missing_uuid__'],
        layer: 'official',
        readonly: false,
        description: '剪切节点到剪贴板'
    },
    {
        key: 'scene.paste-node',
        channel: 'scene',
        method: 'paste-node',
        args: [{ target: '__missing_uuid__', uuids: '__missing_uuid__', keepWorldTransform: false, pasteAsChild: true }],
        layer: 'official',
        readonly: false,
        description: '粘贴节点'
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
        key: 'scene.reset-property',
        channel: 'scene',
        method: 'reset-property',
        args: [{ uuid: '__missing_uuid__', path: 'name', dump: { value: null } }],
        layer: 'official',
        readonly: false,
        description: '重置属性'
    },
    {
        key: 'scene.move-array-element',
        channel: 'scene',
        method: 'move-array-element',
        args: [{ uuid: '__missing_uuid__', path: '__comps__.0.list', target: 0, offset: 1 }],
        layer: 'official',
        readonly: false,
        description: '移动数组元素'
    },
    {
        key: 'scene.remove-array-element',
        channel: 'scene',
        method: 'remove-array-element',
        args: [{ uuid: '__missing_uuid__', path: '__comps__.0.list', index: 0 }],
        layer: 'official',
        readonly: false,
        description: '删除数组元素'
    },
    {
        key: 'scene.execute-component-method',
        channel: 'scene',
        method: 'execute-component-method',
        args: [{ uuid: '__missing_component_uuid__', name: '__probe__', args: [] }],
        layer: 'official',
        readonly: false,
        description: '执行组件方法'
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
        key: 'scene.create-prefab',
        channel: 'scene',
        method: 'create-prefab',
        args: ['__missing_uuid__', 'db://assets/__mcp_probe__.prefab'],
        layer: 'extended',
        readonly: false,
        description: '从节点创建 Prefab 资源'
    },
    {
        key: 'scene.link-prefab',
        channel: 'scene',
        method: 'link-prefab',
        args: ['__missing_uuid__', '__missing_asset_uuid__'],
        layer: 'extended',
        readonly: false,
        description: '将节点关联到 Prefab 资源'
    },
    {
        key: 'scene.unlink-prefab',
        channel: 'scene',
        method: 'unlink-prefab',
        args: ['__missing_uuid__', false],
        layer: 'extended',
        readonly: false,
        description: '解除节点与 Prefab 资源关联'
    },
    {
        key: 'scene.open-scene',
        channel: 'scene',
        method: 'open-scene',
        args: ['db://assets/__mcp_probe_missing__.scene'],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '打开场景'
    },
    {
        key: 'scene.save-as-scene',
        channel: 'scene',
        method: 'save-as-scene',
        args: [],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '场景另存为'
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
        probeStrategy: 'assume_available',
        description: '打开资源'
    },
    {
        key: 'asset-db.generate-available-url',
        channel: 'asset-db',
        method: 'generate-available-url',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: true,
        description: '生成可用资源 URL'
    },
    {
        key: 'asset-db.query-asset-meta',
        channel: 'asset-db',
        method: 'query-asset-meta',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: true,
        description: '查询资源 meta'
    },
    {
        key: 'asset-db.query-missing-asset-info',
        channel: 'asset-db',
        method: 'query-missing-asset-info',
        args: ['db://assets/not-exist.asset'],
        layer: 'official',
        readonly: true,
        description: '查询丢失资源信息'
    },
    {
        key: 'asset-db.create-asset',
        channel: 'asset-db',
        method: 'create-asset',
        args: ['db://invalid/__mcp_probe__.asset', '{}'],
        layer: 'official',
        readonly: false,
        description: '创建资源'
    },
    {
        key: 'asset-db.import-asset',
        channel: 'asset-db',
        method: 'import-asset',
        args: ['/tmp/__mcp_probe_missing__.asset', 'db://invalid/__mcp_probe__.asset'],
        layer: 'official',
        readonly: false,
        description: '导入资源'
    },
    {
        key: 'asset-db.save-asset',
        channel: 'asset-db',
        method: 'save-asset',
        args: ['db://invalid/__mcp_probe__.asset', '{}'],
        layer: 'official',
        readonly: false,
        description: '保存资源内容'
    },
    {
        key: 'asset-db.save-asset-meta',
        channel: 'asset-db',
        method: 'save-asset-meta',
        args: ['db://invalid/__mcp_probe__.asset', '{}'],
        layer: 'official',
        readonly: false,
        description: '保存资源 meta'
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
        key: 'project.open-settings',
        channel: 'project',
        method: 'open-settings',
        args: ['__mcp_probe__', ''],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '打开项目设置'
    },
    {
        key: 'project.set-config',
        channel: 'project',
        method: 'set-config',
        args: ['__mcp_probe__', '__mcp_probe__', '__probe__'],
        layer: 'official',
        readonly: false,
        description: '设置项目配置'
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
        key: 'preferences.open-settings',
        channel: 'preferences',
        method: 'open-settings',
        args: ['__mcp_probe__'],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '打开偏好设置'
    },
    {
        key: 'preferences.set-config',
        channel: 'preferences',
        method: 'set-config',
        args: ['__mcp_probe__', '__mcp_probe__', '__probe__', 'global'],
        layer: 'official',
        readonly: false,
        description: '设置偏好配置'
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
        probeStrategy: 'assume_available',
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
        key: 'information.open-information-dialog',
        channel: 'information',
        method: 'open-information-dialog',
        args: ['__mcp_probe__'],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '打开 information 对话框'
    },
    {
        key: 'information.has-dialog',
        channel: 'information',
        method: 'has-dialog',
        args: ['__mcp_probe__'],
        layer: 'official',
        readonly: true,
        description: '检查 information 对话框'
    },
    {
        key: 'information.close-dialog',
        channel: 'information',
        method: 'close-dialog',
        args: ['__mcp_probe__'],
        layer: 'official',
        readonly: false,
        description: '关闭 information 对话框'
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
        key: 'program.open-program',
        channel: 'program',
        method: 'open-program',
        args: ['__mcp_probe_program__'],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '打开外部程序'
    },
    {
        key: 'program.open-url',
        channel: 'program',
        method: 'open-url',
        args: ['__mcp_probe_invalid_url__'],
        layer: 'official',
        readonly: false,
        probeStrategy: 'assume_available',
        description: '打开外部链接'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kLWNhdGFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvbmV4dC9jYXBhYmlsaXR5L21ldGhvZC1jYXRhbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVhLFFBQUEseUJBQXlCLEdBQXNCO0lBQ3hEO1FBQ0ksR0FBRyxFQUFFLHVCQUF1QjtRQUM1QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsaUJBQWlCO1FBQ3pCLElBQUksRUFBRSxFQUFFO1FBQ1IsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLElBQUk7UUFDZCxXQUFXLEVBQUUsU0FBUztLQUN6QjtJQUNEO1FBQ0ksR0FBRyxFQUFFLGtCQUFrQjtRQUN2QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsWUFBWTtRQUNwQixJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDVixLQUFLLEVBQUUsVUFBVTtRQUNqQixRQUFRLEVBQUUsSUFBSTtRQUNkLFdBQVcsRUFBRSxRQUFRO0tBQ3hCO0lBQ0Q7UUFDSSxHQUFHLEVBQUUsdUJBQXVCO1FBQzVCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSxpQkFBaUI7UUFDekIsSUFBSSxFQUFFLENBQUMsNEJBQTRCLENBQUM7UUFDcEMsS0FBSyxFQUFFLFVBQVU7UUFDakIsUUFBUSxFQUFFLElBQUk7UUFDZCxXQUFXLEVBQUUsUUFBUTtLQUN4QjtJQUNEO1FBQ0ksR0FBRyxFQUFFLGlDQUFpQztRQUN0QyxPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsMkJBQTJCO1FBQ25DLElBQUksRUFBRSxDQUFDLHdCQUF3QixDQUFDO1FBQ2hDLEtBQUssRUFBRSxVQUFVO1FBQ2pCLFFBQVEsRUFBRSxJQUFJO1FBQ2QsV0FBVyxFQUFFLHFCQUFxQjtLQUNyQztJQUNEO1FBQ0ksR0FBRyxFQUFFLHdCQUF3QjtRQUM3QixPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFN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VyxFQUFFLGlCQUFpQjtLQUNqQztJQUNEO1FBQ0ksR0FBRyxFQUFFLDJCQUEyQjtRQUNoQyxPQUFPLEVBQUUsVUFBVTtRQUNuQixNQUFNLEVBQUUsa0JBQWtCO1FBQzFCLElBQUksRUFBRSxDQUFDLHNCQUFzQixDQUFDO1FBQzlCLEtBQUssRUFBRSxjQUFjO1FBQ3JCLFFBQVEsRUFBRSxJQUFJO1FBQ2QsV0FBVyxFQUFFLGlCQUFpQjtLQUNqQztDQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDYXBhYmlsaXR5Q2hlY2sgfSBmcm9tICcuLi9tb2RlbHMnO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DQVBBQklMSVRZX0NIRUNLUzogQ2FwYWJpbGl0eUNoZWNrW10gPSBbXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1ub2RlLXRyZWUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1ub2RlLXRyZWUnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWcuuaZr+iKgueCueagkSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktbm9kZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LW5vZGUnLFxuICAgICAgICBhcmdzOiBbJyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6IqC54K56K+m5oOFJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1jb21wb25lbnQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1jb21wb25lbnQnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ19jb21wb25lbnRfdXVpZF9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Lnu4Tku7bor6bmg4UnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJyxcbiAgICAgICAgYXJnczogWydfX21pc3NpbmdfYXNzZXRfdXVpZF9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlvJXnlKjmjIflrprotYTmupDnmoToioLngrkgVVVJRCDliJfooagnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWNvbXBvbmVudHMnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1jb21wb25lbnRzJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6Llj6/mt7vliqDnu4Tku7bmuIXljZUnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWNsYXNzZXMnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1jbGFzc2VzJyxcbiAgICAgICAgYXJnczogW3t9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue7hOS7tuexu+WFg+S/oeaBrydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktY29tcG9uZW50LWhhcy1zY3JpcHQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1jb21wb25lbnQtaGFzLXNjcmlwdCcsXG4gICAgICAgIGFyZ3M6IFsnY2MuTWlzc2luZ1NjcmlwdCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57uE5Lu25piv5ZCm5a2Y5Zyo6ISa5pysJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1naXptby10b29sLW5hbWUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1naXptby10b29sLW5hbWUnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBHaXptbyDlt6XlhbcnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWdpem1vLXBpdm90JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktZ2l6bW8tcGl2b3QnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBHaXptbyBQaXZvdCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktZ2l6bW8tY29vcmRpbmF0ZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWdpem1vLWNvb3JkaW5hdGUnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBHaXptbyDlnZDmoIfns7snXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWlzMkQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1pczJEJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgU2NlbmUgVmlldyAyRCDmqKHlvI8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWlzLWdyaWQtdmlzaWJsZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWlzLWdyaWQtdmlzaWJsZScsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i572R5qC85pi+56S654q25oCBJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1pcy1pY29uLWdpem1vLTNkJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktaXMtaWNvbi1naXptby0zZCcsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIEljb24gR2l6bW8gM0Qg54q25oCBJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1pY29uLWdpem1vLXNpemUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1pY29uLWdpem1vLXNpemUnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBJY29uIEdpem1vIOWkp+WwjydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUuaXMtbmF0aXZlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnaXMtbmF0aXZlJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LmmK/lkKbkuLrljp/nlJ/nvJbovpHlmajmqKHlvI8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmNyZWF0ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnY3JlYXRlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyBuYW1lOiAnX19tY3BfcHJvYmVfbm9kZV9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfliJvlu7roioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmR1cGxpY2F0ZS1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnZHVwbGljYXRlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLboioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmNvcHktbm9kZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ2NvcHktbm9kZScsXG4gICAgICAgIGFyZ3M6IFsnX19taXNzaW5nX3V1aWRfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WkjeWItuiKgueCueWIsOWJqui0tOadvydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUuY3V0LW5vZGUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdjdXQtbm9kZScsXG4gICAgICAgIGFyZ3M6IFsnX19taXNzaW5nX3V1aWRfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WJquWIh+iKgueCueWIsOWJqui0tOadvydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucGFzdGUtbm9kZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3Bhc3RlLW5vZGUnLFxuICAgICAgICBhcmdzOiBbeyB0YXJnZXQ6ICdfX21pc3NpbmdfdXVpZF9fJywgdXVpZHM6ICdfX21pc3NpbmdfdXVpZF9fJywga2VlcFdvcmxkVHJhbnNmb3JtOiBmYWxzZSwgcGFzdGVBc0NoaWxkOiB0cnVlIH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+eymOi0tOiKgueCuSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucmVtb3ZlLW5vZGUnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdyZW1vdmUtbm9kZScsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfliKDpmaToioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNldC1wYXJlbnQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdzZXQtcGFyZW50JyxcbiAgICAgICAgYXJnczogW3sgcGFyZW50OiAnX19taXNzaW5nX3V1aWRfXycsIHV1aWRzOiBbJ19fbWlzc2luZ191dWlkX18nXSwga2VlcFdvcmxkVHJhbnNmb3JtOiBmYWxzZSB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICforr7nva7niLboioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmNyZWF0ZS1jb21wb25lbnQnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdjcmVhdGUtY29tcG9uZW50JyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJ19fbWlzc2luZ191dWlkX18nLCBjb21wb25lbnQ6ICdjYy5TcHJpdGUnIH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+a3u+WKoOe7hOS7tidcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucmVtb3ZlLWNvbXBvbmVudCcsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3JlbW92ZS1jb21wb25lbnQnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX2NvbXBvbmVudF91dWlkX18nIH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+enu+mZpOe7hOS7tidcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUuc2V0LXByb3BlcnR5JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc2V0LXByb3BlcnR5JyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJ19fbWlzc2luZ191dWlkX18nLCBwYXRoOiAnbmFtZScsIGR1bXA6IHsgdmFsdWU6ICdfX3Byb2JlX18nIH0gfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u5bGe5oCnJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5yZXNldC1wcm9wZXJ0eScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3Jlc2V0LXByb3BlcnR5JyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJ19fbWlzc2luZ191dWlkX18nLCBwYXRoOiAnbmFtZScsIGR1bXA6IHsgdmFsdWU6IG51bGwgfSB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfph43nva7lsZ7mgKcnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLm1vdmUtYXJyYXktZWxlbWVudCcsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ21vdmUtYXJyYXktZWxlbWVudCcsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJywgcGF0aDogJ19fY29tcHNfXy4wLmxpc3QnLCB0YXJnZXQ6IDAsIG9mZnNldDogMSB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfnp7vliqjmlbDnu4TlhYPntKAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnJlbW92ZS1hcnJheS1lbGVtZW50JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncmVtb3ZlLWFycmF5LWVsZW1lbnQnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX3V1aWRfXycsIHBhdGg6ICdfX2NvbXBzX18uMC5saXN0JywgaW5kZXg6IDAgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Yig6Zmk5pWw57uE5YWD57SgJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5leGVjdXRlLWNvbXBvbmVudC1tZXRob2QnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdleGVjdXRlLWNvbXBvbmVudC1tZXRob2QnLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnX19taXNzaW5nX2NvbXBvbmVudF91dWlkX18nLCBuYW1lOiAnX19wcm9iZV9fJywgYXJnczogW10gfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5omn6KGM57uE5Lu25pa55rOVJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5yZXNldC1ub2RlJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncmVzZXQtbm9kZScsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfdXVpZF9fJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfph43nva7oioLngrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnJlc2V0LWNvbXBvbmVudCcsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3Jlc2V0LWNvbXBvbmVudCcsXG4gICAgICAgIGFyZ3M6IFt7IHV1aWQ6ICdfX21pc3NpbmdfY29tcG9uZW50X3V1aWRfXycgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN572u57uE5Lu2J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5yZXN0b3JlLXByZWZhYicsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3Jlc3RvcmUtcHJlZmFiJyxcbiAgICAgICAgYXJnczogW3sgdXVpZDogJ19fbWlzc2luZ191dWlkX18nIH1dLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+i/mOWOnyBQcmVmYWInXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmNyZWF0ZS1wcmVmYWInLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdjcmVhdGUtcHJlZmFiJyxcbiAgICAgICAgYXJnczogWydfX21pc3NpbmdfdXVpZF9fJywgJ2RiOi8vYXNzZXRzL19fbWNwX3Byb2JlX18ucHJlZmFiJ10sXG4gICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5LuO6IqC54K55Yib5bu6IFByZWZhYiDotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmxpbmstcHJlZmFiJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnbGluay1wcmVmYWInLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nLCAnX19taXNzaW5nX2Fzc2V0X3V1aWRfXyddLFxuICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WwhuiKgueCueWFs+iBlOWIsCBQcmVmYWIg6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS51bmxpbmstcHJlZmFiJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAndW5saW5rLXByZWZhYicsXG4gICAgICAgIGFyZ3M6IFsnX19taXNzaW5nX3V1aWRfXycsIGZhbHNlXSxcbiAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfop6PpmaToioLngrnkuI4gUHJlZmFiIOi1hOa6kOWFs+iBlCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUub3Blbi1zY2VuZScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ29wZW4tc2NlbmUnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL19fbWNwX3Byb2JlX21pc3NpbmdfXy5zY2VuZSddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBwcm9iZVN0cmF0ZWd5OiAnYXNzdW1lX2F2YWlsYWJsZScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5omT5byA5Zy65pmvJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5zYXZlLWFzLXNjZW5lJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc2F2ZS1hcy1zY2VuZScsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBwcm9iZVN0cmF0ZWd5OiAnYXNzdW1lX2F2YWlsYWJsZScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Zy65pmv5Y+m5a2Y5Li6J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1pcy1yZWFkeScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWlzLXJlYWR5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlnLrmma/mmK/lkKblsLHnu6onXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnF1ZXJ5LWRpcnR5JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktZGlydHknLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWcuuaZr+aYr+WQpuacieacquS/neWtmOS/ruaUuSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktc2NlbmUtYm91bmRzJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktc2NlbmUtYm91bmRzJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LlnLrmma/ovrnnlYwnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmV4ZWN1dGUtc2NlbmUtc2NyaXB0JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLFxuICAgICAgICBhcmdzOiBbeyBuYW1lOiAnX19tY3BfcHJvYmVfXycsIG1ldGhvZDogJ19fbWNwX3Byb2JlX18nLCBhcmdzOiBbXSB9XSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiafooYzlnLrmma/ohJrmnKzmlrnms5UnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNuYXBzaG90JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc25hcHNob3QnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfop6blj5HlnLrmma/lv6vnhacnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNuYXBzaG90LWFib3J0JyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc25hcHNob3QtYWJvcnQnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfkuK3mraLlnLrmma/lv6vnhacnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLnNvZnQtcmVsb2FkJyxcbiAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgbWV0aG9kOiAnc29mdC1yZWxvYWQnLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflnLrmma/ova/ph43ovb0nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3NjZW5lLmZvY3VzLWNhbWVyYScsXG4gICAgICAgIGNoYW5uZWw6ICdzY2VuZScsXG4gICAgICAgIG1ldGhvZDogJ2ZvY3VzLWNhbWVyYScsXG4gICAgICAgIGFyZ3M6IFtbJ19fbWlzc2luZ191dWlkX18nXV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6IGa54Sm5Zy65pmv55u45py6J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1yZWFkeScsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXJlYWR5JyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgYXNzZXQtZGIg5YeG5aSH54q25oCBJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldHMnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldHMnLFxuICAgICAgICBhcmdzOiBbeyBwYXR0ZXJuOiAnZGI6Ly9hc3NldHMvKiovKicgfV0sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LotYTmupDliJfooagnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LWluZm8nLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1pbmZvJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ6K+m5oOFJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldC11c2VycycsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWFzc2V0LXVzZXJzJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cycsICdhc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6LWE5rqQ6KKr5byV55So5pa5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzJywgJ2Fzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LotYTmupDkvp3otZYnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLmNvcHktYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdjb3B5LWFzc2V0JyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnLCAnZGI6Ly9hc3NldHMvbm90LWV4aXN0LWNvcHkuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICflpI3liLbotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLm1vdmUtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdtb3ZlLWFzc2V0JyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnLCAnZGI6Ly9hc3NldHMvbm90LWV4aXN0LW1vdmUuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfnp7vliqjotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLmRlbGV0ZS1hc3NldCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ2RlbGV0ZS1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0cy5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WIoOmZpOi1hOa6kCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktcGF0aCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXBhdGgnLFxuICAgICAgICBhcmdzOiBbJ19fbWlzc2luZ191dWlkX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+mAmui/hyBVVUlEL1VSTCDmn6Xor6Lmlofku7bot6/lvoQnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LXVybCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXVybCcsXG4gICAgICAgIGFyZ3M6IFsnX19taXNzaW5nX3V1aWRfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YCa6L+HIFVVSUQv6Lev5b6E5p+l6K+iIFVSTCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktdXVpZCcsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXV1aWQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdC5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YCa6L+HIFVSTC/ot6/lvoTmn6Xor6IgVVVJRCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucmVpbXBvcnQtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdyZWltcG9ydC1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6YeN5a+85YWl6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5yZWZyZXNoLWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAncmVmcmVzaC1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Yi35paw6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5vcGVuLWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAnb3Blbi1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9hc3NldHMvbm90LWV4aXN0LmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIHByb2JlU3RyYXRlZ3k6ICdhc3N1bWVfYXZhaWxhYmxlJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIDotYTmupAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLmdlbmVyYXRlLWF2YWlsYWJsZS11cmwnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdnZW5lcmF0ZS1hdmFpbGFibGUtdXJsJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+eUn+aIkOWPr+eUqOi1hOa6kCBVUkwnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnF1ZXJ5LWFzc2V0LW1ldGEnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1hc3NldC1tZXRhJyxcbiAgICAgICAgYXJnczogWydkYjovL2Fzc2V0cy9ub3QtZXhpc3QuYXNzZXQnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoui1hOa6kCBtZXRhJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5xdWVyeS1taXNzaW5nLWFzc2V0LWluZm8nLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1taXNzaW5nLWFzc2V0LWluZm8nLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL25vdC1leGlzdC5hc3NldCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5Lii5aSx6LWE5rqQ5L+h5oGvJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5jcmVhdGUtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdjcmVhdGUtYXNzZXQnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vaW52YWxpZC9fX21jcF9wcm9iZV9fLmFzc2V0JywgJ3t9J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5Yib5bu66LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5pbXBvcnQtYXNzZXQnLFxuICAgICAgICBjaGFubmVsOiAnYXNzZXQtZGInLFxuICAgICAgICBtZXRob2Q6ICdpbXBvcnQtYXNzZXQnLFxuICAgICAgICBhcmdzOiBbJy90bXAvX19tY3BfcHJvYmVfbWlzc2luZ19fLmFzc2V0JywgJ2RiOi8vaW52YWxpZC9fX21jcF9wcm9iZV9fLmFzc2V0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5a+85YWl6LWE5rqQJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdhc3NldC1kYi5zYXZlLWFzc2V0JyxcbiAgICAgICAgY2hhbm5lbDogJ2Fzc2V0LWRiJyxcbiAgICAgICAgbWV0aG9kOiAnc2F2ZS1hc3NldCcsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9pbnZhbGlkL19fbWNwX3Byb2JlX18uYXNzZXQnLCAne30nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfkv53lrZjotYTmupDlhoXlrrknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2Fzc2V0LWRiLnNhdmUtYXNzZXQtbWV0YScsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3NhdmUtYXNzZXQtbWV0YScsXG4gICAgICAgIGFyZ3M6IFsnZGI6Ly9pbnZhbGlkL19fbWNwX3Byb2JlX18uYXNzZXQnLCAne30nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfkv53lrZjotYTmupAgbWV0YSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJvamVjdC5xdWVyeS1jb25maWcnLFxuICAgICAgICBjaGFubmVsOiAncHJvamVjdCcsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWNvbmZpZycsXG4gICAgICAgIGFyZ3M6IFsncHJvamVjdCddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i6aG555uu6YWN572uJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdwcm9qZWN0Lm9wZW4tc2V0dGluZ3MnLFxuICAgICAgICBjaGFubmVsOiAncHJvamVjdCcsXG4gICAgICAgIG1ldGhvZDogJ29wZW4tc2V0dGluZ3MnLFxuICAgICAgICBhcmdzOiBbJ19fbWNwX3Byb2JlX18nLCAnJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIHByb2JlU3RyYXRlZ3k6ICdhc3N1bWVfYXZhaWxhYmxlJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIDpobnnm67orr7nva4nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ3Byb2plY3Quc2V0LWNvbmZpZycsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9qZWN0JyxcbiAgICAgICAgbWV0aG9kOiAnc2V0LWNvbmZpZycsXG4gICAgICAgIGFyZ3M6IFsnX19tY3BfcHJvYmVfXycsICdfX21jcF9wcm9iZV9fJywgJ19fcHJvYmVfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+iuvue9rumhueebrumFjee9ridcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2VydmVyLnF1ZXJ5LWlwLWxpc3QnLFxuICAgICAgICBjaGFubmVsOiAnc2VydmVyJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktaXAtbGlzdCcsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIElQIOWIl+ihqCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2VydmVyLnF1ZXJ5LXBvcnQnLFxuICAgICAgICBjaGFubmVsOiAnc2VydmVyJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktcG9ydCcsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i56uv5Y+jJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdwcmVmZXJlbmNlcy5xdWVyeS1jb25maWcnLFxuICAgICAgICBjaGFubmVsOiAncHJlZmVyZW5jZXMnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1jb25maWcnLFxuICAgICAgICBhcmdzOiBbJ2dlbmVyYWwnXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue8lui+keWZqOWBj+Wlveiuvue9ridcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJlZmVyZW5jZXMub3Blbi1zZXR0aW5ncycsXG4gICAgICAgIGNoYW5uZWw6ICdwcmVmZXJlbmNlcycsXG4gICAgICAgIG1ldGhvZDogJ29wZW4tc2V0dGluZ3MnLFxuICAgICAgICBhcmdzOiBbJ19fbWNwX3Byb2JlX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgcHJvYmVTdHJhdGVneTogJ2Fzc3VtZV9hdmFpbGFibGUnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOWBj+Wlveiuvue9ridcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJlZmVyZW5jZXMuc2V0LWNvbmZpZycsXG4gICAgICAgIGNoYW5uZWw6ICdwcmVmZXJlbmNlcycsXG4gICAgICAgIG1ldGhvZDogJ3NldC1jb25maWcnLFxuICAgICAgICBhcmdzOiBbJ19fbWNwX3Byb2JlX18nLCAnX19tY3BfcHJvYmVfXycsICdfX3Byb2JlX18nLCAnZ2xvYmFsJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6K6+572u5YGP5aW96YWN572uJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdlbmdpbmUucXVlcnktZW5naW5lLWluZm8nLFxuICAgICAgICBjaGFubmVsOiAnZW5naW5lJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktZW5naW5lLWluZm8nLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouW8leaTjuivpue7huS/oeaBrydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYnVpbGRlci5vcGVuJyxcbiAgICAgICAgY2hhbm5lbDogJ2J1aWxkZXInLFxuICAgICAgICBtZXRob2Q6ICdvcGVuJyxcbiAgICAgICAgYXJnczogWydkZWZhdWx0J10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIHByb2JlU3RyYXRlZ3k6ICdhc3N1bWVfYXZhaWxhYmxlJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIDmnoTlu7rpnaLmnb8nXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleTogJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5JyxcbiAgICAgICAgY2hhbm5lbDogJ2J1aWxkZXInLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS13b3JrZXItcmVhZHknLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouaehOW7uiB3b3JrZXIg5bCx57uq54q25oCBJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdpbmZvcm1hdGlvbi5xdWVyeS1pbmZvcm1hdGlvbicsXG4gICAgICAgIGNoYW5uZWw6ICdpbmZvcm1hdGlvbicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWluZm9ybWF0aW9uJyxcbiAgICAgICAgYXJnczogWydfX21jcF9wcm9iZV9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgaW5mb3JtYXRpb24g5L+h5oGv6aG5J1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdpbmZvcm1hdGlvbi5vcGVuLWluZm9ybWF0aW9uLWRpYWxvZycsXG4gICAgICAgIGNoYW5uZWw6ICdpbmZvcm1hdGlvbicsXG4gICAgICAgIG1ldGhvZDogJ29wZW4taW5mb3JtYXRpb24tZGlhbG9nJyxcbiAgICAgICAgYXJnczogWydfX21jcF9wcm9iZV9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIHByb2JlU3RyYXRlZ3k6ICdhc3N1bWVfYXZhaWxhYmxlJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmiZPlvIAgaW5mb3JtYXRpb24g5a+56K+d5qGGJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdpbmZvcm1hdGlvbi5oYXMtZGlhbG9nJyxcbiAgICAgICAgY2hhbm5lbDogJ2luZm9ybWF0aW9uJyxcbiAgICAgICAgbWV0aG9kOiAnaGFzLWRpYWxvZycsXG4gICAgICAgIGFyZ3M6IFsnX19tY3BfcHJvYmVfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5qOA5p+lIGluZm9ybWF0aW9uIOWvueivneahhidcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnaW5mb3JtYXRpb24uY2xvc2UtZGlhbG9nJyxcbiAgICAgICAgY2hhbm5lbDogJ2luZm9ybWF0aW9uJyxcbiAgICAgICAgbWV0aG9kOiAnY2xvc2UtZGlhbG9nJyxcbiAgICAgICAgYXJnczogWydfX21jcF9wcm9iZV9fJ10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5YWz6ZetIGluZm9ybWF0aW9uIOWvueivneahhidcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJvZ3JhbS5xdWVyeS1wcm9ncmFtLWluZm8nLFxuICAgICAgICBjaGFubmVsOiAncHJvZ3JhbScsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXByb2dyYW0taW5mbycsXG4gICAgICAgIGFyZ3M6IFsnX19tY3BfcHJvYmVfXyddLFxuICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIHByb2dyYW0g5L+h5oGvJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdwcm9ncmFtLm9wZW4tcHJvZ3JhbScsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9ncmFtJyxcbiAgICAgICAgbWV0aG9kOiAnb3Blbi1wcm9ncmFtJyxcbiAgICAgICAgYXJnczogWydfX21jcF9wcm9iZV9wcm9ncmFtX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgcHJvYmVTdHJhdGVneTogJ2Fzc3VtZV9hdmFpbGFibGUnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOWklumDqOeoi+W6jydcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJvZ3JhbS5vcGVuLXVybCcsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9ncmFtJyxcbiAgICAgICAgbWV0aG9kOiAnb3Blbi11cmwnLFxuICAgICAgICBhcmdzOiBbJ19fbWNwX3Byb2JlX2ludmFsaWRfdXJsX18nXSxcbiAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgcHJvYmVTdHJhdGVneTogJ2Fzc3VtZV9hdmFpbGFibGUnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOWklumDqOmTvuaOpSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAncHJvZ3JhbW1pbmcucXVlcnktc2hhcmVkLXNldHRpbmdzJyxcbiAgICAgICAgY2hhbm5lbDogJ3Byb2dyYW1taW5nJyxcbiAgICAgICAgbWV0aG9kOiAncXVlcnktc2hhcmVkLXNldHRpbmdzJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgcHJvZ3JhbW1pbmcg5YWx5Lqr6K6+572uJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdwcm9ncmFtbWluZy5xdWVyeS1zb3J0ZWQtcGx1Z2lucycsXG4gICAgICAgIGNoYW5uZWw6ICdwcm9ncmFtbWluZycsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LXNvcnRlZC1wbHVnaW5zJyxcbiAgICAgICAgYXJnczogW10sXG4gICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgcHJvZ3JhbW1pbmcg5o+S5Lu26aG65bqPJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1oaWVyYXJjaHknLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1oaWVyYXJjaHknLFxuICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouWxgue6p++8iOWOhuWPsuaJqeWxleaWueazle+8iSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnc2NlbmUucXVlcnktcGVyZm9ybWFuY2UnLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdxdWVyeS1wZXJmb3JtYW5jZScsXG4gICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i5oCn6IO977yI5Y6G5Y+y5omp5bGV5pa55rOV77yJJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXk6ICdzY2VuZS5hcHBseS1wcmVmYWInLFxuICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICBtZXRob2Q6ICdhcHBseS1wcmVmYWInLFxuICAgICAgICBhcmdzOiBbeyB1dWlkOiAnJyB9XSxcbiAgICAgICAgbGF5ZXI6ICdleHBlcmltZW50YWwnLFxuICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5bqU55SoIHByZWZhYu+8iOWunumqjOaWueazle+8iSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5OiAnYXNzZXQtZGIucXVlcnktYXNzZXQtZGF0YScsXG4gICAgICAgIGNoYW5uZWw6ICdhc3NldC1kYicsXG4gICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWFzc2V0LWRhdGEnLFxuICAgICAgICBhcmdzOiBbJ2RiOi8vYXNzZXRzL2EucHJlZmFiJ10sXG4gICAgICAgIGxheWVyOiAnZXhwZXJpbWVudGFsJyxcbiAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn6K+75Y+W6LWE5Lqn5bqP5YiX5YyW5YaF5a6577yI5a6e6aqM5pa55rOV77yJJ1xuICAgIH1cbl07XG4iXX0=