import { describe, expect, it } from 'vitest';
import { chatMessage, deal, newStream, parseOption, streamerAct, tick, STREAM_ANSWER_MS, type StreamQuestion } from './streamquiz';

const q: StreamQuestion = { text: 'وين برج ايفل؟', options: ['لندن', 'باريس', 'روما', 'مدريد'], correctIndex: 1, points: 300, imageUrl: null };
const start = () => deal(newStream('Abdullah', 4), q, 0);

describe('stream quiz', () => {
  it('streamer answers: right scores the points', () => {
    let s = start();
    expect(s.holder).toBeNull();
    s = streamerAct(s, { type: 'choose', choice: 'answer' }, 0);
    s = streamerAct(s, { type: 'option', index: 1 }, 1);
    expect(s.scores.abdullah).toBe(300);
    expect(s.phase).toBe('result');
  });

  it('streamer swaps with a chatter: right answer doubles for the streamer, wrong costs them', () => {
    let s = chatMessage(start(), 'Ali', 'hello', 0);
    s = streamerAct(s, { type: 'choose', choice: 'swap' }, 0);
    expect(s.phase).toBe('partner');
    s = streamerAct(s, { type: 'partner', user: 'ali' }, 0);
    expect(s.answerer).toBe('ali');
    expect(chatMessage(s, 'Sara', '2', 0).phase).toBe('answer'); // not her turn
    const right = chatMessage(s, 'Ali', 'جاوب باريس', 1);
    expect(right.scores.abdullah).toBe(600);
    const wrong = chatMessage(s, 'Ali', '1', 1);
    expect(wrong.scores.abdullah).toBe(-300);
  });

  it('chat turn: 2 answers, then 1-4 picks; 1 swaps and the streamer answers', () => {
    let s = chatMessage(newStream('Abdullah', 4), 'Ali', 'دخول', 0);
    s = deal(streamerAct(deal(s, q, 0), { type: 'choose', choice: 'answer' }, 0), q, 0); // round 1 streamer, round 2 chat
    s = streamerAct(deal(s, q, 0), { type: 'choose', choice: 'answer' }, 0);
    expect(s.holder).toBeNull();
  });

  it('chat holder answers and scores on their own', () => {
    let s = chatMessage(newStream('Abdullah', 4), 'Ali', 'دخول', 0);
    s = deal(s, q, 0);
    s = streamerAct(s, { type: 'choose', choice: 'answer' }, 0);
    s = streamerAct(s, { type: 'option', index: 0 }, 0); // wrong, round 1 done
    s = deal(s, q, 0);
    expect(s.holder).toBe('ali');
    s = chatMessage(s, 'Ali', '2', 1);
    s = chatMessage(s, 'Ali', '2', 2);
    expect(s.scores.ali).toBe(300);
  });

  it('chat holder swaps: the streamer answers', () => {
    let s = chatMessage(newStream('Abdullah', 4), 'Ali', 'دخول', 0);
    s = streamerAct(deal(s, q, 0), { type: 'choose', choice: 'answer' }, 0);
    s = streamerAct(s, { type: 'option', index: 1 }, 0);
    s = chatMessage(deal(s, q, 0), 'Ali', 'بادل', 1);
    expect(s.answerer).toBeNull();
    s = streamerAct(s, { type: 'option', index: 1 }, 2);
    expect(s.scores.ali).toBe(600);
  });

  it('times out: unanswered counts as wrong', () => {
    let s = chatMessage(start(), 'Ali', 'x', 0);
    s = streamerAct(streamerAct(s, { type: 'choose', choice: 'swap' }, 0), { type: 'partner', user: 'ali' }, 0);
    s = tick(s, STREAM_ANSWER_MS + 1);
    expect(s.result?.correct).toBe(false);
    expect(s.scores.abdullah).toBe(-300);
  });

  it('parses options', () => {
    expect(parseOption('جاوب 3', q.options)).toBe(2);
    expect(parseOption('٤', q.options)).toBe(3);
    expect(parseOption('جاوب باريس', q.options)).toBe(1);
    expect(parseOption('5', q.options)).toBeNull();
  });
});
