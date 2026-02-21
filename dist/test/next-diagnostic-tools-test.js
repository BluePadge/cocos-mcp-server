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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tool_registry_1 = require("../next/protocol/tool-registry");
const router_1 = require("../next/protocol/router");
const official_tools_1 = require("../next/tools/official-tools");
function createMatrix(availableKeys) {
    const byKey = {};
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
async function testDiagnosticTools() {
    var _a;
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-mcp-diagnostic-'));
    const projectPath = path.join(workspace, 'HelloWorld');
    const logDir = path.join(projectPath, 'temp', 'logs');
    const logFilePath = path.join(logDir, 'project.log');
    const previousEditor = globalThis.Editor;
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(logFilePath, [
        '[INFO] Editor booted',
        '[WARN] Deprecated API detected',
        '[ERROR] Compile failed: syntax error',
        '[DEBUG] Plugin scan completed',
        'Plain line without level'
    ].join('\n'), 'utf8');
    const requester = async (channel, method, ...args) => {
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
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const matrix = createMatrix([
        'builder.query-worker-ready',
        'scene.query-performance',
        'information.query-information',
        'program.query-program-info',
        'programming.query-shared-settings',
        'programming.query-sorted-plugins'
    ]);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    try {
        globalThis.Editor = {
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
        const toolNames = list.result.tools.map((item) => item.name);
        const sharedSettingsMeta = (_a = list.result.tools.find((item) => item.name === 'diagnostic_query_shared_settings')) === null || _a === void 0 ? void 0 : _a._meta;
        assert.ok(toolNames.includes('diagnostic_check_compile_status'));
        assert.ok(toolNames.includes('diagnostic_get_project_logs'));
        assert.ok(toolNames.includes('diagnostic_get_log_file_info'));
        assert.ok(toolNames.includes('diagnostic_search_project_logs'));
        assert.ok(toolNames.includes('diagnostic_query_performance_snapshot'));
        assert.ok(toolNames.includes('diagnostic_query_information'));
        assert.ok(toolNames.includes('diagnostic_query_program_info'));
        assert.ok(toolNames.includes('diagnostic_query_shared_settings'));
        assert.ok(toolNames.includes('diagnostic_query_sorted_plugins'));
        assert.strictEqual(sharedSettingsMeta === null || sharedSettingsMeta === void 0 ? void 0 : sharedSettingsMeta.idempotent, true);
        assert.strictEqual(sharedSettingsMeta === null || sharedSettingsMeta === void 0 ? void 0 : sharedSettingsMeta.safety, 'safe');
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
        assert.strictEqual(compileStatus.result.isError, false);
        assert.strictEqual(compileStatus.result.structuredContent.data.ready, true);
        assert.strictEqual(compileStatus.result.structuredContent.data.logSummary.byLevel.ERROR, 1);
        assert.strictEqual(compileStatus.result.structuredContent.data.logSummary.byLevel.WARN, 1);
        assert.strictEqual(String(compileStatus.result.structuredContent.data.logSummary.logFilePath), logFilePath);
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
        assert.strictEqual(getLogs.result.isError, false);
        assert.strictEqual(getLogs.result.structuredContent.data.returnedLines, 1);
        assert.ok(String(getLogs.result.structuredContent.data.logs[0]).includes('Compile failed'));
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
        assert.strictEqual(fileInfo.result.isError, false);
        assert.strictEqual(fileInfo.result.structuredContent.data.lineCount, 5);
        assert.ok(fileInfo.result.structuredContent.data.fileSize > 0);
        assert.strictEqual(String(fileInfo.result.structuredContent.data.filePath), logFilePath);
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
        assert.strictEqual(searchLogs.result.isError, false);
        assert.strictEqual(searchLogs.result.structuredContent.data.totalMatches, 1);
        assert.strictEqual(searchLogs.result.structuredContent.data.matches[0].lineNumber, 3);
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
        assert.strictEqual(performance.result.isError, false);
        assert.strictEqual(performance.result.structuredContent.data.nodeCount, 12);
        assert.strictEqual(performance.result.structuredContent.data.drawCalls, 5);
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
        assert.strictEqual(info.result.isError, false);
        assert.strictEqual(info.result.structuredContent.data.tag, 'compile-health');
        assert.strictEqual(info.result.structuredContent.data.info.status, 'success');
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
        assert.strictEqual(programInfo.result.isError, false);
        assert.strictEqual(programInfo.result.structuredContent.data.programId, 'vscode');
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
        assert.strictEqual(shared.result.isError, false);
        assert.strictEqual(shared.result.structuredContent.data.settings.autoFixOnSave, true);
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
        assert.strictEqual(plugins.result.isError, false);
        assert.strictEqual(plugins.result.structuredContent.data.count, 2);
    }
    finally {
        if (previousEditor === undefined) {
            delete globalThis.Editor;
        }
        else {
            globalThis.Editor = previousEditor;
        }
        fs.rmSync(workspace, { recursive: true, force: true });
    }
}
async function run() {
    await testDiagnosticTools();
    console.log('next-diagnostic-tools-test: PASS');
}
run().catch((error) => {
    console.error('next-diagnostic-tools-test: FAIL', error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1kaWFnbm9zdGljLXRvb2xzLXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC9uZXh0LWRpYWdub3N0aWMtdG9vbHMtdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUNqQyx1Q0FBeUI7QUFDekIsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixrRUFBa0U7QUFDbEUsb0RBQXdEO0FBQ3hELGlFQUFtRTtBQUVuRSxTQUFTLFlBQVksQ0FBQyxhQUF1QjtJQUN6QyxNQUFNLEtBQUssR0FBOEIsRUFBRSxDQUFDO0lBQzVDLEtBQUssTUFBTSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7UUFDOUIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2QyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2QyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDVCxHQUFHO1lBQ0gsT0FBTztZQUNQLE1BQU07WUFDTixLQUFLLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVU7WUFDMUUsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFB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O1lBQ0gsVUFBa0MsQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO1FBQ2hFLENBQUM7UUFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDM0QsQ0FBQztBQUNMLENBQUM7QUFFRCxLQUFLLFVBQVUsR0FBRztJQUNkLE1BQU0sbUJBQW1CLEVBQUUsQ0FBQztJQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7QUFDcEQsQ0FBQztBQUVELEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IENhcGFiaWxpdHlNYXRyaXggfSBmcm9tICcuLi9uZXh0L21vZGVscyc7XG5pbXBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmltcG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3JvdXRlcic7XG5pbXBvcnQgeyBjcmVhdGVPZmZpY2lhbFRvb2xzIH0gZnJvbSAnLi4vbmV4dC90b29scy9vZmZpY2lhbC10b29scyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdHJpeChhdmFpbGFibGVLZXlzOiBzdHJpbmdbXSk6IENhcGFiaWxpdHlNYXRyaXgge1xuICAgIGNvbnN0IGJ5S2V5OiBDYXBhYmlsaXR5TWF0cml4WydieUtleSddID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgb2YgYXZhaWxhYmxlS2V5cykge1xuICAgICAgICBjb25zdCBmaXJzdERvdCA9IGtleS5pbmRleE9mKCcuJyk7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBrZXkuc2xpY2UoMCwgZmlyc3REb3QpO1xuICAgICAgICBjb25zdCBtZXRob2QgPSBrZXkuc2xpY2UoZmlyc3REb3QgKyAxKTtcbiAgICAgICAgYnlLZXlba2V5XSA9IHtcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGNoYW5uZWwsXG4gICAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgICBsYXllcjoga2V5LnN0YXJ0c1dpdGgoJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJykgPyAnZXh0ZW5kZWQnIDogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGtleSxcbiAgICAgICAgICAgIGF2YWlsYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNoZWNrZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgZGV0YWlsOiAnb2snXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ2VuZXJhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgYnlLZXksXG4gICAgICAgIHN1bW1hcnk6IHtcbiAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIGF2YWlsYWJsZTogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICB1bmF2YWlsYWJsZTogMCxcbiAgICAgICAgICAgIGJ5TGF5ZXI6IHtcbiAgICAgICAgICAgICAgICBvZmZpY2lhbDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0gIT09ICdzY2VuZS5xdWVyeS1wZXJmb3JtYW5jZScpLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmZpbHRlcigoaXRlbSkgPT4gaXRlbSAhPT0gJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJykubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHRlbmRlZDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5pbmNsdWRlcygnc2NlbmUucXVlcnktcGVyZm9ybWFuY2UnKSA/IDEgOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMuaW5jbHVkZXMoJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJykgPyAxIDogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0RGlhZ25vc3RpY1Rvb2xzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHdvcmtzcGFjZSA9IGZzLm1rZHRlbXBTeW5jKHBhdGguam9pbihvcy50bXBkaXIoKSwgJ2NvY29zLW1jcC1kaWFnbm9zdGljLScpKTtcbiAgICBjb25zdCBwcm9qZWN0UGF0aCA9IHBhdGguam9pbih3b3Jrc3BhY2UsICdIZWxsb1dvcmxkJyk7XG4gICAgY29uc3QgbG9nRGlyID0gcGF0aC5qb2luKHByb2plY3RQYXRoLCAndGVtcCcsICdsb2dzJyk7XG4gICAgY29uc3QgbG9nRmlsZVBhdGggPSBwYXRoLmpvaW4obG9nRGlyLCAncHJvamVjdC5sb2cnKTtcbiAgICBjb25zdCBwcmV2aW91c0VkaXRvciA9IChnbG9iYWxUaGlzIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLkVkaXRvcjtcblxuICAgIGZzLm1rZGlyU3luYyhsb2dEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGZzLndyaXRlRmlsZVN5bmMoXG4gICAgICAgIGxvZ0ZpbGVQYXRoLFxuICAgICAgICBbXG4gICAgICAgICAgICAnW0lORk9dIEVkaXRvciBib290ZWQnLFxuICAgICAgICAgICAgJ1tXQVJOXSBEZXByZWNhdGVkIEFQSSBkZXRlY3RlZCcsXG4gICAgICAgICAgICAnW0VSUk9SXSBDb21waWxlIGZhaWxlZDogc3ludGF4IGVycm9yJyxcbiAgICAgICAgICAgICdbREVCVUddIFBsdWdpbiBzY2FuIGNvbXBsZXRlZCcsXG4gICAgICAgICAgICAnUGxhaW4gbGluZSB3aXRob3V0IGxldmVsJ1xuICAgICAgICBdLmpvaW4oJ1xcbicpLFxuICAgICAgICAndXRmOCdcbiAgICApO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXN5bmMgKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdidWlsZGVyJyAmJiBtZXRob2QgPT09ICdxdWVyeS13b3JrZXItcmVhZHknKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3NjZW5lJyAmJiBtZXRob2QgPT09ICdxdWVyeS1wZXJmb3JtYW5jZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbm9kZUNvdW50OiAxMixcbiAgICAgICAgICAgICAgICBjb21wb25lbnRDb3VudDogMzQsXG4gICAgICAgICAgICAgICAgZHJhd0NhbGxzOiA1LFxuICAgICAgICAgICAgICAgIHRyaWFuZ2xlczogMTAyNCxcbiAgICAgICAgICAgICAgICBtZW1vcnk6IHsgdG90YWw6IDIwNDggfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2luZm9ybWF0aW9uJyAmJiBtZXRob2QgPT09ICdxdWVyeS1pbmZvcm1hdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnc3VjY2VzcycsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBpZDogYXJnc1swXSxcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdNb2NrIEluZm9ybWF0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3Byb2dyYW0nICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXByb2dyYW0taW5mbycpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaWQ6IGFyZ3NbMF0sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdWaXN1YWwgU3R1ZGlvIENvZGUnLFxuICAgICAgICAgICAgICAgIGV4aXN0czogdHJ1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ3Byb2dyYW1taW5nJyAmJiBtZXRob2QgPT09ICdxdWVyeS1zaGFyZWQtc2V0dGluZ3MnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGF1dG9GaXhPblNhdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgdXNlUHJvamVjdFRzOiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvZ3JhbW1pbmcnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXNvcnRlZC1wbHVnaW5zJykge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdhc3NldC1jaGVjaycsIGVuYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdsaW50LWJyaWRnZScsIGVuYWJsZWQ6IGZhbHNlIH1cbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgY2FsbDogJHtjaGFubmVsfS4ke21ldGhvZH0oJHtKU09OLnN0cmluZ2lmeShhcmdzKX0pYCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IG1hdHJpeCA9IGNyZWF0ZU1hdHJpeChbXG4gICAgICAgICdidWlsZGVyLnF1ZXJ5LXdvcmtlci1yZWFkeScsXG4gICAgICAgICdzY2VuZS5xdWVyeS1wZXJmb3JtYW5jZScsXG4gICAgICAgICdpbmZvcm1hdGlvbi5xdWVyeS1pbmZvcm1hdGlvbicsXG4gICAgICAgICdwcm9ncmFtLnF1ZXJ5LXByb2dyYW0taW5mbycsXG4gICAgICAgICdwcm9ncmFtbWluZy5xdWVyeS1zaGFyZWQtc2V0dGluZ3MnLFxuICAgICAgICAncHJvZ3JhbW1pbmcucXVlcnktc29ydGVkLXBsdWdpbnMnXG4gICAgXSk7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICB0cnkge1xuICAgICAgICAoZ2xvYmFsVGhpcyBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KS5FZGl0b3IgPSB7XG4gICAgICAgICAgICBQcm9qZWN0OiB7XG4gICAgICAgICAgICAgICAgcGF0aDogcHJvamVjdFBhdGhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBsaXN0ID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiAxLFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvbGlzdCdcbiAgICAgICAgfSk7XG4gICAgICAgIGFzc2VydC5vayhsaXN0KTtcbiAgICAgICAgY29uc3QgdG9vbE5hbWVzID0gbGlzdCEucmVzdWx0LnRvb2xzLm1hcCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUpO1xuICAgICAgICBjb25zdCBzaGFyZWRTZXR0aW5nc01ldGEgPSBsaXN0IS5yZXN1bHQudG9vbHMuZmluZCgoaXRlbTogYW55KSA9PiBpdGVtLm5hbWUgPT09ICdkaWFnbm9zdGljX3F1ZXJ5X3NoYXJlZF9zZXR0aW5ncycpPy5fbWV0YTtcbiAgICAgICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZGlhZ25vc3RpY19jaGVja19jb21waWxlX3N0YXR1cycpKTtcbiAgICAgICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZGlhZ25vc3RpY19nZXRfcHJvamVjdF9sb2dzJykpO1xuICAgICAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdkaWFnbm9zdGljX2dldF9sb2dfZmlsZV9pbmZvJykpO1xuICAgICAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdkaWFnbm9zdGljX3NlYXJjaF9wcm9qZWN0X2xvZ3MnKSk7XG4gICAgICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2RpYWdub3N0aWNfcXVlcnlfcGVyZm9ybWFuY2Vfc25hcHNob3QnKSk7XG4gICAgICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2RpYWdub3N0aWNfcXVlcnlfaW5mb3JtYXRpb24nKSk7XG4gICAgICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2RpYWdub3N0aWNfcXVlcnlfcHJvZ3JhbV9pbmZvJykpO1xuICAgICAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdkaWFnbm9zdGljX3F1ZXJ5X3NoYXJlZF9zZXR0aW5ncycpKTtcbiAgICAgICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZGlhZ25vc3RpY19xdWVyeV9zb3J0ZWRfcGx1Z2lucycpKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNoYXJlZFNldHRpbmdzTWV0YT8uaWRlbXBvdGVudCwgdHJ1ZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzaGFyZWRTZXR0aW5nc01ldGE/LnNhZmV0eSwgJ3NhZmUnKTtcblxuICAgICAgICBjb25zdCBjb21waWxlU3RhdHVzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiAyLFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19jaGVja19jb21waWxlX3N0YXR1cycsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGVMb2dTdW1tYXJ5OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBsaW5lczogNTBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhc3NlcnQub2soY29tcGlsZVN0YXR1cyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChjb21waWxlU3RhdHVzIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGlsZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucmVhZHksIHRydWUpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGlsZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubG9nU3VtbWFyeS5ieUxldmVsLkVSUk9SLCAxKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBpbGVTdGF0dXMhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmxvZ1N1bW1hcnkuYnlMZXZlbC5XQVJOLCAxKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKFN0cmluZyhjb21waWxlU3RhdHVzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5sb2dTdW1tYXJ5LmxvZ0ZpbGVQYXRoKSwgbG9nRmlsZVBhdGgpO1xuXG4gICAgICAgIGNvbnN0IGdldExvZ3MgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDMsXG4gICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2dldF9wcm9qZWN0X2xvZ3MnLFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbGluZXM6IDEwMCxcbiAgICAgICAgICAgICAgICAgICAgbG9nTGV2ZWw6ICdFUlJPUicsXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcktleXdvcmQ6ICdjb21waWxlJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFzc2VydC5vayhnZXRMb2dzKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGdldExvZ3MhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChnZXRMb2dzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5yZXR1cm5lZExpbmVzLCAxKTtcbiAgICAgICAgYXNzZXJ0Lm9rKFN0cmluZyhnZXRMb2dzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5sb2dzWzBdKS5pbmNsdWRlcygnQ29tcGlsZSBmYWlsZWQnKSk7XG5cbiAgICAgICAgY29uc3QgZmlsZUluZm8gPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDQsXG4gICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2dldF9sb2dfZmlsZV9pbmZvJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHt9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhc3NlcnQub2soZmlsZUluZm8pO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZUluZm8hLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChmaWxlSW5mbyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubGluZUNvdW50LCA1KTtcbiAgICAgICAgYXNzZXJ0Lm9rKGZpbGVJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5maWxlU2l6ZSA+IDApO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoU3RyaW5nKGZpbGVJbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5maWxlUGF0aCksIGxvZ0ZpbGVQYXRoKTtcblxuICAgICAgICBjb25zdCBzZWFyY2hMb2dzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiA1LFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19zZWFyY2hfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhdHRlcm46ICdDb21waWxlIGZhaWxlZCcsXG4gICAgICAgICAgICAgICAgICAgIHVzZVJlZ2V4OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dExpbmVzOiAxXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKHNlYXJjaExvZ3MpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2VhcmNoTG9ncyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNlYXJjaExvZ3MhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnRvdGFsTWF0Y2hlcywgMSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZWFyY2hMb2dzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5tYXRjaGVzWzBdLmxpbmVOdW1iZXIsIDMpO1xuXG4gICAgICAgIGNvbnN0IHBlcmZvcm1hbmNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiA2LFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9wZXJmb3JtYW5jZV9zbmFwc2hvdCcsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKHBlcmZvcm1hbmNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHBlcmZvcm1hbmNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGVyZm9ybWFuY2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm5vZGVDb3VudCwgMTIpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGVyZm9ybWFuY2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmRyYXdDYWxscywgNSk7XG5cbiAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogNyxcbiAgICAgICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfaW5mb3JtYXRpb24nLFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgICAgICB0YWc6ICdjb21waWxlLWhlYWx0aCcsXG4gICAgICAgICAgICAgICAgICAgIGZvcmNlOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKGluZm8pO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluZm8hLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnRhZywgJ2NvbXBpbGUtaGVhbHRoJyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pbmZvLnN0YXR1cywgJ3N1Y2Nlc3MnKTtcblxuICAgICAgICBjb25zdCBwcm9ncmFtSW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogOCxcbiAgICAgICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfcHJvZ3JhbV9pbmZvJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3JhbUlkOiAndnNjb2RlJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFzc2VydC5vayhwcm9ncmFtSW5mbyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChwcm9ncmFtSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHByb2dyYW1JbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wcm9ncmFtSWQsICd2c2NvZGUnKTtcblxuICAgICAgICBjb25zdCBzaGFyZWQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDksXG4gICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX3F1ZXJ5X3NoYXJlZF9zZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKHNoYXJlZCk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzaGFyZWQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzaGFyZWQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnNldHRpbmdzLmF1dG9GaXhPblNhdmUsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IHBsdWdpbnMgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDEwLFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9zb3J0ZWRfcGx1Z2lucycsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ubHlFbmFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhc3NlcnQub2socGx1Z2lucyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChwbHVnaW5zIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGx1Z2lucyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmIChwcmV2aW91c0VkaXRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkZWxldGUgKGdsb2JhbFRoaXMgYXMgUmVjb3JkPHN0cmluZywgYW55PikuRWRpdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKGdsb2JhbFRoaXMgYXMgUmVjb3JkPHN0cmluZywgYW55PikuRWRpdG9yID0gcHJldmlvdXNFZGl0b3I7XG4gICAgICAgIH1cbiAgICAgICAgZnMucm1TeW5jKHdvcmtzcGFjZSwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRlc3REaWFnbm9zdGljVG9vbHMoKTtcbiAgICBjb25zb2xlLmxvZygnbmV4dC1kaWFnbm9zdGljLXRvb2xzLXRlc3Q6IFBBU1MnKTtcbn1cblxucnVuKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcignbmV4dC1kaWFnbm9zdGljLXRvb2xzLXRlc3Q6IEZBSUwnLCBlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=