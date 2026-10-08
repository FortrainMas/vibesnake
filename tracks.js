'use strict';
// User tracks: persistent playlist (IndexedDB), offline BPM/phase detection, playback via AudioFX.
const Tracks = (() => {
  const DB = (() => {
    let dbp = null;
    const open = () => {
      if (!dbp) {
        dbp = new Promise((res, rej) => {
          const r = indexedDB.open('vibesnake', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      return dbp;
    };
    const req = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const q = fn(db.transaction('tracks', mode).objectStore('tracks'));
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    }));
    return {
      all: () => req('readonly', s => s.getAll()),
      put: rec => req('readwrite', s => s.put(rec)),
      del: id => req('readwrite', s => s.delete(id)),
    };
  })();

  let list = [];
  let cur = -1;
  let enabled = true;
  let token = 0;
  let onStatus = () => {};
  try { enabled = localStorage.getItem('vs_tracks_on') !== '0'; } catch (e) { /* storage unavailable */ }
  const saveEnabled = () => { try { localStorage.setItem('vs_tracks_on', enabled ? '1' : '0'); } catch (e) { /* ignore */ } };
  const AUDIO_EXT = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm|weba)$/i;

  // Onset envelope -> autocorrelation for a rough tempo -> fine comb search over BPM and phase.
  function analyze(buf) {
    const sr = buf.sampleRate;
    const start = buf.length > sr * 170 ? Math.floor(sr * 20) : 0; // skip long intros
    const end = Math.min(buf.length, start + sr * 150);
    const c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : c0;
    const hop = Math.round(sr / 100), fps = sr / hop;
    const frames = Math.floor((end - start) / hop);
    if (frames < fps * 4) return { bpm: 120, offset: 0, drops: [] };

    const a = Math.exp((-2 * Math.PI * 150) / sr);
    let lpS = 0;
    const envL = new Float32Array(frames), envF = new Float32Array(frames);
    for (let f = 0, j = start; f < frames; f++) {
      let sl = 0, sf = 0;
      for (let i = 0; i < hop; i++, j++) {
        const x = (c0[j] + c1[j]) * 0.5;
        lpS = (1 - a) * x + a * lpS;
        sl += lpS * lpS;
        sf += x * x;
      }
      envL[f] = Math.log1p(100 * Math.sqrt(sl / hop));
      envF[f] = Math.log1p(100 * Math.sqrt(sf / hop));
    }
    const raw = new Float32Array(frames);
    for (let f = 1; f < frames; f++) raw[f] = 1.5 * Math.max(0, envL[f] - envL[f - 1]) + Math.max(0, envF[f] - envF[f - 1]);
    const on = new Float32Array(frames);
    const R = 8;
    let win = 0;
    for (let f = 0; f < Math.min(frames, R); f++) win += raw[f];
    for (let f = 0; f < frames; f++) {
      if (f + R < frames) win += raw[f + R];
      if (f - R - 1 >= 0) win -= raw[f - R - 1];
      const n = Math.min(frames - 1, f + R) - Math.max(0, f - R) + 1;
      on[f] = Math.max(0, raw[f] - win / n);
    }

    const minLag = Math.floor((fps * 60) / 190), maxLag = Math.ceil((fps * 60) / 70);
    let bestLag = minLag, bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let f = 0; f + lag < frames; f++) s += on[f] * on[f + lag];
      const bpm = (60 * fps) / lag;
      const z = Math.log2(bpm / 125) / 0.7;
      s *= Math.exp(-0.5 * z * z);
      if (s > bestScore) { bestScore = s; bestLag = lag; }
    }

    const bpm0 = (60 * fps) / bestLag;
    let best = { bpm: bpm0, phase: 0, score: -1 };
    for (let bpm = bpm0 - 3; bpm <= bpm0 + 3; bpm += 0.05) {
      const P = (60 * fps) / bpm;
      for (let ph = 0; ph < P; ph += 1) {
        let s = 0;
        for (let x = ph; x < frames; x += P) s += on[Math.round(x)] || 0;
        if (s > best.score) best = { bpm, phase: ph, score: s };
      }
    }
    const spb = 60 / best.bpm;
    const offset = (((start / sr + best.phase / fps) % spb) + spb) % spb;
    return { bpm: Math.round(best.bpm * 100) / 100, offset, drops: findDrops(buf, spb, offset) };
  }

  // A drop = the beat where 4 beats of (full + bass) energy jump well above the 8 beats before it.
  function findDrops(buf, spb, offset) {
    const sr = buf.sampleRate;
    const c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : c0;
    const nBeats = Math.floor((buf.length / sr - offset) / spb);
    if (nBeats < 16) return [];
    const E = new Float32Array(nBeats), L = new Float32Array(nBeats);
    const STRIDE = 4, a = Math.exp((-2 * Math.PI * 120 * STRIDE) / sr);
    let lpS = 0;
    for (let b = 0; b < nBeats; b++) {
      const s0 = Math.floor((offset + b * spb) * sr), s1 = Math.min(buf.length, Math.floor((offset + (b + 1) * spb) * sr));
      let e = 0, l = 0, n = 0;
      for (let j = s0; j < s1; j += STRIDE) {
        const x = (c0[j] + c1[j]) * 0.5;
        lpS = (1 - a) * x + a * lpS;
        e += x * x;
        l += lpS * lpS;
        n++;
      }
      E[b] = Math.sqrt(e / Math.max(1, n));
      L[b] = Math.sqrt(l / Math.max(1, n));
    }
    const sorted = [...E].sort((x, y) => x - y), median = sorted[sorted.length >> 1];
    const mean = (arr, i, j) => { let s = 0; for (let k = i; k < j; k++) s += arr[k]; return s / (j - i); };
    const cands = [];
    for (let b = 8; b + 4 <= nBeats; b++) {
      const after = mean(E, b, b + 4) + 1.5 * mean(L, b, b + 4);
      const before = mean(E, b - 8, b) + 1.5 * mean(L, b - 8, b);
      const ratio = after / (before + 1e-6);
      if (ratio > 1.6 && mean(E, b, b + 4) > 0.75 * median) cands.push({ b, ratio });
    }
    cands.sort((x, y) => y.ratio - x.ratio);
    const drops = [];
    for (const c of cands) {
      if (drops.length >= 12) break;
      if (drops.every(d => Math.abs(d - c.b) >= 32)) drops.push(c.b);
    }
    return drops.sort((x, y) => x - y);
  }

  async function play(i) {
    if (!list.length) return;
    cur = ((i % list.length) + list.length) % list.length;
    const rec = list[cur];
    const my = ++token;
    onStatus(`ЗАГРУЖАЮ: ${rec.name}`, 200);
    try {
      AudioFX.init();
      const buf = await AudioFX.decode(await rec.blob.arrayBuffer());
      if (my !== token) return;
      if (!rec.bpm || !rec.drops) {
        onStatus('СЛУШАЮ БИТ…', 280);
        await new Promise(r => setTimeout(r, 30));
        Object.assign(rec, analyze(buf));
        DB.put(rec).catch(() => {});
      }
      if (my !== token || !enabled) return;
      AudioFX.playTrack(buf, rec.bpm, rec.offset, () => play(cur + 1));
      onStatus(`♪ ${rec.name} · ${Math.round(rec.bpm)} BPM · дропов: ${rec.drops.length}`, 120);
    } catch (e) {
      console.warn('track failed', rec.name, e);
      if (my === token) onStatus(`НЕ СМОГ ПРОИГРАТЬ: ${rec.name}`, 0);
    }
  }

  async function load() {
    try { list = await DB.all(); } catch (e) { list = []; }
    if (list.length && enabled) play(0);
  }

  async function addFiles(files) {
    const audio = [...files].filter(f => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
    if (!audio.length) {
      onStatus('ЭТО НЕ ПОХОЖЕ НА МУЗЫКУ', 0);
      return;
    }
    let first = -1;
    for (const f of audio) {
      const rec = { name: f.name.replace(/\.[^.]+$/, ''), blob: f };
      try { rec.id = await DB.put(rec); } catch (e) { rec.id = undefined; }
      list.push(rec);
      if (first < 0) first = list.length - 1;
    }
    enabled = true;
    saveEnabled();
    play(first);
  }

  function next() {
    if (!list.length) return onStatus('НЕТ ТРЕКОВ — НАЖМИ T', 0);
    enabled = true;
    saveEnabled();
    play(cur + 1);
  }

  function toggle() {
    if (!list.length) return onStatus('НЕТ ТРЕКОВ — НАЖМИ T ИЛИ КИНЬ ФАЙЛ', 0);
    enabled = !enabled;
    saveEnabled();
    if (enabled) {
      play(cur < 0 ? 0 : cur);
    } else {
      token++;
      AudioFX.stopTrack();
      onStatus('ВСТРОЕННЫЙ БИТ', 300);
    }
  }

  function removeCurrent() {
    if (cur < 0 || !list.length) return;
    const rec = list.splice(cur, 1)[0];
    if (rec.id != null) DB.del(rec.id).catch(() => {});
    token++;
    AudioFX.stopTrack();
    onStatus(`УБРАЛ: ${rec.name}`, 0);
    if (list.length && enabled) play(cur);
    else cur = -1;
  }

  const current = () => (cur >= 0 && list[cur] && AudioFX.trackActive() ? list[cur] : null);

  return { load, addFiles, next, toggle, removeCurrent, current, count: () => list.length, onStatus: fn => { onStatus = fn; } };
})();
