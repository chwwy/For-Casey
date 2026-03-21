const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const data = require('../features/medication/data');
const config = require('../features/medication/config');
const { ensurePersistentMessage } = require('../features/medication/index');

module.exports = async (interaction, client) => {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'log') {
            const day = interaction.options.getString('day');
            let slot = interaction.options.getString('slot');

            // Identify Instance
            const instance = config.getInstanceByChannel(interaction.channelId);
            if (!instance) {
                return interaction.reply({ content: 'This command can only be used in medication report channels.', ephemeral: true });
            }

            // Authorization Check
            if (interaction.user.id !== instance.backupUserId) {
                return interaction.reply({ content: '⛔ You are not authorized to log for this medication report.', ephemeral: true });
            }

            const { key: instanceKey, slots } = instance;

            // Validate Slot
            if (!slot) {
                if (slots.length === 1) {
                    slot = slots[0];
                } else {
                    return interaction.reply({ content: `Please specify a time slot (AM or PM) for this channel. Available: ${slots.join(', ')}`, ephemeral: true });
                }
            } else if (!slots.includes(slot)) {
                return interaction.reply({ content: `Invalid slot '${slot}' for this channel. Available: ${slots.join(', ')}`, ephemeral: true });
            }

            // Show Modal
            const modal = new ModalBuilder()
                .setCustomId(`log_modal:${slot}:${instanceKey}:${day}`)
                .setTitle(`Log ${day} ${slot}`);

            const moodInput = new TextInputBuilder()
                .setCustomId('mood')
                .setLabel('How did you feel? ❤️')
                .setPlaceholder('Enter your mood or notes (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(moodInput));

            await interaction.showModal(modal);

        } else if (interaction.commandName === 'remind') {
            const slot = interaction.options.getString('slot');
            const channelId = interaction.channelId;

            // Identify Instance
            const instance = config.getInstanceByChannel(channelId);
            if (!instance) {
                return interaction.reply({ content: 'This command can only be used in medication report channels.', ephemeral: true });
            }

            if (interaction.user.id !== instance.backupUserId) {
                return interaction.reply({ content: '⛔ You are not authorized to create a reminder in this channel.', ephemeral: true });
            }

            if (!instance.slots.includes(slot)) {
                return interaction.reply({ content: `Invalid slot '${slot}' for this channel. Available: ${instance.slots.join(', ')}`, ephemeral: true });
            }

            try {
                let reminderMsg = `Hey! Don't forget to take your ${slot} pill and log it! 💊`;
                if (instance.reminders && instance.reminders[slot]) {
                    reminderMsg = instance.reminders[slot].message;
                } else if (instance.reminder && slot === 'PM') {
                    reminderMsg = instance.reminder.message;
                } else if (instance.backupUserId) {
                    reminderMsg = `Hey, <@${instance.backupUserId}>! Don't forget to take your ${slot} pill and log it! 💊`;
                }

                const msg = await interaction.channel.send(reminderMsg);
                data.setReminderMessageId(instance.key, channelId, msg.id);
                return interaction.reply({ content: `✅ Created a ${slot} reminder!`, ephemeral: true });
            } catch (e) {
                console.error(`Failed to create reminder:`, e);
                return interaction.reply({ content: `Failed to create reminder.`, ephemeral: true });
            }
        }
    }

    // 2. Handle Button Interactions
    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('log_btn_')) {
            // log_btn_[slot]_[key]
            const parts = customId.split('_');
            const slot = parts[2];
            const instanceKey = parts[3];

            // Re-fetch config to verify
            const instance = config.instances[instanceKey];
            if (!instance) return;

            // Authorization Check
            if (interaction.user.id !== instance.backupUserId) {
                return interaction.reply({ content: '⛔ You are not authorized to log for this medication report.', ephemeral: true });
            }

            const day = data.getCurrentDayName(instance.timezone);

            // Show Modal
            const modal = new ModalBuilder()
                .setCustomId(`log_modal:${slot}:${instanceKey}:${day}`)
                .setTitle(`Log ${day} ${slot}`);

            const moodInput = new TextInputBuilder()
                .setCustomId('mood')
                .setLabel('How did you feel? ❤️')
                .setPlaceholder('Enter your mood or notes (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(moodInput));

            await interaction.showModal(modal);
        }
    }

    // 3. Handle Modal Submissions
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (customId.startsWith('log_modal:')) {
            const parts = customId.split(':');
            const slot = parts[1];
            const instanceKey = parts[2];
            const day = parts[3];

            const mood = interaction.fields.getTextInputValue('mood') || 'Logged';

            const instance = config.instances[instanceKey];
            if (!instance) return;

            // Log Checkmark AND Mood
            data.updateWeeklyCheck(instanceKey, instance.timezone, day, slot, true);
            data.logMood(instanceKey, instance.timezone, day, slot, mood);

            // Sync Messages
            await ensurePersistentMessage(client);

            // Cleanup: delete other messages in the channel to keep it clean
            try {
                const channel = interaction.channel;
                if (channel) {
                    const savedIds = data.getMessageIds(instanceKey);
                    const persistentMessageId = savedIds[channel.id];

                    if (persistentMessageId) { // Only cleanup in designated medication channels
                        const messages = await channel.messages.fetch({ limit: 50 });
                        for (const [msgId, msg] of messages) {
                            if (msgId !== persistentMessageId) {
                                await msg.delete().catch(() => { });
                            }
                        }
                        console.log(`Cleaned up extra messages in ${channel.id} after log.`);
                    }
                }
            } catch (e) {
                console.error("Failed to cleanup messages after modal:", e);
            }

            // Reply Success
            const encouragements = [
                "Proud of you! 💖", "Keep it up! ✨", "You're doing great! 🌸", "Sending you hugs! 🫂",
                "Good job taking care of yourself! 🌿", "You got this! 💫", "Stay awesome! 🍄", "Yay! All done! 🎉"
            ];
            const randomMsg = encouragements[Math.floor(Math.random() * encouragements.length)];

            await interaction.reply({ content: `✅ Logged for **${day} ${slot}**!\n"${mood}"\n\n${randomMsg}`, ephemeral: true });
        }
    }
};
