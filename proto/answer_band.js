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
// 【2026-11-13】売り方の箱（p.s：「anime_music,j_pop_idol」）。音楽性（p.g）に重ねて付く
// 売り方の箱は、短い日本語の名前で出す（地図の名前は英語のもの・別名が長いものがあるため）
var SALES_JA = {anime_music: 'アニソン', j_pop_idol: 'アイドル', city_pop: 'シティ・ポップ', aor: 'AOR', city_funk: 'シティ・ファンク'};
function dispS(id){ return SALES_JA[id] || disp(id); }
function sales(p){ return String(p.s || '').split(',').filter(function(x){ return x && x !== p.g; }); }
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
  /* 【2026-11-13】音楽性＋売り方の箱を楕円で並べる。最初の楕円（音楽性）はジャンルの色で光らせ、あとの楕円は少し小さく。幅に収まらなければ折り返す */
  '#gr-ans .gl{flex:1 1 auto}',
  '#gr-ans .gset{display:flex;flex-wrap:wrap;align-items:center;gap:6px 6px;margin-top:3px}',
  '#gr-ans .gp{display:inline-block;max-width:100%;font-size:20px;font-weight:800;line-height:1.2;color:#fff;padding:3px 12px;border-radius:999px;word-break:break-word;',
  '  border:1.5px solid color-mix(in srgb,var(--gc) 75%,transparent);background:color-mix(in srgb,var(--gc) 18%,transparent);text-shadow:0 0 10px color-mix(in srgb,var(--gc) 70%,transparent)}',
  '#gr-ans .gp2{font-size:15px;font-weight:700;padding:3px 11px;border-color:rgba(216,178,94,.6);background:rgba(216,178,94,.14);color:#f3dfae;text-shadow:none}',
  '#gr-ans .plus{font-style:normal;font-size:16px;font-weight:800;color:#d8b25e;line-height:1}',
  /* 【2026-11-13 チョロさんの指示】1行に収まらないときは、縦に積む（音楽性の楕円の下に「＋」、その下に次の楕円）。「＋」が行の右端に残って右が空くのを防ぐ */
  '#gr-ans .gset.stack{display:inline-flex;flex-direction:column;align-items:center;gap:4px}',
  /* 【2026-11-13 チョロさんの決定】ジャンルは2種類。「メイン」（音楽性・1曲に1つ）と「スタイル」（売り出し方・使われ方・いくつでも重なる）。
     どちらもジャンルだと分かるように、2段を「ジャンル」の枠で囲む（枠の上の線に「ジャンル」の見出しを乗せる） */
  '#gr-ans .gbox{position:relative;margin-top:10px;border:1px solid color-mix(in srgb,var(--gc) 45%,rgba(255,255,255,.2));border-radius:12px;padding:14px 10px 10px;display:grid;grid-template-columns:auto 1fr;gap:8px 10px;align-items:center}',
  '#gr-ans .gbox-t{position:absolute;top:0;left:12px;transform:translateY(-50%);padding:0 6px;background:#1e1e37;font-size:11.5px;font-weight:700;letter-spacing:.12em;color:#d8d8ec}',
  '#gr-ans .glab{font-size:11.5px;font-weight:700;letter-spacing:.06em;color:#b8b8d0;white-space:nowrap}',
  '#gr-ans .glab small{display:block;font-size:9.5px;font-weight:400;letter-spacing:0;color:#8f8fae;margin-top:1px}',
  '#gr-ans .gvals{display:flex;flex-wrap:wrap;gap:6px;min-width:0}',
  '#gr-ans .gvals .gp2{white-space:nowrap;font-size:14px;padding:3px 9px}',   /* 札の中では折り返さない（「シティ・ポップ」が2行に割れていた）。入らなければ札ごと次の行へ */
  '#gr-ans button.gp{font-family:inherit;cursor:pointer;transition:background .15s,box-shadow .15s}',
  '#gr-ans button.gp:not(.on):hover{background:rgba(255,255,255,.14);box-shadow:0 0 0 2px rgba(216,178,94,.35)}',
  '#gr-ans button.gp.on{cursor:default;box-shadow:0 0 0 2px color-mix(in srgb,var(--gc) 55%,transparent),0 0 14px color-mix(in srgb,var(--gc) 45%,transparent)}',
  '#gr-ans button.gp:focus-visible{outline:2px solid #fff;outline-offset:2px}',
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
//   辞典 = 曲ごとの判定31,554曲 ＋ 代表曲8,586曲（重なりを除いて39,919曲・2026-11-13に数えた。以前は4,166曲＋8,595曲＝12,586曲）
//   M = 公式の統計ページの録音数 40,876,279（2026-11-08）／I = 2022年10月の公式発表「1億曲」／Z = 公式ニュースの「1億2,000万曲以上」
//   D・W は、曲の数の公式な数字が見つからなかったので書かない。
var SRC = [
  ['R', '音楽ジャンルルーツ辞典（曲ごとに判定している場合もあります）', '約4万曲'],
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
// 【2026-11-13】辞典のデータベース以外で答えたときも、歌手で決まる売り方の箱が付いたら、その説明を添える
function whyHtml(p){
  var h = whyHtml0(p);
  if (p.src !== 'db' && sales(p).length) h += '<p class="note">スタイルの' + sales(p).map(function(x){ return '「' + esc(dispS(x)) + '」'; }).join('') + 'は、歌っている人で決まる売り出し方のジャンルです（この辞典の判定）。メインのジャンルに重ねて付けています。</p>';
  return h;
}
function whyHtml0(p){
  var g = p.g, gn = esc(disp(g));
  var HEAD = '<p>7つの音楽データベース（2億6,000万曲以上）を上から順に見て、最初にジャンルが分かったものを答えにしています。</p>';
  if (p.src === 'db') {
    return HEAD + srcList('R', {R: 'メイン「' + gn + '」' + (sales(p).length ? '・スタイル' + sales(p).map(function(x){ return '「' + esc(dispS(x)) + '」'; }).join('') : '')}) +
      (sales(p).length ? '<p class="note">ジャンルは2種類です。メインは音楽性のジャンルで、1曲に1つだけです。スタイルは、曲の売り出し方・使われ方のジャンル（アニメの主題歌・挿入歌、アイドルとして売り出された人、など）で、いくつでも重ねて付きます。</p>' : '') +
      (p.en === '1' ? '<p class="note">歌っているのは演歌の歌手ですが、この曲は曲調で判定して「' + gn + '」にしています。</p>' : '');
  }
  if (p.src === 'rep') {
    return HEAD + srcList('R', {R: '「' + gn + '」の代表曲'});
  }
  if (p.src === 'artist') {
    return HEAD + srcList('R', {R: 'この歌手の曲はすべて「' + gn + '」'});
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
    var keep = {}; ['t', 'a', 'g', 's', 'src', 'v', 'by', 'en', 'via'].forEach(function(k){ if (p[k]) keep[k] = p[k]; });
    h.unshift({title: p.t, artist: p.a, genres: [disp(p.g)].concat(sales(p).map(dispS)), g: p.g, p: keep, ts: Date.now()});
    ls.setItem(K, JSON.stringify(h.slice(0, 15)));
    if (typeof w.micRenderHistory === 'function') w.micRenderHistory();
  } catch(e) {}
}
var cur = 0;
function put(w, p, view){
  view = view || p.g;
  var my = ++cur, d = w.document, tries = 0;
  var old = d.getElementById('gr-ans'); if (old) old.remove();
  gReady.then(function(){
    if (view === p.g) saveHist(w, p);   // 楕円を押して別のジャンルへ移ったときは、履歴に足さない
    var timer = setInterval(function(){
      if (my !== cur || ++tries > 120) { clearInterval(timer); return; }    // 60秒であきらめる
      var nd = w._currentNode, body = d.getElementById('sp-body');
      if (!nd || nd.id !== view || !body || !d.querySelector('.yt-music-link')) return;
      clearInterval(timer);
      if (!d.getElementById('gr-ans-css')) { var st = d.createElement('style'); st.id = 'gr-ans-css'; st.textContent = CSS; d.head.appendChild(st); }
      var box = d.createElement('div'); box.id = 'gr-ans';
      // ジャンルのカテゴリーの色（説明パネルの「カテゴリ：」の点の色）で帯を染める
      var dot = d.querySelector('#sp-body .sp-cat-dot, .sp-cat-dot');
      var gc = dot && getComputedStyle(dot).backgroundColor;
      if (gc && gc !== 'rgba(0, 0, 0, 0)') box.style.setProperty('--gc', gc);
      // 【2026-11-13 チョロさんの指示】ジャンルの名前は1つだけ出す（もう1つの呼び方「ニューミュージック」等は出さない。2つ並ぶと何の説明か分からない）。
      // 楕円はボタンにして、押すとそのジャンルの説明へ移る（曲は流したまま）。いま見ているジャンルの楕円を光らせる
      var all = [p.g].concat(sales(p));
      var vname = view === p.g ? disp(p.g) : dispS(view);
      var pill = function(x, i){
        return '<button type="button" class="gp' + (i ? ' gp2' : ' gn') + (x === view ? ' on' : '') + '" data-g="' + esc(x) + '"' +
          (x === view ? ' aria-current="true"' : ' title="「' + esc(i ? dispS(x) : disp(x)) + '」の説明を見る"') + '>' + esc(i ? dispS(x) : disp(x)) + '</button>';
      };
      box.innerHTML =
        '<div class="eye">' + (p.via === 'mic' ? '聴き取った曲' : '調べた曲') + '</div>' +
        '<div class="song">「' + esc(p.t) + '」</div>' +
        (p.a ? '<div class="artist">' + esc(p.a) + '</div>' : '') +
        // 【2026-11-13 チョロさんの決定】「ジャンル」の枠の中に、メイン（必ず1つ）とスタイル（0〜いくつでも）を段に分けて出す。
        //   前は「J-POP ＋ アイドル」と「＋」でつないでいたが、どれが音楽性でどれが売り出し方か、ひと目で分からなかった
        '<div class="ans"><span class="disc" aria-hidden="true"></span><div class="gl">' +
        '<div class="gbox"><span class="gbox-t">ジャンル</span>' +
        '<span class="glab">メイン</span><div class="gvals">' + pill(p.g, 0) + '</div>' +
        (sales(p).length ? '<span class="glab">スタイル</span><div class="gvals">' + sales(p).map(function(x){ return pill(x, 1); }).join('') + '</div>' : '') +
        '</div></div></div>' +
        // 【2026-11-13 チョロさんの指摘】「なぜ ○○？」は、いま見ているジャンルの名前にする（シティ・ポップへ移ったら「なぜ シティ・ポップ？」）
        '<div class="r2"><button type="button" class="btn qi" aria-expanded="false">なぜ ' + esc(vname) + '？ ▾</button>' +
        '<button type="button" class="btn more">' + (p.via === 'mic' ? ICON_MIC + '別の曲を聴かせる' : ICON_SEARCH + '別の曲を調べる') + '</button></div>' +
        '<div class="why">' + whyHtml(p) + '</div>';
      [].forEach.call(box.querySelectorAll('.gbox .gp'), function(b){
        b.addEventListener('click', function(e){
          e.stopPropagation();
          var x = b.getAttribute('data-g');
          if (x === view || typeof w.grOpenGenre !== 'function') return;
          w.grOpenGenre(x);
          put(w, p, x);
        });
      });
      box.querySelector('.qi').addEventListener('click', function(e){
        e.stopPropagation(); var o = box.classList.toggle('why-open'); this.setAttribute('aria-expanded', o ? 'true' : 'false');
        this.textContent = o ? '理由を閉じる ▴' : 'なぜ ' + vname + '？ ▾';
      });
      // 「別の曲を…」は、地図の「この曲なんてジャンル？」のパネルを開く（ページは移らない）
      box.querySelector('.more').addEventListener('click', function(){
        if (typeof w.openMicPanel === 'function') { w.openMicPanel(); if (p.via !== 'mic' && typeof w.micSetMode === 'function') w.micSetMode('name'); }
      });
      // 楕円が1行に収まらず折り返したら、縦に積む形に切り替える（パネルの幅が変わったら測り直す）
      var gset = null;   // 【2026-11-13】「＋」でつなぐ並べ方をやめたので、縦に積む切り替えは使わない
      var fit = function(){
        if (!gset) return;
        gset.classList.remove('stack');
        var ps = gset.querySelectorAll(':scope > .gp');
        if (ps.length > 1 && ps[ps.length - 1].offsetTop >= ps[0].offsetTop + ps[0].offsetHeight - 2) gset.classList.add('stack');   // 最後の楕円が、最初の楕円より下の行にある＝折り返した
      };
      var yw = d.getElementById('sp-yt-wrap');
      body.insertBefore(box, yw && yw.parentNode === body ? yw : body.firstChild);
      fit();
      // 測り直すのはパネルの横幅が変わったときだけ（縦に積むと帯の高さが変わるので、帯そのものを見張ると測り直しが繰り返される）
      try { var lastW = body.clientWidth; if (gset && w.ResizeObserver) new w.ResizeObserver(function(){ if (body.clientWidth !== lastW) { lastW = body.clientWidth; fit(); } }).observe(body); } catch(e) {}
      // 答えが見える位置まで、説明パネルを上へ戻す（下の方を読んでいた場合でも、答えが目に入るように）
      try { var spn = d.getElementById('side-panel'); if (spn) spn.scrollTop = 0; } catch(e) {}
      // 別のジャンルへ移ったら、帯は外す（その曲の答えではなくなるため）
      var watch = setInterval(function(){
        if (!d.getElementById('gr-ans')) { clearInterval(watch); return; }
        if (!w._currentNode || w._currentNode.id !== view) { clearInterval(watch); if (box.parentNode) box.remove(); }
      }, 700);
      findVideo(p.t, p.a).then(function(v){ if (v && my === cur) playHit(w, d, v); });
    }, 500);
  });
}
window.GRBand = { put: put };
})();
