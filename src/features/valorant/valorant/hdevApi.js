/**
 * HenrikDev Valorant API v4.6.0 wrapper
 * Base URL: https://api.henrikdev.xyz
 * Token read from process.env.VALORANT_HDEV_TOKEN or config.HDevToken
 */

const BASE_URL = "https://api.henrikdev.xyz";

const getToken = () =>
    process.env.VALORANT_HDEV_TOKEN || "";

/**
 * Internal fetch helper — attaches Authorization header and parses JSON.
 * @param {string} path  e.g. "/valorant/v3/mmr/na/pc/Casey/NA1"
 * @returns {Promise<{data: any, status: number, error: string|null}>}
 */
const hdevFetch = async (path) => {
    const url = `${BASE_URL}${path}`;
    try {
        const res = await fetch(url, {
            headers: {
                Authorization: getToken(),
                "Content-Type": "application/json"
            }
        });
        const json = await res.json();
        if (!res.ok) {
            const msg = json?.errors?.[0]?.message || json?.message || `HTTP ${res.status}`;
            return { data: null, status: res.status, error: msg };
        }
        return { data: json.data, status: res.status, error: null };
    } catch (err) {
        console.error("[hdevApi] fetch error:", err.message);
        return { data: null, status: 500, error: err.message };
    }
};

// ─────────────────────────────────────────────
// Account
// ─────────────────────────────────────────────

/** Get account info by name#tag (v2 includes card assets) */
export const getAccount = (name, tag) =>
    hdevFetch(`/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);

// ─────────────────────────────────────────────
// MMR / Rank
// ─────────────────────────────────────────────

/**
 * Get MMR (current rank + peak rank) by name#tag — v3 supports platform param
 * @param {string} affinity  na | eu | ap | kr | latam | br
 * @param {string} name
 * @param {string} tag
 * @param {string} platform  pc | console
 */
export const getMMR = (affinity, name, tag, platform = "pc") =>
    hdevFetch(`/valorant/v3/mmr/${affinity}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);

/**
 * Get MMR history (last competitive games) — v2
 */
export const getMMRHistory = (affinity, name, tag, platform = "pc") =>
    hdevFetch(`/valorant/v2/mmr-history/${affinity}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);

// ─────────────────────────────────────────────
// Matches
// ─────────────────────────────────────────────

/**
 * Get recent match history — v4 with platform support
 * @param {string} affinity
 * @param {string} name
 * @param {string} tag
 * @param {string} mode  competitive | unrated | swiftplay | deathmatch | ...
 * @param {number} size  number of matches (max ~20)
 * @param {string} platform  pc | console
 */
export const getMatches = (affinity, name, tag, mode = null, size = 5, platform = "pc") => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (size) params.set("size", size);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return hdevFetch(`/valorant/v4/matches/${affinity}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}${qs}`);
};

// ─────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────

/**
 * Get ranked leaderboard — v3
 * @param {string} affinity
 * @param {string} platform  pc | console
 * @param {number} size      entries per page (default 200)
 * @param {number} page      page number (0-indexed)
 * @param {string} season    season ID (optional)
 */
export const getLeaderboard = (affinity, platform = "pc", size = 20, page = 0, season = null) => {
    const params = new URLSearchParams({ size, page });
    if (season) params.set("season", season);
    return hdevFetch(`/valorant/v3/leaderboard/${affinity}/${platform}?${params.toString()}`);
};

// ─────────────────────────────────────────────
// Esports
// ─────────────────────────────────────────────

/**
 * Get VCT esports schedule — v1
 * @param {string|null} region  e.g. "na", "eu" (optional)
 * @param {string|null} league  e.g. "vct-americas" (optional)
 */
export const getEsportsSchedule = (region = null, league = null) => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (league) params.set("league", league);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return hdevFetch(`/valorant/v1/esports/schedule${qs}`);
};

/**
 * Get VLR esports events — v2
 * @param {string|null} region  e.g. "na" (optional)
 * @param {string|null} type    "ongoing" | "upcoming" (optional)
 * @param {number} page         0-indexed
 */
export const getEsportsEvents = (region = null, type = null, page = 0) => {
    const params = new URLSearchParams({ page });
    if (region) params.set("region", region);
    if (type) params.set("type", type);
    return hdevFetch(`/valorant/v2/esports/vlr/events?${params.toString()}`);
};

/**
 * Get Premier team by name#tag — v1
 */
export const getPremierTeam = (name, tag, affinity = null) => {
    const params = new URLSearchParams();
    if (affinity) params.set("affinity", affinity);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return hdevFetch(`/valorant/v1/premier/${encodeURIComponent(name)}/${encodeURIComponent(tag)}${qs}`);
};
