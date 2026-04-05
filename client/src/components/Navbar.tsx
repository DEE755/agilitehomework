import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/products', label: 'Products' },
  { to: '/support/new', label: 'Contact Support' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <NavLink to="/products" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded border border-olive-500/40 bg-olive-500/15">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-olive-400" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L2 7v6l8 5 8-5V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/>
            </svg>
          </span>
          <div>
            <span className="block text-xs font-bold uppercase tracking-widest text-zinc-100">Agilite</span>
            <span className="block text-[9px] uppercase tracking-widest text-zinc-600">Customer Support</span>
          </div>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  isActive
                    ? 'text-olive-400'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          <NavLink
            to="/support/new"
            className="ml-3 rounded border border-olive-500/40 bg-olive-500/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 hover:text-olive-300"
          >
            Open Ticket
          </NavLink>

          <NavLink
            to="/admin/login"
            className="ml-1 rounded px-2 py-1.5 text-[10px] text-zinc-700 transition hover:text-zinc-400"
          >
            Admin
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
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-zinc-900 text-olive-400' : 'text-zinc-400 hover:text-zinc-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/support/new"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded border border-olive-500/40 bg-olive-500/15 px-3 py-2.5 text-center text-sm font-semibold text-olive-400"
            >
              Open Ticket
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
