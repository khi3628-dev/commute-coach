// Builds two outputs from src/: an artifact page (body only) and a standalone page for HTTPS hosting.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const core = readFileSync('src/content.js', 'utf8') + '\n' + readFileSync('src/core.js', 'utf8');
const inject = f => readFileSync(f, 'utf8').replace('/*@@CORE@@*/', () => core);
const app = inject('src/app.html');
const talk = inject('src/talk.html'); // Commute Talk: the conversation version, same storage
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', app);
const wrap = (body, title, desc) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src https://api.anthropic.com https://generativelanguage.googleapis.com; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="referrer" content="no-referrer">
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="https://khi3628-dev.github.io/commute-coach/img/commute.jpg">
<meta property="og:type" content="website">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${title}">
<meta name="theme-color" content="${title === 'Commute Talk' ? '#1d4ed8' : '#0b6b4c'}">
<link rel="apple-touch-icon" href="img/icon.png">
<link rel="icon" type="image/png" href="img/icon.png">
<style>*,*::before,*::after{box-sizing:border-box}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head><body>
${body}
</body></html>
`;
const page = wrap(app, 'Commute Coach', '운전하며 말로만 연습하는 미국 영어 회화 코치. 내 일상 문장을 간격 반복으로 복습하고, 틀린 부분을 짧게 교정합니다.');
const talkPage = wrap(talk, 'Commute Talk', '출퇴근길에 AI와 말로만 나누는 영어 대화. 더 자연스러운 한 문장을 돌려받아 따라 말하고, 그 문장이 복습에 들어갑니다.');
writeFileSync('dist/index.html', page);
writeFileSync('index.html', page); // served by GitHub Pages from the repo root
writeFileSync('dist/talk.html', talkPage);
writeFileSync('talk.html', talkPage);
console.log('built index.html, talk.html and dist/');
