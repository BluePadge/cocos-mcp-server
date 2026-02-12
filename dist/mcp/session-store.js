"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStore = void 0;
class SessionStore {
    constructor() {
        this.sessions = new Map();
    }
    createSession(sessionId, now = Date.now()) {
        const session = {
            id: sessionId,
            phase: 'awaiting_initialized_notification',
            createdAt: now,
            lastActivityAt: now
        };
        this.sessions.set(sessionId, session);
        return session;
    }
    getSession(sessionId) {
        var _a;
        return (_a = this.sessions.get(sessionId)) !== null && _a !== void 0 ? _a : null;
    }
    ensureSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return session;
    }
    markReady(sessionId, now = Date.now()) {
        const session = this.ensureSession(sessionId);
        session.phase = 'ready';
        session.lastActivityAt = now;
        return session;
    }
    touch(sessionId, now = Date.now()) {
        const session = this.ensureSession(sessionId);
        session.lastActivityAt = now;
        return session;
    }
    removeSession(sessionId) {
        return this.sessions.delete(sessionId);
    }
    clear() {
        this.sessions.clear();
    }
    listSessions() {
        return Array.from(this.sessions.values());
    }
    size() {
        return this.sessions.size;
    }
}
exports.SessionStore = SessionStore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Vzc2lvbi1zdG9yZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS9tY3Avc2Vzc2lvbi1zdG9yZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFTQSxNQUFhLFlBQVk7SUFBekI7UUFDcUIsYUFBUSxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO0lBc0Q5RCxDQUFDO0lBcERVLGFBQWEsQ0FBQyxTQUFpQixFQUFFLE1BQWMsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUM1RCxNQUFNLE9BQU8sR0FBZTtZQUN4QixFQUFFLEVBQUUsU0FBUztZQUNiLEtBQUssRUFBRSxtQ0FBbUM7WUFDMUMsU0FBUyxFQUFFLEdBQUc7WUFDZCxjQUFjLEVBQUUsR0FBRztTQUN0QixDQUFDO1FBRUYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7SUFFTSxVQUFVLENBQUMsU0FBaUI7O1FBQy9CLE9BQU8sTUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsbUNBQUksSUFBSSxDQUFDO0lBQ2hELENBQUM7SUFFTSxhQUFhLENBQUMsU0FBaUI7UUFDbEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDWCxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQztJQUNuQixDQUFDO0lBRU0sU0FBUyxDQUFDLFNBQWlCLEVBQUUsTUFBYyxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDOUMsT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7UUFDeEIsT0FBTyxDQUFDLGNBQWMsR0FBRyxHQUFHLENBQUM7UUFDN0IsT0FBTyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVNLEtBQUssQ0FBQyxTQUFpQixFQUFFLE1BQWMsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUNwRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzlDLE9BQU8sQ0FBQyxjQUFjLEdBQUcsR0FBRyxDQUFDO1FBQzdCLE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7SUFFTSxhQUFhLENBQUMsU0FBaUI7UUFDbEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRU0sS0FBSztRQUNSLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVNLFlBQVk7UUFDZixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFTSxJQUFJO1FBQ1AsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztJQUM5QixDQUFDO0NBQ0o7QUF2REQsb0NBdURDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHR5cGUgU2Vzc2lvblBoYXNlID0gJ2F3YWl0aW5nX2luaXRpYWxpemVkX25vdGlmaWNhdGlvbicgfCAncmVhZHknO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1jcFNlc3Npb24ge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgcGhhc2U6IFNlc3Npb25QaGFzZTtcbiAgICBjcmVhdGVkQXQ6IG51bWJlcjtcbiAgICBsYXN0QWN0aXZpdHlBdDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgU2Vzc2lvblN0b3JlIHtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25zID0gbmV3IE1hcDxzdHJpbmcsIE1jcFNlc3Npb24+KCk7XG5cbiAgICBwdWJsaWMgY3JlYXRlU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZywgbm93OiBudW1iZXIgPSBEYXRlLm5vdygpKTogTWNwU2Vzc2lvbiB7XG4gICAgICAgIGNvbnN0IHNlc3Npb246IE1jcFNlc3Npb24gPSB7XG4gICAgICAgICAgICBpZDogc2Vzc2lvbklkLFxuICAgICAgICAgICAgcGhhc2U6ICdhd2FpdGluZ19pbml0aWFsaXplZF9ub3RpZmljYXRpb24nLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICAgICAgICBsYXN0QWN0aXZpdHlBdDogbm93XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zZXNzaW9ucy5zZXQoc2Vzc2lvbklkLCBzZXNzaW9uKTtcbiAgICAgICAgcmV0dXJuIHNlc3Npb247XG4gICAgfVxuXG4gICAgcHVibGljIGdldFNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpOiBNY3BTZXNzaW9uIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlc3Npb25zLmdldChzZXNzaW9uSWQpID8/IG51bGw7XG4gICAgfVxuXG4gICAgcHVibGljIGVuc3VyZVNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpOiBNY3BTZXNzaW9uIHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2Vzc2lvbiBub3QgZm91bmQ6ICR7c2Vzc2lvbklkfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzZXNzaW9uO1xuICAgIH1cblxuICAgIHB1YmxpYyBtYXJrUmVhZHkoc2Vzc2lvbklkOiBzdHJpbmcsIG5vdzogbnVtYmVyID0gRGF0ZS5ub3coKSk6IE1jcFNlc3Npb24ge1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5lbnN1cmVTZXNzaW9uKHNlc3Npb25JZCk7XG4gICAgICAgIHNlc3Npb24ucGhhc2UgPSAncmVhZHknO1xuICAgICAgICBzZXNzaW9uLmxhc3RBY3Rpdml0eUF0ID0gbm93O1xuICAgICAgICByZXR1cm4gc2Vzc2lvbjtcbiAgICB9XG5cbiAgICBwdWJsaWMgdG91Y2goc2Vzc2lvbklkOiBzdHJpbmcsIG5vdzogbnVtYmVyID0gRGF0ZS5ub3coKSk6IE1jcFNlc3Npb24ge1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5lbnN1cmVTZXNzaW9uKHNlc3Npb25JZCk7XG4gICAgICAgIHNlc3Npb24ubGFzdEFjdGl2aXR5QXQgPSBub3c7XG4gICAgICAgIHJldHVybiBzZXNzaW9uO1xuICAgIH1cblxuICAgIHB1YmxpYyByZW1vdmVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uSWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjbGVhcigpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXNzaW9ucy5jbGVhcigpO1xuICAgIH1cblxuICAgIHB1YmxpYyBsaXN0U2Vzc2lvbnMoKTogTWNwU2Vzc2lvbltdIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5zZXNzaW9ucy52YWx1ZXMoKSk7XG4gICAgfVxuXG4gICAgcHVibGljIHNpemUoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Vzc2lvbnMuc2l6ZTtcbiAgICB9XG59XG4iXX0=