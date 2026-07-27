const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');

function truncateField(lines, limit = 1000) {
  let content = "";
  for (let i = 0; i < lines.length; i++) {
    const nextLine = lines[i] + (i < lines.length - 1 ? "\n" : "");
    if (content.length + nextLine.length > limit) {
      const remaining = lines.length - i;
      content += `\n... and ${remaining} more logs`;
      break;
    }
    content += nextLine;
  }
  return content || "No logs";
}

function formatMoodField(logs) {
  if (!logs.length) return "No mood logged";
  const lines = logs.map((l, i) => {
    let line = `${i + 1}. ${l.core_emotion} → ${l.secondary_emotion} → ${l.specific_feeling}`;
    if (l.note) {
      line += `\n> *"${l.note}"*`;
    }
    return line;
  });
  return truncateField(lines);
}

function formatMedsField(logs) {
  if (!logs.length) return "No meds logged";
  const lines = logs.map((l, i) => `${i + 1}. ${l.med_name}${l.dosage ? ` (${l.dosage})` : ''}`);
  return truncateField(lines);
}

function formatCaffeineField(logs) {
  if (!logs.length) return "No caffeine logged";
  const lines = logs.map((l, i) => `${i + 1}. ${l.drink_type}${l.amount_mg ? ` (${l.amount_mg}mg)` : ''}`);
  return truncateField(lines);
}

function formatSleepField(logs) {
  if (!logs.length) return "No sleep logged";
  const lines = logs.map((l, i) => `${i + 1}. ${l.hours} hours sleep${l.quality ? ` - ${l.quality}` : ''}`);
  return truncateField(lines);
}

async function updateDashboard(client, dashboardOrId) {
  let dashboard;
  if (typeof dashboardOrId === 'string') {
    dashboard = db.getDashboardByMessageId(dashboardOrId);
  } else {
    dashboard = dashboardOrId;
  }
  if (!dashboard) return;

  const { channel_id, message_id, owner_id, timezone } = dashboard;

  const stats = db.getStatsThisWeek(owner_id, timezone);
  const todayLogs = db.getTodayLogs(owner_id, timezone);

  const moodText = formatMoodField(todayLogs.moodLogs);
  const medsText = formatMedsField(todayLogs.medsLogs);
  const caffeineText = formatCaffeineField(todayLogs.caffeineLogs);
  const sleepText = formatSleepField(todayLogs.sleepLogs);

  let ownerName = 'User';
  try {
    const ownerUser = await client.users.fetch(owner_id).catch(() => null);
    if (ownerUser) ownerName = ownerUser.username;
  } catch (e) {
    console.error(`Failed to fetch user details for owner ${owner_id}:`, e);
  }

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${ownerName}'s Mood Tracker`)
    .setColor(0xffd1dc)
    .addFields(
      { name: 'Average Mood', value: stats.averageMood, inline: true },
      { name: 'Total Logs This Week', value: `${stats.totalLogs} logs`, inline: true },
      { name: 'Current Streak', value: stats.streak, inline: true },
      { name: 'Mood', value: moodText },
      { name: 'Meds', value: medsText },
      { name: 'Caffeine', value: caffeineText },
      { name: 'Sleep', value: sleepText }
    )
    .setFooter({ text: `Timezone: ${timezone} • Live Updates Enabled` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mood_log')
      .setLabel('Log Mood')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId('sleep_log')
      .setLabel('Log Sleep')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('😴'),
    new ButtonBuilder()
      .setCustomId('caffeine_log')
      .setLabel('Log Caffeine')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('☕'),
    new ButtonBuilder()
      .setCustomId('chart_view')
      .setLabel('Chart')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊')
  );

  const components = [row];

  const { StringSelectMenuBuilder } = require('discord.js');
  const select = new StringSelectMenuBuilder()
    .setCustomId(`meds_select:${message_id}`)
    .setPlaceholder('💊 Log Medication...');

  const options = [];
  if (dashboard.meds) {
    const medList = dashboard.meds.split(',').map(m => m.trim()).filter(Boolean);
    medList.forEach(med => {
      options.push({
        label: med,
        value: med
      });
    });
  }
  options.push({
    label: '➕ Log Custom/Other Medication...',
    value: '__custom__'
  });
  select.addOptions(options);

  const selectRow = new ActionRowBuilder().addComponents(select);
  components.push(selectRow);

  try {
    const channel = await client.channels.fetch(channel_id).catch(() => null);
    if (channel) {
      const message = await channel.messages.fetch(message_id).catch(() => null);
      if (message) {
        await message.edit({ embeds: [embed], components });
      }
    }
  } catch (e) {
    console.error(`Failed to update dashboard for message ${message_id}:`, e);
  }
}

module.exports = {
  updateDashboard
};
