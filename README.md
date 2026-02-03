# Barebones Discord Bot

This is a starter template for a Discord bot using Node.js and `discord.js`.

## Configuration

1. **Discord Token**: [Get from Discord Dev Portal](https://discord.com/developers/applications).
2. **Gemini API Key**: [Get from Google AI Studio](https://aistudio.google.com/app/apikey).
3. **Channel Mapping**:
    - Enable **Developer Mode** in Discord (User Settings > Advanced > Developer Mode).
    - Right-click channels to copy their IDs.
    - Fill out `.env` as follows:

    ```env
    DISCORD_TOKEN=your_token
    GEMINI_API_KEY=your_gemini_key
    # Comma separated lists. The first Source maps to the first Destination, and so on.
    SOURCE_CHANNEL_IDS=10001,10002
    DESTINATION_CHANNEL_IDS=20001,20002
    ```

## Features

- **Deep Translation**: Uses Google Gemini 2.5 Flash to understand context and slang.
- **Channel Mirroring**: Automatically forwards translated messages from public source channels to private destination channels.
- **Premium UI**: Displays translations in a clean Embed with the original author's avatar and the original text for reference.
- **Smart Filtering**: Ignores bots and unmapped channels.

## Running the Bot
