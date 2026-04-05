export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      className={`inline-block animate-spin rounded-full border-2 border-zinc-700 border-t-olive-400 ${className}`}
    />
  );
}
