"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectRuntimeTools = exports.createAssetDependencyTools = exports.createComponentPropertyTools = exports.createSceneLifecycleTools = exports.createSceneHierarchyTools = void 0;
exports.createOfficialTools = createOfficialTools;
const scene_hierarchy_tools_1 = require("./scene-hierarchy-tools");
const scene_lifecycle_tools_1 = require("./scene-lifecycle-tools");
const component_property_tools_1 = require("./component-property-tools");
const asset_dependency_tools_1 = require("./asset-dependency-tools");
const project_runtime_tools_1 = require("./project-runtime-tools");
function createOfficialTools(requester) {
    return [
        ...(0, scene_hierarchy_tools_1.createSceneHierarchyTools)(requester),
        ...(0, scene_lifecycle_tools_1.createSceneLifecycleTools)(requester),
        ...(0, component_property_tools_1.createComponentPropertyTools)(requester),
        ...(0, asset_dependency_tools_1.createAssetDependencyTools)(requester),
        ...(0, project_runtime_tools_1.createProjectRuntimeTools)(requester)
    ];
}
var scene_hierarchy_tools_2 = require("./scene-hierarchy-tools");
Object.defineProperty(exports, "createSceneHierarchyTools", { enumerable: true, get: function () { return scene_hierarchy_tools_2.createSceneHierarchyTools; } });
var scene_lifecycle_tools_2 = require("./scene-lifecycle-tools");
Object.defineProperty(exports, "createSceneLifecycleTools", { enumerable: true, get: function () { return scene_lifecycle_tools_2.createSceneLifecycleTools; } });
var component_property_tools_2 = require("./component-property-tools");
Object.defineProperty(exports, "createComponentPropertyTools", { enumerable: true, get: function () { return component_property_tools_2.createComponentPropertyTools; } });
var asset_dependency_tools_2 = require("./asset-dependency-tools");
Object.defineProperty(exports, "createAssetDependencyTools", { enumerable: true, get: function () { return asset_dependency_tools_2.createAssetDependencyTools; } });
var project_runtime_tools_2 = require("./project-runtime-tools");
Object.defineProperty(exports, "createProjectRuntimeTools", { enumerable: true, get: function () { return project_runtime_tools_2.createProjectRuntimeTools; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2ZmaWNpYWwtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvbmV4dC90b29scy9vZmZpY2lhbC10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFPQSxrREFRQztBQWRELG1FQUFvRTtBQUNwRSxtRUFBb0U7QUFDcEUseUVBQTBFO0FBQzFFLHFFQUFzRTtBQUN0RSxtRUFBb0U7QUFFcEUsU0FBZ0IsbUJBQW1CLENBQUMsU0FBMEI7SUFDMUQsT0FBTztRQUNILEdBQUcsSUFBQSxpREFBeUIsRUFBQyxTQUFTLENBQUM7UUFDdkMsR0FBRyxJQUFBLGlEQUF5QixFQUFDLFNBQVMsQ0FBQztRQUN2QyxHQUFHLElBQUEsdURBQTRCLEVBQUMsU0FBUyxDQUFDO1FBQzFDLEdBQUcsSUFBQSxtREFBMEIsRUFBQyxTQUFTLENBQUM7UUFDeEMsR0FBRyxJQUFBLGlEQUF5QixFQUFDLFNBQVMsQ0FBQztLQUMxQyxDQUFDO0FBQ04sQ0FBQztBQUVELGlFQUFvRTtBQUEzRCxrSUFBQSx5QkFBeUIsT0FBQTtBQUNsQyxpRUFBb0U7QUFBM0Qsa0lBQUEseUJBQXlCLE9BQUE7QUFDbEMsdUVBQTBFO0FBQWpFLHdJQUFBLDRCQUE0QixPQUFBO0FBQ3JDLG1FQUFzRTtBQUE3RCxvSUFBQSwwQkFBMEIsT0FBQTtBQUNuQyxpRUFBb0U7QUFBM0Qsa0lBQUEseUJBQXlCLE9BQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFZGl0b3JSZXF1ZXN0ZXIsIE5leHRUb29sRGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVscyc7XG5pbXBvcnQgeyBjcmVhdGVTY2VuZUhpZXJhcmNoeVRvb2xzIH0gZnJvbSAnLi9zY2VuZS1oaWVyYXJjaHktdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlU2NlbmVMaWZlY3ljbGVUb29scyB9IGZyb20gJy4vc2NlbmUtbGlmZWN5Y2xlLXRvb2xzJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMgfSBmcm9tICcuL2NvbXBvbmVudC1wcm9wZXJ0eS10b29scyc7XG5pbXBvcnQgeyBjcmVhdGVBc3NldERlcGVuZGVuY3lUb29scyB9IGZyb20gJy4vYXNzZXQtZGVwZW5kZW5jeS10b29scyc7XG5pbXBvcnQgeyBjcmVhdGVQcm9qZWN0UnVudGltZVRvb2xzIH0gZnJvbSAnLi9wcm9qZWN0LXJ1bnRpbWUtdG9vbHMnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT2ZmaWNpYWxUb29scyhyZXF1ZXN0ZXI6IEVkaXRvclJlcXVlc3Rlcik6IE5leHRUb29sRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgICAuLi5jcmVhdGVTY2VuZUhpZXJhcmNoeVRvb2xzKHJlcXVlc3RlciksXG4gICAgICAgIC4uLmNyZWF0ZVNjZW5lTGlmZWN5Y2xlVG9vbHMocmVxdWVzdGVyKSxcbiAgICAgICAgLi4uY3JlYXRlQ29tcG9uZW50UHJvcGVydHlUb29scyhyZXF1ZXN0ZXIpLFxuICAgICAgICAuLi5jcmVhdGVBc3NldERlcGVuZGVuY3lUb29scyhyZXF1ZXN0ZXIpLFxuICAgICAgICAuLi5jcmVhdGVQcm9qZWN0UnVudGltZVRvb2xzKHJlcXVlc3RlcilcbiAgICBdO1xufVxuXG5leHBvcnQgeyBjcmVhdGVTY2VuZUhpZXJhcmNoeVRvb2xzIH0gZnJvbSAnLi9zY2VuZS1oaWVyYXJjaHktdG9vbHMnO1xuZXhwb3J0IHsgY3JlYXRlU2NlbmVMaWZlY3ljbGVUb29scyB9IGZyb20gJy4vc2NlbmUtbGlmZWN5Y2xlLXRvb2xzJztcbmV4cG9ydCB7IGNyZWF0ZUNvbXBvbmVudFByb3BlcnR5VG9vbHMgfSBmcm9tICcuL2NvbXBvbmVudC1wcm9wZXJ0eS10b29scyc7XG5leHBvcnQgeyBjcmVhdGVBc3NldERlcGVuZGVuY3lUb29scyB9IGZyb20gJy4vYXNzZXQtZGVwZW5kZW5jeS10b29scyc7XG5leHBvcnQgeyBjcmVhdGVQcm9qZWN0UnVudGltZVRvb2xzIH0gZnJvbSAnLi9wcm9qZWN0LXJ1bnRpbWUtdG9vbHMnO1xuIl19