/* 「この曲は○○」の答えの帯（音楽ジャンルルーツ辞典）
   【2026-11-08 切り出し】答えのページ（proto/answer.html）の中にだけあった帯を、地図（genre_roots.html）の
   マイクパネルからも同じものを出せるように、このファイルに移した。
   GRBand.put(地図のwindow, {t, a, g, src, v?, by?, en?, via?})
     … 地図の説明パネルがそのジャンルを開き終わるのを待って、パネルの上に帯を差し込み、その曲の動画を右の動画の場所で流す。
   帯に出すのは「「曲名」（歌手名）は ○○」の1行と「なぜ ○○ ？」のボタンだけ（チョロさんの指示 2026-11-07・11-08）。
   ボタンを押すと、なぜそのジャンルにしたかの説明が開く。知りたい人だけが読めばよいので、最初は閉じておく。
   使っているデータベースの名前は出さない（まねされないため）。どんな種類のデータベースかだけを書く。 */
(function(){
var BASE_DIR = (document.currentScript && document.currentScript.src || '/proto/answer_band.js').replace(/[^\/]*$/, '');
var G = null;
var gReady = fetch(BASE_DIR + 'genres.json').then(function(r){ return r.json(); }).then(function(x){ G = x; }).catch(function(){ G = []; });
var JA = {enka: '演歌', kayokyoku: '歌謡曲', mood_kayo: 'ムード歌謡'};
function disp(id){ if (JA[id]) return JA[id]; var n = (G || []).find(function(x){ return x.id === id; }); return n ? String(n.name).replace(/\s*\n\s*/g, ' ') : id; }
// ジャンル名の下に小さく添える、もう1つの呼び方（英語名なら日本語の別名、日本語名なら英語名）
function sub(id){
  var n = (G || []).find(function(x){ return x.id === id; }); if (!n) return '';
  var main = disp(id), jp = /[぀-ヿ一-鿿]/, en = String(n.name).replace(/\s*\n\s*/g, ' ');
  if (jp.test(main)) return en === main ? '' : en;
  return (n.aliases || []).find(function(s){ return jp.test(s); }) || '';
}
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function norm(s){ return String(s || '').toLowerCase().replace(/[\s\-_'’.&・()（）「」]/g, ''); }

var CSS = [
  /* 【2026-11-08 作り直し（チョロさんの指示）】答えがひと目で分かるように。
     ・いちばん大きく出すのは「ジャンル名」。そのジャンルのカテゴリーの色（--gc）で光らせ、横にレコード盤の絵を置く
     ・曲名と歌手名も大きめに。曲名は「 」で、歌手名はその下の行に
     ・パソコンでは答えが画面の右に出て気づかれにくいので、出てきたときに枠を2回光らせる（動きを減らす設定の人には光らせない）
     ・下の段に「なぜ ○○？」と「別の曲を調べる」の2つのボタンを同じ形で並べる */
  '#gr-ans{--gc:#7eb8f7;position:relative;overflow:hidden;margin:0 0 12px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--gc) 55%,transparent);border-radius:14px;',
  '  background:radial-gradient(120% 90% at 0% 0%,color-mix(in srgb,var(--gc) 26%,transparent),transparent 60%),linear-gradient(180deg,#22223e,#1a1a30);line-height:1.5;color:#e8e8f0;',
  '  box-shadow:0 6px 22px rgba(0,0,0,.35);animation:grAnsIn .5s ease-out both,grAnsGlow 1.4s ease-in-out .5s 2}',
  '@keyframes grAnsIn{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}',
  '@keyframes grAnsGlow{0%,100%{box-shadow:0 6px 22px rgba(0,0,0,.35)}50%{box-shadow:0 0 0 3px color-mix(in srgb,var(--gc) 60%,transparent),0 0 28px color-mix(in srgb,var(--gc) 55%,transparent)}}',
  '#gr-ans .eye{font-size:11px;letter-spacing:.12em;color:#b8b8d0;display:flex;align-items:center;gap:6px}',
  '#gr-ans .eye::before{content:"";width:14px;height:2px;border-radius:2px;background:var(--gc)}',
  '#gr-ans .song{margin-top:6px;font-size:16.5px;font-weight:700;color:#fff;line-height:1.35;word-break:break-word}',
  '#gr-ans .artist{font-size:13px;color:#b8b8d0;margin-top:2px}',
  '#gr-ans .ans{display:flex;align-items:center;gap:12px;margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.14)}',
  /* レコード盤：溝の輪と、真ん中のラベルをジャンルの色で塗る。ゆっくり回す */
  '#gr-ans .disc{flex:none;width:48px;height:48px;border-radius:50%;position:relative;',
  '  background:radial-gradient(circle,var(--gc) 0 22%,#111 23% 26%,#1c1c1c 27% 40%,#2a2a2a 41% 42%,#181818 43% 58%,#2a2a2a 59% 60%,#151515 61% 100%);',
  '  box-shadow:0 0 0 1px rgba(255,255,255,.12),0 0 18px color-mix(in srgb,var(--gc) 45%,transparent);animation:grDisc 6s linear infinite}',
  '#gr-ans .disc::after{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 20deg,transparent 0 40deg,rgba(255,255,255,.16) 55deg,transparent 70deg 220deg,rgba(255,255,255,.1) 235deg,transparent 250deg)}',
  '@keyframes grDisc{to{transform:rotate(360deg)}}',
  '#gr-ans .gl{min-width:0}',
  '#gr-ans .gl small{display:block;font-size:11px;color:#b8b8d0;letter-spacing:.06em}',
  '#gr-ans .gn{display:block;font-size:27px;font-weight:800;line-height:1.15;color:#fff;text-shadow:0 0 14px color-mix(in srgb,var(--gc) 75%,transparent),0 0 2px var(--gc);word-break:break-word}',
  '#gr-ans .gs{display:block;font-size:12.5px;color:color-mix(in srgb,var(--gc) 55%,#fff);margin-top:2px}',
  '#gr-ans .r2{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
  '#gr-ans .btn{flex:1 1 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;border-radius:999px;padding:6px 14px;font:700 12.5px/1.3 inherit;cursor:pointer;white-space:nowrap}',
  '#gr-ans .qi{border:1px solid color-mix(in srgb,var(--gc) 70%,transparent);background:color-mix(in srgb,var(--gc) 16%,transparent);color:#fff}',
  '#gr-ans .qi:hover,#gr-ans .qi[aria-expanded=true]{background:color-mix(in srgb,var(--gc) 34%,transparent)}',
  '#gr-ans .more{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#dcdcf0}',
  '#gr-ans .more:hover{background:rgba(255,255,255,.12);color:#fff}',
  '#gr-ans .btn svg{width:14px;height:14px;flex:none}',
  '#gr-ans .why{display:none;font-size:12px;color:#d0d0e2;margin:10px 0 0;padding:10px 12px;border-radius:9px;background:rgba(0,0,0,.3);line-height:1.7}',
  '#gr-ans.why-open .why{display:block}',
  '#gr-ans .why p{margin:0 0 6px}',
  // 【2026-11-08】7つ（Last.fm を足した）のデータベースを同じ並びで見せる。説明（と曲数）を横長に1行、その下に答え（チョロさんの指示：右横だと見にくい・縦に長くなる）
  '#gr-ans .why .srcs{margin:2px 0 6px}',
  '#gr-ans .why .src{padding:5px 2px;border-top:1px solid rgba(255,255,255,.08)}',
  '#gr-ans .why .src .d{font-size:11px;color:#a0a0b8;line-height:1.5}',
  '#gr-ans .why .src .n{color:#d8b25e;white-space:nowrap;margin-left:4px}',
  '#gr-ans .why .src .r{font-size:12.5px;color:#fff;font-weight:600;line-height:1.5}',
  '#gr-ans .why .src.use .r{color:#9fd0ff}',
  '#gr-ans .why .src.off .r{color:#6e6e88;font-weight:400}',
  '#gr-ans .why .note{color:#a0a0b8;font-size:11px}',
  '@media (prefers-reduced-motion:reduce){#gr-ans,#gr-ans .disc{animation:none}}',
  '.yt-music-link.gr-hit{outline:2px solid #7eb8f7;outline-offset:1px;border-radius:4px}'
].join('\n');
var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
var ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';

// 外の音楽データベース。記号（M・D・W・I・Z）は答えの住所にだけ入る。画面には「どんな種類のデータベースか」だけを書く。
// 並びは、ジャンルの付け方が細かい順（＝答えに採る順番）。
// 【2026-11-08】それぞれの曲数も書く（分かるものだけ。チョロさんの指示：辞典だけの数を書くと、全体でその数しか使っていないように見える）。
//   辞典 = 曲ごとの判定4,166曲 ＋ 代表曲8,595曲（重なりを除いて12,586曲・2026-11-08に数えた）
//   M = 公式の統計ページの録音数 40,876,279（2026-11-08）／I = 2022年10月の公式発表「1億曲」／Z = 公式ニュースの「1億2,000万曲以上」
//   D・W は、曲の数の公式な数字が見つからなかったので書かない。
var SRC = [
  ['R', '音楽ジャンルルーツ辞典（歌手ではなく1曲ずつ、曲調で判定）', '約1万2,500曲'],
  // L = Last.fm（2026-11-08に足した）。曲の数の公式な数字が見つからなかったので書かない。
  ['L', '音楽ファンが聴いた曲に、自由にジャンルの札を付けていくデータベース', ''],
  ['M', '音楽ファンが投票でジャンルを付けていく、世界最大級の音楽データベース', '約4,000万曲'],
  ['D', 'レコード・CDの目録として作られた、世界中の盤を集めたデータベース', ''],
  ['W', 'ウィキペディアと同じ仲間の、だれでも編集できる知識のデータベース', ''],
  ['I', '大手の音楽配信ストアの売り場の分類', '1億曲以上'],
  ['Z', 'もう1つの音楽配信ストアの売り場の分類', '1億2,000万曲以上']
];
// 7つを同じ並びで出す。use = 採った答えの記号、ans = 記号ごとの答えの文（無いものは「ー」＝そこまで調べていない）
function srcList(use, ans){
  return '<div class="srcs">' + SRC.map(function(s){
    var a = ans[s[0]], on = s[0] === use;
    return '<div class="src' + (on ? ' use' : '') + (a ? '' : ' off') + '"><div class="d">' + esc(s[1]) + (s[2] ? '<span class="n">' + s[2] + '</span>' : '') + '</div>' +
      '<div class="r">' + (a || 'ー') + (on ? '　← これを採用' : '') + '</div></div>';
  }).join('') + '</div>';
}
function whyHtml(p){
  var g = p.g, gn = esc(disp(g));
  var HEAD = '<p>7つのデータベースを上から順に見て、最初にジャンルが分かったものを答えにしています。</p>';
  if (p.src === 'db') {
    return HEAD + srcList('R', {R: '「' + gn + '」'}) +
      (p.en === '1' ? '<p class="note">歌っているのは演歌の歌手ですが、この曲は曲調で判定して「' + gn + '」にしています。</p>' : '');
  }
  if (p.src === 'rep') {
    return HEAD + srcList('R', {R: '「' + gn + '」の代表曲'});
  }
  if (p.src === 'vote') {
    var said = {}, ans = {R: '登録なし'};
    (p.v || '').split('|').forEach(function(x){ var k = x.split(':'); if (k[0]) said[k[0]] = k[1]; });
    SRC.forEach(function(s){
      var v = said[s[0]]; if (s[0] === 'R' || !v) return;
      ans[s[0]] = v === 'none' ? '登録なし' : v === 'err' ? 'つながらず' : v === 'nogenre' ? 'ジャンルの記載なし' : '「' + esc(disp(v)) + '」';
    });
    return HEAD + srcList(p.by, ans) +
      '<p class="note">大まかな「ポップス」より細かいジャンルを優先するため、ジャンルの付け方が細かい順に並べています。</p>';
  }
  if (p.src === 'wikidata') return '<p>音楽データベースに登録されているジャンルで答えています。</p>';
  return '<p>どの音楽データベースにも見つからなかったため、AIが曲の情報から推しはかったジャンルです。</p>';
}

var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://genre-roots-server.onrender.com';
// 選んだ曲の動画を探す（辞典のサーバーの /video/find。YouTubeの鍵はサーバーの中だけにある）。
// 同じ曲は、このブラウザでも覚えておき、2回目からは探さない。
function findVideo(t, a){
  var key = 'gr-ansvid:' + norm(t) + '|' + norm(a);
  try { var c = localStorage.getItem(key); if (c) return Promise.resolve(c === '-' ? null : c); } catch(e) {}
  return fetch(API + '/video/find?' + new URLSearchParams({t: t, a: a || ''})).then(function(r){ return r.json(); }).then(function(dt){
    if (dt.found && dt.id) { try { localStorage.setItem(key, dt.id); } catch(e) {} return dt.id; }
    if (!dt.reason) { try { localStorage.setItem(key, '-'); } catch(e) {} }   // 上限・つながらないときは覚えない
    return null;
  }).catch(function(){ return null; });
}
// 見つけた動画を右の動画の場所で流す。代表曲の番号は -1（どれでもない）にしておくと、
// 終わったときに地図が「次の代表曲」＝1曲目（メイン動画）から流してくれる。
function playHit(w, d, want){
  if (!want || typeof w.playByVideoId !== 'function') return;
  var stop = false;
  d.addEventListener('click', function(e){ if (e.isTrusted && !(e.target.closest && e.target.closest('#gr-ans'))) stop = true; }, true);
  var go = function(){ if (!stop) w.playByVideoId(want, '', -1, false); };
  var pl = d.getElementById('sp-yt-player');
  if (pl) pl.addEventListener('load', function(){ go(); }, { once: true });
  go();
}

// 【2026-11-08】「この曲なんてジャンル？」の履歴に1件残す（地図の左の「履歴」に出る）。
// 残すのは答えを開き直すのに要るもの（曲名・歌手・ジャンル・答えの中身）。動画は開き直したときに探し直す（同じ曲はこのブラウザが覚えているので、検索は使わない）。
// 同じ曲をもう一度調べたら、前の記録を消して先頭に置く。最大15件（以前の履歴と同じ）。
function saveHist(w, p){
  try {
    var ls = w.localStorage, K = 'micHistory';
    var h = JSON.parse(ls.getItem(K) || '[]').filter(function(e){ return !(e.p && norm(e.title) === norm(p.t) && norm(e.artist) === norm(p.a)); });
    var keep = {}; ['t', 'a', 'g', 'src', 'v', 'by', 'en', 'via'].forEach(function(k){ if (p[k]) keep[k] = p[k]; });
    h.unshift({title: p.t, artist: p.a, genres: [disp(p.g)], g: p.g, p: keep, ts: Date.now()});
    ls.setItem(K, JSON.stringify(h.slice(0, 15)));
    if (typeof w.micRenderHistory === 'function') w.micRenderHistory();
  } catch(e) {}
}
var cur = 0;
function put(w, p){
  var my = ++cur, d = w.document, tries = 0;
  var old = d.getElementById('gr-ans'); if (old) old.remove();
  gReady.then(function(){
    saveHist(w, p);
    var timer = setInterval(function(){
      if (my !== cur || ++tries > 120) { clearInterval(timer); return; }    // 60秒であきらめる
      var nd = w._currentNode, body = d.getElementById('sp-body');
      if (!nd || nd.id !== p.g || !body || !d.querySelector('.yt-music-link')) return;
      clearInterval(timer);
      if (!d.getElementById('gr-ans-css')) { var st = d.createElement('style'); st.id = 'gr-ans-css'; st.textContent = CSS; d.head.appendChild(st); }
      var box = d.createElement('div'); box.id = 'gr-ans';
      // ジャンルのカテゴリーの色（説明パネルの「カテゴリ：」の点の色）で帯を染める
      var dot = d.querySelector('#sp-body .sp-cat-dot, .sp-cat-dot');
      var gc = dot && getComputedStyle(dot).backgroundColor;
      if (gc && gc !== 'rgba(0, 0, 0, 0)') box.style.setProperty('--gc', gc);
      var gs = sub(p.g);
      box.innerHTML =
        '<div class="eye">' + (p.via === 'mic' ? '聴き取った曲' : '調べた曲') + '</div>' +
        '<div class="song">「' + esc(p.t) + '」</div>' +
        (p.a ? '<div class="artist">' + esc(p.a) + '</div>' : '') +
        '<div class="ans"><span class="disc" aria-hidden="true"></span><div class="gl"><small>この曲のジャンルは</small>' +
        '<b class="gn">' + esc(disp(p.g)) + '</b>' + (gs ? '<span class="gs">' + esc(gs) + '</span>' : '') + '</div></div>' +
        '<div class="r2"><button type="button" class="btn qi" aria-expanded="false">なぜ ' + esc(disp(p.g)) + '？ ▾</button>' +
        '<button type="button" class="btn more">' + (p.via === 'mic' ? ICON_MIC + '別の曲を聴かせる' : ICON_SEARCH + '別の曲を調べる') + '</button></div>' +
        '<div class="why">' + whyHtml(p) + '</div>';
      box.querySelector('.qi').addEventListener('click', function(e){
        e.stopPropagation(); var o = box.classList.toggle('why-open'); this.setAttribute('aria-expanded', o ? 'true' : 'false');
        this.textContent = o ? '理由を閉じる ▴' : 'なぜ ' + disp(p.g) + '？ ▾';
      });
      // 「別の曲を…」は、地図の「この曲なんてジャンル？」のパネルを開く（ページは移らない）
      box.querySelector('.more').addEventListener('click', function(){
        if (typeof w.openMicPanel === 'function') { w.openMicPanel(); if (p.via !== 'mic' && typeof w.micSetMode === 'function') w.micSetMode('name'); }
      });
      var yw = d.getElementById('sp-yt-wrap');
      body.insertBefore(box, yw && yw.parentNode === body ? yw : body.firstChild);
      // 答えが見える位置まで、説明パネルを上へ戻す（下の方を読んでいた場合でも、答えが目に入るように）
      try { var spn = d.getElementById('side-panel'); if (spn) spn.scrollTop = 0; } catch(e) {}
      // 別のジャンルへ移ったら、帯は外す（その曲の答えではなくなるため）
      var watch = setInterval(function(){
        if (!d.getElementById('gr-ans')) { clearInterval(watch); return; }
        if (!w._currentNode || w._currentNode.id !== p.g) { clearInterval(watch); box.remove(); }
      }, 700);
      findVideo(p.t, p.a).then(function(v){ if (v && my === cur) playHit(w, d, v); });
    }, 500);
  });
}
window.GRBand = { put: put };
})();
