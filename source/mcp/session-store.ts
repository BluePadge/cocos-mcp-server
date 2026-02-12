export type SessionPhase = 'awaiting_initialized_notification' | 'ready';

export interface McpSession {
    id: string;
    phase: SessionPhase;
    createdAt: number;
    lastActivityAt: number;
}

export class SessionStore {
    private readonly sessions = new Map<string, McpSession>();

    public createSession(sessionId: string, now: number = Date.now()): McpSession {
        const session: McpSession = {
            id: sessionId,
            phase: 'awaiting_initialized_notification',
            createdAt: now,
            lastActivityAt: now
        };

        this.sessions.set(sessionId, session);
        return session;
    }

    public getSession(sessionId: string): McpSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    public ensureSession(sessionId: string): McpSession {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return session;
    }

    public markReady(sessionId: string, now: number = Date.now()): McpSession {
        const session = this.ensureSession(sessionId);
        session.phase = 'ready';
        session.lastActivityAt = now;
        return session;
    }

    public touch(sessionId: string, now: number = Date.now()): McpSession {
        const session = this.ensureSession(sessionId);
        session.lastActivityAt = now;
        return session;
    }

    public removeSession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    public clear(): void {
        this.sessions.clear();
    }

    public listSessions(): McpSession[] {
        return Array.from(this.sessions.values());
    }

    public size(): number {
        return this.sessions.size;
    }
}
