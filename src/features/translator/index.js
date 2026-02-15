const { EmbedBuilder } = require('discord.js');
const { translateText, translateToIndonesian, urlToGenerativePart } = require('../../services/gemini');
const config = require('../../config/env');

// --- State ---
const lastMessages = new Map();
const channelQueues = new Map(); // destinationChannelId -> Promise

// --- Channel Mapping ---
const channelMap = new Map();
config.SOURCE_CHANNEL_IDS.forEach((sourceId, index) => {
    if (config.DESTINATION_CHANNEL_IDS[index]) {
        channelMap.set(sourceId, config.DESTINATION_CHANNEL_IDS[index]);
    }
});

async function handleVIP(message) {
    // Ignore DMs
    if (!message.guild) return false;

    // Check if user is VIP and mentions bot
    const vipName = config.VIP_USERS[message.author.id];

    if (vipName && message.mentions.users.has(message.client.user.id)) {
        console.log(`VIP User detected (${vipName}). Message content: "${message.content}"`);

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
        return true; // Handled
    }
    return false; // Not handled here
}

async function handleForwarding(message) {
    // 1. Check if this message is in a monitored source channel
    if (!channelMap.has(message.channel.id)) return false;

    // 2. Duplicate Check
    const cleanedContent = message.content.trim();
    if (lastMessages.get(message.channel.id) === cleanedContent) {
        return true; // Handled (ignored)
    }
    lastMessages.set(message.channel.id, cleanedContent);

    const destinationChannelId = channelMap.get(message.channel.id);
    const destinationChannel = await message.client.channels.fetch(destinationChannelId).catch(() => null);

    if (!destinationChannel) {
        console.error(`Destination channel ${destinationChannelId} not found or not accessible.`);
        return false;
    }

    // --- Message Queueing ---
    const currentQueue = channelQueues.get(destinationChannelId) || Promise.resolve();

    const nextTask = currentQueue.then(async () => {
        // Translate
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
    return true;
}

module.exports = {
    handleVIP,
    handleForwarding
};
