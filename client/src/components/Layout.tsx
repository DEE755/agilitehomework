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
      className="seasonal-banner relative z-20 w-full py-2 text-center text-xs font-semibold tracking-wide text-white/90 transition-all duration-500"
      style={{ background: theme.banner.gradient }}
    >
      <span className="mr-2">{theme.emoji}</span>
      {theme.banner.text}
      <span className="ml-2">{theme.emoji}</span>
    </div>
  );
}

export default function Layout() {
  // Apply stored theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(STOREFRONT_THEME_KEY) ?? 'default';
    applyTheme(stored);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <SeasonalBanner />
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
