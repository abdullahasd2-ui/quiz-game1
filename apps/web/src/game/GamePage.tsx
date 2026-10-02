import { useSearchParams } from 'react-router';
import { BoardScreen, WaitingForPick } from './screens/BoardScreen';
import { FinalScreen } from './screens/FinalScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { QuestionScreen, TvQuestionScreen } from './screens/QuestionScreen';
import { ResultOverlay } from './screens/ResultOverlay';
import { FloatingWords } from './ui';
import { useRoom } from './useRoom';

export function GamePage() {
  const { view, deadline, connected, resuming, leave } = useRoom();
  const [params] = useSearchParams();

  let screen;
  if (resuming) {
    screen = (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3.5">
        <div className="size-11 animate-spin rounded-full border-4 border-q-line border-t-q-gold" />
        <div className="text-sm text-white/50">جاري استرجاع الغرفة...</div>
      </div>
    );
  } else if (!view) {
    screen = <HomeScreen initialCode={params.get('code')?.toUpperCase() ?? ''} />;
  } else if (view.status === 'lobby') {
    screen = <LobbyScreen view={view} />;
  } else if (view.status === 'done') {
    screen = <FinalScreen view={view} onPlayAgain={leave} />;
  } else if (view.phase === 'board') {
    screen = view.mode === 'tv' && view.you !== 'tv' ? <WaitingForPick view={view} /> : <BoardScreen view={view} />;
  } else {
    screen = view.you === 'tv' ? <TvQuestionScreen view={view} deadline={deadline} /> : <QuestionScreen view={view} deadline={deadline} />;
  }

  return (
    <div className="dark min-h-dvh bg-q-bg font-sans text-white" dir="rtl">
      <FloatingWords />
      {view && view.status !== 'done' && (
        <button
          type="button"
          onClick={leave}
          className="fixed top-2.5 left-2.5 z-40 rounded-full border border-q-red/40 bg-q-red/15 px-3.5 py-1.5 text-xs text-q-red"
        >
          🚪 خروج من الغرفة
        </button>
      )}
      {!connected && !resuming && (
        <div className="fixed inset-x-0 top-0 z-40 bg-q-red/90 py-1 text-center text-xs font-bold" role="status">
          انقطع الاتصال — جاري إعادة الاتصال...
        </div>
      )}
      <main className="relative z-10 mx-auto max-w-[960px] px-4 pt-12 pb-6">{screen}</main>
      {view?.status === 'playing' && view.phase === 'result' && <ResultOverlay view={view} />}
    </div>
  );
}
