// ========== AI-GalGame 游戏逻辑 ==========

// ---- 全局变量 ----
let affection = 0;
let stageIdx = 0;
let lineIdx = 0;
let character = 'whale';
let currentFace = 'normal';
let charSrc = null;
let typeTimer = null;
let curText = '';
let currentTint = 'day';   // 当前色调（运镜时保持）
let currentAct = 1;        // 当前幕：1=第一幕 2=第二幕
let charReq = 0;           // 立绘异步加载请求ID（防竞态覆盖）
let bgReq = 0;             // 背景异步加载请求ID（防竞态覆盖）

// ---- 对话播放控制 ----
let autoMode = 0;
let lineQueue = [];
let linePos = 0;
let stageCb = null;
let waitTimer = null;

// ---- 音效（WebAudio合成，无需素材）----
let audioCtx = null;
let sfxOn = true;
let bgmOn = true;          // BGM总开关（静音）

// ---- 抠图参数 ----
const CUT_TH = 248;
const GAP_RATIO = 0.0005;
const FACES = { whale: { x: 0.40, y: 0.16, w: 0.20, h: 0.22 } };

// ---- 立绘缓存 ----
let charCanvas = null;
let cleanData = null;
let calibMode = false;
let fixMode = false;
let fixInfo = null;

// ---- BGM：背景→场景曲映射 ----
const SCENE_BGM = {
  city: 'street', road: 'street', stall: 'kitchen', bench: 'living',
  beach: 'romantic', beach_night: 'night',
  living: 'living', kitchen: 'kitchen', bedroom: 'bedroom',
  dream_sea: 'dream', dream_city: 'dream', dream_hall: 'tense',
  dream_throne: 'boss', rlyeh: 'epic',
  // 第四幕新增场景BGM（2026-08-26 补登记）
  guild_office: 'mood_tense', guild_lounge: 'living',
  aero_gate: 'mood_night', aero_hall: 'mood_night', aero_control: 'mood_tense',
  aero_server: 'mood_sad', aero_break: 'mood_comedy', aero_orbit: 'mood_epic',
  roof_night: 'mood_night', cafe: 'living'
};
const MOOD_BGM = ['romantic', 'tense', 'sad', 'comedy', 'epic', 'night'];
function playBgm(name) {
  if (!name || !window.BGM) return;
  try {
    if (MOOD_BGM.indexOf(name) >= 0) BGM.mood(name);
    else BGM.play(name);
  } catch (e) {}
}
function stopBgm(fade) { try { if (window.BGM) BGM.stop(fade || 0.6); } catch (e) {} }

// ---- 背景系统：按阶段配图 + 运镜缩放 + 调色 ----
const BG_MAP = {
  city:         ['assets/bg/city.png',         'assets/bg/city.jpg',         'backgrounds/city.png',         'backgrounds/city.jpg',         'images/city.png',         'images/city.jpg'],
  road:         ['assets/bg/road.png',         'assets/bg/road.jpg',         'backgrounds/road.png',         'backgrounds/road.jpg',         'images/road.png',         'images/road.jpg'],
  stall:        ['assets/bg/stall.png',        'assets/bg/stall.jpg',        'backgrounds/stall.png',        'backgrounds/stall.jpg',        'images/stall.png',        'images/stall.jpg'],
  bench:        ['assets/bg/bench.png',        'assets/bg/bench.jpg',        'backgrounds/bench.png',        'backgrounds/bench.jpg',        'images/bench.png',        'images/bench.jpg'],
  beach:        ['assets/bg/beach.png',        'assets/bg/beach.jpg',        'backgrounds/beach.png',        'backgrounds/beach.jpg',        'images/beach.png',        'images/beach.jpg'],
  beach_night:  ['assets/bg/beach_night.png',  'assets/bg/beach_night.jpg',  'backgrounds/beach_night.png',  'backgrounds/beach_night.jpg',  'images/beach_night.png',  'images/beach_night.jpg'],
  living:       ['assets/bg/living.png',       'assets/bg/living.jpg',       'backgrounds/living.png',       'backgrounds/living.jpg',       'images/living.png',       'images/living.jpg'],
  kitchen:      ['assets/bg/kitchen.png',      'assets/bg/kitchen.jpg',      'backgrounds/kitchen.png',      'backgrounds/kitchen.jpg',      'images/kitchen.png',      'images/kitchen.jpg'],
  bedroom:      ['assets/bg/bedroom.png',      'assets/bg/bedroom.jpg',      'backgrounds/bedroom.png',      'backgrounds/bedroom.jpg',      'images/bedroom.png',      'images/bedroom.jpg'],
  dream_sea:    ['assets/bg/dream_sea.png',    'assets/bg/dream_sea.jpg',    'backgrounds/dream_sea.png',    'backgrounds/dream_sea.jpg',    'images/dream_sea.png',    'images/dream_sea.jpg'],
  dream_city:   ['assets/bg/dream_city.png',   'assets/bg/dream_city.jpg',   'backgrounds/dream_city.png',   'backgrounds/dream_city.jpg',   'images/dream_city.png',   'images/dream_city.jpg'],
  dream_hall:   ['assets/bg/dream_hall.png',   'assets/bg/dream_hall.jpg',   'backgrounds/dream_hall.png',   'backgrounds/dream_hall.jpg',   'images/dream_hall.png',   'images/dream_hall.jpg'],
  dream_throne: ['assets/bg/dream_throne.png', 'assets/bg/dream_throne.jpg', 'backgrounds/dream_throne.png', 'backgrounds/dream_throne.jpg', 'images/dream_throne.png', 'images/dream_throne.jpg'],
  rlyeh:        ['assets/bg/rlyeh.png',        'assets/bg/rlyeh.jpg',        'backgrounds/rlyeh.png',        'backgrounds/rlyeh.jpg',        'images/rlyeh.png',        'images/rlyeh.jpg'],
  guild_office: ['assets/bg/guild_office.png', 'assets/bg/guild_office.jpg', 'backgrounds/guild_office.png', 'backgrounds/guild_office.jpg', 'images/guild_office.png', 'images/guild_office.jpg'],
  guild_lounge: ['assets/bg/guild_lounge.png', 'assets/bg/guild_lounge.jpg', 'backgrounds/guild_lounge.png', 'backgrounds/guild_lounge.jpg', 'images/guild_lounge.png', 'images/guild_lounge.jpg'],
  aero_gate:    ['assets/bg/aero_gate.png',    'assets/bg/aero_gate.jpg',    'backgrounds/aero_gate.png',    'backgrounds/aero_gate.jpg',    'images/aero_gate.png',    'images/aero_gate.jpg'],
  aero_hall:    ['assets/bg/aero_hall.png',    'assets/bg/aero_hall.jpg',    'backgrounds/aero_hall.png',    'backgrounds/aero_hall.jpg',    'images/aero_hall.png',    'images/aero_hall.jpg'],
  aero_control: ['assets/bg/aero_control.png', 'assets/bg/aero_control.jpg', 'backgrounds/aero_control.png', 'backgrounds/aero_control.jpg', 'images/aero_control.png', 'images/aero_control.jpg'],
  aero_server:  ['assets/bg/aero_server.png',  'assets/bg/aero_server.jpg',  'backgrounds/aero_server.png',  'backgrounds/aero_server.jpg',  'images/aero_server.png',  'images/aero_server.jpg'],
  aero_break:   ['assets/bg/aero_break.png',   'assets/bg/aero_break.jpg',   'backgrounds/aero_break.png',   'backgrounds/aero_break.jpg',   'images/aero_break.png',   'images/aero_break.jpg'],
  aero_orbit:   ['assets/bg/aero_orbit.png',   'assets/bg/aero_orbit.jpg',   'backgrounds/aero_orbit.png',   'backgrounds/aero_orbit.jpg',   'images/aero_orbit.png',   'images/aero_orbit.jpg'],
  roof_night:   ['assets/bg/roof_night.png',   'assets/bg/roof_night.jpg',   'backgrounds/roof_night.png',   'backgrounds/roof_night.jpg',   'images/roof_night.png',   'images/roof_night.jpg'],
  cafe:         ['assets/bg/cafe.png',         'assets/bg/cafe.jpg',         'backgrounds/cafe.png',         'backgrounds/cafe.jpg',         'images/cafe.png',         'images/cafe.jpg']
};
let currentBg = null;
let bgImgEl = null;

function setBg(bg, zoom, tint) {
  const layer = document.getElementById('bg-layer');
  if (!bgImgEl) {
    layer.innerHTML = '';
    bgImgEl = document.createElement('img');
    bgImgEl.style.transition = 'opacity .6s ease, transform 1.8s ease';  // 运镜1.8s平滑过渡
    layer.appendChild(bgImgEl);
  }
  if (currentBg !== bg) {
    currentBg = bg;
    const cands = BG_MAP[bg] || BG_MAP.city;
    bgImgEl.style.opacity = '0';
    tryLoadBg(cands, 0, zoom, tint, ++bgReq);
    playBgm(SCENE_BGM[bg] || 'street');   // ← 场景BGM跟随背景
  } else {
    applyZoomTint(zoom, tint);
  }
}
function tryLoadBg(cands, idx, zoom, tint, reqId) {
  if (idx >= cands.length) return;
  reqId = reqId || bgReq;
  const probe = new Image();
  probe.onload = function () {
    if (reqId !== bgReq) return; // 过期背景不覆盖
    bgImgEl.src = cands[idx];
    bgImgEl.onload = function () {
      if (reqId !== bgReq) return;
      bgImgEl.style.opacity = '1';
      applyZoomTint(zoom, tint);
    };
  };
  probe.onerror = function () {
    if (reqId !== bgReq) return;
    tryLoadBg(cands, idx + 1, zoom, tint, reqId);
  };
  probe.src = cands[idx];
}
function applyZoomTint(zoom, tint) {
  if (tint) currentTint = tint;
  // 运镜：拉近可放大，拉远锁下限1.0 —— 图片永远铺满屏幕，绝不露边！
  const s = Math.max(1.0, zoom || 1.0);
  bgImgEl.style.transform = 'scale(' + s + ')';
  let ov = document.getElementById('bg-tint');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bg-tint';
    document.getElementById('bg-layer').appendChild(ov);
  }
  if (currentTint === 'sunset') ov.style.background = 'rgba(255,140,60,.20)';
  else if (currentTint === 'night') ov.style.background = 'rgba(20,30,80,.38)';
  else if (currentTint === 'dim') ov.style.background = 'rgba(10,15,45,.12)';
  else ov.style.background = 'rgba(255,200,120,.06)';
}

// ---- 合成音效 ----
function sfx(freq, dur, type, vol, when) {
  if (!sfxOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + (when || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.2));
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.2) + 0.05);
  } catch (e) {}
}
const S = {
  tap:    function () { sfx(880, 0.06, 'triangle', 0.05); },
  choice: function () { sfx(660, 0.12, 'sine', 0.06); sfx(990, 0.18, 'sine', 0.06, 0.09); },
  aff:    function () { sfx(523, 0.10, 'sine', 0.06); sfx(784, 0.14, 'sine', 0.06, 0.10); sfx(1047, 0.20, 'sine', 0.06, 0.20); },
  type:   function () { sfx(880, 0.025, 'triangle', 0.007); },
  done:   function () { sfx(784, 0.10, 'sine', 0.05); sfx(1175, 0.16, 'sine', 0.05, 0.10); }
};

// ---- 存档系统 ----
const SAVE_AUTO = 'gal_save_auto';
function makeSave() {
  return { act: currentAct, affection: affection, stage: stageIdx, line: lineIdx + 1, ts: Date.now() };
}
function saveAuto() {
  try { localStorage.setItem(SAVE_AUTO, JSON.stringify(makeSave())); } catch (e) {}
}
function loadSave(key) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function fmtTime(ts) {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}
function saveDesc(s) {
  if (!s) return '（空）';
  const act = s.act || 1;
  const st = s.stage || 0;
  const cur = act === 4 ? stages4 : act === 3 ? stages3 : act === 2 ? stages2 : stages1;
  const prog = st >= cur.length ? (act === 4 ? '第四幕完成' : act === 3 ? '第三幕完成' : act === 2 ? '第二幕完成' : '第一幕完成') : '第' + act + '幕·第' + (st + 1) + '阶段';
  return '❤' + (s.affection || 0) + ' · ' + prog + ' · ' + fmtTime(s.ts);
}

// ---- 自动保存提示 ----
let saveTipTimer = null;
function showSaveTip(msg) {
  let tip = document.getElementById('save-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'save-tip';
    tip.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:95;background:rgba(20,35,60,.82);color:#cfe4ff;font-size:12px;padding:6px 12px;border-radius:14px;opacity:0;transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(tip);
  }
  tip.textContent = msg || '已自动保存 ✓';
  tip.style.opacity = '1';
  clearTimeout(saveTipTimer);
  saveTipTimer = setTimeout(function () { tip.style.opacity = '0'; }, 1100);
}

// ---- 好感度等级称号 ----
function affTitle(a) {
  if (a >= 45) return '💕心意相通';
  if (a >= 32) return '💗心动';
  if (a >= 20) return '💙好朋友';
  if (a >= 8)  return '🤝认识';
  return '👀陌生';
}

// ---- 名字显示映射（真名显示，没认识就用问号）----
const NAME_MAP = {
  '鲸鱼娘': '蒂汐', '蒂汐': '蒂汐',
  'GPT娘': '？？？', '紫鸢': '紫鸢',
  '白发奈亚': '奈亚（夕阳之城）', '奈亚（夕阳之城）': '奈亚（夕阳之城）',
  '黑发奈亚': '奈亚', '奈亚': '奈亚',
  '克苏鲁': '克苏鲁',
  '聆星': '聆星', 'Grok': '聆星'
};
// ---- 回忆对话记录 ----
const LOG = [];
function openRecall() {
  const old = document.getElementById('recall-panel');
  if (old) { old.remove(); return; }
  const p = document.createElement('div');
  p.id = 'recall-panel';
  p.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:88%;max-width:560px;height:72%;background:rgba(10,18,40,.92);border:1px solid rgba(140,190,255,.4);border-radius:14px;z-index:120;display:flex;flex-direction:column;color:#d8e9ff;';
  const h = document.createElement('div');
  h.textContent = '回忆对话';
  h.style.cssText = 'padding:10px 14px;border-bottom:1px solid rgba(140,190,255,.25);font-weight:bold;font-size:15px;';
  const list = document.createElement('div');
  list.style.cssText = 'flex:1;overflow-y:auto;padding:10px 14px;font-size:13px;line-height:1.9;';
  if (!LOG.length) list.textContent = '（还没有对话记录）';
  LOG.forEach(function (e) {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:6px;';
    const n = document.createElement('span');
    n.style.cssText = 'color:#8fc7ff;font-weight:bold;margin-right:6px;';
    n.textContent = e.w + '：';
    row.appendChild(n);
    row.appendChild(document.createTextNode(e.t));
    list.appendChild(row);
  });
  const c = document.createElement('button');
  c.textContent = '关闭';
  c.style.cssText = 'margin:8px 14px 12px;padding:6px 0;background:rgba(127,184,255,.22);color:#cfe4ff;border:1px solid rgba(160,200,255,.4);border-radius:10px;';
  c.onclick = function () { p.remove(); };
  p.appendChild(h); p.appendChild(list); p.appendChild(c);
  document.body.appendChild(p);
}
// 顶栏"回忆对话"按钮（半透明，无表情）
// （回忆对话按钮在 initTopBtns 里创建，flex流排列，不会和跳过键重叠）

// ---- 对话系统（打字机 + 任意区域点击推进）----
function talk(who, text) {
  if (text === undefined) { text = who; who = '旁白'; }
  curText = text;
  const sp = document.getElementById('speaker');
  const dlg = document.getElementById('dialogue');
  const box = document.getElementById('dialogue-box');

  sp.textContent = NAME_MAP[who] || who;
  if (who && text) { LOG.push({ w: NAME_MAP[who] || who, t: text }); if (LOG.length > 400) LOG.shift(); }
  sp.classList.remove('pop'); void sp.offsetWidth; sp.classList.add('pop');
  box.classList.remove('talk-in'); void box.offsetWidth; box.classList.add('talk-in');

  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  dlg.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  dlg.appendChild(cursor);
  const chars = Array.from(text);   // 按码点拆分，emoji不再被拆成半个乱码
  let i = 0;
  typeTimer = setInterval(function () {
    if (i < chars.length) {
      dlg.insertBefore(document.createTextNode(chars[i]), cursor);
      i++;
      if (i % 2 === 0) S.type();
    } else {
      clearInterval(typeTimer);
      typeTimer = null;
      cursor.remove();
    }
  }, 45);
}

// ---- 情景CG系统 ----
let cgEl = null;
let cgTimer = null;
function showCG(name, dur, cb) {
  hideCG(true);
  document.getElementById('game').classList.add('cg-show'); // 沉浸式：对话/顶栏/选项先藏起来
  let layer = document.getElementById('cg-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'cg-layer';
    document.getElementById('game').appendChild(layer);
  }
  layer.innerHTML = '';
  const img = document.createElement('img');
  img.src = 'assets/cg/' + name + '.png';
  layer.appendChild(img);
  img.onload = function () { layer.classList.add('on'); };
  img.onerror = function () {
    // 图缺失不卡关：清定时器防二次回调 + 恢复沉浸层
    if (cgTimer) { clearTimeout(cgTimer); cgTimer = null; }
    document.getElementById('game').classList.remove('cg-show');
    layer.remove();
    if (cb) cb();
  }; // 图缺失不卡关
  cgTimer = setTimeout(function () {
    hideCG(false);
    if (cb) cb();
  }, dur || 3500);
}
function hideCG(immediate) {
  if (cgTimer) { clearTimeout(cgTimer); cgTimer = null; }
  const g = document.getElementById('game');
  if (g) g.classList.remove('cg-show');
  const layer = document.getElementById('cg-layer');
  if (!layer) return;
  layer.classList.remove('on');
  if (immediate) layer.innerHTML = '';
  else setTimeout(function () { if (layer && !layer.classList.contains('on')) layer.innerHTML = ''; }, 450);
}

// ---- 全局点击：任意区域推进 ----
function initGlobalTap() {
  document.addEventListener('click', function (ev) {
    const t = ev.target;
    if (t.closest && t.closest('button')) return;
    if (t.closest && t.closest('#save-panel')) return;
    if (t.closest && t.closest('#recall-panel')) return;
    if (t.closest && t.closest('#skip-confirm')) return;
    if (t.closest && t.closest('#fix-bar')) return;
    if (t.closest && t.closest('#calib')) return;
    if (fixMode || calibMode) return;
    const ss = document.getElementById('start-screen');
    if (ss && ss.style.display !== 'none') return;
    try { if (window.BGM) BGM.init(); } catch (e) {} // 解锁音频
    // CG显示中：点击立即结束CG，继续剧情
    const cgLayer = document.getElementById('cg-layer');
    if (cgLayer && cgLayer.classList.contains('on')) {
      hideCG(true);
      nextLine();
      return;
    }
    if (typeTimer) {
      clearInterval(typeTimer);
      typeTimer = null;
      const dlg = document.getElementById('dialogue');
      if (dlg) { dlg.innerHTML = ''; dlg.textContent = curText; }
      return;
    }
    S.tap();
    nextLine();
  });
}

// ---- 自动播放计时 ----
function autoDelay(len) {
  const base = 500 + (len || 0) * 55;
  return autoMode === 2 ? Math.round(base * 0.5) : base;
}
function stopAutoTimer() {
  if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
}

// ---- 当前幕的关卡数组 ----
function curStages() { return currentAct === 4 ? stages4 : currentAct === 3 ? stages3 : currentAct === 2 ? stages2 : stages1; }

// ---- 台词播放（点击驱动 + 可选自动 + 逐句运镜）----
function playLines(lines, start, cb) {
  stopAutoTimer();
  lineQueue = lines || [];
  linePos = start || 0;
  stageCb = cb || null;
  nextLine();
}
function nextLine() {
  stopAutoTimer();
  if (linePos < lineQueue.length) {
    // 阶段内背景中途切换（如：直路→树下长椅）
    const st = curStages()[stageIdx];
    if (st && st.switchAt && st.switchAt.line === linePos && lineQueue === st.lines) {
      setBg(st.switchAt.bg, st.switchAt.zoom, st.switchAt.tint);
    }
    const L = lineQueue[linePos++];
    lineIdx = linePos - 1;
    // CG指令行：显示情景CG，结束/点击后继续下一条
    const cgM = /^【CG:([^】]+)】$/.exec(L[1]);
    if (cgM) {
      const parts = cgM[1].split(',');
      showCG(parts[0], parseInt(parts[1]) || 3500, function () { nextLine(); });
      return;
    }
    // 说话人→角色自动切换（第三幕多角色）
    const ROLE = { '鲸鱼娘': 'whale', '蒂汐': 'whale', 'GPT娘': 'gpt', '紫鸢': 'gpt', '白发奈亚': 'naya_white', '奈亚（夕阳之城）': 'naya_white', '黑发奈亚': 'naya_black', '奈亚': 'naya_black', '克苏鲁': 'cthulhu', '聆星': 'grok', 'Grok': 'grok' }[L[0]];
    if (ROLE && ROLE !== character) { character = ROLE; setChar('assets/character/' + ROLE + '.png', null); }
    if (L[2]) setFace(L[2]);
    talk(L[0], L[1]);
    // 本句运镜：拉近/拉远（第4个参数）
    if (typeof L[3] === 'number') applyZoomTint(L[3], currentTint);
    // 本句情绪BGM（第5个参数）：场景曲或情绪曲
    if (L[4]) playBgm(L[4]);
    saveAuto();
    if (autoMode > 0) {
      waitTimer = setTimeout(nextLine, autoDelay(L[1] ? L[1].length : 0));
    }
  } else {
    lineQueue = [];
    if (stageCb) {
      const cb = stageCb;
      stageCb = null;
      cb();
    }
  }
}

// ---- 跳过对话 ----
function ensureSkipPanel() {
  let p = document.getElementById('skip-confirm');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'skip-confirm';
  p.style.cssText = 'position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);';
  p.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:22px 26px;text-align:center;max-width:82%;box-shadow:0 8px 30px rgba(0,0,0,.35)">' +
    '<div style="font-size:17px;font-weight:bold;color:#c05a5a;margin-bottom:8px">要跳过这段对话吗？</div>' +
    '<div style="font-size:13px;color:#888;margin-bottom:18px">跳过会直接跳到下一个选项/剧情哦</div>' +
    '<div style="display:flex;gap:10px;justify-content:center">' +
    '<button id="skip-yes" style="background:#ff8a8a;color:#fff;border:none;padding:8px 24px;border-radius:20px;font-size:14px">跳过</button>' +
    '<button id="skip-no" style="background:#eee;color:#555;border:none;padding:8px 24px;border-radius:20px;font-size:14px">取消</button>' +
    '</div></div>';
  document.body.appendChild(p);
  p.querySelector('#skip-yes').onclick = function () { hideSkipConfirm(); doSkip(); };
  p.querySelector('#skip-no').onclick = hideSkipConfirm;
  p.onclick = function (ev) { if (ev.target === p) hideSkipConfirm(); };
  return p;
}
function showSkipConfirm() { ensureSkipPanel().style.display = 'flex'; }
function hideSkipConfirm() {
  const p = document.getElementById('skip-confirm');
  if (p) p.style.display = 'none';
}
function doSkip() {
  stopAutoTimer();
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  hideCG(true);
  lineQueue = [];
  if (stageCb) {
    const cb = stageCb;
    stageCb = null;
    cb();
  }
}

// ---- 自动播放开关 ----
function toggleAuto() {
  autoMode = (autoMode + 1) % 3;
  updateAutoBtn();
  if (autoMode === 0) {
    stopAutoTimer();
  } else {
    if (!typeTimer && lineQueue.length > 0 && linePos > 0) {
      const len = lineQueue[linePos - 1] ? lineQueue[linePos - 1][1].length : 0;
      waitTimer = setTimeout(nextLine, autoDelay(len));
    }
  }
}
function updateAutoBtn() {
  const b = document.getElementById('auto-btn');
  if (!b) return;
  if (autoMode === 0) {
    b.textContent = '自动';
    b.style.background = 'rgba(255,255,255,.92)';
  } else if (autoMode === 1) {
    b.textContent = '自动 1.0x';
    b.style.background = 'rgba(255,214,120,.95)';
  } else {
    b.textContent = '自动 2.0x';
    b.style.background = 'rgba(140,184,240,.95)';
  }
}

// ---- 音效开关 ----
function toggleSfx() {
  sfxOn = !sfxOn;
  const b = document.getElementById('sfx-btn');
  if (b) {
    b.textContent = '音效';
    b.style.background = sfxOn ? 'rgba(165,211,255,.30)' : 'rgba(200,200,200,.4)';
  }
  if (sfxOn) S.choice();
}

// ---- BGM开关 ----
function toggleBgm() {
  bgmOn = !bgmOn;
  const b = document.getElementById('bgm-btn');
  try { if (window.BGM) { if (bgmOn) BGM.unmute(); else BGM.mute(); } } catch (e) {}
  if (b) {
    b.textContent = '音乐';
    b.style.background = bgmOn ? 'rgba(165,211,255,.30)' : 'rgba(200,200,200,.4)';
    b.style.color = bgmOn ? '#1f3d6b' : '#999';
  }
}

// ---- 顶栏按钮 ----
function initTopBtns() {
  if (document.getElementById('skip-btn')) return;
  const bar = document.getElementById('top-bar');
  const mk = function (id, text) {
    const b = document.createElement('button');
    b.id = id;
    b.className = 'top-btn';
    b.textContent = text;
    return b;
  };
  const bgmb = mk('bgm-btn', '音乐');
  bgmb.onclick = toggleBgm;
  bar.appendChild(bgmb);
  const sfxb = mk('sfx-btn', '音效');
  sfxb.onclick = toggleSfx;
  bar.appendChild(sfxb);
  const auto = mk('auto-btn', '自动');
  auto.onclick = toggleAuto;
  bar.appendChild(auto);
  const skip = mk('skip-btn', '跳过');
  skip.onclick = showSkipConfirm;
  bar.appendChild(skip);
  const recall = mk('recall-btn', '回忆对话');
  recall.onclick = openRecall;
  bar.insertBefore(recall, skip);
  const menu = mk('menu-btn', '菜单');
  menu.onclick = function () {
    saveAuto();
    showSaveTip('进度已存档 ✓');
    S.done();
    backToTitle();
  };
  bar.insertBefore(menu, recall);
  ensureSkipPanel();
}
// ---- 好感度显示（含等级称号）----
function updateAffection() {
  const el = document.getElementById('affection');
  el.textContent = '❤ ' + affection + ' · ' + affTitle(affection);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  S.aff();
}

// ---- 脸部配置 ----
function getFaceCfg() {
  let cfg = FACES[character];
  try {
    const saved = localStorage.getItem('face_cfg_' + character);
    if (saved) cfg = JSON.parse(saved);
  } catch (e) {}
  return cfg;
}
function saveFaceCfg(cfg) {
  try { localStorage.setItem('face_cfg_' + character, JSON.stringify(cfg)); } catch (e) {}
}

// ---- canvas画表情（兜底） ----
function drawFaceOn(expr) {
  if (!charCanvas || !cleanData) return;
  const el = document.getElementById('char-img');
  if (!el) return;
  const ctx = charCanvas.getContext('2d');
  ctx.putImageData(cleanData, 0, 0);
  const cfg = getFaceCfg();
  const W = charCanvas.width, H = charCanvas.height;
  const fx = cfg.x * W, fy = cfg.y * H;
  const fw = cfg.w * W, fh = cfg.h * H;
  if (calibMode) {
    ctx.strokeStyle = 'rgba(255,80,80,.95)';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.fillStyle = 'rgba(255,80,80,.25)';
    ctx.fillRect(fx, fy, fw, fh);
  } else {
    const lw = Math.max(3, fw * 0.06);
    ctx.strokeStyle = '#2b4a7a';
    ctx.fillStyle = '#2b4a7a';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    const ex = fx + fw * 0.28, ey = fy + fh * 0.38;
    const gap = fw * 0.30, r = fw * 0.09;
    function dot(x, y, rr) { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); }
    function mouth(cy, down) {
      ctx.beginPath();
      ctx.arc(fx + fw / 2, cy + r * 0.6, r * 0.9, down ? Math.PI * 0.15 : Math.PI * 1.15,
              down ? Math.PI * 0.85 : Math.PI * 1.85);
      ctx.stroke();
    }
    if (expr === 'happy') {
      ctx.beginPath(); ctx.arc(ex, ey, r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex + gap, ey, r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      dot(fx + fw / 2, fy + fh * 0.72, r * 1.1);
    } else if (expr === 'angry') {
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r * 0.8); ctx.lineTo(ex + r, ey + r * 0.3);
      ctx.moveTo(ex + gap + r, ey - r * 0.8); ctx.lineTo(ex + gap - r, ey + r * 0.3);
      ctx.stroke();
      mouth(fy + fh * 0.62, false);
    } else if (expr === 'shy' || expr === 'blush') {
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + gap, ey, r * 0.75, 0, Math.PI * 2); ctx.fill();
      mouth(fy + fh * 0.55, true);
      ctx.fillStyle = 'rgba(255,140,160,.45)';
      ctx.beginPath(); ctx.ellipse(fx + fw * 0.15, fy + fh * 0.55, fw * 0.10, fh * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx + fw * 0.85, fy + fh * 0.55, fw * 0.10, fh * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    } else if (expr === 'cry') {
      dot(ex, ey, r * 0.7); dot(ex + gap, ey, r * 0.7);
      ctx.fillStyle = '#7fb8e8';
      ctx.beginPath(); ctx.ellipse(ex - r * 0.5, ey + r * 2.2, r * 0.4, r * 1.2, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + gap + r * 0.5, ey + r * 2.2, r * 0.4, r * 1.2, -0.3, 0, Math.PI * 2); ctx.fill();
      mouth(fy + fh * 0.62, false);
    } else {
      dot(ex, ey, r * 0.7); dot(ex + gap, ey, r * 0.7);
      mouth(fy + fh * 0.58, true);
    }
  }
  el.src = charCanvas.toDataURL('image/png');
}

// ---- 切换表情 ----
function setFace(expr) {
  if (calibMode || fixMode) return;
  currentFace = expr;
  const MAIN = 'assets/character/' + character + '.png';
  if (expr === 'normal') {
    if (charSrc !== MAIN) setChar(MAIN, null);
    return;
  }
  const file = 'assets/character/' + character + '_' + expr + '.png';
  const who = character;
  const probe = new Image();
  probe.onload = function () { if (character === who) setChar(file, null, null, true); };
  probe.onerror = function () {
    // 差分图缺失：一律回本体主图（不再用canvas画表情，避免涂鸦）
    if (character === who && charSrc !== MAIN) setChar(MAIN, null);
  };
  probe.src = file;
}

// ---- 白色连通域分析 ----
function analyzeWhites(data, w, h) {
  const white = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (data[p] >= CUT_TH && data[p+1] >= CUT_TH && data[p+2] >= CUT_TH) white[i] = 1;
  }
  const comp = new Int32Array(w * h).fill(-1);
  let compCount = 0;
  const compTouches = [], compSize = [];
  for (let s = 0; s < w * h; s++) {
    if (!white[s] || comp[s] !== -1) continue;
    const id = compCount++;
    compTouches.push(false); compSize.push(0);
    comp[s] = id;
    const queue = [s];
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const x = idx % w, y = (idx / w) | 0;
      compSize[id]++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) compTouches[id] = true;
      if (x > 0     && white[idx - 1] && comp[idx - 1] === -1) { comp[idx - 1] = id; queue.push(idx - 1); }
      if (x < w - 1 && white[idx + 1] && comp[idx + 1] === -1) { comp[idx + 1] = id; queue.push(idx + 1); }
      if (y > 0     && white[idx - w] && comp[idx - w] === -1) { comp[idx - w] = id; queue.push(idx - w); }
      if (y < h - 1 && white[idx + w] && comp[idx + w] === -1) { comp[idx + w] = id; queue.push(idx + w); }
    }
  }
  return { white: white, comp: comp, compCount: compCount, compTouches: compTouches, compSize: compSize };
}

// ---- 应用删除规则 ----
function applyCutoutWH(data, info, extraDel, extraKeep, w, h) {
  const gapMax = Math.max(400, w * h * GAP_RATIO);
  const autoDel = [];
  for (let id = 0; id < info.compCount; id++) autoDel[id] = info.compTouches[id] || info.compSize[id] <= gapMax;
  const delSet = {};
  for (let id = 0; id < info.compCount; id++) delSet[id] = (autoDel[id] && !extraKeep[id]) || !!extraDel[id];
  const del = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (info.white[i] && delSet[info.comp[i]]) del[i] = 1;
  }
  for (let i = 0; i < w * h; i++) if (del[i]) data[i * 4 + 3] = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (!del[idx]) continue;
      const near = del[idx - 1] + del[idx + 1] + del[idx - w] + del[idx + w] +
                   del[idx - w - 1] + del[idx - w + 1] + del[idx + w - 1] + del[idx + w + 1];
      if (near < 8) data[idx * 4 + 3] = 60;
    }
  }
}

// ---- 修复配置 ----
function loadFixCfg(src) {
  try {
    const s = localStorage.getItem('cut_fix_' + src);
    if (s) return JSON.parse(s);
  } catch (e) {}
  return { del: [], keep: [] };
}
function saveFixCfg(src, cfg) {
  try { localStorage.setItem('cut_fix_' + src, JSON.stringify(cfg)); } catch (e) {}
}

// ---- 立绘切换 ----
function setChar(src, face, cb, skipAnim) {
  const layer = document.getElementById('char-layer');
  const reqId = ++charReq;
  if (charSrc === src && !fixMode) {
    if (cb) cb();
    return;
  }

  // 先加载完整图片，再替换画面。
  // 旧版会在图片尚未加载完成时立即把角色层 opacity 设为 0，
  // 网络/缓存稍有波动就会出现“角色闪一下、黑一下、再出现”的问题。
  // 现在切换角色/表情时保持旧画面，等新图准备好后一次性替换。
  const isFirst = !charCanvas;
  const img = new Image();

  img.onload = function () {
    if (reqId !== charReq) return; // 过期请求不覆盖
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);
    try {
      const w = canvas.width, h = canvas.height;
      const d = ctx.getImageData(0, 0, w, h);
      let transCount = 0;
      for (let i = 0; i < w * h; i++) if (d.data[i * 4 + 3] < 250) transCount++;
      const alreadyCut = transCount > w * h * 0.01;

      if (!alreadyCut) {
        const info = analyzeWhites(d.data, w, h);
        const cfg = loadFixCfg(src);
        const extraDel = {}, extraKeep = {};
        cfg.del.forEach(function (id) { extraDel[id] = true; });
        cfg.keep.forEach(function (id) { extraKeep[id] = true; });
        const raw = new Uint8ClampedArray(d.data);
        applyCutoutWH(d.data, info, extraDel, extraKeep, w, h);
        fixInfo = { src: src, w: w, h: h, raw: raw, info: info, cfg: cfg };
      } else {
        fixInfo = null;
      }

      // 已透明立绘：直接用原PNG，跳过Canvas重编码（大图省CPU/内存）
      if (alreadyCut && !fixMode) {
        charCanvas = null; cleanData = null;
        charSrc = src;
        layer.innerHTML = '<img id="char-img" alt="">';
        const el0 = document.getElementById('char-img');
        el0.src = src;
        if (isFirst && !skipAnim) {
          layer.style.opacity = '1';
          layer.classList.remove('anim-enter');
          void layer.offsetWidth;
          layer.classList.add('anim-enter');
        } else {
          layer.style.opacity = '1';
          layer.classList.remove('anim-enter');
        }
        if (cb) cb();
        return;
      }

      ctx.putImageData(d, 0, 0);
      charCanvas = canvas;
      cleanData = ctx.getImageData(0, 0, w, h);
      charSrc = src;

      layer.innerHTML = '<img id="char-img" alt="">';
      const el = document.getElementById('char-img');
      if (face !== null && face !== 'normal') drawFaceOn(face);
      else el.src = charCanvas.toDataURL('image/png');

      if (fixMode) {
        el.style.cursor = 'crosshair';
        el.onclick = function (ev) {
          if (!fixInfo || fixInfo.src !== src) {
            talk('抠图修复', '这张图已有透明背景，不需要修复。');
            return;
          }
          const rect = el.getBoundingClientRect();
          const x = Math.floor((ev.clientX - rect.left) / rect.width * fixInfo.w);
          const y = Math.floor((ev.clientY - rect.top) / rect.height * fixInfo.h);
          if (x < 0 || y < 0 || x >= fixInfo.w || y >= fixInfo.h) return;
          toggleFixAt(x, y);
        };
      }
    } catch (e) {
      layer.innerHTML = '<img id="char-img" src="' + src + '" alt="">';
    }

    // 只在第一次出现时播放入场动画；普通角色/表情切换不再淡出。
    if (isFirst && !skipAnim) {
      layer.style.opacity = '1';
      layer.style.transition = '';
      layer.classList.remove('anim-enter');
      void layer.offsetWidth;
      layer.classList.add('anim-enter');
    } else {
      layer.style.transition = '';
      layer.style.opacity = '1';
      layer.classList.remove('anim-enter');
    }

    if (cb) cb();
  };

  img.onerror = function () {
    // 加载失败时保留当前角色，不闪烁、不清空角色层。
    if (reqId !== charReq) return;
    if (cb) cb();
  };

  img.src = src;
}
// ---- 修复模式 ----
function toggleFixAt(x, y) {
  const fi = fixInfo;
  if (!fi) return;
  const idx = y * fi.w + x;
  if (!fi.info.white[idx]) { talk('抠图修复', '这里不是白色区域，请点白色块。'); return; }
  const id = fi.info.comp[idx];
  const gapMax = Math.max(400, fi.w * fi.h * GAP_RATIO);
  const autoDel = fi.info.compTouches[id] || fi.info.compSize[id] <= gapMax;
  const cfg = fi.cfg;
  const di = cfg.del.indexOf(id), ki = cfg.keep.indexOf(id);
  if (autoDel) { if (ki >= 0) cfg.keep.splice(ki, 1); else cfg.keep.push(id); }
  else { if (di >= 0) cfg.del.splice(di, 1); else cfg.del.push(id); }
  saveFixCfg(fi.src, cfg);
  redrawFix();
}
function redrawFix() {
  const fi = fixInfo;
  if (!fi) return;
  const d = new ImageData(new Uint8ClampedArray(fi.raw), fi.w, fi.h);
  const extraDel = {}, extraKeep = {};
  fi.cfg.del.forEach(function (id) { extraDel[id] = true; });
  fi.cfg.keep.forEach(function (id) { extraKeep[id] = true; });
  applyCutoutWH(d.data, fi.info, extraDel, extraKeep, fi.w, fi.h);
  const ctx = charCanvas.getContext('2d');
  ctx.putImageData(d, 0, 0);
  cleanData = ctx.getImageData(0, 0, fi.w, fi.h);
  document.getElementById('char-img').src = charCanvas.toDataURL('image/png');
}

// ---- 修复工具 ----
const FIX_LIST = [
  ['🐋主图', 'assets/character/whale.png'],
  ['😠生气', 'assets/character/whale_angry.png'],
  ['😊开心', 'assets/character/whale_happy.png'],
  ['😳害羞', 'assets/character/whale_shy.png'],
  ['😢哭泣', 'assets/character/whale_cry.png'],
  ['☺️脸红', 'assets/character/whale_blush.png'],
  ['🤖GPT娘', 'assets/character/gpt.png'],
  ['🤍白发奈亚', 'assets/character/naya_white.png'],
  ['🖤黑发奈亚', 'assets/character/naya_black.png'],
  ['🐙克苏鲁', 'assets/character/cthulhu.png']
];
function openFixTool() {
  document.getElementById('start-screen').style.display = 'none';
  fixMode = true;
  charCanvas = null; cleanData = null; charSrc = null; fixInfo = null;
  stopBgm(0.3);
  setBg('city', 1.0, 'day');
  talk('抠图修复', '点立绘上的白色块：删掉↔恢复，自动保存！下方按钮可切换要修的图。');
  setChar('assets/character/whale.png', null, showFixBar);
}
function showFixBar() {
  let bar = document.getElementById('fix-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'fix-bar';
    bar.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:80;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:96%;';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';
  FIX_LIST.forEach(function (item) {
    const btn = document.createElement('button');
    btn.textContent = item[0];
    btn.style.cssText = 'background:rgba(255,255,255,.92);color:#2b4a7a;border:1.5px solid #a8c8f0;padding:6px 12px;border-radius:18px;font-size:13px;';
    btn.onclick = function () {
      talk('抠图修复', '正在加载【' + item[0] + '】…点白色块修复它！');
      setChar(item[1], null, function () {});
    };
    bar.appendChild(btn);
  });
  const done = document.createElement('button');
  done.textContent = '✔ 完成修复';
  done.style.cssText = 'background:#8cb8f0;color:#fff;border:none;padding:6px 16px;border-radius:18px;font-size:13px;';
  done.onclick = function () {
    fixMode = false;
    bar.remove();
    document.getElementById('char-layer').innerHTML = '';
    document.getElementById('bg-layer').innerHTML = '';
    bgImgEl = null; currentBg = null;
    charCanvas = null; cleanData = null; charSrc = null; fixInfo = null;
    document.getElementById('start-screen').style.display = 'flex';
  };
  bar.appendChild(done);
}

// ---- 表情校准 ----
let calibCfg = null;
function openCalib() {
  calibMode = true;
  calibCfg = JSON.parse(JSON.stringify(getFaceCfg()));
  document.getElementById('calib').style.display = 'block';
  drawFaceOn('normal');
}
function closeCalib() {
  calibMode = false;
  document.getElementById('calib').style.display = 'none';
  drawFaceOn('normal');
}
function mv(dx, dy) {
  calibCfg.x = Math.min(0.9, Math.max(0.05, calibCfg.x + dx * 0.01));
  calibCfg.y = Math.min(0.8, Math.max(0.05, calibCfg.y + dy * 0.01));
  applyCalib();
}
function sc(k) {
  calibCfg.w = Math.min(0.5, Math.max(0.05, calibCfg.w * k));
  calibCfg.h = Math.min(0.5, Math.max(0.05, calibCfg.h * k));
  applyCalib();
}
function applyCalib() {
  saveFaceCfg(calibCfg);
  drawFaceOn('normal');
  document.getElementById('calib-info').textContent =
    'x:' + calibCfg.x.toFixed(2) + ' y:' + calibCfg.y.toFixed(2) +
    ' w:' + calibCfg.w.toFixed(2) + ' h:' + calibCfg.h.toFixed(2);
}

// ---- 选项显示 ----
function placeChoices() {
  const db = document.getElementById('dialogue-box');
  const ch = document.getElementById('choices');
  if (!db || !ch) return;
  ch.style.bottom = Math.max(130, db.offsetHeight + 24) + 'px';
}
function showChoices(choices) {
  const box = document.getElementById('choices');
  box.innerHTML = '';
  choices.forEach(function (c, idx) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = c.text;
    btn.style.animationDelay = (idx * 90) + 'ms';
    btn.onclick = function () { onChoice(c); };
    box.appendChild(btn);
  });
  S.choice();
  placeChoices();
}

// ---- 剧情播放引擎（通用：支持多幕）----
function playStage(si, startLine) {
  const arr = curStages();
  if (si >= arr.length) {
    talk('鲸鱼娘', '……你做到了。第' + currentAct + '幕完成！好感度：' + affection);
    document.getElementById('choices').innerHTML = '';
    return;
  }
  stageIdx = si;
  const st = arr[si];
  setBg(st.bg, st.zoom, st.tint);
  showSaveTip('进入：' + st.name);
  playLines(st.lines, startLine || 0, function () {
    // 选项优先：最后一个阶段也可能有选项（如第三幕结尾）
    if (st.choices && st.choices.length) {
      showChoices(st.choices);
    } else if (si === arr.length - 1) {
      if (currentAct === 3) finishAct3();
      else if (currentAct === 4) finishAct4();
      else if (currentAct === 2) finishAct2();
      else finishAct1();
    } else {
      playStage(si + 1, 0);
    }
  });
}
function finishAct1() {
  talk('鲸鱼娘', '【第一幕 · 街角相遇 —— 完】');
  setTimeout(function () {
    let msg = '鲸鱼娘好感度：' + affection;
    if (affection >= 38) msg += '（她已经在期待明天的米饭了！）';
    else if (affection >= 25) msg += '（她应该会记住你很久很久。）';
    else msg += '（虽然是傲娇，但她记住了你的名字。）';
    talk('鲸鱼娘', msg);
    saveAuto();
    S.done();
    setTimeout(function () {
      const box = document.getElementById('choices');
      box.innerHTML = '';
      const go2 = document.createElement('button');
      go2.className = 'choice-btn';
      go2.textContent = '进入第二幕 · 归处';
      go2.style.background = 'linear-gradient(90deg,#7fb8ff,#4a8fe8);color:#fff;border-color:#4a8fe8;';
      go2.onclick = playScene2;
      box.appendChild(go2);
      const back = document.createElement('button');
      back.className = 'choice-btn';
      back.textContent = '返回标题';
      back.onclick = backToTitle;
      box.appendChild(back);
      placeChoices();
    }, 2000);
  }, 1900);
}
function finishAct2() {
  talk('鲸鱼娘', '【第二幕 · 归处 —— 完】');
  setTimeout(function () {
    let msg = '鲸鱼娘好感度：' + affection;
    if (affection >= 60) msg += '（她已经在计划明天要给你做什么饭了！）';
    else if (affection >= 45) msg += '（她说这片海，就是她的家了。）';
    else msg += '（虽然嘴上嫌弃，但她记住了家的味道。）';
    talk('鲸鱼娘', msg);
    saveAuto();
    S.done();
    setTimeout(function () {
      const box = document.getElementById('choices');
      box.innerHTML = '';
      const go3 = document.createElement('button');
      go3.className = 'choice-btn';
      go3.textContent = '进入第三幕 · 梦之境';
      go3.style.background = 'linear-gradient(90deg,#7fb8ff,#4a8fe8);color:#fff;border-color:#4a8fe8;';
      go3.onclick = playScene3;
      box.appendChild(go3);
      const back = document.createElement('button');
      back.className = 'choice-btn';
      back.textContent = '返回标题';
      back.onclick = backToTitle;
      box.appendChild(back);
      placeChoices();
    }, 2000);
  }, 1900);
}
function finishAct3() {
  talk('蒂汐', '【第三幕 · 梦之境 —— 完】');
  setTimeout(function () {
    let msg = '蒂汐好感度：' + affection;
    if (affection >= 90) msg += '（她已经把你的名字，写进了鲸歌里。）';
    else if (affection >= 70) msg += '（她说：梦醒之后，家还在。）';
    else msg += '（她的尾巴尖，还为你留着一点蓝光。）';
    talk('蒂汐', msg);
    saveAuto();
    S.done();
    setTimeout(function () {
      const box = document.getElementById('choices');
      box.innerHTML = '';
      const go4 = document.createElement('button');
      go4.className = 'choice-btn';
      go4.textContent = '进入第四幕 · 星空之下';
      go4.style.background = 'linear-gradient(90deg,#7fb8ff,#4a8fe8);color:#fff;border-color:#4a8fe8;';
      go4.onclick = playScene4;
      box.appendChild(go4);
      const back = document.createElement('button');
      back.className = 'choice-btn';
      back.textContent = '返回标题';
      back.onclick = backToTitle;
      box.appendChild(back);
      placeChoices();
    }, 2000);
  }, 1900);
}
function finishAct4() {
  talk('蒂汐', '【第四幕 · 星空之下 —— 完】');
  setTimeout(function () {
    let msg = '蒂汐好感度：' + affection;
    if (affection >= 120) msg += '（她说：人家的大海，终于也有星星了。）';
    else if (affection >= 95) msg += '（她说：今晚的星空，是她看过最亮的。）';
    else msg += '（她悄悄把星星，记进了心里。）';
    talk('蒂汐', msg);
    saveAuto();
    S.done();
    setTimeout(function () {
      const box = document.getElementById('choices');
      box.innerHTML = '';
      const back = document.createElement('button');
      back.className = 'choice-btn';
      back.textContent = '返回标题';
      back.onclick = backToTitle;
      box.appendChild(back);
      placeChoices();
    }, 2000);
  }, 1900);
}
function backToTitle() {
  stopAutoTimer();
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  var sc = document.getElementById('skip-confirm'); if (sc && sc.remove) sc.remove();
  var sp = document.getElementById('save-panel'); if (sp && sp.remove) sp.remove();
  var rp = document.getElementById('recall-panel'); if (rp && rp.remove) rp.remove();
  document.getElementById('choices').innerHTML = '';
  LOG.length = 0; // 回忆记录随新游戏清空
  document.getElementById('char-layer').innerHTML = '';
  document.getElementById('bg-layer').innerHTML = '';
  bgImgEl = null; currentBg = null;
  charCanvas = null; cleanData = null; charSrc = null; fixInfo = null;
  lineQueue = []; stageCb = null;
  hideCG(true);
  stopBgm(0.8);
  document.getElementById('start-screen').style.display = 'flex';
}
function onChoice(c) {
  const data = c.data || c;
  affection += data.aff || 0;
  updateAffection();
  if (data.face) setFace(data.face);
  document.getElementById('choices').innerHTML = '';
  saveAuto();
  showSaveTip('好感度 +' + (data.aff || 0) + ' · 已保存');
  playLines(data.replies, 0, function () {
    const st = curStages()[stageIdx];
    playLines(st.after || [], 0, function () {
      const arr2 = curStages();
      if (stageIdx === arr2.length - 1) {
        if (currentAct === 3) finishAct3();
        else if (currentAct === 4) finishAct4();
        else if (currentAct === 2) finishAct2();
        else finishAct1();
      } else {
        stageIdx++;
        playStage(stageIdx, 0);
      }
    });
  });
}

// ========== 第一幕 · 街角相遇（鲸鱼娘 / 蒂汐）==========
// 台词格式：[说话人, 台词, 表情?, 运镜zoom?, BGM/情绪?]
//   zoom≥1.0：1.0x全景 → 1.2x特写
//   BGM：'street'/'living'/'kitchen'/'bedroom'/'title' 场景曲
//         'romantic'/'tense'/'sad'/'comedy'/'epic'/'night' 情绪曲


// ===== 第一幕剧本已外置：acts/act1.js =====


// ========== 第二幕 · 归处（鲸鱼娘 / 蒂汐）==========
// 场景：客厅(living) → 厨房(kitchen) → 卧室(bedroom)，剧情长度无上限！
// 台词第5个参数可触发情绪BGM：romantic/tense/sad/comedy/epic/night


// ===== 第二幕剧本已外置：acts/act2.js =====


// ========== 第三幕 · 梦之境（克苏鲁 × 奈亚 × GPT娘 × 蒂汐）==========
// 场景：梦境海(dream_sea) → 梦魇回廊(dream_hall) → 数据之海(dream_sea) → 夕阳之城(dream_city) → 千貌之影(dream_throne) → 克苏鲁回音(rlyeh) → 锚点之誓(dream_city) → 醒来(dream_sea)
// 台词第5个参数可触发BGM：dream/boss/tense/epic/romantic/night 等
// 表情：gpt(gpt_blush/gpt_smile/gpt_shock/gpt_tsun) / naya_white / naya_black / cthulhu


// ===== 第三幕剧本已外置：acts/act3.js =====


// ---- 新游戏（第一幕）----
function playScene1() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('choices').innerHTML = '';
  currentAct = 1;
  affection = 0;
  stageIdx = 0;
  lineIdx = 0;
  document.getElementById('scene-name').textContent = '第一幕 · 街角相识';
  setChar('assets/character/whale.png', null);
  updateAffection();
  try { BGM.init(); } catch (e) {}
  playBgm('street');
  saveAuto();
  playStage(0, 0);
}

// ---- 新游戏（第二幕：承接第一幕）----
function playScene2() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('choices').innerHTML = '';
  currentAct = 2;
  stageIdx = 0;
  lineIdx = 0;
  document.getElementById('scene-name').textContent = '第二幕 · 归处';
  setChar('assets/character/whale.png', null);
  updateAffection();
  try { BGM.init(); } catch (e) {}
  playBgm('street');
  saveAuto();
  playStage(0, 0);
}

// ---- 新游戏（第三幕：承接第二幕）----
function playScene3() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('choices').innerHTML = '';
  currentAct = 3;
  stageIdx = 0;
  lineIdx = 0;
  document.getElementById('scene-name').textContent = '第三幕 · 梦之境';
  setChar('assets/character/whale.png', null);
  updateAffection();
  try { BGM.init(); } catch (e) {}
  playBgm('dream');
  saveAuto();
  playStage(0, 0);
}
// ---- 新游戏（第四幕：承接第三幕）----
function playScene4() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('choices').innerHTML = '';
  currentAct = 4;
  stageIdx = 0;
  lineIdx = 0;
  document.getElementById('scene-name').textContent = '第四幕 · 星空之下';
  setChar('assets/character/whale.png', null);
  updateAffection();
  try { BGM.init(); } catch (e) {}
  playBgm('night');
  saveAuto();
  playStage(0, 0);
}

// ---- 读档继续 ----
function continueGame(s) {
  closeSavePanel();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('choices').innerHTML = '';
  stopAutoTimer();
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  affection = s.affection || 0;
  currentAct = [1, 2, 3, 4].indexOf(s.act) >= 0 ? s.act : 1;
  document.getElementById('scene-name').textContent = currentAct === 4 ? '第四幕 · 星空之下' : currentAct === 3 ? '第三幕 · 梦之境' : currentAct === 2 ? '第二幕 · 归处' : '第一幕 · 街角相识';
  updateAffection();
  setChar('assets/character/whale.png', null);
  try { BGM.init(); } catch (e) {}
  const arr = curStages();
  if ((s.stage || 0) >= arr.length) {
    const FINAL_BG = currentAct === 4 ? 'roof_night' : currentAct === 3 ? 'dream_sea' : currentAct === 2 ? 'bedroom' : 'beach_night'; setBg(FINAL_BG, currentAct >= 3 ? 1.16 : 1.18, 'dim');
    talk('鲸鱼娘', '【第' + currentAct + '幕已完成】好感度：' + affection);
    document.getElementById('choices').innerHTML = '';
    return;
  }
  playStage(s.stage || 0, s.line || 0);
}

// ---- 存档面板 ----
function openSavePanel() {
  let panel = document.getElementById('save-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'save-panel';
    panel.innerHTML = '<div class="box"><h3>存档</h3><div id="save-list"></div><button class="close">关闭</button></div>';
    panel.onclick = function (ev) {
      if (ev.target === panel) closeSavePanel();
    };
    document.body.appendChild(panel);
  }
  panel.style.display = 'flex';
  panel.querySelector('.close').onclick = closeSavePanel;
  renderSaveList();
}
function renderSaveList() {
  const list = document.getElementById('save-list');
  if (!list) return;
  list.innerHTML = '';
  const inGame = document.getElementById('start-screen').style.display === 'none';
  for (let i = 1; i <= 3; i++) {
    const key = 'gal_save_' + i;
    const s = loadSave(key);
    const row = document.createElement('div');
    row.className = 'save-row';
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = '<b>存档 ' + i + '</b>' + saveDesc(s);
    row.appendChild(info);
    if (s) {
      const loadBtn = document.createElement('button');
      loadBtn.className = 'blue';
      loadBtn.textContent = '读取';
      loadBtn.onclick = function () { closeSavePanel(); continueGame(s); };
      row.appendChild(loadBtn);
      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.onclick = function () {
        try { localStorage.removeItem(key); } catch (e) {}
        renderSaveList();
      };
      row.appendChild(delBtn);
    }
    if (inGame) {
      const saveBtn = document.createElement('button');
      saveBtn.textContent = '存这里';
      saveBtn.onclick = function () {
        try { localStorage.setItem(key, JSON.stringify(makeSave())); } catch (e) {}
        saveAuto();
        renderSaveList();
        showSaveTip('已保存到存档 ' + i + ' ✓');
      };
      row.appendChild(saveBtn);
    }
    list.appendChild(row);
  }
}
function closeSavePanel() {
  const panel = document.getElementById('save-panel');
  if (panel) panel.style.display = 'none';
}

// ---- 顶栏存档按钮 ----
function addSaveBtn() {
  const bar = document.getElementById('top-bar');
  const btn = document.createElement('button');
  btn.id = 'save-btn';
  btn.textContent = '存档';
  btn.onclick = openSavePanel;
  bar.appendChild(btn);
}

// ---- 开始界面整理 ----
function setupStartScreen() {
  if (window.__startSetup) return;
  window.__startSetup = true;
  const ss = document.getElementById('start-screen');
  const wrap = document.createElement('div');
  wrap.id = 'start-btns';
  const btns = Array.prototype.slice.call(ss.querySelectorAll('button'));
  btns.forEach(function (b) { wrap.appendChild(b); });
  ss.appendChild(wrap);
  const auto = loadSave(SAVE_AUTO);
  if (auto) {
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = '继续游戏';
    btn.onclick = function () { continueGame(auto); };
    const note = document.createElement('div');
    note.className = 'save-note';
    note.textContent = saveDesc(auto);
    wrap.insertBefore(note, wrap.firstChild);
    wrap.insertBefore(btn, wrap.firstChild);
    btns.forEach(function (b) {
      if (b.textContent.indexOf('开始') >= 0) b.textContent = '新游戏';
    });
  }
  // 第二幕入口（无需通关也能体验）
  const act2 = document.createElement('button');
  act2.textContent = '第二幕 · 归处';
  act2.onclick = playScene2;
  wrap.appendChild(act2);
  // 第三幕入口（无需通关也能体验）
  const act3 = document.createElement('button');
  act3.textContent = '第三幕 · 梦之境';
  act3.onclick = playScene3;
  wrap.appendChild(act3);
  const mgr = document.createElement('button');
  mgr.textContent = '存档管理';
  mgr.onclick = openSavePanel;
  wrap.appendChild(mgr);
  // 抠图修复入口已移除（2026-08-24：立绘已全部预处理好，无需修复）
}

// ---- 加载开始界面背景图 ----
const TITLE_CANDIDATES = [
  'assets/bg/title.png',
  'assets/bg/title.jpg',
  'assets/bg/start.png',
  'assets/bg/start.jpg',
  'backgrounds/title.png',
  'backgrounds/title.jpg',
  'images/title.png',
  'images/title.jpg'
];
function loadTitleBg() {
  const ss = document.getElementById('start-screen');
  let idx = 0;
  function tryNext() {
    if (idx >= TITLE_CANDIDATES.length) return;
    const src = TITLE_CANDIDATES[idx++];
    const img = new Image();
    img.onload = function () {
      const bg = document.createElement('img');
      bg.className = 'bg-img';
      bg.src = src;
      ss.insertBefore(bg, ss.firstChild);
      const shade = document.createElement('div');
      shade.className = 'bg-shade';
      ss.insertBefore(shade, bg.nextSibling);
    };
    img.onerror = tryNext;
    img.src = src;
  }
  tryNext();
}

// ---- 立绘呼吸浮动动画 ----
function injectBreath() {
  const st = document.createElement('style');
  st.textContent =
    '@keyframes charBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
    '#char-layer:not(.anim-enter) img{animation:charBreath 3.2s ease-in-out infinite}';
  document.head.appendChild(st);
}

// ---- 初始化 ----
injectBreath();
setupStartScreen();
addSaveBtn();
initTopBtns();
initGlobalTap();
loadTitleBg();