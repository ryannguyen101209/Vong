import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/index.jsx';
import { SavedProvider } from './lib/saved.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { App } from './App.jsx';
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
