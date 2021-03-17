import { i18n as da } from "./chat-component-videoconference-da.properties";
import { i18n as de } from "./chat-component-videoconference-de.properties";
import { i18n as en } from "./chat-component-videoconference-en.properties";
import { i18n as es_ES } from "./chat-component-videoconference-es-ES.properties";
import { i18n as fr } from "./chat-component-videoconference-fr.properties";
import { i18n as it } from "./chat-component-videoconference-it.properties";
import { i18n as nl } from "./chat-component-videoconference-nl.properties";
import { i18n as pl } from "./chat-component-videoconference-pl.properties";
import { i18n as sv_SE } from "./chat-component-videoconference-sv-SE.properties";

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
