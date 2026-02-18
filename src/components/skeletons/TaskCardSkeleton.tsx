'use client';

export function TaskCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-card border border-border animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-3 w-1/2 bg-muted rounded mb-3" />
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 bg-muted rounded-full" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}
