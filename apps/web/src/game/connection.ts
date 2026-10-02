import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';
import { platform } from '@/lib/native';
import { SERVER_URL } from '@/lib/server';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Storage can be blocked (private mode, disabled site data) — fall back to memory.
const memory = new Map<string, string>();
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
}

/** Stable per-browser identity: the server binds a team seat to it, so a refresh keeps your seat. */
function deviceId() {
  let id = read('quiz:device');
  if (!id) {
    id = crypto.randomUUID().replaceAll('-', '');
    write('quiz:device', id);
  }
  return id;
}

/** The room this browser is in, so a refresh or a dropped connection rejoins it. */
export const savedRoom = {
  get: () => read('quiz:room'),
  set: (code: string | null) => write('quiz:room', code),
};

let socket: GameSocket | null = null;
export function getSocket(): GameSocket {
  const opts = { auth: { deviceId: deviceId(), platform }, transports: ['websocket', 'polling'] };
  socket ??= SERVER_URL ? io(SERVER_URL, opts) : io(opts);
  return socket;
}

type Events = ClientToServerEvents;
type Payload<E extends keyof Events> = Parameters<Events[E]> extends [infer R] ? [] : Parameters<Events[E]> extends [infer P, unknown] ? [P] : never;
type Result<E extends keyof Events> = Parameters<Events[E]> extends [...unknown[], (res: infer A) => void] ? A : never;

/** Emit with acknowledgement; network failures come back as an `{ok:false}` like rule errors. */
export async function send<E extends keyof Events>(event: E, ...payload: Payload<E>): Promise<Result<E>> {
  const s = getSocket();
  try {
    const timed = s.timeout(8000);
    const emit = timed.emitWithAck.bind(timed) as (e: string, ...a: unknown[]) => Promise<unknown>;
    return (await emit(event, ...payload)) as Result<E>;
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالسيرفر' } as Ack as Result<E>;
  }
}
