const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../../medication_data.json');

// Helper: Get Current Date in Specific Timezone
function getNow(timezone) {
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
}

// Helper: Get Start of Week (Monday) in Specific Timezone
function getWeekStart(timezone) {
    const d = getNow(timezone);
    const day = d.getDay(); // 0 (Sun) - 6 (Sat)

    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    d.setDate(diff);
    d.setHours(0, 0, 0, 0);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
}

// Helper: Get Day Name in Specific Timezone
function getCurrentDayName(timezone) {
    return getNow(timezone).toLocaleDateString('en-US', { weekday: 'long' });
}

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            // Default to empty if empty file
            if (!raw) return { instances: {} };

            // Check if legacy format (no instances)
            if (raw.days && !raw.instances) {
                // Migrate legacy
                return {
                    instances: {
                        'nao': {
                            currentWeekStart: raw.currentWeekStart,
                            days: raw.days,
                            messageIds: raw.messageIds
                        }
                    }
                };
            }
            return raw;
        }
    } catch (e) {
        console.error("Error reading medication data:", e);
    }
    return { instances: {} };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error writing medication data:", e);
    }
}

function ensureInstance(data, instanceKey, timezone) {
    if (!data.instances) data.instances = {};
    if (!data.instances[instanceKey]) {
        data.instances[instanceKey] = {
            currentWeekStart: getWeekStart(timezone),
            days: {},
            messageIds: {}
        };
    }
    return data.instances[instanceKey];
}

function checkWeekReset(instanceData, timezone) {
    const currentStart = getWeekStart(timezone);
    if (instanceData.currentWeekStart !== currentStart) {
        instanceData.currentWeekStart = currentStart;
        instanceData.days = {};
        return true;
    }
    return false;
}

function updateWeeklyCheck(instanceKey, timezone, dayName, timeSlot, value = true) {
    let data = loadData();
    let instance = ensureInstance(data, instanceKey, timezone);
    checkWeekReset(instance, timezone);

    if (!instance.days[dayName]) {
        instance.days[dayName] = { AM: false, PM: false };
    }

    if (!instance.days[dayName].mood) {
        instance.days[dayName].mood = { AM: "", PM: "" };
    }

    let storedValue = value;
    if (value === true) {
        const now = getNow(timezone);
        // Format example: "09:15 PM"
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        storedValue = timeString;
    }

    instance.days[dayName][timeSlot] = storedValue;
    saveData(data);
    return instance;
}

function logMood(instanceKey, timezone, dayName, timeSlot, content) {
    let data = loadData();
    let instance = ensureInstance(data, instanceKey, timezone);
    checkWeekReset(instance, timezone);

    if (!instance.days[dayName]) {
        instance.days[dayName] = { AM: false, PM: false };
    }

    if (!instance.days[dayName].mood) {
        instance.days[dayName].mood = { AM: "", PM: "" };
    }

    instance.days[dayName].mood[timeSlot] = content;
    saveData(data);
    return instance;
}

function getInstanceData(instanceKey, timezone) {
    let data = loadData();
    let instance = ensureInstance(data, instanceKey, timezone);
    checkWeekReset(instance, timezone);
    saveData(data);
    return instance;
}

function setMessageId(instanceKey, channelId, messageId) {
    let data = loadData();
    if (!data.instances) data.instances = {};
    // Ensure instance exists, minimal
    if (!data.instances[instanceKey]) data.instances[instanceKey] = { days: {}, messageIds: {} };

    if (!data.instances[instanceKey].messageIds) data.instances[instanceKey].messageIds = {};
    data.instances[instanceKey].messageIds[channelId] = messageId;
    saveData(data);
}

function getMessageIds(instanceKey) {
    const data = loadData();
    if (data.instances && data.instances[instanceKey]) {
        return data.instances[instanceKey].messageIds || {};
    }
    return {};
}

function resetWeekData(instanceKey, timezone) {
    let data = loadData();
    if (data.instances && data.instances[instanceKey]) {
        data.instances[instanceKey].currentWeekStart = getWeekStart(timezone);
        data.instances[instanceKey].days = {};
        saveData(data);
    }
    return data;
}

function peekInstanceData(instanceKey) {
    const data = loadData();
    if (data.instances && data.instances[instanceKey]) {
        return data.instances[instanceKey];
    }
    return null;
}

function shouldReset(instanceKey, timezone) {
    const data = peekInstanceData(instanceKey);
    if (!data) return true; // New instance needs init/reset
    const currentStart = getWeekStart(timezone);
    return data.currentWeekStart !== currentStart;
}

function setReminderMessageId(instanceKey, channelId, messageId) {
    let data = loadData();
    if (!data.instances) data.instances = {};
    if (!data.instances[instanceKey]) data.instances[instanceKey] = { days: {}, messageIds: {}, reminders: {} };

    if (!data.instances[instanceKey].reminders) data.instances[instanceKey].reminders = {}; // Ensure reminders object

    // Store array of IDs? Or single active reminder per channel?
    // User asked "delete THE message". So likely single active.
    data.instances[instanceKey].reminders[channelId] = messageId;
    saveData(data);
}

function getReminderMessageId(instanceKey, channelId) {
    const data = loadData();
    if (data.instances && data.instances[instanceKey] && data.instances[instanceKey].reminders) {
        return data.instances[instanceKey].reminders[channelId];
    }
    return null;
}

module.exports = {
    updateWeeklyCheck,
    getInstanceData,
    logMood,
    setMessageId,
    getMessageIds,
    resetWeekData,
    getCurrentDayName,
    getNow,
    peekInstanceData,
    shouldReset,
    setReminderMessageId,
    getReminderMessageId,
    removeMessageId: function (instanceKey, channelId) {
        let data = loadData();
        if (data.instances && data.instances[instanceKey] && data.instances[instanceKey].messageIds) {
            delete data.instances[instanceKey].messageIds[channelId];
            saveData(data);
            console.log(`Removed stale channel ${channelId} from ${instanceKey}`);
        }
    }
};
