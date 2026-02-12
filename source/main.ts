import { MCPServer } from './mcp-server';
import { readSettings, saveSettings } from './settings';
import { MCPServerSettings } from './types';
import { ToolManager } from './tools/tool-manager';

let mcpServer: MCPServer | null = null;
let toolManager: ToolManager;

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en Open the MCP server panel
     * @zh 打开 MCP 服务器面板
     */
    openPanel() {
        Editor.Panel.open('cocos-mcp-server');
    },

    /**
     * @en Open the tool manager panel
     * @zh 打开工具管理面板
     */
    openToolManager() {
        // 当前版本将工具管理合并在主面板内，保持兼容旧消息入口
        Editor.Panel.open('cocos-mcp-server');
    },



    /**
     * @en Start the MCP server
     * @zh 启动 MCP 服务器
     */
    async startServer() {
        if (mcpServer) {
            // 确保使用最新的工具配置
            const enabledTools = toolManager.getEnabledTools();
            mcpServer.updateEnabledTools(enabledTools);
            await mcpServer.start();
        } else {
            console.warn('[MCP插件] mcpServer 未初始化');
        }
    },

    /**
     * @en Stop the MCP server
     * @zh 停止 MCP 服务器
     */
    async stopServer() {
        if (mcpServer) {
            mcpServer.stop();
        } else {
            console.warn('[MCP插件] mcpServer 未初始化');
        }
    },

    /**
     * @en Get server status
     * @zh 获取服务器状态
     */
    getServerStatus() {
        const status = mcpServer ? mcpServer.getStatus() : { running: false, port: 0, clients: 0 };
        const settings = mcpServer ? mcpServer.getSettings() : readSettings();
        return {
            ...status,
            settings: settings
        };
    },

    /**
     * @en Update server settings
     * @zh 更新服务器设置
     */
    async updateSettings(settings: MCPServerSettings) {
        saveSettings(settings);
        const wasRunning = mcpServer ? mcpServer.getStatus().running : false;

        if (mcpServer) {
            mcpServer.stop();
        }

        mcpServer = new MCPServer(settings);

        // 保持工具配置与新实例同步
        const enabledTools = toolManager.getEnabledTools();
        mcpServer.updateEnabledTools(enabledTools);

        // 仅在原本已运行时重启，避免“保存设置”意外启动服务
        if (wasRunning) {
            await mcpServer.start();
        }

        return {
            success: true,
            restarted: wasRunning
        };
    },

    /**
     * @en Get tools list
     * @zh 获取工具列表
     */
    getToolsList() {
        return mcpServer ? mcpServer.getAvailableTools() : [];
    },

    getFilteredToolsList() {
        if (!mcpServer) return [];
        
        // 获取当前启用的工具
        const enabledTools = toolManager.getEnabledTools();
        
        // 更新MCP服务器的启用工具列表
        mcpServer.updateEnabledTools(enabledTools);
        
        return mcpServer.getFilteredTools(enabledTools);
    },
    /**
     * @en Get server settings
     * @zh 获取服务器设置
     */
    async getServerSettings() {
        return mcpServer ? mcpServer.getSettings() : readSettings();
    },

    /**
     * @en Get server settings (alternative method)
     * @zh 获取服务器设置（替代方法）
     */
    async getSettings() {
        return mcpServer ? mcpServer.getSettings() : readSettings();
    },

    // 工具管理器相关方法
    async getToolManagerState() {
        return toolManager.getToolManagerState();
    },

    async createToolConfiguration(name: string, description?: string) {
        try {
            const config = toolManager.createConfiguration(name, description);
            return { success: true, id: config.id, config };
        } catch (error: any) {
            throw new Error(`创建配置失败: ${error.message}`);
        }
    },

    async updateToolConfiguration(configId: string, updates: any) {
        try {
            return toolManager.updateConfiguration(configId, updates);
        } catch (error: any) {
            throw new Error(`更新配置失败: ${error.message}`);
        }
    },

    async deleteToolConfiguration(configId: string) {
        try {
            toolManager.deleteConfiguration(configId);
            return { success: true };
        } catch (error: any) {
            throw new Error(`删除配置失败: ${error.message}`);
        }
    },

    async setCurrentToolConfiguration(configId: string) {
        try {
            toolManager.setCurrentConfiguration(configId);
            return { success: true };
        } catch (error: any) {
            throw new Error(`设置当前配置失败: ${error.message}`);
        }
    },

    async updateToolStatus(...args: any[]) {
        try {
            // 兼容两种调用方式：
            // 1) (category, toolName, enabled)
            // 2) (configId, category, toolName, enabled) - 旧面板调用方式
            let category: string;
            let toolName: string;
            let enabled: boolean;

            if (args.length === 4) {
                category = args[1];
                toolName = args[2];
                enabled = args[3];
            } else {
                category = args[0];
                toolName = args[1];
                enabled = args[2];
            }

            const currentConfig = toolManager.getCurrentConfiguration();
            if (!currentConfig) {
                throw new Error('没有当前配置');
            }
            
            toolManager.updateToolStatus(currentConfig.id, category, toolName, enabled);
            
            // 更新MCP服务器的工具列表
            if (mcpServer) {
                const enabledTools = toolManager.getEnabledTools();
                mcpServer.updateEnabledTools(enabledTools);
            }
            
            return { success: true };
        } catch (error: any) {
            throw new Error(`更新工具状态失败: ${error.message}`);
        }
    },

    async updateToolStatusBatch(...args: any[]) {
        try {
            // 兼容两种调用方式：
            // 1) (updates)
            // 2) (configId, updates) - 旧面板调用方式
            const updates = args.length === 2 ? args[1] : args[0];
            console.log(`[Main] updateToolStatusBatch called with updates count:`, updates ? updates.length : 0);
            
            const currentConfig = toolManager.getCurrentConfiguration();
            if (!currentConfig) {
                throw new Error('没有当前配置');
            }
            
            toolManager.updateToolStatusBatch(currentConfig.id, updates);
            
            // 更新MCP服务器的工具列表
            if (mcpServer) {
                const enabledTools = toolManager.getEnabledTools();
                mcpServer.updateEnabledTools(enabledTools);
            }
            
            return { success: true };
        } catch (error: any) {
            throw new Error(`批量更新工具状态失败: ${error.message}`);
        }
    },

    async exportToolConfiguration(configId: string) {
        try {
            return { configJson: toolManager.exportConfiguration(configId) };
        } catch (error: any) {
            throw new Error(`导出配置失败: ${error.message}`);
        }
    },

    async importToolConfiguration(configJson: string) {
        try {
            return toolManager.importConfiguration(configJson);
        } catch (error: any) {
            throw new Error(`导入配置失败: ${error.message}`);
        }
    },

    async getEnabledTools() {
        return toolManager.getEnabledTools();
    }
};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
export function load() {
    console.log('Cocos MCP Server extension loaded');
    
    // 初始化工具管理器
    toolManager = new ToolManager();
    
    // 读取设置
    const settings = readSettings();
    mcpServer = new MCPServer(settings);
    
    // 初始化MCP服务器的工具列表
    const enabledTools = toolManager.getEnabledTools();
    mcpServer.updateEnabledTools(enabledTools);
    
    // 如果设置了自动启动，则启动服务器
    if (settings.autoStart) {
        mcpServer.start().catch(err => {
            console.error('Failed to auto-start MCP server:', err);
        });
    }
}

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
export function unload() {
    if (mcpServer) {
        mcpServer.stop();
        mcpServer = null;
    }
}
