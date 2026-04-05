import type { TicketStatus } from '../types/ticket';

const styles: Record<TicketStatus, string> = {
  new:         'border border-olive-500/30 bg-olive-500/10 text-olive-400',
  in_progress: 'border border-sky-500/30 bg-sky-500/10 text-sky-400',
  resolved:    'border border-violet-500/30 bg-violet-500/10 text-violet-400',
};

const dots: Record<TicketStatus, string> = {
  new:         'bg-olive-400',
  in_progress: 'bg-sky-400',
  resolved:    'bg-violet-400',
};

const labels: Record<TicketStatus, string> = {
  new:         'New',
  in_progress: 'In Progress',
  resolved:    'Resolved',
};

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}
