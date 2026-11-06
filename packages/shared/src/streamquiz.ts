// «جاوب أو بادل» on a Kick stream: the streamer and the chat play one question at a time, each with their own score.
// Pure logic shared by the stream page and its tests; the page feeds it chat messages, button clicks and the clock.
import { MIN_SCORE } from './game';
import { computeScores } from './rules';
import { JOIN_WORDS, normalize } from './puzzle';

export const STREAM_ANSWER_MS = 30_000;
export const STREAM_CHOOSE_MS = 30_000;
const MAX_SEEN = 300;

/** A dealt question; `correctIndex` stays on the streamer's page and never goes into chat. */
export type StreamQuestion = { text: string; options: string[]; correctIndex: number; points: number; imageUrl: string | null; categoryName?: string };
export type StreamPhase = 'lobby' | 'choose' | 'partner' | 'answer' | 'result' | 'over';
export type StreamChoice = 'answer' | 'swap';
/** `null` holder = the streamer. */
export type StreamResult = { holder: string | null; choice: StreamChoice; answerer: string | null; picked: number | null; correct: boolean; deltas: Record<string, number> };

export type StreamState = {
  /** The streamer's name (lowercase), also the key of their score. */
  streamer: string;
  names: Record<string, string>;
  scores: Record<string, number>;
  /** Everyone who joined with «دخول»: they take turns. */
  joined: string[];
  /** Everyone who wrote anything lately, newest last: the streamer picks a swap partner from here. */
  seen: string[];
  phase: StreamPhase;
  round: number;
  totalRounds: number;
  question: StreamQuestion | null;
  holder: string | null;
  choice: StreamChoice | null;
  answerer: string | null;
  deadline: number | null;
  /** Next chat player to get a turn (index into `joined`). */
  cursor: number;
  result: StreamResult | null;
};

export function newStream(streamer: string, totalRounds = 10): StreamState {
  const key = streamer.toLowerCase();
  return {
    streamer: key, names: { [key]: streamer }, scores: { [key]: 0 }, joined: [], seen: [], phase: 'lobby', round: 0, totalRounds,
    question: null, holder: null, choice: null, answerer: null, deadline: null, cursor: 0, result: null,
  };
}

export const displayName = (s: StreamState, key: string | null) => (key === null ? s.names[s.streamer]! : (s.names[key] ?? key));
const clone = (s: StreamState): StreamState => ({ ...s, names: { ...s.names }, scores: { ...s.scores }, joined: [...s.joined], seen: [...s.seen] });

/** Streamer turns and chat turns alternate; with nobody joined it is always the streamer's turn. */
function nextHolder(s: StreamState): string | null {
  if (s.round % 2 === 1 && s.joined.length > 0) return s.joined[s.cursor % s.joined.length]!;
  return null;
}

/** Deal the next question: the question stays hidden until the holder has chosen. */
export function deal(state: StreamState, question: StreamQuestion, now: number): StreamState {
  if (state.phase === 'over') return state;
  const s = clone(state);
  s.round += 1;
  s.holder = nextHolder({ ...s, round: s.round - 1 });
  if (s.holder !== null) s.cursor += 1;
  s.question = question;
  s.choice = null;
  s.answerer = null;
  s.result = null;
  s.phase = 'choose';
  s.deadline = s.holder === null ? null : now + STREAM_CHOOSE_MS;
  return s;
}

function toAnswerPhase(s: StreamState, choice: StreamChoice, partner: string | null, now: number) {
  s.choice = choice;
  // answer: the holder answers; swap: the other side does.
  s.answerer = choice === 'answer' ? s.holder : partner;
  s.phase = 'answer';
  s.deadline = now + STREAM_ANSWER_MS;
}

function resolve(state: StreamState, picked: number | null): StreamState {
  const s = clone(state);
  const q = s.question!;
  const correct = picked === q.correctIndex;
  const deltas: Record<string, number> = {};
  const holderKey = s.holder ?? s.streamer;
  if (s.choice === 'swap') {
    const [d] = computeScores(q.points, ['steal', 'answer'], [false, correct], 'swap');
    deltas[holderKey] = d;
  } else {
    deltas[holderKey] = correct ? q.points : 0;
  }
  for (const [k, d] of Object.entries(deltas)) s.scores[k] = Math.max(MIN_SCORE, (s.scores[k] ?? 0) + d);
  s.result = { holder: s.holder, choice: s.choice!, answerer: s.answerer, picked, correct, deltas };
  s.phase = s.round >= s.totalRounds ? 'over' : 'result';
  s.deadline = null;
  return s;
}

const CHOOSE_SWAP = ['1', 'بادل'];
const CHOOSE_ANSWER = ['2', 'جاوب'];

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

/** One chat message: joins, tracks who is around, and carries the chat side of the turn. */
export function chatMessage(state: StreamState, user: string, text: string, now: number): StreamState {
  const key = user.toLowerCase();
  let s = state;
  if (key !== s.streamer || s.names[key] === undefined) {
    s = clone(s);
    s.names[key] ??= user;
    s.seen = [...s.seen.filter((k) => k !== key), key].slice(-MAX_SEEN);
  }
  const t = normalize(text).toLowerCase();
  if ((JOIN_WORDS as readonly string[]).includes(t) && key !== s.streamer && !s.joined.includes(key)) {
    s = clone(s);
    s.joined.push(key);
    s.scores[key] ??= 0;
    return s;
  }
  if (s.phase === 'choose' && s.holder === key) {
    const c = CHOOSE_SWAP.includes(t) ? 'swap' : CHOOSE_ANSWER.includes(t) ? 'answer' : null;
    if (!c) return s;
    s = clone(s);
    // A chat player who swaps hands the question to the streamer.
    toAnswerPhase(s, c, c === 'swap' ? null : s.holder, now);
    return s;
  }
  if (s.phase === 'answer' && s.answerer === key && s.question) {
    const i = parseOption(text, s.question.options);
    if (i !== null) return resolve(s, i);
  }
  return s;
}

export type StreamerAct =
  | { type: 'start' }
  | { type: 'choose'; choice: 'answer' | 'swap' }
  | { type: 'partner'; user: string }
  | { type: 'option'; index: number };

/** The streamer's buttons. */
export function streamerAct(state: StreamState, act: StreamerAct, now: number): StreamState {
  const s = clone(state);
  switch (act.type) {
    case 'start':
      return s.phase === 'lobby' ? s : s;
    case 'choose':
      if (s.phase !== 'choose' || s.holder !== null) return state;
      if (act.choice === 'answer') toAnswerPhase(s, 'answer', null, now);
      else {
        s.choice = 'swap';
        s.phase = 'partner';
        s.deadline = null;
      }
      return s;
    case 'partner': {
      const key = act.user.toLowerCase();
      if (s.phase !== 'partner' || !s.names[key] || key === s.streamer) return state;
      toAnswerPhase(s, 'swap', key, now);
      return s;
    }
    case 'option':
      if (s.phase !== 'answer' || s.answerer !== null || !s.question || act.index < 0 || act.index >= s.question.options.length) return state;
      return resolve(s, act.index);
  }
}

/** Timeouts: a chat holder who doesn't choose answers; whoever doesn't answer in time is wrong. */
export function tick(state: StreamState, now: number): StreamState {
  if (state.deadline === null || now < state.deadline) return state;
  if (state.phase === 'choose') {
    const s = clone(state);
    toAnswerPhase(s, 'answer', s.holder, now);
    return s;
  }
  if (state.phase === 'answer') return resolve(state, null);
  return state;
}

export type StreamRow = { key: string; name: string; score: number; streamer: boolean };
export function standings(s: StreamState): StreamRow[] {
  return Object.keys(s.scores)
    .map((k) => ({ key: k, name: displayName(s, k), score: s.scores[k]!, streamer: k === s.streamer }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
