import { handleKickFrame, KICK_PUSHER_URL, type KickMessage, type KickStatus } from '@quiz/shared';

// Kick has no official "read chat" socket for third parties; its own site uses a Pusher channel
// per chat room. This reads that channel (public, read-only). If Kick changes it, only this file breaks.

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_RETRIES = 5;
const MAX_CHANNELS = 40;

export type Upstream = { close(): void };
export type Connect = (
  chatroomId: number,
  h: { onLive(): void; onMessage(m: KickMessage): void; onClose(): void },
) => Upstream;
export type ResolveChatroom = (channel: string) => Promise<number>;

export const resolveChatroomFromKick: ResolveChatroom = async (channel) => {
  let last = 'no response';
  // Kick has two public channel endpoints; either one carries the chat room id.
  for (const path of ['api/v2/channels', 'api/v1/channels']) {
    try {
      const res = await fetch(`https://kick.com/${path}/${encodeURIComponent(channel)}`, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json', 'accept-language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        continue;
      }
      const id = ((await res.json()) as { chatroom?: { id?: number } }).chatroom?.id;
      if (Number.isInteger(id)) return id!;
      last = 'no chatroom id';
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
};

export const connectPusher: Connect = (chatroomId, h) => {
  const ws = new WebSocket(KICK_PUSHER_URL);
  ws.onmessage = (ev) => {
    const r = handleKickFrame(String(ev.data), chatroomId);
    if (r.send) ws.send(r.send);
    if (r.live) h.onLive();
    if (r.message) h.onMessage(r.message);
  };
  // Node's WebSocket fires only "error" (no "close") when a connection fails, so treat either as the end, once.
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    h.onClose();
  };
  ws.onclose = end;
  ws.onerror = end;
  return { close: () => ws.close() };
};

type Listener = { onMessage(m: KickMessage): void; onStatus(s: KickStatus): void };
type Channel = {
  listeners: Set<Listener>;
  chatroomId?: number;
  status: KickStatus;
  upstream: Upstream | null;
  retries: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** Fires when Kick's socket opened but never confirmed the chat subscription. */
  handshake: ReturnType<typeof setTimeout> | null;
};

/** One upstream connection per channel, shared by every page watching it, closed when the last one leaves. */
export class KickChatHub {
  private readonly channels = new Map<string, Channel>();

  constructor(
    private readonly opts: { connect?: Connect; resolve?: ResolveChatroom; retryMs?: number; handshakeMs?: number; onError?: (err: unknown) => void } = {},
  ) {}

  get size() {
    return this.channels.size;
  }

  watch(channel: string, chatroomId: number | undefined, listener: Listener): () => void {
    const key = channel.toLowerCase();
    let ch = this.channels.get(key);
    if (!ch) {
      if (this.channels.size >= MAX_CHANNELS) throw new Error('كثير قنوات شغّالة حالياً — جرّب بعد شوي');
      ch = { listeners: new Set(), chatroomId, status: { state: 'connecting' }, upstream: null, retries: 0, timer: null, handshake: null };
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
    if (ch.chatroomId === undefined) {
      this.setStatus(ch, { state: 'connecting', detail: 'جاري البحث عن القناة...' });
      try {
        ch.chatroomId = await (this.opts.resolve ?? resolveChatroomFromKick)(key);
      } catch (err) {
        this.opts.onError?.(err);
        const why = err instanceof Error ? err.message : String(err);
        if (this.channels.get(key) === ch) {
          this.setStatus(ch, { state: 'error', detail: `تعذّر الوصول لقناة «${key}» (${why}) — تأكد من الاسم، أو اكتب رقم الشات يدوياً من "متقدم"` });
        }
        return;
      }
    }
    if (this.channels.get(key) !== ch) return; // everyone left while we looked it up
    this.setStatus(ch, { state: 'connecting', detail: 'جاري الاتصال بالشات...' });
    ch.handshake = setTimeout(() => {
      if (this.channels.get(key) !== ch || ch.status.state === 'live') return;
      this.opts.onError?.(new Error(`kick chat handshake timed out for ${key}`));
      const up = ch.upstream;
      ch.upstream = null;
      this.setStatus(ch, { state: 'error', detail: 'ما رد شات Kick على السيرفر (يمكن Kick يمنع الاتصال من السيرفر)' });
      up?.close();
    }, this.opts.handshakeMs ?? 12000);
    ch.upstream = (this.opts.connect ?? connectPusher)(ch.chatroomId, {
      onLive: () => {
        if (ch.handshake) clearTimeout(ch.handshake);
        ch.retries = 0;
        this.setStatus(ch, { state: 'live' });
      },
      onMessage: (m) => {
        for (const l of ch.listeners) l.onMessage(m);
      },
      onClose: () => {
        if (ch.handshake) clearTimeout(ch.handshake);
        ch.upstream = null;
        if (this.channels.get(key) !== ch || ch.listeners.size === 0 || ch.status.state === 'error') return;
        if (ch.retries >= MAX_RETRIES) return this.setStatus(ch, { state: 'error', detail: 'انقطع الاتصال بشات القناة' });
        this.setStatus(ch, { state: 'connecting', detail: 'إعادة الاتصال...' });
        ch.timer = setTimeout(() => void this.start(key, ch), (this.opts.retryMs ?? 2000) * 2 ** ch.retries++);
      },
    });
  }

  private stop(key: string, ch: Channel) {
    this.channels.delete(key);
    if (ch.timer) clearTimeout(ch.timer);
    if (ch.handshake) clearTimeout(ch.handshake);
    ch.upstream?.close();
  }

  closeAll() {
    for (const [key, ch] of this.channels) this.stop(key, ch);
  }
}
