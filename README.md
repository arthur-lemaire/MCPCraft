# MCPCraft

MCPCraft is a [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/spec) server that interfaces with a Minecraft bot using [Mineflayer](https://github.com/PrismarineJS/mineflayer).

This project allows an LLM (Large Language Model) to control a Minecraft bot, enabling it to perform complex tasks like gathering resources, crafting items, building structures, and even following high-level strategies (like obtaining an iron pickaxe from scratch).

## Features

- **MCP Integration:** Exposes Minecraft actions as MCP tools for seamless LLM control.
- **Autonomous Bot:** Uses `mineflayer` and `mineflayer-pathfinder` for navigation and interaction.
- **Complex Tools:**
  - `craft_item`: Recursively gathers ingredients and crafts items (handling crafting tables automatically).
  - `collect_block`: Finds and mines blocks using pathfinding.
  - `place_block`: intelligent block placement (e.g., placing a furnace).
  - `smelt_item`: Automates smelting processes.
  - `auto_iron`: A macro-strategy to go from a fresh spawn to acquiring an iron pickaxe.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

The bot configuration is currently located in `src/bot.ts`. You can modify the `BOT_CONFIG` object to change the target server, username, or version.

```typescript
export const BOT_CONFIG = {
    host: 'localhost',
    port: 54321,
    username: 'GeminiBot_v2',
    version: '1.21.1'
};
```

*Note: Ensure you have a Minecraft server running on the specified host and port.*

## Usage

### Development

To start the server in development mode (using `tsx`):

```bash
npm start
```

### Build

To compile the TypeScript code to JavaScript:

```bash
npm run build
```

## Tools Available

-   **`craft_item`**: Crafts a specified item. Handles intermediate recipes and crafting table placement if necessary (prioritizing 2x2 crafting when possible).
-   **`collect_block`**: Collects a specified number of blocks.
-   **`place_block`**: Places a specific block nearby.
-   **`smelt_item`**: Smelts an item using a specified fuel.
-   **`drop_item`**: Drops items from the inventory.
-   **`auto_iron`**: Automated sequence to gather wood, stone, craft pickaxes, and smelt iron.
-   **`move_to`**: Moves the bot to specific coordinates.

## License

[MIT](LICENSE)
