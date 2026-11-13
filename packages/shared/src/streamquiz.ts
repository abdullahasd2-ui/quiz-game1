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
import { acceptUnknown, buildListIndex, listAnswer, listRanking, newListRound, rejectUnknown, LIST_BONUS, type ListIndex, type ListRound } from './listquiz';

export const STREAM_CHOOSE_MS = 20_000;
export const STREAM_ANSWER_MS = 30_000;
/** Answer times the streamer can pick before the game, in seconds. */
export const STREAM_ANSWER_CHOICES = [15, 20, 30, 45, 60] as const;
const MAX_PLAYERS = 400;
/** Right answers in a row for a double (same as the main game). */
const STREAK_DOUBLE = 3;

/** A dealt question; `correctIndex` stays on the streamer's page and never goes into chat. */
export type StreamQuestion = {
  /** Team packs: a face per option («مين فينا؟»), the member a question is about, and the dropping-faces timer. */
  faces?: string[];
  about?: { name: string; image: string };
  /** Wrong options that drop out during the answer time, in order (never the right one). */
  eliminate?: number[];
  decay?: { every: number; step: number; min: number };
  /** «عدّها»: every accepted answer («اسم|صيغة|English»); stays on the control page until the round ends. */
  listAnswers?: string[];
  type?: QuestionType; revealUrl?: string | null; text: string; options: string[]; correctIndex: number; points: number; imageUrl: string | null; categoryName?: string };
/** steal: «خبّي أو اكشف» when nobody found the key — the streamer picks a player and takes all their points. */
/** shuffle: «خبّي أو اكشف» — the boxes are being shuffled in front of everyone. */
export type StreamPhase = 'lobby' | 'board' | 'streamer' | 'choose' | 'shuffle' | 'answer' | 'steal' | 'result' | 'over';
/** reverse: only in «جاوب أو بادل أو اعكس». */
export type StreamChoice = 'answer' | 'swap' | 'reverse';
export type StreamOutcome = 'answer-right' | 'answer-wrong' | 'swap-win' | 'swap-lose' | 'idle' | 'flip' | 'flipped-right' | 'flipped-wrong' | 'hid-safe' | 'hid-found' | 'stolen' | 'robbed' | 'reverse-win' | 'reverse-lose' | 'mutual' | 'void' | 'list' | 'reversed';
/**
 * swap = «جاوب أو بادل» (a swapper takes the streamer's answer: ×2 or minus).
 * flip = «جاوب أو اقلب» (the flipped player's result is turned over: right = minus, wrong = plus; the flipper scores nothing).
 */
/** triple = «جاوب أو بادل أو اعكس»: swap rules plus «اعكس» (the reverser scores the other way round from the one he reversed). */
/** list = «عدّها»: name as many as you can in the answer time; a point each, bonus for the top three. */
export type StreamVariant = 'swap' | 'flip' | 'hide' | 'triple' | 'list';

/** «خبّي أو اكشف» on the stream: 10 boxes, the key hidden by the streamer, the chat guesses by number. */
export const STREAM_HIDE_BOXES = 10;
export const STREAM_HIDE_POINTS = 300;
/** Each round's points are drawn at random and set how hard the shuffle is: 100 normal, 200 medium, 300 very fast. */
export const STREAM_HIDE_LEVELS = {
  100: { swaps: 8, ms: 700, label: 'عادي' },
  200: { swaps: 12, ms: 420, label: 'متوسط' },
  300: { swaps: 18, ms: 210, label: 'صعب جداً' },
} as const;
export type HidePoints = keyof typeof STREAM_HIDE_LEVELS;
/** How long the key stays in sight in its box before the shuffle starts. */
export const STREAM_HIDE_SHOW_MS = 1600;
/**
 * The shuffle: boxes start one per slot, then each pair of slots trades boxes in turn. Public (the broadcast page
 * plays it); the slot the key ends in is the answer.
 */
export type HideShuffle = { from: number; swaps: [number, number][]; ms: number };

/** Where the key ends after the swaps (slot index). */
export function shuffleEnd(sh: HideShuffle): number {
  let at = sh.from;
  for (const [a, b] of sh.swaps) at = at === a ? b : at === b ? a : at;
  return at;
}

/** Random swaps; about half of them move the key's box, so following it is the game. */
export function makeShuffle(from: number, points: HidePoints, rnd: () => number = Math.random): HideShuffle {
  const { swaps: n, ms } = STREAM_HIDE_LEVELS[points];
  const swaps: [number, number][] = [];
  let at = from;
  let last = '';
  while (swaps.length < n) {
    const a = rnd() < 0.5 ? at : Math.floor(rnd() * STREAM_HIDE_BOXES);
    let b = Math.floor(rnd() * STREAM_HIDE_BOXES);
    if (b === a) b = (b + 1 + Math.floor(rnd() * (STREAM_HIDE_BOXES - 1))) % STREAM_HIDE_BOXES;
    const key = [a, b].sort().join('-');
    if (key === last) continue;
    last = key;
    swaps.push([a, b]);
    at = at === a ? b : at === b ? a : at;
  }
  return { from, swaps, ms };
}

export const randomHidePoints = (rnd: () => number = Math.random): HidePoints => ([100, 200, 300] as const)[Math.floor(rnd() * 3)]!;
/**
 * A hide round, dressed as a question so the rest of the game (deal, hidden answer, picks, timer, result) works unchanged:
 * the options are the box numbers and the streamer's «answer» is the box he hides the key in.
 */
export function hideQuestion(points: HidePoints = STREAM_HIDE_POINTS): StreamQuestion {
  return {
    type: 'text',
    text: 'وين المفتاح؟ 🔑',
    options: Array.from({ length: STREAM_HIDE_BOXES }, (_, i) => String(i + 1)),
    correctIndex: -1,
    points,
    imageUrl: null,
    categoryName: `خبّي أو اكشف · ${STREAM_HIDE_LEVELS[points].label}`,
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
  /** When the answer time began (control page clock), for the dropping faces and their points. */
  answerAt?: number;
  /** «خبّي أو اكشف»: the shuffle the boxes go through. */
  shuffle?: HideShuffle;
  /** When the shuffle (with the key in sight first) began, by the control page's clock. */
  shuffleAt?: number;
  /** «عدّها»: who found what so far. */
  list?: ListRound;
};
export type StreamResult = { correctIndex: number; streamerChoice: StreamChoice; streamerPartner: string | null; streamerPick: number | null; streamerCorrect: boolean; rows: Record<string, { outcome: StreamOutcome; delta: number; picked: number | null; /** Third right answer in a row: doubled. */ streak?: boolean; /** First to find the key: doubled. */ first?: boolean; /** «عدّها»: right answers and the top-three bonus. */ found?: number; bonus?: number }>;
  /** «خبّي أو اكشف»: whose points the streamer took, and how many. */
  stolen?: { from: string; points: number } | null;
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
  /** Players the streamer kicked out: «دخول» no longer lets them back in. */
  kicked?: string[];
  phase: StreamPhase;
  /** Board cells already played, as `${categoryId}:${points}`. */
  used: string[];
  totalCells: number;
  /** The categories on the board, in order (so the broadcast page can draw it). */
  board?: { id: number; name: string; icon: string }[];
  /** How long the chat has to answer, picked by the streamer before the game. */
  answerMs?: number;
  /** One id per stream session (from «ابدأ البث» to the end), for the server's stats. */
  session?: string;
  /** Started with «تجربة بدون Kick»: kept apart in the stats. */
  test?: boolean;
  /** A team's private pack (the questions stay on the control page; only the name and size here). */
  pack?: { name: string; total: number; logo?: string };
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
  return { streamer: key, names: { [key]: streamer }, scores: { [key]: 0 }, joined: [], phase: 'lobby', used: [], totalCells, round: null, deadline: null, result: null, answerMs, session: Math.random().toString(36).slice(2, 10) + Date.now().toString(36) };
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
  // «عدّها»: no streamer turn and no choosing — the clock starts and the chat names away.
  if (s.variant === 'list') {
    s.round.list = newListRound();
    return startAnswer(s, now);
  }
  return s;
}

const ANSWER_WORDS = ['1', 'جاوب'];
const LEAVE_WORDS = ['خروج', 'خروج!', 'leave'];
const SCORE_WORDS = ['نقاطي', 'نقاطى'];
const SWAP_WORDS = ['2', 'بادل', 'اقلب'];
const REVERSE_WORDS = ['3', 'اعكس'];

/** Option index from "3", "جاوب 3", "جاوب برج ايفل" or just the option's text. */
export function parseOption(text: string, options: string[]): number | null {
  let t = normalize(text).toLowerCase();
  t = t.replace(/^جاوب\s*/, '').trim();
  if (/^\d{1,2}$/.test(t)) {
    const i = Number(t) - 1;
    return i >= 0 && i < options.length ? i : null;
  }
  const f = fold(t);
  if (!f) return null;
  const i = options.findIndex((o) => fold(o) === f);
  return i >= 0 ? i : null;
}

/** Loose form of an answer for matching the chat's typing: no spaces/punctuation, أ/إ/آ=ا, ة=ه, ى=ي, case-free. */
function fold(text: string): string {
  return normalize(text)
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

export function chatMessage(state: StreamState, user: string, text: string, now = 0): StreamState {
  const key = user.toLowerCase();
  if (key === state.streamer) return state;
  const t = normalize(text).toLowerCase();
  let s = state;
  if ((JOIN_WORDS as readonly string[]).includes(t)) {
    if (s.joined.includes(key) || s.kicked?.includes(key) || s.joined.length >= MAX_PLAYERS) return s;
    s = clone(s);
    s.names[key] = user;
    s.joined.push(key);
    s.scores[key] ??= 0;
    return s;
  }
  if (LEAVE_WORDS.includes(t)) return removePlayer(s, key, false);
  if (SCORE_WORDS.includes(t) && s.joined.includes(key)) {
    s = clone(s);
    s.scoreAsk = { key, at: now };
    return s;
  }
  const r = s.round;
  if (!r || !s.joined.includes(key)) return s;
  if (s.variant === 'list') {
    if (s.phase !== 'answer' || !r.list || !r.question.listAnswers) return s;
    const next = listAnswer(r.list, indexOf(r.question.listAnswers), r.question.listAnswers, key, text, now);
    if (!next) return s;
    s = clone(s);
    s.round!.list = next;
    return s;
  }
  const partner = r.streamer?.partner === key;
  if (s.phase === 'choose') {
    const c: StreamChoice | null =
      SWAP_WORDS.includes(t) ? 'swap' : s.variant === 'triple' && REVERSE_WORDS.includes(t) ? 'reverse' : ANSWER_WORDS.includes(t) ? 'answer' : null;
    // The streamer's swap partner is answering for him: no swapping out of it — except in «جاوب أو بادل أو اعكس»,
    // where swapping or reversing back on the streamer leaves them both with nothing.
    // The streamer's partner may pick him back (2/3): like two teams picking each other in the main game, both get zero.
    if (!c || r.choices[key] === c) return s;
    s = clone(s);
    s.round!.choices[key] = c;
    // Everyone has chosen: no need to wait out the clock.
    const rr = s.round!;
    if (s.joined.every((k) => k === rr.streamer?.partner || rr.choices[k] !== undefined)) return startAnswer(s, now);
    return s;
  }
  if (s.phase === 'answer' && (r.choices[key] === 'answer' || s.variant === 'hide') && r.picks[key] === undefined) {
    const i = parseOption(text, r.question.options);
    if (i === null) return s;
    s = clone(s);
    s.round!.picks[key] = i;
    s.round!.pickAt![key] = now;
    // Everyone who can answer has answered: end the question now.
    const rr = s.round!;
    const canAnswer = s.joined.filter((k) => s.variant === 'hide' || rr.choices[k] === 'answer');
    if (canAnswer.every((k) => rr.picks[k] !== undefined)) return resolve(s);
    return s;
  }
  return s;
}

/** The streamer kicks a player out of the game: gone from the players and the scores, and can't rejoin. */
export function kickPlayer(state: StreamState, user: string): StreamState {
  return removePlayer(state, user.toLowerCase(), true);
}

/** A player leaves (or is kicked): out of the players and the scores; only a kick keeps them from rejoining. */
function removePlayer(state: StreamState, k: string, ban: boolean): StreamState {
  if (!state.joined.includes(k)) return state;
  const s = clone(state);
  s.joined = s.joined.filter((x) => x !== k);
  if (ban) s.kicked = [...(s.kicked ?? []), k];
  delete s.scores[k];
  if (s.streaks) delete s.streaks[k];
  if (s.round) {
    delete s.round.choices[k];
    delete s.round.picks[k];
    if (s.round.pickAt) delete s.round.pickAt[k];
  }
  if (s.scoreAsk?.key === k) s.scoreAsk = undefined;
  return s;
}

export type StreamerAct =
  | { type: 'answer'; index: number; /** Tests only: a fixed shuffle. */ shuffle?: HideShuffle }
  | { type: 'swap'; user: string }
  | { type: 'reverse'; user: string }
  | { type: 'show' }
  | { type: 'finish' }
  | { type: 'steal'; user: string };

/** The streamer's buttons: answer or swap (hidden from the stream), show the options early, end the question early. */
export function streamerAct(state: StreamState, act: StreamerAct, now: number): StreamState {
  const r = state.round;
  if (!r) return state;
  if (act.type === 'answer' || act.type === 'swap' || act.type === 'reverse') {
    if (state.phase !== 'streamer') return state;
    const s = clone(state);
    if (act.type === 'answer') {
      if (act.index < 0 || act.index >= r.question.options.length) return state;
      s.round!.streamer = { choice: 'answer', pick: act.index, partner: null };
      if (s.variant === 'hide') {
        // The key goes into the box in front of everyone, then the boxes are shuffled; the answer is where it ends.
        const pts = (s.round!.question.points in STREAM_HIDE_LEVELS ? s.round!.question.points : 300) as HidePoints;
        const sh = act.shuffle ?? makeShuffle(act.index, pts);
        s.round!.shuffle = sh;
        s.round!.shuffleAt = now;
        s.round!.question = { ...s.round!.question, correctIndex: shuffleEnd(sh) };
        s.phase = 'shuffle';
        s.deadline = now + STREAM_HIDE_SHOW_MS + sh.swaps.length * sh.ms + 400;
        return s;
      }
    } else {
      if (s.variant === 'hide' || (act.type === 'reverse' && s.variant !== 'triple')) return state;
      const k = act.user.toLowerCase();
      if (!s.joined.includes(k)) return state;
      s.round!.streamer = { choice: act.type, pick: null, partner: k };
      s.round!.choices[k] = 'answer';
    }
    s.phase = 'choose';
    s.deadline = now + STREAM_CHOOSE_MS;
    return s;
  }
  if (act.type === 'steal') {
    const k = act.user.toLowerCase();
    const take = Math.max(0, state.scores[k] ?? 0);
    if (state.phase !== 'steal' || !state.result || !state.joined.includes(k) || take <= 0) return state;
    const s = clone(state);
    s.scores[k] = 0;
    s.scores[s.streamer] = (s.scores[s.streamer] ?? 0) + take;
    const rows = { ...s.result!.rows };
    const was = rows[k];
    rows[k] = { outcome: 'stolen', delta: (was?.delta ?? 0) - take, picked: was?.picked ?? null };
    const me = rows[s.streamer]!;
    rows[s.streamer] = { ...me, delta: me.delta + take };
    s.result = { ...s.result!, rows, stolen: { from: k, points: take } };
    s.phase = 'result';
    return s;
  }
  if (act.type === 'show') return state.phase === 'choose' ? startAnswer(state, now) : state;
  return state.phase === 'answer' ? resolve(state) : state;
}

function startAnswer(state: StreamState, now: number): StreamState {
  const s = clone(state);
  s.phase = 'answer';
  s.deadline = now + (s.answerMs ?? STREAM_ANSWER_MS);
  s.round!.answerAt = now;
  return s;
}

/** How many wrong options have dropped out by `t` (team «مين فينا؟» questions). */
export function droppedBy(q: StreamQuestion, answerAt: number | undefined, t: number): number {
  if (!q.eliminate?.length || !q.decay || answerAt === undefined) return 0;
  return Math.max(0, Math.min(q.eliminate.length, Math.floor((t - answerAt) / q.decay.every)));
}

/** Points for a right answer given at `t`: fewer the more faces have dropped out. */
export function pointsAt(q: StreamQuestion, answerAt: number | undefined, t: number | undefined): number {
  if (!q.decay || t === undefined) return q.points;
  return Math.max(q.decay.min, q.points - droppedBy(q, answerAt, t) * q.decay.step);
}

/** One lookup per question, built on first use (questions are shared, unchanged, across state copies). */
const listIndexes = new WeakMap<string[], ListIndex>();
function indexOf(answers: string[]): ListIndex {
  let ix = listIndexes.get(answers);
  if (!ix) listIndexes.set(answers, (ix = buildListIndex(answers)));
  return ix;
}

/** «عدّها» ends: a point per right answer, and 5/3/2 more for the top three. */
function resolveList(state: StreamState): StreamState {
  const s = clone(state);
  const list = { ...(s.round!.list ?? newListRound()) };
  // Recounting after the streamer accepted an answer: start again from the scores before this round.
  if (list.before) s.scores = { ...list.before };
  else list.before = { ...s.scores };
  s.round!.list = list;
  const rank = listRanking(list);
  const rows: StreamResult['rows'] = {};
  for (const k of new Set([...s.joined, ...Object.keys(list.found)])) {
    const found = list.found[k]?.length ?? 0;
    const place = rank.indexOf(k);
    const bonus = place >= 0 && place < LIST_BONUS.length ? LIST_BONUS[place]! : 0;
    const delta = found + bonus;
    if (k in s.scores || s.joined.includes(k)) s.scores[k] = (s.scores[k] ?? 0) + delta;
    rows[k] = { outcome: found ? 'list' : 'idle', delta, picked: null, found, bonus };
  }
  s.result = { correctIndex: -1, streamerChoice: 'answer', streamerPartner: null, streamerPick: null, streamerCorrect: false, rows, fastest: rank[0] ?? null };
  s.phase = 'result';
  s.deadline = null;
  return s;
}

/**
 * «عدّها»: the streamer accepts (or drops) an answer the chat typed that isn't on the list.
 * During the time it just counts; after the time the round's points are counted again.
 */
export function judgeUnknown(state: StreamState, foldKey: string, accept: boolean): StreamState {
  const r = state.round;
  if (state.variant !== 'list' || !r?.list || (state.phase !== 'answer' && state.phase !== 'result')) return state;
  const list = accept ? acceptUnknown(r.list, r.question.listAnswers?.length ?? 0, foldKey) : rejectUnknown(r.list, foldKey);
  if (!list) return state;
  const s = clone(state);
  s.round!.list = list;
  return s.phase === 'result' ? resolveList(s) : s;
}

function resolve(state: StreamState): StreamState {
  if (state.variant === 'list') return resolveList(state);
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
    // The first to find it gets double; if nobody does, the streamer scores and then takes one player's points (steal phase).
    const at = s.round!.pickAt ?? {};
    const found = [...players].filter((k) => picks[k] === q.correctIndex).sort((a, b) => (at[a] ?? 0) - (at[b] ?? 0));
    for (const k of players) {
      if (picks[k] === undefined) apply(k, 'idle', 0, null);
      else if (picks[k] !== q.correctIndex) apply(k, 'answer-wrong', 0, picks[k]!);
      else apply(k, 'answer-right', k === found[0] ? q.points * 2 : q.points, picks[k]!);
    }
    if (found[0] && rows[found[0]]) rows[found[0]] = { ...rows[found[0]]!, first: true };
    apply(s.streamer, found.length ? 'hid-found' : 'hid-safe', found.length ? 0 : q.points, sp);
    const done = finishResolve(s, rows, st, sp, found.length === 0);
    // Nobody found it and someone has points to lose: the streamer now picks whose points to take.
    if (!found.length && s.joined.some((k) => (s.scores[k] ?? 0) > 0)) done.phase = 'steal';
    return done;
  }
  if (s.variant === 'flip') {
    // «جاوب أو اقلب»: a flipped answer scores the other way round (right = minus, wrong = plus); flippers score nothing.
    const flipped = (k: string, picked: number | null) => {
      if (picked === null) apply(k, 'idle', 0, null);
      else if (picked === q.correctIndex) apply(k, 'flipped-right', -q.points, picked);
      else apply(k, 'flipped-wrong', q.points, picked);
    };
    const chatFlipped = [...players].some((k) => choices[k] === 'swap');
    // The streamer flipped a player who flipped him back: both get zero, as in the main game.
    if (st.partner && choices[st.partner] === 'swap') {
      apply(s.streamer, 'mutual', 0, null);
      for (const k of players) apply(k, k === st.partner ? 'mutual' : choices[k] === 'swap' ? 'void' : picks[k] === undefined ? 'idle' : picks[k] === q.correctIndex ? 'answer-right' : 'answer-wrong', k !== st.partner && choices[k] !== 'swap' && picks[k] === q.correctIndex ? pointsAt(q, s.round!.answerAt, s.round!.pickAt?.[k]) : 0, picks[k] ?? null);
      return finishResolve(s, rows, st, null, false);
    }
    if (st.choice === 'swap') apply(s.streamer, 'flip', 0, null);
    // The chat flipped the streamer: his own answer is turned over, once, however many flipped.
    else if (chatFlipped && sp !== null) flipped(s.streamer, sp);
    else apply(s.streamer, streamerCorrect ? 'answer-right' : 'answer-wrong', streamerCorrect ? q.points : 0, sp);
    for (const k of players) {
      if (choices[k] === 'swap') apply(k, 'flip', 0, null);
      else if (k === st.partner) flipped(k, picks[k] ?? null);
      else if (picks[k] === undefined) apply(k, 'idle', 0, null);
      else apply(k, picks[k] === q.correctIndex ? 'answer-right' : 'answer-wrong', picks[k] === q.correctIndex ? pointsAt(q, s.round!.answerAt, s.round!.pickAt?.[k]) : 0, picks[k]!);
    }
    return finishResolve(s, rows, st, sp, streamerCorrect);
  }
  if (s.variant === 'triple') {
    // «جاوب أو بادل أو اعكس»: swap as in «جاوب أو بادل»; a reverser scores the other way round from whoever he reversed
    // (right = minus, wrong = plus). The streamer and his partner picking each other (swap/reverse both ways) = zero for both.
    const P = q.points;
    const partner = st.partner;
    const mutual = partner !== null && choices[partner] !== undefined && choices[partner] !== 'answer';
    const pp = partner ? (picks[partner] ?? null) : null;
    // What the chat's swappers/reversers play against: the streamer's answer (his own, or his swap partner's).
    const target = mutual || st.choice === 'reverse' ? null : sp;
    const targetRight = target !== null && target === q.correctIndex;
    if (mutual) apply(s.streamer, 'mutual', 0, null);
    else if (st.choice === 'reverse') {
      if (pp === null) apply(s.streamer, 'idle', 0, null);
      else apply(s.streamer, pp === q.correctIndex ? 'reverse-lose' : 'reverse-win', pp === q.correctIndex ? -P : P, null);
    } else if (st.choice === 'swap') apply(s.streamer, targetRight ? 'swap-win' : 'swap-lose', targetRight ? P * 2 : -P, sp);
    else if (targetRight && [...players].some((k) => choices[k] === 'swap')) apply(s.streamer, 'robbed', 0, sp);
    // Reversed by the chat: like the main game, the reversed side scores nothing for its answer.
    else if ([...players].some((k) => choices[k] === 'reverse')) apply(s.streamer, 'reversed', 0, sp);
    else apply(s.streamer, targetRight ? 'answer-right' : 'answer-wrong', targetRight ? P : 0, sp);
    for (const k of players) {
      if (k === partner && mutual) apply(k, 'mutual', 0, null);
      else if (k === partner && st.choice === 'reverse' && picks[k] !== undefined) apply(k, 'reversed', 0, picks[k]!);
      else if (choices[k] === 'swap' || choices[k] === 'reverse') {
        // Swappers take the streamer's answer (his own or his swap partner's); reversing works only on his own answer.
        if (target === null || (choices[k] === 'reverse' && st.choice !== 'answer')) apply(k, 'void', 0, null);
        else if (choices[k] === 'swap') apply(k, targetRight ? 'swap-win' : 'swap-lose', targetRight ? P * 2 : -P, null);
        else apply(k, targetRight ? 'reverse-lose' : 'reverse-win', targetRight ? -P : P, null);
      } else if (picks[k] === undefined) apply(k, 'idle', 0, null);
      else {
        const ok = picks[k] === q.correctIndex;
        // The streamer took this player's answer (swap): it scores for him, not for them.
        if (ok && k === partner && st.choice === 'swap') apply(k, 'robbed', 0, picks[k]!);
        else apply(k, ok ? 'answer-right' : 'answer-wrong', ok && !(k === partner && st.choice === 'swap') ? pointsAt(q, s.round!.answerAt, s.round!.pickAt?.[k]) : 0, picks[k]!);
      }
    }
    return finishResolve(s, rows, st, sp, st.choice === 'reverse' ? pp === q.correctIndex : targetRight);
  }
  // The streamer swapped with a player who swapped back: both get zero, and there is no answer for the chat to take.
  if (st.partner && choices[st.partner] === 'swap') {
    apply(s.streamer, 'mutual', 0, null);
    for (const k of players) {
      if (k === st.partner) apply(k, 'mutual', 0, null);
      else if (choices[k] === 'swap') apply(k, 'void', 0, null);
      else if (picks[k] === undefined) apply(k, 'idle', 0, null);
      else apply(k, picks[k] === q.correctIndex ? 'answer-right' : 'answer-wrong', picks[k] === q.correctIndex ? pointsAt(q, s.round!.answerAt, s.round!.pickAt?.[k]) : 0, picks[k]!);
    }
    return finishResolve(s, rows, st, null, false);
  }
  if (st.choice === 'swap') apply(s.streamer, streamerCorrect ? 'swap-win' : 'swap-lose', streamerCorrect ? q.points * 2 : -q.points, sp);
  // Someone in the chat swapped onto the streamer's right answer: they take it (×2) and the streamer gets nothing («انزرف»).
  else if (streamerCorrect && [...players].some((k) => choices[k] === 'swap')) apply(s.streamer, 'robbed', 0, sp);
  else apply(s.streamer, streamerCorrect ? 'answer-right' : 'answer-wrong', streamerCorrect ? q.points : 0, sp);
  for (const k of players) {
    if (choices[k] === 'swap') apply(k, streamerCorrect ? 'swap-win' : 'swap-lose', streamerCorrect ? q.points * 2 : -q.points, null);
    else if (picks[k] === undefined) apply(k, 'idle', 0, null);
    else {
      const ok = picks[k] === q.correctIndex;
      // The partner's answer was taken by the streamer, so it scores nothing for them.
      if (ok && st.partner === k) apply(k, 'robbed', 0, picks[k]!);
      else apply(k, ok ? 'answer-right' : 'answer-wrong', ok && st.partner !== k ? pointsAt(q, s.round!.answerAt, s.round!.pickAt?.[k]) : 0, picks[k]!);
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
      .filter((k) => picks[k] === q.correctIndex && k !== st.partner && choices[k] !== 'swap' && choices[k] !== 'reverse')
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
  if (variant === 'list') return { title: 'عدّها', verb: 'عدّ', did: 'عدّ', icon: '⏱️', withStreamer: '', withPlayer: '' };
  if (variant === 'triple')
    return { title: 'جاوب أو بادل أو اعكس', verb: 'بادل/اعكس', did: 'بادل', icon: '↩️', withStreamer: 'بادل مع الستريمر', withPlayer: 'أو بادل أو اعكس على واحد من المشاركين' };
  return variant === 'flip'
    ? { title: 'جاوب أو اقلب', verb: 'اقلب', did: 'قلب', icon: '🔀', withStreamer: 'اقلب على الستريمر', withPlayer: 'أو اقلب على واحد من المشاركين' }
    : { title: 'جاوب أو بادل', verb: 'بادل', did: 'بادل', icon: '🔄', withStreamer: 'بادل مع الستريمر', withPlayer: 'أو بادل مع واحد من المشاركين' };
}

/** Timeouts: the choose window ends by itself, and so does the answer window. */
export function tick(state: StreamState, now: number): StreamState {
  if (state.deadline === null || now < state.deadline) return state;
  if (state.phase === 'choose' || state.phase === 'shuffle') return startAnswer(state, now);
  if (state.phase === 'answer') return resolve(state);
  return state;
}

export function finish(state: StreamState): StreamState {
  const s = clone(state);
  s.phase = 'over';
  s.deadline = null;
  return s;
}

export type StreamRow = { key: string; name: string; score: number; streamer: boolean; outcome: StreamOutcome | null; delta: number; streak: boolean; run: number; first: boolean };
/** Standings, best first; after a question each row also says how that player took it. */
export function standings(s: StreamState): StreamRow[] {
  return Object.keys(s.scores)
    .map((k) => ({ key: k, name: displayName(s, k), score: s.scores[k]!, streamer: k === s.streamer, outcome: s.result?.rows[k]?.outcome ?? null, delta: s.result?.rows[k]?.delta ?? 0, streak: Boolean(s.result?.rows[k]?.streak), run: s.streaks?.[k] ?? 0, first: Boolean(s.result?.rows[k]?.first) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/**
 * What the broadcast page may show: the same state with the streamer's secret removed until the round ends —
 * his choice, the right answer, and (while the streamer is still deciding) the question itself.
 */
export function publicView(s: StreamState): StreamState {
  const r = s.round;
  if (!r || s.phase === 'result' || s.phase === 'steal' || s.phase === 'over' || s.phase === 'board' || s.phase === 'lobby') return s;
  const q = r.question;
  const hidden: StreamQuestion =
    s.phase === 'streamer'
      ? { ...q, text: '', options: [], imageUrl: null, revealUrl: null, correctIndex: -1 }
      : s.phase === 'choose'
        ? { ...q, options: [], revealUrl: null, correctIndex: -1 }
        : { ...q, revealUrl: null, correctIndex: -1, listAnswers: undefined };
  // Picks are kept only as a count: nobody's option is shown, so nobody copies it.
  const picks = Object.fromEntries(Object.keys(r.picks).map((k) => [k, 0]));
  // The shuffle itself is public: the broadcast page plays it (that is the game).
  return { ...s, result: null, round: { question: hidden, streamer: null, choices: r.choices, picks, shuffle: r.shuffle, shuffleAt: r.shuffleAt, answerAt: r.answerAt, list: r.list } };
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
