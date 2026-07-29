require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
    try {
        const c = await client.channels.fetch('1472313975386669218');
        const m = await c.messages.fetch('1474655168715952169');
        console.log(JSON.stringify(m.embeds[0].fields, null, 2));
    } catch (e) {
        console.error(e);
    }
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
