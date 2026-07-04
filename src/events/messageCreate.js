const translatorFeature = require('../features/translator');
const medicationFeature = require('../features/medication');
const lyricsFeature = require('../features/lyrics');
<<<<<<< HEAD
const autoBanFeature = require('../features/autoBan');
=======
const curhatFeature = require('../features/curhat');
>>>>>>> 1d72474362d994fc8ab7794ca2064fc4b6593cb5

module.exports = async (message, client) => {
    // Curhat Autodeletion (Handle all messages in curhat channels including bots)
    curhatFeature.handleMessage(message);

    // 1. Ignore ALL bots to prevent loops and massive API usage from other bots
    if (message.author.bot) return;

    // Ignore specific discord ID
    if (message.author.id === '1229524851459493919') return;

    // 1.5. Auto-Ban & Purge check
    await autoBanFeature.handleMessage(message);

    // 2. Medication Feature
    // Check if it's a command for medication
    if (message.content.startsWith('!pill')) {
        await medicationFeature.handleMessage(message);
        return; // Stop processing valid command
    }

    // 2.5 Lyrics Feature
    if (message.content.startsWith('!lyrics')) {
        await lyricsFeature.handleMessage(message);
        return;
    }

    // 3. Translator Feature
    // VIP Handling
    await translatorFeature.handleVIP(message);

    // Channel Forwarding
    // This runs independently of VIP handling (as per original logic)
    await translatorFeature.handleForwarding(message);
};
