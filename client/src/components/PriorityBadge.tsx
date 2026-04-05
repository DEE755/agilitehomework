import type { TicketPriority } from '../types/ticket';

const styles: Record<TicketPriority, string> = {
  high:       'border border-red-500/25 bg-red-500/10 text-red-400',
  medium:     'border border-amber-500/25 bg-amber-500/10 text-amber-400',
  low:        'border border-sky-500/25 bg-sky-500/10 text-sky-400',
  irrelevant: 'border border-zinc-600/40 bg-zinc-800/60 text-zinc-500 line-through',
};

interface Props {
  priority: TicketPriority | null | undefined;
  aiAssessed?: boolean;
}

export default function PriorityBadge({ priority, aiAssessed }: Props) {
  if (!priority) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        Pending Triage
      </span>
    );
  }

  const label = priority === 'irrelevant' ? 'Irrelevant' : priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[priority]}`}>
      {priority === 'irrelevant' ? (
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden="true">
          <path d="M10 2L2 10M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : aiAssessed ? (
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 opacity-70" aria-label="AI assessed">
          <path d="M6 1l1.2 2.4L10 4.2 7.9 6.3l.5 3L6 8l-2.4 1.3.5-3L2 4.2l2.8-.8L6 1z" fill="currentColor"/>
        </svg>
      ) : null}
      {label}
    </span>
  );
}
