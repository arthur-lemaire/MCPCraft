
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';

export const buildTool = {
    name: 'place_block',
    description: 'Places a block from inventory nearby, searching for a valid spot.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Name of the block to place (e.g., crafting_table)' }
        },
        required: ['name']
    },
    handler: async (bot: Bot, args: { name: string }) => {
        const mcData = minecraftData(bot.version);
        const item = mcData.itemsByName[args.name];
        
        if (!item) return { content: [{ type: 'text', text: `Item inconnu: ${args.name}` }] };
        
        if (!bot.inventory.findInventoryItem(item.id, null, false)) {
            return { content: [{ type: 'text', text: `Je n'ai pas de ${args.name} dans mon inventaire.` }] };
        }

        await bot.equip(item.id, 'hand');
        
        const botPos = bot.entity.position.floored();
        
        // Algorithme de recherche en spirale (rayon 2)
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                // On cherche un bloc solide au sol
                const groundPos = botPos.offset(x, -1, z);
                const groundBlock = bot.blockAt(groundPos);
                
                // Et de l'air au-dessus
                const placePos = botPos.offset(x, 0, z);
                const airBlock = bot.blockAt(placePos);

                if (groundBlock && groundBlock.type !== 0 && airBlock && airBlock.type === 0) {
                    try {
                        // On place sur le bloc du sol, face du haut (0, 1, 0)
                        await bot.placeBlock(groundBlock, new Vec3(0, 1, 0));
                        return { content: [{ type: 'text', text: `J'ai posé ${args.name} à ${placePos}.` }] };
                    } catch (err) {
                        // Si ça échoue (ex: entité qui bloque), on continue la recherche
                        continue;
                    }
                }
            }
        }

        return { content: [{ type: 'text', text: `Impossible de trouver un endroit libre pour poser ${args.name}.` }] };
    }
};
