/**
 * audit_fragments.js — 検出された未登録語を「本当の漏れ」と「無視してよいもの」に仕分ける
 *
 * find_missing.js は本文から固有名詞を機械的に拾うため、以下が大量に混ざる:
 *   1. 長い名前が途中で切れた断片（例:「Through Silver in Blood」→「Blood」）
 *   2. 筆者が強調のために「」で括った日本語の言い回し（例:「揺れるグルーヴ」）
 * どちらも用語集に登録する必要はない。このツールはそれらを除外し、
 * 「正しい形も登録されておらず、本当に説明が出ない状態の語」だけを抽出する。
 *
 * 使い方: node tools/audit_fragments.js [--verbose]
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'genre_roots.html'), 'utf8');
eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'var NODES'));
eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'var GLOSSARY'));

const glossKeys = Object.keys(GLOSSARY);
const verbose = process.argv.includes('--verbose');

const LATIN_RE = /[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]*(?:\s+(?:of|the|de|del|la|le|du|von|van|und|and|&|di|da)\s+[A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]+|\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]*)*/g;

// 「」内が固有名詞（作品名・団体名）ではなく、筆者の言い回し・説明語である場合を判定する。
// 助詞や動詞の活用を含む＝文になっている＝固有名詞ではない、という考え方。
const JP_PHRASE = /[をがのにへとはでもや]|する|した|して|なる|った|ている|れる|られ|こと|よう/;
function isAuthorPhrase(s) {
  if (/[A-Za-z]/.test(s)) return false;          // ラテン文字を含むなら作品名の可能性が高い
  if (s.length >= 12) return true;               // 長い日本語は説明的な言い回し
  if (JP_PHRASE.test(s)) return true;            // 助詞・活用を含むなら文
  return false;
}

// 収集
const occurrences = new Map();   // 語 -> [{genre, context}]
let total = 0;
for (const n of NODES) {
  const text = n.desc + ' ' + n.roots_story;
  const latin = [...text.matchAll(LATIN_RE)].map(m => m[0].trim());
  const quoted = [...text.matchAll(/[「『]([^」』]{2,40})[」』]/g)].map(m => m[1]);
  for (const c of [...new Set([...latin, ...quoted])].filter(s => s.length > 1)) {
    if (glossKeys.includes(c)) continue;
    total++;
    const idx = text.indexOf(c);
    const around = text.slice(Math.max(0, idx - 45), idx + c.length + 45).replace(/\s+/g, ' ');
    if (!occurrences.has(c)) occurrences.set(c, []);
    occurrences.get(c).push({ genre: n.id, context: around });
  }
}

const allWords = [...occurrences.keys()];
const counts = { fragmentOfKey: 0, fragmentOfPeer: 0, authorPhrase: 0 };
const real = [];

for (const w of allWords) {
  // 1) 用語集の既存キーの一部分（例:「Blood」は「Through Silver in Blood」の一部）
  if (glossKeys.some(k => k !== w && k.includes(w))) { counts.fragmentOfKey++; continue; }
  // 2) 未登録語どうしで、より長い語の一部（例:「Papa's Got」は「Papa's Got a Brand New Bag」の一部）
  //    → 長い方だけを「本当の漏れ」として扱う
  if (allWords.some(o => o !== w && o.length > w.length && o.includes(w))) { counts.fragmentOfPeer++; continue; }
  // 3) 筆者の言い回し（固有名詞ではない）
  if (isAuthorPhrase(w)) { counts.authorPhrase++; continue; }
  real.push(w);
}

console.log('検出された未登録語（延べ）: ' + total + ' / 異なり ' + allWords.length);
console.log('  除外1 用語集の既存キーの断片   : ' + counts.fragmentOfKey);
console.log('  除外2 より長い未登録語の断片   : ' + counts.fragmentOfPeer);
console.log('  除外3 筆者の言い回し（固有名詞でない）: ' + counts.authorPhrase);
console.log('  ★ 本当の漏れ（説明が出ない状態）: ' + real.length);
console.log('');

if (real.length) {
  const sorted = real.map(w => [w, occurrences.get(w)]).sort((a, b) => b[1].length - a[1].length);
  console.log('--- 要追加 ---');
  for (const [word, occ] of sorted) {
    console.log(word + '  [' + occ.map(o => o.genre).slice(0, 4).join(',') + (occ.length > 4 ? '…' : '') + ']');
    if (verbose) console.log('    …' + occ[0].context + '…');
  }
}
