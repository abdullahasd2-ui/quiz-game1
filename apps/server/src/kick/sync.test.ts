import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chatMessage, deal, newStream, streamerAct, toBoard, type ControlAct, type StreamState, type SyncView } from '@quiz/shared';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { describe, expect, it } from 'vitest';
import { attachKickSync } from './sync';

const q = { text: 'س؟', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 2, points: 300, imageUrl: null };
const HOST = 'h'.repeat(20);
const KEY = 'k'.repeat(20);

describe('kick sync', () => {
  it('only the control page with the secret key sees the full game and can send the streamer choices to the host', async () => {
    const http = createServer();
    const io = new Server(http);
    attachKickSync(io);
    await new Promise<void>((r) => http.listen(0, r));
    const url = `http://localhost:${(http.address() as AddressInfo).port}/kick-sync`;
    const host = client(url);
    const ctl = client(url);
    const stranger = client(url);
    const thief = client(url);
    const ack = (s: ReturnType<typeof client>, ev: string, arg: unknown) => new Promise<{ ok: boolean }>((res) => s.emit(ev, arg, res));

    const state: StreamState = streamerAct(deal(toBoard(chatMessage(newStream('S', 6), 'Ali', 'دخول')), '1:300', q, 0), { type: 'show' }, 0);
    const seen: SyncView[] = [];
    const acts: ControlAct[] = [];
    ctl.on('sync:view', (v: SyncView) => seen.push(v));
    host.on('sync:act', (a: ControlAct) => acts.push(a));

    expect((await ack(host, 'sync:publish', { code: 'ROOM1234', hostKey: HOST, controlKey: KEY, state, hostNow: 1 })).ok).toBe(true);
    expect((await ack(thief, 'sync:publish', { code: 'ROOM1234', hostKey: 'x'.repeat(20), controlKey: KEY, state: null, hostNow: 2 })).ok).toBe(false);
    expect((await ack(stranger, 'sync:control', { code: 'ROOM1234', key: 'z'.repeat(20) })).ok).toBe(false);
    expect((await ack(ctl, 'sync:control', { code: 'ROOM1234', key: KEY })).ok).toBe(true);
    expect((await ack(stranger, 'sync:act', { code: 'ROOM1234', key: 'z'.repeat(20), act: { type: 'answer', index: 1 } })).ok).toBe(false);
    expect((await ack(ctl, 'sync:act', { code: 'ROOM1234', key: KEY, act: { type: 'answer', index: 9 } })).ok).toBe(false);
    expect((await ack(ctl, 'sync:act', { code: 'ROOM1234', key: KEY, act: { type: 'answer', index: 2 } })).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 100));

    expect(seen[0]!.state?.round?.question.correctIndex).toBe(2);
    expect(acts).toEqual([{ type: 'answer', index: 2 }]);
    for (const c of [host, ctl, stranger, thief]) c.close();
    io.close();
  });
});
