import { MAX_TEAM_SIZE, ROOM_CODE_LENGTH, TEAM_NAME_MAX, type RoomMode, type TeamIndex, type Variant } from '@quiz/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Modal, Steps } from '../ui';
import { HotBadge, usePopular } from '../popular';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { takePreselected, useBus } from '@/quick/bus';
import { streamLink } from '@/lib/links';
import { GAME_VIDEO, VideoGuideButton } from '@/kick/VideoGuide';

/** Each mode's own look: colours, an emblem that shows the idea in motion, and its rule in one line. */
const MODE_LOOK: Record<Variant, { from: string; to: string; ring: string; text: string; emblem: ReactNode; tag: string }> = {
  swap: {
    from: 'from-[#0c3b5e]',
    to: 'to-[#0a1a3a]',
    ring: 'ring-q-cyan',
    text: 'text-q-cyan',
    tag: 'الكلاسيكي',
    emblem: (
      <span className="relative inline-flex h-12 w-20 items-center justify-center">
        <span className="absolute start-1 grid size-9 place-items-center rounded-lg bg-q-gold text-lg text-black shadow-lg motion-safe:animate-[float-y_2.4s_ease-in-out_infinite]">✅</span>
        <span className="absolute end-1 grid size-9 place-items-center rounded-lg bg-q-cyan text-lg text-black shadow-lg motion-safe:animate-[float-y_2.4s_ease-in-out_1.2s_infinite]">؟</span>
        <span className="relative z-10 text-xl drop-shadow">🔄</span>
      </span>
    ),
  },
  flip: {
    from: 'from-[#3b0f5e]',
    to: 'to-[#1a0a3a]',
    ring: 'ring-q-purple',
    text: 'text-q-purple',
    tag: 'قلب النتيجة',
    emblem: (
      <span className="inline-flex h-12 items-center gap-1.5 text-2xl font-black">
        <span className="text-q-green">+</span>
        <span className="motion-safe:animate-[orbit_3s_linear_infinite]">🔀</span>
        <span className="text-q-red">−</span>
      </span>
    ),
  },
  triple: {
    from: 'from-[#5e3b0c]',
    to: 'to-[#2a1a08]',
    ring: 'ring-q-gold',
    text: 'text-q-gold',
    tag: 'ثلاث خيارات',
    emblem: (
      <span className="inline-flex h-12 items-center gap-1 text-xl">
        {['✅', '🔄', '↩️'].map((e, i) => (
          <span key={e} className="grid size-8 place-items-center rounded-full bg-white/10 motion-safe:animate-[float-y_2.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.3}s` }}>
            {e}
          </span>
        ))}
      </span>
    ),
  },
  list: {
    from: 'from-[#5e0c3b]',
    to: 'to-[#2a0818]',
    ring: 'ring-q-pink',
    text: 'text-q-pink',
    tag: 'كتابة سريعة',
    emblem: (
      <span className="inline-flex h-12 items-center gap-1.5">
        <span className="q-display text-3xl text-q-pink motion-safe:animate-[float-y_1.8s_ease-in-out_infinite]">⏱️</span>
        <span className="flex flex-col gap-1">
          {['دول', 'لاعبين', 'أكلات'].map((w, i) => (
            <span key={w} className="rounded-md bg-white/10 px-1.5 text-[10px] font-black text-white/80 motion-safe:animate-[fade-up_0.6s_ease_both]" style={{ animationDelay: `${i * 0.25}s` }}>
              ✅ {w}
            </span>
          ))}
        </span>
      </span>
    ),
  },
  hide: {
    from: 'from-[#0c5e3b]',
    to: 'to-[#08281a]',
    ring: 'ring-q-green',
    text: 'text-q-green',
    tag: 'تخمين',
    emblem: (
      <span className="inline-flex h-12 items-end gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn('grid size-8 place-items-center rounded-md border border-q-gold/40 bg-[#3a2810] text-base', i === 1 && 'motion-safe:animate-[float-y_1.6s_ease-in-out_infinite]')}>
            {i === 1 ? '🔑' : '📦'}
          </span>
        ))}
      </span>
    ),
  },
};

const MODE_ICON: Record<Variant, string> = { swap: '🔄', flip: '🔀', triple: '↩️', hide: '📦', list: '⏱️' };

const MODES: { id: Variant; title: string; desc: string }[] = [
  { id: 'swap', title: 'جاوب أو بادل', desc: 'بادل جواب الخصم: إذا جوابه صح تاخذ دبل، وإذا جوابه غلط تنقص نقاطك' },
  { id: 'flip', title: 'جاوب أو اقلب', desc: 'اقلب على الخصم: إذا جوابه صح تنقص نقاطه، وإذا جوابه غلط تزيد نقاطه' },
  { id: 'triple', title: 'جاوب أو بادل أو اعكس', desc: 'جاوب أو بادل أو اعكس — وبادل أو اعكس يختارها فريق واحد بس في الجولة' },
  { id: 'list', title: 'عدّها', desc: 'سؤال واحد والفريقين يكتبون أكثر عدد أجوبة: كل جواب صح نقطة، والفريق الأكثر ياخذ +5' },
];
/** Modes kept behind «أطوار إضافية». */
const EXTRA_MODES: { id: Variant; title: string; desc: string }[] = [
  { id: 'hide', title: 'خبّي أو اكشف', desc: '10 صناديق — فريق يخبّي المفتاح والثاني يخمّن، ومعك زر تلميح 💡' },
];

export function ModeHowPill({ onOpen }: { onOpen: () => void }) {
  const open = (e: { stopPropagation: () => void; preventDefault: () => void }) => (e.stopPropagation(), e.preventDefault(), onOpen());
  return (
    <span role="button" tabIndex={0} className="q-mode-how" onClick={open} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open(e)}>
      📖 طريقة اللعب
    </span>
  );
}

function ModeCard({ id, title, desc, selected, hot, onClick, onHow }: { id: Variant; title: string; desc: string; selected: boolean; hot: boolean; onClick: () => void; onHow: () => void }) {
  const look = MODE_LOOK[id];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'q-spot group relative flex min-h-44 snap-center flex-col overflow-hidden rounded-3xl bg-linear-to-br p-4 text-start transition-all duration-300 max-sm:w-[78vw] max-sm:shrink-0',
        look.from,
        look.to,
        selected ? cn('ring-2 ring-offset-2 ring-offset-q-bg', look.ring, 'scale-[1.02] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]') : 'opacity-80 ring-1 ring-white/10 hover:-translate-y-1 hover:opacity-100',
      )}
    >
      {/* The mode's own light, brighter when chosen. */}
      <span aria-hidden className={cn('pointer-events-none absolute -top-16 -left-10 size-48 rounded-full bg-white/10 blur-3xl transition-opacity', selected ? 'opacity-100' : 'opacity-40')} />
      {hot && <HotBadge className="top-3 inset-x-0 mx-auto w-fit px-3 py-1 text-xs ring-2 ring-white/50 motion-safe:animate-none" />}
      <div className="flex items-start justify-between gap-2">
        <span className={cn('rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-black', look.text)}>{look.tag}</span>
        <span className={cn('grid size-6 place-items-center rounded-full border text-xs transition-all', selected ? 'border-transparent bg-white text-black' : 'border-white/30 text-transparent')} aria-hidden>
          ✓
        </span>
      </div>
      <div className="my-2 flex justify-center">{look.emblem}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="q-display text-2xl leading-tight text-white">{title}</div>
        {selected && <ModeHowPill onOpen={onHow} />}
      </div>
      <div className="mt-1 text-[12px] leading-relaxed text-white/70">{desc}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-bold text-white/60">{label}</span>
      {children}
    </label>
  );
}

const codeInputClass = 'q-input text-center text-2xl font-black tracking-[0.35em] uppercase';

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3 text-center">
      <div className="text-[11px] font-black tracking-[0.2em] text-q-gold/80">{kicker}</div>
      <h2 className="q-display text-3xl leading-tight">{title}</h2>
    </div>
  );
}

export function HomeScreen({ initialCode, initialSolo = false }: { initialCode: string; initialSolo?: boolean }) {
  const [variant, setVariant] = useState<Variant>('swap');
  // «فردي»: every player on their own (every mode except «خبّي أو اكشف»).
  const [solo, setSolo] = useState(initialSolo);
  const hot = usePopular()?.variants[0];
  const [mode, setMode] = useState<RoomMode>('mobile');
  const [tab, setTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create');
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinTeam, setJoinTeam] = useState<TeamIndex | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [howMode, setHowMode] = useState<Variant | undefined>();
  const { data: categories } = useQuery({ queryKey: ['public-categories'], queryFn: api.publicCategories, staleTime: 60_000 });
  const [pre, setPre] = useState<number[]>(() => takePreselected(false));

  // The shortcuts center drives this screen.
  useBus('home:variant', (v) => {
    setVariant(v);
    if (EXTRA_MODES.some((m) => m.id === v)) setExtra(true);
  });
  useBus('home:mode', setMode);
  useBus('home:tab', setTab);
  useBus('home:how', () => (setHowMode(undefined), setHowOpen(true)));

  async function create(e?: FormEvent) {
    e?.preventDefault();
    setBusy('create');
    if (solo && variant === 'hide') {
      setBusy(null);
      return toast.error('«خبّي أو اكشف» للعب بفريقين فقط — اختر طور ثاني أو العب بفريقين');
    }
    const res = await send(
      'room:create',
      solo
        ? { mode, variant, solo: true, playerName: mode === 'mobile' ? createName.trim() || undefined : undefined }
        : { mode, variant, teamName: mode === 'mobile' ? createName.trim() || undefined : undefined },
    );
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) return toast.error(`الكود ${ROOM_CODE_LENGTH} أحرف!`);
    if (!solo && joinTeam === null) return toast.error('اختر فريقك: الأول أو الثاني');
    setBusy('join');
    const res = await send(
      'room:join',
      solo ? { code: clean, playerName: playerName.trim() || undefined } : { code: clean, team: joinTeam!, teamName: joinName.trim() || undefined, playerName: playerName.trim() || undefined },
    );
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  function pickCategory(id: number, name: string) {
    const next = pre.includes(id) ? pre.filter((x) => x !== id) : [...pre, id];
    setPre(next);
    try {
      sessionStorage.setItem('jab:precategories', JSON.stringify(next));
    } catch {
      // Private mode: the pick just does not carry over.
    }
    if (!pre.includes(id)) toast.success(`«${name}» بتكون مختارة لما تنشئ الغرفة`);
  }

  const goPlay = () => document.getElementById('modes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const chosen = [...MODES, ...EXTRA_MODES].find((m) => m.id === variant)!;
  const [extra, setExtra] = useState(() => EXTRA_MODES.some((m) => m.id === variant));

  const joinForm = (
    <form onSubmit={join}>
      {!solo && <p className="mb-1.5 text-xs font-bold text-white/60">اختر فريقك (حتى {MAX_TEAM_SIZE} لاعبين في الفريق)</p>}
      <div className={cn('mb-3 grid grid-cols-2 gap-2.5', solo && 'hidden')}>
        {([0, 1] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setJoinTeam(t)}
            aria-pressed={joinTeam === t}
            className={cn(
              'rounded-2xl border-2 px-3 py-3.5 text-sm font-black transition-all active:scale-95',
              joinTeam === t ? (t === 0 ? 'border-q-blue bg-q-blue/15 shadow-[0_0_24px_-8px_#3498db]' : 'border-q-red bg-q-red/15 shadow-[0_0_24px_-8px_#e74c3c]') : 'border-q-line bg-q-panel/60 hover:border-white/25',
            )}
          >
            <span className="block text-2xl">{t === 0 ? '🦁' : '🐯'}</span>
            {t === 0 ? 'الفريق الأول' : 'الفريق الثاني'}
          </button>
        ))}
      </div>
      <Field label={mode === 'tv' ? 'كود الغرفة من التلفاز' : 'كود الغرفة'}>
        <input
          id="join-code"
          className={codeInputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="• • • • • •"
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
        />
      </Field>
      <div className={cn('grid gap-x-3', !solo && 'sm:grid-cols-2')}>
        <Field label={solo ? 'اسمك (يظهر لباقي اللاعبين)' : 'اسمك (يظهر لفريقك)'}>
          <input className="q-input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="مثال: سعد" maxLength={TEAM_NAME_MAX} />
        </Field>
        {!solo && (
        <Field label="اسم الفريق (فقط إذا كنت أول من يدخله)">
          <input className="q-input" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="مثال: الصقور" maxLength={TEAM_NAME_MAX} />
        </Field>
        )}
      </div>
      <button className="q-btn-gold" disabled={busy !== null}>
        {busy === 'join' ? 'جاري الانضمام...' : '🔗 انضمام'}
      </button>
    </form>
  );

  return (
    <div className="animate-fade-up">
      {/* ── Hero ── */}
      <section className="relative pt-8 pb-6 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-40 max-w-md rounded-full bg-q-purple/25 blur-3xl" />
        <div className="relative mx-auto mb-3 grid size-24 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full border border-dashed border-q-gold/40 motion-safe:animate-orbit" />
          <span aria-hidden className="absolute inset-3 rounded-full border border-q-cyan/30" />
          <span className="motion-safe:animate-float-y">
            <Logo />
          </span>
        </div>
        <h1 className="q-display relative text-6xl leading-[1.15] sm:text-7xl">
          <span className="bg-linear-to-l from-q-purple to-q-pink bg-clip-text text-transparent">جاوب</span>
          <span className="mx-2 text-3xl text-white/70 sm:text-4xl">أو</span>
          <span className="bg-linear-to-l from-q-cyan to-[#7dd3fc] bg-clip-text text-transparent">بادل</span>
        </h1>
        <p className="relative mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-white/70">
          لعبة أسئلة جماعية: اختار <b className="text-q-gold">سراً</b> — تجاوب بنفسك، أو تبادل جواب خصمك وتاخذ <b className="text-q-gold">دبل</b>!
        </p>
        <div className="relative mx-auto mt-5 flex max-w-sm flex-col gap-2.5 sm:max-w-md sm:flex-row">
          <button type="button" onClick={goPlay} className="q-btn-gold q-shine text-base">
            🚀 ابدأ اللعب
          </button>
          <button type="button" onClick={() => (setHowMode(undefined), setHowOpen(true))} className="q-how w-full sm:w-auto" aria-label="طريقة اللعب — افهم اللعبة في دقيقة">
            <span className="q-how-in">
              <span className="q-how-icon" aria-hidden>
                📖
              </span>
              <span className="text-start leading-tight">
                <span className="block text-[16px] font-black text-white">طريقة اللعب</span>
                <span className="block text-[11px] font-bold text-white/65">افهم اللعبة في دقيقة</span>
              </span>
              <span className="q-how-new" aria-hidden>
                جديد؟ ابدأ هنا
              </span>
            </span>
          </button>
        </div>
        <div className="relative mt-4 flex flex-wrap justify-center gap-2">
          <VideoGuideButton
            className="q-chip border-q-gold/40 bg-q-gold/10 text-q-gold"
            label="🎬 شاهد اللعبة في 90 ثانية"
            src={GAME_VIDEO}
            title="🎬 جاوب أو بادل في 90 ثانية"
            caption="كيف تنشئ غرفة، وتختار الفئات، وتجاوب أو تبادل مع خصمك. والتفاصيل كاملة في «طريقة اللعب»."
            appQr
          />
          <button type="button" className="q-chip" onClick={() => (setTab('join'), document.getElementById('play-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))}>
            🔗 عندي كود
          </button>
          <button type="button" className="q-chip" onClick={() => (setMode('tv'), setTab('create'), document.getElementById('play-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))}>
            📺 العب على التلفاز
          </button>
          <a className="q-chip" {...streamLink()}>
            🟢 العب مع شات Kick
          </a>
        </div>
      </section>

      {/* ── Modes ── */}
      <section id="modes" className="scroll-mt-16 pb-4">
        <SectionTitle kicker="اختر الطور" title="كل طور له لعبته" />
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
          {MODES.map((m) => (
            <ModeCard key={m.id} {...m} hot={hot === m.id} selected={variant === m.id} onClick={() => setVariant(m.id)} onHow={() => (setHowMode(m.id), setHowOpen(true))} />
          ))}
          {extra &&
            EXTRA_MODES.map((m) => (
              <div key={m.id} className="motion-safe:animate-pop-in max-sm:shrink-0 sm:col-span-2 sm:mx-auto sm:w-1/2">
                <ModeCard {...m} hot={hot === m.id} selected={variant === m.id} onClick={() => setVariant(m.id)} onHow={() => (setHowMode(m.id), setHowOpen(true))} />
              </div>
            ))}
        </div>
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => setExtra((x) => !x)}
            aria-expanded={extra}
            className="q-chip"
          >
            {extra ? '▲ إخفاء الأطوار الإضافية' : '🎁 أطوار إضافية'}
          </button>
        </div>
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => document.getElementById('play-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="q-btn-gold q-shine flex w-auto items-center gap-2 px-6 py-2.5 text-sm"
          >
            {MODE_ICON[variant]} التالي: جهّز الغرفة لـ «{chosen.title}» ↓
          </button>
        </div>
        <a
          {...streamLink()}
          className="mt-1 flex items-center gap-3 rounded-2xl border border-[#53fc18]/25 bg-[#53fc18]/5 p-3 text-start transition-colors hover:border-[#53fc18]/60"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#53fc18]/15 text-xl">⏱️</span>
          <span className="flex-1">
            <span className="block text-sm font-black">أطوار البث مع شات Kick</span>
            <span className="block text-[11px] text-white/60">في صفحة الستريمر: الشات يلعب معك، ومنها «عدّها» و«خبّي أو اكشف» والحزم الخاصة</span>
          </span>
          <span className="text-white/40" aria-hidden>
            ←
          </span>
        </a>
      </section>

      {/* ── Play: device + create / join ── */}
      <section id="play-panel" className="q-glass mb-6 scroll-mt-16 p-4 sm:p-5">
        <Steps at={1} className="mb-4" />
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/30 p-1" role="tablist" aria-label="إنشاء أو انضمام">
          {(
            [
              ['create', '🎮 إنشاء غرفة'],
              ['join', '🔗 انضمام'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn('rounded-xl py-2.5 text-sm font-black transition-all', tab === id ? 'bg-linear-to-l from-q-orange to-q-gold text-black shadow' : 'text-white/60 hover:text-white')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-white/60">مين ضد مين؟</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [false, '👥', 'فريقين', 'فريق ضد فريق، وكل فريق يقرر مع بعض'],
                [true, '🙋', 'فردي', 'كل واحد يلعب لحاله، وتبادل مع اللاعب اللي تختاره'],
              ] as const
            ).map(([id, icon, title, desc]) => (
              <button
                key={title}
                type="button"
                onClick={() => setSolo(id)}
                aria-pressed={solo === id}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-start transition-all',
                  solo === id ? (id ? 'border-q-cyan bg-q-cyan/10' : 'border-q-gold bg-q-gold/8') : 'border-q-line bg-q-panel/50 hover:border-white/25',
                )}
              >
                <span className="text-2xl">{icon}</span>
                <span>
                  <span className="block text-sm font-black">{title}</span>
                  <span className="block text-[10.5px] leading-snug text-white/55">{desc}</span>
                </span>
              </button>
            ))}
          </div>
          {solo && variant === 'hide' && <p className="mt-1.5 text-[11px] text-q-orange">«خبّي أو اكشف» للعب بفريقين فقط — اختر طور ثاني للعب الفردي.</p>}
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-white/60">طريقة اللعب</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['mobile', '📱', 'جوال', solo ? 'كل لاعب على جواله' : 'جهازين — كل فريق على جهازه'],
                ['tv', '📺', 'تلفاز', solo ? 'التلفاز يعرض وكل لاعب على جواله' : '3 أجهزة — التلفاز يعرض والفريقين على جوالاتهم'],
              ] as const
            ).map(([id, icon, title, desc]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-start transition-all',
                  mode === id ? (id === 'tv' ? 'border-q-purple bg-q-purple/12' : 'border-q-gold bg-q-gold/8') : 'border-q-line bg-q-panel/50 hover:border-white/25',
                )}
              >
                <span className="text-2xl">{icon}</span>
                <span>
                  <span className="block text-sm font-black">{title}</span>
                  <span className="block text-[10.5px] leading-snug text-white/55">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'create' ? (
          <div key="create" className="motion-safe:animate-fade-up">
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs">
              <span className="text-lg">{MODE_ICON[variant]}</span>
              <span className="text-white/60">الطور:</span>
              <b className={MODE_LOOK[variant].text}>{chosen.title}</b>
              <button type="button" className="ms-auto text-white/50 underline-offset-4 hover:text-q-gold hover:underline" onClick={goPlay}>
                تغيير
              </button>
            </div>
            {pre.length > 0 && categories && (
              <div className="mb-3 text-[11px] text-white/60">
                🗂️ فئات مختارة مسبقًا: {categories.filter((c) => pre.includes(c.id)).map((c) => `${c.icon} ${c.name}`).join('، ')}
              </div>
            )}
            {mode === 'mobile' ? (
              <form onSubmit={create}>
                <Field label={solo ? 'اسمك' : 'اسم فريقك'}>
                  <input id="create-name" className="q-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={solo ? 'مثال: سعد' : 'مثال: النمور'} maxLength={TEAM_NAME_MAX} />
                </Field>
                <button className="q-btn-gold q-shine" disabled={busy !== null}>
                  {busy === 'create' ? 'جاري الإنشاء...' : 'إنشاء غرفة'}
                </button>
              </form>
            ) : (
              <div>
                <p className="mb-3 text-xs leading-relaxed text-white/60">📺 افتح هذا على التلفاز — يتحكم باللعبة ويعرض الأسئلة، والفريقين يدخلون بالكود من جوالاتهم.</p>
                <button type="button" className="q-btn-tv q-shine" disabled={busy !== null} onClick={() => create()}>
                  {busy === 'create' ? 'جاري الإنشاء...' : 'إنشاء غرفة للتلفاز 📺'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div key="join" className="motion-safe:animate-fade-up">
            {joinForm}
          </div>
        )}
      </section>

      {/* ── Categories ── */}
      {categories && categories.some((c) => c.playable) && (
        <section className="mb-6">
          <SectionTitle kicker="فئات الأسئلة" title="من التاريخ إلى الإيموجي" />
          <p className="mb-3 text-center text-xs text-white/55">اضغط على فئة وتكون مختارة لما تنشئ الغرفة — وتقدر تغيّرها في الغرفة.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {categories
              .filter((c) => c.playable)
              .map((c) => {
                const on = pre.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickCategory(c.id, c.name)}
                    className={cn('q-chip px-3.5 py-1.5 text-sm', on && 'border-q-gold bg-q-gold/15 text-white')}
                  >
                    <span className="text-base">{c.icon}</span> {c.name}
                    {on && <span className="text-q-gold">✓</span>}
                  </button>
                );
              })}
          </div>
        </section>
      )}

      {/* ── How it works ── */}
      <section className="mb-6">
        <SectionTitle kicker="بثلاث خطوات" title="كيف تلعب؟" />
        <ol className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['1', '🎮', 'أنشئ غرفة', 'اختر الطور وطريقة اللعب، وشارك الكود أو رمز QR مع الفريق الثاني.'],
              ['2', '🤫', 'اختار سراً', 'في كل سؤال كل فريق يقرر بدون ما يشوف الثاني: يجاوب بنفسه أو يبادل أو يقلب.'],
              ['3', '🏆', 'اجمع النقاط', 'جاوب صح ثلاث مرات ورا بعض وتاخذ دبل، والأعلى نقاط في النهاية يفوز.'],
            ] as const
          ).map(([n, icon, title, text]) => (
            <li key={n} className="q-card relative overflow-hidden">
              <span aria-hidden className="q-display absolute -top-3 -left-1 text-7xl text-white/5">
                {n}
              </span>
              <div className="mb-1 text-3xl">{icon}</div>
              <div className="mb-1 text-base font-black text-q-gold">{title}</div>
              <p className="text-[13px] leading-relaxed text-white/70">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 text-center">
          <button type="button" onClick={() => (setHowMode(undefined), setHowOpen(true))} className="q-chip">
            📖 طريقة اللعب
          </button>
        </div>
      </section>

      <nav className="mt-6 flex justify-center gap-4 pb-16 text-xs text-white/40" aria-label="روابط">
        <a href={serverUrl('/privacy')} target="_blank" rel="noopener noreferrer" className="hover:text-q-gold">
          سياسة الخصوصية
        </a>
        <a href={serverUrl('/terms')} target="_blank" rel="noopener noreferrer" className="hover:text-q-gold">
          شروط الاستخدام
        </a>
        <a href={serverUrl('/support')} target="_blank" rel="noopener noreferrer" className="hover:text-q-gold">
          الدعم
        </a>
      </nav>

      <HowToPlay open={howOpen} variant={howMode} onClose={() => setHowOpen(false)} />
    </div>
  );
}

export function Logo() {
  return (
    <svg width="46" height="46" viewBox="0 0 60 60" aria-hidden>
      <circle cx="26" cy="34" r="20" fill="#111" stroke="#333" strokeWidth="2" />
      <circle cx="19" cy="26" r="4" fill="rgba(255,255,255,0.1)" />
      <rect x="23" y="13" width="6" height="6" rx="2" fill="#222" stroke="#444" strokeWidth="1.5" />
      <path d="M38 18 Q43 12 48 8" stroke="#888" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="8" r="4" fill="#ff6b35" />
      <circle cx="51" cy="5" r="3" fill="#f7c948" />
      <circle cx="49" cy="3" r="2" fill="#fff" />
    </svg>
  );
}

export type Tone = 'good' | 'bad' | 'gold' | 'dim';
const TONE: Record<Tone, string> = { good: 'bg-q-green/20 text-q-green', bad: 'bg-q-red/20 text-q-red', gold: 'bg-q-gold/20 text-q-gold', dim: 'bg-white/10 text-white/60' };

/** Worked examples: what you chose → what happened → who gets what. */
export function Scenarios({ rows }: { rows: [choice: string, what: string, result: [who: string, pts: string, tone: Tone][]][] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map(([choice, what, result], i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1.5 text-xs leading-normal">
          <span className="rounded-md bg-white/10 px-2 py-0.5 font-black">{choice}</span>
          <span className="text-white/40">+</span>
          <span className="rounded-md border border-white/15 px-2 py-0.5">{what}</span>
          <span className="text-white/40">←</span>
          {result.map(([who, pts, tone]) => (
            <span key={who} className={cn('rounded-md px-2 py-0.5 font-black', TONE[tone])}>
              {who} <bdi dir="ltr">{pts}</bdi>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function HowSection({ tone, title, children }: { tone: string; title: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border p-3', tone)}>
      <div className="mb-1.5 font-black">{title}</div>
      {children}
    </div>
  );
}

/** Each mode's own rules (with examples), shown only for the mode picked. */
const MODE_HOW: Record<Variant, ReactNode> = {
  swap: (
    <>
        <p className="text-center text-xs text-white/50">الأمثلة تحت على سؤال قيمته <b className="text-q-gold">200</b> نقطة</p>
        <HowSection tone="border-q-cyan/30 bg-q-cyan/10 [&>div:first-child]:text-q-cyan" title="🔄 جاوب أو بادل">
          <div>✅ <b>جاوب:</b> تجاوب بنفسك. إذا جوابك صح تاخذ نقاط السؤال، وإذا جوابك غلط ما تاخذ شي.</div>
          <div>🔄 <b>بادل:</b> تاخذ جواب الفريق الخصم بدال جوابك. إذا جواب الخصم صح تاخذ دبل النقاط والخصم ما ياخذ شي، وإذا جواب الخصم غلط تنقص من نقاطك.</div>
          <div>🔄🔄 إذا الفريقين اختاروا بادل، ما أحد ياخذ نقاط.</div>
          <Scenarios
            rows={[
              ['✅ جاوب', 'جوابك صح', [['أنت', '+200', 'good']]],
              ['🔄 بادل', 'جواب الخصم صح', [['أنت', '+400', 'gold'], ['الخصم', '0', 'dim']]],
              ['🔄 بادل', 'جواب الخصم غلط', [['أنت', '−200', 'bad']]],
              ['🔄 بادل', 'الخصم بادل بعد', [['الاثنين', '0', 'dim']]],
            ]}
          />
        </HowSection>
        <HowSection tone="border-q-orange/35 bg-q-orange/10 [&>div:first-child]:text-q-orange" title="🔥 سلسلة الإجابات (دبل)">
          <div>• إذا جاوب فريقك صح 3 مرات ورا بعض، تاخذون دبل نقاط السؤال الثالث.</div>
          <div>• كل جواب صح يضيف 🔥 تحت نقاط فريقك، ولما تصير 🔥🔥 فالجواب الصح الجاي دبل.</div>
          <div>• إذا جاوبتوا غلط ترجع السلسلة من الصفر. واختيار «بادل» أو «اقلب» أو «اعكس» ما يأثر عليها.</div>
        </HowSection>
      </>
  ),
  flip: (
    <>
        <p className="text-center text-xs text-white/50">الأمثلة تحت على سؤال قيمته <b className="text-q-gold">200</b> نقطة</p>
        <HowSection tone="border-q-purple/30 bg-q-purple/10 [&>div:first-child]:text-q-purple" title="🔀 جاوب أو اقلب">
          <div>✅ <b>جاوب:</b> تجاوب بنفسك. إذا جوابك صح تاخذ نقاط السؤال، وإذا جوابك غلط ما تاخذ شي.</div>
          <div>🔀 <b>اقلب على الخصم:</b> أنت ما تجاوب، ونتيجة الخصم تنقلب عليه. إذا جواب الخصم صح تنقص نقاطه، وإذا جواب الخصم غلط تزيد نقاطه.</div>
          <div>🔀🔀 إذا الفريقين اختاروا اقلب، ما أحد ياخذ نقاط.</div>
          <Scenarios
            rows={[
              ['✅ جاوب', 'جوابك صح', [['أنت', '+200', 'good']]],
              ['🔀 اقلب', 'جواب الخصم صح', [['الخصم', '−200', 'bad'], ['أنت', '0', 'dim']]],
              ['🔀 اقلب', 'جواب الخصم غلط', [['الخصم', '+200', 'good'], ['أنت', '0', 'dim']]],
            ]}
          />
        </HowSection>
        <HowSection tone="border-q-orange/35 bg-q-orange/10 [&>div:first-child]:text-q-orange" title="🔥 سلسلة الإجابات (دبل)">
          <div>• إذا جاوب فريقك صح 3 مرات ورا بعض، تاخذون دبل نقاط السؤال الثالث.</div>
          <div>• كل جواب صح يضيف 🔥 تحت نقاط فريقك، ولما تصير 🔥🔥 فالجواب الصح الجاي دبل.</div>
          <div>• إذا جاوبتوا غلط ترجع السلسلة من الصفر. واختيار «بادل» أو «اقلب» أو «اعكس» ما يأثر عليها.</div>
        </HowSection>
      </>
  ),
  triple: (
    <>
        <p className="text-center text-xs text-white/50">الأمثلة تحت على سؤال قيمته <b className="text-q-gold">200</b> نقطة</p>
        <HowSection tone="border-q-gold/25 bg-q-gold/8 [&>div:first-child]:text-q-gold" title="↩️ جاوب أو بادل أو اعكس">
          <div>✅ <b>جاوب:</b> تجاوب بنفسك. إذا جوابك صح تاخذ نقاط السؤال، وإذا جوابك غلط ما تاخذ شي.</div>
          <div>🔄 <b>بادل:</b> تاخذ جواب الفريق الخصم بدال جوابك. إذا جواب الخصم صح تاخذ دبل النقاط والخصم ما ياخذ شي، وإذا جواب الخصم غلط تنقص من نقاطك.</div>
          <div>↩️ <b>اعكس على الخصم:</b> أنت ما تجاوب، ونتيجتك عكس نتيجة الخصم. إذا جواب الخصم صح تنقص من نقاطك، وإذا جواب الخصم غلط تزيد نقاطك. والخصم ما ياخذ نقاط السؤال.</div>
          <div>🚫 في الجولة الوحدة فريق واحد بس يقدر يختار بادل أو اعكس. إذا اختارها فريق، الفريق الثاني لازم يجاوب.</div>
          <Scenarios
            rows={[
              ['🔄 بادل', 'جواب الخصم صح', [['أنت', '+400', 'gold'], ['الخصم', '0', 'dim']]],
              ['🔄 بادل', 'جواب الخصم غلط', [['أنت', '−200', 'bad']]],
              ['↩️ اعكس', 'جواب الخصم صح', [['أنت', '−200', 'bad'], ['الخصم', '0', 'dim']]],
              ['↩️ اعكس', 'جواب الخصم غلط', [['أنت', '+200', 'good'], ['الخصم', '0', 'dim']]],
            ]}
          />
        </HowSection>
        <HowSection tone="border-q-orange/35 bg-q-orange/10 [&>div:first-child]:text-q-orange" title="🔥 سلسلة الإجابات (دبل)">
          <div>• إذا جاوب فريقك صح 3 مرات ورا بعض، تاخذون دبل نقاط السؤال الثالث.</div>
          <div>• كل جواب صح يضيف 🔥 تحت نقاط فريقك، ولما تصير 🔥🔥 فالجواب الصح الجاي دبل.</div>
          <div>• إذا جاوبتوا غلط ترجع السلسلة من الصفر. واختيار «بادل» أو «اقلب» أو «اعكس» ما يأثر عليها.</div>
        </HowSection>
      </>
  ),
  list: (
    <>
        <HowSection tone="border-q-pink/30 bg-q-pink/10 [&>div:first-child]:text-q-pink" title="⏱️ عدّها">
          <div>• في كل جولة الفريق اللي دوره يختار فئة، مثل كورة أو جغرافيا أو حروف، ويطلع سؤال واحد للفريقين مثل «اذكر دول عربية».</div>
          <div>• كل لاعب في الفريقين، الرئيس والأعضاء، يكتب أكبر عدد من الأجوبة قبل ما يخلص الوقت، ويقدر يكتب أكثر من جواب بينها فاصلة.</div>
          <div>• كل جواب صح ينحسب لفريقك مرة وحدة بس، حتى لو كتبه أكثر من لاعب، وأجوبة الفريق الثاني ما تبان لكم إلا في النتيجة.</div>
          <div>• كل جواب صح بنقطة، والفريق اللي يلقى أجوبة أكثر ياخذ 5 نقاط زيادة، وإذا تعادلوا ما أحد ياخذ الزيادة.</div>
          <div>• الأسئلة من السهلة إلى المتوسطة، واللعبة 10 جولات والفريقين يتبادلون اختيار الفئة.</div>
        </HowSection>
      </>
  ),
  hide: (
    <>
        <HowSection tone="border-q-green/30 bg-q-green/10 [&>div:first-child]:text-q-green" title="📦 خبّي أو اكشف">
          <div>• فيه 10 صناديق. الفريق اللي دوره يخبّي المفتاح 🔑 في صندوق، والفريق الثاني ما يشوف وين خبّاه.</div>
          <div>• الفريق الثاني يخمّن رقم الصندوق. إذا لقى المفتاح ياخذ النقاط، وإذا ما لقاه تروح النقاط للفريق اللي خبّى.</div>
          <div>• زر 💡 التلميح (مرة وحدة بالجولة): يطلع سؤال متوسط. إذا جاوبته صح ينشال نص الصناديق، وإذا جاوبته غلط تروح النقاط للخصم على طول.</div>
          <div>• الأدوار تتبادل، وكل فريق يخبّي 5 مرات.</div>
        </HowSection>
      </>
  ),
};

/** «طريقة اللعب»: the basics only; with `variant`, that mode's rules. */
function HowToPlay({ open, onClose, variant }: { open: boolean; onClose: () => void; variant?: Variant }) {
  const mode = variant && [...MODES, ...EXTRA_MODES].find((m) => m.id === variant);
  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-black text-q-purple">📖 {mode ? `طريقة لعب «${mode.title}»` : 'طريقة اللعب'}</h2>
        <button type="button" onClick={onClose} className="text-xl text-white/50" aria-label="إغلاق">
          ✕
        </button>
      </div>
      <div className="grid gap-2.5 text-start text-[13px] leading-loose text-white/80">
        {mode ? (
          MODE_HOW[mode.id]
        ) : (
          <>
            <HowSection tone="border-q-gold/25 bg-q-gold/8 [&>div:first-child]:text-q-gold" title="🎯 فكرة اللعبة">
              <div>• فريقين يتنافسون على أسئلة من فئات مختلفة، والفريق اللي يجمع نقاط أكثر في النهاية يفوز.</div>
              <div>• أول شي تختارون الطور، وكل طور له طريقة لعب ونقاط خاصة فيه.</div>
              <div>• بعدها تختارون الفئات، والفريقين يتبادلون الدور.</div>
            </HowSection>
        <HowSection tone="border-q-purple/30 bg-q-purple/10 [&>div:first-child]:text-q-purple" title="📱 وضع الجوال (جهازين)">
          <div>• جهاز ينشئ غرفة والباقي ينضمون بالكود ويختارون فريقهم</div>
          <div>• أول من يدخل الفريق هو الرئيس، والبقية أعضاء (حتى 10 لكل فريق)</div>
          <div>• الأعضاء يصوّتون على كل خطوة، والرئيس يقرر على حسب التصويت</div>
          <div>• الفريق الذي دوره يختار من اللوحة</div>
          <div>• كلاهم يختار سراً جاوب أو بادل ثم يجاوبون</div>
        </HowSection>
        <HowSection tone="border-q-cyan/30 bg-q-cyan/10 [&>div:first-child]:text-q-cyan" title="📺 وضع التلفاز (3 أجهزة)">
          <div>• التلفاز: ينشئ الغرفة ويختار الأسئلة ويعرض النتائج</div>
          <div>• الفريق 1 و2: ينضمون بالكود ويجاوبون على جوالاتهم</div>
        </HowSection>
        <HowSection tone="border-q-cyan/30 bg-q-cyan/10 [&>div:first-child]:text-q-cyan" title="🙋 اللعب الفردي">
          <div>• في اللعب الفردي ما فيه فرق، وكل لاعب يلعب لحاله ونقاطه له بروحه. تقدرون تكونون من لاعبين إلى 12 لاعب.</div>
          <div>• واحد ينشئ الغرفة ويختار «فردي»، والباقي يدخلون بالكود ويكتبون أسماءهم بس، بدون ما يختارون فريق.</div>
          <div>• اللاعبين يتناوبون على اختيار السؤال من اللوحة، وكل سؤال الكل يختار قراره سرًا في نفس الوقت.</div>
          <div>• إذا اخترت «بادل» أو «اقلب» أو «اعكس» تطلع لك قائمة اللاعبين تحت الخيار، وتختار منها اللاعب اللي تبي تلعب على جوابه، مثل ما الستريمر يختار واحد من المشاركين في البث.</div>
          <div>• إذا بادلت جواب لاعب وطلع جوابه صح تاخذ دبل النقاط، وهو ياخذ صفر لأن جوابه انزرف. وإذا طلع جوابه غلط تنقص من نقاطك.</div>
          <div>• إذا اللاعب اللي اخترته ما جاوب بنفسه، لأنه هو بعد اختار بادل أو اقلب أو اعكس، فما تاخذ شي. وإذا اثنين اختاروا بعض فالاثنين ياخذون صفر.</div>
          <div>• كل الأطوار موجودة في اللعب الفردي ما عدا «خبّي أو اكشف» لأنه يحتاج فريقين. وفي «عدّها» كل لاعب يكتب أجوبته لحاله، وأكثر ثلاثة لاعبين ياخذون 5 و3 و2 نقاط زيادة.</div>
        </HowSection>
            <p className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-center text-xs text-white/70">💡 قواعد كل طور ونقاطه: اختر الطور واضغط «📖 طريقة اللعب» اللي يطلع في بطاقته.</p>
          </>
        )}
      </div>
      <button type="button" onClick={onClose} className="q-btn-tv mt-3.5">
        فهمت! 🚀
      </button>
    </Modal>
  );
}
