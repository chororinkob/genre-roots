// パネル詳細図の追加分（2026-09-05）。
// ・音楽性・特徴を「本文だけ」と「用語のふきだし」の2枚に分ける
//   （前回は1枚にふきだしを乗せてしまい、本文の説明が無いのに
//   いきなり用語の話が始まって見えると指摘された）
// ・ふきだしがJazzの見出しに重ならない位置で撮り直す
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

  // ① 音楽性・特徴：見出し＋本文だけ（ふきだし無し）。
  // 見出しがパネル上端の帯に隠れないよう、少し余分にスクロールする。
  await p.evaluate(() => {
    const el = document.getElementById('sp-desc-sec');
    if (el) el.scrollIntoView({ block: 'start' });
    document.getElementById('side-panel').scrollBy(0, -14);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(出力, 'pnl2a_desc.png') });
  console.log('→ pnl2a_desc.png（音楽性・特徴、本文のみ）');

  // ② 用語のふきだし：本文の少し下にある用語をクリックして固定表示。
  // タイトル帯に重ならないよう、ふきだしが出る用語をもう少し下にスクロールしてから開く。
  await p.evaluate(() => {
    document.getElementById('side-panel').scrollBy(0, 90);
  });
  await p.waitForTimeout(400);
  const glossOk = await p.evaluate(() => {
    const panel = document.getElementById('sp-desc');
    if (!panel) return false;
    const terms = [...panel.querySelectorAll('.gloss-term')];
    // 画面のいちばん上に近すぎない（見出しと重ならない）用語を選ぶ
    const target = terms.find(t => t.getBoundingClientRect().top > 260) || terms[0];
    if (!target) return false;
    target.click();
    return true;
  });
  await p.waitForTimeout(400);
  console.log('用語のふきだし表示:', glossOk);
  await p.screenshot({ path: path.join(出力, 'pnl2b_gloss.png') });
  console.log('→ pnl2b_gloss.png（用語のふきだし）');

  await p.close();
  await b.close();
})();
