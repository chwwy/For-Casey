require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Helper: Get Day Name in Specific Timezone
function getDayName(date, timezone) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(date);
}

// Helper: Get Week Start
function getWeekStart(date, timezone) {
    const d = new Date(date.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dStr}`;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const instancesConfig = {
        nao: {
            userId: '860909419226595328',
            timezone: 'Asia/Jakarta'
        },
        nightly: {
            userId: '287489239250370560',
            timezone: 'America/Chicago'
        }
    };

    let data = { instances: {} };

    for (const [key, config] of Object.entries(instancesConfig)) {
        data.instances[key] = {
            currentWeekStart: "2026-02-16",
            days: {},
            messageIds: {}
        };
        const rData = data.instances[key];

        try {
            const user = await client.users.fetch(config.userId);
            const dmChannel = await user.createDM();
            const messages = await dmChannel.messages.fetch({ limit: 100 });

            // Sort ascending
            const msgs = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            for (let i = 0; i < msgs.length; i++) {
                const msg = msgs[i];
                if (!msg.author.bot && msg.createdTimestamp > new Date('2026-02-16T00:00:00Z').getTime()) {
                    // Try to find what it was replying to. Usually the msg immediately before from the bot
                    let botMsg = null;
                    if (msg.reference && msg.reference.messageId) {
                        botMsg = messages.get(msg.reference.messageId);
                    } else {
                        // just find the closest bot msg before this one
                        for (let j = i - 1; j >= 0; j--) {
                            if (msgs[j].author.bot && msgs[j].content.includes('Medication Report')) {
                                botMsg = msgs[j];
                                break;
                            }
                        }
                    }

                    if (botMsg) {
                        const content = botMsg.content;
                        let dayName = "";
                        let slot = "";

                        const match = content.match(/\((.*?)\)/);
                        if (match) {
                            const inner = match[1]; // e.g. "Monday PM" or "AM"
                            if (inner.includes(' ')) {
                                const parts = inner.split(' ');
                                dayName = parts[0];
                                slot = parts[1];
                            } else {
                                slot = inner;
                                dayName = getDayName(botMsg.createdAt, config.timezone);
                            }
                        }

                        if (dayName && slot) {
                            if (!rData.days[dayName]) {
                                rData.days[dayName] = { AM: false, PM: false, mood: { AM: "", PM: "" } };
                            }

                            // Treat as logged and record mood
                            // User timestamp:
                            const dLocal = new Date(msg.createdAt.toLocaleString('en-US', { timeZone: config.timezone }));
                            const timeString = dLocal.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                            // Don't overwrite if manually set to a string already, or keep it true/string
                            rData.days[dayName][slot] = timeString;
                            rData.days[dayName].mood[slot] = msg.content;
                            console.log(`[${key}] Parsed ${dayName} ${slot}: \n  Mood: ${msg.content.substring(0, 50)}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`Error processing ${key}:`, e.message);
        }
    }

    fs.writeFileSync('./medication_data.json', JSON.stringify(data, null, 2));
    console.log('Saved to medication_data.json');
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
