const 設定 = require('./設定');
// スマホ用ヘルプの図をまとめて撮る。
// 使い方: node sp_figs.js <図の番号...>   （何も付けなければ全部）
const { chromium, devices } = require('playwright');
const { 仕込む } = require('./chuu.js');
const 元 = 設定.地図;
const 出先 = 設定.出力先 + '/';

// きらめきを止める。色は自分で戻さない——無理に戻すと、ふだんは暗いはずの
// 玉まで色つきになって、実際の画面と違う絵になってしまう。
// 止めたあと数秒待てば、光っていた玉は自然に元の色へ戻る。
const きらめきを止める = `(() => { twinkleActive = false; })`;
// 小さな動き（つまみの矢印・△・「？」）は、いちばん見えるところで止める
const 動きを止める = `(() => {
  document.querySelectorAll('.dt-arrow, .sp-grip-mark, .sp-fame-i').forEach(a => {
    const an = a.getAnimations()[0];
    if (an) { an.pause(); an.currentTime = an.effect.getTiming().duration / 2; } });
})`;
const 落ち着かせる = 動きを止める;

async function 開く(b, { 動画 = false } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  if (!動画) await p.route('**youtube.com/**', r => r.abort());
  await p.goto(元, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(13000);
  await p.evaluate(きらめきを止める + '()');
  await p.waitForTimeout(7000);          // 光っていた玉が自然に元の色へ戻るのを待つ
  await 仕込む(p);
  await p.evaluate(動きを止める + '()');
  return { ctx, p };
}
const ジャンルを開く = async (p, id = 'jazz') => {
  await p.evaluate(i => { [...document.querySelectorAll('.node')]
    .find(e => (e.__data__||{}).id === i)
    .dispatchEvent(new MouseEvent('click', { bubbles: true })); }, id);
  await p.waitForTimeout(5200);
  await p.evaluate(きらめきを止める + '()');
  await p.waitForTimeout(7000);
  await p.evaluate(動きを止める + '()');
};
const 位置 = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           中x: Math.round(r.left + r.width/2), 中y: Math.round(r.top + r.height/2) }; }, sel);

const 図 = {};

// ── 1. 画面の見取り図 ──
図['01_gamen'] = async b => {
  const { ctx, p } = await 開く(b);
  const m = { タブ: await 位置(p, '#drawer-tab'), 全体: await 位置(p, '#fit-view'),
              ヘルプ: await 位置(p, '#help-link') };
  await p.evaluate(m => {
    const 注 = window.__注;
    注.枠({ x: m.全体.x, y: m.全体.y, w: (m.ヘルプ.x + m.ヘルプ.w) - m.全体.x, h: m.全体.h }, 4);
    注.札と矢(140, 58, '地図をもとに戻す ／ 使い方',
      { x: m.全体.x + 6, y: m.全体.y + m.全体.h + 6 }, { 出口: '右', 字: 12 });
    注.札(104, 110, 'ここが地図。丸ひとつが1ジャンル', { 色: '青', 字: 12.5 });
    注.枠(m.タブ, 4);
    注.札と矢(56, 244, 'ここを押すと、ジャンルの一覧・検索・\n「これなんて曲？」が出てくる',
      { x: m.タブ.x + m.タブ.w + 8, y: m.タブ.中y },
      { 出口: '左', 字: 12, 幅: 218 });
    注.札(52, 566, '指1本でなぞると地図が動く。\n2本の指でつまむと大きく／小さくなる。',
      { 字: 12, 幅: 250 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp01_gamen.png' });
  await ctx.close();
};

// ── 2. タブを押す前 ──
図['02_tab_before'] = async b => {
  const { ctx, p } = await 開く(b);
  const t = await 位置(p, '#drawer-tab');
  await p.evaluate(t => {
    const 注 = window.__注;
    注.枠(t, 5);
    注.札と矢(56, 120, '画面の左はしにある\n「ジャンル検索」のつまみ',
      { x: t.x + t.w + 8, y: t.中y - 10 }, { 出口: '左', 字: 12.5, 幅: 180 });
    注.札と矢(56, 300, 'ここを押す。\n右へ指ではらってもいい',
      { x: t.x + t.w + 8, y: t.中y + 24 }, { 出口: '左', 字: 12.5, 幅: 180 });
  }, t);
  await p.screenshot({ path: 出先 + 'sp02_tab_before.png' });
  await ctx.close();
};

// ── 3. タブを押したあと（引き出しが開く） ──
図['03_tab_after'] = async b => {
  const { ctx, p } = await 開く(b);
  await p.click('#drawer-tab');
  await p.waitForTimeout(1200);
  await p.evaluate(動きを止める + '()');
  const m = { タブ: await 位置(p, '#drawer-tab'), マイク: await 位置(p, '#mic-trigger-btn'),
              検索: await 位置(p, '#search'),
              系統: await p.evaluate(() => {
                const 行 = [...document.querySelectorAll('#left-sidebar .legend-item')]
                  .find(e => (e.textContent||'').trim() === 'ジャズ系');
                if (!行) return null;
                const r = 行.getBoundingClientRect();
                return { x: Math.round(r.left), y: Math.round(r.top),
                         w: Math.round(r.width), h: Math.round(r.height),
                         中y: Math.round(r.top + r.height/2) };
              }) };
  await p.evaluate(m => {
    const 注 = window.__注;
    // 札はぜんぶ引き出しの右（地図の上）に置き、矢印は短くまっすぐ左へ引く
    if (m.マイク) { 注.枠(m.マイク, 4);
      注.札と矢(196, 116, '流れている曲からジャンルを調べる',
        { x: m.マイク.x + m.マイク.w + 4, y: m.マイク.中y },
        { 出口: '左', 字: 12, 幅: 160 }); }
    if (m.検索) { 注.枠(m.検索, 4);
      注.札と矢(196, 216, 'ジャンル名で探す',
        { x: m.検索.x + m.検索.w + 4, y: m.検索.中y }, { 出口: '左', 字: 12 }); }
    if (m.系統) { 注.枠({ x: m.系統.x - 2, y: m.系統.y - 2, w: 132, h: m.系統.h + 4 }, 3);
      注.札と矢(196, 500, '色ごとの系統。押すとその一覧が出る',
        { x: m.系統.x + 134, y: m.系統.中y }, { 出口: '左', 字: 12, 幅: 176 }); }
    注.枠(m.タブ, 4);
    注.札と矢(196, 322, 'つまみは右へ動く。もう一度押すと閉じる',
      { x: m.タブ.x + m.タブ.w + 5, y: m.タブ.中y }, { 出口: '左', 字: 12, 幅: 176 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp03_tab_after.png' });
  await ctx.close();
};

// ── 4. ジャンルの玉を押す ──
図['04_tap_node'] = async b => {
  const { ctx, p } = await 開く(b);
  const j = await p.evaluate(() => {
    const n = [...document.querySelectorAll('.node')].find(e => (e.__data__||{}).id === 'jazz');
    const r = n.querySelector('circle').getBoundingClientRect();
    return { 中x: Math.round(r.left + r.width/2), 中y: Math.round(r.top + r.height/2),
             半: Math.round(r.width/2) };
  });
  await p.evaluate(j => {
    const 注 = window.__注;
    注.枠({ x: j.中x - j.半 - 4, y: j.中y - j.半 - 4, w: j.半*2 + 8, h: j.半*2 + 8 }, 5);
    注.札と矢(38, 150, '知りたいジャンルの丸を、指で1回押す',
      { x: j.中x - j.半 * .7, y: j.中y - j.半 * .7 }, { 出口: '下', 字: 12.5, 幅: 240 });
    注.札(60, 566, '小さくて押しにくいときは、2本の指で\nつまんで広げると大きくなる', { 色: '青', 字: 12, 幅: 260 });
  }, j);
  await p.screenshot({ path: 出先 + 'sp04_tap_node.png' });
  await ctx.close();
};

// ── 5. 説明パネル（全面） ──
図['05_panel'] = async b => {
  const { ctx, p } = await 開く(b);
  await ジャンルを開く(p);
  const m = { つまみ: await 位置(p, '#sp-grip'), 閉: await 位置(p, '#sp-close'),
              星: await 位置(p, '.sp-fame'), はてな: await 位置(p, '.sp-fame-i'),
              曲: await 位置(p, '#sp-body .sp-section') };
  const 曲箱 = await p.evaluate(() => {
    const h = [...document.querySelectorAll('#sp-body *')]
      .find(e => /代表曲/.test((e.textContent||'').trim()) && e.children.length <= 1);
    if (!h) return null;
    const r = (h.closest('div') || h).getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  await p.evaluate(([m, 曲]) => {
    const 注 = window.__注;
    注.枠(m.つまみ, 4); 注.枠(m.閉, 4); if (m.星) 注.枠(m.星, 3);
    if (曲) 注.枠(曲, 4);
    注.札と矢(256, 178, '閉じる', { x: m.閉.中x, y: m.閉.y + m.閉.h + 4 }, { 出口: '上', 字: 12 });
    if (m.はてな) 注.札と矢(196, 244, '「？」を押すと、\n★の根拠が出る',
      { x: m.はてな.中x + 4, y: m.はてな.y + m.はてな.h + 4 }, { 出口: '右', 字: 11.5, 幅: 168 });
    注.札と矢(16, 178, 'ここを押すと、説明を畳んで\n下のルーツマップが見える',
      { x: m.つまみ.x + 26, y: m.つまみ.y + m.つまみ.h + 3 }, { 出口: '上', 字: 11.5, 幅: 172 });
    if (曲) 注.札と矢(16, 246, '代表曲。押すと\nその曲の動画に変わる',
      { x: 曲.x + 52, y: 曲.y - 4 }, { 出口: '下', 字: 11.5, 幅: 158 });
    注.札(96, 596, 'パネルは半透明。後ろの地図が透けて見える', { 色: '青', 字: 11.5, 幅: 250 });
  }, [m, 曲箱]);
  await p.screenshot({ path: 出先 + 'sp05_panel.png' });
  await ctx.close();
};

// ── 6. つまみを押して畳む（ルーツマップ） ──
図['06_peek'] = async b => {
  const { ctx, p } = await 開く(b);
  await ジャンルを開く(p);
  await p.click('#sp-grip');
  await p.waitForTimeout(1600);
  await p.evaluate(落ち着かせる + '()');
  const m = { つまみ: await 位置(p, '#sp-grip'), タブ: await 位置(p, '#drawer-tab') };
  await p.evaluate(m => {
    const 注 = window.__注;
    注.枠(m.つまみ, 4);
        注.札と矢(34, 210, 'もう一度押すと、説明にもどる',
      { x: m.つまみ.x + 30, y: m.つまみ.y + m.つまみ.h + 4 }, { 出口: '上', 字: 12, 幅: 180 });
    注.札(38, 596, '説明が畳まれ、選んだジャンルを中心にしたつながりの地図（ルーツマップ）が出る',
      { 色: '青', 字: 12, 幅: 300 });
  }, m);
  await p.screenshot({ path: 出先 + 'sp06_peek.png' });
  await ctx.close();
};

// ── 7. 畳んだときの細いつまみ ──
図['07_slim'] = async b => {
  const { ctx, p } = await 開く(b);
  await ジャンルを開く(p);
  const t = await 位置(p, '#drawer-tab');
  await p.evaluate(t => {
    const 注 = window.__注;
    注.枠(t, 6);
    注.札と矢(66, 300, '説明を読んでいる間、\n「ジャンル検索」は\n矢印だけの細いつまみになる。\n押せば同じように開く',
      { x: t.x + t.w + 7, y: t.中y }, { 出口: '左', 字: 12, 幅: 200 });
  }, t);
  await p.screenshot({ path: 出先 + 'sp07_slim.png' });
  await ctx.close();
};

(async () => {
  const b = await chromium.launch();
  const 指定 = process.argv.slice(2);
  const 名前 = 指定.length ? Object.keys(図).filter(k => 指定.some(x => k.startsWith(x))) : Object.keys(図);
  for (const k of 名前) { await 図[k](b); console.log('  撮った: ' + k); }
  await b.close();
})();
