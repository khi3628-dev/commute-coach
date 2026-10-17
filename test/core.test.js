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

test('내 문장도 복습 계획에 들어감 (연결 말하기에는 제외)', () => {
  const mine = { id: 'u1', type: 'mine', en: 'I met up with a friend after work.', ko: '퇴근하고 친구 만났어.', grammar: '과거', variants: [] };
  const states = { u1: { ...C.newState(), level: 'review', step: 0, next: '2026-10-08' } };
  const p = C.planSession(states, '2026-10-08', { extra: [mine] });
  assert.deepEqual(p.review.map(s => s.id), ['u1']);
  assert.equal(p.story.length, 0);
  assert.equal(C.planSession(states, '2026-10-08').review.length, 0, 'extra 없으면 무시');
});

test('인터뷰 질문은 시간대별 4개', () => {
  assert.equal(C.interviewQuestions(8)[0].en, 'How did your morning start?');
  assert.equal(C.interviewQuestions(13)[1].en, 'What did you have for lunch?');
  assert.equal(C.interviewQuestions(20)[0].en, 'How was your day?');
  assert.equal(C.interviewQuestions(2)[0].en, 'How was your day?');
  for (const h of [8, 13, 20]) assert.equal(C.interviewQuestions(h).length, 4);
});

test('이야기 생성 요청: 기본 모델, JSON 스키마, 인터뷰 답 포함', () => {
  const answers = [{ q: 'How was your day?', a: '회의가 길었어' }, { q: 'What are you doing tonight?', a: '헬스장 갈 거야' }];
  const body = C.storyRequest(answers, 'ko', ["I'm heading to work."]);
  assert.equal(body.model, 'claude-sonnet-5-5');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.deepEqual(body.output_config.format.schema.required, ['title', 'feedback', 'sentences']);
  assert.equal(body.fallbacks, 'default');
  assert.match(body.messages[0].content, /회의가 길었어/);
  assert.match(body.messages[0].content, /헬스장 갈 거야/);
  assert.match(body.messages[0].content, /given in Korean/);
  assert.match(C.storyRequest(answers, 'en', []).messages[0].content, /given in English/);
});

test('이야기 생성 응답 검증', () => {
  const sent = (en) => ({ en, ko: 'k', grammar: 'g' });
  const ok = { type: 'message', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ title: 'A Long Day', feedback: "Here's your story for today.", sentences: [sent('I had a long meeting today.'), sent('회의'), sent('Then I went to the gym.'), sent('A.'), sent('B.'), sent('C.'), sent('D.')] }) }] };
  const r = C.parseStoryResponse(ok);
  assert.equal(r.title, 'A Long Day');
  assert.equal(r.sentences.length, 5, '한글 문장은 버리고 최대 5개');
  assert.equal(r.sentences[1].en, 'Then I went to the gym.');
  assert.throws(() => C.parseStoryResponse({ stop_reason: 'refusal', content: [] }), /refused/);
  assert.throws(() => C.parseStoryResponse({ type: 'error', error: { message: 'invalid x-api-key' } }), /invalid x-api-key/);
  assert.throws(() => C.parseStoryResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"title":"","feedback":"","sentences":[]}' }] }), /no usable/);
});

test('명령어는 발화 전체가 명령일 때만', () => {
  assert.equal(C.parseCommand('일 끝나고 헬스장 갔어'), null);
  assert.equal(C.parseCommand('다음 주에 회의 있어'), null);
  assert.equal(C.parseCommand('다시 시작'), 'resume');
  assert.equal(C.parseCommand('넘어가.'), 'skip');
  assert.equal(C.parseCommand('그만'), 'stop');
  assert.equal(C.parseCommand("That's it."), 'stop');
});

test('연결 말하기: 같은 단어가 뒤 문장에 다시 나와도 순서대로 찾음', () => {
  const t = [
    { id: 'a', en: 'I grabbed a coffee and headed to work.' },
    { id: 'b', en: 'I had a long meeting today.' },
    { id: 'c', en: 'After work, I went to the gym.' },
  ];
  const r = C.storyMatch(t, 'I grabbed a coffee and headed to work. I had a long meeting today. After work, I went to the gym.');
  assert.deepEqual(r.map(x => x.found), [true, true, true]);
});

test('키 모양으로 AI 제공자 구분', () => {
  assert.equal(C.providerOf('AIzaSyExample'), 'gemini');
  assert.equal(C.providerOf(' sk-ant-api03-x '), 'anthropic');
});

test('Gemini 요청과 응답 검증', () => {
  const body = C.geminiRequest([{ q: 'How was your day?', a: '회의가 길었어' }], 'ko', []);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseJsonSchema.required, ['title', 'feedback', 'sentences']);
  assert.match(body.contents[0].parts[0].text, /회의가 길었어/);
  const json = { title: 'Long Day', feedback: 'Here you go.', sentences: [{ en: 'I had a long meeting today.', ko: '오늘 회의가 길었어.', grammar: '과거시제' }] };
  const ok = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(json) }] } }] };
  assert.equal(C.parseGeminiResponse(ok).sentences[0].en, 'I had a long meeting today.');
  const fenced = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '```json\n' + JSON.stringify(json) + '\n```' }] } }] };
  assert.equal(C.parseGeminiResponse(fenced).title, 'Long Day');
  assert.throws(() => C.parseGeminiResponse({ error: { code: 400, message: 'API key not valid' } }), /API key not valid/);
  assert.throws(() => C.parseGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }), /refused/);
  assert.throws(() => C.parseGeminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] }), /cut off/);
});

test('회화 샘플 102개: 형식과 판정', () => {
  const conv = C.SENTENCES.filter(s => s.type === 'conv');
  assert.equal(conv.length, 102);
  assert.equal(C.MODULES.length, 17);
  assert.equal(new Set(C.SENTENCES.map(s => s.id)).size, C.SENTENCES.length, 'ids are unique');
  for (const s of conv) {
    assert.ok(s.cue && s.en && s.ko && s.grammar, s.id);
    assert.ok(!C.hasHangul(s.en) && !C.hasHangul(s.cue), s.id);
    assert.ok(C.hasHangul(s.ko), s.id);
    assert.ok(s.en.split(/\s+/).length <= 12, `${s.id} is short enough to say in one breath`);
    assert.equal(C.judge(s, s.en).verdict, 'pass', `${s.id} passes against itself`);
  }
  // numbers spoken as digits by speech recognition still pass
  const run = conv.find(s => s.id === 'd3-3');
  assert.equal(C.judge(run, 'I run about 5 kilometers').verdict, 'pass');
  assert.equal(C.judge(conv.find(s => s.id === 'w1-6'), 'I have 2 meetings this afternoon').verdict, 'pass');
});

test('회화 샘플은 출근 12문장 다음에 순서대로, 대화 연습은 최근 주제', () => {
  const R = { ...C.newState(), level: 'review', step: 0, next: '2999-01-01' };
  const m1 = Object.fromEntries(C.SENTENCES.filter(s => s.type !== 'conv').map(s => [s.id, R]));
  let p = C.planSession(m1, '2026-10-12');
  assert.equal(p.fresh.id, 'd1-1');
  assert.deepEqual(p.dialog, []);
  p = C.planSession({ ...m1, 'd1-1': R, 'd1-2': R, 'd1-3': R }, '2026-10-12');
  assert.equal(p.fresh.id, 'd1-4');
  assert.deepEqual(p.dialog.map(s => s.id), ['d1-1', 'd1-2', 'd1-3']);
  p = C.planSession({ ...m1, 'd1-1': R, 'd1-2': R, 'd2-1': R }, '2026-10-12');
  assert.deepEqual(p.dialog, [], 'latest topic has only one sentence ready');
});

test('운전 중 연결 말하기는 3문장까지: 6문장은 날마다 앞·뒤 3문장씩', () => {
  const R = { ...C.newState(), level: 'review', step: 0, next: '2999-01-01' };
  const all = Object.fromEntries(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(id => [id, R]));
  const a = C.planSession(all, '2026-10-15', { maxStory: 3 }).story.map(s => s.id);
  const b = C.planSession(all, '2026-10-16', { maxStory: 3 }).story.map(s => s.id);
  assert.equal(a.length, 3);
  assert.deepEqual([...a, ...b].sort(), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], '이틀이면 앞·뒤를 모두 연습');
  assert.equal(C.planSession(all, '2026-10-15').story.length, 6, '일반 화면은 그대로 6문장');
  const three = { c1: R, c2: R, c3: R };
  assert.equal(C.planSession(three, '2026-10-15', { maxStory: 3 }).story.length, 3);
});

test('긴 이야기 나누기: 5 → 3+2, 4 → 2+2', () => {
  assert.deepEqual(C.chunk([1, 2, 3, 4, 5], 3), [[1, 2, 3], [4, 5]]);
  assert.deepEqual(C.chunk([1, 2, 3, 4], 3), [[1, 2], [3, 4]]);
  assert.deepEqual(C.chunk([1, 2], 3), [[1, 2]]);
});

test('같은 오류 유형 3번이면 그 문장을 다음 수업 복습 맨 앞에', () => {
  const ids = C.SENTENCES.map(s => s.id);
  const at = (t, sid, errors) => ({ t: `2026-10-${t}T08:00:00.000Z`, sid, errors });
  const log = [at(10, 'c1', ['preposition']), at(11, 'c2', ['article']), at(11, 'c1', ['preposition', 'word']), at(12, 'c3', ['form'])];
  assert.equal(C.pickFocus(log, {}, ids), null, '2번까지는 없음');
  log.push(at(13, 'c3', ['preposition']));
  const f = C.pickFocus(log, {}, ids);
  assert.equal(f.kind, 'preposition');
  assert.equal(f.sid, 'c1', '가장 많이 틀린 문장');
  assert.match(f.tip, /preposition/);
  assert.equal(C.pickFocus(log, { preposition: '2026-10-13T09:00:00.000Z' }, ids), null, '넣은 뒤로는 다시 셈');
  assert.equal(C.pickFocus([at(1, 'x', ['word']), at(2, 'x', ['word']), at(3, 'x', ['word'])], {}, ['x']), null, "'어휘'는 대상 아님");
  assert.equal(C.pickFocus([at(1, 'story', ['article']), at(2, 'story', ['article']), at(3, 'story', ['article'])], {}, ids), null, '문장이 아닌 기록은 무시');

  const R = next => ({ ...C.newState(), level: 'review', step: 1, next });
  const states = { c1: R('2999-01-01'), c2: R('2026-10-01'), c3: R('2026-10-02') };
  const p = C.planSession(states, '2026-10-15', { focus: 'c1' });
  assert.deepEqual(p.review.map(s => s.id), ['c1', 'c2', 'c3'], '복습일이 아니어도 맨 앞');
  assert.deepEqual(C.planSession(states, '2026-10-15', { focus: 'c4' }).review.map(s => s.id), ['c2', 'c3'], '배운 적 없는 문장은 넣지 않음');
});

test('복습 간격 개인화: 빨리 말하면 한 칸 건너뛰고, 오래 걸리면 같은 간격 반복', () => {
  assert.equal(C.grade(900), 'easy');
  assert.equal(C.grade(2500), 'good');
  assert.equal(C.grade(5200), 'hard');
  assert.equal(C.grade(null), 'good', '측정 못 하면 보통');
  const day = '2026-10-15';
  const R = { ...C.newState(), level: 'review', step: 0, next: day };
  const ok = ms => ({ passed: true, firstTry: true, hinted: false, latency: ms });
  assert.equal(C.updateState(R, 'review', ok(2500), day).next, '2026-10-18', '보통: 3일');
  const easy = C.updateState(R, 'review', ok(900), day);
  assert.equal(easy.step, 2);
  assert.equal(easy.next, '2026-10-22', '쉬움: 3일을 건너뛰고 7일');
  const hard = C.updateState(R, 'review', ok(5200), day);
  assert.equal(hard.step, 0);
  assert.equal(hard.next, '2026-10-16', '어려움: 1일 다시');
  assert.equal(hard.level, 'review', '어려워도 맞혔으면 학습 중으로 되돌리지 않음');
  const late = { ...R, step: 3, contexts: ['drill', 'story'] };
  assert.equal(C.updateState(late, 'review', ok(900), day).level, 'mastered', '건너뛰어도 마지막 간격까지만');
});

test('연속 학습일: 오늘 또는 어제부터 거꾸로 센다', () => {
  assert.equal(C.streak([], '2026-10-16'), 0);
  assert.equal(C.streak(['2026-10-14', '2026-10-15', '2026-10-16'], '2026-10-16'), 3);
  assert.equal(C.streak(['2026-10-14', '2026-10-15'], '2026-10-16'), 2, '오늘 아직 안 했으면 어제까지');
  assert.equal(C.streak(['2026-10-13', '2026-10-15'], '2026-10-16'), 1, '하루 빠지면 끊김');
  assert.equal(C.streak(['2026-09-30', '2026-10-01'], '2026-10-01'), 2, '달 경계');
});

test('백업 복원: 기록 모양만 받고 나머지는 거른다', () => {
  const good = JSON.stringify({ states: {}, attempts: [], sessions: [], stories: [], settings: { speed: 2 }, apikey: 'sk-ant-x', other: 1 });
  const out = C.parseBackup(good);
  assert.deepEqual(Object.keys(out).sort(), ['attempts', 'sessions', 'settings', 'states', 'stories']);
  assert.throws(() => C.parseBackup('hello'), /not json/);
  assert.throws(() => C.parseBackup('[]'), /not a backup/);
  assert.throws(() => C.parseBackup('{"states":{},"attempts":[]}'), /not a backup/);
  assert.throws(() => C.parseBackup('{"states":{},"attempts":[],"sessions":[],"stories":{}}'), /not a backup/);
});

test('대화 연습: AI 답은 reply 필수, 되돌려 주는 문장(better)은 영어 한 문장만', () => {
  const scene = C.SCENES[0];
  const req = C.talkRequest(scene, [{ role: 'teacher', text: scene.opener }, { role: 'learner', text: 'i go to gym yesterday' }], ['I usually go to the gym after work.']);
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.match(req.messages[0].content, /ONE natural sentence/);
  assert.match(C.talkPrompt(scene, [], [], { last: true }), /Do not ask a question/);
  const ok = C.parseTalkResponse({ content: [{ type: 'text', text: JSON.stringify({ reply: 'Nice! How long did you stay?', better: 'I went to the gym yesterday.', ko: '어제 헬스장에 갔어.', note: '과거시제 · went' }) }] });
  assert.deepEqual(ok, { reply: 'Nice! How long did you stay?', better: 'I went to the gym yesterday.', ko: '어제 헬스장에 갔어.', note: '과거시제 · went' });
  const fine = C.parseGeminiTalkResponse({ candidates: [{ content: { parts: [{ text: '```json\n{"reply":"Sounds good. What time?","better":"","ko":"x","note":"y"}\n```' }] } }] });
  assert.deepEqual(fine, { reply: 'Sounds good. What time?', better: '', ko: '', note: '' }, 'better가 없으면 ko·note도 비움');
  const tooLong = C.parseTalkResponse({ content: [{ type: 'text', text: JSON.stringify({ reply: 'Okay.', better: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen', ko: '', note: '' }) }] });
  assert.equal(tooLong.better, '', '너무 긴 문장은 버림');
  assert.throws(() => C.parseTalkResponse({ content: [{ type: 'text', text: '{"reply":"","better":""}' }] }), /no usable reply/);
  assert.throws(() => C.parseTalkResponse({ content: [{ type: 'text', text: '{"reply":"안녕하세요","better":""}' }] }), /no usable reply/, '선생님 답에 한국어가 섞이면 거부');
  assert.throws(() => C.parseTalkResponse({ type: 'error', error: { message: 'bad key' } }), /bad key/);
});
