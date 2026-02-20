import * as assert from 'assert';
import { CapabilityProbe } from '../next/capability/probe';
import { CapabilityCheck } from '../next/models';

async function testCapabilityProbeWithReadonlyFilter(): Promise<void> {
    const checks: CapabilityCheck[] = [
        {
            key: 'scene.query-node-tree',
            channel: 'scene',
            method: 'query-node-tree',
            args: [],
            layer: 'official',
            readonly: true,
            description: 'query node tree'
        },
        {
            key: 'scene.create-node',
            channel: 'scene',
            method: 'create-node',
            args: [{ name: '__probe__' }],
            layer: 'official',
            readonly: false,
            description: 'create node'
        },
        {
            key: 'scene.query-hierarchy',
            channel: 'scene',
            method: 'query-hierarchy',
            args: [],
            layer: 'extended',
            readonly: true,
            description: 'query hierarchy'
        },
        {
            key: 'scene.unknown-method',
            channel: 'scene',
            method: 'unknown-method',
            args: [],
            layer: 'experimental',
            readonly: true,
            description: 'unknown'
        }
    ];

    const calls: Array<{ channel: string; method: string }> = [];
    const requester = async (channel: string, method: string, ..._args: any[]): Promise<any> => {
        calls.push({ channel, method });
        if (method === 'query-node-tree') {
            return { uuid: 'root' };
        }
        if (method === 'query-hierarchy') {
            throw new Error('invalid params');
        }
        if (method === 'unknown-method') {
            throw new Error('Message does not exist: scene.unknown-method');
        }
        throw new Error('unexpected call');
    };

    const probe = new CapabilityProbe(requester);
    const matrix = await probe.run({
        checks,
        includeWriteChecks: false
    });

    assert.strictEqual(matrix.summary.total, 3, '只应执行只读检查项');
    assert.strictEqual(matrix.byKey['scene.query-node-tree'].available, true);
    assert.strictEqual(matrix.byKey['scene.query-hierarchy'].available, true, '非方法缺失错误应视为能力可见');
    assert.strictEqual(matrix.byKey['scene.unknown-method'].available, false);
    assert.strictEqual(calls.some((item) => item.method === 'create-node'), false, '写检查应被过滤');
}

async function testCapabilityProbeIncludeWriteChecks(): Promise<void> {
    const checks: CapabilityCheck[] = [
        {
            key: 'scene.create-node',
            channel: 'scene',
            method: 'create-node',
            args: [{ name: '__probe__' }],
            layer: 'official',
            readonly: false,
            description: 'create node'
        }
    ];

    const calls: Array<{ channel: string; method: string; args: any[] }> = [];
    const requester = async (channel: string, method: string, ..._args: any[]): Promise<any> => {
        calls.push({ channel, method, args: _args });
        if (channel === 'scene' && method === 'create-node') {
            return 'node-id';
        }
        if (channel === 'scene' && method === 'remove-node') {
            return undefined;
        }
        throw new Error('unexpected call');
    };

    const probe = new CapabilityProbe(requester);
    const matrix = await probe.run({ checks, includeWriteChecks: true });

    assert.strictEqual(calls.some((item) => item.channel === 'scene' && item.method === 'create-node'), true);
    assert.strictEqual(calls.some((item) => item.channel === 'scene' && item.method === 'remove-node'), true);
    assert.strictEqual(matrix.summary.total, 1);
    assert.strictEqual(matrix.summary.available, 1);
    assert.ok(
        matrix.byKey['scene.create-node'].detail?.includes('rollback'),
        'create-node 探测应包含回滚信息'
    );
}

async function run(): Promise<void> {
    await testCapabilityProbeWithReadonlyFilter();
    await testCapabilityProbeIncludeWriteChecks();
    console.log('next-capability-probe-test: PASS');
}

run().catch((error) => {
    console.error('next-capability-probe-test: FAIL', error);
    process.exit(1);
});
