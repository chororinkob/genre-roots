/**
 * audit_wrong_tooltips.js — 見当違いのツールチップが出る箇所を実際に洗い出す
 *
 * マップ本体と同じ処理（長い語を優先して一致させる）を再現し、
 * 本文のどの文字列にどの説明が出るかを実際に作ってみる。
 * そのうえで「日本語の単語の途中に食い込んで一致している」ものを
 * 見当違いの候補として報告する。
 *
 * 例: 本文「17世紀」の「17」に、XXXテンタシオンのアルバムの説明が出る。
 *     本文「ドラム」の「ラム」に、ラオ語の説明が出る。
 *
 * 【使い方】
 *   node tools/audit_wrong_tooltips.js           要注意の語だけ
 *   node tools/audit_wrong_tooltips.js --detail  実際の出現箇所も表示
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'genre_roots.html'), 'utf8');
let NODES; eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'NODES'));
let GLOSSARY; eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'GLOSSARY'));

// マップ本体と同じ：長い語から先に一致させる
const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const regex = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

// 一致した語の前後がどんな文字かを見て、単語の途中に食い込んでいないか判定する
const KANA = /[ァ-ヴー]/;          // カタカナ
const KANJI = /[一-龠]/;           // 漢字
const DIGIT = /[0-9０-９]/;
const LATIN = /[A-Za-z]/;

function isSuspicious(term, before, after) {
  // カタカナ語の前後にカタカナが続く → 別の単語の一部
  if (KANA.test(term[0]) && before && KANA.test(before)) return '前がカタカナ';
  if (KANA.test(term[term.length - 1]) && after && KANA.test(after)) return '後ろがカタカナ';
  // 数字の前後に数字 → 年号などの一部
  if (DIGIT.test(term[0]) && before && DIGIT.test(before)) return '前が数字';
  if (DIGIT.test(term[term.length - 1]) && after && DIGIT.test(after)) return '後ろが数字';
  // 数字の見出しの直後が「世紀」「年」など → 年号の一部
  if (/^[0-9０-９]+$/.test(term) && after && KANJI.test(after)) return '後ろが漢字（年号の一部）';
  // 英字の前後に英字 → 別の単語の一部
  if (LATIN.test(term[0]) && before && LATIN.test(before)) return '前が英字';
  if (LATIN.test(term[term.length - 1]) && after && LATIN.test(after)) return '後ろが英字';
  return null;
}

const detail = process.argv.includes('--detail');
const bad = new Map();   // 見出し語 → { count, reasons, samples }

for (const n of NODES) {
  const text = (n.desc || '') + ' ' + (n.roots_story || '');
  const label = (n.label || n.id).replace(/\n/g, ' ');
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(text))) {
    const term = m[0];
    const before = m.index > 0 ? text[m.index - 1] : '';
    const after = text[m.index + term.length] || '';
    const why = isSuspicious(term, before, after);
    if (!why) continue;
    if (!bad.has(term)) bad.set(term, { count: 0, samples: [], why });
    const e = bad.get(term);
    e.count++;
    if (e.samples.length < 4) {
      const s = Math.max(0, m.index - 8), t = Math.min(text.length, m.index + term.length + 8);
      e.samples.push(label + ': …' + text.slice(s, t).replace(/\n/g, ' ') + '…');
    }
  }
}

const rows = [...bad.entries()].sort((a, b) => b[1].count - a[1].count);
const totalWrong = rows.reduce((s, r) => s + r[1].count, 0);

console.log('用語集 ' + keys.length + '語 / ジャンル ' + NODES.length + '件');
console.log('');
console.log('単語の途中に食い込んで説明が出ている箇所: 合計' + totalWrong + '箇所 / ' + rows.length + '語');
console.log('');
for (const [term, e] of rows) {
  console.log('  "' + term + '"  ' + e.count + '箇所  (' + e.why + ')');
  console.log('      説明: ' + String(GLOSSARY[term]).slice(0, 60));
  if (detail) e.samples.forEach(s => console.log('      ' + s));
}

console.log('');
if (rows.length === 0) {
  console.log('OK: 見当違いのツールチップは見つかりませんでした');
  process.exit(0);
}
console.log('NG: 上記の見出し語は、用語集から削除するか、より長い正式名称に直すこと');
process.exit(1);
