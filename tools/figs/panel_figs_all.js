// 説明パネルの図（pnl1_top〜pnl5_correction の8枚）を、1回でまとめて撮る（2026-11-03 新設）。
//
// それまでは panel_detail_figs.js / 2 / 3 / panel_gloss_only.js / panel_mutual_fig.js に分かれていて、
// 撮ったあと crop_panel_figs.py が「固定の座標」でパネルを切り出していた。説明文を書き直して長さが
// 変わると、固定の座標では見出しが切れたり、別の場所が写ったりする。
// ここでは、パネル（#side-panel）の実際の位置をその場で測り、パネルの部分だけを撮る（clip）。
// 書き出しは _out_panel/ に置き（jpgにする.py が _out/ を全部処理する事故を避けるため）、
// 最後に panel_figs_all.py が横幅320pxの JPG にして docs/img を差し替える。
//
//   node tools/figs/panel_figs_all.js && py tools/figs/panel_figs_all.py
//
// pnl7_amazon（Amazonの商品ページ）は外のサイトの画面なので、ここでは撮らない。
const 設定 = require('./設定');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const 出力 = path.join(__dirname, '_out_panel');
fs.mkdirSync(出力, { recursive: true });

// [名前, 見出しのセレクタ（null=いちばん上）, 撮る高さ（CSS px、パネル幅320pxのときの高さ）, 見出しを置く位置]
const 図 = [
  ['pnl1_top', null, 460],
  ['pnl2a_desc', '#sp-desc-sec h4', 310],
  ['pnl3a_roots', '#sp-roots-story-sec h4', 450],
  ['pnl3b_books', '#sp-books-wrap .sp-books-title', 450],
  ['pnl4_influence', '#sp-in-sec h4', 775],
  ['pnl4b_mutual', '#sp-mutual-sec h4', 450],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  for (const pat of ['**://*.doubleclick.net/**', '**://*.googlesyndication.com/**', '**://*.googleadservices.com/**',
                     '**://*.google.com/pagead/**', '**://*.youtube.com/api/stats/ads**', '**://*.youtube.com/pagead/**',
                     '**://*.youtube.com/ptracking**']) await p.route(pat, r => r.abort());
  await p.goto(設定.地図, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(6000);
  await p.evaluate(() => {
    const n = [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === 'jazz');
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(12000);

  const 枠 = await p.evaluate(() => {
    const r = document.getElementById('side-panel').getBoundingClientRect();
    const h = document.getElementById('sp-header').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, 帯の下: h.bottom };
  });
  console.log('パネルの位置', JSON.stringify(枠));
  const 倍 = 枠.w / 320;   // パネル幅が320pxでないときは、高さも同じ割合で広げる

  const 見出しへ = async (sel) => {
    const 狙い = 枠.帯の下 + 12;    // 固定の帯（ジャンル名）のすぐ下に見出しを置く
    for (let i = 0; i < 4; i++) {
      const top = await p.evaluate(s => document.querySelector(s)?.getBoundingClientRect().top, sel);
      if (top == null) throw new Error('見つからない: ' + sel);
      const ズレ = top - 狙い;
      if (Math.abs(ズレ) < 2) break;
      await p.evaluate(d => { document.getElementById('side-panel').scrollTop += d; }, ズレ);
      await p.waitForTimeout(300);
    }
  };
  const 撮る = async (名前, 高さ) => {
    await p.screenshot({ path: path.join(出力, 名前 + '.png'),
      clip: { x: 枠.x, y: 枠.y, width: 枠.w, height: Math.min(高さ * 倍, 枠.h) } });
    console.log('撮った:', 名前);
  };

  for (const [名前, sel, 高さ] of 図) {
    if (sel) await 見出しへ(sel); else await p.evaluate(() => { document.getElementById('side-panel').scrollTop = 0; });
    await p.waitForTimeout(800);
    await 撮る(名前, 高さ);
  }

  // 用語のふきだし：音楽性・特徴の見出しを上に置き、本文の中の見えている用語を1つ押して開く
  await 見出しへ('#sp-desc-sec h4');
  // ふきだしが固定の帯に隠れないよう、見出しから少し下（帯の下から90〜220px）にある用語を選ぶ。
  // 押すと開く（クリックで固定表示）が、押しただけで開かないこともあるので、マウスも重ねる。
  const 用語 = await p.evaluate((下限) => {
    const ts = [...document.querySelectorAll('#sp-desc .gloss-term')];
    const t = ts[0];
    if (!t) return { 数: 0 };
    // 最初の用語が、帯の下から140pxのところに来るように動かす（ふきだしが撮る範囲に収まるように）
    document.getElementById('side-panel').scrollTop += t.getBoundingClientRect().top - (下限 + 140);
    const r = t.getBoundingClientRect();
    return { 字: t.firstChild.textContent, x: r.left + 4, y: r.top + r.height / 2 };
  }, 枠.帯の下);
  if (用語.字) { await p.mouse.move(用語.x, 用語.y); await p.mouse.click(用語.x, 用語.y); }
  console.log('ふきだしを開いた用語:', 用語);
  await p.waitForTimeout(600);
  await 撮る('pnl2b_gloss', 310);

  // いちばん下の「修正更新」のボタン
  await p.evaluate(() => { const e = document.getElementById('side-panel'); e.scrollTop = e.scrollHeight; });
  await p.waitForTimeout(800);
  const ボタン = await p.evaluate(() => {
    const r = document.getElementById('sp-correction-btn').getBoundingClientRect();
    return { y: r.top, h: r.height };
  });
  await p.screenshot({ path: path.join(出力, 'pnl5_correction.png'),
    clip: { x: 枠.x, y: ボタン.y - 6, width: 枠.w, height: ボタン.h + 12 } });
  console.log('撮った: pnl5_correction');
  await b.close();
})();
