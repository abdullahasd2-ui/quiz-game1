import type { Popular } from '@quiz/shared';
import { useQuery } from '@tanstack/react-query';
import { serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';

/** What players pick most (order only), for the «🔥 الأكثر لعبًا» marks. Empty until it loads or if it fails. */
export function usePopular(): Popular | undefined {
  const { data } = useQuery({
    queryKey: ['popular'],
    queryFn: async () => {
      const res = await fetch(serverUrl('/api/popular'));
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Popular;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  return data;
}

/** The ribbon on the most played mode or category. */
export function HotBadge({ small = false, className }: { small?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute z-10 inline-flex items-center gap-0.5 rounded-full bg-linear-to-l from-orange-500 to-amber-400 font-black text-black shadow-[0_0_14px_-2px_rgba(251,146,60,0.9)] motion-safe:animate-pulse',
        small ? '-top-2 inset-x-0 mx-auto w-fit px-1.5 py-px text-[9px]' : '-top-2.5 start-3 px-2 py-0.5 text-[10px]',
        className,
      )}
    >
      🔥 {small ? 'الأكثر' : 'الأكثر لعبًا'}
    </span>
  );
}
