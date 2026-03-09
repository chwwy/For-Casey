const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const englishTranslator = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-09-2025",
    systemInstruction: `You are a generic translator for a Discord chat.
Task: Translate the following text from Indonesian (or mixed Indonesian/English) to standard English.
Rules:
1. Preserve the tone, slang, and intent of the original message.
2. If the message is already fully English, strictly return the original text exactly as is.
3. Do not add any conversational filler like "Here is the translation". Just the translation.
4. Maintain formatting like code blocks, bolding, etc.
5. If the Indonesian is informal, the English should be informal. If there are cultural jokes, provide a localized English equivalent.`
});

const indoTranslator = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-09-2025",
    systemInstruction: `You are a generic translator for a Discord chat.
Task: Translate the following English text (and/or text inside the image) to Indonesian.
Rules:
1. Use natural, conversational Indonesian (gaul/informal) unless the English is very formal.
2. Preserve the tone and intent.
3. Don't use dramatic and ancient Indonesian words like "selir" instead of "pasangan"`
});

// Helper to convert image URL to Generative Part
async function urlToGenerativePart(url, mimeType) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}

async function translateText(text, authorUsername) {
    if (!text || text.trim() === '') return null;
    try {
        const prompt = `Original Author: ${authorUsername}\nMessage: "${text}"`;
        const result = await englishTranslator.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Translation Error:", error);
        return null;
    }
}

async function translateToIndonesian(text, imageParts = []) {
    try {
        const promptContext = `Message: "${text || '[Image Only]'}"`;
        const result = await indoTranslator.generateContent([promptContext, ...imageParts]);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Indonesian Translation Error Details:", error);
        return null;
    }
}

module.exports = {
    englishTranslator,
    indoTranslator,
    urlToGenerativePart,
    translateText,
    translateToIndonesian
};
