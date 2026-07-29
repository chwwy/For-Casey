export let config = {
    token: process.env.DISCORD_TOKEN,
    HDevToken: process.env.VALORANT_HDEV_TOKEN || "",
    HDevTokenAlert: process.env.VALORANT_HDEV_TOKEN_ALERT !== "false",
    fetchSkinPrices: true,
    fetchSkinRarities: true,
    localiseText: true,
    localiseSkinNames: true,
    linkItemImage: true,
    videoViewerWithSite: process.env.VALORANT_VIDEO_VIEWER_WITH_SITE === "true",
    imageViewerWithSite: process.env.VALORANT_IMAGE_VIEWER_WITH_SITE === "true",
    useEmojisFromServer: process.env.VALORANT_USE_EMOJIS_FROM_SERVER || "",
    refreshSkins: process.env.VALORANT_REFRESH_SKINS || "10 0 0 * * *",
    checkGameVersion: "*/15 * * * *",
    updateUserAgent: "*/15 * * * *",
    delayBetweenAlerts: 5000,
    alertsPerPage: 10,
    careerCacheExpiration: 600000,
    emojiCacheExpiration: 10000,
    loadoutCacheExpiration: 600000,
    useShopCache: true,
    useLoginQueue: false,
    loginQueueInterval: 3000,
    loginQueuePollRate: 2000,
    loginRetryTimeout: 600000,
    authFailureStrikes: 2,
    maxAccountsPerUser: 5,
    userDataCacheExpiration: 168,
    rateLimitBackoff: 60,
    rateLimitCap: 600,
    useMultiqueue: false,
    storePasswords: false,
    trackStoreStats: true,
    statsExpirationDays: 14,
    statsPerPage: 8,
    shardReadyTimeout: 600000,
    autoDeployCommands: false, // Disables self deployment
    ownerId: "287489239250370560,860909419226595328", // Casey and Nao
    ownerName: "Casey & Nao",
    status: "Up and running!",
    notice: "",
    onlyShowNoticeOnce: true,
    maintenanceMode: false,
    githubToken: "",
    logToChannel: "",
    logFrequency: "*/10 * * * * *",
    logUrls: false
};
export default config;

export const loadConfig = () => {
    return config;
}

export const saveConfig = () => {
    console.log("saveConfig: Config update attempted in memory");
}
