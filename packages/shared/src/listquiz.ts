// «عدّها» on the stream: one question («اذكر لاعبين من الدوري الإسباني»), the chat has the answer time (30s by default)
// to type as many right answers as they can. Each right answer, once per player, is a point; at the end the three
// players with the most get a bonus: 5, 3 and 2. Answers come from a long list per question (with spelling variants),
// and the chat's typing is matched loosely: hamza/ta marbuta/ya forms, «ال», spaces and one-letter slips don't matter.
import { normalize } from './puzzle';

/** Bonus for the top three, by number of right answers (ties: whoever got there first). */
export const LIST_BONUS = [5, 3, 2] as const;
export const LIST_ANSWER_MS = 30_000;
/** How many recent finds the broadcast page shows as they come in. */
const FEED = 14;

/** Matching form: no diacritics/punctuation/spaces, one alef/ya/ha, «ال» dropped from each word, Latin lowercased. */
export function listFold(text: string): string {
  return normalize(text)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .map((w) => (w.length > 4 && w.startsWith('ال') ? w.slice(2) : w))
    .join('')
    .replace(/[éèê]/g, 'e')
    .replace(/[áàâ]/g, 'a')
    .replace(/[íì]/g, 'i')
    .replace(/[óòô]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c');
}

/** An answer as stored: «اسم|صيغة ثانية|English». The first form is the one shown. */
export const answerName = (a: string) => a.split('|')[0]!.trim();

export type ListIndex = { exact: Map<string, number>; keys: [string, number][] };

/**
 * Lookup for one question's answers: every written form, plus the last word of a multi-word name («ليونيل ميسي» → «ميسي»)
 * when no other answer shares it.
 */
export function buildListIndex(answers: string[]): ListIndex {
  const exact = new Map<string, number>();
  const clash = new Set<string>();
  answers.forEach((a, i) => {
    for (const form of a.split('|')) {
      const f = listFold(form);
      if (f.length >= 2) exact.set(f, exact.has(f) && exact.get(f) !== i ? exact.get(f)! : i);
    }
  });
  const last = new Map<string, number>();
  answers.forEach((a, i) => {
    for (const form of a.split('|')) {
      const words = normalize(form).split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      const f = listFold(words[words.length - 1]!);
      if (f.length < 3 || exact.has(f)) continue;
      if (last.has(f) && last.get(f) !== i) clash.add(f);
      else last.set(f, i);
    }
  });
  for (const [f, i] of last) if (!clash.has(f)) exact.set(f, i);
  return { exact, keys: [...exact.entries()] };
}

/** Edit distance, stopping early once it is past `max`. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]!);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** Which answers a chat message names: the whole message, or each part split by commas / «،» / new lines. */
export function matchList(index: ListIndex, text: string): number[] {
  const parts = [text, ...text.split(/[,،\n/+]+/)];
  const out = new Set<number>();
  for (const p of parts) {
    const f = listFold(p);
    if (f.length < 2) continue;
    const hit = index.exact.get(f);
    if (hit !== undefined) {
      out.add(hit);
      continue;
    }
    // One slipped letter is fine in a longer word, two in a long one, and a few in a whole saying (أمثال).
    const max = f.length >= 14 ? Math.floor(f.length * 0.15) : f.length >= 9 ? 2 : f.length >= 5 ? 1 : 0;
    if (!max) continue;
    for (const [k, i] of index.keys) if (k.length >= 4 && within(f, k, max)) { out.add(i); break; }
  }
  return [...out];
}

/** Live state of a list round. */
export type ListRound = {
  /** Answer indexes each player found, in order. */
  found: Record<string, number[]>;
  /** When each player last found one (ties at the end go to whoever got there first). */
  at: Record<string, number>;
  /** The latest finds, newest last, for the broadcast page. */
  feed: { k: string; text: string }[];
  /** Answers the streamer accepted on top of the list (index = list length + position here). */
  extra?: string[];
  /** What the chat typed that isn't on the list, by matching form — the streamer can accept it. */
  unknown?: Record<string, { text: string; by: string[]; at: Record<string, number> }>;
  /** Scores before this round's points, so accepting an answer after the time can recount. */
  before?: Record<string, number>;
};

export const newListRound = (): ListRound => ({ found: {}, at: {}, feed: [] });

/** How many not-on-the-list answers are kept for the streamer to look at. */
const UNKNOWN_MAX = 120;

/** A player's message during the answer time: the new right answers it names. */
export function listAnswer(round: ListRound, index: ListIndex, answers: string[], key: string, text: string, now: number): ListRound | null {
  const got = round.found[key] ?? [];
  const extra = round.extra ?? [];
  const extraIx = extra.length ? buildListIndex(extra) : null;
  const parts = text.split(/[,،\n/+]+/).map((p) => p.trim()).filter(Boolean);
  const fresh: number[] = [];
  const unknown = { ...(round.unknown ?? {}) };
  let changed = false;
  for (const part of parts.length > 1 ? parts : [text]) {
    const hits = [...matchList(index, part), ...(extraIx ? matchList(extraIx, part).map((j) => answers.length + j) : [])];
    if (hits.length) {
      for (const i of hits) if (!got.includes(i) && !fresh.includes(i)) fresh.push(i);
      continue;
    }
    // Not on the list: keep it for the streamer, who can accept it (a point for everyone who typed it).
    const f = listFold(part);
    if (f.length < 2 || f.length > 40 || /^\d+$/.test(f)) continue;
    const u = unknown[f];
    if (u?.by.includes(key)) continue;
    if (!u && Object.keys(unknown).length >= UNKNOWN_MAX) continue;
    unknown[f] = { text: u?.text ?? part.slice(0, 40), by: [...(u?.by ?? []), key], at: { ...(u?.at ?? {}), [key]: now } };
    changed = true;
  }
  if (!fresh.length && !changed) return null;
  const name = (i: number) => answerName(i < answers.length ? answers[i]! : extra[i - answers.length]!);
  return {
    ...round,
    unknown,
    found: fresh.length ? { ...round.found, [key]: [...got, ...fresh] } : round.found,
    at: fresh.length ? { ...round.at, [key]: now } : round.at,
    feed: fresh.length ? [...round.feed, ...fresh.map((i) => ({ k: key, text: name(i) }))].slice(-FEED) : round.feed,
  };
}

/** The streamer accepts a not-on-the-list answer: it joins the list and everyone who typed it gets the point. */
export function acceptUnknown(round: ListRound, answersLength: number, foldKey: string): ListRound | null {
  const u = round.unknown?.[foldKey];
  if (!u) return null;
  const extra = [...(round.extra ?? []), u.text];
  const idx = answersLength + extra.length - 1;
  const found = { ...round.found };
  const at = { ...round.at };
  for (const k of u.by) {
    if ((found[k] ?? []).includes(idx)) continue;
    found[k] = [...(found[k] ?? []), idx];
    at[k] = Math.max(at[k] ?? 0, u.at[k] ?? 0);
  }
  const unknown = { ...round.unknown };
  delete unknown[foldKey];
  return { ...round, extra, unknown, found, at, feed: [...round.feed, ...u.by.map((k) => ({ k, text: u.text }))].slice(-FEED) };
}

/** The streamer drops a not-on-the-list answer (wrong, or a joke). */
export function rejectUnknown(round: ListRound, foldKey: string): ListRound {
  const unknown = { ...(round.unknown ?? {}) };
  delete unknown[foldKey];
  return { ...round, unknown };
}

/** Final order: most answers first, then whoever reached that count first. */
export function listRanking(round: ListRound): string[] {
  return Object.keys(round.found)
    .filter((k) => round.found[k]!.length > 0)
    .sort((a, b) => round.found[b]!.length - round.found[a]!.length || (round.at[a] ?? 0) - (round.at[b] ?? 0));
}
