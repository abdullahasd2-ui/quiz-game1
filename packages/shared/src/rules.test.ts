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
  it('flip: the answering team loses points when correct and gains them when wrong', () => {
    expect(computeScores(100, ['steal', 'answer'], [false, true], 'flip')).toEqual([0, -100]);
    expect(computeScores(100, ['steal', 'answer'], [false, false], 'flip')).toEqual([0, 100]);
    expect(computeScores(100, ['answer', 'steal'], [true, false], 'flip')).toEqual([-100, 0]);
    expect(computeScores(100, ['answer', 'steal'], [false, false], 'flip')).toEqual([100, 0]);
  });

  it('reverse: the reverser loses when the opponent is right and gains when wrong', () => {
    expect(computeScores(200, ['reverse', 'answer'], [false, true], 'triple')).toEqual([-200, 0]);
    expect(computeScores(200, ['reverse', 'answer'], [false, false], 'triple')).toEqual([200, 0]);
    expect(computeScores(200, ['answer', 'reverse'], [false, false], 'triple')).toEqual([0, 200]);
    expect(computeScores(200, ['answer', 'reverse'], [true, false], 'triple')).toEqual([0, -200]);
  });
  it('triple: steal still works as swap; two specials score nothing', () => {
    expect(computeScores(200, ['steal', 'answer'], [false, true], 'triple')).toEqual([400, 0]);
    expect(computeScores(200, ['reverse', 'steal'], [true, true], 'triple')).toEqual([0, 0]);
  });
});
