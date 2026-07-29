import fs from "fs";
import {BaseInteraction} from "discord.js";
import {getSetting} from "./settings.js";
import {getUser, User} from "../valorant/auth.js";
import config from "./config.js";

// languages valorant doesn't have:
// danish, croatian, lithuanian, hungarian, dutch, norwegian, romanian, finnish, swedish, czech, greek, bulgarian, ukranian, hindi
// languages discord doesn't have:
// arabic, mexican spanish, indonesian
export const discToValLang = {
    'de'   : 'de-DE',
    'en-GB': 'en-US', // :(
    'en-US': 'en-US',
    'es-ES': 'es-ES',
    'fr'   : 'fr-FR',
    'it'   : 'it-IT',
    'pl'   : 'pl-PL',
    'pt-BR': 'pt-BR',
    'vi'   : 'vi-VN',
    'tr'   : 'tr-TR',
    'ru'   : 'ru-RU',
    'th'   : 'th-TH',
    'zh-CN': 'zh-CN',
    'ja'   : 'ja-JP',
    'zh-TW': 'zh-TW',
    'ko'   : 'ko-KR',

    // valorant languages, that discord doesn't support
    'ar-AE': 'ar-AE',
    'es-MX': 'es-MX',
    'id-ID': 'id-ID'
}

export const valToDiscLang = {};
Object.keys(discToValLang).forEach(discLang => {
    valToDiscLang[discToValLang[discLang]] = discLang;
});

export const discLanguageNames = {
    'de'   : '🇳🇱 Deutsch',
    'en-GB': '🇬🇧 English (UK)',
    'en-US': '🇺🇸 English (US)',
    'es-ES': '🇪🇸 Español',
    'fr'   : '🇫🇷 Français',
    'it'   : '🇮🇹 Italiano',
    'pl'   : '🇵🇱 Polski',
    'pt-BR': '🇧🇷 Português (Brasil)',
    'vi'   : '🇻🇳 Tiếng Việt',
    'tr'   : '🇹🇷 Türkçe',
    'ru'   : '🇷🇺 Русский',
    'th'   : '🇹🇭 ไทย',
    'zh-CN': '🇨🇳 简体中文',
    'ja'   : '🇯🇵 日本語',
    'zh-TW': '🇹🇼 繁體中文',
    'ko'   : '🇰🇷 한국어',

    // valorant languages, that discord doesn't support
    'ar-AE': '🇸🇦 العربية',
    'es-MX': '🇲🇽 Español (México)',
    'id-ID': '🇮🇩 Bahasa Indonesia',

    // languages that neither discord nor valorant support
    'tl-PH': '🇵🇭 Tagalog',
}

export const DEFAULT_LANG = 'en-GB';
export const DEFAULT_VALORANT_LANG = 'en-US';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const languages = {};

const importLanguage = (language) => {
    let languageStrings;
    try {
        const langPath = path.join(__dirname, `../languages/${language}.json`);
        languageStrings = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
    } catch (e) {
        if(language === DEFAULT_LANG) {
            console.error(`Couldn't load ${DEFAULT_LANG}.json from ${langPath}! Things will break.`);
            console.error(e);
        }
        return;
    }

    if(language === DEFAULT_LANG) {
        languages[language] = languageStrings;
        return;
    }

    const languageHandler = {};
    for(const category in languageStrings) {
        if(typeof languageStrings[category] !== 'object') continue;
        languageHandler[category] = new Proxy(languageStrings[category], {
            get: (target, prop) => {
                if(prop in target) return target[prop];
                return languages[DEFAULT_LANG][category][prop] || prop;
            }
        });
    }

    for(const category in languages[DEFAULT_LANG]) {
        if(!languageHandler[category]) languageHandler[category] = languages[DEFAULT_LANG][category];
    }

    languages[language] = languageHandler;
}
importLanguage(DEFAULT_LANG);

// format a string
String.prototype.f = function(args, interactionOrId=null, hideName=true) {
    args = hideUsername(args, interactionOrId, hideName);
    let str = this;
    for(let i in args)
        str = str.replace(`{${i}}`, args[i]);
    return str;
}

// get the strings for a language
export const s = (input) => {
    const discLang = config.localiseText ? resolveDiscordLanguage(input) : DEFAULT_LANG;

    if(!languages[discLang]) importLanguage(discLang);
    return languages[discLang] || languages[DEFAULT_LANG];
}

// get the skin/bundle name in a language
export const l = (names, input) => {
    let discLocale = config.localiseSkinNames ? resolveDiscordLanguage(input) : DEFAULT_LANG;
    let valLocale = discToValLang[discLocale];
    return names[valLocale] || names[DEFAULT_VALORANT_LANG];
}

// input can be a valorant user, an interaction, a discord id, a language code, or null
const resolveDiscordLanguage = (input) => {
    let discLang;

    if(!input) discLang = DEFAULT_LANG;
    if(typeof input === 'string') {
        const user = getUser(input);
        if(user) input = user;
        else discLang = input;
    }
    if(input instanceof User) discLang = getSetting(input.id, 'locale');
    if(input instanceof BaseInteraction) discLang = getSetting(input.user.id, 'locale');

    if(discLang === "Automatic") discLang = input.locale;
    if(!discLang) discLang = DEFAULT_LANG;

    return discLang;
}

export const hideUsername = (args, interactionOrId, hideName = true) => {
    if(!args.u) return {...args, u: s(interactionOrId).info.NO_USERNAME};
    if(!interactionOrId) return args;

    const id = typeof interactionOrId === 'string' ? interactionOrId : interactionOrId.user.id;
    const hide = hideName ? getSetting(id, 'hideIgn') : false;
    if(!hide) return args;

    return {...args, u: `||*${s(interactionOrId).info.HIDDEN_USERNAME}*||`};
}
