import dotenv from "dotenv";
dotenv.config();

import { getStoredMatches } from "./src/features/valorant/valorant/hdevApi.js";

async function main() {
    console.log("Token:", process.env.VALORANT_HDEV_TOKEN);
    // Let's use the active player we found: heartless#css
    const res = await getStoredMatches("na", "heartless", "css", "competitive", 20);
    console.log("Status:", res.status);
    console.log("Error:", res.error);
    if (res.data) {
        console.log("Number of stored matches:", res.data.length);
        const match = res.data[0];
        if (match) {
            console.log("Match root keys:", Object.keys(match));
            console.log("Match meta:", JSON.stringify(match.meta, null, 2));
            console.log("Match stats:", JSON.stringify(match.stats, null, 2));
            console.log("Match teams:", JSON.stringify(match.teams, null, 2));
            if (match.players) {
                console.log("Match has players array of length:", match.players.length);
            }
        }
        
        // Let's print the character played in each match
        res.data.forEach((m, idx) => {
            console.log(`Match ${idx + 1}: Character = ${m.stats?.character?.name}, Team = ${m.stats?.team}`);
        });
    }
}

main().catch(console.error);
