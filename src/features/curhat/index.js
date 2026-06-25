const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const data = require('./data');

// Map to keep track of active inactivity timeouts in memory
const inactivityTimeouts = new Map();

// Inactivity timeout duration: 2 hours (in milliseconds)
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * Resets the 2-hour inactivity timer for a curhat channel.
 * Clears the old timer, updates the activity timestamp in the database, and schedules a new deletion.
 */
function resetInactivityTimer(client, channelId) {
    // Clear existing timer if any
    const existing = inactivityTimeouts.get(channelId);
    if (existing) {
        clearTimeout(existing);
    }

    // Update lastActivity in persistent storage
    data.updateActivity(channelId);

    // Set a new 2-hour inactivity timeout
    const timeout = setTimeout(async () => {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                await channel.delete('Curhat channel inactive for 2 hours');
                console.log(`Deleted curhat channel ${channelId} due to 2 hours of inactivity.`);
            }
        } catch (error) {
            // Ignore if channel was already deleted (error code 10003 or similar)
            if (error.code !== 10003) {
                console.error(`Failed to delete inactive channel ${channelId}:`, error);
            }
        }
    }, INACTIVITY_TIMEOUT_MS);

    inactivityTimeouts.set(channelId, timeout);
}

/**
 * Initializes the inactivity scheduler on bot startup.
 * Evaluates all active channels in the database and either deletes them immediately
 * (if they have been idle for >= 2 hours) or schedules their deletion for the remaining time.
 */
function initInactivityScheduler(client) {
    const channels = data.getAllChannels();
    const now = Date.now();

    console.log(`Initializing curhat inactivity scheduler for ${Object.keys(channels).length} channels...`);

    for (const [channelId, config] of Object.entries(channels)) {
        const elapsed = now - config.lastActivity;

        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            console.log(`Curhat channel ${channelId} was inactive for more than 2 hours during bot offline. Deleting...`);
            client.channels.fetch(channelId)
                .then(async (channel) => {
                    if (channel) {
                        await channel.delete('Curhat channel inactive on startup check');
                    }
                })
                .catch((err) => {
                    // Clean up if channel no longer exists
                    data.removeChannel(channelId);
                    if (err.code !== 10003) {
                        console.error(`Failed to delete channel ${channelId} on startup:`, err);
                    }
                });
        } else {
            const remaining = INACTIVITY_TIMEOUT_MS - elapsed;
            console.log(`Scheduling inactivity check for curhat channel ${channelId} in ${Math.round(remaining / 60000)} minutes.`);

            const timeout = setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(channelId).catch(() => null);
                    if (channel) {
                        await channel.delete('Curhat channel inactive for 2 hours');
                        console.log(`Deleted curhat channel ${channelId} due to 2 hours of inactivity.`);
                    }
                } catch (error) {
                    if (error.code !== 10003) {
                        console.error(`Failed to delete inactive channel ${channelId}:`, error);
                    }
                }
            }, remaining);

            inactivityTimeouts.set(channelId, timeout);
        }
    }
}

/**
 * Handles the execution of the /curhat slash command.
 * Creates a private text channel, sends a persistent control message, and replies with an access button.
 */
async function handleCurhatCommand(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const guild = interaction.guild;
    
    if (!guild) {
        return interaction.reply({ content: '⛔ This command can only be used within a server.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const username = interaction.user.username.toLowerCase();
        const parentId = interaction.channel.parentId;

        // 1. Create the private text channel
        const channel = await guild.channels.create({
            name: `curhat-${username}`,
            type: ChannelType.GuildText,
            parent: parentId || null,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                    ],
                }
            ]
        });

        // 2. Create and send the persistent control message inside the private channel
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`curhat_destroy_${channel.id}`)
                .setLabel('Destroy Channel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

        const controlContent = `🔒 **Curhat Channel Controls**\n\nAll messages sent in this channel (except this one) will be automatically deleted after **${seconds}** seconds.\nThis channel will be deleted automatically if there is no activity for 2 hours.\n\n**Users with access:**\n- <@${interaction.user.id}>`;

        const controlMessage = await channel.send({
            content: controlContent,
            components: [controlRow]
        });

        // 3. Save channel metadata to the database
        data.addChannel(channel.id, seconds, interaction.user.id, controlMessage.id);

        // 4. Start the 2-hour inactivity timer
        resetInactivityTimer(interaction.client, channel.id);

        // 5. Reply in the original channel with the access button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`curhat_access_${channel.id}`)
                .setLabel('Access Channel')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔑')
        );

        const initialContent = `Channel created. Click the button to access channel.\n\n**Users with access:**\n- <@${interaction.user.id}>`;

        await interaction.editReply({
            content: initialContent,
            components: [row]
        });

    } catch (error) {
        console.error('Error creating curhat channel:', error);
        await interaction.editReply({
            content: '⛔ Failed to create a private channel. Please ensure the bot has permission to manage channels.'
        });
    }
}

/**
 * Handles clicks on the "Access Channel" button.
 * Grants permission, updates both the original slash command reply and the persistent control message.
 */
async function handleCurhatButton(interaction) {
    const channelId = interaction.customId.replace('curhat_access_', '');

    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        data.removeChannel(channelId);
        return interaction.reply({ content: '⛔ This curhat channel no longer exists.', ephemeral: true });
    }

    const hasAccess = channel.permissionOverwrites.cache.some(overwrite =>
        overwrite.id === interaction.user.id &&
        overwrite.type === 1 && // Member type
        overwrite.allow.has(PermissionFlagsBits.ViewChannel)
    );

    if (hasAccess) {
        return interaction.reply({
            content: `You already have access to this channel! Click here to join: <#${channelId}>`,
            ephemeral: true
        });
    }

    try {
        // 1. Grant access
        await channel.permissionOverwrites.create(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        // 2. Fetch all members who now have access from permission overwrites
        const membersWithAccess = [];
        for (const [id, overwrite] of channel.permissionOverwrites.cache) {
            if (overwrite.type === 1 && id !== interaction.client.user.id) { // Member overwrite and not the bot
                if (overwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
                    membersWithAccess.push(id);
                }
            }
        }

        if (!membersWithAccess.includes(interaction.user.id)) {
            membersWithAccess.push(interaction.user.id);
        }

        const userList = membersWithAccess.map(id => `- <@${id}>`).join('\n');

        // 3. Update the original command reply message
        const updatedContent = `Channel created. Click the button to access channel.\n\n**Users with access:**\n${userList}`;
        await interaction.update({
            content: updatedContent,
            components: interaction.message.components
        });

        // 4. Update the persistent control message inside the private channel
        const channelConfig = data.getChannel(channelId);
        if (channelConfig && channelConfig.controlMessageId) {
            const controlMessage = await channel.messages.fetch(channelConfig.controlMessageId).catch(() => null);
            if (controlMessage) {
                const updatedControlContent = `🔒 **Curhat Channel Controls**\n\nAll messages sent in this channel (except this one) will be automatically deleted after **${channelConfig.seconds}** seconds.\nThis channel will be deleted automatically if there is no activity for 2 hours.\n\n**Users with access:**\n${userList}`;
                
                await controlMessage.edit({
                    content: updatedControlContent,
                    components: controlMessage.components
                }).catch(err => console.error('Failed to edit control message:', err));
            }
        }

        // 5. Send ephemeral link to the user
        await interaction.followUp({
            content: `✅ You now have access to the channel! Click here to join: <#${channelId}>`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error granting access to curhat channel:', error);
        await interaction.reply({
            content: '⛔ Failed to grant access to the channel. Please contact an administrator.',
            ephemeral: true
        });
    }
}

/**
 * Handles clicks on the "Destroy Channel" button.
 * Validates that the clicker is the channel creator, and deletes the channel.
 */
async function handleDestroyButton(interaction) {
    const channelId = interaction.customId.replace('curhat_destroy_', '');
    const channelConfig = data.getChannel(channelId);

    if (!channelConfig) {
        // Fallback: If not in our database but user has Manage Channels, let them delete it
        if (interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '⏳ Destroying unmanaged channel...', ephemeral: true });
            return interaction.channel.delete().catch(() => {});
        }
        return interaction.reply({ content: '⛔ This channel is no longer managed by the curhat feature.', ephemeral: true });
    }

    // Authorization Check: Only the creator can click this
    if (interaction.user.id !== channelConfig.creatorId) {
        return interaction.reply({
            content: `⛔ Only the channel creator (<@${channelConfig.creatorId}>) can destroy this channel.`,
            ephemeral: true
        });
    }

    await interaction.reply({ content: '⏳ Destroying channel...', ephemeral: true });

    try {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (channel) {
            await channel.delete('Destroyed by creator');
        }
    } catch (error) {
        console.error('Error deleting channel via destroy button:', error);
        await interaction.followUp({
            content: '⛔ Failed to delete the channel. Please delete it manually.',
            ephemeral: true
        });
    }
}

/**
 * Intercepts messages in curhat channels.
 * Resets the 2-hour inactivity timer, and schedules the message's autodeletion (unless it is the control message).
 */
function handleMessage(message) {
    const channelConfig = data.getChannel(message.channelId);
    if (!channelConfig) return;

    // Reset the 2-hour inactivity timer
    resetInactivityTimer(message.client, message.channelId);

    // CRITICAL: Do NOT delete the persistent control message
    if (message.id === channelConfig.controlMessageId) return;

    const seconds = channelConfig.seconds;

    setTimeout(async () => {
        try {
            if (!message.channel || !message.channel.messages) return;
            const msg = await message.channel.messages.fetch(message.id).catch(() => null);
            if (msg) {
                await msg.delete();
            }
        } catch (error) {
            if (error.code !== 10008) { // Ignore if already deleted
                console.error(`Failed to delete message ${message.id} in curhat channel:`, error);
            }
        }
    }, seconds * 1000);
}

/**
 * Cleans up memory timers and database records when a curhat channel is deleted.
 */
function handleChannelDelete(channel) {
    if (data.isCurhatChannel(channel.id)) {
        // Clear in-memory inactivity timer
        const timeout = inactivityTimeouts.get(channel.id);
        if (timeout) {
            clearTimeout(timeout);
            inactivityTimeouts.delete(channel.id);
        }
        data.removeChannel(channel.id);
        console.log(`Curhat channel ${channel.id} was deleted. Cleaned up store and timers.`);
    }
}

module.exports = {
    handleCurhatCommand,
    handleCurhatButton,
    handleDestroyButton,
    handleMessage,
    handleChannelDelete,
    initInactivityScheduler
};
