export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workspace…</span>

      <div className="space-y-2">
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-3 w-full max-w-xl animate-pulse rounded-full bg-muted/80" />
      </div>

      <div className="h-44 animate-pulse rounded-2xl border border-border bg-card" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}
