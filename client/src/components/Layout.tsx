import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { STOREFRONT_THEME_KEY, applyTheme, getTheme } from '../themes/seasonal';

function SeasonalBanner() {
  const [themeId, setThemeId] = useState<string>(() => localStorage.getItem(STOREFRONT_THEME_KEY) ?? 'default');

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STOREFRONT_THEME_KEY) setThemeId(e.newValue ?? 'default');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const theme = getTheme(themeId);
  if (!theme.banner || themeId === 'default') return null;

  return (
    <div
      className="seasonal-banner relative z-20 w-full py-3 text-center text-sm font-semibold tracking-wide text-white/95 shadow-lg transition-all duration-500"
      style={{ background: theme.banner.gradient }}
    >
      <span className="mr-2.5 text-base">{theme.emoji}</span>
      {theme.banner.text}
      <span className="ml-2.5 text-base">{theme.emoji}</span>
    </div>
  );
}

function PageTintOverlay() {
  const [themeId, setThemeId] = useState<string>(() => localStorage.getItem(STOREFRONT_THEME_KEY) ?? 'default');

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STOREFRONT_THEME_KEY) setThemeId(e.newValue ?? 'default');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (themeId === 'default') return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 th-page-tint"
      aria-hidden="true"
    />
  );
}

export default function Layout() {
  // Apply stored theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(STOREFRONT_THEME_KEY) ?? 'default';
    applyTheme(stored);
  }, []);

  return (
    <div className="relative min-h-screen bg-zinc-950">
      <PageTintOverlay />
      <SeasonalBanner />
      <Navbar />
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
