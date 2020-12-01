import { i18n as da } from "./chat-component-chatmessages-da.properties";
import { i18n as de } from "./chat-component-chatmessages-de.properties";
import { i18n as en } from "./chat-component-chatmessages-en.properties";
import { i18n as es_ES } from "./chat-component-chatmessages-es-ES.properties";
import { i18n as fr } from "./chat-component-chatmessages-fr.properties";
import { i18n as it } from "./chat-component-chatmessages-it.properties";
import { i18n as nl } from "./chat-component-chatmessages-nl.properties";
import { i18n as pl } from "./chat-component-chatmessages-pl.properties";
import { i18n as sv_SE } from "./chat-component-chatmessages-sv-SE.properties";

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
