// Private question packs for a stream team: questions about the team members themselves. Two kinds:
//   who  — «مين فينا؟»: the options are the members' faces, wrong faces drop out one by one and the points drop with them;
//   fact — about one member (their photo on top) with four close options.
import type { StreamQuestion } from './streamquiz';

export type PackMember = { id: string; name: string; image: string };
export type PackQuestion =
  | { kind: 'who'; text: string; answer: string }
  | { kind: 'fact'; about: string; text: string; /** The right one first; the order is shuffled when dealt. */ options: string[] };
export type QuestionPack = { code: string; name: string; members: PackMember[]; questions: PackQuestion[] };

/** «مين فينا؟» scoring: starts at `points`, loses `step` each time a wrong face drops out (every `every` ms), never below `min`. */
export const WHO_POINTS = 500;
export const WHO_DECAY = { every: 8000, step: 50, min: 250 };
/** Wrong faces that drop out; the last three stay so the answer is never given away. */
export const WHO_KEEP = 3;
export const FACT_POINTS = 300;

function shuffled<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Who a question is about (for spreading the members evenly through the game). */
export const questionMember = (q: PackQuestion) => (q.kind === 'who' ? q.answer : q.about);

/**
 * The order of play: members take turns (in a random order each lap), each member's questions in random order,
 * so everyone comes up as often and as spread out as their questions allow.
 */
export function packDeck(pack: QuestionPack, rnd: () => number = Math.random): PackQuestion[] {
  const byMember = new Map<string, PackQuestion[]>();
  for (const q of shuffled(pack.questions, rnd)) {
    const k = questionMember(q);
    byMember.set(k, [...(byMember.get(k) ?? []), q]);
  }
  const out: PackQuestion[] = [];
  let last = '';
  while (out.length < pack.questions.length) {
    let lap = shuffled([...byMember.keys()].filter((k) => byMember.get(k)!.length), rnd);
    // Never the same member twice in a row across laps.
    if (lap.length > 1 && lap[0] === last) lap = [...lap.slice(1), lap[0]!];
    for (const k of lap) {
      out.push(byMember.get(k)!.shift()!);
      last = k;
    }
  }
  return out;
}

/** A pack question as a stream question. */
export function packQuestion(pack: QuestionPack, q: PackQuestion, rnd: () => number = Math.random): StreamQuestion {
  if (q.kind === 'who') {
    const members = pack.members;
    const correctIndex = members.findIndex((m) => m.id === q.answer);
    const wrong = shuffled(members.map((_, i) => i).filter((i) => i !== correctIndex), rnd);
    return {
      type: 'text',
      text: q.text,
      options: members.map((m) => m.name),
      faces: members.map((m) => m.image),
      correctIndex,
      points: WHO_POINTS,
      imageUrl: null,
      categoryName: `${pack.name} · مين فينا؟`,
      eliminate: wrong.slice(0, Math.max(0, members.length - WHO_KEEP)),
      decay: WHO_DECAY,
    };
  }
  const about = pack.members.find((m) => m.id === q.about)!;
  const order = shuffled(q.options.map((_, i) => i), rnd);
  return {
    type: 'text',
    text: q.text,
    options: order.map((i) => q.options[i]!),
    correctIndex: order.indexOf(0),
    points: FACT_POINTS,
    imageUrl: null,
    categoryName: `${pack.name} · ${about.name}`,
    about: { name: about.name, image: about.image },
  };
}
