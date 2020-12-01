import { i18n as da } from "./pmc-component-taskchooser-da.properties";
import { i18n as de } from "./pmc-component-taskchooser-de.properties";
import { i18n as en } from "./pmc-component-taskchooser-en.properties";
import { i18n as es_ES } from "./pmc-component-taskchooser-es-ES.properties";
import { i18n as fr } from "./pmc-component-taskchooser-fr.properties";
import { i18n as it } from "./pmc-component-taskchooser-it.properties";
import { i18n as nl } from "./pmc-component-taskchooser-nl.properties";
import { i18n as pl } from "./pmc-component-taskchooser-pl.properties";
import { i18n as sv_SE } from "./pmc-component-taskchooser-sv-SE.properties";

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
