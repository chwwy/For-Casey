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

// Helper to convert image URL to Generative Part
async function urlToGenerativePart(url, mimeType) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}

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

async function translateToIndonesian(text, imageParts = []) {
    try {
        const prompt = `
            You are a generic translator for a Discord chat.
            Task: Translate the following English text (and/or text inside the image) to Indonesian.
            
            Rules:
            1. Use natural, conversational Indonesian (gaul/informal) unless the English is very formal.
            2. Preserve the tone and intent.
            3. Don't use dramatic and ancient Indonesian words like "selir" instead of "pasangan"
            
            Message: "${text || '[Image Only]'}"
            `;

        const result = await model.generateContent([prompt, ...imageParts]);
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
    console.log(`Ready!Logged in as ${readyClient.user.tag}`);

    // Set status to "Playing naosletter.com" with DND (Red) indicator
    readyClient.user.setPresence({
        activities: [{ name: 'naosletter.com', type: ActivityType.Playing }],
        status: 'dnd',
    });
});

// --- Message History for De-duplication ---
const lastMessages = new Map();

// --- Message Queueing for Serial Processing ---
const channelQueues = new Map(); // destinationChannelId -> Promise

client.on(Events.MessageCreate, async message => {
    // 1. Ignore ONLY ourself to prevent immediate loops (allow other bots)
    if (message.author.id === client.user.id) return;

    // 2. Duplicate Check: Skip if message is identical to the last one in this channel
    const cleanedContent = message.content.trim();
    if (lastMessages.get(message.channel.id) === cleanedContent) {
        return;
    }
    lastMessages.set(message.channel.id, cleanedContent);

    // --- VIP Feature: English -> Indonesian for specific user ---

    const VIP_USERS = {
        '287489239250370560': 'Casey',
        '860909419226595328': 'Nao'
    };

    // Debug logging
    if (VIP_USERS[message.author.id]) {
        console.log(`VIP User detected (${VIP_USERS[message.author.id]}). Message content: "${message.content}". Mentions bot: ${message.mentions.users.has(client.user.id)}`);
    }

    if (VIP_USERS[message.author.id] && message.mentions.users.has(client.user.id)) {
        const vipName = VIP_USERS[message.author.id];

        // Remove mention syntax to get clean text
        const textToTranslate = message.content.replace(/<@!?[0-9]+>/, '').trim();

        // Collect image attachments
        const imageParts = [];
        if (message.attachments.size > 0) {
            for (const [key, attachment] of message.attachments) {
                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                    try {
                        const part = await urlToGenerativePart(attachment.url, attachment.contentType);
                        imageParts.push(part);
                    } catch (err) {
                        console.error('Failed to process attachment:', err);
                    }
                }
            }
        }

        if (textToTranslate || imageParts.length > 0) {
            let loadingMsg;
            try {
                loadingMsg = await message.reply('<a:loading:1468690130364661760> Translating...');
            } catch (err) {
                console.error("Failed to send loading message:", err);
            }

            const translatedIndo = await translateToIndonesian(textToTranslate, imageParts);

            if (loadingMsg) {
                try {
                    await loadingMsg.delete();
                } catch (err) {
                    console.error("Failed to delete loading message:", err);
                }
            }

            if (translatedIndo) {
                const vipEmbed = new EmbedBuilder()
                    .setColor(0xFFD1DC)
                    .setAuthor({
                        name: `${vipName} bilang:`,
                        iconURL: message.author.displayAvatarURL()
                    })
                    .setDescription(translatedIndo);

                await message.reply({ embeds: [vipEmbed] });
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

    // --- Message Queueing to prevent race conditions ---
    // Ensure that [Forward -> Reply] happens atomically per channel
    const currentQueue = channelQueues.get(destinationChannelId) || Promise.resolve();

    const nextTask = currentQueue.then(async () => {
        // 4. Translate
        const translationPromise = translateText(message.content, message.author.username);

        let replyContext = '';
        if (message.reference) {
            try {
                const referencedMessage = await message.fetchReference();
                if (referencedMessage && referencedMessage.content) {
                    const translatedRef = await translateText(referencedMessage.content, referencedMessage.author.username);
                    if (translatedRef) {
                        replyContext = `> **Replying to ${referencedMessage.author.username}:** ${translatedRef.replace(/\n/g, '\n> ')}\n`;
                    }
                }
            } catch (error) {
                console.log('Skipping reply context due to error:', error.message);
            }
        }

        const translatedText = await translationPromise;

        if (!translatedText) return;

        // 5. Send Translation Embed
        const translationEmbed = new EmbedBuilder()
            .setColor(0xFFD1DC)
            .setAuthor({
                name: `${message.author.username}`,
                iconURL: message.author.displayAvatarURL(),
                url: message.url
            })
            .setDescription(
                replyContext +
                translatedText +
                `\n\n**Original:**\n${message.content}` +
                `\n\n[Jump to Message](${message.url})`
            )
            .setFooter({ text: `From #${message.channel.name}` })
            .setTimestamp();

        try {
            await destinationChannel.send({ embeds: [translationEmbed] });
        } catch (err) {
            console.error("Failed to reply with translation:", err);
        }
    }).catch(err => {
        console.error("Error in message queue:", err);
    });

    channelQueues.set(destinationChannelId, nextTask);
});

// Log in to Discord with your client's token
if (!DISCORD_TOKEN) {
    console.error("Error: DISCORD_TOKEN is missing! Please set it in your environment variables.");
    process.exit(1);
}

client.login(DISCORD_TOKEN);
