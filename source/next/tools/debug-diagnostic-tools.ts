import * as fs from 'fs';
import * as path from 'path';
import { EditorRequester, NextToolDefinition } from '../models';
import { fail, normalizeError, ok, toNonEmptyString } from './common';

type LogLevel = 'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

interface LogContextLine {
    lineNumber: number;
    content: string;
    isMatch: boolean;
}

interface LogSearchMatch {
    lineNumber: number;
    matchedLine: string;
    context: LogContextLine[];
}

interface LoadedLogContent {
    logFilePath: string;
    candidates: string[];
    rawLines: string[];
    nonEmptyLines: string[];
}

const DEFAULT_LOG_RELATIVE_PATH = path.join('temp', 'logs', 'project.log');

function clampInt(value: any, fallback: number, min: number, max: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    return Math.min(Math.max(Math.floor(num), min), max);
}

function normalizeLogLevel(value: any): LogLevel | null {
    if (typeof value !== 'string') {
        return 'ALL';
    }
    const upper = value.trim().toUpperCase();
    if (upper === 'ALL' || upper === 'ERROR' || upper === 'WARN' || upper === 'INFO' || upper === 'DEBUG' || upper === 'TRACE') {
        return upper;
    }
    return null;
}

function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function uniquePaths(paths: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const filePath of paths) {
        if (!filePath || seen.has(filePath)) {
            continue;
        }
        seen.add(filePath);
        result.push(filePath);
    }
    return result;
}

function findExistingFile(paths: string[]): string | null {
    for (const filePath of paths) {
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                return filePath;
            }
        } catch {
            continue;
        }
    }
    return null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterLinesByLevel(lines: string[], logLevel: LogLevel): string[] {
    if (logLevel === 'ALL') {
        return lines;
    }
    const pattern = new RegExp(`(?:\\[|\\b)${logLevel}(?:\\]|\\b)`, 'i');
    return lines.filter((line) => pattern.test(line));
}

function filterLinesByKeyword(lines: string[], keyword: string | null): string[] {
    if (!keyword) {
        return lines;
    }
    const lower = keyword.toLowerCase();
    return lines.filter((line) => line.toLowerCase().includes(lower));
}

function summarizeLogLevels(lines: string[]): Record<string, number> {
    const result: Record<string, number> = {
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

function resolveProjectPathFromConfig(config: any): string | null {
    if (typeof config === 'string') {
        const value = config.trim();
        return value === '' ? null : value;
    }

    if (!config || typeof config !== 'object') {
        return null;
    }

    const candidates = [
        (config as Record<string, any>).path,
        (config as Record<string, any>).projectPath,
        (config as Record<string, any>).root,
        (config as Record<string, any>).cwd
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim() !== '') {
            return candidate.trim();
        }
    }

    return null;
}

async function buildLogCandidates(requester: EditorRequester, args: any): Promise<string[]> {
    const explicitLogFilePath = toNonEmptyString(args?.logFilePath);
    const explicitProjectPath = toNonEmptyString(args?.projectPath);

    let projectPathFromConfig: string | null = null;
    if (!explicitLogFilePath && !explicitProjectPath) {
        try {
            const config = await requester('project', 'query-config', 'project');
            projectPathFromConfig = resolveProjectPathFromConfig(config);
        } catch {
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

async function loadProjectLogContent(
    requester: EditorRequester,
    args: any
): Promise<{ ok: true; value: LoadedLogContent } | { ok: false; error: string; candidates: string[] }> {
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
    } catch (error: any) {
        return {
            ok: false,
            error: `读取 project.log 失败：${normalizeError(error)}`,
            candidates
        };
    }
}

function extractLogSummary(lines: string[]): {
    totalLines: number;
    byLevel: Record<string, number>;
    hasError: boolean;
    hasWarn: boolean;
} {
    const byLevel = summarizeLogLevels(lines);
    return {
        totalLines: lines.length,
        byLevel,
        hasError: byLevel.ERROR > 0,
        hasWarn: byLevel.WARN > 0
    };
}

function toNumberOrNull(value: any): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function createDebugDiagnosticTools(requester: EditorRequester): NextToolDefinition[] {
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
            run: async (args: any) => {
                const includeLogSummary = args?.includeLogSummary !== false;
                const lines = clampInt(args?.lines, 200, 1, 10000);

                try {
                    const ready = await requester('builder', 'query-worker-ready');
                    const data: Record<string, any> = {
                        ready: ready === true,
                        status: ready === true ? 'ready' : 'not_ready'
                    };

                    if (includeLogSummary) {
                        const loaded = await loadProjectLogContent(requester, {
                            projectPath: args?.projectPath,
                            logFilePath: args?.logFilePath
                        });
                        if (loaded.ok) {
                            const selectedLines = loaded.value.nonEmptyLines.slice(-lines);
                            data.logSummary = {
                                logFilePath: loaded.value.logFilePath,
                                requestedLines: lines,
                                ...extractLogSummary(selectedLines)
                            };
                        } else {
                            data.logSummaryError = loaded.error;
                        }
                    }

                    return ok(data);
                } catch (error: any) {
                    return fail('检查构建状态失败', normalizeError(error));
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
            run: async (args: any) => {
                const lines = clampInt(args?.lines, 200, 1, 10000);
                const logLevel = normalizeLogLevel(args?.logLevel);
                if (!logLevel) {
                    return fail('logLevel 仅支持 ALL/ERROR/WARN/INFO/DEBUG/TRACE', undefined, 'E_INVALID_ARGUMENT');
                }

                const filterKeyword = toNonEmptyString(args?.filterKeyword);
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return fail('读取项目日志失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }

                const selectedLines = loaded.value.nonEmptyLines.slice(-lines);
                const byLevel = filterLinesByLevel(selectedLines, logLevel);
                const filtered = filterLinesByKeyword(byLevel, filterKeyword);

                return ok({
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
            run: async (args: any) => {
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return fail('查询日志文件信息失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }

                try {
                    const stat = fs.statSync(loaded.value.logFilePath);
                    return ok({
                        filePath: loaded.value.logFilePath,
                        fileSize: stat.size,
                        fileSizeFormatted: formatFileSize(stat.size),
                        createdAt: stat.birthtime.toISOString(),
                        modifiedAt: stat.mtime.toISOString(),
                        lineCount: loaded.value.nonEmptyLines.length,
                        candidatePaths: loaded.value.candidates
                    });
                } catch (error: any) {
                    return fail('读取日志文件属性失败', normalizeError(error));
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
            run: async (args: any) => {
                const pattern = toNonEmptyString(args?.pattern);
                if (!pattern) {
                    return fail('pattern 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const useRegex = args?.useRegex !== false;
                const caseSensitive = args?.caseSensitive === true;
                const maxResults = clampInt(args?.maxResults, 20, 1, 200);
                const contextLines = clampInt(args?.contextLines, 2, 0, 10);
                const loaded = await loadProjectLogContent(requester, args);
                if (!loaded.ok) {
                    return fail('搜索项目日志失败', loaded.error, 'E_LOG_FILE_NOT_FOUND');
                }

                let regex: RegExp;
                try {
                    const source = useRegex ? pattern : escapeRegExp(pattern);
                    regex = new RegExp(source, caseSensitive ? 'g' : 'gi');
                } catch (error: any) {
                    return fail('pattern 不是合法正则表达式', normalizeError(error), 'E_INVALID_ARGUMENT');
                }

                const matches: LogSearchMatch[] = [];
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
                    const context: LogContextLine[] = [];
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

                return ok({
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
                try {
                    const raw = await requester('scene', 'query-performance');
                    return ok({
                        nodeCount: toNumberOrNull(raw?.nodeCount),
                        componentCount: toNumberOrNull(raw?.componentCount),
                        drawCalls: toNumberOrNull(raw?.drawCalls),
                        triangles: toNumberOrNull(raw?.triangles),
                        memory: raw?.memory ?? null,
                        raw
                    });
                } catch (error: any) {
                    return fail('查询性能快照失败', normalizeError(error));
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
            run: async (args: any) => {
                const tag = toNonEmptyString(args?.tag);
                if (!tag) {
                    return fail('tag 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                const force = args?.force === true;
                try {
                    const info = force
                        ? await requester('information', 'query-information', tag, { force: true })
                        : await requester('information', 'query-information', tag);
                    return ok({
                        tag,
                        force,
                        info,
                        found: info !== null && info !== undefined
                    });
                } catch (error: any) {
                    return fail('查询 information 信息失败', normalizeError(error));
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
            run: async (args: any) => {
                const programId = toNonEmptyString(args?.programId);
                if (!programId) {
                    return fail('programId 必填', undefined, 'E_INVALID_ARGUMENT');
                }

                try {
                    const info = await requester('program', 'query-program-info', programId);
                    return ok({
                        programId,
                        found: info !== null && info !== undefined,
                        info
                    });
                } catch (error: any) {
                    return fail('查询 program 信息失败', normalizeError(error));
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
                    return ok({ settings });
                } catch (error: any) {
                    return fail('查询 programming 共享设置失败', normalizeError(error));
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
            run: async (args: any) => {
                const options = args?.options && typeof args.options === 'object' ? args.options : undefined;

                try {
                    const plugins = options
                        ? await requester('programming', 'query-sorted-plugins', options)
                        : await requester('programming', 'query-sorted-plugins');
                    const list = Array.isArray(plugins) ? plugins : [];
                    return ok({
                        options: options || null,
                        plugins: list,
                        count: list.length
                    });
                } catch (error: any) {
                    return fail('查询 programming 插件顺序失败', normalizeError(error));
                }
            }
        }
    ];
}
