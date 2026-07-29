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

// 擬音語・擬態語。カタカナ（＋長音・促音・中黒・読点）のみで構成された短い語で、
// 本文中で「」に括られた箇所にしか現れないもの。例:「シャカシャカ」「ズダダダダ」
// 実在の固有名詞なら、地の文でも言及されるか、そもそも長い名前になる。
function isOnomatopoeia(s, quoted, totalInCorpus) {
  if (!/^[ァ-ヴー・、\s]+$/.test(s)) return false;
  const core = s.replace(/[ー・、\s]/g, '');
  if (core.length < 2 || core.length > 8) return false;
  // 同じ音の繰り返しを含む（シャカシャカ／ドンドンドンドン）
  const half = core.length / 2;
  if (Number.isInteger(half) && core.slice(0, half) === core.slice(half)) return true;
  for (const n of [1, 2, 3]) {
    if (core.length >= n * 2 && core.length % n === 0) {
      const unit = core.slice(0, n);
      if (core.split('').every((_, i) => core[i] === unit[i % n])) return true;
    }
  }
  // 繰り返しがなくても、全文で「」内にしか現れない短いカタカナ＝音の描写
  if (quoted > 0 && totalInCorpus === quoted) return true;
  return false;
}

// 全文における出現状況を見て、「筆者が1箇所だけ強調のために括った普通の言葉」を判別する。
// 固有名詞なら、括られていない箇所での出現は少ないか、あっても同じ意味で使われる。
// 対して「発見」「新しい」のような一般語は、地の文に多数出現する。
// これを用語集に登録すると、無関係な数十ジャンルの本文にまでツールチップが付いてしまう
// （ツールチップは単純な文字列一致で付くため）。
let ALL_TEXT = null;
function isCommonWordEmphasized(s, quotedCount) {
  if (/^[A-Za-z]/.test(s)) return false;           // ラテン文字で始まるなら固有名詞
  if (s.length > 6) return false;                  // 長い語は一般語ではない
  const plain = ALL_TEXT.split(s).length - 1 - quotedCount;
  return plain >= 1;                               // 地の文にも出るなら普通の言葉
}

// 固有名詞らしさの手がかり。これらを含む語は、助詞を含んでいても
// 作品名・団体名・イベント名である可能性が高いので、言い回しとして除外しない。
//
// 【重要な教訓】当初、「助詞を含む＝文になっている＝固有名詞ではない」という
// 単純な規則で除外していたが、これでは「有楽町で逢いましょう」「長崎は今日も
// 雨だった」のような日本語の曲名まで巻き込んで除外してしまっていた
// （2026-07-30に発覚）。日本語の作品名は助詞を含むのが普通なので、
// 助詞の有無だけで判断してはいけない。
const PROPER_HINT = /節$|音頭$|節[（(]|レコード|レコーズ|Records|レーベル|フェスティバル|・[ァ-ヴ]|ムジーク|ミュジック|エチュード|交響曲|組曲|協奏曲|ソナタ|前奏曲|王$|女王$|帝王$|の歌$|の詩$/;

// カタカナの外来語・訳語を含む専門用語らしさ（例「ヌエボ・フラメンコ」）
const TERM_HINT = /[（(][ぁ-んァ-ヴ一-龠A-Za-z・\s]+[）)]$/;

function isAuthorPhrase(s) {
  if (/^[A-Za-z]/.test(s) && !JP_PHRASE.test(s)) return false;
  if (!/[ぁ-んァ-ヴ一-龠]/.test(s)) return false;  // 日本語を含まないなら対象外
  if (PROPER_HINT.test(s)) return false;         // 固有名詞の手がかりがあれば除外しない
  if (TERM_HINT.test(s)) return false;           // 「原語(訳語)」形式は専門用語
  if (s.length >= 12) return true;               // 長い日本語は説明的な言い回し
  if (JP_PHRASE.test(s)) return true;            // 助詞・活用を含むなら文
  if (/っぽさ$|らしさ$|っぷり$/.test(s)) return true; // 形容の接尾辞
  return false;
}

// 収集
const occurrences = new Map();   // 語 -> [{genre, context}]
const quotedCount = new Map();   // 語 -> 「」『』で括られて出現した回数
let total = 0;
ALL_TEXT = NODES.map(n => n.desc + ' ' + n.roots_story).join(' ');
for (const n of NODES) {
  const text = n.desc + ' ' + n.roots_story;
  const latin = [...text.matchAll(LATIN_RE)].map(m => m[0].trim());
  const quoted = [...text.matchAll(/[「『]([^」』]{2,40})[」』]/g)].map(m => m[1]);
  for (const q of quoted) quotedCount.set(q, (quotedCount.get(q) || 0) + 1);
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
const counts = { fragmentOfKey: 0, fragmentOfPeer: 0, authorPhrase: 0, onomatopoeia: 0, commonWord: 0 };
const real = [];
const excluded = { onomatopoeia: [], authorPhrase: [], commonWord: [] };

for (const w of allWords) {
  // 0) 「原語（訳語）」形式で、原語の部分が既に登録済み。
  //    例:「還元的聴取（エクート・レデュイット）」← 「還元的聴取」が登録済み。
  //    本文中では登録済みの部分にツールチップが付くので、漏れではない。
  const base = w.replace(/[（(][^）)]*[）)]\s*$/, '').trim();
  if (base !== w && base.length > 1 && glossKeys.includes(base)) { counts.fragmentOfKey++; continue; }
  // 1) 用語集の既存キーの一部分（例:「Blood」は「Through Silver in Blood」の一部）
  if (glossKeys.some(k => k !== w && k.includes(w))) { counts.fragmentOfKey++; continue; }
  // 2) 未登録語どうしで、より長い語の一部（例:「Papa's Got」は「Papa's Got a Brand New Bag」の一部）
  //    → 長い方だけを「本当の漏れ」として扱う
  if (allWords.some(o => o !== w && o.length > w.length && o.includes(w))) { counts.fragmentOfPeer++; continue; }
  // 3) 擬音語・擬態語（例「ドン・ドン・ドン・ドン」「シャカシャカ」）
  const qc = quotedCount.get(w) || 0;
  const totalOcc = ALL_TEXT.split(w).length - 1;
  if (isOnomatopoeia(w, qc, totalOcc)) { counts.onomatopoeia++; excluded.onomatopoeia.push(w); continue; }
  // 4) 筆者の言い回し（助詞・活用を含む＝文になっている）
  if (isAuthorPhrase(w)) { counts.authorPhrase++; excluded.authorPhrase.push(w); continue; }
  // 5) 筆者が1箇所だけ強調で括った一般語（例「発見」「新しい」）
  //    登録すると無関係な多数のジャンルにツールチップが付いてしまうため除外する
  if (isCommonWordEmphasized(w, qc)) { counts.commonWord++; excluded.commonWord.push(w); continue; }
  real.push(w);
}

console.log('検出された未登録語（延べ）: ' + total + ' / 異なり ' + allWords.length);
console.log('  除外1 用語集の既存キーの断片       : ' + counts.fragmentOfKey);
console.log('  除外2 より長い未登録語の断片       : ' + counts.fragmentOfPeer);
console.log('  除外3 擬音語・擬態語               : ' + counts.onomatopoeia);
console.log('  除外4 筆者の言い回し（文になっている）: ' + counts.authorPhrase);
console.log('  除外5 強調で括られた一般語         : ' + counts.commonWord);
console.log('  ★ 本当の漏れ（説明が出ない状態）: ' + real.length);
console.log('');

if (process.argv.includes('--show-excluded')) {
  for (const k of Object.keys(excluded)) {
    console.log('--- 除外[' + k + '] ' + excluded[k].length + '件 ---');
    console.log('  ' + excluded[k].join(' | '));
  }
}

if (real.length) {
  const sorted = real.map(w => [w, occurrences.get(w)]).sort((a, b) => b[1].length - a[1].length);
  console.log('--- 要追加 ---');
  for (const [word, occ] of sorted) {
    console.log(word + '  [' + occ.map(o => o.genre).slice(0, 4).join(',') + (occ.length > 4 ? '…' : '') + ']');
    if (verbose) console.log('    …' + occ[0].context + '…');
  }
}
