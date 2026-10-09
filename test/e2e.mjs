// End-to-end: runs real sessions in Chromium with typed answers and a stubbed speech engine.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('dist/index.html')).href;
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
  // Fake recognizer: each start() consumes one queued utterance. null = silence.
  class FakeSR {
    start() {
      if (window.__deny) return setTimeout(() => this.onerror && this.onerror({ error: 'not-allowed' }), 5);
      const tick = () => {
        if (this.aborted) return;
        if (!window.__queue.length) return setTimeout(tick, 10);
        const item = window.__queue.shift();
        if (item === null) return this.onend && this.onend();
        this.onspeechstart && this.onspeechstart();
        if (this.continuous) {
          const res = [{ transcript: item }]; res.isFinal = true;
          this.onresult({ results: [res] });
          setTimeout(() => this.onend && this.onend(), 5);
        } else this.onresult({ results: [[{ transcript: item, confidence: 0.9 }]] });
      };
      setTimeout(tick, 5);
    }
    abort() { this.aborted = true; }
    stop() { this.aborted = true; }
  }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeSR });
});

const answer = t => page.evaluate(x => window.__queue.push(x), t);
const said = () => page.evaluate(() => window.__said.join(' | '));
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('commute-coach.v1')));

// ---- Day 1: first sentence, one correction, then pass, then end-of-session recheck ----
await page.goto(url);
assert.match(await page.textContent('#plan'), /I'm heading to work\./);
await page.click('#start');
assert.equal(await page.locator('#view-lesson input:not([disabled]), #view-lesson textarea:not([disabled])').count(), 0, 'no usable text box during the lesson');
assert.equal(await page.isDisabled('#start'), true, 'start is locked during the lesson');
await answer('I heading for work');                  // fix
await page.waitForFunction(() => window.__said.some(t => t.startsWith('Almost.')));
assert.match(await page.textContent('#said-text'), /FIX/);
await answer("I'm heading to work.");               // pass
await answer("I'm heading to work");                // recheck (recall from Korean)
await page.waitForFunction(() => window.__said.some(t => t.includes('See you tomorrow')));
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

// ---- Records tab renders the metrics ----
await page.click('#tab-records');
const rec = await page.textContent('#view-records');
assert.match(rec, /Coherence/); assert.match(rec, /3\/3/); assert.match(rec, /전치사/);
assert.match(rec, /Pronunciation미측정/);
assert.match(rec, /내 이야기/); assert.match(rec, /A Busy Day/); assert.match(rec, /After work, I went to the gym\./);

await page.setViewportSize({ width: 390, height: 844 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
assert.equal(overflow, false, 'no horizontal scroll at phone width');
await page.screenshot({ path: 'test/records-phone.png', fullPage: true });
await page.click('#tab-lesson');
await page.screenshot({ path: 'test/lesson-phone.png', fullPage: true });

assert.deepEqual(errors, []);
console.log('e2e ok');
await browser.close();
