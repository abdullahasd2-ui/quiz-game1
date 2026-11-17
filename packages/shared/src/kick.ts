import type { Ack } from './game';

/** Kick channel slugs: letters, digits, `_` and `-`. */
export const KICK_CHANNEL_RE = /^[A-Za-z0-9_-]{1,25}$/;

/**
 * The channel addresses to try for what the streamer typed: a full link, «@name» or the name itself all work,
 * and an underscore is also tried as a hyphen (Kick turns «abo_ali» into kick.com/abo-ali).
 */
export function kickSlugs(input: string): string[] {
  const name = input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?kick\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#\s]/)[0]!
    .toLowerCase();
  return [...new Set([name.replace(/_/g, '-'), name])].filter((s) => KICK_CHANNEL_RE.test(s));
}

export type KickWatchInput = { channel: string; /** Skip the lookup when the server can't resolve the chat room by itself. */ chatroomId?: number; /** Chat arrives through the linked Kick app (webhook), not by reading Kick's site. */ official?: boolean };
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

/** Kick's chat feed (its public Pusher app): key and cluster. Kick rotates them (the old 32cbd69e… key was retired in
 *  Oct 2026 with error 4001 «not in this cluster»), so the server asks Kick for the current ones; this is the fallback. */
export type KickPusher = { key: string; cluster: string };
export const KICK_PUSHER_FALLBACK: KickPusher = { key: '34bf7a0ff419a2a775b9', cluster: 'us2' };
export const kickPusherUrl = (p: KickPusher = KICK_PUSHER_FALLBACK) =>
  `wss://ws-${p.cluster}.pusher.com/app/${p.key}?protocol=7&client=js&version=8.4.0&flash=false`;
export const KICK_PUSHER_URL = kickPusherUrl();

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
export function handleKickFrame(raw: string, chatroomId: number): { send?: string; live?: true; message?: KickMessage; error?: string } {
  let event: string | undefined;
  let data: unknown;
  try {
    ({ event, data } = JSON.parse(raw) as { event?: string; data?: unknown });
  } catch {
    return {};
  }
  // Kick's chat service refused something: keep its own words, they say why (shown to the streamer).
  if (event === 'pusher:error' || event === 'pusher:subscription_error') {
    const d = (typeof data === 'string' ? (() => { try { return JSON.parse(data) as unknown; } catch { return data; } })() : data) as { code?: unknown; message?: unknown; error?: unknown } | string;
    return { error: typeof d === 'string' ? d : [d?.code, d?.message ?? d?.error].filter((x) => x !== undefined && x !== null).join(' ') || event };
  }
  if (event === 'pusher:connection_established') {
    return { send: JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }) };
  }
  if (event === 'pusher_internal:subscription_succeeded') return { live: true };
  if (event === 'pusher:ping') return { send: JSON.stringify({ event: 'pusher:pong', data: {} }) };
  const message = parseKickFrame(raw);
  return message ? { message } : {};
}
