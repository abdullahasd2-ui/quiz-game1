// «جاوب أو بادل» on a Kick stream. Viewers join by typing «دخول»; the streamer picks a board cell (category × points). Then:
//   1. the streamer sees the question first and answers it (picks an option) or swaps with a joined viewer; his choice stays hidden,
//   2. the question goes to the chat: players type «1 جاوب» or «2 بادل» (swap with the streamer),
//   3. answerers see the options and type 1-4 (or «جاوب» + the answer),
//   4. the round ends: the answer is revealed (blurred images too) with the top 10 and how each took the question.
// Scoring is the main game's swap rule: answer right = +points; a swapper takes the streamer's result,
// ×2 points if it is right, minus the points if wrong; whoever's answer is taken scores nothing.
// Pure logic shared by the stream page and its tests; the page feeds it chat messages, clicks and the clock.
import { MIN_SCORE } from './game';
import { JOIN_WORDS, normalize } from './puzzle';
import type { QuestionType } from './schemas';

export const STREAM_CHOOSE_MS = 20_000;
export const STREAM_ANSWER_MS = 30_000;
/** Answer times the streamer can pick before the game, in seconds. */
export const STREAM_ANSWER_CHOICES = [15, 20, 30, 45, 60] as const;
const MAX_PLAYERS = 400;
/** Right answers in a row for a double (same as the main game). */
const STREAK_DOUBLE = 3;

/** A dealt question; `correctIndex` stays on the streamer's page and never goes into chat. */
export type StreamQuestion = { type?: QuestionType; revealUrl?: string | null; text: string; options: string[]; correctIndex: number; points: number; imageUrl: string | null; categoryName?: string };
export type StreamPhase = 'lobby' | 'board' | 'streamer' | 'choose' | 'answer' | 'result' | 'over';
export type StreamChoice = 'answer' | 'swap';
export type StreamOutcome = 'answer-right' | 'answer-wrong' | 'swap-win' | 'swap-lose' | 'idle' | 'flip' | 'flipped-right' | 'flipped-wrong' | 'hid-safe' | 'hid-found';
/**
 * swap = «جاوب أو بادل» (a swapper takes the streamer's answer: ×2 or minus).
 * flip = «جاوب أو اقلب» (the flipped player's result is turned over: right = minus, wrong = plus; the flipper scores nothing).
 */
export type StreamVariant = 'swap' | 'flip' | 'hide';

/** «خبّي أو اكشف» on the stream: 10 boxes, the key hidden by the streamer, the chat guesses by number. */
export const STREAM_HIDE_BOXES = 10;
export const STREAM_HIDE_POINTS = 300;
/**
 * A hide round, dressed as a question so the rest of the game (deal, hidden answer, picks, timer, result) works unchanged:
 * the options are the box numbers and the streamer's «answer» is the box he hides the key in.
 */
export function hideQuestion(): StreamQuestion {
  return {
    type: 'text',
    text: 'وين المفتاح؟ 🔑',
    options: Array.from({ length: STREAM_HIDE_BOXES }, (_, i) => String(i + 1)),
    correctIndex: -1,
    points: STREAM_HIDE_POINTS,
    imageUrl: null,
    categoryName: 'خبّي أو اكشف',
  };
}

export type StreamRound = {
  question: StreamQuestion;
  /** The streamer's hidden choice: answer himself (`pick`), or swap with `partner`, whose answer counts for him. */
  streamer: { choice: StreamChoice; pick: number | null; partner: string | null } | null;
  /** Chosen action per joined viewer. */
  choices: Record<string, StreamChoice>;
  /** Option picked per viewer. */
  picks: Record<string, number>;
  /** When each viewer answered (for the fastest right answer). */
  pickAt?: Record<string, number>;
};
export type StreamResult = { correctIndex: number; streamerChoice: StreamChoice; streamerPartner: string | null; streamerPick: number | null; streamerCorrect: boolean; rows: Record<string, { outcome: StreamOutcome; delta: number; picked: number | null; /** Third right answer in a row: doubled. */ streak?: boolean }>;
  /** The chatter who answered right first. */
  fastest?: string | null;
};

export type StreamState = {
  /** The streamer's name (lowercase), also the key of their score. */
  streamer: string;
  names: Record<string, string>;
  scores: Record<string, number>;
  /** Everyone who typed «دخول»: the players. */
  joined: string[];
  phase: StreamPhase;
  /** Board cells already played, as `${categoryId}:${points}`. */
  used: string[];
  totalCells: number;
  /** The categories on the board, in order (so the broadcast page can draw it). */
  board?: { id: number; name: string; icon: string }[];
  /** How long the chat has to answer, picked by the streamer before the game. */
  answerMs?: number;
  /** Which game: «جاوب أو بادل» (default) or «جاوب أو اقلب». The special choice is stored as 'swap' in both. */
  variant?: StreamVariant;
  round: StreamRound | null;
  deadline: number | null;
  result: StreamResult | null;
  /** Right answers in a row per player (the streamer included); the third is doubled. */
  streaks?: Record<string, number>;
  /** Last «نقاطي» from the chat, for the broadcast page to show that player's score. */
  scoreAsk?: { key: string; at: number } | null;
};

export function newStream(streamer: string, totalCells: number, answerMs = STREAM_ANSWER_MS): StreamState {
  const key = streamer.toLowerCase();
  return { streamer: key, names: { [key]: streamer }, scores: { [key]: 0 }, joined: [], phase: 'lobby', used: [], totalCells, round: null, deadline: null, result: null, answerMs };
}

export const displayName = (s: StreamState, key: string) => s.names[key] ?? key;
const clone = (s: StreamState): StreamState => ({
  ...s,
  names: { ...s.names },
  scores: { ...s.scores },
  joined: [...s.joined],
  streaks: { ...(s.streaks ?? {}) },
  used: [...s.used],
  round: s.round && { ...s.round, pickAt: { ...(s.round.pickAt ?? {}) }, streamer: s.round.streamer && { ...s.round.streamer }, choices: { ...s.round.choices }, picks: { ...s.round.picks } },
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

/** A board cell was picked and its question drawn: the streamer sees it first. */
export function deal(state: StreamState, cell: string, question: StreamQuestion, now: number): StreamState {
  if (state.phase !== 'board' || state.used.includes(cell)) return state;
  const s = clone(state);
  s.used.push(cell);
  s.round = { question, streamer: null, choices: {}, picks: {} };
  s.phase = 'streamer';
  s.deadline = null;
  s.result = null;
  return s;
}

const ANSWER_WORDS = ['1', 'جاوب'];
const SCORE_WORDS = ['نقاطي', 'نقاطى'];
const SWAP_WORDS = ['2', 'بادل', 'اقلب'];

/** Option index from "3", "جاوب 3", "جاوب برج ايفل" or just the option's text. */
export function parseOption(text: string, options: string[]): number | null {
  let t = normalize(text).toLowerCase();
  t = t.replace(/^جاوب\s*/, '').trim();
  if (/^\d{1,2}$/.test(t)) {
    const i = Number(t) - 1;
    return i >= 0 && i < options.length ? i : null;
  }
  const i = options.findIndex((o) => normalize(o).toLowerCase() === t);
  return i >= 0 ? i : null;
}

export function chatMessage(state: StreamState, user: string, text: string, now = 0): StreamState {
  const key = user.toLowerCase();
  if (key === state.streamer) return state;
  const t = normalize(text).toLowerCase();
  let s = state;
  if ((JOIN_WORDS as readonly string[]).includes(t)) {
    if (s.joined.includes(key) || s.joined.length >= MAX_PLAYERS) return s;
    s = clone(s);
    s.names[key] = user;
    s.joined.push(key);
    s.scores[key] ??= 0;
    return s;
  }
  if (SCORE_WORDS.includes(t) && s.joined.includes(key)) {
    s = clone(s);
    s.scoreAsk = { key, at: now };
    return s;
  }
  const r = s.round;
  if (!r || !s.joined.includes(key)) return s;
  const partner = r.streamer?.partner === key;
  if (s.phase === 'choose') {
    const c: StreamChoice | null = SWAP_WORDS.includes(t) ? 'swap' : ANSWER_WORDS.includes(t) ? 'answer' : null;
    // The streamer's swap partner is answering for him: no swapping out of it.
    if (!c || partner || r.choices[key] === c) return s;
    s = clone(s);
    s.round!.choices[key] = c;
    return s;
  }
  if (s.phase === 'answer' && (r.choices[key] === 'answer' || partner || s.variant === 'hide') && r.picks[key] === undefined) {
    const i = parseOption(text, r.question.options);
    if (i === null) return s;
    s = clone(s);
    s.round!.picks[key] = i;
    s.round!.pickAt![key] = now;
    return s;
  }
  return s;
}

export type StreamerAct =
  | { type: 'answer'; index: number }
  | { type: 'swap'; user: string }
  | { type: 'show' }
  | { type: 'finish' };

/** The streamer's buttons: answer or swap (hidden from the stream), show the options early, end the question early. */
export function streamerAct(state: StreamState, act: StreamerAct, now: number): StreamState {
  const r = state.round;
  if (!r) return state;
  if (act.type === 'answer' || act.type === 'swap') {
    if (state.phase !== 'streamer') return state;
    const s = clone(state);
    if (act.type === 'answer') {
      if (act.index < 0 || act.index >= r.question.options.length) return state;
      s.round!.streamer = { choice: 'answer', pick: act.index, partner: null };
      if (s.variant === 'hide') {
        // The streamer's pick is where the key is; no «1 or 2» step — the chat guesses right away.
        s.round!.question = { ...s.round!.question, correctIndex: act.index };
        return startAnswer(s, now);
      }
    } else {
      if (s.variant === 'hide') return state;
      const k = act.user.toLowerCase();
      if (!s.joined.includes(k)) return state;
      s.round!.streamer = { choice: 'swap', pick: null, partner: k };
      s.round!.choices[k] = 'answer';
    }
    s.phase = 'choose';
    s.deadline = now + STREAM_CHOOSE_MS;
    return s;
  }
  if (act.type === 'show') return state.phase === 'choose' ? startAnswer(state, now) : state;
  return state.phase === 'answer' ? resolve(state) : state;
}

function startAnswer(state: StreamState, now: number): StreamState {
  const s = clone(state);
  s.phase = 'answer';
  s.deadline = now + (s.answerMs ?? STREAM_ANSWER_MS);
  return s;
}

function resolve(state: StreamState): StreamState {
  const s = clone(state);
  const { question: q, choices, picks, streamer } = s.round!;
  const st = streamer ?? { choice: 'answer' as const, pick: null, partner: null };
  // What counts as the streamer's answer: his own pick, or his partner's.
  const sp = st.choice === 'swap' ? (picks[st.partner!] ?? null) : st.pick;
  const streamerCorrect = sp === q.correctIndex;
  const rows: StreamResult['rows'] = {};
  const streaks = s.streaks!;
  const apply = (k: string, outcome: StreamOutcome, base: number, picked: number | null) => {
    // Streak: answering right three times in a row doubles the third; a wrong (or missed) answer breaks it.
    let delta = base;
    let streak = false;
    if (outcome === 'answer-right' && base > 0) {
      const run = (streaks[k] ?? 0) + 1;
      streaks[k] = run >= STREAK_DOUBLE ? 0 : run;
      if (run >= STREAK_DOUBLE && base > 0) {
        delta = base * 2;
        streak = true;
      }
    } else if (outcome === 'answer-wrong' || outcome === 'idle') streaks[k] = 0;
    s.scores[k] = Math.max(MIN_SCORE, (s.scores[k] ?? 0) + delta);
    rows[k] = { outcome, delta, picked, ...(streak ? { streak } : {}) };
  };
  const players = new Set([...Object.keys(choices), ...Object.keys(picks)]);
  if (s.variant === 'hide') {
    // Whoever finds the key scores; if nobody does, the streamer who hid it scores.
    const found = [...players].filter((k) => picks[k] === q.correctIndex);
    for (const k of players) {
      if (picks[k] === undefined) apply(k, 'idle', 0, null);
      else apply(k, picks[k] === q.correctIndex ? 'answer-right' : 'answer-wrong', picks[k] === q.correctIndex ? q.points : 0, picks[k]!);
    }
    apply(s.streamer, found.length ? 'hid-found' : 'hid-safe', found.length ? 0 : q.points, sp);
    return finishResolve(s, rows, st, sp, found.length === 0);
  }
  if (s.variant === 'flip') {
    // «جاوب أو اقلب»: a flipped answer scores the other way round (right = minus, wrong = plus); flippers score nothing.
    const flipped = (k: string, picked: number | null) => {
      if (picked === null) apply(k, 'idle', 0, null);
      else if (picked === q.correctIndex) apply(k, 'flipped-right', -q.points, picked);
      else apply(k, 'flipped-wrong', q.points, picked);
    };
    const chatFlipped = [...players].some((k) => choices[k] === 'swap');
    if (st.choice === 'swap') apply(s.streamer, 'flip', 0, null);
    // The chat flipped the streamer: his own answer is turned over, once, however many flipped.
    else if (chatFlipped && sp !== null) flipped(s.streamer, sp);
    else apply(s.streamer, streamerCorrect ? 'answer-right' : 'answer-wrong', streamerCorrect ? q.points : 0, sp);
    for (const k of players) {
      if (choices[k] === 'swap') apply(k, 'flip', 0, null);
      else if (k === st.partner) flipped(k, picks[k] ?? null);
      else if (picks[k] === undefined) apply(k, 'idle', 0, null);
      else apply(k, picks[k] === q.correctIndex ? 'answer-right' : 'answer-wrong', picks[k] === q.correctIndex ? q.points : 0, picks[k]!);
    }
    return finishResolve(s, rows, st, sp, streamerCorrect);
  }
  if (st.choice === 'swap') apply(s.streamer, streamerCorrect ? 'swap-win' : 'swap-lose', streamerCorrect ? q.points * 2 : -q.points, sp);
  else apply(s.streamer, streamerCorrect ? 'answer-right' : 'answer-wrong', streamerCorrect ? q.points : 0, sp);
  for (const k of players) {
    if (choices[k] === 'swap') apply(k, streamerCorrect ? 'swap-win' : 'swap-lose', streamerCorrect ? q.points * 2 : -q.points, null);
    else if (picks[k] === undefined) apply(k, 'idle', 0, null);
    else {
      const ok = picks[k] === q.correctIndex;
      // The partner's answer was taken by the streamer, so it scores nothing for them.
      apply(k, ok ? 'answer-right' : 'answer-wrong', ok && st.partner !== k ? q.points : 0, picks[k]!);
    }
  }
  return finishResolve(s, rows, st, sp, streamerCorrect);
}

function finishResolve(
  s: StreamState,
  rows: StreamResult['rows'],
  st: { choice: StreamChoice; partner: string | null },
  sp: number | null,
  streamerCorrect: boolean,
): StreamState {
  const { question: q, choices, picks } = s.round!;
  const at = s.round!.pickAt ?? {};
  const fastest =
    Object.keys(picks)
      .filter((k) => picks[k] === q.correctIndex && k !== st.partner && choices[k] !== 'swap')
      .sort((a, b) => (at[a] ?? 0) - (at[b] ?? 0))[0] ?? null;
  s.result = { correctIndex: q.correctIndex, streamerChoice: st.choice, streamerPartner: st.partner, streamerPick: sp, streamerCorrect, rows, fastest };
  s.phase = 'result';
  s.deadline = null;
  return s;
}

/** Words for each stream game, so the pages say «بادل» or «اقلب» as fits. */
export function streamLabels(variant: StreamVariant | undefined) {
  if (variant === 'hide')
    return { title: 'خبّي أو اكشف', verb: 'اكشف', did: 'خبّى', icon: '📦', withStreamer: '', withPlayer: '' };
  return variant === 'flip'
    ? { title: 'جاوب أو اقلب', verb: 'اقلب', did: 'قلب', icon: '🔀', withStreamer: 'اقلب على الستريمر', withPlayer: 'أو اقلب على واحد من المشاركين' }
    : { title: 'جاوب أو بادل', verb: 'بادل', did: 'بادل', icon: '🔄', withStreamer: 'بادل مع الستريمر', withPlayer: 'أو بادل مع واحد من المشاركين' };
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

export type StreamRow = { key: string; name: string; score: number; streamer: boolean; outcome: StreamOutcome | null; delta: number; streak: boolean; run: number };
/** Standings, best first; after a question each row also says how that player took it. */
export function standings(s: StreamState): StreamRow[] {
  return Object.keys(s.scores)
    .map((k) => ({ key: k, name: displayName(s, k), score: s.scores[k]!, streamer: k === s.streamer, outcome: s.result?.rows[k]?.outcome ?? null, delta: s.result?.rows[k]?.delta ?? 0, streak: Boolean(s.result?.rows[k]?.streak), run: s.streaks?.[k] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/**
 * What the broadcast page may show: the same state with the streamer's secret removed until the round ends —
 * his choice, the right answer, and (while the streamer is still deciding) the question itself.
 */
export function publicView(s: StreamState): StreamState {
  const r = s.round;
  if (!r || s.phase === 'result' || s.phase === 'over' || s.phase === 'board' || s.phase === 'lobby') return s;
  const q = r.question;
  const hidden: StreamQuestion =
    s.phase === 'streamer'
      ? { ...q, text: '', options: [], imageUrl: null, revealUrl: null, correctIndex: -1 }
      : s.phase === 'choose'
        ? { ...q, options: [], revealUrl: null, correctIndex: -1 }
        : { ...q, revealUrl: null, correctIndex: -1 };
  // Picks are kept only as a count: nobody's option is shown, so nobody copies it.
  const picks = Object.fromEntries(Object.keys(r.picks).map((k) => [k, 0]));
  return { ...s, result: null, round: { question: hidden, streamer: null, choices: r.choices, picks } };
}

/** Short code that pairs the control page with the broadcast page. */
export const SYNC_CODE_RE = /^[A-Za-z0-9]{6,12}$/;
export type SyncPublish = { code: string; hostKey: string; state: StreamState | null; hostNow: number };
export type SyncPick = { code: string; category: number; points: number };
export type SyncView = { state: StreamState | null; hostNow: number };
export interface SyncClientToServerEvents {
  'sync:publish': (m: SyncPublish, reply: (res: { ok: boolean; error?: string }) => void) => void;
  'sync:watch': (code: string, reply: (res: { ok: boolean; error?: string; /** A control page has used this code. */ hosted?: boolean }) => void) => void;
  /** The broadcast page picked a board cell; the server passes it to the control page that owns the code. */
  'sync:pick': (m: SyncPick, reply: (res: { ok: boolean; error?: string }) => void) => void;
}
export interface SyncServerToClientEvents {
  'sync:view': (v: SyncView) => void;
  'sync:pick': (m: SyncPick) => void;
}
