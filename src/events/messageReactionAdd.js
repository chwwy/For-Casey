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

    if (user.bot) return; // Ignore bots

    // 2. Identify Instance
    const instance = config.getInstanceByChannel(reaction.message.channel.id);
    if (!instance) return; // Ignore irrelevant channels

    // Only verify message author is bot
    if (reaction.message.author.id !== client.user.id) return;

    const { key: instanceKey, timezone, slots } = instance;

    // 3. Determine Time Slot or Action based on reaction
    let timeSlot = null;

    if (reaction.emoji.name === '🌞' && slots.includes('AM')) {
        timeSlot = 'AM';
    } else if ((reaction.emoji.name === '💤' || reaction.emoji.name === 'zzz') && slots.includes('PM')) {
        timeSlot = 'PM';
    } else {
        return; // Ignore other reactions
    }

    const dayName = data.getCurrentDayName(timezone);
    console.log(`Processing CHECK & MOOD for ${dayName} ${timeSlot} by ${user.username} in ${instanceKey}`);

    // 4. Update Checkmark immediately
    data.updateWeeklyCheck(instanceKey, timezone, dayName, timeSlot, true);

    // Sync all messages for checkmark updates
    const savedIds = data.getMessageIds(instanceKey);
    for (const [channelId, messageId] of Object.entries(savedIds)) {
        try {
            const channel = await client.channels.fetch(channelId);
            const msg = await channel.messages.fetch(messageId);
            const newEmbeds = generateReportEmbeds(instanceKey);
            await msg.edit({ embeds: newEmbeds });
        } catch (e) {
            console.error('Sync error:', e);
            if (e.code === 10003 || e.status === 404) {
                console.log(`Detected deleted channel ${channelId}, cleaning up...`);
                data.removeMessageId(instanceKey, channelId);
            }
        }
    }

    // NEW: Delete Reminder if exists
    try {
        const reminderId = data.getReminderMessageId(instanceKey, reaction.message.channel.id);
        if (reminderId) {
            const channel = reaction.message.channel;
            const reminderMsg = await channel.messages.fetch(reminderId).catch(() => null);
            if (reminderMsg) {
                await reminderMsg.delete();
                console.log(`Deleted reminder ${reminderId} for ${instanceKey}`);
                // Clear from data? Maybe not strictly needed if we just catch 404, but clean is better.
                // But setReminderMessageId doesn't have a clear function. 
                // We'll leave it, subsequent fetches will fail and be ignored.
            }
        }
    } catch (e) {
        console.error("Failed to delete reminder:", e);
    }

    // 5. Trigger Mood Prompt via DM
    try {
        const dmChannel = await user.createDM();
        // Customize prompt based on type? Or generic as requested?
        // "How are you feeling right now? (Reply here to log) :ribbon:"
        await dmChannel.send(`**${instance.name} (${timeSlot})**\nHow are you feeling right now? (Reply here to log) 🎀`);

        const filter = m => m.author.id === user.id;
        const collector = dmChannel.createMessageCollector({ filter, max: 1, time: 300000 }); // 5 min

        collector.on('collect', async m => {
            const content = m.content;

            // Log mood
            data.logMood(instanceKey, timezone, dayName, timeSlot, content);

            // Random Encouragement
            const encouragements = [
                "Proud of you! 💖",
                "Keep it up! ✨",
                "You're doing great! 🌸",
                "Sending you hugs! 🫂",
                "Good job taking care of yourself! 🌿",
                "You got this! 💫",
                "Stay awesome! 🍄",
                "Yay! All done! 🎉"
            ];
            const randomMsg = encouragements[Math.floor(Math.random() * encouragements.length)];

            await dmChannel.send(`✅ Logged! ${randomMsg}`);

            // Sync all messages again for mood update
            const updatedIds = data.getMessageIds(instanceKey);
            for (const [channelId, messageId] of Object.entries(updatedIds)) {
                try {
                    const ch = await client.channels.fetch(channelId);
                    const msg = await ch.messages.fetch(messageId);
                    const newEmbeds = generateReportEmbeds(instanceKey);
                    await msg.edit({ embeds: newEmbeds });
                } catch (e) {
                    console.error('Sync error:', e);
                    if (e.code === 10003 || e.status === 404) {
                        console.log(`Detected deleted channel ${channelId}, cleaning up...`);
                        data.removeMessageId(instanceKey, channelId);
                    }
                }
            }
        });

    } catch (e) {
        console.error("Failed to send DM for mood prompt:", e);
    }
};
