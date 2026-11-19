import { connectKickChat, kickPusherUrl, kickSlugs, type KickClientToServerEvents, type KickPusher, type KickServerToClientEvents, type KickStatus } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '@/lib/server';

/** The channel's chat room, looked up from the streamer's browser (each spelling of the name, both Kick endpoints). */
export async function findChatroom(slugs: string[]): Promise<{ slug: string; id: number } | null> {
  for (const slug of slugs) {
    for (const path of ['api/v2/channels', 'api/v1/channels']) {
      try {
        const res = await fetch(`https://kick.com/${path}/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        const id = ((await res.json()) as { chatroom?: { id?: number } }).chatroom?.id;
        if (Number.isInteger(id)) return { slug, id: id! };
      } catch {
        // Blocked (Kick's API does not answer other sites), offline or not found: try the next way.
      }
    }
  }
  // Kick's API refuses other websites in a browser, but answers our server: it only looks the number up, and the
  // browser still opens the chat itself.
  for (const slug of slugs) {
    try {
      const res = await fetch(`${SERVER_URL}/api/kick/chatroom/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const { id } = (await res.json()) as { id?: number };
      if (Number.isInteger(id)) return { slug, id: id! };
    } catch {
      // Try the next spelling.
    }
  }
  return null;
}

type KickSocket = Socket<KickServerToClientEvents, KickClientToServerEvents>;

/**
 * Reads one Kick channel's public chat while `enabled`: from the browser first (Kick blocks servers more often than
 * viewers), through our server if the browser can't. Returns the connection status.
 */
export function useKickChat(channel: string, enabled: boolean, onMessage: (user: string, text: string) => void): KickStatus | null {
  const [status, setStatus] = useState<KickStatus | null>(null);
  const cb = useRef(onMessage);
  cb.current = onMessage;
  useEffect(() => {
    if (!enabled || !channel.trim()) return setStatus(null);
    let gone = false;
    let stopBrowser: (() => void) | null = null;
    let socket: KickSocket | null = null;
    const slugs = kickSlugs(channel);
    const viaServer = (hit: { slug: string; id: number } | null) => {
      if (gone || socket) return;
      socket = io(`${SERVER_URL}/kick`);
      socket.on('connect', () =>
        socket!.emit('kick:watch', { channel: hit?.slug ?? slugs[0] ?? channel.trim(), chatroomId: hit?.id }, (res) => {
          if (!res.ok) setStatus({ state: 'error', detail: res.error });
        }),
      );
      socket.on('kick:status', setStatus);
      socket.on('kick:message', (m) => cb.current(m.user, m.text));
      socket.on('connect_error', () => setStatus({ state: 'error', detail: 'تعذّر الاتصال بالسيرفر' }));
    };
    setStatus({ state: 'connecting', detail: 'جاري البحث عن القناة...' });
    void findChatroom(slugs).then(async (hit) => {
      if (gone) return;
      if (!hit) return viaServer(null);
      let live = false;
      const pusher = await fetch(`${SERVER_URL}/api/kick/pusher`, { signal: AbortSignal.timeout(8000) })
        .then((r) => (r.ok ? (r.json() as Promise<KickPusher>) : undefined))
        .catch(() => undefined);
      if (gone) return;
      stopBrowser = connectKickChat({
        chatroomId: hit.id,
        url: kickPusherUrl(pusher),
        handshakeMs: 10000,
        maxRetries: 3,
        onMessage: (m) => cb.current(m.user, m.text),
        onStatus: (st) => {
          if (gone) return;
          if (st.state === 'live') live = true;
          if (st.state === 'error' && !live) {
            stopBrowser?.();
            stopBrowser = null;
            return viaServer(hit);
          }
          setStatus(st);
        },
      });
    });
    return () => {
      gone = true;
      stopBrowser?.();
      socket?.disconnect();
    };
  }, [channel, enabled]);
  return status;
}
