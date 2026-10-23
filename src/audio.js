// ============================================================
//  Audio: all sounds synthesized, no files
// ============================================================
export const Audio = (() => {
  let ctx = null, master = null;
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function tone({ f0 = 440, f1 = f0, dur = 0.1, type = 'square', vol = 0.2, delay = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise({ dur = 0.08, vol = 0.2, hp = 800, delay = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  // a school bell: Westminster quarters, synthesized as a struck bell (fundamental + two decaying partials)
  function bellNote(f, t, dur = 1.6, vol = 0.22) {
    if (!ctx) return;
    [[1, 1], [2.0, 0.35], [3.01, 0.18], [4.2, 0.08]].forEach(([mul, amp]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (mul > 1 ? mul * 0.7 : 1));
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
    });
  }
  const B3 = 246.94, E4 = 329.63, Fs4 = 369.99, Gs4 = 415.30;
  const PHRASES = [[Gs4, Fs4, E4, B3], [E4, Gs4, Fs4, B3], [E4, Fs4, Gs4, E4], [Gs4, E4, Fs4, B3]];
  function bell(phraseIdx, delay = 0) {
    if (!ctx) return 0;
    let t = ctx.currentTime + delay;
    for (const i of phraseIdx) { PHRASES[i].forEach((f, n) => { bellNote(f, t + n * 0.5, n === 3 ? 2.2 : 1.6); }); t += 2.6; }
    return t - ctx.currentTime;
  }
  return {
    init, resume,
    bellOut() { return bell([0, 1]); },   // 下課鈴
    bellIn() { return bell([2, 3]); },    // 上課鈴
    pew() { tone({ f0: 1100, f1: 320, dur: 0.11, type: 'sawtooth', vol: 0.14 }); noise({ dur: 0.05, vol: 0.12, hp: 2000 }); },
    enemyPew() { tone({ f0: 900, f1: 280, dur: 0.1, type: 'sawtooth', vol: 0.07 }); },
    empty() { tone({ f0: 200, f1: 160, dur: 0.06, type: 'square', vol: 0.1 }); },
    reload(dur = 1.3) { tone({ f0: 300, f1: 200, dur: 0.05, type: 'square', vol: 0.12 }); tone({ f0: 500, f1: 700, dur: 0.06, type: 'square', vol: 0.12, delay: dur * 0.65 }); tone({ f0: 900, f1: 1200, dur: 0.05, type: 'square', vol: 0.1, delay: dur * 0.85 }); },
    thud() { tone({ f0: 160, f1: 70, dur: 0.07, type: 'sine', vol: 0.18 }); },
    puff() { noise({ dur: 0.3, vol: 0.22, hp: 500 }); tone({ f0: 220, f1: 120, dur: 0.12, type: 'sine', vol: 0.1 }); },
    hitEnemy() { noise({ dur: 0.06, vol: 0.2, hp: 600 }); tone({ f0: 520, f1: 760, dur: 0.12, type: 'triangle', vol: 0.16 }); },
    out() { tone({ f0: 700, f1: 1400, dur: 0.18, type: 'triangle', vol: 0.18 }); tone({ f0: 1200, f1: 180, dur: 0.6, type: 'sine', vol: 0.14, delay: 0.18 }); },
    hurt() { tone({ f0: 300, f1: 120, dur: 0.22, type: 'square', vol: 0.18 }); noise({ dur: 0.1, vol: 0.2, hp: 300 }); },
    wave() { [523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.14, type: 'triangle', vol: 0.16, delay: i * 0.12 })); },
    footsteps() { for (let i = 0; i < 6; i++) tone({ f0: 90, f1: 60, dur: 0.12, type: 'sine', vol: 0.25 + i * 0.05, delay: i * 0.45 }); },
    teacher() { tone({ f0: 140, f1: 90, dur: 0.5, type: 'sawtooth', vol: 0.2 }); tone({ f0: 220, f1: 150, dur: 0.4, type: 'sawtooth', vol: 0.14, delay: 0.3 }); },
    chalkThrow() { tone({ f0: 1800, f1: 900, dur: 0.08, type: 'triangle', vol: 0.08 }); },
    weakpoint() { noise({ dur: 0.1, vol: 0.25, hp: 1500 }); [880, 1100, 1320].forEach((f, i) => tone({ f0: f, dur: 0.12, type: 'square', vol: 0.12, delay: i * 0.07 })); },
    snore() { tone({ f0: 120, f1: 180, dur: 0.5, type: 'sawtooth', vol: 0.05 }); tone({ f0: 160, f1: 110, dur: 0.45, type: 'sawtooth', vol: 0.04, delay: 0.7 }); },
    growl() { tone({ f0: 110, f1: 70, dur: 0.6, type: 'sawtooth', vol: 0.22 }); noise({ dur: 0.3, vol: 0.12, hp: 200 }); },
    blast() { noise({ dur: 0.35, vol: 0.35, hp: 120 }); tone({ f0: 90, f1: 40, dur: 0.4, type: 'sine', vol: 0.3 }); },
    boing() { tone({ f0: 240, f1: 480, dur: 0.14, type: 'triangle', vol: 0.2 }); tone({ f0: 480, f1: 300, dur: 0.12, type: 'triangle', vol: 0.12, delay: 0.12 }); },
    bounce() { tone({ f0: 300, f1: 180, dur: 0.07, type: 'triangle', vol: 0.1 }); },
    scribble() { noise({ dur: 0.12, vol: 0.1, hp: 2500 }); noise({ dur: 0.1, vol: 0.08, hp: 2500, delay: 0.14 }); },
    tattle() { [880, 1100, 880, 1100].forEach((f, i) => tone({ f0: f, dur: 0.12, type: 'square', vol: 0.12, delay: i * 0.1 })); },
    item() { [660, 880, 1320, 1760].forEach((f, i) => tone({ f0: f, dur: 0.1, type: 'triangle', vol: 0.14, delay: i * 0.06 })); noise({ dur: 0.08, vol: 0.1, hp: 3000 }); },
    itemSpawn() { tone({ f0: 1320, f1: 1320, dur: 0.08, type: 'sine', vol: 0.1 }); tone({ f0: 1760, f1: 1760, dur: 0.12, type: 'sine', vol: 0.1, delay: 0.09 }); },
    whistle() { tone({ f0: 2300, f1: 2500, dur: 0.18, type: 'square', vol: 0.12 }); tone({ f0: 2500, f1: 2200, dur: 0.35, type: 'square', vol: 0.12, delay: 0.2 }); },
    chord() { [523, 659, 784, 1046].forEach(f => tone({ f0: f, dur: 0.6, type: 'triangle', vol: 0.1 })); },
    sing() { const f = [523, 587, 659, 698, 784][Math.floor(Math.random() * 5)]; tone({ f0: f, f1: f * 1.02, dur: 0.3, type: 'triangle', vol: 0.14 }); tone({ f0: f * 1.5, dur: 0.25, type: 'sine', vol: 0.06, delay: 0.05 }); },
    bubble() { for (let i = 0; i < 6; i++) tone({ f0: 300 + Math.random() * 500, f1: 900, dur: 0.08, type: 'sine', vol: 0.08, delay: i * 0.09 }); },
    pickup() { tone({ f0: 1400, f1: 1900, dur: 0.05, type: 'square', vol: 0.07 }); },
    milkSpawn() { tone({ f0: 1046, f1: 1046, dur: 0.12, type: 'sine', vol: 0.14 }); tone({ f0: 1568, f1: 1568, dur: 0.18, type: 'sine', vol: 0.12, delay: 0.1 }); },
    drink() { [420, 360, 300].forEach((f, i) => tone({ f0: f, f1: f * 0.8, dur: 0.1, type: 'sine', vol: 0.18, delay: i * 0.11 })); tone({ f0: 900, f1: 1300, dur: 0.15, type: 'triangle', vol: 0.12, delay: 0.4 }); },
    win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone({ f0: f, dur: 0.22, type: 'triangle', vol: 0.18, delay: i * 0.16 })); },
    lose() { [440, 370, 311, 220].forEach((f, i) => tone({ f0: f, f1: f * 0.9, dur: 0.35, type: 'square', vol: 0.14, delay: i * 0.28 })); },
  };
})();
