const { SlashCommandBuilder } = require('discord.js');

// Only define the command structure here
// It will be registered in ready.js
const commands = [
    new SlashCommandBuilder()
        .setName('log')
        .setDescription('Log medication for a specific day.')
        .addStringOption(option =>
            option.setName('day')
                .setDescription('The day to log for')
                .setRequired(true)
                .addChoices(
                    { name: 'Monday', value: 'Monday' },
                    { name: 'Tuesday', value: 'Tuesday' },
                    { name: 'Wednesday', value: 'Wednesday' },
                    { name: 'Thursday', value: 'Thursday' },
                    { name: 'Friday', value: 'Friday' },
                    { name: 'Saturday', value: 'Saturday' },
                    { name: 'Sunday', value: 'Sunday' }
                ))
        .addStringOption(option =>
            option.setName('slot')
                .setDescription('The time slot (AM or PM)')
                .setRequired(false)
                .addChoices(
                    { name: 'AM', value: 'AM' },
                    { name: 'PM', value: 'PM' }
                )),
    new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Create a medication reminder for yourself.')
        .addStringOption(option =>
            option.setName('slot')
                .setDescription('The time slot (AM or PM)')
                .setRequired(true)
                .addChoices(
                    { name: 'AM', value: 'AM' },
                    { name: 'PM', value: 'PM' }
                ))
]
    .map(command => command.toJSON());

module.exports = commands;
