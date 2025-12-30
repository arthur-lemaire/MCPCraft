
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Bot } from 'mineflayer';

// Import des outils
import { inventoryTool } from './tools/inventory';
import { moveTool } from './tools/move';
import { collectTool } from './tools/collect';
import { buildTool } from './tools/build';
import { craftTool } from './tools/craft';
import { dropTool } from './tools/drop';
import { smeltTool } from './tools/smelt';
import { autoIronTool } from './tools/auto_iron';

// Interface commune
interface Tool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (bot: Bot, args: any) => Promise<{ content: { type: string; text: string }[] }>;
}

const tools: Tool[] = [
    inventoryTool,
    moveTool,
    collectTool,
    buildTool,
    craftTool,
    dropTool,
    smeltTool,
    autoIronTool
];

export function startMcpServer(botProvider: () => Bot) {
    const server = new Server({
        name: "minecraft-mcp-v2",
        version: "2.0.0"
    }, {
        capabilities: { tools: {} }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
        }))
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const tool = tools.find(t => t.name === toolName);

        if (!tool) {
            throw new Error(`Outil inconnu: ${toolName}`);
        }

        try {
            // On récupère l'instance du bot au moment de l'appel
            const bot = botProvider();
            if (!bot) {
                return { content: [{ type: 'text', text: "Le bot n'est pas connecté." }] };
            }
            
            return await tool.handler(bot, request.params.arguments || {});
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: [{ type: 'text', text: `Erreur interne outil: ${msg}` }] };
        }
    });

    const transport = new StdioServerTransport();
    server.connect(transport).then(() => {
        console.error('Serveur MCP v2 prêt et connecté.');
    }).catch(err => {
        console.error('Erreur fatale MCP:', err);
    });
}
