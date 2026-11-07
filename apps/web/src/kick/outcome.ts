import type { StreamOutcome } from '@quiz/shared';

export const OUTCOME: Record<StreamOutcome, { label: string; cls: string }> = {
  'answer-right': { label: '✅ جاوب صح', cls: 'text-q-green' },
  'answer-wrong': { label: '❌ جاوب غلط', cls: 'text-q-red' },
  'swap-win': { label: '🔄 بادل وربح', cls: 'text-q-green' },
  'swap-lose': { label: '🔄 بادل وخسر', cls: 'text-q-red' },
  idle: { label: '⏱ ما جاوب', cls: 'text-white/50' },
};
