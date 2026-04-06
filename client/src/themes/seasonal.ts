export interface SeasonalTheme {
  id: string;
  name: string;
  nameHe?: string;
  emoji: string;
  group: 'jewish' | 'commercial';
  banner: { text: string; gradient: string } | null;
  /** CSS custom property overrides applied to <html data-theme="id"> */
  vars: Record<string, string>;
}

export const THEMES: SeasonalTheme[] = [
  {
    id: 'default',
    name: 'Default',
    emoji: '✦',
    group: 'jewish',
    banner: null,
    vars: {},
  },

  // ─── Jewish / Israeli holidays ────────────────────────────────────────────

  {
    id: 'purim',
    name: 'Purim',
    nameHe: 'פורים',
    emoji: '🎭',
    group: 'jewish',
    banner: {
      text: 'Hag Purim Sameach! Shop our festive collection.',
      gradient: 'linear-gradient(90deg, rgba(91,33,182,0.95) 0%, rgba(126,34,206,0.9) 45%, rgba(219,39,119,0.85) 100%)',
    },
    vars: {
      '--th-accent':      '#a855f7',
      '--th-accent-dim':  'rgba(168,85,247,0.13)',
      '--th-accent-hover':'rgba(168,85,247,0.2)',
      '--th-accent-text': '#c084fc',
      '--th-border':      'rgba(168,85,247,0.3)',
      '--th-selection':   'rgba(168,85,247,0.3)',
    },
  },

  {
    id: 'pesach',
    name: 'Pesach',
    nameHe: 'פסח',
    emoji: '🌿',
    group: 'jewish',
    banner: {
      text: 'Hag Pesach Sameach! Fresh picks for the seder table.',
      gradient: 'linear-gradient(90deg, rgba(20,83,45,0.95) 0%, rgba(22,163,74,0.8) 55%, rgba(202,138,4,0.7) 100%)',
    },
    vars: {
      '--th-accent':      '#4ade80',
      '--th-accent-dim':  'rgba(74,222,128,0.12)',
      '--th-accent-hover':'rgba(74,222,128,0.2)',
      '--th-accent-text': '#86efac',
      '--th-border':      'rgba(74,222,128,0.28)',
      '--th-selection':   'rgba(74,222,128,0.28)',
    },
  },

  {
    id: 'yom_haatzmaut',
    name: "Yom Ha'atzmaut",
    nameHe: 'יום העצמאות',
    emoji: '🇮🇱',
    group: 'jewish',
    banner: {
      text: "Happy Independence Day! יום העצמאות שמח",
      gradient: 'linear-gradient(90deg, rgba(10,37,140,0.97) 0%, rgba(29,78,216,0.9) 50%, rgba(10,37,140,0.97) 100%)',
    },
    vars: {
      '--th-accent':      '#3b82f6',
      '--th-accent-dim':  'rgba(59,130,246,0.13)',
      '--th-accent-hover':'rgba(59,130,246,0.2)',
      '--th-accent-text': '#93c5fd',
      '--th-border':      'rgba(59,130,246,0.3)',
      '--th-selection':   'rgba(59,130,246,0.3)',
    },
  },

  {
    id: 'shavuot',
    name: 'Shavuot',
    nameHe: 'שבועות',
    emoji: '🌸',
    group: 'jewish',
    banner: {
      text: 'Hag Shavuot Sameach! Light, fresh and celebratory.',
      gradient: 'linear-gradient(90deg, rgba(13,78,55,0.92) 0%, rgba(20,184,166,0.75) 55%, rgba(5,150,105,0.85) 100%)',
    },
    vars: {
      '--th-accent':      '#5eead4',
      '--th-accent-dim':  'rgba(94,234,212,0.12)',
      '--th-accent-hover':'rgba(94,234,212,0.2)',
      '--th-accent-text': '#99f6e4',
      '--th-border':      'rgba(94,234,212,0.25)',
      '--th-selection':   'rgba(94,234,212,0.25)',
    },
  },

  {
    id: 'rosh_hashana',
    name: 'Rosh Hashana',
    nameHe: 'ראש השנה',
    emoji: '🍯',
    group: 'jewish',
    banner: {
      text: 'Shana Tova! 🍎 Wishing you a sweet new year.',
      gradient: 'linear-gradient(90deg, rgba(120,53,15,0.97) 0%, rgba(180,83,9,0.88) 50%, rgba(133,77,14,0.95) 100%)',
    },
    vars: {
      '--th-accent':      '#f59e0b',
      '--th-accent-dim':  'rgba(245,158,11,0.14)',
      '--th-accent-hover':'rgba(245,158,11,0.22)',
      '--th-accent-text': '#fbbf24',
      '--th-border':      'rgba(245,158,11,0.32)',
      '--th-selection':   'rgba(245,158,11,0.32)',
    },
  },

  {
    id: 'sukkot',
    name: 'Sukkot',
    nameHe: 'סוכות',
    emoji: '🍂',
    group: 'jewish',
    banner: {
      text: 'Hag Sukkot Sameach! Harvest season warmth.',
      gradient: 'linear-gradient(90deg, rgba(124,45,18,0.97) 0%, rgba(194,65,12,0.88) 50%, rgba(161,98,7,0.85) 100%)',
    },
    vars: {
      '--th-accent':      '#f97316',
      '--th-accent-dim':  'rgba(249,115,22,0.12)',
      '--th-accent-hover':'rgba(249,115,22,0.2)',
      '--th-accent-text': '#fb923c',
      '--th-border':      'rgba(249,115,22,0.28)',
      '--th-selection':   'rgba(249,115,22,0.28)',
    },
  },

  {
    id: 'hanukkah',
    name: 'Hanukkah',
    nameHe: 'חנוכה',
    emoji: '🕎',
    group: 'jewish',
    banner: {
      text: 'Happy Hanukkah! חנוכה שמח — Shine bright this season.',
      gradient: 'linear-gradient(90deg, rgba(7,31,133,0.97) 0%, rgba(29,78,216,0.88) 55%, rgba(180,83,9,0.65) 100%)',
    },
    vars: {
      '--th-accent':      '#fbbf24',
      '--th-accent-dim':  'rgba(251,191,36,0.13)',
      '--th-accent-hover':'rgba(251,191,36,0.22)',
      '--th-accent-text': '#fde68a',
      '--th-border':      'rgba(251,191,36,0.3)',
      '--th-selection':   'rgba(251,191,36,0.3)',
    },
  },

  {
    id: 'tu_bav',
    name: "Tu B'Av",
    nameHe: 'ט״ו באב',
    emoji: '🌹',
    group: 'jewish',
    banner: {
      text: "Tu B'Av — Share love with something special.",
      gradient: 'linear-gradient(90deg, rgba(136,19,55,0.97) 0%, rgba(190,24,93,0.88) 50%, rgba(157,23,77,0.9) 100%)',
    },
    vars: {
      '--th-accent':      '#ec4899',
      '--th-accent-dim':  'rgba(236,72,153,0.12)',
      '--th-accent-hover':'rgba(236,72,153,0.2)',
      '--th-accent-text': '#f9a8d4',
      '--th-border':      'rgba(236,72,153,0.28)',
      '--th-selection':   'rgba(236,72,153,0.28)',
    },
  },

  // ─── Commercial moments ────────────────────────────────────────────────────

  {
    id: 'black_friday',
    name: 'Black Friday',
    emoji: '🔥',
    group: 'commercial',
    banner: {
      text: 'BLACK FRIDAY — Unmissable deals. Shop now.',
      gradient: 'linear-gradient(90deg, rgba(0,0,0,0.99) 0%, rgba(9,9,11,0.99) 50%, rgba(21,128,61,0.55) 100%)',
    },
    vars: {
      '--th-accent':      '#22c55e',
      '--th-accent-dim':  'rgba(34,197,94,0.12)',
      '--th-accent-hover':'rgba(34,197,94,0.2)',
      '--th-accent-text': '#4ade80',
      '--th-border':      'rgba(34,197,94,0.3)',
      '--th-selection':   'rgba(34,197,94,0.3)',
    },
  },

  {
    id: 'valentines',
    name: "Valentine's Day",
    emoji: '💝',
    group: 'commercial',
    banner: {
      text: "Happy Valentine's Day! Give the gift of quality.",
      gradient: 'linear-gradient(90deg, rgba(136,19,55,0.97) 0%, rgba(190,18,60,0.88) 50%, rgba(159,18,57,0.9) 100%)',
    },
    vars: {
      '--th-accent':      '#f43f5e',
      '--th-accent-dim':  'rgba(244,63,94,0.12)',
      '--th-accent-hover':'rgba(244,63,94,0.2)',
      '--th-accent-text': '#fb7185',
      '--th-border':      'rgba(244,63,94,0.28)',
      '--th-selection':   'rgba(244,63,94,0.28)',
    },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string | null | undefined): SeasonalTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const STOREFRONT_THEME_KEY = 'storefront_theme';

/** Apply or remove CSS custom properties on <html> */
export function applyTheme(id: string) {
  const theme = getTheme(id);
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  // Remove any previously set theme vars
  for (const t of THEMES) {
    for (const key of Object.keys(t.vars)) {
      root.style.removeProperty(key);
    }
  }
  // Apply new vars
  for (const [key, val] of Object.entries(theme.vars)) {
    root.style.setProperty(key, val);
  }
  localStorage.setItem(STOREFRONT_THEME_KEY, id);
}
