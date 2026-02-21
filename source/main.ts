import { MCPServer } from './mcp-server';
import { readSettings, saveSettings } from './settings';
import { MCPServerSettings } from './types';

let mcpServer: MCPServer | null = null;

export const methods: { [key: string]: (...any: any) => any } = {
    openPanel() {
        Editor.Panel.open('cocos-mcp-server');
    },

    async startServer() {
        if (!mcpServer) {
            mcpServer = new MCPServer(readSettings());
        }
        await mcpServer.start();
    },

    async stopServer() {
        if (mcpServer) {
            mcpServer.stop();
        }
    },

    getServerStatus() {
        const status = mcpServer ? mcpServer.getStatus() : { running: false, port: 0, clients: 0 };
        const settings = mcpServer ? mcpServer.getSettings() : readSettings();

        return {
            ...status,
            settings
        };
    },

    async updateSettings(settings: MCPServerSettings) {
        saveSettings(settings);

        const wasRunning = mcpServer ? mcpServer.getStatus().running : false;
        if (mcpServer) {
            mcpServer.stop();
        }

        mcpServer = new MCPServer(settings);
        if (wasRunning) {
            await mcpServer.start();
        }

        return {
            success: true,
            restarted: wasRunning
        };
    },

    async getServerSettings() {
        return mcpServer ? mcpServer.getSettings() : readSettings();
    },

    async getSettings() {
        return mcpServer ? mcpServer.getSettings() : readSettings();
    }
};

export function load() {
    console.log('Cocos MCP Server extension loaded');

    const settings = readSettings();
    mcpServer = new MCPServer(settings);

    if (settings.autoStart) {
        mcpServer.start().catch((err) => {
            console.error('Failed to auto-start MCP server:', err);
        });
    }
}

export function unload() {
    if (mcpServer) {
        mcpServer.stop();
        mcpServer = null;
    }
}
