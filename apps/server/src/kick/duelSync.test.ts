import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DUEL_DEFAULTS, duelChat, duelDeal, newDuel, type DuelView } from '@quiz/shared';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { describe, expect, it } from 'vitest';
import { attachDuelSync } from './duelSync';

describe('duel sync', () => {
  it('both broadcast pages get the game without the answer, and only the owner can publish', async () => {
    const http = createServer();
    const io = new Server(http);
    attachDuelSync(io);
    await new Promise<void>((r) => http.listen(0, r));
    const url = `http://localhost:${(http.address() as AddressInfo).port}/duel-sync`;
    const host = client(url), screenA = client(url), screenB = client(url), thief = client(url);
    const ack = (s: ReturnType<typeof client>, ev: 'duel:publish' | 'duel:watch', arg: unknown) => new Promise<{ ok: boolean }>((res) => s.emit(ev, arg, res));
    let state = newDuel({ a: 'one', b: 'two' }, DUEL_DEFAULTS, 's');
    state = duelChat(state, 'a', 'ali', 'دخول', 0);
    state = duelDeal(state, { text: 'س؟', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 2, points: 300 }, 0);
    const views: DuelView[] = [];
    screenA.on('duel:view', (v: DuelView) => views.push(v));
    screenB.on('duel:view', (v: DuelView) => views.push(v));
    expect((await ack(screenA, 'duel:watch', 'DUEL1234')).ok).toBe(true);
    expect((await ack(screenB, 'duel:watch', 'DUEL1234')).ok).toBe(true);
    expect((await ack(host, 'duel:publish', { code: 'DUEL1234', hostKey: 'k'.repeat(20), state, hostNow: 1 })).ok).toBe(true);
    expect((await ack(thief, 'duel:publish', { code: 'DUEL1234', hostKey: 'x'.repeat(20), state: null, hostNow: 2 })).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(views).toHaveLength(2);
    expect(JSON.stringify(views[0])).not.toContain('"correctIndex":2');
    host.close(); screenA.close(); screenB.close(); thief.close();
    io.close();
  });
});
