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
                .setDescription('The time slot (AM, PM, or Sleep)')
                .setRequired(false)
                .addChoices(
                    { name: 'AM', value: 'AM' },
                    { name: 'PM', value: 'PM' },
                    { name: 'Sleep', value: 'Sleep' }
                )),
    new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Create a medication reminder for yourself.')
        .addStringOption(option =>
            option.setName('slot')
                .setDescription('The time slot (AM, PM, or Sleep)')
                .setRequired(true)
                .addChoices(
                    { name: 'AM', value: 'AM' },
                    { name: 'PM', value: 'PM' },
                    { name: 'Sleep', value: 'Sleep' }
                )),
    new SlashCommandBuilder()
        .setName('banchannel')
        .setDescription('Configure auto-ban channels.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a channel to the auto-ban list.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to add')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a channel from the auto-ban list.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all configured auto-ban channels.')
        ),
    new SlashCommandBuilder()
        .setName('curhat')
        .setDescription('Create a private channel where messages are autodeleted.')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('The number of seconds before messages are autodeleted.')
                .setRequired(true)
                .setMinValue(1)
        )
]
    .map(command => command.toJSON());

module.exports = commands;
