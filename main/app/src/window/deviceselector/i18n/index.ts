import { i18n as da } from "./pmc-window-deviceselector-da.properties";
import { i18n as de } from "./pmc-window-deviceselector-de.properties";
import { i18n as en } from "./pmc-window-deviceselector-en.properties";
import { i18n as es_ES } from "./pmc-window-deviceselector-es-ES.properties";
import { i18n as fr } from "./pmc-window-deviceselector-fr.properties";
import { i18n as it } from "./pmc-window-deviceselector-it.properties";
import { i18n as nl } from "./pmc-window-deviceselector-nl.properties";
import { i18n as pl } from "./pmc-window-deviceselector-pl.properties";
import { i18n as sv_SE } from "./pmc-window-deviceselector-sv-SE.properties";

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
