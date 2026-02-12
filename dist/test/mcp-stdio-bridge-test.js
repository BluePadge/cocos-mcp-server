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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function createMockUpstreamServer() {
    const server = http.createServer(async (req, res) => {
        var _a, e_1, _b, _c;
        var _d;
        if (req.method !== 'POST' || req.url !== '/mcp') {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
        }
        let body = '';
        try {
            for (var _e = true, req_1 = __asyncValues(req), req_1_1; req_1_1 = await req_1.next(), _a = req_1_1.done, !_a; _e = true) {
                _c = req_1_1.value;
                _e = false;
                const chunk = _c;
                body += chunk.toString();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_e && !_a && (_b = req_1.return)) await _b.call(req_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        let message;
        try {
            message = JSON.parse(body);
        }
        catch (error) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: `Parse error: ${error.message}`
                }
            }));
            return;
        }
        if (message.method === 'initialize') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('MCP-Session-Id', 'bridge-session');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                    protocolVersion: '2025-11-25',
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: 'mock-upstream',
                        version: '1.0.0'
                    }
                }
            }));
            return;
        }
        if (message.method === 'notifications/initialized') {
            res.statusCode = 202;
            res.end();
            return;
        }
        if (message.method === 'tools/list') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                    tools: [{ name: 'mock_echo' }]
                }
            }));
            return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: (_d = message.id) !== null && _d !== void 0 ? _d : null,
            error: {
                code: -32601,
                message: 'Method not found'
            }
        }));
    });
    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, port: address.port });
        });
        server.on('error', reject);
    });
}
async function main() {
    const upstream = await createMockUpstreamServer();
    const bridgePath = path.join(process.cwd(), 'dist', 'stdio-http-bridge.js');
    const child = (0, child_process_1.spawn)(process.execPath, [bridgePath, '--url', `http://127.0.0.1:${upstream.port}/mcp`], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    const outputLines = [];
    let stdoutBuffer = '';
    const waiters = [];
    const flushWaiter = (line) => {
        const waiter = waiters.shift();
        if (!waiter) {
            return;
        }
        clearTimeout(waiter.timeout);
        waiter.resolve(line);
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk;
        while (true) {
            const newlineIndex = stdoutBuffer.indexOf('\n');
            if (newlineIndex === -1) {
                break;
            }
            const line = stdoutBuffer.slice(0, newlineIndex).trim();
            stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
            if (!line) {
                continue;
            }
            if (waiters.length > 0) {
                flushWaiter(line);
            }
            else {
                outputLines.push(line);
            }
        }
    });
    child.stderr.setEncoding('utf8');
    const waitForLine = (timeoutMs = 3000) => {
        if (outputLines.length > 0) {
            return Promise.resolve(outputLines.shift());
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`等待桥接输出超时（${timeoutMs}ms）`));
            }, timeoutMs);
            waiters.push({ resolve, reject, timeout });
        });
    };
    const writeLine = (line) => {
        child.stdin.write(`${line}\n`);
    };
    try {
        // 非法 JSON 行
        writeLine('not-json');
        const parseErrorLine = await waitForLine();
        const parseError = JSON.parse(parseErrorLine);
        assert.strictEqual(parseError.error.code, -32700);
        // initialize request
        writeLine(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-11-25' }
        }));
        const initializeLine = await waitForLine();
        assert.ok(!initializeLine.startsWith('Content-Length:'), 'stdout 不应输出 Content-Length 帧头');
        const initializeResponse = JSON.parse(initializeLine);
        assert.strictEqual(initializeResponse.id, 1);
        assert.ok(initializeResponse.result);
        // initialized notification（不应有回包）
        const lineCountBeforeNotification = outputLines.length;
        writeLine(JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        }));
        await new Promise((resolve) => setTimeout(resolve, 250));
        assert.strictEqual(outputLines.length, lineCountBeforeNotification);
        // tools/list request
        writeLine(JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list'
        }));
        const toolsListLine = await waitForLine();
        const toolsListResponse = JSON.parse(toolsListLine);
        assert.strictEqual(toolsListResponse.id, 2);
        assert.ok(Array.isArray(toolsListResponse.result.tools));
        assert.strictEqual(toolsListResponse.result.tools[0].name, 'mock_echo');
        console.log('mcp-stdio-bridge-test: PASS');
    }
    finally {
        child.kill('SIGTERM');
        upstream.server.close();
    }
}
main().catch((error) => {
    console.error('mcp-stdio-bridge-test: FAIL');
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXN0ZGlvLWJyaWRnZS10ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rlc3QvbWNwLXN0ZGlvLWJyaWRnZS10ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUNqQywyQ0FBNkI7QUFFN0IsaURBQXNFO0FBQ3RFLDJDQUE2QjtBQVE3QixTQUFTLHdCQUF3QjtJQUM3QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7OztRQUNoRCxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDOUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUM7WUFDckIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoRCxPQUFPO1FBQ1gsQ0FBQztRQUVELElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQzs7WUFDZCxLQUEwQixlQUFBLFFBQUEsY0FBQSxHQUFHLENBQUEsU0FBQSxtRUFBRSxDQUFDO2dCQUFOLG1CQUFHO2dCQUFILFdBQUc7Z0JBQWxCLE1BQU0sS0FBSyxLQUFBLENBQUE7Z0JBQ2xCLElBQUksSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDN0IsQ0FBQzs7Ozs7Ozs7O1FBRUQsSUFBSSxPQUFZLENBQUM7UUFDakIsSUFBSSxDQUFDO1lBQ0QsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsR0FBRyxDQUFDLFVBQVUsR0FBRyxHQUFHLENB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LENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3RCLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDNUIsQ0FBQztBQUNMLENBQUM7QUFFRCxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNuQixPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7SUFDN0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgQWRkcmVzc0luZm8gfSBmcm9tICduZXQnO1xuaW1wb3J0IHsgc3Bhd24sIENoaWxkUHJvY2Vzc1dpdGhvdXROdWxsU3RyZWFtcyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuaW50ZXJmYWNlIExpbmVXYWl0ZXIge1xuICAgIHJlc29sdmU6IChsaW5lOiBzdHJpbmcpID0+IHZvaWQ7XG4gICAgcmVqZWN0OiAoZXJyb3I6IEVycm9yKSA9PiB2b2lkO1xuICAgIHRpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNb2NrVXBzdHJlYW1TZXJ2ZXIoKTogUHJvbWlzZTx7IHNlcnZlcjogaHR0cC5TZXJ2ZXI7IHBvcnQ6IG51bWJlciB9PiB7XG4gICAgY29uc3Qgc2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIoYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcgfHwgcmVxLnVybCAhPT0gJy9tY3AnKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNDtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ05vdCBmb3VuZCcgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGJvZHkgPSAnJztcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIHtcbiAgICAgICAgICAgIGJvZHkgKz0gY2h1bmsudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtZXNzYWdlOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBtZXNzYWdlID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgaWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgZXJyb3I6IHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogLTMyNzAwLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUGFyc2UgZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1lc3NhZ2UubWV0aG9kID09PSAnaW5pdGlhbGl6ZScpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ01DUC1TZXNzaW9uLUlkJywgJ2JyaWRnZS1zZXNzaW9uJyk7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgICAgICAgICAgICByZXN1bHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvdG9jb2xWZXJzaW9uOiAnMjAyNS0xMS0yNScsXG4gICAgICAgICAgICAgICAgICAgIGNhcGFiaWxpdGllczogeyB0b29sczoge30gfSxcbiAgICAgICAgICAgICAgICAgICAgc2VydmVySW5mbzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ21vY2stdXBzdHJlYW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogJzEuMC4wJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1lc3NhZ2UubWV0aG9kID09PSAnbm90aWZpY2F0aW9ucy9pbml0aWFsaXplZCcpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAyO1xuICAgICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1lc3NhZ2UubWV0aG9kID09PSAndG9vbHMvbGlzdCcpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgICAgIGlkOiBtZXNzYWdlLmlkLFxuICAgICAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgICAgICB0b29sczogW3sgbmFtZTogJ21vY2tfZWNobycgfV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiBtZXNzYWdlLmlkID8/IG51bGwsXG4gICAgICAgICAgICBlcnJvcjoge1xuICAgICAgICAgICAgICAgIGNvZGU6IC0zMjYwMSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnTWV0aG9kIG5vdCBmb3VuZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgc2VydmVyLmxpc3RlbigwLCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYWRkcmVzcyA9IHNlcnZlci5hZGRyZXNzKCkgYXMgQWRkcmVzc0luZm87XG4gICAgICAgICAgICByZXNvbHZlKHsgc2VydmVyLCBwb3J0OiBhZGRyZXNzLnBvcnQgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZXJ2ZXIub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB1cHN0cmVhbSA9IGF3YWl0IGNyZWF0ZU1vY2tVcHN0cmVhbVNlcnZlcigpO1xuICAgIGNvbnN0IGJyaWRnZVBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QnLCAnc3RkaW8taHR0cC1icmlkZ2UuanMnKTtcblxuICAgIGNvbnN0IGNoaWxkOiBDaGlsZFByb2Nlc3NXaXRob3V0TnVsbFN0cmVhbXMgPSBzcGF3bihcbiAgICAgICAgcHJvY2Vzcy5leGVjUGF0aCxcbiAgICAgICAgW2JyaWRnZVBhdGgsICctLXVybCcsIGBodHRwOi8vMTI3LjAuMC4xOiR7dXBzdHJlYW0ucG9ydH0vbWNwYF0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ11cbiAgICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBvdXRwdXRMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgc3Rkb3V0QnVmZmVyID0gJyc7XG4gICAgY29uc3Qgd2FpdGVyczogTGluZVdhaXRlcltdID0gW107XG5cbiAgICBjb25zdCBmbHVzaFdhaXRlciA9IChsaW5lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3Qgd2FpdGVyID0gd2FpdGVycy5zaGlmdCgpO1xuICAgICAgICBpZiAoIXdhaXRlcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNsZWFyVGltZW91dCh3YWl0ZXIudGltZW91dCk7XG4gICAgICAgIHdhaXRlci5yZXNvbHZlKGxpbmUpO1xuICAgIH07XG5cbiAgICBjaGlsZC5zdGRvdXQuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICBjaGlsZC5zdGRvdXQub24oJ2RhdGEnLCAoY2h1bms6IHN0cmluZykgPT4ge1xuICAgICAgICBzdGRvdXRCdWZmZXIgKz0gY2h1bms7XG5cbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld2xpbmVJbmRleCA9IHN0ZG91dEJ1ZmZlci5pbmRleE9mKCdcXG4nKTtcbiAgICAgICAgICAgIGlmIChuZXdsaW5lSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBzdGRvdXRCdWZmZXIuc2xpY2UoMCwgbmV3bGluZUluZGV4KS50cmltKCk7XG4gICAgICAgICAgICBzdGRvdXRCdWZmZXIgPSBzdGRvdXRCdWZmZXIuc2xpY2UobmV3bGluZUluZGV4ICsgMSk7XG5cbiAgICAgICAgICAgIGlmICghbGluZSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAod2FpdGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZmx1c2hXYWl0ZXIobGluZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG91dHB1dExpbmVzLnB1c2gobGluZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGNoaWxkLnN0ZGVyci5zZXRFbmNvZGluZygndXRmOCcpO1xuXG4gICAgY29uc3Qgd2FpdEZvckxpbmUgPSAodGltZW91dE1zOiBudW1iZXIgPSAzMDAwKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgICAgICAgaWYgKG91dHB1dExpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUob3V0cHV0TGluZXMuc2hpZnQoKSBhcyBzdHJpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGDnrYnlvoXmoaXmjqXovpPlh7rotoXml7bvvIgke3RpbWVvdXRNc31tc++8iWApKTtcbiAgICAgICAgICAgIH0sIHRpbWVvdXRNcyk7XG5cbiAgICAgICAgICAgIHdhaXRlcnMucHVzaCh7IHJlc29sdmUsIHJlamVjdCwgdGltZW91dCB9KTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGNvbnN0IHdyaXRlTGluZSA9IChsaW5lOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgY2hpbGQuc3RkaW4ud3JpdGUoYCR7bGluZX1cXG5gKTtcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgICAgLy8g6Z2e5rOVIEpTT04g6KGMXG4gICAgICAgIHdyaXRlTGluZSgnbm90LWpzb24nKTtcbiAgICAgICAgY29uc3QgcGFyc2VFcnJvckxpbmUgPSBhd2FpdCB3YWl0Rm9yTGluZSgpO1xuICAgICAgICBjb25zdCBwYXJzZUVycm9yID0gSlNPTi5wYXJzZShwYXJzZUVycm9yTGluZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZUVycm9yLmVycm9yLmNvZGUsIC0zMjcwMCk7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSByZXF1ZXN0XG4gICAgICAgIHdyaXRlTGluZShKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkOiAxLFxuICAgICAgICAgICAgbWV0aG9kOiAnaW5pdGlhbGl6ZScsXG4gICAgICAgICAgICBwYXJhbXM6IHsgcHJvdG9jb2xWZXJzaW9uOiAnMjAyNS0xMS0yNScgfVxuICAgICAgICB9KSk7XG5cbiAgICAgICAgY29uc3QgaW5pdGlhbGl6ZUxpbmUgPSBhd2FpdCB3YWl0Rm9yTGluZSgpO1xuICAgICAgICBhc3NlcnQub2soIWluaXRpYWxpemVMaW5lLnN0YXJ0c1dpdGgoJ0NvbnRlbnQtTGVuZ3RoOicpLCAnc3Rkb3V0IOS4jeW6lOi+k+WHuiBDb250ZW50LUxlbmd0aCDluKflpLQnKTtcbiAgICAgICAgY29uc3QgaW5pdGlhbGl6ZVJlc3BvbnNlID0gSlNPTi5wYXJzZShpbml0aWFsaXplTGluZSk7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChpbml0aWFsaXplUmVzcG9uc2UuaWQsIDEpO1xuICAgICAgICBhc3NlcnQub2soaW5pdGlhbGl6ZVJlc3BvbnNlLnJlc3VsdCk7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZWQgbm90aWZpY2F0aW9u77yI5LiN5bqU5pyJ5Zue5YyF77yJXG4gICAgICAgIGNvbnN0IGxpbmVDb3VudEJlZm9yZU5vdGlmaWNhdGlvbiA9IG91dHB1dExpbmVzLmxlbmd0aDtcbiAgICAgICAgd3JpdGVMaW5lKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgbWV0aG9kOiAnbm90aWZpY2F0aW9ucy9pbml0aWFsaXplZCdcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDI1MCkpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0TGluZXMubGVuZ3RoLCBsaW5lQ291bnRCZWZvcmVOb3RpZmljYXRpb24pO1xuXG4gICAgICAgIC8vIHRvb2xzL2xpc3QgcmVxdWVzdFxuICAgICAgICB3cml0ZUxpbmUoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBpZDogMixcbiAgICAgICAgICAgIG1ldGhvZDogJ3Rvb2xzL2xpc3QnXG4gICAgICAgIH0pKTtcblxuICAgICAgICBjb25zdCB0b29sc0xpc3RMaW5lID0gYXdhaXQgd2FpdEZvckxpbmUoKTtcbiAgICAgICAgY29uc3QgdG9vbHNMaXN0UmVzcG9uc2UgPSBKU09OLnBhcnNlKHRvb2xzTGlzdExpbmUpO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwodG9vbHNMaXN0UmVzcG9uc2UuaWQsIDIpO1xuICAgICAgICBhc3NlcnQub2soQXJyYXkuaXNBcnJheSh0b29sc0xpc3RSZXNwb25zZS5yZXN1bHQudG9vbHMpKTtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xzTGlzdFJlc3BvbnNlLnJlc3VsdC50b29sc1swXS5uYW1lLCAnbW9ja19lY2hvJyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ21jcC1zdGRpby1icmlkZ2UtdGVzdDogUEFTUycpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICAgIGNoaWxkLmtpbGwoJ1NJR1RFUk0nKTtcbiAgICAgICAgdXBzdHJlYW0uc2VydmVyLmNsb3NlKCk7XG4gICAgfVxufVxuXG5tYWluKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcignbWNwLXN0ZGlvLWJyaWRnZS10ZXN0OiBGQUlMJyk7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=