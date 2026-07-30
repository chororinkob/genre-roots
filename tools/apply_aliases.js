/**
 * apply_aliases.js — check_aliases.js が提案した別名を genre_roots.html に追記する
 *
 * 使い方:
 *   node tools/check_aliases.js --json > tools/alias_add.json
 *   （必要なら alias_add.json を手で編集して誤りを削る）
 *   node tools/apply_aliases.js
 *
 * 改行コードがCRLFのため、素朴な置換だと空振りする。既存の aliases 配列の
 * 末尾に挿入する形で追記し、1件も適用できなかった場合は例外を投げる。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const JSONF = path.join(__dirname, 'alias_add.json');

if (!fs.existsSync(JSONF)) {
  console.error('tools/alias_add.json がありません。先に check_aliases.js --json で作成してください。');
  process.exit(1);
}
const toAdd = JSON.parse(fs.readFileSync(JSONF, 'utf8'));
let html = fs.readFileSync(HTML, 'utf8');

let applied = 0, skipped = 0;
for (const [id, words] of Object.entries(toAdd)) {
  if (!words || !words.length) continue;
  // 対象ジャンルのブロックを特定する（{id:"xxx" から次の {id: まで）
  const start = html.indexOf('{id:"' + id + '"');
  if (start < 0) { console.log('  未検出: ' + id); skipped++; continue; }
  const next = html.indexOf('\n  {id:"', start + 5);
  const end = next < 0 ? html.length : next;
  const block = html.slice(start, end);

  const m = block.match(/aliases:\[([^\]]*)\]/);
  if (!m) { console.log('  aliases無し: ' + id); skipped++; continue; }

  const existing = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => x[1]);
  const fresh = words.filter(w => !existing.includes(w));
  if (!fresh.length) { skipped++; continue; }

  const newArr = 'aliases:[' + [...existing, ...fresh].map(w => JSON.stringify(w)).join(', ') + ']';
  const newBlock = block.replace(m[0], newArr);
  html = html.slice(0, start) + newBlock + html.slice(end);
  applied += fresh.length;
  console.log('  ' + id + ': +' + fresh.join(', '));
}

if (applied === 0) throw new Error('1件も追加できませんでした');
fs.writeFileSync(HTML, html);
console.log('');
console.log('追加した別名: ' + applied + '件 / スキップ ' + skipped + '件');
