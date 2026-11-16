// Links between the main game and the stream page. In the iOS/Android app the stream page is not part of the
// app (it is the website), so it opens in the browser; on the web it is the same site.
export const STREAM_URL = 'https://jawabbadel.com/kick/quiz';

export const isNative = () => Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/** Props for an <a> to the stream page. */
export const streamLink = () => (isNative() ? { href: STREAM_URL, target: '_blank', rel: 'noopener noreferrer' } : { href: '/kick/quiz' });

/** Goes to the stream page (in the app: opens it in the browser). */
export function openStream() {
  if (isNative()) window.open(STREAM_URL, '_blank');
  else window.location.assign('/kick/quiz');
}
