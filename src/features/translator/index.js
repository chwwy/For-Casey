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

// --- Batching State ---
const batchQueues = new Map(); // Key: `${sourceChannelId}-${authorId}`, Value: { timer, messages: [] }

async function handleForwarding(message) {
    // 1. Check if this message is in a monitored source channel
    if (!channelMap.has(message.channel.id)) return false;

    // 2. Duplicate Check
    const cleanedContent = message.content.trim();
    if (!cleanedContent && message.attachments.size === 0) return false;

    // Only do duplicate string checking for pure text messages
    if (cleanedContent && message.attachments.size === 0) {
        if (lastMessages.get(message.channel.id) === cleanedContent) {
            return true; // Handled (ignored)
        }
        lastMessages.set(message.channel.id, cleanedContent);
    }

    const destinationChannelId = channelMap.get(message.channel.id);
    const destinationChannel = await message.client.channels.fetch(destinationChannelId).catch(() => null);

    if (!destinationChannel) {
        console.error(`Destination channel ${destinationChannelId} not found.`);
        return false;
    }

    // --- Message Batching Logic ---
    const batchKey = `${message.channel.id}-${message.author.id}`;

    let userBatch = batchQueues.get(batchKey);

    // If a batch exists, clear the existing timer to reset the window
    if (userBatch) {
        clearTimeout(userBatch.timer);
    } else {
        // Initialize a new batch
        userBatch = {
            author: message.author,
            messages: [],
            destinationChannel,
            sourceChannel: message.channel,
            replyContexts: []
        };
        batchQueues.set(batchKey, userBatch);
    }

    // Add current message to the batch
    userBatch.messages.push(message);

    // Attempt to grab reply context (only if we haven't already grabbed one for this batch)
    if (message.reference && userBatch.replyContexts.length === 0) {
        try {
            const referencedMessage = await message.fetchReference();
            if (referencedMessage && referencedMessage.content) {
                userBatch.replyContexts.push(referencedMessage);
            }
        } catch (error) {
            console.log('Skipping reply fetch error:', error.message);
        }
    }

    // Set a new timer
    resetBatchTimer(batchKey, destinationChannelId);

    return true;
}

function flushBatch(batchKey) {
    const userBatch = batchQueues.get(batchKey);
    if (!userBatch) return;

    if (userBatch.timer) clearTimeout(userBatch.timer);

    const destinationChannelId = channelMap.get(userBatch.sourceChannel.id);
    if (!destinationChannelId) return;

    // Pop the queue out of the map so new messages start a fresh batch
    batchQueues.delete(batchKey);

    // Combine the messages
    const combinedContent = userBatch.messages.map(m => m.content).filter(Boolean).join(' ');
    const combinedContentOriginal = userBatch.messages.map(m => m.content).filter(Boolean).join('\n');

    // Extract media links
    let mainImageUrl = null;
    const extraMediaUrls = [];

    for (const msg of userBatch.messages) {
        if (msg.attachments.size > 0) {
            for (const [key, attachment] of msg.attachments) {
                if (!mainImageUrl && attachment.contentType && attachment.contentType.startsWith('image/')) {
                    mainImageUrl = attachment.url;
                } else {
                    extraMediaUrls.push(attachment.url);
                }
            }
        }
    }

    // Grab the URL of the *first* message in the chain so the jump link goes to the start of their thought
    const firstMessageUrl = userBatch.messages[0].url;

    // Process Translation Queue
    const currentQueue = channelQueues.get(destinationChannelId) || Promise.resolve();

    const nextTask = currentQueue.then(async () => {
        // Translate the combined block, chunking if it exceeds the API limit (3000 chars)
        let translatedText = null;
        if (combinedContent.length > 0) {
            const maxChunkSize = 3000;
            if (combinedContent.length <= maxChunkSize) {
                translatedText = await translateText(combinedContent, userBatch.author.username);
            } else {
                const lines = combinedContent.split('\n');
                const chunks = [];
                let currentChunk = '';
                for (const line of lines) {
                    if (line.length > maxChunkSize) {
                        if (currentChunk) chunks.push(currentChunk);
                        let remaining = line;
                        while (remaining.length > 0) {
                            chunks.push(remaining.substring(0, maxChunkSize));
                            remaining = remaining.substring(maxChunkSize);
                        }
                        currentChunk = '';
                    } else if ((currentChunk ? currentChunk.length + 1 : 0) + line.length > maxChunkSize) {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = line;
                    } else {
                        currentChunk = currentChunk ? currentChunk + '\n' + line : line;
                    }
                }
                if (currentChunk) chunks.push(currentChunk);

                const translatedChunks = [];
                for (const chunk of chunks) {
                    const translated = await translateText(chunk, userBatch.author.username);
                    if (translated) translatedChunks.push(translated);
                }
                translatedText = translatedChunks.join('\n');
            }
        }

        // Translate reply context if it exists
        let replyText = '';
        if (userBatch.replyContexts.length > 0) {
            const refMsg = userBatch.replyContexts[0];
            const translatedRef = await translateText(refMsg.content, refMsg.author.username);
            if (translatedRef) {
                replyText = `> **Replying to ${refMsg.author.username}:** ${translatedRef.replace(/\n/g, '\n> ')}\n`;
            }
        }

        if (!translatedText && !mainImageUrl && extraMediaUrls.length === 0) return;

        const descriptionParts = [];
        if (replyText) descriptionParts.push(replyText);
        if (translatedText) descriptionParts.push(`__**Translation :flag_us: (${userBatch.messages.length} msg${userBatch.messages.length > 1 ? 's' : ''})**__:\n${translatedText}`);
        if (combinedContentOriginal) {
            descriptionParts.push(`\n\n__**Original 🇮🇩 (${userBatch.messages.length} msg${userBatch.messages.length > 1 ? 's' : ''}):**__\n${combinedContentOriginal}`);
        }
        descriptionParts.push(`\n\n[Jump to Messages](${firstMessageUrl})`);

        const translationEmbed = new EmbedBuilder()
            .setColor(0xFFD1DC)
            .setAuthor({
                name: `${userBatch.author.username}`,
                iconURL: userBatch.author.displayAvatarURL(),
                url: firstMessageUrl
            })
            .setDescription(descriptionParts.join(''))
            .setFooter({ text: `From #${userBatch.sourceChannel.name}` })
            .setTimestamp();

        if (mainImageUrl) {
            translationEmbed.setImage(mainImageUrl);
        }

        try {
            const messagePayload = { embeds: [translationEmbed] };
            if (extraMediaUrls.length > 0) {
                messagePayload.content = extraMediaUrls.join('\n');
            }
            await userBatch.destinationChannel.send(messagePayload);
        } catch (err) {
            console.error("Failed to reply with translation:", err);
        }
    }).catch(err => {
        console.error("Error in message queue processing:", err);
    });

    channelQueues.set(destinationChannelId, nextTask);
}

function resetBatchTimer(batchKey, destinationChannelId) {
    const userBatch = batchQueues.get(batchKey);
    if (!userBatch) return;

    if (userBatch.timer) clearTimeout(userBatch.timer);

    userBatch.timer = setTimeout(() => {
        flushBatch(batchKey);
    }, config.TRANSLATION_DEBOUNCE_MS);
}

async function handleTyping(typing) {
    const batchKey = `${typing.channel.id}-${typing.user.id}`;
    const userBatch = batchQueues.get(batchKey);
    if (userBatch) {
        const destinationChannelId = channelMap.get(typing.channel.id);
        if (destinationChannelId) {
            console.log(`Typing event detected for ${typing.user.username}, pausing translation timer...`);
            resetBatchTimer(batchKey, destinationChannelId);
        }
    }
}

module.exports = {
    handleVIP,
    handleForwarding,
    handleTyping
};
