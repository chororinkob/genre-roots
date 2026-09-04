const 設定 = require('./設定');
// ヘルプ用の図をまとめて作る。
//
// 画像に後から描き込むのではなく、ブラウザの中で本物の要素の位置を測り、
// その上に矢印・丸・吹き出しを重ねてから撮る。指す先がずれない。
//
// 出力先: genre-roots-repo/docs/img/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 設定.地図;
const 出力 = 設定.出力先;
const 幅 = 1400, 高 = 900;

const 注釈CSS = `
#annot{position:fixed;inset:0;z-index:99999;pointer-events:none;
  font-family:"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;}
#annot .ring{position:absolute;border:4px solid #ffcc33;border-radius:999px;
  box-shadow:0 0 0 3px rgba(0,0,0,.6),0 0 20px rgba(255,204,51,.5);}
#annot .box{position:absolute;border:4px solid #ffcc33;border-radius:10px;
  box-shadow:0 0 0 3px rgba(0,0,0,.6),0 0 20px rgba(255,204,51,.45);}
#annot .tag{position:absolute;background:#ffcc33;color:#1a1206;font-weight:800;
  font-size:18px;line-height:1.5;padding:7px 13px;border-radius:9px;
  box-shadow:0 3px 14px rgba(0,0,0,.7);white-space:pre;}
#annot .tag.b{background:#2f6fd0;color:#fff;}
#annot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
`;

async function 注釈(p, items) {
  await p.evaluate(({ css, items }) => {
    document.getElementById('annot')?.remove();
    let st = document.getElementById('annot-css');
    if (!st) { st = document.createElement('style'); st.id = 'annot-css'; document.head.appendChild(st); }
    st.textContent = css;
    const L = document.createElement('div'); L.id = 'annot';
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ffcc33"/></marker>';
    svg.appendChild(defs); L.appendChild(svg);
    for (const it of items) {
      if (it.type === 'ring' || it.type === 'box') {
        const r = it.rect; if (!r) continue;
        const d = document.createElement('div');
        d.className = it.type;
        d.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
        L.appendChild(d);
      } else if (it.type === 'tag') {
        const d = document.createElement('div');
        d.className = 'tag' + (it.blue ? ' b' : '');
        d.textContent = it.text;
        d.style.left = it.x + 'px'; d.style.top = it.y + 'px';
        L.appendChild(d);
      } else if (it.type === 'arrow') {
        const [x1, y1, x2, y2] = it.pts;
        const ln = document.createElementNS(NS, 'path');
        ln.setAttribute('d', `M${x1},${y1} Q${(x1 + x2) / 2 + (it.curve || 0)},${(y1 + y2) / 2} ${x2},${y2}`);
        ln.setAttribute('fill', 'none'); ln.setAttribute('stroke', '#ffcc33');
        ln.setAttribute('stroke-width', '5'); ln.setAttribute('stroke-linecap', 'round');
        ln.setAttribute('marker-end', 'url(#ah)');
        svg.appendChild(ln);
      }
    }
    document.body.appendChild(L);
  }, { css: 注釈CSS, items });
  await p.waitForTimeout(250);
}

const 位置 = (p, id) => p.evaluate(gid => {
  const n = [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === gid);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}, id);

const 要素位置 = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}, sel);

async function 新規ページ(b) {
  const p = await b.newPage({ viewport: { width: 幅, height: 高 }, deviceScaleFactor: 2 });
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(6000);
  return p;
}

const 撮る = async (p, 名) => {
  await p.screenshot({ path: path.join(出力, 名 + '.png') });
  console.log('  → ' + 名 + '.png');
};

(async () => {
  fs.mkdirSync(出力, { recursive: true });
  const b = await chromium.launch();

  // ── 図1: 画面全体の各部の名前 ──
  // 枠は必ず実物を測って置く。手で座標を書くとずれる（最初それで失敗した）。
  {
    console.log('図1 画面の見取り図');
    const p = await 新規ページ(b);
    const 測 = await p.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; };
      const btn = t => { const e = [...document.querySelectorAll('button,a')]
          .find(x => (x.textContent || '').includes(t) && x.getBoundingClientRect().top < 70);
        if (!e) return null; const b = e.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; };
      return { 曲: r('#recognize-btn') || r('#controls'), 操作: r('#controls'), 検索: r('#search'),
               凡例: r('#legend'), ヘルプ: btn('ヘルプ'), 全体: btn('全体表示') };
    });
    const it = [];
    const 枠 = (o, m = 5) => ({ x: o.x - m, y: o.y - m, w: o.w + m * 2, h: o.h + m * 2 });
    if (測.操作) {
      it.push({ type: 'box', rect: 枠(測.操作) });
      it.push({ type: 'tag', text: '音を聴かせて曲名を調べる' + String.fromCharCode(10) + 'ジャンル名で探す', x: 測.操作.x + 測.操作.w + 46, y: 測.操作.y + 30 });
      it.push({ type: 'arrow', pts: [測.操作.x + 測.操作.w + 42, 測.操作.y + 52, 測.操作.x + 測.操作.w + 10, 測.操作.y + 52] });
    }
    if (測.凡例) {
      const h2 = Math.min(測.凡例.h, 620);
      it.push({ type: 'box', rect: { x: 測.凡例.x - 5, y: 測.凡例.y - 5, w: 測.凡例.w + 10, h: h2 } });
      it.push({ type: 'tag', text: 'カテゴリの色の見本。' + String.fromCharCode(10) + 'クリックするとジャンル一覧が開く', x: 測.凡例.x + 測.凡例.w + 46, y: 測.凡例.y + 200 });
      it.push({ type: 'arrow', pts: [測.凡例.x + 測.凡例.w + 42, 測.凡例.y + 226, 測.凡例.x + 測.凡例.w + 10, 測.凡例.y + 226] });
    }
    if (測.ヘルプ && 測.全体) {
      it.push({ type: 'box', rect: { x: 測.ヘルプ.x - 5, y: 測.ヘルプ.y - 5, w: (1400 - 12) - 測.ヘルプ.x + 5, h: 測.ヘルプ.h + 10 } });
      it.push({ type: 'tag', text: 'ヘルプ・全体表示', x: 測.ヘルプ.x - 330, y: 測.ヘルプ.y + 46 });
      it.push({ type: 'arrow', pts: [測.ヘルプ.x - 40, 測.ヘルプ.y + 52, 測.ヘルプ.x + 10, 測.ヘルプ.y + 34] });
    }
    it.push({ type: 'tag', text: 'ここが地図。丸ひとつが1ジャンル', x: 760, y: 130, blue: true });
    await 注釈(p, it);
    await 撮る(p, 'fig01_gamen');
    await p.close();
  }

  // ── 図2: 丸の大きさ＝知名度 ──
  {
    console.log('図2 丸の大きさ');
    const p = await 新規ページ(b);
    const 大 = await 位置(p, 'jazz');
    const 小 = await 位置(p, 'acid_jazz');
    const it = [];
    if (大) {
      it.push({ type: 'ring', rect: { x: 大.x - 10, y: 大.y - 10, w: 大.w + 20, h: 大.h + 20 } });
      it.push({ type: 'tag', text: '知名度 ★5\n大きい丸', x: 大.cx + 80, y: 大.cy - 100 });
      it.push({ type: 'arrow', pts: [大.cx + 76, 大.cy - 66, 大.cx + 14, 大.cy - 22] });
    }
    if (小) {
      it.push({ type: 'ring', rect: { x: 小.x - 10, y: 小.y - 10, w: 小.w + 20, h: 小.h + 20 } });
      it.push({ type: 'tag', text: '知名度 ★4\n小さい丸', x: 小.cx + 60, y: 小.cy + 40 });
      it.push({ type: 'arrow', pts: [小.cx + 56, 小.cy + 52, 小.cx + 12, 小.cy + 14] });
    }
    it.push({ type: 'tag', text: '丸が大きいほど、世界でよく知られているジャンル', x: 700, y: 830, blue: true });
    await 注釈(p, it);
    await 撮る(p, 'fig02_marunoookisa');
    await p.close();
  }

  // ── 図3: 丸の色＝カテゴリ ──
  {
    console.log('図3 丸の色');
    const p = await 新規ページ(b);
    // 凡例の「ジャズ系」と、地図のジャズ系の玉を結ぶ
    const 凡 = await p.evaluate(() => {
      const el = [...document.querySelectorAll('.legend-item')].find(e => (e.textContent || '').includes('ジャズ'));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    const 玉 = await 位置(p, 'jazz');
    const it = [];
    if (凡) it.push({ type: 'box', rect: { x: 凡.x - 6, y: 凡.y - 4, w: 凡.w + 12, h: 凡.h + 8 } });
    if (玉) it.push({ type: 'ring', rect: { x: 玉.x - 10, y: 玉.y - 10, w: 玉.w + 20, h: 玉.h + 20 } });
    if (凡 && 玉) it.push({ type: 'arrow', pts: [凡.x + 凡.w + 10, 凡.cy, 玉.x - 16, 玉.cy], curve: -60 });
    it.push({ type: 'tag', text: '色が同じ＝同じ系統', x: 400, y: 300 });
    await 注釈(p, it);
    await 撮る(p, 'fig03_marunoiro');
    await p.close();
  }

  // ── 図4: 線の太さ＝影響の強さ（五線譜の道）──
  {
    console.log('図4 五線譜の道');
    const p = await 新規ページ(b);
    const c = await 位置(p, 'acid_jazz');
    await p.mouse.move(c.cx, c.cy);
    for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(130); }
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      document.querySelectorAll('#graph line.link').forEach(l => {
        const d = l.__data__ || {};
        const s = (d.source || {}).id || d.s, t = (d.target || {}).id || d.t;
        if (s === 'jazz' || t === 'jazz') l.classList.add('focus-highlight');
      });
    });
    await p.waitForTimeout(1800);
    await 注釈(p, [
      { type: 'tag', text: 'ジャンルをつなぐ線は「五線譜の道」', x: 640, y: 40, blue: true },
      { type: 'tag', text: '線の本数が多いほど\n影響が強い（2〜5本）', x: 1080, y: 190 },
      { type: 'arrow', pts: [1075, 230, 1000, 300] },
      { type: 'tag', text: '音符が流れる', x: 620, y: 330 },
      { type: 'arrow', pts: [770, 348, 930, 320] },
      { type: 'tag', text: 'ト音記号と\n強弱記号（pp〜ff）', x: 620, y: 560 },
      { type: 'arrow', pts: [780, 590, 900, 520] },
    ]);
    await 撮る(p, 'fig04_gosenfu');
    await p.close();
  }

  // ── 図5: 検索で光らせる ──
  {
    console.log('図5 検索');
    const p = await 新規ページ(b);
    await p.fill('#search', 'Jazz');
    await p.waitForTimeout(600);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2500);
    const 検 = await 要素位置(p, '#search');
    const it = [];
    if (検) {
      it.push({ type: 'box', rect: { x: 検.x - 6, y: 検.y - 6, w: 検.w + 12, h: 検.h + 12 } });
      it.push({ type: 'tag', text: 'ここに入れる', x: 検.x + 検.w + 20, y: 検.y - 4 });
      it.push({ type: 'arrow', pts: [検.x + 検.w + 16, 検.cy, 検.x + 検.w + 2, 検.cy] });
    }
    it.push({ type: 'tag', text: '当てはまるジャンルだけが光る\n（カンマ区切りで複数OK）', x: 640, y: 780, blue: true });
    await 注釈(p, it);
    await 撮る(p, 'fig05_kensaku');
    await p.close();
  }

  // ── 図6: カテゴリ一覧を開く ──
  {
    console.log('図6 カテゴリ一覧');
    const p = await 新規ページ(b);
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('.legend-item[data-cat]')].find(e => (e.textContent || '').includes('ジャズ'));
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await p.waitForTimeout(1500);
    const 凡 = await p.evaluate(() => {
      const el = [...document.querySelectorAll('.legend-item')].find(e => (e.textContent || '').includes('ジャズ'));
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, cy: r.top + r.height / 2 };
    });
    await 注釈(p, [
      { type: 'box', rect: { x: 凡.x - 6, y: 凡.y - 4, w: 凡.w + 12, h: 凡.h + 8 } },
      { type: 'tag', text: 'クリックすると', x: 凡.x + 凡.w + 20, y: 凡.y - 6 },
      { type: 'arrow', pts: [凡.x + 凡.w + 16, 凡.cy, 凡.x + 凡.w + 2, 凡.cy] },
      { type: 'tag', text: 'そのカテゴリのジャンルが\n知名度の高い順に並ぶ', x: 340, y: 560 },
      { type: 'arrow', pts: [335, 590, 300, 590] },
    ]);
    await 撮る(p, 'fig06_categorylist');
    await p.close();
  }

  // ── 図7: 説明パネル ──
  {
    console.log('図7 説明パネル');
    const p = await 新規ページ(b);
    await p.evaluate(() => {
      const n = [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === 'jazz');
      n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await p.waitForTimeout(4000);
    await 撮る(p, 'fig07_panel_raw');
    await p.close();
  }

  await b.close();
  console.log('\n出来上がり:', fs.readdirSync(出力).join(' / '));
})();
