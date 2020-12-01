import { i18n as da } from "./editor-window-mindmaphelp-da.properties";
import { i18n as de } from "./editor-window-mindmaphelp-de.properties";
import { i18n as en } from "./editor-window-mindmaphelp-en.properties";
import { i18n as es_ES } from "./editor-window-mindmaphelp-es-ES.properties";
import { i18n as fr } from "./editor-window-mindmaphelp-fr.properties";
import { i18n as it } from "./editor-window-mindmaphelp-it.properties";
import { i18n as nl } from "./editor-window-mindmaphelp-nl.properties";
import { i18n as pl } from "./editor-window-mindmaphelp-pl.properties";
import { i18n as sv_SE } from "./editor-window-mindmaphelp-sv-SE.properties";

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
