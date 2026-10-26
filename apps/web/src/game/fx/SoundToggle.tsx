import { play, setSoundEnabled, useSoundEnabled } from './sound';

/** Mutes the game's sound effects (there is no background music). Remembered on the device. */
export function SoundToggle() {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      aria-label={on ? 'كتم الأصوات' : 'تشغيل الأصوات'}
      aria-pressed={!on}
      data-silent
      onClick={() => {
        setSoundEnabled(!on);
        if (!on) play('pop');
      }}
      className="fixed top-[calc(env(safe-area-inset-top)+0.625rem)] right-2.5 z-40 grid size-9 place-items-center rounded-full border border-q-line bg-q-panel text-base text-white/70"
    >
      {on ? '🔊' : '🔇'}
    </button>
  );
}
