import type { MemberView, RoomView, SoloView, TeamIndex } from '@quiz/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Modal, TEAM_TINT, teamName } from '../ui';

/** Removes a player (host only) after a confirmation; the server bans the device from rejoining. */
export async function kickPlayer(member: MemberView) {
  if (!window.confirm(`طرد ${member.name} من الغرفة؟`)) return;
  const res = await send('room:kick', { id: member.id });
  if (!res.ok) toast.error(res.error);
  else toast.success(`تم طرد ${member.name}`);
}

/** Host only: − / + buttons that change a score by hand (small steps in «عدّها», whose points are small). */
export function ScoreControl({ id, score, list }: { id: string; score: number; list: boolean }) {
  const [busy, setBusy] = useState(false);
  const steps = list ? [1, 5] : [50, 100];
  async function change(delta: number) {
    setBusy(true);
    const res = await send('game:score', { id, delta });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[-steps[1]!, -steps[0]!].map((d) => (
        <button key={d} type="button" disabled={busy} onClick={() => change(d)} className="rounded-lg border border-q-red/40 bg-q-red/10 px-1.5 py-0.5 text-[11px] font-black text-q-red disabled:opacity-50">
          {d}
        </button>
      ))}
      <span className="q-display min-w-12 text-center text-lg tabular-nums text-q-gold">{score}</span>
      {steps.map((d) => (
        <button key={d} type="button" disabled={busy} onClick={() => change(d)} className="rounded-lg border border-q-green/40 bg-q-green/10 px-1.5 py-0.5 text-[11px] font-black text-q-green disabled:opacity-50">
          +{d}
        </button>
      ))}
    </div>
  );
}

/** In the host's own mobile seat the first captain is the host themself, who can't be kicked. */
export const isSelf = (view: RoomView, t: TeamIndex, m: MemberView) => view.mode === 'mobile' && t === 0 && m.captain;

/** Everyone in both teams, with a kick button for the host. */
export function PlayersList({ view }: { view: RoomView }) {
  return (
    <div className="grid gap-3 text-start">
      {([0, 1] as const).map((t) => (
        <div key={t} className={cn('rounded-xl border p-3', TEAM_TINT[t])}>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-white/80">
            <span>
              {teamName(view, t)} ({view.teams[t]?.members.length ?? 0})
            </span>
            {view.canKick && view.status === 'playing' && view.teams[t] && <ScoreControl id={String(t)} score={view.teams[t].score} list={view.variant === 'list'} />}
          </div>
          {(view.teams[t]?.members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span className={cn('truncate', !m.connected && 'opacity-40')}>
                {m.captain ? '👑 ' : '• '}
                {m.name}
              </span>
              {view.canKick && !isSelf(view, t, m) && (
                <button type="button" onClick={() => kickPlayer(m)} className="rounded-full border border-q-red/40 px-2.5 py-0.5 text-[11px] text-q-red">
                  طرد
                </button>
              )}
            </div>
          ))}
          {!view.teams[t] && <div className="text-xs text-white/40">لا أحد بعد</div>}
        </div>
      ))}
    </div>
  );
}

/** Solo: the host's 👥 button — every player with their score controls and a kick button. */
export function SoloPlayersButton({ view }: { view: SoloView }) {
  const [open, setOpen] = useState(false);
  if (!view.host) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-[calc(env(safe-area-inset-top)+0.625rem)] left-[8.5rem] z-40 rounded-full border border-q-line bg-q-panel px-3.5 py-1.5 text-xs text-white/70"
      >
        👥 اللاعبون والنقاط
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-q-gold">👥 اللاعبون والنقاط</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xl text-white/50" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <p className="mb-3 text-start text-[11px] text-white/55">تقدر تزيد أو تنقص نقاط أي لاعب، والكل يشوف التعديل على طول.</p>
        <div className="grid gap-2 text-start">
          {view.players.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-q-line bg-q-bg/60 px-3 py-2 text-sm">
              <span className={cn('truncate font-bold', !p.connected && 'opacity-40')}>
                {p.host ? '👑 ' : '🙋 '}
                {p.name}
              </span>
              <div className="flex items-center gap-2">
                <ScoreControl id={p.id} score={p.score} list={view.variant === 'list'} />
                {p.id !== view.you && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`طرد ${p.name} من الغرفة؟`)) return;
                      const res = await send('room:kick', { id: p.id });
                      if (!res.ok) toast.error(res.error);
                    }}
                    className="rounded-full border border-q-red/40 px-2 py-0.5 text-[11px] text-q-red"
                  >
                    طرد
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

/** In-game: the host's 👥 button opens the player list so they can remove someone who joined. */
export function PlayersButton({ view }: { view: RoomView }) {
  const [open, setOpen] = useState(false);
  if (!view.canKick) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-[calc(env(safe-area-inset-top)+0.625rem)] left-[8.5rem] z-40 rounded-full border border-q-line bg-q-panel px-3.5 py-1.5 text-xs text-white/70"
      >
        👥 اللاعبون والنقاط
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-q-gold">👥 اللاعبون والنقاط</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xl text-white/50" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <PlayersList view={view} />
      </Modal>
    </>
  );
}
