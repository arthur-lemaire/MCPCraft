handler: async (bot: Bot, args: { name: string, count?: number }) => {
        const mcData = minecraftData(bot.version);
        const targetItemName = args.name;
        const targetCount = args.count || 1;

        // --- PROTECTION CONTRE LES BOUCLES ---
        // On garde une trace des IDs qu'on est en train d'essayer de crafter
        // Si on retombe sur un ID déjà dans la liste, on arrête tout.
        
        async function craftRecursive(name: string, count: number, activeCrafts: Set<number> = new Set()): Promise<boolean> {
            const itemData = mcData.itemsByName[name];
            if (!itemData) {
                bot.chat(`❓ Item inconnu : ${name}`);
                return false;
            }

            // 1. CIRCUIT BREAKER (Arrêt d'urgence)
            if (activeCrafts.has(itemData.id)) {
                console.warn(`⚠️ Cycle infini détecté pour ${name}. Annulation.`);
                return false; 
            }
            // On ajoute l'item actuel à la liste des "en cours"
            const newActiveCrafts = new Set(activeCrafts);
            newActiveCrafts.add(itemData.id);

            // A. Ai-je déjà l'item ?
            const currentCount = bot.inventory.count(itemData.id, null);
            if (currentCount >= count) return true;

            const needed = count - currentCount;

            // B. Trouver une recette
            const recipes = bot.recipesAll(itemData.id, null, false);
            if (recipes.length === 0) return false;

            // Optimisation : On cherche d'abord les recettes qui NE DEMANDENT PAS de table
            // pour éviter de déclencher ensureCraftingTable inutilement.
            recipes.sort((a, b) => (a.requiresTable === b.requiresTable ? 0 : a.requiresTable ? 1 : -1));
            
            const recipe = recipes[0];

            // C. Vérifier/Crafter les ingrédients
            for (const ingredient of recipe.delta) {
                if (ingredient.count > 0) {
                    const ingredientName = mcData.items[ingredient.id].name;
                    // Calcul savant pour savoir combien il en faut
                    const requiredForBatch = Math.abs(ingredient.count) * Math.ceil(needed / recipe.result.count);
                    
                    // APPEL RÉCURSIF avec le set de protection
                    const hasIngredient = await craftRecursive(ingredientName, requiredForBatch, newActiveCrafts);
                    
                    if (!hasIngredient) {
                        // Si c'est du bois ou de la pierre qu'on ne peut pas crafter, on s'arrête là.
                        return false; 
                    }
                }
            }

            // D. Gestion de la Table de Craft
            if (recipe.requiresTable) {
                // PROTECTION CRITIQUE : Si on essaie de crafter une table de craft... 
                // on ne doit pas demander "ensureCraftingTable", sinon ça boucle.
                if (name === 'crafting_table') {
                    // Une table de craft ne devrait jamais nécessiter une table de craft (c'est du 2x2)
                    // Si on est ici, c'est que mineflayer renvoie une recette bizarre ou qu'on force le 3x3.
                    // On force l'utilisation de l'inventaire.
                } else {
                    const tableReady = await ensureCraftingTable(newActiveCrafts);
                    if (!tableReady) return false;
                }
            }

            // E. Exécution
            const tableBlock = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
            const feasibleRecipes = bot.recipesFor(itemData.id, null, needed, tableBlock); // null/tableBlock
            
            if (feasibleRecipes.length === 0) return false;

            try {
                await bot.craft(feasibleRecipes[0], needed, tableBlock || undefined);
                return true;
            } catch (error) {
                console.error(`Erreur craft ${name}:`, error);
                return false;
            }
        }

        // Fonction helper pour la table, mise à jour pour accepter le Set de protection
        async function ensureCraftingTable(activeCrafts: Set<number>): Promise<boolean> {
            const tableBlock = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
            if (tableBlock) return true;

            const hasTableItem = bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null);
            if (!hasTableItem) {
                // On tente de crafter la table, en passant le Set pour dire "Attention, on est déjà dans une boucle"
                const success = await craftRecursive('crafting_table', 1, activeCrafts);
                if (!success) return false;
            }

            // Pose de la table (Code simplifié)
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
        
        // On lance avec un Set vide
        const success = await craftRecursive(targetItemName, targetCount, new Set());

        if (success) {
            // Cleanup : on récupère la table si on en voit une proche pour ne pas la perdre
            const table = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
            if (table) await bot.dig(table);
            
            return { content: [{ type: 'text', text: `✅ Succès : ${targetItemName} crafté.` }] };
        } else {
            return { content: [{ type: 'text', text: `❌ Échec : Impossible de crafter ${targetItemName} (Manque ressources ou erreur logique).` }] };
        }
    }