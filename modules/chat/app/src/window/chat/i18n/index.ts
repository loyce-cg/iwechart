import { i18n as da } from "./chat-window-chat-da.properties";
import { i18n as de } from "./chat-window-chat-de.properties";
import { i18n as en } from "./chat-window-chat-en.properties";
import { i18n as es_ES } from "./chat-window-chat-es-ES.properties";
import { i18n as fr } from "./chat-window-chat-fr.properties";
import { i18n as it } from "./chat-window-chat-it.properties";
import { i18n as nl } from "./chat-window-chat-nl.properties";
import { i18n as pl } from "./chat-window-chat-pl.properties";
import { i18n as sv_SE } from "./chat-window-chat-sv-SE.properties";

export type i18nLang = { [name: string]: string };
export type i18nLangs = { [lang: string]: i18nLang };

export let i18n: i18nLangs = {
    "da": da,
    "de": de,
    "en": en,
    "es-ES": es_ES,
    "fr": fr,
    "it": it,
    "nl": nl,
    "pl": pl,
    "sv-SE": sv_SE,
};
