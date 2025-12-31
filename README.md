# MCPCraft

MCPCraft is a [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/spec) server that interfaces with a Minecraft bot using [Mineflayer](https://github.com/PrismarineJS/mineflayer).

This project allows an LLM (Large Language Model) to control a Minecraft bot, enabling it to perform complex tasks like gathering resources, crafting items, building structures, and exploring the world.

## Features

- **MCP Integration:** Exposes Minecraft actions as MCP tools for seamless LLM control
- **Autonomous Bot:** Uses `mineflayer` and `mineflayer-pathfinder` for navigation and interaction
- **Vision System:** Visual perception of the bot's surroundings
- **Advanced Crafting:** Recursive crafting with automatic ingredient gathering
- **Nether Portal:** Automated nether portal construction
- **Hot Reload:** Development mode with automatic reconnection

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

The bot configuration is defined in `src/index.ts`. Modify the settings in `initBotManager()`:

```typescript
const manager = initBotManager({
    host: 'localhost',
    port: 54321,
    username: 'MCPBot',
    version: '1.21.1'
});
```

> Ensure you have a Minecraft server running on the specified host and port.

## Usage

### Production

Start the MCP server (stdio mode for Claude Desktop):

```bash
npm start
```

### Development

Development mode uses a TCP proxy architecture for hot reload support:

```
Claude Desktop <--stdio--> Proxy <--TCP--> Dev Server <--> Minecraft
```

1. Start the dev server (with hot reload and visual viewer on port 3007):
   ```bash
   npm run dev
   ```

2. In Claude Desktop config, use the proxy:
   ```bash
   npm run proxy
   ```

The proxy and server communicate automatically via a `.dev-port` file. When the server restarts (hot reload), the proxy reconnects automatically.

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Test

Run integration tests:

```bash
npm test
```

## Available Tools

| Tool | Description |
|------|-------------|
| `inventory` | View the bot's inventory |
| `move_to` | Move the bot to specific coordinates |
| `collect_block` | Collect a specified number of blocks |
| `place_block` | Place a block at a location |
| `craft_item` | Craft an item (handles intermediate recipes and crafting table) |
| `drop_item` | Drop items from inventory |
| `smelt_item` | Smelt items using a furnace |
| `vision` | Get a visual representation of the bot's surroundings |
| `build_nether_portal` | Automated nether portal construction |
| `use_bucket` | Use a bucket (water/lava) |

## Architecture

```
src/
├── index.ts          # Production entry (stdio MCP server)
├── index_dev.ts      # Development entry (TCP server + hot reload)
├── mcp_proxy.ts      # Proxy for Claude Desktop (stdio <-> TCP)
├── mcp_server.ts     # MCP server implementation
├── bot_manager.ts    # Bot lifecycle management
├── bot.ts            # Bot configuration (legacy)
└── tools/            # MCP tool implementations
    ├── inventory.ts
    ├── move.ts
    ├── collect.ts
    ├── build.ts
    ├── craft.ts
    ├── drop.ts
    ├── smelt.ts
    ├── vision.ts
    └── nether_portal.ts
```

## License

[MIT](LICENSE)
