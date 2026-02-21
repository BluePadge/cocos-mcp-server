import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CapabilityMatrix } from '../next/models';
import { NextToolRegistry } from '../next/protocol/tool-registry';
import { NextMcpRouter } from '../next/protocol/router';
import { createOfficialTools } from '../next/tools/official-tools';

function createMatrix(availableKeys: string[]): CapabilityMatrix {
    const byKey: CapabilityMatrix['byKey'] = {};
    for (const key of availableKeys) {
        const firstDot = key.indexOf('.');
        const channel = key.slice(0, firstDot);
        const method = key.slice(firstDot + 1);
        byKey[key] = {
            key,
            channel,
            method,
            layer: key.startsWith('scene.query-performance') ? 'extended' : 'official',
            readonly: true,
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
                    total: availableKeys.filter((item) => item !== 'scene.query-performance').length,
                    available: availableKeys.filter((item) => item !== 'scene.query-performance').length
                },
                extended: {
                    total: availableKeys.includes('scene.query-performance') ? 1 : 0,
                    available: availableKeys.includes('scene.query-performance') ? 1 : 0
                },
                experimental: {
                    total: 0,
                    available: 0
                }
            }
        }
    };
}

async function testDiagnosticTools(): Promise<void> {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-mcp-diagnostic-'));
    const projectPath = path.join(workspace, 'HelloWorld');
    const logDir = path.join(projectPath, 'temp', 'logs');
    const logFilePath = path.join(logDir, 'project.log');
    const previousEditor = (globalThis as Record<string, any>).Editor;

    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(
        logFilePath,
        [
            '[INFO] Editor booted',
            '[WARN] Deprecated API detected',
            '[ERROR] Compile failed: syntax error',
            '[DEBUG] Plugin scan completed',
            'Plain line without level'
        ].join('\n'),
        'utf8'
    );

    const requester = async (channel: string, method: string, ...args: any[]): Promise<any> => {
        if (channel === 'builder' && method === 'query-worker-ready') {
            return true;
        }
        if (channel === 'scene' && method === 'query-performance') {
            return {
                nodeCount: 12,
                componentCount: 34,
                drawCalls: 5,
                triangles: 1024,
                memory: { total: 2048 }
            };
        }
        if (channel === 'information' && method === 'query-information') {
            return {
                status: 'success',
                data: {
                    id: args[0],
                    label: 'Mock Information',
                    enable: true
                }
            };
        }
        if (channel === 'program' && method === 'query-program-info') {
            return {
                id: args[0],
                title: 'Visual Studio Code',
                exists: true
            };
        }
        if (channel === 'programming' && method === 'query-shared-settings') {
            return {
                autoFixOnSave: true,
                useProjectTs: true
            };
        }
        if (channel === 'programming' && method === 'query-sorted-plugins') {
            return [
                { name: 'asset-check', enabled: true },
                { name: 'lint-bridge', enabled: false }
            ];
        }

        throw new Error(`Unexpected call: ${channel}.${method}(${JSON.stringify(args)})`);
    };

    const tools = createOfficialTools(requester);
    const matrix = createMatrix([
        'builder.query-worker-ready',
        'scene.query-performance',
        'information.query-information',
        'program.query-program-info',
        'programming.query-shared-settings',
        'programming.query-sorted-plugins'
    ]);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    try {
        (globalThis as Record<string, any>).Editor = {
            Project: {
                path: projectPath
            }
        };

        const list = await router.handle({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list'
        });
        assert.ok(list);
        const toolNames = list!.result.tools.map((item: any) => item.name);
        const sharedSettingsMeta = list!.result.tools.find((item: any) => item.name === 'diagnostic_query_shared_settings')?._meta;
        assert.ok(toolNames.includes('diagnostic_check_compile_status'));
        assert.ok(toolNames.includes('diagnostic_get_project_logs'));
        assert.ok(toolNames.includes('diagnostic_get_log_file_info'));
        assert.ok(toolNames.includes('diagnostic_search_project_logs'));
        assert.ok(toolNames.includes('diagnostic_query_performance_snapshot'));
        assert.ok(toolNames.includes('diagnostic_query_information'));
        assert.ok(toolNames.includes('diagnostic_query_program_info'));
        assert.ok(toolNames.includes('diagnostic_query_shared_settings'));
        assert.ok(toolNames.includes('diagnostic_query_sorted_plugins'));
        assert.strictEqual(sharedSettingsMeta?.idempotent, true);
        assert.strictEqual(sharedSettingsMeta?.safety, 'safe');

        const compileStatus = await router.handle({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'diagnostic_check_compile_status',
                arguments: {
                    includeLogSummary: true,
                    lines: 50
                }
            }
        });
        assert.ok(compileStatus);
        assert.strictEqual(compileStatus!.result.isError, false);
        assert.strictEqual(compileStatus!.result.structuredContent.data.ready, true);
        assert.strictEqual(compileStatus!.result.structuredContent.data.logSummary.byLevel.ERROR, 1);
        assert.strictEqual(compileStatus!.result.structuredContent.data.logSummary.byLevel.WARN, 1);
        assert.strictEqual(String(compileStatus!.result.structuredContent.data.logSummary.logFilePath), logFilePath);

        const getLogs = await router.handle({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'diagnostic_get_project_logs',
                arguments: {
                    projectPath,
                    lines: 100,
                    logLevel: 'ERROR',
                    filterKeyword: 'compile'
                }
            }
        });
        assert.ok(getLogs);
        assert.strictEqual(getLogs!.result.isError, false);
        assert.strictEqual(getLogs!.result.structuredContent.data.returnedLines, 1);
        assert.ok(String(getLogs!.result.structuredContent.data.logs[0]).includes('Compile failed'));

        const fileInfo = await router.handle({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'diagnostic_get_log_file_info',
                arguments: {}
            }
        });
        assert.ok(fileInfo);
        assert.strictEqual(fileInfo!.result.isError, false);
        assert.strictEqual(fileInfo!.result.structuredContent.data.lineCount, 5);
        assert.ok(fileInfo!.result.structuredContent.data.fileSize > 0);
        assert.strictEqual(String(fileInfo!.result.structuredContent.data.filePath), logFilePath);

        const searchLogs = await router.handle({
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
                name: 'diagnostic_search_project_logs',
                arguments: {
                    projectPath,
                    pattern: 'Compile failed',
                    useRegex: false,
                    contextLines: 1
                }
            }
        });
        assert.ok(searchLogs);
        assert.strictEqual(searchLogs!.result.isError, false);
        assert.strictEqual(searchLogs!.result.structuredContent.data.totalMatches, 1);
        assert.strictEqual(searchLogs!.result.structuredContent.data.matches[0].lineNumber, 3);

        const performance = await router.handle({
            jsonrpc: '2.0',
            id: 6,
            method: 'tools/call',
            params: {
                name: 'diagnostic_query_performance_snapshot',
                arguments: {}
            }
        });
        assert.ok(performance);
        assert.strictEqual(performance!.result.isError, false);
        assert.strictEqual(performance!.result.structuredContent.data.nodeCount, 12);
        assert.strictEqual(performance!.result.structuredContent.data.drawCalls, 5);

        const info = await router.handle({
            jsonrpc: '2.0',
            id: 7,
            method: 'tools/call',
            params: {
                name: 'diagnostic_query_information',
                arguments: {
                    tag: 'compile-health',
                    force: true
                }
            }
        });
        assert.ok(info);
        assert.strictEqual(info!.result.isError, false);
        assert.strictEqual(info!.result.structuredContent.data.tag, 'compile-health');
        assert.strictEqual(info!.result.structuredContent.data.info.status, 'success');

        const programInfo = await router.handle({
            jsonrpc: '2.0',
            id: 8,
            method: 'tools/call',
            params: {
                name: 'diagnostic_query_program_info',
                arguments: {
                    programId: 'vscode'
                }
            }
        });
        assert.ok(programInfo);
        assert.strictEqual(programInfo!.result.isError, false);
        assert.strictEqual(programInfo!.result.structuredContent.data.programId, 'vscode');

        const shared = await router.handle({
            jsonrpc: '2.0',
            id: 9,
            method: 'tools/call',
            params: {
                name: 'diagnostic_query_shared_settings',
                arguments: {}
            }
        });
        assert.ok(shared);
        assert.strictEqual(shared!.result.isError, false);
        assert.strictEqual(shared!.result.structuredContent.data.settings.autoFixOnSave, true);

        const plugins = await router.handle({
            jsonrpc: '2.0',
            id: 10,
            method: 'tools/call',
            params: {
                name: 'diagnostic_query_sorted_plugins',
                arguments: {
                    options: {
                        onlyEnable: false
                    }
                }
            }
        });
        assert.ok(plugins);
        assert.strictEqual(plugins!.result.isError, false);
        assert.strictEqual(plugins!.result.structuredContent.data.count, 2);
    } finally {
        if (previousEditor === undefined) {
            delete (globalThis as Record<string, any>).Editor;
        } else {
            (globalThis as Record<string, any>).Editor = previousEditor;
        }
        fs.rmSync(workspace, { recursive: true, force: true });
    }
}

async function run(): Promise<void> {
    await testDiagnosticTools();
    console.log('next-diagnostic-tools-test: PASS');
}

run().catch((error) => {
    console.error('next-diagnostic-tools-test: FAIL', error);
    process.exit(1);
});
