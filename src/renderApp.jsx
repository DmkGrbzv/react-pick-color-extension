import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n, { languageReady } from '@/i18n/index.js';
import '@/styles/base.css';
import { ThemePreference } from '@/preferences/themePreference.js';

export async function renderApp( page ) {
  await languageReady;
  try {
    // Apply the saved appearance before mounting any of the three pages.
    document.documentElement.dataset.theme = await new ThemePreference().read();
  } catch {
    // The theme control retries the read and reports storage failures in the UI.
  }
  createRoot( document.getElementById( 'root' ) ).render(
    <StrictMode>
      <I18nextProvider i18n={ i18n }>{ page }</I18nextProvider>
    </StrictMode>
  );
}
