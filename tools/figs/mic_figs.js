const 設定 = require('./設定');
// 「これなんて曲？」の図を撮る（パソコン版・スマホ版）。
//
// 【外への問い合わせについて】
// 1回目は本当に Shazam へ問い合わせ、その返事を mic_response.json に保存する。
// 2回目からは保存した返事を使い回すので、何度撮り直しても外へは出ない。
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { 仕込む } = require('./chuu.js');
const 公開 = 設定.地図;
const 音源 = 'C:/Users/choro/AppData/Local/Temp/claude/c--Users-choro-OneDrive-Desktop-claudeTMP/7e48fb9a-c233-49ec-87a6-20c25cd26eb0/scratchpad/take_on_me.mp3';
const 保存先 = require('path').join(__dirname, 'mic_response.json');

async function 用意(b, 端末) {
  const ctx = await b.newContext(端末 === 'スマホ'
    ? { ...devices['iPhone 13'], deviceScaleFactor: 3 }
    : { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();

  if (fs.existsSync(保存先)) {
    // 保存してある返事を使う（外へは出ない）
    const 返事 = fs.readFileSync(保存先, 'utf8');
    await p.route('**/recognize', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        headers: {
          'access-control-allow-origin': 'https://genre-roots.com',
          'access-control-allow-credentials': 'true'
        },
        body: 返事
      }));
    console.log('  （保存してある結果を使います。外へは問い合わせません）');
  } else {
    p.on('response', async r => {
      if (/\/recognize$/.test(r.url()) && r.request().method() === 'POST') {
        try { fs.writeFileSync(保存先, await r.text(), 'utf8');
              console.log('  （返事を保存しました。次からは外へ出ません）'); } catch (e) {}
      }
    });
    console.log('  （初回なので、実際に1回だけ問い合わせます）');
  }
  await p.goto(公開, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(14000);
  await p.evaluate(() => { twinkleActive = false; });
  await p.waitForTimeout(6000);
  await 仕込む(p);
  return { ctx, p };
}

const 位置 = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           中x: Math.round(r.left + r.width / 2), 中y: Math.round(r.top + r.height / 2) }; }, sel);

// パネルの上のほうだけを切り取る（下にある動画は説明に要らないので入れない）
const パネルを切る = async (p, 下げ, 画面幅 = 1400) => {
  const r = await 位置(p, '#mic-panel');
  // 説明の札はパネルの左右の外に置いてあるので、そのぶんも入れて切り取る
  const 左 = Math.max(0, r.x - 300);
  const 右 = Math.min(画面幅, r.x + r.w + 310);
  return { x: 左, y: Math.max(0, r.y - 12),
           width: 右 - 左, height: Math.min(下げ, r.h + 24) };
};

async function 撮る(端末, 接頭) {
  const b = await chromium.launch();
  const { ctx, p } = await 用意(b, 端末);

  // ── 1枚目：マイクの画面を開いたところ ──
  if (端末 === 'スマホ') { await p.click('#drawer-tab'); await p.waitForTimeout(1200); }
  await p.click('#mic-trigger-btn');
  await p.waitForTimeout(1800);
  const マイク = await 位置(p, '.mic-listen-btn');
  const ファイル = await 位置(p, '.mic-file-label');
  const 台1 = await 位置(p, '#mic-panel');
  await p.evaluate(([マイク, ファイル, 台, 狭い]) => {
    const 注 = window.__注;
    if (マイク) { 注.枠(マイク, 6);
      if (狭い) 注.札と矢(台.x + 18, マイク.y - 66, 'マイクのボタンを押して、音楽を流す',
        { x: マイク.中x, y: マイク.y - 8 }, { 出口: '下', 字: 12.5, 幅: 290 });
      else 注.札と矢(マイク.x - 250, マイク.中y - 20, 'マイクのボタンを押して、音楽を流す',
        { x: マイク.x - 8, y: マイク.中y }, { 出口: '右', 字: 13, 幅: 220 }); }
    if (ファイル) { 注.枠(ファイル, 5);
      if (狭い) 注.札と矢(台.x + 18, ファイル.y + ファイル.h + 22, 'または、音声ファイルを選ぶ',
        { x: ファイル.中x, y: ファイル.y + ファイル.h + 8 }, { 出口: '上', 字: 12.5, 幅: 290 });
      else 注.札と矢(ファイル.x + ファイル.w + 40, ファイル.中y - 14, 'または、音声ファイルを選ぶ',
        { x: ファイル.x + ファイル.w + 8, y: ファイル.中y }, { 出口: '左', 字: 13 }); }
  }, [マイク, ファイル, 台1, 端末 === 'スマホ']);
  await p.screenshot({ path: 接頭 + '1_open.png', clip: await パネルを切る(p, 端末 === 'スマホ' ? 520 : 460, 端末 === 'スマホ' ? 390 : 1400) });

  // ── ファイルを渡す ──
  await p.evaluate(() => {
    const l = document.getElementById('__chuu'); if (l) l.remove();
    delete window.__注;          // 作り直させる（矢印のSVGごと入れ替える）
  });
  await 仕込む(p);
  await p.setInputFiles('#micAudioFile', 音源);
  let 出た = false;
  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(2000);
    出た = await p.evaluate(() => {
      const r = document.getElementById('mic-result');
      return !!(r && getComputedStyle(r).display !== 'none');
    });
    if (出た) break;
  }
  if (!出た) { console.log('  ✗ 結果が出ませんでした'); await b.close(); return false; }
  await p.waitForTimeout(1500);
  await 仕込む(p);

  // ── 2枚目：結果 ──
  const 曲 = await 位置(p, '#mic-result-title');
  const 人 = await 位置(p, '#mic-result-artist');
  const タグ = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#mic-genre-tags > *')];
    if (!t.length) return null;
    const a = t[0].getBoundingClientRect(), z = t[t.length - 1].getBoundingClientRect();
    return { x: Math.round(a.left) - 4, y: Math.round(a.top) - 4,
             w: Math.round(Math.max(...t.map(e => e.getBoundingClientRect().right)) - a.left) + 8,
             h: Math.round(z.bottom - a.top) + 8,
             最後: { 中x: Math.round(z.left + z.width / 2), 下: Math.round(z.bottom) } };
  });
  const 台2 = await 位置(p, '#mic-panel');
  await p.evaluate(([曲, 人, タグ, 台, 狭い]) => {
    const 注 = window.__注;
    注.枠({ x: 曲.x - 4, y: 曲.y - 4, w: Math.max(曲.w, 人.w) + 8, h: (人.y + 人.h) - 曲.y + 8 }, 4);
    if (タグ) 注.枠(タグ, 4);
    if (狭い) {
      注.札と矢(台.x + 18, 台.y + 118, '曲名とアーティスト名が出る',
        { x: 曲.中x, y: 曲.y - 8 }, { 出口: '下', 字: 12.5, 幅: 290 });
      if (タグ) 注.札と矢(台.x + 18, タグ.y + タグ.h + 20,
        '考えられるジャンルが並ぶ',
        { x: タグ.x + 70, y: タグ.y + タグ.h + 6 }, { 出口: '上', 字: 12.5, 幅: 290 });
    } else {
      注.札と矢(曲.x - 250, 曲.y - 6, '曲名とアーティスト名が出る',
        { x: 曲.x - 8, y: 曲.中y }, { 出口: '右', 字: 13, 幅: 220 });
      if (タグ) 注.札と矢(タグ.x + タグ.w + 40, タグ.y + 10,
        '考えられるジャンルが並ぶ',
        { x: タグ.x + タグ.w + 8, y: タグ.y + 20 }, { 出口: '左', 字: 13, 幅: 230 });
    }
  }, [曲, 人, タグ, 台2, 端末 === 'スマホ']);
  await p.screenshot({ path: 接頭 + '2_result.png', clip: await パネルを切る(p, 端末 === 'スマホ' ? 600 : 585, 端末 === 'スマホ' ? 390 : 1400) });

  // ── 3枚目：ジャンルを選ぶ ──
  await p.evaluate(() => {
    const l = document.getElementById('__chuu'); if (l) l.remove();
    delete window.__注;          // 作り直させる（矢印のSVGごと入れ替える）
  });
  await 仕込む(p);
  const 選んだ = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#mic-genre-tags > *')];
    if (!t.length) return null;
    t[0].click();
    const r = t[0].getBoundingClientRect();
    return { 名: t[0].textContent.trim(), x: Math.round(r.left), y: Math.round(r.top),
             w: Math.round(r.width), h: Math.round(r.height),
             中x: Math.round(r.left + r.width / 2), 中y: Math.round(r.top + r.height / 2) };
  });
  await p.waitForTimeout(1000);
  const ボタン = await 位置(p, '.mic-highlight-btn');
  const 台3 = await 位置(p, '#mic-panel');
  await p.evaluate(([選, ボタン, 台, 狭い]) => {
    const 注 = window.__注;
    if (選) { 注.枠(選, 5);
      if (狭い) 注.札と矢(台.x + 18, 台.y + 118, '見たいジャンルだけ押して選ぶ（選ぶと塗りつぶされる）',
        { x: 選.中x, y: 選.y - 8 }, { 出口: '下', 字: 12.5, 幅: 290 });
      else 注.札と矢(選.x - 260, 選.中y - 16, '見たいジャンルだけ押して選ぶ（選ぶと塗りつぶされる）',
        { x: 選.x - 8, y: 選.中y }, { 出口: '右', 字: 13, 幅: 235 }); }
    if (ボタン) { 注.枠(ボタン, 5);
      if (狭い) 注.札と矢(台.x + 18, ボタン.y + ボタン.h + 20, '選び終わったら、これを押す',
        { x: ボタン.中x, y: ボタン.y + ボタン.h + 6 }, { 出口: '上', 字: 12.5, 幅: 290 });
      else 注.札と矢(ボタン.x + ボタン.w + 40, ボタン.中y - 14, '選び終わったら、これを押す',
        { x: ボタン.x + ボタン.w + 8, y: ボタン.中y }, { 出口: '左', 字: 13 }); }
  }, [選んだ, ボタン, 台3, 端末 === 'スマホ']);
  await p.screenshot({ path: 接頭 + '3_select.png', clip: await パネルを切る(p, 端末 === 'スマホ' ? 600 : 585, 端末 === 'スマホ' ? 390 : 1400) });
  console.log('  選んだジャンル:', 選んだ && 選んだ.名);

  // ── 4枚目：マップで確認 ──
  await p.evaluate(() => { const l = document.getElementById('__chuu'); if (l) l.remove(); });
  await p.evaluate(() => micGoToMap());
  await p.waitForTimeout(5000);
  await 仕込む(p);
  const 光 = await p.evaluate(() => {
    const 出 = [...document.querySelectorAll('.node')].map(n => {
      const c = n.querySelector('circle'); const b = c.getBoundingClientRect();
      return { id: (n.__data__ || {}).id, 濃: Number(getComputedStyle(n).opacity),
               中x: Math.round(b.left + b.width / 2), 中y: Math.round(b.top + b.height / 2),
               半: Math.round(b.width / 2) };
    }).filter(o => o.濃 > 0.7 && o.半 > 4);
    出.sort((a, b) => b.半 - a.半);
    return 出[0] || null;
  });
  if (光) await p.evaluate(光 => {
    const 注 = window.__注;
    注.枠({ x: 光.中x - 光.半 - 6, y: 光.中y - 光.半 - 6, w: 光.半 * 2 + 12, h: 光.半 * 2 + 12 }, 5);
    const 左 = 光.中x > 400;
    注.札と矢(左 ? 光.中x - 330 : 光.中x + 60, 光.中y - 60,
      '選んだジャンルが、地図の上で光る',
      { x: 左 ? 光.中x - 光.半 - 8 : 光.中x + 光.半 + 8, y: 光.中y },
      { 出口: 左 ? '右' : '左', 字: 13, 幅: 250 });
  }, 光);
  await p.screenshot({ path: 接頭 + '4_map.png' });
  console.log('  光ったジャンル:', 光 && 光.id);
  await b.close();
  return true;
}

(async () => {
  const 端末 = process.argv[2] || 'パソコン';
  const 接頭 = 端末 === 'スマホ' ? 設定.出力先 + '/spmic' : 設定.出力先 + '/pcmic';
  console.log('■ ' + 端末);
  const ok = await 撮る(端末, 接頭);
  console.log(ok ? '  撮れました' : '  失敗しました');
})();
