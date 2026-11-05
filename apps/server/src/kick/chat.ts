import type { KickMessage, KickStatus } from '@quiz/shared';

// Kick has no official "read chat" socket for third parties; its own site uses a Pusher channel
// per chat room. This reads that channel (public, read-only). If Kick changes it, only this file breaks.

const PUSHER_URL = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false';
const USER_AGENT = 'Mozilla/5.0 (compatible; JawabBadelBot/1.0)';
const MAX_RETRIES = 5;
const MAX_CHANNELS = 40;

/** One Pusher frame → the chat message inside it, or null for anything else (pings, joins, emotes-only…). */
export function parseKickFrame(raw: string): KickMessage | null {
  try {
    const frame = JSON.parse(raw) as { event?: string; data?: unknown };
    if (frame.event !== 'App\\Events\\ChatMessageEvent' || typeof frame.data !== 'string') return null;
    const data = JSON.parse(frame.data) as { content?: unknown; sender?: { username?: unknown } };
    const user = data.sender?.username;
    if (typeof data.content !== 'string' || typeof user !== 'string') return null;
    // [emote:123:name] tokens are Kick's emote markup, not text.
    const text = data.content.replace(/\[emote:\d+:[^\]]*\]/g, '').trim();
    return text ? { user, text } : null;
  } catch {
    return null;
  }
}

export type Upstream = { close(): void };
export type Connect = (
  chatroomId: number,
  h: { onLive(): void; onMessage(m: KickMessage): void; onClose(): void },
) => Upstream;
export type ResolveChatroom = (channel: string) => Promise<number>;

export const resolveChatroomFromKick: ResolveChatroom = async (channel) => {
  const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`kick lookup ${res.status}`);
  const id = ((await res.json()) as { chatroom?: { id?: number } }).chatroom?.id;
  if (!Number.isInteger(id)) throw new Error('no chatroom id');
  return id!;
};

export const connectPusher: Connect = (chatroomId, h) => {
  const ws = new WebSocket(PUSHER_URL);
  ws.onmessage = (ev) => {
    const raw = String(ev.data);
    let event: string | undefined;
    try {
      event = (JSON.parse(raw) as { event?: string }).event;
    } catch {
      return;
    }
    if (event === 'pusher:connection_established') {
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }));
    } else if (event === 'pusher_internal:subscription_succeeded') h.onLive();
    else if (event === 'pusher:ping') ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
    else {
      const m = parseKickFrame(raw);
      if (m) h.onMessage(m);
    }
  };
  ws.onclose = () => h.onClose();
  ws.onerror = () => ws.close();
  return { close: () => ws.close() };
};

type Listener = { onMessage(m: KickMessage): void; onStatus(s: KickStatus): void };
type Channel = { listeners: Set<Listener>; chatroomId?: number; status: KickStatus; upstream: Upstream | null; retries: number; timer: ReturnType<typeof setTimeout> | null };

/** One upstream connection per channel, shared by every page watching it, closed when the last one leaves. */
export class KickChatHub {
  private readonly channels = new Map<string, Channel>();

  constructor(
    private readonly opts: { connect?: Connect; resolve?: ResolveChatroom; retryMs?: number; onError?: (err: unknown) => void } = {},
  ) {}

  get size() {
    return this.channels.size;
  }

  watch(channel: string, chatroomId: number | undefined, listener: Listener): () => void {
    const key = channel.toLowerCase();
    let ch = this.channels.get(key);
    if (!ch) {
      if (this.channels.size >= MAX_CHANNELS) throw new Error('كثير قنوات شغّالة حالياً — جرّب بعد شوي');
      ch = { listeners: new Set(), chatroomId, status: { state: 'connecting' }, upstream: null, retries: 0, timer: null };
      this.channels.set(key, ch);
      ch.listeners.add(listener);
      listener.onStatus(ch.status);
      void this.start(key, ch);
    } else {
      ch.chatroomId ??= chatroomId;
      ch.listeners.add(listener);
      listener.onStatus(ch.status);
    }
    return () => {
      const cur = this.channels.get(key);
      if (!cur) return;
      cur.listeners.delete(listener);
      if (cur.listeners.size === 0) this.stop(key, cur);
    };
  }

  private setStatus(ch: Channel, status: KickStatus) {
    ch.status = status;
    for (const l of ch.listeners) l.onStatus(status);
  }

  private async start(key: string, ch: Channel) {
    try {
      ch.chatroomId ??= await (this.opts.resolve ?? resolveChatroomFromKick)(key);
    } catch (err) {
      this.opts.onError?.(err);
      if (this.channels.get(key) === ch) this.setStatus(ch, { state: 'error', detail: 'تعذّر الوصول لشات القناة — تأكد من الاسم، أو اكتب رقم الشات يدوياً' });
      return;
    }
    if (this.channels.get(key) !== ch) return; // everyone left while we looked it up
    ch.upstream = (this.opts.connect ?? connectPusher)(ch.chatroomId, {
      onLive: () => {
        ch.retries = 0;
        this.setStatus(ch, { state: 'live' });
      },
      onMessage: (m) => {
        for (const l of ch.listeners) l.onMessage(m);
      },
      onClose: () => {
        ch.upstream = null;
        if (this.channels.get(key) !== ch || ch.listeners.size === 0) return;
        if (ch.retries >= MAX_RETRIES) return this.setStatus(ch, { state: 'error', detail: 'انقطع الاتصال بشات القناة' });
        this.setStatus(ch, { state: 'connecting', detail: 'إعادة الاتصال...' });
        ch.timer = setTimeout(() => void this.start(key, ch), (this.opts.retryMs ?? 2000) * 2 ** ch.retries++);
      },
    });
  }

  private stop(key: string, ch: Channel) {
    this.channels.delete(key);
    if (ch.timer) clearTimeout(ch.timer);
    ch.upstream?.close();
  }

  closeAll() {
    for (const [key, ch] of this.channels) this.stop(key, ch);
  }
}
