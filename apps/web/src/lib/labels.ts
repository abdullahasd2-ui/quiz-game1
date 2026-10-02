import type { QuestionType } from '@quiz/shared';

export const TYPE_LABELS: Record<QuestionType, string> = {
  text: 'نص',
  image: 'صورة',
  reveal: 'اكتشف الصورة',
  zoom: 'زوم',
};

/** Types that show a second, revealed image with the answer. */
export const TYPES_WITH_REVEAL: QuestionType[] = ['reveal', 'zoom'];
