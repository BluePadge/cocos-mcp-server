import { EditorRequester, NextToolDefinition } from '../models';
import { createSceneHierarchyTools } from './scene-hierarchy-tools';
import { createSceneLifecycleTools } from './scene-lifecycle-tools';
import { createSceneViewTools } from './scene-view-tools';
import { createComponentPropertyTools } from './component-property-tools';
import { createAssetDependencyTools } from './asset-dependency-tools';
import { createProjectRuntimeTools } from './project-runtime-tools';
import { createPrefabLifecycleTools } from './prefab-lifecycle-tools';
import { createUiAutomationTools } from './ui-automation-tools';
import { createDebugDiagnosticTools } from './debug-diagnostic-tools';
import { createRuntimeControlTools } from './runtime-control-tools';

export function createOfficialTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        ...createSceneHierarchyTools(requester),
        ...createSceneLifecycleTools(requester),
        ...createSceneViewTools(requester),
        ...createComponentPropertyTools(requester),
        ...createUiAutomationTools(requester),
        ...createAssetDependencyTools(requester),
        ...createProjectRuntimeTools(requester),
        ...createRuntimeControlTools(requester),
        ...createPrefabLifecycleTools(requester),
        ...createDebugDiagnosticTools(requester)
    ];
}

export { createSceneHierarchyTools } from './scene-hierarchy-tools';
export { createSceneLifecycleTools } from './scene-lifecycle-tools';
export { createSceneViewTools } from './scene-view-tools';
export { createComponentPropertyTools } from './component-property-tools';
export { createUiAutomationTools } from './ui-automation-tools';
export { createAssetDependencyTools } from './asset-dependency-tools';
export { createProjectRuntimeTools } from './project-runtime-tools';
export { createRuntimeControlTools } from './runtime-control-tools';
export { createPrefabLifecycleTools } from './prefab-lifecycle-tools';
export { createDebugDiagnosticTools } from './debug-diagnostic-tools';
