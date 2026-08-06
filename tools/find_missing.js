/**
 * find_missing.js — 用語集(GLOSSARY)の登録漏れ検出ツール
 *
 * genre_roots.html の本文(desc / roots_story)に出てくる固有名詞・作品名を
 * 機械的に抽出し、GLOSSARY に未登録のものを列挙する。
 *
 * 【なぜ必要か】
 * 用語説明は「目で見て拾う」方式だと大量に取りこぼす。実際、2026-07-28に
 * 40ジャンルを目視で処理したところ、オペラで26個中23個、ハーモニカブルースで
 * 17個中15個が未登録のまま残っていた。人間(およびAI)の目視は当てにならないため、
 * 機械的な検出を必須の工程として組み込んでいる。
 *
 * 【使い方】
 *   node tools/find_missing.js <ジャンルID> [ジャンルID...]
 *   node tools/find_missing.js --all          全ジャンルを対象にする
 *
 * 【判定基準】
 * 出力が「ゼロ」になるまで GLOSSARY への追加を続けること。ただし以下は
 * 追加不要（機械抽出の性質上、必ず混ざる）:
 *   - 文章の一部が切り取られただけの断片（例「聴き手の注意を引かないこと」）
 *   - 登録済みの複合名が正規表現で分割されたもの
 *     （例「How Long」←「How Long, How Long Blues」の一部、「AC」「DC」←「AC/DC」）
 * 何を除外したかは作業報告に必ず記録すること。
 *
 * 【追加時の方針】
 * 「有名だから不要」という絞り込みは禁止。The Beatles、YouTube、Eric Clapton の
 * ような誰でも知っていそうな名前も追加する。読者ごとに既知/未知は大きく異なるため、
 * 何が自明かを書き手が判断してはいけない、というのがチョロさんの明確な方針。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'genre_roots.html');
const html = fs.readFileSync(HTML, 'utf8');
eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'var NODES'));
eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'var GLOSSARY'));

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
if (args.length === 0) {
  console.log('usage: node tools/find_missing.js <genreId...> | --all');
  process.exit(1);
}
const ids = args[0] === '--all' ? NODES.map(n => n.id) : args;
const glossKeys = Object.keys(GLOSSARY);
// ジャンル名（ラベルと別名）。用語集ではなくリンクで繋ぐものなので除外する
const genreNames = new Set();
for (const n of NODES) {
  if (n.label) genreNames.add(String(n.label).replace(/\n/g, ' ').trim());
  for (const a of (n.aliases || [])) if (a) genreNames.add(String(a).trim());
}

let totalMissing = 0;
for (const id of ids) {
  const n = NODES.find(x => x.id === id);
  if (!n) { console.log(id, 'NOT FOUND'); continue; }
  const text = n.desc + ' ' + n.roots_story;
  // ラテン文字の固有名詞（大文字始まりの連なり。アクセント・空白・&・'・. を含みうる）
  const latin = [...text.matchAll(/[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]*(?:\s+(?:of|the|de|del|la|le|du|von|van|und|and|&|di|da)\s+[A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]+|\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’&.\-]*)*/g)].map(m => m[0].trim());
  // 「」『』で囲まれた作品名
  const quoted = [...text.matchAll(/[「『]([^」』]{2,40})[」』]/g)].map(m => m[1]);
  const cand = [...new Set([...latin, ...quoted])].filter(s => s.length > 1);
  // 抽出は英字の連なりで区切るため、固有名詞が途中で切れた断片になることがある。
  // 例1: 本文の「TB-303」からは「TB-」しか取れない
  // 例2: 本文の「W.C. Handy」からは「Handy」が別途取れてしまう（姓だけ）
  // 断片を含むより長いキーが登録済みで、かつその語が本文に実在するなら、
  // 説明は付いているので登録漏れではない。
  const coveredByLonger = (c) =>
    glossKeys.some(k => k.length > c.length && k.includes(c) && text.includes(k));
  const missing = cand.filter(c => !glossKeys.includes(c) && !coveredByLonger(c) && !isNoise(c, text, glossKeys, genreNames));
  totalMissing += missing.length;
  if (args[0] === '--all' && missing.length === 0) continue; // --all時は問題のあるものだけ表示
  console.log('=== ' + id + ' (' + missing.length + ' missing of ' + cand.length + ')');
  if (missing.length) console.log('  ' + missing.join(' | '));
}
console.log('--- total missing: ' + totalMissing);
