/**
 * apply_text.js — ジャンルの desc / roots_story を差し替える
 *
 * 【なぜ専用ツールが必要か】
 * genre_roots.html は改行コードが CRLF で、本文には引用符・鉤括弧・
 * 記号が多く含まれる。その場かぎりの置換スクリプトを書くと、
 * 「置換したつもりで1件も変わっていない」という空振りが起きる
 * （2026-07-29に用語集追加で実際に起きた。72件追加したと報告したが実際は0件）。
 * そのため必ずこのツールを通し、置換できなかった場合はエラーで止める。
 *
 * 【使い方】
 *   1. tools/text_entries.json に以下の形式で書く
 *      {
 *        "opera":  { "desc": "…", "roots_story": "…" },
 *        "waltz":  { "desc": "…", "roots_story": "…" }
 *      }
 *   2. node tools/apply_text.js
 *
 * 置換後は文字数を表示するので、基準(desc 400/roots 700)を満たしたか
 * その場で分かる。最後に必ず check_quality.js を実行すること。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const ENTRIES = path.join(__dirname, 'text_entries.json');

// JS文字列リテラルに埋め込める形へ変換する。
// 本文に改行を入れると1行1ノードの構造が崩れるため、改行は空白に畳む。
function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}

// 対象ノードの範囲を取り出す。ノードは {id:"xxx", … } の1かたまり。
function findNode(html, id) {
  const head = `{id:"${id}",`;
  const start = html.indexOf(head);
  if (start === -1) return null;
  // 次のノードの開始、または NODES 配列の終わりまで
  const nextNode = html.indexOf('\n  {id:"', start + 1);
  const end = nextNode === -1 ? html.length : nextNode;
  return { start, end };
}

// フィールド1つを置き換える。値の中の \" は文字列の終わりではないので、
// エスケープを考慮した正規表現で正確に範囲を取る。
function replaceField(block, field, value) {
  const re = new RegExp(`(${field}:")((?:[^"\\\\]|\\\\.)*)(")`);
  const m = block.match(re);
  if (!m) return { block, before: null };
  const before = m[2];
  return {
    block: block.replace(re, `$1${esc(value).replace(/\$/g, '$$$$')}$3`),
    before,
  };
}

function main() {
  if (!fs.existsSync(ENTRIES)) {
    console.error(`入力ファイルがない: ${ENTRIES}`);
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(ENTRIES, 'utf8'));
  let html = fs.readFileSync(HTML, 'utf8');
  const ids = Object.keys(entries);
  if (!ids.length) {
    console.error('入力が空');
    process.exit(1);
  }

  const failures = [];
  const results = [];

  for (const id of ids) {
    const loc = findNode(html, id);
    if (!loc) {
      failures.push(`${id}: ノードが見つからない`);
      continue;
    }
    let block = html.slice(loc.start, loc.end);
    const original = block;
    const row = { id, desc: null, roots: null };

    for (const [field, key] of [['desc', 'desc'], ['roots_story', 'roots']]) {
      if (entries[id][field] === undefined) continue;
      const r = replaceField(block, field, entries[id][field]);
      if (r.before === null) {
        failures.push(`${id}: ${field} が見つからない`);
        continue;
      }
      block = r.block;
      row[key] = { before: r.before.length, after: esc(entries[id][field]).length };
    }

    if (block === original) {
      failures.push(`${id}: 置換できなかった（中身が変わっていない）`);
      continue;
    }
    html = html.slice(0, loc.start) + block + html.slice(loc.end);
    results.push(row);
  }

  if (failures.length) {
    console.error('失敗したため書き込みを中止:');
    failures.forEach(f => console.error('  ' + f));
    process.exit(1);
  }

  fs.writeFileSync(HTML, html, 'utf8');

  console.log('置き換えた内容（字数は 変更前 → 変更後）');
  for (const r of results) {
    const d = r.desc ? `desc ${r.desc.before}→${r.desc.after}` : 'desc 変更なし';
    const s = r.roots ? `roots ${r.roots.before}→${r.roots.after}` : 'roots 変更なし';
    const ng = (r.desc && r.desc.after < 400) || (r.roots && r.roots.after < 700) ? '  ← 基準未達' : '';
    console.log(`  ${id_pad(r.id)} ${d} / ${s}${ng}`);
  }
  console.log(`\n${results.length}件を書き換えた。必ず node tools/check_quality.js で確認すること。`);
}

function id_pad(s) { return (s + ' '.repeat(22)).slice(0, 22); }

main();
