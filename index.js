require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Parse channel mappings from Environment Variables
// Expected format: ID1,ID2,ID3
const sourceIds = (process.env.SOURCE_CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
const destIds = (process.env.DESTINATION_CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

// Create a Map: Source Channel ID -> Destination Channel ID
const channelMap = new Map();
sourceIds.forEach((sourceId, index) => {
    if (destIds[index]) {
        channelMap.set(sourceId, destIds[index]);
    }
});

console.log('Channel Mappings:', sourceIds.map((s, i) => `${s} -> ${destIds[i] || 'None'}`).join(', '));

// --- AI Setup ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function translateText(text, authorUsername) {
    try {
        const prompt = `
        You are a generic translator for a Discord chat.
        Task: Translate the following text from Indonesian (or mixed Indonesian/English) to standard English.
        
        Rules:
        1. Preserve the tone, slang, and intent of the original message.
        2. If the message is already fully English, strictly return the original text exactly as is.
        3. Do not add any conversational filler like "Here is the translation". Just the translation.
        4. Maintain formatting like code blocks, bolding, etc.
        5. If the Indonesian is informal, the English should be informal. If there are cultural jokes, provide a localized English equivalent.
        
        Original Author: ${authorUsername}
        Message: "${text}"
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Translation Error:", error);
        return null;
    }
}

async function translateToIndonesian(text) {
    try {
        const prompt = `
        You are a generic translator for a Discord chat.
        Task: Translate the following English text to Indonesian.
        
        Rules:
        1. Use natural, conversational Indonesian (gaul/informal) unless the English is very formal.
        2. Preserve the tone and intent.
        
        Message: "**Casey bilang:** ${text}"
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Indonesian Translation Error Details:", error);
        return null;
    }
}

// --- Discord Client Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    // Set status to "Playing naosletter.com" with DND (Red) indicator
    readyClient.user.setPresence({
        activities: [{ name: 'naosletter.com', type: ActivityType.Playing }],
        status: 'dnd',
    });
});

// --- Message History for De-duplication ---
const lastMessages = new Map();

client.on(Events.MessageCreate, async message => {
    // 1. Ignore bots to prevent loops
    if (message.author.bot) return;

    // 2. Duplicate Check: Skip if message is identical to the last one in this channel
    const cleanedContent = message.content.trim();
    if (lastMessages.get(message.channel.id) === cleanedContent) {
        return;
    }
    lastMessages.set(message.channel.id, cleanedContent);

    // --- VIP Feature: English -> Indonesian for specific user ---
    const VIP_USER_ID = '860909419226595328';

    // Debug logging to help identify why it might fail
    if (message.author.id === VIP_USER_ID) {
        console.log(`VIP User detected. Message content: "${message.content}". Mentions bot: ${message.mentions.users.has(client.user.id)}`);
    }

    if (message.author.id === VIP_USER_ID && message.mentions.users.has(client.user.id)) {
        // Remove mention syntax to get clean text
        const textToTranslate = message.content.replace(/<@!?[0-9]+>/, '').trim();

        if (textToTranslate) {
            const translatedIndo = await translateToIndonesian(textToTranslate);
            if (translatedIndo) {
                await message.reply(translatedIndo);
            }
        }
        // Continue execution so it can still be mirrored if in a source channel
    }

    // 2. Check if this message is in a monitored source channel
    if (!channelMap.has(message.channel.id)) return;

    const destinationChannelId = channelMap.get(message.channel.id);
    const destinationChannel = await client.channels.fetch(destinationChannelId).catch(() => null);

    if (!destinationChannel) {
        console.error(`Destination channel ${destinationChannelId} not found or not accessible.`);
        return;
    }

    // 3. Process the translation
    // Indicate processing using typing status (optional but nice UX)
    // await destinationChannel.sendTyping(); // Careful with rate limits if busy

    const translatedText = await translateText(message.content, message.author.username);

    if (!translatedText) return;

    // 4. Construct the Embed to look premium
    const translationEmbed = new EmbedBuilder()
        .setColor(0x0099FF) // Light blue
        .setAuthor({
            name: `${message.author.username}`,
            iconURL: message.author.displayAvatarURL()
        })
        .setDescription(translatedText)
        .addFields({ name: 'Original', value: message.content.substring(0, 1024) }) // Discord field limit
        .setFooter({ text: `From #${message.channel.name}` })
        .setTimestamp();

    // 5. Send to private destination channel
    try {
        await destinationChannel.send({ embeds: [translationEmbed] });
    } catch (err) {
        console.error("Failed to send translation:", err);
    }
});

// Log in to Discord with your client's token
if (!DISCORD_TOKEN) {
    console.error("Error: DISCORD_TOKEN is missing! Please set it in your environment variables.");
    process.exit(1);
}

client.login(DISCORD_TOKEN);
