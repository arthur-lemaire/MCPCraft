import mineflayer, { Bot } from 'mineflayer';
import { pathfinder } from 'mineflayer-pathfinder';

export interface BotConfig {
    host: string;
    port: number;
    username: string;
    version: string;
}

export type BotStatus = 'idle' | 'busy' | 'disconnected' | 'connecting';

export const DEFAULT_BOT_CONFIG: BotConfig = {
    host: 'localhost',
    port: 54321,
    username: 'MCPBot',
    version: '1.21.1'
};

export class BotManager {
    private bot: Bot | null = null;
    private status: BotStatus = 'disconnected';
    private config: BotConfig;

    constructor(config: Partial<BotConfig> = {}) {
        this.config = { ...DEFAULT_BOT_CONFIG, ...config };
    }

    /**
     * Initialise et connecte le bot
     */
    async initBot(): Promise<Bot> {
        console.error(`[BotManager] Connexion au serveur ${this.config.host}:${this.config.port}...`);
        this.status = 'connecting';

        return new Promise((resolve, reject) => {
            const bot = mineflayer.createBot({
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                version: this.config.version
            });

            bot.loadPlugin(pathfinder);

            bot.once('spawn', () => {
                console.error(`[BotManager] Bot ${this.config.username} connecté et prêt`);
                bot.chat(`${this.config.username} est prêt !`);
                this.bot = bot;
                this.status = 'idle';
                resolve(bot);
            });

            bot.on('kicked', (reason) => {
                console.error(`[BotManager] Bot kicked: ${reason}`);
                this.status = 'disconnected';
                this.scheduleReconnect();
            });

            bot.on('error', (err) => {
                console.error(`[BotManager] Erreur: ${err.message}`);
            });

            bot.on('end', () => {
                console.error(`[BotManager] Bot déconnecté`);
                this.status = 'disconnected';
                this.scheduleReconnect();
            });

            // Timeout de connexion
            setTimeout(() => {
                if (!this.bot) {
                    this.status = 'disconnected';
                    reject(new Error(`Timeout de connexion au serveur`));
                }
            }, 30000);
        });
    }

    /**
     * Programme une reconnexion automatique (max 3 tentatives)
     */
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;

    private scheduleReconnect(): void {
        if (this.status === 'disconnected' && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.error(`[BotManager] Reconnexion dans 5s... (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
                if (this.status === 'disconnected') {
                    this.initBot()
                        .then(() => {
                            this.reconnectAttempts = 0; // Reset on success
                        })
                        .catch(err => {
                            console.error('[BotManager] Échec reconnexion:', err.message);
                        });
                }
            }, 5000);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[BotManager] Abandon après 3 tentatives. Relancez manuellement.');
        }
    }

    /**
     * Récupère le bot (lève une erreur si non connecté)
     */
    getBot(): Bot {
        if (!this.bot) {
            throw new Error("Bot non connecté");
        }
        return this.bot;
    }

    /**
     * Vérifie si le bot est connecté
     */
    isConnected(): boolean {
        return this.bot !== null && this.status !== 'disconnected';
    }

    /**
     * Récupère le statut actuel
     */
    getStatus(): BotStatus {
        return this.status;
    }

    /**
     * Récupère la configuration
     */
    getConfig(): BotConfig {
        return this.config;
    }

    /**
     * Arrête proprement le bot
     */
    async shutdown(): Promise<void> {
        console.error('[BotManager] Arrêt...');
        if (this.bot) {
            this.bot.quit();
            this.bot = null;
        }
        this.status = 'disconnected';
        console.error('[BotManager] Arrêt terminé');
    }
}

// Instance globale
let botManagerInstance: BotManager | null = null;

export function getBotManager(): BotManager {
    if (!botManagerInstance) {
        throw new Error("BotManager non initialisé. Appelez initBotManager() d'abord.");
    }
    return botManagerInstance;
}

export function initBotManager(config?: Partial<BotConfig>): BotManager {
    if (botManagerInstance) {
        console.error('[BotManager] Instance existante, retour de l\'instance actuelle');
        return botManagerInstance;
    }
    botManagerInstance = new BotManager(config);
    return botManagerInstance;
}
