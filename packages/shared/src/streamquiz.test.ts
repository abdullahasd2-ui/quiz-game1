import { describe, expect, it } from 'vitest';
import { chatMessage, deal, finish, newStream, parseOption, standings, streamerAct, tick, toBoard, STREAM_ANSWER_MS, STREAM_CHOOSE_MS, type StreamQuestion } from './streamquiz';

const q: StreamQuestion = { text: 'وين برج ايفل؟', options: ['لندن', 'باريس', 'روما', 'مدريد'], correctIndex: 1, points: 300, imageUrl: null };
const begin = () => deal(toBoard(newStream('Abdullah', 6)), '1:300', q, 0);
const toAnswer = (s: ReturnType<typeof begin>) => streamerAct(s, { type: 'show' }, 0);

describe('stream quiz', () => {
  it('everyone answers the same question and keeps their own score', () => {
    let s = begin();
    s = chatMessage(s, 'Ali', '2', 1);
    s = chatMessage(s, 'Sara', 'جاوب', 1);
    s = toAnswer(s);
    s = chatMessage(s, 'Ali', 'جاوب باريس', 2);
    s = chatMessage(s, 'Sara', '3', 2);
    s = streamerAct(s, { type: 'option', index: 1 }, 3);
    s = streamerAct(s, { type: 'finish' }, 4);
    expect(s.scores).toMatchObject({ abdullah: 300, ali: 300, sara: 0 });
    expect(s.phase).toBe('result');
  });

  it('a swapper takes the streamer answer: double if right, minus if wrong', () => {
    const run = (streamerIndex: number) => {
      let s = begin();
      s = chatMessage(s, 'Ali', '1', 1);
      s = chatMessage(s, 'Sara', 'بادل', 1);
      s = toAnswer(s);
      s = streamerAct(s, { type: 'option', index: streamerIndex }, 2);
      return streamerAct(s, { type: 'finish' }, 3);
    };
    expect(run(1).scores).toMatchObject({ abdullah: 300, ali: 600, sara: 600 });
    expect(run(0).scores).toMatchObject({ abdullah: 0, ali: -300, sara: -300 });
  });

  it('a swapper cannot answer, and an answer is locked after the first', () => {
    let s = begin();
    s = chatMessage(s, 'Ali', '1', 1);
    s = toAnswer(s);
    s = chatMessage(s, 'Ali', '2', 2);
    s = chatMessage(s, 'Sara', '1', 2);
    s = chatMessage(s, 'Sara', '2', 3); // first answer wins
    s = streamerAct(s, { type: 'option', index: 1 }, 3);
    s = streamerAct(s, { type: 'finish' }, 3);
    expect(s.result?.rows.ali?.outcome).toBe('swap-win');
    expect(s.result?.rows.sara?.picked).toBe(0);
    expect(s.result?.rows.sara?.outcome).toBe('answer-wrong');
  });

  it('chat can answer without choosing first (counts as answer)', () => {
    let s = toAnswer(begin());
    s = chatMessage(s, 'Ali', '2', 1);
    expect(chatMessage(s, 'Ali', '2', 1).round?.picks.ali).toBe(1);
  });

  it('timeouts move the phases and unanswered streamer scores nothing', () => {
    let s = begin();
    s = tick(s, STREAM_CHOOSE_MS + 1);
    expect(s.phase).toBe('answer');
    s = chatMessage(s, 'Ali', '2', STREAM_CHOOSE_MS + 2);
    s = tick(s, STREAM_CHOOSE_MS + STREAM_ANSWER_MS + 2);
    expect(s.phase).toBe('result');
    expect(s.scores.abdullah).toBe(0);
    expect(s.scores.ali).toBe(300);
  });

  it('standings show how each player took the question', () => {
    let s = begin();
    s = chatMessage(s, 'Ali', '1', 1);
    s = toAnswer(s);
    s = streamerAct(streamerAct(s, { type: 'option', index: 1 }, 1), { type: 'finish' }, 1);
    const top = standings(s);
    expect(top[0]).toMatchObject({ name: 'Ali', outcome: 'swap-win', delta: 600 });
    expect(top[1]).toMatchObject({ name: 'Abdullah', outcome: 'answer-right' });
  });

  it('the board is used once per cell and ends the game', () => {
    let s = begin();
    s = streamerAct(s, { type: 'show' }, 0);
    s = streamerAct(s, { type: 'finish' }, 0);
    s = toBoard(s);
    expect(deal(s, '1:300', q, 0).phase).toBe('board'); // already used
    expect(finish(s).phase).toBe('over');
  });

  it('parses options', () => {
    expect(parseOption('جاوب 3', q.options)).toBe(2);
    expect(parseOption('٤', q.options)).toBe(3);
    expect(parseOption('جاوب باريس', q.options)).toBe(1);
    expect(parseOption('5', q.options)).toBeNull();
  });
});
