import { i18n as da } from "./chat-component-desktoppicker-da.properties";
import { i18n as de } from "./chat-component-desktoppicker-de.properties";
import { i18n as en } from "./chat-component-desktoppicker-en.properties";
import { i18n as es_ES } from "./chat-component-desktoppicker-es-ES.properties";
import { i18n as fr } from "./chat-component-desktoppicker-fr.properties";
import { i18n as it } from "./chat-component-desktoppicker-it.properties";
import { i18n as nl } from "./chat-component-desktoppicker-nl.properties";
import { i18n as pl } from "./chat-component-desktoppicker-pl.properties";
import { i18n as sv_SE } from "./chat-component-desktoppicker-sv-SE.properties";

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
