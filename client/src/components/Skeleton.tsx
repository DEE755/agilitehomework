function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800 ${className}`} />;
}

export function TicketCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <Bone className="h-4 w-2/3" />
        <div className="flex shrink-0 gap-1.5">
          <Bone className="h-5 w-14 rounded-full" />
          <Bone className="h-5 w-14 rounded-full" />
        </div>
      </div>
      <Bone className="mt-2.5 h-3 w-full" />
      <Bone className="mt-1.5 h-3 w-4/5" />
      <div className="mt-4 flex gap-3">
        <Bone className="h-3 w-24" />
        <Bone className="h-3 w-20" />
      </div>
    </div>
  );
}

export function TicketDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl">
      <Bone className="mb-6 h-4 w-28" />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between gap-4">
          <Bone className="h-6 w-3/4" />
          <div className="flex gap-1.5">
            <Bone className="h-5 w-14 rounded-full" />
            <Bone className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="mt-3 flex gap-4">
          <Bone className="h-3 w-28" />
          <Bone className="h-3 w-36" />
          <Bone className="h-3 w-32" />
        </div>
        <Bone className="mt-5 h-3 w-full" />
        <Bone className="mt-2 h-3 w-full" />
        <Bone className="mt-2 h-3 w-2/3" />
      </div>
    </div>
  );
}
