const config = require('../config/env');

async function libreTranslate(text, targetLang) {
    const url = config.LIBRETRANSLATE_URL;
    if (!url) {
        throw new Error("LIBRETRANSLATE_URL environment variable is not defined");
    }

    const body = {
        q: text,
        source: "auto",
        target: targetLang,
        format: "text"
    };

    if (config.LIBRETRANSLATE_API_KEY) {
        body.api_key = config.LIBRETRANSLATE_API_KEY;
    }

    const res = await fetch(`${url.replace(/\/$/, '')}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`LibreTranslate API error: status ${res.status} - ${errorText}`);
    }

    const data = await res.json();

    // Only translate to English if the source language was detected as Indonesian (id)
    if (targetLang === 'en') {
        const detected = data.detectedLanguage?.language;
        if (detected !== 'id') {
            return null;
        }
    }

    return data.translatedText;
}

// Helper to convert image URL to Generative Part (Disabled for free translation API)
async function urlToGenerativePart(url, mimeType) {
    return null; // Image translation is not supported with the free google translate API
}

async function translateText(text, authorUsername) {
    if (!text || text.trim() === '') return null;
    try {
        return await libreTranslate(text, 'en');
    } catch (error) {
        console.error("Translation Error:", error.message);
        return null;
    }
}

async function translateToIndonesian(text, imageParts = []) {
    if (!text || text.trim() === '') return null;
    try {
        return await libreTranslate(text, 'id');
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
