/**
 * check_aliases.js — 別名(aliases)の表記ゆれ漏れを検出する
 *
 * 【なぜ必要か】
 * マップの検索と、ジャンル追加申請の重複チェックは aliases を見ている。
 * ここに表記ゆれが登録されていないと、
 *   1. 利用者がその表記で検索してもヒットしない
 *   2. 既存ジャンルなのに「未登録」と判断され、AIの生成処理を無駄に消費する
 * という実害が出る。実際、visual_kei に「ヴィジュアル系」が無く、申請が
 * 生成まで進んでしまう事象が起きた(2026-07-30)。
 *
 * 【検出する表記ゆれ】
 *   ヴァ⇔バ / ヴィ⇔ビ / ヴ⇔ブ / ヴェ⇔ベ / ヴォ⇔ボ   (visual → ヴィジュアル/ビジュアル)
 *   ・(中黒) の有無                                    (ヒップ・ホップ/ヒップホップ)
 *   ー(長音) の有無                                    (コンピュータ/コンピューター)
 *   全角英数 ⇔ 半角英数
 *
 * 【使い方】
 *   node tools/check_aliases.js            検出結果を表示
 *   node tools/check_aliases.js --json     追加すべき別名を gloss形式のJSONで出力
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const html = fs.readFileSync(HTML, 'utf8');
eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'var NODES'));

// ヴ ⇔ 清音の対応
const VU_PAIRS = [['ヴァ', 'バ'], ['ヴィ', 'ビ'], ['ヴェ', 'ベ'], ['ヴォ', 'ボ'], ['ヴ', 'ブ']];

// 【設計上の注意】
// 当初、末尾の長音の有無も表記ゆれとして扱ったが、「ジャズ」→「ジャズー」や
// 「シューゲイザー」→「シューゲイザ」のような、誰も入力しない語を大量に
// 生成してしまったため取りやめた。機械的な変換規則は、思いつくものを全部
// 入れるのではなく、実際に人が入力しうる形だけに絞る必要がある。
//
// 清音→ヴ の変換も、無条件に行うと「ビート」→「ヴィート」のような誤りを生む。
// そこで英語表記に V が含まれる場合に限定している（Visual Kei → ヴィジュアル系）。
function variantsOf(s, englishLabel) {
  const out = new Set();

  // ヴ → 清音（例: ヴァイキングメタル → バイキングメタル）
  let toSeion = s;
  for (const [vu, se] of VU_PAIRS) toSeion = toSeion.split(vu).join(se);
  if (toSeion !== s) out.add(toSeion);

  // 清音 → ヴ。英語表記に V がある場合のみ（例: Visual Kei / ビジュアル系 → ヴィジュアル系）
  if (/[Vv]/.test(englishLabel || '')) {
    for (const [vu, se] of VU_PAIRS) {
      if (s.includes(se)) {
        const cand = s.split(se).join(vu);
        if (cand !== s) out.add(cand);
      }
    }
  }

  // 中黒の有無（例: ミュジック・コンクレート → ミュジックコンクレート）
  if (s.includes('・')) out.add(s.split('・').join(''));

  // 全角英数 → 半角英数
  const toHankaku = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  if (toHankaku !== s) out.add(toHankaku);

  out.delete(s);
  return [...out];
}

const suggestions = [];
for (const n of NODES) {
  const eng = n.label.replace(/\n/g, ' ');
  const known = new Set([n.label.replace(/\n/g, ''), eng, ...(n.aliases || [])]);
  const add = new Set();
  for (const a of [...known]) {
    for (const v of variantsOf(a, eng)) {
      if (!known.has(v)) add.add(v);
    }
  }
  if (add.size) suggestions.push({ id: n.id, label: n.label.replace(/\n/g, ' '), current: n.aliases || [], add: [...add] });
}

if (process.argv.includes('--json')) {
  const out = {};
  for (const s of suggestions) out[s.id] = s.add;
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log('別名の表記ゆれが不足しているジャンル: ' + suggestions.length + '件 / 全' + NODES.length + '件');
  console.log('');
  for (const s of suggestions) {
    console.log(s.id + '  (' + s.label + ')');
    console.log('    現在: ' + JSON.stringify(s.current));
    console.log('    追加: ' + JSON.stringify(s.add));
  }
}
