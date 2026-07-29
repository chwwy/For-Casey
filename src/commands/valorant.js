const { ApplicationCommandOptionType } = require('discord.js');

const settingsChoices = [
    { name: "Daily shop channel", value: "dailyShop" },
    { name: "Ping on auto daily shop", value: "pingOnAutoDailyShop" },
    { name: "Hide IGN", value: "hideIgn" },
    { name: "Others can view shop", value: "othersCanViewShop" },
    { name: "Others can view collection", value: "othersCanViewColl" },
    { name: "Others can view profile", value: "othersCanViewProfile" },
    { name: "Others can use account buttons", value: "othersCanUseAccountButtons" },
    { name: "Language", value: "locale" }
];

const WeaponType = {
    Odin: "Odin",
    Ares: "Ares",
    Vandal: "Vandal",
    Bulldog: "Bulldog",
    Phantom: "Phantom",
    Judge: "Judge",
    Bucky: "Bucky",
    Frenzy: "Frenzy",
    Classic: "Classic",
    Ghost: "Ghost",
    Sheriff: "Sheriff",
    Shorty: "Shorty",
    Operator: "Operator",
    Guardian: "Guardian",
    Marshal: "Marshal",
    Outlaw: "Outlaw",
    Spectre: "Spectre",
    Stinger: "Stinger",
    Knife: "Tactical Knife"
};

const commands = [
    {
        name: "shop",
        description: "Show your current daily shop!",
        options: [{
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Optional: see the daily shop of someone else!",
            required: false
        }]
    },
    {
        name: "bundles",
        description: "Show the current featured bundle(s)."
    },
    {
        name: "bundle",
        description: "Inspect a specific bundle",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "bundle",
            description: "The name of the bundle you want to inspect!",
            required: true,
            autocomplete: true
        }]
    },
    {
        name: "nightmarket",
        description: "Show your Night Market if there is one."
    },
    {
        name: "balance",
        description: "Show how many VALORANT Points & Radianite you have in your account!"
    },
    {
        name: "alert",
        description: "Set an alert for when a particular skin is in your shop.",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "skin",
            description: "The name of the skin you want to set an alert for",
            required: true,
            autocomplete: true
        }]
    },
    {
        name: "alerts",
        description: "Show all your active alerts!"
    },
    {
        name: "testalerts",
        description: "Make sure alerts are working for your account and in this channel"
    },
    {
        name: "login",
        description: "Log in with your Riot username/password!",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "username",
                description: "Your Riot username",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "password",
                description: "Your Riot password",
                required: true
            },
        ]
    },
    {
        name: "update",
        description: "Update your username/region in the bot.",
    },
    {
        name: "2fa",
        description: "Enter your 2FA code if needed",
        options: [{
            type: ApplicationCommandOptionType.Integer,
            name: "code",
            description: "The 2FA Code",
            required: true,
            minValue: 0,
            maxValue: 999999
        }]
    },
    {
        name: "cookies",
        description: "Log in with your cookies. Useful if you have 2FA or if you use Google/Facebook to log in.",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "cookies",
            description: "Your auth.riotgames.com cookie header",
            required: true
        }]
    },
    {
        name: "settings",
        description: "Change your settings with the bot, or view your current settings",
        options: [{
            name: "view",
            description: "See your current settings",
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "set",
            description: "Change one of your settings with the bot",
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "setting",
                description: "The name of the setting you want to change",
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: settingsChoices
            }]
        }
        ]
    },
    {
        name: "logout",
        description: "Delete your credentials from the bot, but keep your alerts..",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "account",
            description: "The account you want to logout from. Leave blank to logout of your current account.",
            required: false,
            autocomplete: true
        }]
    },
    {
        name: "forget",
        description: "Forget and permanently delete your account from the bot.",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "account",
            description: "The account you want to forget. Leave blank to forget all accounts.",
            required: false,
            autocomplete: true
        }]
    },
    {
        name: "collection",
        description: "Show off your skin collection!",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "weapon",
            description: "Optional: see all your skins for a specific weapon",
            required: false,
            choices: Object.values(WeaponType).map(weaponName => ({
                name: weaponName,
                value: weaponName,
            })),
        },
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Optional: see someone else's collection!",
            required: false
        }]
    },
    {
        name: "battlepass",
        description: "Calculate battlepass progression.",
        options: [{
            type: ApplicationCommandOptionType.Integer,
            name: "maxlevel",
            description: "Enter the level you want to reach",
            required: false,
            minValue: 2,
            maxValue: 55
        }]
    },
    {
        name: "stats",
        description: "See the stats for a skin",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "skin",
            description: "The name of the skin you want to see the stats of",
            required: false,
            autocomplete: true
        }]
    },
    {
        name: "account",
        description: "Switch the Valorant account you are currently using",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "account",
            description: "The account you want to switch to",
            required: true,
            autocomplete: true
        }]
    },
    {
        name: "accounts",
        description: "Show all of your Valorant accounts"
    },
    {
        name: "valstatus",
        description: "Check the status of your account's VALORANT servers"
    },
    {
        name: "info",
        description: "Show information about the bot"
    },
    {
        name: "profile",
        description: "Check your VALORANT profile",
        options: [{
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Optional: see someone else's profile!",
            required: false
        }]
    },

    // ── HenrikDev API commands ─────────────────────────────────────────────────

    {
        name: "rank",
        description: "🏆 Look up any player's current Valorant rank (public lookup)",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "Riot ID name (e.g. Casey)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "tag",
                description: "Riot ID tag (e.g. NA1 — without the #)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "region",
                description: "Region (na, eu, ap, kr, latam, br)",
                required: true,
                choices: [
                    { name: "North America", value: "na" },
                    { name: "Europe", value: "eu" },
                    { name: "Asia Pacific", value: "ap" },
                    { name: "Korea", value: "kr" },
                    { name: "Latin America", value: "latam" },
                    { name: "Brazil", value: "br" }
                ]
            }
        ]
    },

    {
        name: "matches",
        description: "🎮 Look up recent matches for any Valorant player (public lookup)",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "Riot ID name (e.g. Casey)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "tag",
                description: "Riot ID tag (e.g. NA1 — without the #)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "region",
                description: "Region (na, eu, ap, kr, latam, br)",
                required: true,
                choices: [
                    { name: "North America", value: "na" },
                    { name: "Europe", value: "eu" },
                    { name: "Asia Pacific", value: "ap" },
                    { name: "Korea", value: "kr" },
                    { name: "Latin America", value: "latam" },
                    { name: "Brazil", value: "br" }
                ]
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "mode",
                description: "Game mode (default: competitive)",
                required: false,
                choices: [
                    { name: "Competitive", value: "competitive" },
                    { name: "Unrated", value: "unrated" },
                    { name: "Swiftplay", value: "swiftplay" },
                    { name: "Spike Rush", value: "spikerush" },
                    { name: "Deathmatch", value: "deathmatch" },
                    { name: "Team Deathmatch", value: "teamdeathmatch" }
                ]
            }
        ]
    },

    {
        name: "mmrhistory",
        description: "📈 Look up rank change history for any Valorant player (public lookup)",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "Riot ID name (e.g. Casey)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "tag",
                description: "Riot ID tag (e.g. NA1 — without the #)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "region",
                description: "Region (na, eu, ap, kr, latam, br)",
                required: true,
                choices: [
                    { name: "North America", value: "na" },
                    { name: "Europe", value: "eu" },
                    { name: "Asia Pacific", value: "ap" },
                    { name: "Korea", value: "kr" },
                    { name: "Latin America", value: "latam" },
                    { name: "Brazil", value: "br" }
                ]
            }
        ]
    },

    {
        name: "leaderboard",
        description: "🏅 Show the top ranked players on any region's leaderboard",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "region",
                description: "Region (na, eu, ap, kr, latam, br)",
                required: true,
                choices: [
                    { name: "North America", value: "na" },
                    { name: "Europe", value: "eu" },
                    { name: "Asia Pacific", value: "ap" },
                    { name: "Korea", value: "kr" },
                    { name: "Latin America", value: "latam" },
                    { name: "Brazil", value: "br" }
                ]
            }
        ]
    },

    {
        name: "esports",
        description: "📅 Show upcoming VCT esports schedule and events",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "region",
                description: "Filter by region (optional)",
                required: false,
                choices: [
                    { name: "North America", value: "na" },
                    { name: "Europe", value: "eu" },
                    { name: "Pacific", value: "ap" },
                    { name: "China", value: "cn" },
                    { name: "All Regions", value: "" }
                ]
            }
        ]
    },

    {
        name: "playerstats",
        description: "📊 Deep stats for any player — KD, HS%, win rate, per-match breakdown (public lookup)",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "Riot ID name (e.g. Casey)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "tag",
                description: "Riot ID tag without the # (e.g. NA1)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "region",
                description: "Region (na, eu, ap, kr, latam, br)",
                required: true,
                choices: [
                    { name: "North America", value: "na" },
                    { name: "Europe", value: "eu" },
                    { name: "Asia Pacific", value: "ap" },
                    { name: "Korea", value: "kr" },
                    { name: "Latin America", value: "latam" },
                    { name: "Brazil", value: "br" }
                ]
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "view",
                description: "What to show (default: overview)",
                required: false,
                choices: [
                    { name: "Overview (KD, HS%, win rate, top agents)", value: "overview" },
                    { name: "Match History (per-match KDA + HS%)", value: "history" }
                ]
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "mode",
                description: "Game mode filter (default: competitive)",
                required: false,
                choices: [
                    { name: "Competitive", value: "competitive" },
                    { name: "Unrated", value: "unrated" },
                    { name: "Swiftplay", value: "swiftplay" },
                    { name: "Spike Rush", value: "spikerush" },
                    { name: "Deathmatch", value: "deathmatch" }
                ]
            }
        ]
    }
];

module.exports = commands;

