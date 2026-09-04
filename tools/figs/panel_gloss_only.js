// 用語のふきだしだけを、スクロールせずに（＝パネル上部のヘッダーとの
// 重なりを避けて）撮り直す。
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

  // スクロールしない。画面内に見えている用語のうち、
  // 音楽性・特徴の本文の中にあるものだけをクリックする
  const info = await p.evaluate(() => {
    const panel = document.getElementById('sp-desc');
    if (!panel) return null;
    const terms = [...panel.querySelectorAll('.gloss-term')];
    const vis = terms.filter(t => {
      const r = t.getBoundingClientRect();
      return r.top > 0 && r.bottom < 900 && r.left > 0;
    });
    if (!vis.length) return { found: false, count: terms.length };
    vis[0].click();
    return { found: true, text: vis[0].textContent };
  });
  console.log('クリックした用語:', JSON.stringify(info));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(出力, 'pnl2b_gloss.png') });
  console.log('→ pnl2b_gloss.png');

  await p.close();
  await b.close();
})();
