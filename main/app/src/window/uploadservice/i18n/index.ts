
import { i18n as en } from "./pmc-window-uploadservice-en.properties";
import { i18n as pl } from "./pmc-window-uploadservice-pl.properties";


export type i18nLang = { [name: string]: string };
export type i18nLangs = { [lang: string]: i18nLang };

export let i18n: i18nLangs = {

    "en": en,
    "pl": pl

};
