import * as assert from 'assert';
import { CapabilityMatrix } from '../next/models';
import { createOfficialTools } from '../next/tools/official-tools';
import { NextToolRegistry } from '../next/protocol/tool-registry';
import { NextMcpRouter } from '../next/protocol/router';

function createMatrix(availableKeys: string[]): CapabilityMatrix {
    const byKey: CapabilityMatrix['byKey'] = {};
    for (const key of availableKeys) {
        const firstDot = key.indexOf('.');
        byKey[key] = {
            key,
            channel: key.slice(0, firstDot),
            method: key.slice(firstDot + 1),
            layer: 'official',
            readonly: false,
            description: key,
            available: true,
            checkedAt: new Date().toISOString(),
            detail: 'ok'
        };
    }

    return {
        generatedAt: new Date().toISOString(),
        byKey,
        summary: {
            total: availableKeys.length,
            available: availableKeys.length,
            unavailable: 0,
            byLayer: {
                official: {
                    total: availableKeys.length,
                    available: availableKeys.length
                },
                extended: {
                    total: 0,
                    available: 0
                },
                experimental: {
                    total: 0,
                    available: 0
                }
            }
        }
    };
}

async function main(): Promise<void> {
    const openAssetCalls: string[] = [];

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
        if (channel === 'asset-db' && method === 'open-asset') {
            const scenePath = String(args[0] || '');
            openAssetCalls.push(scenePath);

            if (scenePath === 'db://assets/scenes/boot.scene') {
                return undefined;
            }

            throw new Error(`Unexpected scene path: ${scenePath}`);
        }

        throw new Error(`Unexpected call: ${channel}.${method}`);
    };

    const tools = createOfficialTools(requester);
    const registry = new NextToolRegistry(tools, createMatrix(['asset-db.open-asset']));
    const router = new NextMcpRouter(registry);

    const response = await router.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
            name: 'scene_open_scene',
            arguments: {
                sceneUrl: 'db://assets/scenes/boot.scene'
            }
        }
    });

    assert.ok(response);
    assert.strictEqual(response!.result.isError, false);
    assert.strictEqual(response!.result.structuredContent.data.opened, true);
    assert.strictEqual(response!.result.structuredContent.data.sceneUrl, 'db://assets/scenes/boot.scene');
    assert.strictEqual(response!.result.structuredContent.data.resolvedSceneUrl, 'db://assets/scenes/boot.scene');
    assert.strictEqual(response!.result.structuredContent.data.openMethod, 'asset-db.open-asset');
    assert.deepStrictEqual(openAssetCalls, [
        'db://assets/scenes/boot.scene'
    ]);

    console.log('next-scene-open-compat-test: PASS');
}

main().catch((error) => {
    console.error('next-scene-open-compat-test: FAIL');
    console.error(error);
    process.exit(1);
});
