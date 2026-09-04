// パネル詳細図の3回目の撮り直し（2026-09-05）。
// 前回は scrollIntoView() で大まかにスクロールしていたため、パネル上部の
// 固定ヘッダー（#sp-header、position:sticky、高さ約125px）に見出しが
// 隠れることがあった。今回は各見出しの offsetTop を実測し、
// side-panel.scrollTop を直接、見出しがヘッダーの下に十分な余白を
// 持って収まる位置に設定してから撮る。
//
// ・成り立ち／関連する書籍は、チョロさんの指示で2枚に分ける
//   （1枚だと「成り立ち」の見出しごと関連書籍まで詰め込めないため）
// ・影響を受けた／影響を与えたジャンルは、両方の見出しが306px差で
//   近いので1枚に収める
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

  const 狙う位置 = 170; // ヘッダーの下、この画面上のy座標(CSS px)に見出しの上端を持ってくる

  const スクロールして撮る = async (name, targetSelector) => {
    // 1回目：ざっくり scrollIntoView で近づける
    await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: 'start' });
    }, targetSelector);
    await p.waitForTimeout(300);
    // 2回目：実際に描画された位置を測り、狙う位置とのズレをscrollTopで補正する
    // （offsetTopだけを頼りに計算すると、offsetParentのズレで誤差が出た）
    for (let i = 0; i < 3; i++) {
      const top = await p.evaluate((sel) => document.querySelector(sel)?.getBoundingClientRect().top, targetSelector);
      if (top == null) { console.log('  ★ 見つからず:', targetSelector); return; }
      const ズレ = top - 狙う位置;
      if (Math.abs(ズレ) < 2) break;
      await p.evaluate((d) => { document.getElementById('side-panel').scrollTop += d; }, ズレ);
      await p.waitForTimeout(200);
    }
    const finalTop = await p.evaluate((sel) => document.querySelector(sel)?.getBoundingClientRect().top, targetSelector);
    await p.screenshot({ path: path.join(出力, name + '.png') });
    console.log('→ ' + name + '.png （見出しの実際の位置 top=' + finalTop + 'px、狙いは' + 狙う位置 + 'px）');
  };

  // ⑧-a 成り立ち（見出し＋本文）
  await スクロールして撮る('pnl3a_roots', '#sp-roots-story-sec h4');

  // ⑧-b 関連する書籍（見出し＋表紙）
  await スクロールして撮る('pnl3b_books', '#sp-books-wrap .sp-books-title');

  // ⑨ 影響を受けた／与えたジャンル（両方の見出しが入るように）
  await スクロールして撮る('pnl4_influence', '#sp-in-sec h4');

  await p.close();
  await b.close();
})();
