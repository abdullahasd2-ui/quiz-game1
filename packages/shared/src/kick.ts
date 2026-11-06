import type { Ack } from './game';

/** Kick channel slugs: letters, digits, `_` and `-`. */
export const KICK_CHANNEL_RE = /^[A-Za-z0-9_-]{1,25}$/;

export type KickWatchInput = { channel: string; /** Skip the lookup when the server can't resolve the chat room by itself. */ chatroomId?: number };
export type KickStatus = { state: 'connecting' | 'live' | 'error'; detail?: string };
export type KickMessage = { user: string; text: string };

/** Socket.IO namespace `/kick`: the stream page asks the server to relay one channel's chat. */
export interface KickClientToServerEvents {
  'kick:watch': (input: KickWatchInput, reply: (res: Ack) => void) => void;
}
export interface KickServerToClientEvents {
  'kick:message': (m: KickMessage) => void;
  'kick:status': (s: KickStatus) => void;
}

/** Kick's own site reads chat through this public Pusher app; the same read-only feed works for us. */
export const KICK_PUSHER_URL = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false';

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

/** What to do with one incoming Pusher frame: a reply to send, "the chat is live", or a chat message. */
export function handleKickFrame(raw: string, chatroomId: number): { send?: string; live?: true; message?: KickMessage } {
  let event: string | undefined;
  try {
    event = (JSON.parse(raw) as { event?: string }).event;
  } catch {
    return {};
  }
  if (event === 'pusher:connection_established') {
    return { send: JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }) };
  }
  if (event === 'pusher_internal:subscription_succeeded') return { live: true };
  if (event === 'pusher:ping') return { send: JSON.stringify({ event: 'pusher:pong', data: {} }) };
  const message = parseKickFrame(raw);
  return message ? { message } : {};
}
