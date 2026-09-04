// 「相互に影響し合ったジャンル」の図を撮る（2026-09-05）。
// Jazz は Blues と相互影響の関係を持つ（jazz→blues と blues→jazz の
// 両方がLINKSにある）ため、Jazzのままで撮れる。
const 設定 = require('./設定');
const { chromium } = require('playwright');
const path = require('path');
const URL = 設定.地図;
const 出力 = 設定.出力先;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await p.route('**://*.doubleclick.net/**', r => r.abort());
  await p.route('**://*.googlesyndication.com/**', r => r.abort());
  await p.route('**://*.googleadservices.com/**', r => r.abort());
  await p.route('**://*.google.com/pagead/**', r => r.abort());
  await p.route('**://*.youtube.com/api/stats/ads**', r => r.abort());
  await p.route('**://*.youtube.com/pagead/**', r => r.abort());
  await p.route('**://*.youtube.com/ptracking**', r => r.abort());
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(6000);
  await p.evaluate(() => {
    const n = [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === 'jazz');
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(12000);

  const 狙う位置 = 170;
  const targetSelector = '#sp-mutual-sec h4';
  await p.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'start' });
  }, targetSelector);
  await p.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    const top = await p.evaluate((sel) => document.querySelector(sel)?.getBoundingClientRect().top, targetSelector);
    if (top == null) { console.log('  ★ 見つからず:', targetSelector); await b.close(); return; }
    const ズレ = top - 狙う位置;
    if (Math.abs(ズレ) < 2) break;
    await p.evaluate((d) => { document.getElementById('side-panel').scrollTop += d; }, ズレ);
    await p.waitForTimeout(200);
  }
  const finalTop = await p.evaluate((sel) => document.querySelector(sel)?.getBoundingClientRect().top, targetSelector);
  const mutualText = await p.evaluate(() => document.getElementById('sp-mutual')?.innerText.slice(0, 200));
  console.log('見出しの位置 top=' + finalTop + 'px　中身:', mutualText);
  await p.screenshot({ path: path.join(出力, 'pnl4b_mutual.png') });
  console.log('→ pnl4b_mutual.png');

  await p.close();
  await b.close();
})();
