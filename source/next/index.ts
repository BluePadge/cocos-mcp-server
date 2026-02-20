import { CapabilityCheck, EditorRequester } from './models';
import { CapabilityProbe } from './capability/probe';
import { NextMcpRouter } from './protocol/router';
import { NextToolRegistry } from './protocol/tool-registry';
import { createOfficialTools } from './tools/official-tools';
import { defaultEditorRequester } from './editor-requester';

export interface CreateNextRuntimeOptions {
    requester?: EditorRequester;
    checks?: CapabilityCheck[];
    includeWriteChecks?: boolean;
}

export async function createNextRuntime(options: CreateNextRuntimeOptions = {}): Promise<{
    probe: CapabilityProbe;
    registry: NextToolRegistry;
    router: NextMcpRouter;
}> {
    const requester = options.requester ?? defaultEditorRequester;
    const probe = new CapabilityProbe(requester);
    const matrix = await probe.run({
        checks: options.checks,
        includeWriteChecks: options.includeWriteChecks
    });

    const tools = createOfficialTools(requester);
    const registry = new NextToolRegistry(tools, matrix);
    const router = new NextMcpRouter(registry);

    return {
        probe,
        registry,
        router
    };
}

export { CapabilityProbe } from './capability/probe';
export { DEFAULT_CAPABILITY_CHECKS } from './capability/method-catalog';
export { NextMcpRouter } from './protocol/router';
export { NextToolRegistry } from './protocol/tool-registry';
export { createOfficialTools } from './tools/official-tools';
export * from './models';
