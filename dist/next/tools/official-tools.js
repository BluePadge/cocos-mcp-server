"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDebugDiagnosticTools = exports.createPrefabLifecycleTools = exports.createRuntimeControlTools = exports.createProjectRuntimeTools = exports.createAssetDependencyTools = exports.createUiAutomationTools = exports.createComponentPropertyTools = exports.createSceneViewTools = exports.createSceneLifecycleTools = exports.createSceneHierarchyTools = void 0;
exports.createOfficialTools = createOfficialTools;
const scene_hierarchy_tools_1 = require("./scene-hierarchy-tools");
const scene_lifecycle_tools_1 = require("./scene-lifecycle-tools");
const scene_view_tools_1 = require("./scene-view-tools");
const component_property_tools_1 = require("./component-property-tools");
const asset_dependency_tools_1 = require("./asset-dependency-tools");
const project_runtime_tools_1 = require("./project-runtime-tools");
const prefab_lifecycle_tools_1 = require("./prefab-lifecycle-tools");
const ui_automation_tools_1 = require("./ui-automation-tools");
const debug_diagnostic_tools_1 = require("./debug-diagnostic-tools");
const runtime_control_tools_1 = require("./runtime-control-tools");
function createOfficialTools(requester) {
    return [
        ...(0, scene_hierarchy_tools_1.createSceneHierarchyTools)(requester),
        ...(0, scene_lifecycle_tools_1.createSceneLifecycleTools)(requester),
        ...(0, scene_view_tools_1.createSceneViewTools)(requester),
        ...(0, component_property_tools_1.createComponentPropertyTools)(requester),
        ...(0, ui_automation_tools_1.createUiAutomationTools)(requester),
        ...(0, asset_dependency_tools_1.createAssetDependencyTools)(requester),
        ...(0, project_runtime_tools_1.createProjectRuntimeTools)(requester),
        ...(0, runtime_control_tools_1.createRuntimeControlTools)(requester),
        ...(0, prefab_lifecycle_tools_1.createPrefabLifecycleTools)(requester),
        ...(0, debug_diagnostic_tools_1.createDebugDiagnosticTools)(requester)
    ];
}
var scene_hierarchy_tools_2 = require("./scene-hierarchy-tools");
Object.defineProperty(exports, "createSceneHierarchyTools", { enumerable: true, get: function () { return scene_hierarchy_tools_2.createSceneHierarchyTools; } });
var scene_lifecycle_tools_2 = require("./scene-lifecycle-tools");
Object.defineProperty(exports, "createSceneLifecycleTools", { enumerable: true, get: function () { return scene_lifecycle_tools_2.createSceneLifecycleTools; } });
var scene_view_tools_2 = require("./scene-view-tools");
Object.defineProperty(exports, "createSceneViewTools", { enumerable: true, get: function () { return scene_view_tools_2.createSceneViewTools; } });
var component_property_tools_2 = require("./component-property-tools");
Object.defineProperty(exports, "createComponentPropertyTools", { enumerable: true, get: function () { return component_property_tools_2.createComponentPropertyTools; } });
var ui_automation_tools_2 = require("./ui-automation-tools");
Object.defineProperty(exports, "createUiAutomationTools", { enumerable: true, get: function () { return ui_automation_tools_2.createUiAutomationTools; } });
var asset_dependency_tools_2 = require("./asset-dependency-tools");
Object.defineProperty(exports, "createAssetDependencyTools", { enumerable: true, get: function () { return asset_dependency_tools_2.createAssetDependencyTools; } });
var project_runtime_tools_2 = require("./project-runtime-tools");
Object.defineProperty(exports, "createProjectRuntimeTools", { enumerable: true, get: function () { return project_runtime_tools_2.createProjectRuntimeTools; } });
var runtime_control_tools_2 = require("./runtime-control-tools");
Object.defineProperty(exports, "createRuntimeControlTools", { enumerable: true, get: function () { return runtime_control_tools_2.createRuntimeControlTools; } });
var prefab_lifecycle_tools_2 = require("./prefab-lifecycle-tools");
Object.defineProperty(exports, "createPrefabLifecycleTools", { enumerable: true, get: function () { return prefab_lifecycle_tools_2.createPrefabLifecycleTools; } });
var debug_diagnostic_tools_2 = require("./debug-diagnostic-tools");
Object.defineProperty(exports, "createDebugDiagnosticTools", { enumerable: true, get: function () { return debug_diagnostic_tools_2.createDebugDiagnosticTools; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2ZmaWNpYWwtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvbmV4dC90b29scy9vZmZpY2lhbC10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFZQSxrREFhQztBQXhCRCxtRUFBb0U7QUFDcEUsbUVBQW9FO0FBQ3BFLHlEQUEwRDtBQUMxRCx5RUFBMEU7QUFDMUUscUVBQXNFO0FBQ3RFLG1FQUFvRTtBQUNwRSxxRUFBc0U7QUFDdEUsK0RBQWdFO0FBQ2hFLHFFQUFzRTtBQUN0RSxtRUFBb0U7QUFFcEUsU0FBZ0IsbUJBQW1CLENBQUMsU0FBMEI7SUFDMUQsT0FBTztRQUNILEdBQUcsSUFBQSxpREFBeUIsRUFBQyxTQUFTLENBQUM7UUFDdkMsR0FBRyxJQUFBLGlEQUF5QixFQUFDLFNBQVMsQ0FBQztRQUN2QyxHQUFHLElBQUEsdUNBQW9CLEVBQUMsU0FBUyxDQUFDO1FBQ2xDLEdBQUcsSUFBQSx1REFBNEIsRUFBQyxTQUFTLENBQUM7UUFDMUMsR0FBRyxJQUFBLDZDQUF1QixFQUFDLFNBQVMsQ0FBQztRQUNyQyxHQUFHLElBQUEsbURBQTBCLEVBQUMsU0FBUyxDQUFDO1FBQ3hDLEdBQUcsSUFBQSxpREFBeUIsRUFBQyxTQUFTLENBQUM7UUFDdkMsR0FBRyxJQUFBLGlEQUF5QixFQUFDLFNBQVMsQ0FBQztRQUN2QyxHQUFHLElBQUEsbURBQTBCLEVBQUMsU0FBUyxDQUFDO1FBQ3hDLEdBQUcsSUFBQSxtREFBMEIsRUFBQyxTQUFTLENBQUM7S0FDM0MsQ0FBQztBQUNOLENBQUM7QUFFRCxpRUFBb0U7QUFBM0Qsa0lBQUEseUJBQXlCLE9BQUE7QUFDbEMsaUVBQW9FO0FBQTNELGtJQUFBLHlCQUF5QixPQUFBO0FBQ2xDLHVEQUEwRDtBQUFqRCx3SEFBQSxvQkFBb0IsT0FBQTtBQUM3Qix1RUFBMEU7QUFBakUsd0lBQUEsNEJBQTRCLE9BQUE7QUFDckMsNkRBQWdFO0FBQXZELDhIQUFBLHVCQUF1QixPQUFBO0FBQ2hDLG1FQUFzRTtBQUE3RCxvSUFBQSwwQkFBMEIsT0FBQTtBQUNuQyxpRUFBb0U7QUFBM0Qsa0lBQUEseUJBQXlCLE9BQUE7QUFDbEMsaUVBQW9FO0FBQTNELGtJQUFBLHlCQUF5QixPQUFBO0FBQ2xDLG1FQUFzRTtBQUE3RCxvSUFBQSwwQkFBMEIsT0FBQTtBQUNuQyxtRUFBc0U7QUFBN0Qsb0lBQUEsMEJBQTBCLE9BQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBjcmVhdGVTY2VuZUhpZXJhcmNoeVRvb2xzIH0gZnJvbSAnLi9zY2VuZS1oaWVyYXJjaHktdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlU2NlbmVMaWZlY3ljbGVUb29scyB9IGZyb20gJy4vc2NlbmUtbGlmZWN5Y2xlLXRvb2xzJztcbmltcG9ydCB7IGNyZWF0ZVNjZW5lVmlld1Rvb2xzIH0gZnJvbSAnLi9zY2VuZS12aWV3LXRvb2xzJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMgfSBmcm9tICcuL2NvbXBvbmVudC1wcm9wZXJ0eS10b29scyc7XG5pbXBvcnQgeyBjcmVhdGVBc3NldERlcGVuZGVuY3lUb29scyB9IGZyb20gJy4vYXNzZXQtZGVwZW5kZW5jeS10b29scyc7XG5pbXBvcnQgeyBjcmVhdGVQcm9qZWN0UnVudGltZVRvb2xzIH0gZnJvbSAnLi9wcm9qZWN0LXJ1bnRpbWUtdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlUHJlZmFiTGlmZWN5Y2xlVG9vbHMgfSBmcm9tICcuL3ByZWZhYi1saWZlY3ljbGUtdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlVWlBdXRvbWF0aW9uVG9vbHMgfSBmcm9tICcuL3VpLWF1dG9tYXRpb24tdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlRGVidWdEaWFnbm9zdGljVG9vbHMgfSBmcm9tICcuL2RlYnVnLWRpYWdub3N0aWMtdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlUnVudGltZUNvbnRyb2xUb29scyB9IGZyb20gJy4vcnVudGltZS1jb250cm9sLXRvb2xzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU9mZmljaWFsVG9vbHMocmVxdWVzdGVyOiBFZGl0b3JSZXF1ZXN0ZXIpOiBOZXh0VG9vbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgLi4uY3JlYXRlU2NlbmVIaWVyYXJjaHlUb29scyhyZXF1ZXN0ZXIpLFxuICAgICAgICAuLi5jcmVhdGVTY2VuZUxpZmVjeWNsZVRvb2xzKHJlcXVlc3RlciksXG4gICAgICAgIC4uLmNyZWF0ZVNjZW5lVmlld1Rvb2xzKHJlcXVlc3RlciksXG4gICAgICAgIC4uLmNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMocmVxdWVzdGVyKSxcbiAgICAgICAgLi4uY3JlYXRlVWlBdXRvbWF0aW9uVG9vbHMocmVxdWVzdGVyKSxcbiAgICAgICAgLi4uY3JlYXRlQXNzZXREZXBlbmRlbmN5VG9vbHMocmVxdWVzdGVyKSxcbiAgICAgICAgLi4uY3JlYXRlUHJvamVjdFJ1bnRpbWVUb29scyhyZXF1ZXN0ZXIpLFxuICAgICAgICAuLi5jcmVhdGVSdW50aW1lQ29udHJvbFRvb2xzKHJlcXVlc3RlciksXG4gICAgICAgIC4uLmNyZWF0ZVByZWZhYkxpZmVjeWNsZVRvb2xzKHJlcXVlc3RlciksXG4gICAgICAgIC4uLmNyZWF0ZURlYnVnRGlhZ25vc3RpY1Rvb2xzKHJlcXVlc3RlcilcbiAgICBdO1xufVxuXG5leHBvcnQgeyBjcmVhdGVTY2VuZUhpZXJhcmNoeVRvb2xzIH0gZnJvbSAnLi9zY2VuZS1oaWVyYXJjaHktdG9vbHMnO1xuZXhwb3J0IHsgY3JlYXRlU2NlbmVMaWZlY3ljbGVUb29scyB9IGZyb20gJy4vc2NlbmUtbGlmZWN5Y2xlLXRvb2xzJztcbmV4cG9ydCB7IGNyZWF0ZVNjZW5lVmlld1Rvb2xzIH0gZnJvbSAnLi9zY2VuZS12aWV3LXRvb2xzJztcbmV4cG9ydCB7IGNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMgfSBmcm9tICcuL2NvbXBvbmVudC1wcm9wZXJ0eS10b29scyc7XG5leHBvcnQgeyBjcmVhdGVVaUF1dG9tYXRpb25Ub29scyB9IGZyb20gJy4vdWktYXV0b21hdGlvbi10b29scyc7XG5leHBvcnQgeyBjcmVhdGVBc3NldERlcGVuZGVuY3lUb29scyB9IGZyb20gJy4vYXNzZXQtZGVwZW5kZW5jeS10b29scyc7XG5leHBvcnQgeyBjcmVhdGVQcm9qZWN0UnVudGltZVRvb2xzIH0gZnJvbSAnLi9wcm9qZWN0LXJ1bnRpbWUtdG9vbHMnO1xuZXhwb3J0IHsgY3JlYXRlUnVudGltZUNvbnRyb2xUb29scyB9IGZyb20gJy4vcnVudGltZS1jb250cm9sLXRvb2xzJztcbmV4cG9ydCB7IGNyZWF0ZVByZWZhYkxpZmVjeWNsZVRvb2xzIH0gZnJvbSAnLi9wcmVmYWItbGlmZWN5Y2xlLXRvb2xzJztcbmV4cG9ydCB7IGNyZWF0ZURlYnVnRGlhZ25vc3RpY1Rvb2xzIH0gZnJvbSAnLi9kZWJ1Zy1kaWFnbm9zdGljLXRvb2xzJztcbiJdfQ==