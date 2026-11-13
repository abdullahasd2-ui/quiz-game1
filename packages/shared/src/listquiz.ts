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
};

export const newListRound = (): ListRound => ({ found: {}, at: {}, feed: [] });

/** A player's message during the answer time: the new right answers it names. */
export function listAnswer(round: ListRound, index: ListIndex, answers: string[], key: string, text: string, now: number): ListRound | null {
  const got = round.found[key] ?? [];
  const fresh = matchList(index, text).filter((i) => !got.includes(i));
  if (!fresh.length) return null;
  return {
    found: { ...round.found, [key]: [...got, ...fresh] },
    at: { ...round.at, [key]: now },
    feed: [...round.feed, ...fresh.map((i) => ({ k: key, text: answerName(answers[i]!) }))].slice(-FEED),
  };
}

/** Final order: most answers first, then whoever reached that count first. */
export function listRanking(round: ListRound): string[] {
  return Object.keys(round.found)
    .filter((k) => round.found[k]!.length > 0)
    .sort((a, b) => round.found[b]!.length - round.found[a]!.length || (round.at[a] ?? 0) - (round.at[b] ?? 0));
}
