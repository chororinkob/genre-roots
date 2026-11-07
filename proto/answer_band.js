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
function disp(id){ if (JA[id]) return JA[id]; var n = (G || []).find(function(x){ return x.id === id; }); return n ? n.name : id; }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function norm(s){ return String(s || '').toLowerCase().replace(/[\s\-_'’.&・()（）「」]/g, ''); }

var CSS = [
  '#gr-ans{position:relative;margin:0 0 10px;padding:10px 12px 8px;border:1px solid rgba(126,184,247,.35);border-radius:10px;',
  '  background:linear-gradient(180deg,rgba(126,184,247,.13),rgba(126,184,247,.05)),#1d1d36;line-height:1.6;font-size:13px;color:#e8e8f0}',
  '#gr-ans .q{font-size:14.5px;font-weight:700}',
  '#gr-ans .q b{color:#7eb8f7}',
  /* 【2026-11-08】「？」だけでは押してもらえないので、何が見られるかを書いたボタンにした（チョロさんの指示）。
     ジャンル名の下の行に置くので、曲名やジャンル名が長くても並びは崩れない */
  '#gr-ans .r2{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:6px}',
  '#gr-ans .qi{border:1px solid rgba(126,184,247,.6);border-radius:999px;background:rgba(126,184,247,.1);color:#cfe3ff;font:700 12px/1.4 inherit;padding:4px 12px;cursor:pointer}',
  '#gr-ans .qi:hover,#gr-ans .qi[aria-expanded=true]{background:rgba(126,184,247,.3);color:#fff}',
  '#gr-ans .why{display:none;font-size:12px;color:#d0d0e2;margin:8px 0 2px;padding:9px 11px;border-radius:7px;background:rgba(0,0,0,.28);line-height:1.7}',
  '#gr-ans.why-open .why{display:block}',
  '#gr-ans .why p{margin:0 0 6px}',
  '#gr-ans .why table{border-collapse:collapse;width:100%;font-size:11.5px;margin:2px 0 6px}',
  '#gr-ans .why td{padding:3px 4px;border-top:1px solid rgba(255,255,255,.08);vertical-align:top}',
  '#gr-ans .why td.v{white-space:nowrap;text-align:right;color:#fff}',
  '#gr-ans .why tr.use td{color:#9fd0ff;font-weight:700}',
  '#gr-ans .why .note{color:#a0a0b8;font-size:11px}',
  '#gr-ans .more{font-size:11.5px}',
  '#gr-ans .more a{color:#7eb8f7;cursor:pointer}',
  '.yt-music-link.gr-hit{outline:2px solid #7eb8f7;outline-offset:1px;border-radius:4px}'
].join('\n');

// 外の音楽データベース。記号（M・D・W・I・Z）は答えの住所にだけ入る。画面には「どんな種類のデータベースか」だけを書く。
// 並びは、ジャンルの付け方が細かい順（＝答えに採る順番）。
var SRC = [
  ['M', '音楽ファンが投票でジャンルを付けていく、世界最大級の音楽データベース'],
  ['D', 'レコード・CDの目録として作られた、世界中の盤を集めたデータベース'],
  ['W', 'ウィキペディアと同じ仲間の、だれでも編集できる知識のデータベース'],
  ['I', '大手の音楽配信ストアの売り場の分類'],
  ['Z', 'もう1つの音楽配信ストアの売り場の分類']
];
function whyHtml(p){
  var g = p.g, gn = esc(disp(g));
  if (p.src === 'db') {
    return '<p>この辞典では、曲のジャンルを<b>歌手ではなく1曲ずつ、曲調やメロディーで</b>判定して登録しています。' +
      '「' + esc(p.t) + '」もその1曲で、判定は「' + gn + '」です。</p>' +
      (p.en === '1' ? '<p>歌っているのは演歌の歌手ですが、この曲は曲調で判定して「' + gn + '」にしています（演歌は、浪曲や民謡につながる節回しで決めています）。</p>' : '') +
      '<p class="note">いま登録しているのは ' + (window.GRSong && GRSong.count() ? GRSong.count().toLocaleString() + '曲。' : '日本の曲を中心に約4,000曲。') + 'ここにない曲は、辞典の代表曲や、世界の音楽データベースから答えます。</p>';
  }
  if (p.src === 'rep') {
    return '<p>この曲は、辞典の「' + gn + '」のページで<b>代表曲</b>として紹介している曲です。そのため、辞典が登録しているジャンル「' + gn + '」で答えています。</p>' +
      '<p class="note">代表曲は、そのジャンルを代表する曲として辞典が選び、1曲ずつ確かめて載せたものです。下の「代表曲・アーティスト」から、同じジャンルのほかの曲も聴けます。</p>';
  }
  if (p.src === 'vote') {
    var said = {};
    (p.v || '').split('|').forEach(function(x){ var k = x.split(':'); if (k[0]) said[k[0]] = k[1]; });
    var rows = SRC.map(function(s){
      var v = said[s[0]], txt = !v ? 'ー' : v === 'none' ? '登録なし' : v === 'err' ? 'つながらず' : v === 'nogenre' ? 'ジャンルの記載なし' : '「' + esc(disp(v)) + '」';
      return '<tr' + (s[0] === p.by ? ' class="use"' : '') + '><td>' + esc(s[1]) + '</td><td class="v">' + txt + (s[0] === p.by ? '<br>← これを採用' : '') + '</td></tr>';
    }).join('');
    return '<p>この曲はまだ辞典に登録がないため、<b>世界の音楽データベース5つ</b>に問い合わせました。それぞれの答えは次のとおりです。</p>' +
      '<table>' + rows + '</table>' +
      '<p class="note">ジャンルの付け方が細かいデータベースから順に見て、最初にジャンルが書かれていた答えを採っています（大まかな「ポップス」より、細かい「' + gn + '」を優先するため）。</p>';
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
      box.innerHTML =
        '<div class="q">「' + esc(p.t) + '」（' + esc(p.a) + '）は <b>' + esc(disp(p.g)) + '</b></div>' +
        '<div class="r2"><button type="button" class="qi" aria-expanded="false">なぜ ' + esc(disp(p.g)) + ' ？ ▾</button>' +
        '<span class="more"><a role="button" tabindex="0">' + (p.via === 'mic' ? 'ほかの曲も聴かせる →' : 'ほかの曲も調べる →') + '</a></span></div>' +
        '<div class="why">' + whyHtml(p) + '</div>';
      box.querySelector('.qi').addEventListener('click', function(e){
        e.stopPropagation(); var o = box.classList.toggle('why-open'); this.setAttribute('aria-expanded', o ? 'true' : 'false');
        this.textContent = o ? '理由を閉じる ▴' : 'なぜ ' + disp(p.g) + ' ？ ▾';
      });
      // 「ほかの曲も…」は、地図の「この曲なんてジャンル？」のパネルを開く（ページは移らない）
      box.querySelector('.more a').addEventListener('click', function(){
        if (typeof w.openMicPanel === 'function') { w.openMicPanel(); if (p.via !== 'mic' && typeof w.micSetMode === 'function') w.micSetMode('name'); }
      });
      var yw = d.getElementById('sp-yt-wrap');
      body.insertBefore(box, yw && yw.parentNode === body ? yw : body.firstChild);
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
