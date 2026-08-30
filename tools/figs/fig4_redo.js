const 設定 = require('./設定');
const { 広告を飛ばす } = require('./広告');
// 図4を作り直す。拡大せず、放射状に並んだ状態のまま
// 「いちばん太い道」と「いちばん細い道」を実測して指す。
const { chromium } = require('playwright');
const path = require('path');
const URL = 設定.地図;
const 出力 = 設定.出力先;

const CSS = [
  '#annot{position:fixed;inset:0;z-index:99999;pointer-events:none;',
  '  font-family:"Zen Kaku Gothic New","Yu Gothic",sans-serif;}',
  '#annot .tag{position:absolute;background:#ffcc33;color:#1a1206;font-weight:800;',
  '  font-size:17px;line-height:1.5;padding:6px 12px;border-radius:9px;',
  '  box-shadow:0 3px 14px rgba(0,0,0,.75);white-space:pre;}',
  '#annot .tag.b{background:#2f6fd0;color:#fff;}',
  '#annot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}',
].join('\n');

async function 注釈(p, items) {
  await p.evaluate(function (arg) {
    var old = document.getElementById('annot'); if (old) old.remove();
    var st = document.getElementById('annot-css');
    if (!st) { st = document.createElement('style'); st.id = 'annot-css'; document.head.appendChild(st); }
    st.textContent = arg.css;
    var L = document.createElement('div'); L.id = 'annot';
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    var defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ffcc33"/></marker>';
    svg.appendChild(defs); L.appendChild(svg);
    arg.items.forEach(function (it) {
      if (!it) return;
      if (it.type === 'tag') {
        var t = document.createElement('div'); t.className = 'tag' + (it.blue ? ' b' : '');
        t.textContent = it.text; t.style.left = it.x + 'px'; t.style.top = it.y + 'px';
        L.appendChild(t);
      } else if (it.type === 'arrow') {
        var ln = document.createElementNS(NS, 'path');
        ln.setAttribute('d', 'M' + it.pts[0] + ',' + it.pts[1] + ' L' + it.pts[2] + ',' + it.pts[3]);
        ln.setAttribute('fill', 'none'); ln.setAttribute('stroke', '#ffcc33');
        ln.setAttribute('stroke-width', '5'); ln.setAttribute('stroke-linecap', 'round');
        ln.setAttribute('marker-end', 'url(#ah)'); svg.appendChild(ln);
      }
    });
    document.body.appendChild(L);
  }, { css: CSS, items: items });
  await p.waitForTimeout(300);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  // YouTubeの広告を止める。図の中で広告が流れていると、
  // 「よく広告が出るツール」に見えてしまう。動画そのものは通す。
  await p.route('**://*.doubleclick.net/**', r => r.abort());
  await p.route('**://*.googlesyndication.com/**', r => r.abort());
  await p.route('**://*.googleadservices.com/**', r => r.abort());
  await p.route('**://*.google.com/pagead/**', r => r.abort());
  await p.route('**://*.youtube.com/api/stats/ads**', r => r.abort());
  await p.route('**://*.youtube.com/pagead/**', r => r.abort());
  await p.route('**://*.youtube.com/ptracking**', r => r.abort());
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(6000);
  await p.evaluate(function () {
    var n = Array.prototype.slice.call(document.querySelectorAll('.node'))
      .filter(function (e) { return (e.__data__ || {}).id === 'jazz'; })[0];
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(9000);   // 動画が出そろうまで待つ

  // 動画が写る図なので、広告が流れていないか確かめてから撮る
  await 広告を飛ばす(p);

  // 光っている線の中から、太いもの・細いものを影響度(score合計)で選ぶ
  const 測 = await p.evaluate(function () {
    var ls = Array.prototype.slice.call(document.querySelectorAll('#graph line.link.focus-highlight'));
    var 出 = [];
    ls.forEach(function (l) {
      var d = l.__data__ || {};
      var sc = d.score || {};
      var 合 = (sc.r || 0) + (sc.h || 0) + (sc.i || 0) + (sc.v || 0) + (sc.c || 0);
      var x1 = +l.getAttribute('x1'), y1 = +l.getAttribute('y1'),
          x2 = +l.getAttribute('x2'), y2 = +l.getAttribute('y2');
      var g = document.getElementById('graph');
      var m = g.getScreenCTM();
      var pt = function (x, y) { return { x: m.a * x + m.e, y: m.d * y + m.f }; };
      var a = pt(x1, y1), c = pt(x2, y2);
      // 矢印の指す先は、地図がはっきり見えている範囲にする
      // （パネルや左の欄の裏は指せない）。
      // 【線のまんなかだけを見てはいけない】まんなかが範囲の外にあると、
      // その道が候補ごと落ちてしまう。実際、いちばん太い道（レベル4）が
      // 落ちて、レベル2とレベル1という比べようのない図になった。
      // 線の上を少しずつ動かして、見えている場所を探す。
      var 指す = null;
      for (var t = 0.30; t <= 0.78; t += 0.04) {
        var px = a.x + (c.x - a.x) * t, py = a.y + (c.y - a.y) * t;
        if (px >= 430 && px <= 1040 && py >= 200 && py <= 760) { 指す = { x: px, y: py }; break; }
      }
      if (!指す) return;
      var mid = 指す;
      出.push({ lv: 合, mid: mid,
        相手: ((d.source || {}).id === 'jazz' ? (d.target || {}) : (d.source || {})).label || '' });
    });
    出.sort(function (a2, b2) { return b2.lv - a2.lv; });
    return { 太: 出[0], 細: 出[出.length - 1], 本数: 出.length };
  });
  console.log('選んだ道:', JSON.stringify(測));

  const it = [{ type: 'tag', text: 'ジャンルをつなぐ線は「五線譜の道」', x: 380, y: 100, blue: true }];
  if (測.太) {
    const tx = Math.min(760, Math.max(350, 測.太.mid.x - 330)), ty = Math.min(700, Math.max(170, 測.太.mid.y + 60));
    it.push({ type: 'tag', text: '影響が強い（レベル' + 測.太.lv + '）\n線が多く、道が太い', x: tx, y: ty });
    it.push({ type: 'arrow', pts: [tx + 230, ty + 22, 測.太.mid.x, 測.太.mid.y] });
  }
  if (測.細) {
    const tx = Math.min(760, Math.max(350, 測.細.mid.x - 330)), ty = Math.min(720, Math.max(170, 測.細.mid.y - 120));
    it.push({ type: 'tag', text: '影響が弱い（レベル' + 測.細.lv + '）\n線が少なく、道が細い', x: tx, y: ty });
    it.push({ type: 'arrow', pts: [tx + 230, ty + 44, 測.細.mid.x, 測.細.mid.y] });
  }
  await 注釈(p, it);
  await p.screenshot({ path: path.join(出力, 'fig04_gosenfu.png') });
  console.log('→ fig04_gosenfu.png');
  await b.close();
})();
