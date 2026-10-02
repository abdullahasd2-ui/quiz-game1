import type { QuestionType } from './schemas';

// Response shapes of the HTTP API (dates arrive as ISO strings).
export type Category = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

export type PublicCategory = Pick<Category, 'id' | 'slug' | 'name' | 'icon'> & { playable: boolean };

export type Question = {
  id: number;
  categoryId: number;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  imageUrl: string | null;
  revealUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type CoverageRow = { categoryId: number; slug: string; name: string; counts: Record<number, number> };

export type Admin = { id: number; email: string };

export type ApiErrorBody = { error: string; issues?: { path: string; message: string }[] };
