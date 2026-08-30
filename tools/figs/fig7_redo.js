const 設定 = require('./設定');
const { 広告を飛ばす } = require('./広告');
// 図7を撮り直す。
//  ・YouTubeが「エラー153」になっていた。file:// から開くとYouTube側が
//    再生を拒むため。http で配っているRender経由なら普通に再生される。
//  ・知名度の黄色い枠が、意味のない帯（見出しの下線）から始まっていた。
//    「知名度」の文字から★までを囲む。
const { chromium } = require('playwright');
const path = require('path');

const URL = 設定.地図;
const 出力 = 設定.出力先;

const CSS = [
  '#annot{position:fixed;inset:0;z-index:99999;pointer-events:none;',
  '  font-family:"Zen Kaku Gothic New","Yu Gothic",sans-serif;}',
  '#annot .box{position:absolute;border:4px solid #ffcc33;border-radius:10px;',
  '  box-shadow:0 0 0 3px rgba(0,0,0,.6),0 0 20px rgba(255,204,51,.45);}',
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
      if (it.type === 'box') {
        if (!it.rect) return;
        var d = document.createElement('div'); d.className = 'box';
        d.style.left = it.rect.x + 'px'; d.style.top = it.rect.y + 'px';
        d.style.width = it.rect.w + 'px'; d.style.height = it.rect.h + 'px';
        L.appendChild(d);
      } else if (it.type === 'tag') {
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
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  console.log('Render経由で開く（YouTubeが再生できる形）...');
  await p.goto(URL, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(9000);
  await p.evaluate(function () {
    var n = Array.prototype.slice.call(document.querySelectorAll('.node'))
      .filter(function (e) { return (e.__data__ || {}).id === 'jazz'; })[0];
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // 動画が出るまで少し長めに待つ
  await p.waitForTimeout(12000);

  const 測 = await p.evaluate(function () {
    function box(e) {
      if (!e) return null;
      var b = e.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
    }
    // 「知名度」と★と「？」をちょうど包んでいるのが .sp-fame。
    // 前は帯（見出しの下線）まで囲んでしまい、意味のない部分から枠が
    // 始まっていた（チョロさん指摘・2026-08-26）。
    var 星 = document.querySelector('#side-panel .sp-fame');
    // 「代表曲・アーティスト」の見出し。パネルの中にあり、画面の右側に
    // 出ているものだけを拾う。左側の別の要素を掴んで、矢印が画面の外へ
    // 飛んでしまったため（2026-08-26）。
    var 代表 = null;
    var all = Array.prototype.slice.call(document.querySelectorAll('#side-panel h4, #side-panel h3, #side-panel div, #side-panel span'));
    for (var j2 = 0; j2 < all.length; j2++) {
      var t = (all[j2].textContent || '').trim();
      var rb = all[j2].getBoundingClientRect();
      if (t.indexOf('代表曲') === 0 && all[j2].children.length < 4
          && rb.left > 1000 && rb.top > 80 && rb.height > 10 && rb.height < 60) {
        代表 = all[j2]; break;
      }
    }
    var 動画 = document.querySelector('#side-panel iframe');
    return {
      パネル: box(document.getElementById('side-panel')),
      星: box(星), 代表曲: box(代表), 動画: box(動画),
      動画の中身: 動画 ? (動画.getAttribute('src') || '').slice(0, 60) : '(iframeが無い)',
      エラー表示: document.body.innerText.indexOf('エラー 153') >= 0,
    };
  });
  console.log('測れたもの:', JSON.stringify({ 星: !!測.星, 代表曲: !!測.代表曲, 動画: !!測.動画,
    エラーが出ている: 測.エラー表示, 動画src: 測.動画の中身 }));

  const L = 測.パネル ? 測.パネル.x : 1100;
  const it = [
    { type: 'tag', text: 'クリックすると、そのジャンルを中心に\n地図が並び替わる', x: 330, y: 110, blue: true },
    { type: 'tag', text: 'つながる相手だけが残り、\n「五線譜の道」で結ばれる', x: 330, y: 790, blue: true },
  ];
  if (測.星) {
    it.push({ type: 'box', rect: { x: 測.星.x - 6, y: 測.星.y - 5, w: 測.星.w + 12, h: 測.星.h + 10 } });
    var fx0 = Math.max(20, 測.星.x - 350), fy0 = Math.max(60, 測.星.y - 4);
    it.push({ type: 'tag', text: '知名度（★5段階）' + String.fromCharCode(10) + '「？」を押すと根拠が出る', x: fx0, y: fy0 });
    it.push({ type: 'arrow', pts: [fx0 + 292, fy0 + 26, 測.星.x - 12, 測.星.cy] });
  }
  if (測.代表曲) {
    it.push({ type: 'box', rect: { x: 測.代表曲.x - 5, y: 測.代表曲.y - 5, w: 測.代表曲.w + 10, h: 測.代表曲.h + 10 } });
    var cx0 = Math.max(20, 測.代表曲.x - 320), cy0 = Math.max(60, 測.代表曲.y - 6);
    it.push({ type: 'tag', text: '代表曲。押すと' + String.fromCharCode(10) + 'その曲の動画に変わる', x: cx0, y: cy0 });
    it.push({ type: 'arrow', pts: [cx0 + 262, cy0 + 28, 測.代表曲.x - 10, 測.代表曲.y + 16] });
  }
  // 動画が写る図なので、広告が流れていないか確かめてから撮る
  await 広告を飛ばす(p);
  await 注釈(p, it);
  await p.screenshot({ path: path.join(出力, 'fig07_panel.png') });
  console.log('→ fig07_panel.png');
  await b.close();
})();
