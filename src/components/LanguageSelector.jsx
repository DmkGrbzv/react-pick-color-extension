import '@/styles/components/LanguageSelector.css';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languageLoadFailed, setLanguage } from '@/i18n/index.js';

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState( false );
  const [error, setError] = useState( languageLoadFailed ? 'errors.languageLoad' : '' );

  async function change( event ) {
    setSaving( true );
    setError( '' );
    try {
      await setLanguage( event.target.value );
    } catch {
      setError( 'errors.languageSave' );
    } finally {
      setSaving( false );
    }
  }

  return (
    <div className="language-control">
      <label className="language-label">
        { t( 'language' ) }
        <select value={ i18n.resolvedLanguage } onChange={ change } disabled={ saving }>
          <option value="uk" lang="uk">
            Українська
          </option>
          <option value="en" lang="en">
            English
          </option>
        </select>
      </label>
      { error && (
        <p className="error" role="alert">
          { t( error ) }
        </p>
      ) }
    </div>
  );
}
