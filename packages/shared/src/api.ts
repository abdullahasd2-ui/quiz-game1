import type { GamePhase, RoomMode, RoomStatus } from './game';
import type { Variant } from './rules';
import type { Platform, QuestionStatus, QuestionType } from './schemas';

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
  reference: string | null;
  status: QuestionStatus;
  source: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type CoverageRow = { categoryId: number; slug: string; name: string; counts: Record<number, number> };

export type Admin = { id: number; email: string };
export type AdminAccount = Admin & { createdAt: string; lastLoginAt: string | null };

/** What's happening on the game server right now (rooms live in memory). */
export type LiveRoom = {
  code: string;
  mode: RoomMode;
  variant: Variant;
  status: RoomStatus;
  phase: GamePhase;
  teams: ({ name: string; score: number; connected: boolean } | null)[];
  tvConnected: boolean | null;
  categories: string[];
  roundsPlayed: number;
  totalRounds: number;
  idleSeconds: number;
};
export type LiveStats = {
  /** Open sockets (a device with two tabs counts twice). */
  connections: number;
  /** Distinct devices online, in a room or not. */
  devicesOnline: number;
  /** Connected devices sitting in a room. */
  playersInRooms: number;
  rooms: LiveRoom[];
};

export type UsageDay = { day: string; visitors: number; visits: number; games: number; finished: number };
export type UsageStats = {
  days: number;
  totals: {
    visitors: number;
    visits: number;
    newVisitors: number;
    gamesCreated: number;
    gamesStarted: number;
    gamesFinished: number;
    /** Median minutes from start to the last round, finished games only. */
    medianGameMinutes: number | null;
  };
  today: { visitors: number; visits: number; games: number };
  byDay: UsageDay[];
  platforms: { platform: Platform; visitors: number }[];
  modes: { mode: RoomMode; variant: Variant; games: number }[];
  topCategories: { categoryId: number; name: string; games: number }[];
};

export type ApiErrorBody = { error: string; issues?: { path: string; message: string }[] };
