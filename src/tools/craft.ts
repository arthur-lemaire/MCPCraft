import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';

// On exporte une constante (objet) qui contient TOUTE la définition de l'outil
export const craftTool = {
    name: 'craft_item', // <--- C'est cette propriété "name" qui manquait et faisait planter !
    description: 'Crafts an item, recursively gathering ingredients and placing tables if needed.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Name of the item to craft (ex: iron_pickaxe)' },
            count: { type: 'number', description: 'Quantity (default 1)' }
        },
        required: ['name']
    },
    handler: async (bot: Bot, args: { name: string, count?: number }) => {
        const mcData = minecraftData(bot.version);
        const targetItemName = args.name;
        const targetCount = args.count || 1;

        // --- PROTECTION CONTRE LES BOUCLES ---
        async function craftRecursive(name: string, count: number, activeCrafts: Set<number> = new Set()): Promise<boolean> {
            const itemData = mcData.itemsByName[name];
            if (!itemData) {
                bot.chat(`❓ Item inconnu : ${name}`);
                return false;
            }

            // 1. CIRCUIT BREAKER
            if (activeCrafts.has(itemData.id)) {
                console.warn(`⚠️ Cycle infini détecté pour ${name}. Annulation.`);
                return false; 
            }
            const newActiveCrafts = new Set(activeCrafts);
            newActiveCrafts.add(itemData.id);

            // A. Ai-je déjà l'item ?
            const currentCount = bot.inventory.count(itemData.id, null);
            if (currentCount >= count) return true;

            const needed = count - currentCount;

            // B. Trouver une recette
            // Utilisation de recipesAll pour la théorie
            const recipes = bot.recipesAll(itemData.id, null, false);
            if (recipes.length === 0) return false;

            // Optimisation : Recettes sans table en priorité
            recipes.sort((a, b) => (a.requiresTable === b.requiresTable ? 0 : a.requiresTable ? 1 : -1));
            const recipe = recipes[0];

            // C. Vérifier/Crafter les ingrédients
            for (const ingredient of recipe.delta) {
                if (ingredient.count > 0) {
                    const ingredientName = mcData.items[ingredient.id].name;
                    const requiredForBatch = Math.abs(ingredient.count) * Math.ceil(needed / recipe.result.count);
                    
                    const hasIngredient = await craftRecursive(ingredientName, requiredForBatch, newActiveCrafts);
                    if (!hasIngredient) return false; 
                }
            }

            // D. Gestion de la Table de Craft
            if (recipe.requiresTable) {
                if (name === 'crafting_table') {
                    // Prevent loops for crafting table itself
                } else {
                    const tableReady = await ensureCraftingTable(newActiveCrafts);
                    if (!tableReady) return false;
                }
            }

            // E. Exécution
            const tableBlock = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
            const feasibleRecipes = bot.recipesFor(itemData.id, null, needed, tableBlock);
            
            if (feasibleRecipes.length === 0) return false;

            try {
                await bot.craft(feasibleRecipes[0], needed, tableBlock || undefined);
                return true;
            } catch (error) {
                console.error(`Erreur craft ${name}:`, error);
                return false;
            }
        }

        // Fonction helper pour la table
        async function ensureCraftingTable(activeCrafts: Set<number>): Promise<boolean> {
            const tableBlock = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
            if (tableBlock) return true;

            const hasTableItem = bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null);
            if (!hasTableItem) {
                const success = await craftRecursive('crafting_table', 1, activeCrafts);
                if (!success) return false;
            }

            const p = bot.entity.position;
            const placePos = p.offset(1, 0, 0); 
            const tableItem = bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null);
            
            if(tableItem) {
                await bot.equip(tableItem, 'hand');
                const refBlock = bot.blockAt(placePos.offset(0, -1, 0));
                if(refBlock && refBlock.name !== 'air') {
                    try {
                        await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                        return true;
                    } catch (e) { return false; }
                }
            }
            return false;
        }

        // --- LANCEMENT ---
        bot.chat(`⚙️ Crafting ${targetCount} ${targetItemName}...`);
        const success = await craftRecursive(targetItemName, targetCount, new Set());

        if (success) {
            const table = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
            if (table) await bot.dig(table);
            return { content: [{ type: 'text', text: `✅ Succès : ${targetItemName} crafté.` }] };
        } else {
            return { content: [{ type: 'text', text: `❌ Échec : Impossible de crafter ${targetItemName}.` }] };
        }
    }
};