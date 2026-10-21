import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from '@/App.jsx';
import i18n, { languageReady } from '@/i18n/index.js';
import { ThemePreference } from '@/features/preferences/services/themePreference.js';
import { readAppOptions } from '@/routes/appOptions.js';
import '@/styles/base.css';

async function mountApp() {
  const container = document.getElementById( 'root' );
  if ( !container ) throw new Error( 'Missing application root' );
  const options = readAppOptions( container.dataset );
  await languageReady;
  try {
    document.documentElement.dataset.theme = await new ThemePreference().read();
  } catch {
    // The theme control retries the read and reports storage failures in the UI.
  }
  createRoot( container ).render(
    <StrictMode>
      <I18nextProvider i18n={ i18n }><App { ...options } /></I18nextProvider>
    </StrictMode>
  );
}

void mountApp();
