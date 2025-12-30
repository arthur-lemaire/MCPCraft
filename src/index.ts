
import { initBot, getBot } from './bot';
import { startMcpServer } from './mcp_server';

async function main() {
    console.error('--- Démarrage de l architecture v2 ---');
    
    // 1. Démarrer le bot
    initBot();

    // 2. Démarrer le serveur MCP
    // On passe une fonction pour récupérer l instance courante du bot (pour gérer les reconnexions)
    startMcpServer(() => getBot());
}

main().catch(console.error);
