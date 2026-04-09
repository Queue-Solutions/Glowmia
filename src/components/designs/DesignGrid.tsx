import { DesignCard } from '@/src/components/designs/DesignCard';
import type { Design } from '@/src/data/designs';

type DesignGridProps = {
  designs: Design[];
  priorityCount?: number;
};

export function DesignGrid({ designs, priorityCount = 0 }: DesignGridProps) {
  return (
    <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
      {designs.map((design, index) => (
        <DesignCard key={design.id} design={design} priority={index < priorityCount} />
      ))}
    </div>
  );
}
