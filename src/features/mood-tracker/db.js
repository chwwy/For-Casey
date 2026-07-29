const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { valenceOf } = require('./wheel-valence');

// Open/create the SQLite database (supporting dynamic environment paths for persistent volumes)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../mood_tracker.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new DatabaseSync(dbPath);

// Migrate dashboards table schema if necessary (e.g. if owner_id or meds column is missing)
let needsRecreate = false;
try {
  db.prepare('SELECT owner_id, meds FROM dashboards LIMIT 1').get();
} catch (e) {
  needsRecreate = true;
}

if (needsRecreate) {
  console.log('Migrating dashboards table to new schema...');
  db.exec('DROP TABLE IF EXISTS dashboards');
}

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    meds TEXT,
    UNIQUE(owner_id, channel_id)
  );

  CREATE INDEX IF NOT EXISTS idx_dashboards_message ON dashboards(message_id);
  CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id, channel_id);

  CREATE TABLE IF NOT EXISTS mood_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    core_emotion TEXT NOT NULL,
    secondary_emotion TEXT NOT NULL,
    specific_feeling TEXT NOT NULL,
    note TEXT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meds_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    med_name TEXT NOT NULL,
    dosage TEXT,
    taken_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sleep_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    hours REAL NOT NULL,
    quality TEXT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS caffeine_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    drink_type TEXT NOT NULL,
    amount_mg INTEGER,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Prep SQL statements
const stmtSaveDashboard = db.prepare(`
  INSERT INTO dashboards (guild_id, channel_id, message_id, owner_id, timezone, meds)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(owner_id, channel_id) DO UPDATE SET
    message_id = excluded.message_id,
    timezone = excluded.timezone,
    guild_id = excluded.guild_id,
    meds = excluded.meds
`);

const stmtGetDashboardByMessageId = db.prepare('SELECT * FROM dashboards WHERE message_id = ?');
const stmtGetDashboardByOwner = db.prepare('SELECT * FROM dashboards WHERE owner_id = ? AND channel_id = ?');
const stmtGetAllDashboards = db.prepare('SELECT * FROM dashboards');

const stmtLogMood = db.prepare(`
  INSERT INTO mood_logs (user_id, guild_id, core_emotion, secondary_emotion, specific_feeling, note)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const stmtLogMeds = db.prepare(`
  INSERT INTO meds_logs (user_id, guild_id, med_name, dosage)
  VALUES (?, ?, ?, ?)
`);

const stmtLogSleep = db.prepare(`
  INSERT INTO sleep_logs (user_id, guild_id, hours, quality)
  VALUES (?, ?, ?, ?)
`);

const stmtLogCaffeine = db.prepare(`
  INSERT INTO caffeine_logs (user_id, guild_id, drink_type, amount_mg)
  VALUES (?, ?, ?, ?)
`);

// Date helper: get local date string YYYY-MM-DD in the target timezone from UTC string
function getLocalDateString(utcString, timezone) {
  let date;
  if (typeof utcString === 'string') {
    let formattedStr = utcString;
    if (!formattedStr.endsWith('Z')) {
      formattedStr = formattedStr.replace(' ', 'T');
      if (!formattedStr.includes('T')) {
        formattedStr += 'T00:00:00Z';
      } else {
        formattedStr += 'Z';
      }
    }
    date = new Date(formattedStr);
  } else {
    date = utcString;
  }

  if (isNaN(date.getTime())) {
    console.error('Invalid Date created from input:', utcString);
    date = new Date();
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

// Date helper: subtract days from date string YYYY-MM-DD
function subtractDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get Monday 00:00:00 local time converted to UTC string for start of week query
function getUTCStartOfWeek(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

  const localDate = new Date(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    partMap.hour,
    partMap.minute,
    partMap.second
  );

  const day = localDate.getDay();
  const diff = localDate.getDate() - day + (day === 0 ? -6 : 1);

  const mondayStart = new Date(localDate);
  mondayStart.setDate(diff);
  mondayStart.setHours(0, 0, 0, 0);

  const offsetMs = localDate.getTime() - now.getTime();
  const utcMondayStart = new Date(mondayStart.getTime() - offsetMs);
  return utcMondayStart.toISOString().replace('T', ' ').substring(0, 19);
}

// Get the current local date today and yesterday in target timezone
function getLocalCurrentAndPastDates(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  const getFormatted = (d) => {
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
  };

  const todayStr = getFormatted(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getFormatted(yesterday);

  return { todayStr, yesterdayStr };
}

// Module Exports Database API
module.exports = {
  getLocalDateString,
  // DB Save & Load
  saveDashboard(guildId, channelId, messageId, ownerId, timezone, meds) {
    stmtSaveDashboard.run(guildId, channelId, messageId, ownerId, timezone, meds || null);
  },

  getDashboardByMessageId(messageId) {
    return stmtGetDashboardByMessageId.get(messageId);
  },

  getDashboardByOwner(ownerId, channelId) {
    return stmtGetDashboardByOwner.get(ownerId, channelId);
  },

  getAllDashboards() {
    return stmtGetAllDashboards.all();
  },

  // Logging API
  logMood(userId, guildId, coreEmotion, secondaryEmotion, specificFeeling, note) {
    stmtLogMood.run(userId, guildId, coreEmotion, secondaryEmotion, specificFeeling, note || null);
  },

  logMeds(userId, guildId, medName, dosage) {
    stmtLogMeds.run(userId, guildId, medName, dosage || null);
  },

  logSleep(userId, guildId, hours, quality) {
    stmtLogSleep.run(userId, guildId, hours, quality || null);
  },

  logCaffeine(userId, guildId, drinkType, amountMg) {
    stmtLogCaffeine.run(userId, guildId, drinkType, amountMg || null);
  },

  // Get categorized logs of owner from today
  getTodayLogs(ownerId, timezone) {
    const { DateTime } = require('luxon');
    const todayStartUTC = DateTime.now().setZone(timezone).startOf('day').toUTC().toFormat('yyyy-MM-dd HH:mm:ss');
    const todayEndUTC = DateTime.now().setZone(timezone).endOf('day').toUTC().toFormat('yyyy-MM-dd HH:mm:ss');

    const moodLogs = db.prepare('SELECT * FROM mood_logs WHERE user_id = ? AND logged_at BETWEEN ? AND ? ORDER BY logged_at ASC').all(ownerId, todayStartUTC, todayEndUTC);
    const medsLogs = db.prepare('SELECT * FROM meds_logs WHERE user_id = ? AND taken_at BETWEEN ? AND ? ORDER BY taken_at ASC').all(ownerId, todayStartUTC, todayEndUTC);
    const sleepLogs = db.prepare('SELECT * FROM sleep_logs WHERE user_id = ? AND logged_at BETWEEN ? AND ? ORDER BY logged_at ASC').all(ownerId, todayStartUTC, todayEndUTC);
    const caffeineLogs = db.prepare('SELECT * FROM caffeine_logs WHERE user_id = ? AND logged_at BETWEEN ? AND ? ORDER BY logged_at ASC').all(ownerId, todayStartUTC, todayEndUTC);

    return { moodLogs, medsLogs, sleepLogs, caffeineLogs };
  },

  // Get statistics for the dashboard for the current calendar week starting Monday, scoped to owner
  getStatsThisWeek(ownerId, timezone) {
    const utcMondayStart = getUTCStartOfWeek(timezone);

    // 1. Get total logs count for this owner since Monday
    const moodCount = db.prepare('SELECT COUNT(*) AS count FROM mood_logs WHERE user_id = ? AND logged_at >= ?').get(ownerId, utcMondayStart).count;
    const medsCount = db.prepare('SELECT COUNT(*) AS count FROM meds_logs WHERE user_id = ? AND taken_at >= ?').get(ownerId, utcMondayStart).count;
    const sleepCount = db.prepare('SELECT COUNT(*) AS count FROM sleep_logs WHERE user_id = ? AND logged_at >= ?').get(ownerId, utcMondayStart).count;
    const caffeineCount = db.prepare('SELECT COUNT(*) AS count FROM caffeine_logs WHERE user_id = ? AND logged_at >= ?').get(ownerId, utcMondayStart).count;
    const totalLogsThisWeek = moodCount + medsCount + sleepCount + caffeineCount;

    // 2. Average Mood Valence this week
    const moods = db.prepare('SELECT core_emotion, specific_feeling FROM mood_logs WHERE user_id = ? AND logged_at >= ?').all(ownerId, utcMondayStart);
    let avgValence = null;
    let avgMoodText = 'N/A';
    if (moods.length > 0) {
      let sumValence = 0;
      for (const m of moods) {
        sumValence += valenceOf(m);
      }
      avgValence = sumValence / moods.length;

      if (avgValence >= 1.5) avgMoodText = `Happy 💛 (+${avgValence.toFixed(1)})`;
      else if (avgValence >= 0.5) avgMoodText = `Surprised/Good 🧡 (+${avgValence.toFixed(1)})`;
      else if (avgValence >= -0.5) avgMoodText = `Neutral/Okay 🤍 (${avgValence >= 0 ? '+' : ''}${avgValence.toFixed(1)})`;
      else if (avgValence >= -1.5) avgMoodText = `Down/Bad 💜 (${avgValence.toFixed(1)})`;
      else avgMoodText = `Sad/Angry 💔 (${avgValence.toFixed(1)})`;
    }

    // 3. Current logging streak for this owner
    const moodTimes = db.prepare('SELECT logged_at FROM mood_logs WHERE user_id = ?').all(ownerId).map(r => r.logged_at);
    const medsTimes = db.prepare('SELECT taken_at AS logged_at FROM meds_logs WHERE user_id = ?').all(ownerId).map(r => r.logged_at);
    const sleepTimes = db.prepare('SELECT logged_at FROM sleep_logs WHERE user_id = ?').all(ownerId).map(r => r.logged_at);
    const caffeineTimes = db.prepare('SELECT logged_at FROM caffeine_logs WHERE user_id = ?').all(ownerId).map(r => r.logged_at);

    const allTimes = [...moodTimes, ...medsTimes, ...sleepTimes, ...caffeineTimes];
    const uniqueDates = new Set();
    for (const utcTime of allTimes) {
      uniqueDates.add(getLocalDateString(utcTime, timezone));
    }

    const { todayStr, yesterdayStr } = getLocalCurrentAndPastDates(timezone);

    let streak = 0;
    let currentStr = '';
    if (uniqueDates.has(todayStr)) {
      currentStr = todayStr;
    } else if (uniqueDates.has(yesterdayStr)) {
      currentStr = yesterdayStr;
    }

    if (currentStr) {
      let checkStr = currentStr;
      while (uniqueDates.has(checkStr)) {
        streak++;
        checkStr = subtractDays(checkStr, 1);
      }
    }

    return {
      averageMood: avgMoodText,
      totalLogs: totalLogsThisWeek,
      streak: streak > 0 ? `${streak} day${streak > 1 ? 's' : ''} 🔥` : '0 days'
    };
  },

  // Helper to fetch user specific metrics grouped by local day for the charts
  getUserDailyMetrics(userId, timezone, daysCount = 7) {
    const now = new Date();
    const dateLabels = [];
    const dateMap = {};

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'numeric', day: 'numeric', weekday: 'short'
      });
      const parts = formatter.formatToParts(d);
      const month = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;
      const weekday = parts.find(p => p.type === 'weekday').value;

      const localDateStr = getLocalDateString(d, timezone);
      dateLabels.push({
        dateStr: localDateStr,
        label: `${weekday} (${month}/${day})`
      });
      dateMap[localDateStr] = {
        moodSum: 0,
        moodCount: 0,
        sleepHours: 0,
        caffeineMg: 0
      };
    }

    const startLocalDate = dateLabels[0].dateStr;
    const bufferStartDate = new Date(now);
    bufferStartDate.setDate(bufferStartDate.getDate() - daysCount - 2);
    const bufferStartUtcStr = bufferStartDate.toISOString().replace('T', ' ').substring(0, 19);

    // Fetch mood logs
    const moodLogs = db.prepare('SELECT core_emotion, specific_feeling, logged_at FROM mood_logs WHERE user_id = ? AND logged_at >= ?').all(userId, bufferStartUtcStr);
    for (const log of moodLogs) {
      const localDate = getLocalDateString(log.logged_at, timezone);
      if (dateMap[localDate]) {
        dateMap[localDate].moodSum += valenceOf(log);
        dateMap[localDate].moodCount++;
      }
    }

    // Fetch sleep logs
    const sleepLogs = db.prepare('SELECT hours, logged_at FROM sleep_logs WHERE user_id = ? AND logged_at >= ?').all(userId, bufferStartUtcStr);
    for (const log of sleepLogs) {
      const localDate = getLocalDateString(log.logged_at, timezone);
      if (dateMap[localDate]) {
        dateMap[localDate].sleepHours += log.hours;
      }
    }

    // Fetch caffeine logs
    const caffeineLogs = db.prepare('SELECT amount_mg, logged_at FROM caffeine_logs WHERE user_id = ? AND logged_at >= ?').all(userId, bufferStartUtcStr);
    for (const log of caffeineLogs) {
      const localDate = getLocalDateString(log.logged_at, timezone);
      if (dateMap[localDate]) {
        dateMap[localDate].caffeineMg += log.amount_mg || 0;
      }
    }

    const labels = dateLabels.map(dl => dl.label);
    const moodValues = [];
    const sleepValues = [];
    const caffeineValues = [];

    for (const dl of dateLabels) {
      const metrics = dateMap[dl.dateStr];
      moodValues.push(metrics.moodCount > 0 ? Number((metrics.moodSum / metrics.moodCount).toFixed(2)) : null);
      sleepValues.push(metrics.sleepHours > 0 ? Number(metrics.sleepHours.toFixed(1)) : 0);
      caffeineValues.push(metrics.caffeineMg);
    }

    return {
      labels,
      dateLabels: dateLabels.map(dl => dl.dateStr),
      moodValues,
      sleepValues,
      caffeineValues,
      rawMoodLogs: moodLogs.map(l => ({
        core_emotion: l.core_emotion,
        specific_feeling: l.specific_feeling,
        localDate: getLocalDateString(l.logged_at, timezone)
      })),
      rawSleepLogs: sleepLogs.map(l => ({
        hours: l.hours,
        localDate: getLocalDateString(l.logged_at, timezone)
      })),
      rawCaffeineLogs: caffeineLogs.map(l => ({
        amount_mg: l.amount_mg || 0,
        localDate: getLocalDateString(l.logged_at, timezone)
      }))
    };
  },

  getUserDailyAggregates(userId, timezone, daysCount) {
    const now = new Date();
    const dateLabels = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dateLabels.push(getLocalDateString(d, timezone));
    }

    const bufferStartDate = new Date(now);
    bufferStartDate.setDate(bufferStartDate.getDate() - daysCount - 2);
    const bufferStartUtcStr = bufferStartDate.toISOString().replace('T', ' ').substring(0, 19);

    // 1. Get daily average mood valence
    const moodLogs = db.prepare('SELECT core_emotion, specific_feeling, logged_at FROM mood_logs WHERE user_id = ? AND logged_at >= ?').all(userId, bufferStartUtcStr);
    const moodMap = {};
    for (const log of moodLogs) {
      const localDate = getLocalDateString(log.logged_at, timezone);
      if (dateLabels.includes(localDate)) {
        if (!moodMap[localDate]) moodMap[localDate] = { sum: 0, count: 0 };
        moodMap[localDate].sum += valenceOf(log);
        moodMap[localDate].count++;
      }
    }
    const dailyMood = {};
    for (const [dStr, val] of Object.entries(moodMap)) {
      dailyMood[dStr] = val.sum / val.count;
    }

    // 2. Get daily total sleep hours
    const sleepLogs = db.prepare('SELECT hours, logged_at FROM sleep_logs WHERE user_id = ? AND logged_at >= ?').all(userId, bufferStartUtcStr);
    const dailySleep = {};
    for (const log of sleepLogs) {
      const localDate = getLocalDateString(log.logged_at, timezone);
      if (dateLabels.includes(localDate)) {
        if (dailySleep[localDate] === undefined) dailySleep[localDate] = 0;
        dailySleep[localDate] += log.hours;
      }
    }

    // 3. Get daily total caffeine mg
    const caffeineLogs = db.prepare('SELECT amount_mg, logged_at FROM caffeine_logs WHERE user_id = ? AND logged_at >= ?').all(userId, bufferStartUtcStr);
    const dailyCaffeine = {};
    for (const log of caffeineLogs) {
      const localDate = getLocalDateString(log.logged_at, timezone);
      if (dateLabels.includes(localDate)) {
        if (dailyCaffeine[localDate] === undefined) dailyCaffeine[localDate] = 0;
        dailyCaffeine[localDate] += log.amount_mg || 0;
      }
    }

    return {
      dailyMood,
      dailySleep,
      dailyCaffeine,
      dateLabels,
      moodLogs
    };
  }
};
