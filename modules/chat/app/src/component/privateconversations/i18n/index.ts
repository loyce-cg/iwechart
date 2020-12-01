import { i18n as da } from "./chat-component-privateconversations-da.properties";
import { i18n as de } from "./chat-component-privateconversations-de.properties";
import { i18n as en } from "./chat-component-privateconversations-en.properties";
import { i18n as es_ES } from "./chat-component-privateconversations-es-ES.properties";
import { i18n as fr } from "./chat-component-privateconversations-fr.properties";
import { i18n as it } from "./chat-component-privateconversations-it.properties";
import { i18n as nl } from "./chat-component-privateconversations-nl.properties";
import { i18n as pl } from "./chat-component-privateconversations-pl.properties";
import { i18n as sv_SE } from "./chat-component-privateconversations-sv-SE.properties";

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
