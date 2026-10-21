import {
  ACTION_SECONDS,
  ANSWER_SECONDS,
  canAdvance,
  canPick,
  cellKey,
  MAX_TEAM_SIZE,
  computeScores,
  POINTS,
  type Action,
  type BoardCategory,
  type GamePhase,
  type QuestionType,
  type RoomMode,
  type RoomStatus,
  type RoomView,
  type Seat,
  type TeamIndex,
  type Variant,
} from '@quiz/shared';

/** A rule violation reported back to the player who caused it (message is shown as-is). */
export class GameError extends Error {}

export type DealtQuestion = {
  id: number;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  imageUrl: string | null;
  revealUrl: string | null;
};

/** The captain of a team: decides for it, owns its name and score. */
type Player = { deviceId: string; name: string; nick: string; score: number; connected: boolean };
/** A non-captain team member: can only vote. */
type Member = { deviceId: string; name: string; connected: boolean };

type Round = {
  categoryId: number;
  points: number;
  question: DealtQuestion;
  actions: [Action | null, Action | null];
  answers: [number | null, number | null];
  deadline: number | null;
  deltas: [number, number] | null;
};

const DEFAULT_NAMES = ['الفريق الأول', 'الفريق الثاني'] as const;

/** Fisher–Yates on a copy; the correct option is tracked by identity, not position. */
export function shuffleQuestion(q: DealtQuestion, random = Math.random): DealtQuestion {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { ...q, options: order.map((i) => q.options[i]!), correctIndex: order.indexOf(q.correctIndex) };
}

/**
 * Authoritative state of one game room. The server owns every rule, timer and score;
 * devices only send intents and render the per-seat `view()`.
 */
export class GameRoom {
  status: RoomStatus = 'lobby';
  readonly teams: [Player | null, Player | null] = [null, null];
  readonly members: [Member[], Member[]] = [[], []];
  /** Each team's live votes (deviceId → key) for the step in progress; insertion order breaks ties. */
  private readonly votes: [Map<string, string>, Map<string, string>] = [new Map(), new Map()];
  tv: { deviceId: string; connected: boolean } | null = null;
  categories: BoardCategory[] = [];
  readonly used = new Set<string>();
  turn: TeamIndex = 0;
  phase: GamePhase = 'board';
  round: Round | null = null;
  /** Set while a cell's question is being fetched so a double tap can't deal twice. */
  picking = false;
  lastActivity = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly code: string,
    readonly mode: RoomMode,
    readonly variant: Variant,
    /** Called after every state change the room makes on its own (timeouts). */
    private readonly onChange: () => void = () => {},
  ) {}

  // ── Seats ────────────────────────────────────────────────────────────────

  seatOf(deviceId: string): Seat | null {
    if (this.tv?.deviceId === deviceId) return 'tv';
    if (this.teams[0]?.deviceId === deviceId) return 0;
    if (this.teams[1]?.deviceId === deviceId) return 1;
    return null;
  }

  /** The team a (non-captain) member belongs to. */
  memberOf(deviceId: string): TeamIndex | null {
    if (this.members[0].some((m) => m.deviceId === deviceId)) return 0;
    if (this.members[1].some((m) => m.deviceId === deviceId)) return 1;
    return null;
  }

  /** What a device sees: its seat, plus its device id when it is only a member of that team. */
  viewerOf(deviceId: string): { seat: Seat; member?: string } | null {
    const seat = this.seatOf(deviceId);
    if (seat !== null) return { seat };
    const team = this.memberOf(deviceId);
    return team === null ? null : { seat: team, member: deviceId };
  }

  /** The device that created the room: team 1's phone in mobile mode, the TV in tv mode. */
  seatHost(deviceId: string, teamName?: string, nick?: string) {
    if (this.mode === 'tv') this.tv = { deviceId, connected: true };
    else this.teams[0] = { deviceId, name: teamName || DEFAULT_NAMES[0], nick: nick || 'الرئيس', score: 0, connected: true };
  }

  /**
   * Join (or re-join after a refresh — the device id keeps its seat or membership).
   * With `team`, the first device into a team becomes its captain and everyone after is a
   * member (up to MAX_TEAM_SIZE); without it (older clients) the next free captain seat is taken.
   */
  join(deviceId: string, teamName?: string, team?: TeamIndex, nick?: string): Seat {
    const existing = this.seatOf(deviceId);
    if (existing !== null) {
      this.setConnected(deviceId, true);
      return existing;
    }
    const mine = this.memberOf(deviceId);
    if (mine !== null) {
      this.setConnected(deviceId, true);
      return mine;
    }

    if (team === undefined) {
      if (this.status !== 'lobby') throw new GameError('اللعبة بدأت بالفعل!');
      const free = ([0, 1] as const).find((i) => !this.teams[i]);
      if (free === undefined) throw new GameError('الغرفة ممتلئة!');
      this.teams[free] = { deviceId, name: teamName || DEFAULT_NAMES[free], nick: nick || 'الرئيس', score: 0, connected: true };
      this.touch();
      return free;
    }

    if (!this.teams[team]) {
      if (this.status !== 'lobby') throw new GameError('اللعبة بدأت بالفعل!');
      this.teams[team] = { deviceId, name: teamName || DEFAULT_NAMES[team], nick: nick || 'الرئيس', score: 0, connected: true };
    } else {
      if (1 + this.members[team].length >= MAX_TEAM_SIZE) throw new GameError(`الفريق ممتلئ (${MAX_TEAM_SIZE} لاعبين)!`);
      this.members[team].push({ deviceId, name: nick || `لاعب ${this.members[team].length + 1}`, connected: true });
    }
    this.touch();
    return team;
  }

  /**
   * A member leaving just drops out (and their votes with them). Leaving the lobby frees a captain
   * seat (a waiting member takes it over); the host leaving closes the room (returns true).
   * Mid-game a captain's seat is kept so the team can come back with the code.
   */
  leave(deviceId: string): boolean {
    const member = this.memberOf(deviceId);
    if (member !== null) {
      this.members[member] = this.members[member].filter((m) => m.deviceId !== deviceId);
      this.votes[member].delete(deviceId);
      this.touch();
      return false;
    }
    const seat = this.seatOf(deviceId);
    if (seat === null) return false;
    if (this.status !== 'lobby') {
      this.setConnected(deviceId, false);
      return false;
    }
    const isHost = this.mode === 'tv' ? seat === 'tv' : seat === 0;
    if (isHost) return true;
    if (seat !== 'tv') {
      const heir = this.members[seat].shift();
      const captain = this.teams[seat]!;
      this.teams[seat] = heir ? { ...captain, deviceId: heir.deviceId, nick: heir.name, connected: heir.connected } : null;
      if (heir) this.votes[seat].delete(heir.deviceId);
    }
    this.touch();
    return false;
  }

  setConnected(deviceId: string, connected: boolean) {
    const seat = this.seatOf(deviceId);
    if (seat === 'tv') this.tv!.connected = connected;
    else if (seat !== null) {
      this.teams[seat]!.connected = connected;
      if (!connected) this.handOverCaptain(seat);
    } else {
      const team = this.memberOf(deviceId);
      const m = team === null ? undefined : this.members[team].find((x) => x.deviceId === deviceId);
      if (m) m.connected = connected;
    }
    this.touch();
  }

  /** A captain who drops mid-game would stall their team, so a connected member takes over (the old captain returns as a member). */
  private handOverCaptain(team: TeamIndex) {
    if (this.status !== 'playing') return;
    const captain = this.teams[team]!;
    const i = this.members[team].findIndex((m) => m.connected);
    if (i < 0) return;
    const heir = this.members[team][i]!;
    this.members[team][i] = { deviceId: captain.deviceId, name: captain.nick, connected: false };
    this.teams[team] = { ...captain, deviceId: heir.deviceId, nick: heir.name, connected: true };
    this.votes[team].delete(heir.deviceId);
  }

  /** Connected devices in the room (captains + members + tv). */
  get connectedCount() {
    return (
      (this.tv?.connected ? 1 : 0) +
      this.teams.filter((t) => t?.connected).length +
      this.members.reduce((n, ms) => n + ms.filter((m) => m.connected).length, 0)
    );
  }

  get hasConnectedDevice() {
    return Boolean(
      this.tv?.connected || this.teams.some((t) => t?.connected) || this.members.some((ms) => ms.some((m) => m.connected)),
    );
  }

  // ── Game flow ────────────────────────────────────────────────────────────

  start(seat: Seat, categories: BoardCategory[]) {
    const host: Seat = this.mode === 'tv' ? 'tv' : 0;
    if (seat !== host) throw new GameError('المضيف فقط يبدأ اللعبة');
    if (this.status !== 'lobby') throw new GameError('اللعبة بدأت بالفعل!');
    if (!this.teams[0] || !this.teams[1]) throw new GameError('في انتظار الفريق الثاني');
    this.categories = categories;
    this.status = 'playing';
    this.phase = 'board';
    this.turn = 0;
    this.clearVotes();
    this.touch();
  }

  /** Validates a board pick before the (async) question fetch. */
  assertCanPick(seat: Seat, categoryId: number, points: number) {
    if (this.status !== 'playing' || this.phase !== 'board' || this.picking) throw new GameError('ليس وقت اختيار سؤال');
    if (!canPick(this.mode, seat, this.turn)) throw new GameError('ليس دورك!');
    if (!this.categories.some((c) => c.id === categoryId) || !(POINTS as readonly number[]).includes(points)) {
      throw new GameError('هذا السؤال غير موجود في اللوحة');
    }
    if (this.used.has(cellKey(categoryId, points))) throw new GameError('هذا السؤال استُخدم بالفعل!');
  }

  beginRound(categoryId: number, points: number, question: DealtQuestion) {
    this.used.add(cellKey(categoryId, points));
    this.round = { categoryId, points, question, actions: [null, null], answers: [null, null], deadline: null, deltas: null };
    this.phase = 'action';
    this.clearVotes();
    this.arm(ACTION_SECONDS, () => this.timeoutActions());
    this.touch();
  }

  /** Secret choice: answer yourself, or steal (swap / flip) the opponent's answer. */
  act(seat: Seat, action: Action) {
    const round = this.requireRound('action');
    const team = this.requireTeam(seat);
    if (round.actions[team]) throw new GameError('قرارك محفوظ بالفعل');
    round.actions[team] = action;
    this.touch();
    if (round.actions[0] && round.actions[1]) this.enterAnswerPhase();
  }

  answer(seat: Seat, index: number) {
    const round = this.requireRound('answer');
    const team = this.requireTeam(seat);
    if (round.answers[team] !== null) throw new GameError('جوابك محفوظ بالفعل');
    if (index < 0 || index >= round.question.options.length) throw new GameError('خيار غير صالح');
    round.answers[team] = index;
    this.touch();
    if (round.answers[0] !== null && round.answers[1] !== null) this.finishRound();
  }

  next(seat: Seat) {
    if (this.status !== 'playing' || this.phase !== 'result') throw new GameError('الجولة لم تنتهِ بعد');
    if (!canAdvance(this.mode, seat)) throw new GameError('التلفاز فقط ينتقل للسؤال التالي');
    this.round = null;
    if (this.used.size >= this.categories.length * POINTS.length) {
      this.status = 'done';
    } else {
      this.turn = this.turn === 0 ? 1 : 0;
      this.phase = 'board';
    }
    this.clearVotes();
    this.touch();
  }

  /** A member's vote for the step in progress; they can change it until the captain decides. */
  vote(deviceId: string, key: string) {
    const team = this.memberOf(deviceId);
    if (team === null) throw new GameError('التصويت للأعضاء فقط');
    if (this.status !== 'playing') throw new GameError('اللعبة لم تبدأ');
    const err = this.voteError(team, key);
    if (err) throw new GameError(err);
    // Delete first so a changed vote counts as the newest one when breaking ties.
    this.votes[team].delete(deviceId);
    this.votes[team].set(deviceId, key);
    this.touch();
  }

  /** Why `key` can't be voted on right now by `team` (null when it can). */
  private voteError(team: TeamIndex, key: string): string | null {
    const round = this.round;
    if (this.phase === 'board') {
      if (this.mode !== 'mobile' || this.picking) return 'ليس وقت التصويت';
      if (team !== this.turn) return 'ليس دور فريقك!';
      const [cat, pts] = key.split(':').map(Number);
      const ok = this.categories.some((c) => c.id === cat) && (POINTS as readonly number[]).includes(pts!);
      if (!ok) return 'هذا السؤال غير موجود في اللوحة';
      return this.used.has(cellKey(cat!, pts!)) ? 'هذا السؤال استُخدم بالفعل!' : null;
    }
    if (this.phase === 'action') {
      if (!round || round.actions[team]) return 'قرر رئيس الفريق بالفعل';
      return key === 'answer' || key === 'steal' ? null : 'خيار غير صالح';
    }
    if (this.phase === 'answer') {
      if (!round || round.actions[team] === 'steal' || round.answers[team] !== null) return 'قرر رئيس الفريق بالفعل';
      const i = Number(key);
      return Number.isInteger(i) && i >= 0 && i < round.question.options.length ? null : 'خيار غير صالح';
    }
    return 'ليس وقت التصويت';
  }

  /** Is the team still deciding something its members can vote on? */
  private votingOpen(team: TeamIndex): boolean {
    if (this.status !== 'playing') return false;
    const round = this.round;
    if (this.phase === 'board') return this.mode === 'mobile' && team === this.turn && !this.picking;
    if (this.phase === 'action') return Boolean(round && !round.actions[team]);
    if (this.phase === 'answer') return Boolean(round && round.actions[team] !== 'steal' && round.answers[team] === null);
    return false;
  }

  private tally(team: TeamIndex): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const key of this.votes[team].values()) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }

  /** The most-voted key among `allowed` (earliest vote wins a tie), or null with no votes. */
  private leading<K extends string>(team: TeamIndex, allowed: readonly K[]): K | null {
    const counts = this.tally(team);
    let best: K | null = null;
    for (const key of this.votes[team].values()) {
      if (!(allowed as readonly string[]).includes(key)) continue;
      if (best === null || counts[key]! > counts[best]!) best = key as K;
    }
    return best;
  }

  private leadingAnswer(team: TeamIndex): number {
    const options = this.round!.question.options.map((_, i) => String(i));
    const key = this.leading(team, options);
    return key === null ? -1 : Number(key);
  }

  private clearVotes() {
    this.votes[0].clear();
    this.votes[1].clear();
  }

  dispose() {
    this.disarm();
  }

  private enterAnswerPhase() {
    const round = this.round!;
    // Stealers don't answer; both stealing skips straight to the (scoreless) result.
    round.actions.forEach((a, t) => {
      if (a === 'steal') round.answers[t] = -1;
    });
    if (round.answers[0] !== null && round.answers[1] !== null) return this.finishRound();
    this.phase = 'answer';
    this.clearVotes();
    this.arm(ANSWER_SECONDS, () => this.timeoutAnswers());
  }

  private finishRound() {
    const round = this.round!;
    this.disarm();
    const actions = round.actions as [Action, Action];
    const answers = round.answers as [number, number];
    const correct = answers.map((a) => a === round.question.correctIndex) as [boolean, boolean];
    round.deltas = computeScores(round.points, actions, correct, this.variant);
    round.deltas.forEach((d, t) => {
      const team = this.teams[t]!;
      team.score = Math.max(0, team.score + d);
    });
    this.phase = 'result';
  }

  private timeoutActions() {
    const round = this.round;
    if (this.phase !== 'action' || !round) return;
    round.actions = [round.actions[0] ?? this.leading(0, ['answer', 'steal']) ?? 'answer', round.actions[1] ?? this.leading(1, ['answer', 'steal']) ?? 'answer'] as [Action, Action];
    this.enterAnswerPhase();
    this.touch();
    this.onChange();
  }

  private timeoutAnswers() {
    const round = this.round;
    if (this.phase !== 'answer' || !round) return;
    round.answers = [round.answers[0] ?? this.leadingAnswer(0), round.answers[1] ?? this.leadingAnswer(1)];
    this.finishRound();
    this.touch();
    this.onChange();
  }

  private arm(seconds: number, fn: () => void) {
    this.disarm();
    this.round!.deadline = Date.now() + seconds * 1000;
    this.timer = setTimeout(fn, seconds * 1000);
  }

  private disarm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.round) this.round.deadline = null;
  }

  private requireRound(phase: GamePhase): Round {
    if (this.status !== 'playing' || this.phase !== phase || !this.round) throw new GameError('انتهى وقت هذه الخطوة');
    return this.round;
  }

  private requireTeam(seat: Seat): TeamIndex {
    if (seat === 'tv') throw new GameError('التلفاز لا يلعب');
    return seat;
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  // ── View ─────────────────────────────────────────────────────────────────

  view(seat: Seat, memberDeviceId?: string): RoomView {
    const round = this.round;
    const team = seat === 'tv' ? null : seat;
    const reveal = this.phase === 'result' && round?.deltas;
    return {
      code: this.code,
      mode: this.mode,
      variant: this.variant,
      status: this.status,
      you: seat,
      role: seat === 'tv' ? 'tv' : memberDeviceId ? 'member' : 'captain',
      teams: [this.teamView(0), this.teamView(1)],
      tvConnected: Boolean(this.tv?.connected),
      categories: this.categories,
      used: [...this.used],
      turn: this.turn,
      phase: this.phase,
      question: round
        ? {
            categoryId: round.categoryId,
            points: round.points,
            type: round.question.type,
            text: round.question.text,
            options: round.question.options,
            imageUrl: round.question.imageUrl,
          }
        : null,
      remainingMs: round?.deadline ? Math.max(0, round.deadline - Date.now()) : null,
      decided: [Boolean(round?.actions[0]), Boolean(round?.actions[1])],
      myAction: round && team !== null ? round.actions[team] : null,
      myAnswer: round && team !== null ? round.answers[team] : null,
      votes:
        team !== null && this.votingOpen(team)
          ? { counts: this.tally(team), mine: (memberDeviceId && this.votes[team].get(memberDeviceId)) || null }
          : null,
      result: reveal
        ? {
            correctIndex: round.question.correctIndex,
            revealUrl: round.question.revealUrl,
            actions: round.actions as [Action, Action],
            answers: round.answers as [number, number],
            deltas: round.deltas!,
          }
        : null,
    };
  }

  private teamView(t: TeamIndex) {
    const p = this.teams[t];
    if (!p) return null;
    return {
      name: p.name,
      score: p.score,
      connected: p.connected,
      members: [
        { name: p.nick, connected: p.connected, captain: true },
        ...this.members[t].map((m) => ({ name: m.name, connected: m.connected, captain: false })),
      ],
    };
  }
}
