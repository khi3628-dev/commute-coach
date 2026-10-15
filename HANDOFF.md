# Commute Coach 인수인계 (Handoff)

작성일: 2026-10-15 · 기준 커밋: `259a205` (main)

이 문서 하나만 읽고 다음 작업을 이어갈 수 있게 정리했습니다. 처음 보는 사람이나 새 Claude 세션은 **1 → 4 → 7** 순서로 읽으면 됩니다.

---

## 1. 한 줄 요약

출퇴근 운전 중에 **화면을 보지 않고 음성만으로** 미국식 영어 회화를 연습하는 개인용 웹앱(iPhone Safari)입니다. 이전에 배운 문장을 기억해 복습하고, 틀린 부분을 짧게 교정한 뒤 다시 말하게 합니다.

- 사용자: 본인 1명 (Phase 0: 본인 검증 → 이후 베타 → 제품화)
- 플랫폼: iPhone Safari에서 여는 정적 웹앱 (네이티브 앱 아님)
- 상태: 기본 기능 동작 확인됨 (사용자가 iPhone에서 "기본적인 건 잘 작동한다"고 확인)

## 2. 링크

| 항목 | 위치 |
| --- | --- |
| 실제 앱 | https://khi3628-dev.github.io/commute-coach/ |
| 저장소 | https://github.com/khi3628-dev/commute-coach (공개, GitHub Pages: main / root) |
| 실행 기획서 | https://claude.ai/code/artifact/08e3877c-56e3-4d4b-9aaa-8ebb1448c500 (Claude Docs) |
| 이미지 프롬프트 | `docs/image-prompts.md` |
| 초기 미리보기(구버전) | https://claude.ai/artifact/3obSWdT3KxNXzYGxyBbNjy (마이크 불가 → 기록 보기 전용) |

## 3. 지금 되는 것

**수업 시작** (매일 수업, 한 번 탭 후 음성 전용)
1. 워밍업 복습: 복습일이 된 문장 최대 4개. 핵심 문장은 한국어 뜻을 듣고 영어로, 질문이 있는 문장은 질문을 듣고 답.
2. 오늘의 문장 1개: 듣고 따라 말하기 → 교정(최대 2개 지적) → "Say it again", 최대 3회. 계속 실패하면 문장을 쪼개서 연습.
3. 대화 연습 또는 연결 말하기: 회화 주제가 준비되면 그 주제 질문에 이어서 답하기. 아니면 출근 이야기 2/3/6문장 이어 말하기.
4. 마무리 재확인: 오늘 통과한 문장을 한 번 더.

**오늘 이야기 레슨** (AI 키 필요)
- 시간대별 질문 4개 인터뷰(한국어 또는 영어로 답) → AI 1회 호출로 '오늘의 내 이야기' 2~5문장 생성 → 한 문장씩 연습 → 처음부터 이어 말하기 → 재확인.
- AI: Claude(`sk-ant-` 키, 모델 `claude-opus-5-5`) 또는 Gemini(`AIza` 키, 기본 모델 `gemini-flash-latest`, 설정에서 변경 가능). 키 모양으로 자동 선택.

**콘텐츠**
- Module 1 출근 6문장 + 확장 6문장 (원본 학습 이력에서 가져옴)
- 회화 샘플 102개: 17개 주제 × 질문→답 6개 (일상 6, 직장 6, 취미·여행 5) — `src/content.js`

**기타**
- 운전 모드: 전체 화면 표지판 디자인, 문장 글자 없음, 화면 꺼짐 방지, 두 번 침묵하면 자동 일시정지. 이어 말하기는 최대 3문장(6문장 출근 이야기는 날마다 앞·뒤 3문장 번갈아, 내 이야기 4~5문장은 2~3문장씩 나눠서). 일반 화면은 그대로 6문장
- 반복 오류: 같은 오류 유형(관사·전치사·연결어·어미·어순·be동사 빠짐)이 시도 3번에서 나오면 가장 많이 틀린 문장을 다음 수업 워밍업 맨 앞에 넣고 한 줄 팁("Watch the preposition.")을 말함. 넣은 뒤로는 다시 셈(`focusSince`)
- 음성 인식: `continuous`를 쓰지 않음. 긴 답은 구간마다 다시 시작해 이어 붙이고 2.6초 말이 없으면 끝. 시작하자마자 오류 없이 끝나면 한 번 다시 시도
- 음성 명령(발화 전체가 명령일 때만): again/다시, slower/천천히, meaning/뜻, skip/넘어가, pause/잠깐, resume/계속, stop/그만
- 선생님 목소리: iPhone 고품질(향상됨/프리미엄) 음성 우선, 직접 선택·미리 듣기
- 기록 탭: Retention, Fluency(말 시작까지 시간), Coherence, Transfer, Pronunciation(미측정 표시), 문장별 상태, 회화 주제 진도, 내 이야기, 반복 오류, 최근 발화, 백업 복사
- 그림: Higgsfield GPT Image 2.5 Flare로 만든 10장(아이콘 + 주제 그림 9장), 문장 카드 위에 표시. `img/`에 줄인 사본(JPEG 800px, 아이콘 PNG 512px, 합계 약 1.3MB)으로 보관

## 4. 구조와 파일

```
src/content.js   회화 샘플 102개(MODULES), 그림 주소(IMAGES, imageFor → img/)
img/             그림 10장 (icon.png, commute/lunch/gym/run/parents/rest/office/reading/japan.jpg)
src/core.js      순수 로직(DOM 없음): 정답 판정, 명령어, 복습 일정, 세션 계획, 인터뷰 질문, AI 요청/응답 검증
src/app.html     화면 + 세션 흐름(음성 입출력, 수업, 인터뷰, 기록 탭, 설정)
build.mjs        src → index.html(Pages가 서비스) + dist/index.html + dist/artifact.html
test/core.test.js  로직 테스트 26개 (node:test)
test/e2e.mjs       Chromium 시뮬레이션 (가짜 음성 인식·합성, 가짜 AI 서버, 루트 index.html을 엽니다)
docs/image-prompts.md  이미지 프롬프트와 Higgsfield 작업 ID
```

- 빌드 결과물(`index.html`, `dist/`)도 커밋합니다. **src를 고친 뒤 반드시 `node build.mjs`를 실행하고 함께 커밋**해야 실제 앱에 반영됩니다.
- 외부 라이브러리 없음. 폰트만 Google Fonts.

### 핵심 로직 (src/core.js)
- `judge(sentence, text, learned)`: 단어 단위 정렬로 비교. 축약형 펼침(I'm → I am), 숫자→영어(5 → five), ok/okay, email/emails 같게 취급. 결과는 `pass` / `fix`(오류 종류: article, preposition, connector, form, word_order, contraction, word) / `korean` / `empty`.
- `updateState(state, kind, result, day)`: 단계 `new → learning → review → mastered`. 복습 간격 1→3→7→14일. 맞힌 답의 말 시작 시간으로 조절(`grade`): 1.5초 이내면 한 칸 건너뛰고, 4초 초과면 같은 간격 반복. 숙달하려면 14일 복습 통과 + 2가지 이상 상황(drill, story, transfer)에서 성공. 3회 연속 실패 시 분해 연습 표시.
- `planSession(states, day, {extra, maxStory, focus})`: 복습 최대 4개(오래된 순, `focus` 문장은 맨 앞), 새 문장 1개(학습 중 3개 미만일 때, 순서: 핵심 → 확장 → 회화 샘플), 연결 말하기(운전 중 `maxStory` 3), 대화 연습 대상.
- `pickFocus(attempts, since, ids)`: 같은 오류 유형 3번이면 그 문장과 팁. `chunk(list, max)`: 긴 이야기를 고르게 나누기.
- 다지기(새 문장 없는 날의 학습 중 문장)는 한국어 뜻 듣고 영어로 말하기. 2번 연속 실패한 문장과 확장 문장은 따라 말하기.
- `storyMatch(targets, text)`: 이어 말하기에서 순서대로 말한 문장 찾기(80% 이상 일치).
- `parseCommand(text)`: 발화 전체가 명령일 때만 명령으로 처리.
- AI: `storyRequest`/`parseStoryResponse`(Claude), `geminiRequest`/`parseGeminiResponse`(Gemini), `providerOf(key)`.

### 저장 데이터 (iPhone 브라우저 localStorage)
- `commute-coach.v1`: `{ states, attempts(최근 800), sessions(최근 200), learned, errors, custom(내 문장), stories(내 이야기), settings{speed, voice, geminiModel} }`
- `commute-coach.apikey`: AI 키. 백업 데이터와 분리해 백업 복사에 포함되지 않음.
- 서버 없음. 기록은 그 기기 브라우저에만 있음.

## 5. 개발·배포 방법

```bash
git clone https://github.com/khi3628-dev/commute-coach && cd commute-coach
node build.mjs                    # src → index.html, dist/
node --test test/core.test.js     # 로직 테스트 (26개 통과)
PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node test/e2e.mjs   # 브라우저 시뮬레이션 ("e2e ok" 출력)
git push origin main              # 1~2분 뒤 GitHub Pages에 반영
```

- e2e는 설치된 playwright를 `PLAYWRIGHT` 환경 변수 경로에서 불러옵니다(없으면 `/opt/node22/lib/node_modules/playwright/index.mjs`). 사용자 Mac에서는 `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`(1.61.1)로 통과 확인.
- `dist/index.html`에서는 그림 경로(`img/`)가 맞지 않아 그림이 숨겨집니다. 실제 서비스와 e2e는 루트 `index.html`을 씁니다.
- 커밋 작성자는 `khi3628-dev`로 해 왔습니다.

## 6. 지켜 온 결정 (바꾸기 전에 사용자 확인)

- **수업 중에는 음성만**: 시작 탭 1회 외에는 입력창·버튼 없음. 마이크를 못 쓰면 수업을 시작하지 않음.
- **판정은 규칙 기반**: 정답과 등록된 변형만 통과. 원본 문서의 변형(email/emails, something's/anything's 등)은 모두 정답.
- **교정은 한 번에 최대 2개**, 문법 설명은 길게 하지 않음.
- **사용자 발화와 교사 예문을 섞지 않음**: AI가 만든 문장은 `provenance: 'teacher_suggested'`, 학습자 발화는 attempts에만.
- **측정 근거 없는 점수는 "미측정"**: 발음·강세·리듬 점수 없음.
- **API 키는 코드·저장소에 넣지 않음**: 사용자가 앱의 AI 연결 칸에 직접 넣음(저장소가 공개).
- 사용자와의 대화는 **한국어**, 앱 안 선생님 발화는 영어(한국어 모드의 안내만 한국어).

## 7. 남은 일 / 확인 필요

**확인 필요 (실제 기기에서 아직 검증 안 됨)**
- [ ] 실제 Claude·Gemini 키로 "저장하고 확인" 성공 여부와 생성 문장 품질 (테스트는 가짜 응답으로만 함)
- [ ] Gemini 기본 모델 이름 `gemini-flash-latest`가 지금도 유효한지 (공식 문서를 이 환경에서 열지 못함)
- [ ] iPhone에서 한국어 음성 인식(인터뷰 한국어 답) 정확도
- [ ] iPhone Safari에서 고품질 음성이 목록에 뜨는지
- [x] 그림 10장 확인: 글자 섞임·어색한 손 없음. 단, '휴식'·'독서' 그림의 인물은 수염이 있어 다른 그림의 주인공과 조금 다름
- [ ] iPhone 홈 화면 아이콘(이제 같은 도메인의 `img/icon.png`)이 제대로 뜨는지

**할 수 있는 다음 작업**
- [ ] 비상 정지(화면 길게 누르면 일시정지) — "수업 중 음성만" 원칙의 예외라 사용자 결정 대기
- [ ] 실제 iPhone에서 새 음성 인식 방식 확인: 긴 답(이어 말하기·인터뷰)이 중간에 끊기지 않는지, 구간 사이에 단어가 빠지지 않는지
- [ ] 회화 샘플 내용 다듬기 (사용자 생활과 안 맞는 문장 수정 — 사용자 피드백 대기)
- [ ] 회화 샘플을 출근 12문장보다 먼저 나오게 할지 결정 (사용자 선택 대기)
- [ ] 클라우드 AI 음성(TTS) 도입 여부 — 고품질 iPhone 음성으로 부족할 때
- [ ] 다른 사람도 쓰게 할 경우: API 키를 서버(Vercel 함수)로 옮기기, 기록 동기화
- [ ] 장기: 네이티브 iOS 앱(Siri 단축어, 액션 버튼, CarPlay, 백그라운드 오디오)

## 8. 알려진 한계

- 네이티브 앱이 아니라 화면이 켜져 있어야 하고, Siri·CarPlay·백그라운드 재생 불가
- 선생님이 말하는 중에는 끼어들 수 없음(듣는 중에만 명령)
- 영어 수업 중 음성 인식 언어가 en-US로 고정이라 한국어 답은 잘못 인식될 수 있음(인터뷰의 한국어 모드는 ko-KR)
- 버튼이 없어서 음성 인식이 계속 실패하면 "stop"도 안 먹힐 수 있음 → 탭을 닫으면 그때까지 기록은 남음

## 9. 새 세션에서 이어갈 때 쓸 첫 메시지 예시

> khi3628-dev/commute-coach 저장소의 HANDOFF.md를 먼저 읽고 이어서 작업해 줘. 오늘 할 일: (예) 회화 샘플 중 d3 러닝 주제를 내 생활에 맞게 고치기. 수정 후 `node build.mjs`, 테스트 두 개 통과 확인, main에 푸시까지.
