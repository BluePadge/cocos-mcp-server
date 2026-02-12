import * as http from 'http';
import { randomUUID } from 'crypto';

interface StreamConnection {
    connectionId: string;
    res: http.ServerResponse;
    heartbeatTimer: NodeJS.Timeout;
}

interface StreamableHttpOptions {
    heartbeatMs: number;
}

const DEFAULT_OPTIONS: StreamableHttpOptions = {
    heartbeatMs: 15000
};

export class StreamableHttpManager {
    private readonly options: StreamableHttpOptions;
    private readonly sessionConnections = new Map<string, Map<string, StreamConnection>>();

    constructor(options?: Partial<StreamableHttpOptions>) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
    }

    public openSseStream(sessionId: string, req: http.IncomingMessage, res: http.ServerResponse): string {
        const connectionId = randomUUID();

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const heartbeatTimer = setInterval(() => {
            if (!res.writableEnded) {
                res.write(': heartbeat\n\n');
            }
        }, this.options.heartbeatMs);

        const connection: StreamConnection = {
            connectionId,
            res,
            heartbeatTimer
        };

        const connections = this.getOrCreateConnections(sessionId);
        connections.set(connectionId, connection);

        res.write(`event: ready\ndata: ${JSON.stringify({ sessionId, connectionId })}\n\n`);

        const closeHandler = () => {
            this.closeConnection(sessionId, connectionId);
        };

        req.on('close', closeHandler);
        res.on('close', closeHandler);
        res.on('finish', closeHandler);
        res.on('error', closeHandler);

        return connectionId;
    }

    public sendJsonRpcMessage(sessionId: string, payload: unknown): void {
        const connections = this.sessionConnections.get(sessionId);
        if (!connections || connections.size === 0) {
            return;
        }

        const data = JSON.stringify(payload);
        const packet = this.buildSsePacket('message', data);

        for (const connection of connections.values()) {
            if (connection.res.writableEnded) {
                this.closeConnection(sessionId, connection.connectionId);
                continue;
            }

            connection.res.write(packet);
        }
    }

    public getSessionConnectionCount(sessionId: string): number {
        return this.sessionConnections.get(sessionId)?.size ?? 0;
    }

    public closeSession(sessionId: string): void {
        const connections = this.sessionConnections.get(sessionId);
        if (!connections) {
            return;
        }

        for (const connection of connections.values()) {
            clearInterval(connection.heartbeatTimer);
            if (!connection.res.writableEnded) {
                connection.res.end();
            }
        }

        this.sessionConnections.delete(sessionId);
    }

    public dispose(): void {
        for (const sessionId of this.sessionConnections.keys()) {
            this.closeSession(sessionId);
        }
    }

    private closeConnection(sessionId: string, connectionId: string): void {
        const connections = this.sessionConnections.get(sessionId);
        if (!connections) {
            return;
        }

        const connection = connections.get(connectionId);
        if (!connection) {
            return;
        }

        clearInterval(connection.heartbeatTimer);
        connections.delete(connectionId);

        if (connections.size === 0) {
            this.sessionConnections.delete(sessionId);
        }
    }

    private getOrCreateConnections(sessionId: string): Map<string, StreamConnection> {
        const existing = this.sessionConnections.get(sessionId);
        if (existing) {
            return existing;
        }

        const created = new Map<string, StreamConnection>();
        this.sessionConnections.set(sessionId, created);
        return created;
    }

    private buildSsePacket(eventName: string, data: string): string {
        const lines = data.split('\n');
        const dataLines = lines.map((line) => `data: ${line}`).join('\n');
        return `event: ${eventName}\n${dataLines}\n\n`;
    }
}
