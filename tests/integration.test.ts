/**
 * Test d'intégration - De zéro au Nether
 * Simule le parcours complet du bot pour atteindre le Nether
 */

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface MockInventoryItem {
    name: string;
    count: number;
}

class MockBot {
    version = '1.20.1';
    inventory: MockInventoryItem[] = [];
    chatLog: string[] = [];
    craftLog: string[] = [];
    dimension: 'overworld' | 'nether' | 'end' = 'overworld';
    portalBuilt = false;

    // Simule l'inventaire
    addItem(name: string, count: number) {
        const existing = this.inventory.find(i => i.name === name);
        if (existing) {
            existing.count += count;
        } else {
            this.inventory.push({ name, count });
        }
    }

    removeItem(name: string, count: number): boolean {
        const existing = this.inventory.find(i => i.name === name);
        if (!existing || existing.count < count) return false;
        existing.count -= count;
        if (existing.count === 0) {
            this.inventory = this.inventory.filter(i => i.name !== name);
        }
        return true;
    }

    countItem(name: string): number {
        return this.inventory.find(i => i.name === name)?.count || 0;
    }

    chat(msg: string) {
        this.chatLog.push(msg);
        console.log(`[Bot Chat] ${msg}`);
    }

    // Toutes les recettes de craft
    getRecipe(itemName: string): { ingredients: { name: string; count: number }[]; result: number; requiresTable: boolean } | null {
        const recipes: Record<string, { ingredients: { name: string; count: number }[]; result: number; requiresTable: boolean }> = {
            // Basic
            'oak_planks': { ingredients: [{ name: 'oak_log', count: 1 }], result: 4, requiresTable: false },
            'stick': { ingredients: [{ name: 'oak_planks', count: 2 }], result: 4, requiresTable: false },
            'crafting_table': { ingredients: [{ name: 'oak_planks', count: 4 }], result: 1, requiresTable: false },
            'furnace': { ingredients: [{ name: 'cobblestone', count: 8 }], result: 1, requiresTable: true },
            // Tools
            'wooden_pickaxe': { ingredients: [{ name: 'oak_planks', count: 3 }, { name: 'stick', count: 2 }], result: 1, requiresTable: true },
            'stone_pickaxe': { ingredients: [{ name: 'cobblestone', count: 3 }, { name: 'stick', count: 2 }], result: 1, requiresTable: true },
            'iron_pickaxe': { ingredients: [{ name: 'iron_ingot', count: 3 }, { name: 'stick', count: 2 }], result: 1, requiresTable: true },
            'diamond_pickaxe': { ingredients: [{ name: 'diamond', count: 3 }, { name: 'stick', count: 2 }], result: 1, requiresTable: true },
            // Bucket
            'bucket': { ingredients: [{ name: 'iron_ingot', count: 3 }], result: 1, requiresTable: true },
            // Nether stuff
            'flint_and_steel': { ingredients: [{ name: 'iron_ingot', count: 1 }, { name: 'flint', count: 1 }], result: 1, requiresTable: false },
        };
        return recipes[itemName] || null;
    }

    // Simule le craft
    craft(itemName: string, count: number = 1): boolean {
        const recipe = this.getRecipe(itemName);
        if (!recipe) {
            console.log(`[Craft] No recipe for ${itemName}`);
            return false;
        }

        if (recipe.requiresTable && this.countItem('crafting_table') === 0) {
            console.log(`[Craft] Need crafting_table for ${itemName}`);
            return false;
        }

        for (const ing of recipe.ingredients) {
            const needed = ing.count * count;
            if (this.countItem(ing.name) < needed) {
                console.log(`[Craft] Missing ${ing.name}: need ${needed}, have ${this.countItem(ing.name)}`);
                return false;
            }
        }

        for (const ing of recipe.ingredients) {
            this.removeItem(ing.name, ing.count * count);
        }

        this.addItem(itemName, recipe.result * count);
        this.craftLog.push(`${count}x ${itemName}`);
        console.log(`[Craft] ✓ ${count}x ${itemName} (now have ${this.countItem(itemName)})`);
        return true;
    }

    // Simule le minage avec vérification de pioche
    mine(blockName: string, count: number = 1): boolean {
        const drops: Record<string, { drop: string; requires?: string[] }> = {
            'oak_log': { drop: 'oak_log' },
            'stone': { drop: 'cobblestone', requires: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'] },
            'coal_ore': { drop: 'coal', requires: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'] },
            'iron_ore': { drop: 'raw_iron', requires: ['stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'] },
            'diamond_ore': { drop: 'diamond', requires: ['iron_pickaxe', 'diamond_pickaxe'] },
            'obsidian': { drop: 'obsidian', requires: ['diamond_pickaxe'] },
            'gravel': { drop: 'gravel' }, // Can drop flint randomly
            'netherrack': { drop: 'netherrack', requires: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'] },
            'nether_gold_ore': { drop: 'gold_nugget', requires: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'] },
            'ancient_debris': { drop: 'ancient_debris', requires: ['diamond_pickaxe'] },
        };

        const blockInfo = drops[blockName];
        if (!blockInfo) {
            console.log(`[Mine] Unknown block: ${blockName}`);
            return false;
        }

        // Check tool requirement
        if (blockInfo.requires) {
            const hasTool = blockInfo.requires.some(tool => this.countItem(tool) > 0);
            if (!hasTool) {
                console.log(`[Mine] Need one of: ${blockInfo.requires.join(', ')} to mine ${blockName}`);
                return false;
            }
        }

        // Special case: gravel can drop flint (30% chance simulated)
        if (blockName === 'gravel') {
            const flintDrops = Math.floor(count * 0.3);
            if (flintDrops > 0) {
                this.addItem('flint', flintDrops);
                console.log(`[Mine] Got ${flintDrops}x flint from gravel`);
            }
            this.addItem('gravel', count - flintDrops);
            console.log(`[Mine] Got ${count - flintDrops}x gravel`);
            return true;
        }

        this.addItem(blockInfo.drop, count);
        console.log(`[Mine] Got ${count}x ${blockInfo.drop}`);
        return true;
    }

    // Simule la fonte
    smelt(itemName: string, count: number = 1): boolean {
        const smeltResults: Record<string, string> = {
            'raw_iron': 'iron_ingot',
            'raw_gold': 'gold_ingot',
            'raw_copper': 'copper_ingot',
            'ancient_debris': 'netherite_scrap',
        };

        const result = smeltResults[itemName];
        if (!result) {
            console.log(`[Smelt] Cannot smelt: ${itemName}`);
            return false;
        }

        if (this.countItem('furnace') === 0) {
            console.log(`[Smelt] Need furnace`);
            return false;
        }

        const fuelNeeded = Math.ceil(count / 8);
        if (this.countItem('coal') < fuelNeeded && this.countItem('oak_planks') < count) {
            console.log(`[Smelt] Need fuel`);
            return false;
        }

        if (this.countItem(itemName) < count) {
            console.log(`[Smelt] Not enough ${itemName}`);
            return false;
        }

        this.removeItem(itemName, count);
        if (this.countItem('coal') >= fuelNeeded) {
            this.removeItem('coal', fuelNeeded);
        } else {
            this.removeItem('oak_planks', count);
        }
        this.addItem(result, count);
        console.log(`[Smelt] ✓ Got ${count}x ${result}`);
        return true;
    }

    // Créer de l'obsidienne avec water bucket sur lava
    createObsidian(count: number): boolean {
        if (this.countItem('bucket') === 0 && this.countItem('water_bucket') === 0) {
            console.log(`[Obsidian] Need bucket`);
            return false;
        }
        // Simuler: on assume qu'on trouve de la lave et de l'eau
        this.addItem('obsidian', count);
        console.log(`[Obsidian] Created ${count}x obsidian (water on lava)`);
        return true;
    }

    // Construire et allumer le portail
    buildNetherPortal(): boolean {
        if (this.countItem('obsidian') < 10) {
            console.log(`[Portal] Need 10 obsidian (have ${this.countItem('obsidian')})`);
            return false;
        }
        if (this.countItem('flint_and_steel') === 0) {
            console.log(`[Portal] Need flint_and_steel`);
            return false;
        }

        this.removeItem('obsidian', 10);
        this.portalBuilt = true;
        console.log(`[Portal] ✓ Nether portal built and lit!`);
        return true;
    }

    // Entrer dans le Nether
    enterNether(): boolean {
        if (!this.portalBuilt) {
            console.log(`[Portal] No portal built`);
            return false;
        }
        this.dimension = 'nether';
        console.log(`[Portal] ✓ Entered the Nether!`);
        return true;
    }

    printInventory() {
        console.log('\n=== INVENTORY ===');
        if (this.inventory.length === 0) {
            console.log('  (empty)');
        }
        for (const item of this.inventory.sort((a, b) => b.count - a.count)) {
            console.log(`  ${item.count}x ${item.name}`);
        }
        console.log(`=== Dimension: ${this.dimension.toUpperCase()} ===\n`);
    }
}

// ============ TEST COMPLET: De zéro au Nether ============
async function testZeroToNether() {
    console.log('\n🎮 TEST: De zéro au NETHER\n');
    console.log('='.repeat(60));

    const bot = new MockBot();
    let step = 0;

    function nextStep(title: string) {
        step++;
        console.log(`\n📍 ÉTAPE ${step}: ${title}`);
    }

    // ===== PHASE 1: OUTILS DE BASE =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 1: OUTILS DE BASE');
    console.log('═'.repeat(60));

    nextStep('Couper des arbres');
    bot.mine('oak_log', 20);

    nextStep('Crafter des planches');
    bot.craft('oak_planks', 5); // 20 planks

    nextStep('Crafter crafting_table');
    bot.craft('crafting_table', 1);

    nextStep('Crafter des sticks');
    bot.craft('stick', 2); // 8 sticks

    nextStep('Crafter wooden_pickaxe');
    if (!bot.craft('wooden_pickaxe', 1)) return fail('wooden_pickaxe');

    bot.printInventory();

    // ===== PHASE 2: STONE AGE =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 2: STONE AGE');
    console.log('═'.repeat(60));

    nextStep('Miner stone et coal');
    bot.mine('stone', 30);
    bot.mine('coal_ore', 16);

    nextStep('Crafter stone_pickaxe');
    if (!bot.craft('stone_pickaxe', 1)) return fail('stone_pickaxe');

    nextStep('Crafter furnace');
    if (!bot.craft('furnace', 1)) return fail('furnace');

    bot.printInventory();

    // ===== PHASE 3: IRON AGE =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 3: IRON AGE');
    console.log('═'.repeat(60));

    nextStep('Miner iron ore');
    bot.mine('iron_ore', 12);

    nextStep('Fondre le fer');
    if (!bot.smelt('raw_iron', 12)) return fail('smelt iron');

    nextStep('Crafter iron_pickaxe');
    bot.craft('stick', 1);
    if (!bot.craft('iron_pickaxe', 1)) return fail('iron_pickaxe');

    nextStep('Crafter bucket');
    if (!bot.craft('bucket', 1)) return fail('bucket');

    bot.printInventory();

    // ===== PHASE 4: DIAMOND AGE =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 4: DIAMOND AGE');
    console.log('═'.repeat(60));

    nextStep('Miner diamonds');
    bot.mine('diamond_ore', 3);

    nextStep('Crafter diamond_pickaxe');
    bot.craft('stick', 1);
    if (!bot.craft('diamond_pickaxe', 1)) return fail('diamond_pickaxe');

    bot.printInventory();

    // ===== PHASE 5: PRÉPARATION NETHER =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 5: PRÉPARATION NETHER');
    console.log('═'.repeat(60));

    nextStep('Obtenir obsidian');
    // Méthode 1: Miner avec diamond pickaxe
    bot.mine('obsidian', 10);
    // OU Méthode 2: Créer avec water bucket (alternatif)
    // bot.createObsidian(10);

    nextStep('Obtenir flint (miner gravel)');
    bot.mine('gravel', 10); // ~3 flint

    nextStep('Crafter flint_and_steel');
    if (!bot.craft('flint_and_steel', 1)) return fail('flint_and_steel');

    bot.printInventory();

    // ===== PHASE 6: NETHER =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 6: NETHER PORTAL');
    console.log('═'.repeat(60));

    nextStep('Construire le portail');
    if (!bot.buildNetherPortal()) return fail('nether portal');

    nextStep('Entrer dans le Nether');
    if (!bot.enterNether()) return fail('enter nether');

    bot.printInventory();

    // ===== PHASE 7: EXPLORATION NETHER =====
    console.log('\n' + '═'.repeat(60));
    console.log('   PHASE 7: EXPLORATION NETHER');
    console.log('═'.repeat(60));

    nextStep('Miner netherrack');
    bot.mine('netherrack', 20);

    nextStep('Trouver ancient debris');
    bot.mine('ancient_debris', 4);

    nextStep('Fondre netherite scrap');
    if (!bot.smelt('ancient_debris', 4)) return fail('smelt ancient_debris');

    bot.printInventory();

    // ===== RÉSULTAT =====
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCÈS! Le bot est dans le Nether!');
    console.log('='.repeat(60));

    console.log('\n📋 Résumé des crafts:');
    for (const craft of bot.craftLog) {
        console.log(`  ✓ ${craft}`);
    }

    console.log(`\n📊 Statistiques:`);
    console.log(`  - Étapes complétées: ${step}`);
    console.log(`  - Items craftés: ${bot.craftLog.length}`);
    console.log(`  - Dimension finale: ${bot.dimension}`);

    return true;

    function fail(item: string): boolean {
        console.log(`\n❌ ÉCHEC à l'étape ${step}: Impossible de créer/faire ${item}`);
        bot.printInventory();
        return false;
    }
}

// Run test
testZeroToNether().then(success => {
    if (success) {
        console.log('\n🎉 Test passé avec succès!\n');
        process.exit(0);
    } else {
        console.log('\n💥 Test échoué!\n');
        process.exit(1);
    }
}).catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
