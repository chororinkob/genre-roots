// ヘルプで使っている図を、ぜんぶ撮り直す。
//
//   node tools/figs/all.js
//
// 【いつ流すか】公開の直前に1回。画面をいじるたびに撮り直していると
// きりがないので、気づいたことは docs/図の宿題.md に貯めておき、
// まとめてここで片づける。
//
// 【流す前に必ず】直したい内容を GitHub Pages に公開しておくこと。
// この道具は「公開しているURL」から撮る。手元のファイルを file:// で
// 開くと YouTube が動画を貸してくれず、図にエラーが写り込む。
//
// 【順番の意味】make_figs が fig01〜07 をひととおり撮ったあと、
// fig04 と fig07 だけを撮り直している。この2枚は動画が写るため、
// 広告を飛ばす処理や、矢印の指す先を選び直す処理が要る。
// あとから上書きするので、この順番を入れ替えないこと。

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const 設定 = require('./設定');

// [ファイル名, 説明, 渡す言葉]
// mic_figs.js は端末を言葉で受け取る作りなので、パソコン版とスマホ版を
// 別々に呼ぶ。これを忘れてスマホ版の4枚が撮れていなかった（2026-08-31）。
const 手順 = [
  ['make_figs.js', 'パソコンの地図 fig01〜fig07', []],
  ['fig4_redo.js', 'fig04（動画つき・広告を飛ばす）', []],
  ['fig7_redo.js', 'fig07（動画つき）', []],
  ['pc_figs.js', 'パソコンのリクエスト・修正依頼', []],
  ['mic_figs.js', '「これなんて曲？」パソコン版', ['パソコン']],
  ['mic_figs.js', '「これなんて曲？」スマホ版', ['スマホ']],
  ['sp_figs.js', 'スマホ sp01〜sp07', []],
  ['sp_figs2.js', 'スマホ sp08〜sp14', []],
  ['kakunin_figs.js', '申請の確認画面', []],
];

const 一部だけ = process.argv.slice(2);

fs.mkdirSync(設定.出力先, { recursive: true });
console.log('撮る場所: ' + 設定.地図);
console.log('書き出し: ' + 設定.出力先 + '\n');

const 失敗 = [];
for (const [名, 説明, 言葉] of 手順) {
  if (一部だけ.length && !一部だけ.some(x => 名.includes(x))) continue;
  console.log('═'.repeat(64));
  console.log('▶ ' + 名 + '  … ' + 説明);
  console.log('═'.repeat(64));
  try {
    execFileSync('node', [path.join(__dirname, 名)].concat(言葉), { stdio: 'inherit' });
  } catch (e) {
    console.log('  ★ ' + 名 + '（' + 説明 + '）が途中で止まりました');
    失敗.push(説明);
  }
}

console.log('\n' + '═'.repeat(64));
console.log('▶ JPGに書き出す');
console.log('═'.repeat(64));
try {
  execFileSync('python', [path.join(__dirname, 'jpgにする.py')], { stdio: 'inherit' });
} catch (e) {
  失敗.push('jpgにする.py');
}

console.log('\n' + (失敗.length
  ? '★ うまくいかなかったもの: ' + 失敗.join('、')
  : 'ぜんぶ終わりました。docs/img を git で見て、意図した図に変わっているか確かめてください。'));
process.exit(失敗.length ? 1 : 0);
