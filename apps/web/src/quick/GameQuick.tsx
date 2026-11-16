// The shortcuts center of the main game: what it offers depends on where the player is (home, lobby, game).
import { useQuery } from '@tanstack/react-query';
import type { RoomView, Variant } from '@quiz/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toggleFullscreen } from '@/lib/hotkeys';
import { serverUrl } from '@/lib/server';
import { setSoundEnabled, useSoundEnabled } from '@/game/fx/sound';
import { emit, preselectCategory } from './bus';
import { QuickAccess, spotlight, type QaItem, type QaSection } from './QuickAccess';
import { useLocalStats } from './stats';

export const VARIANTS: { id: Variant; icon: string; title: string; hint: string; keywords: string }[] = [
  { id: 'swap', icon: '🔄', title: 'جاوب أو بادل', hint: 'بادل جواب الخصم: صح = دبل، غلط = تنقص', keywords: 'swap بادل' },
  { id: 'flip', icon: '🔀', title: 'جاوب أو اقلب', hint: 'اقلب نتيجة الخصم عليه', keywords: 'flip اقلب' },
  { id: 'triple', icon: '↩️', title: 'جاوب أو بادل أو اعكس', hint: 'ثلاث خيارات، وبادل أو اعكس لفريق واحد', keywords: 'triple اعكس reverse' },
  { id: 'hide', icon: '📦', title: 'خبّي أو اكشف', hint: '10 صناديق ومفتاح وزر تلميح', keywords: 'hide صناديق مفتاح' },
];
const VARIANT_NAME: Record<string, string> = Object.fromEntries(VARIANTS.map((v) => [v.id, v.title]));

/** The player's record on this device, as a small visual card. */
function StatsCard() {
  const s = useLocalStats();
  if (!s.games) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/4 p-3 text-center text-xs leading-relaxed text-white/60">
        📊 إحصائياتك تظهر هنا بعد أول لعبة تكملها — محفوظة في جهازك بس.
      </div>
    );
  }
  const rate = Math.round((s.wins / s.games) * 100);
  const max = Math.max(1, ...Object.values(s.byVariant).map((n) => n ?? 0));
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0" role="img" aria-label={`نسبة الفوز ${rate}٪`}>
          <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#qa-win)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${rate} 100`} />
            <defs>
              <linearGradient id="qa-win" x1="0" x2="1">
                <stop offset="0" stopColor="#f7c948" />
                <stop offset="1" stopColor="#ff6b35" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-sm font-black tabular-nums">{rate}٪</div>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1.5 text-center">
          {(
            [
              ['لعبت', s.games, 'text-white'],
              ['فزت', s.wins, 'text-q-green'],
              ['أعلى نقاط', s.best, 'text-q-gold'],
            ] as const
          ).map(([l, n, c]) => (
            <div key={l} className="rounded-lg bg-black/20 py-1">
              <div className={`text-base font-black tabular-nums ${c}`}>{n}</div>
              <div className="text-[10px] text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2.5 space-y-1">
        {VARIANTS.filter((v) => s.byVariant[v.id]).map((v) => (
          <div key={v.id} className="flex items-center gap-2 text-[11px]">
            <span className="w-28 truncate text-white/70">
              {v.icon} {v.title}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <span className="block h-full rounded-full bg-linear-to-l from-q-cyan to-q-purple" style={{ width: `${((s.byVariant[v.id] ?? 0) / max) * 100}%` }} />
            </span>
            <span className="w-5 text-end font-black tabular-nums">{s.byVariant[v.id]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameQuick({ view, leave, onKeys }: { view: RoomView | null; leave: () => void; onKeys: () => void }) {
  const sound = useSoundEnabled();
  const atHome = !view;
  const inLobby = view?.status === 'lobby';
  const isHost = Boolean(view?.canKick);
  const { data: categories } = useQuery({ queryKey: ['public-categories'], queryFn: api.publicCategories, enabled: atHome || (inLobby && isHost), staleTime: 60_000 });

  const sections: QaSection[] = [];

  if (atHome) {
    sections.push({
      id: 'start',
      title: '🚀 ابدأ',
      items: [
        { id: 'home', icon: '🏠', title: 'الصفحة الرئيسية', hint: 'أعلى الصفحة', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        { id: 'create', icon: '🎮', title: 'إنشاء غرفة', hint: 'غرفة جديدة على الجوال', keywords: 'create room', run: () => (emit('home:mode', 'mobile'), emit('home:tab', 'create'), spotlight('play-panel', '#create-name')) },
        { id: 'tv', icon: '📺', title: 'إنشاء غرفة للتلفاز', hint: 'التلفاز يعرض والفريقين على جوالاتهم', keywords: 'tv تلفزيون', run: () => (emit('home:mode', 'tv'), emit('home:tab', 'create'), spotlight('play-panel')) },
        { id: 'join', icon: '🔗', title: 'الانضمام إلى غرفة', hint: 'بكود الغرفة', keywords: 'join code كود', run: () => (emit('home:tab', 'join'), spotlight('play-panel', '#join-code')) },
      ],
    });
    sections.push({
      id: 'modes',
      title: '🎲 أطوار اللعب',
      items: [
        ...VARIANTS.map<QaItem>((v) => ({ id: `v-${v.id}`, icon: v.icon, title: v.title, hint: v.hint, keywords: v.keywords, run: () => (emit('home:variant', v.id), spotlight('modes')) })),
        { id: 'v-list', icon: '⏱️', title: 'عدّها', hint: 'طور البث: الشات يعدّ أكثر عدد أجوبة', badge: 'في البث', keywords: 'list count عدها', run: () => window.location.assign('/kick/quiz') },
      ],
    });
  }

  if ((atHome || (inLobby && isHost)) && categories?.length) {
    sections.push({
      id: 'cats',
      title: atHome ? '🗂️ فئات الأسئلة — تنختار لما تنشئ الغرفة' : '🗂️ فئات الأسئلة — اختر أو شيل',
      items: categories
        .filter((c) => c.playable)
        .map<QaItem>((c) => ({
          id: `c-${c.id}`,
          icon: c.icon,
          title: c.name,
          keywords: c.slug,
          stay: !atHome,
          run: () => {
            if (atHome) {
              const n = preselectCategory(c.id).length;
              toast.success(`«${c.name}» بتكون مختارة في الغرفة (${n} فئات)`);
              emit('home:tab', 'create');
              spotlight('play-panel');
            } else emit('lobby:toggleCategory', c.id);
          },
        })),
    });
  }

  if (view) {
    const room: QaItem[] = [];
    if (inLobby) room.push({ id: 'invite', icon: '📨', title: 'نسخ رابط الدعوة', hint: `كود الغرفة ${view.code}`, run: () => emit('lobby:invite') });
    room.push({ id: 'leave', icon: '🚪', title: 'خروج من الغرفة', hint: VARIANT_NAME[view.variant] ? `أنت في «${VARIANT_NAME[view.variant]}»` : undefined, run: leave });
    sections.push({ id: 'room', title: `🏷️ الغرفة ${view.code}`, items: room });
  }

  sections.push({
    id: 'settings',
    title: '⚙️ الإعدادات والمساعدة',
    items: [
      { id: 'sound', icon: sound ? '🔊' : '🔇', title: sound ? 'كتم الأصوات' : 'تشغيل الأصوات', badge: 'M', stay: true, run: () => setSoundEnabled(!sound) },
      { id: 'full', icon: '⛶', title: 'ملء الشاشة', hint: 'مفيد على التلفاز', badge: 'F', run: () => void toggleFullscreen() },
      { id: 'keys', icon: '⌨️', title: 'اختصارات لوحة المفاتيح', badge: '؟', run: onKeys },
      ...(atHome ? [{ id: 'how', icon: '📖', title: 'طريقة اللعب', hint: 'القواعد وأمثلة النقاط', keywords: 'help قواعد', run: () => emit('home:how') }] : []),
      { id: 'stream', icon: '🟢', title: 'صفحة الستريمر (Kick)', hint: 'العب مع شات البث', keywords: 'kick stream بث', run: () => window.location.assign('/kick/quiz') },
      { id: 'support', icon: '💬', title: 'الدعم', run: () => window.open(serverUrl('/support'), '_blank', 'noopener') },
      { id: 'privacy', icon: '🔒', title: 'سياسة الخصوصية', run: () => window.open(serverUrl('/privacy'), '_blank', 'noopener') },
    ],
  });

  return <QuickAccess site="game" sections={sections} header={<StatsCard />} />;
}
