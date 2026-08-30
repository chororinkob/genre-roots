const 設定 = require('./設定');
// スマホ用ヘルプの図 その2（地図の見方・探し方・申請・修正依頼）
const { chromium, devices } = require('playwright');
const { 仕込む } = require('./chuu.js');
const 元 = 設定.地図;
const 出先 = 設定.出力先 + '/';

const きらめきを止める = `(() => { twinkleActive = false; })`;
const 動きを止める = `(() => {
  document.querySelectorAll('.dt-arrow, .sp-grip-mark, .sp-fame-i').forEach(a => {
    const an = a.getAnimations()[0];
    if (an) { an.pause(); an.currentTime = an.effect.getTiming().duration / 2; } });
})`;

async function 開く(b) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route('**youtube.com/**', r => r.abort());
  await p.goto(元, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(13000);
  await p.evaluate(きらめきを止める + '()');
  await p.waitForTimeout(7000);
  await 仕込む(p);
  await p.evaluate(動きを止める + '()');
  return { ctx, p };
}
const 落ち着く = async p => {
  await p.evaluate(きらめきを止める + '()');
  await p.waitForTimeout(7000);
  await p.evaluate(動きを止める + '()');
};
const ジャンルを開く = async (p, id = 'jazz') => {
  await p.evaluate(i => { [...document.querySelectorAll('.node')]
    .find(e => (e.__data__ || {}).id === i)
    .dispatchEvent(new MouseEvent('click', { bubbles: true })); }, id);
  await p.waitForTimeout(5200);
  await 落ち着く(p);
};
const 位置 = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           中x: Math.round(r.left + r.width / 2), 中y: Math.round(r.top + r.height / 2) }; }, sel);
const 光っている玉 = p => p.evaluate(() => {
  const 光 = [...document.querySelectorAll('.node')].map(n => {
    const c = n.querySelector('circle'); const bb = c.getBoundingClientRect();
    return { 濃: Number(getComputedStyle(n).opacity),
      中x: Math.round(bb.left + bb.width / 2), 中y: Math.round(bb.top + bb.height / 2),
      半: Math.round(bb.width / 2) };
  }).filter(o => o.中x > 175 && o.中x < 368 && o.中y > 180 && o.中y < 560 && o.濃 > 0.7);
  光.sort((a, b) => b.半 - a.半);
  return 光[0] || null;
});
const 系統の行 = p => p.evaluate(() => {
  const 行 = [...document.querySelectorAll('#left-sidebar .legend-item')]
    .find(e => (e.textContent || '').trim() === 'ジャズ系');
  if (!行) return null;
  const r = 行.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
           h: Math.round(r.height), 中y: Math.round(r.top + r.height / 2) };
});
const 系統を押す = async p => {
  await p.evaluate(() => { [...document.querySelectorAll('#left-sidebar .legend-item')]
    .find(e => (e.textContent || '').trim() === 'ジャズ系')
    .dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await p.waitForTimeout(2600);
  await 落ち着く(p);
};

const 図 = {};

// ── 8. 丸の大きさ ──
図['08_size'] = async b => {
  const { ctx, p } = await 開く(b);
  const m = await p.evaluate(async () => {
    const 玉 = id => [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === id);
    const a = 玉('jazz').__data__, c = 玉('acid_jazz').__data__;
    const k = d3.zoomTransform(svg.node()).k * 2.0;
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(innerWidth / 2 - (a.x + c.x) / 2 * k, innerHeight / 2 - (a.y + c.y) / 2 * k + 20).scale(k));
    await new Promise(r => setTimeout(r, 1200));
    const 位 = id => { const n = 玉(id); const r = n.querySelector('circle').getBoundingClientRect();
      return { 中x: Math.round(r.left + r.width / 2), 中y: Math.round(r.top + r.height / 2),
               半: Math.round(r.width / 2), 星: n.__data__.fame }; };
    return { 大: 位('jazz'), 小: 位('acid_jazz') };
  });
  await p.evaluate(m => {
    const 注 = window.__注;
    const 丸枠 = o => 注.枠({ x: o.中x - o.半, y: o.中y - o.半, w: o.半 * 2, h: o.半 * 2 }, 5);
    丸枠(m.大); 丸枠(m.小);
    注.札と矢(24, 120, '知名度 ★' + m.大.星 + '　大きい丸',
      { x: m.大.中x - m.大.半 - 4, y: m.大.中y - m.大.半 - 4 }, { 出口: '下', 字: 12.5 });
    注.札と矢(200, 520, '知名度 ★' + m.小.星 + '　小さい丸',
      { x: m.小.中x + m.小.半 + 4, y: m.小.中y + m.小.半 + 4 }, { 出口: '上', 字: 12.5 });
    注.札(20, 618, '丸が大きいほど、世界でよく知られているジャンル',
      { 色: '青', 字: 12, 幅: 310 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp08_size.png' });
  await ctx.close();
};

// ── 9. 丸の色＝系統 ──
図['09_color'] = async b => {
  const { ctx, p } = await 開く(b);
  await p.click('#drawer-tab'); await p.waitForTimeout(1200);
  await 系統を押す(p);
  const 見本 = await 系統の行(p);
  const 玉 = await 光っている玉(p);
  await p.evaluate(([見本, 玉]) => {
    const 注 = window.__注;
    注.枠({ x: 見本.x - 2, y: 見本.y - 2, w: 132, h: 見本.h + 4 }, 3);
    if (玉) {
      注.枠({ x: 玉.中x - 玉.半, y: 玉.中y - 玉.半, w: 玉.半 * 2, h: 玉.半 * 2 }, 5);
      注.札と矢(160, 452, '見本と同じ色の丸が、地図の上で光る',
        { x: 玉.中x, y: 玉.中y + 玉.半 + 5 }, { 出口: '上', 字: 12, 幅: 176 });
    }
    注.札(186, 150, '色＝ジャンルの系統', { 色: '青', 字: 12.5 });
    注.札と矢(160, 566, '系統の名前を押すと、その系統だけが残る',
      { x: 見本.x + 134, y: 見本.中y }, { 出口: '左', 字: 12, 幅: 176 });
  }, [見本, 玉]);
  await p.screenshot({ path: 出先 + 'sp09_color.png' });
  await ctx.close();
};

// ── 10. 五線譜の道 ──
図['10_michi'] = async b => {
  const { ctx, p } = await 開く(b);
  await ジャンルを開く(p);
  await p.click('#sp-grip'); await p.waitForTimeout(1600);
  await p.evaluate(動きを止める + '()');
  const m = await p.evaluate(() => {
    const 玉 = id => [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === id);
    const 位 = n => { const b = n.querySelector('circle').getBoundingClientRect();
      return { 中x: b.left + b.width / 2, 中y: b.top + b.height / 2, 半: b.width / 2 }; };
    const j = 位(玉('jazz'));
    const 玉たち = [...document.querySelectorAll('.node')].map(n => 位(n));
    const 道 = [...document.querySelectorAll('#graph line.link.focus-highlight')].map(e => {
      const d = e.__data__ || {}; if (!d.source) return null;
      const 相手 = (d.source.id === 'jazz') ? d.target.id : d.source.id;
      const n = 玉(相手); if (!n) return null;
      const g = 位(n);
      return { 相手, 段: _staffLevel(d), ...g, 距: Math.hypot(g.中x - j.中x, g.中y - j.中y) };
    }).filter(o => o && o.中x > 30 && o.中x < 360 && o.中y > 195 && o.中y < 630 && o.距 > 100);
    const 点 = o => { const t = (o.距 - o.半 - 15) / o.距;
      const x = j.中x + (o.中x - j.中x) * t, y = j.中y + (o.中y - j.中y) * t;
      if (x < 25 || x > 365 || y < 200 || y > 625) return null;
      const 余 = Math.min(...玉たち.filter(g => Math.hypot(g.中x - o.中x, g.中y - o.中y) > 1)
        .map(g => Math.hypot(g.中x - x, g.中y - y) - g.半));
      return { x: Math.round(x), y: Math.round(y), 余 }; };
    const 段別 = n => 道.filter(o => o.段 === n).map(o => ({ ...o, 点: 点(o) }))
      .filter(o => o.点).sort((a, b) => b.点.余 - a.点.余);
    const 太 = 段別(5)[0] || 段別(4)[0], 細 = 段別(1)[0] || 段別(2)[0];
    return { 太: 太 && { 点: 太.点 }, 細: 細 && { 点: 細.点 } };
  });
  await p.evaluate(m => {
    const 注 = window.__注;
    const 上 = m.細.点.y > 380;
    注.札と矢(14, 上 ? 214 : 566, '影響が弱い道は細く、線も2本', m.細.点,
      { 出口: 上 ? '下' : '上', 字: 11.5, 幅: 152 });
    const 太上 = m.太.点.y > 380;
    注.札と矢(192, 太上 ? 214 : 566, '影響が強い道は太く、線が5本', m.太.点,
      { 出口: 太上 ? '下' : '上', 字: 11.5, 幅: 158 });
    注.札(58, 632, '道の上を音符が流れる', { 色: '青', 字: 11.5 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp10_michi.png' });
  await ctx.close();
};

// ── 11. ジャンル名で探す ──
図['11_search'] = async b => {
  const { ctx, p } = await 開く(b);
  await p.click('#drawer-tab'); await p.waitForTimeout(1200);
  await p.fill('#search', 'jazz');
  await p.waitForTimeout(2200);
  await 落ち着く(p);
  const 欄 = await 位置(p, '#search');
  const 件数 = await p.evaluate(() => {
    const 件 = [...document.querySelectorAll('#left-sidebar *')]
      .find(e => e.children.length === 0 && /件ヒット/.test(e.textContent || ''));
    if (!件) return null;
    const r = 件.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const 玉 = await 光っている玉(p);
  await p.evaluate(([欄, 件数, 玉]) => {
    const 注 = window.__注;
    注.枠(欄, 4);
    if (件数) 注.枠(件数, 3);
    if (玉) 注.枠({ x: 玉.中x - 玉.半, y: 玉.中y - 玉.半, w: 玉.半 * 2, h: 玉.半 * 2 }, 5);
    注.札と矢(180, 250, 'ここにジャンル名を入れる',
      { x: 欄.x + 欄.w + 5, y: 欄.中y }, { 出口: '左', 字: 12, 幅: 152 });
    if (玉) 注.札と矢(178, 470, '当てはまる丸が地図の上で光る',
      { x: 玉.中x, y: 玉.中y + 玉.半 + 5 }, { 出口: '上', 字: 12, 幅: 152 });
    注.札(18, 596, '「説明文含む」に切り替えると、「切ない」「夏」のような雰囲気の言葉でも探せる',
      { 色: '青', 字: 11.5, 幅: 344 });
  }, [欄, 件数, 玉]);
  await p.screenshot({ path: 出先 + 'sp11_search.png' });
  await ctx.close();
};

// ── 12. 系統のジャンル一覧 ──
図['12_catlist'] = async b => {
  const { ctx, p } = await 開く(b);
  await p.click('#drawer-tab'); await p.waitForTimeout(1200);
  await 系統を押す(p);
  const 名 = await p.evaluate(() => [...document.querySelectorAll('#left-sidebar *')]
    .filter(e => e.children.length === 0 &&
      ['Jazz', 'Ragtime', 'Bebop', 'Swing'].includes((e.textContent || '').trim()))
    .map(e => { const r = e.getBoundingClientRect();
      return { 字: e.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top),
               w: Math.round(r.width), h: Math.round(r.height) }; }));
  await p.evaluate(名 => {
    const 注 = window.__注;
    const 上 = 名[0], 下 = 名[名.length - 1];
    if (上 && 下) 注.枠({ x: 上.x - 2, y: 上.y - 3, w: 128, h: (下.y + 下.h) - 上.y + 66 }, 4);
    注.札と矢(166, 232, '知名度の高い順に並ぶ',
      { x: 上 ? 上.x + 120 : 130, y: 上 ? 上.y + 8 : 240 }, { 出口: '左', 字: 12, 幅: 152 });
    注.札と矢(166, 470, 'ジャンル名を押すと、その説明が開く',
      { x: 下 ? 下.x + 110 : 130, y: 下 ? 下.y + 8 : 480 }, { 出口: '左', 字: 12, 幅: 164 });
    注.札(120, 606, '地図のほうも、その系統だけが残る', { 色: '青', 字: 12 });
  }, 名);
  await p.screenshot({ path: 出先 + 'sp12_catlist.png' });
  await ctx.close();
};

// ── 13. ジャンル追加申請 ──
図['13_request'] = async b => {
  const { ctx, p } = await 開く(b);
  await p.evaluate(() => openGenreRequest('Arena Rock'));
  await p.waitForTimeout(1200);
  const m = { 名: await 位置(p, '#gr-name'), 申請: await 位置(p, '#gr-submit') };
  await p.evaluate(m => {
    const 注 = window.__注;
    注.枠(m.名, 4); 注.枠(m.申請, 4);
    // 札は入れ物より下の空いているところに置く。中に置くとボタンに重なる
    注.札と矢(26, 376, '載っていないジャンルの名前を入れる',
      { x: m.名.x + 60, y: m.名.y + m.名.h + 4 }, { 出口: '上', 字: 12, 幅: 216 });
    注.札と矢(26, 480, 'キーボードが出ていても、ここはいつも見えている。そのまま押せる',
      { x: m.申請.中x, y: m.申請.y + m.申請.h + 4 }, { 出口: '上', 字: 12, 幅: 250 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp13_request.png' });
  await ctx.close();
};

// ── 14. 修正依頼を書く画面 ──
図['14_correction'] = async b => {
  const { ctx, p } = await 開く(b);
  await ジャンルを開く(p);
  await p.evaluate(() => document.getElementById('sp-correction-btn').click());
  await p.waitForTimeout(1200);
  const m = { 欄: await 位置(p, '#sp-correction-text'), 送信: await 位置(p, '#sp-correction-send'),
              閉: await 位置(p, '#cs-close') };
  await p.evaluate(m => {
    const 注 = window.__注;
    注.枠(m.欄, 4); 注.枠(m.送信, 4); 注.枠(m.閉, 4);
    // 札は入力欄より下の空いているところへ。矢印は短く、上へまっすぐ
    注.札と矢(140, 14, 'やめて説明にもどる',
      { x: m.閉.x - 5, y: m.閉.中y }, { 出口: '右', 字: 12 });
    注.札と矢(26, 300, 'どこが違うと思ったかを書く',
      { x: m.欄.x + 70, y: m.欄.y + m.欄.h + 4 }, { 出口: '上', 字: 12.5, 幅: 200 });
    注.札と矢(26, 400, '送ると、AIが調べて、その結果がこの画面に出る',
      { x: m.送信.中x, y: m.送信.y + m.送信.h + 4 }, { 出口: '上', 字: 12.5, 幅: 260 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp14_correction.png' });
  await ctx.close();
};

(async () => {
  const b = await chromium.launch();
  const 指定 = process.argv.slice(2);
  const 名前 = 指定.length ? Object.keys(図).filter(k => 指定.some(x => k.startsWith(x))) : Object.keys(図);
  for (const k of 名前) { await 図[k](b); console.log('  撮った: ' + k); }
  await b.close();
})();
