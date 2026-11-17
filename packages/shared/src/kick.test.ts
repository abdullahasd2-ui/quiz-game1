import { describe, expect, it } from 'vitest';
import { handleKickFrame, kickSlugs } from './kick';

describe('kickSlugs', () => {
  it('accepts a link, @name or the name, and tries an underscore as a hyphen', () => {
    expect(kickSlugs('Abo_Ali')).toEqual(['abo-ali', 'abo_ali']);
    expect(kickSlugs('@xQc')).toEqual(['xqc']);
    expect(kickSlugs('https://kick.com/Streamer_1/videos')).toEqual(['streamer-1', 'streamer_1']);
    expect(kickSlugs('kick.com/name ')).toEqual(['name']);
    expect(kickSlugs('اسم عربي')).toEqual([]);
  });
});

describe('handleKickFrame errors', () => {
  it("keeps Kick's own reason when its chat service refuses", () => {
    expect(handleKickFrame(JSON.stringify({ event: 'pusher:error', data: { code: 4001, message: 'App key not in this cluster' } }), 1)).toEqual({ error: '4001 App key not in this cluster' });
    expect(handleKickFrame(JSON.stringify({ event: 'pusher:subscription_error', data: JSON.stringify({ error: 'Forbidden' }) }), 1)).toEqual({ error: 'Forbidden' });
  });
});
