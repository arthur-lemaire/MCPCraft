/**
 * MCP Proxy - Process stable entre Claude Desktop et le serveur MCP
 *
 * Architecture:
 * Claude Desktop ←(stdio)→ Proxy ←(TCP)→ Serveur MCP
 *
 * Le proxy reste connecté à Claude Desktop.
 * Le serveur MCP peut être redémarré sans couper la connexion.
 * Le port est lu depuis le fichier .dev-port créé par le serveur.
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DEFAULT_PORT = 3099;
const PORT_FILE = path.join(process.cwd(), '.dev-port');
const RECONNECT_DELAY = 2000;

let serverSocket: net.Socket | null = null;
let isConnected = false;
let serverBuffer = '';
let currentPort = DEFAULT_PORT;

// Cache pour les outils (mis à jour quand le serveur répond)
let cachedTools: any[] = [];
let isInitialized = false;

/**
 * Lit le port depuis le fichier .dev-port
 */
function readPortFromFile(): number {
    try {
        const content = fs.readFileSync(PORT_FILE, 'utf8').trim();
        const port = parseInt(content, 10);
        if (!isNaN(port) && port > 0 && port < 65536) {
            return port;
        }
    } catch {
        // Fichier non trouvé ou erreur de lecture
    }
    return DEFAULT_PORT;
}

/**
 * Répond directement à certaines requêtes MCP (sans le serveur)
 */
function handleLocalRequest(message: any): any | null {
    const { method, id } = message;

    if (method === 'initialize') {
        isInitialized = true;
        return {
            jsonrpc: '2.0',
            result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'mcpcraft-proxy', version: '2.0.0' },
                capabilities: { tools: {} }
            },
            id
        };
    }

    if (method === 'notifications/initialized') {
        return null;
    }

    if (method === 'tools/list' && !isConnected) {
        return {
            jsonrpc: '2.0',
            result: { tools: cachedTools },
            id
        };
    }

    return undefined;
}

/**
 * Envoie un message au serveur
 */
function sendToServer(line: string): void {
    if (isConnected && serverSocket) {
        serverSocket.write(line + '\n');
    } else {
        try {
            const message = JSON.parse(line);
            const localResponse = handleLocalRequest(message);

            if (localResponse === null) return;

            if (localResponse !== undefined) {
                process.stdout.write(JSON.stringify(localResponse) + '\n');
                return;
            }

            if (message.method === 'tools/call') {
                const errorResponse = {
                    jsonrpc: '2.0',
                    result: {
                        content: [{
                            type: 'text',
                            text: 'Serveur MCP non connecté. Lance "npm run dev" dans le projet MCPCraft.'
                        }]
                    },
                    id: message.id
                };
                process.stdout.write(JSON.stringify(errorResponse) + '\n');
                return;
            }
        } catch {
            // JSON invalide
        }
    }
}

/**
 * Connecte au serveur MCP
 */
function connectToServer(): void {
    if (serverSocket) {
        serverSocket.removeAllListeners();
        serverSocket.destroy();
    }

    // Lire le port depuis le fichier à chaque tentative de connexion
    const newPort = readPortFromFile();
    if (newPort !== currentPort) {
        currentPort = newPort;
        console.error(`[Proxy] Port mis à jour: ${currentPort}`);
    }

    serverSocket = new net.Socket();

    serverSocket.connect(currentPort, 'localhost', () => {
        console.error(`[Proxy] Connecté au serveur MCP (port ${currentPort})`);
        isConnected = true;

        if (isInitialized) {
            serverSocket!.write(JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/list',
                id: '_proxy_tools_list'
            }) + '\n');
        }
    });

    serverSocket.on('data', (data) => {
        serverBuffer += data.toString();

        const lines = serverBuffer.split('\n');
        serverBuffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const msg = JSON.parse(line);
                    if (msg.id === '_proxy_tools_list' && msg.result?.tools) {
                        cachedTools = msg.result.tools;
                        console.error(`[Proxy] Cache: ${cachedTools.length} outils`);
                        continue;
                    }
                } catch {}

                process.stdout.write(line + '\n');
            }
        }
    });

    serverSocket.on('error', (err) => {
        if ((err as any).code !== 'ECONNREFUSED') {
            console.error(`[Proxy] Erreur: ${err.message}`);
        }
        isConnected = false;
    });

    serverSocket.on('close', () => {
        if (isConnected) {
            console.error('[Proxy] Connexion perdue, reconnexion...');
        }
        isConnected = false;
        serverSocket = null;
        setTimeout(connectToServer, RECONNECT_DELAY);
    });
}

/**
 * Traite les messages de Claude Desktop
 */
function handleStdinMessage(line: string): void {
    if (!line.trim()) return;

    try {
        const message = JSON.parse(line);
        const localResponse = handleLocalRequest(message);

        if (localResponse === null) {
            sendToServer(line);
            return;
        }

        if (localResponse !== undefined) {
            process.stdout.write(JSON.stringify(localResponse) + '\n');
            if (isConnected && serverSocket) {
                serverSocket.write(line + '\n');
            }
            return;
        }

        sendToServer(line);
    } catch {
        sendToServer(line);
    }
}

// === Main ===

console.error('[Proxy] Démarrage...');

const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
});

rl.on('line', handleStdinMessage);
rl.on('close', () => {
    if (serverSocket) serverSocket.destroy();
    process.exit(0);
});

connectToServer();

process.on('SIGINT', () => {
    if (serverSocket) serverSocket.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (serverSocket) serverSocket.destroy();
    process.exit(0);
});
