module.exports = {
    instances: {
        'nao': {
            name: "Nao's Medication Report",
            channels: ['1472313975386669218'],
            timezone: 'Asia/Jakarta',
            slots: ['AM', 'PM'],
            backupUserId: '860909419226595328',
            reminders: {
                'AM': {
                    time: '00 09 * * *',
                    message: "Hey, <@860909419226595328>! Don't forget to take your morning pill and log it ❣️"
                },
                'PM': {
                    time: '00 21 * * *',
                    message: "Hey, <@860909419226595328>! Don't forget to take your night pill and log it ❣️"
                }
            }
        },
        'nightly': {
            name: "Casey's Medication Report",
            channels: ['1472444626978869411'],
            timezone: 'America/Chicago',
            slots: ['PM'],
            backupUserId: '287489239250370560',
            reminder: {
                time: '55 19 * * *',
                message: "Hey, <@287489239250370560>! Don't forget to take your pill and log it ❣️"
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
