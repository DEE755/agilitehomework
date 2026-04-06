import { Link, useLocation, useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

type SuccessState = {
  authorEmail?: string;
  productName?: string | null;
};

export default function SupportSuccessPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const location = useLocation();
  const state = (location.state as SuccessState | null) ?? null;
  const { t } = useLanguage();
  const ts = t.success;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <span className="th-btn inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-xl">
          ✓
        </span>

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] th-text opacity-80">
          {ts.received}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-100">
          {ts.heading}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          {ts.body}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {ts.reference}
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-200">
              {ticketId ?? ts.pending}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {ts.contact}
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              {state?.authorEmail ?? ts.contactFallback}
            </p>
          </div>
        </div>

        {state?.productName && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {ts.product}
            </p>
            <p className="mt-2 text-sm text-zinc-200">{state.productName}</p>
          </div>
        )}

        {ticketId && state?.authorEmail && (
          <div className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500">{ts.trackProgress}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {ts.bookmarkHint}
            </p>
            <Link
              to={`/support/lookup?id=${ticketId}&email=${encodeURIComponent(state.authorEmail)}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 transition hover:text-sky-300"
            >
              {ts.viewThread}
            </Link>
          </div>
        )}

        <div className="mt-6">
          <Link
            to="/products"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {ts.backToProducts}
          </Link>
        </div>
      </div>
    </div>
  );
}
