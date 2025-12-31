/**
 * Point d'entrée pour le développement avec hot reload
 *
 * Ce fichier lance le serveur MCP en mode TCP (au lieu de stdio)
 * pour permettre la reconnexion depuis le proxy.
 *
 * Usage:
 *   npm run dev    → Lance avec tsx watch (hot reload)
 *   npm run proxy  → Lance le proxy (une seule fois, dans Claude Desktop)
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { Bot } from 'mineflayer';
import { mineflayer as mineflayerViewer } from 'prismarine-viewer';

import { initBotManager, getBotManager, BotManager } from './bot_manager';

// Fichier pour communiquer le port au proxy
const PORT_FILE = path.join(process.cwd(), '.dev-port');

// Import des outils
import { inventoryTool } from './tools/inventory';
import { moveTool } from './tools/move';
import { collectTool } from './tools/collect';
import { buildTool } from './tools/build';
import { craftTool } from './tools/craft';
import { dropTool } from './tools/drop';
import { smeltTool } from './tools/smelt';
import { visionTool } from './tools/vision';
import { netherPortalTool, bucketTool } from './tools/nether_portal';

const SERVER_PORT = 3099;

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
    visionTool,
    netherPortalTool,
    bucketTool
];

let manager: BotManager | null = null;

/**
 * Transport personnalisé qui utilise un socket TCP
 */
class SocketTransport {
    private socket: net.Socket;
    private buffer: string = '';
    private onMessage: ((msg: any) => void) | null = null;
    private onClose: (() => void) | null = null;

    constructor(socket: net.Socket) {
        this.socket = socket;

        socket.on('data', (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });

        socket.on('close', () => {
            if (this.onClose) this.onClose();
        });

        socket.on('error', (err) => {
            console.error('[Transport] Erreur:', err.message);
        });
    }

    private processBuffer(): void {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim() && this.onMessage) {
                try {
                    const msg = JSON.parse(line);
                    this.onMessage(msg);
                } catch (err) {
                    console.error('[Transport] JSON invalide:', line);
                }
            }
        }
    }

    send(msg: any): void {
        this.socket.write(JSON.stringify(msg) + '\n');
    }

    setMessageHandler(handler: (msg: any) => void): void {
        this.onMessage = handler;
    }

    setCloseHandler(handler: () => void): void {
        this.onClose = handler;
    }

    close(): void {
        this.socket.destroy();
    }
}

/**
 * Gère une connexion client (du proxy)
 */
async function handleClient(socket: net.Socket, botProvider: () => Bot): Promise<void> {
    console.error('[Dev] Nouvelle connexion du proxy');

    const transport = new SocketTransport(socket);

    transport.setMessageHandler(async (message) => {
        try {
            const response = await handleMcpRequest(message, botProvider);
            if (response) {
                transport.send(response);
            }
        } catch (err) {
            console.error('[Dev] Erreur traitement:', err);
            transport.send({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal error' },
                id: message.id || null
            });
        }
    });

    transport.setCloseHandler(() => {
        console.error('[Dev] Proxy déconnecté');
    });
}

/**
 * Traite les requêtes MCP
 */
async function handleMcpRequest(message: any, botProvider: () => Bot): Promise<any> {
    const { method, params, id } = message;

    try {
        if (method === 'initialize') {
            return {
                jsonrpc: '2.0',
                result: {
                    protocolVersion: '2024-11-05',
                    serverInfo: { name: 'mcpcraft-dev', version: '2.0.0' },
                    capabilities: { tools: {} }
                },
                id
            };
        }

        if (method === 'notifications/initialized') {
            return null;
        }

        if (method === 'tools/list') {
            const validTools = tools.filter(t => t != null);
            return {
                jsonrpc: '2.0',
                result: {
                    tools: validTools.map(t => ({
                        name: t.name,
                        description: t.description,
                        inputSchema: t.inputSchema
                    }))
                },
                id
            };
        }

        if (method === 'tools/call') {
            const toolName = params.name;
            const tool = tools.find(t => t.name === toolName);

            if (!tool) {
                return {
                    jsonrpc: '2.0',
                    error: { code: -32601, message: `Outil inconnu: ${toolName}` },
                    id
                };
            }

            try {
                const bot = botProvider();
                const result = await tool.handler(bot, params.arguments || {});
                return {
                    jsonrpc: '2.0',
                    result,
                    id
                };
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                return {
                    jsonrpc: '2.0',
                    result: { content: [{ type: 'text', text: `Erreur: ${msg}` }] },
                    id
                };
            }
        }

        return {
            jsonrpc: '2.0',
            error: { code: -32601, message: `Méthode non supportée: ${method}` },
            id
        };

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            jsonrpc: '2.0',
            error: { code: -32603, message: msg },
            id
        };
    }
}

let currentPort = SERVER_PORT;

async function main() {
    console.error('');
    console.error('╔═══════════════════════════════════════════╗');
    console.error('║     MCPCraft - Mode Développement         ║');
    console.error('╚═══════════════════════════════════════════╝');
    console.error('');

    // 1. Initialiser le BotManager
    manager = initBotManager({
        host: 'localhost',
        port: 54321,
        username: 'MCPBot',
        version: '1.21.1'
    });

    // 2. Démarrer le bot Minecraft
    console.error('[Dev] Connexion au serveur Minecraft...');
    try {
        const bot = await manager.initBot();

        // 3. Lancer le viewer (vue du bot)
        mineflayerViewer(bot, { port: 3007, firstPerson: true });
        console.error('[Dev] Viewer disponible sur http://localhost:3007');
    } catch (err) {
        console.error('[Dev] Impossible de se connecter à Minecraft:', err);
        console.error('[Dev] Le serveur MCP va démarrer quand même (sans bot)');
    }

    // 4. Créer le serveur TCP pour le proxy
    const tcpServer = net.createServer({ allowHalfOpen: false }, (socket) => {
        handleClient(socket, () => {
            try {
                return getBotManager().getBot();
            } catch {
                throw new Error("Bot non connecté");
            }
        });
    });

    tcpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            currentPort++;
            console.error(`[Dev] Port occupé, essai sur ${currentPort}...`);
            tcpServer.listen({ port: currentPort, host: 'localhost' });
        } else {
            console.error('[Dev] Erreur serveur:', err);
        }
    });

    tcpServer.listen({ port: currentPort, host: 'localhost' }, () => {
        // Écrire le port dans un fichier pour le proxy
        fs.writeFileSync(PORT_FILE, String(currentPort));
        console.error(`[Dev] Serveur MCP prêt sur localhost:${currentPort}`);
    });

    // Gestion de l'arrêt propre
    const shutdown = async () => {
        console.error('\n[Dev] Arrêt...');

        // Supprimer le fichier de port
        try { fs.unlinkSync(PORT_FILE); } catch {}

        tcpServer.close();
        if (manager) {
            await manager.shutdown();
        }
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', () => {
        tcpServer.close();
    });
}

main().catch(console.error);
