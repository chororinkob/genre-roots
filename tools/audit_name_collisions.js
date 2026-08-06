/**
 * audit_name_collisions.js — 普通の言葉と衝突している見出し語を洗い出す
 *
 * 【audit_wrong_tooltips.js との違い】
 * あちらは「別の単語の途中に食い込んでいるか」を見る。
 * こちらは「見出しとしては独立して一致しているが、その語が普通名詞として
 * 使われている箇所にまで、特定の作品や人物の説明が出てしまう」場合を探す。
 *
 * 【実例】2026-08-06、チョロさんが発見
 *   「映像」という見出しに、ドビュッシーのピアノ曲集『映像』の説明が
 *   入っていた。本文で普通に「映像」と書いた54箇所すべてに、
 *   ドビュッシーの説明が出ていた。
 *   文字の途中に食い込んでいるわけではないので、既存の検査では通ってしまう。
 *
 * 【判定の考え方】
 * 一般的な用語（拍子・小節・転調）は多くのジャンルに出て当然。
 * しかし特定の作品名・人物名は、本来ごく少数のジャンルにしか出ないはず。
 * 「多くのジャンルに出る」×「説明が特定の作品や人物の話」= 衝突している。
 *
 * 【使い方】
 *   node tools/audit_name_collisions.js
 *   node tools/audit_name_collisions.js --all   閾値を下げて広く表示
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'genre_roots.html'), 'utf8');
let NODES; eval(html.match(/const NODES = \[[\s\S]*?\n\];/)[0].replace('const NODES', 'NODES'));
let GLOSSARY; eval(html.match(/const GLOSSARY = \{[\s\S]*?\n\};/)[0].replace('const GLOSSARY', 'GLOSSARY'));

// マップ本体と同じ方式：長い語から先に一致させる
const gkeys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const regex = new RegExp(gkeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

const texts = NODES.map(n => ({
  label: (n.label || n.id).replace(/\n/g, ' '),
  text: (n.desc || '') + ' ' + (n.roots_story || ''),
}));

// 説明文が「特定の作品」を指していると判断する手がかり。
// 人名・バンド名は対象にしない（細野晴臣やKraftwerkは何度出ても正しいため）。
const WORK = /(が\d{4}年に(発表|録音|制作|公開)|アルバム|シングル|ピアノ曲集|組曲|映画|テレビドラマ|主題歌)/;
const YEAR = /(1[89]\d\d年|20\d\d年)/;

// 一般的な用語であることを示す手がかり（これがあれば作品名の見出しではない）
const GENERIC = /(のこと|を指す|と呼ば|という意味|の総称|の略|する処理|する技法|する奏法|する現象|の単位|の一種|の一系統|の型|とも呼ばれる)/;

// 見出しが「日本語の普通の言葉の形」をしているか。
// 漢字・ひらがな・カタカナだけで5文字以下のものを対象とする。
// 「映像」のように、作品名がたまたま日常語と同じ形をしている場合を捕まえる。
// 英字の見出し（Kraftwerk、SoundCloud）は日常語と衝突しにくいので除外する。
const looksCommonWord = (k) => k.length <= 5 && /^[一-龠ぁ-んァ-ヴー]+$/.test(k);

// 目視で確認し、問題ないと判断したもの。
// これを消すと毎回同じものが報告され、本当の問題が埋もれてしまう。
//   第三の波 … 5箇所中3箇所はAlvin Tofflerの著書で正しい。Emoの
//              「第三の波」だけ別の意味だが、実害は小さいと判断
//   坂本龍一 … 4箇所すべて本人。人名なので何度出ても正しい
const ALLOW = new Set(['第三の波', '坂本龍一']);

const threshold = process.argv.includes('--all') ? 3 : 5;

// 実際にツールチップが出る回数を数える。単に文字列が含まれるかで数えると、
// より長い見出しに一致して実際には出ない箇所まで数えてしまい、大幅な
// 過大報告になる（2026-08-06、Death や Space が誤って報告された）。
// 本文を1回だけ走査して、出た語をまとめて数える。
const hitCount = new Map();
const hitSample = new Map();
for (const t of texts) {
  let m; regex.lastIndex = 0;
  while ((m = regex.exec(t.text))) {
    const k = m[0];
    hitCount.set(k, (hitCount.get(k) || 0) + 1);
    const arr = hitSample.get(k) || [];
    if (arr.length < 3) {
      const s = Math.max(0, m.index - 16), e = Math.min(t.text.length, m.index + k.length + 16);
      arr.push(t.label + ': …' + t.text.slice(s, e).replace(/\n/g, ' ') + '…');
      hitSample.set(k, arr);
    }
  }
}

const rows = [];
for (const k of Object.keys(GLOSSARY)) {
  const v = String(GLOSSARY[k]);
  // 作品名・人物名らしい説明か
  if (ALLOW.has(k)) continue;
  const looksSpecific = looksCommonWord(k) && WORK.test(v) && YEAR.test(v) && !GENERIC.test(v);
  if (!looksSpecific) continue;
  const count = hitCount.get(k) || 0;
  if (count < threshold) continue;
  rows.push({ key: k, def: v, count, samples: hitSample.get(k) || [] });
}

rows.sort((a, b) => b.count - a.count);
console.log('用語集 ' + Object.keys(GLOSSARY).length + '語 / ジャンル ' + texts.length + '件');
console.log('');
console.log('特定の作品・人物の説明なのに、' + threshold + '箇所以上で説明が出る見出し: ' + rows.length + '語');
console.log('（普通の言葉として使われている箇所にまで、その説明が出ている可能性が高い）');
console.log('');
for (const r of rows) {
  console.log('  "' + r.key + '"  実際に説明が出る箇所: ' + r.count + '回');
  r.samples.forEach(x => console.log('      ' + x));
  console.log('      説明: ' + r.def.slice(0, 70));
}

console.log('');
if (rows.length === 0) {
  console.log('OK: 普通の言葉と衝突している見出しは見つかりませんでした');
  process.exit(0);
}
console.log('NG: 上記は、見出しを正式名称に変えるか、用語集から削除すること');
process.exit(1);
