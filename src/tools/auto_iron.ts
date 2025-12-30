
import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { goals } from 'mineflayer-pathfinder';
import { collectTool } from './collect';
import { craftTool } from './craft';
import { buildTool } from './build';
import { smeltTool } from './smelt';

// Interface pour suivre l'état de la mission
interface MissionState {
    step: 'INIT' | 'WOOD' | 'STONE' | 'IRON_ORE' | 'SMELT' | 'CRAFT_FINAL';
    woodNeeded: number;
    stoneNeeded: number;
    ironNeeded: number;
}

export const autoIronTool = {
    name: 'auto_iron',
    description: 'Execute the full strategy to obtain an iron pickaxe from scratch.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (bot: Bot) => {
        const mcData = minecraftData(bot.version);
        const state: MissionState = {
            step: 'INIT',
            woodNeeded: 6, // 3 (pioche) + 3 (bâtons/table)
            stoneNeeded: 11, // 3 (pioche) + 8 (four)
            ironNeeded: 3
        };

        bot.chat('--- Démarrage du Protocole Âge du Fer ---');

        // --- PHASE 1 : BOIS (Data Analysis & Collection) ---
        bot.chat('[Phase 1] Analyse des besoins en bois...');
        // On a besoin de bois pour : 
        // 1. Table de craft (4 planches = 1 log)
        // 2. Pioche en bois (3 planches + 2 sticks = 3 logs approx)
        // 3. Pioche en pierre (2 sticks)
        // 4. Pioche en fer (2 sticks)
        // + Marge de sécurité
        
        await collectTool.handler(bot, { name: 'oak_log', count: 5 });
        bot.chat('[Phase 1] Bois acquis.');

        // --- PHASE 2 : PIERRE (Tool Tiering) ---
        bot.chat('[Phase 2] Montée en niveau technologique (Pierre)...');
        
        // 1. Craft Pioche Bois
        const craftWoodPick = await craftTool.handler(bot, { name: 'wooden_pickaxe' });
        if (craftWoodPick.content[0].text.includes('Échec')) {
            return { content: [{ type: 'text', text: 'Echec critique: Impossible de faire la pioche en bois.' }] };
        }

        // 2. Récolte Cobblestone
        await collectTool.handler(bot, { name: 'stone', count: 14 }); // 3 (pioche) + 8 (four) + 3 (marge)
        bot.chat('[Phase 2] Pierre acquise.');

        // 3. Craft Pioche Pierre
        await craftTool.handler(bot, { name: 'stone_pickaxe' });
        
        // 4. Craft Fourneau (Anticipation)
        await craftTool.handler(bot, { name: 'furnace' });
        
        bot.chat('[Phase 2] Outillage en pierre et fourneau prêts.');

        // --- PHASE 3 : FER (Resource Acquisition) ---
        bot.chat('[Phase 3] Recherche de minerai de fer et charbon...');
        
        // On cherche du fer
        await collectTool.handler(bot, { name: 'iron_ore', count: 3 });
        
        // On cherche du charbon (Fuel optimal selon mcData)
        await collectTool.handler(bot, { name: 'coal_ore', count: 1 });
        
        bot.chat('[Phase 3] Ressources brutes acquises.');

        // --- PHASE 4 : SMELTING (State Management) ---
        bot.chat('[Phase 4] Traitement métallurgique...');
        
        // 1. Poser le four
        // On cherche un endroit valide avec notre algorithme en spirale
        const placeFurnace = await buildTool.handler(bot, { name: 'furnace' });
        if (placeFurnace.content[0].text.includes('Impossible')) {
             return { content: [{ type: 'text', text: 'Echec: Impossible de poser le four.' }] };
        }

        // 2. Cuisson
        // On utilise le charbon miné
        await smeltTool.handler(bot, { itemName: 'raw_iron', fuelName: 'coal', count: 3 });
        // Note: Sur les versions récentes (1.17+), iron_ore donne raw_iron. 
        // Sur 1.21.1, c'est bien raw_iron qu'il faut cuire.
        // Si c'est une vieille version, c'est iron_ore. Je vais ajouter une vérif.
        
        const rawIron = bot.inventory.findInventoryItem(mcData.itemsByName.raw_iron.id, null, false);
        const oreIron = bot.inventory.findInventoryItem(mcData.itemsByName.iron_ore.id, null, false);
        const itemToSmelt = rawIron ? 'raw_iron' : 'iron_ore';

        // Petit fix si smeltTool n'a pas été appelé correctement ci-dessus à cause du nom
        await smeltTool.handler(bot, { itemName: itemToSmelt, fuelName: 'coal', count: 3 });

        bot.chat('[Phase 4] Lingots de fer obtenus.');

        // --- PHASE 5 : FINALISATION (Synthesis) ---
        bot.chat('[Phase 5] Assemblage final...');
        
        // On a besoin d'une table de craft. Si l'ancienne est loin, on en refait une.
        // craftTool le gère déjà récursivement, mais assurons-nous qu'elle est posée.
        
        const finalCraft = await craftTool.handler(bot, { name: 'iron_pickaxe' });
        
        if (finalCraft.content[0].text.includes('J\'ai crafté')) {
            return { content: [{ type: 'text', text: 'MISSION ACCOMPLIE : PIOCHE EN FER OBTENUE !' }] };
        } else {
            return { content: [{ type: 'text', text: 'Echec lors de l\'assemblage final.' }] };
        }
    }
};
