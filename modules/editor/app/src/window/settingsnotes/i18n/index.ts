import { i18n as da } from "./editor-window-settingsnotes-da.properties";
import { i18n as de } from "./editor-window-settingsnotes-de.properties";
import { i18n as en } from "./editor-window-settingsnotes-en.properties";
import { i18n as es_ES } from "./editor-window-settingsnotes-es-ES.properties";
import { i18n as fr } from "./editor-window-settingsnotes-fr.properties";
import { i18n as it } from "./editor-window-settingsnotes-it.properties";
import { i18n as nl } from "./editor-window-settingsnotes-nl.properties";
import { i18n as pl } from "./editor-window-settingsnotes-pl.properties";
import { i18n as sv_SE } from "./editor-window-settingsnotes-sv-SE.properties";

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
