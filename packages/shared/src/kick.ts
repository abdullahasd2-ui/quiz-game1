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
