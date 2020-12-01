import { i18n as da } from "./tasks-window-task-da.properties";
import { i18n as de } from "./tasks-window-task-de.properties";
import { i18n as en } from "./tasks-window-task-en.properties";
import { i18n as es_ES } from "./tasks-window-task-es-ES.properties";
import { i18n as fr } from "./tasks-window-task-fr.properties";
import { i18n as it } from "./tasks-window-task-it.properties";
import { i18n as nl } from "./tasks-window-task-nl.properties";
import { i18n as pl } from "./tasks-window-task-pl.properties";
import { i18n as sv_SE } from "./tasks-window-task-sv-SE.properties";

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
