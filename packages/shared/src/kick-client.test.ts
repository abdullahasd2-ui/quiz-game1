import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { connectKickChat } from './kick-client';
import type { KickStatus } from './kick';

const servers: WebSocketServer[] = [];
afterEach(() => servers.splice(0).forEach((s) => s.close()));

function fakePusher(opts: { silent?: boolean } = {}) {
  const wss = new WebSocketServer({ port: 0 });
  servers.push(wss);
  const received: string[] = [];
  wss.on('connection', (sock) => {
    if (opts.silent) return;
    sock.send(JSON.stringify({ event: 'pusher:connection_established', data: '{}' }));
    sock.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as { event: string; data: { channel?: string } };
      received.push(`${msg.event}:${msg.data.channel ?? ''}`);
      if (msg.event === 'pusher:subscribe') {
        sock.send(JSON.stringify({ event: 'pusher_internal:subscription_succeeded', data: '{}' }));
        sock.send(
          JSON.stringify({
            event: 'App\\Events\\ChatMessageEvent',
            data: JSON.stringify({ content: 'دخول', sender: { username: 'Ali' } }),
          }),
        );
        sock.send(JSON.stringify({ event: 'pusher:ping', data: '{}' }));
      }
    });
  });
  const port = (wss.address() as { port: number }).port;
  return { url: `ws://127.0.0.1:${port}`, received };
}

const until = async (cond: () => boolean, ms = 2000) => {
  const t = Date.now();
  while (!cond() && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 10));
};

describe('connectKickChat', () => {
  it('subscribes to the chat room, goes live and delivers messages', async () => {
    const { url, received } = fakePusher();
    const statuses: KickStatus[] = [];
    const messages: unknown[] = [];
    const stop = connectKickChat({ chatroomId: 4242, url, onStatus: (s) => statuses.push(s), onMessage: (m) => messages.push(m) });
    await until(() => messages.length > 0 && received.includes('pusher:pong:'));
    stop();
    expect(received).toContain('pusher:subscribe:chatrooms.4242.v2');
    expect(statuses.at(-1)).toEqual({ state: 'live' });
    expect(messages).toEqual([{ user: 'Ali', text: 'دخول' }]);
    expect(received).toContain('pusher:pong:');
  });

  it('reports an error when Kick never confirms the subscription', async () => {
    const { url } = fakePusher({ silent: true });
    const statuses: KickStatus[] = [];
    const stop = connectKickChat({ chatroomId: 1, url, handshakeMs: 80, onStatus: (s) => statuses.push(s), onMessage: () => {} });
    await until(() => statuses.at(-1)?.state === 'error');
    stop();
    expect(statuses.at(-1)).toMatchObject({ state: 'error', detail: expect.stringContaining('ما رد شات Kick') });
  });

  it('retries and finally errors out when the server is unreachable', async () => {
    const statuses: KickStatus[] = [];
    const stop = connectKickChat({ chatroomId: 1, url: 'ws://127.0.0.1:1', retryMs: 5, maxRetries: 2, onStatus: (s) => statuses.push(s), onMessage: () => {} });
    await until(() => statuses.at(-1)?.state === 'error');
    stop();
    expect(statuses.at(-1)).toMatchObject({ state: 'error' });
    expect(statuses.filter((s) => s.state === 'connecting').length).toBeGreaterThanOrEqual(3);
  });
});
