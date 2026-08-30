const 設定 = require('./設定');
// 申請の確認画面（承認画面）の図を撮る。
const { chromium } = require('playwright');
const { 仕込む } = require('./chuu.js');
const URL0 = 'https://genre-roots-server.onrender.com/admin/preview/R1d93-_Ez8m2XT-GMeFUmCO19C1LtS_1';

const 見出しの位置 = (p, 字) => p.evaluate(t => {
  const e = [...document.querySelectorAll('h1,h2,summary')]
    .find(x => (x.innerText || '').includes(t));
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY),
           w: Math.round(r.width), h: Math.round(r.height) };
}, 字);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route('**youtube.com/**', r => r.abort());
  await p.goto(URL0, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(4000);

  // ① 画面の上のほう（申請の内容・AIの記録・3つのボタン）
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  await 仕込む(p);
  const ボタン = await p.evaluate(() => {
    const b = [...document.querySelectorAll('button,a.btn,.btn')]
      .filter(e => /承認|却下|修正依頼/.test(e.innerText || ''));
    if (!b.length) return null;
    const 箱 = e => { const r = e.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
               中x: Math.round(r.left + r.width/2), 中y: Math.round(r.top + r.height/2),
               字: (e.innerText||'').replace(/\s+/g,'').slice(0,12) }; };
    return b.map(箱);
  });
  const ログ = await p.evaluate(() => {
    const e = [...document.querySelectorAll('h2')].find(x => (x.innerText||'').includes('AI 処理ログ'));
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left) - 4, y: Math.round(r.top) - 4,
             w: Math.round(r.width) + 8, h: Math.round(r.height) + 8 };
  });
  await p.evaluate(([ボタン, ログ]) => {
    const 注 = window.__注;
    (ボタン || []).forEach(b => 注.枠(b, 4));
    if (ログ) 注.枠(ログ, 3);
    if (ボタン && ボタン.length) {
      // ボタンは画面の下に貼り付いているので、札はそのすぐ上に置く
      const 上 = Math.min(...ボタン.map(b => b.y));
      注.札(20, 上 - 46, 'この3つのボタンで決めます（画面の下にいつも出ています）',
        { 色: '青', 字: 13.5 });
    }
    if (ログ) 注.札と矢(ログ.x + 240, ログ.y - 6,
      'どのAIが何をしたかの記録',
      { x: ログ.x + ログ.w + 6, y: ログ.y + ログ.h/2 }, { 出口: '左', 字: 13 });
  }, [ボタン, ログ]);
  await p.screenshot({ path: 設定.出力先 + '/kakunin1_top.png', clip: { x: 0, y: 0, width: 900, height: 1060 } });
  console.log('  撮った: ① 上のほう', JSON.stringify((ボタン||[]).map(b=>b.字)));

  // ② 直した内容と根拠
  await p.evaluate(() => { const l = document.getElementById('__chuu'); if (l) l.remove();
                           delete window.__注; });
  const 根拠 = await 見出しの位置(p, '直した内容と根拠');
  await p.evaluate(y => window.scrollTo(0, y - 40), 根拠.y);
  await p.waitForTimeout(500);
  await 仕込む(p);
  await p.screenshot({ path: 設定.出力先 + '/kakunin2_factcheck.png', clip: { x: 0, y: 0, width: 900, height: 720 } });
  console.log('  撮った: ② 直した内容と根拠');

  // ③ 知名度の内訳
  await p.evaluate(() => { const l = document.getElementById('__chuu'); if (l) l.remove();
                           delete window.__注; });
  const 知名度 = await 見出しの位置(p, '知名度（マップの丸の大きさ');
  await p.evaluate(y => window.scrollTo(0, y - 30), 知名度.y);
  await p.waitForTimeout(500);
  await p.screenshot({ path: 設定.出力先 + '/kakunin3_fame.png', clip: { x: 0, y: 0, width: 900, height: 400 } });
  console.log('  撮った: ③ 知名度');

  // ④ 関連ジャンル
  const 関連 = await 見出しの位置(p, '関連ジャンル');
  await p.evaluate(y => window.scrollTo(0, y - 30), 関連.y);
  await p.waitForTimeout(500);
  await p.screenshot({ path: 設定.出力先 + '/kakunin4_links.png', clip: { x: 0, y: 0, width: 900, height: 560 } });
  console.log('  撮った: ④ 関連ジャンル');

  await b.close();
})();
