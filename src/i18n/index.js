import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import uk from './locales/uk.json';
import { createLanguagePreference, resolveLanguage, SUPPORTED_LANGUAGES } from './language.js';

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
export const languageReady = i18nReady
  .then( () => preference.start() )
  .catch( () => {
    languageLoadFailed = true;
  } );
export const setLanguage = ( language ) => preference.set( language );

if ( import.meta.hot ) import.meta.hot.dispose( () => preference.stop() );
export default i18n;
