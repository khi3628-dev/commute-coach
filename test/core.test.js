const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const S = id => C.SENTENCES.find(s => s.id === id);

test('원본의 정답 변형은 모두 통과', () => {
  assert.equal(C.judge(S('c5'), 'I open my inbox and check my emails.').verdict, 'pass');
  assert.equal(C.judge(S('c6'), 'If something is urgent, I reply.').verdict, 'pass');
  assert.equal(C.judge(S('c6'), "If anything's urgent, I reply").verdict, 'pass');
  assert.equal(C.judge(S('c3'), 'traffic is a little heavy but it is ok').verdict, 'pass');
  assert.equal(C.judge(S('c2'), 'It takes about 20 minutes by car.').verdict, 'pass');
  assert.equal(C.judge(S('c1'), 'I am heading to work').verdict, 'pass');
  assert.equal(C.judge(S('c4'), 'I grab a coffee before I start the day').verdict, 'pass');
});

test('원본 4장 사례: 관사·주어 누락을 교정', () => {
  const r = C.judge(S('c4'), 'I grab coffee before start day.');
  assert.equal(r.verdict, 'fix');
  const missing = r.errors.filter(e => e.type === 'miss').map(e => e.want).sort();
  assert.deepEqual(missing, ['a', 'i', 'the']);
  assert.equal(r.errors[0].kind, 'article');
  assert.match(r.hint, /Add "a"/);
  assert.ok(r.hint.split('.').filter(x => x.trim()).length <= 2, '힌트는 최대 2개');
});

test('전치사 오류 분류', () => {
  const r = C.judge(S('c1'), "I'm heading for work.");
  assert.equal(r.verdict, 'fix');
  assert.equal(r.errors[0].kind, 'preposition');
  assert.equal(r.hint, 'Say "to", not "for".');
});

test('한국어 발화와 빈 발화', () => {
  assert.equal(C.judge(S('c1'), '출근하는 중이야').verdict, 'korean');
  assert.equal(C.judge(S('c1'), 'I am 출근').verdict, 'korean');
  assert.equal(C.judge(S('c1'), '   ').verdict, 'empty');
});

test('전혀 다른 말은 far로 표시하고 힌트 없음', () => {
  const r = C.judge(S('c2'), 'banana');
  assert.equal(r.far, true);
  assert.equal(r.hint, '');
});

test('학습한 변형도 통과', () => {
  const r = C.judge(S('c2'), 'It takes around twenty minutes by car.', { c2: ['It takes around twenty minutes by car.'] });
  assert.equal(r.verdict, 'pass');
});

test('음성 명령은 짧은 발화만', () => {
  assert.equal(C.parseCommand('Again'), 'again');
  assert.equal(C.parseCommand('천천히'), 'slower');
  assert.equal(C.parseCommand('stop.'), 'stop');
  assert.equal(C.parseCommand('무슨 뜻이야'), 'meaning');
  assert.equal(C.parseCommand("I'm heading to work."), null);
  assert.equal(C.parseCommand('I stop at the coffee shop before work'), null);
});

test('연결 말하기: 순서대로 찾은 문장 수', () => {
  const t = [S('c1'), S('c2'), S('c3')];
  const r = C.storyMatch(t, "I'm heading to work. It takes about twenty minutes by car. Traffic is a little heavy but it's okay.");
  assert.deepEqual(r.map(x => x.found), [true, true, true]);
  const r2 = C.storyMatch(t, "I'm heading to work. Traffic's a little heavy, but it's okay.");
  assert.deepEqual(r2.map(x => x.found), [true, false, true]);
});

test('복습 간격 1→3→7→14, 여러 상황 성공 시 숙달', () => {
  const day = '2026-10-08';
  let st = C.updateState(C.newState(), 'learn', { passed: true, firstTry: true }, day);
  assert.equal(st.level, 'learning');
  st = C.updateState(st, 'recheck', { passed: true, firstTry: true }, day);
  assert.equal(st.level, 'review');
  assert.equal(st.next, '2026-10-09');
  const ok = { passed: true, firstTry: true, hinted: false };
  st = C.updateState(st, 'review', ok, '2026-10-09');
  assert.equal(st.next, '2026-10-12');
  st = C.updateState(st, 'review', ok, '2026-10-12');
  assert.equal(st.next, '2026-10-19');
  st = C.updateState(st, 'review', ok, '2026-10-19');
  assert.equal(st.next, '2026-11-02');
  st = C.updateState(st, 'review', ok, '2026-11-02');
  assert.equal(st.level, 'review', '한 상황에서만 성공하면 숙달 아님');
  st = C.updateState(st, 'story', { passed: true }, '2026-11-02');
  st = C.updateState(st, 'review', ok, '2026-11-16');
  assert.equal(st.level, 'mastered');
});

test('복습 실패와 힌트 사용은 학습 중으로 되돌림, 3회 실패면 분해', () => {
  const day = '2026-10-08';
  let st = { ...C.newState(), level: 'review', step: 2, next: day };
  st = C.updateState(st, 'review', { passed: true, firstTry: true, hinted: true }, day);
  assert.equal(st.level, 'learning');
  assert.equal(st.next, day);
  st = C.updateState(st, 'learn', { passed: false }, day);
  st = C.updateState(st, 'learn', { passed: false }, day);
  st = C.updateState(st, 'learn', { passed: false }, day);
  assert.equal(st.split, true);
});

test('세션 계획: 첫날은 1번 문장, 학습 중 3개면 새 문장 없음, 연결 말하기 길이', () => {
  const day = '2026-10-08';
  let p = C.planSession({}, day);
  assert.equal(p.fresh.id, 'c1');
  assert.equal(p.review.length, 0);
  assert.equal(p.story.length, 0);

  const L = { ...C.newState(), level: 'learning', next: day };
  p = C.planSession({ c1: L, c2: L, c3: L }, day);
  assert.equal(p.fresh, null);
  assert.equal(p.review.length, 3);

  const R = { ...C.newState(), level: 'review', step: 0, next: '2026-10-20' };
  p = C.planSession({ c1: R, c2: R, c3: R }, day);
  assert.equal(p.fresh.id, 'c4');
  assert.equal(p.story.length, 3);
  assert.equal(p.review.length, 0);

  const all = Object.fromEntries(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(id => [id, R]));
  p = C.planSession(all, day);
  assert.equal(p.story.length, 6);
  assert.equal(p.fresh.id, 'e1', '핵심 6문장 이후엔 상위 문장을 배운 확장 문장(순서대로)');
});

test('복습은 최대 4개, 오래된 것부터', () => {
  const mk = next => ({ ...C.newState(), level: 'review', step: 0, next });
  const states = { c1: mk('2026-10-05'), c2: mk('2026-10-01'), c3: mk('2026-10-07'), c4: mk('2026-10-03'), c5: mk('2026-10-08'), c6: mk('2026-10-09') };
  const p = C.planSession(states, '2026-10-08');
  assert.deepEqual(p.review.map(s => s.id), ['c2', 'c4', 'c1', 'c3']);
});
