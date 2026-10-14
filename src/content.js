// Conversation samples: 17 topics x 6 question → answer pairs (102 items).
// The teacher asks `cue`; the learner answers with `en`. Each topic's answers read as one short story.
(function (root) {
  'use strict';

  // Illustrations generated with Higgsfield GPT Image 2.5 Flare (prompts: docs/image-prompts.md).
  // Loaded straight from Higgsfield's CDN; the app hides an image that fails to load.
  const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3JiWxjnuLk7mVdFFVIbN6vL8oAE/';
  const IMAGES = {
    icon: CDN + 'hf_20261014_104509_02ecce27-6fe5-4cf7-a160-ce0717b9b313.png',
    commute: CDN + 'hf_20261014_104507_de495c89-6716-448a-b2bb-faff9328aafe.png',
    lunch: CDN + 'hf_20261014_104508_303a1843-909a-4b92-93fc-f27568276cbd.png',
    gym: CDN + 'hf_20261014_104507_5bae09b5-0990-40b6-82fd-1473b07b2af8.png',
    run: CDN + 'hf_20261014_104509_b159217a-dc66-49d9-b6fc-ed4f3e148230.png',
    parents: CDN + 'hf_20261014_104508_b556dd57-1af4-4b0e-b002-ae16c66a8c1d.png',
    rest: CDN + 'hf_20261014_104509_249ec0c6-170f-41b7-a6d5-9252cd5840e0.png',
    office: CDN + 'hf_20261014_104509_2c5a2dfb-2c8a-4468-af38-8c0abba68478.png',
    reading: CDN + 'hf_20261014_104507_c2661495-10d3-4f7b-ba7b-105416edcc72.png',
    japan: CDN + 'hf_20261014_104508_3bec63e1-fa29-400b-95e7-5e2ed62aa200.png',
  };
  // Topic → illustration. Topics without their own picture borrow the closest one.
  const MODULE_IMAGE = { d1: 'lunch', d2: 'gym', d3: 'run', d4: 'parents', d5: 'rest', d6: 'rest', w1: 'office', w2: 'office', w3: 'office', w4: 'office', w5: 'office', w6: 'office', h1: 'reading', h2: 'reading', h3: 'reading', h4: 'japan', h5: 'japan' };
  // Core, extension and my own sentences are about the commute and the day around it.
  const imageFor = s => (s && s.module ? IMAGES[MODULE_IMAGE[s.module]] : IMAGES.commute);

  // [question, answer, Korean meaning, key point]
  const MODULES = [
    // ---------- 일상 생활 ----------
    { id: 'd1', topic: 'daily', title: 'Lunch with a friend', titleKo: '친구와 점심', items: [
      ['What did you do at lunch?', 'I met up with a friend for lunch.', '점심에 친구 만났어.', '구동사 · met up with'],
      ['Where did you go?', 'We went to a new ramen place near my office.', '사무실 근처에 새로 생긴 라멘집에 갔어.', 'near + 장소'],
      ['How was the food?', 'It was really good, but the line was long.', '정말 맛있었는데 줄이 길었어.', 'but · 대조'],
      ['What did you talk about?', 'We talked about work and our weekend plans.', '일 얘기랑 주말 계획 얘기했어.', 'talk about'],
      ['Did you get coffee after that?', 'Yeah, we grabbed a coffee before heading back.', '응, 돌아가기 전에 커피 한 잔 했어.', 'before + -ing'],
      ['When are you meeting again?', "We're meeting up again next month.", '다음 달에 또 만나기로 했어.', '현재진행 · 정해진 계획'],
    ] },
    { id: 'd2', topic: 'daily', title: 'After work', titleKo: '퇴근 후', items: [
      ['What do you usually do after work?', 'I usually go to the gym after work.', '퇴근하면 보통 헬스장에 가.', '빈도부사 · usually'],
      ['How long do you work out?', 'I work out for about an hour.', '한 시간 정도 운동해.', 'for + 기간'],
      ['What kind of workout do you do?', 'I do some weights and then run a little.', '웨이트 좀 하고 조금 뛰어.', 'and then · 순서'],
      ['What do you do after that?', 'After that, I head home and take a shower.', '그다음엔 집에 가서 샤워해.', 'After that'],
      ['What do you have for dinner?', 'I usually have something light for dinner.', '저녁은 보통 가볍게 먹어.', 'something + 형용사'],
      ['How do you relax at night?', 'I watch something on YouTube and go to bed early.', '유튜브 좀 보다가 일찍 자.', '동작 연결 · and'],
    ] },
    { id: 'd3', topic: 'daily', title: 'Running', titleKo: '러닝', items: [
      ['Do you run?', 'Yeah, I go running two or three times a week.', '응, 일주일에 두세 번 달리기해.', 'go running · 빈도'],
      ['Where do you run?', 'I usually run along the river near my place.', '보통 집 근처 강을 따라 뛰어.', 'along + 장소'],
      ['How far do you run?', 'I run about five kilometers.', '5킬로미터 정도 뛰어.', 'about + 거리'],
      ['How do you feel after a run?', 'I feel tired, but my head feels clear.', '피곤하지만 머리가 맑아져.', 'feel + 형용사'],
      ['Did anything happen last time?', 'My leg cramped up near the end.', '지난번엔 끝날 무렵 다리에 쥐가 났어.', '구동사 · cramp up'],
      ['What did you do?', 'I stopped, stretched, and walked the rest of the way.', '멈춰서 스트레칭하고 나머지는 걸었어.', '과거 동사 나열'],
    ] },
    { id: 'd4', topic: 'daily', title: 'Visiting my parents', titleKo: '부모님 방문', items: [
      ['What are you doing this weekend?', "I'm visiting my parents this weekend.", '이번 주말에 부모님 댁에 가.', 'visit · meet와 차이'],
      ['Where do they live?', 'They live about an hour away by car.', '차로 한 시간 정도 거리에 사셔.', 'away · by car'],
      ['How often do you see them?', 'I try to see them once a month.', '한 달에 한 번은 찾아뵈려고 해.', 'try to · once a month'],
      ['What do you usually do there?', 'We have dinner together and just talk.', '같이 저녁 먹고 그냥 이야기해.', 'together'],
      ['How are they doing?', "They're doing well, but my dad's knee hurts a bit.", '잘 지내시는데 아빠 무릎이 좀 아프셔.', 'doing well · but'],
      ['What will you bring?', "I'll bring some fruit and a cake.", '과일이랑 케이크 사 갈 거야.', 'will · 계획'],
    ] },
    { id: 'd5', topic: 'daily', title: 'Rest and sleep', titleKo: '휴식과 잠', items: [
      ['How do you deal with stress?', 'I meditate to relax my mind.', '마음을 편하게 하려고 명상해.', '목적의 to'],
      ['When do you meditate?', 'I meditate for ten minutes before bed.', '자기 전에 10분 명상해.', 'before bed'],
      ['Does it help?', 'Yeah, it really helps me sleep better.', '응, 잠을 더 잘 자게 도와줘.', 'help + 사람 + 동사'],
      ['Did you sleep well last night?', 'Not really. I woke up a few times.', '별로. 몇 번 깼어.', 'Not really · woke up'],
      ['How do you feel today?', "I'm a little tired, but I'm okay.", '좀 피곤한데 괜찮아.', 'a little'],
      ['Do you have any energy left?', "I don't have much left in the tank today.", '오늘은 기운이 별로 안 남았어.', 'left in the tank'],
    ] },
    { id: 'd6', topic: 'daily', title: 'The weekend', titleKo: '주말', items: [
      ['How was your weekend?', 'It was nice and relaxing.', '좋고 여유로웠어.', 'nice and + 형용사'],
      ['What did you do on Saturday?', 'I slept in and cleaned my apartment.', '늦잠 자고 집 청소했어.', '구동사 · sleep in'],
      ['What about Sunday?', 'I met up with some friends for brunch.', '친구들이랑 브런치 먹었어.', 'met up with'],
      ['Did you go anywhere after that?', 'We walked around the park for a while.', '공원을 한동안 걸었어.', 'walk around · for a while'],
      ['Did you do anything for yourself?', 'I read a few chapters of a book.', '책 몇 장 읽었어.', 'a few'],
      ['Are you ready for Monday?', "Not really, but I'm ready to get going.", '별로지만 시작할 준비는 됐어.', 'ready to'],
    ] },

    // ---------- 직장 생활 ----------
    { id: 'w1', topic: 'work', title: 'Morning priorities', titleKo: '아침 우선순위', items: [
      ["What's the first thing you do at work?", 'I check my email and my calendar.', '이메일이랑 일정부터 확인해.', 'and · 연결'],
      ['Is anything urgent today?', 'Yeah, a client needs an answer by noon.', '응, 고객사가 정오까지 답을 달래.', 'by + 시간'],
      ['What will you do first?', "I'll handle that first and then work on my report.", '그거 먼저 처리하고 보고서 할 거야.', 'handle · and then'],
      ['How do you share priorities?', 'I message my team about the priorities.', '팀에 우선순위를 메시지로 알려.', 'message ~ about'],
      ["What's your main task this week?", 'My main task is finishing the monthly report.', '이번 주 주요 업무는 월간 보고서 마무리야.', '동명사 · -ing'],
      ['Do you have any meetings today?', 'I have two meetings this afternoon.', '오후에 회의가 두 개 있어.', 'this afternoon'],
    ] },
    { id: 'w2', topic: 'work', title: 'Asking for help', titleKo: '도움 요청', items: [
      ['Do you need help with anything?', 'Yes, could you take a look at this file?', '응, 이 파일 좀 봐줄 수 있어?', '부탁 · could you'],
      ["What's the problem?", "Some of the numbers don't match.", '숫자 몇 개가 안 맞아.', "don't match"],
      ['When do you need it?', 'I need it by the end of the day.', '오늘 퇴근 전까지 필요해.', 'by the end of the day'],
      ['Can it wait until tomorrow?', "I'm afraid not. It's for a client meeting.", '아쉽지만 안 돼. 고객 미팅용이야.', "I'm afraid not"],
      ['Is there anything else I can do?', 'Could you also send me the latest version?', '최신 버전도 보내줄래?', 'also · latest'],
      ["Okay, I'll do it right now.", 'Thanks, I really appreciate it.', '고마워, 정말 고마워.', 'appreciate'],
    ] },
    { id: 'w3', topic: 'work', title: 'Schedules and deadlines', titleKo: '일정과 마감', items: [
      ['When is the deadline?', 'The deadline is next Friday.', '마감은 다음 주 금요일이야.', 'next + 요일'],
      ['Are we on schedule?', "We're a little behind schedule.", '일정보다 조금 늦어.', 'behind schedule'],
      ['Why is it delayed?', "We're still waiting on some data from another team.", '다른 팀 데이터를 아직 기다리고 있어.', 'wait on'],
      ['Can we still make it?', 'I think so, if we get the data by Wednesday.', '수요일까지 데이터 받으면 될 것 같아.', 'if · 조건'],
      ['Should we move the meeting?', "Let's push the meeting to Thursday.", '회의를 목요일로 미루자.', 'push A to B'],
      ['Who will tell the client?', "I'll let the client know this afternoon.", '오늘 오후에 고객사에 알릴게.', 'let ~ know'],
    ] },
    { id: 'w4', topic: 'work', title: 'After a meeting', titleKo: '회의 후', items: [
      ['How did the meeting go?', 'It went well, but it ran a little long.', '잘 끝났는데 좀 길어졌어.', 'go well · run long'],
      ['What did you decide?', 'We decided to start the project next month.', '다음 달에 프로젝트를 시작하기로 했어.', 'decide to'],
      ['Did anyone disagree?', 'One person had some concerns about the budget.', '한 명이 예산에 대해 우려가 좀 있었어.', 'concerns about'],
      ['What happens next?', "I'll send a summary to everyone.", '모두에게 요약을 보낼 거야.', 'send A to B'],
      ['Do you have to present?', "Yes, I'm presenting the plan next week.", '응, 다음 주에 계획을 발표해.', '현재진행 · 정해진 계획'],
      ['Are you ready?', 'Almost. I just need to finish the slides.', '거의. 슬라이드만 마무리하면 돼.', 'just need to'],
    ] },
    { id: 'w5', topic: 'work', title: 'Project update', titleKo: '진행 현황', items: [
      ["How's the project going?", "It's going well so far.", '지금까지 잘 되고 있어.', 'so far'],
      ['How much is done?', "We're about halfway done.", '절반 정도 했어.', 'halfway done'],
      ['Any problems?', 'We had a small issue, but we fixed it.', '작은 문제가 있었는데 해결했어.', '과거시제 · but'],
      ["What's left?", 'We still need to test everything.', '아직 전체 테스트가 남았어.', 'still need to'],
      ['When will it be finished?', 'It should be finished by the end of the month.', '이번 달 말까지는 끝날 거야.', 'should be'],
      ['Do you need anything from me?', 'Just your feedback on the draft.', '초안에 대한 피드백만 주면 돼.', 'feedback on'],
    ] },
    { id: 'w6', topic: 'work', title: 'End of the day', titleKo: '퇴근길', items: [
      ['Are you heading out?', "Yeah, I'm heading home now.", '응, 이제 집에 가.', 'heading home'],
      ['How was your day?', 'It was busy, but I got a lot done.', '바빴는데 일을 많이 끝냈어.', 'get a lot done'],
      ['Did you finish everything?', "Almost. I'll finish the rest tomorrow.", '거의. 나머지는 내일 할게.', 'the rest'],
      ['Are you tired?', "I'm pretty tired, to be honest.", '솔직히 꽤 피곤해.', 'to be honest'],
      ['Any plans tonight?', "I'm just going to relax at home.", '그냥 집에서 쉴 거야.', 'be going to'],
      ['See you tomorrow.', 'See you tomorrow. Have a good night.', '내일 봐. 좋은 밤 보내.', 'Have a good ~'],
    ] },

    // ---------- 취미·여행 ----------
    { id: 'h1', topic: 'hobby', title: 'AI and me', titleKo: 'AI와 나', items: [
      ['What are you interested in these days?', "I'm really into AI these days.", '요즘 AI에 푹 빠져 있어.', 'be into'],
      ['How do you use it?', 'I use it for work and to study English.', '일할 때랑 영어 공부할 때 써.', 'for + 명사 · to + 동사'],
      ['What do you like about it?', 'It saves me a lot of time.', '시간을 많이 아껴줘.', 'save + 사람 + 시간'],
      ['Do you have any worries?', 'Sometimes I worry about relying on it too much.', '가끔 너무 의존할까 봐 걱정돼.', 'worry about + -ing'],
      ['Do you read about it?', "Yeah, I'm reading a book about AI right now.", '응, 지금 AI에 관한 책 읽고 있어.', 'right now'],
      ['What book is it?', "It's Nexus by Yuval Noah Harari.", '유발 하라리의 넥서스야.', 'by + 저자'],
    ] },
    { id: 'h2', topic: 'hobby', title: 'Reading', titleKo: '독서', items: [
      ['Do you like reading?', 'Yes, I try to read a little every day.', '응, 매일 조금씩 읽으려고 해.', 'try to'],
      ['When do you read?', 'I usually read on the subway or before bed.', '보통 지하철에서나 자기 전에 읽어.', 'or · 장소와 시간'],
      ['What kind of books do you like?', 'I like books about history and big ideas.', '역사나 큰 생각을 다룬 책을 좋아해.', 'kind of'],
      ["What's your book about?", "It's about how information shapes society.", '정보가 사회를 어떻게 만드는지에 관한 책이야.', 'how · 명사절'],
      ['Would you recommend it?', "Yes, but it's a little hard to read.", '응, 근데 좀 읽기 어려워.', 'hard to read'],
      ['What are you going to read next?', "I haven't decided yet.", '아직 못 정했어.', "haven't + p.p. yet"],
    ] },
    { id: 'h3', topic: 'hobby', title: 'Free time', titleKo: '여가 시간', items: [
      ['What do you do in your free time?', 'I like running and reading.', '달리기랑 독서를 좋아해.', 'like + -ing'],
      ['How did you start running?', 'A friend got me into it a few years ago.', '몇 년 전에 친구 덕분에 시작했어.', 'get someone into'],
      ['Do you have any new hobbies?', "I've started learning English again.", '영어 공부를 다시 시작했어.', 'have started'],
      ['Why English?', 'I want to speak more naturally at work.', '회사에서 더 자연스럽게 말하고 싶어.', '부사 · naturally'],
      ['How do you practice?', 'I practice speaking in my car every morning.', '매일 아침 차에서 말하기 연습해.', 'practice + -ing'],
      ['Is it working?', "I think so. It's getting easier.", '그런 것 같아. 점점 쉬워지고 있어.', 'get + 비교급'],
    ] },
    { id: 'h4', topic: 'travel', title: 'My trip to Japan', titleKo: '교토·오사카 여행', items: [
      ['Where did you travel recently?', 'I went to Kyoto and Osaka in Japan.', '일본 교토랑 오사카에 다녀왔어.', 'went to'],
      ['How long were you there?', 'I was there for five days.', '5일 있었어.', 'for + 기간'],
      ['What did you do in Kyoto?', 'I visited old temples and walked a lot.', '오래된 절들을 둘러보고 많이 걸었어.', 'visit · walk a lot'],
      ['What about Osaka?', 'In Osaka, I mostly ate street food.', '오사카에서는 주로 길거리 음식을 먹었어.', 'mostly'],
      ['What was your favorite part?', 'I loved the mix of old and new Japan.', '옛 일본과 새 일본이 섞인 게 좋았어.', 'the mix of'],
      ['Would you go back?', "Definitely. I'd love to go back in the fall.", '당연하지. 가을에 다시 가고 싶어.', "I'd love to"],
    ] },
    { id: 'h5', topic: 'travel', title: 'Planning a trip', titleKo: '여행 계획', items: [
      ['Do you have any travel plans?', "I'm thinking about a trip next spring.", '내년 봄에 여행 갈까 생각 중이야.', 'think about'],
      ['Where do you want to go?', 'Maybe somewhere warm, like Vietnam.', '아마 베트남처럼 따뜻한 곳.', 'like + 예시'],
      ['Who are you going with?', "I'll probably go with my family.", '아마 가족이랑 갈 거야.', 'probably'],
      ['How will you get around?', "We'll fly there and then rent a car.", '비행기로 가서 차를 빌릴 거야.', 'and then'],
      ['What do you want to do there?', 'I just want to rest and eat good food.', '그냥 쉬고 맛있는 거 먹고 싶어.', 'just want to'],
      ['Have you booked anything?', "Not yet. I'm still looking at flights.", '아직. 항공편 보는 중이야.', 'not yet · still'],
    ] },
  ];

  const CONVERSATIONS = [];
  MODULES.forEach((m, mi) => m.items.forEach(([cue, en, ko, grammar], i) => {
    CONVERSATIONS.push({ id: `${m.id}-${i + 1}`, type: 'conv', module: m.id, moduleTitle: m.title, moduleTitleKo: m.titleKo, topic: m.topic, order: mi * 10 + i, cue, en, ko, grammar, variants: [] });
  }));

  const api = { MODULES, CONVERSATIONS, IMAGES, imageFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
