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
exports.createDebugDiagnosticTools = createDebugDiagnosticTools;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const common_1 = require("./common");
const DEFAULT_LOG_RELATIVE_PATH = path.join('temp', 'logs', 'project.log');
function clampInt(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    return Math.min(Math.max(Math.floor(num), min), max);
}
function normalizeLogLevel(value) {
    if (typeof value !== 'string') {
        return 'ALL';
    }
    const upper = value.trim().toUpperCase();
    if (upper === 'ALL' || upper === 'ERROR' || upper === 'WARN' || upper === 'INFO' || upper === 'DEBUG' || upper === 'TRACE') {
        return upper;
    }
    return null;
}
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
function uniquePaths(paths) {
    const seen = new Set();
    const result = [];
    for (const filePath of paths) {
        if (!filePath || seen.has(filePath)) {
            continue;
        }
        seen.add(filePath);
        result.push(filePath);
    }
    return result;
}
function findExistingFile(paths) {
    for (const filePath of paths) {
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                return filePath;
            }
        }
        catch (_a) {
            continue;
        }
    }
    return null;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function filterLinesByLevel(lines, logLevel) {
    if (logLevel === 'ALL') {
        return lines;
    }
    const pattern = new RegExp(`(?:\\[|\\b)${logLevel}(?:\\]|\\b)`, 'i');
    return lines.filter((line) => pattern.test(line));
}
function filterLinesByKeyword(lines, keyword) {
    if (!keyword) {
        return lines;
    }
    const lower = keyword.toLowerCase();
    return lines.filter((line) => line.toLowerCase().includes(lower));
}
function summarizeLogLevels(lines) {
    const result = {
        ERROR: 0,
        WARN: 0,
        INFO: 0,
        DEBUG: 0,
        TRACE: 0,
        UNKNOWN: 0
    };
    for (const line of lines) {
        const match = line.match(/(?:\[|\b)(ERROR|WARN|INFO|DEBUG|TRACE)(?:\]|\b)/i);
        if (!match) {
            result.UNKNOWN += 1;
            continue;
        }
        const level = match[1].toUpperCase();
        result[level] = (result[level] || 0) + 1;
    }
    return result;
}
function resolveProjectPathFromConfig(config) {
    if (typeof config === 'string') {
        const value = config.trim();
        return value === '' ? null : value;
    }
    if (!config || typeof config !== 'object') {
        return null;
    }
    const candidates = [
        config.path,
        config.projectPath,
        config.root,
        config.cwd
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim() !== '') {
            return candidate.trim();
        }
    }
    return null;
}
function resolveProjectPathFromEditor() {
    var _a, _b;
    const editorProjectPath = (_b = (_a = globalThis === null || globalThis === void 0 ? void 0 : globalThis.Editor) === null || _a === void 0 ? void 0 : _a.Project) === null || _b === void 0 ? void 0 : _b.path;
    if (typeof editorProjectPath !== 'string') {
        return null;
    }
    const value = editorProjectPath.trim();
    return value === '' ? null : value;
}
function toExistingDirectory(value) {
    if (!value) {
        return null;
    }
    const resolvedPath = path.resolve(value);
    try {
        const stat = fs.statSync(resolvedPath);
        return stat.isDirectory() ? resolvedPath : null;
    }
    catch (_a) {
        return null;
    }
}
async function buildLogCandidates(requester, args) {
    const explicitLogFilePath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.logFilePath);
    const explicitProjectPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.projectPath);
    const projectPathFromEditor = !explicitLogFilePath ? resolveProjectPathFromEditor() : null;
    let projectPathFromConfig = null;
    if (!explicitLogFilePath) {
        try {
            const config = await requester('project', 'query-config', 'project');
            projectPathFromConfig = resolveProjectPathFromConfig(config);
        }
        catch (_a) {
            projectPathFromConfig = null;
        }
    }
    const projectPathCandidates = uniquePaths([
        explicitProjectPath ? path.resolve(explicitProjectPath) : '',
        projectPathFromEditor ? path.resolve(projectPathFromEditor) : '',
        projectPathFromConfig ? path.resolve(projectPathFromConfig) : ''
    ]).filter((item) => toExistingDirectory(item) !== null);
    const candidates = uniquePaths([
        explicitLogFilePath ? path.resolve(explicitLogFilePath) : '',
        ...projectPathCandidates.map((projectPath) => path.join(projectPath, DEFAULT_LOG_RELATIVE_PATH)),
        path.join(process.cwd(), DEFAULT_LOG_RELATIVE_PATH)
    ]);
    return candidates;
}
async function loadProjectLogContent(requester, args) {
    const candidates = await buildLogCandidates(requester, args);
    const logFilePath = findExistingFile(candidates);
    if (!logFilePath) {
        return {
            ok: false,
            error: `未找到 project.log，候选路径：${candidates.join(' | ')}`,
            candidates
        };
    }
    try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        const rawLines = content.split(/\r?\n/);
        const nonEmptyLines = rawLines.filter((line) => line.trim() !== '');
        return {
            ok: true,
            value: {
                logFilePath,
                candidates,
                rawLines,
                nonEmptyLines
            }
        };
    }
    catch (error) {
        return {
            ok: false,
            error: `读取 project.log 失败：${(0, common_1.normalizeError)(error)}`,
            candidates
        };
    }
}
function extractLogSummary(lines) {
    const byLevel = summarizeLogLevels(lines);
    return {
        totalLines: lines.length,
        byLevel,
        hasError: byLevel.ERROR > 0,
        hasWarn: byLevel.WARN > 0
    };
}
function toNumberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function createDebugDiagnosticTools(requester) {
    return [
        {
            name: 'diagnostic_check_compile_status',
            description: '检查构建 worker 状态，并可附带最近日志摘要',
            layer: 'official',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    includeLogSummary: {
                        type: 'boolean',
                        description: '是否附带最近日志摘要，默认 true'
                    },
                    lines: {
                        type: 'number',
                        description: '日志摘要读取行数，默认 200，范围 1-10000'
                    },
                    projectPath: {
                        type: 'string',
                        description: '可选，项目根目录；用于定位 temp/logs/project.log'
                    },
                    logFilePath: {
                        type: 'string',
                        description: '可选，project.log 绝对路径；优先级高于 projectPath'
                    }
                }
            },
            requiredCapabilities: ['builder.query-worker-ready'],
            run: async (args) => {
                const includeLogSummary = (args === null || args === void 0 ? void 0 : args.includeLogSummary) !== false;
                const lines = clampInt(args === null || args === void 0 ? void 0 : args.lines, 200, 1, 10000);
                try {
                    const ready = await requester('builder', 'query-worker-ready');
                    const data = {
                        ready: ready === true,
                        status: ready === true ? 'ready' : 'not_ready'
                    };
                    if (includeLogSummary) {
                        const loaded = await loadProjectLogContent(requester, {
                            projectPath: args === null || args === void 0 ? void 0 : args.projectPath,
                            logFilePath: args === null || args === void 0 ? void 0 : args.logFilePath
                        });
                        if (loaded.ok) {
                            const selectedLines = loaded.value.nonEmptyLines.slice(-lines);
                            data.logSummary = Object.assign({ logFilePath: loaded.value.logFilePath, requestedLines: lines }, extractLogSummary(selectedLines));
                        }
                        else {
                            data.logSummaryError = loaded.error;
                        }
                    }
                    return (0, common_1.ok)(data);
                }
                catch (error) {
                    return (0, common_1.fail)('检查构建状态失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'diagnostic_get_project_logs',
            description: '读取项目 project.log 最近日志',
            layer: 'extended',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    lines: {
                        type: 'number',
                        description: '读取末尾行数，默认 200，范围 1-10000'
                    },
                    logLevel: {
                        type: 'string',
                        enum: ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'],
                        description: '日志级别过滤，默认 ALL'
                    },
                    filterKeyword: {
                        type: 'string',
                        description: '可选，按关键字过滤（不区分大小写）'
                    },
                    projectPath: {
                        type: 'string',
                        description: '可选，项目根目录'
                    },
                    logFilePath: {
                        type: 'string',
                        description: '可选，project.log 绝对路径'
                    }
                }
            },
            requiredCapabilities: [],
            run: async (args) => {
                const lines = clampInt(args === null || args === void 0 ? void 0 : args.lines, 200, 1, 10000);
                const logLevel = normalizeLogLevel(args === null || args === void 0 ? void 0 : args.logLevel);
                if (!logLevel) {
                    return (0, common_1.fail)('logLevel 仅支持 ALL/ERROR/WARN/INFO/DEBUG/TRACE', undefined, 'E_INVALID_ARGUMENT');
                }
                const filterKeyword = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.filterKeyword);
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return (0, common_1.fail)('读取项目日志失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }
                const selectedLines = loaded.value.nonEmptyLines.slice(-lines);
                const byLevel = filterLinesByLevel(selectedLines, logLevel);
                const filtered = filterLinesByKeyword(byLevel, filterKeyword);
                return (0, common_1.ok)({
                    logFilePath: loaded.value.logFilePath,
                    totalLines: loaded.value.nonEmptyLines.length,
                    requestedLines: lines,
                    returnedLines: filtered.length,
                    logLevel,
                    filterKeyword,
                    logs: filtered
                });
            }
        },
        {
            name: 'diagnostic_get_log_file_info',
            description: '查询 project.log 文件信息',
            layer: 'extended',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: {
                        type: 'string',
                        description: '可选，项目根目录'
                    },
                    logFilePath: {
                        type: 'string',
                        description: '可选，project.log 绝对路径'
                    }
                }
            },
            requiredCapabilities: [],
            run: async (args) => {
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return (0, common_1.fail)('查询日志文件信息失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }
                try {
                    const stat = fs.statSync(loaded.value.logFilePath);
                    return (0, common_1.ok)({
                        filePath: loaded.value.logFilePath,
                        fileSize: stat.size,
                        fileSizeFormatted: formatFileSize(stat.size),
                        createdAt: stat.birthtime.toISOString(),
                        modifiedAt: stat.mtime.toISOString(),
                        lineCount: loaded.value.nonEmptyLines.length,
                        candidatePaths: loaded.value.candidates
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('读取日志文件属性失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'diagnostic_search_project_logs',
            description: '按关键字或正则搜索 project.log',
            layer: 'extended',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: '匹配模式（默认按正则解释）'
                    },
                    useRegex: {
                        type: 'boolean',
                        description: '是否按正则匹配，默认 true'
                    },
                    caseSensitive: {
                        type: 'boolean',
                        description: '是否区分大小写，默认 false'
                    },
                    maxResults: {
                        type: 'number',
                        description: '最大返回匹配数，默认 20，范围 1-200'
                    },
                    contextLines: {
                        type: 'number',
                        description: '上下文行数，默认 2，范围 0-10'
                    },
                    projectPath: {
                        type: 'string',
                        description: '可选，项目根目录'
                    },
                    logFilePath: {
                        type: 'string',
                        description: '可选，project.log 绝对路径'
                    }
                },
                required: ['pattern']
            },
            requiredCapabilities: [],
            run: async (args) => {
                const pattern = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.pattern);
                if (!pattern) {
                    return (0, common_1.fail)('pattern 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const useRegex = (args === null || args === void 0 ? void 0 : args.useRegex) !== false;
                const caseSensitive = (args === null || args === void 0 ? void 0 : args.caseSensitive) === true;
                const maxResults = clampInt(args === null || args === void 0 ? void 0 : args.maxResults, 20, 1, 200);
                const contextLines = clampInt(args === null || args === void 0 ? void 0 : args.contextLines, 2, 0, 10);
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return (0, common_1.fail)('搜索项目日志失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }
                let regex;
                try {
                    const source = useRegex ? pattern : escapeRegExp(pattern);
                    regex = new RegExp(source, caseSensitive ? 'g' : 'gi');
                }
                catch (error) {
                    return (0, common_1.fail)('pattern 不是合法正则表达式', (0, common_1.normalizeError)(error), 'E_INVALID_ARGUMENT');
                }
                const matches = [];
                for (let index = 0; index < loaded.value.rawLines.length; index += 1) {
                    if (matches.length >= maxResults) {
                        break;
                    }
                    const line = loaded.value.rawLines[index] || '';
                    regex.lastIndex = 0;
                    if (!regex.test(line)) {
                        continue;
                    }
                    const start = Math.max(0, index - contextLines);
                    const end = Math.min(loaded.value.rawLines.length - 1, index + contextLines);
                    const context = [];
                    for (let cursor = start; cursor <= end; cursor += 1) {
                        context.push({
                            lineNumber: cursor + 1,
                            content: loaded.value.rawLines[cursor] || '',
                            isMatch: cursor === index
                        });
                    }
                    matches.push({
                        lineNumber: index + 1,
                        matchedLine: line,
                        context
                    });
                }
                return (0, common_1.ok)({
                    logFilePath: loaded.value.logFilePath,
                    pattern,
                    useRegex,
                    caseSensitive,
                    maxResults,
                    contextLines,
                    totalLines: loaded.value.rawLines.length,
                    totalMatches: matches.length,
                    matches
                });
            }
        },
        {
            name: 'diagnostic_query_performance_snapshot',
            description: '查询编辑态性能快照（若编辑器支持 scene.query-performance）',
            layer: 'extended',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['scene.query-performance'],
            run: async () => {
                var _a;
                try {
                    const raw = await requester('scene', 'query-performance');
                    return (0, common_1.ok)({
                        nodeCount: toNumberOrNull(raw === null || raw === void 0 ? void 0 : raw.nodeCount),
                        componentCount: toNumberOrNull(raw === null || raw === void 0 ? void 0 : raw.componentCount),
                        drawCalls: toNumberOrNull(raw === null || raw === void 0 ? void 0 : raw.drawCalls),
                        triangles: toNumberOrNull(raw === null || raw === void 0 ? void 0 : raw.triangles),
                        memory: (_a = raw === null || raw === void 0 ? void 0 : raw.memory) !== null && _a !== void 0 ? _a : null,
                        raw
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询性能快照失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'diagnostic_query_information',
            description: '查询 information 模块信息项（问卷/提示等）',
            layer: 'official',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: '信息标签（tag）'
                    },
                    force: {
                        type: 'boolean',
                        description: '是否强制刷新'
                    }
                },
                required: ['tag']
            },
            requiredCapabilities: ['information.query-information'],
            run: async (args) => {
                const tag = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.tag);
                if (!tag) {
                    return (0, common_1.fail)('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                const force = (args === null || args === void 0 ? void 0 : args.force) === true;
                try {
                    const info = force
                        ? await requester('information', 'query-information', tag, { force: true })
                        : await requester('information', 'query-information', tag);
                    return (0, common_1.ok)({
                        tag,
                        force,
                        info,
                        found: info !== null && info !== undefined
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询 information 信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'diagnostic_query_program_info',
            description: '查询指定程序能力信息（program.query-program-info）',
            layer: 'official',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    programId: {
                        type: 'string',
                        description: '程序标识，例如 vscode'
                    }
                },
                required: ['programId']
            },
            requiredCapabilities: ['program.query-program-info'],
            run: async (args) => {
                const programId = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.programId);
                if (!programId) {
                    return (0, common_1.fail)('programId 必填', undefined, 'E_INVALID_ARGUMENT');
                }
                try {
                    const info = await requester('program', 'query-program-info', programId);
                    return (0, common_1.ok)({
                        programId,
                        found: info !== null && info !== undefined,
                        info
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询 program 信息失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'diagnostic_query_shared_settings',
            description: '查询 programming 共享设置（query-shared-settings）',
            layer: 'official',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            requiredCapabilities: ['programming.query-shared-settings'],
            run: async () => {
                try {
                    const settings = await requester('programming', 'query-shared-settings');
                    return (0, common_1.ok)({ settings });
                }
                catch (error) {
                    return (0, common_1.fail)('查询 programming 共享设置失败', (0, common_1.normalizeError)(error));
                }
            }
        },
        {
            name: 'diagnostic_query_sorted_plugins',
            description: '查询 programming 插件脚本顺序（query-sorted-plugins）',
            layer: 'official',
            category: 'diagnostic',
            inputSchema: {
                type: 'object',
                properties: {
                    options: {
                        type: 'object',
                        description: '可选，透传 query-sorted-plugins 的过滤参数'
                    }
                }
            },
            requiredCapabilities: ['programming.query-sorted-plugins'],
            run: async (args) => {
                const options = (args === null || args === void 0 ? void 0 : args.options) && typeof args.options === 'object' ? args.options : undefined;
                try {
                    const plugins = options
                        ? await requester('programming', 'query-sorted-plugins', options)
                        : await requester('programming', 'query-sorted-plugins');
                    const list = Array.isArray(plugins) ? plugins : [];
                    return (0, common_1.ok)({
                        options: options || null,
                        plugins: list,
                        count: list.length
                    });
                }
                catch (error) {
                    return (0, common_1.fail)('查询 programming 插件顺序失败', (0, common_1.normalizeError)(error));
                }
            }
        }
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWctZGlhZ25vc3RpYy10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL2RlYnVnLWRpYWdub3N0aWMtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5UUEsZ0VBeWFDO0FBbHJCRCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLHFDQUFzRTtBQXVCdEUsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFFM0UsU0FBUyxRQUFRLENBQUMsS0FBVSxFQUFFLFFBQWdCLEVBQUUsR0FBVyxFQUFFLEdBQVc7SUFDcEUsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDeEIsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDekQsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsS0FBVTtJQUNqQyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVCLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDekMsSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksS0FBSyxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssS0FBSyxP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RSxRQUFRO3dCQUNkLFdBQVcsRUFBRSxrQ0FBa0M7cUJBQ2xEO2lCQUNKO2FBQ0o7WUFDRCxvQkFBb0IsRUFBRSxDQUFDLGtDQUFrQyxDQUFDO1lBQzFELEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBUyxFQUFFLEVBQUU7Z0JBQ3JCLE1BQU0sT0FBTyxHQUFHLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLE9BQU8sS0FBSSxPQUFPLElBQUksQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7Z0JBRTdGLElBQUksQ0FBQztvQkFDRCxNQUFNLE9BQU8sR0FBRyxPQUFPO3dCQUNuQixDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsYUFBYSxFQUFFLHNCQUFzQixFQUFFLE9BQU8sQ0FBQzt3QkFDakUsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLGFBQWEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO29CQUM3RCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyxJQUFBLFdBQUUsRUFBQzt3QkFDTixPQUFPLEVBQUUsT0FBTyxJQUFJLElBQUk7d0JBQ3hCLE9BQU8sRUFBRSxJQUFJO3dCQUNiLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtxQkFDckIsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyx1QkFBdUIsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgdG9Ob25FbXB0eVN0cmluZyB9IGZyb20gJy4vY29tbW9uJztcblxudHlwZSBMb2dMZXZlbCA9ICdBTEwnIHwgJ0VSUk9SJyB8ICdXQVJOJyB8ICdJTkZPJyB8ICdERUJVRycgfCAnVFJBQ0UnO1xuXG5pbnRlcmZhY2UgTG9nQ29udGV4dExpbmUge1xuICAgIGxpbmVOdW1iZXI6IG51bWJlcjtcbiAgICBjb250ZW50OiBzdHJpbmc7XG4gICAgaXNNYXRjaDogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvZ1NlYXJjaE1hdGNoIHtcbiAgICBsaW5lTnVtYmVyOiBudW1iZXI7XG4gICAgbWF0Y2hlZExpbmU6IHN0cmluZztcbiAgICBjb250ZXh0OiBMb2dDb250ZXh0TGluZVtdO1xufVxuXG5pbnRlcmZhY2UgTG9hZGVkTG9nQ29udGVudCB7XG4gICAgbG9nRmlsZVBhdGg6IHN0cmluZztcbiAgICBjYW5kaWRhdGVzOiBzdHJpbmdbXTtcbiAgICByYXdMaW5lczogc3RyaW5nW107XG4gICAgbm9uRW1wdHlMaW5lczogc3RyaW5nW107XG59XG5cbmNvbnN0IERFRkFVTFRfTE9HX1JFTEFUSVZFX1BBVEggPSBwYXRoLmpvaW4oJ3RlbXAnLCAnbG9ncycsICdwcm9qZWN0LmxvZycpO1xuXG5mdW5jdGlvbiBjbGFtcEludCh2YWx1ZTogYW55LCBmYWxsYmFjazogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IG51bSA9IE51bWJlcih2YWx1ZSk7XG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUobnVtKSkge1xuICAgICAgICByZXR1cm4gZmFsbGJhY2s7XG4gICAgfVxuICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChNYXRoLmZsb29yKG51bSksIG1pbiksIG1heCk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUxvZ0xldmVsKHZhbHVlOiBhbnkpOiBMb2dMZXZlbCB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiAnQUxMJztcbiAgICB9XG4gICAgY29uc3QgdXBwZXIgPSB2YWx1ZS50cmltKCkudG9VcHBlckNhc2UoKTtcbiAgICBpZiAodXBwZXIgPT09ICdBTEwnIHx8IHVwcGVyID09PSAnRVJST1InIHx8IHVwcGVyID09PSAnV0FSTicgfHwgdXBwZXIgPT09ICdJTkZPJyB8fCB1cHBlciA9PT0gJ0RFQlVHJyB8fCB1cHBlciA9PT0gJ1RSQUNFJykge1xuICAgICAgICByZXR1cm4gdXBwZXI7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRGaWxlU2l6ZShieXRlczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCB1bml0cyA9IFsnQicsICdLQicsICdNQicsICdHQiddO1xuICAgIGxldCBzaXplID0gYnl0ZXM7XG4gICAgbGV0IHVuaXRJbmRleCA9IDA7XG5cbiAgICB3aGlsZSAoc2l6ZSA+PSAxMDI0ICYmIHVuaXRJbmRleCA8IHVuaXRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgc2l6ZSAvPSAxMDI0O1xuICAgICAgICB1bml0SW5kZXggKz0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYCR7c2l6ZS50b0ZpeGVkKDIpfSAke3VuaXRzW3VuaXRJbmRleF19YDtcbn1cblxuZnVuY3Rpb24gdW5pcXVlUGF0aHMocGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBwYXRocykge1xuICAgICAgICBpZiAoIWZpbGVQYXRoIHx8IHNlZW4uaGFzKGZpbGVQYXRoKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuICAgICAgICByZXN1bHQucHVzaChmaWxlUGF0aCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGZpbmRFeGlzdGluZ0ZpbGUocGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBwYXRocykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7XG59XG5cbmZ1bmN0aW9uIGZpbHRlckxpbmVzQnlMZXZlbChsaW5lczogc3RyaW5nW10sIGxvZ0xldmVsOiBMb2dMZXZlbCk6IHN0cmluZ1tdIHtcbiAgICBpZiAobG9nTGV2ZWwgPT09ICdBTEwnKSB7XG4gICAgICAgIHJldHVybiBsaW5lcztcbiAgICB9XG4gICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZWdFeHAoYCg/OlxcXFxbfFxcXFxiKSR7bG9nTGV2ZWx9KD86XFxcXF18XFxcXGIpYCwgJ2knKTtcbiAgICByZXR1cm4gbGluZXMuZmlsdGVyKChsaW5lKSA9PiBwYXR0ZXJuLnRlc3QobGluZSkpO1xufVxuXG5mdW5jdGlvbiBmaWx0ZXJMaW5lc0J5S2V5d29yZChsaW5lczogc3RyaW5nW10sIGtleXdvcmQ6IHN0cmluZyB8IG51bGwpOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFrZXl3b3JkKSB7XG4gICAgICAgIHJldHVybiBsaW5lcztcbiAgICB9XG4gICAgY29uc3QgbG93ZXIgPSBrZXl3b3JkLnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIGxpbmVzLmZpbHRlcigobGluZSkgPT4gbGluZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyKSk7XG59XG5cbmZ1bmN0aW9uIHN1bW1hcml6ZUxvZ0xldmVscyhsaW5lczogc3RyaW5nW10pOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+IHtcbiAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgICAgIEVSUk9SOiAwLFxuICAgICAgICBXQVJOOiAwLFxuICAgICAgICBJTkZPOiAwLFxuICAgICAgICBERUJVRzogMCxcbiAgICAgICAgVFJBQ0U6IDAsXG4gICAgICAgIFVOS05PV046IDBcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD86XFxbfFxcYikoRVJST1J8V0FSTnxJTkZPfERFQlVHfFRSQUNFKSg/OlxcXXxcXGIpL2kpO1xuICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICByZXN1bHQuVU5LTk9XTiArPSAxO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZXZlbCA9IG1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIHJlc3VsdFtsZXZlbF0gPSAocmVzdWx0W2xldmVsXSB8fCAwKSArIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVByb2plY3RQYXRoRnJvbUNvbmZpZyhjb25maWc6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGNvbmZpZy50cmltKCk7XG4gICAgICAgIHJldHVybiB2YWx1ZSA9PT0gJycgPyBudWxsIDogdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKCFjb25maWcgfHwgdHlwZW9mIGNvbmZpZyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgKGNvbmZpZyBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KS5wYXRoLFxuICAgICAgICAoY29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLnByb2plY3RQYXRoLFxuICAgICAgICAoY29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLnJvb3QsXG4gICAgICAgIChjb25maWcgYXMgUmVjb3JkPHN0cmluZywgYW55PikuY3dkXG4gICAgXTtcblxuICAgIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjYW5kaWRhdGUgPT09ICdzdHJpbmcnICYmIGNhbmRpZGF0ZS50cmltKCkgIT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FuZGlkYXRlLnRyaW0oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlUHJvamVjdFBhdGhGcm9tRWRpdG9yKCk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGVkaXRvclByb2plY3RQYXRoID0gKGdsb2JhbFRoaXMgYXMgUmVjb3JkPHN0cmluZywgYW55Pik/LkVkaXRvcj8uUHJvamVjdD8ucGF0aDtcbiAgICBpZiAodHlwZW9mIGVkaXRvclByb2plY3RQYXRoICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBlZGl0b3JQcm9qZWN0UGF0aC50cmltKCk7XG4gICAgcmV0dXJuIHZhbHVlID09PSAnJyA/IG51bGwgOiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gdG9FeGlzdGluZ0RpcmVjdG9yeSh2YWx1ZTogc3RyaW5nIHwgbnVsbCk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHZhbHVlKTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMocmVzb2x2ZWRQYXRoKTtcbiAgICAgICAgcmV0dXJuIHN0YXQuaXNEaXJlY3RvcnkoKSA/IHJlc29sdmVkUGF0aCA6IG51bGw7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVpbGRMb2dDYW5kaWRhdGVzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLCBhcmdzOiBhbnkpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgZXhwbGljaXRMb2dGaWxlUGF0aCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ubG9nRmlsZVBhdGgpO1xuICAgIGNvbnN0IGV4cGxpY2l0UHJvamVjdFBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByb2plY3RQYXRoKTtcbiAgICBjb25zdCBwcm9qZWN0UGF0aEZyb21FZGl0b3IgPSAhZXhwbGljaXRMb2dGaWxlUGF0aCA/IHJlc29sdmVQcm9qZWN0UGF0aEZyb21FZGl0b3IoKSA6IG51bGw7XG5cbiAgICBsZXQgcHJvamVjdFBhdGhGcm9tQ29uZmlnOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBpZiAoIWV4cGxpY2l0TG9nRmlsZVBhdGgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHJlcXVlc3RlcigncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpO1xuICAgICAgICAgICAgcHJvamVjdFBhdGhGcm9tQ29uZmlnID0gcmVzb2x2ZVByb2plY3RQYXRoRnJvbUNvbmZpZyhjb25maWcpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHByb2plY3RQYXRoRnJvbUNvbmZpZyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBwcm9qZWN0UGF0aENhbmRpZGF0ZXMgPSB1bmlxdWVQYXRocyhbXG4gICAgICAgIGV4cGxpY2l0UHJvamVjdFBhdGggPyBwYXRoLnJlc29sdmUoZXhwbGljaXRQcm9qZWN0UGF0aCkgOiAnJyxcbiAgICAgICAgcHJvamVjdFBhdGhGcm9tRWRpdG9yID8gcGF0aC5yZXNvbHZlKHByb2plY3RQYXRoRnJvbUVkaXRvcikgOiAnJyxcbiAgICAgICAgcHJvamVjdFBhdGhGcm9tQ29uZmlnID8gcGF0aC5yZXNvbHZlKHByb2plY3RQYXRoRnJvbUNvbmZpZykgOiAnJ1xuICAgIF0pLmZpbHRlcigoaXRlbSkgPT4gdG9FeGlzdGluZ0RpcmVjdG9yeShpdGVtKSAhPT0gbnVsbCk7XG5cbiAgICBjb25zdCBjYW5kaWRhdGVzID0gdW5pcXVlUGF0aHMoW1xuICAgICAgICBleHBsaWNpdExvZ0ZpbGVQYXRoID8gcGF0aC5yZXNvbHZlKGV4cGxpY2l0TG9nRmlsZVBhdGgpIDogJycsXG4gICAgICAgIC4uLnByb2plY3RQYXRoQ2FuZGlkYXRlcy5tYXAoKHByb2plY3RQYXRoKSA9PiBwYXRoLmpvaW4ocHJvamVjdFBhdGgsIERFRkFVTFRfTE9HX1JFTEFUSVZFX1BBVEgpKSxcbiAgICAgICAgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIERFRkFVTFRfTE9HX1JFTEFUSVZFX1BBVEgpXG4gICAgXSk7XG5cbiAgICByZXR1cm4gY2FuZGlkYXRlcztcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZFByb2plY3RMb2dDb250ZW50KFxuICAgIHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyLFxuICAgIGFyZ3M6IGFueVxuKTogUHJvbWlzZTx7IG9rOiB0cnVlOyB2YWx1ZTogTG9hZGVkTG9nQ29udGVudCB9IHwgeyBvazogZmFsc2U7IGVycm9yOiBzdHJpbmc7IGNhbmRpZGF0ZXM6IHN0cmluZ1tdIH0+IHtcbiAgICBjb25zdCBjYW5kaWRhdGVzID0gYXdhaXQgYnVpbGRMb2dDYW5kaWRhdGVzKHJlcXVlc3RlciwgYXJncyk7XG4gICAgY29uc3QgbG9nRmlsZVBhdGggPSBmaW5kRXhpc3RpbmdGaWxlKGNhbmRpZGF0ZXMpO1xuICAgIGlmICghbG9nRmlsZVBhdGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiBg5pyq5om+5YiwIHByb2plY3QubG9n77yM5YCZ6YCJ6Lev5b6E77yaJHtjYW5kaWRhdGVzLmpvaW4oJyB8ICcpfWAsXG4gICAgICAgICAgICBjYW5kaWRhdGVzXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhsb2dGaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgICAgY29uc3QgcmF3TGluZXMgPSBjb250ZW50LnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgICAgIGNvbnN0IG5vbkVtcHR5TGluZXMgPSByYXdMaW5lcy5maWx0ZXIoKGxpbmUpID0+IGxpbmUudHJpbSgpICE9PSAnJyk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgbG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgY2FuZGlkYXRlcyxcbiAgICAgICAgICAgICAgICByYXdMaW5lcyxcbiAgICAgICAgICAgICAgICBub25FbXB0eUxpbmVzXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6IGDor7vlj5YgcHJvamVjdC5sb2cg5aSx6LSl77yaJHtub3JtYWxpemVFcnJvcihlcnJvcil9YCxcbiAgICAgICAgICAgIGNhbmRpZGF0ZXNcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RMb2dTdW1tYXJ5KGxpbmVzOiBzdHJpbmdbXSk6IHtcbiAgICB0b3RhbExpbmVzOiBudW1iZXI7XG4gICAgYnlMZXZlbDogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgICBoYXNFcnJvcjogYm9vbGVhbjtcbiAgICBoYXNXYXJuOiBib29sZWFuO1xufSB7XG4gICAgY29uc3QgYnlMZXZlbCA9IHN1bW1hcml6ZUxvZ0xldmVscyhsaW5lcyk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdG90YWxMaW5lczogbGluZXMubGVuZ3RoLFxuICAgICAgICBieUxldmVsLFxuICAgICAgICBoYXNFcnJvcjogYnlMZXZlbC5FUlJPUiA+IDAsXG4gICAgICAgIGhhc1dhcm46IGJ5TGV2ZWwuV0FSTiA+IDBcbiAgICB9O1xufVxuXG5mdW5jdGlvbiB0b051bWJlck9yTnVsbCh2YWx1ZTogYW55KTogbnVtYmVyIHwgbnVsbCB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSA/IHZhbHVlIDogbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlYnVnRGlhZ25vc3RpY1Rvb2xzKHJlcXVlc3RlcjogRWRpdG9yUmVxdWVzdGVyKTogTmV4dFRvb2xEZWZpbml0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2NoZWNrX2NvbXBpbGVfc3RhdHVzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5qOA5p+l5p6E5bu6IHdvcmtlciDnirbmgIHvvIzlubblj6/pmYTluKbmnIDov5Hml6Xlv5fmkZjopoEnLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2RpYWdub3N0aWMnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGVMb2dTdW1tYXJ5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpumZhOW4puacgOi/keaXpeW/l+aRmOimge+8jOm7mOiupCB0cnVlJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsaW5lczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aXpeW/l+aRmOimgeivu+WPluihjOaVsO+8jOm7mOiupCAyMDDvvIzojIPlm7QgMS0xMDAwMCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzpobnnm67moLnnm67lvZXvvJvnlKjkuo7lrprkvY0gdGVtcC9sb2dzL3Byb2plY3QubG9nJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jHByb2plY3QubG9nIOe7neWvuei3r+W+hO+8m+S8mOWFiOe6p+mrmOS6jiBwcm9qZWN0UGF0aCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydidWlsZGVyLnF1ZXJ5LXdvcmtlci1yZWFkeSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZUxvZ1N1bW1hcnkgPSBhcmdzPy5pbmNsdWRlTG9nU3VtbWFyeSAhPT0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBjbGFtcEludChhcmdzPy5saW5lcywgMjAwLCAxLCAxMDAwMCk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFkeSA9IGF3YWl0IHJlcXVlc3RlcignYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YTogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWR5OiByZWFkeSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogcmVhZHkgPT09IHRydWUgPyAncmVhZHknIDogJ25vdF9yZWFkeSdcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZUxvZ1N1bW1hcnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRlZCA9IGF3YWl0IGxvYWRQcm9qZWN0TG9nQ29udGVudChyZXF1ZXN0ZXIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0UGF0aDogYXJncz8ucHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGFyZ3M/LmxvZ0ZpbGVQYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2FkZWQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3RlZExpbmVzID0gbG9hZGVkLnZhbHVlLm5vbkVtcHR5TGluZXMuc2xpY2UoLWxpbmVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmxvZ1N1bW1hcnkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiBsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZExpbmVzOiBsaW5lcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4uZXh0cmFjdExvZ1N1bW1hcnkoc2VsZWN0ZWRMaW5lcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmxvZ1N1bW1hcnlFcnJvciA9IGxvYWRlZC5lcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayhkYXRhKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmo4Dmn6XmnoTlu7rnirbmgIHlpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfZ2V0X3Byb2plY3RfbG9ncycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ivu+WPlumhueebriBwcm9qZWN0LmxvZyDmnIDov5Hml6Xlv5cnLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2RpYWdub3N0aWMnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIGxpbmVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K+75Y+W5pyr5bC+6KGM5pWw77yM6buY6K6kIDIwMO+8jOiMg+WbtCAxLTEwMDAwJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsb2dMZXZlbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ0FMTCcsICdFUlJPUicsICdXQVJOJywgJ0lORk8nLCAnREVCVUcnLCAnVFJBQ0UnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5pel5b+X57qn5Yir6L+H5ruk77yM6buY6K6kIEFMTCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyS2V5d29yZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOaMieWFs+mUruWtl+i/h+a7pO+8iOS4jeWMuuWIhuWkp+Wwj+WGme+8iSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzpobnnm67moLnnm67lvZUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yMcHJvamVjdC5sb2cg57ud5a+56Lev5b6EJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gY2xhbXBJbnQoYXJncz8ubGluZXMsIDIwMCwgMSwgMTAwMDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvZ0xldmVsID0gbm9ybWFsaXplTG9nTGV2ZWwoYXJncz8ubG9nTGV2ZWwpO1xuICAgICAgICAgICAgICAgIGlmICghbG9nTGV2ZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ2xvZ0xldmVsIOS7heaUr+aMgSBBTEwvRVJST1IvV0FSTi9JTkZPL0RFQlVHL1RSQUNFJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsdGVyS2V5d29yZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uZmlsdGVyS2V5d29yZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9hZGVkID0gYXdhaXQgbG9hZFByb2plY3RMb2dDb250ZW50KHJlcXVlc3RlciwgYXJncyk7XG4gICAgICAgICAgICAgICAgaWYgKCFsb2FkZWQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ivu+WPlumhueebruaXpeW/l+Wksei0pScsIGxvYWRlZC5lcnJvciwgJ0VfTE9HX0ZJTEVfTk9UX0ZPVU5EJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRMaW5lcyA9IGxvYWRlZC52YWx1ZS5ub25FbXB0eUxpbmVzLnNsaWNlKC1saW5lcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnlMZXZlbCA9IGZpbHRlckxpbmVzQnlMZXZlbChzZWxlY3RlZExpbmVzLCBsb2dMZXZlbCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsdGVyZWQgPSBmaWx0ZXJMaW5lc0J5S2V5d29yZChieUxldmVsLCBmaWx0ZXJLZXl3b3JkKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiBsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHRvdGFsTGluZXM6IGxvYWRlZC52YWx1ZS5ub25FbXB0eUxpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkTGluZXM6IGxpbmVzLFxuICAgICAgICAgICAgICAgICAgICByZXR1cm5lZExpbmVzOiBmaWx0ZXJlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIGxvZ0xldmVsLFxuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJLZXl3b3JkLFxuICAgICAgICAgICAgICAgICAgICBsb2dzOiBmaWx0ZXJlZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19nZXRfbG9nX2ZpbGVfaW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBwcm9qZWN0LmxvZyDmlofku7bkv6Hmga8nLFxuICAgICAgICAgICAgbGF5ZXI6ICdleHRlbmRlZCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2RpYWdub3N0aWMnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6aG555uu5qC555uu5b2VJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jHByb2plY3QubG9nIOe7neWvuei3r+W+hCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogW10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2FkZWQgPSBhd2FpdCBsb2FkUHJvamVjdExvZ0NvbnRlbnQocmVxdWVzdGVyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvYWRlZC5vaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+i5pel5b+X5paH5Lu25L+h5oGv5aSx6LSlJywgbG9hZGVkLmVycm9yLCAnRV9MT0dfRklMRV9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMobG9hZGVkLnZhbHVlLmxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlU2l6ZTogc3RhdC5zaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVNpemVGb3JtYXR0ZWQ6IGZvcm1hdEZpbGVTaXplKHN0YXQuc2l6ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IHN0YXQuYmlydGh0aW1lLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RpZmllZEF0OiBzdGF0Lm10aW1lLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lQ291bnQ6IGxvYWRlZC52YWx1ZS5ub25FbXB0eUxpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbmRpZGF0ZVBhdGhzOiBsb2FkZWQudmFsdWUuY2FuZGlkYXRlc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfor7vlj5bml6Xlv5fmlofku7blsZ7mgKflpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfc2VhcmNoX3Byb2plY3RfbG9ncycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aMieWFs+mUruWtl+aIluato+WImeaQnOe0oiBwcm9qZWN0LmxvZycsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WMuemFjeaooeW8j++8iOm7mOiupOaMieato+WImeino+mHiu+8iSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgdXNlUmVnZXg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm5oyJ5q2j5YiZ5Yy56YWN77yM6buY6K6kIHRydWUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGNhc2VTZW5zaXRpdmU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm5Yy65YiG5aSn5bCP5YaZ77yM6buY6K6kIGZhbHNlJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBtYXhSZXN1bHRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5pyA5aSn6L+U5Zue5Yy56YWN5pWw77yM6buY6K6kIDIw77yM6IyD5Zu0IDEtMjAwJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0TGluZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkuIrkuIvmlofooYzmlbDvvIzpu5jorqQgMu+8jOiMg+WbtCAwLTEwJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0UGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmhueebruagueebruW9lSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxwcm9qZWN0LmxvZyDnu53lr7not6/lvoQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3BhdHRlcm4nXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnBhdHRlcm4pO1xuICAgICAgICAgICAgICAgIGlmICghcGF0dGVybikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncGF0dGVybiDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCB1c2VSZWdleCA9IGFyZ3M/LnVzZVJlZ2V4ICE9PSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYXNlU2Vuc2l0aXZlID0gYXJncz8uY2FzZVNlbnNpdGl2ZSA9PT0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhSZXN1bHRzID0gY2xhbXBJbnQoYXJncz8ubWF4UmVzdWx0cywgMjAsIDEsIDIwMCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGV4dExpbmVzID0gY2xhbXBJbnQoYXJncz8uY29udGV4dExpbmVzLCAyLCAwLCAxMCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9hZGVkID0gYXdhaXQgbG9hZFByb2plY3RMb2dDb250ZW50KHJlcXVlc3RlciwgYXJncyk7XG4gICAgICAgICAgICAgICAgaWYgKCFsb2FkZWQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+aQnOe0oumhueebruaXpeW/l+Wksei0pScsIGxvYWRlZC5lcnJvciwgJ0VfTE9HX0ZJTEVfTk9UX0ZPVU5EJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHJlZ2V4OiBSZWdFeHA7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc291cmNlID0gdXNlUmVnZXggPyBwYXR0ZXJuIDogZXNjYXBlUmVnRXhwKHBhdHRlcm4pO1xuICAgICAgICAgICAgICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAoc291cmNlLCBjYXNlU2Vuc2l0aXZlID8gJ2cnIDogJ2dpJyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgncGF0dGVybiDkuI3mmK/lkIjms5XmraPliJnooajovr7lvI8nLCBub3JtYWxpemVFcnJvcihlcnJvciksICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVzOiBMb2dTZWFyY2hNYXRjaFtdID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGxvYWRlZC52YWx1ZS5yYXdMaW5lcy5sZW5ndGg7IGluZGV4ICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMubGVuZ3RoID49IG1heFJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxvYWRlZC52YWx1ZS5yYXdMaW5lc1tpbmRleF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2V4Lmxhc3RJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdChsaW5lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGFydCA9IE1hdGgubWF4KDAsIGluZGV4IC0gY29udGV4dExpbmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW5kID0gTWF0aC5taW4obG9hZGVkLnZhbHVlLnJhd0xpbmVzLmxlbmd0aCAtIDEsIGluZGV4ICsgY29udGV4dExpbmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGV4dDogTG9nQ29udGV4dExpbmVbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBjdXJzb3IgPSBzdGFydDsgY3Vyc29yIDw9IGVuZDsgY3Vyc29yICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZU51bWJlcjogY3Vyc29yICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBsb2FkZWQudmFsdWUucmF3TGluZXNbY3Vyc29yXSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc01hdGNoOiBjdXJzb3IgPT09IGluZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBpbmRleCArIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkTGluZTogbGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGxvYWRlZC52YWx1ZS5sb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybixcbiAgICAgICAgICAgICAgICAgICAgdXNlUmVnZXgsXG4gICAgICAgICAgICAgICAgICAgIGNhc2VTZW5zaXRpdmUsXG4gICAgICAgICAgICAgICAgICAgIG1heFJlc3VsdHMsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRMaW5lcyxcbiAgICAgICAgICAgICAgICAgICAgdG90YWxMaW5lczogbG9hZGVkLnZhbHVlLnJhd0xpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgdG90YWxNYXRjaGVzOiBtYXRjaGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9wZXJmb3JtYW5jZV9zbmFwc2hvdCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoue8lui+keaAgeaAp+iDveW/q+eFp++8iOiLpee8lui+keWZqOaUr+aMgSBzY2VuZS5xdWVyeS1wZXJmb3JtYW5jZe+8iScsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnc2NlbmUucXVlcnktcGVyZm9ybWFuY2UnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhdyA9IGF3YWl0IHJlcXVlc3Rlcignc2NlbmUnLCAncXVlcnktcGVyZm9ybWFuY2UnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVDb3VudDogdG9OdW1iZXJPck51bGwocmF3Py5ub2RlQ291bnQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Q291bnQ6IHRvTnVtYmVyT3JOdWxsKHJhdz8uY29tcG9uZW50Q291bnQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGxzOiB0b051bWJlck9yTnVsbChyYXc/LmRyYXdDYWxscyksXG4gICAgICAgICAgICAgICAgICAgICAgICB0cmlhbmdsZXM6IHRvTnVtYmVyT3JOdWxsKHJhdz8udHJpYW5nbGVzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9yeTogcmF3Py5tZW1vcnkgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhd1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6LmgKfog73lv6vnhaflpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfaW5mb3JtYXRpb24nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgaW5mb3JtYXRpb24g5qih5Z2X5L+h5oGv6aG577yI6Zeu5Y23L+aPkOekuuetie+8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdGFnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5L+h5oGv5qCH562+77yIdGFn77yJJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBmb3JjZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKblvLrliLbliLfmlrAnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3RhZyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnaW5mb3JtYXRpb24ucXVlcnktaW5mb3JtYXRpb24nXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhZyA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8udGFnKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgndGFnIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGZvcmNlID0gYXJncz8uZm9yY2UgPT09IHRydWU7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5mbyA9IGZvcmNlXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcignaW5mb3JtYXRpb24nLCAncXVlcnktaW5mb3JtYXRpb24nLCB0YWcsIHsgZm9yY2U6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYXdhaXQgcmVxdWVzdGVyKCdpbmZvcm1hdGlvbicsICdxdWVyeS1pbmZvcm1hdGlvbicsIHRhZyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YWcsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3VuZDogaW5mbyAhPT0gbnVsbCAmJiBpbmZvICE9PSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIGluZm9ybWF0aW9uIOS/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9wcm9ncmFtX2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6LmjIflrprnqIvluo/og73lipvkv6Hmga/vvIhwcm9ncmFtLnF1ZXJ5LXByb2dyYW0taW5mb++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3JhbUlkOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn56iL5bqP5qCH6K+G77yM5L6L5aaCIHZzY29kZSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncHJvZ3JhbUlkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcm9ncmFtLnF1ZXJ5LXByb2dyYW0taW5mbyddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvZ3JhbUlkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wcm9ncmFtSWQpO1xuICAgICAgICAgICAgICAgIGlmICghcHJvZ3JhbUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwcm9ncmFtSWQg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IHJlcXVlc3RlcigncHJvZ3JhbScsICdxdWVyeS1wcm9ncmFtLWluZm8nLCBwcm9ncmFtSWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvZ3JhbUlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm91bmQ6IGluZm8gIT09IG51bGwgJiYgaW5mbyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5mb1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6IgcHJvZ3JhbSDkv6Hmga/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfc2hhcmVkX3NldHRpbmdzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIHByb2dyYW1taW5nIOWFseS6q+iuvue9ru+8iHF1ZXJ5LXNoYXJlZC1zZXR0aW5nc++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsncHJvZ3JhbW1pbmcucXVlcnktc2hhcmVkLXNldHRpbmdzJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IHJlcXVlc3RlcigncHJvZ3JhbW1pbmcnLCAncXVlcnktc2hhcmVkLXNldHRpbmdzJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7IHNldHRpbmdzIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBwcm9ncmFtbWluZyDlhbHkuqvorr7nva7lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfcXVlcnlfc29ydGVkX3BsdWdpbnMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgcHJvZ3JhbW1pbmcg5o+S5Lu26ISa5pys6aG65bqP77yIcXVlcnktc29ydGVkLXBsdWdpbnPvvIknLFxuICAgICAgICAgICAgbGF5ZXI6ICdvZmZpY2lhbCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ2RpYWdub3N0aWMnLFxuICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzpgI/kvKAgcXVlcnktc29ydGVkLXBsdWdpbnMg55qE6L+H5ruk5Y+C5pWwJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3Byb2dyYW1taW5nLnF1ZXJ5LXNvcnRlZC1wbHVnaW5zJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0gYXJncz8ub3B0aW9ucyAmJiB0eXBlb2YgYXJncy5vcHRpb25zID09PSAnb2JqZWN0JyA/IGFyZ3Mub3B0aW9ucyA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBsdWdpbnMgPSBvcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IHJlcXVlc3RlcigncHJvZ3JhbW1pbmcnLCAncXVlcnktc29ydGVkLXBsdWdpbnMnLCBvcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2dyYW1taW5nJywgJ3F1ZXJ5LXNvcnRlZC1wbHVnaW5zJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3QgPSBBcnJheS5pc0FycmF5KHBsdWdpbnMpID8gcGx1Z2lucyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9ucyB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGx1Z2luczogbGlzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiBsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6IgcHJvZ3JhbW1pbmcg5o+S5Lu26aG65bqP5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBdO1xufVxuIl19