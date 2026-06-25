const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.CURHAT_DATA_PATH || path.join(__dirname, '../../../curhat_channels.json');

let curhatChannels = {};

function loadCurhatChannels() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            curhatChannels = JSON.parse(data || '{}');
        } else {
            curhatChannels = {};
            saveCurhatChannels();
        }
    } catch (error) {
        console.error('Error loading curhat channels:', error);
        curhatChannels = {};
    }
}

function saveCurhatChannels() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(curhatChannels, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving curhat channels:', error);
    }
}

// Initialize on load
loadCurhatChannels();

module.exports = {
    getChannel(channelId) {
        return curhatChannels[channelId];
    },
    addChannel(channelId, seconds, creatorId, controlMessageId) {
        curhatChannels[channelId] = {
            seconds,
            creatorId,
            controlMessageId,
            lastActivity: Date.now()
        };
        saveCurhatChannels();
    },
    updateActivity(channelId) {
        if (curhatChannels[channelId]) {
            curhatChannels[channelId].lastActivity = Date.now();
            saveCurhatChannels();
        }
    },
    removeChannel(channelId) {
        if (curhatChannels[channelId]) {
            delete curhatChannels[channelId];
            saveCurhatChannels();
        }
    },
    isCurhatChannel(channelId) {
        return !!curhatChannels[channelId];
    },
    getAllChannels() {
        return curhatChannels;
    }
};
