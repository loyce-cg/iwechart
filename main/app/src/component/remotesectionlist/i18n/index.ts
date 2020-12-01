import {i18n as pl} from "./pmc-component-remotesectionlist-pl.properties";
import {i18n as en} from "./pmc-component-remotesectionlist-en.properties";

export type i18nLang = {[name: string]: string};
export type i18nLangs = {[lang: string]: i18nLang};

export let i18n: i18nLangs = {
    pl: pl,
    en: en
};
