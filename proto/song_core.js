/* 曲のジャンルを調べる共通部品（音楽ジャンルルーツ辞典）
   【2026-11-08 切り出し】これまで「曲名で調べる」ページ（song_name.html）の中にだけあった処理を、
   地図（genre_roots.html）のマイクパネルからも同じものを使えるように、このファイルに移した。中身は変えていない。
   ・GRSong.search(言葉, 一覧の箱, 案内の行, 曲を選んだときの処理) … あいまい検索の候補を出す
   ・GRSong.judge(曲名, 歌手名, 途中経過を出す処理) … ジャンルを決める（辞典のデータベース → 代表曲 → 外の音楽データベース）
   画面には、使っているデータベースの名前を出さない（まねされないため）。 */
(function(){
var BASE_DIR = (document.currentScript && document.currentScript.src || '/proto/song_core.js').replace(/[^\/]*$/, '');
var G = null;
fetch(BASE_DIR + 'genres.json').then(function(r){return r.json()}).then(function(x){G = x});
function norm(s){return String(s||'').toLowerCase().replace(/[\s\-_'’.&・]/g,'')}
function q(s){return '"' + String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"'}
function find(wgs){
  for (var i = 0; i < wgs.length; i++) {
    var w = norm(wgs[i].en), wj = norm(wgs[i].ja);
    var hit = G.find(function(n){
      var names = [n.name].concat(n.aliases || []).map(norm);
      return names.indexOf(w) >= 0 || (wj && names.indexOf(wj) >= 0);
    });
    if (hit) return {id: hit.id, wg: wgs[i].en || wgs[i].ja};
  }
  return null;
}
// ───────── 【2026-11-05 2版】5か所に同時に聞いて、多数決でジャンルを決める ─────────
// チョロさんの決定：どこか1か所を信じるのではなく、全部に聞いて「いちばん多かったジャンル」にする。
// 割れたときは、どこが何と言ったかを答えにそのまま書く。
// 聞く先（それぞれ1票）：辞典自身の代表曲／MusicBrainz／Wikidata／iTunes／Deezer。
// 同じ数のときは、日本の曲45曲のテスト（2026-11-05）で当たりが多かった順に優先する（この並び順）。
// Last.fm は曲ごとのタグが日本の曲にほぼ付いていない（Lemonでもゼロ）うえ、鍵が要るので、この試作では聞かない。
// 【2026-11-07】辞典の代表曲は先に findRep で調べるので、外に聞くのは4か所。並びは答えを採る優先順（PRIO と同じ）。
// 【2026-11-08 チョロさんの決定】Last.fm を先頭に足した（6か所）。理由は PRIO の説明を参照。
// 【2026-11-13 チョロさんの決定】日本語版ウィキペディアの曲の記事（情報の欄の「ジャンル」）を足した（8か所）。画面に名前は出さない（記号は P）
var ORDER = ['Wikipedia', 'Lastfm', 'MusicBrainz', 'Discogs', 'Wikidata', 'iTunes', 'Deezer'];
// 【2026-11-07 チョロさん】画面・アドレス欄には、使っているデータベースの名前を出さない（まねされないため）。
// 頭文字の記号だけを出す：M=MusicBrainz・D=Discogs・W=Wikidata・I=iTunes・Z=Deezer（答えのページも同じ記号で書く）。
// L=Last.fm（2026-11-08）
var CODE = {Wikipedia: 'P', Lastfm: 'L', MusicBrainz: 'M', Discogs: 'D', Wikidata: 'W', iTunes: 'I', Deezer: 'Z'};
// Discogsは合言葉（トークン）が要るので、ブラウザから直接ではなく、辞典のサーバーの中継（/genre/discogs）を通す。
// トークンはサーバーの中だけにあり、このページにも返事にも出てこない（2026-11-07）。
var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://genre-roots-server.onrender.com';
// 外の取り先が使う呼び名 → 辞典のジャンル（辞典の名前・別名で引けないものだけ）
var EXTRA = {'演歌':'enka','歌謡曲':'kayokyoku','ムード歌謡':'mood_kayo','ポップス':'jpop','japanesepop':'jpop','jballad':'jpop','jrock':'j_rock',
  // Discogsの呼び名（2026-11-07）
  'kayōkyoku':'kayokyoku','kayokyoku':'kayokyoku','anison':'anime_music','bossanova':'bossa_nova'};
var REP = null;
fetch(BASE_DIR + 'rep_index.json').then(function(r){return r.json()}).then(function(x){REP = x});
// 【2026-11-06】曲ごとのジャンルのデータベース（song_db.json：[曲名, 歌手, ジャンル番号, 判定者 c=チョロさん/k=クローディア]）。
// 歌手ごとの「お店の棚の分類」ではなく、曲そのもので判定したもの。ここに見つかれば、多数決はせずにこの判定で答える。
// 見つからない曲だけ、下の5か所の多数決で答える（チョロさんの決定 2026-11-06）。
var SDB = null;
fetch(BASE_DIR + 'song_db.json').then(function(r){return r.json()}).then(function(x){SDB = x});
// 【2026-11-13】歌手で決まる売り方の箱（アイドルとして売り出された人・シティ・ファンクの人）。{歌手の鍵: ['j_pop_idol', ...]}。
// データベースに無い曲（アルバムの曲など）を外のデータベースで答えたときも、その歌手なら箱を付ける（例：久保田利伸「流星のサドル」→ J-POP ＋ シティ・ファンク）。
// 読めなくても答えは出す（箱が付かないだけ）
var ASALES = {};
fetch(BASE_DIR + 'artist_sales.json').then(function(r){return r.json()}).then(function(x){ ASALES = x || {}; }).catch(function(){});
function akey(s){ return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
function addBoxes(p){
  var have = String(p.s || '').split(',').filter(Boolean);
  var names = [p.a].concat(String(p.a || '').split(/\s*(?:&|＆|,|、|\/|feat\.?|ft\.|featuring|with|×)\s*/i));
  names.forEach(function(n){ (ASALES[akey(n)] || []).forEach(function(b){ if (have.indexOf(b) < 0 && b !== p.g) have.push(b); }); });
  if (have.length) p.s = have.join(','); return p;
}
// 演歌も歌う歌手（データベースに演歌の曲が1曲でもある歌手）。この人の曲を歌謡曲・ムード歌謡と答えるときは、
// 「歌手で決めず、曲調で判定した」という注意書きを答えに添える（チョロさんの指示 2026-11-06）。
function enkaSinger(name){
  var k = norm(String(name).split(/[・&＆]/)[0]);
  return !!(SDB || []).find(function(x){ return x[2] === 'enka' && norm(String(x[1]).split(/[・&＆]/)[0]) === k; });
}
// 【2026-11-07】聴き取り（音紋照合）で返ってくる曲名は、後ろに版の名前が付いていたり（「怪獣の花唄 - replica -」
// 「不可逆リプレイス （re:rec）」「CHA-LA HEAD-CHA-LA (ドラゴンボールZ)」）、全角・半角が違ったり（ウィーアー！）する。
// データベースと照らし合わせる前に、後ろの（ ）と「 - ○○ - 」を外し、全角・半角をそろえる。
function dbNorm(s){ return norm(String(s || '').normalize('NFKC')).replace(/[!?！？…]/g, ''); }
function coreTitle(t){
  t = String(t || '').normalize('NFKC');
  t = t.replace(/\s*[\(\[（【][^\)\]）】]*[\)\]）】]\s*$/, '');
  t = t.replace(/\s+[-–]\s+.*$/, '');
  return t;
}
// 1文字だけ違う（中国の字が混ざった「宇宙戦舰ヤマト」など）。短い曲名は別の曲と取り違えやすいので4文字以上だけ
// 【2026-11-07 直し】1文字ちがい・1文字多い・1文字少ない、のどれかなら「1文字違い」とみなす。
// 「心を凍らせて」（正しくは「心凍らせて」）のように、1文字多く入れても見つかるようにする（チョロさんの試験で発覚）。
function oneOff(p, q){
  if (Math.min(p.length, q.length) < 4 || Math.abs(p.length - q.length) > 1) return false;
  if (p.length === q.length) { var d = 0; for (var i = 0; i < p.length; i++) if (p[i] !== q[i] && ++d > 1) return false; return d === 1; }
  var L = p.length > q.length ? p : q, S = p.length > q.length ? q : p;
  for (var k = 0; k < L.length; k++) if (L.slice(0, k) + L.slice(k + 1) === S) return true;
  return false;
}
function findDB(t, a){
  if (!SDB) return null;
  var nt = dbNorm(coreTitle(t)), na = dbNorm(a);
  if (!nt) return null;
  // ① 曲名がぴったり同じもの、② 頭が同じもの。歌手名はどちらかに含まれていればよい
  var ok = function(x){ var nra = dbNorm(x[1]); return !na || nra.indexOf(na) >= 0 || (nra && na.indexOf(nra) >= 0); };
  var hit = SDB.find(function(x){ return dbNorm(x[0]) === nt && ok(x); }) || SDB.find(function(x){ return dbNorm(x[0]).indexOf(nt) === 0 && ok(x); });
  if (hit) return hit;
  // ③ 曲名が1文字違い（「心を凍らせて」→「心凍らせて」）で、歌手名が合うもの。
  // 【2026-11-08 チョロさんの決定】以前は「日本語の曲名で、データベースにその曲名が1曲しかなければ、歌手名が違っても同じ曲とみなす」
  // 決まりがあった（ささきいさお／佐々木功 のような別名のため）。しかし「茜空／ちょろりんこぶ」が、データベースにある
  // 「茜空／レミオロメン」と同じ曲にされ、答えも動画もレミオロメンになった。同じ曲名の別の曲は世の中にとても多いので、
  // 歌手名が合わないものは同じ曲とみなさない。別名で返ってきた曲は、ここで見つからなくても、世界の音楽データベースで答えが出る。
  var c = SDB.filter(function(x){ var k = dbNorm(x[0]); return (k === nt || oneOff(k, nt)) && ok(x); });
  return c.length ? c[0] : null;
}
// 【2026-11-09 チョロさんの指示】歌手ごとの決まり。ここに書いた歌手の曲は、曲名がどう書かれていても（カタカナ・英語・版の名前つき）、
// 辞典にない曲でも、このジャンルで答える。外のデータベースには聞かない。
// YMO は日本で「テクノポップ」と呼ばれてきたが、海外の札はシンセポップになるため。名前は Apple 等に出てくる書き方をそろえて持つ。
// 共演（「○○ feat. YMO」）は、先頭の歌手だけを見るので対象にしない。
var ARTIST_RULE = {'yellowmagicorchestra': 'techno_kayo', 'ymo': 'techno_kayo', 'イエローマジックオーケストラ': 'techno_kayo'};
function artistRule(a){
  var main = String(a || '').split(/\s*(?:&|＆|,|、|\/|\bfeat\.?|\bft\.|\bfeaturing\b|\bwith\b|×)\s*/i)[0];
  return ARTIST_RULE[dbNorm(main)] || null;
}
function toId(name){
  var k = norm(name); if (!k || !G) return null;
  if (EXTRA[k]) return EXTRA[k];
  var hit = G.find(function(n){ return [n.name].concat(n.aliases || []).map(norm).indexOf(k) >= 0; });
  return hit ? hit.id : null;
}
// 同じ曲か：曲名が同じ（または頭が同じ）で、歌手名がどちらかに含まれる
function same(t, a, rt, ra){
  var nt = norm(t), nrt = norm(rt), na = norm(a), nra = norm(ra);
  return (nrt === nt || nrt.indexOf(nt) === 0) && (!na || nra.indexOf(na) >= 0 || (nra && na.indexOf(nra) >= 0));
}
// 1か所の答え（名前の並び）から、その取り先の1票を決める（いちばん多く出た辞典のジャンル）
function oneVote(names){
  var c = {}, first = {};
  names.forEach(function(x, i){ var id = toId(x); if (id) { c[id] = (c[id] || 0) + 1; if (!(id in first)) first[id] = i; } });
  var ids = Object.keys(c); if (!ids.length) return null;
  ids.sort(function(p, q2){ return c[q2] - c[p] || first[p] - first[q2]; });
  return ids[0];
}
function getJ(u){ return fetch(u).then(function(r){ if (!r.ok) throw r.status; return r.json(); }); }
// MusicBrainzは問い合わせが続くと「少し待って」（503）と断ることがあるので、2秒あけて2回まで聞き直す
function getMB(u, n){
  n = n || 0;
  return getJ(u).catch(function(e){ if (n >= 2) throw e; return wait(2000).then(function(){ return getMB(u, n + 1); }); });
}
function jsonp(u){
  return new Promise(function(ok, ng){
    var cb = 'jp' + Date.now() + Math.floor(Math.random() * 1e6), s = document.createElement('script');
    var to = setTimeout(function(){ ng('timeout'); }, 15000);
    window[cb] = function(d){ clearTimeout(to); delete window[cb]; s.remove(); ok(d); };
    s.onerror = function(){ clearTimeout(to); ng('error'); };
    s.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'output=jsonp&callback=' + cb; document.head.appendChild(s);
  });
}
function wait(ms){ return new Promise(function(ok){ setTimeout(ok, ms); }); }

// 各取り先：{found: 曲が見つかったか, vote: 辞典のジャンル番号 or null, raw: 取り先の言い方, name: 正式な歌手名}
var ASK = {
  // 【2026-11-13 チョロさんの指示】日本語版ウィキペディアの曲の記事。日本の曲は記事のほとんどにジャンル欄がある
  //   （データベースを作るときに数えた37,446件。約半分は「J-POP」だが、無いよりはよい＝チョロさん）。Wikidata は日本の曲にジャンルが入っていないことが多い。
  //   1. 曲名＋歌手名で記事を探す → 2. 記事の題名（「（曲）」などの付け足しを除く）が曲名と同じで、記事の頭の部分に歌手名がある記事だけ使う
  //   → 3. 情報の欄の「ジャンル」の行を読み、リンク・注釈を外して、言葉ごとに分ける
  'Wikipedia': function(t, a){
    if (!a) return Promise.resolve({found: false});
    var W = 'https://ja.wikipedia.org/w/api.php?origin=*&format=json&formatversion=2&';
    var nt = norm(t), na = norm(a);
    return getJ(W + 'action=query&list=search&srlimit=5&srnamespace=0&srsearch=' + encodeURIComponent(t + ' ' + a)).then(function(d){
      var cands = ((d.query || {}).search || []).map(function(x){ return x.title; }).filter(function(ti){
        var core = norm(ti.replace(/\s*[（(][^）)]*[）)]\s*$/, ''));
        return core === nt || (nt.length >= 4 && core.indexOf(nt) === 0);
      }).slice(0, 2);
      var tryOne = function(i){
        if (i >= cands.length) return {found: false};
        return getJ(W + 'action=parse&prop=wikitext&section=0&page=' + encodeURIComponent(cands[i])).then(function(x){
          var wt = ((x.parse || {}).wikitext) || '';
          if (!na || norm(wt).indexOf(na) < 0) return tryOne(i + 1);   // 歌手名が出てこない記事は、同じ題名の別の曲
          // 曲の情報の欄は、項目名が英語（「| Genre = 」）のことが多い（日本語版の「Infobox Single」）。両方読む
          var m = wt.match(/\|\s*(?:ジャンル|Genre)\s*=\s*([^\n]*)/i);
          if (!m) return {found: true, vote: null, raw: []};
          var g = m[1].replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1').replace(/\{\{[^|}]*\|?/g, '').replace(/\}\}/g, '');
          var raw = g.split(/<br\s*\/?>|[、,，\/／|｜\n]/).map(function(y){ return y.replace(/[（(][^）)]*[）)]/g, '').trim(); }).filter(Boolean);
          return {found: true, vote: oneVote(raw), raw: raw, by: '曲'};
        });
      };
      return tryOne(0);
    });
  },
  '辞典': function(t, a){
    var h = (REP || []).find(function(x){ return same(t, a, x[0], x[1]); });
    return Promise.resolve(h ? {found: true, vote: h[2], raw: [], name: h[1]} : {found: false});
  },
  'Wikidata': function(t, a){
    var sp = 'SELECT DISTINCT ?s ?pl ?pn ?en ?ja WHERE { VALUES ?lab { ' + q(t) + '@ja ' + q(t) + '@en } ' +
      '{?s rdfs:label ?lab} UNION {?s skos:altLabel ?lab} ' +
      '?s wdt:P175 ?p . {?p rdfs:label ?pl} UNION {?p skos:altLabel ?pl} FILTER(lang(?pl)="ja"||lang(?pl)="en") ' +
      'OPTIONAL{?p rdfs:label ?pn FILTER(lang(?pn)="ja")} ' +
      'OPTIONAL{?s wdt:P136 ?g . OPTIONAL{?g rdfs:label ?en FILTER(lang(?en)="en")} OPTIONAL{?g rdfs:label ?ja FILTER(lang(?ja)="ja")}} } LIMIT 300';
    return getJ('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sp)).then(function(d){
      var na = norm(a);
      // 歌手名は、どちらかがどちらかに含まれていればよい（「米津」→米津玄師、長い表記→短い登録名）
      var rows = d.results.bindings.filter(function(b){ var np = norm(b.pl.value); return !na || np.indexOf(na) >= 0 || (np && na.indexOf(np) >= 0); });
      if (!rows.length) return {found: false};
      var raw = [];
      rows.forEach(function(b){ ['en', 'ja'].forEach(function(k){ if (b[k] && raw.indexOf(b[k].value) < 0) raw.push(b[k].value); }); });
      return {found: true, vote: oneVote(raw), raw: raw, name: (rows[0].pn || rows[0].pl).value};
    });
  },
  'MusicBrainz': function(t, a){
    // MusicBrainzは「1秒に1回まで」の決まりがあるので、間を空けて順番に聞く
    var base = 'https://musicbrainz.org/ws/2/';
    return getMB(base + 'recording/?fmt=json&limit=10&query=' + encodeURIComponent('recording:"' + t + '" AND artist:"' + a + '"')).then(function(d){
      var recs = (d.recordings || []).filter(function(r){
        var ra = (r['artist-credit'] || []).map(function(c){ return (c.name || '') + ' ' + ((c.artist || {}).name || ''); }).join(' ');
        return same(t, a, r.title, ra) || (same(t, '', r.title, '') && norm(ra).indexOf(norm(a)) >= 0);
      }).slice(0, 2);
      if (!recs.length) return {found: false};
      var raw = [], chain = Promise.resolve();
      recs.forEach(function(r){
        chain = chain.then(function(){ return wait(1100); })
          .then(function(){ return getMB(base + 'recording/' + r.id + '?fmt=json&inc=genres+tags'); })
          .then(function(x){ (x.genres || []).concat(x.tags || []).forEach(function(g){ raw.push(g.name); }); });
      });
      return chain.then(function(){
        if (raw.length) return {found: true, vote: oneVote(raw), raw: raw, by: '曲'};
        // 曲にジャンルが無ければ、歌手のジャンルを使う
        var aid = recs[0]['artist-credit'][0].artist.id;
        return wait(1100).then(function(){ return getMB(base + 'artist/' + aid + '?fmt=json&inc=genres+tags'); }).then(function(x){
          var ar = (x.genres || []).concat(x.tags || []).map(function(g){ return g.name; });
          return {found: true, vote: oneVote(ar), raw: ar, by: '歌手'};
        });
      });
    });
  },
  // 【2026-11-08】Last.fm も鍵（APIキー）が要るので、Discogs と同じく辞典のサーバーの中継（/genre/lastfm）を通す。
  // 返ってくるのは、音楽ファンが曲（無ければ歌手）に付けた札（タグ）の名前だけ。
  'Lastfm': function(t, a){
    if (!a) return Promise.resolve({found: false});
    return getJ(API + '/genre/lastfm?' + new URLSearchParams({t: t, a: a})).then(function(d){
      if (!d.found) return {found: false, err: !!d.error};
      return {found: true, vote: oneVote(d.tags || []), raw: d.tags || [], by: d.by === 'artist' ? '歌手' : '曲'};
    });
  },
  'Discogs': function(t, a){
    return getJ(API + '/genre/discogs?' + new URLSearchParams({t: t, a: a})).then(function(d){
      if (!d.found) return {found: false, err: !!d.error};
      // 細かいスタイル（Viking Metal など）を先に、無ければ大分類（Rock など）で1票を決める
      var raw = (d.styles || []).concat(d.genres || []);
      return {found: true, vote: oneVote(d.styles || []) || oneVote(d.genres || []), raw: raw};
    });
  },
  'iTunes': function(t, a){
    return getJ('https://itunes.apple.com/search?country=JP&lang=ja_jp&media=music&entity=song&limit=25&term=' + encodeURIComponent(t + ' ' + a)).then(function(d){
      var rs = (d.results || []).filter(function(r){ return same(t, a, r.trackName, r.artistName); });
      if (!rs.length) return {found: false};
      var raw = rs.map(function(r){ return r.primaryGenreName; });
      return {found: true, vote: oneVote(raw), raw: raw};
    });
  },
  'Deezer': function(t, a){
    var pick = function(d){ return (d.data || []).filter(function(r){ return same(t, a, r.title, (r.artist || {}).name); }); };
    return jsonp('https://api.deezer.com/search?limit=25&q=' + encodeURIComponent('track:"' + t + '" artist:"' + a + '"')).then(function(d){
      var rs = pick(d);
      return rs.length ? rs : jsonp('https://api.deezer.com/search?limit=25&q=' + encodeURIComponent(t + ' ' + a)).then(pick);
    }).then(function(rs){
      if (!rs.length) return {found: false};
      var raw = [];
      // 【2026-11-08 直し】Deezer は日本の画面向けに、一般のポップス（Pop）を「ポップス」と日本語で返す。
      // 読み替え表（EXTRA）では「ポップス」を J-POP にしているため、マイケル・ジャクソンやビートルズまで J-POP になっていた。
      // 曲名にも歌手名にも日本の文字（ひらがな・カタカナ・漢字）が無い曲は、「ポップス」を一般のポップス（Pop）として数える。
      var jp = /[\u3040-\u30ff\u3400-\u9fff]/.test(t + a);
      return Promise.all(rs.slice(0, 3).map(function(r){ return jsonp('https://api.deezer.com/album/' + r.album.id); })).then(function(al){
        al.forEach(function(x){ ((x.genres || {}).data || []).forEach(function(g){ raw.push(!jp && g.name === 'ポップス' ? 'Pop' : g.name); }); });
        return {found: true, vote: oneVote(raw), raw: raw};
      });
    });
  }
};

// 【2026-11-07 チョロさんの決定】多数決をやめ、正確さの順に見て、最初にジャンルが書かれていた所の答えを使う。
// 順番：MusicBrainz（利用者の投票で細かいジャンルが付く。59曲のテストで曲を見つけた数が最多）→ Wikidata（載っていれば正確だが少ない）
//       → iTunes → Deezer（どちらもお店の棚の大まかな分類）。
// 多数決だと、細かいジャンル（バイキングメタル）が、大まかな答え2つ（ヘヴィメタル）に負けてしまっていた。
// 辞典の代表曲は、ここに来る前に別に調べて、入っていればそれで答える（findRep）。
// 【2026-11-07】Discogsを2番目に入れた（59曲で、MusicBrainzが外した細かいジャンル＝オペラ・サンバ・バイキングメタル・テキサスブルース・フナナ等をDiscogsが当てた）。
// 【2026-11-08 チョロさんの決定】Last.fm を先頭に入れた。海外の曲40曲のテストで、Last.fm 単独28曲正解（ほかの最高は Discogs の20曲）、
// 全体の答えは今までの順番の18曲 → Last.fm 先頭で30曲。日本の曲35曲でも8曲 → 10曲で、悪くならなかった。
// 最後に足しても前の4つが先に答えてしまい、正解は1曲も増えなかったので、先頭でないと意味がない。
var PRIO = ['Lastfm', 'MusicBrainz', 'Discogs', 'Wikidata', 'iTunes', 'Deezer'];
// 【2026-11-13】ウィキペディアは、日本の曲（曲名か歌手名に日本の文字がある）では最初に見る。海外の曲は、日本語版の記事のジャンルが
//   大まかなこと（「ロック」「ポップ」）が多く、Last.fm の細かい答え（40曲のテストで一番当たった）を上書きしないよう、Last.fm の次に見る
var PRIO_JP = ['Wikipedia'].concat(PRIO), PRIO_EN = ['Lastfm', 'Wikipedia'].concat(PRIO.slice(1));
function decide(res, jp){
  var P = jp ? PRIO_JP : PRIO_EN;
  for (var i = 0; i < P.length; i++) { var r = res[P[i]]; if (r && r.vote) return {id: r.vote, by: P[i]}; }
  return null;
}
// 【2026-11-07 チョロさんの決定】辞典の代表曲に入っている曲は、外に聞かずに、辞典が登録したジャンルで答える。
// 代表曲は知名度・メジャーさの順に並べてあるので、万一2つのジャンルに入っていたら、より前（上位）に置かれている方を使う。
function findRep(t, a){
  if (!REP) return null;
  var nt = dbNorm(coreTitle(t)), na = dbNorm(a); if (!nt || !na) return null;
  var pos = {}, best = null;
  REP.forEach(function(x){
    var g = x[2]; pos[g] = (pos[g] || 0) + 1;
    var rt = dbNorm(coreTitle(x[0])), ra = dbNorm(x[1]);
    // 曲名は、同じか、どちらかがどちらかを含んでいればよい（歌手名も合っていることが条件）。
    // 例：「Trem Das Onze」と代表曲の「O Trem das Onze」、「Rigoletto: "La Donna è Mobile"」と「La donna è mobile」、
    //     「DON'T STOP THE MUSIC」と「Don't Stop the Music 2006」（どれも59曲の通しテストで取りこぼしたもの）。
    //     短い曲名（4文字未満）は別の曲を含んでしまいやすいので、ぴったり同じときだけにする。
    if (rt !== nt && !(Math.min(rt.length, nt.length) >= 4 && (rt.indexOf(nt) >= 0 || nt.indexOf(rt) >= 0))) return;
    if (!(ra.indexOf(na) >= 0 || na.indexOf(ra) >= 0)) return;
    if (!best || pos[g] < best.n) best = {row: x, n: pos[g]};
  });
  return best ? best.row : null;
}


var ready = new Promise(function(ok){ (function w(){ if (G && REP && SDB) ok(); else setTimeout(w, 150); })(); });
function disp0(id){ var JA = {enka:'演歌', kayokyoku:'歌謡曲', mood_kayo:'ムード歌謡'}; if (JA[id]) return JA[id]; var n = (G || []).find(function(x){return x.id === id}); return n ? n.name : id; }
function gname(id){ return disp0(id); }
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function nz(s){
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); })
    .replace(/[\s\-_'’.&・!?！？…()（）「」]/g, '')
    .replace(/×/g, 'x');   // 「DAOKO×米津玄師」と「DAOKO x 米津玄師」を同じにする
}
// ① 辞典の曲から探す（曲名が同じ・頭が同じ・含む・1文字違い、または歌手名が含む）
function localHits(q){
  var k = nz(q); if (k.length < 2) return [];
  var seen = {}, out = [];
  [[SDB || [], 'db'], [REP || [], 'rep']].forEach(function(src){
    src[0].forEach(function(x){
      var t = nz(x[0]), a = nz(x[1]), sc = 0;
      if (t === k) sc = 100; else if (t.indexOf(k) === 0) sc = 80; else if (oneOff(t, k)) sc = 70;
      else if (k.length >= 2 && t.indexOf(k) > 0) sc = 50; else if (a === k) sc = 60; else if (k.length >= 2 && a.indexOf(k) >= 0) sc = 40;
      if (!sc) return;
      var key = t + '|' + a; if (seen[key]) return; seen[key] = 1;
      out.push({t: x[0], a: x[1], g: x[2], sc: sc + (src[1] === 'db' ? 1 : 0)});
    });
  });
  out.sort(function(p, q2){ return q2.sc - p.sc; });
  return out.slice(0, 8);
}
// ② 外の音楽データベースに聞く（同じ言葉は覚えておく）
var CACHE = {};
function ask(url){
  if (CACHE[url]) return CACHE[url];
  return CACHE[url] = fetch(url).then(function(r){ if (!r.ok) throw r.status; return r.json(); })
    .catch(function(e){ delete CACHE[url]; throw e; });
}
var IT = 'https://itunes.apple.com/search?country=JP&lang=ja_jp&media=music';
function remoteSongs(q){
  return ask(IT + '&entity=song&limit=40&term=' + encodeURIComponent(q)).then(function(d){
    var seen = {}, out = [];
    (d.results || []).forEach(function(r){
      var key = nz(r.trackName) + '|' + nz(r.artistName); if (seen[key]) return; seen[key] = 1;
      out.push({t: r.trackName, a: r.artistName, aid: r.artistId, img: r.artworkUrl60, y: (r.releaseDate || '').slice(0, 4), al: r.collectionName, g: r.primaryGenreName});
    });
    return out;
  });
}
function remoteArtists(q){
  return ask(IT + '&entity=musicArtist&limit=6&term=' + encodeURIComponent(q)).then(function(d){
    return (d.results || []).map(function(r){ return {id: r.artistId, name: r.artistName, genre: r.primaryGenreName}; });
  });
}
// 【2026-11-08 チョロさんの決定】Appleの音楽ストアの検索に断られたとき（同じWi-Fiの iPhone 1台だけで「人間椅子」が出なかった）は、
// もう1つの音楽ストア（Deezer）の検索で候補を出す。ジャンルを答えるときにもう使っているところで、鍵は要らない。
// Deezer の歌手の番号は、Apple の番号と混ざらないよう頭に「z」を付ける。発売年は検索の返事に入っていないので出さない。
function zSong(r){
  return {t: r.title, a: (r.artist || {}).name || '', aid: 'z' + (r.artist || {}).id, img: (r.album || {}).cover_small, y: '', al: (r.album || {}).title, g: ''};
}
function zSongs(q){
  return jsonp('https://api.deezer.com/search?limit=40&q=' + encodeURIComponent(q)).then(function(d){
    if (d.error) throw d.error;
    var seen = {}, out = [];
    (d.data || []).forEach(function(r){ var s = zSong(r), key = nz(s.t) + '|' + nz(s.a); if (seen[key]) return; seen[key] = 1; out.push(s); });
    return out;
  });
}
function zArtists(q){
  return jsonp('https://api.deezer.com/search/artist?limit=6&q=' + encodeURIComponent(q)).then(function(d){
    if (d.error) throw d.error;
    return (d.data || []).map(function(r){ return {id: 'z' + r.id, name: r.name, genre: ''}; });
  });
}
function artistSongs(ar){
  if (String(ar.id).charAt(0) === 'z') {
    // Deezer は同じ人が複数の番号に分かれて登録されていることがある（人間椅子は「人間椅子」と「Ningen Isu」の2つ）。
    // 「人気の曲」（artist/番号/top）は1曲しか返さないこともあったので、歌手名そのままでも曲を探し、名前か番号が合う曲を集める。
    // （「artist:"人間椅子"」の形の探し方は、日本語の名前だと0件になるので使わない）
    var zid = String(ar.id).slice(1), kn = nz(ar.name);
    return Promise.all([
      jsonp('https://api.deezer.com/artist/' + zid + '/top?limit=50').catch(function(){ return {}; }),
      jsonp('https://api.deezer.com/search?limit=100&q=' + encodeURIComponent(ar.name))
    ]).then(function(two){
      var d = {data: (two[0].data || []).concat(two[1].data || [])};
      if (!d.data.length && two[1].error) throw two[1].error;
      var seen = {}, out = [];
      (d.data || []).forEach(function(r){
        var A = r.artist || {};
        if (String(A.id) !== zid && nz(A.name) !== kn) return;
        var s = zSong(r), key = nz(s.t); if (seen[key]) return; seen[key] = 1; out.push(s);
      });
      return out;
    });
  }
  // 人の番号で、その人の曲を取る（名前で探すと、同じ名前の別の人や共演の曲が混ざるため）
  return ask('https://itunes.apple.com/lookup?country=JP&lang=ja_jp&entity=song&limit=60&id=' + ar.id).then(function(d){
    var seen = {}, out = [];
    (d.results || []).forEach(function(r){
      if (r.wrapperType !== 'track' || r.artistId !== ar.id) return;
      var key = nz(r.trackName); if (seen[key]) return; seen[key] = 1;
      out.push({t: r.trackName, a: r.artistName, img: r.artworkUrl60, y: (r.releaseDate || '').slice(0, 4), al: r.collectionName});
    });
    return out;
  });
}
// 辞典にある曲か（ジャンル名の印を付けるため）
function inDict(t, a){
  var kt = nz(t), ka = nz(a);
  var f = function(x){ var xa = nz(x[1]); return nz(x[0]) === kt && (xa.indexOf(ka) >= 0 || ka.indexOf(xa) >= 0); };
  return (SDB || []).find(f) || (REP || []).find(f);
}
(function(){
  try {
    var st = document.createElement('style');
    st.textContent = '.row .badges{flex:none;max-width:48%;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:2px 2px}' +
      '.row .badges .badge,#mic-name-out .row .badges .badge{max-width:none;flex:none;overflow:visible;text-overflow:clip}' +
      '.row .badges .plus{font-style:normal;font-size:10px;font-weight:700;color:#d8b25e;line-height:1}';
    (document.head || document.documentElement).appendChild(st);
  } catch(e) {}
})();
function songRow(s, mark){
  var d = mark ? null : inDict(s.t, s.a);
  var g = mark ? s.g : (artistRule(s.a) || (d && d[2]));
  // 【2026-11-13 チョロさんの指摘】「辞典で判定済みの曲」の段（mark）でも、スタイル（売り出し方）を出す。前はメインしか出ず、下の段と食い違っていた
  var dd = d || inDict(s.t, s.a);
  var gs = (dd && dd[4]) || [];
  var sub = s.a + (s.y ? '・' + s.y + '年' : '');
  return '<div class="row song" tabindex="0" data-t="' + esc(s.t) + '" data-a="' + esc(s.a) + '">' +
    (s.img ? '<img src="' + esc(s.img) + '" alt="" loading="lazy">' : '<span class="noimg"></span>') +
    '<div class="tx"><div class="t">' + esc(s.t) + '</div><div class="a">' + esc(sub) + '</div></div>' +
    // 【2026-11-08】印はジャンル名だけ（「辞典の判定あり：」は付けない。ジャンル名が出ていること自体が、辞典で判定済みの目印。チョロさんの指摘）
    // 【2026-11-13】売り方の箱があれば「J-POP ＋ アニソン」のように楕円を「＋」でつないで並べる（幅に収まらなければ折り返す）
    (g ? (gs.length ? '<span class="badges" title="この辞典の判定">' + [g].concat(gs).map(function(x, i){ return '<span class="badge">' + esc(i ? ({anime_music: 'アニソン', j_pop_idol: 'アイドル', city_pop: 'シティ・ポップ', aor: 'AOR', city_funk: 'シティ・ファンク', vgm: 'ゲーム音楽', film_score: '映画音楽', musical_theatre: 'ミュージカル', opera: 'オペラ', operetta: 'オペレッタ', bollywood: 'ボリウッド', cyberpunk_music: 'サイバーパンク', christmas_music: 'クリスマス音楽', ccm: 'CCM', adult_contemporary: 'アダルト・コンテンポラリー', urban_contemporary: 'アーバン・コンテンポラリー', quiet_storm: 'クワイエット・ストーム', classic_rock: 'クラシック・ロック', yacht_rock: 'ヨット・ロック', doujin_music: '同人音楽'}[x] || gname(x)) : gname(x)) + '</span>'; }).join('<i class="plus">＋</i>') + '</span>'
                    : '<span class="badge" title="この辞典の判定">' + esc(gname(g)) + '</span>') : '') + '</div>';
}

// ───── 候補の一覧を出す（以前の srRun・pick と同じ動き） ─────
var seq = 0;
// 【2026-11-08】候補をどこから出したか（Apple／Deezer／どちらもだめ）を、辞典のサーバーの統計に1回知らせる（チョロさんの指示）。
// 候補の検索はこの端末から直接 Apple・Deezer に聞いていて、サーバーを通らないため、知らせないと記録に残らない。
// 1文字打つごとに探し直すので、数が増えすぎないよう、ページを開いている間は同じ結果を1回だけ知らせる。失敗しても画面には何も出さない。
var told = {};
function tell(how){
  if (told[how]) return; told[how] = 1;
  try { fetch(API + '/api/log', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind: 'how', how: how}), keepalive: true}).catch(function(){}); } catch (e) {}
}
function search(q, out, st, onSong){
  var my = ++seq;
  q = String(q || '').trim();
  out.onclick = function(e){ var r = e.target.closest('.row'); if (r) pickRow(r, q, out, st, onSong); };
  out.onkeydown = function(e){ if (e.key === 'Enter') { var r = e.target.closest('.row'); if (r) pickRow(r, q, out, st, onSong); } };
  if (nz(q).length < 2) { out.innerHTML = ''; st.textContent = '2文字以上入れてください。'; return; }
  st.textContent = '探しています…';
  ready.then(function(){
    if (my !== seq) return;
    var loc = localHits(q);
    var html = '';
    if (loc.length) html += '<div class="sec"><h3>音楽ジャンルルーツ辞典で判定済みの曲<small>' + loc.length + '件</small></h3>' + loc.map(function(s){ return songRow(s, true); }).join('') + '</div>';
    out.innerHTML = html + '<div class="sec gr-rm"></div>';
    st.textContent = 'ほかの音楽データベースからも探しています…';
    // 【2026-11-08】外の音楽データベースは、短い時間に何度も聞くと、しばらく返事をしなくなる（1分に20回ほどが目安）。
    // 返事がなかったときは、3秒待ってから1回だけ聞き直す。
    var askBoth = function(){ return Promise.all([remoteSongs(q), remoteArtists(q)]); };
    // 【2026-11-08】Appleに断られたら、すぐに Deezer で探す。Deezer もだめなら、3秒待って Apple にもう1回だけ聞く。
    var askZ = function(){ return Promise.all([zSongs(q), zArtists(q)]); };
    var used = 'I';
    askBoth().catch(function(){ if (my !== seq) throw 'old'; used = 'Z'; return askZ(); })
      .catch(function(){ return new Promise(function(ok){ setTimeout(ok, 3000); }).then(function(){ if (my !== seq) throw 'old'; used = 'I'; return askBoth(); }); }).then(function(r){
      if (my !== seq) return;
      tell('cand_' + used);
      var all = r[0], songs = all.slice(0, 15), k = nz(q);
      // 人の候補：歌手の検索結果に、曲の検索結果に出てきた歌手（名前に入れた言葉を含む人）を足す。
      // 歌手の検索は、日本の歌手も英語の綴りで返すことがある（高山厳 → Takayama Gen）。曲の検索に同じ人（同じ番号）が
      // 日本語名で出ていれば、その名前に置き換える。
      var jp = {}; all.forEach(function(s){ if (!jp[s.aid] || nz(s.a) === k) jp[s.aid] = s.a; });
      var ars = r[1].map(function(x){ return {id: x.id, name: jp[x.id] || x.name, genre: x.genre}; }), ids = {};
      ars.forEach(function(x){ ids[x.id] = 1; });
      all.forEach(function(s){ if (!ids[s.aid]) { ids[s.aid] = 1; ars.push({id: s.aid, name: jp[s.aid], genre: s.g}); } });
      // Deezer で探したときは、同じ名前の人は1人にまとめる（同じ人が複数の番号に分かれて登録されているため）
      var zn = {}; ars = ars.filter(function(x){ if (String(x.id).charAt(0) !== 'z') return true; var k2 = nz(x.name); if (zn[k2]) return false; zn[k2] = 1; return true; });
      var exact = songs.some(function(s){ return nz(s.t) === k; }) || loc.some(function(s){ return nz(s.t) === k; });
      var h = '';
      var arHit = ars.filter(function(x){ var n = nz(x.name); return n.indexOf(k) >= 0 || (n.length >= 2 && k.indexOf(n) >= 0); })
        .sort(function(p, q2){ return (nz(q2.name) === k) - (nz(p.name) === k); }).slice(0, 5);
      if (arHit.length) h += '<div class="sec"><h3>この人ですか？<small>押すと、その人の曲が出ます</small></h3>' + arHit.map(function(x){
        return '<div class="row artist" tabindex="0" data-i="' + ars.indexOf(x) + '"><span class="noimg">🎤</span><div class="tx"><div class="t">' + esc(x.name) + '</div><div class="a">' + esc(x.genre || '') + '</div></div></div>';
      }).join('') + '</div>';
      if (songs.length) h += '<div class="sec"><h3>' + (exact ? 'どの曲をお探しですか？' : arHit.some(function(x){ return nz(x.name) === k; }) ? esc(q) + ' の曲など' : 'これのことですか？') + '<small>同じ名前の曲は、歌っている人ごとに並べています</small></h3>' + songs.map(function(s){ return songRow(s); }).join('') + '</div>';
      var rm = out.querySelector('.gr-rm'); if (rm) rm.outerHTML = h || '<div class="sec"></div>';
      st.textContent = (loc.length || songs.length || arHit.length) ? '曲を選ぶと、ジャンルを調べます。' : '見つかりませんでした。書き方を少し変えて試してください（ひらがな・カタカナ・英語など）。';
      out._ars = ars;
    }).catch(function(e){
      if (my !== seq) return;
      var rm = out.querySelector('.gr-rm'); if (rm) rm.remove();
      if (e !== 'old') tell('cand_fail');
      // 【2026-11-08 チョロさん】お客さん向けの文は短く。理由（外の音楽データベースが、続けて聞くとしばらく返事をしなくなる等）は書かない
      st.textContent = 'ほかの候補にアクセスできませんでした。少し待ってから、もう一度お試しください。';
    });
  });
}
function pickRow(el, q, out, st, onSong){
  if (el.classList.contains('song')) { ++seq; onSong(el.dataset.t, el.dataset.a); return; }
  if (!el.classList.contains('artist')) return;
  var ar = out._ars[+el.dataset.i], my = ++seq;
  st.textContent = '「' + ar.name + '」の曲を探しています…';
  artistSongs(ar).then(function(ss){
    if (my !== seq) return;
    out.innerHTML = '<div class="sec"><h3>' + esc(ar.name) + ' の曲<small>' + ss.length + '曲。どの曲をお探しですか？</small></h3>' + ss.map(function(s){ return songRow(s); }).join('') + '</div>';
    st.innerHTML = '<a href="#" class="back">← 候補の一覧に戻る</a>';
    st.querySelector('.back').onclick = function(e){ e.preventDefault(); search(q, out, st, onSong); };
  }).catch(function(){ st.textContent = '曲の一覧を取れませんでした。少し待ってから、もう一度押してください。'; });
}

// ───── ジャンルを決める（以前の送信ボタンの処理と同じ順番） ─────
// 答え：{ok:true, p:{t, a, g, src, v?, by?, en?}} または {ok:false, msg:'利用者向けの文'}
function judge(t, a, say){
  say = say || function(){};
  t = String(t || '').trim(); a = String(a || '').trim();
  return ready.then(function(){
    var ruled = artistRule(a);
    if (ruled) return {ok: true, p: addBoxes({t: coreTitle(t).trim() || t, a: a, g: ruled, src: 'artist'})};
    var hit = findDB(t, a);
    if (hit) {
      var q1 = {t: hit[0], a: hit[1], g: hit[2], src: 'db'};
      // 【2026-11-13】売り方の箱（アニソン・アイドル・シティ・ポップ等）。音楽性（g）に重ねて付く。住所に載せるので「,」でつなぐ
      if (hit[4] && hit[4].length) q1.s = hit[4].join(',');
      if ((hit[2] === 'kayokyoku' || hit[2] === 'mood_kayo') && enkaSinger(hit[1])) q1.en = '1';
      return {ok: true, p: addBoxes(q1)};
    }
    // 曲名の後ろの版の名前「(Re-Recorded)」「 - replica -」と、歌手名の共演者「& ○○」「feat. ○○」を外して探す
    t = coreTitle(t).trim() || t;
    a = String(a).split(/\s*(?:&|＆|,|、|\/|\bfeat\.?|\bft\.|\bfeaturing\b|\bwith\b|×)\s*/i)[0].trim() || a;
    var rep = findRep(t, a);
    if (rep) return {ok: true, p: addBoxes({t: rep[0], a: rep[1], g: rep[2], src: 'rep'})};
    var done = 0, res = {};
    var show = function(){ say('「' + t + '」のジャンルを調べています…'); };
    show();
    return Promise.all(ORDER.map(function(s){
      return ASK[s](t, a).catch(function(){ return {found: false, err: true}; }).then(function(r){ res[s] = r; done++; show(); });
    })).then(function(){
      var d = decide(res, /[぀-ヿ㐀-鿿]/.test(t + a));
      if (!d) {
        var any = ORDER.some(function(s){ return res[s].found; });
        // 【2026-11-08】お客さん向けの文は短く（理由の内訳は書かない）
        return {ok: false, msg: any ? '「' + t + '」のジャンルは見つかりませんでした。' : '「' + t + '」が見つかりませんでした。書き方を変えて試してください。'};
      }
      // 答えには正式な歌手名を出す（「米津」→「米津玄師」）
      var nm = (res['Wikidata'].found && res['Wikidata'].name) || a;
      var votes = ORDER.map(function(s){ var r = res[s]; return CODE[s] + ':' + (r.err ? 'err' : !r.found ? 'none' : (r.vote || 'nogenre')); }).join('|');
      return {ok: true, p: addBoxes({t: t, a: nm, g: d.id, src: 'vote', v: votes, by: CODE[d.by]})};
    });
  });
}
window.GRSong = { ready: ready, search: search, judge: judge, gname: gname, esc: esc, nz: nz, count: function(){ return (SDB || []).length; } };
})();
