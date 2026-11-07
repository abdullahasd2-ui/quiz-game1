// «جاوب أو بادل» on a Kick stream. The streamer picks a board cell (category × points); then the streamer and every
// chatter play the same question at once, each with their own score:
//   - chat first chooses «2 جاوب» or «1 بادل» while the question is still hidden,
//   - then the question appears; answerers type 1-4 (or «جاوب» + the answer), the streamer clicks,
//   - a swapper takes the streamer's answer: ×2 points if the streamer is right, minus the points if wrong.
// Pure logic shared by the stream page and its tests; the page feeds it chat messages, clicks and the clock.
import { MIN_SCORE } from './game';
import { JOIN_WORDS, normalize } from './puzzle';

export const STREAM_CHOOSE_MS = 20_000;
export const STREAM_ANSWER_MS = 30_000;
const MAX_SEEN = 400;

/** A dealt question; `correctIndex` stays on the streamer's page and never goes into chat. */
export type StreamQuestion = { text: string; options: string[]; correctIndex: number; points: number; imageUrl: string | null; categoryName?: string };
export type StreamPhase = 'lobby' | 'board' | 'choose' | 'answer' | 'result' | 'over';
export type StreamChoice = 'answer' | 'swap';
export type StreamOutcome = 'answer-right' | 'answer-wrong' | 'swap-win' | 'swap-lose' | 'idle';

export type StreamRound = {
  question: StreamQuestion;
  /** Chosen action per chatter (the streamer always answers). */
  choices: Record<string, StreamChoice>;
  /** Option picked per player; the streamer's key included. */
  picks: Record<string, number>;
};
export type StreamResult = { correctIndex: number; streamerPick: number | null; streamerCorrect: boolean; rows: Record<string, { outcome: StreamOutcome; delta: number; picked: number | null }> };

export type StreamState = {
  /** The streamer's name (lowercase), also the key of their score. */
  streamer: string;
  names: Record<string, string>;
  scores: Record<string, number>;
  /** Who wrote in chat lately; every one of them can play. */
  seen: string[];
  phase: StreamPhase;
  /** Board cells already played, as `${categoryId}:${points}`. */
  used: string[];
  totalCells: number;
  round: StreamRound | null;
  deadline: number | null;
  result: StreamResult | null;
};

export function newStream(streamer: string, totalCells: number): StreamState {
  const key = streamer.toLowerCase();
  return { streamer: key, names: { [key]: streamer }, scores: { [key]: 0 }, seen: [], phase: 'lobby', used: [], totalCells, round: null, deadline: null, result: null };
}

export const displayName = (s: StreamState, key: string) => s.names[key] ?? key;
const clone = (s: StreamState): StreamState => ({
  ...s,
  names: { ...s.names },
  scores: { ...s.scores },
  seen: [...s.seen],
  used: [...s.used],
  round: s.round && { ...s.round, choices: { ...s.round.choices }, picks: { ...s.round.picks } },
});

/** The streamer opens the board (after the lobby), or goes back to it between questions. */
export function toBoard(state: StreamState): StreamState {
  if (state.phase !== 'lobby' && state.phase !== 'result') return state;
  const s = clone(state);
  s.phase = s.used.length >= s.totalCells ? 'over' : 'board';
  s.round = null;
  s.deadline = null;
  return s;
}

/** A board cell was picked and its question drawn: chat now chooses answer or swap, the question still hidden. */
export function deal(state: StreamState, cell: string, question: StreamQuestion, now: number): StreamState {
  if (state.phase !== 'board' || state.used.includes(cell)) return state;
  const s = clone(state);
  s.used.push(cell);
  s.round = { question, choices: {}, picks: {} };
  s.phase = 'choose';
  s.deadline = now + STREAM_CHOOSE_MS;
  s.result = null;
  return s;
}

const SWAP_WORDS = ['1', 'بادل'];
const ANSWER_WORDS = ['2', 'جاوب'];

/** Option index from "3", "جاوب 3", "جاوب برج ايفل" or just the option's text. */
export function parseOption(text: string, options: string[]): number | null {
  let t = normalize(text).toLowerCase();
  t = t.replace(/^جاوب\s*/, '').trim();
  if (/^[1-4]$/.test(t)) {
    const i = Number(t) - 1;
    return i < options.length ? i : null;
  }
  const i = options.findIndex((o) => normalize(o).toLowerCase() === t);
  return i >= 0 ? i : null;
}

export function chatMessage(state: StreamState, user: string, text: string, _now = 0): StreamState {
  const key = user.toLowerCase();
  if (key === state.streamer) return state;
  let s = state;
  if (!s.names[key] || s.seen[s.seen.length - 1] !== key) {
    s = clone(s);
    s.names[key] ??= user;
    s.seen = [...s.seen.filter((k) => k !== key), key].slice(-MAX_SEEN);
  }
  const t = normalize(text).toLowerCase();
  if ((JOIN_WORDS as readonly string[]).includes(t)) return s;
  const r = s.round;
  if (!r) return s;
  if (s.phase === 'choose') {
    const c: StreamChoice | null = SWAP_WORDS.includes(t) ? 'swap' : ANSWER_WORDS.includes(t) ? 'answer' : null;
    if (!c || r.choices[key] === c) return s;
    s = clone(s);
    s.round!.choices[key] = c;
    return s;
  }
  if (s.phase === 'answer' && r.choices[key] !== 'swap' && r.picks[key] === undefined) {
    const i = parseOption(text, r.question.options);
    if (i === null) return s;
    s = clone(s);
    s.round!.picks[key] = i;
    s.round!.choices[key] ??= 'answer';
    return s;
  }
  return s;
}

export type StreamerAct = { type: 'show' } | { type: 'option'; index: number } | { type: 'finish' };

/** The streamer's buttons: show the question early, answer it, end the question early. */
export function streamerAct(state: StreamState, act: StreamerAct, now: number): StreamState {
  const r = state.round;
  if (!r) return state;
  if (act.type === 'show') return state.phase === 'choose' ? startAnswer(state, now) : state;
  if (act.type === 'option') {
    if (state.phase !== 'answer' || r.picks[state.streamer] !== undefined || act.index < 0 || act.index >= r.question.options.length) return state;
    const s = clone(state);
    s.round!.picks[state.streamer] = act.index;
    return s;
  }
  return state.phase === 'answer' ? resolve(state) : state;
}

function startAnswer(state: StreamState, now: number): StreamState {
  const s = clone(state);
  s.phase = 'answer';
  s.deadline = now + STREAM_ANSWER_MS;
  return s;
}

function resolve(state: StreamState): StreamState {
  const s = clone(state);
  const { question: q, choices, picks } = s.round!;
  const sp = picks[s.streamer] ?? null;
  const streamerCorrect = sp === q.correctIndex;
  const rows: StreamResult['rows'] = {};
  const apply = (k: string, outcome: StreamOutcome, delta: number, picked: number | null) => {
    s.scores[k] = Math.max(MIN_SCORE, (s.scores[k] ?? 0) + delta);
    rows[k] = { outcome, delta, picked };
  };
  apply(s.streamer, streamerCorrect ? 'answer-right' : 'answer-wrong', streamerCorrect ? q.points : 0, sp);
  for (const k of new Set([...Object.keys(choices), ...Object.keys(picks)])) {
    if (k === s.streamer) continue;
    if (choices[k] === 'swap') apply(k, streamerCorrect ? 'swap-win' : 'swap-lose', streamerCorrect ? q.points * 2 : -q.points, null);
    else if (picks[k] === undefined) apply(k, 'idle', 0, null);
    else {
      const ok = picks[k] === q.correctIndex;
      apply(k, ok ? 'answer-right' : 'answer-wrong', ok ? q.points : 0, picks[k]!);
    }
  }
  s.result = { correctIndex: q.correctIndex, streamerPick: sp, streamerCorrect, rows };
  s.phase = 'result';
  s.deadline = null;
  return s;
}

/** Timeouts: the choose window ends by itself, and so does the answer window. */
export function tick(state: StreamState, now: number): StreamState {
  if (state.deadline === null || now < state.deadline) return state;
  if (state.phase === 'choose') return startAnswer(state, now);
  if (state.phase === 'answer') return resolve(state);
  return state;
}

export function finish(state: StreamState): StreamState {
  const s = clone(state);
  s.phase = 'over';
  s.deadline = null;
  return s;
}

export type StreamRow = { key: string; name: string; score: number; streamer: boolean; outcome: StreamOutcome | null; delta: number };
/** Standings, best first; after a question each row also says how that player took it. */
export function standings(s: StreamState): StreamRow[] {
  return Object.keys(s.scores)
    .map((k) => ({ key: k, name: displayName(s, k), score: s.scores[k]!, streamer: k === s.streamer, outcome: s.result?.rows[k]?.outcome ?? null, delta: s.result?.rows[k]?.delta ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
