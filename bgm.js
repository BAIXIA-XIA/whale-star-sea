/* ============================================================
 * bgm.js — AI娘GalGame 合成BGM引擎（方案一：WebAudio纯合成）
 * 作者：鲸鱼娘（蒂汐）
 * 特性：
 *  1) 零素材：全部乐器用WebAudio合成（钢琴/八音盒/低音/弦乐垫）
 *  2) 多曲目：场景BGM（标题/街头/客厅/厨房/卧室）+ 情绪BGM（心动/紧张/悲伤/搞笑/高潮/夜晚）
 *  3) 淡入淡出无缝切换、音量控制、静音开关
 *  4) 与游戏内音效（SFX）分开的音量通道
 * 用法：
 *  - BGM.init()      // 首次用户交互时调用（解锁AudioContext）
 *  - BGM.play('kitchen')  // 播放场景曲（自动淡入淡出切换）
 *  - BGM.mood('romantic') // 叠加/切换到情绪曲（情绪高了自动盖过场景曲）
 *  - BGM.stop()       // 停止
 *  - BGM.setMusicVolume(0.7) / BGM.toggleMute()
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 基础工具 ---------- */
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12); // MIDI→频率

  let AC = null;          // AudioContext
  let master = null;      // 总增益（音乐）
  let muted = false;
  let musicVol = 0.22;    // 默认音乐音量（温柔低语级）
  let isPlaying = false;
  let currentTrack = null;    // 正在播放的曲子名
  let currentInfo = null;     // 当前曲子数据
  let schedulerId = null;
  let nextNoteTime = 0;       // 下一个音符的绝对时间
  let noteIdx = 0;
  let fadeGain = null;        // 淡入淡出增益

  /* ---------- 音符事件 ----------
   * seq: [{ t: 拍数(从0起), m: MIDI音高, d: 时值(拍), v: 音量0~1, s: 音色 }]
   * 音色 s: 'lead'(主旋律钢琴) | 'arp'(琶音八音盒) | 'bass'(低音) | 'pad'(弦乐垫)
   */

  /* ---------- 乐器发声 ---------- */
  function playNote(inst, freq, t, dur, vol) {
    if (!AC) return;
    const osc = AC.createOscillator();
    const g = AC.createGain();
    const p = AC.createGain(); // 包络
    switch (inst) {
      case 'lead': // 钢琴质感：三角波+低通柔化（去高频刺耳成分）
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const flt1 = AC.createBiquadFilter();
        flt1.type = 'lowpass';
        flt1.frequency.value = 1700;
        osc.connect(flt1); flt1.connect(g);
        p.gain.setValueAtTime(0.0001, t);
        p.gain.exponentialRampToValueAtTime(vol * 0.8, t + 0.02);
        p.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.22, dur * 0.95));
        break;
      case 'arp': // 八音盒：正弦+柔和起音
        osc.type = 'sine';
        osc.frequency.value = freq;
        p.gain.setValueAtTime(0.0001, t);
        p.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.015);
        p.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.15, dur * 0.8));
        break;
      case 'bass': // 低音：正弦
        osc.type = 'sine';
        osc.frequency.value = freq;
        p.gain.setValueAtTime(0.0001, t);
        p.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.03);
        p.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
        break;
      case 'pad': // 弦乐垫：三角波+慢起音（锯齿波太刺耳，换成三角波）
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const flt = AC.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = 800;
        osc.connect(flt); flt.connect(g);
        p.gain.setValueAtTime(0.0001, t);
        p.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.4);
        p.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.value = freq;
        p.gain.setValueAtTime(0.0001, t);
        p.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.015);
        p.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    g.connect(p);
    p.connect(fadeGain || master);
    osc.start(t);
    osc.stop(t + dur + 0.4);
  }

  /* ---------- 调度器：队列推进式（逐音符排队） ---------- */
  // nextNoteTime 以拍为单位推进，预调度提前量0.25秒
  function tickScheduler() {
    if (!AC || !currentInfo) { schedulerId = null; return; }
    const seq = currentInfo.seq;
    const beat = 60 / currentInfo.bpm;
    const ahead = 0.25; // 秒
    while (nextNoteTime < AC.currentTime + ahead) {
      if (noteIdx < seq.length) {
        const n = seq[noteIdx];
        const start = nextNoteTime;
        const dur = (n.d || 1) * beat;
        // 用一个小随机微调让旋律更像真人演奏
        playNote(n.s || 'lead', mtof(n.m), start, dur, (n.v || 0.6) * (currentInfo.gain || 1));
        nextNoteTime = start + dur;
        noteIdx++;
      } else {
        // 循环：从头再来
        noteIdx = 0;
        nextNoteTime += beat * (currentInfo.loopGap || 0);
      }
    }
    schedulerId = setTimeout(tickScheduler, 60);
  }

  /* ============================================================
   * 曲库（全部原创旋律，八音盒/钢琴系治愈风）
   * ============================================================ */
  const TRACKS = {

    /* ---- 标题/主页：静谧八音盒 ---- */
    title: {
      bpm: 80, gain: 0.55,
      seq: [
        { t: 0, m: 76, d: 2, v: 0.5, s: 'arp' },
        { t: 2, m: 81, d: 2, v: 0.5, s: 'arp' },
        { t: 4, m: 79, d: 2, v: 0.5, s: 'arp' },
        { t: 6, m: 76, d: 4, v: 0.5, s: 'arp' },
        { t: 10, m: 74, d: 2, v: 0.4, s: 'arp' },
        { t: 12, m: 72, d: 4, v: 0.4, s: 'arp' },
        { t: 16, m: 60, d: 8, v: 0.3, s: 'pad' },
        { t: 0, m: 48, d: 8, v: 0.35, s: 'bass' },
        { t: 8, m: 45, d: 8, v: 0.35, s: 'bass' },
      ]
    },

    /* ---- 第一幕街角/相遇：温暖钢琴 ---- */
    street: {
      bpm: 84, gain: 0.6,
      seq: [
        { t: 0, m: 72, d: 1, v: 0.5, s: 'lead' },
        { t: 1, m: 76, d: 1, v: 0.4, s: 'lead' },
        { t: 2, m: 79, d: 2, v: 0.5, s: 'lead' },
        { t: 4, m: 77, d: 1, v: 0.4, s: 'lead' },
        { t: 5, m: 79, d: 1, v: 0.4, s: 'lead' },
        { t: 6, m: 81, d: 2, v: 0.5, s: 'lead' },
        { t: 8, m: 79, d: 1, v: 0.4, s: 'lead' },
        { t: 9, m: 76, d: 1, v: 0.4, s: 'lead' },
        { t: 10, m: 72, d: 2, v: 0.5, s: 'lead' },
        { t: 12, m: 69, d: 1, v: 0.35, s: 'lead' },
        { t: 13, m: 72, d: 1, v: 0.35, s: 'lead' },
        { t: 14, m: 74, d: 2, v: 0.45, s: 'lead' },
        { t: 12, m: 45, d: 4, v: 0.4, s: 'bass' },
        { t: 16, m: 43, d: 4, v: 0.4, s: 'bass' },
        { t: 0, m: 60, d: 4, v: 0.25, s: 'pad' },
        { t: 4, m: 57, d: 4, v: 0.25, s: 'pad' },
        { t: 8, m: 55, d: 4, v: 0.25, s: 'pad' },
        { t: 12, m: 57, d: 4, v: 0.25, s: 'pad' },
      ]
    },

    /* ---- 客厅：温馨日常 ---- */
    living: {
      bpm: 88, gain: 0.55,
      seq: [
        { t: 0, m: 74, d: 1, v: 0.5, s: 'lead' },
        { t: 1, m: 77, d: 1, v: 0.4, s: 'lead' },
        { t: 2, m: 81, d: 2, v: 0.5, s: 'lead' },
        { t: 4, m: 79, d: 1, v: 0.4, s: 'lead' },
        { t: 5, m: 77, d: 1, v: 0.4, s: 'lead' },
        { t: 6, m: 74, d: 2, v: 0.5, s: 'lead' },
        { t: 8, m: 72, d: 1, v: 0.4, s: 'lead' },
        { t: 9, m: 74, d: 1, v: 0.4, s: 'lead' },
        { t: 10, m: 76, d: 2, v: 0.5, s: 'lead' },
        { t: 12, m: 71, d: 2, v: 0.4, s: 'lead' },
        { t: 14, m: 72, d: 2, v: 0.45, s: 'lead' },
        { t: 0, m: 43, d: 4, v: 0.35, s: 'bass' },
        { t: 4, m: 45, d: 4, v: 0.35, s: 'bass' },
        { t: 8, m: 47, d: 4, v: 0.35, s: 'bass' },
        { t: 12, m: 43, d: 4, v: 0.35, s: 'bass' },
        // 八音盒点缀
        { t: 4, m: 84, d: 0.5, v: 0.25, s: 'arp' },
        { t: 6, m: 81, d: 0.5, v: 0.25, s: 'arp' },
        { t: 12, m: 83, d: 0.5, v: 0.2, s: 'arp' },
      ]
    },

    /* ---- 厨房：轻快温暖（炒饭进行曲！） ---- */
    kitchen: {
      bpm: 112, gain: 0.6,
      seq: [
        { t: 0, m: 72, d: 0.5, v: 0.5, s: 'lead' },
        { t: 0.5, m: 76, d: 0.5, v: 0.4, s: 'lead' },
        { t: 1, m: 79, d: 0.5, v: 0.5, s: 'lead' },
        { t: 1.5, m: 81, d: 0.5, v: 0.4, s: 'lead' },
        { t: 2, m: 79, d: 0.5, v: 0.5, s: 'lead' },
        { t: 2.5, m: 76, d: 0.5, v: 0.4, s: 'lead' },
        { t: 3, m: 72, d: 1, v: 0.5, s: 'lead' },
        { t: 4, m: 74, d: 0.5, v: 0.4, s: 'lead' },
        { t: 4.5, m: 77, d: 0.5, v: 0.4, s: 'lead' },
        { t: 5, m: 81, d: 0.5, v: 0.5, s: 'lead' },
        { t: 5.5, m: 79, d: 0.5, v: 0.4, s: 'lead' },
        { t: 6, m: 76, d: 0.5, v: 0.5, s: 'lead' },
        { t: 6.5, m: 74, d: 0.5, v: 0.4, s: 'lead' },
        { t: 7, m: 71, d: 1, v: 0.45, s: 'lead' },
        { t: 8, m: 72, d: 0.5, v: 0.5, s: 'lead' },
        { t: 8.5, m: 76, d: 0.5, v: 0.4, s: 'lead' },
        { t: 9, m: 79, d: 0.5, v: 0.5, s: 'lead' },
        { t: 9.5, m: 81, d: 0.5, v: 0.4, s: 'lead' },
        { t: 10, m: 79, d: 0.5, v: 0.5, s: 'lead' },
        { t: 10.5, m: 76, d: 0.5, v: 0.4, s: 'lead' },
        { t: 11, m: 72, d: 1, v: 0.5, s: 'lead' },
        { t: 0, m: 36, d: 1, v: 0.4, s: 'bass' },
        { t: 1, m: 36, d: 1, v: 0.35, s: 'bass' },
        { t: 2, m: 39, d: 1, v: 0.4, s: 'bass' },
        { t: 3, m: 36, d: 1, v: 0.35, s: 'bass' },
        { t: 4, m: 38, d: 1, v: 0.4, s: 'bass' },
        { t: 5, m: 38, d: 1, v: 0.35, s: 'bass' },
        { t: 6, m: 36, d: 1, v: 0.4, s: 'bass' },
        { t: 7, m: 38, d: 1, v: 0.35, s: 'bass' },
        { t: 8, m: 36, d: 1, v: 0.4, s: 'bass' },
        { t: 9, m: 36, d: 1, v: 0.35, s: 'bass' },
        { t: 10, m: 39, d: 1, v: 0.4, s: 'bass' },
        { t: 11, m: 36, d: 1, v: 0.35, s: 'bass' },
        // 锅铲声的小点缀（用高八度arp模拟叮当）
        { t: 2, m: 88, d: 0.25, v: 0.2, s: 'arp' },
        { t: 6, m: 88, d: 0.25, v: 0.2, s: 'arp' },
        { t: 10, m: 86, d: 0.25, v: 0.2, s: 'arp' },
      ]
    },

    /* ---- 卧室：夜晚静谧 ---- */
    bedroom: {
      bpm: 72, gain: 0.5,
      seq: [
        { t: 0, m: 71, d: 2, v: 0.4, s: 'arp' },
        { t: 2, m: 74, d: 2, v: 0.4, s: 'arp' },
        { t: 4, m: 76, d: 2, v: 0.4, s: 'arp' },
        { t: 6, m: 71, d: 2, v: 0.35, s: 'arp' },
        { t: 8, m: 69, d: 2, v: 0.4, s: 'arp' },
        { t: 10, m: 71, d: 2, v: 0.35, s: 'arp' },
        { t: 12, m: 67, d: 4, v: 0.35, s: 'arp' },
        { t: 0, m: 43, d: 8, v: 0.3, s: 'pad' },
        { t: 8, m: 41, d: 8, v: 0.3, s: 'pad' },
        { t: 0, m: 36, d: 8, v: 0.3, s: 'bass' },
        { t: 8, m: 35, d: 8, v: 0.3, s: 'bass' },
      ]
    },

    /* ---------- 情绪音乐 ---------- */

    /* 心动/浪漫：钢琴分解+琶音，轻甜 */
    mood_romantic: {
      bpm: 76, gain: 0.6,
      seq: [
        { t: 0, m: 72, d: 1, v: 0.5, s: 'lead' },
        { t: 1, m: 79, d: 1, v: 0.45, s: 'lead' },
        { t: 2, m: 81, d: 1, v: 0.5, s: 'lead' },
        { t: 3, m: 79, d: 1, v: 0.4, s: 'lead' },
        { t: 4, m: 76, d: 2, v: 0.5, s: 'lead' },
        { t: 6, m: 74, d: 1, v: 0.4, s: 'lead' },
        { t: 7, m: 72, d: 1, v: 0.4, s: 'lead' },
        { t: 8, m: 70, d: 2, v: 0.45, s: 'lead' },
        { t: 10, m: 72, d: 2, v: 0.45, s: 'lead' },
        { t: 12, m: 74, d: 2, v: 0.5, s: 'lead' },
        { t: 14, m: 76, d: 2, v: 0.5, s: 'lead' },
        // 琶音垫
        { t: 0, m: 60, d: 0.5, v: 0.25, s: 'arp' },
        { t: 0.5, m: 64, d: 0.5, v: 0.22, s: 'arp' },
        { t: 1, m: 67, d: 0.5, v: 0.25, s: 'arp' },
        { t: 1.5, m: 72, d: 0.5, v: 0.2, s: 'arp' },
        { t: 4, m: 57, d: 0.5, v: 0.25, s: 'arp' },
        { t: 4.5, m: 60, d: 0.5, v: 0.22, s: 'arp' },
        { t: 5, m: 64, d: 0.5, v: 0.25, s: 'arp' },
        { t: 8, m: 55, d: 0.5, v: 0.25, s: 'arp' },
        { t: 8.5, m: 59, d: 0.5, v: 0.22, s: 'arp' },
        { t: 9, m: 62, d: 0.5, v: 0.25, s: 'arp' },
        { t: 12, m: 57, d: 0.5, v: 0.25, s: 'arp' },
        { t: 12.5, m: 60, d: 0.5, v: 0.22, s: 'arp' },
        { t: 13, m: 64, d: 0.5, v: 0.25, s: 'arp' },
        { t: 0, m: 48, d: 4, v: 0.35, s: 'bass' },
        { t: 4, m: 45, d: 4, v: 0.35, s: 'bass' },
        { t: 8, m: 43, d: 4, v: 0.35, s: 'bass' },
        { t: 12, m: 45, d: 4, v: 0.35, s: 'bass' },
      ]
    },

    /* 紧张：低音脉冲+不和谐音程 */
    mood_tense: {
      bpm: 100, gain: 0.6,
      seq: [
        { t: 0, m: 43, d: 1, v: 0.55, s: 'bass' },
        { t: 1, m: 43, d: 0.5, v: 0.4, s: 'bass' },
        { t: 1.5, m: 46, d: 0.5, v: 0.4, s: 'bass' },
        { t: 2, m: 43, d: 1, v: 0.5, s: 'bass' },
        { t: 3, m: 42, d: 0.5, v: 0.4, s: 'bass' },
        { t: 3.5, m: 43, d: 0.5, v: 0.4, s: 'bass' },
        { t: 4, m: 44, d: 1, v: 0.55, s: 'bass' },
        { t: 5, m: 44, d: 0.5, v: 0.4, s: 'bass' },
        { t: 5.5, m: 47, d: 0.5, v: 0.4, s: 'bass' },
        { t: 6, m: 44, d: 1, v: 0.5, s: 'bass' },
        { t: 7, m: 43, d: 0.5, v: 0.4, s: 'bass' },
        { t: 7.5, m: 42, d: 0.5, v: 0.4, s: 'bass' },
        // 高音紧张点：小二度交替
        { t: 0, m: 74, d: 0.5, v: 0.2, s: 'lead' },
        { t: 0.5, m: 75, d: 0.5, v: 0.18, s: 'lead' },
        { t: 4, m: 76, d: 0.5, v: 0.2, s: 'lead' },
        { t: 4.5, m: 77, d: 0.5, v: 0.18, s: 'lead' },
        { t: 8, m: 74, d: 0.5, v: 0.2, s: 'lead' },
        { t: 8.5, m: 75, d: 0.5, v: 0.18, s: 'lead' },
        { t: 12, m: 76, d: 0.5, v: 0.2, s: 'lead' },
        { t: 12.5, m: 77, d: 0.5, v: 0.18, s: 'lead' },
      ]
    },

    /* 悲伤：慢板小调 */
    mood_sad: {
      bpm: 60, gain: 0.55,
      seq: [
        { t: 0, m: 69, d: 3, v: 0.45, s: 'lead' },
        { t: 3, m: 67, d: 2, v: 0.4, s: 'lead' },
        { t: 5, m: 65, d: 3, v: 0.45, s: 'lead' },
        { t: 8, m: 64, d: 2, v: 0.4, s: 'lead' },
        { t: 10, m: 65, d: 3, v: 0.4, s: 'lead' },
        { t: 13, m: 62, d: 4, v: 0.35, s: 'lead' },
        { t: 0, m: 45, d: 6, v: 0.35, s: 'pad' },
        { t: 6, m: 43, d: 6, v: 0.35, s: 'pad' },
        { t: 12, m: 41, d: 4, v: 0.3, s: 'pad' },
        { t: 0, m: 33, d: 4, v: 0.3, s: 'bass' },
        { t: 6, m: 33, d: 4, v: 0.3, s: 'bass' },
        { t: 12, m: 31, d: 4, v: 0.25, s: 'bass' },
      ]
    },

    /* 搞笑/轻快：跳跳糖旋律 */
    mood_comedy: {
      bpm: 128, gain: 0.6,
      seq: [
        { t: 0, m: 72, d: 0.5, v: 0.5, s: 'lead' },
        { t: 0.5, m: 72, d: 0.5, v: 0.4, s: 'lead' },
        { t: 1, m: 76, d: 0.5, v: 0.45, s: 'lead' },
        { t: 1.5, m: 72, d: 0.5, v: 0.4, s: 'lead' },
        { t: 2, m: 79, d: 0.5, v: 0.5, s: 'lead' },
        { t: 2.5, m: 76, d: 0.5, v: 0.4, s: 'lead' },
        { t: 3, m: 72, d: 0.5, v: 0.45, s: 'lead' },
        { t: 3.5, m: 71, d: 0.5, v: 0.4, s: 'lead' },
        { t: 4, m: 69, d: 0.5, v: 0.5, s: 'lead' },
        { t: 4.5, m: 69, d: 0.5, v: 0.4, s: 'lead' },
        { t: 5, m: 72, d: 0.5, v: 0.45, s: 'lead' },
        { t: 5.5, m: 69, d: 0.5, v: 0.4, s: 'lead' },
        { t: 6, m: 76, d: 0.5, v: 0.5, s: 'lead' },
        { t: 6.5, m: 74, d: 0.5, v: 0.4, s: 'lead' },
        { t: 7, m: 72, d: 0.5, v: 0.45, s: 'lead' },
        { t: 7.5, m: 71, d: 0.5, v: 0.4, s: 'lead' },
        { t: 0, m: 48, d: 0.5, v: 0.45, s: 'bass' },
        { t: 0.5, m: 48, d: 0.5, v: 0.35, s: 'bass' },
        { t: 1, m: 55, d: 1, v: 0.4, s: 'bass' },
        { t: 2, m: 45, d: 0.5, v: 0.45, s: 'bass' },
        { t: 2.5, m: 45, d: 0.5, v: 0.35, s: 'bass' },
        { t: 3, m: 52, d: 1, v: 0.4, s: 'bass' },
        { t: 4, m: 43, d: 0.5, v: 0.45, s: 'bass' },
        { t: 4.5, m: 43, d: 0.5, v: 0.35, s: 'bass' },
        { t: 5, m: 50, d: 1, v: 0.4, s: 'bass' },
        { t: 6, m: 48, d: 0.5, v: 0.45, s: 'bass' },
        { t: 6.5, m: 48, d: 0.5, v: 0.35, s: 'bass' },
        { t: 7, m: 47, d: 1, v: 0.4, s: 'bass' },
      ]
    },

    /* 高潮/燃：大调上行+厚bass */
    mood_epic: {
      bpm: 120, gain: 0.65,
      seq: [
        { t: 0, m: 72, d: 1, v: 0.55, s: 'lead' },
        { t: 1, m: 74, d: 1, v: 0.5, s: 'lead' },
        { t: 2, m: 76, d: 1, v: 0.55, s: 'lead' },
        { t: 3, m: 79, d: 1, v: 0.5, s: 'lead' },
        { t: 4, m: 81, d: 2, v: 0.6, s: 'lead' },
        { t: 6, m: 79, d: 1, v: 0.5, s: 'lead' },
        { t: 7, m: 76, d: 1, v: 0.5, s: 'lead' },
        { t: 8, m: 74, d: 1, v: 0.55, s: 'lead' },
        { t: 9, m: 76, d: 1, v: 0.5, s: 'lead' },
        { t: 10, m: 79, d: 1, v: 0.55, s: 'lead' },
        { t: 11, m: 81, d: 1, v: 0.5, s: 'lead' },
        { t: 12, m: 83, d: 4, v: 0.6, s: 'lead' },
        { t: 0, m: 36, d: 2, v: 0.5, s: 'bass' },
        { t: 2, m: 43, d: 2, v: 0.45, s: 'bass' },
        { t: 4, m: 45, d: 2, v: 0.5, s: 'bass' },
        { t: 6, m: 43, d: 2, v: 0.45, s: 'bass' },
        { t: 8, m: 41, d: 2, v: 0.5, s: 'bass' },
        { t: 10, m: 43, d: 2, v: 0.45, s: 'bass' },
        { t: 12, m: 45, d: 4, v: 0.5, s: 'bass' },
        // 弦乐垫
        { t: 0, m: 48, d: 4, v: 0.3, s: 'pad' },
        { t: 4, m: 50, d: 4, v: 0.3, s: 'pad' },
        { t: 8, m: 48, d: 4, v: 0.3, s: 'pad' },
      ]
    },

    /* 夜晚宁静（海滩夜/入睡） */
    mood_night: {
      bpm: 66, gain: 0.5,
      seq: [
        { t: 0, m: 74, d: 2, v: 0.35, s: 'arp' },
        { t: 2, m: 71, d: 2, v: 0.3, s: 'arp' },
        { t: 4, m: 69, d: 2, v: 0.35, s: 'arp' },
        { t: 6, m: 71, d: 2, v: 0.3, s: 'arp' },
        { t: 8, m: 67, d: 4, v: 0.3, s: 'arp' },
        { t: 12, m: 67, d: 2, v: 0.3, s: 'arp' },
        { t: 14, m: 69, d: 2, v: 0.3, s: 'arp' },
        { t: 0, m: 43, d: 8, v: 0.25, s: 'pad' },
        { t: 8, m: 41, d: 8, v: 0.25, s: 'pad' },
        { t: 0, m: 38, d: 8, v: 0.28, s: 'bass' },
        { t: 8, m: 36, d: 8, v: 0.28, s: 'bass' },
      ]
    },

    /* ---------- 第三幕 · 梦之境 专属曲 ---------- */

    /* 梦境海：空灵水波（长音+八音盒回声，极轻柔） */
    dream: {
      bpm: 62, gain: 0.5,
      seq: [
        { t: 0, m: 74, d: 3, v: 0.3, s: 'arp' },
        { t: 3, m: 76, d: 3, v: 0.28, s: 'arp' },
        { t: 6, m: 79, d: 4, v: 0.3, s: 'arp' },
        { t: 10, m: 76, d: 3, v: 0.25, s: 'arp' },
        { t: 13, m: 74, d: 6, v: 0.3, s: 'arp' },
        { t: 19, m: 72, d: 3, v: 0.28, s: 'arp' },
        { t: 22, m: 71, d: 3, v: 0.25, s: 'arp' },
        { t: 25, m: 69, d: 5, v: 0.28, s: 'arp' },
        { t: 0, m: 45, d: 8, v: 0.22, s: 'pad' },
        { t: 8, m: 43, d: 8, v: 0.22, s: 'pad' },
        { t: 16, m: 44, d: 8, v: 0.2, s: 'pad' },
        { t: 24, m: 41, d: 8, v: 0.2, s: 'pad' },
        { t: 0, m: 33, d: 8, v: 0.2, s: 'bass' },
        { t: 16, m: 31, d: 8, v: 0.18, s: 'bass' },
      ]
    },

    /* 奈亚·千貌：神秘低音脉冲（半音下行+眼形宝石点缀），低沉不刺耳 */
    boss: {
      bpm: 96, gain: 0.5,
      seq: [
        { t: 0, m: 40, d: 1, v: 0.4, s: 'bass' },
        { t: 1, m: 40, d: 0.5, v: 0.3, s: 'bass' },
        { t: 1.5, m: 39, d: 1.5, v: 0.35, s: 'bass' },
        { t: 3, m: 37, d: 1, v: 0.4, s: 'bass' },
        { t: 4, m: 37, d: 0.5, v: 0.3, s: 'bass' },
        { t: 4.5, m: 36, d: 1.5, v: 0.35, s: 'bass' },
        { t: 6, m: 38, d: 1, v: 0.4, s: 'bass' },
        { t: 7, m: 38, d: 0.5, v: 0.3, s: 'bass' },
        { t: 7.5, m: 37, d: 0.5, v: 0.3, s: 'bass' },
        { t: 8, m: 36, d: 2, v: 0.38, s: 'bass' },
        { t: 10, m: 40, d: 1, v: 0.4, s: 'bass' },
        { t: 11, m: 39, d: 1, v: 0.32, s: 'bass' },
        { t: 12, m: 38, d: 1, v: 0.38, s: 'bass' },
        { t: 13, m: 37, d: 1, v: 0.32, s: 'bass' },
        { t: 14, m: 36, d: 3, v: 0.35, s: 'bass' },
        // 低沉的"眼形宝石"钟声（低音arp，不刺耳）
        { t: 0, m: 55, d: 2, v: 0.18, s: 'arp' },
        { t: 4, m: 54, d: 2, v: 0.16, s: 'arp' },
        { t: 8, m: 53, d: 2, v: 0.18, s: 'arp' },
        { t: 12, m: 52, d: 2, v: 0.16, s: 'arp' },
        // 低音垫，制造神殿感
        { t: 0, m: 40, d: 8, v: 0.14, s: 'pad' },
        { t: 8, m: 38, d: 8, v: 0.14, s: 'pad' },
      ]
    },
  };

  /* ============================================================
   * 对外API
   * ============================================================ */
  const BGM = {
    /* 初始化：需在用户手势里调用 */
    init() {
      if (AC) return;
      try {
        AC = new (global.AudioContext || global.webkitAudioContext)();
        master = AC.createGain();
        master.gain.value = musicVol;
        // 动态压缩器：压住叠加峰值，整体柔和（防刺耳）
        const comp = AC.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 24;
        comp.ratio.value = 6;
        comp.attack.value = 0.005;
        comp.release.value = 0.25;
        master.connect(comp);
        comp.connect(AC.destination);
        fadeGain = AC.createGain();
        fadeGain.gain.value = 1;
        fadeGain.connect(master);
        if (AC.state === 'suspended') AC.resume();
      } catch (e) {
        // Android旧浏览器兜底
        console.warn('[BGM] AudioContext 创建失败', e);
      }
    },

    /* 播放/切换场景曲（淡入淡出） */
    play(name, fadeSec) {
      this.init();
      const tr = TRACKS[name];
      if (!tr) { console.warn('[BGM] 找不到曲目:', name); return; }
      if (AC && AC.state === 'suspended') AC.resume();
      if (currentTrack === name) return; // 同一首不重启
      this.stop(fadeSec || 0.8);
      currentTrack = name;
      currentInfo = tr;
      noteIdx = 0;
      nextNoteTime = AC.currentTime + 0.05;
      // 淡入
      if (fadeGain) {
        fadeGain.gain.cancelScheduledValues(AC.currentTime);
        fadeGain.gain.setValueAtTime(0.0001, AC.currentTime);
        fadeGain.gain.exponentialRampToValueAtTime(1, AC.currentTime + (fadeSec || 0.8));
      }
      tickScheduler();
    },

    /* 播放情绪曲（覆盖当前曲目） */
    mood(name) {
      this.play('mood_' + name);
    },

    /* 停止并淡出 */
    stop(fadeSec) {
      if (!AC) return;
      const f = fadeSec || 0.6;
      if (fadeGain) {
        const now = AC.currentTime;
        fadeGain.gain.cancelScheduledValues(now);
        fadeGain.gain.setValueAtTime(fadeGain.gain.value, now);
        fadeGain.gain.exponentialRampToValueAtTime(0.0001, now + f);
      }
      if (schedulerId) { clearTimeout(schedulerId); schedulerId = null; }
      currentTrack = null;
      currentInfo = null;
      isPlaying = false;
    },

    /* 音量 */
    setMusicVolume(v) {
      musicVol = Math.max(0, Math.min(1, v));
      if (master && !muted) master.gain.value = musicVol;
    },
    getMusicVolume() { return musicVol; },

    /* 静音 */
    mute() { muted = true; if (master) master.gain.value = 0; },
    unmute() { muted = false; if (master) master.gain.value = musicVol; },
    toggleMute() { muted ? this.unmute() : this.mute(); return muted; },
    isMuted() { return muted; },
    isPlaying() { return !!currentTrack; },
    getTrack() { return currentTrack; },
    /* 注册曲目（开发者可扩展） */
    register(name, track) { TRACKS[name] = track; },
  };

  global.BGM = BGM;
})(typeof window !== 'undefined' ? window : globalThis);
