/**
 * audit_glossary_keys.js — 用語集の見出し語そのものの妥当性を調べる
 *
 * 【なぜ必要か】
 * これまでの検査は「説明が足りているか」しか見ていなかった。
 * しかし逆の事故がある。見出し語が短すぎたり一般的すぎたりすると、
 * 関係のない文字列の内側に一致してしまい、本文のあちこちに
 * 見当違いのツールチップが出る。
 *
 * 実例（2026-08-05にパンソリで発覚）:
 *   本文「17世紀から18世紀の朝鮮半島」の「17」に、
 *   まったく別の意味の説明が出ていた。
 *   パンソリで説明が出る語は「17」「ラム」「映像」の3語だけで、
 *   全羅道・巫俗・申在孝といった本来説明すべき語は素通りだった。
 *
 * 【何を見るか】
 *   (1) 見出しが短すぎる語（2文字以下、数字のみ）
 *   (2) 多くのジャンルに一致しすぎる語（一般語の可能性）
 *   (3) 他の見出し語の内側に含まれてしまう語
 *
 * 【使い方】
 *   node tools/audit_glossary_keys.js          要注意のものだけ
 *   node tools/audit_glossary_keys.js --all    全件
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const html = fs.readFileSync(HTML, 'utf8');
let NODES; eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'NODES'));
let GLOSSARY; eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'GLOSSARY'));

const keys = Object.keys(GLOSSARY);
const texts = NODES.map(n => ({
  id: n.id,
  label: (n.label || n.id).replace(/\n/g, ' '),
  text: (n.desc || '') + ' ' + (n.roots_story || ''),
}));

// 各見出し語が、何ジャンルの本文に一致するかを数える
const hitCount = new Map();
for (const k of keys) {
  let c = 0;
  for (const t of texts) if (t.text.includes(k)) c++;
  hitCount.set(k, c);
}

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const problems = [];

// (1) 短すぎる見出し
const tooShort = keys.filter(k => k.length <= 2);
// (2) 数字だけの見出し
const numeric = keys.filter(k => /^[0-9０-９.\-]+$/.test(k));
// (3) 一致しすぎる見出し（全565件の1割超）
const overMatch = keys.filter(k => hitCount.get(k) > 56 && k.length <= 6);
// (4) 他の見出し語の内側に完全に含まれる短い語
const swallowed = keys.filter(k =>
  k.length <= 4 && keys.some(o => o !== k && o.includes(k)));

function show(title, list, note) {
  console.log('');
  console.log('【' + title + '】' + list.length + '語' + (note ? '  ' + note : ''));
  const lim = showAll ? list.length : 25;
  list.sort((a, b) => hitCount.get(b) - hitCount.get(a)).slice(0, lim).forEach(k => {
    const d = String(GLOSSARY[k]).slice(0, 46);
    console.log('  "' + k + '"'.padEnd(3) + '  ' + String(hitCount.get(k)).padStart(3) +
                'ジャンルに一致  → ' + d);
  });
  if (!showAll && list.length > lim) console.log('  ...他' + (list.length - lim) + '語');
}

console.log('用語集 ' + keys.length + '語 / ジャンル ' + texts.length + '件');

show('見出しが2文字以下', tooShort, '短い語は無関係な文字列の内側に一致しやすい');
show('見出しが数字だけ', numeric, '本文中の年号や数値に誤って一致する');
show('多くのジャンルに一致しすぎ（6文字以下で57件以上）', overMatch, '一般語の可能性');
show('他の見出し語の内側に含まれる4文字以下の語', swallowed, '長い語が優先されるため実害は小さいが要確認');

const risky = [...new Set([...tooShort, ...numeric, ...overMatch])];
console.log('');
console.log('要確認の見出し語（重複を除く）: ' + risky.length + '語');
console.log('');
if (risky.length === 0) {
  console.log('OK: 問題のある見出し語は見つかりませんでした');
  process.exit(0);
}
console.log('NG: 上記を確認し、不適切なものは用語集から削除すること');
process.exit(1);
