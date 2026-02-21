export type CapabilityLayer = 'official' | 'extended' | 'experimental';

export interface CapabilityCheck {
    key: string;
    channel: string;
    method: string;
    args?: any[];
    layer: CapabilityLayer;
    readonly: boolean;
    probeStrategy?: 'invoke' | 'assume_available';
    description: string;
}

export interface CapabilityRecord {
    key: string;
    channel: string;
    method: string;
    layer: CapabilityLayer;
    readonly: boolean;
    description: string;
    available: boolean;
    checkedAt: string;
    detail?: string;
}

export interface CapabilityLayerSummary {
    total: number;
    available: number;
}

export interface CapabilityMatrix {
    generatedAt: string;
    byKey: Record<string, CapabilityRecord>;
    summary: {
        total: number;
        available: number;
        unavailable: number;
        byLayer: Record<CapabilityLayer, CapabilityLayerSummary>;
    };
}

export interface NextToolResult {
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
        detail?: string;
    };
}

export interface NextToolDefinition {
    name: string;
    description: string;
    layer: CapabilityLayer;
    category: string;
    inputSchema: any;
    requiredCapabilities: string[];
    run: (args: any) => Promise<NextToolResult>;
}

export interface JsonRpcRequestMessage {
    jsonrpc: '2.0';
    id?: string | number | null;
    method: string;
    params?: any;
}

export interface JsonRpcResponseMessage {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export type EditorRequester = (channel: string, method: string, ...args: any[]) => Promise<any>;
