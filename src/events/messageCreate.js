const translatorFeature = require('../features/translator');
const medicationFeature = require('../features/medication');

module.exports = async (message, client) => {
    // 1. Ignore self to prevent loops
    if (message.author.id === client.user.id) return;

    // Ignore specific discord ID
    if (message.author.id === '1229524851459493919') return;

    // 2. Medication Feature
    // Check if it's a command for medication
    if (message.content.startsWith('!pill')) {
        await medicationFeature.handleMessage(message);
        return; // Stop processing valid command
    }

    // 3. Translator Feature
    // VIP Handling
    await translatorFeature.handleVIP(message);

    // Channel Forwarding
    // This runs independently of VIP handling (as per original logic)
    await translatorFeature.handleForwarding(message);
};
