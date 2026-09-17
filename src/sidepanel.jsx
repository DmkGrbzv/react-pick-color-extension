import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n, { languageReady } from '@/i18n/index.js';
import PaletteView from '@/components/PaletteView.jsx';
import '@/styles/base.css';

async function renderApp() {
  await languageReady;
  createRoot( document.getElementById( 'root' ) ).render(
    <StrictMode>
      <I18nextProvider i18n={ i18n }>
        <PaletteView />
      </I18nextProvider>
    </StrictMode>
  );
}

void renderApp();
