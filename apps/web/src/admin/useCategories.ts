import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const categoriesQueryKey = ['categories'] as const;

export function useCategories() {
  const query = useQuery({ queryKey: categoriesQueryKey, queryFn: api.categories });
  const byId = new Map((query.data ?? []).map((c) => [c.id, c]));
  return { ...query, byId };
}
