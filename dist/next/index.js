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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOfficialTools = exports.NextToolRegistry = exports.NextMcpRouter = exports.DEFAULT_CAPABILITY_CHECKS = exports.CapabilityProbe = void 0;
exports.createNextRuntime = createNextRuntime;
const probe_1 = require("./capability/probe");
const router_1 = require("./protocol/router");
const tool_registry_1 = require("./protocol/tool-registry");
const official_tools_1 = require("./tools/official-tools");
const editor_requester_1 = require("./editor-requester");
async function createNextRuntime(options = {}) {
    var _a;
    const requester = (_a = options.requester) !== null && _a !== void 0 ? _a : editor_requester_1.defaultEditorRequester;
    const probe = new probe_1.CapabilityProbe(requester);
    const matrix = await probe.run({
        checks: options.checks,
        includeWriteChecks: options.includeWriteChecks
    });
    const tools = (0, official_tools_1.createOfficialTools)(requester);
    const registry = new tool_registry_1.NextToolRegistry(tools, matrix);
    const router = new router_1.NextMcpRouter(registry);
    return {
        probe,
        registry,
        router
    };
}
var probe_2 = require("./capability/probe");
Object.defineProperty(exports, "CapabilityProbe", { enumerable: true, get: function () { return probe_2.CapabilityProbe; } });
var method_catalog_1 = require("./capability/method-catalog");
Object.defineProperty(exports, "DEFAULT_CAPABILITY_CHECKS", { enumerable: true, get: function () { return method_catalog_1.DEFAULT_CAPABILITY_CHECKS; } });
var router_2 = require("./protocol/router");
Object.defineProperty(exports, "NextMcpRouter", { enumerable: true, get: function () { return router_2.NextMcpRouter; } });
var tool_registry_2 = require("./protocol/tool-registry");
Object.defineProperty(exports, "NextToolRegistry", { enumerable: true, get: function () { return tool_registry_2.NextToolRegistry; } });
var official_tools_2 = require("./tools/official-tools");
Object.defineProperty(exports, "createOfficialTools", { enumerable: true, get: function () { return official_tools_2.createOfficialTools; } });
__exportStar(require("./models"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvbmV4dC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQWFBLDhDQXFCQztBQWpDRCw4Q0FBcUQ7QUFDckQsOENBQWtEO0FBQ2xELDREQUE0RDtBQUM1RCwyREFBNkQ7QUFDN0QseURBQTREO0FBUXJELEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxVQUFvQyxFQUFFOztJQUsxRSxNQUFNLFNBQVMsR0FBRyxNQUFBLE9BQU8sQ0FBQyxTQUFTLG1DQUFJLHlDQUFzQixDQUFDO0lBQzlELE1BQU0sS0FBSyxHQUFHLElBQUksdUJBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUM3QyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLENBQUM7UUFDM0IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxrQkFBa0I7S0FDakQsQ0FBQyxDQUFDO0lBRUgsTUFBTSxLQUFLLEdBQUcsSUFBQSxvQ0FBbUIsRUFBQyxTQUFTLENBQUMsQ0FBQztJQUM3QyxNQUFNLFFBQVEsR0FBRyxJQUFJLGdDQUFnQixDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNyRCxNQUFNLE1BQU0sR0FBRyxJQUFJLHNCQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFM0MsT0FBTztRQUNILEtBQUs7UUFDTCxRQUFRO1FBQ1IsTUFBTTtLQUNULENBQUM7QUFDTixDQUFDO0FBRUQsNENBQXFEO0FBQTVDLHdHQUFBLGVBQWUsT0FBQTtBQUN4Qiw4REFBd0U7QUFBL0QsMkhBQUEseUJBQXlCLE9BQUE7QUFDbEMsNENBQWtEO0FBQXpDLHVHQUFBLGFBQWEsT0FBQTtBQUN0QiwwREFBNEQ7QUFBbkQsaUhBQUEsZ0JBQWdCLE9BQUE7QUFDekIseURBQTZEO0FBQXBELHFIQUFBLG1CQUFtQixPQUFBO0FBQzVCLDJDQUF5QiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENhcGFiaWxpdHlDaGVjaywgRWRpdG9yUmVxdWVzdGVyIH0gZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0IHsgQ2FwYWJpbGl0eVByb2JlIH0gZnJvbSAnLi9jYXBhYmlsaXR5L3Byb2JlJztcbmltcG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuL3Byb3RvY29sL3JvdXRlcic7XG5pbXBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmltcG9ydCB7IGNyZWF0ZU9mZmljaWFsVG9vbHMgfSBmcm9tICcuL3Rvb2xzL29mZmljaWFsLXRvb2xzJztcbmltcG9ydCB7IGRlZmF1bHRFZGl0b3JSZXF1ZXN0ZXIgfSBmcm9tICcuL2VkaXRvci1yZXF1ZXN0ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIENyZWF0ZU5leHRSdW50aW1lT3B0aW9ucyB7XG4gICAgcmVxdWVzdGVyPzogRWRpdG9yUmVxdWVzdGVyO1xuICAgIGNoZWNrcz86IENhcGFiaWxpdHlDaGVja1tdO1xuICAgIGluY2x1ZGVXcml0ZUNoZWNrcz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVOZXh0UnVudGltZShvcHRpb25zOiBDcmVhdGVOZXh0UnVudGltZU9wdGlvbnMgPSB7fSk6IFByb21pc2U8e1xuICAgIHByb2JlOiBDYXBhYmlsaXR5UHJvYmU7XG4gICAgcmVnaXN0cnk6IE5leHRUb29sUmVnaXN0cnk7XG4gICAgcm91dGVyOiBOZXh0TWNwUm91dGVyO1xufT4ge1xuICAgIGNvbnN0IHJlcXVlc3RlciA9IG9wdGlvbnMucmVxdWVzdGVyID8/IGRlZmF1bHRFZGl0b3JSZXF1ZXN0ZXI7XG4gICAgY29uc3QgcHJvYmUgPSBuZXcgQ2FwYWJpbGl0eVByb2JlKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgbWF0cml4ID0gYXdhaXQgcHJvYmUucnVuKHtcbiAgICAgICAgY2hlY2tzOiBvcHRpb25zLmNoZWNrcyxcbiAgICAgICAgaW5jbHVkZVdyaXRlQ2hlY2tzOiBvcHRpb25zLmluY2x1ZGVXcml0ZUNoZWNrc1xuICAgIH0pO1xuXG4gICAgY29uc3QgdG9vbHMgPSBjcmVhdGVPZmZpY2lhbFRvb2xzKHJlcXVlc3Rlcik7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgTmV4dFRvb2xSZWdpc3RyeSh0b29scywgbWF0cml4KTtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgTmV4dE1jcFJvdXRlcihyZWdpc3RyeSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBwcm9iZSxcbiAgICAgICAgcmVnaXN0cnksXG4gICAgICAgIHJvdXRlclxuICAgIH07XG59XG5cbmV4cG9ydCB7IENhcGFiaWxpdHlQcm9iZSB9IGZyb20gJy4vY2FwYWJpbGl0eS9wcm9iZSc7XG5leHBvcnQgeyBERUZBVUxUX0NBUEFCSUxJVFlfQ0hFQ0tTIH0gZnJvbSAnLi9jYXBhYmlsaXR5L21ldGhvZC1jYXRhbG9nJztcbmV4cG9ydCB7IE5leHRNY3BSb3V0ZXIgfSBmcm9tICcuL3Byb3RvY29sL3JvdXRlcic7XG5leHBvcnQgeyBOZXh0VG9vbFJlZ2lzdHJ5IH0gZnJvbSAnLi9wcm90b2NvbC90b29sLXJlZ2lzdHJ5JztcbmV4cG9ydCB7IGNyZWF0ZU9mZmljaWFsVG9vbHMgfSBmcm9tICcuL3Rvb2xzL29mZmljaWFsLXRvb2xzJztcbmV4cG9ydCAqIGZyb20gJy4vbW9kZWxzJztcbiJdfQ==