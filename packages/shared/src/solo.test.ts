import { describe, expect, it } from 'vitest';
import { soloListScores, soloScores, type SoloChoice } from './solo';

const a = (pick: number): SoloChoice => ({ action: 'answer', target: null, pick });
const s = (target: string): SoloChoice => ({ action: 'steal', target, pick: -1 });
const r = (target: string): SoloChoice => ({ action: 'reverse', target, pick: -1 });
const deltas = (rows: Record<string, { delta: number }>) => Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.delta]));

describe('soloScores', () => {
  it('answers: right wins the points, wrong and no answer win nothing', () => {
    expect(deltas(soloScores(200, 'swap', { x: a(0), y: a(1), z: a(-1) }, 0, {}))).toEqual({ x: 200, y: 0, z: 0 });
  });
  it('swap: a right answer is doubled for the swapper and its owner gets 0 («انزرف»)', () => {
    const rows = soloScores(200, 'swap', { x: a(0), y: s('x') }, 0, {});
    expect(deltas(rows)).toEqual({ x: 0, y: 400 });
    expect(rows.x!.outcome).toBe('robbed');
    expect(rows.x!.by).toEqual(['y']);
  });
  it('swap: a wrong answer costs the swapper', () => {
    expect(deltas(soloScores(200, 'swap', { x: a(1), y: s('x') }, 0, {}))).toEqual({ x: 0, y: -200 });
  });
  it('two players who pick each other both get 0', () => {
    const rows = soloScores(300, 'triple', { x: s('y'), y: r('x') }, 0, {});
    expect(deltas(rows)).toEqual({ x: 0, y: 0 });
    expect(rows.x!.outcome).toBe('void');
  });
  it('reverse: the reversed player gets 0; the reverser wins on a wrong answer and loses on a right one', () => {
    expect(deltas(soloScores(100, 'triple', { x: a(1), y: r('x') }, 0, {}))).toEqual({ x: 0, y: 100 });
    expect(deltas(soloScores(100, 'triple', { x: a(0), y: r('x') }, 0, {}))).toEqual({ x: 0, y: -100 });
  });
  it('flip: the flipper scores nothing, the flipped player loses on right and wins on wrong', () => {
    expect(deltas(soloScores(100, 'flip', { x: a(0), y: s('x') }, 0, {}))).toEqual({ x: -100, y: 0 });
    expect(deltas(soloScores(100, 'flip', { x: a(2), y: s('x') }, 0, {}))).toEqual({ x: 100, y: 0 });
  });
  it('the third right answer in a row is doubled', () => {
    const runs = { x: 2 };
    const rows = soloScores(100, 'swap', { x: a(0) }, 0, runs);
    expect(rows.x).toMatchObject({ delta: 200, streak: true });
    expect(runs.x).toBe(0);
  });
});

describe('soloListScores', () => {
  it('a point per answer and +5/+3/+2 for the top three (ties: first there)', () => {
    const out = soloListScores({ a: { count: 3, at: 5 }, b: { count: 3, at: 2 }, c: { count: 1, at: 1 }, d: { count: 1, at: 9 }, e: { count: 0, at: 0 } });
    expect(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.delta]))).toEqual({ a: 6, b: 8, c: 3, d: 1, e: 0 });
  });
});
