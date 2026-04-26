const translate = require('google-translate-api-x');

// Helper to convert image URL to Generative Part (Disabled for free translation API)
async function urlToGenerativePart(url, mimeType) {
    return null; // Image translation is not supported with the free google translate API
}

async function translateText(text, authorUsername) {
    if (!text || text.trim() === '') return null;
    try {
        const result = await translate(text, { to: 'en' });
        return result.text;
    } catch (error) {
        console.error("Translation Error:", error.message);
        return null;
    }
}

async function translateToIndonesian(text, imageParts = []) {
    if (!text || text.trim() === '') return null;
    try {
        const result = await translate(text, { to: 'id' });
        return result.text;
    } catch (error) {
        console.error("Indonesian Translation Error Details:", error.message);
        return null;
    }
}

module.exports = {
    urlToGenerativePart,
    translateText,
    translateToIndonesian
};
