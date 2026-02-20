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
async function buildLogCandidates(requester, args) {
    const explicitLogFilePath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.logFilePath);
    const explicitProjectPath = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.projectPath);
    let projectPathFromConfig = null;
    if (!explicitLogFilePath && !explicitProjectPath) {
        try {
            const config = await requester('project', 'query-config', 'project');
            projectPathFromConfig = resolveProjectPathFromConfig(config);
        }
        catch (_a) {
            projectPathFromConfig = null;
        }
    }
    const candidates = uniquePaths([
        explicitLogFilePath ? path.resolve(explicitLogFilePath) : '',
        explicitProjectPath ? path.join(path.resolve(explicitProjectPath), DEFAULT_LOG_RELATIVE_PATH) : '',
        projectPathFromConfig ? path.join(path.resolve(projectPathFromConfig), DEFAULT_LOG_RELATIVE_PATH) : '',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWctZGlhZ25vc3RpYy10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL2RlYnVnLWRpYWdub3N0aWMtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE0T0EsZ0VBeWFDO0FBcnBCRCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLHFDQUFzRTtBQXVCdEUsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFFM0UsU0FBUyxRQUFRLENBQUMsS0FBVSxFQUFFLFFBQWdCLEVBQUUsR0FBVyxFQUFFLEdBQVc7SUFDcEUsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDeEIsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDekQsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsS0FBVTtJQUNqQyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVCLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDekMsSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksS0FBSyxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssS0FBSyxP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LEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBUyxFQUFFLEVBQUU7Z0JBQ3JCLE1BQU0sT0FBTyxHQUFHLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLE9BQU8sS0FBSSxPQUFPLElBQUksQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7Z0JBRTdGLElBQUksQ0FBQztvQkFDRCxNQUFNLE9BQU8sR0FBRyxPQUFPO3dCQUNuQixDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsYUFBYSxFQUFFLHNCQUFzQixFQUFFLE9BQU8sQ0FBQzt3QkFDakUsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLGFBQWEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO29CQUM3RCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyxJQUFBLFdBQUUsRUFBQzt3QkFDTixPQUFPLEVBQUUsT0FBTyxJQUFJLElBQUk7d0JBQ3hCLE9BQU8sRUFBRSxJQUFJO3dCQUNiLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtxQkFDckIsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyx1QkFBdUIsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgdG9Ob25FbXB0eVN0cmluZyB9IGZyb20gJy4vY29tbW9uJztcblxudHlwZSBMb2dMZXZlbCA9ICdBTEwnIHwgJ0VSUk9SJyB8ICdXQVJOJyB8ICdJTkZPJyB8ICdERUJVRycgfCAnVFJBQ0UnO1xuXG5pbnRlcmZhY2UgTG9nQ29udGV4dExpbmUge1xuICAgIGxpbmVOdW1iZXI6IG51bWJlcjtcbiAgICBjb250ZW50OiBzdHJpbmc7XG4gICAgaXNNYXRjaDogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvZ1NlYXJjaE1hdGNoIHtcbiAgICBsaW5lTnVtYmVyOiBudW1iZXI7XG4gICAgbWF0Y2hlZExpbmU6IHN0cmluZztcbiAgICBjb250ZXh0OiBMb2dDb250ZXh0TGluZVtdO1xufVxuXG5pbnRlcmZhY2UgTG9hZGVkTG9nQ29udGVudCB7XG4gICAgbG9nRmlsZVBhdGg6IHN0cmluZztcbiAgICBjYW5kaWRhdGVzOiBzdHJpbmdbXTtcbiAgICByYXdMaW5lczogc3RyaW5nW107XG4gICAgbm9uRW1wdHlMaW5lczogc3RyaW5nW107XG59XG5cbmNvbnN0IERFRkFVTFRfTE9HX1JFTEFUSVZFX1BBVEggPSBwYXRoLmpvaW4oJ3RlbXAnLCAnbG9ncycsICdwcm9qZWN0LmxvZycpO1xuXG5mdW5jdGlvbiBjbGFtcEludCh2YWx1ZTogYW55LCBmYWxsYmFjazogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IG51bSA9IE51bWJlcih2YWx1ZSk7XG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUobnVtKSkge1xuICAgICAgICByZXR1cm4gZmFsbGJhY2s7XG4gICAgfVxuICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChNYXRoLmZsb29yKG51bSksIG1pbiksIG1heCk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUxvZ0xldmVsKHZhbHVlOiBhbnkpOiBMb2dMZXZlbCB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiAnQUxMJztcbiAgICB9XG4gICAgY29uc3QgdXBwZXIgPSB2YWx1ZS50cmltKCkudG9VcHBlckNhc2UoKTtcbiAgICBpZiAodXBwZXIgPT09ICdBTEwnIHx8IHVwcGVyID09PSAnRVJST1InIHx8IHVwcGVyID09PSAnV0FSTicgfHwgdXBwZXIgPT09ICdJTkZPJyB8fCB1cHBlciA9PT0gJ0RFQlVHJyB8fCB1cHBlciA9PT0gJ1RSQUNFJykge1xuICAgICAgICByZXR1cm4gdXBwZXI7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRGaWxlU2l6ZShieXRlczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCB1bml0cyA9IFsnQicsICdLQicsICdNQicsICdHQiddO1xuICAgIGxldCBzaXplID0gYnl0ZXM7XG4gICAgbGV0IHVuaXRJbmRleCA9IDA7XG5cbiAgICB3aGlsZSAoc2l6ZSA+PSAxMDI0ICYmIHVuaXRJbmRleCA8IHVuaXRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgc2l6ZSAvPSAxMDI0O1xuICAgICAgICB1bml0SW5kZXggKz0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYCR7c2l6ZS50b0ZpeGVkKDIpfSAke3VuaXRzW3VuaXRJbmRleF19YDtcbn1cblxuZnVuY3Rpb24gdW5pcXVlUGF0aHMocGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBwYXRocykge1xuICAgICAgICBpZiAoIWZpbGVQYXRoIHx8IHNlZW4uaGFzKGZpbGVQYXRoKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuICAgICAgICByZXN1bHQucHVzaChmaWxlUGF0aCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGZpbmRFeGlzdGluZ0ZpbGUocGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBwYXRocykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7XG59XG5cbmZ1bmN0aW9uIGZpbHRlckxpbmVzQnlMZXZlbChsaW5lczogc3RyaW5nW10sIGxvZ0xldmVsOiBMb2dMZXZlbCk6IHN0cmluZ1tdIHtcbiAgICBpZiAobG9nTGV2ZWwgPT09ICdBTEwnKSB7XG4gICAgICAgIHJldHVybiBsaW5lcztcbiAgICB9XG4gICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZWdFeHAoYCg/OlxcXFxbfFxcXFxiKSR7bG9nTGV2ZWx9KD86XFxcXF18XFxcXGIpYCwgJ2knKTtcbiAgICByZXR1cm4gbGluZXMuZmlsdGVyKChsaW5lKSA9PiBwYXR0ZXJuLnRlc3QobGluZSkpO1xufVxuXG5mdW5jdGlvbiBmaWx0ZXJMaW5lc0J5S2V5d29yZChsaW5lczogc3RyaW5nW10sIGtleXdvcmQ6IHN0cmluZyB8IG51bGwpOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFrZXl3b3JkKSB7XG4gICAgICAgIHJldHVybiBsaW5lcztcbiAgICB9XG4gICAgY29uc3QgbG93ZXIgPSBrZXl3b3JkLnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIGxpbmVzLmZpbHRlcigobGluZSkgPT4gbGluZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyKSk7XG59XG5cbmZ1bmN0aW9uIHN1bW1hcml6ZUxvZ0xldmVscyhsaW5lczogc3RyaW5nW10pOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+IHtcbiAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgICAgIEVSUk9SOiAwLFxuICAgICAgICBXQVJOOiAwLFxuICAgICAgICBJTkZPOiAwLFxuICAgICAgICBERUJVRzogMCxcbiAgICAgICAgVFJBQ0U6IDAsXG4gICAgICAgIFVOS05PV046IDBcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD86XFxbfFxcYikoRVJST1J8V0FSTnxJTkZPfERFQlVHfFRSQUNFKSg/OlxcXXxcXGIpL2kpO1xuICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICByZXN1bHQuVU5LTk9XTiArPSAxO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZXZlbCA9IG1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIHJlc3VsdFtsZXZlbF0gPSAocmVzdWx0W2xldmVsXSB8fCAwKSArIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVByb2plY3RQYXRoRnJvbUNvbmZpZyhjb25maWc6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGNvbmZpZy50cmltKCk7XG4gICAgICAgIHJldHVybiB2YWx1ZSA9PT0gJycgPyBudWxsIDogdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKCFjb25maWcgfHwgdHlwZW9mIGNvbmZpZyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICAgKGNvbmZpZyBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KS5wYXRoLFxuICAgICAgICAoY29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLnByb2plY3RQYXRoLFxuICAgICAgICAoY29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLnJvb3QsXG4gICAgICAgIChjb25maWcgYXMgUmVjb3JkPHN0cmluZywgYW55PikuY3dkXG4gICAgXTtcblxuICAgIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjYW5kaWRhdGUgPT09ICdzdHJpbmcnICYmIGNhbmRpZGF0ZS50cmltKCkgIT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FuZGlkYXRlLnRyaW0oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBidWlsZExvZ0NhbmRpZGF0ZXMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsIGFyZ3M6IGFueSk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBleHBsaWNpdExvZ0ZpbGVQYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5sb2dGaWxlUGF0aCk7XG4gICAgY29uc3QgZXhwbGljaXRQcm9qZWN0UGF0aCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucHJvamVjdFBhdGgpO1xuXG4gICAgbGV0IHByb2plY3RQYXRoRnJvbUNvbmZpZzogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgaWYgKCFleHBsaWNpdExvZ0ZpbGVQYXRoICYmICFleHBsaWNpdFByb2plY3RQYXRoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKTtcbiAgICAgICAgICAgIHByb2plY3RQYXRoRnJvbUNvbmZpZyA9IHJlc29sdmVQcm9qZWN0UGF0aEZyb21Db25maWcoY29uZmlnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBwcm9qZWN0UGF0aEZyb21Db25maWcgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IHVuaXF1ZVBhdGhzKFtcbiAgICAgICAgZXhwbGljaXRMb2dGaWxlUGF0aCA/IHBhdGgucmVzb2x2ZShleHBsaWNpdExvZ0ZpbGVQYXRoKSA6ICcnLFxuICAgICAgICBleHBsaWNpdFByb2plY3RQYXRoID8gcGF0aC5qb2luKHBhdGgucmVzb2x2ZShleHBsaWNpdFByb2plY3RQYXRoKSwgREVGQVVMVF9MT0dfUkVMQVRJVkVfUEFUSCkgOiAnJyxcbiAgICAgICAgcHJvamVjdFBhdGhGcm9tQ29uZmlnID8gcGF0aC5qb2luKHBhdGgucmVzb2x2ZShwcm9qZWN0UGF0aEZyb21Db25maWcpLCBERUZBVUxUX0xPR19SRUxBVElWRV9QQVRIKSA6ICcnLFxuICAgICAgICBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgREVGQVVMVF9MT0dfUkVMQVRJVkVfUEFUSClcbiAgICBdKTtcblxuICAgIHJldHVybiBjYW5kaWRhdGVzO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvamVjdExvZ0NvbnRlbnQoXG4gICAgcmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIsXG4gICAgYXJnczogYW55XG4pOiBQcm9taXNlPHsgb2s6IHRydWU7IHZhbHVlOiBMb2FkZWRMb2dDb250ZW50IH0gfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZzsgY2FuZGlkYXRlczogc3RyaW5nW10gfT4ge1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBhd2FpdCBidWlsZExvZ0NhbmRpZGF0ZXMocmVxdWVzdGVyLCBhcmdzKTtcbiAgICBjb25zdCBsb2dGaWxlUGF0aCA9IGZpbmRFeGlzdGluZ0ZpbGUoY2FuZGlkYXRlcyk7XG4gICAgaWYgKCFsb2dGaWxlUGF0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6IGDmnKrmib7liLAgcHJvamVjdC5sb2fvvIzlgJnpgInot6/lvoTvvJoke2NhbmRpZGF0ZXMuam9pbignIHwgJyl9YCxcbiAgICAgICAgICAgIGNhbmRpZGF0ZXNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCAndXRmOCcpO1xuICAgICAgICBjb25zdCByYXdMaW5lcyA9IGNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICAgICAgY29uc3Qgbm9uRW1wdHlMaW5lcyA9IHJhd0xpbmVzLmZpbHRlcigobGluZSkgPT4gbGluZS50cmltKCkgIT09ICcnKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICBjYW5kaWRhdGVzLFxuICAgICAgICAgICAgICAgIHJhd0xpbmVzLFxuICAgICAgICAgICAgICAgIG5vbkVtcHR5TGluZXNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogYOivu+WPliBwcm9qZWN0LmxvZyDlpLHotKXvvJoke25vcm1hbGl6ZUVycm9yKGVycm9yKX1gLFxuICAgICAgICAgICAgY2FuZGlkYXRlc1xuICAgICAgICB9O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdExvZ1N1bW1hcnkobGluZXM6IHN0cmluZ1tdKToge1xuICAgIHRvdGFsTGluZXM6IG51bWJlcjtcbiAgICBieUxldmVsOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+O1xuICAgIGhhc0Vycm9yOiBib29sZWFuO1xuICAgIGhhc1dhcm46IGJvb2xlYW47XG59IHtcbiAgICBjb25zdCBieUxldmVsID0gc3VtbWFyaXplTG9nTGV2ZWxzKGxpbmVzKTtcbiAgICByZXR1cm4ge1xuICAgICAgICB0b3RhbExpbmVzOiBsaW5lcy5sZW5ndGgsXG4gICAgICAgIGJ5TGV2ZWwsXG4gICAgICAgIGhhc0Vycm9yOiBieUxldmVsLkVSUk9SID4gMCxcbiAgICAgICAgaGFzV2FybjogYnlMZXZlbC5XQVJOID4gMFxuICAgIH07XG59XG5cbmZ1bmN0aW9uIHRvTnVtYmVyT3JOdWxsKHZhbHVlOiBhbnkpOiBudW1iZXIgfCBudWxsIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpID8gdmFsdWUgOiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVidWdEaWFnbm9zdGljVG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2RpYWdub3N0aWNfY2hlY2tfY29tcGlsZV9zdGF0dXMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmo4Dmn6XmnoTlu7ogd29ya2VyIOeKtuaAge+8jOW5tuWPr+mZhOW4puacgOi/keaXpeW/l+aRmOimgScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUxvZ1N1bW1hcnk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5piv5ZCm6ZmE5bim5pyA6L+R5pel5b+X5pGY6KaB77yM6buY6K6kIHRydWUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxpbmVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5pel5b+X5pGY6KaB6K+75Y+W6KGM5pWw77yM6buY6K6kIDIwMO+8jOiMg+WbtCAxLTEwMDAwJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0UGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmhueebruagueebruW9le+8m+eUqOS6juWumuS9jSB0ZW1wL2xvZ3MvcHJvamVjdC5sb2cnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yMcHJvamVjdC5sb2cg57ud5a+56Lev5b6E77yb5LyY5YWI57qn6auY5LqOIHByb2plY3RQYXRoJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ2J1aWxkZXIucXVlcnktd29ya2VyLXJlYWR5J10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmNsdWRlTG9nU3VtbWFyeSA9IGFyZ3M/LmluY2x1ZGVMb2dTdW1tYXJ5ICE9PSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IGNsYW1wSW50KGFyZ3M/LmxpbmVzLCAyMDAsIDEsIDEwMDAwKTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlYWR5ID0gYXdhaXQgcmVxdWVzdGVyKCdidWlsZGVyJywgJ3F1ZXJ5LXdvcmtlci1yZWFkeScpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZHk6IHJlYWR5ID09PSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiByZWFkeSA9PT0gdHJ1ZSA/ICdyZWFkeScgOiAnbm90X3JlYWR5J1xuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlTG9nU3VtbWFyeSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9hZGVkID0gYXdhaXQgbG9hZFByb2plY3RMb2dDb250ZW50KHJlcXVlc3Rlciwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoOiBhcmdzPy5wcm9qZWN0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDogYXJncz8ubG9nRmlsZVBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvYWRlZC5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkTGluZXMgPSBsb2FkZWQudmFsdWUubm9uRW1wdHlMaW5lcy5zbGljZSgtbGluZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEubG9nU3VtbWFyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGxvYWRlZC52YWx1ZS5sb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkTGluZXM6IGxpbmVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5leHRyYWN0TG9nU3VtbWFyeShzZWxlY3RlZExpbmVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEubG9nU3VtbWFyeUVycm9yID0gbG9hZGVkLmVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKGRhdGEpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ajgOafpeaehOW7uueKtuaAgeWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19nZXRfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn6K+75Y+W6aG555uuIHByb2plY3QubG9nIOacgOi/keaXpeW/lycsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbGluZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfor7vlj5bmnKvlsL7ooYzmlbDvvIzpu5jorqQgMjAw77yM6IyD5Zu0IDEtMTAwMDAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxvZ0xldmVsOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnQUxMJywgJ0VSUk9SJywgJ1dBUk4nLCAnSU5GTycsICdERUJVRycsICdUUkFDRSddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfml6Xlv5fnuqfliKvov4fmu6TvvIzpu5jorqQgQUxMJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJLZXl3b3JkOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5oyJ5YWz6ZSu5a2X6L+H5ruk77yI5LiN5Yy65YiG5aSn5bCP5YaZ77yJJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0UGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmhueebruagueebruW9lSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxwcm9qZWN0LmxvZyDnu53lr7not6/lvoQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFtdLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBjbGFtcEludChhcmdzPy5saW5lcywgMjAwLCAxLCAxMDAwMCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9nTGV2ZWwgPSBub3JtYWxpemVMb2dMZXZlbChhcmdzPy5sb2dMZXZlbCk7XG4gICAgICAgICAgICAgICAgaWYgKCFsb2dMZXZlbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgnbG9nTGV2ZWwg5LuF5pSv5oyBIEFMTC9FUlJPUi9XQVJOL0lORk8vREVCVUcvVFJBQ0UnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBmaWx0ZXJLZXl3b3JkID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5maWx0ZXJLZXl3b3JkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2FkZWQgPSBhd2FpdCBsb2FkUHJvamVjdExvZ0NvbnRlbnQocmVxdWVzdGVyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvYWRlZC5vaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn6K+75Y+W6aG555uu5pel5b+X5aSx6LSlJywgbG9hZGVkLmVycm9yLCAnRV9MT0dfRklMRV9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3RlZExpbmVzID0gbG9hZGVkLnZhbHVlLm5vbkVtcHR5TGluZXMuc2xpY2UoLWxpbmVzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBieUxldmVsID0gZmlsdGVyTGluZXNCeUxldmVsKHNlbGVjdGVkTGluZXMsIGxvZ0xldmVsKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWx0ZXJlZCA9IGZpbHRlckxpbmVzQnlLZXl3b3JkKGJ5TGV2ZWwsIGZpbHRlcktleXdvcmQpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGxvYWRlZC52YWx1ZS5sb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgdG90YWxMaW5lczogbG9hZGVkLnZhbHVlLm5vbkVtcHR5TGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWRMaW5lczogbGluZXMsXG4gICAgICAgICAgICAgICAgICAgIHJldHVybmVkTGluZXM6IGZpbHRlcmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgbG9nTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcktleXdvcmQsXG4gICAgICAgICAgICAgICAgICAgIGxvZ3M6IGZpbHRlcmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2dldF9sb2dfZmlsZV9pbmZvJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIHByb2plY3QubG9nIOaWh+S7tuS/oeaBrycsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzpobnnm67moLnnm67lvZUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yMcHJvamVjdC5sb2cg57ud5a+56Lev5b6EJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRlZCA9IGF3YWl0IGxvYWRQcm9qZWN0TG9nQ29udGVudChyZXF1ZXN0ZXIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmICghbG9hZGVkLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Lml6Xlv5fmlofku7bkv6Hmga/lpLHotKUnLCBsb2FkZWQuZXJyb3IsICdFX0xPR19GSUxFX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGg6IGxvYWRlZC52YWx1ZS5sb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVTaXplOiBzdGF0LnNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlU2l6ZUZvcm1hdHRlZDogZm9ybWF0RmlsZVNpemUoc3RhdC5zaXplKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogc3RhdC5iaXJ0aHRpbWUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkQXQ6IHN0YXQubXRpbWUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVDb3VudDogbG9hZGVkLnZhbHVlLm5vbkVtcHR5TGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2FuZGlkYXRlUGF0aHM6IGxvYWRlZC52YWx1ZS5jYW5kaWRhdGVzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ivu+WPluaXpeW/l+aWh+S7tuWxnuaAp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19zZWFyY2hfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJ5YWz6ZSu5a2X5oiW5q2j5YiZ5pCc57SiIHByb2plY3QubG9nJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Yy56YWN5qih5byP77yI6buY6K6k5oyJ5q2j5YiZ6Kej6YeK77yJJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB1c2VSZWdleDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbmjInmraPliJnljLnphY3vvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgY2FzZVNlbnNpdGl2ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbljLrliIblpKflsI/lhpnvvIzpu5jorqQgZmFsc2UnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG1heFJlc3VsdHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmnIDlpKfov5Tlm57ljLnphY3mlbDvvIzpu5jorqQgMjDvvIzojIPlm7QgMS0yMDAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRMaW5lczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S4iuS4i+aWh+ihjOaVsO+8jOm7mOiupCAy77yM6IyD5Zu0IDAtMTAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6aG555uu5qC555uu5b2VJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jHByb2plY3QubG9nIOe7neWvuei3r+W+hCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncGF0dGVybiddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFtdLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucGF0dGVybik7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXR0ZXJuKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwYXR0ZXJuIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHVzZVJlZ2V4ID0gYXJncz8udXNlUmVnZXggIT09IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhc2VTZW5zaXRpdmUgPSBhcmdzPy5jYXNlU2Vuc2l0aXZlID09PSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1heFJlc3VsdHMgPSBjbGFtcEludChhcmdzPy5tYXhSZXN1bHRzLCAyMCwgMSwgMjAwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0TGluZXMgPSBjbGFtcEludChhcmdzPy5jb250ZXh0TGluZXMsIDIsIDAsIDEwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2FkZWQgPSBhd2FpdCBsb2FkUHJvamVjdExvZ0NvbnRlbnQocmVxdWVzdGVyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvYWRlZC5vaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5pCc57Si6aG555uu5pel5b+X5aSx6LSlJywgbG9hZGVkLmVycm9yLCAnRV9MT0dfRklMRV9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcmVnZXg6IFJlZ0V4cDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2UgPSB1c2VSZWdleCA/IHBhdHRlcm4gOiBlc2NhcGVSZWdFeHAocGF0dGVybik7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChzb3VyY2UsIGNhc2VTZW5zaXRpdmUgPyAnZycgOiAnZ2knKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwYXR0ZXJuIOS4jeaYr+WQiOazleato+WImeihqOi+vuW8jycsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZXM6IExvZ1NlYXJjaE1hdGNoW10gPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbG9hZGVkLnZhbHVlLnJhd0xpbmVzLmxlbmd0aDsgaW5kZXggKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcy5sZW5ndGggPj0gbWF4UmVzdWx0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lID0gbG9hZGVkLnZhbHVlLnJhd0xpbmVzW2luZGV4XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgcmVnZXgubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KGxpbmUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gTWF0aC5tYXgoMCwgaW5kZXggLSBjb250ZXh0TGluZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmQgPSBNYXRoLm1pbihsb2FkZWQudmFsdWUucmF3TGluZXMubGVuZ3RoIC0gMSwgaW5kZXggKyBjb250ZXh0TGluZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0OiBMb2dDb250ZXh0TGluZVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGN1cnNvciA9IHN0YXJ0OyBjdXJzb3IgPD0gZW5kOyBjdXJzb3IgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBjdXJzb3IgKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGxvYWRlZC52YWx1ZS5yYXdMaW5lc1tjdXJzb3JdIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTWF0Y2g6IGN1cnNvciA9PT0gaW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRMaW5lOiBsaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDogbG9hZGVkLnZhbHVlLmxvZ0ZpbGVQYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuLFxuICAgICAgICAgICAgICAgICAgICB1c2VSZWdleCxcbiAgICAgICAgICAgICAgICAgICAgY2FzZVNlbnNpdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgbWF4UmVzdWx0cyxcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dExpbmVzLFxuICAgICAgICAgICAgICAgICAgICB0b3RhbExpbmVzOiBsb2FkZWQudmFsdWUucmF3TGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICB0b3RhbE1hdGNoZXM6IG1hdGNoZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX3F1ZXJ5X3BlcmZvcm1hbmNlX3NuYXBzaG90JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5oCB5oCn6IO95b+r54Wn77yI6Iul57yW6L6R5Zmo5pSv5oyBIHNjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNl77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1wZXJmb3JtYW5jZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1wZXJmb3JtYW5jZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZUNvdW50OiB0b051bWJlck9yTnVsbChyYXc/Lm5vZGVDb3VudCksXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRDb3VudDogdG9OdW1iZXJPck51bGwocmF3Py5jb21wb25lbnRDb3VudCksXG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbHM6IHRvTnVtYmVyT3JOdWxsKHJhdz8uZHJhd0NhbGxzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyaWFuZ2xlczogdG9OdW1iZXJPck51bGwocmF3Py50cmlhbmdsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb3J5OiByYXc/Lm1lbW9yeSA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmF3XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouaAp+iDveW/q+eFp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9pbmZvcm1hdGlvbicsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBpbmZvcm1hdGlvbiDmqKHlnZfkv6Hmga/pobnvvIjpl67ljbcv5o+Q56S6562J77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB0YWc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkv6Hmga/moIfnrb7vvIh0YWfvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGZvcmNlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuW8uuWItuWIt+aWsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndGFnJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydpbmZvcm1hdGlvbi5xdWVyeS1pbmZvcm1hdGlvbiddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFnID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YWcpO1xuICAgICAgICAgICAgICAgIGlmICghdGFnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd0YWcg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZm9yY2UgPSBhcmdzPy5mb3JjZSA9PT0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gZm9yY2VcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdpbmZvcm1hdGlvbicsICdxdWVyeS1pbmZvcm1hdGlvbicsIHRhZywgeyBmb3JjZTogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ2luZm9ybWF0aW9uJywgJ3F1ZXJ5LWluZm9ybWF0aW9uJywgdGFnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5mbyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kOiBpbmZvICE9PSBudWxsICYmIGluZm8gIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6IgaW5mb3JtYXRpb24g5L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX3F1ZXJ5X3Byb2dyYW1faW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouaMh+Wumueoi+W6j+iDveWKm+S/oeaBr++8iHByb2dyYW0ucXVlcnktcHJvZ3JhbS1pbmZv77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwcm9ncmFtSWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnqIvluo/moIfor4bvvIzkvovlpoIgdnNjb2RlJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydwcm9ncmFtSWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3Byb2dyYW0ucXVlcnktcHJvZ3JhbS1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9ncmFtSWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByb2dyYW1JZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFwcm9ncmFtSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3Byb2dyYW1JZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtJywgJ3F1ZXJ5LXByb2dyYW0taW5mbycsIHByb2dyYW1JZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9ncmFtSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3VuZDogaW5mbyAhPT0gbnVsbCAmJiBpbmZvICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBwcm9ncmFtIOS/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9zaGFyZWRfc2V0dGluZ3MnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgcHJvZ3JhbW1pbmcg5YWx5Lqr6K6+572u77yIcXVlcnktc2hhcmVkLXNldHRpbmdz77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcm9ncmFtbWluZy5xdWVyeS1zaGFyZWQtc2V0dGluZ3MnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtbWluZycsICdxdWVyeS1zaGFyZWQtc2V0dGluZ3MnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgc2V0dGluZ3MgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIHByb2dyYW1taW5nIOWFseS6q+iuvue9ruWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9zb3J0ZWRfcGx1Z2lucycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBwcm9ncmFtbWluZyDmj5Lku7bohJrmnKzpobrluo/vvIhxdWVyeS1zb3J0ZWQtcGx1Z2luc++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmAj+S8oCBxdWVyeS1zb3J0ZWQtcGx1Z2lucyDnmoTov4fmu6Tlj4LmlbAnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsncHJvZ3JhbW1pbmcucXVlcnktc29ydGVkLXBsdWdpbnMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzPy5vcHRpb25zICYmIHR5cGVvZiBhcmdzLm9wdGlvbnMgPT09ICdvYmplY3QnID8gYXJncy5vcHRpb25zIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGx1Z2lucyA9IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtbWluZycsICdxdWVyeS1zb3J0ZWQtcGx1Z2lucycsIG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHJlcXVlc3RlcigncHJvZ3JhbW1pbmcnLCAncXVlcnktc29ydGVkLXBsdWdpbnMnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkocGx1Z2lucykgPyBwbHVnaW5zIDogW107XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBwbHVnaW5zOiBsaXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBwcm9ncmFtbWluZyDmj5Lku7bpobrluo/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=