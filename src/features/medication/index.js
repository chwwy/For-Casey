const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const data = require('./data');
const config = require('./config');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateReportEmbeds(instanceKey) {
    const instanceConfig = config.instances[instanceKey];
    if (!instanceConfig) return [];

    const instanceData = data.getInstanceData(instanceKey, instanceConfig.timezone);
    const days = instanceData.days || {};

    let totalCount = 0;
    const slots = instanceConfig.slots; // ['AM', 'PM'] or ['PM']

    // Helper to format a day's status
    const formatDay = (day) => {
        const d = days[day] || {};

        let statusLines = [];
        for (const slot of slots) {
            // Checkmark logic
            let checked = '';
            if (d[slot]) {
                totalCount++;
                if (typeof d[slot] === 'string' && d[slot].length > 0) {
                    checked = `✅ ${d[slot]}`; // e.g. "✅ 09:15 PM"
                } else {
                    checked = '✅';
                }
            }

            statusLines.push(`\`${slot}:\` ${checked}`);
        }
        return `**${day}**\n${statusLines.join('\n')}\n`;
    };

    // Calculate total needed
    // 7 days * number of slots
    const totalPossible = 7 * slots.length;

    // Field 1: Monday - Thursday
    const part1Days = DAY_NAMES.slice(0, 4);
    const part1Value = part1Days.map(formatDay).join('\n');

    // Field 2: Friday - Sunday
    const part2Days = DAY_NAMES.slice(4);
    const part2Value = part2Days.map(formatDay).join('\n') + `\n**Weekly Progress:**\n${totalCount}/${totalPossible}`;

    const reportEmbed = new EmbedBuilder()
        .setTitle(`${instanceConfig.name} 💊`)
        .setThumbnail("https://yt3.ggpht.com/kShOeDVt42lWaVio1oEUV60wr9HTuIvw_IOsw66vdNQ112xvZrCwzQUVHyZJllpslIhUeqsnLw=s176-c-k-c0x00ffffff-no-rj-mo")
        .setDescription("Did you take your pills?")
        .setColor(16765404)
        .addFields(
            { name: "**Start of Week**", value: part1Value, inline: true },
            { name: "**End of Week**", value: part2Value, inline: true }
        );

    // Second Embed: Mood Tracker
    const moodEmbed = new EmbedBuilder()
        .setTitle("How did you feel? ❤️")
        .setColor(16765404)
        .addFields(DAY_NAMES.map(day => {
            const d = days[day] || {};
            const mood = d.mood || {};

            let moodLines = [];
            for (const slot of slots) {
                moodLines.push(`\`${slot}:\` ${mood[slot] || ''}`);
            }

            return {
                name: day,
                value: moodLines.join('\n'),
                inline: false
            };
        }));

    return [reportEmbed, moodEmbed];
}

async function ensurePersistentMessage(client) {
    // Iterate over all configured instances
    for (const [key, instanceConfig] of Object.entries(config.instances)) {
        const savedIds = data.getMessageIds(key);

        for (const channelId of instanceConfig.channels) {
            const channel = await client.channels.fetch(channelId).catch(console.error);
            if (!channel) continue;

            let message;
            if (savedIds[channelId]) {
                try {
                    message = await channel.messages.fetch(savedIds[channelId]);
                } catch (e) {
                    console.log(`Message not found in ${channelId} for ${key}, creating new one.`);
                }
            }

            const embeds = generateReportEmbeds(key);

            if (message) {
                await message.edit({ embeds: embeds });
            } else {
                message = await channel.send({ embeds: embeds });
                data.setMessageId(key, channelId, message.id);
            }

            // Always ensure reactions exist based on slots
            try {
                // Cleanup unwanted reactions (Legacy)
                const unwanted = ['📓', '🛏️'];
                for (const emoji of unwanted) {
                    const reaction = message.reactions.cache.find(r => r.emoji.name === emoji);
                    if (reaction) {
                        try {
                            await reaction.remove();
                        } catch (e) { /* ignore cleanup errors */ }
                    }
                }

                if (instanceConfig.slots.includes('AM')) {
                    await message.react('🌞');
                }
                if (instanceConfig.slots.includes('PM')) {
                    await message.react('💤');
                }
            } catch (error) {
                console.error('Failed to react to message:', error);
            }
        }
    }
}

async function resetAndClear(client, force = false) {
    console.log('Running medication reset check...');

    for (const [key, instanceConfig] of Object.entries(config.instances)) {
        // Only reset if week changed (or forced)
        // We assume data.shouldReset is available from step 319
        if (!force && !data.shouldReset(key, instanceConfig.timezone)) {
            continue;
        }

        console.log(`Resetting instance: ${instanceConfig.name}`);

        // 1. Send Backup DM
        const currentData = data.peekInstanceData(key); // Assuming peekInstanceData from step 319
        const backupUserId = instanceConfig.backupUserId;

        if (currentData && backupUserId) {
            try {
                const user = await client.users.fetch(backupUserId);
                if (user) {
                    const reportEmbed = new EmbedBuilder()
                        .setTitle(`Weekly Backup: ${instanceConfig.name}`)
                        .setDescription(`Week starting: ${currentData.currentWeekStart || 'Unknown'}`)
                        .setColor(16765404);

                    const days = currentData.days || {};
                    let summary = "";
                    for (const day of DAY_NAMES) {
                        const d = days[day] || {};
                        const checks = instanceConfig.slots.map(s => `${s}: ${d[s] ? '✅' : '❌'}`).join(', ');
                        const moodMap = d.mood || {};
                        const moods = instanceConfig.slots.map(s => `${s} Mood: ${moodMap[s] || '-'}`).join('\n');
                        summary += `**${day}**\n${checks}\n${moods}\n\n`;
                    }
                    // Truncate safely
                    if (summary.length > 4000) summary = summary.substring(0, 4000) + "...";

                    reportEmbed.setDescription(summary);

                    await user.send({ content: `Here is your weekly medication backup! 💊`, embeds: [reportEmbed] });
                    console.log(`Sent backup to ${backupUserId}`);
                }
            } catch (e) {
                console.error(`Failed to send backup DM for ${key}:`, e);
            }
        }

        // 2. Perform Reset
        data.resetWeekData(key, instanceConfig.timezone);

        // 3. Update Messages
        const savedIds = data.getMessageIds(key);
        for (const [channelId, messageId] of Object.entries(savedIds)) {
            try {
                const channel = await client.channels.fetch(channelId);
                const message = await channel.messages.fetch(messageId);
                if (message) {
                    // Re-react and update
                    await message.reactions.removeAll();
                    if (instanceConfig.slots.includes('AM')) {
                        await message.react('🌞');
                    }
                    if (instanceConfig.slots.includes('PM')) {
                        await message.react('💤');
                    }

                    const embeds = generateReportEmbeds(key);
                    await message.edit({ embeds: embeds });
                }
            } catch (e) {
                console.error(`Failed to reset message in ${channelId}:`, e);
                if (e.code === 10003 || e.status === 404) {
                    console.log(`Detected deleted channel ${channelId}, cleaning up...`);
                    data.removeMessageId(key, channelId);
                }
            }
        }
    }
}

function initScheduler(client) {
    // Check for messages on startup
    ensurePersistentMessage(client);

    // Schedule: Every hour check for week rollover
    // This allows timezone-specific resets (e.g. 7 AM Jakarta vs 6 PM Chicago)
    cron.schedule('0 * * * *', () => {
        resetAndClear(client);
    });
    console.log('Medication scheduler initialized (Hourly Check).');

    // Custom Reminder Schedules
    for (const [key, instanceConfig] of Object.entries(config.instances)) {
        if (instanceConfig.reminder) {
            console.log(`Scheduling reminder for ${key} at ${instanceConfig.reminder.time} (${instanceConfig.timezone})`);

            cron.schedule(instanceConfig.reminder.time, async () => {
                console.log(`Sending reminder for ${key}...`);
                for (const channelId of instanceConfig.channels) {
                    try {
                        const channel = await client.channels.fetch(channelId);
                        const msg = await channel.send(instanceConfig.reminder.message);
                        data.setReminderMessageId(key, channelId, msg.id);
                    } catch (e) {
                        console.error(`Failed to send reminder to ${channelId}:`, e);
                    }
                }
            }, {
                timezone: instanceConfig.timezone
            });
        }
    }

    // Daily Midnight Cleanup (Reset Buttons for new day)
    for (const [key, instanceConfig] of Object.entries(config.instances)) {
        console.log(`Scheduling daily reaction cleanup for ${key} at 00:00 (${instanceConfig.timezone})`);

        cron.schedule('0 0 * * *', async () => {
            console.log(`Running midnight cleanup for ${key}...`);
            // Clear reactions to reset the "buttons" for the new day
            // We use removeAll() to avoid triggering individual remove events that might mess with data
            const savedIds = data.getMessageIds(key);
            for (const [channelId, messageId] of Object.entries(savedIds)) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    const message = await channel.messages.fetch(messageId);
                    if (message) {
                        await message.reactions.removeAll();
                        // Re-add buttons
                        if (instanceConfig.slots.includes('AM')) {
                            await message.react('🌞');
                        }
                        if (instanceConfig.slots.includes('PM')) {
                            await message.react('💤');
                        }
                        console.log(`Reset reactions for ${key} in ${channelId}`);
                    }
                } catch (e) {
                    console.error(`Failed to cleanup reactions for ${channelId}:`, e);
                    if (e.code === 10003 || e.status === 404) {
                        console.log(`Detected deleted channel ${channelId}, cleaning up...`);
                        data.removeMessageId(key, channelId);
                    }
                }
            }
        }, {
            timezone: instanceConfig.timezone
        });
    }

    // Check immediately on startup too, in case we missed it while offline
    // Wait a bit for client to be fully ready? client is passed in so it is ready.
    setTimeout(() => resetAndClear(client), 5000);
}

module.exports = {
    generateReportEmbeds,
    initScheduler,
    ensurePersistentMessage,
    resetAndClear,
    handleMessage: async (message) => {
        if (!message.content.startsWith('!pill')) return false;

        const args = message.content.split(' ');
        const command = args[1]?.toLowerCase();

        // Global refresh command
        if (command === 'refresh' || command === 'check') {
            await ensurePersistentMessage(message.client);
            message.reply('Medication report refreshed/restored.');
        } else if (command === 'reset') {
            // Force reset manually
            await resetAndClear(message.client, true);
            message.reply('Weekly data reset manually (Backups sent).');
        } else if (command === 'remind') {
            const channelId = message.channel.id;
            let triggered = false;

            for (const [key, instanceConfig] of Object.entries(config.instances)) {
                // Check if this channel is part of an instance and has a reminder
                if (instanceConfig.channels.includes(channelId) && instanceConfig.reminder) {
                    try {
                        const msg = await message.channel.send(instanceConfig.reminder.message);
                        data.setReminderMessageId(key, channelId, msg.id);
                        triggered = true;
                        console.log(`Manually triggered reminder for ${key} in ${channelId}`);
                    } catch (e) {
                        console.error(`Failed to send manual reminder:`, e);
                    }
                }
            }

            if (triggered) {
                // Optional: Delete the command message to keep it clean
                message.delete().catch(() => { });
            } else {
                message.reply("No reminder configured for this channel.");
            }
        } else {
            message.reply('Use `!pill refresh` or `!pill remind` to restore or test.');
        }
        return true;
    },
    ensurePersistentMessage,
    resetAndClear
};
