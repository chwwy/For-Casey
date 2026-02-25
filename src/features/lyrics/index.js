const { Client } = require('genius-lyrics');
const client = new Client(process.env.GENIUS_ACCESS_TOKEN);

async function handleMessage(message) {
    if (!message.content.startsWith('!lyrics')) return;

    const query = message.content.slice(7).trim();
    if (!query) {
        return message.reply('Please provide a song to search for, e.g., `!lyrics artist - song title`');
    }

    try {
        const searches = await client.songs.search(query);
        if (searches.length === 0) {
            return message.reply(`No lyrics found for: ${query}`);
        }

        const song = searches[0];
        let lyrics = await song.lyrics();

        // Strip everything before the first recognized section header (e.g., [Verse 1])
        lyrics = lyrics.replace(/^[\s\S]*?(?=\[(?:Verse|Chorus|Intro|Hook|Bridge|Pre-Chorus|Outro|Guitar|Instrumental|Part|Refrain)[^\]]*\])/i, '');
        // Clean up common trailing artifacts from genius-lyrics
        lyrics = lyrics.replace(/\d*Embed$/, '');
        lyrics = lyrics.replace(/You might also like/gi, '');
        lyrics = lyrics.trim();

        // Discord embed description limit is 4096.
        const embedParams = {
            title: `${song.title} - ${song.artist.name}`,
            url: song.url,
            thumbnail: { url: song.thumbnail },
            color: 0xffd1dc
        };

        if (lyrics.length <= 4096) {
            embedParams.description = lyrics;
            await message.reply({ embeds: [embedParams] });
        } else {
            // Split into pieces
            const chunks = lyrics.match(/[\s\S]{1,4096}/g);
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply({ embeds: [{ ...embedParams, description: chunks[i] }] });
                } else {
                    await message.channel.send({ embeds: [{ title: `${song.title} - Continued`, description: chunks[i], color: 0xffff00 }] });
                }
            }
        }
    } catch (error) {
        console.error('Error fetching lyrics:', error);
        await message.reply('An error occurred while fetching the lyrics.');
    }
}

module.exports = {
    handleMessage
};
