const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const db = require('./db');
const { updateDashboard } = require('./dashboard');
const { WHEEL, CORE_EMOJIS } = require('./wheel');
const { generateChartUrls, getCorrelationStats } = require('./chart');

// Startup initializations - sync and update every dashboard in the DB
async function initDashboards(client) {
  try {
    const dashboards = db.getAllDashboards();
    console.log(`Initializing and sync'ing ${dashboards.length} Mood Tracker Dashboards...`);
    for (const dash of dashboards) {
      await updateDashboard(client, dash);
    }
  } catch (error) {
    console.error('Error during initDashboards:', error);
  }
}

// Slash command: /mood-dashboard setup
async function handleCommand(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  const timezone = interaction.options.getString('timezone') || 'UTC';
  const meds = interaction.options.getString('meds') || null;

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch (e) {
    return interaction.reply({ content: `❌ Invalid timezone \`${timezone}\`. Please use a valid IANA timezone (e.g. \`America/Chicago\` or \`Asia/Jakarta\`).`, ephemeral: true });
  }

  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (e) {
    console.error('Failed to defer slash command interaction:', e);
    return;
  }

  try {
    const ownerId = interaction.user.id;
    const channelId = interaction.channelId;

    // Check if the user already has a dashboard in this channel. If so, replace it.
    const oldDash = db.getDashboardByOwner(ownerId, channelId);
    if (oldDash) {
      try {
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          const oldMsg = await channel.messages.fetch(oldDash.message_id).catch(() => null);
          if (oldMsg) {
            await oldMsg.delete().catch(() => { });
          }
        }
      } catch (e) {
        console.error('Failed to delete old dashboard message:', e);
      }
    }

    // Initial empty/placeholder embed to post
    const placeholderEmbed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Mood & Wellness Board`)
      .setDescription('Initializing dashboard stats, please wait...')
      .setColor(0xffd1dc);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mood_log')
        .setLabel('Log Mood')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝')
    );

    // Post to the current channel
    const msg = await interaction.channel.send({
      embeds: [placeholderEmbed],
      components: [row]
    });

    // Save/Overwrite in database
    db.saveDashboard(interaction.guildId, channelId, msg.id, ownerId, timezone, meds);

    // Generate real stats
    await updateDashboard(interaction.client, msg.id);

    await interaction.editReply({
      content: `✅ Your dashboard has been created and is active!\nMessage link: ${msg.url}`
    });
  } catch (e) {
    console.error('Failed to setup dashboard:', e);
    await interaction.editReply({ content: '❌ Failed to create the dashboard message in this channel.' });
  }
}

// Helper to check ownership of a dashboard message
function verifyDashboardOwnership(interaction, dashMsgId) {
  const dashboard = db.getDashboardByMessageId(dashMsgId);
  if (!dashboard) return null;

  if (interaction.user.id !== dashboard.owner_id) {
    interaction.reply({
      content: `This is <@${dashboard.owner_id}>'s board — run \`/mood-dashboard setup\` to create your own!`,
      ephemeral: true
    });
    return null;
  }
  return dashboard;
}

// Main Buttons routing
async function handleButton(interaction) {
  const customId = interaction.customId;
  const dashMsgId = interaction.message ? interaction.message.id : null;

  // Back to Core mood selection
  if (customId.startsWith('mood_back_to_core:')) {
    const msgId = customId.split(':')[1];
    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const select = new StringSelectMenuBuilder()
      .setCustomId(`mood_core:${msgId}`)
      .setPlaceholder('Select Core Emotion');

    const options = Object.keys(WHEEL).map(core => ({
      label: `${core} ${CORE_EMOJIS[core] || ''}`,
      value: core
    }));
    select.addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.update({
      content: '📝 **Wheel of Emotions — Step 1: Core**\nSelect your primary core emotion below:',
      components: [row]
    });
  }

  // Back to Secondary mood selection
  if (customId.startsWith('mood_back_to_secondary:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const core = parts[2];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const secondaries = WHEEL[core];
    if (!secondaries) return;

    const select = new StringSelectMenuBuilder()
      .setCustomId(`mood_secondary:${msgId}:${core}`)
      .setPlaceholder('Select Secondary Emotion');

    const options = Object.keys(secondaries).map(sec => ({
      label: sec,
      value: sec
    }));
    select.addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mood_back_to_core:${msgId}`)
        .setLabel('Back to Core')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    return interaction.update({
      content: `📝 **Wheel of Emotions — Step 2: Secondary (${core})**\nRefine your emotion details:`,
      components: [row, btnRow]
    });
  }

  // 1. Log Mood button
  if (customId === 'mood_log') {
    const dashboard = verifyDashboardOwnership(interaction, dashMsgId);
    if (!dashboard) return;

    const select = new StringSelectMenuBuilder()
      .setCustomId(`mood_core:${dashMsgId}`) // Encode dashboard message ID
      .setPlaceholder('Select Core Emotion');

    const options = Object.keys(WHEEL).map(core => ({
      label: `${core} ${CORE_EMOJIS[core] || ''}`,
      value: core
    }));
    select.addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({
      content: '📝 **Wheel of Emotions — Step 1: Core**\nSelect your primary core emotion below:',
      components: [row],
      ephemeral: true
    });
  }

  // 2. Log Meds button
  if (customId === 'meds_log') {
    const dashboard = verifyDashboardOwnership(interaction, dashMsgId);
    if (!dashboard) return;

    // Check if the owner set up their meds beforehand
    const configuredMeds = dashboard.meds;
    if (configuredMeds) {
      const medList = configuredMeds.split(',').map(m => m.trim()).filter(Boolean);
      if (medList.length > 0) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`meds_select:${dashMsgId}`) // Encode message ID
          .setPlaceholder('Select Medication to Log');

        const options = medList.map(med => ({
          label: med,
          value: med
        }));
        options.push({
          label: '➕ Log Custom/Other Medication...',
          value: '__custom__'
        });
        select.addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.reply({
          content: '💊 **Log Medication**\nSelect one of your pre-configured medications, or choose custom to type a name:',
          components: [row],
          ephemeral: true
        });
      }
    }

    // Default modal if no meds pre-configured
    const modal = new ModalBuilder()
      .setCustomId(`meds_modal:${dashMsgId}`) // Encode dashboard message ID
      .setTitle('Log Medication 💊');

    const nameInput = new TextInputBuilder()
      .setCustomId('meds_name')
      .setLabel('Medication Name')
      .setPlaceholder('e.g., Lexapro, Ibuprofen')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const dosageInput = new TextInputBuilder()
      .setCustomId('meds_dosage')
      .setLabel('Dosage (optional)')
      .setPlaceholder('e.g., 10mg, 1 tablet')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(dosageInput)
    );

    return interaction.showModal(modal);
  }

  // 3. Log Sleep button
  if (customId === 'sleep_log') {
    const dashboard = verifyDashboardOwnership(interaction, dashMsgId);
    if (!dashboard) return;

    const modal = new ModalBuilder()
      .setCustomId(`sleep_hours_modal:${dashMsgId}`) // Encode dashboard message ID
      .setTitle('Log Sleep 😴');

    const hoursInput = new TextInputBuilder()
      .setCustomId('sleep_hours')
      .setLabel('Hours Slept')
      .setPlaceholder('e.g., 8.0, 7.5')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(hoursInput));
    return interaction.showModal(modal);
  }

  // 4. Log Caffeine button
  if (customId === 'caffeine_log') {
    const dashboard = verifyDashboardOwnership(interaction, dashMsgId);
    if (!dashboard) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`caffeine_type:${dashMsgId}:Coffee:95`) // Encode message ID
        .setLabel('Coffee (95mg)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('☕'),
      new ButtonBuilder()
        .setCustomId(`caffeine_type:${dashMsgId}:Energy Drink:150`)
        .setLabel('Energy (150mg)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚡'),
      new ButtonBuilder()
        .setCustomId(`caffeine_type:${dashMsgId}:Tea:30`)
        .setLabel('Tea (30mg)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🍵'),
      new ButtonBuilder()
        .setCustomId(`caffeine_type:${dashMsgId}:Soda:35`)
        .setLabel('Soda (35mg)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🥤'),
      new ButtonBuilder()
        .setCustomId(`caffeine_other_btn:${dashMsgId}`)
        .setLabel('Other')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({
      content: '☕ **Log Caffeine Intake**\nSelect a common drink below, or click **Other** to input custom details:',
      components: [row],
      ephemeral: true
    });
  }

  // 5. Chart button (Public!)
  if (customId === 'chart_view') {
    const dashboard = db.getDashboardByMessageId(dashMsgId);
    if (!dashboard) return;

    await interaction.deferReply({ ephemeral: true });
    try {
      let ownerName = 'User';
      try {
        const ownerUser = await interaction.client.users.fetch(dashboard.owner_id).catch(() => null);
        if (ownerUser) ownerName = ownerUser.username;
      } catch (e) { }

      const { sleepChartUrl, caffeineChartUrl } = await generateChartUrls(dashboard.owner_id, ownerName, dashboard.timezone, 7);
      const stats = getCorrelationStats(dashboard.owner_id, dashboard.timezone, 7);

      const statsThisWeek = db.getStatsThisWeek(dashboard.owner_id, dashboard.timezone);
      const noLogsNote = statsThisWeek.totalLogs === 0 ? '\n\n*No entries yet this week — log your first mood to see it here!*' : '';

      const embedSleep = new EmbedBuilder()
        .setTitle(`📊 ${ownerName}'s Sleep vs Mood Report`)
        .setDescription(`${stats.sleepText}${noLogsNote}`)
        .setImage(sleepChartUrl)
        .setColor(0xffd1dc)
        .setTimestamp();

      const embedCaff = new EmbedBuilder()
        .setTitle(`📊 ${ownerName}'s Caffeine vs Mood Report`)
        .setDescription(`${stats.caffeineText}${noLogsNote}\n\n${stats.disclaimer}`)
        .setImage(caffeineChartUrl)
        .setColor(0xffd1dc)
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId(`chart_range:${dashMsgId}`) // Encode message ID
        .setPlaceholder('Select Range')
        .addOptions(
          { label: 'Weekly (Last 7 days)', value: '7', default: true },
          { label: 'Monthly (Last 30 days)', value: '30' },
          { label: 'All-time (Last 90 days)', value: '90' }
        );

      const row = new ActionRowBuilder().addComponents(select);

      return interaction.editReply({
        embeds: [embedSleep, embedCaff],
        components: [row]
      });
    } catch (e) {
      console.error('Failed to generate chart:', e);
      const errorEmbed = new EmbedBuilder()
        .setTitle('📊 Chart Report')
        .setDescription("❌ Couldn't generate your chart right now — try again in a bit.")
        .setColor(0xffd1dc);
      return interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
  }

  // Caffeine Quick Log execution (caffeine_type:dashMsgId:NAME:MG)
  if (customId.startsWith('caffeine_type:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const drinkType = parts[2];
    const mg = parseInt(parts[3], 10);

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    db.logCaffeine(interaction.user.id, interaction.guildId, drinkType, mg);

    await interaction.update({
      content: `Logged Caffeine: **${drinkType}** (${mg}mg) ☕`,
      components: []
    });

    return updateDashboard(interaction.client, msgId);
  }

  // Caffeine Custom Log trigger button
  if (customId.startsWith('caffeine_other_btn:')) {
    const msgId = customId.split(':')[1];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const modal = new ModalBuilder()
      .setCustomId(`caffeine_other_modal:${msgId}`)
      .setTitle('Log Custom Caffeine ☕');

    const drinkInput = new TextInputBuilder()
      .setCustomId('caffeine_drink')
      .setLabel('Drink Type/Name')
      .setPlaceholder('e.g., Matcha Latte, Red Bull')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const mgInput = new TextInputBuilder()
      .setCustomId('caffeine_mg')
      .setLabel('Amount in mg (optional)')
      .setPlaceholder('e.g., 70')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(drinkInput),
      new ActionRowBuilder().addComponents(mgInput)
    );

    return interaction.showModal(modal);
  }
}

// Main Select Menus routing
async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  const value = interaction.values[0];

  // 1. Mood Core selection -> Secondary selection (mood_core:dashMsgId)
  if (customId.startsWith('mood_core:')) {
    const msgId = customId.split(':')[1];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const secondaries = WHEEL[value];
    if (!secondaries) return;

    const select = new StringSelectMenuBuilder()
      .setCustomId(`mood_secondary:${msgId}:${value}`) // Propagate message ID + core value
      .setPlaceholder('Select Secondary Emotion');

    const options = Object.keys(secondaries).map(sec => ({
      label: sec,
      value: sec
    }));
    select.addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mood_back_to_core:${msgId}`)
        .setLabel('Back to Core')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    return interaction.update({
      content: `📝 **Wheel of Emotions — Step 2: Secondary (${value})**\nRefine your emotion details:`,
      components: [row, btnRow]
    });
  }

  // 2. Mood Secondary selection -> Specific feeling selection (mood_secondary:dashMsgId:core)
  if (customId.startsWith('mood_secondary:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const core = parts[2];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const secondaries = WHEEL[core];
    if (!secondaries) return;

    const specificFeelings = secondaries[value];
    if (!specificFeelings) return;

    const select = new StringSelectMenuBuilder()
      .setCustomId(`mood_specific:${msgId}:${core}:${value}`) // Propagate message ID + core + secondary
      .setPlaceholder('Select Specific Feeling');

    const options = specificFeelings.map(spec => ({
      label: spec,
      value: spec
    }));
    select.addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mood_back_to_secondary:${msgId}:${core}`)
        .setLabel('Back to Secondary')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    return interaction.update({
      content: `📝 **Wheel of Emotions — Step 3: Specific Feeling (${core} > ${value})**\nSelect the exact word describing your feeling:`,
      components: [row, btnRow]
    });
  }

  // 3. Mood Specific Feeling selection -> Show note Modal (mood_specific:dashMsgId:core:secondary)
  if (customId.startsWith('mood_specific:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const core = parts[2];
    const secondary = parts[3];
    const specific = value;

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const modal = new ModalBuilder()
      .setCustomId(`mood_note_modal:${msgId}:${core}:${secondary}:${specific}`) // Propagate message ID + full path
      .setTitle('Add a Note 📝');

    const noteInput = new TextInputBuilder()
      .setCustomId('mood_note')
      .setLabel('Write about your feelings (optional)')
      .setPlaceholder('Enter some notes on how you feel right now...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
    return interaction.showModal(modal);
  }

  // 4. Sleep Quality selection -> Save Sleep (sleep_quality:dashMsgId:hours)
  if (customId.startsWith('sleep_quality:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const hours = parseFloat(parts[2]);
    const quality = value;

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    db.logSleep(interaction.user.id, interaction.guildId, hours, quality);

    await interaction.update({
      content: `Logged Sleep: **${hours} hours** (${quality} quality) 😴`,
      components: []
    });

    return updateDashboard(interaction.client, msgId);
  }

  // 5. Chart range selection (Public!) (chart_range:dashMsgId)
  if (customId.startsWith('chart_range:')) {
    const msgId = customId.split(':')[1];
    const dashboard = db.getDashboardByMessageId(msgId);
    if (!dashboard) return;

    await interaction.deferUpdate();
    try {
      const daysCount = parseInt(value, 10);
      let ownerName = 'User';
      try {
        const ownerUser = await interaction.client.users.fetch(dashboard.owner_id).catch(() => null);
        if (ownerUser) ownerName = ownerUser.username;
      } catch (e) { }

      const { sleepChartUrl, caffeineChartUrl } = await generateChartUrls(dashboard.owner_id, ownerName, dashboard.timezone, daysCount);
      const stats = getCorrelationStats(dashboard.owner_id, dashboard.timezone, daysCount);

      const statsThisWeek = db.getStatsThisWeek(dashboard.owner_id, dashboard.timezone);
      const noLogsNote = statsThisWeek.totalLogs === 0 ? '\n\n*No entries yet this week — log your first mood to see it here!*' : '';

      const embedSleep = new EmbedBuilder()
        .setTitle(`📊 ${ownerName}'s Sleep vs Mood Report`)
        .setDescription(`${stats.sleepText}${noLogsNote}`)
        .setImage(sleepChartUrl)
        .setColor(0xffd1dc)
        .setTimestamp();

      const embedCaff = new EmbedBuilder()
        .setTitle(`📊 ${ownerName}'s Caffeine vs Mood Report`)
        .setDescription(`${stats.caffeineText}${noLogsNote}\n\n${stats.disclaimer}`)
        .setImage(caffeineChartUrl)
        .setColor(0xffd1dc)
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId(`chart_range:${msgId}`)
        .setPlaceholder('Select Range')
        .addOptions(
          { label: 'Weekly (Last 7 days)', value: '7', default: value === '7' },
          { label: 'Monthly (Last 30 days)', value: '30', default: value === '30' },
          { label: 'All-time (Last 90 days)', value: '90', default: value === '90' }
        );

      const row = new ActionRowBuilder().addComponents(select);

      return interaction.editReply({
        embeds: [embedSleep, embedCaff],
        components: [row]
      });
    } catch (e) {
      console.error('Failed to update chart range:', e);
      const errorEmbed = new EmbedBuilder()
        .setTitle('📊 Chart Report')
        .setDescription("❌ Couldn't generate your chart right now — try again in a bit.")
        .setColor(0xffd1dc);
      return interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
  }

  // 6. Configured Medications selection menu (meds_select:dashMsgId)
  if (customId.startsWith('meds_select:')) {
    const msgId = customId.split(':')[1];
    const medValue = value;

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    if (medValue === '__custom__') {
      const modal = new ModalBuilder()
        .setCustomId(`meds_modal:${msgId}`)
        .setTitle('Log Medication 💊');

      const nameInput = new TextInputBuilder()
        .setCustomId('meds_name')
        .setLabel('Medication Name')
        .setPlaceholder('e.g., Lexapro, Ibuprofen')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const dosageInput = new TextInputBuilder()
        .setCustomId('meds_dosage')
        .setLabel('Dosage (optional)')
        .setPlaceholder('e.g., 10mg, 1 tablet')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(dosageInput)
      );

      return interaction.showModal(modal);
    } else {
      db.logMeds(interaction.user.id, interaction.guildId, medValue, null);

      await interaction.reply({
        content: `Logged Meds: **${medValue}** 💊`,
        ephemeral: true
      });

      return updateDashboard(interaction.client, msgId);
    }
  }
}

// Main Modals routing
async function handleModal(interaction) {
  const customId = interaction.customId;

  // 1. Mood Log Note submission (mood_note_modal:dashMsgId:core:secondary:specific)
  if (customId.startsWith('mood_note_modal:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const core = parts[2];
    const secondary = parts[3];
    const specific = parts[4];
    const note = interaction.fields.getTextInputValue('mood_note');

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    db.logMood(interaction.user.id, interaction.guildId, core, secondary, specific, note);

    const emoji = CORE_EMOJIS[core] || '💛';
    await interaction.reply({
      content: `Logged Mood: **${specific}** ${emoji}${note ? `\n> *"${note}"*` : ''}`,
      ephemeral: true
    });

    return updateDashboard(interaction.client, msgId);
  }

  // 2. Medication Log submission (meds_modal:dashMsgId)
  if (customId.startsWith('meds_modal:')) {
    const msgId = customId.split(':')[1];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const name = interaction.fields.getTextInputValue('meds_name');
    const dosage = interaction.fields.getTextInputValue('meds_dosage');

    db.logMeds(interaction.user.id, interaction.guildId, name, dosage);

    await interaction.reply({
      content: `Logged Meds: **${name}** ${dosage ? `(${dosage})` : ''} 💊`,
      ephemeral: true
    });

    return updateDashboard(interaction.client, msgId);
  }

  // 3. Configured Medication Dosage Log submission (meds_dosage_modal:dashMsgId:medValue)
  if (customId.startsWith('meds_dosage_modal:')) {
    const parts = customId.split(':');
    const msgId = parts[1];
    const medValue = parts[2];
    const dosage = interaction.fields.getTextInputValue('meds_dosage');

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    db.logMeds(interaction.user.id, interaction.guildId, medValue, dosage);

    await interaction.reply({
      content: `Logged Meds: **${medValue}** ${dosage ? `(${dosage})` : ''} 💊`,
      ephemeral: true
    });

    return updateDashboard(interaction.client, msgId);
  }

  // 4. Sleep Hours submission -> Select quality (sleep_hours_modal:dashMsgId)
  if (customId.startsWith('sleep_hours_modal:')) {
    const msgId = customId.split(':')[1];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const hoursInput = interaction.fields.getTextInputValue('sleep_hours');
    const hours = parseFloat(hoursInput);

    if (isNaN(hours) || hours < 0 || hours > 24) {
      return interaction.reply({
        content: '❌ Please enter a valid number of hours slept between 0 and 24.',
        ephemeral: true
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`sleep_quality:${msgId}:${hours}`) // Propagate message ID
      .setPlaceholder('Select Quality')
      .addOptions(
        { label: 'Poor 😭', value: 'Poor' },
        { label: 'Okay 😐', value: 'Okay' },
        { label: 'Good 🙂', value: 'Good' },
        { label: 'Great 😄', value: 'Great' }
      );

    const row = new ActionRowBuilder().addComponents(select);

    return interaction.reply({
      content: `Slept **${hours} hours**. How was your sleep quality?`,
      components: [row],
      ephemeral: true
    });
  }

  // 5. Caffeine Custom Log submission (caffeine_other_modal:dashMsgId)
  if (customId.startsWith('caffeine_other_modal:')) {
    const msgId = customId.split(':')[1];

    const dashboard = verifyDashboardOwnership(interaction, msgId);
    if (!dashboard) return;

    const drink = interaction.fields.getTextInputValue('caffeine_drink');
    const mgInput = interaction.fields.getTextInputValue('caffeine_mg');
    let mg = 0;

    if (mgInput) {
      mg = parseInt(mgInput, 10);
      if (isNaN(mg) || mg < 0) {
        return interaction.reply({
          content: '❌ Please enter a valid number of milligrams for caffeine intake.',
          ephemeral: true
        });
      }
    }

    db.logCaffeine(interaction.user.id, interaction.guildId, drink, mg || null);

    await interaction.reply({
      content: `Logged Caffeine: **${drink}** ${mg ? `(${mg}mg)` : ''} ☕`,
      ephemeral: true
    });

    return updateDashboard(interaction.client, msgId);
  }
}

module.exports = {
  initDashboards,
  handleCommand,
  handleButton,
  handleSelectMenu,
  handleModal
};
