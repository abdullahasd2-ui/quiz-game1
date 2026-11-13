import { MAX_TEAM_SIZE, ROOM_CODE_LENGTH, TEAM_NAME_MAX, type RoomMode, type TeamIndex, type Variant } from '@quiz/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Modal } from '../ui';

function Choice({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: string; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-2xl border-2 bg-q-panel bg-linear-to-b from-white/[0.04] to-transparent px-4 py-5 text-center transition-all hover:-translate-y-0.5 active:scale-[0.98]',
        selected
          ? 'border-q-gold shadow-[inset_0_0_0_999px_rgba(247,201,72,0.07),0_0_28px_-8px_rgba(247,201,72,0.55)]'
          : 'border-q-line shadow-[0_10px_24px_-14px_rgba(0,0,0,0.8)] hover:border-white/20',
      )}
    >
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="text-[15px] font-black text-q-gold">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-white/50">{desc}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}

const codeInputClass = 'q-input text-center text-xl font-black tracking-[0.3em] uppercase';

export function HomeScreen({ initialCode }: { initialCode: string }) {
  const [variant, setVariant] = useState<Variant>('swap');
  const [mode, setMode] = useState<RoomMode>('mobile');
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinTeam, setJoinTeam] = useState<TeamIndex | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  async function create(e?: FormEvent) {
    e?.preventDefault();
    setBusy('create');
    const res = await send('room:create', { mode, variant, teamName: mode === 'mobile' ? createName.trim() || undefined : undefined });
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) return toast.error(`الكود ${ROOM_CODE_LENGTH} أحرف!`);
    if (joinTeam === null) return toast.error('اختر فريقك: الأول أو الثاني');
    setBusy('join');
    const res = await send('room:join', { code: clean, team: joinTeam, teamName: joinName.trim() || undefined, playerName: playerName.trim() || undefined });
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  const joinForm = (
    <form onSubmit={join} className="q-card">
      <h3 className="mb-3.5 text-[15px] font-bold text-q-gold">{mode === 'tv' ? '🎮 انضمام كفريق (الجوال)' : '🔗 الانضمام لغرفة'}</h3>
      <p className="mb-1.5 text-xs text-white/50">اختر فريقك (حتى {MAX_TEAM_SIZE} لاعبين في الفريق)</p>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        {([0, 1] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setJoinTeam(t)}
            aria-pressed={joinTeam === t}
            className={cn(
              'rounded-xl border-2 px-3 py-3 text-sm font-black transition-all',
              joinTeam === t ? (t === 0 ? 'border-q-blue bg-q-blue/10' : 'border-q-red bg-q-red/10') : 'border-q-line bg-q-panel',
            )}
          >
            {t === 0 ? '🦁 الفريق الأول' : '🐯 الفريق الثاني'}
          </button>
        ))}
      </div>
      <Field label="اسمك (يظهر لفريقك)">
        <input className="q-input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="مثال: سعد" maxLength={TEAM_NAME_MAX} />
      </Field>
      <Field label="اسم الفريق (فقط إذا كنت أول من يدخله)">
        <input className="q-input" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="مثال: الصقور" maxLength={TEAM_NAME_MAX} />
      </Field>
      <Field label={mode === 'tv' ? 'كود الغرفة من التلفاز' : 'كود الغرفة'}>
        <input
          className={codeInputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="أدخل الكود"
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
        />
      </Field>
      <button className="q-btn-gold" disabled={busy !== null}>
        {busy === 'join' ? 'جاري الانضمام...' : 'انضمام'}
      </button>
    </form>
  );

  return (
    <div className="animate-fade-up">
      <div className="pt-7 pb-4 text-center">
        <h1 className="flex items-center justify-center gap-2.5 text-[40px] font-black">
          <Logo />
          <span className="text-q-purple">جاوب</span>
          <span className="text-[28px]">أو</span>
          <span className="text-q-cyan">بادل</span>
        </h1>
        <p className="mt-1 text-[13px] text-white/50">اختار سراً — جاوب أو بادل نقاط خصمك!</p>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="mt-2.5 rounded-full border-[1.5px] border-white/20 px-5 py-1.5 text-[13px] text-white/60 transition-colors hover:border-q-purple hover:text-q-purple"
        >
          📖 طريقة اللعب
        </button>
      </div>

      <p className="mb-2 text-center text-[13px] text-white/50">اختار نوع اللعبة</p>
      <div className="mb-5 grid grid-cols-2 gap-3.5">
        <Choice selected={variant === 'swap'} onClick={() => setVariant('swap')} icon="🔄" title="جاوب أو بادل" desc="بادل جواب الخصم: إذا جوابه صح تاخذ دبل، وإذا جوابه غلط تنقص نقاطك" />
        <Choice selected={variant === 'flip'} onClick={() => setVariant('flip')} icon="🔀" title="جاوب أو اقلب" desc="اقلب على الخصم: إذا جوابه صح تنقص نقاطه، وإذا جوابه غلط تزيد نقاطه" />
        <Choice selected={variant === 'hide'} onClick={() => setVariant('hide')} icon="📦" title="خبّي أو اكشف" desc="10 صناديق — فريق يخبّي المفتاح والثاني يخمّن، ومعك زر تلميح 💡" />
        <Choice
          selected={variant === 'triple'}
          onClick={() => setVariant('triple')}
          icon="↩️"
          title="جاوب أو بادل أو اعكس"
          desc="جاوب أو بادل أو اعكس — وبادل أو اعكس يختارها فريق واحد بس في الجولة"
        />
      </div>

      <p className="mb-2 text-center text-[13px] text-white/50">اختار طريقة اللعب</p>
      <div className="mb-5 grid grid-cols-2 gap-3.5">
        <Choice selected={mode === 'mobile'} onClick={() => setMode('mobile')} icon="📱" title="جوال" desc="جهازين — كل فريق على جهازه" />
        <Choice selected={mode === 'tv'} onClick={() => setMode('tv')} icon="📺" title="تلفاز" desc="3 أجهزة — التلفاز يعرض والفريقين على جوالاتهم" />
      </div>

      {mode === 'mobile' ? (
        <form onSubmit={create} className="q-card">
          <h3 className="mb-3.5 text-[15px] font-bold text-q-gold">🎮 إنشاء غرفة جديدة</h3>
          <Field label="اسم فريقك">
            <input className="q-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="مثال: النمور" maxLength={TEAM_NAME_MAX} />
          </Field>
          <button className="q-btn-gold" disabled={busy !== null}>
            {busy === 'create' ? 'جاري الإنشاء...' : 'إنشاء غرفة'}
          </button>
        </form>
      ) : (
        <div className="q-card border-q-purple/40">
          <h3 className="mb-1.5 text-[15px] font-bold text-q-purple">📺 تشغيل على التلفاز (المضيف)</h3>
          <p className="mb-3 text-xs text-white/50">افتح هذا على التلفاز — يتحكم باللعبة ويعرض الأسئلة</p>
          <button type="button" className="q-btn-tv" disabled={busy !== null} onClick={() => create()}>
            {busy === 'create' ? 'جاري الإنشاء...' : 'إنشاء غرفة للتلفاز 📺'}
          </button>
        </div>
      )}
      <div className="my-1.5 text-center text-white/20">—</div>
      {joinForm}

      <nav className="mt-6 flex justify-center gap-4 text-xs text-white/40" aria-label="روابط">
        <a href={serverUrl('/privacy')} target="_blank" rel="noopener noreferrer" className="hover:text-q-gold">
          سياسة الخصوصية
        </a>
        <a href={serverUrl('/support')} target="_blank" rel="noopener noreferrer" className="hover:text-q-gold">
          الدعم
        </a>
      </nav>

      <HowToPlay open={howOpen} onClose={() => setHowOpen(false)} />
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

function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-black text-q-purple">📖 طريقة اللعب</h2>
        <button type="button" onClick={onClose} className="text-xl text-white/50" aria-label="إغلاق">
          ✕
        </button>
      </div>
      <div className="grid gap-2.5 text-start text-[13px] leading-loose text-white/80">
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
        <HowSection tone="border-q-green/30 bg-q-green/10 [&>div:first-child]:text-q-green" title="📦 خبّي أو اكشف">
          <div>• فيه 10 صناديق. الفريق اللي دوره يخبّي المفتاح 🔑 في صندوق، والفريق الثاني ما يشوف وين خبّاه.</div>
          <div>• الفريق الثاني يخمّن رقم الصندوق. إذا لقى المفتاح ياخذ النقاط، وإذا ما لقاه تروح النقاط للفريق اللي خبّى.</div>
          <div>• زر 💡 التلميح (مرة وحدة بالجولة): يطلع سؤال متوسط. إذا جاوبته صح ينشال نص الصناديق، وإذا جاوبته غلط تروح النقاط للخصم على طول.</div>
          <div>• الأدوار تتبادل، وكل فريق يخبّي 5 مرات.</div>
        </HowSection>
        <HowSection tone="border-q-orange/35 bg-q-orange/10 [&>div:first-child]:text-q-orange" title="🔥 سلسلة الإجابات (دبل)">
          <div>• إذا جاوب فريقك صح 3 مرات ورا بعض، تاخذون دبل نقاط السؤال الثالث.</div>
          <div>• كل جواب صح يضيف 🔥 تحت نقاط فريقك، ولما تصير 🔥🔥 فالجواب الصح الجاي دبل.</div>
          <div>• إذا جاوبتوا غلط ترجع السلسلة من الصفر. واختيار «بادل» أو «اقلب» أو «اعكس» ما يأثر عليها.</div>
        </HowSection>
      </div>
      <button type="button" onClick={onClose} className="q-btn-tv mt-3.5">
        فهمت! 🚀
      </button>
    </Modal>
  );
}
