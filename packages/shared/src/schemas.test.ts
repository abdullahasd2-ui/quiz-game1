import { describe, expect, it } from 'vitest';
import { normalizeQuestionText } from './schemas';

describe('normalizeQuestionText', () => {
  it('ignores diacritics, letter variants and punctuation', () => {
    expect(normalizeQuestionText('ما هِيَ عاصمة أستراليا؟')).toBe(normalizeQuestionText('ما هي عاصمه استراليا'));
  });

  it('keeps emoji, so emoji questions with the same wording stay distinct', () => {
    const prompt = 'أي دولة تمثلها هذه الإيموجي؟';
    expect(normalizeQuestionText(`${prompt} 🗻🍣🌸`)).not.toBe(normalizeQuestionText(`${prompt} 🐻🪆❄️`));
  });

  it('keeps flags', () => {
    const prompt = 'أي لاعب تمثله هذه الإيموجي؟';
    expect(normalizeQuestionText(`${prompt} 🇵🇹7️⃣`)).not.toBe(normalizeQuestionText(`${prompt} 🇦🇷7️⃣`));
  });
});
