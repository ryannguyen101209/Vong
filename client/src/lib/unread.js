import { useEffect, useState } from 'react';
import { sessionApi } from './session-api.js';

const EVENT = 'vong:unread-changed';
const POLL_MS = 30_000;

/** Tell the header badge to re-check, e.g. right after a conversation is read. */
export function unreadChanged() {
  window.dispatchEvent(new Event(EVENT));
}

/**
 * How many conversations have messages the signed-in user has not seen.
 * Re-checks every 30 seconds while the tab is visible, when the tab comes back,
 * and whenever unreadChanged() is called.
 */
export function useUnreadCount(signedIn) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setCount(0);
      return undefined;
    }
    let live = true;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      sessionApi.unread().then((data) => live && setCount(data.count)).catch(() => {});
    };
    check();
    const timer = setInterval(check, POLL_MS);
    window.addEventListener(EVENT, check);
    document.addEventListener('visibilitychange', check);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(EVENT, check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [signedIn]);

  return count;
}
