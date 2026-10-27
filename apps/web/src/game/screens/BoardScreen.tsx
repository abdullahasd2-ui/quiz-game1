import { canPick, cellKey, POINTS, type RoomView } from '@quiz/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Scorebar, teamName } from '../ui';

const POINT_TONE: Record<number, string> = {
  100: 'text-q-green border-q-green/30',
  200: 'text-q-blue border-q-blue/30',
  300: 'text-q-gold border-q-gold/30',
  400: 'text-q-orange border-q-orange/30',
  500: 'text-q-red border-q-red/30',
};

export function BoardScreen({ view }: { view: RoomView }) {
  const isMember = view.role === 'member';
  const mayPick = canPick(view.mode, view.you, view.turn) && !isMember;
  // Members of the team whose turn it is vote on the cell; their captain taps to decide.
  const mayVote = isMember && view.you === view.turn;
  const [pending, setPending] = useState<string | null>(null);
  const turnName = teamName(view, view.turn);

  async function pick(categoryId: number, points: number) {
    setPending(cellKey(categoryId, points));
    const res = mayVote ? await send('game:vote', { key: cellKey(categoryId, points) }) : await send('game:pick', { categoryId, points });
    setPending(null);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <div className="animate-fade-up">
      <Scorebar view={view} highlightTurn />
      <div className="mb-2.5 text-center text-[13px] text-white/50">
        {view.you === view.turn && isMember ? (
          <>
            <b className="text-q-gold">دور فريقك!</b> صوّت على السؤال — والرئيس يقرر
          </>
        ) : view.you === view.turn ? (
          <>
            <b className="text-q-gold">دورك!</b> اختار سؤالاً
            {view.votes && Object.keys(view.votes.counts).length > 0 && <span className="text-white/50"> (الأرقام = أصوات فريقك)</span>}
          </>
        ) : (
          <>
            دور <span className="font-bold text-q-gold">{turnName}</span> في اختيار السؤال
          </>
        )}
      </div>
      <div className="-mx-1 overflow-x-auto pb-2">
        <table className="w-full min-w-max border-separate border-spacing-1.5">
          <thead>
            <tr>
              {view.categories.map((c) => (
                <th key={c.id} className="min-w-16 rounded-lg border border-q-line bg-linear-to-br from-[#1a1a40] to-[#2a1a50] px-1 py-2.5 text-xs font-bold text-q-gold">
                  <div className="text-lg">{c.icon}</div>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POINTS.map((pts) => (
              <tr key={pts}>
                {view.categories.map((c) => {
                  const key = cellKey(c.id, pts);
                  const used = view.used.includes(key);
                  const votes = used ? 0 : (view.votes?.counts[key] ?? 0);
                  const mine = view.votes?.mine === key;
                  return (
                    <td key={key} className="p-0.5">
                      <button
                        type="button"
                        disabled={used || !(mayPick || mayVote) || pending !== null}
                        onClick={() => pick(c.id, pts)}
                        aria-label={`${c.name} ${pts}`}
                        className={cn(
                          'w-full rounded-lg border bg-q-panel px-1 py-3 text-[15px] font-black tabular-nums transition-transform',
                          POINT_TONE[pts],
                          used && 'border-transparent bg-[#1a1a2a] line-through opacity-35 grayscale',
                          !used && (mayPick || mayVote) && 'hover:scale-105',
                          !used && !(mayPick || mayVote) && 'cursor-default opacity-60',
                          mine && 'ring-2 ring-q-gold',
                          pending === key && 'animate-pulse',
                        )}
                      >
                        {used ? '✅' : pts}
                        {votes > 0 && <span className="mt-0.5 block text-[10px] font-bold text-q-cyan">🗳️ {votes}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Tv-mode phones while the TV picks the next question. */
export function WaitingForPick({ view }: { view: RoomView }) {
  return (
    <div className="animate-fade-up">
      <Scorebar view={view} highlightTurn />
      <div className="px-5 py-10 text-center">
        <div className="mb-3 text-5xl">⏳</div>
        <p className="text-sm leading-loose text-white/50">
          دور <span className="font-bold text-q-gold">{teamName(view, view.turn)}</span> في اختيار السؤال
          <br />
          رئيس الفريق يختار السؤال وبيظهر على التلفاز...
        </p>
      </div>
    </div>
  );
}
