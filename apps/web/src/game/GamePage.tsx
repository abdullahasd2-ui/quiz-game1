import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { play, resumeAudioIfNeeded, unlockAudio } from './fx/sound';
import { SoundToggle } from './fx/SoundToggle';
import { Intro } from './fx/Intro';
import { StreamerLink } from './fx/StreamerLink';
import { useGameFx } from './fx/useGameFx';
import { BoardScreen, WaitingForPick } from './screens/BoardScreen';
import { FinalScreen } from './screens/FinalScreen';
import { HideScreen } from './screens/HideScreen';
import { ListGameScreen } from './screens/ListGameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { QuestionScreen, TvQuestionScreen } from './screens/QuestionScreen';
import { PlayersButton, SoloPlayersButton } from './screens/PlayersPanel';
import { ResultOverlay } from './screens/ResultOverlay';
import { SoloGame } from './screens/SoloScreens';
import { Background3D } from '@/game/fx/Background3D';
import { useRoom } from './useRoom';
import { GameQuick } from '@/quick/GameQuick';
import { GameStart } from './fx/GameStart';
import { useCardSpotlight } from '@/lib/spotlight';
import { recordGame } from '@/quick/stats';
import { CornerTools, HotkeysHelp, useHotkeys, useWakeLock, type HotkeyRow } from '@/lib/hotkeys';

const GAME_KEYS: HotkeyRow[] = [
  ['A', 'جاوب (قرارك في السؤال)'],
  ['S', 'بادل أو اقلب'],
  ['D', 'اعكس (في «جاوب أو بادل أو اعكس»)'],
  ['1 / 2 / 3 / 4', 'اختيار الجواب'],
  ['1 … 9 / 0', 'اختيار الصندوق في «خبّي أو اكشف» (0 = الصندوق العاشر)'],
  ['H', 'طلب التلميح في «خبّي أو اكشف»'],
  ['Enter / Space', 'الزر الرئيسي: ابدأ اللعبة، التالي، العب مرة ثانية'],
  ['M', 'كتم الأصوات أو تشغيلها'],
  ['Ctrl+K / /', 'فتح مركز الاختصارات'],
];

export function GamePage() {
  const { view, solo, deadline, connected, resuming, leave } = useRoom();
  const [params] = useSearchParams();
  useGameFx(view);
  useCardSpotlight();
  // No fullscreen in the main game (phones and the app); the stream pages keep it.
  const { help, setHelp } = useHotkeys(undefined, { fullscreen: false });
  // The screen stays on from the lobby to the final result.
  useWakeLock(Boolean((view ?? solo) && (view ?? solo)!.status !== 'done'));
  // The player's own record (on this device) when a game reaches its final screen.
  useEffect(() => {
    if (view?.status === 'done') recordGame(view);
  }, [view]);
  // iOS suspends audio while the app is in the background.
  useEffect(() => {
    const wake = () => document.visibilityState === 'visible' && resumeAudioIfNeeded();
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, []);

  let screen;
  if (resuming) {
    screen = (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3.5">
        <div className="size-11 animate-spin rounded-full border-4 border-q-line border-t-q-gold" />
        <div className="text-sm text-white/50">جاري استرجاع الغرفة...</div>
      </div>
    );
  } else if (solo) {
    screen = <SoloGame view={solo} deadline={deadline} onPlayAgain={leave} />;
  } else if (!view) {
    const code = params.get('code')?.toUpperCase() ?? '';
    // Keyed so an invite link opened while on the home screen refills the form.
    screen = <HomeScreen key={code} initialCode={code} initialSolo={params.get('solo') === '1'} />;
  } else if (view.status === 'lobby') {
    screen = <LobbyScreen view={view} />;
  } else if (view.status === 'done') {
    screen = <FinalScreen view={view} onPlayAgain={leave} />;
  } else if (view.variant === 'list' && view.list) {
    screen = <ListGameScreen view={view} deadline={deadline} />;
  } else if (view.variant === 'hide' && view.hide) {
    screen = <HideScreen view={view} deadline={deadline} />;
  } else if (view.phase === 'board') {
    screen = view.mode === 'tv' && view.you !== 'tv' && view.you !== view.turn ? <WaitingForPick view={view} /> : <BoardScreen view={view} />;
  } else {
    screen = view.you === 'tv' ? <TvQuestionScreen view={view} deadline={deadline} /> : <QuestionScreen view={view} deadline={deadline} />;
  }

  // Each new screen is dealt onto the table (see screen-in in index.css); within one question the screen stays put.
  const screenKey = solo
    ? `solo-${solo.status}-${solo.phase === 'board' ? 'board' : 'q'}-${solo.used.length}-${solo.list?.round ?? 0}`
    : !view
    ? 'home'
    : view.status !== 'playing'
      ? view.status
      : view.variant === 'list' && view.list
        ? `list-${view.list.round}-${view.phase === 'board' ? 'pick' : 'q'}`
        : view.variant === 'hide' && view.hide
        ? `hide-${view.hide.round}`
        : `${view.phase === 'board' ? 'board' : 'q'}-${view.used.length}`;

  return (
    <div
      className="dark relative isolate min-h-dvh bg-q-bg font-sans text-white"
      dir="rtl"
      onPointerDownCapture={(e) => {
        unlockAudio();
        const button = (e.target as HTMLElement).closest('button');
        if (button && !button.disabled && !button.hasAttribute('data-silent')) play('tap');
      }}
    >
      <Intro />
      <div className="q-aurora" aria-hidden />
      {(view || solo) && <div className="q-topfade" aria-hidden />}
      <Background3D />
      <SoundToggle />
      <CornerTools fullscreen={false} onHelp={() => setHelp(true)} className="fixed top-[calc(env(safe-area-inset-top)+0.625rem)] right-13 z-40" />
      <HotkeysHelp open={help} onClose={() => setHelp(false)} rows={GAME_KEYS} fullscreen={false} />
      {!solo && <GameQuick view={view} leave={leave} onKeys={() => setHelp(true)} />}
      <GameStart status={view?.status ?? null} />
      {!view && !solo && <StreamerLink />}
      {(view ?? solo) && (view ?? solo)!.status !== 'done' && (
        <button
          type="button"
          onClick={leave}
          className="fixed top-[calc(env(safe-area-inset-top)+0.625rem)] left-2.5 z-40 rounded-full border border-q-red/40 bg-q-red/15 px-3.5 py-1.5 text-xs text-q-red"
        >
          🚪 خروج من الغرفة
        </button>
      )}
      {view?.status === 'playing' && <PlayersButton view={view} />}
      {solo?.status === 'playing' && <SoloPlayersButton view={solo} />}
      {!connected && !resuming && (view || solo) && (
        <div className="fixed inset-x-0 top-0 z-40 bg-q-red/90 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-1 text-center text-xs font-bold" role="status">
          انقطع الاتصال — جاري إعادة الاتصال...
        </div>
      )}
      <main className="relative z-10 mx-auto max-w-[960px] px-4 pt-14 pb-24 sm:px-6">
        <div key={screenKey} className="motion-safe:animate-screen-in">
          {screen}
        </div>
      </main>
      {view?.status === 'playing' && view.phase === 'result' && <ResultOverlay view={view} />}
    </div>
  );
}
