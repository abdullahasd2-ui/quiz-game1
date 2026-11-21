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

/** In the host's own mobile seat the first captain is the host themself, who can't be kicked. */
export const isSelf = (view: RoomView, t: TeamIndex, m: MemberView) => view.mode === 'mobile' && t === 0 && m.captain;

/** Everyone in both teams, with a kick button for the host. */
export function PlayersList({ view }: { view: RoomView }) {
  return (
    <div className="grid gap-3 text-start">
      {([0, 1] as const).map((t) => (
        <div key={t} className={cn('rounded-xl border p-3', TEAM_TINT[t])}>
          <div className="mb-1.5 text-xs font-bold text-white/80">
            {teamName(view, t)} ({view.teams[t]?.members.length ?? 0})
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

/** Solo: the host's 👥 button — every player, with a kick button. */
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
        👥 اللاعبون
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-q-gold">👥 اللاعبون</h2>
          <button type="button" onClick={() => setOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-black text-white" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="grid gap-2 text-start">
          {view.players.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-q-line bg-q-bg/60 px-3 py-2 text-sm">
              <span className={cn('truncate font-bold', !p.connected && 'opacity-40')}>
                {p.host ? '👑 ' : '🙋 '}
                {p.name}
              </span>
              <div className="flex items-center gap-2">
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
        👥 اللاعبون
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-q-gold">👥 اللاعبون</h2>
          <button type="button" onClick={() => setOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-black text-white" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <PlayersList view={view} />
      </Modal>
    </>
  );
}
