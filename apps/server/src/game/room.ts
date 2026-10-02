import {
  ACTION_SECONDS,
  ANSWER_SECONDS,
  canAdvance,
  canPick,
  cellKey,
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

type Player = { deviceId: string; name: string; score: number; connected: boolean };

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

  /** The device that created the room: team 1's phone in mobile mode, the TV in tv mode. */
  seatHost(deviceId: string, teamName?: string) {
    if (this.mode === 'tv') this.tv = { deviceId, connected: true };
    else this.teams[0] = { deviceId, name: teamName || DEFAULT_NAMES[0], score: 0, connected: true };
  }

  /** Join (or re-join after a refresh — the device id keeps its seat). */
  join(deviceId: string, teamName?: string): Seat {
    const existing = this.seatOf(deviceId);
    if (existing !== null) {
      this.setConnected(deviceId, true);
      return existing;
    }
    if (this.status !== 'lobby') throw new GameError('اللعبة بدأت بالفعل!');
    const free = ([0, 1] as const).find((i) => !this.teams[i]);
    if (free === undefined) throw new GameError('الغرفة ممتلئة!');
    this.teams[free] = { deviceId, name: teamName || DEFAULT_NAMES[free], score: 0, connected: true };
    this.touch();
    return free;
  }

  /**
   * Leaving the lobby frees the seat; the host leaving closes the room (returns true).
   * Mid-game the seat is kept so the team can come back with the code.
   */
  leave(deviceId: string): boolean {
    const seat = this.seatOf(deviceId);
    if (seat === null) return false;
    if (this.status !== 'lobby') {
      this.setConnected(deviceId, false);
      return false;
    }
    const isHost = this.mode === 'tv' ? seat === 'tv' : seat === 0;
    if (isHost) return true;
    if (seat !== 'tv') this.teams[seat] = null;
    this.touch();
    return false;
  }

  setConnected(deviceId: string, connected: boolean) {
    const seat = this.seatOf(deviceId);
    if (seat === 'tv') this.tv!.connected = connected;
    else if (seat !== null) this.teams[seat]!.connected = connected;
    this.touch();
  }

  get hasConnectedDevice() {
    return Boolean(this.tv?.connected || this.teams[0]?.connected || this.teams[1]?.connected);
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
    this.touch();
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
    round.actions = [round.actions[0] ?? 'answer', round.actions[1] ?? 'answer'];
    this.enterAnswerPhase();
    this.touch();
    this.onChange();
  }

  private timeoutAnswers() {
    const round = this.round;
    if (this.phase !== 'answer' || !round) return;
    round.answers = [round.answers[0] ?? -1, round.answers[1] ?? -1];
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

  view(seat: Seat): RoomView {
    const round = this.round;
    const team = seat === 'tv' ? null : seat;
    const reveal = this.phase === 'result' && round?.deltas;
    return {
      code: this.code,
      mode: this.mode,
      variant: this.variant,
      status: this.status,
      you: seat,
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
    return p ? { name: p.name, score: p.score, connected: p.connected } : null;
  }
}
