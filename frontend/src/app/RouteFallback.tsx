import { Skeleton } from "../components/ui/primitives";

// Content-shaped fallback while a lazy route chunk loads (spec: skeletons match geometry).
export function RouteFallback() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10">
      <Skeleton className="h-8 w-56 mb-6" />
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
