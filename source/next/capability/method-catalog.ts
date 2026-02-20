import { CapabilityCheck } from '../models';

export const DEFAULT_CAPABILITY_CHECKS: CapabilityCheck[] = [
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
