import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'vong.google.profile';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const AuthContext = createContext(null);

function decodeCredential(credential) {
  try {
    const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return null;
  }
}

function loadProfile() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(loadProfile);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    if (profile) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [profile]);

  const value = useMemo(
    () => ({
      profile,
      signInOpen,
      googleConfigured: Boolean(GOOGLE_CLIENT_ID),
      openSignIn: () => setSignInOpen(true),
      closeSignIn: () => setSignInOpen(false),
      completeGoogleSignIn: (credential) => {
        const claims = decodeCredential(credential);
        if (!claims?.sub) return false;
        setProfile({ id: claims.sub, name: claims.name, email: claims.email, picture: claims.picture });
        setSignInOpen(false);
        return true;
      },
      signOut: () => setProfile(null),
    }),
    [profile, signInOpen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export { GOOGLE_CLIENT_ID };
