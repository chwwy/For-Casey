const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Use Google's cheapest 8B parameter model, extremely cost-effective for simple translations
const MODEL_NAME = "gemini-1.5-flash-8b";

const englishTranslator = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: "You are a generic translator for a Discord chat. Translate the user's text from Indonesian (or mixed Indonesian/English) to standard English. Rules: 1. Preserve tone, slang, and intent. 2. If already fully English, strictly return original text exactly. 3. No conversational filler. 4. Maintain markdown formatting. 5. Localize informal/gaul text."
});

const indoTranslator = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: "You are a generic translator for a Discord chat. Translate English text (and/or text inside images) to Indonesian. Rules: 1. Use natural, conversational gaul/informal Indonesian unless original is highly formal. 2. Preserve tone and intent. 3. Avoid overly dramatic/ancient words."
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
    model,
    urlToGenerativePart,
    translateText,
    translateToIndonesian
};
