import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';

export const craftTool = {
    name: 'craft_item',
    description: 'Crafts an item. Will place a crafting table if needed.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Name of the item to craft (e.g., stick, wooden_pickaxe, crafting_table)' },
            count: { type: 'number', description: 'Quantity to craft (default 1)' }
        },
        required: ['name']
    },
    handler: async (bot: Bot, args: { name: string, count?: number }) => {
        const mcData = minecraftData(bot.version);
        const targetName = args.name;
        const targetCount = args.count ?? 1;
        const logs: string[] = [];

        function log(msg: string) {
            console.error(`[Craft] ${msg}`);
            logs.push(msg);
        }

        // Count items in inventory
        function countItem(itemName: string): number {
            const item = mcData.itemsByName[itemName];
            if (!item) return 0;
            return bot.inventory.count(item.id, null);
        }

        // Find crafting table block nearby
        function findCraftingTable() {
            return bot.findBlock({
                matching: mcData.blocksByName.crafting_table.id,
                maxDistance: 4
            });
        }

        // Place crafting table
        async function placeCraftingTable(): Promise<boolean> {
            const tableItem = bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null, false);
            if (!tableItem) {
                log('No crafting_table in inventory to place');
                return false;
            }

            await bot.equip(tableItem, 'hand');
            const pos = bot.entity.position.floored();

            const directions = [
                new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
                new Vec3(0, 0, 1), new Vec3(0, 0, -1)
            ];

            for (const dir of directions) {
                const placePos = pos.plus(dir);
                const ground = bot.blockAt(placePos.offset(0, -1, 0));
                const target = bot.blockAt(placePos);

                if (ground && ground.name !== 'air' && target && target.name === 'air') {
                    try {
                        await bot.placeBlock(ground, new Vec3(0, 1, 0));
                        await bot.waitForTicks(5);
                        log('Placed crafting_table');
                        return true;
                    } catch (e) {
                        continue;
                    }
                }
            }
            log('Could not find spot to place crafting_table');
            return false;
        }

        // Simple craft function - tries to craft directly
        async function simpleCraft(itemName: string, count: number, withTable: boolean): Promise<boolean> {
            const item = mcData.itemsByName[itemName];
            if (!item) {
                log(`Unknown item: ${itemName}`);
                return false;
            }

            const table = withTable ? findCraftingTable() : null;
            const recipes = bot.recipesFor(item.id, null, count, table);

            if (recipes.length === 0) {
                log(`No recipe found for ${itemName} (withTable=${withTable})`);
                return false;
            }

            try {
                await bot.craft(recipes[0], count, table ?? undefined);
                log(`Crafted ${count}x ${itemName}`);
                return true;
            } catch (e) {
                log(`Craft error for ${itemName}: ${e}`);
                return false;
            }
        }

        // Ensure we have a crafting table ready
        async function ensureCraftingTable(): Promise<boolean> {
            // Already nearby?
            if (findCraftingTable()) return true;

            // In inventory? Place it
            if (bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null, false)) {
                return await placeCraftingTable();
            }

            // Need to craft one - try without table first
            log('Crafting a crafting_table...');
            const crafted = await simpleCraft('crafting_table', 1, false);
            if (!crafted) {
                log('Failed to craft crafting_table');
                return false;
            }

            return await placeCraftingTable();
        }

        // Main craft logic
        async function doCraft(itemName: string, count: number): Promise<boolean> {
            const item = mcData.itemsByName[itemName];
            if (!item) {
                log(`Unknown item: ${itemName}`);
                return false;
            }

            // Already have enough?
            const have = countItem(itemName);
            if (have >= count) {
                log(`Already have ${have}x ${itemName}`);
                return true;
            }

            const needed = count - have;
            log(`Need to craft ${needed}x ${itemName} (have ${have})`);

            // Try without crafting table first
            let success = await simpleCraft(itemName, needed, false);
            if (success) return true;

            // Try with crafting table
            const tableReady = await ensureCraftingTable();
            if (!tableReady) {
                log('Cannot get crafting table ready');
                return false;
            }

            success = await simpleCraft(itemName, needed, true);
            return success;
        }

        // === MAIN ===
        bot.chat(`Crafting ${targetCount}x ${targetName}...`);

        const success = await doCraft(targetName, targetCount);

        // Cleanup: pick up table
        const table = findCraftingTable();
        if (table) {
            try {
                await bot.dig(table);
                await bot.waitForTicks(10);
                log('Picked up crafting_table');
            } catch { }
        }

        const finalCount = countItem(targetName);

        if (success) {
            return {
                content: [{
                    type: 'text',
                    text: `Crafted ${targetName}. Now have ${finalCount} in inventory.\nLog: ${logs.join(' -> ')}`
                }]
            };
        } else {
            return {
                content: [{
                    type: 'text',
                    text: `Failed to craft ${targetName}. Have ${finalCount} in inventory.\nLog: ${logs.join(' -> ')}`
                }]
            };
        }
    }
};
