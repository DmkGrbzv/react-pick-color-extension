import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';
import { createLanguagePreference, resolveLanguage, SUPPORTED_LANGUAGES } from '@/i18n/language.js';

const defaultLanguage = resolveLanguage(
  globalThis.chrome?.i18n?.getUILanguage() || navigator.language
);

export const i18nReady = i18n.use( initReactI18next ).init( {
  resources: { uk: { translation: uk }, en: { translation: en } },
  lng: defaultLanguage,
  fallbackLng: 'uk',
  supportedLngs: SUPPORTED_LANGUAGES,
  load: 'languageOnly',
  interpolation: { escapeValue: false },
} );

i18n.on( 'languageChanged', ( language ) => {
  document.documentElement.lang = resolveLanguage( language );
} );
document.documentElement.lang = defaultLanguage;

const preference = createLanguagePreference(
  globalThis.chrome?.storage,
  defaultLanguage,
  ( language ) => {
    void i18n.changeLanguage( language );
  }
);
export let languageLoadFailed = false;
async function initializeLanguage() {
  try {
    await i18nReady;
    await preference.start();
  } catch {
    languageLoadFailed = true;
  }
}
export const languageReady = initializeLanguage();
export const setLanguage = ( language ) => preference.set( language );

if ( import.meta.hot ) import.meta.hot.dispose( () => preference.stop() );
export default i18n;
