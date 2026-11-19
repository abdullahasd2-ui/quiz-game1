import { describe, expect, it } from 'vitest';
import { DUEL_DEFAULTS, castleDamage, duelCaptain, teamSize, duelChat, duelDeal, duelFinish, duelPublicView, duelTick, duelTop, fazaGoal, newDuel, type DuelSettings, type DuelState, type DuelTeam } from './duel';

const Q = { text: 'ما هي عاصمة الإمارات؟', options: ['أبوظبي', 'دبي', 'الشارقة', 'العين'], correctIndex: 0, points: 300 };
const start = (mode: DuelSettings['mode'], extra: Partial<DuelSettings> = {}) => newDuel({ a: 'falcon', b: 'tiger' }, { ...DUEL_DEFAULTS, mode, ...extra }, 's1');
const join = (s: DuelState, team: DuelTeam, ...users: string[]) => users.reduce((x, u) => duelChat(x, team, u, 'دخول', 0), s);

describe('duel', () => {
  it('joins each chat to its own team, once', () => {
    let s = join(start('castle'), 'a', 'fahad', 'sara');
    s = join(s, 'b', 'fahad');
    s = duelChat(s, 'a', 'Fahad', 'دخول', 0);
    expect(Object.keys(s.players).sort()).toEqual(['a:fahad', 'a:sara', 'b:fahad']);
  });

  it('counts only the first answer, by number or by text', () => {
    let s = join(start('castle'), 'a', 'fahad', 'sara');
    s = join(s, 'b', 'reem');
    s = duelDeal(s, Q, 1000);
    s = duelChat(s, 'a', 'fahad', '2', 1100);
    s = duelChat(s, 'a', 'fahad', '1', 1200);
    s = duelChat(s, 'a', 'sara', 'ابوظبي', 1300);
    expect(s.round!.answers['a:fahad']!.pick).toBe(1);
    expect(s.round!.answers['a:sara']!.pick).toBe(0);
    expect(s.round!.live.a).toBe(1);
  });

  it('castle: the share of right answers hits the other castle; the first to fall loses', () => {
    expect(castleDamage(100, 300)).toBe(30);
    expect(castleDamage(50, 500)).toBe(25);
    let s = join(start('castle', { castleHp: 60 }), 'a', 'x1', 'x2');
    s = join(s, 'b', 'y1', 'y2');
    for (let i = 0; i < 2; i++) {
      s = duelDeal(s, Q, i * 100_000);
      s = duelChat(s, 'a', 'x1', '1', i * 100_000 + 10);
      s = duelChat(s, 'a', 'x2', '1', i * 100_000 + 20);
      s = duelChat(s, 'b', 'y1', '1', i * 100_000 + 30);
      s = duelChat(s, 'b', 'y2', '2', i * 100_000 + 40);
    }
    // a: 100% → 30 per round on b; b: 50% → 15 per round on a
    expect(s.hp).toEqual({ a: 30, b: 0 });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('a');
  });

  it('faza: the first team to reach the goal takes the round at once', () => {
    expect(fazaGoal(10, 30)).toBe(3);
    expect(fazaGoal(1, 30)).toBe(1);
    let s = join(start('faza', { fazaWins: 2, fazaGoalPct: 50 }), 'a', 'x1', 'x2', 'x3', 'x4');
    s = join(s, 'b', 'y1', 'y2');
    s = duelDeal(s, Q, 0);
    expect(s.round!.goal).toEqual({ a: 2, b: 1 });
    s = duelChat(s, 'a', 'x1', '1', 10);
    expect(s.phase).toBe('question');
    s = duelChat(s, 'b', 'y1', '1', 20);
    expect(s.phase).toBe('result');
    expect(s.round!.result!.winner).toBe('b');
    expect(s.wins).toEqual({ a: 0, b: 1 });
  });

  it('faza: when time runs out, the higher share takes it', () => {
    let s = join(start('faza', { fazaGoalPct: 100 }), 'a', 'x1', 'x2');
    s = join(s, 'b', 'y1', 'y2');
    s = duelDeal(s, Q, 0);
    s = duelChat(s, 'a', 'x1', '1', 10);
    s = duelTick(s, 30_000);
    expect(s.round!.result!.winner).toBe('a');
  });

  it('chain: turns alternate, the chain multiplies the points and a wrong answer breaks it', () => {
    let s = join(start('chain', { chainRounds: 6 }), 'a', 'x1');
    s = join(s, 'b', 'y1');
    const play = (team: DuelTeam, user: string, ans: string, t: number) => {
      s = duelDeal(s, Q, t);
      expect(s.round!.turn).toBe(team);
      s = duelChat(s, team === 'a' ? 'b' : 'a', team === 'a' ? 'y1' : 'x1', '1', t + 5); // the other chat can't answer
      s = duelChat(s, team, user, ans, t + 10);
    };
    play('a', 'x1', '1', 0); // a: ×1 = 300
    play('b', 'y1', '2', 1e5); // b wrong
    play('a', 'x1', '1', 2e5); // a: ×2 = 600
    play('b', 'y1', '1', 3e5); // b: ×1 = 300
    play('a', 'x1', '3', 4e5); // a breaks
    expect(s.round!.result!.broke).toBe(true);
    play('b', 'y1', '1', 5e5); // b: ×2 = 600
    expect(s.points).toEqual({ a: 900, b: 900 });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('draw');
  });

  it('keeps the players\' points and lists each team\'s best', () => {
    let s = join(start('castle'), 'a', 'x1', 'x2');
    s = join(s, 'b', 'y1');
    s = duelDeal(s, Q, 0);
    s = duelChat(s, 'a', 'x2', '1', 10);
    s = duelChat(s, 'a', 'x1', '2', 20);
    s = duelChat(s, 'b', 'y1', '1', 30);
    expect(duelTop(s, 'a').map((p) => p.name)).toEqual(['x2']);
    expect(s.round!.result!.star).toEqual({ a: 'x2', b: 'y1' });
  });

  it('hides the right answer and picks from the broadcast during the question', () => {
    let s = join(start('castle'), 'a', 'x1');
    s = join(s, 'b', 'y1');
    s = duelDeal(s, Q, 0);
    s = duelChat(s, 'a', 'x1', '2', 10);
    const v = duelPublicView(s);
    expect(v.round!.question.correctIndex).toBe(-1);
    expect(v.round!.answers['a:x1']!.pick).toBe(-1);
    expect(duelFinish(s).phase).toBe('over');
  });
});

describe('«بث واحد»: one channel, two teams', () => {
  const start = () => newDuel({ a: 'host', b: '' }, DUEL_DEFAULTS, 's1', false, true);
  it('«أزرق» and «أحمر» pick a team; «دخول» fills the smaller one; the team can change in the lobby', () => {
    let s = start();
    s = duelChat(s, 'a', 'fahad', 'أزرق', 0);
    s = duelChat(s, 'a', 'reem', 'احمر', 0);
    s = duelChat(s, 'a', 'saad', 'دخول', 0);
    expect(teamSize(s, 'a')).toBe(2);
    expect(teamSize(s, 'b')).toBe(1);
    s = duelChat(s, 'a', 'saad', 'أحمر', 0);
    expect(teamSize(s, 'a')).toBe(1);
    expect(teamSize(s, 'b')).toBe(2);
  });
  it('the streamer picks the red captain, who names the red team and stays red', () => {
    let s = duelChat(start(), 'a', 'Nawaf', 'أزرق', 0);
    s = duelCaptain(s, 'Nawaf');
    expect(s.captain).toBe('Nawaf');
    expect(s.channels.b).toBe('Nawaf');
    expect(s.players['b:nawaf']?.team).toBe('b');
    expect(duelChat(s, 'a', 'Nawaf', 'أزرق', 0).players['b:nawaf']).toBeDefined();
  });
  it('answers count for the team the viewer picked', () => {
    let s = duelChat(start(), 'a', 'reem', 'أحمر', 0);
    s = duelChat(s, 'a', 'fahad', 'أزرق', 0);
    s = duelDeal(s, { text: 'q', options: ['x', 'y', 'z', 'w'], correctIndex: 1, points: 100 }, 0);
    s = duelChat(s, 'a', 'reem', '2', 10);
    expect(s.round?.live.b).toBe(1);
  });
});
