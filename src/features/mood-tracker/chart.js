const QuickChart = require('quickchart-js');
const db = require('./db');
const { valenceOf } = require('./wheel-valence');

function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 10) return null; // Raised to 10 total entries since "n" is now log count

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? null : num / denom;
}

function describeCorrelation(r) {
  if (r === null) return "Log a few more days to see this";
  const abs = Math.abs(r);
  const strength = abs > 0.7 ? "strong" : abs > 0.4 ? "moderate" : abs > 0.2 ? "weak" : "negligible";
  const direction = r >= 0 ? "positive" : "negative";
  return `${strength} ${direction} (r=${r.toFixed(2)})`;
}

function axisMax(values, emptyStateFallback) {
  if (!values) return emptyStateFallback;
  const validValues = values.filter(val => val !== null && val !== undefined && !isNaN(val));
  if (validValues.length === 0) return emptyStateFallback;
  const max = Math.max(...validValues);
  if (max === 0) return emptyStateFallback;
  return Math.ceil(max * 1.2);
}

function buildPerEntryPairs(moodLogs, dailyAggregateMap, timezone) {
  const moodValues = [];
  const otherValues = [];
  for (const log of moodLogs) {
    const day = db.getLocalDateString(log.logged_at, timezone);
    if (dailyAggregateMap[day] !== undefined) {
      const valence = valenceOf(log);
      moodValues.push(valence);
      otherValues.push(dailyAggregateMap[day]);
    }
  }
  return { moodValues, otherValues };
}

function getCorrelationStats(userId, timezone, daysCount) {
  const { dailyMood, dailySleep, dailyCaffeine, dateLabels, moodLogs } = db.getUserDailyAggregates(userId, timezone, daysCount);

  // Filter raw mood logs to only include those matching dates in dateLabels range in the target timezone
  const timezoneMoodLogs = moodLogs.filter(log => {
    const localDate = db.getLocalDateString(log.logged_at, timezone);
    return dateLabels.includes(localDate);
  });

  // 1. Sleep vs Mood (per mood entry paired with that day's sleep total)
  const { moodValues: moodValSleep, otherValues: sleepVals } = buildPerEntryPairs(timezoneMoodLogs, dailySleep, timezone);
  const rSleep = pearsonCorrelation(moodValSleep, sleepVals);
  const descSleep = describeCorrelation(rSleep);

  // 2. Caffeine vs Mood (per mood entry paired with that day's caffeine total)
  const { moodValues: moodValCaff, otherValues: caffVals } = buildPerEntryPairs(timezoneMoodLogs, dailyCaffeine, timezone);
  const rCaff = pearsonCorrelation(moodValCaff, caffVals);
  const descCaff = describeCorrelation(rCaff);

  return {
    sleepText: `📈 **Sleep ↔ Mood**: ${descSleep}`,
    caffeineText: `☕ **Caffeine ↔ Mood**: ${descCaff}`,
    disclaimer: `*Disclaimer: Correlation does not equal causation.*`
  };
}

// Helper to compute deterministic jitter offsets within a day's slot (±0.15 index offset)
function getJitteredPoints(logsForMetric, dayIndexMap, valueOf) {
  const byDay = {};
  for (const log of logsForMetric) {
    const d = dayIndexMap[log.localDate];
    if (d !== undefined && d !== null) {
      (byDay[d] ??= []).push(log);
    }
  }
  const JITTER_SPAN = 0.3;
  const points = [];
  for (const [dayIndex, dayLogs] of Object.entries(byDay)) {
    const n = dayLogs.length;
    dayLogs.forEach((log, i) => {
      const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * JITTER_SPAN;
      points.push({ x: Number(dayIndex) + offset, y: valueOf(log) });
    });
  }
  return points;
}

async function generateChartUrls(userId, username, timezone, daysCount = 7) {
  const metrics = db.getUserDailyMetrics(userId, timezone, daysCount);

  // Map dates to their indexes (0 to daysCount - 1)
  const dayIndexMap = {};
  metrics.dateLabels.forEach((dStr, idx) => {
    dayIndexMap[dStr] = idx;
  });

  // Build points for trend lines (daily aggregates/averages)
  const dailyAvgMoodPoints = (metrics.moodValues || [])
    .map((val, idx) => val !== null ? { x: idx, y: val } : null)
    .filter(Boolean);

  const dailySleepPoints = (metrics.sleepValues || []).map((val, idx) => ({ x: idx, y: val }));
  const dailyCaffeinePoints = (metrics.caffeineValues || []).map((val, idx) => ({ x: idx, y: val }));

  const maxSleep = axisMax(metrics.sleepValues, 10);
  const maxCaffeine = axisMax(metrics.caffeineValues, 100);

  // Build raw jittered scatter points
  const jitteredMoodPoints = getJitteredPoints(
    metrics.rawMoodLogs,
    dayIndexMap,
    (log) => valenceOf(log)
  );

  const jitteredSleepPoints = getJitteredPoints(
    metrics.rawSleepLogs,
    dayIndexMap,
    (log) => log.hours
  );

  const jitteredCaffeinePoints = getJitteredPoints(
    metrics.rawCaffeineLogs,
    dayIndexMap,
    (log) => log.amount_mg
  );

  // 1. Chart A: Mood vs Sleep
  const qcSleep = new QuickChart();
  qcSleep.setVersion('3');
  qcSleep.setConfig({
    type: 'line', // Mixed type datasets (line + scatter)
    data: {
      datasets: [
        {
          type: 'line',
          label: 'Mood',
          data: dailyAvgMoodPoints,
          yAxisID: 'y',
          borderColor: '#facc15', // Vibrant Yellow
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 0,
          datalabels: {
            display: new Function('context', 'return context.dataIndex === context.dataset.data.length - 1;'),
            align: 'top',
            color: '#ffffff',
            font: { weight: 'bold' },
            formatter: new Function('value', 'return (value && typeof value === "object") ? (value.y !== undefined ? value.y : "") : value;')
          }
        },
        {
          type: 'scatter',
          label: '',
          data: jitteredMoodPoints,
          yAxisID: 'y',
          backgroundColor: '#facc15',
          pointRadius: 6,
          showLine: false,
          fill: false,
          datalabels: { display: false }
        },
        {
          type: 'line',
          label: 'Sleep',
          data: dailySleepPoints,
          yAxisID: 'y1',
          borderColor: '#38bdf8', // Sleek Blue
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 0,
          datalabels: {
            display: new Function('context', 'return context.dataIndex === context.dataset.data.length - 1;'),
            align: 'top',
            color: '#ffffff',
            font: { weight: 'bold' },
            formatter: new Function('value', 'return (value && typeof value === "object") ? (value.y !== undefined ? value.y : "") : value;')
          }
        },
        {
          type: 'scatter',
          label: '',
          data: jitteredSleepPoints,
          yAxisID: 'y1',
          backgroundColor: '#38bdf8',
          pointRadius: 6,
          showLine: false,
          fill: false,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${username}'s Sleep vs Mood Report (Last ${daysCount} Days)`,
          color: '#ffffff',
          font: { size: 16 }
        },
        legend: {
          labels: {
            color: '#ffffff',
            filter: new Function('item', 'data', "return item.text && item.text !== '';")
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: -0.5,
          max: daysCount - 0.5,
          ticks: {
            color: '#ffffff',
            stepSize: 1,
            callback: new Function('value', 'const labels = ' + JSON.stringify(metrics.labels) + '; return labels[value] ?? "";')
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: {
          position: 'left',
          min: -2,
          max: 2,
          title: { display: true, text: 'Mood Valence', color: '#ffffff' },
          ticks: {
            color: '#ffffff',
            stepSize: 1,
            callback: function (val) {
              if (val === 2) return 'Happy (+2)';
              if (val === 1) return 'Good (+1)';
              if (val === 0) return 'Neutral (0)';
              if (val === -1) return 'Down (-1)';
              if (val === -2) return 'Sad/Angry (-2)';
              return '';
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.15)' }
        },
        y1: {
          position: 'right',
          min: 0,
          max: maxSleep,
          title: { display: true, text: 'Sleep Hours', color: '#ffffff' },
          ticks: { color: '#ffffff', stepSize: 2 },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  qcSleep.setWidth(700).setHeight(400).setBackgroundColor('#2b2d31');

  // 2. Chart B: Mood vs Caffeine
  const qcCaff = new QuickChart();
  qcCaff.setVersion('3');
  qcCaff.setConfig({
    type: 'line',
    data: {
      datasets: [
        {
          type: 'line',
          label: 'Mood',
          data: dailyAvgMoodPoints,
          yAxisID: 'y',
          borderColor: '#facc15',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 0,
          datalabels: {
            display: new Function('context', 'return context.dataIndex === context.dataset.data.length - 1;'),
            align: 'top',
            color: '#ffffff',
            font: { weight: 'bold' },
            formatter: new Function('value', 'return (value && typeof value === "object") ? (value.y !== undefined ? value.y : "") : value;')
          }
        },
        {
          type: 'scatter',
          label: '',
          data: jitteredMoodPoints,
          yAxisID: 'y',
          backgroundColor: '#facc15',
          pointRadius: 6,
          showLine: false,
          fill: false,
          datalabels: { display: false }
        },
        {
          type: 'line',
          label: 'Caffeine',
          data: dailyCaffeinePoints,
          yAxisID: 'y1',
          borderColor: '#f87171', // Warm Red
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 0,
          datalabels: {
            display: new Function('context', 'return context.dataIndex === context.dataset.data.length - 1;'),
            align: 'top',
            color: '#ffffff',
            font: { weight: 'bold' },
            formatter: new Function('value', 'return (value && typeof value === "object") ? (value.y !== undefined ? value.y : "") : value;')
          }
        },
        {
          type: 'scatter',
          label: '',
          data: jitteredCaffeinePoints,
          yAxisID: 'y1',
          backgroundColor: '#f87171',
          pointRadius: 6,
          showLine: false,
          fill: false,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${username}'s Caffeine vs Mood Report (Last ${daysCount} Days)`,
          color: '#ffffff',
          font: { size: 16 }
        },
        legend: {
          labels: {
            color: '#ffffff',
            filter: new Function('item', 'data', "return item.text && item.text !== '';")
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: -0.5,
          max: daysCount - 0.5,
          ticks: {
            color: '#ffffff',
            stepSize: 1,
            callback: new Function('value', 'const labels = ' + JSON.stringify(metrics.labels) + '; return labels[value] ?? "";')
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: {
          position: 'left',
          min: -2,
          max: 2,
          title: { display: true, text: 'Mood Valence', color: '#ffffff' },
          ticks: {
            color: '#ffffff',
            stepSize: 1,
            callback: function (val) {
              if (val === 2) return 'Happy (+2)';
              if (val === 1) return 'Good (+1)';
              if (val === 0) return 'Neutral (0)';
              if (val === -1) return 'Down (-1)';
              if (val === -2) return 'Sad/Angry (-2)';
              return '';
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.15)' }
        },
        y1: {
          position: 'right',
          min: 0,
          max: maxCaffeine,
          title: { display: true, text: 'Caffeine (mg)', color: '#ffffff' },
          ticks: { color: '#ffffff', stepSize: 50 },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  qcCaff.setWidth(700).setHeight(400).setBackgroundColor('#2b2d31');

  // Request URLs in parallel
  const [sleepChartUrl, caffeineChartUrl] = await Promise.all([
    qcSleep.getShortUrl(),
    qcCaff.getShortUrl()
  ]);

  // Warm up the QuickChart CDN/cache asynchronously (non-blocking)
  Promise.all([
    fetch(sleepChartUrl).catch(() => {}),
    fetch(caffeineChartUrl).catch(() => {})
  ]).catch(e => {
    console.error('Failed to pre-fetch QuickChart short URLs:', e);
  });

  return { sleepChartUrl, caffeineChartUrl };
}

module.exports = {
  getCorrelationStats,
  generateChartUrls
};
