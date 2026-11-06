import { generateKeyPairSync, createSign } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { KickChatHub } from './chat';
import { kickOAuthRoutes } from './oauth';

describe('kick webhook', () => {
  it('delivers signed chat messages and rejects forged ones', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const fetchImpl = (async () => new Response(JSON.stringify({ data: { public_key: pem } }))) as typeof fetch;
    const hub = new KickChatHub();
    const got: string[] = [];
    hub.watch('streamer', undefined, { onMessage: (m) => got.push(`${m.user}:${m.text}`), onStatus: () => {} }, true);
    const app = Fastify();
    await app.register(kickOAuthRoutes, { hub, clientId: 'id', clientSecret: 's', origin: 'http://x', fetchImpl });
    const body = JSON.stringify({ broadcaster: { username: 'Streamer', channel_slug: 'streamer' }, sender: { username: 'ali' }, content: 'دخول' });
    const sign = (b: string) => createSign('RSA-SHA256').update(`m1.2026-01-01T00:00:00Z.${b}`).sign(privateKey, 'base64');
    const headers = (sig: string) => ({
      'content-type': 'application/json',
      'kick-event-message-id': 'm1',
      'kick-event-message-timestamp': '2026-01-01T00:00:00Z',
      'kick-event-type': 'chat.message.sent',
      'kick-event-signature': sig,
    });
    const bad = await app.inject({ method: 'POST', url: '/api/kick/webhook', headers: headers('AAAA'), payload: body });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/kick/webhook', headers: headers(sign(body)), payload: body });
    expect(ok.statusCode).toBe(200);
    expect(got).toEqual(['ali:دخول']);
    hub.closeAll();
  });
});
