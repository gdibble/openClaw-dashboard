'use client';

export function MetricsSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border animate-pulse">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-5 w-5 bg-muted rounded" />
        <div className="h-5 w-32 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 bg-muted/30 rounded-xl">
            <div className="h-3 w-12 bg-muted rounded mb-2" />
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-40 bg-muted/30 rounded-xl" />
    </div>
  );
}
