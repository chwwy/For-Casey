require('dotenv').config();

module.exports = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SOURCE_CHANNEL_IDS: (process.env.SOURCE_CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    DESTINATION_CHANNEL_IDS: (process.env.DESTINATION_CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    BAN_CHANNEL_IDS: (process.env.BAN_CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    VIP_USERS: {
        '287489239250370560': 'Casey',
        '860909419226595328': 'Nao'
    },
    LIBRETRANSLATE_URL: process.env.LIBRETRANSLATE_URL,
    LIBRETRANSLATE_API_KEY: process.env.LIBRETRANSLATE_API_KEY
};
