import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.js';
import vi from './vi.js';

const DICTIONARIES = { en, vi };
export const LANGUAGES = Object.keys(DICTIONARIES);
const STORAGE_KEY = 'vong.lang';

const I18nContext = createContext(null);

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.includes(stored)) return stored;
    // First visit: a Vietnamese browser gets Vietnamese.
    if (navigator.language?.toLowerCase().startsWith('vi')) return 'vi';
  } catch {
    /* Storage can be blocked; English is a fine fallback. */
  }
  return 'en';
}

/** Walk a dotted key path, e.g. "home.heroTitle". */
function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (LANGUAGES.includes(next)) setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((current) => (current === 'en' ? 'vi' : 'en'));
  }, []);

  /**
   * t('sell.feeNoticeTitle', { fee: '10.000 ₫' })
   * Falls back to English, then to the key itself, so a missing translation is
   * visible in development instead of rendering as blank.
   */
  const t = useCallback(
    (key, vars) => {
      const value = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.en, key);
      if (typeof value !== 'string') return value ?? key;
      if (!vars) return value;
      return value.replace(/\{\{(\w+)\}\}/g, (match, name) =>
        vars[name] === undefined ? match : String(vars[name])
      );
    },
    [lang]
  );

  /** Arrays of objects (the FAQ), with {{vars}} filled in on every string. */
  const tList = useCallback(
    (key, vars) => {
      const value = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.en, key);
      if (!Array.isArray(value)) return [];
      if (!vars) return value;
      const fill = (str) =>
        String(str).replace(/\{\{(\w+)\}\}/g, (match, name) =>
          vars[name] === undefined ? match : String(vars[name])
        );
      return value.map((item) =>
        typeof item === 'string'
          ? fill(item)
          : Object.fromEntries(Object.entries(item).map(([k, v]) => [k, fill(v)]))
      );
    },
    [lang]
  );

  /**
   * Listings carry both language variants when we wrote them, but only one when
   * a seller did. Prefer the current language, fall back to whatever exists.
   */
  const localized = useCallback(
    (row, field) => {
      if (!row) return '';
      const preferred = row[`${field}_${lang}`];
      const other = row[`${field}_${lang === 'en' ? 'vi' : 'en'}`];
      return preferred || other || '';
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, tList, localized }),
    [lang, setLang, toggleLang, t, tList, localized]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <LanguageProvider>');
  return context;
}
