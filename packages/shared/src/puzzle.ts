// "لوحة الصورة": viewers of a live stream type chat commands to join and to put image pieces in place.
// Pure logic, shared by the stream page and its tests; the page only feeds it chat messages.

export const PUZZLE_SIZES = [3, 4, 5] as const;
/** Anyone spamming commands faster than this is ignored. */
export const PUZZLE_COOLDOWN_MS = 1200;
/** The word that joins the game from the chat. */
export const JOIN_WORDS = ['دخول', 'دخول!', 'join'] as const;

export type PuzzlePlayer = { score: number; lastAt: number };
export type PuzzleState = {
  /** The image is an n×n grid; piece `i` belongs in cell `i` (row-major). */
  size: number;
  /** Number shown on each piece (1..n²), shuffled once so the tray order doesn't give the answer away. */
  labels: number[];
  /** Cell index → the player who put its piece there. */
  placed: Record<number, string>;
  players: Record<string, PuzzlePlayer>;
};

export type ChatCommand = { type: 'join' } | { type: 'place'; label: number; row: number; col: number };

export type PuzzleEvent =
  | { type: 'join'; user: string }
  | { type: 'already'; user: string }
  | { type: 'place'; user: string; label: number; cell: string; ok: boolean }
  | { type: 'done'; winner: string | null };

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
// Arabic keyboards have no Latin letters: ا ب ج د هـ = A B C D E.
const ARABIC_LETTERS: Record<string, string> = { ا: 'A', أ: 'A', ب: 'B', ج: 'C', د: 'D', ه: 'E', هـ: 'E' };

export function normalize(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[ً-ٟـ]/g, '')
    .trim();
}

/** "دخول" joins; "5 B3" (also "B3 5", "٥ ب٣") puts piece 5 into column B, row 3. */
export function parseChat(text: string): ChatCommand | null {
  const t = normalize(text);
  if ((JOIN_WORDS as readonly string[]).includes(t.toLowerCase())) return { type: 'join' };
  const letter = '([A-Ea-eاأبجده]ـ?)';
  const m = new RegExp(`^(\\d{1,2})\\s*[-:,]?\\s*${letter}\\s*(\\d)$`).exec(t) ?? new RegExp(`^${letter}\\s*(\\d)\\s*[-:,]?\\s*(\\d{1,2})$`).exec(t);
  if (!m) return null;
  const first = /^\d/.test(m[1]!);
  const num = Number(first ? m[1] : m[3]);
  const l = first ? m[2]! : m[1]!;
  const row = Number(first ? m[3] : m[2]);
  const col = (ARABIC_LETTERS[l] ?? l.toUpperCase()).charCodeAt(0) - 65;
  return { type: 'place', label: num, row: row - 1, col };
}

export const cellName = (size: number, cell: number) => `${String.fromCharCode(65 + (cell % size))}${Math.floor(cell / size) + 1}`;

export function newPuzzle(size: number, random = Math.random): PuzzleState {
  const labels = Array.from({ length: size * size }, (_, i) => i + 1);
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [labels[i], labels[j]] = [labels[j]!, labels[i]!];
  }
  return { size, labels, placed: {}, players: {} };
}

/** Piece numbers still in the tray, ascending. */
export const trayLabels = (s: PuzzleState) => s.labels.filter((_, cell) => s.placed[cell] === undefined).sort((a, b) => a - b);
export const isDone = (s: PuzzleState) => Object.keys(s.placed).length === s.size * s.size;

export function leaderboard(s: PuzzleState) {
  return Object.entries(s.players)
    .map(([name, p]) => ({ name, score: p.score }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Applies one chat message; returns the next state and what happened (nothing for ignored messages). */
export function applyChat(s: PuzzleState, user: string, text: string, now = Date.now()): { state: PuzzleState; events: PuzzleEvent[] } {
  const cmd = parseChat(text);
  if (!cmd || isDone(s)) return { state: s, events: [] };
  const key = user.toLowerCase();
  const known = s.players[key];

  if (cmd.type === 'join') {
    if (known) return { state: s, events: [{ type: 'already', user }] };
    return { state: { ...s, players: { ...s.players, [key]: { score: 0, lastAt: 0 } } }, events: [{ type: 'join', user }] };
  }

  if (!known || now - known.lastAt < PUZZLE_COOLDOWN_MS) return { state: s, events: [] };
  const { size } = s;
  if (cmd.row < 0 || cmd.row >= size || cmd.col < 0 || cmd.col >= size) return { state: s, events: [] };
  const cell = cmd.row * size + cmd.col;
  const piece = s.labels.indexOf(cmd.label); // the cell this label belongs to
  if (piece < 0 || s.placed[piece] !== undefined) return { state: s, events: [] };

  const ok = piece === cell;
  const players = { ...s.players, [key]: { score: known.score + (ok ? 1 : 0), lastAt: now } };
  const state: PuzzleState = { ...s, players, placed: ok ? { ...s.placed, [cell]: user } : s.placed };
  const events: PuzzleEvent[] = [{ type: 'place', user, label: cmd.label, cell: cellName(size, cell), ok }];
  if (ok && isDone(state)) events.push({ type: 'done', winner: leaderboard(state)[0]?.name ?? null });
  return { state, events };
}
