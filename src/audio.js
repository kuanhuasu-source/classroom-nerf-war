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
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); if (ctx && musicWant && !musicTimer) music(musicWant); }
  // ---- background music: three short loops synthesized on the fly (no files), scheduled a little ahead of the clock ----
  // each bar is 16 steps (sixteenth notes); numbers are MIDI notes, 0 is a rest
  const SONGS = {
    menu: { bpm: 84, wave: 'triangle', vol: 0.07, drums: 0,
      lead: [72, 0, 0, 76, 0, 0, 79, 0, 0, 0, 76, 0, 0, 0, 0, 0, 74, 0, 0, 77, 0, 0, 81, 0, 0, 0, 77, 0, 0, 0, 0, 0, 76, 0, 0, 79, 0, 0, 84, 0, 0, 0, 79, 0, 0, 0, 0, 0, 74, 0, 0, 79, 0, 0, 83, 0, 0, 0, 79, 0, 72, 0, 0, 0],
      bass: [48, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0, 53, 0, 0, 0, 0, 0, 0, 0, 52, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0] },
    battle: { bpm: 138, wave: 'square', vol: 0.045, drums: 1,
      lead: [76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0, 79, 0, 81, 0, 0, 0, 77, 0, 81, 0, 84, 0, 81, 0, 77, 0, 81, 0, 79, 0, 77, 0, 79, 0, 83, 0, 86, 0, 83, 0, 79, 0, 74, 0, 79, 0, 0, 0],
      bass: [36, 0, 48, 0, 36, 0, 48, 0, 36, 0, 48, 0, 43, 0, 48, 0, 33, 0, 45, 0, 33, 0, 45, 0, 33, 0, 45, 0, 40, 0, 45, 0, 29, 0, 41, 0, 29, 0, 41, 0, 29, 0, 41, 0, 36, 0, 41, 0, 31, 0, 43, 0, 31, 0, 43, 0, 31, 0, 43, 0, 38, 0, 43, 0] },
    boss: { bpm: 152, wave: 'sawtooth', vol: 0.035, drums: 2,
      lead: [69, 72, 76, 81, 76, 72, 69, 72, 76, 81, 76, 72, 69, 0, 69, 0, 65, 69, 72, 77, 72, 69, 65, 69, 72, 77, 72, 69, 65, 0, 65, 0, 67, 71, 74, 79, 74, 71, 67, 71, 74, 79, 74, 71, 67, 0, 67, 0, 64, 68, 71, 76, 71, 68, 64, 68, 71, 76, 80, 76, 71, 0, 76, 0],
      bass: [33, 0, 33, 45, 33, 0, 33, 45, 33, 0, 33, 45, 33, 0, 45, 0, 29, 0, 29, 41, 29, 0, 29, 41, 29, 0, 29, 41, 29, 0, 41, 0, 31, 0, 31, 43, 31, 0, 31, 43, 31, 0, 31, 43, 31, 0, 43, 0, 28, 0, 28, 40, 28, 0, 28, 40, 28, 0, 28, 40, 28, 0, 40, 0] },
  };
  let musicGain = null, musicTimer = null, musicName = null, musicWant = null, musicOn = true, mStep = 0, mNext = 0;
  try { musicOn = localStorage.getItem('cnw-music') !== '0'; } catch (e) { /* ignore */ }
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function mNote(f, t, dur, type, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.02); }
  function mNoise(t, dur, vol, hp) { const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); }
  function mSchedule() {
    const s = SONGS[musicName]; if (!s || !ctx) return; const spb = 60 / s.bpm / 4;
    if (mNext < ctx.currentTime) mNext = ctx.currentTime + 0.03; // the tab slept: do not flood the gap
    while (mNext < ctx.currentTime + 0.15) {
      const i = mStep % s.lead.length, l = s.lead[i], b = s.bass[i], beat = i % 16;
      if (l) mNote(hz(l), mNext, spb * (s.drums ? 1.7 : 5), s.wave, s.vol);
      if (b) mNote(hz(b), mNext, spb * (s.drums ? 1.8 : 14), 'triangle', s.vol * 1.9);
      if (s.drums) { if (beat % (s.drums === 2 ? 4 : 8) === 0) mNote(110, mNext, 0.09, 'sine', 0.16); if (beat % 8 === 4) mNoise(mNext, 0.06, 0.07, 1800); if (beat % 2 === 0 && beat % 4 !== 0) mNoise(mNext, 0.025, 0.03, 5000); }
      mNext += spb; mStep++;
    }
  }
  // which loop should play (null: silence). Remembered even before the first click lets the sound start.
  function music(name) {
    musicWant = name;
    if (musicTimer && (name !== musicName || !musicOn || !name)) { clearInterval(musicTimer); musicTimer = null; if (musicGain) { const g = musicGain; g.gain.setTargetAtTime(0, ctx.currentTime, 0.08); setTimeout(() => g.disconnect(), 500); musicGain = null; } }
    if (!ctx || !musicOn || !name || !SONGS[name] || musicTimer) return;
    musicName = name; musicGain = ctx.createGain(); musicGain.gain.value = 1; musicGain.connect(master); mStep = 0; mNext = ctx.currentTime + 0.06;
    mSchedule(); musicTimer = setInterval(mSchedule, 40);
  }
  function musicToggle(on = !musicOn) { musicOn = on; try { localStorage.setItem('cnw-music', on ? '1' : '0'); } catch (e) { /* ignore */ } music(musicWant); return musicOn; }
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
    init, resume, music, musicToggle, musicState: () => ({ on: musicOn, want: musicWant, playing: musicTimer ? musicName : null, step: mStep }),
    bellOut() { return bell([0, 1]); },   // 下課鈴
    bellIn() { return bell([2, 3]); },    // 上課鈴
    pew() { tone({ f0: 1100, f1: 320, dur: 0.11, type: 'sawtooth', vol: 0.14 }); noise({ dur: 0.05, vol: 0.12, hp: 2000 }); },
    combo(n) { const base = 520 * Math.pow(1.19, Math.min(n, 6)); [1, 1.26, 1.5].forEach((m, i) => tone({ f0: base * m, dur: 0.12, type: 'square', vol: 0.12, delay: i * 0.07 })); },
    lastOne() { tone({ f0: 880, f1: 220, dur: 0.5, type: 'sine', vol: 0.16 }); },
    slide() { noise({ dur: 0.35, vol: 0.16, hp: 900 }); tone({ f0: 260, f1: 120, dur: 0.3, type: 'sine', vol: 0.08 }); },
    shotgun() { noise({ dur: 0.16, vol: 0.3, hp: 500 }); tone({ f0: 320, f1: 90, dur: 0.14, type: 'sawtooth', vol: 0.16 }); },
    twang() { tone({ f0: 1700, f1: 240, dur: 0.22, type: 'triangle', vol: 0.2 }); tone({ f0: 300, f1: 520, dur: 0.1, type: 'sine', vol: 0.1, delay: 0.03 }); },
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
