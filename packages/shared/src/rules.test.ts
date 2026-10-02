import { describe, expect, it } from 'vitest';
import { computeScores } from './rules';

describe('computeScores', () => {
  it('both answer: each scores on their own answer', () => {
    expect(computeScores(300, ['answer', 'answer'], [true, false], 'swap')).toEqual([300, 0]);
  });
  it('both steal: nobody scores', () => {
    expect(computeScores(300, ['steal', 'steal'], [true, true], 'swap')).toEqual([0, 0]);
    expect(computeScores(300, ['steal', 'steal'], [true, true], 'flip')).toEqual([0, 0]);
  });
  it('swap: stealing a correct answer doubles, a wrong one penalizes', () => {
    expect(computeScores(200, ['steal', 'answer'], [false, true], 'swap')).toEqual([400, 0]);
    expect(computeScores(200, ['steal', 'answer'], [true, false], 'swap')).toEqual([-200, 0]);
    expect(computeScores(200, ['answer', 'steal'], [true, false], 'swap')).toEqual([0, 400]);
  });
  it('flip: stealing a wrong answer scores, a correct one scores nothing', () => {
    expect(computeScores(100, ['steal', 'answer'], [false, false], 'flip')).toEqual([100, 0]);
    expect(computeScores(100, ['steal', 'answer'], [false, true], 'flip')).toEqual([0, 0]);
    expect(computeScores(100, ['answer', 'steal'], [false, true], 'flip')).toEqual([0, 100]);
    expect(computeScores(100, ['answer', 'steal'], [true, false], 'flip')).toEqual([0, 0]);
  });
});
