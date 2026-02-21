/* eslint-disable vue/one-component-per-file */

import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { createApp, App, defineComponent, ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

const panelDataMap = new WeakMap<any, App>();

interface ServerSettings {
    port: number;
    autoStart: boolean;
    debugLog: boolean;
    allowedOrigins: string[];
    maxConnections: number;
}

module.exports = Editor.Panel.define({
    listeners: {
        show() {
            console.log('[MCP Panel] Panel shown');
        },
        hide() {
            console.log('[MCP Panel] Panel hidden');
        }
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app'
    },
    ready() {
        if (!this.$.app) {
            return;
        }

        const app = createApp({});
        app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('ui-');

        app.component('McpServerApp', defineComponent({
            setup() {
                const serverRunning = ref(false);
                const serverStatus = ref('已停止');
                const connectedClients = ref(0);
                const httpUrl = ref('');
                const isProcessing = ref(false);
                const settingsChanged = ref(false);
                const settingsInitialized = ref(false);

                const settings = ref<ServerSettings>({
                    port: 3000,
                    autoStart: false,
                    debugLog: false,
                    allowedOrigins: ['*'],
                    maxConnections: 10
                });

                let statusPollTimer: ReturnType<typeof setInterval> | null = null;

                const statusClass = computed(() => ({
                    'status-running': serverRunning.value,
                    'status-stopped': !serverRunning.value
                }));

                const normalizeAllowedOrigins = (origins: unknown): string[] => {
                    if (!Array.isArray(origins)) {
                        return ['*'];
                    }

                    const normalized = origins
                        .filter((item): item is string => typeof item === 'string')
                        .map((item) => item.trim())
                        .filter((item) => item.length > 0);

                    return normalized.length > 0 ? normalized : ['*'];
                };

                const createSettingsPayload = () => ({
                    port: Number(settings.value.port) || 3000,
                    autoStart: Boolean(settings.value.autoStart),
                    enableDebugLog: Boolean(settings.value.debugLog),
                    allowedOrigins: [...normalizeAllowedOrigins(settings.value.allowedOrigins)],
                    maxConnections: Number(settings.value.maxConnections) || 10
                });

                const stopStatusPolling = () => {
                    if (statusPollTimer) {
                        clearInterval(statusPollTimer);
                        statusPollTimer = null;
                    }
                };

                const refreshStatus = async () => {
                    const result = await Editor.Message.request('cocos-mcp-server', 'get-server-status');
                    if (!result) {
                        return;
                    }

                    serverRunning.value = result.running;
                    serverStatus.value = result.running ? '运行中' : '已停止';
                    connectedClients.value = result.clients || 0;
                    httpUrl.value = result.running ? `http://localhost:${result.port}/mcp` : '';

                    if (!settingsInitialized.value && result.settings) {
                        settings.value = {
                            port: result.settings.port ?? 3000,
                            autoStart: Boolean(result.settings.autoStart),
                            debugLog: Boolean(result.settings.enableDebugLog),
                            allowedOrigins: normalizeAllowedOrigins(result.settings.allowedOrigins),
                            maxConnections: result.settings.maxConnections ?? 10
                        };
                        settingsInitialized.value = true;
                        settingsChanged.value = false;
                    }
                };

                const startStatusPolling = () => {
                    stopStatusPolling();
                    statusPollTimer = setInterval(async () => {
                        try {
                            await refreshStatus();
                        } catch (error) {
                            console.error('[MCP Panel] Failed to refresh status:', error);
                        }
                    }, 2000);
                };

                const toggleServer = async () => {
                    isProcessing.value = true;
                    try {
                        if (serverRunning.value) {
                            await Editor.Message.request('cocos-mcp-server', 'stop-server');
                        } else {
                            const currentSettings = createSettingsPayload();
                            await Editor.Message.request('cocos-mcp-server', 'update-settings', currentSettings);
                            await Editor.Message.request('cocos-mcp-server', 'start-server');
                            settingsChanged.value = false;
                        }
                        await refreshStatus();
                    } catch (error) {
                        console.error('[MCP Panel] Failed to toggle server:', error);
                    } finally {
                        isProcessing.value = false;
                    }
                };

                const saveSettings = async () => {
                    try {
                        const payload = createSettingsPayload();
                        await Editor.Message.request('cocos-mcp-server', 'update-settings', payload);
                        settingsChanged.value = false;
                        await refreshStatus();
                    } catch (error) {
                        console.error('[MCP Panel] Failed to save settings:', error);
                    }
                };

                const copyUrl = async () => {
                    try {
                        await navigator.clipboard.writeText(httpUrl.value);
                    } catch (error) {
                        console.error('[MCP Panel] Failed to copy URL:', error);
                    }
                };

                watch(
                    settings,
                    () => {
                        if (settingsInitialized.value) {
                            settingsChanged.value = true;
                        }
                    },
                    { deep: true }
                );

                onMounted(async () => {
                    try {
                        await refreshStatus();
                    } catch (error) {
                        console.error('[MCP Panel] Failed to load initial status:', error);
                    }
                    startStatusPolling();
                });

                onBeforeUnmount(() => {
                    stopStatusPolling();
                });

                return {
                    serverRunning,
                    serverStatus,
                    connectedClients,
                    httpUrl,
                    isProcessing,
                    settings,
                    settingsChanged,
                    statusClass,
                    toggleServer,
                    saveSettings,
                    copyUrl
                };
            },
            template: readFileSync(join(__dirname, '../../../static/template/vue/mcp-server-app.html'), 'utf-8')
        }));

        app.mount(this.$.app);
        panelDataMap.set(this, app);
        console.log('[MCP Panel] Vue app mounted');
    },
    beforeClose() {},
    close() {
        const app = panelDataMap.get(this);
        if (app) {
            app.unmount();
        }
    }
});
