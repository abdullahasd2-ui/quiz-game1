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
    expect(room.view(1).teams[1]).toMatchObject({ name: 'الصقور', score: 0, connected: true });
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
    expect(room.teams[1]!.score).toBe(-500);
  });

  it('scores can go negative but stop at -1000', () => {
    const { room } = mobileRoom();
    for (let i = 0; i < 3; i++) {
      room.beginRound(2, 500, question(2));
      room.act(0, 'answer');
      room.act(1, 'steal');
      room.answer(0, 0);
      if (i < 2) room.next(0);
    }
    expect(room.teams[1]!.score).toBe(-1000);
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

describe('team members and voting', () => {
  /** Mobile room already playing; team 0 has two members (m1, m2), team 1 has one (g1). */
  function teamsRoom() {
    const { room, onChange } = mobileRoom();
    room.join('m1', undefined, 0, 'سعد');
    room.join('m2', undefined, 0);
    room.join('g1', undefined, 1);
    return { room, onChange };
  }

  it('the first device into a team is its captain, the rest are members, capped at 10', () => {
    const room = new GameRoom('ABCDEF', 'tv', 'swap');
    room.seatHost('tv');
    expect(room.join('c1', 'النمور', 0, 'ليث')).toBe(0);
    expect(room.seatOf('c1')).toBe(0);
    for (let i = 1; i < 10; i++) expect(room.join(`p${i}`, undefined, 0)).toBe(0);
    expect(room.view(0).teams[0]!.members).toHaveLength(10);
    expect(room.view(0).teams[0]!.members[0]).toMatchObject({ name: 'ليث', connected: true, captain: true });
    expect(() => room.join('p10', undefined, 0)).toThrow('الفريق ممتلئ');
    // Joining the other team is independent, and re-joining keeps your role.
    expect(room.join('x1', undefined, 1)).toBe(1);
    expect(room.join('p3')).toBe(0);
    expect(room.viewerOf('p3')).toEqual({ seat: 0, member: 'p3' });
  });

  it('a game can start with one player per team; members may join mid-game but not take a captain seat', () => {
    const { room } = mobileRoom();
    expect(room.join('late', undefined, 1)).toBe(1);
    expect(room.view(1, 'late').role).toBe('member');
    const lobby = new GameRoom('ABCDEF', 'tv', 'swap');
    lobby.seatHost('tv');
    lobby.join('a', undefined, 0);
    lobby.join('b', undefined, 1);
    lobby.start('tv', CATS);
    expect(lobby.status).toBe('playing');
    expect(() => lobby.join('c', undefined, 0)).not.toThrow();
  });

  it('members vote on action and answer; counts are visible to their own team only; the captain still decides', () => {
    const { room } = teamsRoom();
    room.beginRound(1, 100, question(2));
    room.vote('m1', 'steal');
    room.vote('m2', 'answer');
    expect(room.view(0, 'm1').votes).toEqual({ counts: { steal: 1, answer: 1 }, mine: 'steal' });
    expect(room.view(0).votes).toEqual({ counts: { steal: 1, answer: 1 }, mine: null });
    expect(room.view(1).votes).toEqual({ counts: {}, mine: null });
    room.vote('m2', 'steal'); // change of mind
    expect(room.view(0).votes!.counts).toEqual({ steal: 2 });
    expect(room.seatOf('m1')).toBeNull(); // members hold no captain seat, so the socket layer refuses their decisions
    room.act(0, 'answer'); // the captain overrides the vote
    expect(room.view(0).votes).toBeNull();
    expect(() => room.vote('m1', 'steal')).toThrow('قرر رئيس الفريق');
    room.act(1, 'answer');
    expect(room.phase).toBe('answer');
    room.vote('m1', '3');
    expect(room.view(0, 'm1').votes).toEqual({ counts: { 3: 1 }, mine: '3' });
    expect(() => room.vote('m1', '9')).toThrow('خيار غير صالح');
    expect(() => room.vote('tv-or-captain', '1')).toThrow('للأعضاء فقط');
  });

  it('when time runs out the most-voted option is used (earliest vote breaks ties), else the default', () => {
    const { room } = teamsRoom();
    room.beginRound(1, 100, question(2));
    room.vote('m1', 'steal');
    room.vote('m2', 'steal');
    vi.advanceTimersByTime(60_000);
    expect(room.round!.actions).toEqual(['steal', 'answer']);
    expect(room.phase).toBe('answer');

    const second = teamsRoom().room;
    second.beginRound(1, 100, question(2));
    second.act(0, 'answer');
    second.act(1, 'answer');
    second.vote('m1', '1');
    second.vote('m2', '2');
    vi.advanceTimersByTime(60_000);
    expect(second.round!.answers[0]).toBe(1); // tie → m1 voted first
    expect(second.round!.answers[1]).toBe(-1); // no vote, no answer
  });

  it('members vote on the board cell for their team on its turn (mobile mode only)', () => {
    const { room } = teamsRoom();
    room.vote('m1', '1:300');
    expect(room.view(0, 'm1').votes).toEqual({ counts: { '1:300': 1 }, mine: '1:300' });
    expect(() => room.vote('g1', '1:300')).toThrow('ليس دور فريقك');
    expect(() => room.vote('m1', '9:100')).toThrow('غير موجود');
    room.beginRound(1, 300, question());
    expect(() => room.vote('m1', '1:300')).toThrow('خيار غير صالح'); // now an action vote, not a cell
    expect(room.view(0, 'm1').votes).toEqual({ counts: {}, mine: null }); // the cell votes were cleared
  });

  it('a captain who drops mid-game hands the team to a connected member; leaving the lobby promotes one too', () => {
    const { room } = teamsRoom();
    room.setConnected('dev-guest', false);
    expect(room.teams[1]!.deviceId).toBe('g1');
    expect(room.view(1, 'dev-guest').role).toBe('member');
    expect(room.teams[1]!.name).toBe('الصقور'); // team name and score stay with the team
    expect(room.join('dev-guest')).toBe(1); // back as a member

    const lobby = new GameRoom('ABCDEF', 'mobile', 'swap');
    lobby.seatHost('h');
    lobby.join('cap', 'الصقور', 1);
    lobby.join('mem', undefined, 1);
    expect(lobby.leave('cap')).toBe(false);
    expect(lobby.seatOf('mem')).toBe(1);
    expect(lobby.teams[1]!.name).toBe('الصقور');
  });
});

describe('kicking players', () => {
  const idOf = (room: GameRoom, t: 0 | 1, name: string) => room.view(t).teams[t]!.members.find((m) => m.name === name)!.id;

  it('only the host kicks; the removed device is banned; ids never expose device ids', () => {
    const room = new GameRoom('ABCDEF', 'mobile', 'swap');
    room.seatHost('dev-host', 'النمور', 'أنا');
    room.join('cap', 'الصقور', 1, 'ليث');
    room.join('mem', undefined, 0, 'سعد');
    expect(JSON.stringify(room.view(1))).not.toContain('dev-host');
    expect(JSON.stringify(room.view(1))).not.toContain('"mem"');
    expect(room.view(0).canKick).toBe(true);
    expect(room.view(1).canKick).toBe(false);
    expect(room.view(0, 'mem').canKick).toBe(false);
    expect(() => room.kick(1, idOf(room, 0, 'سعد'))).toThrow('المضيف فقط');
    expect(room.kick(0, idOf(room, 0, 'سعد'))).toBe('mem');
    expect(room.memberOf('mem')).toBeNull();
    expect(() => room.join('mem', undefined, 0)).toThrow('طردك مضيف الغرفة');
    expect(() => room.kick(0, 'nope')).toThrow('اللاعب غير موجود');
    expect(() => room.kick(0, room.view(0).teams[0]!.members[0]!.id)).toThrow('تطرد نفسك');
  });

  it('kicking a captain promotes their first member; a lone captain can only be removed in the lobby', () => {
    const room = new GameRoom('ABCDEF', 'mobile', 'swap');
    room.seatHost('dev-host');
    room.join('cap', 'الصقور', 1, 'ليث');
    room.join('mem', undefined, 1, 'سعد');
    expect(room.kick(0, idOf(room, 1, 'ليث'))).toBe('cap');
    expect(room.seatOf('mem')).toBe(1);
    expect(room.teams[1]!.name).toBe('الصقور');
    expect(room.kick(0, room.view(0).teams[1]!.members[0]!.id)).toBe('mem');
    expect(room.teams[1]).toBeNull(); // lobby: the seat is free again

    const started = mobileRoom().room;
    expect(() => started.kick(0, started.view(0).teams[1]!.members[0]!.id)).toThrow('الوحيد أثناء اللعب');
  });

  it('tv mode: the tv kicks any player', () => {
    const room = new GameRoom('ABCDEF', 'tv', 'swap');
    room.seatHost('tv');
    room.join('a', 'أ', 0, 'علي');
    room.join('b', 'ب', 1, 'بدر');
    expect(room.view('tv').canKick).toBe(true);
    expect(room.kick('tv', room.view('tv').teams[0]!.members[0]!.id)).toBe('a');
    expect(room.teams[0]).toBeNull();
  });
});
