import { Link, useLocation, useParams } from 'react-router-dom';

type SuccessState = {
  authorEmail?: string;
  productName?: string | null;
};

export default function SupportSuccessPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const location = useLocation();
  const state = (location.state as SuccessState | null) ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <span className="th-btn inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-xl">
          ✓
        </span>

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] th-text opacity-80">
          Request Received
        </p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-100">
          Your support request is in the queue
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          The support team now owns the ticket workflow. They will review the request, update its
          status internally, and reply by email if they need more information.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Reference
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-200">
              {ticketId ?? 'Pending'}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Contact
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              {state?.authorEmail ?? 'We will use the email you submitted.'}
            </p>
          </div>
        </div>

        {state?.productName && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Product
            </p>
            <p className="mt-2 text-sm text-zinc-200">{state.productName}</p>
          </div>
        )}

        {ticketId && state?.authorEmail && (
          <div className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500">Track Progress</p>
            <p className="mt-1 text-xs text-zinc-400">
              Bookmark this link to follow your conversation at any time.
            </p>
            <Link
              to={`/support/lookup?id=${ticketId}&email=${encodeURIComponent(state.authorEmail)}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 transition hover:text-sky-300"
            >
              View my ticket thread →
            </Link>
          </div>
        )}

        <div className="mt-6">
          <Link
            to="/products"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Back to Products
          </Link>
        </div>
      </div>
    </div>
  );
}
