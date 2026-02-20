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
        const writeKeywords = this.getWriteKeywords();
        return !this.hasActionKeyword(tool.name, writeKeywords);
    }

    private getSafety(tool: NextToolDefinition): 'safe' | 'cautious' | 'destructive' {
        if (this.hasActionKeyword(tool.name, ['delete', 'remove'])) {
            return 'destructive';
        }
        if (this.hasActionKeyword(tool.name, this.getWriteKeywords())) {
            return 'cautious';
        }
        return 'safe';
    }

    private getWriteKeywords(): string[] {
        return [
            'create',
            'delete',
            'remove',
            'copy',
            'move',
            'set',
            'change',
            'execute',
            'reload',
            'snapshot',
            'open',
            'save',
            'close',
            'add',
            'duplicate',
            'parent',
            'focus',
            'align',
            'restore',
            'reset',
            'apply'
        ];
    }

    private hasActionKeyword(toolName: string, keywords: string[]): boolean {
        const tokens = toolName.split('_').filter((token) => token !== '');
        return keywords.some((keyword) => tokens.includes(keyword));
    }
}
