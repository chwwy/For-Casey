const data = require('../features/medication/data');
const config = require('../features/medication/config');
const { generateReportEmbeds } = require('../features/medication/index');

module.exports = async (reaction, user, client) => {
    // 1. Basic Checks
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    if (user.bot) return; // Ignore bots

    // 2. Identify Instance
    const instance = config.getInstanceByChannel(reaction.message.channel.id);
    if (!instance) return; // Ignore irrelevant channels

    // Only verify message author is bot
    if (reaction.message.author.id !== client.user.id) return;

    const { key: instanceKey, timezone, slots } = instance;

    // DISABLED: Using buttons/modals instead of reactions
    return;
};
