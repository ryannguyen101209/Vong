import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/index.jsx';
import { SavedProvider } from './lib/saved.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { App } from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SavedProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SavedProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
