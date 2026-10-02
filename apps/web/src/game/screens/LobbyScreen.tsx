import { MAX_BOARD_CATEGORIES, MIN_BOARD_CATEGORIES, type RoomView, type Seat } from '@quiz/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { teamName } from '../ui';

function Slot({ avatar, name, role, connected, you, tone }: { avatar: string; name: string | null; role?: string; connected: boolean; you: boolean; tone: string }) {
  return (
    <div className={cn('rounded-xl border-2 bg-q-panel p-3.5 text-center transition-colors', connected ? 'border-q-green' : tone)}>
      <div className="mb-1 text-3xl">{avatar}</div>
      <div className="truncate text-[13px] font-bold">{name ?? 'في انتظار...'}</div>
      {role && <div className="mt-0.5 text-[10px] font-bold text-q-purple">{role}</div>}
      <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-white/50">
        <span className={cn('inline-block size-1.5 rounded-full', connected ? 'bg-q-green' : 'animate-blink bg-q-gold')} />
        {connected ? (you ? 'أنت' : 'متصل') : name ? 'انقطع الاتصال' : 'ينتظر'}
      </div>
    </div>
  );
}

export function LobbyScreen({ view }: { view: RoomView }) {
  const isTv = view.mode === 'tv';
  const host: Seat = isTv ? 'tv' : 0;
  const isHost = view.you === host;
  const ready = Boolean(view.teams[0] && view.teams[1]);

  async function copyLink() {
    const link = `${location.origin}/?code=${view.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('تم نسخ رابط الدعوة');
    } catch {
      toast.info(link);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="pt-4 pb-2.5 text-center">
        {isTv && <div className="mb-1.5 text-[13px] font-bold text-q-purple">📺 وضع التلفاز</div>}
        <div className="mb-1.5 text-xs text-white/50">كود الغرفة — شاركه مع {isTv ? 'الفريقين' : 'صديقك'}</div>
        <div
          className="my-1.5 inline-block rounded-2xl bg-linear-to-l from-q-orange to-q-gold px-6 py-3 text-[32px] font-black tracking-[0.3em] text-black"
          dir="ltr"
          data-testid="room-code"
        >
          {view.code}
        </div>
        <div>
          <button type="button" onClick={copyLink} className="text-xs text-white/50 underline-offset-4 hover:text-q-gold hover:underline">
            🔗 نسخ رابط الدعوة
          </button>
        </div>
      </div>

      <div className={cn('my-2.5 grid gap-2.5', isTv ? 'grid-cols-3' : 'grid-cols-2')}>
        {isTv && <Slot avatar="📺" name="التلفاز" role="المضيف" connected={view.tvConnected} you={view.you === 'tv'} tone="border-q-purple/50" />}
        {([0, 1] as const).map((t) => (
          <Slot
            key={t}
            avatar={t === 0 ? '🦁' : '🐯'}
            name={view.teams[t] ? teamName(view, t) : null}
            role={isTv ? (t === 0 ? 'الفريق الأول' : 'الفريق الثاني') : t === 0 ? 'مضيف' : undefined}
            connected={Boolean(view.teams[t]?.connected)}
            you={view.you === t}
            tone={t === 0 ? 'border-q-blue/40' : 'border-q-red/40'}
          />
        ))}
      </div>

      {isHost && ready ? (
        <CategoryPicker tv={isTv} />
      ) : (
        <div className="p-4 text-center text-sm text-white/50">
          {!ready ? '⏳ في انتظار انضمام الفريق الثاني...' : `⏳ في انتظار ${isTv ? 'المضيف (التلفاز)' : 'المضيف'} لبدء اللعبة...`}
        </div>
      )}
    </div>
  );
}

function CategoryPicker({ tv }: { tv: boolean }) {
  const { data: categories, isLoading, isError } = useQuery({ queryKey: ['public-categories'], queryFn: api.publicCategories });
  const [selected, setSelected] = useState<number[]>([]);
  const [starting, setStarting] = useState(false);

  const toggle = (id: number) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_BOARD_CATEGORIES) {
        toast.error(`اختر ${MAX_BOARD_CATEGORIES} فئات كحد أقصى`);
        return s;
      }
      return [...s, id];
    });

  async function start() {
    if (selected.length < MIN_BOARD_CATEGORIES) return toast.error(`اختر ${MIN_BOARD_CATEGORIES} فئات على الأقل!`);
    setStarting(true);
    const res = await send('game:start', { categoryIds: selected });
    setStarting(false);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <div>
      <div className="mb-2.5 text-center text-xs text-white/50">
        اختار الفئات ({MIN_BOARD_CATEGORIES} على الأقل) — مختار {selected.length}
      </div>
      {isError && <div className="mb-2 text-center text-sm text-q-red">تعذر تحميل الفئات</div>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {isLoading && Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[74px] animate-pulse rounded-xl bg-q-panel" />)}
        {categories?.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={!c.playable}
              onClick={() => toggle(c.id)}
              aria-pressed={on}
              title={c.playable ? undefined : 'ليس فيها سؤال مفعّل لكل النقاط'}
              className={cn(
                'rounded-xl border-2 px-1.5 py-3 text-center transition-all',
                on ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel hover:border-q-gold/50',
                !c.playable && 'cursor-not-allowed opacity-35 hover:border-q-line',
              )}
            >
              <div className="mb-1 text-2xl">{c.icon}</div>
              <div className="text-[11px] font-bold">{c.name}</div>
              {!c.playable && <div className="mt-0.5 text-[9px] text-white/50">غير مكتملة</div>}
            </button>
          );
        })}
      </div>
      <button type="button" className={cn('mt-3', tv ? 'q-btn-tv' : 'q-btn-gold')} onClick={start} disabled={starting}>
        {starting ? 'جاري البدء...' : '🚀 ابدأ اللعبة!'}
      </button>
    </div>
  );
}
