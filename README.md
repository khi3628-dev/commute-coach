# Commute Coach

A hands-free English speaking coach for the morning commute. It follows the plan in "AI 영어 회화 코치 앱 — 실행 기획서 v1".

## What works now
- Module 1: the 6 core commute sentences and 6 extension sentences, with the accepted variants from the source doc
- Conversation samples (`src/content.js`): 102 question → my-answer pairs, 6 per topic across 17 topics (daily life 6, work 6, hobbies and travel 5). After Module 1, one new item comes per session: you hear the question and the model answer, then repeat it. In reviews you hear only the question and answer it. Once 2 or more items in a topic reach review, "conversation practice" asks that topic's questions in order.
- Session flow: warm-up review (up to 4) → today's sentence (up to 3 tries; split practice on repeated failure) → story (2/3/6 sentences in a row) → end-of-session recheck
- Voice only: after one tap to start, there is no text box and no on-screen buttons. Answers and commands are spoken. If the microphone is unavailable, the lesson does not start.
- Grading: word-level comparison that accepts listed variants and contractions, spoken corrections (at most 2 per turn), and a "say it again" retry. Korean answers get the English sentence back.
- Today's story lesson (interview): the teacher asks 4 questions that depend on the time of day (morning, afternoon, evening). You answer in Korean or English ("넘어가" skips a question, "그만" ends it). Once the interview ends, one AI call (Claude claude-opus-5-5, or Google Gemini) turns your answers into a 2–5 sentence story of your day, in time order with linking words. You then practice each sentence, say the whole story from the start, and finish with a final recheck. The sentences join your reviews, and the story is listed under "내 이야기" in the Records tab. Requires an Anthropic key (sk-ant-…) or a Google AI Studio Gemini key (AIza…). The app picks the provider from the key's prefix, and the key is stored only in that browser. The Gemini model name can be changed in settings (default gemini-flash-latest).
- Commands count only when the whole utterance is a command (e.g. "일 끝나고 헬스장 갔어" is treated as an answer, not "stop").
- Illustrations: 10 images made with Higgsfield GPT Image 2.5 Flare (prompts: `docs/image-prompts.md`). The sentence card shows the picture for the current topic, and the icon is used as the home-screen icon. Resized copies live in `img/`; an image that fails to load is simply hidden.
- Teacher voice: downloaded iOS "Enhanced/Premium" voices are picked first. You can choose a voice and preview it.
- Review intervals 1 → 3 → 7 → 14 days; mastery requires passes in two or more contexts (drill, story, extension)
- Voice commands: again, slower, skip, pause, resume, meaning (뜻), stop (또는 다시·천천히·넘어가·잠깐·계속·무슨 뜻·그만)
- Drive mode: full-screen sign with no sentence text, screen wake lock, auto-pause after two silences
- Records: Retention, Fluency (time until you start speaking), Coherence, Transfer. Pronunciation is shown as "not measured".

- Commute Talk (`talk.html`): a second version of the coach. Pick a scene (my day, lunch plans, weekend, morning check-in, travel), then the AI plays a conversation partner by voice. When your line has a clear mistake it offers one natural recast, which you repeat; that repeat is judged by the same rules as the lessons, and the recast joins the main app's reviews as "my sentence" (provenance teacher_suggested). 8 turns, or 5 in drive mode. Needs the same API key.

## Running it
- `dist/index.html` on an HTTPS host, opened in iPhone Safari → voice recognition and speech output both work (needs testing on a real device)
- `dist/artifact.html` → the claude.ai artifact version. The microphone is unavailable there, so lessons cannot start; it only shows records.

## Development
```
node build.mjs                 # src → index.html, talk.html, dist/
node --test test/core.test.js  # grading, commands, review intervals, session-plan tests
node test/e2e.mjs              # Chromium simulation with a fake speech recognizer: 3 days, silence → auto-pause, microphone denied
```

## Known limits (Phase 0 prototype)
- Not a native iOS app: no Siri shortcut, Action Button, CarPlay, or background audio. The screen must stay on.
- Barge-in (interrupting while the teacher is speaking) is not supported. Use commands while the app is listening.
- With no on-screen buttons, "stop" may not work if recognition keeps failing. Closing the tab keeps everything recorded up to that point.
- Recognition language is fixed to en-US, so Korean speech may be misrecognized.
- The API key is called directly from the browser (for personal use). For other users, move it behind a server (e.g. Vercel).
- Records are stored only in this device's browser. The Records tab can copy the backup, save it as a file, and restore it from pasted text or a file.
- Speech recognition reportedly does not work when the app is opened from a Home Screen icon. The app shows a notice in that case; open it in Safari instead.
- There are no push notifications. "매일 알림" adds a daily repeating event to the Calendar (.ics) instead.
