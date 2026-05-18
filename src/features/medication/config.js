module.exports = {
    instances: {
        'nao': {
            name: "Nao's Medication Report",
            channels: ['1505874859962400789'],
            timezone: 'Asia/Jakarta',
            slots: ['AM', 'PM'],
            backupUserId: '860909419226595328',
            reminders: {
                'AM': {
                    time: '00 09 * * *',
                    message: "Hey, <@860909419226595328>! Don't forget to take your pill and log it ❣️"
                }
            }
        },
        'nightly': {
            name: "Casey's Medication Report",
            channels: ['1505874841767776296'],
            timezone: 'America/Chicago',
            slots: ['AM'],
            backupUserId: '287489239250370560',
            reminders: {
                'AM': {
                    time: '00 07 * * *',
                    message: "Hey, <@287489239250370560>! Don't forget to take your pill and log it ❣️"
                }
            }
        }
    },
    // Helper to find instance by channel ID
    getInstanceByChannel: function (channelId) {
        for (const [key, config] of Object.entries(this.instances)) {
            if (config.channels.includes(channelId)) {
                return { key, ...config };
            }
        }
        return null;
    }
};
