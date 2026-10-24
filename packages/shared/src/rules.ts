/** triple: answer / swap / reverse — and only one team per round may use swap or reverse. */
export type Variant = 'swap' | 'flip' | 'triple';
/** `steal` is the swap (or flip) action; `reverse` exists only in the triple variant. */
export type Action = 'answer' | 'steal' | 'reverse';
/** Swap, flip and reverse all act on the opponent's answer instead of answering. */
export const isSpecial = (a: Action | null): a is 'steal' | 'reverse' => a === 'steal' || a === 'reverse';

export const POINTS = [100, 200, 300, 400, 500] as const;
export type Points = (typeof POINTS)[number];

/**
 * Round score deltas for both teams.
 * swap: stealing a correct opponent answer doubles the points, stealing a wrong one is a penalty.
 * flip: the flipper scores nothing; the answering team loses `pts` if correct and gains `pts` if wrong.
 * reverse (triple): the reverser loses `pts` if the opponent answers right and gains `pts` if they answer wrong.
 * Two special actions in one round score nothing (the triple variant never lets that happen).
 */
export function computeScores(
  pts: number,
  actions: [Action, Action],
  correct: [boolean, boolean],
  variant: Variant,
): [number, number] {
  const [a0, a1] = actions;
  const [c0, c1] = correct;
  if (isSpecial(a0) && isSpecial(a1)) return [0, 0];
  if (a0 === 'answer' && a1 === 'answer') return [c0 ? pts : 0, c1 ? pts : 0];

  // Exactly one team stole: `thief` takes from `victim`'s answer.
  const thief = isSpecial(a0) ? 0 : 1;
  const victimCorrect = thief === 0 ? c1 : c0;
  const out: [number, number] = [0, 0];
  if (actions[thief] === 'reverse') out[thief] = victimCorrect ? -pts : pts;
  else if (variant === 'flip') out[1 - thief] = victimCorrect ? -pts : pts;
  else out[thief] = victimCorrect ? pts * 2 : -pts;
  return out;
}
