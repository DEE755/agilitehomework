import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

interface NavbarProps {
  isDark: boolean;
  onThemeToggle: () => void;
}

export default function Navbar({ isDark, onThemeToggle }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, lang, toggleLang } = useLanguage();

  return (
    <header
      className="sticky top-0 z-10 border-b bg-zinc-950/95 backdrop-blur-sm"
      style={{ borderColor: 'var(--th-nav-border)' }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <NavLink to="/products" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded border"
            style={{ borderColor: 'var(--th-logo-border)', backgroundColor: 'var(--th-logo-bg)' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" style={{ color: 'var(--th-accent-text)' }} xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L2 7v6l8 5 8-5V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/>
            </svg>
          </span>
          <div>
            <span className="block text-xs font-bold uppercase tracking-widest text-zinc-100">Agilate</span>
            <span className="block text-[9px] uppercase tracking-widest text-zinc-600">{t.nav.customerSupport}</span>
          </div>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink
            to="/products"
            className={({ isActive }) =>
              `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                isActive ? 'th-text' : 'text-zinc-500 hover:text-zinc-200'
              }`
            }
          >
            {t.nav.products}
          </NavLink>

          <NavLink
            to="/support/lookup"
            className={({ isActive }) =>
              `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                isActive ? 'th-text' : 'text-zinc-500 hover:text-zinc-200'
              }`
            }
          >
            {t.nav.myTickets}
          </NavLink>

          <NavLink
            to="/support/new"
            className="th-btn ms-2 rounded border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition"
          >
            {t.nav.openTicket}
          </NavLink>

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="ms-1 rounded border border-zinc-800 px-2.5 py-1.5 text-[10px] font-bold text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            aria-label="Switch language"
          >
            {lang === 'en' ? t.nav.switchToHe : t.nav.switchToEn}
          </button>

          {/* Dark / light toggle */}
          <button
            onClick={onThemeToggle}
            className="ms-1 rounded border border-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀' : '🌙'}
          </button>

          <NavLink
            to="/admin/login"
            className="ms-1 rounded px-2 py-1.5 text-[10px] text-zinc-700 transition hover:text-zinc-400"
          >
            {t.nav.admin}
          </NavLink>
        </nav>

        {/* Mobile menu toggle */}
        <button
          className="flex flex-col gap-1.5 p-1 sm:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/products"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-zinc-900 th-text' : 'text-zinc-400 hover:text-zinc-100'
                }`
              }
            >
              {t.nav.products}
            </NavLink>
            <NavLink
              to="/support/lookup"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-zinc-900 th-text' : 'text-zinc-400 hover:text-zinc-100'
                }`
              }
            >
              {t.nav.myTickets}
            </NavLink>
            <NavLink
              to="/support/new"
              onClick={() => setMobileOpen(false)}
              className="th-btn mt-1 rounded border px-3 py-2.5 text-center text-sm font-semibold"
            >
              {t.nav.openTicket}
            </NavLink>
            {/* Language toggle mobile */}
            <button
              onClick={() => { toggleLang(); setMobileOpen(false); }}
              className="mt-1 rounded border border-zinc-800 px-3 py-2 text-sm font-bold text-zinc-500 transition hover:text-zinc-300 text-center"
            >
              {lang === 'en' ? `עברית` : 'English'}
            </button>
            {/* Dark / light toggle mobile */}
            <button
              onClick={() => { onThemeToggle(); setMobileOpen(false); }}
              className="mt-1 rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:text-zinc-300 text-center"
            >
              {isDark ? '☀ Light mode' : '🌙 Dark mode'}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
