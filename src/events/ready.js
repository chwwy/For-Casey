const { ActivityType, REST, Routes } = require('discord.js');
const { initScheduler } = require('../features/medication');
const commands = require('../commands/definitions');

module.exports = async (client) => {
    // Register Slash Commands
    try {
        console.log('Refreshing application (/) commands...');
        // await client.application.commands.set(commands); // Global update might take time
        // Use guild commands for instant update if guild ID available?
        // Let's iterate all connected guilds and set for now
        const guilds = client.guilds.cache;
        for (const [gId, guild] of guilds) {
            await guild.commands.set(commands);
            console.log(`Commands registered for guild: ${guild.name} (${gId})`);
        }
    } catch (error) {
        console.error(error);
    }
    console.log(`Ready! Logged in as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'naosletter.com', type: ActivityType.Playing }],
        status: 'dnd',
    });

    // Initialize Schedulers
    initScheduler(client);
};
