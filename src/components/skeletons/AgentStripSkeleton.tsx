'use client';

export function AgentStripSkeleton() {
  return (
    <div className="flex items-center gap-3 py-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl">
          <div className="w-8 h-8 bg-muted rounded-full" />
          <div>
            <div className="h-3 w-16 bg-muted rounded mb-1" />
            <div className="h-2 w-10 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
