import {
    Bot
} from 'mineflayer';
import minecraftData from 'minecraft-data';

export const dropTool = {
    name: 'drop_item',
    description: 'Drops a specific item or all items from the inventory.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Name of the item to drop. If "all", drops everything.'
            },
            count: {
                type: 'number',
                description: 'Quantity to drop. If omitted, drops all of that item.'
            }
        },
        required: ['name']
    },
    handler: async (bot: Bot, args: {
        name: string,
        count ? : number
    }) => {
        const mcData = minecraftData(bot.version);

        if (args.name === 'all') {
            const items = bot.inventory.items();
            for (const item of items) {
                await bot.tossStack(item);
            }
            return {
                content: [{
                    type: 'text',
                    text: 'J\'ai tout lâché.'
                }]
            };
        }

        const item = mcData.itemsByName[args.name];
        if (!item) return {
            content: [{
                type: 'text',
                text: `Item inconnu: ${args.name}`
            }]
        };

        const inventoryItem = bot.inventory.findInventoryItem(item.id, null, false);
        if (!inventoryItem) return {
            content: [{
                type: 'text',
                text: `Je n'ai pas de ${args.name}.`
            }]
        };

        const countToDrop = args.count || inventoryItem.count;
        try {
            await bot.toss(item.id, null, countToDrop);
            return {
                content: [{
                    type: 'text',
                    text: `J'ai lâché ${countToDrop}x ${args.name}.`
                }]
            };
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: `Erreur en lâchant l'objet: ${err}`
                }]
            };
        }
    }
};
