// Commute Coach core: content, answer judging, review scheduling.
// Pure functions only (no DOM), so it runs in the browser and in Node tests.
(function (root) {
  'use strict';

  // ---------- Content (원본 3장: Module 1 핵심 6문장 + 확장 6문장) ----------
  const SENTENCES = [
    { id: 'c1', type: 'core', order: 1, en: "I'm heading to work.", ko: '나 지금 출근하는 중이야.', grammar: '현재진행 · heading to', variants: [] },
    { id: 'c2', type: 'core', order: 2, en: 'It takes about twenty minutes by car.', ko: '차로 20분 정도 걸려.', grammar: '이동 시간 · by car', variants: [] },
    { id: 'c3', type: 'core', order: 3, en: "Traffic's a little heavy, but it's okay.", ko: '차가 좀 막히는데 괜찮아.', grammar: '교통 상황 · but · 축약형', variants: [] },
    { id: 'c4', type: 'core', order: 4, en: 'And then I grab a coffee before I start the day.', ko: '그리고 하루를 시작하기 전에 커피 한 잔 사.', grammar: '관사 a · before · 행동 순서', variants: ['I grab a coffee before I start the day.', 'Then I grab a coffee before I start the day.'] },
    { id: 'c5', type: 'core', order: 5, en: 'I open my inbox and check my email.', ko: '받은편지함을 열고 이메일을 확인해.', grammar: '이메일 업무 · and', variants: [] },
    { id: 'c6', type: 'core', order: 6, en: "If something's urgent, I reply.", ko: '급한 게 있으면 답장해.', grammar: '조건문 if · urgent · reply', variants: ["If anything's urgent, I reply."] },
    { id: 'e1', type: 'ext', parent: 'c5', en: 'When I get to the office, I check my emails.', ko: '사무실에 도착하면 이메일을 확인해.', grammar: 'when 절', cue: 'What do you do when you get to the office?', variants: [] },
    { id: 'e2', type: 'ext', parent: 'c5', en: 'After I check my email, I message my team about priorities.', ko: '이메일을 확인한 뒤 팀에 우선순위를 메시지로 보내.', grammar: 'after 절 · message', cue: 'And after you check your email?', variants: [] },
    { id: 'e3', type: 'ext', parent: 'c4', en: 'I head to work, grab a coffee, and check my email.', ko: '출근해서 커피 사고 이메일 확인해.', grammar: '동작 나열', cue: 'Sum up your morning in one sentence.', variants: [] },
    { id: 'e4', type: 'ext', parent: 'c1', en: "I'm heading home.", ko: '집에 가는 중이야.', grammar: 'heading 변형', cue: "Work is over. You're driving back. Where are you going?", variants: [] },
    { id: 'e5', type: 'ext', parent: 'c1', en: "I'm heading to the gym.", ko: '헬스장 가는 중이야.', grammar: 'heading 변형', cue: "You're going to work out. Tell me.", variants: [] },
    { id: 'e6', type: 'ext', parent: 'c1', en: "I'm heading into a meeting.", ko: '회의 들어가는 중이야.', grammar: 'heading into', cue: "You're walking into a meeting. Tell me.", variants: [] },
  ];

  // ---------- Normalization ----------
  const NUM = { '20': 'twenty', '6': 'six', '1': 'one', '2': 'two', '3': 'three' };
  const EQUIV = { ok: 'okay', emails: 'email', mins: 'minutes', gonna: 'going to' };

  function norm(s) {
    let t = String(s || '').toLowerCase().replace(/[’‘`´]/g, "'");
    t = t.replace(/\bcan't\b/g, 'can not').replace(/\bwon't\b/g, 'will not')
      .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are')
      .replace(/'ll\b/g, ' will').replace(/'ve\b/g, ' have').replace(/'d\b/g, ' would')
      .replace(/\b(\w+)'s\b/g, '$1 is');
    t = t.replace(/[^a-z0-9\s]/g, ' ');
    return t.split(/\s+/).filter(Boolean)
      .map(w => NUM[w] || EQUIV[w] || w).join(' ').split(' ').filter(Boolean);
  }

  const hasHangul = s => /[ㄱ-ㆎ가-힣]/.test(String(s || ''));

  // Word-level edit distance with the list of edits.
  function align(want, got) {
    const n = want.length, m = got.length;
    const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (want[i - 1] === got[j - 1] ? 0 : 1));
    }
    const ops = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && want[i - 1] === got[j - 1] && d[i][j] === d[i - 1][j - 1]) { ops.unshift({ type: 'ok', want: want[i - 1], got: got[j - 1] }); i--; j--; }
      else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) { ops.unshift({ type: 'sub', want: want[i - 1], got: got[j - 1] }); i--; j--; }
      else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.unshift({ type: 'miss', want: want[i - 1] }); i--; }
      else { ops.unshift({ type: 'extra', got: got[j - 1] }); j--; }
    }
    return { dist: d[n][m], ops };
  }

  const ARTICLES = new Set(['a', 'an', 'the']);
  const PREPS = new Set(['to', 'into', 'by', 'about', 'at', 'in', 'on', 'for', 'with', 'from']);
  const CONNECTORS = new Set(['and', 'but', 'before', 'after', 'if', 'when', 'then', 'so']);

  function classify(op, ops) {
    const w = op.want || op.got;
    if (op.type !== 'sub') {
      const other = ops.find(o => o !== op && o.type !== 'ok' && o.type !== 'sub' && o.type !== op.type && (o.want || o.got) === w);
      if (other) return 'word_order';
    }
    const words = [op.want, op.got].filter(Boolean);
    if (words.some(x => ARTICLES.has(x))) return 'article';
    if (words.some(x => PREPS.has(x))) return 'preposition';
    if (words.some(x => CONNECTORS.has(x))) return 'connector';
    if (op.type === 'sub' && op.want.slice(0, 4) === op.got.slice(0, 4)) return 'form';
    if (op.type === 'miss' && (op.want === 'am' || op.want === 'is' || op.want === 'are')) return 'contraction';
    return 'word';
  }

  const PRIORITY = { connector: 0, article: 1, preposition: 2, form: 3, word_order: 4, contraction: 5, word: 6 };

  function hintFor(e) {
    if (e.type === 'miss') return `Add "${e.want}".`;
    if (e.type === 'extra') return `Drop "${e.got}".`;
    return `Say "${e.want}", not "${e.got}".`;
  }

  // Judge a learner utterance against a sentence.
  // Returns {verdict: 'pass'|'fix'|'korean'|'empty', target, errors[], hint, far}
  function judge(sentence, text, learned) {
    if (!text || !String(text).trim()) return { verdict: 'empty' };
    if (hasHangul(text)) return { verdict: 'korean', target: sentence.en };
    const got = norm(text);
    const candidates = [sentence.en, ...(sentence.variants || []), ...((learned && learned[sentence.id]) || [])];
    let best = null;
    for (const c of candidates) {
      const a = align(norm(c), got);
      if (!best || a.dist < best.dist) best = { ...a, text: c, len: norm(c).length };
    }
    if (best.dist === 0) return { verdict: 'pass', target: best.text, errors: [] };
    const edits = best.ops.filter(o => o.type !== 'ok').map(o => ({ ...o, kind: classify(o, best.ops) }));
    edits.sort((x, y) => PRIORITY[x.kind] - PRIORITY[y.kind]);
    const far = best.dist / best.len > 0.6;
    const top = edits.slice(0, 2);
    return {
      verdict: 'fix', target: sentence.en, errors: edits, far,
      hint: far ? '' : top.map(hintFor).join(' '),
      ops: best.ops,
    };
  }

  // Story (연결 말하기): how many targets appear in order in one long answer.
  function storyMatch(targets, text) {
    const got = norm(text);
    let cursor = 0;
    return targets.map(t => {
      const want = norm(t.en);
      const slice = got.slice(cursor);
      // LCS between want and slice, tracking the last matched index.
      const n = want.length, m = slice.length;
      const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        L[i][j] = want[i - 1] === slice[j - 1] ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
      }
      const score = n ? L[n][m] / n : 0;
      const found = score >= 0.8;
      // Advance past the earliest point where the best match is complete, so a word that
      // repeats in a later sentence ("headed to work" … "After work") is not borrowed from it.
      if (found) cursor += L[n].findIndex(v => v === L[n][m]);
      return { id: t.id, found, score };
    });
  }

  // ---------- Commands (운전 모드 음성 명령) ----------
  // A command is the whole utterance, never a word inside an answer
  // (so "일 끝나고 헬스장 갔어" or "다음 주에 회의 있어" are answers, not commands).
  const COMMANDS = [
    ['resume', /^(resume|continue|go on|ready|i'm ready|i am ready|계속|계속해|계속하자|다시 시작)$/],
    ['again', /^(again|repeat|one more time|say it again|다시|다시 해 ?줘|한 번 더)$/],
    ['slower', /^(slower|slow down|more slowly|천천히|천천히 해 ?줘|천천히 말해 ?줘)$/],
    ['skip', /^(skip|next|skip it|넘어가|넘어가자|넘어가 ?줘|다음|다음 거)$/],
    ['pause', /^(pause|wait|hold on|잠깐|잠깐만|멈춰)$/],
    ['meaning', /^(what does it mean|meaning|what's that mean|what is that mean|무슨 뜻|무슨 뜻이야|뜻이 뭐야|뜻)$/],
    ['stop', /^(stop|end|finish|that's it|that is it|그만|그만하자|그만해|끝|끝내자)$/],
  ];
  function parseCommand(text) {
    const t = String(text || '').trim().toLowerCase().replace(/[.!?,~]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    for (const [cmd, re] of COMMANDS) if (re.test(t)) return cmd;
    return null;
  }

  // ---------- Dates ----------
  function today(now) {
    const d = now ? new Date(now) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function addDays(day, n) {
    const [y, m, d] = day.split('-').map(Number);
    const x = new Date(y, m - 1, d + n);
    return today(x);
  }

  // ---------- Review scheduling (원본 9장 제안 간격: 1 → 3 → 7 → 14일) ----------
  const INTERVALS = [1, 3, 7, 14];

  function newState() {
    return { level: 'new', step: -1, next: null, lastPracticed: null, failStreak: 0, contexts: [], split: false };
  }

  // kind: 'learn' (오늘의 문장), 'review' (워밍업 복습), 'recheck' (마무리 재확인), 'story' (연결 말하기), 'transfer' (변형 질문)
  function updateState(prev, kind, result, day) {
    const st = { ...newState(), ...prev, contexts: [...((prev && prev.contexts) || [])] };
    st.lastPracticed = day;
    const clean = result.passed && result.firstTry && !result.hinted;
    if (result.passed) {
      st.failStreak = 0;
      const ctx = kind === 'story' ? 'story' : kind === 'transfer' ? 'transfer' : 'drill';
      if (!st.contexts.includes(ctx)) st.contexts.push(ctx);
    } else if (!result.skipped) {
      st.failStreak += 1;
      if (st.failStreak >= 3) st.split = true;
    }

    if (kind === 'learn') {
      if (st.level === 'new') st.level = 'learning';
      if (!result.passed) st.next = day;
      return st;
    }
    if (kind === 'recheck') {
      if (result.passed && st.level === 'learning') { st.level = 'review'; st.step = 0; st.next = addDays(day, INTERVALS[0]); st.split = false; }
      else if (!result.passed) st.next = day;
      return st;
    }
    if (kind === 'review') {
      if (clean && (st.level === 'review' || st.level === 'mastered')) {
        st.step = Math.min(st.step + 1, INTERVALS.length);
        if (st.step >= INTERVALS.length && st.contexts.length >= 2) { st.level = 'mastered'; st.next = addDays(day, 30); }
        else st.next = addDays(day, INTERVALS[Math.min(st.step, INTERVALS.length - 1)]);
      } else if (clean && st.level === 'learning') {
        st.level = 'review'; st.step = 0; st.next = addDays(day, INTERVALS[0]);
      } else if (!result.skipped && !clean) {
        st.level = 'learning'; st.step = -1; st.next = day;
      }
      return st;
    }
    return st; // story / transfer only add contexts
  }

  // ---------- Session plan ----------
  // opts.extra: the learner's own sentences (내 문장). They join reviews but not the story.
  function planSession(states, day, opts) {
    const o = { maxReview: 4, extra: [], ...opts };
    const st = id => states[id] || newState();
    const all = SENTENCES.concat(o.extra);
    const due = all.filter(s => {
      const x = st(s.id);
      return x.level !== 'new' && x.next && x.next <= day;
    }).sort((a, b) => (st(a.id).next < st(b.id).next ? -1 : st(a.id).next > st(b.id).next ? 1 : 0));
    const review = due.slice(0, o.maxReview);
    const learning = all.filter(s => st(s.id).level === 'learning').length;
    let fresh = null;
    if (learning < 3) {
      const cores = SENTENCES.filter(s => s.type === 'core').sort((a, b) => a.order - b.order);
      fresh = cores.find(s => st(s.id).level === 'new') || null;
      if (!fresh) fresh = SENTENCES.find(s => s.type === 'ext' && st(s.id).level === 'new' && st(s.parent).level !== 'new') || null;
    }
    // 연결 말하기: 이야기 순서대로 앞에서부터 복습 단계 이상인 핵심 문장
    const cores = SENTENCES.filter(s => s.type === 'core').sort((a, b) => a.order - b.order);
    let k = 0;
    while (k < cores.length && ['review', 'mastered'].includes(st(cores[k].id).level)) k++;
    const storyLen = k >= 6 ? 6 : k >= 3 ? 3 : k >= 2 ? 2 : 0;
    return { review, fresh, story: cores.slice(0, storyLen) };
  }

  // ---------- 오늘 이야기 인터뷰: 질문, Claude 요청과 응답 검증 ----------
  const QUESTIONS = {
    morning: [
      { en: 'How did your morning start?', ko: '아침은 어떻게 시작했어요?' },
      { en: "How's your commute today?", ko: '오늘 출근길은 어때요?' },
      { en: "What's the first thing you'll do at work?", ko: '회사에서 제일 먼저 뭘 할 거예요?' },
      { en: 'What are your plans after work?', ko: '퇴근 후엔 뭐 할 거예요?' },
    ],
    day: [
      { en: "How's your day going so far?", ko: '오늘 하루 지금까지 어때요?' },
      { en: 'What did you have for lunch?', ko: '점심은 뭐 먹었어요?' },
      { en: 'What are you working on this afternoon?', ko: '오후에는 무슨 일을 해요?' },
      { en: 'What are your plans after work?', ko: '퇴근 후엔 뭐 할 거예요?' },
    ],
    evening: [
      { en: 'How was your day?', ko: '오늘 하루 어땠어요?' },
      { en: 'What was the busiest part of your day?', ko: '오늘 제일 바빴던 일은 뭐였어요?' },
      { en: 'Did anything good happen today?', ko: '오늘 좋은 일 있었어요?' },
      { en: 'What are you doing tonight?', ko: '오늘 저녁엔 뭐 해요?' },
    ],
  };
  function interviewQuestions(hour) {
    if (hour >= 5 && hour < 12) return QUESTIONS.morning;
    if (hour >= 12 && hour < 17) return QUESTIONS.day;
    return QUESTIONS.evening;
  }

  const STORY_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'feedback', 'sentences'],
    properties: {
      title: { type: 'string' },
      feedback: { type: 'string' },
      sentences: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'ko', 'grammar'],
          properties: { en: { type: 'string' }, ko: { type: 'string' }, grammar: { type: 'string' } },
        },
      },
    },
  };

  // answers: [{q, a}] from the interview. lang: 'ko' (answered in Korean) or 'en' (tried in English)
  function storyPrompt(answers, lang, known) {
    return [
      'You are an American English speaking coach for a Korean adult who practices out loud while commuting.',
      'You just asked the learner a few questions about their day. Their answers are speech-to-text,',
      lang === 'ko'
        ? 'given in Korean, and may contain recognition errors.'
        : 'given in English by the learner, so ignore punctuation and capitalization and expect grammar mistakes.',
      `Interview: ${JSON.stringify(answers)}`,
      "Write the learner's own short story of today that they will memorize and say out loud.",
      'Rules:',
      '- First person, casual spoken American English, everyday words, contractions are fine.',
      '- 2 to 5 sentences in total, in the order things happen in the day; one sentence per answer, two only when an answer has two separate events.',
      '- At most 12 words per sentence.',
      '- Start later sentences with a natural link when it fits (Then, After that, So, But, Later).',
      '- Keep the learner\'s facts and details. Do not invent events, people, places or feelings. Skip answers that are empty or unclear.',
      '- If only one answer is usable, write 1 or 2 sentences.',
      `- Sentences the learner already knows (reuse their patterns when they fit): ${JSON.stringify(known.slice(0, 20))}`,
      'Fields: title (an English title of at most 5 words); for each sentence: en, ko (natural Korean meaning), grammar (one short Korean label for the key point, e.g. "과거시제 · met up with");',
      lang === 'ko'
        ? 'feedback: one short English sentence the teacher says before the drill, like "Here\'s your story for today."'
        : "feedback: one short English sentence that names the most important fix across the learner's answers, or \"Nice job. Here's a natural way to say it.\" if they were fine.",
    ].join('\n');
  }

  function storyRequest(answers, lang, known, model) {
    return {
      model: model || 'claude-opus-5-5',
      max_tokens: 3000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: STORY_SCHEMA } },
      fallbacks: 'default',
      messages: [{ role: 'user', content: storyPrompt(answers, lang, known) }],
    };
  }

  // Validate a Messages API response; returns {title, feedback, sentences} or throws a readable error.
  function parseStoryResponse(resp) {
    if (!resp || resp.type === 'error') throw new Error((resp && resp.error && resp.error.message) || 'empty response');
    if (resp.stop_reason === 'refusal') throw new Error('refused');
    if (resp.stop_reason === 'max_tokens') throw new Error('cut off');
    const block = (resp.content || []).find(b => b.type === 'text');
    if (!block) throw new Error('no text');
    return parseStoryJson(block.text);
  }

  // ---------- Gemini (Google AI Studio key) ----------
  const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
  const providerOf = key => (/^AIza/.test(String(key || '').trim()) ? 'gemini' : 'anthropic');

  function geminiRequest(answers, lang, known) {
    return {
      contents: [{ role: 'user', parts: [{ text: storyPrompt(answers, lang, known) }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: STORY_SCHEMA, maxOutputTokens: 3000 },
    };
  }

  function parseGeminiResponse(resp) {
    if (!resp) throw new Error('empty response');
    if (resp.error) throw new Error(resp.error.message || 'error');
    if (resp.promptFeedback && resp.promptFeedback.blockReason) throw new Error('refused');
    const cand = (resp.candidates || [])[0];
    if (!cand) throw new Error('no text');
    if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw new Error('refused');
    if (cand.finishReason === 'MAX_TOKENS') throw new Error('cut off');
    const text = ((cand.content && cand.content.parts) || []).map(x => x.text || '').join('');
    if (!text) throw new Error('no text');
    return parseStoryJson(text);
  }

  function parseStoryJson(text) {
    const out = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    const sentences = (out.sentences || [])
      .map(x => ({ en: String(x.en || '').trim(), ko: String(x.ko || '').trim(), grammar: String(x.grammar || '').trim() }))
      .filter(x => x.en && !hasHangul(x.en) && x.en.split(/\s+/).length <= 16)
      .slice(0, 5);
    if (!sentences.length) throw new Error('no usable sentence');
    const title = String(out.title || '').trim().slice(0, 60) || 'My day';
    return { title, sentences, feedback: String(out.feedback || '').trim().slice(0, 140) };
  }

  const api = { SENTENCES, interviewQuestions, storyPrompt, storyRequest, parseStoryResponse, providerOf, geminiRequest, parseGeminiResponse, GEMINI_DEFAULT_MODEL, norm, hasHangul, align, judge, storyMatch, parseCommand, today, addDays, INTERVALS, newState, updateState, planSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
