import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

// Blocks that are worth tracking individually with positions
const IMPORTANT_BLOCKS = new Set([
    // Ores
    'coal_ore', 'deepslate_coal_ore',
    'iron_ore', 'deepslate_iron_ore',
    'copper_ore', 'deepslate_copper_ore',
    'gold_ore', 'deepslate_gold_ore',
    'redstone_ore', 'deepslate_redstone_ore',
    'emerald_ore', 'deepslate_emerald_ore',
    'lapis_ore', 'deepslate_lapis_ore',
    'diamond_ore', 'deepslate_diamond_ore',
    'ancient_debris',
    // Functional blocks
    'crafting_table', 'furnace', 'blast_furnace', 'smoker',
    'chest', 'trapped_chest', 'barrel', 'ender_chest',
    'anvil', 'chipped_anvil', 'damaged_anvil',
    'enchanting_table', 'brewing_stand', 'grindstone', 'stonecutter',
    'smithing_table', 'cartography_table', 'loom',
    'bed', 'respawn_anchor',
    // Doors and access
    'iron_door', 'oak_door', 'spruce_door', 'birch_door',
    // Liquids
    'water', 'lava',
    // Spawners and portals
    'spawner', 'nether_portal', 'end_portal', 'end_portal_frame',
]);

// Blocks to completely ignore (common, not useful)
const IGNORE_BLOCKS = new Set([
    'air', 'cave_air', 'void_air', 'bedrock'
]);

interface BlockSummary {
    count: number;
    positions?: { x: number; y: number; z: number }[];
}

async function getNearbyWorld(bot: Bot, radius: number): Promise<object> {
    const botPosition = bot.entity.position;
    const blockCounts: Map<string, BlockSummary> = new Map();
    const entities: { type: string; name: string; x: number; y: number; z: number; distance: number }[] = [];

    // Scan blocks in cube
    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                const blockPos = botPosition.offset(x, y, z);
                const block = bot.blockAt(blockPos);

                if (!block || IGNORE_BLOCKS.has(block.name)) continue;

                const name = block.name;
                const isImportant = IMPORTANT_BLOCKS.has(name);

                if (!blockCounts.has(name)) {
                    blockCounts.set(name, {
                        count: 0,
                        positions: isImportant ? [] : undefined
                    });
                }

                const summary = blockCounts.get(name)!;
                summary.count++;

                // Only store positions for important blocks (max 50 per type)
                if (isImportant && summary.positions && summary.positions.length < 50) {
                    summary.positions.push({
                        x: Math.round(block.position.x),
                        y: Math.round(block.position.y),
                        z: Math.round(block.position.z)
                    });
                }
            }
        }
    }

    // Scan entities
    for (const entity of Object.values(bot.entities)) {
        if (entity === bot.entity) continue;
        const dist = botPosition.distanceTo(entity.position);
        if (dist <= radius) {
            entities.push({
                type: entity.type ?? 'unknown',
                name: entity.name || entity.username || entity.displayName || 'unknown',
                x: Math.round(entity.position.x),
                y: Math.round(entity.position.y),
                z: Math.round(entity.position.z),
                distance: Math.round(dist)
            });
        }
    }

    // Sort entities by distance
    entities.sort((a, b) => a.distance - b.distance);

    // Convert block map to sorted object (by count descending)
    const blocks: Record<string, BlockSummary> = {};
    const sortedBlocks = [...blockCounts.entries()].sort((a, b) => b[1].count - a[1].count);

    for (const [name, summary] of sortedBlocks) {
        // Only include blocks with significant presence or important ones
        if (summary.count >= 3 || summary.positions) {
            blocks[name] = summary;
        }
    }

    return {
        bot: {
            x: Math.round(botPosition.x),
            y: Math.round(botPosition.y),
            z: Math.round(botPosition.z),
            health: Math.round(bot.health),
            food: Math.round(bot.food)
        },
        radius,
        blocks,
        entities: entities.slice(0, 30) // Max 30 entities
    };
}

export const visionTool = {
    name: "get_vision",
    description: "Scans the bot's surroundings. Returns block counts (with positions for important blocks like ores, chests, crafting tables) and nearby entities.",
    inputSchema: {
        type: 'object',
        properties: {
            radius: {
                type: 'number',
                description: 'Scan radius (1-32, default 8)',
                minimum: 1,
                maximum: 32
            }
        }
    },
    handler: async (bot: Bot, args: { radius?: number }) => {
        const radius = Math.min(32, Math.max(1, args.radius ?? 8));
        const worldData = await getNearbyWorld(bot, radius);
        // Compact JSON (no pretty print)
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(worldData)
            }]
        };
    },
};
