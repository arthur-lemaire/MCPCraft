
import { Bot } from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { goals } = pkg;
import minecraftData from 'minecraft-data';

export const collectTool = {
    name: 'collect_block',
    description: 'Finds and mines a specific block type nearby.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Name of the block (e.g., oak_log, stone)' },
            count: { type: 'number', description: 'How many blocks to collect (default 1)' }
        },
        required: ['name']
    },
    handler: async (bot: Bot, args: { name: string, count?: number }) => {
        const mcData = minecraftData(bot.version);
        const blockName = args.name;
        const count = args.count || 1;
        
        const blockType = mcData.blocksByName[blockName];
        if (!blockType) {
            return { content: [{ type: 'text', text: `Bloc inconnu: ${blockName}` }] };
        }

        const blocks = bot.findBlocks({
            matching: blockType.id,
            maxDistance: 64,
            count: count
        });

        if (blocks.length === 0) {
            return { content: [{ type: 'text', text: `Aucun bloc de type ${blockName} trouvé à proximité.` }] };
        }

        bot.chat(`Je vais miner ${blocks.length} ${blockName}.`);

        for (const pos of blocks) {
            const block = bot.blockAt(pos);
            if (!block) continue;

            try {
                await bot.pathfinder.goto(new goals.GoalBlock(pos.x, pos.y, pos.z));
                await bot.dig(block);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                bot.chat(`Problème en minant: ${msg}`);
                // On continue avec le prochain bloc
            }
        }

        return { content: [{ type: 'text', text: `Opération de minage terminée pour ${blockName}.` }] };
    }
};
