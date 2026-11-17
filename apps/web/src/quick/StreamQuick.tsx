// The shortcuts center of the streamer page. It only offers what the streamer can do at that moment:
// setting up the game in the lobby, running it during play. Every item calls the page's own controls.
import { STREAM_ANSWER_CHOICES, streamLabels, type PublicCategory, type StreamState, type StreamVariant } from '@quiz/shared';
import { toast } from 'sonner';
import { toggleFullscreen } from '@/lib/hotkeys';
import { QuickAccess, spotlight, type QaItem, type QaSection } from './QuickAccess';

const VARIANT_ICON: Record<StreamVariant, string> = { swap: '🔄', flip: '🔀', triple: '↩️', hide: '📦', list: '⏱️' };
const PHASE_LABEL: Record<StreamState['phase'], string> = {
  lobby: 'تجهيز اللعبة',
  board: 'اختيار السؤال',
  streamer: 'دورك تجاوب',
  choose: 'الشات يختار',
  shuffle: 'خلط الصناديق',
  answer: 'وقت الإجابة',
  steal: 'خذ نقاط مشارك',
  result: 'النتيجة',
  over: 'انتهت اللعبة',
};

export type StreamQuickProps = {
  state: StreamState | null;
  /** Before the stream starts. */
  start?: (test: boolean) => void;
  variant: StreamVariant;
  setVariant: (v: StreamVariant) => void;
  hasPack: boolean;
  cats: PublicCategory[];
  chosen: number[];
  toggleCat: (id: number) => void;
  listCats: { id: string; name: string; icon: string }[];
  listChosen: string[];
  toggleList: (id: string) => void;
  answerSec: number;
  setAnswerSec: (s: number) => void;
  rounds: number;
  setRounds: (n: number) => void;
  beginGame: () => void;
  finishGame: () => void;
  screenUrl: string | null;
  onKeys: () => void;
};

export function StreamQuick(p: StreamQuickProps) {
  const s = p.state;
  const lobby = s?.phase === 'lobby';
  const playing = Boolean(s && s.phase !== 'lobby' && s.phase !== 'over');
  const sections: QaSection[] = [];
  const howto = () => document.querySelector<HTMLButtonElement>('[data-qa="howto"]')?.click();

  if (!s && p.start) {
    sections.push({
      id: 'go',
      title: '🔴 البث',
      items: [
        { id: 'live', icon: '🔴', title: 'ابدأ البث', hint: 'يتصل بشات Kick', run: () => p.start!(false) },
        { id: 'test', icon: '🧪', title: 'تجربة بدون Kick', hint: 'تكتب رسائل الشات بنفسك', run: () => p.start!(true) },
      ],
    });
  }

  if (s && p.screenUrl) {
    const url = p.screenUrl;
    sections.push({
      id: 'screen',
      title: '🖥️ شاشة البث والغرفة',
      items: [
        {
          id: 'copy-screen',
          icon: '📋',
          title: 'نسخ رابط شاشة البث',
          hint: 'تحطه في OBS كمصدر متصفح',
          keywords: 'obs link رابط',
          run: () => void navigator.clipboard?.writeText(url).then(() => toast.success('تم نسخ رابط شاشة البث')),
        },
        { id: 'open-screen', icon: '🖥️', title: 'فتح شاشة البث', hint: 'في نافذة جديدة', run: () => window.open(url, '_blank', 'noopener') },
        { id: 'room', icon: '🏷️', title: 'معلومات الغرفة', hint: `${s.joined.length} مشارك · ${s.used.length} من ${s.totalCells} ${s.variant === 'hide' ? 'جولة' : 'سؤال'}`, run: () => spotlight('st-room') },
      ],
    });
  }

  if (lobby) {
    const modes: StreamVariant[] = p.hasPack ? ['swap', 'flip', 'triple'] : ['swap', 'flip', 'triple', 'hide', 'list'];
    sections.push({
      id: 'modes',
      title: '🎮 أطوار البث',
      items: modes.map<QaItem>((v) => ({
        id: `v-${v}`,
        icon: VARIANT_ICON[v],
        title: streamLabels(v).title,
        badge: p.variant === v ? 'مختار' : undefined,
        stay: true,
        run: () => p.setVariant(v),
      })),
    });
    if (!p.hasPack && p.variant === 'list' && p.listCats.length) {
      sections.push({
        id: 'list-cats',
        title: '🗂️ فئات «عدّها»',
        items: p.listCats.map<QaItem>((c) => ({ id: `lc-${c.id}`, icon: c.icon, title: c.name, badge: p.listChosen.includes(c.id) ? '✓' : undefined, stay: true, run: () => p.toggleList(c.id) })),
      });
    } else if (!p.hasPack && p.variant !== 'hide' && p.variant !== 'list' && p.cats.length) {
      sections.push({
        id: 'cats',
        title: `🗂️ فئات الأسئلة (${p.chosen.length} مختارة)`,
        items: p.cats.filter((c) => c.playable).map<QaItem>((c) => ({ id: `c-${c.id}`, icon: c.icon, title: c.name, keywords: c.slug, badge: p.chosen.includes(c.id) ? '✓' : undefined, stay: true, run: () => p.toggleCat(c.id) })),
      });
    }
    sections.push({
      id: 'time',
      title: `⏱️ ${p.variant === 'hide' ? 'وقت التخمين' : 'وقت الإجابة'}`,
      items: STREAM_ANSWER_CHOICES.map<QaItem>((sec) => ({ id: `t-${sec}`, icon: '⏱️', title: `${sec} ثانية`, badge: p.answerSec === sec ? 'مختار' : undefined, stay: true, run: () => p.setAnswerSec(sec) })),
    });
    if (!p.hasPack && (p.variant === 'hide' || p.variant === 'list')) {
      const counts = p.variant === 'hide' ? [5, 10, 15] : [5, 10, 15, 30];
      sections.push({
        id: 'rounds',
        title: p.variant === 'hide' ? '🔁 عدد الجولات' : '🔁 عدد الأسئلة',
        items: counts.map<QaItem>((n) => ({ id: `r-${n}`, icon: '🔁', title: `${n} ${p.variant === 'hide' ? 'جولات' : 'أسئلة'}`, badge: p.rounds === n ? 'مختار' : undefined, stay: true, run: () => p.setRounds(n) })),
      });
    }
    sections.push({
      id: 'setup',
      title: '🛠️ التجهيز',
      items: [
        { id: 'pack', icon: '🎭', title: 'الحزم الخاصة', hint: p.hasPack ? 'فيه حزمة محمّلة' : 'حمّل حزمة فريق بالكود', run: () => spotlight('st-pack', '#st-pack-code') },
        { id: 'joined', icon: '👥', title: 'المشاركون', hint: `${s!.joined.length} كتبوا «دخول»`, run: () => spotlight('st-joined') },
        { id: 'begin', icon: '▶️', title: 'ابدأ اللعبة', badge: 'Enter', run: p.beginGame },
      ],
    });
  }

  if (s && !lobby) {
    sections.push({
      id: 'game',
      title: '📊 اللعبة',
      items: [
        { id: 'top', icon: '🏆', title: 'الترتيب والنقاط', hint: 'أفضل 10', run: () => spotlight('st-top') },
        { id: 'players', icon: '👥', title: 'المشاركون', hint: `${s.joined.length} مشارك`, run: () => spotlight('st-players') },
        ...(playing ? [{ id: 'finish', icon: '🏁', title: 'إنهاء اللعبة وعرض الفائز', hint: 'ينهي اللعبة الحين', run: p.finishGame }] : []),
      ],
    });
  }

  sections.push({
    id: 'tools',
    title: '🧰 أدوات',
    items: [
      { id: 'howto', icon: '📖', title: 'طريقة اللعب', hint: 'للستريمر والمشاهدين', run: howto },
      { id: 'keys', icon: '⌨️', title: 'اختصارات لوحة المفاتيح', badge: '؟', run: p.onKeys },
      { id: 'full', icon: '⛶', title: 'ملء الشاشة', badge: 'F', run: () => void toggleFullscreen() },
      { id: 'home', icon: '🏠', title: 'اللعبة الأساسية', hint: 'جاوب أو بادل بين فريقين', run: () => window.location.assign('/') },
    ],
  });

  const all = new Map(sections.flatMap((x) => x.items).map((it) => [it.id, it]));
  const pick = (...ids: string[]) => ids.map((id) => all.get(id)).filter((x): x is QaItem => Boolean(x));
  const goBtn = () => document.querySelector<HTMLButtonElement>('[data-hotkey="go"]');
  const context = !s
    ? { icon: '🔴', label: 'قبل بداية البث' }
    : { icon: VARIANT_ICON[s.variant ?? p.variant] ?? '🎮', label: PHASE_LABEL[s.phase], detail: s.phase === 'lobby' ? `${s.joined.length} مشارك` : `${Math.min(s.used.length + (s.phase === 'board' ? 1 : 0), s.totalCells)} من ${s.totalCells} · ${s.joined.length} مشارك` };
  const tiles: QaItem[] = !s
    ? pick('live', 'test', 'howto')
    : lobby
      ? pick('begin', 'copy-screen', 'pack', 'joined')
      : [
          // The page's main button for this phase (start the question, show the options, end it, next…).
          ...(playing && s.phase !== 'board' ? [{ id: 'go', icon: '▶️', title: 'الخطوة التالية', run: () => goBtn()?.click() }] : []),
          ...pick('top', 'players', 'finish', 'copy-screen'),
        ].slice(0, 4);

  return <QuickAccess site="stream" sections={sections} context={context} tiles={tiles} compact={playing} />;
}
