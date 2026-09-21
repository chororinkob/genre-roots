// genre_roots.html の NODES/LINKS データから、ジャンル別の薄いページ(スタブ)589個と
// 新しい sitemap.xml、tools/README.md を生成する。
// 使い方: リポジトリのどこからでも `node tools/gen_stubs.js`（またはtools/の中から`node gen_stubs.js`）。
//   出力先はこのファイル自身の場所から辿るので、Genspark・チョロさん・クローディア、
//   誰のPCでも同じ結果になる（以前は Genspark の作業環境だけにある道 /tmp/opencode/... が
//   固定で書き込まれていて、ほかの人のPCでは動かなかった。2026-09-23、クローディアが修正）。
//   出力：<リポジトリ直下>/genre/*.html・sitemap.xml、tools/README.md（使い方の記録。
//   リポジトリのトップページ扱いになる README.md を上書きしないよう、道具の隣に置く）。
// アプリ本体 (genre_roots.html) は一切変更しない。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');           // このファイルは <リポジトリ>/tools/ にある
const SRC = path.join(ROOT, 'genre_roots.html');
const OUT = ROOT;                                   // 直接リポジトリ直下に書く（unzipして置き直す手間を無くす）
const SITE = 'https://genre-roots.com';
// 【2026-09-23、クローディアが修正】以前は日付が'2026-09-21'に固定されていて、
// いつ実行しても同じ日付がsitemap.xmlに書かれてしまっていた（次に実行する人が気づきにくい）。
// 実行した日をそのまま使う。
const TODAY = (() => {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
})();
const src = fs.readFileSync(SRC, 'utf8');

function extractArray(name) {
  const startTok = 'const ' + name + ' = [';
  const s = src.indexOf(startTok);
  if (s < 0) throw new Error(name + ' start not found');
  const from = s + startTok.length;
  let end = src.indexOf('\nconst ', from);
  if (end < 0) end = src.length;
  const seg = src.slice(from, end);
  const close = seg.lastIndexOf('];');
  if (close < 0) throw new Error(name + ' close not found');
  return new Function('return [' + seg.slice(0, close + 1) + ';')();
}

const NODES = extractArray('NODES');
const LINKS = extractArray('LINKS');
if (NODES.length < 500) throw new Error('NODES extraction failed: ' + NODES.length);
const byId = new Map(NODES.map(n => [n.id, n]));
const label = gid => { const g = byId.get(gid); return g ? String(g.label || '').replace(/\n/g, ' ') : null; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function metaFor(n) {
  const id = n.id;
  const 名 = String(n.label || '').replace(/\n/g, ' ');
  const 読み = (n.aliases || []).find(a => /^[ァ-ヴー・\s]+$/.test(a)) || '';
  const roots = LINKS.filter(l => l.t === id).map(l => ({ id: l.s, label: label(l.s) })).filter(x => x.label);
  const infl = LINKS.filter(l => l.s === id).map(l => ({ id: l.t, label: label(l.t) })).filter(x => x.label);
  let 差 = '';
  if (roots.length) 差 = roots.slice(0, 2).map(x => x.label).join('・') + 'から生まれた';
  else if (infl.length) 差 = infl.slice(0, 2).map(x => x.label).join('・') + 'に影響を与えた';
  const 名読み = 名 + (読み ? '（' + 読み + '）' : '');
  const T = (差 ? 名読み + 'とは？' + 差 + '音楽ジャンルの成り立ち' : 名読み + ' とは') + ' — 音楽ジャンルルーツ辞典';
  const D = String(n.desc || '').replace(/\s+/g, ' ').slice(0, 115);
  return { id, 名, 名読み, T, D, roots, infl, node: n };
}

function page(m) {
  const { id, 名, 名読み, T, D, roots, infl, node } = m;
  const era = esc(String(node.era || ''));
  const tracks = (node.rep_tracks || []).map(t => '<li>' + esc(t) + '</li>').join('');
  const rlinks = roots.slice(0, 8).map(x => '<a href="/genre/' + encodeURIComponent(x.id) + '.html">' + esc(x.label) + '</a>').join('、 ');
  const ilinks = infl.slice(0, 8).map(x => '<a href="/genre/' + encodeURIComponent(x.id) + '.html">' + esc(x.label) + '</a>').join('、 ');
  const ld = esc(JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: T, description: D, url: SITE + '/genre/' + id + '.html' }));
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(T)}</title>
<meta name="description" content="${esc(D)}">
<link rel="canonical" href="${SITE}/genre/${encodeURIComponent(id)}.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="音楽ジャンルルーツ辞典">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${esc(T)}">
<meta property="og:description" content="${esc(D)}">
<meta property="og:url" content="${SITE}/genre/${encodeURIComponent(id)}.html">
<meta property="og:image" content="${SITE}/ogp.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(T)}">
<meta name="twitter:description" content="${esc(D)}">
<meta name="theme-color" content="#1a1a2e">
<style>
html,body{margin:0;padding:0;height:100%;background:#1a1a2e;overflow:hidden}
#app{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;border:0}
.ns{color:#e8e8f0;font-family:"Segoe UI","Hiragino Kaku Gothic ProN",sans-serif;line-height:1.9;max-width:720px;margin:0 auto;padding:24px}
.ns a{color:#7eb8f7}
</style>
<script type="application/ld+json">${ld}</script>
</head>
<body>
<iframe id="app" src="/genre_roots.html?genre=${encodeURIComponent(id)}" title="${esc(T)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
<noscript><div class="ns">
<h1>${esc(名読み)}とは</h1>
<p>${esc(D)}</p>
<p>${esc(String(node.desc || ''))}</p>
${node.roots_story ? '<h2>成り立ち</h2><p>' + esc(String(node.roots_story)) + '</p>' : ''}
${tracks ? '<h2>代表曲</h2><ul>' + tracks + '</ul>' : ''}
${rlinks ? '<h2>ルーツ（影響を受けたジャンル）</h2><p>' + rlinks + '</p>' : ''}
${ilinks ? '<h2>影響を与えたジャンル</h2><p>' + ilinks + '</p>' : ''}
<p>地図で${esc(名読み)}のルーツをたどるには、JavaScriptを有効にして <a href="/genre_roots.html?genre=${encodeURIComponent(id)}">音楽ジャンルルーツ辞典</a> を開いてください。</p>
</div></noscript>
</body>
</html>
`;
}

fs.mkdirSync(path.join(OUT, 'genre'), { recursive: true });
const titles = new Set();
let total = 0;
for (const n of NODES) {
  const m = metaFor(n);
  if (titles.has(m.T)) console.error('WARN duplicate title:', m.T);
  titles.add(m.T);
  fs.writeFileSync(path.join(OUT, 'genre', m.id + '.html'), page(m), 'utf8');
  total++;
}

// ---- sitemap.xml ----
const url = (loc, lastmod, pri, freq) =>
  ' <url>\n  <loc>' + loc + '</loc>\n  <lastmod>' + lastmod + '</lastmod>\n  <changefreq>' + freq + '</changefreq>\n  <priority>' + pri + '</priority>\n </url>';
let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
sm += url(SITE + '/', TODAY, '1.0', 'daily');
sm += '\n' + url(SITE + '/genre_roots.html', TODAY, '1.0', 'daily');
sm += '\n' + url(SITE + '/docs/manual.html', TODAY, '0.5', 'monthly');
sm += '\n' + url(SITE + '/docs/about.html', TODAY, '0.3', 'monthly');
// 【2026-09-23、クローディアが追加】旧版の tools/sitemap/build.py にはあった
// docs/changes.html（更新の記録）が、この書き直しで漏れていた。noindexの無い
// 検索に出すページなので、docs/logic.md「検索に出す／出さないの意思表示」の
// 決まりどおり sitemap.xml にも載せる。
sm += '\n' + url(SITE + '/docs/changes.html', TODAY, '0.3', 'weekly');
sm += '\n' + url(SITE + '/song.html', TODAY, '0.8', 'monthly');
for (const n of NODES) sm += '\n' + url(SITE + '/genre/' + encodeURIComponent(n.id) + '.html', TODAY, '0.8', 'weekly');
sm += '\n</urlset>\n';
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sm, 'utf8');

// ---- tools/README.md（道具の使い方の記録。リポジトリ直下のREADME.mdは上書きしない） ----
fs.writeFileSync(path.join(__dirname, 'README.md'), `# ジャンル別ページ 589個の追加・再生成ツール（初版 2026-09-22、最終更新 ${TODAY}）

## これは何？
- \`genre/\` フォルダ：ジャンルごとの独立ページ（例: \`genre/jazz.html\`）
  - 各ページは Google 用の固有タイトル・説明文・canonical を持つ
  - 画面は今までの地図アプリそのもの（全画面表示・操作感も同一）
  - JavaScript無効環境向けに、ジャンル解説の全文がページ内テキストとして入っている
- \`sitemap.xml\`：\`?genre=\` URL から \`/genre/xxx.html\` URL への差し替え版（docs/changes.html は noindex のため除外）
- \`tools/gen_stubs.js\`：再生成スクリプト。ジャンルを追加・修正したら genre_roots.html を更新してから、
  リポジトリのどこからでも \`node tools/gen_stubs.js\` を実行すれば、genre/・sitemap.xml が
  **リポジトリ直下に直接**書き直される（2026-09-23〜。それより前の版は Genspark の作業環境の
  道が固定で書かれていて、ほかのPCでは動かなかった）

## 反映手順
1. \`node tools/gen_stubs.js\` を実行する（リポジトリ直下・tools/の中、どちらから実行してもよい）
2. \`git status\` で genre/・sitemap.xml の差分を確かめてから、いつも通りコミット＆push → Render が自動デプロイ
3. https://genre-roots.com/genre/jazz.html を開いて確認（タブ名が Jazz 専用になり、地図が開けばOK）
4. Search Console の「サイトマップ」で sitemap.xml を再送信（任意だが推奨）

## ロールバック
- \`git revert <コミット番号>\` で genre/ 追加前の状態に完全に戻る
- アプリ本体（genre_roots.html / index.html / docs/）はこのツールでは一切変更しない

## 今回やっていないこと（フェーズ2候補）
- 古い \`genre_roots.html?genre=xxx\` URL の canonical を新 URL に向ける1行修正（アプリ内JS）。
  やらないままでも Google は徐々に統合するが、やると統合が早くなる。様子を見てからでOK
`, 'utf8');

console.log('pages:', total, '| unique titles:', titles.size);
let bytes = 0;
for (const f of fs.readdirSync(path.join(OUT, 'genre'))) bytes += fs.statSync(path.join(OUT, 'genre', f)).size;
console.log('genre/ total bytes:', bytes);
console.log('sitemap urls:', (sm.match(/<url>/g) || []).length);
console.log('書き込み先:', ROOT);
