export type Variant = 'swap' | 'flip';
export type Action = 'answer' | 'steal';

export const POINTS = [100, 200, 300, 400, 500] as const;
export type Points = (typeof POINTS)[number];

/**
 * Round score deltas for both teams.
 * swap: stealing a correct opponent answer doubles the points, stealing a wrong one is a penalty.
 * flip: stealing flips the opponent's answer (right becomes wrong and vice versa).
 * Both stealing always scores nothing.
 */
export function computeScores(
  pts: number,
  actions: [Action, Action],
  correct: [boolean, boolean],
  variant: Variant,
): [number, number] {
  const [a0, a1] = actions;
  const [c0, c1] = correct;
  if (a0 === 'steal' && a1 === 'steal') return [0, 0];
  if (a0 === 'answer' && a1 === 'answer') return [c0 ? pts : 0, c1 ? pts : 0];

  // Exactly one team stole: `thief` takes from `victim`'s answer.
  const thief = a0 === 'steal' ? 0 : 1;
  const victimCorrect = thief === 0 ? c1 : c0;
  const out: [number, number] = [0, 0];
  if (variant === 'flip') out[thief] = victimCorrect ? 0 : pts;
  else out[thief] = victimCorrect ? pts * 2 : -pts;
  return out;
}
