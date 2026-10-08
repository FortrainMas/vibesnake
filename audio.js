'use strict';
// WebAudio synth: a step sequencer driven by the snake's own steps (so the music speeds up /
// slows down with the game) — saturated drums, sidechain-pumped acid bass/pads — plus SFX.
const AudioFX = (() => {
  let ctx = null, sfx, mus, duck, drums, send, lp, hp, master, delay, noiseBuf;
  let trackGain, analyser, freqData, track = null, slowOn = false, warpOn = false;
  const SLOW_RATE = 0.72;
  let muted = false;
  try { muted = localStorage.getItem('vs_mute') === '1'; } catch (e) { /* storage unavailable */ }

  const VOL = 0.5;
  const LEAD = 0.05; // every sound is scheduled this far ahead so rAF jitter doesn't reach the speakers
  // Am - F - C - G, as semitone offsets from A2 (110 Hz)
  const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
  const PENTA = [0, 3, 5, 7, 10];
  const BASS = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 3, 0, 12, 10];
  const ACCENT = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  const freq = semi => 110 * Math.pow(2, semi / 12);
  let lastStepT = 0;

  function softClip(k) {
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000;
    lp.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.55;
    master.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    trackGain = ctx.createGain();
    trackGain.gain.value = 0.95;
    trackGain.connect(lp);

    // drums + music share a saturator; music is ducked by every kick (sidechain pump)
    const drive = ctx.createWaveShaper();
    drive.curve = softClip(2.4);
    drive.oversample = '2x';
    drive.connect(lp);
    // build-up filter: sweeps up before a drop, snaps back on the drop
    hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 20;
    hp.connect(drive);
    drums = ctx.createGain();
    drums.gain.value = 0.85;
    drums.connect(hp);
    duck = ctx.createGain();
    duck.connect(hp);
    mus = ctx.createGain();
    mus.gain.value = 0.9;
    mus.connect(duck);
    sfx = ctx.createGain();
    sfx.connect(lp);

    // dub-ish feedback delay on a send bus, synced to the step length in step()
    send = ctx.createGain();
    delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.3;
    const fb = ctx.createGain();
    fb.gain.value = 0.4;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3000;
    send.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(duck);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // Never queue notes while the context is suspended: they would all fire at once on resume.
  const ready = () => ctx && !muted && ctx.state === 'running';
  const now = () => ctx.currentTime + LEAD;

  function tone({ f, t = now(), type = 'sine', dur = 0.2, vol = 0.2, a = 0.005, hold = 0, to = null, cutoff = null, sweep = null, q = 1, fx = 0, detune = 0, out = sfx }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    osc.detune.value = detune;
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    if (hold) g.gain.setValueAtTime(vol, t + Math.max(a, dur * hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (cutoff || sweep) {
      const bf = ctx.createBiquadFilter();
      bf.type = 'lowpass';
      bf.Q.value = q;
      if (sweep) {
        bf.frequency.setValueAtTime(sweep[0], t);
        bf.frequency.exponentialRampToValueAtTime(sweep[1], t + dur * 0.9);
      } else {
        bf.frequency.value = cutoff;
      }
      osc.connect(bf);
      node = bf;
    }
    node.connect(g);
    g.connect(out);
    if (fx) {
      const s = ctx.createGain();
      s.gain.value = fx;
      g.connect(s);
      s.connect(send);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise({ t = now(), dur = 0.05, vol = 0.1, type = 'highpass', f = 7000, q = 1, out = sfx }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(out);
    src.start(t, Math.random() * Math.max(0, 0.95 - dur));
    src.stop(t + dur + 0.02);
  }

  function kick(t, stepSec = 0.12, vk = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.1 * vk, t + 0.002);
    g.gain.setValueAtTime(1.1 * vk, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g);
    g.connect(drums);
    o.start(t);
    o.stop(t + 0.42);
    noise({ t, dur: 0.012, vol: 0.35 * vk, f: 2500, out: drums });
    // sidechain pump: everything melodic ducks under the kick and swells back
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.2, t);
    duck.gain.linearRampToValueAtTime(1, t + Math.min(0.32, stepSec * 3));
  }

  function clap(t, v = 1) {
    for (let i = 0; i < 3; i++) noise({ t: t + i * 0.011, dur: 0.02, vol: 0.22 * v, type: 'bandpass', f: 1400, q: 0.9, out: drums });
    noise({ t: t + 0.033, dur: 0.17, vol: 0.26 * v, type: 'bandpass', f: 1250, q: 0.7, out: drums });
    tone({ t, f: 220, to: 150, type: 'triangle', dur: 0.09, vol: 0.2 * v, out: drums });
  }

  const hat = (t, dur, vol) => noise({ t, dur, vol, f: 8500, out: drums });

  function riser(t, dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 2;
    filt.frequency.setValueAtTime(300, t);
    filt.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    src.connect(filt);
    filt.connect(g);
    g.connect(drums);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  function impact(t) {
    tone({ t, f: 70, to: 28, dur: 1.2, vol: 0.6, a: 0.003, out: drums });
    noise({ t, dur: 1.8, vol: 0.2, f: 4500, out: drums });
    noise({ t, dur: 0.5, vol: 0.3, type: 'lowpass', f: 900, out: drums });
  }

  // n: global step counter, stepSec: current step length, lvl: 1..6 arrangement density,
  // late: how far (s) the game step already overshot its ideal time
  function step(n, stepSec, lvl, trip, idle, late = 0) {
    if (!ready() || trackActive()) return;
    // Lock onto the step grid when the new step lands close to where the previous one predicts.
    let t = ctx.currentTime + LEAD - late;
    const pred = lastStepT + stepSec;
    if (Math.abs(pred - t) < 0.03) t = pred;
    t = Math.max(t, ctx.currentTime + 0.005);
    lastStepT = t;
    delay.delayTime.setTargetAtTime(Math.min(0.9, stepSec * 3), ctx.currentTime, 0.2);

    const s = n % 16, ph = n % 128;
    const build = lvl >= 2 && ph >= 96;
    const drop = lvl >= 2 && ph < 32 && n >= 128;
    const chord = CHORDS[Math.floor(n / 16) % 4];
    const root = chord[0];

    if (idle) {
      // chill title loop: soft bass, arp and pad, no drums
      hp.frequency.setTargetAtTime(20, t, 0.05);
      if (s % 2 === 0) tone({ t, f: freq(root + (s % 4 === 2 ? 12 : 0)), type: 'sawtooth', dur: stepSec * 1.7, vol: 0.07, cutoff: 600, q: 6, out: mus });
      if (s % 2 === 0) tone({ t, f: freq(chord[s % 3] + 24 + 12 * (Math.floor(s / 3) % 2)), type: 'triangle', dur: stepSec * 1.4, vol: 0.035, fx: 0.55, out: mus });
      if (s === 0) for (const semi of chord) tone({ t, f: freq(semi + 12), type: 'sawtooth', dur: Math.max(1.2, stepSec * 16), a: 0.25, hold: 0.65, vol: 0.012, cutoff: 900, fx: 0.4, out: mus });
      return;
    }

    // --- build-up / drop ---
    if (build) hp.frequency.setTargetAtTime(20 + Math.pow((ph - 96) / 32, 2) * 1400, t, 0.05);
    else if (ph === 0) hp.frequency.setValueAtTime(20, t);
    if (lvl >= 2 && ph === 96) riser(t, stepSec * 32);
    if (ph === 0 && n >= 128 && lvl >= 2) impact(t);

    // --- drums ---
    const kickOn = !(build && ph >= 120);
    if (kickOn && s % 4 === 0) kick(t, stepSec);
    if (kickOn && (lvl >= 4 || drop) && s === 14) kick(t, stepSec, 0.75);
    if (kickOn && (lvl >= 6 || drop) && s === 10) kick(t, stepSec, 0.6);
    if (build && ph >= 112) {
      if (ph >= 120 || s % 2 === 0) clap(t, 0.3 + ((ph - 112) / 16) * 0.8); // snare roll into the drop
    } else if (s % 8 === 4) {
      clap(t, lvl >= 3 ? 1 : 0.75);
    }
    if (lvl >= 2) {
      if (s % 4 === 2) hat(t, 0.16, 0.09); // open hat on the offbeat
      else hat(t, 0.03, s % 2 ? 0.07 : 0.04);
    } else if (s % 2 === 1) {
      hat(t, 0.03, 0.05);
    }
    if (drop && s % 8 === 0) {
      for (const semi of chord) for (const det of [-14, 0, 14]) {
        tone({ t, f: freq(semi + 24), type: 'sawtooth', dur: stepSec * 3, vol: 0.03, cutoff: 3200, q: 2, fx: 0.5, detune: det, out: mus });
      }
    }

    // --- bass: offbeat sub + resonant acid line ---
    if (s % 4 === 2) tone({ t, f: freq(root - 12), dur: stepSec * 1.8, vol: 0.32, a: 0.004, out: mus });
    if (lvl >= 2 || s % 2 === 0) {
      const acc = ACCENT[s];
      tone({
        t, f: freq(root + BASS[s]), type: s % 8 < 4 ? 'sawtooth' : 'square',
        dur: stepSec * (acc ? 1.15 : 0.85), vol: acc ? 0.17 : 0.11, a: 0.003,
        sweep: [500 + acc * 1900 + (trip ? 1500 : 0) + lvl * 150, 170], q: 14, out: mus,
      });
    }

    // --- arp + pad ---
    if (lvl >= 3 && (lvl >= 5 || trip || s % 2 === 0)) {
      const note = chord[s % 3] + 12 * (1 + (Math.floor(s / 3) % 2)) + (trip ? 12 : 0);
      tone({
        t, f: freq(note + 12), type: trip ? 'square' : 'triangle', dur: Math.max(0.1, stepSec * 1.4),
        vol: trip ? 0.04 : 0.055, fx: 0.55, out: mus,
      });
    }
    if (s === 0) {
      const dur = Math.max(1.2, stepSec * 16);
      for (const semi of chord) {
        for (const det of [-9, 9]) {
          tone({ t, f: freq(semi + 12), type: 'sawtooth', dur, a: 0.25, hold: 0.65, vol: 0.016, cutoff: 1100, fx: 0.4, detune: det, out: mus });
        }
      }
    }
  }

  function eat(combo, special) {
    if (!ready()) return;
    const t = now();
    const deg = Math.min(combo - 1, 11);
    const f = freq(PENTA[deg % 5] + 12 * Math.floor(deg / 5) + 24);
    tone({ t, f, type: 'triangle', dur: 0.3, vol: 0.22, fx: 0.6 });
    tone({ t: t + 0.04, f: f * 2, dur: 0.22, vol: 0.1, fx: 0.6 });
    if (special) {
      tone({ t, f: 220, to: 1760, type: 'sawtooth', dur: 0.5, vol: 0.1, cutoff: 3000, q: 4, fx: 0.7 });
      for (let i = 0; i < 5; i++) tone({ t: t + 0.06 * i, f: freq(PENTA[i] + 36), dur: 0.2, vol: 0.07, fx: 0.8 });
    }
  }

  function shoot() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 1500 + Math.random() * 300, to: 260, type: 'square', dur: 0.09, vol: 0.06, cutoff: 4000, q: 2 });
    noise({ t, dur: 0.03, vol: 0.04, f: 5000 });
  }

  function triple() {
    if (!ready()) return;
    const t = now();
    for (let i = 0; i < 3; i++) tone({ t: t + i * 0.025, f: 1100 + i * 250, to: 200, type: 'square', dur: 0.1, vol: 0.05, cutoff: 3500, q: 2 });
    noise({ t, dur: 0.06, vol: 0.08, type: 'bandpass', f: 2500, q: 1 });
  }

  function blast() {
    if (!ready()) return;
    const t = now();
    kick(t);
    noise({ t, dur: 0.7, vol: 0.45, type: 'lowpass', f: 2200 });
    tone({ t, f: 80, to: 1200, type: 'sawtooth', dur: 0.35, vol: 0.14, cutoff: 3500, q: 6, fx: 0.7 });
    tone({ t: t + 0.05, f: 1200, to: 60, type: 'square', dur: 0.6, vol: 0.08, cutoff: 2500, q: 3, fx: 0.5 });
    for (let i = 0; i < 6; i++) tone({ t: t + 0.04 * i, f: freq(PENTA[i % 5] + 36 + 12 * Math.floor(i / 5)), dur: 0.2, vol: 0.06, fx: 0.8 });
  }

  function kill(big) {
    if (!ready()) return;
    const t = now();
    noise({ t, dur: big ? 0.45 : 0.25, vol: big ? 0.4 : 0.28, type: 'lowpass', f: 1100 });
    tone({ t, f: 320, to: 50, type: 'sawtooth', dur: big ? 0.4 : 0.22, vol: 0.14, cutoff: 1400, q: 3 });
    tone({ t: t + 0.03, f: freq(PENTA[Math.floor(Math.random() * 5)] + 36), dur: 0.15, vol: 0.06, fx: 0.7 });
  }

  function alarm(urgent) {
    if (!ready()) return;
    const t = now();
    tone({ t, f: urgent ? 1320 : 880, type: 'square', dur: 0.09, vol: 0.07, cutoff: 3500 });
    tone({ t: t + 0.1, f: urgent ? 990 : 660, type: 'square', dur: 0.09, vol: 0.06, cutoff: 3500 });
  }

  function annihilate() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 60, to: 25, dur: 1.2, vol: 0.5, a: 0.003 });
    noise({ t, dur: 1.2, vol: 0.45, type: 'lowpass', f: 3000 });
    tone({ t, f: 2400, to: 80, type: 'sawtooth', dur: 0.6, vol: 0.12, cutoff: 5000, q: 3, fx: 0.6 });
  }

  function ouroboros() {
    if (!ready()) return;
    const t = now();
    for (const [f, d] of [[110, 2.5], [164.8, 2.2], [277, 1.8], [415, 1.4]]) tone({ t, f, dur: d, vol: 0.09, a: 0.003, fx: 0.6 });
    for (let i = 0; i < 10; i++) tone({ t: t + 0.05 * i, f: freq(PENTA[i % 5] + 24 + 12 * Math.floor(i / 5)), type: 'triangle', dur: 0.3, vol: 0.07, fx: 0.8 });
    noise({ t, dur: 1.5, vol: 0.12, f: 6000 });
  }

  function tick() {
    if (!ready()) return;
    tone({ f: 2200, dur: 0.04, vol: 0.05 });
  }

  // How far behind the game clock the synth is actually heard (scheduling lead + device latency).
  const latency = () => (ctx ? LEAD + (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0);

  // Aim mode: near time-stop — the track crawls and everything goes underwater.
  function setWarp(on) {
    if (!ctx) return;
    warpOn = on;
    setTrackRate(on ? 0.15 : slowOn ? SLOW_RATE : 1);
    lp.frequency.setTargetAtTime(on ? 500 : slowOn ? 700 : 16000, ctx.currentTime, 0.08);
    if (ready()) tone({ f: on ? 900 : 120, to: on ? 90 : 1200, type: 'sawtooth', dur: 0.35, vol: 0.08, cutoff: 2000, q: 4, out: sfx });
  }

  function bossShot() {
    if (!ready()) return;
    tone({ f: 300, to: 950, type: 'sawtooth', dur: 0.12, vol: 0.08, cutoff: 2500, q: 3 });
  }

  function miss() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 140, type: 'sawtooth', dur: 0.55, vol: 0.16, cutoff: 700, q: 2 });
    tone({ t, f: 148, type: 'sawtooth', dur: 0.55, vol: 0.16, cutoff: 700, q: 2 });
  }

  function dropBoom() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 65, to: 26, dur: 1.1, vol: 0.45, a: 0.003 });
    noise({ t, dur: 0.4, vol: 0.2, type: 'lowpass', f: 700 });
  }

  function chomp() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 160, to: 60, type: 'square', dur: 0.12, vol: 0.18, cutoff: 900, q: 4 });
    tone({ t: t + 0.08, f: 220, to: 90, type: 'square', dur: 0.1, vol: 0.14, cutoff: 900, q: 4 });
    noise({ t, dur: 0.08, vol: 0.15, type: 'bandpass', f: 1500, q: 2 });
  }

  function magnet() {
    if (!ready()) return;
    tone({ f: 500, to: 1400, type: 'triangle', dur: 0.12, vol: 0.08, fx: 0.4 });
  }

  function chop() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 240, to: 70, type: 'sawtooth', dur: 0.3, vol: 0.2, cutoff: 1000, q: 5 });
    noise({ t, dur: 0.2, vol: 0.25, type: 'bandpass', f: 900, q: 1.5 });
  }

  function warn() {
    if (!ready()) return;
    tone({ f: 990, type: 'square', dur: 0.07, vol: 0.05, cutoff: 3000 });
  }

  function crash() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 520, to: 55, type: 'sawtooth', dur: 0.7, vol: 0.25, cutoff: 1500, q: 6, fx: 0.5 });
    noise({ t, dur: 0.6, vol: 0.35, type: 'lowpass', f: 1300 });
    kick(t);
  }

  function respawn() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 110, to: 880, type: 'sawtooth', dur: 0.5, vol: 0.08, cutoff: 2500, q: 4, fx: 0.6 });
    for (let i = 0; i < 5; i++) tone({ t: t + 0.05 * i, f: freq(PENTA[i] + 24), type: 'triangle', dur: 0.25, vol: 0.08, fx: 0.7 });
  }

  function die() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: 600, to: 30, type: 'sawtooth', dur: 1.4, vol: 0.28, cutoff: 1500, q: 6, fx: 0.5 });
    noise({ t, dur: 0.9, vol: 0.35, type: 'lowpass', f: 1200 });
    kick(t);
  }

  function levelUp() {
    if (!ready()) return;
    const t = now();
    for (let i = 0; i < 6; i++) {
      tone({ t: t + i * 0.07, f: freq(PENTA[i % 5] + 24 + 12 * Math.floor(i / 5)), type: 'square', dur: 0.25, vol: 0.06, fx: 0.7 });
    }
  }

  function chime() {
    if (!ready()) return;
    const t = now();
    tone({ t, f: freq(31), dur: 0.4, vol: 0.08, fx: 0.8 });
    tone({ t: t + 0.08, f: freq(38), dur: 0.4, vol: 0.06, fx: 0.8 });
  }

  function setSlow(on) {
    if (!ctx) return;
    slowOn = on;
    if (warpOn) return;
    setTrackRate(on ? SLOW_RATE : 1);
    lp.frequency.setTargetAtTime(on ? 700 : 16000, ctx.currentTime, on ? 0.15 : 0.3);
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('vs_mute', muted ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, 0.05);
    return muted;
  }

  // ---------- user tracks ----------
  function decode(arrayBuffer) {
    init();
    return ctx.decodeAudioData(arrayBuffer);
  }

  function trackPos(at) {
    return track.anchorPos + Math.max(0, at - track.anchorCtx) * track.rate;
  }

  function playTrack(buffer, bpm, offset, onEnded, startPos = 0) {
    stopTrack();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rate = slowOn ? SLOW_RATE : 1;
    src.playbackRate.value = rate;
    src.connect(trackGain);
    const t0 = ctx.currentTime + 0.05;
    src.start(t0, startPos);
    const me = { src, buffer, bpm, offset, rate, anchorCtx: t0, anchorPos: startPos, onEnded, paused: null };
    src.onended = () => {
      if (track === me) {
        track = null;
        if (onEnded) onEnded();
      }
    };
    track = me;
  }

  function stopTrack() {
    if (!track) return;
    const t = track;
    track = null;
    t.src.onended = null;
    try { t.src.stop(); } catch (e) { /* already stopped */ }
  }

  function pauseTrack() {
    if (!track || track.paused != null) return;
    const pos = trackPos(ctx.currentTime);
    track.src.onended = null;
    try { track.src.stop(); } catch (e) { /* already stopped */ }
    track.paused = pos;
  }

  function resumeTrack() {
    if (!track || track.paused == null) return;
    const t = track;
    track = null;
    playTrack(t.buffer, t.bpm, t.offset, t.onEnded, Math.min(t.paused, t.buffer.duration - 0.01));
  }

  function setTrackRate(rate) {
    if (!track || track.paused != null) return;
    track.anchorPos = trackPos(ctx.currentTime);
    track.anchorCtx = Math.max(ctx.currentTime, track.anchorCtx);
    track.rate = rate;
    track.src.playbackRate.setValueAtTime(rate, ctx.currentTime);
  }

  const trackActive = () => !!(track && track.paused == null);

  // Beat position of what is coming out of the speakers right now.
  function trackClock() {
    if (!trackActive() || ctx.state !== 'running') return null;
    let at = ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0);
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime > 0 && ts.performanceTime > 0) at = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    const spb = 60 / track.bpm;
    return { beat: (trackPos(at) - track.offset) / spb, bpm: track.bpm, spb: spb / track.rate };
  }

  function levels() {
    if (!analyser || muted || ctx.state !== 'running') return null;
    analyser.getByteFrequencyData(freqData);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const band = (lo, hi) => {
      let s = 0, n = 0;
      for (let i = Math.max(1, Math.floor(lo / binHz)); i <= Math.min(freqData.length - 1, Math.ceil(hi / binHz)); i++) { s += freqData[i]; n++; }
      return n ? s / n / 255 : 0;
    };
    return { bass: band(30, 150), mid: band(300, 2000), high: band(4000, 12000) };
  }

  return {
    decode, playTrack, stopTrack, pauseTrack, resumeTrack, trackActive, trackClock, levels,
    alarm, annihilate, ouroboros, tick, latency, setWarp, bossShot, miss,
    init, step, eat, shoot, triple, blast, dropBoom, chomp, kill, magnet, chop, warn, crash, respawn, die, levelUp, chime, setSlow, toggleMute,
    isMuted: () => muted,
  };
})();
