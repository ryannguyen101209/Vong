import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sessionApi } from './session-api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([sessionApi.me(), sessionApi.config()])
      .then(([session, config]) => {
        if (!active) return;
        setProfile(session.profile);
        setGoogleClientId(config.googleClientId);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const openSignIn = useCallback(() => { setAuthError(false); setSignInOpen(true); }, []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  const completeGoogleSignIn = useCallback(async (credential) => {
    try {
      const { profile: user } = await sessionApi.google(credential);
      setProfile(user);
      setAuthError(false);
      setSignInOpen(false);
      return true;
    } catch {
      setAuthError(true);
      return false;
    }
  }, []);
  const signOut = useCallback(async () => {
    try {
      await sessionApi.logout();
      setProfile(null);
      setAuthError(false);
      window.google?.accounts?.id?.disableAutoSelect();
    } catch { setAuthError(true); }
  }, []);
  const value = useMemo(() => ({
    profile, loading, signInOpen, googleClientId, authError,
    googleConfigured: Boolean(googleClientId),
    openSignIn, closeSignIn, completeGoogleSignIn, signOut,
  }), [profile, loading, signInOpen, googleClientId, authError, openSignIn, closeSignIn, completeGoogleSignIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
