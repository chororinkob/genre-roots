const 設定 = require('./設定');
// パソコン版ヘルプの残りの図（ジャンル追加申請・修正依頼）
const { chromium } = require('playwright');
const { 仕込む } = require('./chuu.js');
const 元 = 設定.地図;

const 位置 = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           中x: Math.round(r.left + r.width / 2), 中y: Math.round(r.top + r.height / 2) }; }, sel);

async function 開く(b) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route('**youtube.com/**', r => r.abort());
  await p.goto(元, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(13000);
  await p.evaluate(() => { twinkleActive = false; });
  await p.waitForTimeout(6000);
  await 仕込む(p);
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();

  // ── ジャンル追加申請 ──
  { const { ctx, p } = await 開く(b);
    await p.evaluate(() => openGenreRequest('Arena Rock'));
    await p.waitForTimeout(1200);
    const 名 = await 位置(p, '#gr-name');
    const メモ = await 位置(p, '#gr-note');
    const 申請 = await 位置(p, '#gr-submit');
    const 台 = await 位置(p, '#genre-request-card');
    await p.evaluate(([名, メモ, 申請, 台]) => {
      const 注 = window.__注;
      注.枠(名, 4); 注.枠(申請, 4);
      注.札と矢(名.x - 290, 名.中y - 16, '載っていないジャンルの名前を入れる',
        { x: 名.x - 8, y: 名.中y }, { 出口: '右', 字: 13, 幅: 260 });
      if (メモ) 注.札と矢(メモ.x + メモ.w + 36, メモ.y + 8,
        '分かれば、代表アーティストや時代も（任意）',
        { x: メモ.x + メモ.w + 8, y: メモ.y + 20 }, { 出口: '左', 字: 13, 幅: 230 });
      注.札と矢(申請.x + 申請.w + 36, 申請.中y - 34,
        '押すとAIが実在を確かめ、情報を作る。1〜2分かかる',
        { x: 申請.x + 申請.w + 8, y: 申請.中y }, { 出口: '左', 字: 13, 幅: 240 });
    }, [名, メモ, 申請, 台]);
    await p.screenshot({ path: 設定.出力先 + '/pcadd1.png',
      clip: { x: Math.max(0, 台.x - 310), y: Math.max(0, 台.y - 14),
              width: Math.min(1400 - Math.max(0, 台.x - 310), 台.w + 620), height: 台.h + 28 } });
    console.log('  撮った: 申請');
    await ctx.close(); }

  // ── 修正依頼 ──
  { const { ctx, p } = await 開く(b);
    await p.evaluate(() => { [...document.querySelectorAll('.node')]
      .find(e => (e.__data__ || {}).id === 'jazz')
      .dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await p.waitForTimeout(5200);
    // 説明の下のほうにある「修正依頼」まで送る
    await p.evaluate(() => {
      const b = document.getElementById('sp-correction-btn');
      if (b) b.scrollIntoView({ block: 'center' });
    });
    await p.waitForTimeout(800);
    const ボタン = await 位置(p, '#sp-correction-btn');
    await 仕込む(p);
    await p.evaluate(ボタン => {
      const 注 = window.__注;
      注.枠(ボタン, 5);
      注.札と矢(ボタン.x - 300, ボタン.中y - 16,
        '説明のいちばん下にある。押すと書く欄が開く',
        { x: ボタン.x - 8, y: ボタン.中y }, { 出口: '右', 字: 13, 幅: 270 });
    }, ボタン);
    await p.screenshot({ path: 設定.出力先 + '/pcfix1.png',
      clip: { x: Math.max(0, ボタン.x - 320), y: Math.max(0, ボタン.y - 60),
              width: Math.min(1400 - Math.max(0, ボタン.x - 320), ボタン.w + 340), height: 170 } });

    // 開いたところ
    await p.evaluate(() => { const l = document.getElementById('__chuu'); if (l) l.remove();
                             delete window.__注; });
    await p.evaluate(() => document.getElementById('sp-correction-btn').click());
    await p.waitForTimeout(1000);
    await p.evaluate(() => document.getElementById('sp-correction-text')
      .scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(600);
    await 仕込む(p);
    const 欄 = await 位置(p, '#sp-correction-text');
    const 送信 = await 位置(p, '#sp-correction-send');
    await p.evaluate(([欄, 送信]) => {
      const 注 = window.__注;
      注.枠(欄, 4); 注.枠(送信, 4);
      注.札と矢(欄.x - 300, 欄.y + 4, 'どこが違うと思ったかを書く',
        { x: 欄.x - 8, y: 欄.中y }, { 出口: '右', 字: 13, 幅: 270 });
      注.札と矢(送信.x - 300, 送信.中y - 16, '送ると、AIが調べて結果がここに出る',
        { x: 送信.x - 8, y: 送信.中y }, { 出口: '右', 字: 13, 幅: 270 });
    }, [欄, 送信]);
    await p.screenshot({ path: 設定.出力先 + '/pcfix2.png',
      clip: { x: Math.max(0, 欄.x - 320), y: Math.max(0, 欄.y - 70),
              width: Math.min(1400 - Math.max(0, 欄.x - 320), 欄.w + 340),
              height: (送信.y + 送信.h) - (欄.y - 70) + 24 } });
    console.log('  撮った: 修正依頼');
    await ctx.close(); }

  await b.close();
})();
