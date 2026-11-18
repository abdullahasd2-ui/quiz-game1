import {
  ANSWER_SECONDS,
  ACTION_SECONDS,
  MIN_SCORE,
  POINTS,
  SOLO_LIST_ROUNDS,
  SOLO_MAX_PLAYERS,
  SOLO_MIN_PLAYERS,
  answerName,
  buildListIndex,
  cellKey,
  matchList,
  soloListScores,
  soloScores,
  type Action,
  type BoardCategory,
  type GamePhase,
  type ListCategoryView,
  type ListIndex,
  type RoomMode,
  type RoomStatus,
  type SoloChoice,
  type SoloRow,
  type SoloVariant,
  type SoloView,
} from '@quiz/shared';
import { GameError, type DealtQuestion, type ListQuestion } from './room';

type SoloPlayer = { deviceId: string; pid: string; name: string; score: number; connected: boolean };

/**
 * «فردي»: the main game with every player on their own. Each question every player decides in secret
 * (answer, or swap / flip / reverse a player they pick), then the ones who answer pick an option.
 * The host is the creator's phone (who plays too) or the TV (which only hosts).
 */
export class SoloRoom {
  readonly solo = true;
  status: RoomStatus = 'lobby';
  readonly players: SoloPlayer[] = [];
  tv: { deviceId: string; connected: boolean } | null = null;
  private readonly banned = new Set<string>();
  private pidCounter = 0;
  categories: BoardCategory[] = [];
  actionSeconds: number = ACTION_SECONDS;
  readonly used = new Set<string>();
  phase: GamePhase = 'board';
  /** Index into `players` of the one who picks next. */
  private turnAt = 0;
  picking = false;
  lastActivity = Date.now();
  private deadline: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly runs: Record<string, number> = {};
  private round: {
    categoryId: number;
    points: number;
    question: DealtQuestion;
    choices: Record<string, { action: Action; target: string | null } | undefined>;
    answers: Record<string, number | undefined>;
    rows: Record<string, SoloRow> | null;
  } | null = null;
  // ── عدّها ──
  listCategories: ListCategoryView[] = [];
  readonly listUsed = new Set<string>();
  private listRound = 0;
  private list: {
    question: ListQuestion;
    index: ListIndex;
    found: Record<string, number[]>;
    at: Record<string, number>;
    rows: Record<string, SoloRow> | null;
  } | null = null;

  constructor(
    readonly code: string,
    readonly mode: RoomMode,
    readonly variant: SoloVariant,
    private readonly onChange: () => void = () => {},
  ) {}

  // ── Seats ────────────────────────────────────────────────────────────────

  private player(deviceId: string) {
    return this.players.find((p) => p.deviceId === deviceId);
  }

  /** The player id of a device ('tv' for the TV), or null when it is not in the room. */
  seatOf(deviceId: string): string | null {
    if (this.tv?.deviceId === deviceId) return 'tv';
    return this.player(deviceId)?.pid ?? null;
  }

  private get hostPid(): string {
    return this.mode === 'tv' ? 'tv' : (this.players[0]?.pid ?? '');
  }

  seatHost(deviceId: string, nick?: string) {
    if (this.mode === 'tv') this.tv = { deviceId, connected: true };
    else this.addPlayer(deviceId, nick);
  }

  private addPlayer(deviceId: string, nick?: string) {
    const name = nick?.trim() || `لاعب ${this.players.length + 1}`;
    if (this.players.some((p) => p.name === name)) throw new GameError('فيه لاعب بنفس الاسم — اختر اسم ثاني');
    this.players.push({ deviceId, pid: `p${++this.pidCounter}`, name, score: 0, connected: true });
  }

  join(deviceId: string, nick?: string) {
    if (this.seatOf(deviceId) !== null) return this.setConnected(deviceId, true);
    if (this.banned.has(deviceId)) throw new GameError('طردك مضيف الغرفة');
    if (this.status !== 'lobby') throw new GameError('اللعبة بدأت بالفعل!');
    if (this.players.length >= SOLO_MAX_PLAYERS) throw new GameError(`الغرفة ممتلئة (${SOLO_MAX_PLAYERS} لاعبين)!`);
    this.addPlayer(deviceId, nick);
    this.touch();
  }

  /** Leaving the lobby drops the player (the host leaving closes the room: returns true); mid-game the seat is kept. */
  leave(deviceId: string): boolean {
    const seat = this.seatOf(deviceId);
    if (seat === null) return false;
    if (seat === this.hostPid && this.status === 'lobby') return true;
    if (this.status !== 'lobby') {
      this.setConnected(deviceId, false);
      return false;
    }
    this.players.splice(
      this.players.findIndex((p) => p.pid === seat),
      1,
    );
    this.touch();
    return false;
  }

  setConnected(deviceId: string, connected: boolean) {
    if (this.tv?.deviceId === deviceId) this.tv.connected = connected;
    const p = this.player(deviceId);
    if (p) p.connected = connected;
    this.touch();
    // A player who drops no longer holds up the question.
    if (!connected) this.maybeAdvance();
  }

  /** The host removes a player (banned from coming back); returns the removed device id. */
  kick(seat: string, pid: string): string {
    if (seat !== this.hostPid) throw new GameError('المضيف فقط يطرد اللاعبين');
    if (pid === seat) throw new GameError('ما تقدر تطرد نفسك!');
    const i = this.players.findIndex((p) => p.pid === pid);
    if (i < 0) throw new GameError('اللاعب غير موجود');
    if (this.status === 'playing' && this.players.length <= SOLO_MIN_PLAYERS) throw new GameError('لازم يبقى لاعبين على الأقل');
    const [p] = this.players.splice(i, 1);
    this.banned.add(p!.deviceId);
    if (this.round) {
      delete this.round.choices[pid];
      delete this.round.answers[pid];
    }
    if (this.turnAt >= this.players.length) this.turnAt = 0;
    this.touch();
    this.maybeAdvance();
    return p!.deviceId;
  }

  get connectedCount() {
    return (this.tv?.connected ? 1 : 0) + this.players.filter((p) => p.connected).length;
  }

  get hasConnectedDevice() {
    return this.connectedCount > 0;
  }

  /** The two best players, for the admin dashboard and the usage log (which expect two teams). */
  get teams(): [SoloPlayer | null, SoloPlayer | null] {
    const top = [...this.players].sort((a, b) => b.score - a.score);
    return [top[0] ?? null, top[1] ?? null];
  }

  get totalRounds() {
    return this.variant === 'list' ? SOLO_LIST_ROUNDS : this.categories.length * POINTS.length;
  }

  get roundsPlayed() {
    if (this.variant !== 'list') return this.used.size;
    return this.status === 'done' ? this.totalRounds : this.listRound + (this.phase === 'result' ? 1 : 0);
  }

  // ── Game flow ────────────────────────────────────────────────────────────

  start(seat: string, categories: BoardCategory[], actionSeconds: number = ACTION_SECONDS, listCategories: ListCategoryView[] = []) {
    if (seat !== this.hostPid) throw new GameError('المضيف فقط يبدأ اللعبة');
    if (this.status !== 'lobby') throw new GameError('اللعبة بدأت بالفعل!');
    if (this.players.length < SOLO_MIN_PLAYERS) throw new GameError(`في انتظار ${SOLO_MIN_PLAYERS} لاعبين على الأقل`);
    if (this.variant === 'list') {
      if (!listCategories.length) throw new GameError('اختر فئة وحدة على الأقل');
      this.listCategories = listCategories;
    }
    this.categories = categories;
    this.actionSeconds = actionSeconds;
    this.status = 'playing';
    this.phase = 'board';
    this.turnAt = 0;
    this.touch();
  }

  private get turn(): string | null {
    return this.players[this.turnAt]?.pid ?? null;
  }

  /** The player in turn picks; the host (or the TV) may pick for them, so a player who dropped never stalls the game. */
  private assertPicker(seat: string) {
    if (seat !== this.turn && seat !== this.hostPid) throw new GameError('ليس دورك!');
  }

  assertCanPick(seat: string, categoryId: number, points: number) {
    if (this.variant === 'list' || this.status !== 'playing' || this.phase !== 'board' || this.picking) throw new GameError('ليس وقت اختيار سؤال');
    this.assertPicker(seat);
    if (!this.categories.some((c) => c.id === categoryId) || !(POINTS as readonly number[]).includes(points)) throw new GameError('هذا السؤال غير موجود في اللوحة');
    if (this.used.has(cellKey(categoryId, points))) throw new GameError('هذا السؤال استُخدم بالفعل!');
  }

  beginRound(categoryId: number, points: number, question: DealtQuestion) {
    this.used.add(cellKey(categoryId, points));
    this.round = { categoryId, points, question, choices: {}, answers: {}, rows: null };
    this.phase = 'action';
    this.arm(this.actionSeconds, () => this.timeoutActions());
    this.touch();
  }

  /** Secret choice: answer, or swap / flip / reverse the player `target`. */
  act(seat: string, action: Action, target?: string) {
    const round = this.requireRound('action');
    const me = this.requirePlayer(seat);
    if (round.choices[me]) throw new GameError('قرارك محفوظ بالفعل');
    if (action === 'reverse' && this.variant !== 'triple') throw new GameError('خيار غير صالح');
    if (action !== 'answer') {
      if (!target) throw new GameError('اختر اللاعب');
      if (target === me) throw new GameError('ما تقدر تختار نفسك!');
      if (!this.players.some((p) => p.pid === target)) throw new GameError('اللاعب غير موجود');
    }
    round.choices[me] = { action, target: action === 'answer' ? null : target! };
    this.touch();
    this.maybeAdvance();
  }

  answer(seat: string, index: number) {
    const round = this.requireRound('answer');
    const me = this.requirePlayer(seat);
    if (round.choices[me]?.action !== 'answer') throw new GameError('ما عليك جواب في هذا السؤال');
    if (round.answers[me] !== undefined) throw new GameError('جوابك محفوظ بالفعل');
    if (index < 0 || index >= round.question.options.length) throw new GameError('خيار غير صالح');
    round.answers[me] = index;
    this.touch();
    this.maybeAdvance();
  }

  /** The step ends early once every connected player has done their part. */
  private maybeAdvance() {
    const round = this.round;
    if (this.status !== 'playing' || !round) return;
    const live = this.players.filter((p) => p.connected);
    if (this.phase === 'action' && live.every((p) => round.choices[p.pid])) this.enterAnswerPhase();
    else if (this.phase === 'answer' && live.every((p) => round.choices[p.pid]?.action !== 'answer' || round.answers[p.pid] !== undefined)) this.finishRound();
  }

  private timeoutActions() {
    const round = this.round;
    if (this.phase !== 'action' || !round) return;
    this.enterAnswerPhase();
    this.touch();
    this.onChange();
  }

  private enterAnswerPhase() {
    const round = this.round!;
    // Undecided players answer themselves.
    for (const p of this.players) round.choices[p.pid] ??= { action: 'answer', target: null };
    if (!this.players.some((p) => round.choices[p.pid]!.action === 'answer')) return this.finishRound();
    this.phase = 'answer';
    this.arm(ANSWER_SECONDS, () => this.timeoutAnswers());
  }

  private timeoutAnswers() {
    if (this.phase !== 'answer' || !this.round) return;
    this.finishRound();
    this.touch();
    this.onChange();
  }

  private finishRound() {
    const round = this.round!;
    this.disarm();
    const choices: Record<string, SoloChoice> = {};
    for (const p of this.players) {
      const c = round.choices[p.pid] ?? { action: 'answer' as const, target: null };
      choices[p.pid] = { action: c.action, target: c.target, pick: c.action === 'answer' ? (round.answers[p.pid] ?? -1) : -1 };
    }
    round.rows = soloScores(round.points, this.variant, choices, round.question.correctIndex, this.runs);
    this.applyRows(round.rows);
    this.phase = 'result';
  }

  private applyRows(rows: Record<string, SoloRow>) {
    for (const p of this.players) {
      const d = rows[p.pid]?.delta ?? 0;
      p.score = Math.max(MIN_SCORE, p.score + d);
    }
  }

  /** The host moves on after the result: the next player in line picks. */
  next(seat: string) {
    if (this.status !== 'playing' || this.phase !== 'result') throw new GameError('الجولة لم تنتهِ بعد');
    // Anyone may move on when the host dropped, so the game never stalls.
    const hostHere = this.mode === 'tv' ? this.tv?.connected : this.players[0]?.connected;
    if (seat !== this.hostPid && hostHere) throw new GameError('المضيف فقط ينتقل للسؤال التالي');
    this.round = null;
    this.list = null;
    const over = this.variant === 'list' ? this.listRound + 1 >= this.totalRounds : this.used.size >= this.totalRounds;
    if (over) this.status = 'done';
    else {
      if (this.variant === 'list') this.listRound++;
      this.turnAt = (this.turnAt + 1) % Math.max(1, this.players.length);
      this.phase = 'board';
    }
    this.touch();
  }

  // ── عدّها ────────────────────────────────────────────────────────────────

  assertCanListPick(seat: string, category: string) {
    if (this.variant !== 'list' || this.status !== 'playing' || this.phase !== 'board' || this.picking) throw new GameError('ليس وقت اختيار الفئة');
    this.assertPicker(seat);
    if (!this.listCategories.some((c) => c.id === category)) throw new GameError('هذي الفئة مو في اللعبة');
  }

  beginList(question: ListQuestion) {
    this.listUsed.add(question.id);
    this.list = { question, index: buildListIndex(question.answers, question.letter), found: {}, at: {}, rows: null };
    this.phase = 'list';
    this.arm(this.actionSeconds, () => this.finishList());
    this.touch();
  }

  listAnswer(seat: string, text: string): string[] {
    const list = this.list;
    if (this.variant !== 'list' || this.status !== 'playing' || this.phase !== 'list' || !list) throw new GameError('انتهى الوقت');
    const me = this.requirePlayer(seat);
    const mine = (list.found[me] ??= []);
    const added = matchList(list.index, text).filter((i) => !mine.includes(i));
    if (!added.length) return [];
    mine.push(...added);
    list.at[me] = Date.now();
    this.touch();
    return added.map((i) => answerName(list.question.answers[i]!));
  }

  private finishList() {
    const list = this.list;
    if (this.phase !== 'list' || !list) return;
    this.disarm();
    const scores = soloListScores(Object.fromEntries(this.players.map((p) => [p.pid, { count: list.found[p.pid]?.length ?? 0, at: list.at[p.pid] ?? 0 }])));
    list.rows = Object.fromEntries(
      Object.entries(scores).map(([pid, s]) => [pid, { outcome: s.found ? 'list' : 'idle', delta: s.delta, action: 'answer', target: null, pick: -1, by: [], found: s.found, bonus: s.bonus } satisfies SoloRow]),
    );
    this.applyRows(list.rows);
    this.phase = 'result';
    this.touch();
    this.onChange();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private requireRound(phase: GamePhase) {
    if (this.status !== 'playing' || this.phase !== phase || !this.round) throw new GameError('انتهى وقت هذه الخطوة');
    return this.round;
  }

  private requirePlayer(seat: string): string {
    if (seat === 'tv') throw new GameError('التلفاز لا يلعب');
    return seat;
  }

  private arm(seconds: number, fn: () => void) {
    this.disarm();
    this.deadline = Date.now() + seconds * 1000;
    this.timer = setTimeout(fn, seconds * 1000);
  }

  private disarm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
  }

  dispose() {
    this.disarm();
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  view(seat: string): SoloView {
    const round = this.round;
    const list = this.list;
    const me = seat === 'tv' ? null : seat;
    const done =
      this.phase === 'action' && round
        ? Object.keys(round.choices).filter((k) => round.choices[k])
        : this.phase === 'answer' && round
          ? Object.keys(round.answers)
          : this.phase === 'list' && list
            ? Object.keys(list.found).filter((k) => list.found[k]!.length)
            : [];
    return {
      solo: true,
      code: this.code,
      mode: this.mode,
      variant: this.variant,
      status: this.status,
      you: seat,
      host: seat === this.hostPid,
      players: this.players.map((p) => ({ id: p.pid, name: p.name, score: p.score, connected: p.connected, host: p.pid === this.hostPid, streak: this.runs[p.pid] ?? 0 })),
      tvConnected: Boolean(this.tv?.connected),
      categories: this.categories,
      used: [...this.used],
      turn: this.status === 'playing' ? this.turn : null,
      phase: this.phase,
      question: round
        ? { categoryId: round.categoryId, points: round.points, type: round.question.type, text: round.question.text, options: round.question.options, imageUrl: round.question.imageUrl }
        : null,
      actionSeconds: this.actionSeconds,
      answerSeconds: ANSWER_SECONDS,
      remainingMs: this.deadline ? Math.max(0, this.deadline - Date.now()) : null,
      done,
      myAction: (me && round?.choices[me]?.action) || null,
      myTarget: (me && round?.choices[me]?.target) || null,
      myAnswer: me && round ? (round.answers[me] ?? null) : null,
      result:
        this.phase === 'result' && round?.rows
          ? { correctIndex: round.question.correctIndex, revealUrl: round.question.revealUrl, rows: round.rows }
          : this.phase === 'result' && list?.rows
            ? { correctIndex: -1, revealUrl: null, rows: list.rows }
            : null,
      list:
        this.variant === 'list'
          ? {
              round: Math.min(this.listRound + 1, this.totalRounds),
              totalRounds: this.totalRounds,
              categories: this.listCategories,
              question: list ? { text: list.question.text, letter: list.question.letter, category: list.question.category } : null,
              found: Object.fromEntries(Object.entries(list?.found ?? {}).map(([k, v]) => [k, v.length])),
              mine: list && me ? (list.found[me] ?? []).map((i) => answerName(list.question.answers[i]!)).reverse() : [],
              result: list?.rows ? { answers: list.question.answers.map(answerName), found: list.found } : null,
            }
          : null,
    };
  }
}
