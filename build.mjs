// Builds two outputs from src/: an artifact page (body only) and a standalone page for HTTPS hosting.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const core = readFileSync('src/core.js', 'utf8');
const app = readFileSync('src/app.html', 'utf8').replace('/*@@CORE@@*/', () => core);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', app);
const page = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Commute Coach">
<meta name="theme-color" content="#0b6b4c">
<style>*,*::before,*::after{box-sizing:border-box}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head><body>
${app}
</body></html>
`;
writeFileSync('dist/index.html', page);
writeFileSync('index.html', page); // served by GitHub Pages from the repo root
console.log('built dist/artifact.html and dist/index.html');
