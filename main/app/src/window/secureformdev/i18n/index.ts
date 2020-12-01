import { i18n as da } from "./pmc-window-secureformdev-da.properties";
import { i18n as de } from "./pmc-window-secureformdev-de.properties";
import { i18n as en } from "./pmc-window-secureformdev-en.properties";
import { i18n as es_ES } from "./pmc-window-secureformdev-es-ES.properties";
import { i18n as fr } from "./pmc-window-secureformdev-fr.properties";
import { i18n as it } from "./pmc-window-secureformdev-it.properties";
import { i18n as nl } from "./pmc-window-secureformdev-nl.properties";
import { i18n as pl } from "./pmc-window-secureformdev-pl.properties";
import { i18n as sv_SE } from "./pmc-window-secureformdev-sv-SE.properties";

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
