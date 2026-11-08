/* 「この曲なんてジャンル？」入り口ページ3つ（song.html・song_file.html・song_name.html）の共通の動き（2026-11-08 初版）
   ・3つのボタンは、それぞれのページへのリンク（検索にはそれぞれ別のページとして出す）。
     押したときはページを読み込み直さず、その場で中身だけを切り替えて、アドレスと題名だけを替える
     （チョロさんの指示：ページが変わったようには見えず、タブを切り替えているように見せる）。
   ・🎤 聴かせる：マイクで20秒録って、サーバー /recognize/identify で曲名・歌手名を当てる。
   ・📁 ファイル：選んだ音楽ファイルを、同じ /recognize/identify に送る。
   ・✏️ 曲名／歌手名：GRSong.search（proto/song_core.js）で候補を出す。
   曲が決まったら GRSong.judge でジャンルを決め、答えのページ（/proto/answer.html：地図の上に答えの帯）へ移る。
   地図の中のパネル（genre_roots.html の mic〜）と同じ文・同じ動きにしてある。片方を直したら、もう片方も合わせること。 */
(function(){
'use strict';
var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://genre-roots-server.onrender.com';
var SEC = 20;   // 録音は20秒のまま（10秒では59曲中45曲しか分からなかった。2026-11-07 実測）
var PAGES = window.SONG_PAGES || {};
var panel = document.getElementById('mic-panel');
var $ = function(id){ return document.getElementById(id); };
var state = 'idle', mode = panel.dataset.mode;
var stream = null, actx = null, an = null, rec = null, chunks = [], mime = '', tick = null, anim = null, maxVol = 0, phase = 0, cancelled = false;
var canvas = $('mic-eq-canvas'), cx = canvas.getContext('2d');
var IDLE = { listen: 'マイクを押すと、20秒聴いて曲を当てます', file: '', name: '' };

function setState(s){
  state = s;
  panel.classList.toggle('mic-panel-recording', s === 'recording');
  panel.classList.toggle('mic-panel-processing', s === 'processing');
  var t = { idle: IDLE[mode] || '', recording: '聴き取り中 — もう一度タップでキャンセル',
            processing: '曲を探しています…' }[s];
  if (t !== undefined) $('mic-status').textContent = t;
}
function showError(html){ var e = $('mic-error'); e.innerHTML = html; e.classList.add('visible'); }
function hideError(){ $('mic-error').classList.remove('visible'); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

// ───── タブ（3つのボタン）の切り替え ─────
function setMode(m, push){
  if (state === 'recording' || state === 'processing' || !PAGES[m]) return;
  mode = m; panel.dataset.mode = m;
  document.querySelectorAll('.mic-mode-btn').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.mode === m ? 'true' : 'false'); });
  hideError(); setState('idle');
  if (PAGES[m].title) document.title = PAGES[m].title;
  if (push && location.pathname !== PAGES[m].file) history.pushState({mode: m}, '', PAGES[m].file);
  if (m === 'name') setTimeout(function(){ $('mic-name-t').focus(); }, 0);
}
document.querySelectorAll('.mic-mode-btn').forEach(function(b){
  b.addEventListener('click', function(e){
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // 新しいタブで開くときは、ふつうのリンクのまま
    e.preventDefault(); setMode(b.dataset.mode, true);
  });
});
window.addEventListener('popstate', function(){
  for (var m in PAGES) if (PAGES[m].file === location.pathname) { setMode(m, false); return; }
});
history.replaceState({mode: mode}, '', location.href);
setState('idle');

// ───── 曲が決まったら、ジャンルを決めて答えのページへ ─────
function goAnswer(t, a, via){
  var say = via === 'mic' ? $('mic-status') : $('mic-name-st');
  say.textContent = '「' + t + '」のジャンルを調べています…';
  if (via !== 'mic') $('mic-name-out').innerHTML = '';
  GRSong.judge(t, a, function(x){ say.textContent = x; }).then(function(r){
    if (!r.ok) { say.textContent = ''; showError(esc(r.msg)); setState('idle'); return; }
    if (via) r.p.via = via;
    location.href = '/proto/answer.html?' + new URLSearchParams(r.p);
  }).catch(function(){
    say.textContent = ''; setState('idle');
    showError('アクセスできませんでした。少し待ってから、もう一度お試しください。');
  });
}

// ───── ✏️ 曲名／歌手名 ─────
var timer = null;
function nameSearch(q){
  var st = $('mic-name-st'), out = $('mic-name-out');
  if (!window.GRSong) { st.textContent = '準備しています…'; setTimeout(function(){ nameSearch(q); }, 300); return; }
  GRSong.search(q, out, st, function(t, a){ goAnswer(t, a, ''); });
}
$('mic-name-t').addEventListener('input', function(){
  clearTimeout(timer); var q = this.value; hideError();
  timer = setTimeout(function(){ nameSearch(q); }, 800);
});
$('mic-name-form').addEventListener('submit', function(e){
  e.preventDefault(); hideError();
  var q = $('mic-name-t').value.trim();
  if (!q) { showError('曲名か歌手名を入れてください。'); return; }
  clearTimeout(timer); nameSearch(q);
});

// ───── 🎤 聴かせる ─────
function pickMime(){
  var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return (window.MediaRecorder && c.find(function(x){ return MediaRecorder.isTypeSupported(x); })) || '';
}
function resize(){ var w = canvas.offsetWidth; if (w > 0) { canvas.width = w; canvas.height = 40; } }
function clearCanvas(){ cancelAnimationFrame(anim); cx.clearRect(0, 0, canvas.width, canvas.height); $('mic-countdown').textContent = ''; }
function drawListening(){
  if (state !== 'recording' || !an) return;
  var w = canvas.width, h = canvas.height, d = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(d);
  var sum = 0; for (var i = 0; i < d.length; i++) sum += d[i] * d[i];
  maxVol = Math.max(maxVol, Math.sqrt(sum / d.length) / 255);
  cx.clearRect(0, 0, w, h);
  var NUM = 24, bw = w / NUM, use = Math.floor(d.length * 17 / 36);   // 低〜中音に多く割り当てる（地図のパネルと同じ）
  for (var k = 0; k < NUM; k++) {
    var bh = Math.max(2, d[Math.floor(k * use / NUM)] / 255 * h), g = cx.createLinearGradient(0, h - bh, 0, h);
    g.addColorStop(0, 'rgba(233,69,96,0.92)'); g.addColorStop(1, 'rgba(233,69,96,0.2)');
    cx.fillStyle = g; cx.fillRect(k * bw + 1, h - bh, bw - 2, bh);
  }
  anim = requestAnimationFrame(drawListening);
}
function drawProcessing(){
  if (state !== 'processing') return;
  phase += 0.05;
  var w = canvas.width, h = canvas.height, NUM = 24, bw = w / NUM;
  cx.clearRect(0, 0, w, h);
  for (var k = 0; k < NUM; k++) {
    var bh = h * (0.12 + 0.52 * Math.abs(Math.sin(phase * 1.5 + k / NUM * Math.PI * 2.4)));
    cx.fillStyle = 'rgba(233,69,96,0.42)'; cx.fillRect(k * bw + 1, h - bh, bw - 2, bh);
  }
  anim = requestAnimationFrame(drawProcessing);
}
function stopRec(cancel){
  cancelled = cancel; clearInterval(tick); cancelAnimationFrame(anim);
  if (rec && rec.state !== 'inactive') rec.stop();
  if (stream) { stream.getTracks().forEach(function(t){ t.stop(); }); stream = null; }
  if (actx) { actx.close(); actx = null; an = null; }
}
$('mic-listen-btn').addEventListener('click', function(){
  if (state === 'processing') return;
  if (state === 'recording') { stopRec(true); return; }
  hideError();
  if (!navigator.mediaDevices || !window.MediaRecorder) { showError('このブラウザではマイクを使えません。'); return; }
  navigator.mediaDevices.getUserMedia({audio: true}).then(function(s){
    stream = s; maxVol = 0; chunks = [];
    actx = new (window.AudioContext || window.webkitAudioContext)(); an = actx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.78;
    actx.createMediaStreamSource(s).connect(an);
    mime = pickMime();
    try { rec = new MediaRecorder(s, mime ? {mimeType: mime} : {}); } catch (e) { rec = new MediaRecorder(s); }
    rec.ondataavailable = function(e){ if (e.data.size) chunks.push(e.data); };
    rec.onstop = onStop;
    rec.start(200);
    setState('recording'); resize(); drawListening();
    var left = SEC; $('mic-countdown').textContent = left + '秒';
    tick = setInterval(function(){ left--; $('mic-countdown').textContent = left > 0 ? left + '秒' : ''; if (left <= 0) stopRec(false); }, 1000);
  }).catch(function(){
    showError('マイクを許可してから、もう一度押してください。');
  });
});
function onStop(){
  if (cancelled) { cancelled = false; clearCanvas(); setState('idle'); return; }
  if (maxVol < 0.015) { clearCanvas(); setState('idle'); showError('音が聞こえませんでした。曲を流してから、もう一度押してください。'); return; }
  var m = mime || (rec && rec.mimeType) || 'audio/webm';
  var ext = m.indexOf('mp4') >= 0 ? 'mp4' : m.indexOf('ogg') >= 0 ? 'ogg' : 'webm';
  var fd = new FormData(); fd.append('audio', new Blob(chunks, {type: m}), 'recording.' + ext); fd.append('source', 'mic');
  identify(fd);
}

// ───── 📁 ファイル ─────
$('micAudioFile').addEventListener('change', function(){
  var f = this.files[0]; this.value = ''; if (!f) return;
  hideError();
  var fd = new FormData(); fd.append('audio', f, f.name);
  identify(fd);
});

// ───── 音から曲名・歌手名を当てる（地図のパネルの micDoRecognize と同じ） ─────
function identify(fd){
  setState('processing'); phase = 0; resize(); drawProcessing();
  fetch(API + '/recognize/identify', {method: 'POST', body: fd}).then(function(r){ return r.json(); }).then(function(d){
    clearCanvas();
    if (d.error) { setState('idle'); showError(esc(d.error)); return; }
    if (!d.found) {
      // お客さんには理由（照合先・回数の上限など）を書かない（2026-11-08 チョロさんの方針）
      setState('idle');
      showError('曲を特定できませんでした。もう一度近づけて聴かせるか、曲名で探してください。');
      return;
    }
    $('mic-status').textContent = '「' + d.title + '」（' + d.artist + '）';
    var go = function(){ goAnswer(d.title, d.artist, 'mic'); };
    if (window.GRSong) go(); else { var w = setInterval(function(){ if (window.GRSong) { clearInterval(w); go(); } }, 200); }
  }).catch(function(){
    clearCanvas(); setState('idle');
    showError('アクセスできませんでした。少し待ってから、もう一度お試しください。');
  });
}

// 【2026-11-08】検索から来た人に「ほかの調べ方もある」と気づいてもらう：開いて少ししたら、選んでいない2つのボタンが順に小さく跳ねる（1回だけ・文字は足さない）
setTimeout(function(){
  if (state !== 'idle' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var k = 0;
  document.querySelectorAll('.mic-mode-btn[aria-selected="false"]').forEach(function(b){
    setTimeout(function(){ b.classList.add('nudge'); setTimeout(function(){ b.classList.remove('nudge'); }, 700); }, k++ * 350);
  });
}, 1200);
// 地図から「曲名で調べる」で来たとき（?q=言葉）は、その言葉で候補を出す
var P0 = new URLSearchParams(location.search);
if (mode === 'name' && P0.get('q')) { $('mic-name-t').value = P0.get('q'); nameSearch(P0.get('q')); }
// 以前の作りで渡していた ?t=曲名&a=歌手名&auto=1（&via=mic）で来たときは、そのままジャンルを調べる（古いリンクのため）
if (P0.get('t') && P0.get('auto') === '1') {
  var w0 = setInterval(function(){ if (window.GRSong) { clearInterval(w0); goAnswer(P0.get('t'), P0.get('a') || '', P0.get('via') || ''); } }, 200);
}
})();
