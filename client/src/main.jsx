import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/index.jsx';
import { SavedProvider } from './lib/saved.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { App } from './App.jsx';
import './styles.css';

// The static demo is served from a plain file host with no route rewriting,
// so it uses hash URLs (#/browse). A real install uses clean paths.
const Router = __VONG_DEMO__ ? HashRouter : BrowserRouter;

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
