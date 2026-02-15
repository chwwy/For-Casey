const data = require('../features/medication/data');
const config = require('../features/medication/config');
const { generateReportEmbeds } = require('../features/medication/index');

module.exports = async (reaction, user, client) => {
    // 1. Basic Checks
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    if (user.bot) return;

    // 2. Identify Instance
    const instance = config.getInstanceByChannel(reaction.message.channel.id);
    if (!instance) return;

    // Only verify message author is bot
    if (reaction.message.author.id !== client.user.id) return;

    const { key: instanceKey, timezone, slots } = instance;

    // 3. Determine Time Slot
    let timeSlot = null;
    if (reaction.emoji.name === '🌞' && slots.includes('AM')) {
        timeSlot = 'AM';
    } else if ((reaction.emoji.name === '💤' || reaction.emoji.name === 'zzz') && slots.includes('PM')) {
        timeSlot = 'PM';
    } else {
        return;
    }

    // 4. Determine Day (Always "Today" for reaction interactions)
    const dayName = data.getCurrentDayName(timezone);

    console.log(`[Reaction Remove] User ${user.username} removed ${timeSlot} for ${dayName} in ${instanceKey}`);

    // 5. Update Data -> Set to FALSE explicitly
    data.updateWeeklyCheck(instanceKey, timezone, dayName, timeSlot, false);

    // 6. Update Messages
    const savedIds = data.getMessageIds(instanceKey);
    for (const [channelId, messageId] of Object.entries(savedIds)) {
        try {
            const channel = await client.channels.fetch(channelId);
            const msg = await channel.messages.fetch(messageId);

            // Generate NEW embeds with updated data (which should now have false/empty for this slot)
            const newEmbeds = generateReportEmbeds(instanceKey);

            await msg.edit({ embeds: newEmbeds });
            console.log(`[Sync] Updated report in ${channelId} after uncheck`);
        } catch (e) {
            console.error(`Failed to sync update to ${channelId}:`, e);
            if (e.code === 10003 || e.status === 404) {
                console.log(`Detected deleted channel ${channelId}, cleaning up...`);
                data.removeMessageId(instanceKey, channelId);
            }
        }
    }
};
