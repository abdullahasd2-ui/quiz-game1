// «فردي»: the main game with every player on their own (no teams), like the stream game where the streamer
// picks one of the players to swap with. Each question every player decides in secret: answer, or swap / flip /
// reverse one player they pick from the list. Every mode of the main game except «خبّي أو اكشف».
import { LIST_BONUS } from './listquiz';
import type { Action, Variant } from './rules';
import { STREAK_FOR_DOUBLE, type BoardCategory, type GamePhase, type QuestionView, type RoomMode, type RoomStatus } from './game';

export const SOLO_MIN_PLAYERS = 2;
export const SOLO_MAX_PLAYERS = 12;
/** «عدّها» alone: the number of questions in a game. */
export const SOLO_LIST_ROUNDS = 10;
export type SoloVariant = Exclude<Variant, 'hide'>;

/**
 * How a player's question ended.
 * answer-right / answer-wrong / idle (no answer in time) — answered themselves.
 * robbed — answered right, but someone swapped their answer away («انزرف»): 0.
 * reversed — someone reversed them: 0.
 * flipped-right / flipped-wrong — someone flipped them: a right answer costs the points, a wrong one wins them.
 * swap-win / swap-lose — swapped a right (double) or a wrong (minus) answer.
 * reverse-win / reverse-lose — reversed a wrong (plus) or a right (minus) answer.
 * flip — flipped someone: no points for the flipper.
 * void — their player did not answer either (swapped, flipped or reversed too): 0.
 */
export type SoloOutcome =
  | 'answer-right'
  | 'answer-wrong'
  | 'idle'
  | 'robbed'
  | 'reversed'
  | 'flipped-right'
  | 'flipped-wrong'
  | 'swap-win'
  | 'swap-lose'
  | 'reverse-win'
  | 'reverse-lose'
  | 'flip'
  | 'void'
  | 'list';

export type SoloRow = {
  outcome: SoloOutcome;
  delta: number;
  action: Action;
  /** The player they swapped / flipped / reversed. */
  target: string | null;
  /** The option they picked (-1 = none). */
  pick: number;
  /** Players who swapped, flipped or reversed this one. */
  by: string[];
  /** Third right answer in a row: doubled. */
  streak?: boolean;
  /** «عدّها»: right answers and the top-three bonus. */
  found?: number;
  bonus?: number;
};

export type SoloChoice = { action: Action; target: string | null; pick: number };

/**
 * Scores one question for every player. `runs` are the right answers in a row before this question
 * (updated in place: the third right answer is doubled and starts the count again).
 */
export function soloScores(
  points: number,
  variant: SoloVariant,
  choices: Record<string, SoloChoice>,
  correctIndex: number,
  runs: Record<string, number>,
): Record<string, SoloRow> {
  const P = points;
  const ids = Object.keys(choices);
  const answered = (id: string | null) => id !== null && choices[id]?.action === 'answer';
  const right = (id: string) => choices[id]!.pick === correctIndex;
  const by: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const id of ids) {
    const c = choices[id]!;
    if (c.action !== 'answer' && c.target && answered(c.target)) by[c.target]!.push(id);
  }
  const rows: Record<string, SoloRow> = {};
  for (const id of ids) {
    const c = choices[id]!;
    const row = (outcome: SoloOutcome, delta: number): SoloRow => ({ outcome, delta, action: c.action, target: c.target, pick: c.pick, by: by[id]! });
    if (c.action === 'answer') {
      const ok = right(id);
      // The streak counts the answer itself, even when someone took the points.
      if (c.pick < 0 || !ok) runs[id] = 0;
      else runs[id] = (runs[id] ?? 0) + 1;
      const doubled = ok && (runs[id] ?? 0) >= STREAK_FOR_DOUBLE;
      if (doubled) runs[id] = 0;
      const hitters = by[id]!.map((t) => choices[t]!.action);
      if (variant === 'flip' && hitters.length) rows[id] = row(ok ? 'flipped-right' : 'flipped-wrong', ok ? -P : P);
      else if (hitters.includes('reverse')) rows[id] = row('reversed', 0);
      else if (ok && hitters.includes('steal')) rows[id] = row('robbed', 0);
      else if (c.pick < 0) rows[id] = row('idle', 0);
      else {
        rows[id] = row(ok ? 'answer-right' : 'answer-wrong', ok ? P * (doubled ? 2 : 1) : 0);
        if (doubled) rows[id]!.streak = true;
      }
      continue;
    }
    // Swapped, flipped or reversed: it only counts when their player answered.
    if (!answered(c.target)) {
      rows[id] = row('void', 0);
      continue;
    }
    const theirsRight = right(c.target!);
    if (c.action === 'reverse') rows[id] = row(theirsRight ? 'reverse-lose' : 'reverse-win', theirsRight ? -P : P);
    else if (variant === 'flip') rows[id] = row('flip', 0);
    else rows[id] = row(theirsRight ? 'swap-win' : 'swap-lose', theirsRight ? P * 2 : -P);
  }
  return rows;
}

/** «عدّها» alone: a point per right answer, and +5 / +3 / +2 for the three who found the most (ties: who got there first). */
export function soloListScores(found: Record<string, { count: number; at: number }>): Record<string, { found: number; bonus: number; delta: number }> {
  const order = Object.entries(found)
    .filter(([, f]) => f.count > 0)
    .sort((a, b) => b[1].count - a[1].count || a[1].at - b[1].at)
    .map(([id]) => id);
  const out: Record<string, { found: number; bonus: number; delta: number }> = {};
  for (const [id, f] of Object.entries(found)) {
    const place = order.indexOf(id);
    const bonus = place >= 0 && place < LIST_BONUS.length ? LIST_BONUS[place]! : 0;
    out[id] = { found: f.count, bonus, delta: f.count + bonus };
  }
  return out;
}

export type SoloPlayerView = { id: string; name: string; score: number; connected: boolean; host: boolean; streak: number };

/** Everything one device needs to render a solo room. Other players' choices stay hidden until the result. */
export type SoloView = {
  solo: true;
  code: string;
  mode: RoomMode;
  variant: SoloVariant;
  status: RoomStatus;
  /** Your player id, or 'tv'. */
  you: string;
  /** May start the game, remove players and move to the next question. */
  host: boolean;
  players: SoloPlayerView[];
  tvConnected: boolean;
  categories: BoardCategory[];
  used: string[];
  /** The player who picks the next question (or category). */
  turn: string | null;
  phase: GamePhase;
  question: QuestionView | null;
  actionSeconds: number;
  answerSeconds: number;
  remainingMs: number | null;
  /** Players who locked their choice in this step (never which one, until the result). */
  done: string[];
  myAction: Action | null;
  myTarget: string | null;
  myAnswer: number | null;
  result: { correctIndex: number; revealUrl: string | null; rows: Record<string, SoloRow> } | null;
  list: {
    round: number;
    totalRounds: number;
    categories: { id: string; name: string; icon: string }[];
    question: { text: string; letter?: string; category: string } | null;
    /** Right answers so far per player. */
    found: Record<string, number>;
    mine: string[];
    result: { answers: string[]; found: Record<string, number[]> } | null;
  } | null;
};
