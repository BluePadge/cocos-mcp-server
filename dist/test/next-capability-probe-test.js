"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const probe_1 = require("../next/capability/probe");
async function testCapabilityProbeWithReadonlyFilter() {
    const checks = [
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
    const calls = [];
    const requester = async (channel, method, ..._args) => {
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
    const probe = new probe_1.CapabilityProbe(requester);
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
async function testCapabilityProbeIncludeWriteChecks() {
    var _a;
    const checks = [
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
    const calls = [];
    const requester = async (channel, method, ..._args) => {
        calls.push({ channel, method, args: _args });
        if (channel === 'scene' && method === 'create-node') {
            return 'node-id';
        }
        if (channel === 'scene' && method === 'remove-node') {
            return undefined;
        }
        throw new Error('unexpected call');
    };
    const probe = new probe_1.CapabilityProbe(requester);
    const matrix = await probe.run({ checks, includeWriteChecks: true });
    assert.strictEqual(calls.some((item) => item.channel === 'scene' && item.method === 'create-node'), true);
    assert.strictEqual(calls.some((item) => item.channel === 'scene' && item.method === 'remove-node'), true);
    assert.strictEqual(matrix.summary.total, 1);
    assert.strictEqual(matrix.summary.available, 1);
    assert.ok((_a = matrix.byKey['scene.create-node'].detail) === null || _a === void 0 ? void 0 : _a.includes('rollback'), 'create-node 探测应包含回滚信息');
}
async function testCapabilityProbeAssumeAvailableStrategy() {
    var _a;
    const checks = [
        {
            key: 'program.open-url',
            channel: 'program',
            method: 'open-url',
            args: ['https://example.com'],
            layer: 'official',
            readonly: false,
            probeStrategy: 'assume_available',
            description: 'open url'
        },
        {
            key: 'scene.query-is-ready',
            channel: 'scene',
            method: 'query-is-ready',
            args: [],
            layer: 'official',
            readonly: true,
            description: 'query ready'
        }
    ];
    const calls = [];
    const requester = async (channel, method) => {
        calls.push({ channel, method });
        if (channel === 'scene' && method === 'query-is-ready') {
            return true;
        }
        throw new Error(`Unexpected invoke: ${channel}.${method}`);
    };
    const probe = new probe_1.CapabilityProbe(requester);
    const matrix = await probe.run({ checks, includeWriteChecks: true });
    assert.strictEqual(matrix.byKey['program.open-url'].available, true);
    assert.ok((_a = matrix.byKey['program.open-url'].detail) === null || _a === void 0 ? void 0 : _a.includes('assume_available'));
    assert.strictEqual(calls.some((item) => item.channel === 'program' && item.method === 'open-url'), false, 'assume_available 检查项不应触发真实调用');
    assert.strictEqual(calls.some((item) => item.channel === 'scene' && item.method === 'query-is-ready'), true, '普通检查项仍应执行');
}
async function run() {
    await testCapabilityProbeWithReadonlyFilter();
    await testCapabilityProbeIncludeWriteChecks();
    await testCapabilityProbeAssumeAvailableStrategy();
    console.log('next-capability-probe-test: PASS');
}
run().catch((error) => {
    console.error('next-capability-probe-test: FAIL', error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1jYXBhYmlsaXR5LXByb2JlLXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC9uZXh0LWNhcGFiaWxpdHktcHJvYmUtdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUNqQyxvREFBMkQ7QUFHM0QsS0FBSyxVQUFVLHFDQUFxQztJQUNoRCxNQUFNLE1BQU0sR0FBc0I7UUFDOUI7WUFDSSxHQUFHLEVBQUUsdUJBQXVCO1lBQzVCLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE1BQU0sRUFBRSxpQkFBaUI7WUFDekIsSUFBSSxFQUFFLEVBQUU7WUFDUixLQUFLLEVBQUUsVUFBVTtZQUNqQixRQUFRLEVBQUUsSUFBSTtZQUNkLFdBQVcsRUFBRSxpQkFBaUI7U0FDakM7UUFDRDtZQUNJLEdBQUcsRUFBRSxtQkFBbUI7WUFDeEIsT0FBTyxFQUFFLE9BQU87WUFDaEIsTUFBTSxFQUFFLGFBQWE7WUFDckIsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUM7WUFDN0IsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLEtBQUs7WUFDZixXQUFXLEVBQUUsYUFBYTtTQUM3QjtRQUNEO1lBQ0ksR0FBRyxFQUFFLHVCQUF1QjtZQUM1QixPQUFPLEVBQUUsT0FBTztZQUNoQixNQUFNLEVBQUUsaUJBQWlCO1lBQ3pCLElBQUksRUFBRSxFQUFFO1lBQ1IsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsaUJBQWlCO1NBQ2pDO1FBQ0Q7WUFDSSxHQUFHLEVBQUUsc0JBQXNCO1lBQzNCLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE1BQU0sRUFBRSxnQkFBZ0I7WUFDeEIsSUFBSSxFQUFFLEVBQUU7WUFDUixLQUFLLEVBQUUsY0FBYztZQUNyQixRQUFRLEVBQUUsSUFBSTtZQUNkLFdBQVcsRUFBRSxTQUFTO1NBQ3pCO0tBQ0osQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUErQyxFQUFFLENBQUM7SUFDN0QsTUFBTSxTQUFTLEdBQUcsS0FBSyxFQUFFLE9BQWUsRUFBRSxNQUFjLEVBQUUsR0FBRyxLQUFZLEVBQWdCLEVBQUU7UUFDdkYsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2hDLElBQUksTUFBTSxLQUFLLGlCQUFpQixFQUFFLENBQUM7WUFDL0IsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQztRQUM1QixDQUFDO1FBQ0QsSUFBSSxNQUFNLEtBQUssaUJBQWlCLEVBQUUsQ0FBQztZQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUNELElBQUksTUFBTSxLQUFLLGdCQUFnQixFQUFFLENBQUM7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDdkMsQ0FBQyxDQUFDO0lBRUYsTUFBTSxLQUFLLEdBQUcsSUFBSSx1QkFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQztRQUMzQixNQUFNO1FBQ04sa0JBQWtCLEVBQUUsS0FBSztLQUM1QixDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUN6RCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzVGLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMxRSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssYUFBYSxDQUFDLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQzlGLENBQUM7QUFFRCxLQUFLLFVBQVUscUNBQXFDOztJQUNoRCxNQUFNLE1BQU0sR0FBc0I7UUFDOUI7WUFDSSxHQUFHLEVBQUUsbUJBQW1CO1lBQ3hCLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE1BQU0sRUFBRSxhQUFhO1lBQ3JCLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDO1lBQzdCLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxLQUFLO1lBQ2YsV0FBVyxFQUFFLGFBQWE7U0FDN0I7S0FDSixDQUFDO0lBRUYsTUFBTSxLQUFLLEdBQTRELEVBQUUsQ0FBQztJQUMxRSxNQUFNLFNBQVMsR0FBRyxLQUFLLEVBQUUsT0FBZSxFQUFFLE1BQWMsRUFBRSxHQUFHLEtBQVksRUFBZ0IsRUFBRTtRQUN2RixLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUM3QyxJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksTUFBTSxLQUFLLGFBQWEsRUFBRSxDQUFDO1lBQ2xELE9BQU8sU0FBUyxDQUFDO1FBQ3JCLENBQUM7UUFDRCxJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksTUFBTSxLQUFLLGFBQWEsRUFBRSxDQUFDO1lBQ2xELE9BQU8sU0FBUyxDQUFDO1FBQ3JCLENBQUM7UUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDdkMsQ0FBQyxDQUFDO0lBRUYsTUFBTSxLQUFLLEdBQUcsSUFBSSx1QkFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRXJFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxPQUFPLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxhQUFhLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssYUFBYSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1QyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hELE1BQU0sQ0FBQyxFQUFFLENBQ0wsTUFBQSxNQUFNLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLENBQUMsTUFBTSwwQ0FBRSxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQzlELHVCQUF1QixDQUMxQixDQUFDO0FBQ04sQ0FBQztBQUVELEtBQUssVUFBVSwwQ0FBMEM7O0lBQ3JELE1BQU0sTUFBTSxHQUFzQjtRQUM5QjtZQUNJLEdBQUcsRUFBRSxrQkFBa0I7WUFDdkIsT0FBTyxFQUFFLFNBQVM7WUFDbEIsTUFBTSxFQUFFLFVBQVU7WUFDbEIsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUM7WUFDN0IsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLEtBQUs7WUFDZixhQUFhLEVBQUUsa0JBQWtCO1lBQ2pDLFdBQVcsRUFBRSxVQUFVO1NBQzFCO1FBQ0Q7WUFDSSxHQUFHLEVBQUUsc0JBQXNCO1lBQzNCLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE1BQU0sRUFBRSxnQkFBZ0I7WUFDeEIsSUFBSSxFQUFFLEVBQUU7WUFDUixLQUFLLEVBQUUsVUFBVTtZQUNqQixRQUFRLEVBQUUsSUFBSTtZQUNkLFdBQVcsRUFBRSxhQUFhO1NBQzdCO0tBQ0osQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUErQyxFQUFFLENBQUM7SUFDN0QsTUFBTSxTQUFTLEdBQUcsS0FBSyxFQUFFLE9BQWUsRUFBRSxNQUFjLEVBQWdCLEVBQUU7UUFDdEUsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2hDLElBQUksT0FBTyxLQUFLLE9BQU8sSUFBSSxNQUFNLEtBQUssZ0JBQWdCLEVBQUUsQ0FBQztZQUNyRCxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsT0FBTyxJQUFJLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDL0QsQ0FBQyxDQUFDO0lBRUYsTUFBTSxLQUFLLEdBQUcsSUFBSSx1QkFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRXJFLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyRSxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQUEsTUFBTSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sMENBQUUsUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztJQUNqRixNQUFNLENBQUMsV0FBVyxDQUNkLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLEVBQzlFLEtBQUssRUFDTCw4QkFBOEIsQ0FDakMsQ0FBQztJQUNGLE1BQU0sQ0FBQyxXQUFXLENBQ2QsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxPQUFPLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxnQkFBZ0IsQ0FBQyxFQUNsRixJQUFJLEVBQ0osV0FBVyxDQUNkLENBQUM7QUFDTixDQUFDO0FBRUQsS0FBSyxVQUFVLEdBQUc7SUFDZCxNQUFNLHFDQUFxQyxFQUFFLENBQUM7SUFDOUMsTUFBTSxxQ0FBcUMsRUFBRSxDQUFDO0lBQzlDLE1BQU0sMENBQTBDLEVBQUUsQ0FBQztJQUNuRCxPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7QUFDcEQsQ0FBQztBQUVELEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FwYWJpbGl0eVByb2JlIH0gZnJvbSAnLi4vbmV4dC9jYXBhYmlsaXR5L3Byb2JlJztcbmltcG9ydCB7IENhcGFiaWxpdHlDaGVjayB9IGZyb20gJy4uL25leHQvbW9kZWxzJztcblxuYXN5bmMgZnVuY3Rpb24gdGVzdENhcGFiaWxpdHlQcm9iZVdpdGhSZWFkb25seUZpbHRlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjaGVja3M6IENhcGFiaWxpdHlDaGVja1tdID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1ub2RlLXRyZWUnLFxuICAgICAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ3F1ZXJ5LW5vZGUtdHJlZScsXG4gICAgICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ3F1ZXJ5IG5vZGUgdHJlZSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAga2V5OiAnc2NlbmUuY3JlYXRlLW5vZGUnLFxuICAgICAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ2NyZWF0ZS1ub2RlJyxcbiAgICAgICAgICAgIGFyZ3M6IFt7IG5hbWU6ICdfX3Byb2JlX18nIH1dLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICByZWFkb25seTogZmFsc2UsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ2NyZWF0ZSBub2RlJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBrZXk6ICdzY2VuZS5xdWVyeS1oaWVyYXJjaHknLFxuICAgICAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWhpZXJhcmNoeScsXG4gICAgICAgICAgICBhcmdzOiBbXSxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ3F1ZXJ5IGhpZXJhcmNoeSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAga2V5OiAnc2NlbmUudW5rbm93bi1tZXRob2QnLFxuICAgICAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ3Vua25vd24tbWV0aG9kJyxcbiAgICAgICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHBlcmltZW50YWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ3Vua25vd24nXG4gICAgICAgIH1cbiAgICBdO1xuXG4gICAgY29uc3QgY2FsbHM6IEFycmF5PHsgY2hhbm5lbDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZyB9PiA9IFtdO1xuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5fYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBjYWxscy5wdXNoKHsgY2hhbm5lbCwgbWV0aG9kIH0pO1xuICAgICAgICBpZiAobWV0aG9kID09PSAncXVlcnktbm9kZS10cmVlJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdXVpZDogJ3Jvb3QnIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3F1ZXJ5LWhpZXJhcmNoeScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBwYXJhbXMnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWV0aG9kID09PSAndW5rbm93bi1tZXRob2QnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01lc3NhZ2UgZG9lcyBub3QgZXhpc3Q6IHNjZW5lLnVua25vd24tbWV0aG9kJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkIGNhbGwnKTtcbiAgICB9O1xuXG4gICAgY29uc3QgcHJvYmUgPSBuZXcgQ2FwYWJpbGl0eVByb2JlKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gYXdhaXQgcHJvYmUucnVuKHtcbiAgICAgICAgY2hlY2tzLFxuICAgICAgICBpbmNsdWRlV3JpdGVDaGVja3M6IGZhbHNlXG4gICAgfSk7XG5cbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobWF0cml4LnN1bW1hcnkudG90YWwsIDMsICflj6rlupTmiafooYzlj6ror7vmo4Dmn6XpobknKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwobWF0cml4LmJ5S2V5WydzY2VuZS5xdWVyeS1ub2RlLXRyZWUnXS5hdmFpbGFibGUsIHRydWUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChtYXRyaXguYnlLZXlbJ3NjZW5lLnF1ZXJ5LWhpZXJhcmNoeSddLmF2YWlsYWJsZSwgdHJ1ZSwgJ+mdnuaWueazlee8uuWksemUmeivr+W6lOinhuS4uuiDveWKm+WPr+ingScpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChtYXRyaXguYnlLZXlbJ3NjZW5lLnVua25vd24tbWV0aG9kJ10uYXZhaWxhYmxlLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0ubWV0aG9kID09PSAnY3JlYXRlLW5vZGUnKSwgZmFsc2UsICflhpnmo4Dmn6XlupTooqvov4fmu6QnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdGVzdENhcGFiaWxpdHlQcm9iZUluY2x1ZGVXcml0ZUNoZWNrcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjaGVja3M6IENhcGFiaWxpdHlDaGVja1tdID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBrZXk6ICdzY2VuZS5jcmVhdGUtbm9kZScsXG4gICAgICAgICAgICBjaGFubmVsOiAnc2NlbmUnLFxuICAgICAgICAgICAgbWV0aG9kOiAnY3JlYXRlLW5vZGUnLFxuICAgICAgICAgICAgYXJnczogW3sgbmFtZTogJ19fcHJvYmVfXycgfV0sXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnY3JlYXRlIG5vZGUnXG4gICAgICAgIH1cbiAgICBdO1xuXG4gICAgY29uc3QgY2FsbHM6IEFycmF5PHsgY2hhbm5lbDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZzsgYXJnczogYW55W10gfT4gPSBbXTtcbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uX2FyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgY2FsbHMucHVzaCh7IGNoYW5uZWwsIG1ldGhvZCwgYXJnczogX2FyZ3MgfSk7XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ2NyZWF0ZS1ub2RlJykge1xuICAgICAgICAgICAgcmV0dXJuICdub2RlLWlkJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdyZW1vdmUtbm9kZScpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkIGNhbGwnKTtcbiAgICB9O1xuXG4gICAgY29uc3QgcHJvYmUgPSBuZXcgQ2FwYWJpbGl0eVByb2JlKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gYXdhaXQgcHJvYmUucnVuKHsgY2hlY2tzLCBpbmNsdWRlV3JpdGVDaGVja3M6IHRydWUgfSk7XG5cbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5jaGFubmVsID09PSAnc2NlbmUnICYmIGl0ZW0ubWV0aG9kID09PSAnY3JlYXRlLW5vZGUnKSwgdHJ1ZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLnNvbWUoKGl0ZW0pID0+IGl0ZW0uY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBpdGVtLm1ldGhvZCA9PT0gJ3JlbW92ZS1ub2RlJyksIHRydWUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChtYXRyaXguc3VtbWFyeS50b3RhbCwgMSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKG1hdHJpeC5zdW1tYXJ5LmF2YWlsYWJsZSwgMSk7XG4gICAgYXNzZXJ0Lm9rKFxuICAgICAgICBtYXRyaXguYnlLZXlbJ3NjZW5lLmNyZWF0ZS1ub2RlJ10uZGV0YWlsPy5pbmNsdWRlcygncm9sbGJhY2snKSxcbiAgICAgICAgJ2NyZWF0ZS1ub2RlIOaOoua1i+W6lOWMheWQq+Wbnua7muS/oeaBrydcbiAgICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0Q2FwYWJpbGl0eVByb2JlQXNzdW1lQXZhaWxhYmxlU3RyYXRlZ3koKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY2hlY2tzOiBDYXBhYmlsaXR5Q2hlY2tbXSA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAga2V5OiAncHJvZ3JhbS5vcGVuLXVybCcsXG4gICAgICAgICAgICBjaGFubmVsOiAncHJvZ3JhbScsXG4gICAgICAgICAgICBtZXRob2Q6ICdvcGVuLXVybCcsXG4gICAgICAgICAgICBhcmdzOiBbJ2h0dHBzOi8vZXhhbXBsZS5jb20nXSxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgcHJvYmVTdHJhdGVneTogJ2Fzc3VtZV9hdmFpbGFibGUnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdvcGVuIHVybCdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAga2V5OiAnc2NlbmUucXVlcnktaXMtcmVhZHknLFxuICAgICAgICAgICAgY2hhbm5lbDogJ3NjZW5lJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ3F1ZXJ5LWlzLXJlYWR5JyxcbiAgICAgICAgICAgIGFyZ3M6IFtdLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICByZWFkb25seTogdHJ1ZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAncXVlcnkgcmVhZHknXG4gICAgICAgIH1cbiAgICBdO1xuXG4gICAgY29uc3QgY2FsbHM6IEFycmF5PHsgY2hhbm5lbDogc3RyaW5nOyBtZXRob2Q6IHN0cmluZyB9PiA9IFtdO1xuICAgIGNvbnN0IHJlcXVlc3RlciA9IGFzeW5jIChjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgY2FsbHMucHVzaCh7IGNoYW5uZWwsIG1ldGhvZCB9KTtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdzY2VuZScgJiYgbWV0aG9kID09PSAncXVlcnktaXMtcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgaW52b2tlOiAke2NoYW5uZWx9LiR7bWV0aG9kfWApO1xuICAgIH07XG5cbiAgICBjb25zdCBwcm9iZSA9IG5ldyBDYXBhYmlsaXR5UHJvYmUocmVxdWVzdGVyKTtcbiAgICBjb25zdCBtYXRyaXggPSBhd2FpdCBwcm9iZS5ydW4oeyBjaGVja3MsIGluY2x1ZGVXcml0ZUNoZWNrczogdHJ1ZSB9KTtcblxuICAgIGFzc2VydC5zdHJpY3RFcXVhbChtYXRyaXguYnlLZXlbJ3Byb2dyYW0ub3Blbi11cmwnXS5hdmFpbGFibGUsIHRydWUpO1xuICAgIGFzc2VydC5vayhtYXRyaXguYnlLZXlbJ3Byb2dyYW0ub3Blbi11cmwnXS5kZXRhaWw/LmluY2x1ZGVzKCdhc3N1bWVfYXZhaWxhYmxlJykpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChcbiAgICAgICAgY2FsbHMuc29tZSgoaXRlbSkgPT4gaXRlbS5jaGFubmVsID09PSAncHJvZ3JhbScgJiYgaXRlbS5tZXRob2QgPT09ICdvcGVuLXVybCcpLFxuICAgICAgICBmYWxzZSxcbiAgICAgICAgJ2Fzc3VtZV9hdmFpbGFibGUg5qOA5p+l6aG55LiN5bqU6Kem5Y+R55yf5a6e6LCD55SoJ1xuICAgICk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKFxuICAgICAgICBjYWxscy5zb21lKChpdGVtKSA9PiBpdGVtLmNoYW5uZWwgPT09ICdzY2VuZScgJiYgaXRlbS5tZXRob2QgPT09ICdxdWVyeS1pcy1yZWFkeScpLFxuICAgICAgICB0cnVlLFxuICAgICAgICAn5pmu6YCa5qOA5p+l6aG55LuN5bqU5omn6KGMJ1xuICAgICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0Q2FwYWJpbGl0eVByb2JlV2l0aFJlYWRvbmx5RmlsdGVyKCk7XG4gICAgYXdhaXQgdGVzdENhcGFiaWxpdHlQcm9iZUluY2x1ZGVXcml0ZUNoZWNrcygpO1xuICAgIGF3YWl0IHRlc3RDYXBhYmlsaXR5UHJvYmVBc3N1bWVBdmFpbGFibGVTdHJhdGVneSgpO1xuICAgIGNvbnNvbGUubG9nKCduZXh0LWNhcGFiaWxpdHktcHJvYmUtdGVzdDogUEFTUycpO1xufVxuXG5ydW4oKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKCduZXh0LWNhcGFiaWxpdHktcHJvYmUtdGVzdDogRkFJTCcsIGVycm9yKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG59KTtcbiJdfQ==