/**
 * Discord embed builders for HenrikDev-powered commands:
 *   /rank, /matches, /mmrhistory, /leaderboard, /esports
 */

import { EmbedBuilder } from "discord.js";

export const VAL_COLOR_1 = 0xFD4553;
export const VAL_COLOR_RANK = 0x7C3AED;   // purple for rank/mmr embeds
export const VAL_COLOR_ESPORTS = 0xF59E0B; // amber for esports

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtTs = (ts) => {
    if (!ts) return "Unknown";
    const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
    return `<t:${Math.floor(d.getTime() / 1000)}:R>`;
};

const fmtDate = (ts) => {
    if (!ts) return "Unknown";
    const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
    return `<t:${Math.floor(d.getTime() / 1000)}:d>`;
};

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

const tierColor = (tier) => {
    const t = (tier || "").toLowerCase();
    if (t.includes("radiant")) return 0xFFD700;
    if (t.includes("immortal")) return 0xFF4655;
    if (t.includes("ascendant")) return 0x00D4AA;
    if (t.includes("diamond")) return 0x9B59B6;
    if (t.includes("platinum")) return 0x00B4DB;
    if (t.includes("gold")) return 0xF1C40F;
    if (t.includes("silver")) return 0x95A5A6;
    if (t.includes("bronze")) return 0xCD7F32;
    if (t.includes("iron")) return 0x7F8C8D;
    return VAL_COLOR_RANK;
};

// ── /rank embed ───────────────────────────────────────────────────────────────

/**
 * Build the /rank embed from HenrikDev MMR v3 response data
 * @param {object} data  The `data` field of the MMR v3 response
 * @param {string} name
 * @param {string} tag
 */
export const rankEmbed = (data, name, tag) => {
    const current = data.current;
    const peak = data.peak;
    const tierName = current?.tier?.name || "Unranked";
    const rr = current?.rr ?? 0;
    const elo = current?.elo ?? 0;
    const gamesNeeded = current?.games_needed_for_rating ?? null;
    const leaderboardRank = current?.leaderboard_placement ?? null;

    const color = tierColor(tierName);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${name}#${tag} — Rank`)
        .setThumbnail(current?.tier?.large_icon || current?.tier?.icon || null)
        .addFields(
            { name: "🏆 Current Rank", value: `**${tierName}** — ${rr} RR`, inline: true },
            { name: "📊 Elo", value: `${elo}`, inline: true }
        );

    if (peak?.tier?.name) {
        embed.addFields({
            name: "⭐ Peak Rank",
            value: `**${peak.tier.name}** (${peak.season?.short || "?"})`,
            inline: true
        });
    }

    if (leaderboardRank) {
        embed.addFields({ name: "🥇 Leaderboard Rank", value: `#${leaderboardRank}`, inline: true });
    }

    if (gamesNeeded !== null && gamesNeeded > 0) {
        embed.addFields({ name: "🎮 Placement Games Left", value: `${gamesNeeded}`, inline: true });
    }

    // Last 5 games win/loss indicator
    if (data.last_games?.length > 0) {
        const last = data.last_games.slice(0, 5).map(g => {
            const won = g.outcome === "won";
            const icon = won ? "🟢" : "🔴";
            const rr = g.rr_change >= 0 ? `+${g.rr_change}` : `${g.rr_change}`;
            return `${icon} ${rr}`;
        }).join("  ");
        embed.addFields({ name: "📈 Last Games", value: last, inline: false });
    }

    embed.setFooter({ text: `Region: ${(data.current?.tier?.act_data?.season_id || "").toUpperCase() || "—"}  •  HenrikDev API` });
    return { embeds: [embed] };
};

// ── /matches embed ─────────────────────────────────────────────────────────────

/**
 * Build the /matches embed from HenrikDev matches v4 response
 * @param {Array} matches  The `data` array from matches v4
 * @param {string} name
 * @param {string} tag
 * @param {string} mode   Game mode (competitive | unrated | etc.)
 */
export const matchesEmbed = (matches, name, tag, mode = "competitive") => {
    const embed = new EmbedBuilder()
        .setColor(VAL_COLOR_1)
        .setTitle(`${name}#${tag} — Recent ${cap(mode)} Matches`);

    if (!matches || matches.length === 0) {
        embed.setDescription("No matches found.");
        return { embeds: [embed] };
    }

    const lines = matches.slice(0, 5).map((match, i) => {
        const meta = match.metadata;
        const me = match.players?.find(p =>
            p.name?.toLowerCase() === name.toLowerCase() &&
            p.tag?.toLowerCase() === tag.toLowerCase()
        ) || match.players?.[0];

        const map = meta?.map?.name || "Unknown Map";
        const result = me?.team_id?.toLowerCase() === match.teams?.find(t => t.won)?.team_id?.toLowerCase() ? "✅ Win" : "❌ Loss";
        const kda = me ? `${me.stats?.kills}/${me.stats?.deaths}/${me.stats?.assists}` : "?/?/?";
        const agent = me?.agent?.name || "?";
        const rr = me?.tier?.rr_change != null
            ? (me.tier.rr_change >= 0 ? `+${me.tier.rr_change}` : `${me.tier.rr_change}`) + " RR"
            : "";
        const ts = fmtTs(meta?.started_at);

        return `**${i + 1}. ${result}** on **${map}** ${ts}\n` +
               `  └ ${agent} — KDA: \`${kda}\`${rr ? `  ${rr}` : ""}`;
    });

    embed.setDescription(lines.join("\n\n"));
    embed.setFooter({ text: "HenrikDev API" });
    return { embeds: [embed] };
};

// ── /mmrhistory embed ─────────────────────────────────────────────────────────

/**
 * Build the /mmrhistory embed from HenrikDev MMR history v2 response
 * @param {Array} history  The `data` array
 * @param {string} name
 * @param {string} tag
 */
export const mmrHistoryEmbed = (history, name, tag) => {
    const embed = new EmbedBuilder()
        .setColor(VAL_COLOR_RANK)
        .setTitle(`${name}#${tag} — Rank History`);

    if (!history || history.length === 0) {
        embed.setDescription("No rank history found.");
        return { embeds: [embed] };
    }

    const lines = history.slice(0, 10).map((entry, i) => {
        const tier = entry.tier?.name || "Unranked";
        const rr = entry.rr ?? 0;
        const change = entry.rr_change;
        const changeStr = change >= 0 ? `+${change}` : `${change}`;
        const icon = change > 0 ? "🟢" : change < 0 ? "🔴" : "⚪";
        const ts = fmtDate(entry.match?.started_at || entry.date);
        const map = entry.match?.map?.name || "?";
        return `${icon} **${tier}** — ${rr} RR (${changeStr}) on **${map}** ${ts}`;
    });

    embed.setDescription(lines.join("\n"));
    embed.setFooter({ text: "HenrikDev API" });
    return { embeds: [embed] };
};

// ── /leaderboard embed ────────────────────────────────────────────────────────

/**
 * Build the /leaderboard embed from HenrikDev leaderboard v3 response
 * @param {object} lbData  The `data` field of the v3 leaderboard response
 * @param {string} affinity
 */
export const leaderboardEmbed = (lbData, affinity) => {
    const players = lbData?.players || lbData || [];

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🏆 Leaderboard — ${affinity.toUpperCase()}`);

    if (!players || players.length === 0) {
        embed.setDescription("No leaderboard data found.");
        return { embeds: [embed] };
    }

    const lines = players.slice(0, 20).map((p, i) => {
        const rank = p.leaderboard_rank ?? (i + 1);
        const playerName = p.name_tag ? p.name_tag : (p.gameName && p.tagLine ? `${p.gameName}#${p.tagLine}` : "Unknown");
        const rr = p.rr ?? p.ranked_rating ?? 0;
        const tier = p.tier?.name || "Immortal";
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `**#${rank}**`;
        return `${medal} ${playerName} — ${rr} RR (${tier})`;
    });

    embed.setDescription(lines.join("\n"));
    embed.setFooter({ text: "HenrikDev API  •  Top 20 shown" });
    return { embeds: [embed] };
};

// ── /esports embed ────────────────────────────────────────────────────────────

/**
 * Build the /esports embed from HenrikDev esports schedule v1 response
 * @param {Array} schedule  The `data` array from the schedule endpoint
 */
export const esportsEmbed = (schedule) => {
    const embed = new EmbedBuilder()
        .setColor(VAL_COLOR_ESPORTS)
        .setTitle("📅 VCT Esports Schedule");

    if (!schedule || schedule.length === 0) {
        embed.setDescription("No upcoming matches found.");
        return { embeds: [embed] };
    }

    // Sort by start time ascending
    const sorted = [...schedule].sort((a, b) => {
        const ta = new Date(a.date || a.started_at || 0).getTime();
        const tb = new Date(b.date || b.started_at || 0).getTime();
        return ta - tb;
    });

    const lines = sorted.slice(0, 10).map(match => {
        const league = match.league?.name || match.tournament || "VCT";
        const team1 = match.teams?.[0]?.name || "TBD";
        const team2 = match.teams?.[1]?.name || "TBD";
        const ts = match.date ? fmtTs(match.date) : "TBD";
        const state = match.state || match.status || "";
        const stateIcon = state === "live" || state === "ongoing" ? "🔴 LIVE" : ts;
        return `**${league}**\n  └ ${team1} vs ${team2} — ${stateIcon}`;
    });

    embed.setDescription(lines.join("\n\n"));
    embed.setFooter({ text: "Data via HenrikDev API (VLR.gg)" });
    return { embeds: [embed] };
};

// ── /esports events embed ─────────────────────────────────────────────────────

/**
 * Build an embed for VLR esports events list
 * @param {Array} events  Array from VLR events v2
 */
export const esportsEventsEmbed = (events) => {
    const embed = new EmbedBuilder()
        .setColor(VAL_COLOR_ESPORTS)
        .setTitle("🎮 VCT Esports Events");

    if (!events || events.length === 0) {
        embed.setDescription("No events found.");
        return { embeds: [embed] };
    }

    const lines = events.slice(0, 12).map(ev => {
        const name = ev.name || "Unknown Event";
        const region = ev.region || "?";
        const status = ev.status || ev.type || "ongoing";
        const icon = status === "ongoing" ? "🔴" : "⏳";
        const prizePool = ev.prize_pool ? `💰 ${ev.prize_pool}` : "";
        return `${icon} **${name}** (${region.toUpperCase()})${prizePool ? `  ${prizePool}` : ""}`;
    });

    embed.setDescription(lines.join("\n"));
    embed.setFooter({ text: "Data via HenrikDev API (VLR.gg)" });
    return { embeds: [embed] };
};

// ── Generic error embed ───────────────────────────────────────────────────────

export const hdevErrorEmbed = (message) =>
    new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("❌ Error")
        .setDescription(message || "Something went wrong calling the HenrikDev API.")
        .setFooter({ text: "HenrikDev API" });
