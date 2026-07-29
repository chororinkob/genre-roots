/**
 * check_quality.js — ジャンル解説の品質チェック（文字数・構文・用語集）
 *
 * 【この基準ができた経緯】
 * 2026-07-28、大量のジャンルを一度に書き直した際、件数が多くなるにつれて
 * 1件あたりの分量が無意識に削られ、後半が前半の1/3程度の薄さになる事故が起きた。
 * 「もう十分書いた」という書き手の主観は当てにならないため、機械的な下限を設けた。
 * 下限を割った場合は「このジャンルは書くことが少ない」のではなく
 * 「まだ知識を出し切れていない」と解釈し、追記してから次へ進むこと。
 *
 * 文字数に上限はない。多いほど良い、というのがチョロさんの明確な方針。
 *
 * 【使い方】
 *   node tools/check_quality.js              全ジャンルをチェック
 *   node tools/check_quality.js <ID...>      指定ジャンルのみ
 *   node tools/check_quality.js --new <ID>   新規登録時のチェック（用語集も含む）
 *
 * 終了コード 0 = 合格 / 1 = 不合格（CIや登録前チェックで使える）
 */
const fs = require('fs');
const path = require('path');

const MIN_DESC = 300;   // desc(音楽性の特徴) の下限文字数
const MIN_ROOTS = 500;  // roots_story(成り立ち) の下限文字数

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const html = fs.readFileSync(HTML, 'utf8');

let failed = false;

// --- 1. スクリプトブロックの構文チェック ---
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
blocks.forEach((m, i) => {
  try { new Function(m[1]); }
  catch (e) { console.log('[構文エラー] scriptブロック' + (i + 1) + ': ' + e.message); failed = true; }
});

eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'var NODES'));
eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'var GLOSSARY'));

// --- 2. GLOSSARY のキー重複チェック ---
const raw = html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0];
const rawKeys = [...raw.matchAll(/^\s{2}"((?:[^"\\]|\\.)*)":/gm)].map(m => m[1]);
const seen = new Set(), dupes = [];
rawKeys.forEach(k => { if (seen.has(k)) dupes.push(k); seen.add(k); });
if (dupes.length) { console.log('[用語集] キー重複: ' + dupes.join(', ')); failed = true; }

// --- 3. 文字数チェック ---
const args = process.argv.slice(2).filter(a => a !== '--new');
const targets = args.length ? NODES.filter(n => args.includes(n.id)) : NODES;
if (args.length && targets.length !== args.length) {
  const found = targets.map(n => n.id);
  args.filter(a => !found.includes(a)).forEach(a => { console.log('[未検出] ' + a + ' は NODES にありません'); failed = true; });
}

const below = targets.filter(n => n.desc.length < MIN_DESC || n.roots_story.length < MIN_ROOTS);
if (below.length) {
  console.log('[文字数] 基準未達 ' + below.length + '件 (desc>=' + MIN_DESC + ' / roots_story>=' + MIN_ROOTS + ')');
  below.slice(0, 30).forEach(n => console.log('  ' + n.id + ' desc:' + n.desc.length + ' roots:' + n.roots_story.length));
  if (below.length > 30) console.log('  ...他' + (below.length - 30) + '件');
  failed = true;
}

// --- 4. サマリ ---
const td = targets.reduce((s, n) => s + n.desc.length, 0);
const tr = targets.reduce((s, n) => s + n.roots_story.length, 0);
console.log('対象' + targets.length + '件 / 平均 desc ' + Math.round(td / targets.length) +
            '字・roots_story ' + Math.round(tr / targets.length) + '字 / 用語集 ' + rawKeys.length + '語');

if (!failed) console.log('OK: すべての基準を満たしています');
else console.log('NG: 上記を修正してください');

process.exit(failed ? 1 : 0);
