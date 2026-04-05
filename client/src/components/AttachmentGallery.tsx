import { useEffect, useState } from 'react';
import type { Attachment } from '../types/ticket';

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Lightbox({
  attachments,
  index,
  onClose,
}: {
  attachments: Attachment[];
  index: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);
  const total = attachments.length;
  const attachment = attachments[current];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent((i) => (i + 1) % total);
      if (e.key === 'ArrowLeft')  setCurrent((i) => (i - 1 + total) % total);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [total, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[80vh] max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <span className="truncate text-xs text-zinc-500">{attachment.fileName} · {formatBytes(attachment.size)}</span>
          <div className="flex items-center gap-3">
            {total > 1 && (
              <span className="text-[10px] text-zinc-600">{current + 1} / {total}</span>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-zinc-900 p-4">
          {attachment.url ? (
            <img
              src={attachment.url}
              alt={attachment.fileName}
              className="max-h-[60vh] max-w-full rounded object-contain"
            />
          ) : (
            <p className="text-sm text-zinc-600">Preview unavailable</p>
          )}
        </div>

        {/* Prev / Next */}
        {total > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2">
            <button
              onClick={() => setCurrent((i) => (i - 1 + total) % total)}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            >
              ← Prev
            </button>
            <div className="flex gap-1.5">
              {attachments.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 w-1.5 rounded-full transition ${i === current ? 'bg-zinc-300' : 'bg-zinc-700 hover:bg-zinc-500'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrent((i) => (i + 1) % total)}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttachmentGallery({
  attachments,
  title = 'Attachments',
}: {
  attachments: Attachment[];
  title?: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const viewable = attachments.filter((a) => a.url);

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          attachments={viewable}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <div className="mt-5 border-t border-zinc-800 pt-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
          {title} ({attachments.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => {
            const viewableIndex = viewable.findIndex((a) => a.key === attachment.key);
            return (
              <button
                key={attachment.key}
                type="button"
                title={`${attachment.fileName} · ${formatBytes(attachment.size)}`}
                onClick={() => viewableIndex !== -1 && setLightboxIndex(viewableIndex)}
                className={`group relative overflow-hidden rounded-lg border transition ${
                  attachment.url
                    ? 'border-zinc-800 hover:border-zinc-600 cursor-zoom-in'
                    : 'pointer-events-none border-zinc-900 opacity-50'
                }`}
              >
                {attachment.url ? (
                  <>
                    <img
                      src={attachment.url}
                      alt={attachment.fileName}
                      className="h-16 w-16 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-white">
                        <path d="M3 3h5M3 3v5M17 3h-5M17 3v5M3 17h5M3 17v-5M17 17h-5M17 17v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-zinc-900">
                    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-zinc-600">
                      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M3 13l4-4 3 3 2-2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 space-y-1">
          {attachments.map((a) => (
            <div key={a.key} className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span className="truncate max-w-[180px]">{a.fileName}</span>
              <span className="shrink-0">{formatBytes(a.size)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
