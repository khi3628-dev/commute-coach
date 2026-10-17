// End-to-end: runs real sessions in Chromium with typed answers and a stubbed speech engine.
// Uses a globally installed playwright; set PLAYWRIGHT to its index.mjs path elsewhere.
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('index.html')).href;
const browser = await chromium.launch({  });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  window.__said = []; window.__queue = []; window.__deny = false;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 2); },
    cancel() {}, getVoices() { return []; },
  } });
  // Fake recognizer like Safari's one-shot mode: each start() consumes one queued utterance,
  // gives one final result and ends. null = silence ("no-speech", then end).
  // window.__quickEnd = n: the next n starts end at once with no error (iOS right after speech output).
  window.__quickEnd = 0; window.__starts = 0;
  class FakeSR {
    start() {
      window.__starts++;
      if (this.continuous) throw new Error('continuous mode is not used');
      if (window.__deny) return setTimeout(() => this.onerror && this.onerror({ error: 'not-allowed' }), 5);
      if (window.__quickEnd > 0) { window.__quickEnd--; return setTimeout(() => this.onend && this.onend(), 5); }
      const tick = () => {
        if (this.aborted) return;
        if (!window.__queue.length) return setTimeout(tick, 10);
        const item = window.__queue.shift();
        if (item === null) { this.onerror && this.onerror({ error: 'no-speech' }); return this.onend && this.onend(); }
        this.onspeechstart && this.onspeechstart();
        const res = [{ transcript: item, confidence: 0.9 }]; res.isFinal = true;
        this.onresult({ results: [res] });
        setTimeout(() => this.onend && this.onend(), 5);
      };
      setTimeout(tick, 5);
    }
    abort() { this.aborted = true; }
    stop() { this.aborted = true; }
  }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeSR });
});

const C_addDays = (day, n) => { const [y, m, dd] = day.split('-').map(Number); const x = new Date(y, m - 1, dd + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const answer = t => page.evaluate(x => window.__queue.push(x), t);

const said = () => page.evaluate(() => window.__said.join(' | '));
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('commute-coach.v1')));

// ---- Day 1: first sentence, one correction, then pass, then end-of-session recheck ----
await page.goto(url);
assert.match(await page.textContent('#plan'), /I'm heading to work\./);
await page.waitForFunction(() => !document.getElementById('s-img').hidden);
assert.match(await page.getAttribute('#s-img', 'src'), /img\/commute\.jpg$/, 'commute picture on the first sentence');
await page.evaluate(() => { document.getElementById('s-img').src = 'img/missing.jpg'; });
await page.waitForFunction(() => document.getElementById('s-img').hidden, null, { timeout: 5000 });
await page.click('#start');
assert.equal(await page.locator('#view-lesson input:not([disabled]), #view-lesson textarea:not([disabled])').count(), 0, 'no usable text box during the lesson');
assert.equal(await page.isDisabled('#start'), true, 'start is locked during the lesson');
await answer('I heading for work');                  // fix
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Almost.')));
assert.match(await page.textContent('#said-text'), /FIX/);
await answer("I'm heading to work.");               // pass
await answer("I'm heading to work");                // recheck (recall from Korean)
await page.waitForFunction(() => window.__said.some(t => t.includes('See you tomorrow')));
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1') || '{}').sessions?.length === 1);
let d = await store();
assert.equal(d.states.c1.level, 'review');
assert.equal(d.states.c1.step, 0);
assert.equal(d.sessions.length, 1);
assert.equal(d.sessions[0].end, 'done');
assert.ok(d.errors.preposition.count >= 1, 'preposition error recorded');
console.log('day 1 ok:', (await said()).slice(0, 160), '...');

// ---- Day 2 (simulated): c1 due → warm-up recall with Korean answer, then new c2; stop mid-way ----
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('commute-coach.v1'));
  d.states.c1.next = '2000-01-01';
  localStorage.setItem('commute-coach.v1', JSON.stringify(d));
});
await page.reload();
assert.match(await page.textContent('#plan'), /워밍업 복습 1문장/);
await page.click('#start');
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Welcome back')));
await answer('출근하는 중');                          // Korean → teacher gives English
await page.waitForFunction(() => window.__said.includes('Say it with me.'));
await answer("I'm heading to work.");               // pass, but hinted → back to learning
await answer('It takes about 20 minutes by car');   // new sentence c2 passes
await page.waitForFunction(() => window.__said.includes('Before we finish, one more time.'));
await answer('stop');
await page.waitForFunction(() => window.__said.some(t => t.includes('stop here')));
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 2);
d = await store();
assert.equal(d.states.c1.level, 'learning', 'Korean answer counts as a hint');
assert.equal(d.states.c2.level, 'learning');
assert.equal(d.sessions[1].end, 'stopped');

// ---- Day 3: c1..c3 in review → story of 3 sentences with one missing ----
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('commute-coach.v1'));
  for (const id of ['c1', 'c2', 'c3']) d.states[id] = { level: 'review', step: 1, next: '2999-01-01', lastPracticed: null, failStreak: 0, contexts: ['drill'], split: false };
  localStorage.setItem('commute-coach.v1', JSON.stringify(d));
});
await page.reload();
assert.match(await page.textContent('#plan'), /3문장 이어 말하기/);
await page.click('#start');
await answer('And then I grab a coffee before I start the day.'); // new c4
await answer('yes');                                                // story consent
await answer("I'm heading to work. Traffic's a little heavy, but it's okay."); // missing c2
await page.waitForFunction(() => window.__said.some(t => t.startsWith('You got 2 of 3')));
await answer("I'm heading to work. It takes about twenty minutes by car. Traffic is a little heavy but it's ok.");
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Great story')));
await answer('I grab a coffee before I start the day');            // recheck c4 via variant
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 3);
d = await store();
assert.equal(d.states.c4.level, 'review');
assert.ok(d.states.c2.contexts.includes('story'));

// ---- Silence: first a hint, then auto-pause; "resume" by voice continues ----
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('commute-coach.v1'));
  d.states.c1.next = '2000-01-01';
  localStorage.setItem('commute-coach.v1', JSON.stringify(d));
});
await page.reload();
await page.click('#start');
await page.waitForFunction(() => window.__said.includes('In English?'));
await answer(null);
await page.waitForFunction(() => window.__said.some(t => t.startsWith("Here's a start")));
await answer(null);
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Paused.')));
await answer('resume');
await page.waitForFunction(() => window.__said.includes("Okay, let's continue."));
await answer('stop');
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 4);

// ---- Microphone denied: the lesson ends and start stays locked ----
await page.evaluate(() => { window.__deny = true; });
await page.click('#start');
await page.waitForFunction(() => window.__said.some(t => t.startsWith("I can't hear you")));
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 5);
assert.equal((await store()).sessions[4].end, 'mic');
assert.equal(await page.isDisabled('#start'), true);
assert.match(await page.textContent('#env'), /음성 인식을 쓸 수 없어/);

// ---- 오늘 이야기 레슨: interview (Korean) → Claude (mocked) → drills → whole story → last check ----
await page.evaluate(() => { window.__deny = false; localStorage.setItem('commute-coach.apikey', 'sk-ant-test'); });
const STORY = ['I grabbed a coffee and headed to work.', 'I had a long meeting today.', 'After work, I went to the gym.'];
let apiCalls = [];
await page.route('https://api.anthropic.com/v1/messages', async route => {
  const req = route.request();
  apiCalls.push({ headers: req.headers(), body: JSON.parse(req.postData()) });
  if (req.headers()['x-api-key'] === 'bad') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    type: 'message', stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ title: 'A Busy Day', feedback: "Here's your story for today.", sentences: STORY.map(en => ({ en, ko: '뜻', grammar: '과거시제' })) }) }],
  }) });
});
await page.reload();
assert.match(await page.textContent('#env'), /Claude 연결됨/);
const said0 = await page.evaluate(() => window.__said.length);
await page.click('#mine-ko');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 1/4');
await answer('아침에 커피 마시고 출근했어');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 2/4');
await answer('넘어가');                                   // skip this question
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 3/4');
await answer('오늘 회의가 길었고 일 끝나고 헬스장 갔어');   // contains 끝 but is an answer, not "stop"
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 4/4');
await answer('그만');                                     // stop the interview early
await page.waitForFunction(() => window.__said.includes('Your story has 3 sentences. Let\'s practice them one by one.'));
for (const en of STORY) await answer(en);
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Ready for the story? 3 sentences')));
await answer('yes');
await page.waitForFunction(() => window.__said.includes('Now tell me your whole story, from the beginning.'));
await answer(STORY.join(' '));
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Great story')));
await answer(STORY[0]);                                   // last check 1 (recall)
await answer(STORY[1]);                                   // last check 2 (recall)
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 6);
d = await store();
assert.equal(d.sessions[5].mode, 'mine-ko');
assert.equal(d.sessions[5].end, 'done');
assert.equal(d.stories.length, 1);
assert.equal(d.stories[0].title, 'A Busy Day');
assert.equal(d.stories[0].answers.length, 2, 'skipped and stop are not answers');
assert.equal(d.custom.length, 3);
assert.ok(d.custom.every(c => c.storyId === d.stories[0].id));
assert.equal(d.states[d.custom[0].id].level, 'review', 'drill + last check → review');
assert.ok(d.states[d.custom[2].id].contexts.includes('story'));
assert.equal(apiCalls.length, 1, 'one Claude call per interview');
const prompt = apiCalls[0].body.messages[0].content;
assert.match(prompt, /아침에 커피 마시고 출근했어/);
assert.match(prompt, /일 끝나고 헬스장 갔어/);
assert.equal(apiCalls[0].headers['anthropic-dangerous-direct-browser-access'], 'true');
assert.ok(!JSON.stringify(d).includes('sk-ant-test'), 'API key is not in the backup data');
const koSaid = await page.evaluate(n => window.__said.slice(n), said0);
assert.ok(koSaid.some(t => /[가-힣]/.test(t) && t.includes('?')), 'Korean version of each question is spoken');

// wrong key → spoken Korean error, nothing added
await page.evaluate(() => localStorage.setItem('commute-coach.apikey', 'bad'));
await page.click('#mine-ko');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 1/4');
await answer('오늘 회의가 길었어');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 2/4');
await answer('그만');
await page.waitForFunction(() => window.__said.some(t => t.includes('API 키가 맞지 않아요')));
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 7);
assert.equal((await store()).custom.length, 3);
assert.equal((await store()).stories.length, 1);

// ---- Gemini key: same interview lesson through the Gemini API (mocked) ----
const GEM = ['I took the subway today.', 'Then I had lunch with my team.'];
let gemCalls = [];
await page.route('https://generativelanguage.googleapis.com/**', async route => {
  const req = route.request();
  gemCalls.push({ url: req.url(), headers: req.headers(), body: JSON.parse(req.postData()) });
  if (req.headers()['x-goog-api-key'] === 'AIzaBAD') return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }) });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify({ title: 'Subway Day', feedback: "Here's your story for today.", sentences: GEM.map(en => ({ en, ko: '뜻', grammar: '과거시제' })) }) }] } }],
  }) });
});
await page.evaluate(() => localStorage.setItem('commute-coach.apikey', 'AIzaTEST'));
await page.reload();
assert.match(await page.textContent('#env'), /Gemini 연결됨/);
await page.click('#mine-ko');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 1/4');
await answer('지하철 타고 왔어');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 2/4');
await answer('팀이랑 점심 먹었어');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 3/4');
await answer('그만');
await page.waitForFunction(() => window.__said.includes("Your story has 2 sentences. Let's practice them one by one."));
for (const en of GEM) await answer(en);
await page.waitForFunction(() => window.__said.filter(t => t.startsWith('Ready for the story? 2 sentences')).length >= 1);
await answer('skip');                                     // skip the whole-story step this time
await answer(GEM[0]); await answer(GEM[1]);               // last check
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 8);
d = await store();
assert.equal(d.sessions[7].end, 'done');
assert.equal(d.stories.length, 2);
assert.equal(d.stories[1].title, 'Subway Day');
assert.equal(gemCalls.length, 1);
assert.match(gemCalls[0].url, /\/v1beta\/models\/gemini-flash-latest:generateContent$/);
assert.equal(gemCalls[0].headers['x-goog-api-key'], 'AIzaTEST');
assert.equal(gemCalls[0].body.generationConfig.responseMimeType, 'application/json');
assert.match(gemCalls[0].body.contents[0].parts[0].text, /지하철 타고 왔어/);
assert.equal(apiCalls.length, 2, 'no Anthropic call with a Gemini key');

// custom model name is used; bad Gemini key → Korean error
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('commute-coach.v1')); d.settings.geminiModel = 'gemini-test-model'; localStorage.setItem('commute-coach.v1', JSON.stringify(d)); localStorage.setItem('commute-coach.apikey', 'AIzaBAD'); });
await page.reload();
await page.click('#mine-ko');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 1/4');
await answer('오늘 바빴어');
await page.waitForFunction(() => document.getElementById('s-tag').textContent === 'INTERVIEW 2/4');
await answer('그만');
await page.waitForFunction(() => window.__said.some(t => t.includes('API 키가 맞지 않아요')) && JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 9);
assert.match(gemCalls[1].url, /models\/gemini-test-model:generateContent$/);
assert.equal((await store()).stories.length, 2);

// ---- 회화 샘플: new Q&A item (question → model answer), conversation practice, recheck by question ----
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('commute-coach.v1'));
  const R = { level: 'review', step: 1, next: '2999-01-01', lastPracticed: null, failStreak: 0, contexts: ['drill'], split: false };
  for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'd1-1', 'd1-2']) d.states[id] = { ...R };
  for (const c of d.custom) d.states[c.id] = { ...R };
  localStorage.setItem('commute-coach.v1', JSON.stringify(d));
});
await page.reload();
const planText = await page.textContent('#plan');
assert.match(planText, /친구와 점심 · Q: How was the food\? → It was really good, but the line was long\./);
assert.match(planText, /대화 연습/);
await page.click('#start');
await page.waitForFunction(() => window.__said.includes('You can answer:'));
assert.match(await page.textContent('#s-tag'), /LUNCH WITH A FRIEND · Q: How was the food\?/);
await page.waitForFunction(() => !document.getElementById('s-img').hidden);
assert.match(await page.getAttribute('#s-img', 'src'), /img\/lunch\.jpg$/, 'lunch picture on the lunch topic');
await answer('It was really good but the line was long');            // new item passes
await page.waitForFunction(() => window.__said.some(t => t.startsWith("Let's have a quick conversation. Lunch with a friend.")));
await answer('I met up with a friend for lunch');                     // d1-1 ok
await answer('We went to a ramen place');                             // d1-2 not quite → model answer
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Nice. You answered 1 of 2')));
await page.waitForFunction(() => window.__said.includes('Before we finish, one more time.'));
await answer('It was really good, but the line was long.');           // recheck: hears only the question
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 10);
d = await store();
assert.equal(d.sessions[9].end, 'done');
assert.equal(d.states['d1-3'].level, 'review');
assert.ok(d.states['d1-1'].contexts.includes('story'), 'conversation counts as a second context');
assert.ok(!(d.states['d1-2'].contexts || []).includes('story'));
const lastSaid = await page.evaluate(() => window.__said.slice(-6));
assert.ok(lastSaid.includes('How was the food?'), 'recheck asks the question');

// ---- Records tab renders the metrics ----
await page.click('#tab-records');
const rec = await page.textContent('#view-records');
assert.match(rec, /Coherence/); assert.match(rec, /3\/3/); assert.match(rec, /전치사/);
assert.match(rec, /Pronunciation미측정/);
assert.match(rec, /회화 샘플 진도/); assert.match(rec, /친구와 점심/); assert.match(rec, /순서대로 기다리고/);
assert.match(rec, /내 이야기/); assert.match(rec, /A Busy Day/); assert.match(rec, /After work, I went to the gym\./);

await page.setViewportSize({ width: 390, height: 844 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
assert.equal(overflow, false, 'no horizontal scroll at phone width');
await page.screenshot({ path: 'test/records-phone.png', fullPage: true });
await page.click('#tab-lesson');
await page.screenshot({ path: 'test/lesson-phone.png', fullPage: true });

// ---- Drive mode: the 6-sentence commute story is cut to 3 sentences ----
await page.evaluate(() => {
  const R = { level: 'review', step: 1, next: '2999-01-01', lastPracticed: null, failStreak: 0, contexts: ['drill'], split: false };
  const states = Object.fromEntries(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(id => [id, { ...R }]));
  localStorage.setItem('commute-coach.v1', JSON.stringify({ states, attempts: [], sessions: [], learned: {}, errors: {}, custom: [], stories: [] }));
});
await page.reload();
assert.match(await page.textContent('#plan'), /6문장 이어 말하기/, 'normal screen keeps the 6-sentence story');
const driveStory = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('commute-coach.v1'));
  return window.CoachCore.planSession(d.states, window.CoachCore.today(), { maxStory: 3 }).story.map(s => s.en);
});
assert.equal(driveStory.length, 3);
await page.evaluate(() => { window.__quickEnd = 1; });                // first listen ends at once (iOS after speech output)
const driveSaid0 = await page.evaluate(() => window.__said.length);
await page.click('#drive-start');
await answer('When I get to the office, I check my emails.');         // new e1, heard on the retry
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Ready for the story?')));
assert.ok((await said()).includes('Ready for the story? 3 sentences'), 'drive mode story has 3 sentences');
assert.equal(await page.evaluate(() => window.__quickEnd), 0);
assert.ok(!(await page.evaluate(n => window.__said.slice(n), driveSaid0)).includes('Your turn.'), 'the quick end was retried, not taken as silence');
await answer('yes');
await page.waitForFunction(() => window.__said.includes('Tell me your morning, from heading to work.') || window.__said.some(t => t.startsWith('Tell me the rest of your morning')));
await answer(driveStory.slice(0, 2).join(' '));                        // the long answer comes in two segments
await page.waitForFunction(t => document.getElementById('said-text').textContent.includes(t), driveStory[1]);
await answer(driveStory[2]);
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Great story. All 3')));
await answer('When I get to the office, I check my emails.');         // last check
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 1);
d = await store();
assert.equal(d.sessions[0].mode, 'drive');
assert.deepEqual(d.sessions[0].story, { n: 3, found: 3 });
await page.click('#d-exit');

// ---- Same error kind 3 times → that sentence opens the next warm-up with a one-line tip ----
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('commute-coach.v1'));
  const t = new Date().toISOString();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const day = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`; // yesterday, so the streak is 2
  d.attempts.push(...[1, 2, 3].map(() => ({ t, day, sid: 'c2', kind: 'review', text: 'It takes about twenty minutes in car', verdict: 'fix', errors: ['preposition'] })));
  localStorage.setItem('commute-coach.v1', JSON.stringify(d));
});
await page.reload();
assert.match(await page.textContent('#plan'), /워밍업 복습 1문장 · 핵심 2 \(맨 앞: 반복 오류 · 전치사\)/);
await page.click('#start');
await page.waitForFunction(() => window.__said.includes('This one has tripped you up. Watch the preposition.'));
await answer('It takes about twenty minutes by car.');
await page.waitForFunction(() => window.__said.includes('Listen and repeat.') && window.__said.lastIndexOf('In English?') < window.__said.lastIndexOf('Listen and repeat.'));
await answer('stop');
await page.waitForFunction(() => JSON.parse(localStorage.getItem('commute-coach.v1')).sessions.length === 2);
d = await store();
assert.ok(d.focusSince.preposition, 'count starts over after the focus');
assert.equal(d.states.c2.step, 3, 'answered at once (fake voice) → easy → one interval skipped');
assert.doesNotMatch(await page.textContent('#plan'), /반복 오류/);

// ---- Records: streak, backup restore (two taps, rejects junk), no API key in backups ----
await page.evaluate(() => localStorage.setItem('commute-coach.apikey', 'sk-ant-secret'));
await page.click('#tab-records');
assert.match(await page.textContent('#view-records'), /연속 학습\s*2일/);
const backup = JSON.stringify(d);
assert.doesNotMatch(backup, /sk-ant-secret/);
await page.fill('#restore-text', 'not a backup');
await page.click('#restore');
assert.match(await page.textContent('#restore-msg'), /백업 내용이 아닙니다/);
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('commute-coach.v1')); x.sessions = []; x.states = {}; localStorage.setItem('commute-coach.v1', JSON.stringify(x)); });
await page.reload();
await page.click('#tab-records');
await page.fill('#restore-text', backup);
await page.click('#restore');
assert.match(await page.textContent('#restore-msg'), /수업 2번/);
assert.equal((await store()).sessions.length, 0, 'first tap only checks');
await page.click('#restore');
assert.equal((await store()).sessions.length, 2);
assert.equal((await store()).states.c2.step, 3);
assert.match(await page.textContent('#restore-msg'), /복원했습니다/);
assert.equal(await page.evaluate(() => localStorage.getItem('commute-coach.apikey')), 'sk-ant-secret', 'restore leaves the key alone');

// ---- Commute Talk: scene → Korean answer → recast judged by rules → sentence joins the main reviews ----
const talkUrl = pathToFileURL(resolve('talk.html')).href;
await page.evaluate(() => localStorage.setItem('commute-coach.apikey', 'sk-ant-talk'));
let talkCalls = [];
await page.unroute('https://api.anthropic.com/v1/messages');
await page.route('https://api.anthropic.com/v1/messages', async route => {
  const body = route.request().postDataJSON();
  talkCalls.push(body);
  const prompt = body.messages[0].content;
  const history = JSON.parse(prompt.match(/Conversation so far: (\[.*\])\n/)[1]);
  const lastLearner = history[history.length - 1].text;
  const last = /close the conversation/.test(prompt);
  const out = /헬스장/.test(lastLearner) ? { reply: 'Nice. How long did you stay?', better: 'I went to the gym after work.', ko: '퇴근하고 헬스장에 갔어.', note: '과거시제 · went' }
    : /skipped/.test(lastLearner) ? { reply: 'Sure. What about this weekend?', better: '', ko: '', note: '' }
    : { reply: last ? 'Sounds like a good day. See you tomorrow!' : 'Cool. And then?', better: '', ko: '', note: '' };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'msg_t', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }) });
});
await page.goto(talkUrl);
assert.equal(await page.locator('.scene').count(), 5);
assert.equal(await page.locator('.scene:not([disabled])').count(), 5, 'scenes enabled with mic and key');
await page.evaluate(() => { window.__said = []; });
await page.check('#drive-on');
await page.click('.scene[data-scene="day"]');
await page.waitForFunction(() => window.__said.includes("Hey! How's your day going so far?"));
assert.equal(await page.locator('#view-lesson input:not([disabled]), textarea:not([disabled]), .scene:not([disabled])').count(), 0, 'nothing to tap during the talk');
assert.equal(await page.isHidden('#drive'), false, 'drive sign shown');
await answer('퇴근하고 헬스장 갔어');
await page.waitForFunction(() => window.__said.includes('Your turn.'));
assert.ok((await said()).includes('In English, you could say: | I went to the gym after work.'), 'Korean answer gets the English version');
await answer('I go to the gym after work');
await page.waitForFunction(() => window.__said.includes('Say it again.'));
assert.match(await said(), /Almost\. .*went/, 'the repeat is judged by rules: past tense');
await answer('I went to the gym after work.');
await page.waitForFunction(() => window.__said.includes('Nice. How long did you stay?'));
assert.match(await said(), /Nice\.( \|)? Nice\. How long/);
await answer('skip');
await page.waitForFunction(() => window.__said.includes('Sure. What about this weekend?'));
await answer('I will stay home');
await page.waitForFunction(() => window.__said.includes('Cool. And then?'));
await answer('stop');
await page.waitForFunction(() => window.__said.some(x => /will come back in your reviews/.test(x)));
assert.ok(talkCalls.every(c => c.output_config.format.type === 'json_schema'));
assert.equal(talkCalls.length, 3);
assert.ok(/the learner skipped/.test(talkCalls[1].messages[0].content), 'skip is told to the AI');
d = await store();
let talkSess = d.sessions[d.sessions.length - 1];
assert.equal(talkSess.mode, 'drive-talk'); assert.equal(talkSess.end, 'stopped'); assert.equal(talkSess.gained.length, 1);
let mine = d.custom.find(s => s.en === 'I went to the gym after work.');
assert.ok(mine && mine.provenance === 'teacher_suggested' && mine.source === 'talk' && mine.grammar === '과거시제 · went');
assert.equal(d.attempts.filter(a => a.kind === 'recast').length, 2);
assert.equal(d.states[mine.id].level, 'review', 'said correctly → reviewed from tomorrow');
assert.equal(d.states[mine.id].next, C_addDays(d.states[mine.id].lastPracticed, 1));
assert.equal(d.attempts.filter(a => a.kind === 'recast')[0].judge, 'rules');
assert.match(await page.textContent('#summary-list'), /I went to the gym after work\. — 퇴근하고 헬스장에 갔어\./);
assert.equal(await page.isHidden('#drive'), true, 'drive sign closes after the talk');
// The main app lists it as my sentence
await page.goto(url);
await page.click('#tab-records');
assert.match(await page.textContent('#view-records'), /내 문장.*I went to the gym after work\./s);
// Without a key the scenes are disabled
await page.evaluate(() => localStorage.removeItem('commute-coach.apikey'));
await page.goto(talkUrl);
assert.equal(await page.locator('.scene:not([disabled])').count(), 0);
assert.match(await page.textContent('#env'), /AI 미연결/);

assert.deepEqual(errors, []);
console.log('e2e ok');
await browser.close();
