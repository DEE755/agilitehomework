export const PRODUCT_PALETTES = [
  { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/30'     },
  { bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/30'  },
  { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30'   },
  { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/30'    },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/30'    },
  { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/30'  },
  { bg: 'bg-pink-500/20',    text: 'text-pink-300',    border: 'border-pink-500/30'    },
];

export function productPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PRODUCT_PALETTES[h % PRODUCT_PALETTES.length];
}

export function parseTitle(raw: string): { productName: string | null; title: string } {
  const m = raw.match(/^\[(.+?)\]\s*(.+)$/);
  if (m) return { productName: m[1], title: m[2] };
  return { productName: null, title: raw };
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
