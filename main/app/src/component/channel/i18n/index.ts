import { i18n as da } from "./pmc-component-channel-da.properties";
import { i18n as de } from "./pmc-component-channel-de.properties";
import { i18n as en } from "./pmc-component-channel-en.properties";
import { i18n as es_ES } from "./pmc-component-channel-es-ES.properties";
import { i18n as fr } from "./pmc-component-channel-fr.properties";
import { i18n as it } from "./pmc-component-channel-it.properties";
import { i18n as nl } from "./pmc-component-channel-nl.properties";
import { i18n as pl } from "./pmc-component-channel-pl.properties";
import { i18n as sv_SE } from "./pmc-component-channel-sv-SE.properties";

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
