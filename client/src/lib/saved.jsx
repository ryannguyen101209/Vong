/*
 * Saved listings live in localStorage, not on the server: there are no user
 * accounts yet, so there is nobody to attach them to. Each entry stores WHY it
 * was saved -- either a quick-pick key or the shopper's own note.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'vong.saved';
const SavedContext = createContext(null);

export const SAVE_REASONS = [
  'reasonGoodPrice',
  'reasonComparing',
  'reasonPayday',
  'reasonForRoom',
  'reasonGift',
  'reasonAskSeller',
];

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((item) => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

export function SavedProvider({ children }) {
  const [items, setItems] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* Private mode or a full quota: saving silently stops working, the app doesn't. */
    }
  }, [items]);

  const save = useCallback((id, { reasonKey = null, note = '' } = {}) => {
    setItems((current) => {
      const rest = current.filter((item) => item.id !== id);
      const existing = current.find((item) => item.id === id);
      return [
        {
          id,
          reasonKey,
          note: note.trim(),
          savedAt: existing?.savedAt ?? new Date().toISOString(),
        },
        ...rest,
      ];
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const entry = useCallback((id) => items.find((item) => item.id === id) ?? null, [items]);
  const isSaved = useCallback((id) => items.some((item) => item.id === id), [items]);

  const value = useMemo(
    () => ({ items, save, remove, entry, isSaved, count: items.length }),
    [items, save, remove, entry, isSaved]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const context = useContext(SavedContext);
  if (!context) throw new Error('useSaved must be used inside <SavedProvider>');
  return context;
}
