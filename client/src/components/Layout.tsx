import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { STOREFRONT_THEME_KEY, CUSTOMER_UI_THEME_KEY, applyTheme, getTheme } from '../themes/seasonal';

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

function ThemeDecorations() {
  const [themeId, setThemeId] = useState<string>(() => localStorage.getItem(STOREFRONT_THEME_KEY) ?? 'default');

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STOREFRONT_THEME_KEY) setThemeId(e.newValue ?? 'default');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const theme = getTheme(themeId);

  const particles = useMemo(() => {
    const dec = theme.decorations;
    if (!dec) return [];
    return Array.from({ length: dec.count }, (_, i) => {
      // Deterministic pseudo-random using Knuth multiplicative hash
      const h1 = ((i * 2654435761) >>> 0) / 4294967296;
      const h2 = (((i + 17) * 2654435761) >>> 0) / 4294967296;
      const h3 = (((i + 31) * 2654435761) >>> 0) / 4294967296;
      const h4 = (((i + 53) * 2654435761) >>> 0) / 4294967296;
      return {
        id: i,
        emoji: dec.emojis[i % dec.emojis.length],
        x: 2 + h1 * 92,
        delay: -(h2 * 18),       // negative = already mid-animation on load
        duration: 10 + h3 * 14,  // 10s – 24s
        size: 0.85 + h4 * 0.85,  // 0.85rem – 1.7rem
        drift: (h1 - 0.5) * 90,  // –45px to +45px horizontal drift
        rotate: h2 > 0.5 ? 180 : -180,
        animation: dec.animation,
      };
    });
  }, [themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!theme.decorations || particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className={p.animation === 'float-up' ? 'particle-float-up' : 'particle-fall-down'}
          style={{
            left: `${p.x}%`,
            fontSize: `${p.size}rem`,
            '--dur': `${p.duration}s`,
            '--delay': `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--rotate': `${p.rotate}deg`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

export default function Layout() {
  const [isDark, setIsDark] = useState<boolean>(
    () => (localStorage.getItem(CUSTOMER_UI_THEME_KEY) ?? 'dark') !== 'light',
  );

  // Apply stored seasonal theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(STOREFRONT_THEME_KEY) ?? 'default';
    applyTheme(stored);
  }, []);

  function toggleCustomerTheme() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(CUSTOMER_UI_THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <div
      id="storefront-root"
      className={`relative min-h-screen bg-zinc-950${isDark ? '' : ' customer-light'}`}
    >
      <PageTintOverlay />
      <ThemeDecorations />
      <SeasonalBanner />
      <Navbar isDark={isDark} onThemeToggle={toggleCustomerTheme} />
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
