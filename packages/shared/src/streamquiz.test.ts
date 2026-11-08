import { describe, expect, it } from 'vitest';
import { type StreamState, chatMessage, deal, finish, newStream, parseOption, standings, streamerAct, tick, toBoard, STREAM_ANSWER_MS, STREAM_CHOOSE_MS, type StreamQuestion } from './streamquiz';

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

describe('broadcast view', () => {
  it('hides the streamer secret until the round ends', async () => {
    const { publicView } = await import('./streamquiz');
    let s = begin('Ali');
    expect(publicView(s).round?.question.text).toBe('');
    s = streamerAct(s, { type: 'answer', index: 1 }, 0);
    let v = publicView(s);
    expect(v.round?.streamer).toBeNull();
    expect(v.round?.question.correctIndex).toBe(-1);
    expect(v.round?.question.options).toEqual([]);
    s = say(say(s, 'Ali', '1'), 'Ali', '1');
    s = streamerAct(s, { type: 'show' }, 1);
    s = say(s, 'Ali', '3');
    v = publicView(s);
    expect(v.round?.question.options).toHaveLength(4);
    expect(v.round?.picks).toEqual({ ali: 0 });
    expect(JSON.stringify(v)).not.toContain('"correctIndex":1');
    s = streamerAct(s, { type: 'finish' }, 2);
    expect(publicView(s).result?.correctIndex).toBe(1);
  });
});

describe('answer time', () => {
  it('uses the time the streamer picked', () => {
    let s = deal(toBoard(chatMessage(newStream('S', 6, 15_000), 'Ali', 'دخول')), '1:100', q, 0);
    s = streamerAct(s, { type: 'answer', index: 1 }, 0);
    s = streamerAct(s, { type: 'show' }, 1000);
    expect(s.deadline).toBe(16_000);
    expect(tick(s, 15_999).phase).toBe('answer');
    expect(tick(s, 16_000).phase).toBe('result');
  });
});

describe('streak, fastest and «نقاطي»', () => {
  const round = (s: ReturnType<typeof newStream>, cell: string, aliAt: number, saraAt: number) => {
    let r = deal(toBoard(s), cell, q, 0);
    r = streamerAct(r, { type: 'answer', index: 1 }, 0);
    r = chatMessage(chatMessage(r, 'Ali', '1', 1), 'Sara', '1', 1);
    r = streamerAct(r, { type: 'show' }, 2);
    r = chatMessage(r, 'Sara', '2', saraAt);
    r = chatMessage(r, 'Ali', '2', aliAt);
    return streamerAct(r, { type: 'finish' }, 99);
  };
  it('the third right answer in a row is doubled', () => {
    let s = chatMessage(chatMessage(newStream('S', 20), 'Ali', 'دخول'), 'Sara', 'دخول');
    s = round(s, '1:100', 5, 6);
    s = round(s, '1:200', 5, 6);
    s = round(s, '1:300', 5, 6);
    expect(s.result?.rows.ali).toMatchObject({ delta: 600, streak: true });
    expect(s.result?.rows.s).toMatchObject({ delta: 600, streak: true }); // the streamer answered right too
    expect(s.scores.ali).toBe(300 + 300 + 600); // the test question is worth 300 in every cell
  });
  it('names the fastest right answer', () => {
    const s = round(chatMessage(chatMessage(newStream('S', 20), 'Ali', 'دخول'), 'Sara', 'دخول'), '1:100', 9, 4);
    expect(s.result?.fastest).toBe('sara');
  });
  it('«نقاطي» marks who asked', () => {
    let s = chatMessage(newStream('S', 20), 'Ali', 'دخول');
    s = chatMessage(s, 'Ali', 'نقاطي', 42);
    expect(s.scoreAsk).toEqual({ key: 'ali', at: 42 });
    expect(chatMessage(s, 'Nobody', 'نقاطي', 50).scoreAsk?.key).toBe('ali'); // only players
  });
});

describe('«جاوب أو اقلب» on the stream', () => {
  const flipGame = () => {
    let s = newStream('S', 20);
    s = { ...s, variant: 'flip' as const };
    for (const n of ['Ali', 'Sara', 'Omar']) s = chatMessage(s, n, 'دخول');
    return deal(toBoard(s), '1:300', q, 0);
  };
  it('chat flips the streamer: his result is turned over once; flippers score nothing', () => {
    const run = (streamerIndex: number) => {
      let s = streamerAct(flipGame(), { type: 'answer', index: streamerIndex }, 0);
      s = chatMessage(s, 'Ali', 'اقلب', 1);
      s = chatMessage(s, 'Sara', '2', 1);
      s = chatMessage(s, 'Omar', '1', 1);
      s = streamerAct(s, { type: 'show' }, 2);
      s = chatMessage(s, 'Omar', '2', 3);
      return streamerAct(s, { type: 'finish' }, 4);
    };
    const right = run(1);
    expect(right.scores).toMatchObject({ s: -300, ali: 0, sara: 0, omar: 300 });
    expect(right.result?.rows.s?.outcome).toBe('flipped-right');
    expect(right.result?.rows.ali?.outcome).toBe('flip');
    expect(run(0).scores).toMatchObject({ s: 300, ali: 0, sara: 0 });
  });
  it('nobody flips: the streamer scores as usual', () => {
    let s = streamerAct(flipGame(), { type: 'answer', index: 1 }, 0);
    s = streamerAct(streamerAct(s, { type: 'show' }, 1), { type: 'finish' }, 2);
    expect(s.scores.s).toBe(300);
  });
  it('the streamer flips a player: that player’s result is turned over, the streamer scores nothing', () => {
    const run = (text: string) => {
      let s = streamerAct(flipGame(), { type: 'swap', user: 'ali' }, 0);
      s = streamerAct(s, { type: 'show' }, 1);
      s = chatMessage(s, 'Ali', text, 2);
      return streamerAct(s, { type: 'finish' }, 3);
    };
    expect(run('2').scores).toMatchObject({ s: 0, ali: -300 }); // right → minus
    expect(run('3').scores).toMatchObject({ s: 0, ali: 300 }); // wrong → plus
    expect(run('2').result?.rows.ali?.outcome).toBe('flipped-right');
  });
});

/** Hide the key in `slot` with no shuffle, and let the shuffle phase end. */
const hideAt = (s: StreamState, slot: number) => tick(streamerAct(s, { type: 'answer', index: slot, shuffle: { from: slot, swaps: [], ms: 100 } }, 0), 1e6);

describe('«خبّي أو اكشف» on the stream', () => {
  const hideGame = async () => {
    const { hideQuestion } = await import('./streamquiz');
    let s: StreamState = { ...newStream('S', 5), variant: 'hide' };
    for (const n of ['Ali', 'Sara', 'Omar']) s = chatMessage(s, n, 'دخول');
    return deal(toBoard(s), 'h:1', hideQuestion(), 0);
  };
  it('the streamer hides, the chat guesses 1-10 at once; finders score, the streamer scores only if nobody finds it', async () => {
    let s = await hideGame();
    s = hideAt(s, 6); // box 7
    expect(s.phase).toBe('answer');
    expect(s.round?.question.correctIndex).toBe(6); // no swaps in this test
    s = chatMessage(s, 'Ali', '7', 1);
    s = chatMessage(s, 'Sara', '10', 2);
    s = chatMessage(s, 'Omar', '٧', 3); // Arabic digit
    s = streamerAct(s, { type: 'finish' }, 4);
    expect(s.scores).toMatchObject({ s: 0, ali: 600, sara: 0, omar: 300 }); // Ali found it first: double
    expect(s.result?.rows.ali?.first).toBe(true);
    expect(s.result?.rows.s?.outcome).toBe('hid-found');
    expect(s.result?.fastest).toBe('ali');
  });
  it('nobody finds it: the streamer scores', async () => {
    let s = hideAt(await hideGame(), 0);
    s = chatMessage(chatMessage(s, 'Ali', '2', 1), 'Sara', '3', 1);
    s = streamerAct(s, { type: 'finish' }, 2);
    expect(s.scores).toMatchObject({ s: 300, ali: 0, sara: 0 });
    expect(s.result?.rows.s?.outcome).toBe('hid-safe');
  });
  it('no swapping in hide, and 11 is not a box', async () => {
    const s = await hideGame();
    expect(streamerAct(s, { type: 'swap', user: 'ali' }, 0).phase).toBe('streamer');
    const g = chatMessage(hideAt(s, 0), 'Ali', '11', 1);
    expect(g.round?.picks.ali).toBeUndefined();
  });
});

describe('«خبّي أو اكشف»: the streamer takes a player\'s points when nobody finds the key', () => {
  const setup = async () => {
    const { hideQuestion } = await import('./streamquiz');
    let s: StreamState = { ...newStream('S', 5), variant: 'hide' };
    for (const n of ['Ali', 'Sara']) s = chatMessage(s, n, 'دخول');
    s = { ...s, scores: { ...s.scores, ali: 900, sara: 200 } };
    s = hideAt(deal(toBoard(s), 'h:1', hideQuestion(), 0), 4);
    s = chatMessage(chatMessage(s, 'Ali', '1', 1), 'Sara', '2', 1);
    return streamerAct(s, { type: 'finish' }, 2);
  };
  it('goes to the steal step, and the chosen player\'s points move to the streamer', async () => {
    let s = await setup();
    expect(s.phase).toBe('steal');
    expect(s.scores.s).toBe(300);
    expect(streamerAct(s, { type: 'steal', user: 'nobody' }, 3).phase).toBe('steal');
    s = streamerAct(s, { type: 'steal', user: 'Ali' }, 3);
    expect(s.phase).toBe('result');
    expect(s.scores).toMatchObject({ s: 1200, ali: 0, sara: 200 });
    expect(s.result?.stolen).toEqual({ from: 'ali', points: 900 });
    expect(s.result?.rows.ali).toMatchObject({ outcome: 'stolen', delta: -900 });
  });
});

describe('the box shuffle', () => {
  it('follows the key through the swaps, and the level sets how many and how fast', async () => {
    const { makeShuffle, shuffleEnd, STREAM_HIDE_LEVELS } = await import('./streamquiz');
    expect(shuffleEnd({ from: 2, swaps: [[2, 5], [5, 9], [0, 1]], ms: 100 })).toBe(9);
    for (const p of [100, 200, 300] as const) {
      const sh = makeShuffle(3, p);
      expect(sh.swaps).toHaveLength(STREAM_HIDE_LEVELS[p].swaps);
      expect(sh.ms).toBe(STREAM_HIDE_LEVELS[p].ms);
      for (const [a, b] of sh.swaps) expect(a).not.toBe(b);
    }
    expect(STREAM_HIDE_LEVELS[300].ms).toBeLessThan(STREAM_HIDE_LEVELS[100].ms);
  });
  it('the answer is where the key ends; the shuffle phase ends by itself', async () => {
    const { hideQuestion } = await import('./streamquiz');
    let s: StreamState = { ...newStream('S', 5), variant: 'hide' };
    s = chatMessage(s, 'Ali', 'دخول');
    s = deal(toBoard(s), 'h:1', hideQuestion(200), 0);
    s = streamerAct(s, { type: 'answer', index: 1, shuffle: { from: 1, swaps: [[1, 7]], ms: 400 } }, 0);
    expect(s.phase).toBe('shuffle');
    expect(chatMessage(s, 'Ali', '8', 1).round?.picks.ali).toBeUndefined(); // no guessing during the shuffle
    s = tick(s, s.deadline!);
    expect(s.phase).toBe('answer');
    s = streamerAct(chatMessage(s, 'Ali', '8', 1), { type: 'finish' }, 2);
    expect(s.scores.ali).toBe(400); // 200 points, first finder doubles
  });
});
