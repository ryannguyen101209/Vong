import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useSaved } from '../lib/saved.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from './Logo.jsx';
import { MenuIcon, CloseIcon, SunIcon, MoonIcon, ChevronDownIcon } from './Icons.jsx';

const LINKS = [
  { to: '/browse', key: 'nav.browse' },
  { to: '/saved', key: 'nav.saved', count: 'saved' },
  { to: '/messages', key: 'nav.messages', count: 'unread' },
];

function Avatar({ profile }) {
  const [broken, setBroken] = useState(false);
  if (profile.picture && !broken) {
    return <img className="avatar-img" src={profile.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="avatar-img avatar-img--initial" aria-hidden="true">{(profile.name || profile.email || '?').trim()[0].toUpperCase()}</span>;
}

function AccountMenu({ profile, unread, signOut }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="account-chip"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar profile={profile} />
        <span className="account-chip__name">{profile.name?.split(' ')[0] || t('auth.account')}</span>
        <ChevronDownIcon />
        <span className="sr-only">{t('auth.accountMenu')}</span>
      </button>
      {open && (
        <div className="account-menu" id="account-menu">
          <div className="account-menu__who">
            <strong>{profile.name}</strong>
            <span>{profile.email}</span>
          </div>
          <Link to="/my-listings" className="account-menu__item" onClick={() => setOpen(false)}>{t('mine.title')}</Link>
          <Link to="/messages" className="account-menu__item" onClick={() => setOpen(false)}>
            {t('nav.messages')}
            {unread > 0 && <span className="nav__count">{unread}</span>}
          </Link>
          <button type="button" className="account-menu__item" onClick={signOut}>{t('auth.signOut')}</button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t, toggleLang } = useI18n();
  const { count } = useSaved();
  const { theme, toggleTheme } = useTheme();
  const { profile, openSignIn, signOut, unread } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const counts = { saved: count, unread };

  // Navigating on a phone should close the menu behind you.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const links = LINKS.map((link) => (
    <NavLink
      key={link.to}
      to={link.to}
      className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
    >
      {t(link.key)}
      {link.count && counts[link.count] > 0 && (
        <span className="nav__count">
          {counts[link.count]}
          {link.count === 'unread' && <span className="sr-only"> {t('messages.unread')}</span>}
        </span>
      )}
    </NavLink>
  ));

  return (
    <header className="header">
      <a href="#main-content" className="skip-link">{t('market.skip')}</a>
      <div className="shell header__inner">
        <Link to="/" className="brand" aria-label={t('common.appName')}>
          <Logo />
        </Link>

        <nav className="nav header__nav" aria-label={t('nav.menu')}>{links}</nav>

        <div className="header__tools">
          <Link className="btn btn--accent btn--small header__sell" to="/sell">{t('market.sell')}</Link>
          <button type="button" className="icon-btn" onClick={toggleLang} title={t('nav.switchLanguage')}>
            <span aria-hidden="true">{t('nav.languageShort')}</span>
            <span className="sr-only">{t('nav.switchLanguage')}</span>
          </button>

          <button type="button" className="icon-btn" onClick={toggleTheme} title={t('nav.themeToggle')}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span className="sr-only">{t('nav.themeToggle')}</span>
          </button>

          {profile ? (
            <AccountMenu profile={profile} unread={unread} signOut={signOut} />
          ) : (
            <button type="button" className="btn btn--ghost btn--small header__signin" onClick={openSignIn}>
              {t('auth.signIn')}
            </button>
          )}

          <button
            type="button"
            className="icon-btn header__burger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
            {!menuOpen && unread > 0 && <span className="header__burger-dot" aria-hidden="true" />}
            <span className="sr-only">{t('nav.menu')}</span>
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`mobile-nav${menuOpen ? ' is-open' : ''}`}
        aria-label={t('nav.menu')}
      >
        {links}
        {profile ? (
          <>
            <NavLink to="/my-listings" className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}>{t('mine.title')}</NavLink>
            <div className="mobile-nav__account">
              <span>{profile.email}</span>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => { setMenuOpen(false); signOut(); }}>{t('auth.signOut')}</button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn--ghost mobile-nav__signin" onClick={() => { setMenuOpen(false); openSignIn(); }}>{t('auth.signIn')}</button>
        )}
      </nav>
    </header>
  );
}
