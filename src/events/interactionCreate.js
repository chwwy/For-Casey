const data = require('../features/medication/data');
const config = require('../features/medication/config');
const { generateReportEmbeds } = require('../features/medication/index');

module.exports = async (interaction, client) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'log') {
        const day = interaction.options.getString('day');
        let slot = interaction.options.getString('slot');

        // Identify Instance
        const instance = config.getInstanceByChannel(interaction.channelId);
        if (!instance) {
            return interaction.reply({ content: 'This command can only be used in medication report channels.', ephemeral: true });
        }

        // Authorization Check
        // Only allow the configured backupUserId for this instance to use the command
        if (interaction.user.id !== instance.backupUserId) {
            return interaction.reply({ content: '⛔ You are not authorized to log for this medication report.', ephemeral: true });
        }

        const { key: instanceKey, timezone, slots } = instance;

        // Defer immediately to prevent timeout
        await interaction.deferReply({ ephemeral: true });

        // Validate Slot
        if (!slot) {
            if (slots.length === 1) {
                slot = slots[0]; // Default to the only slot
            } else {
                return interaction.editReply({ content: `Please specify a time slot (AM or PM) for this channel. Available: ${slots.join(', ')}` });
            }
        } else {
            if (!slots.includes(slot)) {
                return interaction.editReply({ content: `Invalid slot '${slot}' for this channel. Available: ${slots.join(', ')}` });
            }
        }

        // Log Checkmark
        // We use the provided day, not "today"
        data.updateWeeklyCheck(instanceKey, timezone, day, slot, true);

        // Update Embeds
        const savedIds = data.getMessageIds(instanceKey);
        for (const [channelId, messageId] of Object.entries(savedIds)) {
            try {
                const channel = await client.channels.fetch(channelId);
                const msg = await channel.messages.fetch(messageId);
                const newEmbeds = generateReportEmbeds(instanceKey);
                await msg.edit({ embeds: newEmbeds });
            } catch (e) {
                console.error('Sync error:', e);
            }
        }

        // Send DM Prompt
        try {
            const user = interaction.user;
            const dmChannel = await user.createDM();
            await dmChannel.send(`**${instance.name} (${day} ${slot})**\nHow were you feeling last ${day}? (Reply here to log) 🎀`);

            const filter = m => m.author.id === user.id;
            const collector = dmChannel.createMessageCollector({ filter, max: 1, time: 300000 }); // 5 min

            collector.on('collect', async m => {
                const content = m.content;
                // Log mood for the SPECIFIC day
                data.logMood(instanceKey, timezone, day, slot, content);

                await dmChannel.send("✅ Logged!");

                // Sync Embeds Again
                const updatedIds = data.getMessageIds(instanceKey);
                for (const [channelId, messageId] of Object.entries(updatedIds)) {
                    try {
                        const ch = await client.channels.fetch(channelId);
                        const msg = await ch.messages.fetch(messageId);
                        const newEmbeds = generateReportEmbeds(instanceKey);
                        await msg.edit({ embeds: newEmbeds });
                    } catch (e) { }
                }
            });

            await interaction.editReply({ content: `✅ Logged ${day} ${slot} checkmark! Check your DMs to log your mood.` });

        } catch (e) {
            console.error("Failed to prompt DM:", e);
            await interaction.editReply({ content: `✅ Logged ${day} ${slot} checkmark! (Failed to send DM)` });
        }
    }
};
