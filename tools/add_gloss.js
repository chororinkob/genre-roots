/**
 * add_gloss.js — 用語集(GLOSSARY)への一括追加ツール
 *
 * 【なぜ専用ツールが必要か】
 * genre_roots.html は改行コードが CRLF のため、素朴な文字列置換スクリプトを
 * 自作すると「\n」で検索して一致せず、置換が空振りする。しかも例外が出ないため、
 * 「追加した」と報告しながら実際には1件も入っていない、という事故が起きる
 * （2026-07-28に実際に発生）。このツールは改行コードを自動判別し、置換が
 * 失敗した場合は必ず例外を投げる。GLOSSARYへの追加は必ずこれを経由すること。
 *
 * 【使い方】
 *   1. 同じディレクトリに gloss_entries.json を作る
 *      { "用語": "説明文(日本語2〜3文)", "人名": "説明文", ... }
 *   2. node tools/add_gloss.js
 *
 * 既存キーは自動でスキップするので、重複を気にせず投入してよい。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'genre_roots.html');
const ENTRIES = path.join(__dirname, 'gloss_entries.json');

if (!fs.existsSync(ENTRIES)) {
  console.error('gloss_entries.json が見つかりません: ' + ENTRIES);
  console.error('{ "用語": "説明文", ... } の形式で作成してください。');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(ENTRIES, 'utf8'));
let h = fs.readFileSync(FILE, 'utf8');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
const NL = h.indexOf(CR + LF) >= 0 ? CR + LF : LF;   // CRLF/LF を自動判別
const anchor = 'const GLOSSARY = {' + NL;
if (h.indexOf(anchor) < 0) throw new Error('GLOSSARY の開始位置が見つかりません');

let ins = anchor;
let added = 0, skipped = 0;
for (const [k, v] of Object.entries(entries)) {
  if (h.indexOf('  ' + JSON.stringify(k) + ':') >= 0) { skipped++; continue; }
  ins += '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',' + NL;
  added++;
}
const before = h.length;
h = h.replace(anchor, ins);
if (h.length === before && added > 0) throw new Error('置換に失敗しました（改行コードの不一致の可能性）');
fs.writeFileSync(FILE, h);
console.log('added ' + added + ' / skipped(既存) ' + skipped);
