/**
 * audit_glossary_coverage.js — 全ジャンルの用語説明の行き渡り具合を調べる
 *
 * 【何を見るか】
 * 本文(desc + roots_story)を実際にマップと同じ方法で走査し、
 *   (1) 用語集にあってツールチップが出る語が何語あるか
 *   (2) 用語集に無くて説明が出ない固有名詞が何語あるか
 * をジャンルごとに数える。
 *
 * find_missing.js は「登録漏れ」だけを見るが、こちらは逆に
 * 「そもそも説明が1つも出ないジャンル」を見つけるためのもの。
 * 用語集は6000語を超えているのに、特定のジャンルだけ本文に
 * 1語も引っかからない、という穴を検出する。
 *
 * 【使い方】
 *   node tools/audit_glossary_coverage.js            要注意のものだけ表示
 *   node tools/audit_glossary_coverage.js --all      全件表示
 *   node tools/audit_glossary_coverage.js --csv      カンマ区切りで出力
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const html = fs.readFileSync(HTML, 'utf8');

let NODES; eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'NODES'));
let GLOSSARY; eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'GLOSSARY'));

// マップ本体と同じ方式：長い語から順に一致させる
const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const regex = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

// 説明が付いていない固有名詞の抽出（find_missing.js と同じ規則）
function candidates(text) {
  const latin = [...text.matchAll(/[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]*(?:\s+(?:of|the|de|del|la|le|du|von|van|und|and|&|di|da)\s+[A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]+|\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]*)*/g)].map(m => m[0].trim());
  const quoted = [...text.matchAll(/[「『]([^」』]{2,40})[」』]/g)].map(m => m[1]);
  return [...new Set([...latin, ...quoted])].filter(s => s.length > 1);
}
const coveredByLonger = (c, text) =>
  keys.some(k => k.length > c.length && k.includes(c) && text.includes(k));

// ジャンル名（ラベルと別名）。用語集ではなくリンクで繋ぐものなので除外する
const genreNames = new Set();
for (const n of NODES) {
  if (n.label) genreNames.add(String(n.label).replace(/\n/g, ' ').trim());
  for (const a of (n.aliases || [])) if (a) genreNames.add(String(a).trim());
}
// 対応不要なものを除外する。これを入れないと、検出の副産物が大量に
// 混ざって本当の漏れが埋もれる（2026-08-06、62件のうち実際に
// 対応が要ったのは十数件だった）。
function isNoise(c, text, glossKeys, genreNames) {
  // 1. かな混じり = 筆者の言い回し（「音で殴られる体験」など）
  if (/[ぁ-ん]/.test(c)) return true;
  // 2. 数字だけ（本文中の「140」「17」など）
  if (/^[0-9０-９.\-]+$/.test(c)) return true;
  // 3. 短い大文字の断片。コード記号(IV)や型番の一部(JV/XV/MP)が該当する。
  //    3文字以下で大文字を含む英字だけのものは、単独の見出しにならない
  if (/^[A-Za-z]{1,3}$/.test(c) && /[A-Z]/.test(c)) return true;
  // 4. 記号で終わる断片（Roland Juno- など）
  if (/[-‐–—.\/]$/.test(c)) return true;
  // 5. マップ上のジャンル名（用語集ではなくリンクで繋ぐもの）
  if (genreNames.has(c)) return true;
  // 6. 鉤括弧で囲まれた短い日常語・擬音。筆者が強調のために囲んだもので、
  //    固有名詞ではない（「ズレ」「チープ」「感動」「ワウワウ」など）
  if (/^[ァ-ヴー・一-龠]{2,6}$/.test(c) && text.includes('「' + c + '」')) return true;
  // 7. 括弧付きの言い換え。括弧の外が登録済みなら説明は出ている
  const m = c.match(/^(.+?)\s*[（(]/);
  if (m && glossKeys.includes(m[1].trim())) return true;
  return false;
}

const args = process.argv.slice(2);
const rows = [];
for (const n of NODES) {
  const text = (n.desc || '') + ' ' + (n.roots_story || '');
  const hits = new Set(text.match(regex) || []);
  const missing = candidates(text).filter(c => !keys.includes(c) && !coveredByLonger(c, text) && !isNoise(c, text, keys, genreNames));
  rows.push({
    id: n.id,
    label: (n.label || n.id).replace(/\n/g, ' '),
    chars: text.length,
    hits: hits.size,
    missing: missing.length,
    missingList: missing,
  });
}

if (args.includes('--csv')) {
  console.log('id,label,本文字数,説明が出る語数,説明が無い語数');
  rows.forEach(r => console.log([r.id, r.label, r.chars, r.hits, r.missing].join(',')));
  process.exit(0);
}

const total = rows.length;
const avg = (rows.reduce((s, r) => s + r.hits, 0) / total).toFixed(1);
const zero = rows.filter(r => r.hits === 0);
const few = rows.filter(r => r.hits > 0 && r.hits < 5);
const withMissing = rows.filter(r => r.missing > 0);

console.log(`対象${total}件 / 用語集${keys.length}語`);
console.log(`本文に説明が出る語の平均: ${avg}語`);
console.log('');
console.log(`【重大】本文に説明が1語も出ないジャンル: ${zero.length}件`);
zero.forEach(r => console.log(`  ${r.label}(${r.id})  本文${r.chars}字`));
console.log('');
console.log(`【要注意】説明が出る語が5語未満: ${few.length}件`);
few.sort((a, b) => a.hits - b.hits).forEach(r =>
  console.log(`  ${r.label.padEnd(24)} ${r.hits}語  本文${r.chars}字`));
console.log('');
console.log(`【登録漏れ】説明が用意されていない固有名詞があるジャンル: ${withMissing.length}件`);
withMissing.sort((a, b) => b.missing - a.missing).slice(0, args.includes('--all') ? 999 : 20)
  .forEach(r => console.log(`  ${r.label.padEnd(24)} ${r.missing}語  ${r.missingList.slice(0, 8).join('、')}`));

const bad = zero.length + withMissing.length;
console.log('');
if (bad === 0) console.log('OK: 問題は見つかりませんでした');
else console.log(`NG: 合計${bad}件に対応が必要です`);
process.exit(bad === 0 ? 0 : 1);
