import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const TOKEN_KEY = 'ag_admin_token';
const AGENT_KEY = 'ag_admin_agent';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const ADMIN_EMAIL = 'admin@agilate.com';
const ADMIN_PASSWORD = 'Admin1234!';

interface LoginResponse {
  token: string;
  agent: { _id: string; name: string; email: string; role: string };
}

async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as LoginResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Login failed');
  if (!data.token) throw new Error('Authentication error');
  return data;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') ?? '/admin/tickets';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // Skip login if already authenticated
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) navigate(redirect, { replace: true });
  }, [navigate, redirect]);

  async function login(cEmail: string, cPassword: string) {
    setError(null);
    setLoading(true);
    try {
      const { token, agent } = await loginRequest(cEmail, cPassword);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded border border-olive-500/40 bg-olive-500/15">
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-olive-400">
              <path d="M10 2L2 7v6l8 5 8-5V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/>
            </svg>
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Agent Access</p>
        </div>

        {/* Form */}
        <form
          onSubmit={e => { e.preventDefault(); login(email, password); }}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h1 className="mb-5 text-sm font-semibold uppercase tracking-widest text-zinc-200">Sign in</h1>

          {error && (
            <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-olive-500/40 bg-olive-500/15 py-2 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Discrete quick-connect */}
        <div className="mt-4 flex items-center justify-between px-1">
          <Link to="/products" className="text-[10px] text-zinc-600 transition hover:text-zinc-400">
            ← Customer portal
          </Link>
          <button
            type="button"
            onClick={() => { setEmail(ADMIN_EMAIL); setPassword(ADMIN_PASSWORD); }}
            className="text-[10px] text-zinc-600 transition hover:text-zinc-400"
          >
            Connect as admin
          </button>
        </div>
      </div>
    </div>
  );
}
