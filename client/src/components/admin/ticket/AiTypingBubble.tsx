export default function AiTypingBubble() {
  return (
    <div className="flex flex-row-reverse gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">
        ✦
      </span>
      <div className="max-w-[80%] flex-1 rounded-xl rounded-tr-sm border border-violet-500/25 bg-violet-500/5 p-4">
        <div className="flex flex-row-reverse items-baseline gap-2 mb-3">
          <span className="text-sm font-semibold text-zinc-200">AI Agent</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
            ✦ Generating reply…
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
