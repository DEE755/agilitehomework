import { formatDate } from '../../../utils/formatting';
import type { Reply } from '../../../types/ticket';
import type { InternalNote } from '../../../types/admin';

export function ReplyBubble({ reply, index }: { reply: Reply; index: number }) {
  const isAgent  = reply.isAgent;
  const isAiBot  = isAgent && reply.authorName === 'Agilate Support AI';

  const avatarCls = isAiBot
    ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
    : isAgent
      ? 'border-olive-500/30 bg-olive-500/10 text-olive-400'
      : 'border-zinc-700 bg-zinc-800 text-zinc-400';

  const bubbleCls = isAiBot
    ? 'rounded-tr-sm border border-violet-500/25 bg-violet-500/5'
    : isAgent
      ? 'rounded-tr-sm border border-olive-500/20 bg-olive-500/5'
      : 'rounded-tl-sm border border-zinc-800 bg-zinc-900';

  return (
    <div className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarCls}`}>
        {isAiBot ? '✦' : reply.authorName[0]?.toUpperCase()}
      </span>
      <div className={`max-w-[80%] flex-1 rounded-xl p-4 ${bubbleCls}`}>
        <div className={`flex flex-wrap items-baseline gap-2 ${isAgent ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-semibold text-zinc-200">{reply.authorName}</span>
          {isAiBot && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              ✦ AI Agent · Auto-sent
            </span>
          )}
          {isAgent && !isAiBot && (
            <span className="rounded-full border border-olive-500/30 bg-olive-500/10 px-2 py-0.5 text-[10px] font-medium text-olive-400">
              Agent
            </span>
          )}
          <span className="ml-auto text-xs text-zinc-600">#{index + 1} · {formatDate(reply.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{reply.body}</p>
      </div>
    </div>
  );
}

export function NoteBubble({ note }: { note: InternalNote }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-400">
        {note.authorName[0]?.toUpperCase()}
      </span>
      <div className="flex-1 rounded-xl rounded-tl-sm border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-300">{note.authorName}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            Internal Note
          </span>
          <span className="ml-auto text-xs text-zinc-600">{formatDate(note.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">{note.body}</p>
      </div>
    </div>
  );
}
