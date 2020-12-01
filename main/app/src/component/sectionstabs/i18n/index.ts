import { i18n as da } from "./pmc-component-sectionstabs-da.properties";
import { i18n as de } from "./pmc-component-sectionstabs-de.properties";
import { i18n as en } from "./pmc-component-sectionstabs-en.properties";
import { i18n as es_ES } from "./pmc-component-sectionstabs-es-ES.properties";
import { i18n as fr } from "./pmc-component-sectionstabs-fr.properties";
import { i18n as it } from "./pmc-component-sectionstabs-it.properties";
import { i18n as nl } from "./pmc-component-sectionstabs-nl.properties";
import { i18n as pl } from "./pmc-component-sectionstabs-pl.properties";
import { i18n as sv_SE } from "./pmc-component-sectionstabs-sv-SE.properties";

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
