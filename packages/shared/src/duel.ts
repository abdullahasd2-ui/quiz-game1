// «تحدي القنوات»: two Kick streamers, each channel's chat is a team. Viewers type «دخول» in their own channel's chat
// to join its team, then answer the question by number (1–4) or by typing the answer. Scores are by share: the part
// of a team's players who answered right, so a small channel can beat a big one.
//
// Three modes:
//   castle (القلعة): each castle starts with N life. Both teams answer the same question; a team's share of right answers
//                     hits the other castle (bigger questions hit harder). The first castle to fall loses.
//   faza (الفزعة):    a race. Both teams answer the same question; the first team whose right answers reach the goal (a share
//                     of its players) takes the round. First to N rounds wins.
//   chain (السلسلة):  the teams take turns; a right answer (at least half of the team's voters picked it) grows the team's chain and
//                     multiplies the points (×1, ×2, ×3 … up to ×5); a wrong one breaks it. Most points after N rounds wins.
import { parseOption } from './streamquiz';
import { JOIN_WORDS, normalize } from './puzzle';

export type DuelMode = 'castle' | 'faza' | 'chain';
export type DuelTeam = 'a' | 'b';
export const DUEL_TEAMS: DuelTeam[] = ['a', 'b'];
export const other = (t: DuelTeam): DuelTeam => (t === 'a' ? 'b' : 'a');

export const DUEL_MODES: { id: DuelMode; title: string; emoji: string; short: string }[] = [
  { id: 'castle', title: 'القلعة', emoji: '🏰', short: 'أجوبة شاتك الصح تضرب قلعة الخصم — أول قلعة تطيح تخسر' },
  { id: 'faza', title: 'الفزعة', emoji: '🏁', short: 'سباق: أول شات يوصل للهدف من الأجوبة الصح ياخذ الجولة' },
  { id: 'chain', title: 'السلسلة', emoji: '🔗', short: 'بالدور: كل جواب صح يكبّر سلسلتك ويضاعف النقاط، والغلط يكسرها' },
];

export type DuelSettings = {
  mode: DuelMode;
  answerMs: number;
  /** القلعة: life of each castle. */
  castleHp: number;
  /** الفزعة: rounds to win, and the goal as a share (%) of the team's players. */
  fazaWins: number;
  fazaGoalPct: number;
  /** السلسلة: questions in the game (both teams together). */
  chainRounds: number;
};
export const DUEL_DEFAULTS: DuelSettings = { mode: 'castle', answerMs: 20_000, castleHp: 100, fazaWins: 5, fazaGoalPct: 30, chainRounds: 10 };
export const DUEL_ANSWER_CHOICES = [15, 20, 30, 45] as const;
export const DUEL_HP_CHOICES = [60, 100, 150, 200] as const;
export const DUEL_WIN_CHOICES = [3, 5, 7] as const;
export const DUEL_GOAL_CHOICES = [20, 30, 50] as const;
export const DUEL_ROUND_CHOICES = [6, 10, 14, 20] as const;
/** السلسلة: the multiplier stops growing here. */
export const CHAIN_MAX = 5;
/** Pause on the result before the host can go on (the broadcast animates in it). */
export const DUEL_RESULT_MS = 1200;

export type DuelQuestion = { text: string; options: string[]; correctIndex: number; points: number; categoryName?: string; imageUrl?: string | null; type?: string; revealUrl?: string | null };

export type DuelPlayer = { team: DuelTeam; name: string; score: number };

export type DuelRoundResult = {
  /** Share (0–100) of each team's players who answered right (the chain: of those who voted). */
  pct: Record<DuelTeam, number>;
  right: Record<DuelTeam, number>;
  voters: Record<DuelTeam, number>;
  /** القلعة: damage each team dealt; الفزعة: the round's winner; السلسلة: points gained and if the chain broke. */
  damage?: Record<DuelTeam, number>;
  winner?: DuelTeam | null;
  gained?: number;
  broke?: boolean;
  /** Who of the chat answered right first, per team (the round's star). */
  star: Record<DuelTeam, string | null>;
};

export type DuelRound = {
  question: DuelQuestion;
  startedAt: number;
  endsAt: number;
  /** السلسلة: the team whose turn it is (only its chat answers). */
  turn?: DuelTeam;
  /** Each player's first answer (option index) and when. */
  answers: Record<string, { pick: number; at: number }>;
  /** الفزعة: right answers so far, live. */
  live: Record<DuelTeam, number>;
  /** الفزعة: right answers a team needs this round. */
  goal?: Record<DuelTeam, number>;
  result?: DuelRoundResult;
};

export type DuelState = {
  session: string;
  phase: 'lobby' | 'question' | 'result' | 'over';
  settings: DuelSettings;
  channels: Record<DuelTeam, string>;
  /** Players by key `${team}:${user}`. */
  players: Record<string, DuelPlayer>;
  round: DuelRound | null;
  rounds: number;
  hp: Record<DuelTeam, number>;
  wins: Record<DuelTeam, number>;
  points: Record<DuelTeam, number>;
  chain: Record<DuelTeam, number>;
  /** السلسلة: whose turn is next. */
  turn: DuelTeam;
  winner: DuelTeam | 'draw' | null;
  /** Test mode: no Kick chat, the streamer types the chat lines. */
  test?: boolean;
};

const zero = (): Record<DuelTeam, number> => ({ a: 0, b: 0 });

export function newDuel(channels: Record<DuelTeam, string>, settings: DuelSettings, session: string, test = false): DuelState {
  return {
    session,
    phase: 'lobby',
    settings,
    channels,
    players: {},
    round: null,
    rounds: 0,
    hp: { a: settings.castleHp, b: settings.castleHp },
    wins: zero(),
    points: zero(),
    chain: zero(),
    turn: 'a',
    winner: null,
    test,
  };
}

export const playerKey = (team: DuelTeam, user: string) => `${team}:${user.toLowerCase()}`;
export const teamSize = (s: DuelState, team: DuelTeam) => Object.values(s.players).filter((p) => p.team === team).length;

/** الفزعة: right answers a team needs (a share of its players, at least one). */
export const fazaGoal = (players: number, pct: number) => Math.max(1, Math.ceil((players * pct) / 100));

/** القلعة: the hit of a share (0–100) of right answers on a question worth `points` (100% on a 300 = 30). */
export const castleDamage = (pct: number, points: number) => Math.round((pct / 100) * (points / 10));

/** A chat line from one of the channels: «دخول» joins that channel's team; during a question, the first answer counts. */
export function duelChat(s: DuelState, team: DuelTeam, user: string, text: string, now: number): DuelState {
  const key = playerKey(team, user);
  const t = normalize(text).toLowerCase().trim();
  if ((JOIN_WORDS as readonly string[]).includes(t)) {
    if (s.players[key] || s.phase === 'over') return s;
    return { ...s, players: { ...s.players, [key]: { team, name: user, score: 0 } } };
  }
  const r = s.round;
  if (s.phase !== 'question' || !r || now > r.endsAt) return s;
  const p = s.players[key];
  if (!p || r.answers[key]) return s;
  if (s.settings.mode === 'chain' && r.turn !== team) return s;
  const pick = parseOption(text, r.question.options);
  if (pick === null) return s;
  const right = pick === r.question.correctIndex;
  let next: DuelState = { ...s, round: { ...r, answers: { ...r.answers, [key]: { pick, at: now } }, live: right ? { ...r.live, [team]: r.live[team] + 1 } : r.live } };
  // الفزعة: a team reaching its goal ends the round at once.
  if (s.settings.mode === 'faza' && right && next.round!.goal && next.round!.live[team] >= next.round!.goal[team]) next = endRound(next, now, team);
  // Everyone who can answer did: no need to wait.
  else if (allAnswered(next)) next = endRound(next, now);
  return next;
}

function allAnswered(s: DuelState): boolean {
  const r = s.round!;
  const who = Object.entries(s.players).filter(([, p]) => s.settings.mode !== 'chain' || p.team === r.turn);
  return who.length > 0 && who.every(([k]) => r.answers[k]);
}

/** The host starts the next question. */
export function duelDeal(s: DuelState, question: DuelQuestion, now: number): DuelState {
  if (s.phase === 'over') return s;
  const goal = s.settings.mode === 'faza' ? { a: fazaGoal(teamSize(s, 'a'), s.settings.fazaGoalPct), b: fazaGoal(teamSize(s, 'b'), s.settings.fazaGoalPct) } : undefined;
  return {
    ...s,
    phase: 'question',
    round: { question, startedAt: now, endsAt: now + s.settings.answerMs, turn: s.settings.mode === 'chain' ? s.turn : undefined, answers: {}, live: zero(), goal },
  };
}

/** Time ran out. */
export function duelTick(s: DuelState, now: number): DuelState {
  return s.phase === 'question' && s.round && now >= s.round.endsAt ? endRound(s, now) : s;
}

/** The host ends the question early. */
export const duelStop = (s: DuelState, now: number) => (s.phase === 'question' ? endRound(s, now) : s);

function endRound(s: DuelState, now: number, raceWinner?: DuelTeam): DuelState {
  const r = s.round!;
  const q = r.question;
  const right = zero(), voters = zero();
  const star: Record<DuelTeam, string | null> = { a: null, b: null };
  const firstAt: Record<DuelTeam, number> = { a: Infinity, b: Infinity };
  const players = { ...s.players };
  for (const [k, a] of Object.entries(r.answers)) {
    const p = players[k];
    if (!p) continue;
    voters[p.team]++;
    if (a.pick !== q.correctIndex) continue;
    right[p.team]++;
    players[k] = { ...p, score: p.score + q.points };
    if (a.at < firstAt[p.team]) {
      firstAt[p.team] = a.at;
      star[p.team] = p.name;
    }
  }
  const size = { a: teamSize(s, 'a'), b: teamSize(s, 'b') };
  const share = (t: DuelTeam) => (size[t] ? Math.round((right[t] / size[t]) * 100) : 0);
  const pct = { a: share('a'), b: share('b') };
  const res: DuelRoundResult = { pct, right, voters, star };
  let next: DuelState = { ...s, players, phase: 'result', rounds: s.rounds + 1 };
  const { mode } = s.settings;

  if (mode === 'castle') {
    const damage = { a: castleDamage(pct.a, q.points), b: castleDamage(pct.b, q.points) };
    res.damage = damage;
    next.hp = { a: Math.max(0, s.hp.a - damage.b), b: Math.max(0, s.hp.b - damage.a) };
    if (next.hp.a === 0 || next.hp.b === 0) next = over(next, next.hp.a === next.hp.b ? 'draw' : next.hp.a > next.hp.b ? 'a' : 'b');
  } else if (mode === 'faza') {
    // The race's winner, or when time ran out the higher share (a tie: nobody).
    const w = raceWinner ?? (pct.a === pct.b ? null : pct.a > pct.b ? 'a' : 'b');
    res.winner = w;
    if (w) next.wins = { ...s.wins, [w]: s.wins[w] + 1 };
    if (w && next.wins[w] >= s.settings.fazaWins) next = over(next, w);
  } else {
    const t = r.turn!;
    // Right when at least half of the team's voters picked the right answer.
    const ok = voters[t] > 0 && right[t] * 2 >= voters[t];
    const mult = Math.min(CHAIN_MAX, s.chain[t] + 1);
    res.gained = ok ? q.points * mult : 0;
    res.broke = !ok && s.chain[t] > 0;
    res.pct = { ...pct, [t]: voters[t] ? Math.round((right[t] / voters[t]) * 100) : 0 };
    next.points = { ...s.points, [t]: s.points[t] + res.gained };
    next.chain = { ...s.chain, [t]: ok ? s.chain[t] + 1 : 0 };
    next.turn = other(t);
    if (next.rounds >= s.settings.chainRounds) next = over(next, next.points.a === next.points.b ? 'draw' : next.points.a > next.points.b ? 'a' : 'b');
  }
  next.round = { ...r, endsAt: Math.min(r.endsAt, now), result: res };
  return next;
}

function over(s: DuelState, winner: DuelTeam | 'draw'): DuelState {
  return { ...s, winner, phase: 'over' };
}

/** The host ends the game now (the leader wins). */
export function duelFinish(s: DuelState): DuelState {
  const { mode } = s.settings;
  const v = mode === 'castle' ? s.hp : mode === 'faza' ? s.wins : s.points;
  return { ...s, phase: 'over', winner: v.a === v.b ? 'draw' : v.a > v.b ? 'a' : 'b' };
}

/** A team's best players (most points, then name). */
export function duelTop(s: DuelState, team: DuelTeam, n = 3): DuelPlayer[] {
  return Object.values(s.players)
    .filter((p) => p.team === team && p.score > 0)
    .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name))
    .slice(0, n);
}

/** What the broadcast may see: during the question, no right answer and no one's pick. */
export function duelPublicView(s: DuelState): DuelState {
  if (s.phase !== 'question' || !s.round) return s;
  const { correctIndex: _c, ...q } = s.round.question;
  const answers = Object.fromEntries(Object.keys(s.round.answers).map((k) => [k, { pick: -1, at: 0 }]));
  return { ...s, round: { ...s.round, question: { ...q, correctIndex: -1 }, answers } };
}

export type DuelPublish = { code: string; hostKey: string; state: DuelState | null; hostNow: number };
export type DuelView = { state: DuelState | null; hostNow: number };
export interface DuelClientToServerEvents {
  'duel:watch': (code: string, reply: (r: { ok: boolean; error?: string; hosted?: boolean }) => void) => void;
  'duel:publish': (m: DuelPublish, reply: (r: { ok: boolean; error?: string }) => void) => void;
}
export interface DuelServerToClientEvents {
  'duel:view': (v: DuelView) => void;
}
