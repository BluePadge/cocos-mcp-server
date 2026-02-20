import { EditorRequester, NextToolDefinition } from '../models';
import { createSceneHierarchyTools } from './scene-hierarchy-tools';
import { createSceneLifecycleTools } from './scene-lifecycle-tools';
import { createComponentPropertyTools } from './component-property-tools';
import { createAssetDependencyTools } from './asset-dependency-tools';
import { createProjectRuntimeTools } from './project-runtime-tools';

export function createOfficialTools(requester: EditorRequester): NextToolDefinition[] {
    return [
        ...createSceneHierarchyTools(requester),
        ...createSceneLifecycleTools(requester),
        ...createComponentPropertyTools(requester),
        ...createAssetDependencyTools(requester),
        ...createProjectRuntimeTools(requester)
    ];
}

export { createSceneHierarchyTools } from './scene-hierarchy-tools';
export { createSceneLifecycleTools } from './scene-lifecycle-tools';
export { createComponentPropertyTools } from './component-property-tools';
export { createAssetDependencyTools } from './asset-dependency-tools';
export { createProjectRuntimeTools } from './project-runtime-tools';
