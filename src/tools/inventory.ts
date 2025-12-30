import {
	Bot
} from 'mineflayer';

export const inventoryTool = {
    name: 'check_inventory',
    description: 'Lists the items currently in the bot\'s inventory.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (bot: Bot) => {
        const items = bot.inventory.items();
        if (items.length === 0) {
            return { content: [{ type: 'text', text: 'Mon inventaire est vide.' }] };
        }
        const report = items.map(item => `${item.count}x ${item.name}`).join(', ');
        return { content: [{ type: 'text', text: `Inventaire: ${report}` }] };
    }
};
