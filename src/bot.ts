
import mineflayer from 'mineflayer';
import { pathfinder } from 'mineflayer-pathfinder';
// import { viewer as prismarineViewer } from 'prismarine-viewer';
// import inventoryViewer from 'mineflayer-web-inventory';

// Configuration centralisée
export const BOT_CONFIG = {
    host: 'localhost',
    port: 54321,
    username: 'GeminiBot_v2',
    version: '1.21.1'
};

let botInstance: mineflayer.Bot | null = null;

export function getBot(): mineflayer.Bot {
    if (!botInstance) {
        throw new Error("Bot not initialized. Call initBot() first.");
    }
    return botInstance;
}

export function initBot(): mineflayer.Bot {
    console.error(`[Bot] Initializing connection to ${BOT_CONFIG.host}:${BOT_CONFIG.port}...`);
    
    botInstance = mineflayer.createBot(BOT_CONFIG);

    // Load plugins
    botInstance.loadPlugin(pathfinder);
    // Temporarily disabled to debug EADDRINUSE error
    // botInstance.loadPlugin(inventoryViewer, { port: 5002 });

    // Event listeners
    botInstance.on('spawn', () => {
        console.error('[Bot] Spawned and ready.');
        botInstance?.chat('Je suis prêt ! (Architecture v2)');

        // Start the viewer - Temporarily disabled
        // if (botInstance) {
        //     prismarineViewer(botInstance, {
        //         viewDistance: 6,
        //         firstPerson: false,
        //         port: 5001,
        //     });
        //     console.error('[Viewer] Visualizer running on http://localhost:5001');
        // }
    });

    botInstance.on('kicked', (reason) => console.error(`[Bot] Kicked: ${reason}`));
    botInstance.on('error', (err) => console.error(`[Bot] Error: ${err}`));
    botInstance.on('end', () => {
        console.error('[Bot] Disconnected. Attempting reconnect in 5s...');
        botInstance = null;
        setTimeout(initBot, 5000);
    });

    return botInstance;
}
