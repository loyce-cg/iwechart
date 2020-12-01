import { i18n as da } from "./tasks-component-taskGroupsPanel-da.properties";
import { i18n as de } from "./tasks-component-taskGroupsPanel-de.properties";
import { i18n as en } from "./tasks-component-taskGroupsPanel-en.properties";
import { i18n as es_ES } from "./tasks-component-taskGroupsPanel-es-ES.properties";
import { i18n as fr } from "./tasks-component-taskGroupsPanel-fr.properties";
import { i18n as it } from "./tasks-component-taskGroupsPanel-it.properties";
import { i18n as nl } from "./tasks-component-taskGroupsPanel-nl.properties";
import { i18n as pl } from "./tasks-component-taskGroupsPanel-pl.properties";
import { i18n as sv_SE } from "./tasks-component-taskGroupsPanel-sv-SE.properties";

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
