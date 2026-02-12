"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationTools = void 0;
const settings_1 = require("../settings");
class ValidationTools {
    getTools() {
        return [
            {
                name: 'validate_json_params',
                description: 'Validate and fix JSON parameters before sending to other tools',
                inputSchema: {
                    type: 'object',
                    properties: {
                        jsonString: {
                            type: 'string',
                            description: 'JSON string to validate and fix'
                        },
                        expectedSchema: {
                            type: 'object',
                            description: 'Expected parameter schema (optional)'
                        }
                    },
                    required: ['jsonString']
                }
            },
            {
                name: 'safe_string_value',
                description: 'Create a safe string value that won\'t cause JSON parsing issues',
                inputSchema: {
                    type: 'object',
                    properties: {
                        value: {
                            type: 'string',
                            description: 'String value to make safe'
                        }
                    },
                    required: ['value']
                }
            },
            {
                name: 'format_mcp_request',
                description: 'Format a complete MCP request with proper JSON escaping',
                inputSchema: {
                    type: 'object',
                    properties: {
                        toolName: {
                            type: 'string',
                            description: 'Tool name to call'
                        },
                        arguments: {
                            type: 'object',
                            description: 'Tool arguments'
                        }
                    },
                    required: ['toolName', 'arguments']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'validate_json_params':
                return await this.validateJsonParams(args.jsonString, args.expectedSchema);
            case 'safe_string_value':
                return await this.createSafeStringValue(args.value);
            case 'format_mcp_request':
                return await this.formatMcpRequest(args.toolName, args.arguments);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    async validateJsonParams(jsonString, expectedSchema) {
        try {
            // First try to parse as-is
            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            }
            catch (error) {
                // Try to fix common issues
                const fixed = this.fixJsonString(jsonString);
                try {
                    parsed = JSON.parse(fixed);
                }
                catch (secondError) {
                    return {
                        success: false,
                        error: `Cannot fix JSON: ${error.message}`,
                        data: {
                            originalJson: jsonString,
                            fixedAttempt: fixed,
                            suggestions: this.getJsonFixSuggestions(jsonString)
                        }
                    };
                }
            }
            // Validate against schema if provided
            if (expectedSchema) {
                const validation = this.validateAgainstSchema(parsed, expectedSchema);
                if (!validation.valid) {
                    return {
                        success: false,
                        error: 'Schema validation failed',
                        data: {
                            parsedJson: parsed,
                            validationErrors: validation.errors,
                            suggestions: validation.suggestions
                        }
                    };
                }
            }
            return {
                success: true,
                data: {
                    parsedJson: parsed,
                    fixedJson: JSON.stringify(parsed, null, 2),
                    isValid: true
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    async createSafeStringValue(value) {
        const safeValue = this.escapJsonString(value);
        return {
            success: true,
            data: {
                originalValue: value,
                safeValue: safeValue,
                jsonReady: JSON.stringify(safeValue),
                usage: `Use "${safeValue}" in your JSON parameters`
            }
        };
    }
    async formatMcpRequest(toolName, toolArgs) {
        try {
            const mcpRequest = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: toolArgs
                }
            };
            const formattedJson = JSON.stringify(mcpRequest, null, 2);
            const compactJson = JSON.stringify(mcpRequest);
            return {
                success: true,
                data: {
                    request: mcpRequest,
                    formattedJson: formattedJson,
                    compactJson: compactJson,
                    curlCommand: this.generateCurlCommand(compactJson)
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to format MCP request: ${error.message}`
            };
        }
    }
    fixJsonString(jsonStr) {
        let fixed = jsonStr;
        // Fix common escape character issues
        fixed = fixed
            // Fix unescaped quotes in string values
            .replace(/(\{[^}]*"[^"]*":\s*")([^"]*")([^"]*")([^}]*\})/g, (match, prefix, content, suffix, end) => {
            const escapedContent = content.replace(/"/g, '\\"');
            return prefix + escapedContent + suffix + end;
        })
            // Fix unescaped backslashes
            .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2')
            // Fix trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix control characters
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            // Fix single quotes to double quotes
            .replace(/'/g, '"');
        return fixed;
    }
    escapJsonString(str) {
        return str
            .replace(/\\/g, '\\\\') // Escape backslashes first
            .replace(/"/g, '\\"') // Escape quotes
            .replace(/\n/g, '\\n') // Escape newlines
            .replace(/\r/g, '\\r') // Escape carriage returns
            .replace(/\t/g, '\\t') // Escape tabs
            .replace(/\f/g, '\\f') // Escape form feeds
            .replace(/\u0008/g, '\\b'); // Escape backspaces
    }
    validateAgainstSchema(data, schema) {
        const errors = [];
        const suggestions = [];
        // Basic type checking
        if (schema.type) {
            const actualType = Array.isArray(data) ? 'array' : typeof data;
            if (actualType !== schema.type) {
                errors.push(`Expected type ${schema.type}, got ${actualType}`);
                suggestions.push(`Convert value to ${schema.type}`);
            }
        }
        // Required fields checking
        if (schema.required && Array.isArray(schema.required)) {
            for (const field of schema.required) {
                if (!Object.prototype.hasOwnProperty.call(data, field)) {
                    errors.push(`Missing required field: ${field}`);
                    suggestions.push(`Add required field "${field}"`);
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            suggestions
        };
    }
    getJsonFixSuggestions(jsonStr) {
        const suggestions = [];
        if (jsonStr.includes('\\"')) {
            suggestions.push('Check for improperly escaped quotes');
        }
        if (jsonStr.includes("'")) {
            suggestions.push('Replace single quotes with double quotes');
        }
        if (jsonStr.includes('\n') || jsonStr.includes('\t')) {
            suggestions.push('Escape newlines and tabs properly');
        }
        if (jsonStr.match(/,\s*[}\]]/)) {
            suggestions.push('Remove trailing commas');
        }
        return suggestions;
    }
    generateCurlCommand(jsonStr) {
        const escapedJson = jsonStr.replace(/'/g, "'\"'\"'");
        const port = this.getConfiguredPort();
        return `curl -X POST http://127.0.0.1:${port}/mcp \\
  -H "Content-Type: application/json" \\
  -d '${escapedJson}'`;
    }
    getConfiguredPort() {
        try {
            const settings = (0, settings_1.readSettings)();
            if (Number.isInteger(settings.port) && settings.port > 0) {
                return settings.port;
            }
        }
        catch (error) {
            console.warn('[ValidationTools] Failed to read settings port, fallback to 3000:', error);
        }
        return 3000;
    }
}
exports.ValidationTools = ValidationTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGlvbi10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy92YWxpZGF0aW9uLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDBDQUEyQztBQUUzQyxNQUFhLGVBQWU7SUFDeEIsUUFBUTtRQUNKLE9BQU87WUFDSDtnQkFDSSxJQUFJLEVBQUUsc0JBQXNCO2dCQUM1QixXQUFXLEVBQUUsZ0VBQWdFO2dCQUM3RSxXQUFXLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLFVBQVUsRUFBRTs0QkFDUixJQUFJLEVBQUUsUUFBUTs0QkFDZCxXQUFXLEVBQUUsaUNBQWlDO3lCQUNqRDt3QkFDRCxjQUFjLEVBQUU7NEJBQ1osSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLHNDQUFzQzt5QkFDdEQ7cUJBQ0o7b0JBQ0QsUUFBUSxFQUFFLENBQUMsWUFBWSxDQUFDO2lCQUMzQjthQUNKO1lBQ0Q7Z0JBQ0ksSUFBSSxFQUFFLG1CQUFtQjtnQkFDekIsV0FBVyxFQUFFLGtFQUFrRTtnQkFDL0UsV0FBVyxFQUFFO29CQUNULElBQUksRUFBRSxRQUFRO29CQUNkLFVBQVUsRUFBRTt3QkFDUixLQUFLLEVBQUU7NEJBQ0gsSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLDJCQUEyQjt5QkFDM0M7cUJBQ0o7b0JBQ0QsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDO2lCQUN0QjthQUNKO1lBQ0Q7Z0JBQ0ksSUFBSSxFQUFFLG9CQUFvQjtnQkFDMUIsV0FBVyxFQUFFLHlEQUF5RDtnQkFDdEUsV0FBVyxFQUFFO29CQUNULElBQUksRUFBRSxRQUFRO29CQUNkLFVBQVUsRUFBRTt3QkFDUixRQUFRLEVBQUU7NEJBQ04sSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLG1CQUFtQjt5QkFDbkM7d0JBQ0QsU0FBUyxFQUFFOzRCQUNQLElBQUksRUFB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QUNuQixDQUFDO0lBRU8saUJBQWlCO1FBQ3JCLElBQUksQ0FBQztZQUNELE1BQU0sUUFBUSxHQUFHLElBQUEsdUJBQVksR0FBRSxDQUFDO1lBQ2hDLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDdkQsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO1lBQ3pCLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUVBQW1FLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7Q0FDSjtBQWpSRCwwQ0FpUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUb29sRGVmaW5pdGlvbiwgVG9vbFJlc3BvbnNlLCBUb29sRXhlY3V0b3IgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyByZWFkU2V0dGluZ3MgfSBmcm9tICcuLi9zZXR0aW5ncyc7XG5cbmV4cG9ydCBjbGFzcyBWYWxpZGF0aW9uVG9vbHMgaW1wbGVtZW50cyBUb29sRXhlY3V0b3Ige1xuICAgIGdldFRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd2YWxpZGF0ZV9qc29uX3BhcmFtcycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdWYWxpZGF0ZSBhbmQgZml4IEpTT04gcGFyYW1ldGVycyBiZWZvcmUgc2VuZGluZyB0byBvdGhlciB0b29scycsXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGpzb25TdHJpbmc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0pTT04gc3RyaW5nIHRvIHZhbGlkYXRlIGFuZCBmaXgnXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0V4cGVjdGVkIHBhcmFtZXRlciBzY2hlbWEgKG9wdGlvbmFsKSdcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnanNvblN0cmluZyddXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2FmZV9zdHJpbmdfdmFsdWUnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIGEgc2FmZSBzdHJpbmcgdmFsdWUgdGhhdCB3b25cXCd0IGNhdXNlIEpTT04gcGFyc2luZyBpc3N1ZXMnLFxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3RyaW5nIHZhbHVlIHRvIG1ha2Ugc2FmZSdcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndmFsdWUnXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zvcm1hdF9tY3BfcmVxdWVzdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGb3JtYXQgYSBjb21wbGV0ZSBNQ1AgcmVxdWVzdCB3aXRoIHByb3BlciBKU09OIGVzY2FwaW5nJyxcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbE5hbWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Rvb2wgbmFtZSB0byBjYWxsJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVG9vbCBhcmd1bWVudHMnXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Rvb2xOYW1lJywgJ2FyZ3VtZW50cyddXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBdO1xuICAgIH1cblxuICAgIGFzeW5jIGV4ZWN1dGUodG9vbE5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcbiAgICAgICAgc3dpdGNoICh0b29sTmFtZSkge1xuICAgICAgICAgICAgY2FzZSAndmFsaWRhdGVfanNvbl9wYXJhbXMnOlxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnZhbGlkYXRlSnNvblBhcmFtcyhhcmdzLmpzb25TdHJpbmcsIGFyZ3MuZXhwZWN0ZWRTY2hlbWEpO1xuICAgICAgICAgICAgY2FzZSAnc2FmZV9zdHJpbmdfdmFsdWUnOlxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNyZWF0ZVNhZmVTdHJpbmdWYWx1ZShhcmdzLnZhbHVlKTtcbiAgICAgICAgICAgIGNhc2UgJ2Zvcm1hdF9tY3BfcmVxdWVzdCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZm9ybWF0TWNwUmVxdWVzdChhcmdzLnRvb2xOYW1lLCBhcmdzLmFyZ3VtZW50cyk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUpzb25QYXJhbXMoanNvblN0cmluZzogc3RyaW5nLCBleHBlY3RlZFNjaGVtYT86IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBGaXJzdCB0cnkgdG8gcGFyc2UgYXMtaXNcbiAgICAgICAgICAgIGxldCBwYXJzZWQ7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBhcnNlZCA9IEpTT04ucGFyc2UoanNvblN0cmluZyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpeCBjb21tb24gaXNzdWVzXG4gICAgICAgICAgICAgICAgY29uc3QgZml4ZWQgPSB0aGlzLmZpeEpzb25TdHJpbmcoanNvblN0cmluZyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VkID0gSlNPTi5wYXJzZShmaXhlZCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoc2Vjb25kRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBDYW5ub3QgZml4IEpTT046ICR7ZXJyb3IubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsSnNvbjoganNvblN0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXhlZEF0dGVtcHQ6IGZpeGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiB0aGlzLmdldEpzb25GaXhTdWdnZXN0aW9ucyhqc29uU3RyaW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgYWdhaW5zdCBzY2hlbWEgaWYgcHJvdmlkZWRcbiAgICAgICAgICAgIGlmIChleHBlY3RlZFNjaGVtYSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkYXRpb24gPSB0aGlzLnZhbGlkYXRlQWdhaW5zdFNjaGVtYShwYXJzZWQsIGV4cGVjdGVkU2NoZW1hKTtcbiAgICAgICAgICAgICAgICBpZiAoIXZhbGlkYXRpb24udmFsaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlZEpzb246IHBhcnNlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uRXJyb3JzOiB2YWxpZGF0aW9uLmVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogdmFsaWRhdGlvbi5zdWdnZXN0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VkSnNvbjogcGFyc2VkLFxuICAgICAgICAgICAgICAgICAgICBmaXhlZEpzb246IEpTT04uc3RyaW5naWZ5KHBhcnNlZCwgbnVsbCwgMiksXG4gICAgICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVTYWZlU3RyaW5nVmFsdWUodmFsdWU6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XG4gICAgICAgIGNvbnN0IHNhZmVWYWx1ZSA9IHRoaXMuZXNjYXBKc29uU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxWYWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgc2FmZVZhbHVlOiBzYWZlVmFsdWUsXG4gICAgICAgICAgICAgICAganNvblJlYWR5OiBKU09OLnN0cmluZ2lmeShzYWZlVmFsdWUpLFxuICAgICAgICAgICAgICAgIHVzYWdlOiBgVXNlIFwiJHtzYWZlVmFsdWV9XCIgaW4geW91ciBKU09OIHBhcmFtZXRlcnNgXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmb3JtYXRNY3BSZXF1ZXN0KHRvb2xOYW1lOiBzdHJpbmcsIHRvb2xBcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbWNwUmVxdWVzdCA9IHtcbiAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICBpZDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50czogdG9vbEFyZ3NcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWRKc29uID0gSlNPTi5zdHJpbmdpZnkobWNwUmVxdWVzdCwgbnVsbCwgMik7XG4gICAgICAgICAgICBjb25zdCBjb21wYWN0SnNvbiA9IEpTT04uc3RyaW5naWZ5KG1jcFJlcXVlc3QpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0OiBtY3BSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICBmb3JtYXR0ZWRKc29uOiBmb3JtYXR0ZWRKc29uLFxuICAgICAgICAgICAgICAgICAgICBjb21wYWN0SnNvbjogY29tcGFjdEpzb24sXG4gICAgICAgICAgICAgICAgICAgIGN1cmxDb21tYW5kOiB0aGlzLmdlbmVyYXRlQ3VybENvbW1hbmQoY29tcGFjdEpzb24pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBmb3JtYXQgTUNQIHJlcXVlc3Q6ICR7ZXJyb3IubWVzc2FnZX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBmaXhKc29uU3RyaW5nKGpzb25TdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGxldCBmaXhlZCA9IGpzb25TdHI7XG4gICAgICAgIFxuICAgICAgICAvLyBGaXggY29tbW9uIGVzY2FwZSBjaGFyYWN0ZXIgaXNzdWVzXG4gICAgICAgIGZpeGVkID0gZml4ZWRcbiAgICAgICAgICAgIC8vIEZpeCB1bmVzY2FwZWQgcXVvdGVzIGluIHN0cmluZyB2YWx1ZXNcbiAgICAgICAgICAgIC5yZXBsYWNlKC8oXFx7W159XSpcIlteXCJdKlwiOlxccypcIikoW15cIl0qXCIpKFteXCJdKlwiKShbXn1dKlxcfSkvZywgKG1hdGNoLCBwcmVmaXgsIGNvbnRlbnQsIHN1ZmZpeCwgZW5kKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZENvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgZXNjYXBlZENvbnRlbnQgKyBzdWZmaXggKyBlbmQ7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLy8gRml4IHVuZXNjYXBlZCBiYWNrc2xhc2hlc1xuICAgICAgICAgICAgLnJlcGxhY2UoLyhbXlxcXFxdKVxcXFwoW15cIlxcXFxcXC9iZm5ydHVdKS9nLCAnJDFcXFxcXFxcXCQyJylcbiAgICAgICAgICAgIC8vIEZpeCB0cmFpbGluZyBjb21tYXNcbiAgICAgICAgICAgIC5yZXBsYWNlKC8sKFxccypbfVxcXV0pL2csICckMScpXG4gICAgICAgICAgICAvLyBGaXggY29udHJvbCBjaGFyYWN0ZXJzXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxuL2csICdcXFxcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICdcXFxcdCcpXG4gICAgICAgICAgICAvLyBGaXggc2luZ2xlIHF1b3RlcyB0byBkb3VibGUgcXVvdGVzXG4gICAgICAgICAgICAucmVwbGFjZSgvJy9nLCAnXCInKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBmaXhlZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGVzY2FwSnNvblN0cmluZyhzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBzdHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpICAvLyBFc2NhcGUgYmFja3NsYXNoZXMgZmlyc3RcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgICAgLy8gRXNjYXBlIHF1b3Rlc1xuICAgICAgICAgICAgLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKSAgIC8vIEVzY2FwZSBuZXdsaW5lc1xuICAgICAgICAgICAgLnJlcGxhY2UoL1xcci9nLCAnXFxcXHInKSAgIC8vIEVzY2FwZSBjYXJyaWFnZSByZXR1cm5zXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICdcXFxcdCcpICAgLy8gRXNjYXBlIHRhYnNcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXGYvZywgJ1xcXFxmJykgICAvLyBFc2NhcGUgZm9ybSBmZWVkc1xuICAgICAgICAgICAgLnJlcGxhY2UoL1xcdTAwMDgvZywgJ1xcXFxiJyk7ICAvLyBFc2NhcGUgYmFja3NwYWNlc1xuICAgIH1cblxuICAgIHByaXZhdGUgdmFsaWRhdGVBZ2FpbnN0U2NoZW1hKGRhdGE6IGFueSwgc2NoZW1hOiBhbnkpOiB7IHZhbGlkOiBib29sZWFuOyBlcnJvcnM6IHN0cmluZ1tdOyBzdWdnZXN0aW9uczogc3RyaW5nW10gfSB7XG4gICAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgLy8gQmFzaWMgdHlwZSBjaGVja2luZ1xuICAgICAgICBpZiAoc2NoZW1hLnR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFR5cGUgPSBBcnJheS5pc0FycmF5KGRhdGEpID8gJ2FycmF5JyA6IHR5cGVvZiBkYXRhO1xuICAgICAgICAgICAgaWYgKGFjdHVhbFR5cGUgIT09IHNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goYEV4cGVjdGVkIHR5cGUgJHtzY2hlbWEudHlwZX0sIGdvdCAke2FjdHVhbFR5cGV9YCk7XG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgQ29udmVydCB2YWx1ZSB0byAke3NjaGVtYS50eXBlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVxdWlyZWQgZmllbGRzIGNoZWNraW5nXG4gICAgICAgIGlmIChzY2hlbWEucmVxdWlyZWQgJiYgQXJyYXkuaXNBcnJheShzY2hlbWEucmVxdWlyZWQpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIHNjaGVtYS5yZXF1aXJlZCkge1xuICAgICAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGRhdGEsIGZpZWxkKSkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChgTWlzc2luZyByZXF1aXJlZCBmaWVsZDogJHtmaWVsZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgQWRkIHJlcXVpcmVkIGZpZWxkIFwiJHtmaWVsZH1cImApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgICAgICAgIGVycm9ycyxcbiAgICAgICAgICAgIHN1Z2dlc3Rpb25zXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRKc29uRml4U3VnZ2VzdGlvbnMoanNvblN0cjogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBzdWdnZXN0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIGlmIChqc29uU3RyLmluY2x1ZGVzKCdcXFxcXCInKSkge1xuICAgICAgICAgICAgc3VnZ2VzdGlvbnMucHVzaCgnQ2hlY2sgZm9yIGltcHJvcGVybHkgZXNjYXBlZCBxdW90ZXMnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0ci5pbmNsdWRlcyhcIidcIikpIHtcbiAgICAgICAgICAgIHN1Z2dlc3Rpb25zLnB1c2goJ1JlcGxhY2Ugc2luZ2xlIHF1b3RlcyB3aXRoIGRvdWJsZSBxdW90ZXMnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0ci5pbmNsdWRlcygnXFxuJykgfHwganNvblN0ci5pbmNsdWRlcygnXFx0JykpIHtcbiAgICAgICAgICAgIHN1Z2dlc3Rpb25zLnB1c2goJ0VzY2FwZSBuZXdsaW5lcyBhbmQgdGFicyBwcm9wZXJseScpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyLm1hdGNoKC8sXFxzKlt9XFxdXS8pKSB7XG4gICAgICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKCdSZW1vdmUgdHJhaWxpbmcgY29tbWFzJyk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybENvbW1hbmQoanNvblN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgZXNjYXBlZEpzb24gPSBqc29uU3RyLnJlcGxhY2UoLycvZywgXCInXFxcIidcXFwiJ1wiKTtcbiAgICAgICAgY29uc3QgcG9ydCA9IHRoaXMuZ2V0Q29uZmlndXJlZFBvcnQoKTtcbiAgICAgICAgcmV0dXJuIGBjdXJsIC1YIFBPU1QgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9L21jcCBcXFxcXG4gIC1IIFwiQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXCIgXFxcXFxuICAtZCAnJHtlc2NhcGVkSnNvbn0nYDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldENvbmZpZ3VyZWRQb3J0KCk6IG51bWJlciB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHJlYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgaWYgKE51bWJlci5pc0ludGVnZXIoc2V0dGluZ3MucG9ydCkgJiYgc2V0dGluZ3MucG9ydCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0dGluZ3MucG9ydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW1ZhbGlkYXRpb25Ub29sc10gRmFpbGVkIHRvIHJlYWQgc2V0dGluZ3MgcG9ydCwgZmFsbGJhY2sgdG8gMzAwMDonLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDMwMDA7XG4gICAgfVxufVxuIl19