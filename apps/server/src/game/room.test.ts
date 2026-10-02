import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameError, GameRoom, shuffleQuestion, type DealtQuestion } from './room';

const CATS = [1, 2, 3].map((id) => ({ id, name: `c${id}`, icon: '❓' }));
const question = (correctIndex = 2): DealtQuestion => ({
  id: 1,
  type: 'text',
  text: 'q',
  options: ['a', 'b', 'c', 'd'],
  correctIndex,
  imageUrl: null,
  revealUrl: null,
});

function mobileRoom(variant: 'swap' | 'flip' = 'swap') {
  const onChange = vi.fn();
  const room = new GameRoom('ABCDEF', 'mobile', variant, onChange);
  room.seatHost('dev-host', 'النمور');
  room.join('dev-guest', 'الصقور');
  room.start(0, CATS);
  return { room, onChange };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('seats', () => {
  it('rejoining with the same device keeps the seat; a third device is refused', () => {
    const room = new GameRoom('ABCDEF', 'mobile', 'swap');
    room.seatHost('dev-host', 'النمور');
    expect(room.join('dev-guest', 'الصقور')).toBe(1);
    room.setConnected('dev-guest', false);
    expect(room.join('dev-guest')).toBe(1);
    expect(room.view(1).teams[1]).toEqual({ name: 'الصقور', score: 0, connected: true });
    expect(() => room.join('dev-3')).toThrow('الغرفة ممتلئة!');
  });

  it('tv mode: the TV hosts, phones fill teams in order, only the TV starts', () => {
    const room = new GameRoom('ABCDEF', 'tv', 'swap');
    room.seatHost('tv');
    expect(room.join('p1', 'أ')).toBe(0);
    expect(room.join('p2', 'ب')).toBe(1);
    expect(() => room.start(0, CATS)).toThrow('المضيف فقط');
    room.start('tv', CATS);
    expect(room.status).toBe('playing');
  });

  it('a guest leaving the lobby frees the seat; the host leaving closes the room', () => {
    const room = new GameRoom('ABCDEF', 'mobile', 'swap');
    room.seatHost('dev-host');
    room.join('dev-guest');
    expect(room.leave('dev-guest')).toBe(false);
    expect(room.teams[1]).toBeNull();
    expect(room.leave('dev-host')).toBe(true);
  });

  it('cannot join once the game started, but a seated device can come back', () => {
    const { room } = mobileRoom();
    expect(() => room.join('dev-new')).toThrow('اللعبة بدأت');
    room.leave('dev-guest');
    expect(room.teams[1]?.connected).toBe(false);
    expect(room.join('dev-guest')).toBe(1);
  });
});

describe('round flow', () => {
  it('only the team whose turn it is picks, and a cell is used once', () => {
    const { room } = mobileRoom();
    expect(() => room.assertCanPick(1, 1, 100)).toThrow('ليس دورك!');
    expect(() => room.assertCanPick(0, 99, 100)).toThrow(GameError);
    room.assertCanPick(0, 1, 100);
    room.beginRound(1, 100, question());
    expect(room.phase).toBe('action');
    room.act(0, 'answer');
    room.act(1, 'answer');
    room.answer(0, 2);
    room.answer(1, 0);
    room.next(1);
    expect(room.turn).toBe(1);
    expect(() => room.assertCanPick(1, 1, 100)).toThrow('استُخدم');
  });

  it('hides the other team’s choice and the correct answer until the result', () => {
    const { room } = mobileRoom();
    room.beginRound(1, 300, question(2));
    room.act(0, 'steal');
    const guest = room.view(1);
    expect(guest.decided).toEqual([true, false]);
    expect(guest.myAction).toBeNull();
    expect(guest.result).toBeNull();
    expect(JSON.stringify(guest)).not.toContain('correctIndex');
    expect(room.view(0).myAction).toBe('steal');
  });

  it('swap: stealing a correct answer doubles; scores never go below zero', () => {
    const { room } = mobileRoom('swap');
    room.beginRound(1, 200, question(2));
    room.act(0, 'steal');
    room.act(1, 'answer');
    expect(room.phase).toBe('answer');
    room.answer(1, 2);
    const r = room.view(0).result!;
    expect(r.deltas).toEqual([400, 0]);
    expect(r.answers).toEqual([-1, 2]);
    expect(room.teams[0]!.score).toBe(400);

    room.next(0);
    room.beginRound(2, 500, question(2));
    room.act(0, 'answer');
    room.act(1, 'steal');
    room.answer(0, 0); // wrong → thief is penalised
    expect(room.view(1).result!.deltas).toEqual([0, -500]);
    expect(room.teams[1]!.score).toBe(0);
  });

  it('both stealing skips the answer phase and scores nothing', () => {
    const { room } = mobileRoom('flip');
    room.beginRound(1, 100, question());
    room.act(0, 'steal');
    room.act(1, 'steal');
    expect(room.phase).toBe('result');
    expect(room.view(0).result!.deltas).toEqual([0, 0]);
  });

  it('timeouts: undecided teams answer, unanswered teams get nothing', () => {
    const { room, onChange } = mobileRoom();
    room.beginRound(1, 100, question(2));
    room.act(0, 'answer');
    expect(room.view(0).remainingMs).toBe(60_000);
    vi.advanceTimersByTime(60_000);
    expect(room.phase).toBe('answer');
    expect(onChange).toHaveBeenCalledTimes(1);
    room.answer(0, 2);
    vi.advanceTimersByTime(60_000);
    expect(room.phase).toBe('result');
    expect(room.view(0).result).toMatchObject({ actions: ['answer', 'answer'], answers: [2, -1], deltas: [100, 0] });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('finishing the round early cancels the pending timeout', () => {
    const { room, onChange } = mobileRoom();
    room.beginRound(1, 100, question());
    room.act(0, 'steal');
    room.act(1, 'steal');
    vi.advanceTimersByTime(120_000);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ends the game when every cell is used; in tv mode only the TV advances', () => {
    const room = new GameRoom('ABCDEF', 'tv', 'swap');
    room.seatHost('tv');
    room.join('p1');
    room.join('p2');
    room.start('tv', CATS);
    let n = 0;
    for (const c of CATS) {
      for (const pts of [100, 200, 300, 400, 500]) {
        expect(() => room.assertCanPick(room.turn, c.id, pts)).toThrow('ليس دورك!');
        room.assertCanPick('tv', c.id, pts);
        room.beginRound(c.id, pts, question());
        room.act(0, 'steal');
        room.act(1, 'steal');
        if (++n === 1) expect(() => room.next(0)).toThrow('التلفاز فقط');
        room.next('tv');
      }
    }
    expect(room.status).toBe('done');
  });
});

describe('shuffleQuestion', () => {
  it('keeps the correct option attached to its text', () => {
    for (let i = 0; i < 20; i++) {
      const q = shuffleQuestion(question(1));
      expect(q.options.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(q.options[q.correctIndex]).toBe('b');
    }
  });
});
