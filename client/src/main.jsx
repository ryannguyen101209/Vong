import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/index.jsx';
import { SavedProvider } from './lib/saved.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { App } from './App.jsx';
// Be Vietnam Pro: designed for Vietnamese, self-hosted. Only the subsets a page uses are downloaded.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './styles.css';

// Hosted demos use real URLs; an embed can opt into memory routing explicitly.
const Router = __VONG_MEMORY_ROUTER__ ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SavedProvider>
            <Router>
              <App />
            </Router>
          </SavedProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
