const autoBanConfig = require('./config');

/**
 * Handles incoming messages to check if they are in the auto-ban channel list.
 * If yes, bans the member and purges messages from the channel for the last 1 hour.
 * @param {import('discord.js').Message} message 
 */
async function handleMessage(message) {
    const banChannelIds = autoBanConfig.getBanChannelIds();
    if (!banChannelIds || banChannelIds.length === 0) return;

    if (!banChannelIds.includes(message.channel.id)) return;

    const guild = message.guild;
    if (!guild) return;

    const author = message.author;
    const channel = message.channel;

    console.log(`[AutoBan] Triggered by user ${author.tag} (${author.id}) in channel ${channel.name} (${channel.id}).`);

    // 1. Ban the member immediately
    try {
        let member;
        try {
            member = await guild.members.fetch(author.id);
        } catch (e) {
            // Member might not be cached or not fetchable, fallback to direct ban
        }

        if (member) {
            if (member.bannable) {
                await member.ban({ deleteMessageSeconds: 3600, reason: 'Auto-ban: Sent message in banned channel' });
                console.log(`[AutoBan] Successfully banned user ${author.tag} (${author.id})`);
            } else {
                console.warn(`[AutoBan] User ${author.tag} (${author.id}) is not bannable (e.g., owner or higher role).`);
            }
        } else {
            // Fallback direct ban
            await guild.members.ban(author.id, { deleteMessageSeconds: 3600, reason: 'Auto-ban: Sent message in banned channel' });
            console.log(`[AutoBan] Successfully banned user ${author.tag} (${author.id}) via direct guild ban.`);
        }
    } catch (error) {
        console.error(`[AutoBan] Failed to ban user ${author.tag} (${author.id}):`, error);
    }

    // 2. Delete all chats in the channel in the last one hour
    try {
        console.log(`[AutoBan] Purging messages from the last 1 hour in channel ${channel.name} (${channel.id})...`);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        let messagesToDelete = [];
        let lastId = null;
        let fetching = true;

        while (fetching) {
            const options = { limit: 100 };
            if (lastId) {
                options.before = lastId;
            }
            const fetched = await channel.messages.fetch(options);
            if (fetched.size === 0) {
                fetching = false;
                break;
            }

                        // Filter messages in the last hour sent by this specific user
            const userMessagesInLastHour = fetched.filter(
                msg => msg.createdTimestamp >= oneHourAgo && msg.author.id === author.id
            );
            messagesToDelete.push(...userMessagesInLastHour.values());

            const oldestFetched = fetched.last();
            if (oldestFetched && oldestFetched.createdTimestamp < oneHourAgo) {
                fetching = false;
            } else {
                lastId = oldestFetched.id;
            }
        }

        console.log(`[AutoBan] Found ${messagesToDelete.length} messages in the last 1 hour to delete.`);

        if (messagesToDelete.length > 0) {
            // chunk deletion by 100s
            for (let i = 0; i < messagesToDelete.length; i += 100) {
                const chunk = messagesToDelete.slice(i, i + 100);
                await channel.bulkDelete(chunk);
            }
            console.log(`[AutoBan] Successfully deleted ${messagesToDelete.length} messages.`);
        }
    } catch (error) {
        console.error(`[AutoBan] Failed to purge messages in channel ${channel.id}:`, error);
    }
}

module.exports = {
    handleMessage
};
