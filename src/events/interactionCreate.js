const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const data = require('../features/medication/data');
const config = require('../features/medication/config');
const { ensurePersistentMessage } = require('../features/medication/index');
const curhatFeature = require('../features/curhat');

let valorantBot;
async function getValorantBot() {
    if (!valorantBot) {
        valorantBot = await import('../features/valorant/discord/bot.js');
    }
    return valorantBot;
}

module.exports = async (interaction, client) => {
    try {
        // Route Valorant commands and autocompletes
        const valorantCommands = [
            "shop", "bundles", "bundle", "nightmarket", "balance", 
            "alert", "alerts", "update", "testalerts", "login", 
            "2fa", "cookies", "settings", "logout", "forget", 
            "collection", "battlepass", "stats", "account", "accounts", 
            "valstatus", "info", "profile",
            // HenrikDev API commands
            "rank", "matches", "mmrhistory", "leaderboard", "esports"
        ];

        if (interaction.isChatInputCommand() && valorantCommands.includes(interaction.commandName)) {
            const vBot = await getValorantBot();
            return await vBot.handleInteraction(interaction);
        }

        if (interaction.isAutocomplete() && valorantCommands.includes(interaction.commandName)) {
            const vBot = await getValorantBot();
            return await vBot.handleInteraction(interaction);
        }

        if (interaction.isButton()) {
            const customId = interaction.customId;
            const isValButton = 
                customId.startsWith("removealert/") ||
                customId.startsWith("retry_auth") ||
                customId.startsWith("changealertspage") ||
                customId.startsWith("changestatspage") ||
                customId.startsWith("clpage") ||
                customId.startsWith("clswitch") ||
                customId.startsWith("clwpage") ||
                customId.startsWith("clwswitch") ||
                customId.startsWith("viewbundle") ||
                customId.startsWith("account") ||
                customId.startsWith("gotopage");

            if (isValButton) {
                const vBot = await getValorantBot();
                return await vBot.handleInteraction(interaction);
            }
        }

        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            const valSelects = [
                "skin-select", "skin-select-stats", "bundle-select", 
                "set-setting", "select-skin-with-level", "select-skin-level", "get-level-video"
            ];
            if (valSelects.includes(customId)) {
                const vBot = await getValorantBot();
                return await vBot.handleInteraction(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            if (customId.startsWith("gotopage")) {
                const vBot = await getValorantBot();
                return await vBot.handleInteraction(interaction);
            }
        }

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
                    return interaction.reply({ content: `Please specify a time slot. Available: ${slots.join(', ')}`, ephemeral: true });
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

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`remind_again_${slot}_${instance.key}`)
                        .setLabel('Remind me again')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⏰')
                );

                const msg = await interaction.channel.send({ content: reminderMsg, components: [row] });
                data.setReminderMessageId(instance.key, channelId, msg.id);
                return interaction.reply({ content: `✅ Created a ${slot} reminder in this channel!`, ephemeral: true });
            } catch (e) {
                console.error(`Failed to create reminder:`, e);
                return interaction.reply({ content: `Failed to create reminder.`, ephemeral: true });
            }
        } else if (interaction.commandName === 'banchannel') {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '⛔ You must be an Administrator to run this command.', ephemeral: true });
            }

            const autoBanConfig = require('../features/autoBan/config');
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'add') {
                const channel = interaction.options.getChannel('channel');
                const added = autoBanConfig.addBanChannel(channel.id);
                if (added) {
                    return interaction.reply({ content: `✅ Added <#${channel.id}> to the auto-ban list.`, ephemeral: true });
                } else {
                    return interaction.reply({ content: `ℹ️ <#${channel.id}> is already in the auto-ban list.`, ephemeral: true });
                }
            } else if (subcommand === 'remove') {
                const channel = interaction.options.getChannel('channel');
                const removed = autoBanConfig.removeBanChannel(channel.id);
                if (removed) {
                    return interaction.reply({ content: `✅ Removed <#${channel.id}> from the auto-ban list.`, ephemeral: true });
                } else {
                    return interaction.reply({ content: `ℹ️ <#${channel.id}> was not in the auto-ban list.`, ephemeral: true });
                }
            } else if (subcommand === 'list') {
                const channels = autoBanConfig.getBanChannelIds();
                if (channels.length === 0) {
                    return interaction.reply({ content: 'ℹ️ There are no channels configured for auto-ban.', ephemeral: true });
                }
                const list = channels.map(id => `- <#${id}> (${id})`).join('\n');
                return interaction.reply({ content: `**Configured Auto-Ban Channels:**\n${list}`, ephemeral: true });
            }
        } else if (interaction.commandName === 'curhat') {
            return curhatFeature.handleCurhatCommand(interaction);
        } else if (interaction.commandName === 'mood-dashboard') {
            return require('../features/mood-tracker').handleCommand(interaction);
        }
    }

    // 2. Handle Button Interactions
    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (
            customId === 'mood_log' ||
            customId === 'meds_log' ||
            customId === 'sleep_log' ||
            customId === 'caffeine_log' ||
            customId === 'chart_view' ||
            customId.startsWith('caffeine_other_btn:') ||
            customId.startsWith('caffeine_type:')
        ) {
            return require('../features/mood-tracker').handleButton(interaction);
        }

        if (customId.startsWith('curhat_access_')) {
            return curhatFeature.handleCurhatButton(interaction);
        } else if (customId.startsWith('curhat_destroy_')) {
            return curhatFeature.handleDestroyButton(interaction);
        } else if (customId.startsWith('note_btn_')) {
            // note_btn_[slot]_[key]
            const parts = customId.split('_');
            let slot = parts[2];
            const instanceKey = parts[3];

            // Re-fetch config to verify
            const instance = config.instances[instanceKey];
            if (!instance) return;

            // Authorization Check
            if (interaction.user.id !== instance.backupUserId) {
                return interaction.reply({ content: '⛔ You are not authorized to log for this medication report.', ephemeral: true });
            }

            if (slot === 'AUTO') {
                const hour = data.getNow(instance.timezone).getHours();
                slot = (hour >= 6 && hour < 18) ? 'AM' : 'PM';
            }

            const day = data.getCurrentDayName(instance.timezone);

            if (instanceKey === 'nao' || instanceKey === 'nightly') {
                data.updateWeeklyCheck(instanceKey, instance.timezone, day, slot, true);
                await ensurePersistentMessage(client);

                try {
                    const channel = interaction.channel;
                    if (channel) {
                        const savedIds = data.getMessageIds(instanceKey);
                        const persistentMessageId = savedIds[channel.id];
                        if (persistentMessageId) {
                            const messages = await channel.messages.fetch({ limit: 50 });
                            for (const [msgId, msg] of messages) {
                                if (msgId !== persistentMessageId) {
                                    await msg.delete().catch(() => { });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Cleanup failed:", e);
                }

                return interaction.reply({ content: `✅ Logged for **${day} ${slot}**!`, ephemeral: true });
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
        } else if (customId.startsWith('mark_btn_')) {
            const parts = customId.split('_');
            let slot = parts[2];
            const instanceKey = parts[3];

            const instance = config.instances[instanceKey];
            if (!instance) return;

            if (interaction.user.id !== instance.backupUserId) {
                return interaction.reply({ content: '⛔ You are not authorized to log for this medication report.', ephemeral: true });
            }

            if (slot === 'AUTO') {
                const hour = data.getNow(instance.timezone).getHours();
                slot = (hour >= 6 && hour < 18) ? 'AM' : 'PM';
            }

            const day = data.getCurrentDayName(instance.timezone);

            // Just update the checklist and sync the message
            data.updateWeeklyCheck(instanceKey, instance.timezone, day, slot, true);
            await ensurePersistentMessage(client);

            // Cleanup: delete other messages in the channel to keep it clean
            try {
                const channel = interaction.channel;
                if (channel) {
                    const savedIds = data.getMessageIds(instanceKey);
                    const persistentMessageId = savedIds[channel.id];

                    if (persistentMessageId) { 
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
                console.error("Failed to cleanup messages after mark:", e);
            }

            const encouragements = [
                "Proud of you! 💖", "Keep it up! ✨", "You're doing great! 🌸", "Sending you hugs! 🫂",
                "Good job taking care of yourself! 🌿", "You got this! 💫", "Stay awesome! 🍄", "Yay! All done! 🎉"
            ];
            const randomMsg = encouragements[Math.floor(Math.random() * encouragements.length)];

            await interaction.reply({ content: `✅ Marked **${day} ${slot}** as done!\n\n${randomMsg}`, ephemeral: true });
        } else if (customId.startsWith('remind_again_')) {
            const parts = customId.split('_');
            const slot = parts[2];
            const instanceKey = parts[3];

            const instance = config.instances[instanceKey];
            if (!instance) return;

            if (interaction.user.id !== instance.backupUserId) {
                return interaction.reply({ content: '⛔ You are not authorized.', ephemeral: true });
            }

            await interaction.reply({ content: `Got it! I will remind you again about your ${slot} pill in 30 minutes. ⏰`, ephemeral: true });

            setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(interaction.channelId);
                    if (!channel) return;

                    let reminderMsg = `Hey! Don't forget to take your ${slot} pill! 💊`;
                    if (instance.reminders && instance.reminders[slot]) {
                        reminderMsg = instance.reminders[slot].message;
                    } else if (instance.reminder && slot === 'PM') {
                        reminderMsg = instance.reminder.message;
                    } else if (instance.backupUserId) {
                        reminderMsg = `Hey, <@${instance.backupUserId}>! Don't forget to take your ${slot} pill and log it! 💊`;
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`remind_again_${slot}_${instanceKey}`)
                            .setLabel('Remind me again')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⏰')
                    );

                    const msg = await channel.send({ content: `**Reminder!**\n${reminderMsg}`, components: [row] });
                    data.setReminderMessageId(instanceKey, channel.id, msg.id);
                } catch (e) {
                    console.error('Failed to send deferred reminder:', e);
                }
            }, 30 * 60 * 1000);
        }
    }

    // Handle Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        if (
            customId.startsWith('mood_core:') ||
            customId.startsWith('mood_secondary:') ||
            customId.startsWith('mood_specific:') ||
            customId.startsWith('sleep_quality:') ||
            customId.startsWith('chart_range:') ||
            customId.startsWith('meds_select:')
        ) {
            return require('../features/mood-tracker').handleSelectMenu(interaction);
        }
    }

    // 3. Handle Modal Submissions
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (
            customId.startsWith('mood_note_modal:') ||
            customId.startsWith('meds_modal:') ||
            customId.startsWith('sleep_hours_modal:') ||
            customId.startsWith('caffeine_other_modal:') ||
            customId.startsWith('meds_dosage_modal:')
        ) {
            return require('../features/mood-tracker').handleModal(interaction);
        }

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
    } catch (error) {
        console.error('Unhandled error in interactionCreate:', error);
    }
};
