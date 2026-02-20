import { CapabilityMatrix, NextToolDefinition } from '../models';

export interface ToolManifest {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    requiredCapabilities: string[];
    _meta: {
        layer: string;
        category: string;
        idempotent: boolean;
        safety: 'safe' | 'cautious' | 'destructive';
        supportsDryRun: boolean;
    };
}

export class NextToolRegistry {
    private readonly tools: NextToolDefinition[];
    private readonly matrix: CapabilityMatrix;

    constructor(tools: NextToolDefinition[], matrix: CapabilityMatrix) {
        this.tools = tools;
        this.matrix = matrix;
    }

    public listTools(): Array<{ name: string; description: string; inputSchema: any; _meta: any }> {
        return this.tools
            .filter((tool) => this.isToolAvailable(tool))
            .map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                _meta: {
                    layer: tool.layer,
                    category: tool.category,
                    safety: this.getSafety(tool),
                    idempotent: this.isIdempotent(tool),
                    supportsDryRun: false
                }
            }));
    }

    public getTool(name: string): NextToolDefinition | null {
        const tool = this.tools.find((item) => item.name === name);
        if (!tool) {
            return null;
        }
        return this.isToolAvailable(tool) ? tool : null;
    }

    public getManifest(name: string): ToolManifest | null {
        const tool = this.tools.find((item) => item.name === name);
        if (!tool) {
            return null;
        }

        return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    data: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
                    error: {
                        type: 'object',
                        properties: {
                            code: { type: 'string' },
                            message: { type: 'string' },
                            detail: { type: 'string' }
                        }
                    }
                },
                required: ['success']
            },
            requiredCapabilities: [...tool.requiredCapabilities],
            _meta: {
                layer: tool.layer,
                category: tool.category,
                idempotent: this.isIdempotent(tool),
                safety: this.getSafety(tool),
                supportsDryRun: false
            }
        };
    }

    public getCapabilityMatrix(): CapabilityMatrix {
        return this.matrix;
    }

    private isToolAvailable(tool: NextToolDefinition): boolean {
        return tool.requiredCapabilities.every((key) => this.matrix.byKey[key]?.available === true);
    }

    private isIdempotent(tool: NextToolDefinition): boolean {
        const writeKeywords = ['create', 'delete', 'remove', 'copy', 'move', 'set', 'open', 'save', 'add', 'duplicate', 'parent'];
        return !writeKeywords.some((keyword) => tool.name.includes(keyword));
    }

    private getSafety(tool: NextToolDefinition): 'safe' | 'cautious' | 'destructive' {
        if (tool.name.includes('delete') || tool.name.includes('remove')) {
            return 'destructive';
        }
        if (tool.name.includes('create')
            || tool.name.includes('copy')
            || tool.name.includes('set')
            || tool.name.includes('open')
            || tool.name.includes('save')
            || tool.name.includes('duplicate')
            || tool.name.includes('parent')
            || tool.name.includes('add')) {
            return 'cautious';
        }
        return 'safe';
    }
}
