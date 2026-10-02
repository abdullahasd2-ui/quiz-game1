import { App } from '@capacitor/app';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DirectionProvider } from '@/components/ui/direction';
import { Toaster } from '@/components/ui/sonner';
import { GamePage } from '@/game/GamePage';
import './app.css';

/** Invite links (https://jawabbadel.com/?code=XXXX) carry the room code. */
function codeFrom(url: string) {
  try {
    return new URL(url).searchParams.get('code')?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

const router = createMemoryRouter([{ path: '/', element: <GamePage /> }]);

App.addListener('appUrlOpen', ({ url }) => {
  const code = codeFrom(url);
  if (code) void router.navigate(`/?code=${code}`);
});
// A game has no back stack: Android's back button sends the app to the background instead of quitting mid-game.
App.addListener('backButton', () => void App.minimizeApp());

// Phones lying on the table between turns shouldn't lock.
KeepAwake.keepAwake().catch(() => {});
StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DirectionProvider dir="rtl">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="bottom-center" richColors />
      </QueryClientProvider>
    </DirectionProvider>
  </StrictMode>,
);

void SplashScreen.hide();
