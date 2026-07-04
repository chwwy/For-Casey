const fs = require('fs');
const path = require('path');
const config = require('../../config/env');

const CONFIG_FILE = path.join(__dirname, '../../../autoban_config.json');

let banChannelIds = [];

// Load config initially
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.banChannelIds)) {
                banChannelIds = data.banChannelIds;
                return;
            }
        }
    } catch (error) {
        console.error('[AutoBan Config] Failed to load autoban_config.json:', error);
    }

    // Fallback / Initial load from environment configuration
    if (config.BAN_CHANNEL_IDS && Array.isArray(config.BAN_CHANNEL_IDS)) {
        banChannelIds = [...config.BAN_CHANNEL_IDS];
    }
}

// Save config
function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ banChannelIds }, null, 4));
    } catch (error) {
        console.error('[AutoBan Config] Failed to save autoban_config.json:', error);
    }
}

// Initialize on load
loadConfig();

module.exports = {
    getBanChannelIds: () => banChannelIds,
    addBanChannel: (channelId) => {
        if (!banChannelIds.includes(channelId)) {
            banChannelIds.push(channelId);
            saveConfig();
            return true;
        }
        return false;
    },
    removeBanChannel: (channelId) => {
        const index = banChannelIds.indexOf(channelId);
        if (index !== -1) {
            banChannelIds.splice(index, 1);
            saveConfig();
            return true;
        }
        return false;
    }
};
