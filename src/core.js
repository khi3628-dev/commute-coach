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
      if (found) {
        let i = n, j = m, last = -1;
        while (i > 0 && j > 0) {
          if (want[i - 1] === slice[j - 1]) { if (last < 0) last = j - 1; i--; j--; }
          else if (L[i - 1][j] >= L[i][j - 1]) i--; else j--;
        }
        cursor += last + 1;
      }
      return { id: t.id, found, score };
    });
  }

  // ---------- Commands (운전 모드 음성 명령) ----------
  function parseCommand(text) {
    const raw = String(text || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw.split(/\s+/).length > 4) return null;
    const t = raw.replace(/[.!?,]/g, '');
    if (/^(again|repeat|one more time|say it again)$|다시/.test(t)) return 'again';
    if (/^(slower|slow down|more slowly)$|천천히/.test(t)) return 'slower';
    if (/^(skip|next|skip it)$|넘어가|다음/.test(t)) return 'skip';
    if (/^(pause|wait|hold on)$|잠깐|멈춰/.test(t)) return 'pause';
    if (/^(resume|continue|go on|ready|i'm ready)$|계속|다시 시작/.test(t)) return 'resume';
    if (/^(what does it mean|meaning|what's that mean)$|무슨 뜻|뜻이 뭐/.test(t)) return 'meaning';
    if (/^(stop|end|finish|that's it)$|그만|끝/.test(t)) return 'stop';
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
  function planSession(states, day, opts) {
    const o = { maxReview: 4, ...opts };
    const st = id => states[id] || newState();
    const due = SENTENCES.filter(s => {
      const x = st(s.id);
      return x.level !== 'new' && x.next && x.next <= day;
    }).sort((a, b) => (st(a.id).next < st(b.id).next ? -1 : st(a.id).next > st(b.id).next ? 1 : 0));
    const review = due.slice(0, o.maxReview);
    const learning = SENTENCES.filter(s => st(s.id).level === 'learning').length;
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

  const api = { SENTENCES, norm, hasHangul, align, judge, storyMatch, parseCommand, today, addDays, INTERVALS, newState, updateState, planSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
