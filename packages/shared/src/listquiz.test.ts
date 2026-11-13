import { describe, expect, it } from 'vitest';
import { buildListIndex, listFold, matchList } from './listquiz';
import { chatMessage, deal, judgeUnknown, newStream, tick, toBoard, type StreamState } from './streamquiz';

const answers = ['ليونيل ميسي|ميسي|Messi', 'كريستيانو رونالدو|رونالدو|Ronaldo|CR7', 'لوكا مودريتش|Modric', 'أنطوان غريزمان|جريزمان|Griezmann', 'الهلال|Al Hilal'];

describe('matching', () => {
  const ix = buildListIndex(answers);
  it('takes any written form, loosely', () => {
    expect(matchList(ix, 'ميسي')).toEqual([0]);
    expect(matchList(ix, 'messi')).toEqual([0]);
    expect(matchList(ix, 'cr7')).toEqual([1]);
    expect(matchList(ix, 'مودريتش')).toEqual([2]);
    expect(matchList(ix, 'غريزمان')).toEqual([3]);
    expect(matchList(ix, 'هلال')).toEqual([4]);
    expect(matchList(ix, 'الهلال!')).toEqual([4]);
  });
  it('forgives one slipped letter, and splits on commas', () => {
    expect(matchList(ix, 'رونالدوو')).toEqual([1]);
    expect(matchList(ix, 'ميسي، رونالدو, Modric').sort()).toEqual([0, 1, 2]);
    expect(matchList(ix, 'نيمار')).toEqual([]);
  });
  it('takes a whole saying with a slip or two', () => {
    const p = buildListIndex(['الصبر مفتاح الفرج', 'من جد وجد ومن زرع حصد|من جد وجد']);
    expect(matchList(p, 'الصبر مفتاح الفرج')).toEqual([0]);
    expect(matchList(p, 'الصبر مفتاح الفرح')).toEqual([0]);
    expect(matchList(p, 'من جد وجد')).toEqual([1]);
    expect(matchList(p, 'الصبر')).toEqual([]);
  });
  it('folds hamza, ta marbuta and ya', () => {
    expect(listFold('أنطوان')).toBe(listFold('انطوان'));
    expect(listFold('مكة')).toBe(listFold('مكه'));
    expect(listFold('موسى')).toBe(listFold('موسي'));
  });
});

describe('a list round', () => {
  const start = () => {
    let s: StreamState = { ...newStream('Abdullah', 10, 30_000), variant: 'list' };
    for (const p of ['Ali', 'Sara', 'Omar', 'Noor']) s = chatMessage(s, p, 'دخول');
    s = toBoard(s);
    return deal(s, 'list:1', { text: 'اذكر لاعبين', options: [], correctIndex: -1, points: 1, imageUrl: null, listAnswers: answers }, 0);
  };
  it('a point per right answer once, then 5/3/2 for the top three', () => {
    let s = start();
    expect(s.phase).toBe('answer');
    s = chatMessage(s, 'Ali', 'ميسي', 1);
    s = chatMessage(s, 'Ali', 'ميسي', 2);
    s = chatMessage(s, 'Ali', 'رونالدو', 3);
    s = chatMessage(s, 'Sara', 'ميسي، مودريتش', 4);
    s = chatMessage(s, 'Omar', 'الهلال', 5);
    s = chatMessage(s, 'Noor', 'نيمار', 6);
    expect(s.round?.list?.found.ali).toEqual([0, 1]);
    s = tick(s, 30_000);
    expect(s.phase).toBe('result');
    // Ali and Sara both have 2 — Ali got there first.
    expect(s.scores).toMatchObject({ ali: 7, sara: 5, omar: 3, noor: 0 });
    expect(s.result?.rows.ali).toMatchObject({ found: 2, bonus: 5 });
  });

  it('the streamer accepts an answer that is not on the list, during or after the time', () => {
    let s = start();
    s = chatMessage(s, 'Ali', 'نيمار', 1);
    s = chatMessage(s, 'Sara', 'نيمار، ميسي', 2);
    s = chatMessage(s, 'Omar', 'هههههه', 3);
    const key = Object.keys(s.round!.list!.unknown!).find((k) => s.round!.list!.unknown![k]!.text === 'نيمار')!;
    expect(s.round!.list!.unknown![key]!.by).toEqual(['ali', 'sara']);
    s = tick(s, 30_000);
    expect(s.scores).toMatchObject({ sara: 6, ali: 0 });
    s = judgeUnknown(s, key, true);
    // Recounted: Sara 2 answers (+5), Ali 1 (+3)
    expect(s.scores).toMatchObject({ sara: 7, ali: 4 });
    expect(s.round!.list!.unknown![key]).toBeUndefined();
    const omar = Object.keys(s.round!.list!.unknown!)[0]!;
    expect(judgeUnknown(s, omar, false).round!.list!.unknown![omar]).toBeUndefined();
  });
});
