import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/index.jsx';
import { SavedProvider } from './lib/saved.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { App } from './App.jsx';
import './styles.css';

// The demo is embedded in a page we do not control, so it routes in memory and
// never touches the address bar. A real install uses normal URLs.
const Router = __VONG_DEMO__ ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SavedProvider>
          <Router>
            <App />
          </Router>
        </SavedProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
