import { handleKickFrame, KICK_PUSHER_URL, type KickMessage, type KickStatus } from './kick';

export type KickChatOptions = {
  chatroomId: number;
  onStatus(s: KickStatus): void;
  onMessage(m: KickMessage): void;
  /** Tests point this at a local fake Pusher. */
  url?: string;
  retryMs?: number;
  handshakeMs?: number;
  maxRetries?: number;
};

/**
 * Reads one Kick chat room straight from the caller's own network (the stream page runs it in the
 * browser, so Kick sees an ordinary viewer instead of a server). Reconnects with backoff; returns a stop function.
 */
export function connectKickChat(o: KickChatOptions): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let handshake: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (handshake) clearTimeout(handshake);
    handshake = null;
  };

  // Why Kick's chat service ended the last connection (its error, or the close code), shown to the streamer.
  let why = '';
  const open = () => {
    o.onStatus({ state: 'connecting', detail: retries ? `إعادة الاتصال... (${why || 'انقطع'} · شات رقم ${o.chatroomId})` : `جاري الاتصال بالشات (رقم ${o.chatroomId})...` });
    let live = false;
    const sock = new WebSocket(o.url ?? KICK_PUSHER_URL);
    ws = sock;
    handshake = setTimeout(() => {
      if (live || stopped) return;
      o.onStatus({ state: 'error', detail: `ما رد شات Kick${why ? ` (${why})` : ''} — شات رقم ${o.chatroomId}` });
      stopped = true;
      sock.close();
    }, o.handshakeMs ?? 12000);
    sock.onmessage = (ev) => {
      const r = handleKickFrame(String(ev.data), o.chatroomId);
      if (r.send) sock.send(r.send);
      if (r.live) {
        live = true;
        retries = 0;
        clear();
        o.onStatus({ state: 'live' });
      }
      if (r.message) o.onMessage(r.message);
      if (r.error) why = r.error;
    };
    // Browsers send "error" then "close"; Node's WebSocket sends only "error" when the connection fails,
    // so both lead to the same one-shot handler (and close() inside it can't loop).
    let ended = false;
    const end = (ev?: Event) => {
      const code = (ev as CloseEvent | undefined)?.code;
      if (!why && code && code !== 1000 && code !== 1005) why = `رمز ${code}${(ev as CloseEvent).reason ? ` ${(ev as CloseEvent).reason}` : ''}`;
      if (ended) return;
      ended = true;
      clear();
      try {
        sock.close();
      } catch {
        /* already closed */
      }
      if (stopped) return;
      if (retries >= (o.maxRetries ?? 5)) {
        o.onStatus({ state: 'error', detail: `انقطع الاتصال بشات القناة${why ? ` (${why})` : ''} — شات رقم ${o.chatroomId}` });
        return;
      }
      timer = setTimeout(open, (o.retryMs ?? 2000) * 2 ** retries++);
    };
    sock.onerror = end;
    sock.onclose = end;
  };
  open();

  return () => {
    stopped = true;
    clear();
    if (timer) clearTimeout(timer);
    ws?.close();
  };
}
