const 設定 = require('./設定');
const { 広告を飛ばす } = require('./広告');
// 図4を作り直す。拡大せず、放射状に並んだ状態のまま
// 「いちばん太い道」を1本だけ選び、その1本に沿って説明を並べる。
//
// 【2026-09-05 に2度目の作り直し】
// 1度目の直し（実際にクリックして本物のパネルを開く）は良かったが、
// 「影響が強い」「音符の向き」「ト音記号・強弱記号」の3つの矢印を、
// それぞれ別々の道の途中（何もラベルの無い、線が密集した場所）に
// 適当に置いていたため、どの矢印がどの道を指しているのか分からず
// 「めちゃくちゃ」になっていた、とチョロさんに指摘された。
// 今回は、名前がラベルとして見えている「いちばん太い道」1本だけを選び、
// その道の3か所（ジャズ側の起点付近／中間／相手ジャンルの玉）を
// 順になぞる形にした。同じ1本の道を指しているとひと目で分かるように、
// 矢印はすべてこの道の上（またはすぐそば）に置く。
const { chromium } = require('playwright');
const path = require('path');
const URL = 設定.地図;
const 出力 = 設定.出力先;

const CSS = [
  '#annot{position:fixed;inset:0;z-index:99999;pointer-events:none;',
  '  font-family:"Zen Kaku Gothic New","Yu Gothic",sans-serif;}',
  '#annot .tag{position:absolute;background:#ffcc33;color:#1a1206;font-weight:800;',
  '  font-size:15px;line-height:1.5;padding:6px 12px;border-radius:9px;',
  '  box-shadow:0 3px 14px rgba(0,0,0,.75);white-space:pre;max-width:270px;}',
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
      } else if (it.type === 'line') {
        // 「これが1本の同じ道です」を示す、細い目印の線（矢印なし）
        var ln2 = document.createElementNS(NS, 'path');
        ln2.setAttribute('d', 'M' + it.pts[0] + ',' + it.pts[1] + ' L' + it.pts[2] + ',' + it.pts[3]);
        ln2.setAttribute('fill', 'none'); ln2.setAttribute('stroke', '#ffcc33');
        ln2.setAttribute('stroke-width', '2'); ln2.setAttribute('stroke-dasharray', '2 6');
        ln2.setAttribute('stroke-linecap', 'round'); ln2.setAttribute('opacity', '0.85');
        svg.appendChild(ln2);
      }
    });
    document.body.appendChild(L);
  }, { css: CSS, items: items });
  await p.waitForTimeout(300);
}

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
  await p.evaluate(function () {
    var n = Array.prototype.slice.call(document.querySelectorAll('.node'))
      .filter(function (e) { return (e.__data__ || {}).id === 'jazz'; })[0];
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(12000);
  await 広告を飛ばす(p);

  // 「いちばん太い道」を1本選ぶ。相手ジャンルの玉が、地図の見える範囲
  // （パネルや左の欄の裏ではない）にラベルごと収まっているものだけを候補にする。
  const 測 = await p.evaluate(function () {
    var jazzEl = Array.prototype.slice.call(document.querySelectorAll('.node'))
      .filter(function (e) { return (e.__data__ || {}).id === 'jazz'; })[0];
    var jazzC = jazzEl.querySelector('circle').getBoundingClientRect();
    var jazz = { x: jazzC.left + jazzC.width / 2, y: jazzC.top + jazzC.height / 2 };

    var ls = Array.prototype.slice.call(document.querySelectorAll('#graph line.link.focus-highlight'));
    var 候補 = [];
    ls.forEach(function (l) {
      var d = l.__data__ || {};
      var sc = d.score || {};
      var lv = (sc.r || 0) + (sc.h || 0) + (sc.i || 0) + (sc.v || 0) + (sc.c || 0);
      var otherId = (d.source || {}).id === 'jazz' ? (d.target || {}).id : (d.source || {}).id;
      var otherLabel = (d.source || {}).id === 'jazz' ? (d.target || {}).label : (d.source || {}).label;
      var otherEl = Array.prototype.slice.call(document.querySelectorAll('.node'))
        .filter(function (e) { return (e.__data__ || {}).id === otherId; })[0];
      if (!otherEl) return;
      var oc = otherEl.querySelector('circle').getBoundingClientRect();
      var other = { x: oc.left + oc.width / 2, y: oc.top + oc.height / 2, r: oc.width / 2 };
      // 相手の玉が、地図がはっきり見える範囲に収まっているか
      // （左の欄の裏・パネルの裏・上下の帯の裏ではない）
      if (other.x < 460 || other.x > 1000 || other.y < 220 || other.y > 720) return;
      // ジャズから離れすぎていない・近すぎない道だけを選ぶ。
      // 近すぎると3か所の説明（起点／中間／相手の玉）が重なって
      // 読めなくなる（2026-09-05に実際に起きた）。
      var 距 = Math.hypot(other.x - jazz.x, other.y - jazz.y);
      if (距 < 230 || 距 > 420) return;
      候補.push({ lv: lv, other: other, otherLabel: otherLabel, jazz: jazz, 距: 距 });
    });
    候補.sort(function (a, b) { return b.lv - a.lv; });
    var 弱い候補 = 候補.slice().sort(function (a, b) { return a.lv - b.lv; });
    return { 太: 候補[0], 細: 弱い候補[0], 総数: 候補.length };
  });
  console.log('選んだ道:', JSON.stringify(測));

  const it = [{ type: 'tag', text: 'ジャンルをつなぐ線は「五線譜の道」', x: 380, y: 40, blue: true }];

  if (測.太) {
    const j = 測.太.jazz, o = 測.太.other;
    // 道に沿った2点：起点（ジャズのすぐそば）／中間
    const at = (t) => ({ x: j.x + (o.x - j.x) * t, y: j.y + (o.y - j.y) * t });
    const 起点 = at(0.12), 中間 = at(0.55);

    // 目印の線（起点〜相手の玉のすぐ手前まで、この1本が同じ道だと分かるように）
    it.push({ type: 'line', pts: [起点.x, 起点.y, o.x - (o.x - j.x) * 0.06, o.y - (o.y - j.y) * 0.06] });

    // 3枚の札は、重ならないよう固定の場所（画面の下のほう・左のほう）に離して置き、
    // 矢印だけを実測した道の3か所（相手の玉／中間／起点）へ伸ばす。
    // ① 相手の玉（ラベルが見えている）を指して「影響が強い」
    it.push({ type: 'tag', text: '線の本数が多いほど\n影響が強い（2〜5本）', x: 700, y: 760 });
    it.push({ type: 'arrow', pts: [790, 758, o.x - 6, o.y + 6] });

    // ② 中間点で「音符が流れる向き」
    it.push({ type: 'tag', text: '同じ道の上を流れる音符の\n向き＝影響の向き\n（ルーツ→生まれたジャンル）', x: 340, y: 620 });
    it.push({ type: 'arrow', pts: [610, 660, 中間.x, 中間.y] });

    // ③ 起点付近で「強弱記号」（ト音記号は「五線譜です」の意味だけ添える）
    it.push({ type: 'tag', text: '強弱記号（pp〜ff）は、線の\n本数と同じ5段階の影響の強さ\n（ト音記号は「五線譜」の意味）', x: 340, y: 380 });
    it.push({ type: 'arrow', pts: [610, 420, 起点.x, 起点.y] });
  }

  if (測.細 && (!測.太 || 測.細.otherLabel !== 測.太.otherLabel)) {
    const o = 測.細.other;
    it.push({ type: 'tag', text: '影響が弱い道は\n線が少なく、道が細い', x: 1000, y: 200 });
    it.push({ type: 'arrow', pts: [1040, 260, o.x, o.y + 8] });
  }

  await 注釈(p, it);
  await p.screenshot({ path: path.join(出力, 'fig04_gosenfu.png') });
  console.log('→ fig04_gosenfu.png');
  await b.close();
})();
