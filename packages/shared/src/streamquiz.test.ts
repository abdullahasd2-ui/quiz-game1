import { describe, expect, it } from 'vitest';
import { chatMessage, deal, finish, newStream, parseOption, standings, streamerAct, tick, toBoard, STREAM_ANSWER_MS, STREAM_CHOOSE_MS, type StreamQuestion } from './streamquiz';

const q: StreamQuestion = { text: 'وين برج ايفل؟', options: ['لندن', 'باريس', 'روما', 'مدريد'], correctIndex: 1, points: 300, imageUrl: null };
const join = (s: ReturnType<typeof newStream>, ...names: string[]) => names.reduce((acc, n) => chatMessage(acc, n, 'دخول'), s);
const begin = (...players: string[]) => deal(toBoard(join(newStream('Abdullah', 6), ...players)), '1:300', q, 0);
const say = (s: ReturnType<typeof begin>, user: string, text: string) => chatMessage(s, user, text, 1);
const end = (s: ReturnType<typeof begin>) => streamerAct(streamerAct(s, { type: 'show' }, 1), { type: 'finish' }, 2);

describe('stream quiz', () => {
  it('only viewers who typed «دخول» play', () => {
    let s = begin('Ali');
    s = streamerAct(s, { type: 'answer', index: 1 }, 0);
    s = say(s, 'Ali', '1');
    s = say(s, 'Sara', '1'); // never joined
    s = streamerAct(s, { type: 'show' }, 1);
    s = say(s, 'Ali', 'جاوب باريس');
    s = say(s, 'Sara', '2');
    s = streamerAct(s, { type: 'finish' }, 2);
    expect(Object.keys(s.result!.rows).sort()).toEqual(['abdullah', 'ali']);
    expect(s.scores).toMatchObject({ abdullah: 300, ali: 300 });
  });

  it('the streamer answers first and his choice stays unscored until the round ends', () => {
    let s = begin('Ali');
    expect(s.phase).toBe('streamer');
    expect(say(s, 'Ali', '1').round?.choices).toEqual({}); // chat cannot act yet
    s = streamerAct(s, { type: 'answer', index: 1 }, 0);
    expect(s.phase).toBe('choose');
    expect(s.scores.abdullah).toBe(0);
  });

  it('chat: 1 answers, 2 swaps with the streamer (double if he is right, minus if wrong)', () => {
    const run = (idx: number) => {
      let s = begin('Ali', 'Sara', 'Omar');
      s = streamerAct(s, { type: 'answer', index: idx }, 0);
      s = say(s, 'Ali', '2');
      s = say(s, 'Sara', 'بادل');
      s = say(s, 'Omar', '1');
      s = streamerAct(s, { type: 'show' }, 1);
      s = say(s, 'Omar', '3'); // wrong (option 3)
      return streamerAct(s, { type: 'finish' }, 2);
    };
    expect(run(1).scores).toMatchObject({ abdullah: 300, ali: 600, sara: 600, omar: 0 });
    expect(run(0).scores).toMatchObject({ abdullah: 0, ali: -300, sara: -300, omar: 0 });
  });

  it('a swapper cannot answer, and the first answer is locked', () => {
    let s = begin('Ali', 'Sara');
    s = streamerAct(s, { type: 'answer', index: 1 }, 0);
    s = say(say(s, 'Ali', '2'), 'Sara', '1');
    s = streamerAct(s, { type: 'show' }, 1);
    s = say(s, 'Ali', '2');
    s = say(say(s, 'Sara', '1'), 'Sara', '2');
    s = streamerAct(s, { type: 'finish' }, 2);
    expect(s.result?.rows.ali?.picked).toBeNull();
    expect(s.result?.rows.sara?.picked).toBe(0);
  });

  it('streamer swaps with a viewer: the viewer answers for him (double / minus) and scores nothing', () => {
    const run = (text: string) => {
      let s = begin('Ali', 'Sara');
      s = streamerAct(s, { type: 'swap', user: 'ali' }, 0);
      s = say(s, 'Ali', '2'); // the partner cannot swap out
      s = say(s, 'Sara', '2'); // swaps with the streamer, who swapped himself
      s = streamerAct(s, { type: 'show' }, 1);
      s = say(s, 'Ali', text);
      return streamerAct(s, { type: 'finish' }, 2);
    };
    expect(run('2').scores).toMatchObject({ abdullah: 600, ali: 0, sara: 600 });
    expect(run('1').scores).toMatchObject({ abdullah: -300, ali: 0, sara: -300 });
    expect(streamerAct(begin('Ali'), { type: 'swap', user: 'nobody' }, 0).phase).toBe('streamer');
  });

  it('timeouts move the phases', () => {
    let s = streamerAct(begin('Ali'), { type: 'answer', index: 1 }, 0);
    s = say(s, 'Ali', '1');
    s = tick(s, STREAM_CHOOSE_MS + 1);
    expect(s.phase).toBe('answer');
    s = say(s, 'Ali', '3');
    s = tick(s, STREAM_CHOOSE_MS + STREAM_ANSWER_MS + 2);
    expect(s.phase).toBe('result');
    expect(s.scores).toMatchObject({ abdullah: 300, ali: 0 });
  });

  it('standings show how each player took the question', () => {
    let s = streamerAct(begin('Ali'), { type: 'answer', index: 1 }, 0);
    s = end(say(s, 'Ali', '2'));
    const top = standings(s);
    expect(top[0]).toMatchObject({ name: 'Ali', outcome: 'swap-win', delta: 600 });
    expect(top[1]).toMatchObject({ name: 'Abdullah', outcome: 'answer-right' });
  });

  it('each board cell plays once and the game can end', () => {
    let s = streamerAct(begin(), { type: 'answer', index: 0 }, 0);
    s = toBoard(end(s));
    expect(deal(s, '1:300', q, 0).phase).toBe('board');
    expect(finish(s).phase).toBe('over');
  });

  it('parses options', () => {
    expect(parseOption('جاوب 3', q.options)).toBe(2);
    expect(parseOption('٤', q.options)).toBe(3);
    expect(parseOption('جاوب باريس', q.options)).toBe(1);
    expect(parseOption('5', q.options)).toBeNull();
  });
});
