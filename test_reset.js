const data = require('./src/features/medication/data');
const config = require('./src/features/medication/config');

for (const key of Object.keys(config.instances)) {
    console.log(`\n--- Instance: ${key} ---`);
    console.log("Current Week Start (from config/timezone):", data.getNow(config.instances[key].timezone), " -> ", data.shouldReset(key, config.instances[key].timezone) ? "RESET NEEDED" : "NO RESET");
    const inst = data.peekInstanceData(key);
    console.log("File data currentWeekStart:", inst ? inst.currentWeekStart : "null");
}
