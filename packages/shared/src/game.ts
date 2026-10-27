import { z } from 'zod';
import { POINTS, type Action, type Variant } from './rules';
import type { QuestionType } from './schemas';

// Live game protocol shared by the Socket.IO server and the web client.

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MIN_BOARD_CATEGORIES = 3;
export const MAX_BOARD_CATEGORIES = 9;
export const ACTION_SECONDS = 60;
export const ANSWER_SECONDS = 30;
/** A team's score can go negative, but never below this. */
export const MIN_SCORE = -1000;
export const TEAM_NAME_MAX = 18;
/** Captain + members. A game can start with any number of players per team (at least the captain). */
export const MAX_TEAM_SIZE = 10;

export type RoomMode = 'mobile' | 'tv';
export type TeamIndex = 0 | 1;
/** Which device you are: one of the two teams, or the TV that hosts a tv-mode room. */
export type Seat = TeamIndex | 'tv';
export type RoomStatus = 'lobby' | 'playing' | 'done';
/** board → action (secret answer/steal) → answer → result → board … */
export type GamePhase = 'board' | 'action' | 'answer' | 'result';

/** `id` is a public handle for the host's kick button — never the device id, which is the player's secret. */
export type MemberView = { id: string; name: string; connected: boolean; captain: boolean };
export type TeamView = { name: string; score: number; connected: boolean; members: MemberView[] };
/** Captain decides for the team; members only vote (the tv hosts and never plays). */
export type Role = 'captain' | 'member' | 'tv';
/**
 * Live team vote on the step in progress, only sent to that team's own devices.
 * Keys: `answer`/`steal` in the action phase, the option index in the answer phase,
 * `${categoryId}:${points}` when picking a board cell.
 */
export type VoteView = { counts: Record<string, number>; mine: string | null };
export type BoardCategory = { id: number; name: string; icon: string };

/** A question as players see it: options already shuffled, correct answer withheld. */
export type QuestionView = {
  categoryId: number;
  points: number;
  type: QuestionType;
  text: string;
  options: string[];
  imageUrl: string | null;
};

export type RoundResult = {
  correctIndex: number;
  revealUrl: string | null;
  actions: [Action, Action];
  /** Chosen option index, or -1 when the team stole or ran out of time. */
  answers: [number, number];
  deltas: [number, number];
};

/** Everything one device needs to render the room; the other team's secrets are hidden until the result. */
export type RoomView = {
  code: string;
  mode: RoomMode;
  variant: Variant;
  status: RoomStatus;
  you: Seat;
  role: Role;
  /** True for the room's creator (team 1's captain in mobile mode, the tv in tv mode): may remove players. */
  canKick: boolean;
  teams: [TeamView | null, TeamView | null];
  tvConnected: boolean;
  categories: BoardCategory[];
  /** Used board cells as `${categoryId}:${points}`. */
  used: string[];
  turn: TeamIndex;
  phase: GamePhase;
  question: QuestionView | null;
  /** Time left in the current action/answer phase when this view was sent. */
  remainingMs: number | null;
  /** Whether each team has locked its secret choice (never which one, until the result). */
  decided: [boolean, boolean];
  myAction: Action | null;
  myAnswer: number | null;
  votes: VoteView | null;
  result: RoundResult | null;
};

export const cellKey = (categoryId: number, points: number) => `${categoryId}:${points}`;

/** Who may pick a board cell / advance after a result. */
export function canPick(mode: RoomMode, seat: Seat, turn: TeamIndex): boolean {
  return mode === 'tv' ? seat === 'tv' : seat === turn;
}
export function canAdvance(mode: RoomMode, seat: Seat): boolean {
  return mode === 'tv' ? seat === 'tv' : seat !== 'tv';
}

// ── Client → server payloads ────────────────────────────────────────────────

const teamName = z.string().trim().max(TEAM_NAME_MAX, `اسم الفريق أطول من ${TEAM_NAME_MAX} حرفًا`);
const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH, `الكود ${ROOM_CODE_LENGTH} أحرف`);

const playerName = z.string().trim().max(TEAM_NAME_MAX, `الاسم أطول من ${TEAM_NAME_MAX} حرفًا`);

export const createRoomInput = z.object({
  mode: z.enum(['mobile', 'tv']),
  variant: z.enum(['swap', 'flip']),
  teamName: teamName.optional(),
  playerName: playerName.optional(),
});
export const joinRoomInput = z.object({
  code: roomCode,
  /** Name for the team, used only if you are the first to enter it (you become its captain). */
  teamName: teamName.optional(),
  /** Which team to join; the first to enter a team is its captain, everyone after is a member. */
  team: z.union([z.literal(0), z.literal(1)]).optional(),
  playerName: playerName.optional(),
});
export const startGameInput = z.object({
  categoryIds: z
    .array(z.number().int().positive())
    .min(MIN_BOARD_CATEGORIES, `اختر ${MIN_BOARD_CATEGORIES} فئات على الأقل`)
    .max(MAX_BOARD_CATEGORIES, `اختر ${MAX_BOARD_CATEGORIES} فئات كحد أقصى`)
    .refine((ids) => new Set(ids).size === ids.length, 'فئة مكررة'),
});
export const pickCellInput = z.object({
  categoryId: z.number().int().positive(),
  points: z.number().refine((p) => (POINTS as readonly number[]).includes(p)),
});
export const actionInput = z.object({ action: z.enum(['answer', 'steal']) });
export const answerInput = z.object({ index: z.number().int().min(0).max(3) });
export const kickInput = z.object({ id: z.string().trim().min(1).max(16) });
export const voteInput = z.object({ key: z.string().trim().min(1).max(16) });

export type CreateRoomInput = z.infer<typeof createRoomInput>;
export type JoinRoomInput = z.infer<typeof joinRoomInput>;

export type Ack<T = null> = { ok: true; data: T } | { ok: false; error: string };
type Reply<T = null> = (res: Ack<T>) => void;

export interface ClientToServerEvents {
  'room:create': (input: CreateRoomInput, reply: Reply<{ code: string }>) => void;
  'room:join': (input: JoinRoomInput, reply: Reply<{ code: string }>) => void;
  'room:leave': (reply: Reply) => void;
  'game:start': (input: z.infer<typeof startGameInput>, reply: Reply) => void;
  'game:pick': (input: z.infer<typeof pickCellInput>, reply: Reply) => void;
  'game:action': (input: z.infer<typeof actionInput>, reply: Reply) => void;
  'game:answer': (input: z.infer<typeof answerInput>, reply: Reply) => void;
  'room:kick': (input: z.infer<typeof kickInput>, reply: Reply) => void;
  'game:vote': (input: z.infer<typeof voteInput>, reply: Reply) => void;
  'game:next': (reply: Reply) => void;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'room:closed': (reason: string) => void;
}
