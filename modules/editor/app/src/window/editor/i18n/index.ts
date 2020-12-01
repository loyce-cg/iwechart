import { i18n as da } from "./editor-window-editor-da.properties";
import { i18n as de } from "./editor-window-editor-de.properties";
import { i18n as en } from "./editor-window-editor-en.properties";
import { i18n as es_ES } from "./editor-window-editor-es-ES.properties";
import { i18n as fr } from "./editor-window-editor-fr.properties";
import { i18n as it } from "./editor-window-editor-it.properties";
import { i18n as nl } from "./editor-window-editor-nl.properties";
import { i18n as pl } from "./editor-window-editor-pl.properties";
import { i18n as sv_SE } from "./editor-window-editor-sv-SE.properties";

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
