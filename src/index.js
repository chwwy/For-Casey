const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config/env');
const handleReady = require('./events/ready');
const handleMessageCreate = require('./events/messageCreate');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [ // Partials are required to receive DMs!
        'CHANNEL', // Required to receive DMs
        'MESSAGE', // Required to read messages in DMs
        'REACTION' // Required for reaction events on uncached messages
    ]
});

client.once(Events.ClientReady, handleReady);
client.on(Events.MessageCreate, (message) => handleMessageCreate(message, client));
client.on(Events.MessageReactionAdd, (reaction, user) => require('./events/messageReactionAdd')(reaction, user, client));
client.on(Events.MessageReactionRemove, (reaction, user) => require('./events/messageReactionRemove')(reaction, user, client));
client.on(Events.InteractionCreate, (interaction) => require('./events/interactionCreate')(interaction, client));

if (!config.DISCORD_TOKEN) {
    console.error("Error: DISCORD_TOKEN is missing! Please set it in your environment variables.");
    process.exit(1);
}

client.login(config.DISCORD_TOKEN);
