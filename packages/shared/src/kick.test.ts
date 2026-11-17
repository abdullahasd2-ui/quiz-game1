import { describe, expect, it } from 'vitest';
import { kickSlugs } from './kick';

describe('kickSlugs', () => {
  it('accepts a link, @name or the name, and tries an underscore as a hyphen', () => {
    expect(kickSlugs('Abo_Ali')).toEqual(['abo-ali', 'abo_ali']);
    expect(kickSlugs('@xQc')).toEqual(['xqc']);
    expect(kickSlugs('https://kick.com/Streamer_1/videos')).toEqual(['streamer-1', 'streamer_1']);
    expect(kickSlugs('kick.com/name ')).toEqual(['name']);
    expect(kickSlugs('اسم عربي')).toEqual([]);
  });
});
