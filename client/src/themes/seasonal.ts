export interface ThemeDecorations {
  emojis: string[];
  count: number;
  animation: 'float-up' | 'fall-down';
}

export interface SeasonalTheme {
  id: string;
  name: string;
  nameHe?: string;
  emoji: string;
  group: 'jewish' | 'commercial';
  banner: { text: string; textHe?: string; gradient: string } | null;
  /** CSS custom property overrides applied to <html data-theme="id"> */
  vars: Record<string, string>;
  /** Optional ambient particle decorations rendered over the storefront */
  decorations?: ThemeDecorations;
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
      textHe: 'פורים שמח! גלו את הקולקציה החגיגית שלנו.',
      gradient: 'linear-gradient(90deg, rgba(91,33,182,0.95) 0%, rgba(126,34,206,0.9) 45%, rgba(219,39,119,0.85) 100%)',
    },
    decorations: {
      emojis: ['🎭', '🎉', '🎊', '🌟', '⭐', '🎈'],
      count: 18,
      animation: 'fall-down',
    },
    vars: {
      '--th-accent':       '#a855f7',
      '--th-accent-dim':   'rgba(168,85,247,0.13)',
      '--th-accent-hover': 'rgba(168,85,247,0.2)',
      '--th-accent-text':  '#c084fc',
      '--th-border':       'rgba(168,85,247,0.3)',
      '--th-selection':    'rgba(168,85,247,0.3)',
      '--th-page-tint':    'rgba(168,85,247,0.04)',
      '--th-card-glow':    'rgba(168,85,247,0.22)',
      '--th-price':        '#c084fc',
      '--th-logo-border':  'rgba(168,85,247,0.45)',
      '--th-logo-bg':      'rgba(168,85,247,0.15)',
      '--th-nav-border':   'rgba(168,85,247,0.25)',
    },
  },

  {
    id: 'pesach',
    name: 'Pesach',
    nameHe: 'פסח',
    emoji: '🫓',
    group: 'jewish',
    banner: {
      text: '🍷 🫓 ✡️  Hag Pesach Sameach!  ✡️ 🫓 🍷',
      textHe: 'חג פסח שמח! בחירות טריות לשולחן הסדר.',
      gradient: 'linear-gradient(90deg, rgba(120,77,4,0.97) 0%, rgba(202,138,4,0.88) 50%, rgba(133,77,14,0.85) 100%)',
    },
    decorations: {
      emojis: ['🫓', '🍷', '🐸', '🦗', '🪰', '🩸', '🐍', '🌊', '🐟', '🍗', '🥚', '✡️', '🔯', '🦁', '🐯', '⚱️'],
      count: 20,
      animation: 'fall-down',
    },
    vars: {
      '--th-accent':       '#eab308',
      '--th-accent-dim':   'rgba(234,179,8,0.13)',
      '--th-accent-hover': 'rgba(234,179,8,0.22)',
      '--th-accent-text':  '#fde047',
      '--th-border':       'rgba(234,179,8,0.32)',
      '--th-selection':    'rgba(234,179,8,0.32)',
      '--th-page-tint':    'rgba(234,179,8,0.04)',
      '--th-card-glow':    'rgba(234,179,8,0.22)',
      '--th-price':        '#fde047',
      '--th-logo-border':  'rgba(234,179,8,0.45)',
      '--th-logo-bg':      'rgba(234,179,8,0.15)',
      '--th-nav-border':   'rgba(234,179,8,0.28)',
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
      textHe: 'יום העצמאות שמח! חוגגים עם הציוד הטוב ביותר.',
      gradient: 'linear-gradient(90deg, rgba(10,37,140,0.97) 0%, rgba(29,78,216,0.9) 50%, rgba(10,37,140,0.97) 100%)',
    },
    decorations: {
      emojis: ['🇮🇱', '✡️', '🕍', '🇮🇱', '🇮🇱'],
      count: 14,
      animation: 'float-up',
    },
    vars: {
      '--th-accent':       '#3b82f6',
      '--th-accent-dim':   'rgba(59,130,246,0.13)',
      '--th-accent-hover': 'rgba(59,130,246,0.2)',
      '--th-accent-text':  '#93c5fd',
      '--th-border':       'rgba(59,130,246,0.3)',
      '--th-selection':    'rgba(59,130,246,0.3)',
      '--th-page-tint':    'rgba(59,130,246,0.045)',
      '--th-card-glow':    'rgba(59,130,246,0.22)',
      '--th-price':        '#93c5fd',
      '--th-logo-border':  'rgba(59,130,246,0.45)',
      '--th-logo-bg':      'rgba(59,130,246,0.15)',
      '--th-nav-border':   'rgba(59,130,246,0.28)',
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
      textHe: 'חג שבועות שמח! קל, טרי וחגיגי.',
      gradient: 'linear-gradient(90deg, rgba(13,78,55,0.92) 0%, rgba(20,184,166,0.75) 55%, rgba(5,150,105,0.85) 100%)',
    },
    vars: {
      '--th-accent':       '#5eead4',
      '--th-accent-dim':   'rgba(94,234,212,0.12)',
      '--th-accent-hover': 'rgba(94,234,212,0.2)',
      '--th-accent-text':  '#99f6e4',
      '--th-border':       'rgba(94,234,212,0.25)',
      '--th-selection':    'rgba(94,234,212,0.25)',
      '--th-page-tint':    'rgba(94,234,212,0.03)',
      '--th-card-glow':    'rgba(94,234,212,0.18)',
      '--th-price':        '#99f6e4',
      '--th-logo-border':  'rgba(94,234,212,0.35)',
      '--th-logo-bg':      'rgba(94,234,212,0.12)',
      '--th-nav-border':   'rgba(94,234,212,0.2)',
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
      textHe: 'שנה טובה! 🍎 מאחלים לכם שנה מתוקה.',
      gradient: 'linear-gradient(90deg, rgba(120,53,15,0.97) 0%, rgba(180,83,9,0.88) 50%, rgba(133,77,14,0.95) 100%)',
    },
    decorations: {
      emojis: ['🍎', '🍯', '🌟', '✨', '🍁'],
      count: 12,
      animation: 'fall-down',
    },
    vars: {
      '--th-accent':       '#f59e0b',
      '--th-accent-dim':   'rgba(245,158,11,0.14)',
      '--th-accent-hover': 'rgba(245,158,11,0.22)',
      '--th-accent-text':  '#fbbf24',
      '--th-border':       'rgba(245,158,11,0.32)',
      '--th-selection':    'rgba(245,158,11,0.32)',
      '--th-page-tint':    'rgba(245,158,11,0.04)',
      '--th-card-glow':    'rgba(245,158,11,0.22)',
      '--th-price':        '#fbbf24',
      '--th-logo-border':  'rgba(245,158,11,0.45)',
      '--th-logo-bg':      'rgba(245,158,11,0.15)',
      '--th-nav-border':   'rgba(245,158,11,0.28)',
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
      textHe: 'חג סוכות שמח! חמימות עונת הקציר.',
      gradient: 'linear-gradient(90deg, rgba(124,45,18,0.97) 0%, rgba(194,65,12,0.88) 50%, rgba(161,98,7,0.85) 100%)',
    },
    vars: {
      '--th-accent':       '#f97316',
      '--th-accent-dim':   'rgba(249,115,22,0.12)',
      '--th-accent-hover': 'rgba(249,115,22,0.2)',
      '--th-accent-text':  '#fb923c',
      '--th-border':       'rgba(249,115,22,0.28)',
      '--th-selection':    'rgba(249,115,22,0.28)',
      '--th-page-tint':    'rgba(249,115,22,0.04)',
      '--th-card-glow':    'rgba(249,115,22,0.20)',
      '--th-price':        '#fb923c',
      '--th-logo-border':  'rgba(249,115,22,0.42)',
      '--th-logo-bg':      'rgba(249,115,22,0.14)',
      '--th-nav-border':   'rgba(249,115,22,0.24)',
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
      textHe: 'חנוכה שמח! זהרו בעונה הזו.',
      gradient: 'linear-gradient(90deg, rgba(7,31,133,0.97) 0%, rgba(29,78,216,0.88) 55%, rgba(180,83,9,0.65) 100%)',
    },
    decorations: {
      emojis: ['✨', '🕎', '⭐', '🌟', '💫'],
      count: 14,
      animation: 'float-up',
    },
    vars: {
      '--th-accent':       '#fbbf24',
      '--th-accent-dim':   'rgba(251,191,36,0.13)',
      '--th-accent-hover': 'rgba(251,191,36,0.22)',
      '--th-accent-text':  '#fde68a',
      '--th-border':       'rgba(251,191,36,0.3)',
      '--th-selection':    'rgba(251,191,36,0.3)',
      '--th-page-tint':    'rgba(29,78,216,0.06)',
      '--th-card-glow':    'rgba(251,191,36,0.22)',
      '--th-price':        '#fde68a',
      '--th-logo-border':  'rgba(251,191,36,0.45)',
      '--th-logo-bg':      'rgba(251,191,36,0.15)',
      '--th-nav-border':   'rgba(251,191,36,0.28)',
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
      textHe: 'ט״ו באב — שתפו אהבה עם משהו מיוחד.',
      gradient: 'linear-gradient(90deg, rgba(136,19,55,0.97) 0%, rgba(190,24,93,0.88) 50%, rgba(157,23,77,0.9) 100%)',
    },
    decorations: {
      emojis: ['🌹', '❤️', '🌸', '💕', '🌷', '💗'],
      count: 16,
      animation: 'fall-down',
    },
    vars: {
      '--th-accent':       '#ec4899',
      '--th-accent-dim':   'rgba(236,72,153,0.12)',
      '--th-accent-hover': 'rgba(236,72,153,0.2)',
      '--th-accent-text':  '#f9a8d4',
      '--th-border':       'rgba(236,72,153,0.28)',
      '--th-selection':    'rgba(236,72,153,0.28)',
      '--th-page-tint':    'rgba(236,72,153,0.04)',
      '--th-card-glow':    'rgba(236,72,153,0.22)',
      '--th-price':        '#f9a8d4',
      '--th-logo-border':  'rgba(236,72,153,0.42)',
      '--th-logo-bg':      'rgba(236,72,153,0.14)',
      '--th-nav-border':   'rgba(236,72,153,0.24)',
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
      textHe: 'יום שישי השחור — מבצעים שאסור לפספס. קנו עכשיו.',
      gradient: 'linear-gradient(90deg, rgba(0,0,0,0.99) 0%, rgba(9,9,11,0.99) 50%, rgba(21,128,61,0.55) 100%)',
    },
    vars: {
      '--th-accent':       '#22c55e',
      '--th-accent-dim':   'rgba(34,197,94,0.12)',
      '--th-accent-hover': 'rgba(34,197,94,0.2)',
      '--th-accent-text':  '#4ade80',
      '--th-border':       'rgba(34,197,94,0.3)',
      '--th-selection':    'rgba(34,197,94,0.3)',
      '--th-page-tint':    'rgba(34,197,94,0.03)',
      '--th-card-glow':    'rgba(34,197,94,0.20)',
      '--th-price':        '#4ade80',
      '--th-logo-border':  'rgba(34,197,94,0.42)',
      '--th-logo-bg':      'rgba(34,197,94,0.14)',
      '--th-nav-border':   'rgba(34,197,94,0.24)',
    },
  },

  {
    id: 'valentines',
    name: "Valentine's Day",
    emoji: '💝',
    group: 'commercial',
    banner: {
      text: "Happy Valentine's Day! Give the gift of quality.",
      textHe: 'יום האהבה שמח! תנו מתנה של איכות.',
      gradient: 'linear-gradient(90deg, rgba(136,19,55,0.97) 0%, rgba(190,18,60,0.88) 50%, rgba(159,18,57,0.9) 100%)',
    },
    decorations: {
      emojis: ['❤️', '🌹', '💝', '💖', '🌷', '💗', '🥀'],
      count: 18,
      animation: 'fall-down',
    },
    vars: {
      '--th-accent':       '#f43f5e',
      '--th-accent-dim':   'rgba(244,63,94,0.12)',
      '--th-accent-hover': 'rgba(244,63,94,0.2)',
      '--th-accent-text':  '#fb7185',
      '--th-border':       'rgba(244,63,94,0.28)',
      '--th-selection':    'rgba(244,63,94,0.28)',
      '--th-page-tint':    'rgba(244,63,94,0.04)',
      '--th-card-glow':    'rgba(244,63,94,0.22)',
      '--th-price':        '#fb7185',
      '--th-logo-border':  'rgba(244,63,94,0.4)',
      '--th-logo-bg':      'rgba(244,63,94,0.13)',
      '--th-nav-border':   'rgba(244,63,94,0.22)',
    },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string | null | undefined): SeasonalTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const STOREFRONT_THEME_KEY = 'storefront_theme';
export const CUSTOMER_UI_THEME_KEY = 'customer_ui_theme';

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
