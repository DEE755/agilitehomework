import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
import type { AppNotification } from '../../types/admin';

const POLL_INTERVAL = 30_000; // 30 seconds

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_ICON: Record<AppNotification['type'], string> = {
  ticket_assigned:  '📋',
  customer_replied: '💬',
  ai_escalated:     '⚠',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await adminApi.notifications.list();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silently ignore — network errors shouldn't break the UI
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    void fetchNotifications();
    const id = setInterval(() => void fetchNotifications(), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await adminApi.notifications.markRead(id).catch(() => null);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await adminApi.notifications.markAllRead().catch(() => null);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded border border-zinc-800 p-1.5 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path
            d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 16.5a1.5 1.5 0 003 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-olive-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded border border-zinc-800 bg-zinc-950 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => void handleMarkAllRead()}
                className="text-[10px] text-zinc-600 transition hover:text-zinc-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-600">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`flex gap-3 border-b border-zinc-800/50 px-4 py-3 transition last:border-0 ${
                    n.read ? 'opacity-50' : 'bg-zinc-900/40'
                  }`}
                >
                  <span className="mt-0.5 text-sm">{TYPE_ICON[n.type]}</span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/admin/tickets/${n.ticketId}`}
                      onClick={() => {
                        void handleMarkRead(n._id);
                        setOpen(false);
                      }}
                      className="block text-xs text-zinc-300 hover:text-olive-400 transition"
                    >
                      {n.message}
                    </Link>
                    <span className="text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</span>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => void handleMarkRead(n._id)}
                      className="mt-0.5 text-[10px] text-zinc-700 transition hover:text-zinc-400"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
