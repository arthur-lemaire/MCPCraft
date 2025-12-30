import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';

export const netherPortalTool = {
    name: 'build_nether_portal',
    description: 'Builds and lights a nether portal. Requires 10+ obsidian and flint_and_steel in inventory.',
    inputSchema: {
        type: 'object',
        properties: {
            enter: {
                type: 'boolean',
                description: 'Whether to enter the portal after building (default: false)'
            }
        }
    },
    handler: async (bot: Bot, args: { enter?: boolean }) => {
        const mcData = minecraftData(bot.version);
        const logs: string[] = [];

        function log(msg: string) {
            console.error(`[NetherPortal] ${msg}`);
            logs.push(msg);
        }

        function countItem(name: string): number {
            const item = mcData.itemsByName[name];
            if (!item) return 0;
            return bot.inventory.count(item.id, null);
        }

        function getItem(name: string) {
            const item = mcData.itemsByName[name];
            if (!item) return null;
            return bot.inventory.findInventoryItem(item.id, null, false);
        }

        // Check requirements
        const obsidianCount = countItem('obsidian');
        const hasFlint = countItem('flint_and_steel') > 0;

        log(`Obsidian: ${obsidianCount}/10, Flint&Steel: ${hasFlint}`);

        if (obsidianCount < 10) {
            return {
                content: [{
                    type: 'text',
                    text: `Need 10 obsidian (have ${obsidianCount}). Get obsidian by mining with diamond_pickaxe or pouring water on lava source blocks.`
                }]
            };
        }

        if (!hasFlint) {
            return {
                content: [{
                    type: 'text',
                    text: `Need flint_and_steel. Craft it with iron_ingot + flint (get flint by mining gravel).`
                }]
            };
        }

        // Find a good spot to build (flat ground)
        const startPos = bot.entity.position.floored().offset(2, 0, 0);
        log(`Building portal at ${startPos.x}, ${startPos.y}, ${startPos.z}`);

        // Portal frame layout (minimal 4x5, without corners = 10 blocks)
        // Looking at it from the front:
        //   OO
        //   O O
        //   O O
        //   O O
        //   OO
        // We build it in the X-Z plane, facing Z direction

        const portalBlocks: Vec3[] = [
            // Bottom row
            new Vec3(0, 0, 0),
            new Vec3(1, 0, 0),
            // Left column
            new Vec3(0, 1, 0),
            new Vec3(0, 2, 0),
            new Vec3(0, 3, 0),
            // Right column
            new Vec3(1, 1, 0),
            new Vec3(1, 2, 0),
            new Vec3(1, 3, 0),
            // Top row
            new Vec3(0, 4, 0),
            new Vec3(1, 4, 0),
        ];

        // Equip obsidian
        const obsidianItem = getItem('obsidian');
        if (!obsidianItem) {
            return { content: [{ type: 'text', text: 'Cannot find obsidian in inventory' }] };
        }

        try {
            await bot.equip(obsidianItem, 'hand');
        } catch (e) {
            log(`Error equipping obsidian: ${e}`);
        }

        // Place obsidian blocks
        let placedCount = 0;
        for (const offset of portalBlocks) {
            const targetPos = startPos.plus(offset);
            const block = bot.blockAt(targetPos);

            // Skip if already obsidian
            if (block && block.name === 'obsidian') {
                log(`Already obsidian at ${targetPos}`);
                placedCount++;
                continue;
            }

            // Find a reference block to place against
            const directions = [
                new Vec3(0, -1, 0), // below
                new Vec3(0, 1, 0),  // above
                new Vec3(-1, 0, 0), // left
                new Vec3(1, 0, 0),  // right
                new Vec3(0, 0, -1), // front
                new Vec3(0, 0, 1),  // back
            ];

            let placed = false;
            for (const dir of directions) {
                const refPos = targetPos.plus(dir);
                const refBlock = bot.blockAt(refPos);

                if (refBlock && refBlock.name !== 'air' && refBlock.boundingBox === 'block') {
                    try {
                        // Re-equip obsidian in case it changed
                        const obsidian = getItem('obsidian');
                        if (obsidian) {
                            await bot.equip(obsidian, 'hand');
                            await bot.placeBlock(refBlock, dir.scaled(-1));
                            await bot.waitForTicks(3);
                            placedCount++;
                            placed = true;
                            log(`Placed obsidian at ${targetPos}`);
                            break;
                        }
                    } catch (e) {
                        // Try next direction
                        continue;
                    }
                }
            }

            if (!placed) {
                log(`Could not place obsidian at ${targetPos}`);
            }
        }

        log(`Placed ${placedCount}/10 obsidian blocks`);

        if (placedCount < 10) {
            return {
                content: [{
                    type: 'text',
                    text: `Only placed ${placedCount}/10 obsidian. Portal incomplete.\nLog: ${logs.join(' -> ')}`
                }]
            };
        }

        // Light the portal with flint and steel
        log('Lighting portal...');
        const flintItem = getItem('flint_and_steel');
        if (!flintItem) {
            return { content: [{ type: 'text', text: 'Lost flint_and_steel' }] };
        }

        try {
            await bot.equip(flintItem, 'hand');

            // Click on the inside bottom of the portal
            const insidePos = startPos.offset(0, 1, 0);
            const insideBlock = bot.blockAt(insidePos);

            // We need to activate on the bottom obsidian
            const bottomBlock = bot.blockAt(startPos);
            if (bottomBlock) {
                await bot.activateBlock(bottomBlock);
                await bot.waitForTicks(10);
                log('Portal lit!');
            }
        } catch (e) {
            log(`Error lighting portal: ${e}`);
            // Try alternate method - place fire
            try {
                const bottomBlock = bot.blockAt(startPos);
                if (bottomBlock) {
                    await bot.placeBlock(bottomBlock, new Vec3(0, 1, 0));
                    log('Portal lit (alternate method)!');
                }
            } catch (e2) {
                log(`Alternate lighting failed: ${e2}`);
            }
        }

        // Check if portal is active
        await bot.waitForTicks(20);
        const portalCheck = bot.findBlock({
            matching: mcData.blocksByName.nether_portal?.id,
            maxDistance: 5
        });

        if (!portalCheck) {
            return {
                content: [{
                    type: 'text',
                    text: `Portal frame built but failed to light. Try using flint_and_steel manually.\nLog: ${logs.join(' -> ')}`
                }]
            };
        }

        log('Portal is active!');

        // Enter portal if requested
        if (args.enter) {
            log('Entering portal...');
            try {
                const goals = require('mineflayer-pathfinder').goals;
                const portalPos = portalCheck.position;

                // Walk into the portal
                await bot.lookAt(portalPos);
                bot.setControlState('forward', true);
                await bot.waitForTicks(60); // Wait to teleport
                bot.setControlState('forward', false);

                log('Should be teleporting...');
            } catch (e) {
                log(`Error entering portal: ${e}`);
            }
        }

        return {
            content: [{
                type: 'text',
                text: `Nether portal built and lit successfully at ${startPos.x}, ${startPos.y}, ${startPos.z}!\nLog: ${logs.join(' -> ')}`
            }]
        };
    }
};

// Tool to use buckets (water/lava) - useful for making obsidian
export const bucketTool = {
    name: 'use_bucket',
    description: 'Use a bucket to pick up or place water/lava. Useful for creating obsidian (water on lava source).',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['pickup', 'place'],
                description: 'pickup = collect liquid, place = pour liquid'
            },
            liquid: {
                type: 'string',
                enum: ['water', 'lava'],
                description: 'Type of liquid'
            }
        },
        required: ['action']
    },
    handler: async (bot: Bot, args: { action: 'pickup' | 'place'; liquid?: 'water' | 'lava' }) => {
        const mcData = minecraftData(bot.version);
        const logs: string[] = [];

        function log(msg: string) {
            console.error(`[Bucket] ${msg}`);
            logs.push(msg);
        }

        function getItem(name: string) {
            const item = mcData.itemsByName[name];
            if (!item) return null;
            return bot.inventory.findInventoryItem(item.id, null, false);
        }

        if (args.action === 'pickup') {
            // Need empty bucket
            const bucket = getItem('bucket');
            if (!bucket) {
                return { content: [{ type: 'text', text: 'Need an empty bucket' }] };
            }

            await bot.equip(bucket, 'hand');

            // Find nearest water or lava source
            const liquidType = args.liquid || 'water';
            const liquidBlock = bot.findBlock({
                matching: mcData.blocksByName[liquidType]?.id,
                maxDistance: 4
            });

            if (!liquidBlock) {
                return { content: [{ type: 'text', text: `No ${liquidType} source found nearby` }] };
            }

            try {
                await bot.activateBlock(liquidBlock);
                await bot.waitForTicks(5);
                log(`Picked up ${liquidType}`);
                return {
                    content: [{
                        type: 'text',
                        text: `Picked up ${liquidType} with bucket.\nLog: ${logs.join(' -> ')}`
                    }]
                };
            } catch (e) {
                return { content: [{ type: 'text', text: `Failed to pick up liquid: ${e}` }] };
            }

        } else if (args.action === 'place') {
            // Need water_bucket or lava_bucket
            const waterBucket = getItem('water_bucket');
            const lavaBucket = getItem('lava_bucket');

            const bucket = args.liquid === 'lava' ? lavaBucket : (waterBucket || lavaBucket);

            if (!bucket) {
                return { content: [{ type: 'text', text: 'Need a water_bucket or lava_bucket' }] };
            }

            await bot.equip(bucket, 'hand');

            // Place in front of bot
            const targetPos = bot.entity.position.offset(
                Math.round(-Math.sin(bot.entity.yaw)),
                0,
                Math.round(-Math.cos(bot.entity.yaw))
            ).floored();

            const targetBlock = bot.blockAt(targetPos);
            if (!targetBlock) {
                return { content: [{ type: 'text', text: 'No valid block to place liquid on' }] };
            }

            try {
                await bot.activateBlock(targetBlock);
                await bot.waitForTicks(5);
                const liquidType = bucket.name.replace('_bucket', '');
                log(`Placed ${liquidType}`);
                return {
                    content: [{
                        type: 'text',
                        text: `Placed ${liquidType}.\nLog: ${logs.join(' -> ')}`
                    }]
                };
            } catch (e) {
                return { content: [{ type: 'text', text: `Failed to place liquid: ${e}` }] };
            }
        }

        return { content: [{ type: 'text', text: 'Invalid action' }] };
    }
};
