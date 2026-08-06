/**
 * remove_gloss.js — 用語集(GLOSSARY)から見出し語を削除する
 *
 * 【なぜ必要か】
 * 見出しが短すぎたり、たまたま普通の単語と同じ形をしていたりすると、
 * 関係のない文字列の内側に一致して、本文のあちこちに見当違いの説明が出る。
 * 例:「ラム」(モーラム由来のラオ語)を登録した結果、436箇所の
 * 「ドラム」「バスドラム」に、ラオ語の説明が出ていた（2026-08-05発覚）。
 *
 * add_gloss.js と同じく、genre_roots.html は改行コードが CRLF のため、
 * その場かぎりの置換スクリプトを書くと無言で空振りする。必ずこれを使うこと。
 *
 * 【使い方】
 *   1. tools/gloss_remove.json に削除したい見出しを配列で書く
 *      ["ラム", "モー", "ブルー"]
 *   2. node tools/remove_gloss.js
 *
 * 存在しない見出しは黙って飛ばす。1件も消せなかった場合はエラーで止まる。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'genre_roots.html');
const LIST = path.join(__dirname, 'gloss_remove.json');

if (!fs.existsSync(LIST)) {
  console.error('gloss_remove.json が見つかりません: ' + LIST);
  process.exit(1);
}
const targets = JSON.parse(fs.readFileSync(LIST, 'utf8'));
if (!Array.isArray(targets) || targets.length === 0) {
  console.error('削除対象が空です');
  process.exit(1);
}

let html = fs.readFileSync(FILE, 'utf8');
const m = html.match(/const GLOSSARY = \{[\s\S]*?\n\};/);
if (!m) {
  console.error('GLOSSARY ブロックが見つかりません');
  process.exit(1);
}
const block = m.group ? m.group(0) : m[0];
const nl = block.includes('\r\n') ? '\r\n' : '\n';
const lines = block.split(nl);

const esc = (t) => t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const wanted = new Set(targets.map(esc));

const kept = [];
const removed = [];
for (const line of lines) {
  const km = line.match(/^  "((?:[^"\\]|\\.)*)":/);
  if (km && wanted.has(km[1])) {
    removed.push(km[1]);
    continue;
  }
  kept.push(line);
}

if (removed.length === 0) {
  console.error('1件も削除できませんでした（見出しが一致していない可能性があります）');
  process.exit(1);
}

const newBlock = kept.join(nl);
html = html.replace(block, newBlock);
fs.writeFileSync(FILE, html, 'utf8');

const notFound = targets.filter(t => !removed.includes(esc(t)));
console.log('removed ' + removed.length + ' / not found ' + notFound.length);
console.log('  削除: ' + removed.join('、'));
if (notFound.length) console.log('  見つからず: ' + notFound.join('、'));
