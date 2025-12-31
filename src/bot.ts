import mineflayer from 'mineflayer';
import { getBotManager } from './bot_manager';

// Configuration exportée pour rétrocompatibilité
export const BOT_CONFIG = {
    host: 'localhost',
    port: 54321,
    username: 'MCPBot',
    version: '1.21.1'
};

/**
 * @deprecated Utilisez getBotManager().getBot() à la place
 */
export function getBot(): mineflayer.Bot {
    return getBotManager().getBot();
}

/**
 * @deprecated Utilisez initBotManager().initBot() à la place
 */
export async function initBot(): Promise<mineflayer.Bot> {
    return await getBotManager().initBot();
}
