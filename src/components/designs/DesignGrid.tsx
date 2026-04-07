import { DesignCard } from '@/src/components/designs/DesignCard';
import type { Design } from '@/src/data/designs';

type DesignGridProps = {
  designs: Design[];
};

export function DesignGrid({ designs }: DesignGridProps) {
  return (
    <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
      {designs.map((design) => (
        <DesignCard key={design.id} design={design} />
      ))}
    </div>
  );
}
