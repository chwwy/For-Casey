require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const users = {
        nao: '860909419226595328', // backupUserId for Nao
        nightly: '287489239250370560' // backupUserId for Casey
    };

    for (const [key, userId] of Object.entries(users)) {
        try {
            console.log(`\n=== Fetching DMs for user ${key} (${userId}) ===`);
            const user = await client.users.fetch(userId);
            const dmChannel = await user.createDM();

            // Fetch last 100 messages from Monday
            const messages = await dmChannel.messages.fetch({ limit: 100 });
            console.log(`Got ${messages.size} messages in the DM.`);

            messages.forEach(msg => {
                const isBot = msg.author.id === client.user.id;
                console.log(`[${msg.createdAt.toISOString()}] ${isBot ? 'BOT' : 'USER'} (${msg.author.username}): ${msg.content}`);
                msg.embeds.forEach(e => {
                    console.log(`  Embed Title: ${e.title}`);
                    if (e.description) console.log(`  Embed Desc: ${e.description.substring(0, 100)}...`);
                });
            });

        } catch (e) {
            console.error(`Error fetching DMs for ${key}:`, e.message);
        }
    }

    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
