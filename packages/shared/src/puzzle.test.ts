import { describe, expect, it } from 'vitest';
import { applyChat, cellName, isDone, leaderboard, newPuzzle, parseChat, PUZZLE_COOLDOWN_MS, trayLabels } from './puzzle';

/** Deterministic: labels end up 1..n² in order (piece i has label i+1). */
const ordered = (size: number) => newPuzzle(size, () => 0.999999);
const T = (n: number) => n * PUZZLE_COOLDOWN_MS * 2;

describe('parseChat', () => {
  it('joins on دخول only', () => {
    expect(parseChat('دخول')).toEqual({ type: 'join' });
    expect(parseChat('  دخول! ')).toEqual({ type: 'join' });
    expect(parseChat('ادخل')).toBeNull();
    expect(parseChat('hello')).toBeNull();
  });
  it('reads "piece cell" in several spellings, Arabic digits and letters included', () => {
    expect(parseChat('5 B3')).toEqual({ type: 'place', label: 5, row: 2, col: 1 });
    expect(parseChat('5b3')).toEqual({ type: 'place', label: 5, row: 2, col: 1 });
    expect(parseChat('B3 5')).toEqual({ type: 'place', label: 5, row: 2, col: 1 });
    expect(parseChat('١٢ ج٤')).toEqual({ type: 'place', label: 12, row: 3, col: 2 });
    expect(parseChat('7 ا1')).toEqual({ type: 'place', label: 7, row: 0, col: 0 });
    expect(parseChat('5 Z9')).toBeNull();
  });
});

describe('applyChat', () => {
  it('only joined viewers can place pieces, and joining twice is a no-op', () => {
    let s = ordered(3);
    expect(applyChat(s, 'ali', '1 A1', T(1)).events).toEqual([]);
    const j = applyChat(s, 'Ali', 'دخول', T(1));
    expect(j.events).toEqual([{ type: 'join', user: 'Ali' }]);
    s = j.state;
    expect(applyChat(s, 'ali', 'دخول', T(2)).events).toEqual([{ type: 'already', user: 'ali' }]);
  });

  it('a correct placement scores and locks the piece; a wrong one does not', () => {
    let s = applyChat(ordered(3), 'sara', 'دخول', 0).state;
    // Piece 1 belongs in A1, piece 2 in B1.
    let r = applyChat(s, 'sara', '1 B1', T(1));
    expect(r.events).toEqual([{ type: 'place', user: 'sara', label: 1, cell: 'B1', ok: false }]);
    expect(r.state.placed).toEqual({});
    expect(leaderboard(r.state)[0]).toEqual({ name: 'sara', score: 0 });
    r = applyChat(r.state, 'sara', '1 A1', T(2));
    expect(r.events[0]).toMatchObject({ ok: true, cell: 'A1' });
    expect(r.state.placed).toEqual({ 0: 'sara' });
    expect(trayLabels(r.state)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    // The same piece can't be placed again.
    expect(applyChat(r.state, 'sara', '1 A1', T(3)).events).toEqual([]);
  });

  it('ignores commands sent faster than the cooldown', () => {
    const s = applyChat(ordered(3), 'sara', 'دخول', 0).state;
    const a = applyChat(s, 'sara', '1 A1', 5000);
    expect(a.events).toHaveLength(1);
    expect(applyChat(a.state, 'sara', '2 B1', 5000 + PUZZLE_COOLDOWN_MS - 1).events).toEqual([]);
    expect(applyChat(a.state, 'sara', '2 B1', 5000 + PUZZLE_COOLDOWN_MS).events).toHaveLength(1);
  });

  it('finishes when every piece is placed and names the top scorer', () => {
    let s = ordered(3);
    s = applyChat(s, 'a', 'دخول', 0).state;
    s = applyChat(s, 'b', 'دخول', 0).state;
    let events: ReturnType<typeof applyChat>['events'] = [];
    for (let cell = 0; cell < 9; cell++) {
      const user = cell < 6 ? 'b' : 'a';
      ({ state: s, events } = applyChat(s, user, `${cell + 1} ${cellName(3, cell)}`, T(cell + 1) + (user === 'a' ? 7 : 0)));
    }
    expect(isDone(s)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'done', winner: 'b' });
    expect(applyChat(s, 'a', 'دخول', T(99)).events).toEqual([]);
  });

  it('shuffles the labels with a permutation of 1..n²', () => {
    const s = newPuzzle(4);
    expect([...s.labels].sort((x, y) => x - y)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});
