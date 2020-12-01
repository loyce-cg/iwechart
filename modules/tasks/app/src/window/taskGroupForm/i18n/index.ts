import { i18n as da } from "./tasks-window-taskGroupForm-da.properties";
import { i18n as de } from "./tasks-window-taskGroupForm-de.properties";
import { i18n as en } from "./tasks-window-taskGroupForm-en.properties";
import { i18n as es_ES } from "./tasks-window-taskGroupForm-es-ES.properties";
import { i18n as fr } from "./tasks-window-taskGroupForm-fr.properties";
import { i18n as it } from "./tasks-window-taskGroupForm-it.properties";
import { i18n as nl } from "./tasks-window-taskGroupForm-nl.properties";
import { i18n as pl } from "./tasks-window-taskGroupForm-pl.properties";
import { i18n as sv_SE } from "./tasks-window-taskGroupForm-sv-SE.properties";

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
