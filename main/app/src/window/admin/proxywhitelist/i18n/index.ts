import {i18n as pl} from "./pmc-window-admin-proxywhitelist-pl.properties";
import {i18n as en} from "./pmc-window-admin-proxywhitelist-en.properties";

export type i18nLang = {[name: string]: string};
export type i18nLangs = {[lang: string]: i18nLang};

export let i18n: i18nLangs = {
    pl: pl,
    en: en
};
