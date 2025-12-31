import { initBotManager, getBotManager } from './bot_manager';
import { startMcpServer } from './mcp_server';

async function main() {
    console.error('--- MCPCraft - Démarrage ---');

    // 1. Initialiser le BotManager
    const manager = initBotManager({
        host: 'localhost',
        port: 54321,
        username: 'MCPBot',
        version: '1.21.1'
    });

    // 2. Connecter le bot
    await manager.initBot();

    // 3. Démarrer le serveur MCP
    startMcpServer(() => getBotManager().getBot());

    // Gestion de l'arrêt propre
    process.on('SIGINT', async () => {
        console.error('\n[Main] Arrêt demandé...');
        await manager.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.error('\n[Main] Arrêt demandé...');
        await manager.shutdown();
        process.exit(0);
    });
}

main().catch(console.error);
