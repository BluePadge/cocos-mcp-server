#!/usr/bin/env node
/* eslint-disable no-console */

const DEFAULT_ENDPOINT = 'http://127.0.0.1:3000/mcp';

function parseArgs(argv) {
    const options = {
        endpoint: DEFAULT_ENDPOINT
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--endpoint') {
            options.endpoint = argv[i + 1] || DEFAULT_ENDPOINT;
            i += 1;
        }
    }

    return options;
}

async function post(endpoint, body, sessionId) {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) {
        headers['MCP-Session-Id'] = sessionId;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }

    return {
        status: response.status,
        headers: response.headers,
        text,
        json
    };
}

function parseToolCallResult(response) {
    const structured = response?.json?.result?.structuredContent;
    if (structured && typeof structured.success === 'boolean') {
        return {
            ok: structured.success === true,
            data: structured.data || null,
            error: structured.error?.message || ''
        };
    }

    if (response?.json?.error) {
        return {
            ok: false,
            data: null,
            error: response.json.error.message || 'jsonrpc error'
        };
    }

    return {
        ok: false,
        data: null,
        error: 'invalid response'
    };
}

async function main() {
    const options = parseArgs(process.argv);
    const endpoint = options.endpoint;
    const steps = [];
    const cleanup = [];

    const temp = {
        rootNodeUuid: null,
        jsonUrl: null
    };

    let sessionId = null;
    try {
        const initialize = await post(endpoint, {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: {
                    name: 'mcp-online-smoke',
                    version: '1.0.0'
                }
            }
        });

        sessionId = initialize.headers.get('mcp-session-id');
        if (!sessionId) {
            throw new Error(`initialize 未返回 MCP-Session-Id，status=${initialize.status}`);
        }

        await post(endpoint, {
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        }, sessionId);

        const listResponse = await post(endpoint, {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        }, sessionId);

        const tools = listResponse?.json?.result?.tools || [];
        const toolNames = new Set(tools.map((item) => item.name));
        const requiredTools = [
            'scene_query_status',
            'component_query_classes',
            'asset_generate_available_url',
            'project_query_config',
            'preferences_query_config',
            'scene_create_game_object',
            'scene_delete_game_object',
            'asset_create_asset',
            'asset_save_asset',
            'asset_delete_asset'
        ];
        const missingTools = requiredTools.filter((name) => !toolNames.has(name));
        if (missingTools.length > 0) {
            throw new Error(`缺少关键工具: ${missingTools.join(', ')}`);
        }

        console.log(`[smoke] tools=${tools.length}`);

        async function callTool(name, argumentsObject, id) {
            const response = await post(endpoint, {
                jsonrpc: '2.0',
                id,
                method: 'tools/call',
                params: {
                    name,
                    arguments: argumentsObject || {}
                }
            }, sessionId);

            const parsed = parseToolCallResult(response);
            steps.push({
                name,
                ok: parsed.ok,
                error: parsed.error
            });
            if (!parsed.ok) {
                throw new Error(`${name} 失败: ${parsed.error}`);
            }
            return parsed.data || {};
        }

        await callTool('scene_query_status', { includeBounds: false }, 10);
        await callTool('component_query_classes', {}, 11);
        await callTool('project_query_config', { configType: 'project' }, 12);
        await callTool('preferences_query_config', { configType: 'general' }, 13);

        const availableJson = await callTool('asset_generate_available_url', {
            url: 'db://assets/__mcp_online_smoke__.json'
        }, 20);
        temp.jsonUrl = availableJson.availableUrl;

        const rootNode = await callTool('scene_create_game_object', {
            name: '__mcp_online_smoke_root__'
        }, 30);
        temp.rootNodeUuid = rootNode.nodeUuid;

        await callTool('asset_create_asset', {
            url: temp.jsonUrl,
            content: '{"phase":"create","ok":true}',
            contentEncoding: 'utf8'
        }, 40);

        await callTool('asset_save_asset', {
            url: temp.jsonUrl,
            content: '{"phase":"save","ok":true}',
            contentEncoding: 'utf8'
        }, 41);

        console.log('[smoke] RESULT=PASS');
    } catch (error) {
        console.log('[smoke] RESULT=FAIL');
        console.log(`[smoke] ERROR=${error?.message || String(error)}`);
        process.exitCode = 1;
    } finally {
        async function cleanupTool(name, argumentsObject, id) {
            if (!sessionId) {
                return;
            }
            try {
                const response = await post(endpoint, {
                    jsonrpc: '2.0',
                    id,
                    method: 'tools/call',
                    params: {
                        name,
                        arguments: argumentsObject || {}
                    }
                }, sessionId);
                const parsed = parseToolCallResult(response);
                cleanup.push({
                    name,
                    ok: parsed.ok,
                    error: parsed.error
                });
            } catch (error) {
                cleanup.push({
                    name,
                    ok: false,
                    error: error?.message || String(error)
                });
            }
        }

        if (temp.rootNodeUuid) {
            await cleanupTool('scene_delete_game_object', { uuids: [temp.rootNodeUuid] }, 900);
        }
        if (temp.jsonUrl) {
            await cleanupTool('asset_delete_asset', { url: temp.jsonUrl }, 901);
        }

        if (sessionId) {
            await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'MCP-Session-Id': sessionId
                }
            }).catch(() => {});
        }

        console.log('---step summary---');
        for (const step of steps) {
            console.log(`${step.ok ? 'OK' : 'FAIL'} ${step.name}${step.ok ? '' : ` err=${step.error}`}`);
        }
        console.log('---cleanup summary---');
        for (const item of cleanup) {
            console.log(`${item.ok ? 'OK' : 'FAIL'} ${item.name}${item.ok ? '' : ` err=${item.error}`}`);
        }
    }
}

main().catch((error) => {
    console.error('[smoke] 执行异常', error);
    process.exit(1);
});
