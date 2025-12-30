
import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';

export const smeltTool = {
    name: 'smelt_item',
    description: 'Smelts an item in a furnace nearby.',
    inputSchema: {
        type: 'object',
        properties: {
            itemName: { type: 'string', description: 'Item to smelt (e.g., raw_iron)' },
            fuelName: { type: 'string', description: 'Fuel to use (e.g., coal, oak_planks)' },
            count: { type: 'number', description: 'Amount to smelt' }
        },
        required: ['itemName', 'fuelName']
    },
    handler: async (bot: Bot, args: { itemName: string, fuelName: string, count?: number }) => {
        const mcData = minecraftData(bot.version);
        const item = mcData.itemsByName[args.itemName];
        const fuel = mcData.itemsByName[args.fuelName];
        const count = args.count || 1;

        if (!item || !fuel) return { content: [{ type: 'text', text: 'Item ou fuel inconnu.' }] };

        const furnaceBlock = bot.findBlock({
            matching: mcData.blocksByName.furnace.id,
            maxDistance: 4
        });

        if (!furnaceBlock) return { content: [{ type: 'text', text: 'Pas de four à proximité.' }] };

        try {
            const furnace = await bot.openFurnace(furnaceBlock);
            await furnace.putInput(item.id, null, count);
            await furnace.putFuel(fuel.id, null, count); // Simplified fuel logic
            
            bot.chat(`Cuisson de ${count} ${args.itemName} lancée...`);
            
            // Wait for smelting to finish (crude wait, could be improved with events)
            await new Promise(resolve => setTimeout(resolve, 10000 * count)); 
            
            await furnace.takeOutput();
            furnace.close();
            
            return { content: [{ type: 'text', text: `Cuisson de ${args.itemName} terminée !` }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `Erreur pendant la cuisson: ${err}` }] };
        }
    }
};
