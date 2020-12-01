import { i18n as da } from "./chat-common-da.properties";
import { i18n as de } from "./chat-common-de.properties";
import { i18n as en } from "./chat-common-en.properties";
import { i18n as es_ES } from "./chat-common-es-ES.properties";
import { i18n as fr } from "./chat-common-fr.properties";
import { i18n as it } from "./chat-common-it.properties";
import { i18n as nl } from "./chat-common-nl.properties";
import { i18n as pl } from "./chat-common-pl.properties";
import { i18n as sv_SE } from "./chat-common-sv-SE.properties";

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
