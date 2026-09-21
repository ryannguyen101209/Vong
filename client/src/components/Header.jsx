import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useSaved } from '../lib/saved.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from './Logo.jsx';
import { MenuIcon, CloseIcon, SunIcon, MoonIcon, MessageIcon } from './Icons.jsx';

const LINKS = [
  { to: '/browse', key: 'nav.browse' },
  { to: '/sell', key: 'nav.sell' },
  { to: '/saved', key: 'nav.saved', showCount: true },
  { to: '/messages', key: 'nav.messages' },
  { to: '/about', key: 'nav.about' },
];

export function Header() {
  const { t, toggleLang } = useI18n();
  const { count } = useSaved();
  const { theme, toggleTheme } = useTheme();
  const { profile, openSignIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Navigating on a phone should close the menu behind you.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const links = LINKS.map((link) => (
    <NavLink
      key={link.to}
      to={link.to}
      className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
    >
      {t(link.key)}
      {link.showCount && count > 0 && <span className="nav__count">{count}</span>}
    </NavLink>
  ));

  return (
    <header className="header">
      <div className="shell header__inner">
        <Link to="/" className="brand" aria-label={t('common.appName')}>
          <Logo />
        </Link>

        <nav className="nav header__nav" aria-label={t('nav.menu')}>{links}</nav>

        <div className="header__tools">
          <button type="button" className="icon-btn" onClick={toggleLang} title={t('nav.switchLanguage')}>
            <span aria-hidden="true">{t('nav.languageShort')}</span>
            <span className="sr-only">{t('nav.switchLanguage')}</span>
          </button>

          <button type="button" className="icon-btn" onClick={toggleTheme} title={t('nav.themeToggle')}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span className="sr-only">{t('nav.themeToggle')}</span>
          </button>

          {profile ? (
            <button type="button" className="account-chip" onClick={signOut} title={t('auth.signOut')}>
              {profile.picture ? <img src={profile.picture} alt="" referrerPolicy="no-referrer" /> : <MessageIcon size={16} />}
              <span>{profile.name?.split(' ')[0] || t('auth.account')}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--accent btn--small header__signin" onClick={openSignIn}>
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
      </nav>
    </header>
  );
}
