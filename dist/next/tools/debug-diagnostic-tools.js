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
function parseIncrementalFilterOptions(args) {
    const hasSinceLine = args && Object.prototype.hasOwnProperty.call(args, 'sinceLine');
    let sinceLine = null;
    if (hasSinceLine) {
        const rawSinceLine = Number(args === null || args === void 0 ? void 0 : args.sinceLine);
        if (!Number.isInteger(rawSinceLine) || rawSinceLine < 0) {
            return { ok: false, error: 'sinceLine 必须是大于等于 0 的整数' };
        }
        sinceLine = rawSinceLine;
    }
    const sinceTimestamp = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.sinceTimestamp);
    let sinceTimestampMs = null;
    if (sinceTimestamp) {
        const parsed = Date.parse(sinceTimestamp);
        if (!Number.isFinite(parsed)) {
            return { ok: false, error: 'sinceTimestamp 必须是合法时间字符串（建议 ISO8601）' };
        }
        sinceTimestampMs = parsed;
    }
    return {
        ok: true,
        value: {
            sinceLine,
            sinceTimestamp,
            sinceTimestampMs
        }
    };
}
function extractLineTimestampMs(line) {
    const isoLikePatterns = [
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
        /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?/
    ];
    for (const pattern of isoLikePatterns) {
        const matched = line.match(pattern);
        if (!matched || !matched[0]) {
            continue;
        }
        const normalized = matched[0].includes('T') ? matched[0] : matched[0].replace(' ', 'T');
        const parsed = Date.parse(normalized);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
function filterIncrementalLines(rawLines, options) {
    const result = [];
    for (let index = 0; index < rawLines.length; index += 1) {
        const lineNo = index + 1;
        const line = rawLines[index] || '';
        if (line.trim() === '') {
            continue;
        }
        if (options.sinceLine !== null && lineNo <= options.sinceLine) {
            continue;
        }
        if (options.sinceTimestampMs !== null) {
            const lineTs = extractLineTimestampMs(line);
            if (lineTs === null || lineTs <= options.sinceTimestampMs) {
                continue;
            }
        }
        result.push(line);
    }
    return result;
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
                    sinceLine: {
                        type: 'number',
                        description: '可选，仅统计该行号之后的日志（基于 project.log 原始行号）'
                    },
                    sinceTimestamp: {
                        type: 'string',
                        description: '可选，仅统计该时间之后的日志（建议 ISO8601）'
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
                const incrementalOptions = parseIncrementalFilterOptions(args);
                if (!incrementalOptions.ok) {
                    return (0, common_1.fail)('增量参数不合法', incrementalOptions.error, 'E_INVALID_ARGUMENT');
                }
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
                            const incrementalLines = filterIncrementalLines(loaded.value.rawLines, incrementalOptions.value);
                            const selectedLines = incrementalLines.slice(-lines);
                            data.logSummary = Object.assign({ logFilePath: loaded.value.logFilePath, requestedLines: lines, sourceLines: incrementalLines.length }, extractLogSummary(selectedLines));
                        }
                        else {
                            data.logSummaryError = loaded.error;
                        }
                    }
                    data.incremental = {
                        sinceLine: incrementalOptions.value.sinceLine,
                        sinceTimestamp: incrementalOptions.value.sinceTimestamp
                    };
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
                    sinceLine: {
                        type: 'number',
                        description: '可选，仅返回该行号之后的日志（基于 project.log 原始行号）'
                    },
                    sinceTimestamp: {
                        type: 'string',
                        description: '可选，仅返回该时间之后的日志（建议 ISO8601）'
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
                const incrementalOptions = parseIncrementalFilterOptions(args);
                if (!incrementalOptions.ok) {
                    return (0, common_1.fail)('增量参数不合法', incrementalOptions.error, 'E_INVALID_ARGUMENT');
                }
                const filterKeyword = (0, common_1.toNonEmptyString)(args === null || args === void 0 ? void 0 : args.filterKeyword);
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return (0, common_1.fail)('读取项目日志失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }
                const incrementalLines = filterIncrementalLines(loaded.value.rawLines, incrementalOptions.value);
                const selectedLines = incrementalLines.slice(-lines);
                const byLevel = filterLinesByLevel(selectedLines, logLevel);
                const filtered = filterLinesByKeyword(byLevel, filterKeyword);
                return (0, common_1.ok)({
                    logFilePath: loaded.value.logFilePath,
                    totalLines: loaded.value.nonEmptyLines.length,
                    sourceLines: incrementalLines.length,
                    requestedLines: lines,
                    returnedLines: filtered.length,
                    logLevel,
                    filterKeyword,
                    incremental: {
                        sinceLine: incrementalOptions.value.sinceLine,
                        sinceTimestamp: incrementalOptions.value.sinceTimestamp
                    },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWctZGlhZ25vc3RpYy10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9uZXh0L3Rvb2xzL2RlYnVnLWRpYWdub3N0aWMtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEyVkEsZ0VBOGNDO0FBenlCRCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLHFDQUFzRTtBQTZCdEUsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFFM0UsU0FBUyxRQUFRLENBQUMsS0FBVSxFQUFFLFFBQWdCLEVBQUUsR0FBVyxFQUFFLEdBQVc7SUFDcEUsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDeEIsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDekQsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsS0FBVTtJQUNqQyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVCLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDekMsSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksS0FBSyxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssS0FBSyxP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LElBQUksQ0FBQztvQkFDRCxNQUFNLE9BQU8sR0FBRyxPQUFPO3dCQUNuQixDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsYUFBYSxFQUFFLHNCQUFzQixFQUFFLE9BQU8sQ0FBQzt3QkFDakUsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLGFBQWEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO29CQUM3RCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyxJQUFBLFdBQUUsRUFBQzt3QkFDTixPQUFPLEVBQUUsT0FBTyxJQUFJLElBQUk7d0JBQ3hCLE9BQU8sRUFBRSxJQUFJO3dCQUNiLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtxQkFDckIsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxJQUFBLGFBQUksRUFBQyx1QkFBdUIsRUFBRSxJQUFBLHVCQUFjLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztZQUNMLENBQUM7U0FDSjtLQUNKLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEVkaXRvclJlcXVlc3RlciwgTmV4dFRvb2xEZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kZWxzJztcbmltcG9ydCB7IGZhaWwsIG5vcm1hbGl6ZUVycm9yLCBvaywgdG9Ob25FbXB0eVN0cmluZyB9IGZyb20gJy4vY29tbW9uJztcblxudHlwZSBMb2dMZXZlbCA9ICdBTEwnIHwgJ0VSUk9SJyB8ICdXQVJOJyB8ICdJTkZPJyB8ICdERUJVRycgfCAnVFJBQ0UnO1xuXG5pbnRlcmZhY2UgTG9nQ29udGV4dExpbmUge1xuICAgIGxpbmVOdW1iZXI6IG51bWJlcjtcbiAgICBjb250ZW50OiBzdHJpbmc7XG4gICAgaXNNYXRjaDogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvZ1NlYXJjaE1hdGNoIHtcbiAgICBsaW5lTnVtYmVyOiBudW1iZXI7XG4gICAgbWF0Y2hlZExpbmU6IHN0cmluZztcbiAgICBjb250ZXh0OiBMb2dDb250ZXh0TGluZVtdO1xufVxuXG5pbnRlcmZhY2UgTG9hZGVkTG9nQ29udGVudCB7XG4gICAgbG9nRmlsZVBhdGg6IHN0cmluZztcbiAgICBjYW5kaWRhdGVzOiBzdHJpbmdbXTtcbiAgICByYXdMaW5lczogc3RyaW5nW107XG4gICAgbm9uRW1wdHlMaW5lczogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBJbmNyZW1lbnRhbEZpbHRlck9wdGlvbnMge1xuICAgIHNpbmNlTGluZTogbnVtYmVyIHwgbnVsbDtcbiAgICBzaW5jZVRpbWVzdGFtcDogc3RyaW5nIHwgbnVsbDtcbiAgICBzaW5jZVRpbWVzdGFtcE1zOiBudW1iZXIgfCBudWxsO1xufVxuXG5jb25zdCBERUZBVUxUX0xPR19SRUxBVElWRV9QQVRIID0gcGF0aC5qb2luKCd0ZW1wJywgJ2xvZ3MnLCAncHJvamVjdC5sb2cnKTtcblxuZnVuY3Rpb24gY2xhbXBJbnQodmFsdWU6IGFueSwgZmFsbGJhY2s6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBudW0gPSBOdW1iZXIodmFsdWUpO1xuICAgIGlmICghTnVtYmVyLmlzRmluaXRlKG51bSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbGxiYWNrO1xuICAgIH1cbiAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgoTWF0aC5mbG9vcihudW0pLCBtaW4pLCBtYXgpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVMb2dMZXZlbCh2YWx1ZTogYW55KTogTG9nTGV2ZWwgfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gJ0FMTCc7XG4gICAgfVxuICAgIGNvbnN0IHVwcGVyID0gdmFsdWUudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHVwcGVyID09PSAnQUxMJyB8fCB1cHBlciA9PT0gJ0VSUk9SJyB8fCB1cHBlciA9PT0gJ1dBUk4nIHx8IHVwcGVyID09PSAnSU5GTycgfHwgdXBwZXIgPT09ICdERUJVRycgfHwgdXBwZXIgPT09ICdUUkFDRScpIHtcbiAgICAgICAgcmV0dXJuIHVwcGVyO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0RmlsZVNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgdW5pdHMgPSBbJ0InLCAnS0InLCAnTUInLCAnR0InXTtcbiAgICBsZXQgc2l6ZSA9IGJ5dGVzO1xuICAgIGxldCB1bml0SW5kZXggPSAwO1xuXG4gICAgd2hpbGUgKHNpemUgPj0gMTAyNCAmJiB1bml0SW5kZXggPCB1bml0cy5sZW5ndGggLSAxKSB7XG4gICAgICAgIHNpemUgLz0gMTAyNDtcbiAgICAgICAgdW5pdEluZGV4ICs9IDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIGAke3NpemUudG9GaXhlZCgyKX0gJHt1bml0c1t1bml0SW5kZXhdfWA7XG59XG5cbmZ1bmN0aW9uIHVuaXF1ZVBhdGhzKHBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgcGF0aHMpIHtcbiAgICAgICAgaWYgKCFmaWxlUGF0aCB8fCBzZWVuLmhhcyhmaWxlUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHNlZW4uYWRkKGZpbGVQYXRoKTtcbiAgICAgICAgcmVzdWx0LnB1c2goZmlsZVBhdGgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBmaW5kRXhpc3RpbmdGaWxlKHBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xuICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgcGF0aHMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaWxlUGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpO1xufVxuXG5mdW5jdGlvbiBmaWx0ZXJMaW5lc0J5TGV2ZWwobGluZXM6IHN0cmluZ1tdLCBsb2dMZXZlbDogTG9nTGV2ZWwpOiBzdHJpbmdbXSB7XG4gICAgaWYgKGxvZ0xldmVsID09PSAnQUxMJykge1xuICAgICAgICByZXR1cm4gbGluZXM7XG4gICAgfVxuICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVnRXhwKGAoPzpcXFxcW3xcXFxcYikke2xvZ0xldmVsfSg/OlxcXFxdfFxcXFxiKWAsICdpJyk7XG4gICAgcmV0dXJuIGxpbmVzLmZpbHRlcigobGluZSkgPT4gcGF0dGVybi50ZXN0KGxpbmUpKTtcbn1cblxuZnVuY3Rpb24gZmlsdGVyTGluZXNCeUtleXdvcmQobGluZXM6IHN0cmluZ1tdLCBrZXl3b3JkOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nW10ge1xuICAgIGlmICgha2V5d29yZCkge1xuICAgICAgICByZXR1cm4gbGluZXM7XG4gICAgfVxuICAgIGNvbnN0IGxvd2VyID0ga2V5d29yZC50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBsaW5lcy5maWx0ZXIoKGxpbmUpID0+IGxpbmUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhsb3dlcikpO1xufVxuXG5mdW5jdGlvbiBzdW1tYXJpemVMb2dMZXZlbHMobGluZXM6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgbnVtYmVyPiB7XG4gICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAgICAgICBFUlJPUjogMCxcbiAgICAgICAgV0FSTjogMCxcbiAgICAgICAgSU5GTzogMCxcbiAgICAgICAgREVCVUc6IDAsXG4gICAgICAgIFRSQUNFOiAwLFxuICAgICAgICBVTktOT1dOOiAwXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goLyg/OlxcW3xcXGIpKEVSUk9SfFdBUk58SU5GT3xERUJVR3xUUkFDRSkoPzpcXF18XFxiKS9pKTtcbiAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgcmVzdWx0LlVOS05PV04gKz0gMTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGV2ZWwgPSBtYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICByZXN1bHRbbGV2ZWxdID0gKHJlc3VsdFtsZXZlbF0gfHwgMCkgKyAxO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVQcm9qZWN0UGF0aEZyb21Db25maWcoY29uZmlnOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBjb25maWcudHJpbSgpO1xuICAgICAgICByZXR1cm4gdmFsdWUgPT09ICcnID8gbnVsbCA6IHZhbHVlO1xuICAgIH1cblxuICAgIGlmICghY29uZmlnIHx8IHR5cGVvZiBjb25maWcgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgICAgIChjb25maWcgYXMgUmVjb3JkPHN0cmluZywgYW55PikucGF0aCxcbiAgICAgICAgKGNvbmZpZyBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KS5wcm9qZWN0UGF0aCxcbiAgICAgICAgKGNvbmZpZyBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KS5yb290LFxuICAgICAgICAoY29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pLmN3ZFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBjYW5kaWRhdGVzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2FuZGlkYXRlID09PSAnc3RyaW5nJyAmJiBjYW5kaWRhdGUudHJpbSgpICE9PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGNhbmRpZGF0ZS50cmltKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVByb2plY3RQYXRoRnJvbUVkaXRvcigpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBlZGl0b3JQcm9qZWN0UGF0aCA9IChnbG9iYWxUaGlzIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pPy5FZGl0b3I/LlByb2plY3Q/LnBhdGg7XG4gICAgaWYgKHR5cGVvZiBlZGl0b3JQcm9qZWN0UGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gZWRpdG9yUHJvamVjdFBhdGgudHJpbSgpO1xuICAgIHJldHVybiB2YWx1ZSA9PT0gJycgPyBudWxsIDogdmFsdWU7XG59XG5cbmZ1bmN0aW9uIHRvRXhpc3RpbmdEaXJlY3RvcnkodmFsdWU6IHN0cmluZyB8IG51bGwpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZSh2YWx1ZSk7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHJlc29sdmVkUGF0aCk7XG4gICAgICAgIHJldHVybiBzdGF0LmlzRGlyZWN0b3J5KCkgPyByZXNvbHZlZFBhdGggOiBudWxsO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1aWxkTG9nQ2FuZGlkYXRlcyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlciwgYXJnczogYW55KTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IGV4cGxpY2l0TG9nRmlsZVBhdGggPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LmxvZ0ZpbGVQYXRoKTtcbiAgICBjb25zdCBleHBsaWNpdFByb2plY3RQYXRoID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5wcm9qZWN0UGF0aCk7XG4gICAgY29uc3QgcHJvamVjdFBhdGhGcm9tRWRpdG9yID0gIWV4cGxpY2l0TG9nRmlsZVBhdGggPyByZXNvbHZlUHJvamVjdFBhdGhGcm9tRWRpdG9yKCkgOiBudWxsO1xuXG4gICAgbGV0IHByb2plY3RQYXRoRnJvbUNvbmZpZzogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgaWYgKCFleHBsaWNpdExvZ0ZpbGVQYXRoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCByZXF1ZXN0ZXIoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKTtcbiAgICAgICAgICAgIHByb2plY3RQYXRoRnJvbUNvbmZpZyA9IHJlc29sdmVQcm9qZWN0UGF0aEZyb21Db25maWcoY29uZmlnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBwcm9qZWN0UGF0aEZyb21Db25maWcgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcHJvamVjdFBhdGhDYW5kaWRhdGVzID0gdW5pcXVlUGF0aHMoW1xuICAgICAgICBleHBsaWNpdFByb2plY3RQYXRoID8gcGF0aC5yZXNvbHZlKGV4cGxpY2l0UHJvamVjdFBhdGgpIDogJycsXG4gICAgICAgIHByb2plY3RQYXRoRnJvbUVkaXRvciA/IHBhdGgucmVzb2x2ZShwcm9qZWN0UGF0aEZyb21FZGl0b3IpIDogJycsXG4gICAgICAgIHByb2plY3RQYXRoRnJvbUNvbmZpZyA/IHBhdGgucmVzb2x2ZShwcm9qZWN0UGF0aEZyb21Db25maWcpIDogJydcbiAgICBdKS5maWx0ZXIoKGl0ZW0pID0+IHRvRXhpc3RpbmdEaXJlY3RvcnkoaXRlbSkgIT09IG51bGwpO1xuXG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IHVuaXF1ZVBhdGhzKFtcbiAgICAgICAgZXhwbGljaXRMb2dGaWxlUGF0aCA/IHBhdGgucmVzb2x2ZShleHBsaWNpdExvZ0ZpbGVQYXRoKSA6ICcnLFxuICAgICAgICAuLi5wcm9qZWN0UGF0aENhbmRpZGF0ZXMubWFwKChwcm9qZWN0UGF0aCkgPT4gcGF0aC5qb2luKHByb2plY3RQYXRoLCBERUZBVUxUX0xPR19SRUxBVElWRV9QQVRIKSksXG4gICAgICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBERUZBVUxUX0xPR19SRUxBVElWRV9QQVRIKVxuICAgIF0pO1xuXG4gICAgcmV0dXJuIGNhbmRpZGF0ZXM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRQcm9qZWN0TG9nQ29udGVudChcbiAgICByZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3RlcixcbiAgICBhcmdzOiBhbnlcbik6IFByb21pc2U8eyBvazogdHJ1ZTsgdmFsdWU6IExvYWRlZExvZ0NvbnRlbnQgfSB8IHsgb2s6IGZhbHNlOyBlcnJvcjogc3RyaW5nOyBjYW5kaWRhdGVzOiBzdHJpbmdbXSB9PiB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IGF3YWl0IGJ1aWxkTG9nQ2FuZGlkYXRlcyhyZXF1ZXN0ZXIsIGFyZ3MpO1xuICAgIGNvbnN0IGxvZ0ZpbGVQYXRoID0gZmluZEV4aXN0aW5nRmlsZShjYW5kaWRhdGVzKTtcbiAgICBpZiAoIWxvZ0ZpbGVQYXRoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogYOacquaJvuWIsCBwcm9qZWN0LmxvZ++8jOWAmemAiei3r+W+hO+8miR7Y2FuZGlkYXRlcy5qb2luKCcgfCAnKX1gLFxuICAgICAgICAgICAgY2FuZGlkYXRlc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMobG9nRmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICAgIGNvbnN0IHJhd0xpbmVzID0gY29udGVudC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgICAgICBjb25zdCBub25FbXB0eUxpbmVzID0gcmF3TGluZXMuZmlsdGVyKChsaW5lKSA9PiBsaW5lLnRyaW0oKSAhPT0gJycpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoLFxuICAgICAgICAgICAgICAgIGNhbmRpZGF0ZXMsXG4gICAgICAgICAgICAgICAgcmF3TGluZXMsXG4gICAgICAgICAgICAgICAgbm9uRW1wdHlMaW5lc1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiBg6K+75Y+WIHByb2plY3QubG9nIOWksei0pe+8miR7bm9ybWFsaXplRXJyb3IoZXJyb3IpfWAsXG4gICAgICAgICAgICBjYW5kaWRhdGVzXG4gICAgICAgIH07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZUluY3JlbWVudGFsRmlsdGVyT3B0aW9ucyhhcmdzOiBhbnkpOiB7IG9rOiB0cnVlOyB2YWx1ZTogSW5jcmVtZW50YWxGaWx0ZXJPcHRpb25zIH0gfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZyB9IHtcbiAgICBjb25zdCBoYXNTaW5jZUxpbmUgPSBhcmdzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChhcmdzLCAnc2luY2VMaW5lJyk7XG4gICAgbGV0IHNpbmNlTGluZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gICAgaWYgKGhhc1NpbmNlTGluZSkge1xuICAgICAgICBjb25zdCByYXdTaW5jZUxpbmUgPSBOdW1iZXIoYXJncz8uc2luY2VMaW5lKTtcbiAgICAgICAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1NpbmNlTGluZSkgfHwgcmF3U2luY2VMaW5lIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ3NpbmNlTGluZSDlv4XpobvmmK/lpKfkuo7nrYnkuo4gMCDnmoTmlbTmlbAnIH07XG4gICAgICAgIH1cbiAgICAgICAgc2luY2VMaW5lID0gcmF3U2luY2VMaW5lO1xuICAgIH1cblxuICAgIGNvbnN0IHNpbmNlVGltZXN0YW1wID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy5zaW5jZVRpbWVzdGFtcCk7XG4gICAgbGV0IHNpbmNlVGltZXN0YW1wTXM6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgIGlmIChzaW5jZVRpbWVzdGFtcCkge1xuICAgICAgICBjb25zdCBwYXJzZWQgPSBEYXRlLnBhcnNlKHNpbmNlVGltZXN0YW1wKTtcbiAgICAgICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUocGFyc2VkKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ3NpbmNlVGltZXN0YW1wIOW/hemhu+aYr+WQiOazleaXtumXtOWtl+espuS4su+8iOW7uuiuriBJU084NjAx77yJJyB9O1xuICAgICAgICB9XG4gICAgICAgIHNpbmNlVGltZXN0YW1wTXMgPSBwYXJzZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IHRydWUsXG4gICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICBzaW5jZUxpbmUsXG4gICAgICAgICAgICBzaW5jZVRpbWVzdGFtcCxcbiAgICAgICAgICAgIHNpbmNlVGltZXN0YW1wTXNcbiAgICAgICAgfVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RMaW5lVGltZXN0YW1wTXMobGluZTogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgY29uc3QgaXNvTGlrZVBhdHRlcm5zID0gW1xuICAgICAgICAvXFxkezR9LVxcZHsyfS1cXGR7Mn1UXFxkezJ9OlxcZHsyfTpcXGR7Mn0oPzpcXC5cXGQrKT8oPzpafFsrLV1cXGR7Mn06P1xcZHsyfSk/LyxcbiAgICAgICAgL1xcZHs0fS1cXGR7Mn0tXFxkezJ9IFxcZHsyfTpcXGR7Mn06XFxkezJ9KD86XFwuXFxkKyk/L1xuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgaXNvTGlrZVBhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoZWQgPSBsaW5lLm1hdGNoKHBhdHRlcm4pO1xuICAgICAgICBpZiAoIW1hdGNoZWQgfHwgIW1hdGNoZWRbMF0pIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBtYXRjaGVkWzBdLmluY2x1ZGVzKCdUJykgPyBtYXRjaGVkWzBdIDogbWF0Y2hlZFswXS5yZXBsYWNlKCcgJywgJ1QnKTtcbiAgICAgICAgY29uc3QgcGFyc2VkID0gRGF0ZS5wYXJzZShub3JtYWxpemVkKTtcbiAgICAgICAgaWYgKE51bWJlci5pc0Zpbml0ZShwYXJzZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VkO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaWx0ZXJJbmNyZW1lbnRhbExpbmVzKHJhd0xpbmVzOiBzdHJpbmdbXSwgb3B0aW9uczogSW5jcmVtZW50YWxGaWx0ZXJPcHRpb25zKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcmF3TGluZXMubGVuZ3RoOyBpbmRleCArPSAxKSB7XG4gICAgICAgIGNvbnN0IGxpbmVObyA9IGluZGV4ICsgMTtcbiAgICAgICAgY29uc3QgbGluZSA9IHJhd0xpbmVzW2luZGV4XSB8fCAnJztcbiAgICAgICAgaWYgKGxpbmUudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5zaW5jZUxpbmUgIT09IG51bGwgJiYgbGluZU5vIDw9IG9wdGlvbnMuc2luY2VMaW5lKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnNpbmNlVGltZXN0YW1wTXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVUcyA9IGV4dHJhY3RMaW5lVGltZXN0YW1wTXMobGluZSk7XG4gICAgICAgICAgICBpZiAobGluZVRzID09PSBudWxsIHx8IGxpbmVUcyA8PSBvcHRpb25zLnNpbmNlVGltZXN0YW1wTXMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdC5wdXNoKGxpbmUpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBleHRyYWN0TG9nU3VtbWFyeShsaW5lczogc3RyaW5nW10pOiB7XG4gICAgdG90YWxMaW5lczogbnVtYmVyO1xuICAgIGJ5TGV2ZWw6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gICAgaGFzRXJyb3I6IGJvb2xlYW47XG4gICAgaGFzV2FybjogYm9vbGVhbjtcbn0ge1xuICAgIGNvbnN0IGJ5TGV2ZWwgPSBzdW1tYXJpemVMb2dMZXZlbHMobGluZXMpO1xuICAgIHJldHVybiB7XG4gICAgICAgIHRvdGFsTGluZXM6IGxpbmVzLmxlbmd0aCxcbiAgICAgICAgYnlMZXZlbCxcbiAgICAgICAgaGFzRXJyb3I6IGJ5TGV2ZWwuRVJST1IgPiAwLFxuICAgICAgICBoYXNXYXJuOiBieUxldmVsLldBUk4gPiAwXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gdG9OdW1iZXJPck51bGwodmFsdWU6IGFueSk6IG51bWJlciB8IG51bGwge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIE51bWJlci5pc0Zpbml0ZSh2YWx1ZSkgPyB2YWx1ZSA6IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZWJ1Z0RpYWdub3N0aWNUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19jaGVja19jb21waWxlX3N0YXR1cycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ajgOafpeaehOW7uiB3b3JrZXIg54q25oCB77yM5bm25Y+v6ZmE5bim5pyA6L+R5pel5b+X5pGY6KaBJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlTG9nU3VtbWFyeToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbpmYTluKbmnIDov5Hml6Xlv5fmkZjopoHvvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbGluZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfml6Xlv5fmkZjopoHor7vlj5booYzmlbDvvIzpu5jorqQgMjAw77yM6IyD5Zu0IDEtMTAwMDAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNpbmNlTGluZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOS7hee7n+iuoeivpeihjOWPt+S5i+WQjueahOaXpeW/l++8iOWfuuS6jiBwcm9qZWN0LmxvZyDljp/lp4vooYzlj7fvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNpbmNlVGltZXN0YW1wOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5LuF57uf6K6h6K+l5pe26Ze05LmL5ZCO55qE5pel5b+X77yI5bu66K6uIElTTzg2MDHvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6aG555uu5qC555uu5b2V77yb55So5LqO5a6a5L2NIHRlbXAvbG9ncy9wcm9qZWN0LmxvZydcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIxwcm9qZWN0LmxvZyDnu53lr7not6/lvoTvvJvkvJjlhYjnuqfpq5jkuo4gcHJvamVjdFBhdGgnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsnYnVpbGRlci5xdWVyeS13b3JrZXItcmVhZHknXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVMb2dTdW1tYXJ5ID0gYXJncz8uaW5jbHVkZUxvZ1N1bW1hcnkgIT09IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gY2xhbXBJbnQoYXJncz8ubGluZXMsIDIwMCwgMSwgMTAwMDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluY3JlbWVudGFsT3B0aW9ucyA9IHBhcnNlSW5jcmVtZW50YWxGaWx0ZXJPcHRpb25zKGFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmICghaW5jcmVtZW50YWxPcHRpb25zLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCflop7ph4/lj4LmlbDkuI3lkIjms5UnLCBpbmNyZW1lbnRhbE9wdGlvbnMuZXJyb3IsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFkeSA9IGF3YWl0IHJlcXVlc3RlcignYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YTogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWR5OiByZWFkeSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogcmVhZHkgPT09IHRydWUgPyAncmVhZHknIDogJ25vdF9yZWFkeSdcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZUxvZ1N1bW1hcnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRlZCA9IGF3YWl0IGxvYWRQcm9qZWN0TG9nQ29udGVudChyZXF1ZXN0ZXIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0UGF0aDogYXJncz8ucHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGFyZ3M/LmxvZ0ZpbGVQYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2FkZWQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmNyZW1lbnRhbExpbmVzID0gZmlsdGVySW5jcmVtZW50YWxMaW5lcyhsb2FkZWQudmFsdWUucmF3TGluZXMsIGluY3JlbWVudGFsT3B0aW9ucy52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRMaW5lcyA9IGluY3JlbWVudGFsTGluZXMuc2xpY2UoLWxpbmVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmxvZ1N1bW1hcnkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiBsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZExpbmVzOiBsaW5lcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlTGluZXM6IGluY3JlbWVudGFsTGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5leHRyYWN0TG9nU3VtbWFyeShzZWxlY3RlZExpbmVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEubG9nU3VtbWFyeUVycm9yID0gbG9hZGVkLmVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZGF0YS5pbmNyZW1lbnRhbCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbmNlTGluZTogaW5jcmVtZW50YWxPcHRpb25zLnZhbHVlLnNpbmNlTGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbmNlVGltZXN0YW1wOiBpbmNyZW1lbnRhbE9wdGlvbnMudmFsdWUuc2luY2VUaW1lc3RhbXBcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soZGF0YSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5qOA5p+l5p6E5bu654q25oCB5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2dldF9wcm9qZWN0X2xvZ3MnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfor7vlj5bpobnnm64gcHJvamVjdC5sb2cg5pyA6L+R5pel5b+XJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBsaW5lczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+ivu+WPluacq+WwvuihjOaVsO+8jOm7mOiupCAyMDDvvIzojIPlm7QgMS0xMDAwMCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbG9nTGV2ZWw6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydBTEwnLCAnRVJST1InLCAnV0FSTicsICdJTkZPJywgJ0RFQlVHJywgJ1RSQUNFJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aXpeW/l+e6p+WIq+i/h+a7pO+8jOm7mOiupCBBTEwnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcktleXdvcmQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzmjInlhbPplK7lrZfov4fmu6TvvIjkuI3ljLrliIblpKflsI/lhpnvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNpbmNlTGluZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOS7hei/lOWbnuivpeihjOWPt+S5i+WQjueahOaXpeW/l++8iOWfuuS6jiBwcm9qZWN0LmxvZyDljp/lp4vooYzlj7fvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNpbmNlVGltZXN0YW1wOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM5LuF6L+U5Zue6K+l5pe26Ze05LmL5ZCO55qE5pel5b+X77yI5bu66K6uIElTTzg2MDHvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6aG555uu5qC555uu5b2VJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jHByb2plY3QubG9nIOe7neWvuei3r+W+hCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogW10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IGNsYW1wSW50KGFyZ3M/LmxpbmVzLCAyMDAsIDEsIDEwMDAwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2dMZXZlbCA9IG5vcm1hbGl6ZUxvZ0xldmVsKGFyZ3M/LmxvZ0xldmVsKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvZ0xldmVsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdsb2dMZXZlbCDku4XmlK/mjIEgQUxML0VSUk9SL1dBUk4vSU5GTy9ERUJVRy9UUkFDRScsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBpbmNyZW1lbnRhbE9wdGlvbnMgPSBwYXJzZUluY3JlbWVudGFsRmlsdGVyT3B0aW9ucyhhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWluY3JlbWVudGFsT3B0aW9ucy5vaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5aKe6YeP5Y+C5pWw5LiN5ZCI5rOVJywgaW5jcmVtZW50YWxPcHRpb25zLmVycm9yLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsdGVyS2V5d29yZCA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8uZmlsdGVyS2V5d29yZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9hZGVkID0gYXdhaXQgbG9hZFByb2plY3RMb2dDb250ZW50KHJlcXVlc3RlciwgYXJncyk7XG4gICAgICAgICAgICAgICAgaWYgKCFsb2FkZWQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ivu+WPlumhueebruaXpeW/l+Wksei0pScsIGxvYWRlZC5lcnJvciwgJ0VfTE9HX0ZJTEVfTk9UX0ZPVU5EJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5jcmVtZW50YWxMaW5lcyA9IGZpbHRlckluY3JlbWVudGFsTGluZXMobG9hZGVkLnZhbHVlLnJhd0xpbmVzLCBpbmNyZW1lbnRhbE9wdGlvbnMudmFsdWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkTGluZXMgPSBpbmNyZW1lbnRhbExpbmVzLnNsaWNlKC1saW5lcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnlMZXZlbCA9IGZpbHRlckxpbmVzQnlMZXZlbChzZWxlY3RlZExpbmVzLCBsb2dMZXZlbCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsdGVyZWQgPSBmaWx0ZXJMaW5lc0J5S2V5d29yZChieUxldmVsLCBmaWx0ZXJLZXl3b3JkKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiBsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHRvdGFsTGluZXM6IGxvYWRlZC52YWx1ZS5ub25FbXB0eUxpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgc291cmNlTGluZXM6IGluY3JlbWVudGFsTGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWRMaW5lczogbGluZXMsXG4gICAgICAgICAgICAgICAgICAgIHJldHVybmVkTGluZXM6IGZpbHRlcmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgbG9nTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcktleXdvcmQsXG4gICAgICAgICAgICAgICAgICAgIGluY3JlbWVudGFsOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaW5jZUxpbmU6IGluY3JlbWVudGFsT3B0aW9ucy52YWx1ZS5zaW5jZUxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBzaW5jZVRpbWVzdGFtcDogaW5jcmVtZW50YWxPcHRpb25zLnZhbHVlLnNpbmNlVGltZXN0YW1wXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxvZ3M6IGZpbHRlcmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX2dldF9sb2dfZmlsZV9pbmZvJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+iIHByb2plY3QubG9nIOaWh+S7tuS/oeaBrycsXG4gICAgICAgICAgICBsYXllcjogJ2V4dGVuZGVkJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdFBhdGg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICflj6/pgInvvIzpobnnm67moLnnm67lvZUnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yMcHJvamVjdC5sb2cg57ud5a+56Lev5b6EJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRlZCA9IGF3YWl0IGxvYWRQcm9qZWN0TG9nQ29udGVudChyZXF1ZXN0ZXIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmICghbG9hZGVkLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6Lml6Xlv5fmlofku7bkv6Hmga/lpLHotKUnLCBsb2FkZWQuZXJyb3IsICdFX0xPR19GSUxFX05PVF9GT1VORCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhsb2FkZWQudmFsdWUubG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGg6IGxvYWRlZC52YWx1ZS5sb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVTaXplOiBzdGF0LnNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlU2l6ZUZvcm1hdHRlZDogZm9ybWF0RmlsZVNpemUoc3RhdC5zaXplKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogc3RhdC5iaXJ0aHRpbWUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkQXQ6IHN0YXQubXRpbWUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVDb3VudDogbG9hZGVkLnZhbHVlLm5vbkVtcHR5TGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2FuZGlkYXRlUGF0aHM6IGxvYWRlZC52YWx1ZS5jYW5kaWRhdGVzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+ivu+WPluaXpeW/l+aWh+S7tuWxnuaAp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19zZWFyY2hfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5oyJ5YWz6ZSu5a2X5oiW5q2j5YiZ5pCc57SiIHByb2plY3QubG9nJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Yy56YWN5qih5byP77yI6buY6K6k5oyJ5q2j5YiZ6Kej6YeK77yJJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB1c2VSZWdleDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbmjInmraPliJnljLnphY3vvIzpu5jorqQgdHJ1ZSdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgY2FzZVNlbnNpdGl2ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmmK/lkKbljLrliIblpKflsI/lhpnvvIzpu5jorqQgZmFsc2UnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG1heFJlc3VsdHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmnIDlpKfov5Tlm57ljLnphY3mlbDvvIzpu5jorqQgMjDvvIzojIPlm7QgMS0yMDAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRMaW5lczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+S4iuS4i+aWh+ihjOaVsO+8jOm7mOiupCAy77yM6IyD5Zu0IDAtMTAnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RQYXRoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5Y+v6YCJ77yM6aG555uu5qC555uu5b2VJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jHByb2plY3QubG9nIOe7neWvuei3r+W+hCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncGF0dGVybiddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFtdLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IHRvTm9uRW1wdHlTdHJpbmcoYXJncz8ucGF0dGVybik7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXR0ZXJuKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwYXR0ZXJuIOW/heWhqycsIHVuZGVmaW5lZCwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHVzZVJlZ2V4ID0gYXJncz8udXNlUmVnZXggIT09IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhc2VTZW5zaXRpdmUgPSBhcmdzPy5jYXNlU2Vuc2l0aXZlID09PSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1heFJlc3VsdHMgPSBjbGFtcEludChhcmdzPy5tYXhSZXN1bHRzLCAyMCwgMSwgMjAwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0TGluZXMgPSBjbGFtcEludChhcmdzPy5jb250ZXh0TGluZXMsIDIsIDAsIDEwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2FkZWQgPSBhd2FpdCBsb2FkUHJvamVjdExvZ0NvbnRlbnQocmVxdWVzdGVyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvYWRlZC5vaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5pCc57Si6aG555uu5pel5b+X5aSx6LSlJywgbG9hZGVkLmVycm9yLCAnRV9MT0dfRklMRV9OT1RfRk9VTkQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcmVnZXg6IFJlZ0V4cDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2UgPSB1c2VSZWdleCA/IHBhdHRlcm4gOiBlc2NhcGVSZWdFeHAocGF0dGVybik7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChzb3VyY2UsIGNhc2VTZW5zaXRpdmUgPyAnZycgOiAnZ2knKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCdwYXR0ZXJuIOS4jeaYr+WQiOazleato+WImeihqOi+vuW8jycsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSwgJ0VfSU5WQUxJRF9BUkdVTUVOVCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZXM6IExvZ1NlYXJjaE1hdGNoW10gPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbG9hZGVkLnZhbHVlLnJhd0xpbmVzLmxlbmd0aDsgaW5kZXggKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcy5sZW5ndGggPj0gbWF4UmVzdWx0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lID0gbG9hZGVkLnZhbHVlLnJhd0xpbmVzW2luZGV4XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgcmVnZXgubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KGxpbmUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gTWF0aC5tYXgoMCwgaW5kZXggLSBjb250ZXh0TGluZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmQgPSBNYXRoLm1pbihsb2FkZWQudmFsdWUucmF3TGluZXMubGVuZ3RoIC0gMSwgaW5kZXggKyBjb250ZXh0TGluZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0OiBMb2dDb250ZXh0TGluZVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGN1cnNvciA9IHN0YXJ0OyBjdXJzb3IgPD0gZW5kOyBjdXJzb3IgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBjdXJzb3IgKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGxvYWRlZC52YWx1ZS5yYXdMaW5lc1tjdXJzb3JdIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTWF0Y2g6IGN1cnNvciA9PT0gaW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGluZGV4ICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRMaW5lOiBsaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDogbG9hZGVkLnZhbHVlLmxvZ0ZpbGVQYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuLFxuICAgICAgICAgICAgICAgICAgICB1c2VSZWdleCxcbiAgICAgICAgICAgICAgICAgICAgY2FzZVNlbnNpdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgbWF4UmVzdWx0cyxcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dExpbmVzLFxuICAgICAgICAgICAgICAgICAgICB0b3RhbExpbmVzOiBsb2FkZWQudmFsdWUucmF3TGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICB0b3RhbE1hdGNoZXM6IG1hdGNoZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX3F1ZXJ5X3BlcmZvcm1hbmNlX3NuYXBzaG90JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5p+l6K+i57yW6L6R5oCB5oCn6IO95b+r54Wn77yI6Iul57yW6L6R5Zmo5pSv5oyBIHNjZW5lLnF1ZXJ5LXBlcmZvcm1hbmNl77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnZXh0ZW5kZWQnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydzY2VuZS5xdWVyeS1wZXJmb3JtYW5jZSddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgcmVxdWVzdGVyKCdzY2VuZScsICdxdWVyeS1wZXJmb3JtYW5jZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZUNvdW50OiB0b051bWJlck9yTnVsbChyYXc/Lm5vZGVDb3VudCksXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRDb3VudDogdG9OdW1iZXJPck51bGwocmF3Py5jb21wb25lbnRDb3VudCksXG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbHM6IHRvTnVtYmVyT3JOdWxsKHJhdz8uZHJhd0NhbGxzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyaWFuZ2xlczogdG9OdW1iZXJPck51bGwocmF3Py50cmlhbmdsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb3J5OiByYXc/Lm1lbW9yeSA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmF3XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivouaAp+iDveW/q+eFp+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9pbmZvcm1hdGlvbicsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBpbmZvcm1hdGlvbiDmqKHlnZfkv6Hmga/pobnvvIjpl67ljbcv5o+Q56S6562J77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB0YWc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfkv6Hmga/moIfnrb7vvIh0YWfvvIknXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGZvcmNlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aYr+WQpuW8uuWItuWIt+aWsCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndGFnJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydpbmZvcm1hdGlvbi5xdWVyeS1pbmZvcm1hdGlvbiddLFxuICAgICAgICAgICAgcnVuOiBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFnID0gdG9Ob25FbXB0eVN0cmluZyhhcmdzPy50YWcpO1xuICAgICAgICAgICAgICAgIGlmICghdGFnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCd0YWcg5b+F5aGrJywgdW5kZWZpbmVkLCAnRV9JTlZBTElEX0FSR1VNRU5UJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZm9yY2UgPSBhcmdzPy5mb3JjZSA9PT0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gZm9yY2VcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdpbmZvcm1hdGlvbicsICdxdWVyeS1pbmZvcm1hdGlvbicsIHRhZywgeyBmb3JjZTogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBhd2FpdCByZXF1ZXN0ZXIoJ2luZm9ybWF0aW9uJywgJ3F1ZXJ5LWluZm9ybWF0aW9uJywgdGFnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5mbyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kOiBpbmZvICE9PSBudWxsICYmIGluZm8gIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWlsKCfmn6Xor6IgaW5mb3JtYXRpb24g5L+h5oGv5aSx6LSlJywgbm9ybWFsaXplRXJyb3IoZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdkaWFnbm9zdGljX3F1ZXJ5X3Byb2dyYW1faW5mbycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivouaMh+Wumueoi+W6j+iDveWKm+S/oeaBr++8iHByb2dyYW0ucXVlcnktcHJvZ3JhbS1pbmZv77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwcm9ncmFtSWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnqIvluo/moIfor4bvvIzkvovlpoIgdnNjb2RlJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogWydwcm9ncmFtSWQnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiBbJ3Byb2dyYW0ucXVlcnktcHJvZ3JhbS1pbmZvJ10sXG4gICAgICAgICAgICBydW46IGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9ncmFtSWQgPSB0b05vbkVtcHR5U3RyaW5nKGFyZ3M/LnByb2dyYW1JZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFwcm9ncmFtSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ3Byb2dyYW1JZCDlv4XloasnLCB1bmRlZmluZWQsICdFX0lOVkFMSURfQVJHVU1FTlQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtJywgJ3F1ZXJ5LXByb2dyYW0taW5mbycsIHByb2dyYW1JZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9ncmFtSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3VuZDogaW5mbyAhPT0gbnVsbCAmJiBpbmZvICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBwcm9ncmFtIOS/oeaBr+Wksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9zaGFyZWRfc2V0dGluZ3MnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICfmn6Xor6IgcHJvZ3JhbW1pbmcg5YWx5Lqr6K6+572u77yIcXVlcnktc2hhcmVkLXNldHRpbmdz77yJJyxcbiAgICAgICAgICAgIGxheWVyOiAnb2ZmaWNpYWwnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdkaWFnbm9zdGljJyxcbiAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZENhcGFiaWxpdGllczogWydwcm9ncmFtbWluZy5xdWVyeS1zaGFyZWQtc2V0dGluZ3MnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtbWluZycsICdxdWVyeS1zaGFyZWQtc2V0dGluZ3MnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9rKHsgc2V0dGluZ3MgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFpbCgn5p+l6K+iIHByb2dyYW1taW5nIOWFseS6q+iuvue9ruWksei0pScsIG5vcm1hbGl6ZUVycm9yKGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZGlhZ25vc3RpY19xdWVyeV9zb3J0ZWRfcGx1Z2lucycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+afpeivoiBwcm9ncmFtbWluZyDmj5Lku7bohJrmnKzpobrluo/vvIhxdWVyeS1zb3J0ZWQtcGx1Z2luc++8iScsXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnZGlhZ25vc3RpYycsXG4gICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+WPr+mAie+8jOmAj+S8oCBxdWVyeS1zb3J0ZWQtcGx1Z2lucyDnmoTov4fmu6Tlj4LmlbAnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IFsncHJvZ3JhbW1pbmcucXVlcnktc29ydGVkLXBsdWdpbnMnXSxcbiAgICAgICAgICAgIHJ1bjogYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzPy5vcHRpb25zICYmIHR5cGVvZiBhcmdzLm9wdGlvbnMgPT09ICdvYmplY3QnID8gYXJncy5vcHRpb25zIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGx1Z2lucyA9IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXdhaXQgcmVxdWVzdGVyKCdwcm9ncmFtbWluZycsICdxdWVyeS1zb3J0ZWQtcGx1Z2lucycsIG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHJlcXVlc3RlcigncHJvZ3JhbW1pbmcnLCAncXVlcnktc29ydGVkLXBsdWdpbnMnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkocGx1Z2lucykgPyBwbHVnaW5zIDogW107XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBwbHVnaW5zOiBsaXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IGxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhaWwoJ+afpeivoiBwcm9ncmFtbWluZyDmj5Lku7bpobrluo/lpLHotKUnLCBub3JtYWxpemVFcnJvcihlcnJvcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIF07XG59XG4iXX0=