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
const official_tools_1 = require("../next/tools/official-tools");
const tool_registry_1 = require("../next/protocol/tool-registry");
const router_1 = require("../next/protocol/router");
function createMatrix(availableKeys) {
    const byKey = {};
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
async function main() {
    const openAssetCalls = [];
    const requester = async (channel, method, ...args) => {
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
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const registry = new tool_registry_1.NextToolRegistry(tools, createMatrix(['asset-db.open-asset']));
    const router = new router_1.NextMcpRouter(registry);
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
    assert.strictEqual(response.result.isError, false);
    assert.strictEqual(response.result.structuredContent.data.opened, true);
    assert.strictEqual(response.result.structuredContent.data.sceneUrl, 'db://assets/scenes/boot.scene');
    assert.strictEqual(response.result.structuredContent.data.resolvedSceneUrl, 'db://assets/scenes/boot.scene');
    assert.strictEqual(response.result.structuredContent.data.openMethod, 'asset-db.open-asset');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dC1zY2VuZS1vcGVuLWNvbXBhdC10ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rlc3QvbmV4dC1zY2VuZS1vcGVuLWNvbXBhdC10ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsK0NBQWlDO0FBRWpDLGlFQUFtRTtBQUNuRSxrRUFBa0U7QUFDbEUsb0RBQXdEO0FBRXhELFNBQVMsWUFBWSxDQUFDLGFBQXVCO0lBQ3pDLE1BQU0sS0FBSyxHQUE4QixFQUFFLENBQUM7SUFDNUMsS0FBSyxNQUFNLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztRQUM5QixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRztZQUNULEdBQUc7WUFDSCxPQUFPLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDO1lBQy9CLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFDL0IsS0FBSyxFQUFFLFVBQVU7WUFDakIsUUFBUSxFQUFFLEtBQUs7WUFDZixXQUFXLEVBQUUsR0FBRztZQUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxNQUFNLEVBQUUsSUFBSTtTQUNmLENBQUM7SUFDTixDQUFDO0lBRUQsT0FBTztRQUNILFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxLQUFLO1FBQ0wsT0FBTyxFQUFFO1lBQ0wsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMvQixXQUFXLEVBQUUsQ0FBQztZQUNkLE9BQU8sRUFBRTtnQkFD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RUFBRTtJQUNuQixPQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7SUFDbkQsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYXBhYmlsaXR5TWF0cml4IH0gZnJvbSAnLi4vbmV4dC9tb2RlbHMnO1xuaW1wb3J0IHsgY3JlYXRlT2ZmaWNpYWxUb29scyB9IGZyb20gJy4uL25leHQvdG9vbHMvb2ZmaWNpYWwtdG9vbHMnO1xuaW1wb3J0IHsgTmV4dFRvb2xSZWdpc3RyeSB9IGZyb20gJy4uL25leHQvcHJvdG9jb2wvdG9vbC1yZWdpc3RyeSc7XG5pbXBvcnQgeyBOZXh0TWNwUm91dGVyIH0gZnJvbSAnLi4vbmV4dC9wcm90b2NvbC9yb3V0ZXInO1xuXG5mdW5jdGlvbiBjcmVhdGVNYXRyaXgoYXZhaWxhYmxlS2V5czogc3RyaW5nW10pOiBDYXBhYmlsaXR5TWF0cml4IHtcbiAgICBjb25zdCBieUtleTogQ2FwYWJpbGl0eU1hdHJpeFsnYnlLZXknXSA9IHt9O1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGF2YWlsYWJsZUtleXMpIHtcbiAgICAgICAgY29uc3QgZmlyc3REb3QgPSBrZXkuaW5kZXhPZignLicpO1xuICAgICAgICBieUtleVtrZXldID0ge1xuICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgY2hhbm5lbDoga2V5LnNsaWNlKDAsIGZpcnN0RG90KSxcbiAgICAgICAgICAgIG1ldGhvZDoga2V5LnNsaWNlKGZpcnN0RG90ICsgMSksXG4gICAgICAgICAgICBsYXllcjogJ29mZmljaWFsJyxcbiAgICAgICAgICAgIHJlYWRvbmx5OiBmYWxzZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBrZXksXG4gICAgICAgICAgICBhdmFpbGFibGU6IHRydWUsXG4gICAgICAgICAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGRldGFpbDogJ29rJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIGJ5S2V5LFxuICAgICAgICBzdW1tYXJ5OiB7XG4gICAgICAgICAgICB0b3RhbDogYXZhaWxhYmxlS2V5cy5sZW5ndGgsXG4gICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgdW5hdmFpbGFibGU6IDAsXG4gICAgICAgICAgICBieUxheWVyOiB7XG4gICAgICAgICAgICAgICAgb2ZmaWNpYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IGF2YWlsYWJsZUtleXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGU6IGF2YWlsYWJsZUtleXMubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHRlbmRlZDoge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBleHBlcmltZW50YWw6IHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IDAsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZTogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgb3BlbkFzc2V0Q2FsbHM6IHN0cmluZ1tdID0gW107XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhc3luYyAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuICAgICAgICBpZiAoY2hhbm5lbCA9PT0gJ2Fzc2V0LWRiJyAmJiBtZXRob2QgPT09ICdvcGVuLWFzc2V0Jykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmVQYXRoID0gU3RyaW5nKGFyZ3NbMF0gfHwgJycpO1xuICAgICAgICAgICAgb3BlbkFzc2V0Q2FsbHMucHVzaChzY2VuZVBhdGgpO1xuXG4gICAgICAgICAgICBpZiAoc2NlbmVQYXRoID09PSAnZGI6Ly9hc3NldHMvc2NlbmVzL2Jvb3Quc2NlbmUnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHNjZW5lIHBhdGg6ICR7c2NlbmVQYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhbGw6ICR7Y2hhbm5lbH0uJHttZXRob2R9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvb2xzID0gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXIpO1xuICAgIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE5leHRUb29sUmVnaXN0cnkodG9vbHMsIGNyZWF0ZU1hdHJpeChbJ2Fzc2V0LWRiLm9wZW4tYXNzZXQnXSkpO1xuICAgIGNvbnN0IHJvdXRlciA9IG5ldyBOZXh0TWNwUm91dGVyKHJlZ2lzdHJ5KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGVyLmhhbmRsZSh7XG4gICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICBpZDogMSxcbiAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgbmFtZTogJ3NjZW5lX29wZW5fc2NlbmUnLFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgc2NlbmVVcmw6ICdkYjovL2Fzc2V0cy9zY2VuZXMvYm9vdC5zY2VuZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXNzZXJ0Lm9rKHJlc3BvbnNlKTtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2UhLnJlc3VsdC5pc0Vycm9yLCBmYWxzZSk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5vcGVuZWQsIHRydWUpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEuc2NlbmVVcmwsICdkYjovL2Fzc2V0cy9zY2VuZXMvYm9vdC5zY2VuZScpO1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZSEucmVzdWx0LnN0cnVjdHVyZWRDb250ZW50LmRhdGEucmVzb2x2ZWRTY2VuZVVybCwgJ2RiOi8vYXNzZXRzL3NjZW5lcy9ib290LnNjZW5lJyk7XG4gICAgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbnNlIS5yZXN1bHQuc3RydWN0dXJlZENvbnRlbnQuZGF0YS5vcGVuTWV0aG9kLCAnYXNzZXQtZGIub3Blbi1hc3NldCcpO1xuICAgIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3BlbkFzc2V0Q2FsbHMsIFtcbiAgICAgICAgJ2RiOi8vYXNzZXRzL3NjZW5lcy9ib290LnNjZW5lJ1xuICAgIF0pO1xuXG4gICAgY29uc29sZS5sb2coJ25leHQtc2NlbmUtb3Blbi1jb21wYXQtdGVzdDogUEFTUycpO1xufVxuXG5tYWluKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcignbmV4dC1zY2VuZS1vcGVuLWNvbXBhdC10ZXN0OiBGQUlMJyk7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iXX0=