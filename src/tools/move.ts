
import { Bot } from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { goals } = pkg;

export const moveTool = {
    name: 'move_to',
    description: 'Moves the bot to a player or specific coordinates.',
    inputSchema: {
        type: 'object',
        properties: {
            target: { type: 'string', description: "Player name or 'x,y,z'" }
        },
        required: ['target']
    },
    handler: async (bot: Bot, args: { target: string }) => {
        const { target } = args;

        // Target is a player name
        const player = bot.players[target]?.entity;
        if (player) {
            bot.chat(`En route vers ${target}...`);
            try {
                await bot.pathfinder.goto(new goals.GoalNear(player.position.x, player.position.y, player.position.z, 1));
                return { content: [{ type: 'text', text: `Arrivé près de ${target}.` }] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: 'text', text: `Erreur de déplacement: ${msg}` }] };
            }
        }

        // Target is coordinates (e.g., "100,64,-200")
        const coords = target.split(',').map(Number);
        if (coords.length === 3 && !coords.some(isNaN)) {
            bot.chat(`En route vers ${coords.join(', ')}...`);
            try {
                await bot.pathfinder.goto(new goals.GoalBlock(coords[0], coords[1], coords[2]));
                return { content: [{ type: 'text', text: `Arrivé aux coordonnées ${target}.` }] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: 'text', text: `Erreur de déplacement: ${msg}` }] };
            }
        }

        return { content: [{ type: 'text', text: `Cible inconnue ou invalide: ${target}` }] };
    }
};
