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
                    lines: 50,
                    projectPath
                }
            }
        });
        assert.ok(compileStatus);
        assert.strictEqual(compileStatus.result.isError, false);
        assert.strictEqual(compileStatus.result.structuredContent.data.ready, true);
        assert.strictEqual(compileStatus.result.structuredContent.data.logSummary.byLevel.ERROR, 1);
        assert.strictEqual(compileStatus.result.structuredContent.data.logSummary.byLevel.WARN, 1);
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
                arguments: {
                    projectPath
                }
            }
        });
        assert.ok(fileInfo);
        assert.strictEqual(fileInfo.result.isError, false);
        assert.strictEqual(fileInfo.result.structuredContent.data.lineCount, 5);
        assert.ok(fileInfo.result.structuredContent.data.fileSize > 0);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1kaWFnbm9zdGljLXRvb2xzLXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC9uZXh0LWRpYWdub3N0aWMtdG9vbHMtdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUNqQyx1Q0FBeUI7QUFDekIsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixrRUFBa0U7QUFDbEUsb0RBQXdEO0FBQ3hELGlFQUFtRTtBQUVuRSxTQUFTLFlBQVksQ0FBQyxhQUF1QjtJQUN6QyxNQUFNLEtBQUssR0FBOEIsRUFBRSxDQUFDO0lBQzVDLEtBQUssTUFBTSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7UUFDOUIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2QyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2QyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDVCxHQUFHO1lBQ0gsT0FBTztZQUNQLE1BQU07WUFDTixLQUFLLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVU7WUFDMUUsUUFBUSxFQUFFLElBQUk7WUFDZCxXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFB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ZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ2FwYWJpbGl0eU1hdHJpeCB9IGZyb20gJy4uL25leHQvbW9kZWxzJztcbmltcG9ydCB7IE5leHRUb29sUmVnaXN0cnkgfSBmcm9tICcuLi9uZXh0L3Byb3RvY29sL3Rvb2wtcmVnaXN0cnknO1xuaW1wb3J0IHsgTmV4dE1jcFJvdXRlciB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvcm91dGVyJztcbmltcG9ydCB7IGNyZWF0ZU9mZmljaWFsVG9vbHMgfSBmcm9tICcuLi9uZXh0L3Rvb2xzL29mZmljaWFsLXRvb2xzJztcblxuZnVuY3Rpb24gY3JlYXRlTWF0cml4KGF2YWlsYWJsZUtleXM6IHN0cmluZ1tdKTogQ2FwYWJpbGl0eU1hdHJpeCB7XG4gICAgY29uc3QgYnlLZXk6IENhcGFiaWxpdHlNYXRyaXhbJ2J5S2V5J10gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBhdmFpbGFibGVLZXlzKSB7XG4gICAgICAgIGNvbnN0IGZpcnN0RG90ID0ga2V5LmluZGV4T2YoJy4nKTtcbiAgICAgICAgY29uc3QgY2hhbm5lbCA9IGtleS5zbGljZSgwLCBmaXJzdERvdCk7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IGtleS5zbGljZShmaXJzdERvdCArIDEpO1xuICAgICAgICBieUtleVtrZXldID0ge1xuICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgY2hhbm5lbCxcbiAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgIGxheWVyOiBrZXkuc3RhcnRzV2l0aCgnc2NlbmUucXVlcnktcGVyZm9ybWFuY2UnKSA/ICdleHRlbmRlZCcgOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjoga2V5LFxuICAgICAgICAgICAgYXZhaWxhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBkZXRhaWw6ICdvaydcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBieUtleSxcbiAgICAgICAgc3VtbWFyeToge1xuICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdmFpbGFibGVLZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHVuYXZhaWxhYmxlOiAwLFxuICAgICAgICAgICAgYnlMYXllcjoge1xuICAgICAgICAgICAgICAgIG9mZmljaWFsOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmZpbHRlcigoaXRlbSkgPT4gaXRlbSAhPT0gJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJykubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMuZmlsdGVyKChpdGVtKSA9PiBpdGVtICE9PSAnc2NlbmUucXVlcnktcGVyZm9ybWFuY2UnKS5sZW5ndGhcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGV4dGVuZGVkOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsOiBhdmFpbGFibGVLZXlzLmluY2x1ZGVzKCdzY2VuZS5xdWVyeS1wZXJmb3JtYW5jZScpID8gMSA6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogYXZhaWxhYmxlS2V5cy5pbmNsdWRlcygnc2NlbmUucXVlcnktcGVyZm9ybWFuY2UnKSA/IDEgOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHBlcmltZW50YWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRlc3REaWFnbm9zdGljVG9vbHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgd29ya3NwYWNlID0gZnMubWtkdGVtcFN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCAnY29jb3MtbWNwLWRpYWdub3N0aWMtJykpO1xuICAgIGNvbnN0IHByb2plY3RQYXRoID0gcGF0aC5qb2luKHdvcmtzcGFjZSwgJ0hlbGxvV29ybGQnKTtcbiAgICBjb25zdCBsb2dEaXIgPSBwYXRoLmpvaW4ocHJvamVjdFBhdGgsICd0ZW1wJywgJ2xvZ3MnKTtcbiAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHBhdGguam9pbihsb2dEaXIsICdwcm9qZWN0LmxvZycpO1xuXG4gICAgZnMubWtkaXJTeW5jKGxvZ0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhcbiAgICAgICAgbG9nRmlsZVBhdGgsXG4gICAgICAgIFtcbiAgICAgICAgICAgICdbSU5GT10gRWRpdG9yIGJvb3RlZCcsXG4gICAgICAgICAgICAnW1dBUk5dIERlcHJlY2F0ZWQgQVBJIGRldGVjdGVkJyxcbiAgICAgICAgICAgICdbRVJST1JdIENvbXBpbGUgZmFpbGVkOiBzeW50YXggZXJyb3InLFxuICAgICAgICAgICAgJ1tERUJVR10gUGx1Z2luIHNjYW4gY29tcGxldGVkJyxcbiAgICAgICAgICAgICdQbGFpbiBsaW5lIHdpdGhvdXQgbGV2ZWwnXG4gICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgICd1dGY4J1xuICAgICk7XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2J1aWxkZXInICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXdvcmtlci1yZWFkeScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnc2NlbmUnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXBlcmZvcm1hbmNlJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBub2RlQ291bnQ6IDEyLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudENvdW50OiAzNCxcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbHM6IDUsXG4gICAgICAgICAgICAgICAgdHJpYW5nbGVzOiAxMDI0LFxuICAgICAgICAgICAgICAgIG1lbW9yeTogeyB0b3RhbDogMjA0OCB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAnaW5mb3JtYXRpb24nICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LWluZm9ybWF0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdzdWNjZXNzJyxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBhcmdzWzBdLFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ01vY2sgSW5mb3JtYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGU6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvZ3JhbScgJiYgbWV0aG9kID09PSAncXVlcnktcHJvZ3JhbS1pbmZvJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpZDogYXJnc1swXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Zpc3VhbCBTdHVkaW8gQ29kZScsXG4gICAgICAgICAgICAgICAgZXhpc3RzOiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFubmVsID09PSAncHJvZ3JhbW1pbmcnICYmIG1ldGhvZCA9PT0gJ3F1ZXJ5LXNoYXJlZC1zZXR0aW5ncycpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgYXV0b0ZpeE9uU2F2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICB1c2VQcm9qZWN0VHM6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5uZWwgPT09ICdwcm9ncmFtbWluZycgJiYgbWV0aG9kID09PSAncXVlcnktc29ydGVkLXBsdWdpbnMnKSB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIHsgbmFtZTogJ2Fzc2V0LWNoZWNrJywgZW5hYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ2xpbnQtYnJpZGdlJywgZW5hYmxlZDogZmFsc2UgfVxuICAgICAgICAgICAgXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBjYWxsOiAke2NoYW5uZWx9LiR7bWV0aG9kfSgke0pTT04uc3RyaW5naWZ5KGFyZ3MpfSlgKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gY3JlYXRlTWF0cml4KFtcbiAgICAgICAgJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5JyxcbiAgICAgICAgJ3NjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNlJyxcbiAgICAgICAgJ2luZm9ybWF0aW9uLnF1ZXJ5LWluZm9ybWF0aW9uJyxcbiAgICAgICAgJ3Byb2dyYW0ucXVlcnktcHJvZ3JhbS1pbmZvJyxcbiAgICAgICAgJ3Byb2dyYW1taW5nLnF1ZXJ5LXNoYXJlZC1zZXR0aW5ncycsXG4gICAgICAgICdwcm9ncmFtbWluZy5xdWVyeS1zb3J0ZWQtcGx1Z2lucydcbiAgICBdKTtcbiAgICBjb25zdCByZWdpc3RyeSA9IG5ldyBOZXh0VG9vbFJlZ2lzdHJ5KHRvb2xzLCBtYXRyaXgpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDEsXG4gICAgICAgICAgICBtZXRob2Q6ICd0b29scy9saXN0J1xuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKGxpc3QpO1xuICAgICAgICBjb25zdCB0b29sTmFtZXMgPSBsaXN0IS5yZXN1bHQudG9vbHMubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSk7XG4gICAgICAgIGNvbnN0IHNoYXJlZFNldHRpbmdzTWV0YSA9IGxpc3QhLnJlc3VsdC50b29scy5maW5kKChpdGVtOiBhbnkpID0+IGl0ZW0ubmFtZSA9PT0gJ2RpYWdub3N0aWNfcXVlcnlfc2hhcmVkX3NldHRpbmdzJyk/Ll9tZXRhO1xuICAgICAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdkaWFnbm9zdGljX2NoZWNrX2NvbXBpbGVfc3RhdHVzJykpO1xuICAgICAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdkaWFnbm9zdGljX2dldF9wcm9qZWN0X2xvZ3MnKSk7XG4gICAgICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2RpYWdub3N0aWNfZ2V0X2xvZ19maWxlX2luZm8nKSk7XG4gICAgICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2RpYWdub3N0aWNfc2VhcmNoX3Byb2plY3RfbG9ncycpKTtcbiAgICAgICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZGlhZ25vc3RpY19xdWVyeV9wZXJmb3JtYW5jZV9zbmFwc2hvdCcpKTtcbiAgICAgICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZGlhZ25vc3RpY19xdWVyeV9pbmZvcm1hdGlvbicpKTtcbiAgICAgICAgYXNzZXJ0Lm9rKHRvb2xOYW1lcy5pbmNsdWRlcygnZGlhZ25vc3RpY19xdWVyeV9wcm9ncmFtX2luZm8nKSk7XG4gICAgICAgIGFzc2VydC5vayh0b29sTmFtZXMuaW5jbHVkZXMoJ2RpYWdub3N0aWNfcXVlcnlfc2hhcmVkX3NldHRpbmdzJykpO1xuICAgICAgICBhc3NlcnQub2sodG9vbE5hbWVzLmluY2x1ZGVzKCdkaWFnbm9zdGljX3F1ZXJ5X3NvcnRlZF9wbHVnaW5zJykpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2hhcmVkU2V0dGluZ3NNZXRhPy5pZGVtcG90ZW50LCB0cnVlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNoYXJlZFNldHRpbmdzTWV0YT8uc2FmZXR5LCAnc2FmZScpO1xuXG4gICAgICAgIGNvbnN0IGNvbXBpbGVTdGF0dXMgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDIsXG4gICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2NoZWNrX2NvbXBpbGVfc3RhdHVzJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUxvZ1N1bW1hcnk6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVzOiA1MCxcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGhcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhc3NlcnQub2soY29tcGlsZVN0YXR1cyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChjb21waWxlU3RhdHVzIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGlsZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucmVhZHksIHRydWUpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGlsZVN0YXR1cyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubG9nU3VtbWFyeS5ieUxldmVsLkVSUk9SLCAxKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBpbGVTdGF0dXMhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmxvZ1N1bW1hcnkuYnlMZXZlbC5XQVJOLCAxKTtcblxuICAgICAgICBjb25zdCBnZXRMb2dzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiAzLFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19nZXRfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVzOiAxMDAsXG4gICAgICAgICAgICAgICAgICAgIGxvZ0xldmVsOiAnRVJST1InLFxuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJLZXl3b3JkOiAnY29tcGlsZSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhc3NlcnQub2soZ2V0TG9ncyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChnZXRMb2dzIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TG9ncyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucmV0dXJuZWRMaW5lcywgMSk7XG4gICAgICAgIGFzc2VydC5vayhTdHJpbmcoZ2V0TG9ncyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEubG9nc1swXSkuaW5jbHVkZXMoJ0NvbXBpbGUgZmFpbGVkJykpO1xuXG4gICAgICAgIGNvbnN0IGZpbGVJbmZvID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiA0LFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19nZXRfbG9nX2ZpbGVfaW5mbycsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKGZpbGVJbmZvKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGZpbGVJbmZvIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZUluZm8hLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmxpbmVDb3VudCwgNSk7XG4gICAgICAgIGFzc2VydC5vayhmaWxlSW5mbyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuZmlsZVNpemUgPiAwKTtcblxuICAgICAgICBjb25zdCBzZWFyY2hMb2dzID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiA1LFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19zZWFyY2hfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhdHRlcm46ICdDb21waWxlIGZhaWxlZCcsXG4gICAgICAgICAgICAgICAgICAgIHVzZVJlZ2V4OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dExpbmVzOiAxXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKHNlYXJjaExvZ3MpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoc2VhcmNoTG9ncyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHNlYXJjaExvZ3MhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnRvdGFsTWF0Y2hlcywgMSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzZWFyY2hMb2dzIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5tYXRjaGVzWzBdLmxpbmVOdW1iZXIsIDMpO1xuXG4gICAgICAgIGNvbnN0IHBlcmZvcm1hbmNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiA2LFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9wZXJmb3JtYW5jZV9zbmFwc2hvdCcsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKHBlcmZvcm1hbmNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHBlcmZvcm1hbmNlIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGVyZm9ybWFuY2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLm5vZGVDb3VudCwgMTIpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGVyZm9ybWFuY2UhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLmRyYXdDYWxscywgNSk7XG5cbiAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogNyxcbiAgICAgICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfaW5mb3JtYXRpb24nLFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgICAgICB0YWc6ICdjb21waWxlLWhlYWx0aCcsXG4gICAgICAgICAgICAgICAgICAgIGZvcmNlOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKGluZm8pO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoaW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGluZm8hLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnRhZywgJ2NvbXBpbGUtaGVhbHRoJyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5pbmZvLnN0YXR1cywgJ3N1Y2Nlc3MnKTtcblxuICAgICAgICBjb25zdCBwcm9ncmFtSW5mbyA9IGF3YWl0IHJvdXRlci5oYW5kbGUoe1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogOCxcbiAgICAgICAgICAgIG1ldGhvZDogJ3Rvb2xzL2NhbGwnLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfcHJvZ3JhbV9pbmZvJyxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3JhbUlkOiAndnNjb2RlJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFzc2VydC5vayhwcm9ncmFtSW5mbyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChwcm9ncmFtSW5mbyEucmVzdWx0LmlzRXJyb3IsIGZhbHNlKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHByb2dyYW1JbmZvIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5wcm9ncmFtSWQsICd2c2NvZGUnKTtcblxuICAgICAgICBjb25zdCBzaGFyZWQgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDksXG4gICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX3F1ZXJ5X3NoYXJlZF9zZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7fVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXNzZXJ0Lm9rKHNoYXJlZCk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzaGFyZWQhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChzaGFyZWQhLnJlc3VsdC5zdHJ1Y3R1cmVkQ29udGVudC5kYXRhLnNldHRpbmdzLmF1dG9GaXhPblNhdmUsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IHBsdWdpbnMgPSBhd2FpdCByb3V0ZXIuaGFuZGxlKHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQ6IDEwLFxuICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9zb3J0ZWRfcGx1Z2lucycsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ubHlFbmFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhc3NlcnQub2socGx1Z2lucyk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChwbHVnaW5zIS5yZXN1bHQuaXNFcnJvciwgZmFsc2UpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocGx1Z2lucyEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuY291bnQsIDIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICAgIGZzLnJtU3luYyh3b3Jrc3BhY2UsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0ZXN0RGlhZ25vc3RpY1Rvb2xzKCk7XG4gICAgY29uc29sZS5sb2coJ25leHQtZGlhZ25vc3RpYy10b29scy10ZXN0OiBQQVNTJyk7XG59XG5cbnJ1bigpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoJ25leHQtZGlhZ25vc3RpYy10b29scy10ZXN0OiBGQUlMJywgZXJyb3IpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbn0pO1xuIl19