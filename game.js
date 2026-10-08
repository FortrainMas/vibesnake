'use strict';
(() => {
  const COLS = 32, ROWS = 20;
  const TAU = Math.PI * 2;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const FONT_HEAVY = '"Segoe UI Black", "Arial Black", Impact, sans-serif';

  const LEVEL_NAMES = [
    'ТРЕЗВЫЙ РАЗУМ', 'ЛЁГКОЕ ПОКАЛЫВАНИЕ', 'ЦВЕТА ЗВУЧАТ', 'СТЕНЫ ДЫШАТ', 'ТРЕТИЙ ГЛАЗ ОТКРЫТ',
    'БЕСЕДА СО ЗМЕЕМ-ДУХОМ', 'ЭГО РАСТВОРЯЕТСЯ', 'ТЫ И ЕСТЬ ЗМЕЙКА', 'ВСЕЛЕННАЯ ЖУЁТ СВОЙ ХВОСТ', '∞ УРОБОРОС ∞',
  ];
  const TRIP = [
    { name: 'ЧИЛЛ', base: 0.12 },
    { name: 'ТРИП', base: 0.5 },
    { name: 'МАКСИМУМ', base: 0.9 },
  ];
  const SPEED_NAMES = ['ЛЕНИВЕЦ', 'ЧЕРЕПАХА', 'ПРОГУЛКА', 'КРУИЗ', 'ДРАЙВ', 'ТУРБО', 'ГИПЕР', 'ВАРП', 'СВЕТОВАЯ'];
  const LIVES_OPTS = [1, 3, 5, 9, Infinity];
  const SPECIALS = ['mushroom', 'crystal', 'ghost', 'star'];
  const ITEM_INFO = {
    orb: { pts: 10 },
    crumb: { pts: 5 },
    moth: { pts: 40, label: 'МОТЫЛЁК ПОЙМАН', h: 90 },
    mushroom: { pts: 25, label: 'ГРИБНОЙ ТРИП · ОЧКИ x2', h: 320 },
    crystal: { pts: 25, label: 'ЗАМЕДЛЕНИЕ ВРЕМЕНИ', h: 190 },
    ghost: { pts: 25, label: 'АСТРАЛЬНОЕ ТЕЛО', h: 220 },
    star: { pts: 100, label: 'ЗВЁЗДНАЯ ПЫЛЬ', h: 50 },
  };
  // Free-flying things, in cell units. bad = kills on head contact, bites off the tail on body contact.
  const FLIER = {
    eye: { bad: true, r: 0.42, speed: [2.5, 4.5], hp: 1, pts: 20, life: 14, cause: 'ПОЙМАЛ ВЗГЛЯД ПАРАНОЙИ' },
    spike: { bad: true, r: 0.4, speed: [3.2, 4.6], hp: 2, pts: 35, life: 12, homing: 1.3, cause: 'НАСАДИЛСЯ НА ШИП' },
    moth: { bad: false, r: 0.38, speed: [2, 3.2], hp: 1, pts: 40, life: 12 },
    glitch: { bad: true, r: 0.4, speed: [0, 0], hp: 1, pts: 30, life: 14, cause: 'ГЛИТЧ ТЕЛЕПОРТНУЛСЯ В ЛИЦО' },
    pulsar: { bad: true, r: 0.5, speed: [0.5, 1.1], hp: 3, pts: 50, life: 16, cause: 'НАКРЫЛО ВОЛНОЙ ПУЛЬСАРА' },
    worm: { bad: true, r: 0.4, speed: [3, 4], hp: 4, pts: 80, life: 18, cause: 'СОЖРАН ЧЕРВЁМ' },
    ghoul: { bad: true, r: 0.85, speed: [0.9, 1.5], hp: 10, pts: 150, life: 26, homing: 0.5, cause: 'ЗАДАВЛЕН УПЫРЁМ' },
  };
  // kind, min level, weight, max alive
  const FLIER_POOL = [['eye', 1, 3, 9], ['glitch', 2, 2, 3], ['spike', 3, 2, 4], ['pulsar', 4, 1.5, 2], ['worm', 5, 1.2, 1], ['ghoul', 3, 1, 2]];
  const DROP_DUR = 6;
  const POWER_DUR = { trip: 9, slow: 6, ghost: 7, big: 6 };
  const POWER_INFO = {
    trip: { name: 'ТРИП x2', h: 320 },
    slow: { name: 'СЛОУМО', h: 190 },
    ghost: { name: 'ПРИЗРАК', h: 220 },
    big: { name: 'БОШКА', h: 30 },
  };
  const LEGEND = [
    [['orb', 'СФЕРА', '+10 · рост'], ['mushroom', 'ГРИБ', 'трип · x2'], ['crystal', 'КРИСТАЛЛ', 'замедление'],
      ['ghost', 'ПРИЗРАК', 'неуязвимость'], ['star', 'ЗВЕЗДА', '+100 · тает'], ['moth', 'МОТЫЛЁК', 'лови · +40']],
    [['void', 'ДЫРА', 'смерть'], ['eye', 'ГЛАЗ', 'бьёт и кусает'], ['spike', 'ШИП', 'самонаводится'],
      ['glitch', 'ГЛИТЧ', 'прыгает в долю'], ['pulsar', 'ПУЛЬСАР', 'волна на такт'], ['worm', 'ЧЕРВЬ', 'охотится'],
      ['well', 'ГРАВИ-ДЫРА', 'тянет всё'], ['ghoul', 'УПЫРЬ', '10 пуль / 3 прицела']],
  ];
  const HYPE = { 3: 'ОГО', 5: 'НЕПЛОХО', 7: 'БЕЗУМИЕ', 9: 'КОСМОС', 12: 'НИРВАНА' };
  const KEYMAP = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutBack = x => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
  const livesLabel = n => (Number.isFinite(n) ? String(n) : '∞');
  const speedHue = s => 200 - (s - 1) * 25;
  const audio = (fn, ...args) => { try { AudioFX[fn](...args); } catch (e) { console.warn('audio', e); } };

  // ---------- canvases ----------
  const glCanvas = document.getElementById('gl');
  const ui = document.getElementById('ui');
  const uctx = ui.getContext('2d');
  const fx = document.createElement('canvas'); // game layer, fed into the shader pipeline
  const fctx = fx.getContext('2d');
  let hasGL = false;
  try { hasGL = GFX.init(glCanvas); } catch (err) { console.error('WebGL2 init failed, falling back to 2D', err); }
  function useFallback2D() {
    hasGL = false;
    glCanvas.style.display = 'none';
    if (!fx.parentNode) document.body.insertBefore(fx, ui);
  }
  if (!hasGL) useFallback2D();
  glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); useFallback2D(); });
  // Own tracks: drop audio files on the window or press T to pick them.
  let dragToastAt = -10;
  window.addEventListener('dragover', e => {
    e.preventDefault();
    if (time - dragToastAt > 1) { dragToastAt = time; showToast('КИДАЙ ТРЕК СЮДА', 50); }
  });
  window.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) Tracks.addFiles(e.dataTransfer.files);
  });
  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = 'audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus';
  filePicker.multiple = true;
  filePicker.style.display = 'none';
  filePicker.addEventListener('change', () => {
    if (filePicker.files.length) Tracks.addFiles(filePicker.files);
    filePicker.value = '';
  });
  document.body.appendChild(filePicker);

  let W = 0, H = 0, dpr = 1, cell = 20, bx = 0, by = 0, bw = 0, bh = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [glCanvas, ui, fx]) {
      c.width = Math.max(1, Math.round(W * dpr));
      c.height = Math.max(1, Math.round(H * dpr));
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    }
    const top = 66, bottom = 40, side = 24;
    cell = Math.max(8, Math.floor(Math.min((W - side * 2) / COLS, (H - top - bottom) / ROWS)));
    bw = cell * COLS;
    bh = cell * ROWS;
    bx = Math.floor((W - bw) / 2);
    by = Math.floor(top + Math.max(0, (H - top - bottom - bh) / 2));
    if (hasGL) GFX.resize(glCanvas.width, glCanvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // Continuous board coordinates: cell (x, y) spans [x, x+1); its center is x + 0.5.
  const ux = u => bx + u * cell;
  const uy = u => by + u * cell;
  const cx = x => ux(x + 0.5);
  const cy = y => uy(y + 0.5);
  const wrapCell = (x, y) => ({ x: ((x % COLS) + COLS) % COLS, y: ((y % ROWS) + ROWS) % ROWS });

  // ---------- state ----------
  let tripLevel = clamp(store.get('vs_trip', 1) | 0, 0, TRIP.length - 1);
  let speed = clamp(store.get('vs_speed', 5) | 0, 1, 9);
  let livesIdx = clamp(store.get('vs_lives', 1) | 0, 0, LIVES_OPTS.length - 1);
  let best = store.get('vs_best', 0) | 0;
  let state = 'title'; // title | play | countdown | paused | respawn | dying | over
  let snake = [], prevSnake = [], curCells = [], dir = { x: 1, y: 0 }, dirQueue = [], grow = 0;
  let items = [], voids = [], fliers = [], bullets = [], pickups = [];
  let score = 0, shownScore = 0, eaten = 0, level = 1, combo = 0, comboTimer = 0, lives = 3;
  let acc = 0, stepCount = 0, gameTime = 0, idleAcc = 0, idleStep = 0;
  let power = { trip: 0, slow: 0, ghost: 0 }, shield = 0, slowK = 1, graceUsed = false;
  let fireHeld = false, fireCd = 0, mouthOpen = 0, flierTimer = 4, countT = 0, superCharge = 1;
  let gridIdx = null, gridLen = 0, lastBeat = null, lastBeatF = null;
  let dropT = 0, buildK = 0, invertFlash = 0, shockT = 9, bigK = 0, bigTimer = 25, beatsToDrop = Infinity;
  let barPulse = 0, barAxis = false, hordeLeft = 0;
  let zone = null, zoneTimer = 20, zoneFlash = null;
  let ouroCd = 0, lastOuroEaten = -1, ouroPoly = null, ouroT = 0, mega = null;
  let groove = 0, fever = 0;
  const FEVER_DUR = 8;
  let dropCount = 0, boss = null, bossBullets = [], wells = [], wellTimer = 25;
  let aim = null, aimCharge = 1, aimK = 0, beam = null;
  const AIM_RECHARGE = 10, AIM_TIME = 3.5, BOSS_LIFE = 35;
  const react = { bass: 0, bassAvg: 0, kick: 0, high: 0 };
  const SUBDIV = [2, 1, 0.5, 1 / 3, 0.25, 1 / 6, 0.125];
  const SUPER_RECHARGE = 10, SUPER_RAYS = 28, AIM_DMG = 4;
  let triHeld = false, triCd = 0;
  const particles = [], rings = [], popups = [];
  let toast = null, banner = null;
  let time = 0, hue = 0, intensity = 0.4, tripSmooth = 0;
  let shake = 0, pulse = 0, beat = 0, flash = 0, hitStop = 0;
  let deathT = 0, exploded = 0, deathCause = '', newBest = false, overAt = 0;
  let titlePts = [];
  const stars = Array.from({ length: 110 }, () => ({ a: Math.random() * TAU, d: Math.random(), s: 0.5 + Math.random() }));

  const speedK = () => (speed - 1) / 8;
  const invulnerable = () => power.ghost > 0 || shield > 0;
  const voidArm = v => clamp((gameTime - v.born) / 1.0, 0, 1);
  const flierArmed = f => { const age = gameTime - f.born; return age > 0.7 && age < FLIER[f.kind].life - 0.5; };

  const baseStepMs = () => Math.max(40, 200 * Math.pow(48 / 200, (speed - 1) / 8) * Math.pow(0.975, level - 1));
  const stepMs = () => baseStepMs() * slowK;

  // With a user track the snake steps on the track's beat grid: pick the subdivision closest to the chosen speed.
  function gridLenFor(bpm) {
    const target = baseStepMs() / 1000, spb = 60 / bpm;
    let best = 1, err = Infinity;
    for (const c of SUBDIV) {
      const e = Math.abs(Math.log((c * spb) / target));
      if (e < err) { err = e; best = c; }
    }
    return best;
  }
  const musicLevel = () => (power.trip > 0 ? 6 : Math.min(6, level + 1 + (speed >= 7 ? 1 : 0)));

  function reset() {
    const y = Math.floor(ROWS / 2);
    snake = [{ x: 8, y }, { x: 7, y }, { x: 6, y }, { x: 5, y }];
    prevSnake = snake.map(s => ({ ...s }));
    dir = { x: 1, y: 0 };
    dirQueue = [];
    grow = 0;
    items = []; voids = []; fliers = []; bullets = []; pickups = [];
    score = 0; shownScore = 0; eaten = 0; level = 1; combo = 0; comboTimer = 0;
    lives = LIVES_OPTS[livesIdx];
    acc = 0; stepCount = 0; gameTime = 0;
    power = { trip: 0, slow: 0, ghost: 0, big: 0 }; shield = 0; slowK = 1; graceUsed = false;
    fireCd = 0; flierTimer = 4; superCharge = 1; gridIdx = null;
    dropT = 0; bigTimer = 18 + Math.random() * 12; hordeLeft = 0;
    zone = null; zoneTimer = 20 + Math.random() * 8; zoneFlash = null;
    ouroCd = 0; lastOuroEaten = -1; ouroPoly = null; mega = null; groove = 0; fever = 0;
    dropCount = 0; boss = null; bossBullets = []; wells = []; wellTimer = 25 + Math.random() * 10;
    if (aim) audio('setWarp', false);
    aim = null; aimCharge = 1; beam = null;
    document.body.classList.remove('aiming');
    particles.length = 0; rings.length = 0; popups.length = 0;
    banner = null;
    newBest = false;
    spawnItem('orb');
    curCells = snakeCells(0);
  }

  // ---------- spawning ----------
  function occupied(x, y) {
    return snake.some(s => s.x === x && s.y === y) ||
      voids.some(v => v.x === x && v.y === y) ||
      items.some(i => i.x === x && i.y === y);
  }

  function torDist(a, b) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    return Math.min(dx, COLS - dx) + Math.min(dy, ROWS - dy);
  }

  function freeCell(minHeadDist, reject = null) {
    for (let tries = 0; tries < 400; tries++) {
      const c = { x: rnd(COLS), y: rnd(ROWS) };
      if (!occupied(c.x, c.y) && torDist(c, snake[0]) >= minHeadDist && !(reject && reject(c))) return c;
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!occupied(x, y)) return { x, y };
    return null;
  }

  function aheadOfHead(c, n = 12) {
    let { x, y } = snake[0];
    for (let k = 0; k < n; k++) {
      x = (x + dir.x + COLS) % COLS;
      y = (y + dir.y + ROWS) % ROWS;
      if (x === c.x && y === c.y) return true;
    }
    return false;
  }

  function spawnItem(type) {
    const c = freeCell(type === 'orb' ? 2 : 4);
    if (!c) return;
    const life = type === 'orb' ? Infinity : type === 'star' ? 6 : 10;
    items.push({ type, x: c.x, y: c.y, born: gameTime, life });
  }

  function spawnVoid() {
    if (voids.length >= 10) return;
    const bad = c => aheadOfHead(c) || items.some(i => torDist(i, c) <= 1);
    const c = freeCell(7, bad);
    if (!c || torDist(c, snake[0]) < 7 || bad(c)) return; // the fallback scan ignores the filter
    voids.push({ x: c.x, y: c.y, born: gameTime });
  }

  function spawnFlier(kind) {
    const F = FLIER[kind];
    const h = curCells[0];
    if (kind === 'glitch') {
      for (let t = 0; t < 20; t++) {
        const x = 1 + Math.random() * (COLS - 2), y = 1 + Math.random() * (ROWS - 2);
        if (h && Math.hypot(x - h.x, y - h.y) < 6) continue;
        const f = { kind, x, y, vx: 0, vy: 0, born: gameTime, hp: F.hp, ph: 0, hit: 0, tx: x, ty: y };
        pickGlitchTarget(f);
        fliers.push(f);
        return;
      }
      return;
    }
    for (let t = 0; t < 10; t++) {
      const e = rnd(4);
      let x, y, a;
      if (e === 0) { x = F.r; y = 1 + Math.random() * (ROWS - 2); a = 0; }
      else if (e === 1) { x = COLS - F.r; y = 1 + Math.random() * (ROWS - 2); a = Math.PI; }
      else if (e === 2) { x = 1 + Math.random() * (COLS - 2); y = F.r; a = Math.PI / 2; }
      else { x = 1 + Math.random() * (COLS - 2); y = ROWS - F.r; a = -Math.PI / 2; }
      if (h && Math.hypot(x - h.x, y - h.y) < 6) continue;
      a += (Math.random() * 2 - 1) * 0.9;
      const sp = (F.speed[0] + Math.random() * (F.speed[1] - F.speed[0])) * (0.75 + speed * 0.06) * (1 + (level - 1) * 0.03);
      const f = { kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: gameTime, hp: F.hp, ph: Math.random() * TAU, hit: 0 };
      if (kind === 'worm') f.trail = Array.from({ length: 8 }, () => ({ x, y }));
      if (kind === 'pulsar') { f.ringAge = null; f.beatSec = 0.5; }
      fliers.push(f);
      return;
    }
  }

  function pickGlitchTarget(f) {
    const h = curCells[0] || { x: COLS / 2, y: ROWS / 2 };
    for (let k = 0; k < 8; k++) {
      const a = Math.atan2(h.y - f.y, h.x - f.x) + (Math.random() - 0.5) * 1.8, d = 2.5 + Math.random() * 2.5;
      const tx = clamp(f.x + Math.cos(a) * d, 0.6, COLS - 0.6), ty = clamp(f.y + Math.sin(a) * d, 0.6, ROWS - 0.6);
      if (Math.hypot(tx - h.x, ty - h.y) > 1.8 || k === 7) {
        f.tx = tx;
        f.ty = ty;
        return;
      }
    }
  }

  const beatSec = () => {
    const c = AudioFX.trackClock();
    return c ? c.spb : (stepMs() * 4) / 1000;
  };

  // Called once per musical beat (track or built-in synth): beat-bound enemies act here.
  function onBeat(b) {
    if (beatSec() >= 0.33 || b % 2 === 0) beat = 1; // keep full-screen pulses under ~3 Hz
    if (b % 4 === 0) {
      barPulse = 1;
      barAxis = !barAxis;
    }
    if (state !== 'play' && state !== 'respawn') return;
    if (hordeLeft > 0 && state === 'play') {
      for (let k = 0; k < 2 && hordeLeft > 0; k++, hordeLeft--) spawnHorde();
    }
    if (zone) {
      zone.beatsLeft--;
      if (zone.beatsLeft <= 0) annihilateZone();
      else audio('alarm', zone.beatsLeft <= 2);
    }
    // the boss fires on the beat: straight when it has you in its sights, a spread now and then
    if (boss && state === 'play' && b % 2 === 0 && snake.length) {
      if (lineOfFire(boss.segs[0], boss.dir, snake[0])) bossFire(false);
      else if (b % 8 === 0) bossFire(true);
    }
    const bs = beatSec();
    for (const f of fliers) {
      if (!flierArmed(f)) continue;
      if (f.kind === 'pulsar' && b % 4 === 0) {
        f.ringAge = 0;
        f.beatSec = bs;
      }
      if (f.kind === 'glitch' && b % 2 === 0) {
        burst(ux(f.x), uy(f.y), 14, 160, 200);
        f.x = f.tx;
        f.y = f.ty;
        burst(ux(f.x), uy(f.y), 14, 300, 200);
        pickGlitchTarget(f);
      }
    }
  }

  function pickWeighted(opts) {
    let r = Math.random() * opts.reduce((s, o) => s + o[2], 0);
    for (const o of opts) {
      r -= o[2];
      if (r <= 0) return o[0];
    }
    return opts.length ? opts[opts.length - 1][0] : null;
  }

  function spawnHorde() {
    if (fliers.length >= 26) return;
    const count = k => fliers.filter(f => f.kind === k).length;
    const opts = FLIER_POOL.filter(([k, lv]) => level + 2 >= lv && (k !== 'worm' || count('worm') < 2) && (k !== 'pulsar' || count('pulsar') < 3));
    const kind = pickWeighted(opts);
    if (kind) spawnFlier(kind);
  }

  // ---------- annihilation zone: half the board glows for a few beats, then everything in it dies ----------
  const inZone = (z, x, y) => (z.axis === 'h' ? (z.side === 0 ? y < ROWS / 2 : y >= ROWS / 2) : (z.side === 0 ? x < COLS / 2 : x >= COLS / 2));
  const zoneRect = z => (z.axis === 'h' ? [bx, by + (z.side ? bh / 2 : 0), bw, bh / 2] : [bx + (z.side ? bw / 2 : 0), by, bw / 2, bh]);

  function startZone() {
    zone = { axis: Math.random() < 0.5 ? 'h' : 'v', side: rnd(2), beatsLeft: beatSec() < 0.4 ? 8 : 4 };
    zone.total = zone.beatsLeft;
    showToast('АННИГИЛЯЦИЯ! ВАЛИ ИЗ ЗОНЫ', 0);
    audio('alarm', false);
  }

  function annihilateZone() {
    const z = zone;
    zone = null;
    zoneTimer = 16 + Math.random() * 12;
    zoneFlash = { ...z, t: 0.6 };
    for (let i = fliers.length - 1; i >= 0; i--) {
      if (!inZone(z, fliers[i].x, fliers[i].y)) continue;
      if (FLIER[fliers[i].kind].bad) destroyFlier(i);
      else fliers.splice(i, 1);
    }
    for (let i = voids.length - 1; i >= 0; i--) if (inZone(z, voids[i].x + 0.5, voids[i].y + 0.5)) destroyVoid(i);
    for (let i = items.length - 1; i >= 0; i--) {
      if (!inZone(z, items[i].x + 0.5, items[i].y + 0.5)) continue;
      const it = items.splice(i, 1)[0];
      burst(cx(it.x), cy(it.y), 10, 0, 200);
    }
    for (let i = pickups.length - 1; i >= 0; i--) if (inZone(z, pickups[i].x, pickups[i].y)) pickups.splice(i, 1);
    const [zx, zy, zw, zh] = zoneRect(z);
    for (let k = 0; k < 24; k++) burst(zx + Math.random() * zw, zy + Math.random() * zh, 10, Math.random() * 360, 300);
    shake = Math.max(shake, 22);
    pulse = 1;
    hitStop = Math.max(hitStop, 0.12);
    flash = Math.max(flash, 0.3);
    audio('annihilate');
    if (state === 'play' && curCells.length && !invulnerable() && inZone(z, curCells[0].x, curCells[0].y)) {
      crash('АННИГИЛИРОВАН ВМЕСТЕ С ПОЛОВИНОЙ МИРА');
    }
  }

  // ---------- ouroboros: bite your own tail tip, everything inside the loop is annihilated ----------
  function inPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function ouroboros() {
    ouroCd = 3;
    const fresh = eaten !== lastOuroEaten;
    lastOuroEaten = eaten;
    const poly = snake.map(s => ({ x: s.x + 0.5, y: s.y + 0.5 }));
    const closed = poly.every((p, i) => i === 0 || (Math.abs(p.x - poly[i - 1].x) <= 1.5 && Math.abs(p.y - poly[i - 1].y) <= 1.5));
    let caught = 0;
    if (closed) {
      for (let i = fliers.length - 1; i >= 0; i--) {
        const f = fliers[i];
        if (!inPoly(f.x, f.y, poly)) continue;
        caught++;
        if (FLIER[f.kind].bad) destroyFlier(i);
        else { fliers.splice(i, 1); magnetize('moth', f.x, f.y); }
      }
      for (let i = voids.length - 1; i >= 0; i--) {
        if (inPoly(voids[i].x + 0.5, voids[i].y + 0.5, poly)) { destroyVoid(i); caught++; }
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (inPoly(it.x + 0.5, it.y + 0.5, poly)) { items.splice(i, 1); magnetize(it.type, it.x + 0.5, it.y + 0.5); }
      }
      ouroPoly = poly;
      ouroT = 0.8;
    }
    bumpCombo();
    bumpCombo();
    const h = snake[0];
    award(Math.round(snake.length * 15 * (fresh ? 1 : 0.25) * (1 + caught * 0.5)), cx(h.x), cy(h.y), true);
    mega = {
      text: 'УРОБОРОС',
      sub: caught ? `ВНУТРИ КОЛЬЦА АННИГИЛИРОВАНО: ${caught}` : fresh ? 'ЗМЕЙ ПОЖИРАЕТ СЕБЯ' : 'ПОВТОР — ОЧКИ x0.25',
      life: 2, max: 2,
    };
    for (const s of snake) burst(cx(s.x), cy(s.y), 4, hue + Math.random() * 120, 220);
    shockT = 0;
    pulse = 1;
    hitStop = Math.max(hitStop, 0.15);
    shake = Math.max(shake, 14);
    audio('ouroboros');
  }

  // ---------- groove: turning on the beat fills a meter; a full meter = fever ----------
  function rhythmCheck() {
    const clock = AudioFX.trackClock();
    let bp;
    if (clock) {
      bp = clock.beat;
    } else {
      const sm = stepMs();
      bp = (stepCount + clamp(acc / sm, 0, 1)) / 4 - AudioFX.latency() / ((sm * 4) / 1000);
    }
    if (Math.abs(bp - Math.round(bp)) < 0.13) {
      groove = Math.min(8, groove + 1);
      score += 5 * speed;
      const h = curCells[0];
      if (h) popup(ux(h.x), uy(h.y) - cell * 0.8, 'В ДОЛЮ', '', 50, 13, 0.5);
      audio('tick');
      if (groove >= 8) {
        groove = 0;
        fever = FEVER_DUR;
        mega = { text: 'ГРУВ!', sub: 'ТЫ В РИТМЕ · ОЧКИ x2', life: 1.6, max: 1.6 };
        pulse = 1;
        audio('levelUp');
      }
    } else {
      groove = Math.max(0, groove - 0.5);
    }
  }

  // ---------- boss: an anti-snake as long as you, duel to the first head shot ----------
  const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  function spawnBoss() {
    if (boss || state !== 'play') return;
    const c = freeCell(10) || { x: (snake[0].x + COLS / 2) % COLS, y: (snake[0].y + ROWS / 2) % ROWS };
    const len = clamp(snake.length, 6, 40);
    boss = { segs: [c], prev: [{ ...c }], cells: [{ x: c.x + 0.5, y: c.y + 0.5 }], dir: pick(DIRS4), grow: len - 1, life: BOSS_LIFE };
    mega = { text: 'БОСС', sub: 'АНТИ-ЗМЕЙ ТВОЕЙ ДЛИНЫ · КТО ПЕРВЫМ ПОПАДЁТ В ГОЛОВУ', life: 2.2, max: 2.2 };
    burst(cx(c.x), cy(c.y), 80, 0, 400);
    ring(cx(c.x), cy(c.y), cell * 5, -cell * 7, 0.6, 0, 6);
    audio('alarm', true);
  }

  // is p straight ahead of n along d (within 12 cells, through portals)?
  function lineOfFire(n, d, p) {
    for (let k = 1; k <= 12; k++) {
      const c = wrapCell(n.x + d.x * k, n.y + d.y * k);
      if (c.x === p.x && c.y === p.y) return true;
    }
    return false;
  }

  function bossStep() {
    const b = boss;
    b.prev = b.segs.map(s => ({ ...s }));
    const h = b.segs[0], ph = snake[0];
    let best = b.dir, bestScore = -Infinity;
    for (const d of DIRS4) {
      if (d.x === -b.dir.x && d.y === -b.dir.y) continue;
      const n = wrapCell(h.x + d.x, h.y + d.y);
      let s = Math.random() * 0.6;
      if (voids.some(v => v.x === n.x && v.y === n.y)) s -= 100;
      if (snake.some(p => p.x === n.x && p.y === n.y)) s -= 60;
      s -= Math.abs(torDist(n, ph) - 6) * 0.8;
      if (lineOfFire(n, d, ph)) s += 4;
      if (d.x === b.dir.x && d.y === b.dir.y) s += 0.5;
      if (s > bestScore) { bestScore = s; best = d; }
    }
    b.dir = best;
    const nh = wrapCell(h.x + best.x, h.y + best.y);
    const hit = snake.findIndex(p => p.x === nh.x && p.y === nh.y);
    if (hit >= 0 && !invulnerable()) {
      if (hit === 0) crash('ЛОБОВОЕ С БОССОМ');
      else bossDefeated('БОСС ВРЕЗАЛСЯ В ТЕБЯ');
      return;
    }
    b.segs.unshift(nh);
    if (b.grow > 0) b.grow--;
    else b.segs.pop();
  }

  function bossFire(spread) {
    const h = boss.cells[0] || { x: boss.segs[0].x + 0.5, y: boss.segs[0].y + 0.5 };
    const sp = Math.max(16, (1.7 * 1000) / stepMs());
    const base = Math.atan2(boss.dir.y, boss.dir.x);
    for (const off of spread ? [-0.35, 0, 0.35] : [0]) {
      bossBullets.push({ x: h.x + boss.dir.x * 0.5, y: h.y + boss.dir.y * 0.5, vx: Math.cos(base + off) * sp, vy: Math.sin(base + off) * sp, life: 1.4 });
    }
    audio('bossShot');
  }

  function chopBoss(k) {
    const lost = boss.segs.slice(k);
    boss.segs = boss.segs.slice(0, Math.max(2, k));
    boss.prev = boss.prev.slice(0, boss.segs.length);
    boss.grow = 0;
    for (const s of lost) burst(cx(s.x), cy(s.y), 6, 0, 220);
    dropCrumbs(lost, 6);
    award(10 * lost.length, cx(lost[0].x), cy(lost[0].y), false);
  }

  function bossDefeated(reason) {
    const b = boss;
    boss = null;
    bossBullets = [];
    for (const s of b.segs) burst(cx(s.x), cy(s.y), 14, hue + Math.random() * 90, 320);
    dropCrumbs(b.segs, 16);
    bumpCombo();
    bumpCombo();
    bumpCombo();
    award(60 * b.segs.length + 300, cx(b.segs[0].x), cy(b.segs[0].y), true);
    mega = { text: 'БОСС ПОВЕРЖЕН', sub: reason, life: 2.4, max: 2.4 };
    invertFlash = 1;
    shockT = 0;
    shake = 26;
    pulse = 1;
    hitStop = Math.max(hitStop, 0.2);
    audio('ouroboros');
    audio('kill', true);
  }

  // ---------- gravity wells: pull the snake, bullets and enemies; bend light ----------
  function spawnWell() {
    if (wells.length >= 2) return;
    const h = curCells[0] || { x: COLS / 2, y: ROWS / 2 };
    for (let t = 0; t < 30; t++) {
      const x = 2 + Math.random() * (COLS - 4), y = 2 + Math.random() * (ROWS - 4);
      if (Math.hypot(x - h.x, y - h.y) < 7 || wells.some(w => Math.hypot(w.x - x, w.y - y) < 6)) continue;
      wells.push({ x, y, born: gameTime, life: 14 });
      showToast('ГРАВИ-ДЫРА: ТЯНЕТ ВСЁ', 260);
      return;
    }
  }

  function collapseWell(i, byPlayer) {
    const w = wells.splice(i, 1)[0];
    burst(ux(w.x), uy(w.y), 60, 260, 380);
    ring(ux(w.x), uy(w.y), 4, 600, 0.6, 260, 6);
    if (byPlayer) {
      bumpCombo();
      award(60, ux(w.x), uy(w.y), true);
      audio('kill', true);
    }
  }

  // accelerate a moving body toward the wells; keepSpeed curves it without speeding it up
  function gravitate(o, dt, G, keepSpeed, maxSpeed) {
    for (const w of wells) {
      const dx = w.x - o.x, dy = w.y - o.y, d2 = Math.max(0.4, dx * dx + dy * dy), d = Math.sqrt(d2);
      const a = Math.min(G / d2, G * 2);
      const sp0 = Math.hypot(o.vx, o.vy);
      o.vx += (dx / d) * a * dt;
      o.vy += (dy / d) * a * dt;
      const sp = Math.hypot(o.vx, o.vy) || 1;
      const lim = keepSpeed ? sp0 : Math.min(sp, maxSpeed);
      o.vx *= lim / sp;
      o.vy *= lim / sp;
    }
  }

  // without input, a nearby well bends the snake's course toward itself
  function gravityPull() {
    if (!wells.length || invulnerable()) return;
    const h = { x: snake[0].x + 0.5, y: snake[0].y + 0.5 };
    for (const w of wells) {
      const dx = w.x - h.x, dy = w.y - h.y, d = Math.hypot(dx, dy);
      if (d > 4.5 || Math.random() > 0.55 * (1 - d / 4.5)) continue;
      const nd = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      if ((nd.x || nd.y) && !(nd.x === -dir.x && nd.y === -dir.y)) {
        dir = nd;
        burst(cx(snake[0].x), cy(snake[0].y), 6, 260, 120);
      }
      return;
    }
  }

  // ---------- Q: sniper scope — time nearly stops, aim at a cell; hit annihilates, miss doubles the enemies ----------
  function aimHits(a) {
    const tx = a.x + 0.5, ty = a.y + 0.5;
    if (boss && boss.segs.some(s => s.x === a.x && s.y === a.y)) return true;
    if (voids.some(v => v.x === a.x && v.y === a.y)) return true;
    if (wells.some(w => Math.hypot(w.x - tx, w.y - ty) < 1)) return true;
    return fliers.some(f => FLIER[f.kind].bad && (Math.hypot(f.x - tx, f.y - ty) < FLIER[f.kind].r + 0.55 ||
      (f.kind === 'worm' && f.trail.some(s => Math.hypot(s.x - tx, s.y - ty) < 0.75))));
  }

  function startAim() {
    if (aim || state !== 'play' || !curCells.length) return;
    if (aimCharge < 1) {
      showToast(`ПРИЦЕЛ ${Math.floor(aimCharge * 100)}%`, 0);
      return;
    }
    aimCharge = 0;
    fireHeld = false;
    aim = { x: snake[0].x, y: snake[0].y, t: AIM_TIME };
    document.body.classList.add('aiming');
    audio('setWarp', true);
  }

  function cancelAim() {
    if (!aim) return;
    aim = null;
    aimCharge = 1;
    document.body.classList.remove('aiming');
    audio('setWarp', false);
  }

  function fireAim() {
    const a = aim;
    if (!a) return;
    aim = null;
    document.body.classList.remove('aiming');
    audio('setWarp', false);
    const tx = a.x + 0.5, ty = a.y + 0.5;
    const h = curCells[0] || { x: tx, y: ty };
    beam = { x0: h.x, y0: h.y, x1: tx, y1: ty, t: 0.5, hit: false };
    let hits = 0;
    const struck = new Set();
    if (boss) {
      const bi = boss.segs.findIndex(s => s.x === a.x && s.y === a.y);
      if (bi === 0) { bossDefeated('СНАЙПЕРСКИЙ ВЫСТРЕЛ В ГОЛОВУ'); hits++; }
      else if (bi > 0) { chopBoss(bi); hits++; }
    }
    for (let i = fliers.length - 1; i >= 0; i--) {
      const f = fliers[i];
      if (!FLIER[f.kind].bad) continue;
      const segHit = f.kind === 'worm' && f.trail.some(s => Math.hypot(s.x - tx, s.y - ty) < 0.75);
      if (segHit || Math.hypot(f.x - tx, f.y - ty) < FLIER[f.kind].r + 0.55) { struck.add(f); damageFlier(i, AIM_DMG); hits++; }
    }
    for (let i = voids.length - 1; i >= 0; i--) if (voids[i].x === a.x && voids[i].y === a.y) { destroyVoid(i); hits++; }
    for (let i = wells.length - 1; i >= 0; i--) if (Math.hypot(wells[i].x - tx, wells[i].y - ty) < 1) { collapseWell(i, true); hits++; }

    if (hits) {
      beam.hit = true;
      for (let i = fliers.length - 1; i >= 0; i--) {
        const f = fliers[i];
        if (FLIER[f.kind].bad && !struck.has(f) && Math.hypot(f.x - tx, f.y - ty) < 1.8) { damageFlier(i, AIM_DMG); hits++; }
      }
      award(80 * hits, ux(tx), uy(ty), true);
      mega = { text: 'ПОПАЛ', sub: `ПОРАЖЕНО ЦЕЛЕЙ: ${hits}`, life: 1.4, max: 1.4 };
      burst(ux(tx), uy(ty), 120, hue, 520);
      for (let k = 0; k < 3; k++) ring(ux(tx), uy(ty), 4 + k * 20, 700 + k * 200, 0.7, hue + k * 60, 8 - k * 2);
      shockT = 0;
      invertFlash = Math.max(invertFlash, 0.6);
      shake = Math.max(shake, 20);
      hitStop = Math.max(hitStop, 0.12);
      audio('annihilate');
    } else {
      // miss: every bad flier splits in two
      const bad = fliers.filter(f => FLIER[f.kind].bad).slice(0, Math.max(0, 30 - fliers.length));
      for (const f of bad) {
        const ang = Math.random() * TAU;
        const cl = { ...f, x: clamp(f.x + Math.cos(ang), 0.5, COLS - 0.5), y: clamp(f.y + Math.sin(ang), 0.5, ROWS - 0.5), vx: -f.vy, vy: f.vx, born: gameTime, hit: 0, hp: FLIER[f.kind].hp };
        if (f.trail) cl.trail = f.trail.map(s => ({ ...s }));
        if (f.kind === 'glitch') pickGlitchTarget(cl);
        fliers.push(cl);
        burst(ux(cl.x), uy(cl.y), 20, 0, 260);
      }
      if (!bad.length) for (let k = 0; k < 3; k++) spawnFlier('eye');
      mega = { text: 'ПРОМАХ', sub: 'ВРАГОВ СТАЛО x2', life: 1.4, max: 1.4 };
      shake = Math.max(shake, 12);
      audio('miss');
    }
  }

  function triggerDrop(fromTrack) {
    dropT = DROP_DUR;
    invertFlash = 1;
    shockT = 0;
    pulse = 1;
    shake = Math.max(shake, 22);
    hitStop = Math.max(hitStop, 0.1);
    const x0 = state === 'title' ? W / 2 : bx + bw / 2, y0 = state === 'title' ? H / 2 : by + bh / 2;
    const rw = state === 'title' ? W * 0.4 : bw * 0.45, rh = state === 'title' ? H * 0.4 : bh * 0.45;
    for (let k = 0; k < 5; k++) ring(x0, y0, 10 + k * 30, 900 + k * 150, 0.9, hue + k * 72, 10 - k);
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12;
      burst(x0 + Math.cos(a) * rw, y0 + Math.sin(a) * rh, 20, hue + k * 30, 400);
    }
    popup(x0, y0, 'ДРОП!', '', hue, 90, 1.4);
    if (fromTrack) audio('dropBoom');
    const bossDrop = (state === 'play' || state === 'respawn') && ++dropCount % 2 === 0;
    if (bossDrop) spawnBoss();
    else if (state === 'play' || state === 'respawn') hordeLeft = Math.min(20, 6 + level * 2);
    if (state === 'play') {
      power.big = Math.max(power.big, DROP_DUR);
      superCharge = 1;
      if (!bossDrop) showToast('ДРОП! ЛЕЗЕТ ОРДА · БОШКА ЖРЁТ · x2', 30);
      const h = curCells[0];
      if (h) {
        for (let i = fliers.length - 1; i >= 0; i--) {
          const f = fliers[i];
          if (FLIER[f.kind].bad && Math.hypot(f.x - h.x, f.y - h.y) < 6) damageFlier(i, 5);
        }
      }
    }
  }

  function dropCrumbs(segs, max) {
    const stride = Math.max(1, Math.floor(segs.length / max));
    let n = 0;
    for (let i = 0; i < segs.length && n < max; i += stride) {
      const s = segs[i];
      if (items.some(it => it.x === s.x && it.y === s.y) || voids.some(v => v.x === s.x && v.y === s.y)) continue;
      items.push({ type: 'crumb', x: s.x, y: s.y, born: gameTime, life: 9 });
      n++;
    }
  }

  // ---------- effects ----------
  function burst(x, y, n, h, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = spd * (0.3 + Math.random());
      const life = 0.5 + Math.random() * 0.7;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, h: h + Math.random() * 60, size: 1.5 + Math.random() * 3.5 });
    }
    if (particles.length > 1100) particles.splice(0, particles.length - 1100);
  }

  function ring(x, y, r, vr, life, h, w) {
    rings.push({ x, y, r, vr, life, max: life, h, w });
  }

  function showToast(text, h) {
    toast = { text, h, life: 1.8, max: 1.8 };
  }

  function popup(x, y, text, sub, h, size, life = 1) {
    popups.push({ x, y, text, sub, life, max: life, h, size });
  }

  // ---------- game flow ----------
  function startGame() {
    reset();
    state = 'play';
    audio('setSlow', false);
    showToast('ПОЕХАЛИ', 120);
    document.body.classList.add('playing');
  }

  function toMenu() {
    if (score > best) {
      best = score;
      store.set('vs_best', best);
    }
    cancelAim();
    audio('resumeTrack');
    audio('setSlow', false);
    fireHeld = false;
    power = { trip: 0, slow: 0, ghost: 0, big: 0 };
    zone = null;
    boss = null;
    buildK = 0;
    state = 'title';
    document.body.classList.remove('playing', 'aiming');
  }

  function pause() {
    cancelAim();
    state = 'paused';
    fireHeld = false;
    audio('pauseTrack');
    document.body.classList.remove('playing');
  }

  function resume() {
    state = 'countdown';
    countT = 0.9;
    gridIdx = null;
    audio('resumeTrack');
    document.body.classList.add('playing');
  }

  function setSpeed(n) {
    speed = n;
    store.set('vs_speed', speed);
    showToast(`СКОРОСТЬ ${n} · ${SPEED_NAMES[n - 1]} · ОЧКИ x${n}`, speedHue(n));
    pulse = 1;
  }

  function queueDir(x, y) {
    const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if ((last.x === x && last.y === y) || (last.x === -x && last.y === -y)) return false;
    if (dirQueue.length >= 3) return false;
    dirQueue.push({ x, y });
    return true;
  }

  function musicStep(late) {
    if (AudioFX.trackActive()) return; // the track's own beat drives the visuals (see update)
    audio('step', stepCount, stepMs() / 1000, musicLevel(), power.trip > 0, false, late);
    if (stepCount % 4 === 0) onBeat(stepCount / 4);
    // the built-in track builds up over 2 bars and drops every 8 bars (see AudioFX.step)
    if (stepCount % 128 === 0 && musicLevel() >= 2) triggerDrop(false);
  }

  function step(late) {
    stepCount++;
    prevSnake = snake.map(s => ({ x: s.x, y: s.y }));
    if (dirQueue.length) dir = dirQueue.shift();
    else gravityPull();
    const h = snake[0];
    const nh = { x: (h.x + dir.x + COLS) % COLS, y: (h.y + dir.y + ROWS) % ROWS };

    // The snake passes through itself freely; armed black holes (a big head eats them) and the boss's body are deadly.
    const hitVoid = power.big <= 0 && voids.some(v => voidArm(v) >= 1 && v.x === nh.x && v.y === nh.y);
    const hitBoss = boss && boss.segs.some(s => s.x === nh.x && s.y === nh.y);
    if (!invulnerable() && (hitVoid || hitBoss)) {
      // one tick of grace: hold still so a slightly-late turn can still save you
      if (!graceUsed) {
        graceUsed = true;
        musicStep(late);
        return;
      }
      crash(hitBoss ? 'ВРЕЗАЛСЯ В БОССА' : 'ЗАСОСАЛО В ЧЁРНУЮ ДЫРУ');
      return;
    }
    graceUsed = false;

    const tail = snake[snake.length - 1];
    const bite = snake.length >= 8 && nh.x === tail.x && nh.y === tail.y;
    snake.unshift(nh);
    if (grow > 0) grow--;
    else snake.pop();
    if (bite && ouroCd <= 0) ouroboros();

    const idx = items.findIndex(i => i.x === nh.x && i.y === nh.y);
    if (idx >= 0) {
      const it = items.splice(idx, 1)[0];
      eat(it.type, cx(it.x), cy(it.y));
    }

    if (power.trip > 0 && snake.length > 1) {
      const tail = snake[snake.length - 1];
      burst(cx(tail.x), cy(tail.y), 3, hue + 180, 90);
    }
    if (combo >= 4 || speed >= 8 || fever > 0) burst(cx(nh.x), cy(nh.y), 2 + Math.min(combo, 8) / 2, combo >= 8 ? hue : 20, 70);

    if (boss) bossStep();
    if (state !== 'play') return;
    musicStep(late);
  }

  function bumpCombo() {
    combo = comboTimer > 0 ? Math.min(combo + 1, 12) : 1;
    comboTimer = 3;
    if (HYPE[combo]) popup(bx + bw / 2, by + bh * 0.45, `${HYPE[combo]} x${combo}`, '', hue + 90, 40, 0.9);
  }

  function award(base, px, py, big) {
    const mult = combo * (power.trip > 0 ? 2 : 1) * (dropT > 0 ? 2 : 1) * (fever > 0 ? 2 : 1) * speed;
    const pts = base * mult;
    score += pts;
    popup(px, py - cell * 0.3, `+${pts}`, mult > 1 ? `x${mult}` : '', hue, (big ? 22 : 15) + Math.min(combo, 8) * 2);
  }

  function eat(type, px, py) {
    const special = SPECIALS.includes(type);
    const big = special || type === 'moth';
    bumpCombo();
    switch (type) {
      case 'orb':
        grow += 1;
        eaten++;
        if (!items.some(i => i.type === 'orb')) spawnItem('orb');
        if (eaten % 5 === 0) levelUp();
        if (!items.some(i => SPECIALS.includes(i.type)) && Math.random() < 0.3) {
          spawnItem(pick(SPECIALS));
          audio('chime');
        }
        break;
      case 'crumb': grow += 1; break;
      case 'moth': grow += 1; break;
      case 'mushroom': power.trip = POWER_DUR.trip; break;
      case 'crystal': power.slow = POWER_DUR.slow; audio('setSlow', true); break;
      case 'ghost': power.ghost = POWER_DUR.ghost; break;
      case 'star': grow += 2; break;
    }
    if (ITEM_INFO[type].label) showToast(ITEM_INFO[type].label, ITEM_INFO[type].h);
    if (special) flash = Math.max(flash, 0.3);
    award(ITEM_INFO[type].pts, px, py, big);
    burst(px, py, big ? 60 : type === 'crumb' ? 10 : 26, hue, big ? 340 : 220);
    ring(px, py, cell * 0.3, big ? 520 : 300, 0.6, hue, big ? 6 : 3);
    shake = Math.min(18, shake + (big ? 9 : 2 + combo * 0.5));
    pulse = Math.max(pulse, type === 'crumb' ? 0.5 : 1);
    audio('eat', combo, big);
  }

  function levelUp() {
    level++;
    spawnVoid();
    if (level >= 6) spawnVoid();
    banner = { title: `УРОВЕНЬ ${level}`, sub: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], life: 1.6, max: 1.6 };
    audio('levelUp');
    flash = Math.max(flash, 0.4);
    for (let k = 0; k < 3; k++) ring(bx + bw / 2, by + bh / 2, 10 + k * 40, 700, 0.9, hue + k * 120, 8);
  }

  function crash(cause) {
    cancelAim();
    deathCause = cause;
    exploded = 0;
    deathT = 0;
    acc = 0;
    dirQueue = [];
    graceUsed = false;
    power = { trip: 0, slow: 0, ghost: 0, big: 0 };
    shield = 0;
    slowK = 1;
    combo = 0;
    comboTimer = 0;
    audio('setSlow', false);
    shake = 24;
    flash = Math.max(flash, 0.7);
    pulse = 1;
    hitStop = 0.3;
    prevSnake = snake.map(s => ({ ...s }));
    curCells = snakeCells(1);
    if (Number.isFinite(lives)) lives--;
    if (lives > 0) {
      dropCrumbs(snake, 12);
      state = 'respawn';
      audio('crash');
      showToast(Number.isFinite(lives) ? `ОСТАЛОСЬ ЖИЗНЕЙ: ${lives}` : 'РЕИНКАРНАЦИЯ…', 340);
    } else {
      state = 'dying';
      fireHeld = false;
      audio('die');
      if (score > best) {
        best = score;
        newBest = true;
        store.set('vs_best', best);
      }
      document.body.classList.remove('playing');
    }
  }

  function findSpawn() {
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (let tries = 0; tries < 300; tries++) {
      const d = pick(dirs), x = rnd(COLS), y = rnd(ROWS);
      let ok = true;
      for (let k = -3; k <= 6 && ok; k++) {
        const c = wrapCell(x + d.x * k, y + d.y * k);
        if (voids.some(v => v.x === c.x && v.y === c.y)) ok = false;
        if (k < 0 && items.some(i => i.x === c.x && i.y === c.y)) ok = false;
      }
      if (ok && fliers.some(f => FLIER[f.kind].bad && Math.hypot(f.x - x - 0.5, f.y - y - 0.5) < 5)) ok = false;
      if (ok) return { x, y, d };
    }
    return { x: rnd(COLS), y: rnd(ROWS), d: { x: 1, y: 0 } };
  }

  function respawnSnake() {
    const sp = findSpawn();
    snake = [];
    for (let k = 0; k < 4; k++) snake.push(wrapCell(sp.x - sp.d.x * k, sp.y - sp.d.y * k));
    prevSnake = snake.map(s => ({ ...s }));
    dir = { ...sp.d };
    dirQueue = [];
    grow = 0;
    acc = 0;
    gridIdx = null;
    shield = 2.5;
    state = 'play';
    curCells = snakeCells(0);
    const px = cx(sp.x), py = cy(sp.y);
    burst(px, py, 60, hue, 300);
    ring(px, py, cell * 4, -cell * 6, 0.5, hue + 180, 5);
    ring(px, py, 4, 500, 0.6, hue, 4);
    pulse = 1;
    audio('respawn');
  }

  function chop(k) {
    const lost = snake.slice(k);
    snake = snake.slice(0, k);
    prevSnake = prevSnake.slice(0, k);
    curCells = curCells.slice(0, k);
    grow = 0;
    for (const s of lost) burst(cx(s.x), cy(s.y), 6, hue + 180, 200);
    dropCrumbs(lost, 6);
    const cut = lost[0];
    popup(cx(cut.x), cy(cut.y), 'ХВОСТ ОТКУСИЛИ!', '', 0, 20, 1.2);
    shake = Math.min(20, shake + 10);
    pulse = 1;
    hitStop = Math.max(hitStop, 0.1);
    audio('chop');
  }

  function fire() {
    if (fireCd > 0 || !curCells.length) return;
    fireCd = 0.16;
    const h = curCells[0];
    const sp = Math.max(28, (2.6 * 1000) / stepMs());
    bullets.push({ x: h.x + dir.x * 0.45, y: h.y + dir.y * 0.45, vx: dir.x * sp, vy: dir.y * sp, life: 1.0, h: hue });
    const px = ux(h.x + dir.x * 0.6), py = uy(h.y + dir.y * 0.6);
    for (let k = 0; k < 7; k++) {
      const life = 0.15 + Math.random() * 0.15;
      particles.push({
        x: px, y: py,
        vx: (dir.x * 0.8 + (Math.random() - 0.5) * 0.9) * 320, vy: (dir.y * 0.8 + (Math.random() - 0.5) * 0.9) * 320,
        life, max: life, h: hue + 40, size: 2 + Math.random() * 2,
      });
    }
    shake = Math.min(18, shake + 1.2);
    mouthOpen = 0.12;
    audio('shoot');
  }

  // R: three bullets in a fan — more punch than a single shot, but they spread
  function fireTriple() {
    if (triCd > 0 || !curCells.length) return;
    triCd = 0.55;
    const h = curCells[0];
    const sp = Math.max(26, (2.4 * 1000) / stepMs());
    const base = Math.atan2(dir.y, dir.x);
    for (const off of [-0.2, 0, 0.2]) {
      bullets.push({ x: h.x + dir.x * 0.45, y: h.y + dir.y * 0.45, vx: Math.cos(base + off) * sp, vy: Math.sin(base + off) * sp, life: 0.8, h: hue + off * 300 });
    }
    burst(ux(h.x + dir.x * 0.6), uy(h.y + dir.y * 0.6), 16, hue + 60, 340);
    shake = Math.min(18, shake + 2.5);
    mouthOpen = 0.18;
    audio('triple');
  }

  function fireSuper() {
    const h = curCells[0];
    if (!h) return;
    if (superCharge < 1) {
      showToast(`СВЕРХЗАРЯД ${Math.floor(superCharge * 100)}%`, 50);
      return;
    }
    superCharge = 0;
    const sp = Math.max(24, (2.2 * 1000) / stepMs());
    const a0 = Math.random() * TAU;
    for (let k = 0; k < SUPER_RAYS; k++) {
      const a = a0 + (k * TAU) / SUPER_RAYS;
      bullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, h: hue + k * (360 / SUPER_RAYS), sup: true });
    }
    const px = ux(h.x), py = uy(h.y);
    burst(px, py, 90, hue, 520);
    ring(px, py, 6, 900, 0.55, hue, 10);
    ring(px, py, 6, 600, 0.7, hue + 180, 5);
    shake = Math.min(22, shake + 14);
    pulse = 1;
    flash = Math.max(flash, 0.25);
    hitStop = Math.max(hitStop, 0.06);
    mouthOpen = 0.3;
    showToast('СВЕРХЗАРЯД!', 50);
    audio('blast');
  }

  function magnetize(type, x, y) {
    pickups.push({ type, x, y, vx: 0, vy: 0, t: 0 });
    burst(ux(x), uy(y), 12, hue + 120, 160);
    audio('magnet');
  }

  function destroyVoid(i, cheap = false) {
    const v = voids.splice(i, 1)[0];
    const px = cx(v.x), py = cy(v.y);
    if (cheap) comboTimer = Math.max(comboTimer, 1);
    else bumpCombo();
    award(cheap ? 7 : 15, px, py, false);
    burst(px, py, 40, 280, 300);
    ring(px, py, 4, 400, 0.5, 290, 5);
    shake = Math.min(18, shake + 5);
    pulse = 1;
    audio('kill', false);
  }

  // hp damage; returns true when the flier died
  function damageFlier(i, dmg, cheap = false) {
    const f = fliers[i];
    f.hp -= dmg;
    f.hit = 0.12;
    burst(ux(f.x), uy(f.y), 6 + dmg * 3, 40, 200);
    if (f.hp > 0) return false;
    destroyFlier(i, cheap);
    return true;
  }

  function destroyFlier(i, cheap = false) {
    const f = fliers.splice(i, 1)[0];
    const px = ux(f.x), py = uy(f.y);
    const big = f.kind === 'spike' || f.kind === 'ghoul';
    if (cheap) comboTimer = Math.max(comboTimer, 1);
    else bumpCombo();
    award(cheap ? Math.round(FLIER[f.kind].pts / 2) : FLIER[f.kind].pts, px, py, big);
    if (f.kind === 'ghoul') {
      for (let k = 0; k < 3; k++) ring(px, py, 6 + k * 16, 500 + k * 150, 0.6, 120 + k * 40, 6 - k);
      shake = Math.max(shake, 16);
    }
    burst(px, py, big ? 70 : 45, big ? 0 : hue, big ? 420 : 320);
    ring(px, py, 4, big ? 600 : 420, 0.5, big ? 10 : hue, big ? 7 : 4);
    shake = Math.min(18, shake + (big ? 8 : 5));
    pulse = 1;
    hitStop = Math.max(hitStop, big ? 0.08 : 0.04);
    audio('kill', big);
  }

  // ---------- input ----------
  window.addEventListener('keydown', e => {
    audio('init');
    const mv = KEYMAP[e.code];
    if (aim && state === 'play') {
      if (mv) {
        e.preventDefault();
        aim.x = (aim.x + mv[0] + COLS) % COLS;
        aim.y = (aim.y + mv[1] + ROWS) % ROWS;
        audio('tick');
        return;
      }
      if (['KeyQ', 'Space', 'Enter', 'NumpadEnter'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) fireAim();
        return;
      }
    }
    if (mv) {
      e.preventDefault();
      if (state === 'play' || state === 'countdown') {
        if (queueDir(mv[0], mv[1]) && state === 'play' && !e.repeat) rhythmCheck();
      }
      return;
    }
    const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (digit) {
      setSpeed(+digit[2]);
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (state === 'play' || state === 'countdown' || state === 'respawn') {
        fireHeld = true;
        if (state === 'play') fire();
        return;
      }
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'ShiftLeft': case 'ShiftRight': case 'KeyE':
        if (state === 'play') fireSuper();
        break;
      case 'KeyQ':
        startAim();
        break;
      case 'KeyR':
        if (state === 'play') { triHeld = true; fireTriple(); }
        break;
      case 'Space': case 'Enter': case 'NumpadEnter':
        e.preventDefault();
        if (state === 'title' || (state === 'over' && time - overAt > 0.4)) startGame();
        else if (state === 'paused') resume();
        break;
      case 'KeyP':
        if (state === 'play' || state === 'countdown') pause();
        else if (state === 'paused') resume();
        break;
      case 'Escape':
        if (state === 'play' || state === 'countdown') pause();
        else if (state === 'paused' || state === 'over') toMenu();
        break;
      case 'KeyM':
        showToast(AudioFX.isMuted() ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ', 200);
        audio('toggleMute');
        break;
      case 'KeyV':
        tripLevel = (tripLevel + 1) % TRIP.length;
        store.set('vs_trip', tripLevel);
        showToast(`УРОВЕНЬ ТРИПА: ${TRIP[tripLevel].name}`, 300);
        pulse = 1;
        break;
      case 'KeyT':
        if (state === 'play' || state === 'countdown') pause();
        filePicker.click();
        break;
      case 'KeyN':
        Tracks.next();
        break;
      case 'KeyB':
        Tracks.toggle();
        break;
      case 'Delete':
        Tracks.removeCurrent();
        break;
      case 'KeyL':
        if (state === 'title' || state === 'over') {
          livesIdx = (livesIdx + 1) % LIVES_OPTS.length;
          store.set('vs_lives', livesIdx);
          showToast(`ЖИЗНИ: ${livesLabel(LIVES_OPTS[livesIdx])}`, 340);
        } else {
          showToast('ЖИЗНИ МЕНЯЮТСЯ В МЕНЮ', 340);
        }
        break;
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') fireHeld = false;
    if (e.code === 'KeyR') triHeld = false;
  });
  window.addEventListener('pointerdown', () => audio('init'));
  window.addEventListener('mousemove', e => {
    if (!aim) return;
    aim.x = clamp(Math.floor((e.clientX - bx) / cell), 0, COLS - 1);
    aim.y = clamp(Math.floor((e.clientY - by) / cell), 0, ROWS - 1);
  });
  window.addEventListener('mousedown', () => { if (aim && state === 'play') fireAim(); });
  window.addEventListener('blur', () => {
    fireHeld = false;
    triHeld = false;
    if (state === 'play' || state === 'countdown') pause();
  });
  audio('init');
  Tracks.onStatus(showToast);
  Tracks.load();

  // ---------- update ----------
  const snakeCells = t => cellsOf(snake, prevSnake, t);

  function cellsOf(segs, prev, t) {
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      const to = segs[i], from = prev[Math.min(i, prev.length - 1)] || to;
      let fx0 = from.x, fy0 = from.y;
      if (to.x - fx0 > 1) fx0 += COLS; else if (fx0 - to.x > 1) fx0 -= COLS;
      if (to.y - fy0 > 1) fy0 += ROWS; else if (fy0 - to.y > 1) fy0 -= ROWS;
      out.push({ x: fx0 + (to.x - fx0) * t + 0.5, y: fy0 + (to.y - fy0) * t + 0.5 });
    }
    return out;
  }

  function updatePlay(dt) {
    const wasSlow = power.slow > 0, ghostBefore = power.ghost;
    for (const k in power) power[k] = Math.max(0, power[k] - dt);
    if (wasSlow && power.slow === 0) audio('setSlow', false);
    for (const th of [1.5, 1.0, 0.5]) if (ghostBefore > th && power.ghost <= th) audio('warn');
    shield = Math.max(0, shield - dt);
    slowK += ((power.slow > 0 ? 1.75 : 1) - slowK) * Math.min(1, dt * 4);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) { comboTimer = 0; combo = 0; }
    }
    fireCd = Math.max(0, fireCd - dt);
    triCd = Math.max(0, triCd - dt);
    if (fireHeld) fire();
    if (triHeld) fireTriple();
    if (superCharge < 1) {
      superCharge = Math.min(1, superCharge + dt / SUPER_RECHARGE);
      if (superCharge === 1) {
        audio('chime');
        const h = curCells[0];
        if (h) ring(ux(h.x), uy(h.y), cell * 2.5, -cell * 4, 0.4, 50, 4);
      }
    }
    ouroCd = Math.max(0, ouroCd - dt);
    fever = Math.max(0, fever - dt);
    if (aimCharge < 1 && !aim) {
      aimCharge = Math.min(1, aimCharge + dt / AIM_RECHARGE);
      if (aimCharge === 1) audio('chime');
    }
    if (boss && (boss.life -= dt) <= 0) {
      for (const s of boss.segs) burst(cx(s.x), cy(s.y), 4, 0, 160);
      boss = null;
      bossBullets = [];
      showToast('БОСС СБЕЖАЛ', 0);
    }
    if (level >= 3) {
      wellTimer -= dt;
      if (wellTimer <= 0) {
        wellTimer = 20 + Math.random() * 12;
        spawnWell();
      }
    }
    groove = Math.max(0, groove - dt * 0.15);
    if (level >= 2 && !zone) {
      zoneTimer -= dt;
      if (zoneTimer <= 0) startZone();
    }
    bigTimer -= dt;
    if (bigTimer <= 0) {
      bigTimer = 22 + Math.random() * 16;
      if (power.big <= 0) {
        power.big = POWER_DUR.big;
        showToast('БОЛЬШАЯ БОШКА! ЖРИ ВРАГОВ', 30);
        audio('chomp');
        pulse = 1;
      }
    }

    const clock = AudioFX.trackClock();
    if (clock) {
      const len = gridLenFor(clock.bpm);
      const pos = clock.beat / len;
      const idx = Math.floor(pos);
      if (gridIdx === null || len !== gridLen || idx < gridIdx) {
        gridIdx = idx;
        gridLen = len;
      } else if (idx > gridIdx) {
        gridIdx = idx;
        step(0);
        if (state !== 'play') return;
      }
      curCells = snakeCells(clamp(pos - idx, 0, 1));
      if (boss) boss.cells = cellsOf(boss.segs, boss.prev, clamp(pos - idx, 0, 1));
      return;
    }
    gridIdx = null;
    acc += dt * 1000;
    const sm = stepMs();
    if (acc >= sm) {
      acc -= sm;
      if (acc > sm) acc = 0;
      step(acc / 1000);
      if (state !== 'play') return;
    }
    curCells = snakeCells(clamp(acc / stepMs(), 0, 1));
    if (boss) boss.cells = cellsOf(boss.segs, boss.prev, clamp(acc / stepMs(), 0, 1));
  }

  function devour(i) {
    const f = fliers.splice(i, 1)[0];
    const px = ux(f.x), py = uy(f.y);
    bumpCombo();
    award(FLIER[f.kind].pts * 2, px, py, true);
    grow += 1;
    burst(px, py, 60, hue, 380);
    ring(px, py, 4, 500, 0.5, hue + 60, 6);
    popup(px, py - cell, 'ЧАВК!', '', 30, 22, 0.8);
    shake = Math.min(20, shake + 7);
    pulse = 1;
    audio('chomp');
  }

  function snakeVsFliers() {
    if (state !== 'play' || !curCells.length) return;
    const inv = invulnerable(), big = power.big > 0;
    const h = curCells[0], hr = 0.32 + 0.85 * bigK;
    for (let i = wells.length - 1; i >= 0; i--) {
      const w = wells[i];
      if (Math.hypot(w.x - h.x, w.y - h.y) > 0.65 + 0.6 * bigK) continue;
      if (big) { collapseWell(i, true); audio('chomp'); }
      else if (!inv) { crash('СПАГЕТТИФИЦИРОВАН ГРАВИ-ДЫРОЙ'); return; }
    }
    if (big) {
      // the big head swallows black holes and vacuums up items around it
      for (let i = voids.length - 1; i >= 0; i--) {
        const v = voids[i];
        if (Math.hypot(v.x + 0.5 - h.x, v.y + 0.5 - h.y) < hr + 0.2) { destroyVoid(i); audio('chomp'); }
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (Math.hypot(it.x + 0.5 - h.x, it.y + 0.5 - h.y) < hr + 0.15) {
          items.splice(i, 1);
          eat(it.type, cx(it.x), cy(it.y));
        }
      }
    }
    for (let i = fliers.length - 1; i >= 0; i--) {
      const f = fliers[i], F = FLIER[f.kind];
      if (!flierArmed(f)) continue;
      let touch = Math.hypot(f.x - h.x, f.y - h.y) < F.r + hr;
      if (!touch && f.kind === 'worm') touch = f.trail.some(s => Math.hypot(s.x - h.x, s.y - h.y) < F.r * 0.85 + hr);
      if (touch) {
        if (!F.bad) {
          fliers.splice(i, 1);
          eat('moth', ux(f.x), uy(f.y));
          continue;
        }
        if (big) { if (f.kind !== 'ghoul') devour(i); continue; }
        if (inv) continue;
        fliers.splice(i, 1);
        burst(ux(f.x), uy(f.y), 40, 0, 300);
        crash(F.cause);
        return;
      }
      if (f.kind === 'pulsar' && f.ringAge != null && !inv && !big) {
        const R = (f.ringAge / f.beatSec) * 4;
        if (R > 0.8 && Math.abs(Math.hypot(h.x - f.x, h.y - f.y) - R) < 0.4) {
          crash(F.cause);
          return;
        }
      }
      if (F.bad && !inv) {
        for (let k = 2; k < curCells.length; k++) {
          const s = curCells[k];
          if (Math.abs(s.x - f.x) < 1 && Math.abs(s.y - f.y) < 1 && Math.hypot(s.x - f.x, s.y - f.y) < F.r + 0.3) {
            fliers.splice(i, 1);
            burst(ux(f.x), uy(f.y), 30, 0, 260);
            chop(k);
            break;
          }
        }
      }
    }
  }

  function bulletHit(b) {
    const gx = Math.floor(b.x), gy = Math.floor(b.y);
    if (wells.some(w => Math.hypot(w.x - b.x, w.y - b.y) < 0.35)) return true;
    if (boss) {
      const bh = boss.cells[0];
      if (bh && Math.hypot(bh.x - b.x, bh.y - b.y) < 0.55) { bossDefeated('ВЫСТРЕЛ В ГОЛОВУ'); return true; }
      const bi = boss.segs.findIndex(s => s.x === gx && s.y === gy);
      if (bi === 0) { bossDefeated('ВЫСТРЕЛ В ГОЛОВУ'); return true; }
      if (bi > 0) { chopBoss(bi); return true; }
    }
    const vi = voids.findIndex(v => v.x === gx && v.y === gy);
    if (vi >= 0) { destroyVoid(vi, b.sup); return true; }
    const ii = items.findIndex(it => it.x === gx && it.y === gy);
    if (ii >= 0) {
      const it = items.splice(ii, 1)[0];
      magnetize(it.type, it.x + 0.5, it.y + 0.5);
      return true;
    }
    for (let i = fliers.length - 1; i >= 0; i--) {
      const f = fliers[i], F = FLIER[f.kind];
      if (gameTime - f.born < 0.3) continue;
      let hitF = Math.hypot(f.x - b.x, f.y - b.y) < F.r + 0.25;
      if (!hitF && f.kind === 'worm') hitF = f.trail.some(s => Math.hypot(s.x - b.x, s.y - b.y) < F.r + 0.2);
      if (hitF) {
        if (F.bad) {
          damageFlier(i, b.dmg || 1, b.sup);
        } else {
          fliers.splice(i, 1);
          magnetize('moth', f.x, f.y);
        }
        return true;
      }
    }
    return false;
  }

  function updateWorld(dt, spawning) {
    gameTime += dt;

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (gameTime - it.born > it.life) {
        items.splice(i, 1);
        burst(cx(it.x), cy(it.y), 10, hue, 120);
      }
    }
    if (spawning && !items.some(i => i.type === 'orb') && !pickups.some(p => p.type === 'orb')) spawnItem('orb');

    if (spawning) {
      flierTimer -= dt;
      if (flierTimer <= 0) {
        flierTimer = Math.max(1.2, 6.5 - level * 0.45 - speed * 0.2) * (0.7 + Math.random() * 0.6);
        const badCount = fliers.filter(f => FLIER[f.kind].bad).length;
        const maxBad = Math.min(1 + Math.floor(level * 0.8), 9);
        if (Math.random() < 0.22 && fliers.filter(f => f.kind === 'moth').length < 2) {
          spawnFlier('moth');
        } else if (badCount < maxBad) {
          const opts = FLIER_POOL.filter(([k, lv, , mx]) => level >= lv && fliers.filter(f => f.kind === k).length < mx);
          let r = Math.random() * opts.reduce((s, o) => s + o[2], 0);
          for (const o of opts) {
            r -= o[2];
            if (r <= 0) { spawnFlier(o[0]); break; }
          }
        }
      }
    }

    const head = state === 'play' ? curCells[0] : null;
    for (let i = fliers.length - 1; i >= 0; i--) {
      const f = fliers[i], F = FLIER[f.kind];
      if (gameTime - f.born > F.life) { fliers.splice(i, 1); continue; }
      if (f.hit > 0) f.hit -= dt;
      if (F.homing && head && gameTime - f.born > 0.7) {
        const cur = Math.atan2(f.vy, f.vx);
        let d = Math.atan2(head.y - f.y, head.x - f.x) - cur;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const a = cur + clamp(d, -F.homing * dt, F.homing * dt);
        const sp = Math.hypot(f.vx, f.vy);
        f.vx = Math.cos(a) * sp;
        f.vy = Math.sin(a) * sp;
      }
      if (f.kind === 'worm') {
        const sp = Math.hypot(f.vx, f.vy);
        let a = Math.atan2(f.vy, f.vx) + Math.sin(time * 2.4 + f.ph) * 2.2 * dt;
        if (head && gameTime - f.born > 1) {
          let d = Math.atan2(head.y - f.y, head.x - f.x) - a;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          a += clamp(d, -0.7 * dt, 0.7 * dt);
        }
        f.vx = Math.cos(a) * sp;
        f.vy = Math.sin(a) * sp;
      }
      if (f.kind === 'pulsar' && f.ringAge != null) {
        f.ringAge += dt;
        if (f.ringAge > f.beatSec) f.ringAge = null;
      }
      if (wells.length && f.kind !== 'glitch') {
        gravitate(f, dt, 6, false, 7);
        const wi = wells.findIndex(w => Math.hypot(w.x - f.x, w.y - f.y) < 0.6);
        if (wi >= 0) {
          // swallowed by the well — counts as your kill
          if (F.bad) destroyFlier(i);
          else fliers.splice(i, 1);
          continue;
        }
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'moth') {
        const sp = Math.hypot(f.vx, f.vy) || 1, w = Math.sin(time * 5 + f.ph) * 2.2 * dt;
        f.x += (-f.vy / sp) * w;
        f.y += (f.vx / sp) * w;
      }
      if (f.x < F.r) { f.x = F.r; f.vx = Math.abs(f.vx); } else if (f.x > COLS - F.r) { f.x = COLS - F.r; f.vx = -Math.abs(f.vx); }
      if (f.y < F.r) { f.y = F.r; f.vy = Math.abs(f.vy); } else if (f.y > ROWS - F.r) { f.y = ROWS - F.r; f.vy = -Math.abs(f.vy); }
      if (f.trail && Math.hypot(f.x - f.trail[0].x, f.y - f.trail[0].y) >= 0.55) {
        f.trail.unshift({ x: f.x, y: f.y });
        f.trail.length = 8;
      }
    }

    for (let i = wells.length - 1; i >= 0; i--) {
      if (gameTime - wells[i].born > wells[i].life) collapseWell(i, false);
    }

    // boss bullets: only a hit to the head counts, your body soaks them up
    for (let i = bossBullets.length - 1; i >= 0; i--) {
      const b = bossBullets[i];
      b.life -= dt;
      if (wells.length) gravitate(b, dt, 40, true);
      let alive = b.life > 0;
      const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 0.35));
      for (let s = 0; s < n && alive; s++) {
        b.x = (b.x + (b.vx * dt) / n + COLS) % COLS;
        b.y = (b.y + (b.vy * dt) / n + ROWS) % ROWS;
        if (wells.some(w => Math.hypot(w.x - b.x, w.y - b.y) < 0.35)) { alive = false; break; }
        if (state !== 'play' || !curCells.length) continue;
        const h = curCells[0];
        if (Math.hypot(h.x - b.x, h.y - b.y) < 0.45 + 0.6 * bigK) {
          alive = false;
          if (!invulnerable()) { crash('БОСС ПОПАЛ ТЕБЕ В ГОЛОВУ'); break; }
        } else if (snake.some(p => p.x === Math.floor(b.x) && p.y === Math.floor(b.y))) {
          alive = false;
          burst(ux(b.x), uy(b.y), 8, 0, 160);
        }
      }
      if (!alive) bossBullets.splice(i, 1);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      if (wells.length) gravitate(b, dt, 40, true);
      let alive = b.life > 0;
      const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 0.35));
      for (let s = 0; s < n && alive; s++) {
        b.x = (b.x + (b.vx * dt) / n + COLS) % COLS;
        b.y = (b.y + (b.vy * dt) / n + ROWS) % ROWS;
        alive = !bulletHit(b);
      }
      if (!alive) bullets.splice(i, 1);
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt;
      if (head) {
        const dx = head.x - p.x, dy = head.y - p.y, d = Math.hypot(dx, dy);
        if (d < 0.55) {
          pickups.splice(i, 1);
          eat(p.type, ux(p.x), uy(p.y));
          continue;
        }
        const sp = 10 + p.t * 40, k = Math.min(1, dt * 7);
        p.vx += ((dx / d) * sp - p.vx) * k;
        p.vy += ((dy / d) * sp - p.vy) * k;
      } else {
        const k = Math.max(0, 1 - dt * 4);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.random() < dt * 40) burst(ux(p.x), uy(p.y), 1, hue + 120, 40);
    }
  }

  function updateExplosion(dt) {
    deathT += dt;
    const n = snake.length;
    const target = Math.min(n, 1 + Math.floor((deathT / 0.7) * n));
    while (exploded < target) {
      const s = snake[exploded];
      burst(cx(s.x), cy(s.y), exploded === 0 ? 80 : 12, hue + exploded * 13, exploded === 0 ? 420 : 240);
      if (exploded % 4 === 0) ring(cx(s.x), cy(s.y), 4, 260, 0.4, hue + exploded * 13, 3);
      exploded++;
    }
  }

  function update(dtReal) {
    time += dtReal;
    hitStop = Math.max(0, hitStop - dtReal);
    if (aim && state === 'play' && (aim.t -= dtReal) <= 0) fireAim();
    aimK += ((aim ? 1 : 0) - aimK) * Math.min(1, dtReal * 10);
    if (beam && (beam.t -= dtReal) <= 0) beam = null;
    const dt = dtReal * (hitStop > 0 ? 0.25 : 1) * (aim ? 0.08 : 1);
    const sk = speedK();
    const target = TRIP[tripLevel].base + (state === 'title' ? 0.15 : Math.min(0.3, (level - 1) * 0.035)) + sk * 0.25 + (power.trip > 0 ? 0.75 : 0)
      + 0.6 * clamp(dropT, 0, 1) + 0.25 * buildK;
    intensity += (target - intensity) * Math.min(1, dtReal * 1.5);
    tripSmooth += ((power.trip > 0 ? 1 : 0) - tripSmooth) * Math.min(1, dtReal * 1.5);
    hue = (hue + dtReal * (25 + 70 * intensity + speed * 6 + 150 * clamp(dropT, 0, 1))) % 360;
    pulse = Math.max(0, pulse - dtReal * 2.2);
    beat = Math.max(0, beat - dtReal * 5);
    flash = Math.max(0, flash - dtReal * 1.8);
    shake = Math.max(0, shake - dtReal * 45);
    mouthOpen = Math.max(0, mouthOpen - dtReal);
    shownScore += (score - shownScore) * Math.min(1, dtReal * 10);

    // Audio-reactive visuals: works for the built-in synth and for user tracks alike.
    const lv = state === 'paused' ? null : AudioFX.levels();
    const rk = [0.4, 0.85, 1.2][tripLevel];
    if (lv) {
      react.bassAvg += (lv.bass - react.bassAvg) * Math.min(1, dtReal * 2.5);
      react.kick = Math.max(react.kick - dtReal * 5, clamp((lv.bass - react.bassAvg) * 5, 0, 1));
      react.bass += (lv.bass - react.bass) * Math.min(1, dtReal * 12);
      react.high += (lv.high - react.high) * Math.min(1, dtReal * 8);
      beat = Math.max(beat, react.kick * rk);
      intensity += react.high * 0.6 * rk * dtReal;
      hue = (hue + react.high * 120 * rk * dtReal) % 360;
    } else {
      react.kick = Math.max(0, react.kick - dtReal * 5);
    }
    const clock = state === 'paused' ? null : AudioFX.trackClock();
    if (clock) {
      const b = Math.floor(clock.beat);
      if (lastBeat !== null && b > lastBeat) {
        onBeat(b);
        if (((b % 4) + 4) % 4 === 0) {
          pulse = Math.max(pulse, 0.8 * rk);
          ring(state === 'title' ? W / 2 : bx + bw / 2, state === 'title' ? H / 2 : by + bh / 2, 20, 900, 0.5, hue, 3);
        }
      }
      const tr = Tracks.current();
      const drops = (tr && tr.drops) || [];
      if (lastBeatF !== null) for (const d of drops) if (lastBeatF < d && clock.beat >= d) triggerDrop(true);
      const nd = drops.find(d => d > clock.beat);
      beatsToDrop = nd != null ? nd - clock.beat : Infinity;
      buildK = beatsToDrop <= 8 ? 1 - beatsToDrop / 8 : 0;
      lastBeat = b;
      lastBeatF = clock.beat;
    } else {
      lastBeat = null;
      lastBeatF = null;
      if (state === 'play' && musicLevel() >= 2) {
        const ph = (stepCount % 128) + clamp(acc / stepMs(), 0, 1);
        buildK = ph >= 96 ? (ph - 96) / 32 : 0;
        beatsToDrop = buildK > 0 ? (128 - ph) / 4 : Infinity;
      } else if (state !== 'paused' && state !== 'countdown') {
        buildK = 0;
        beatsToDrop = Infinity;
      }
    }
    dropT = Math.max(0, dropT - dtReal);
    barPulse = Math.max(0, barPulse - dtReal * 3);
    if (zoneFlash && (zoneFlash.t -= dtReal) <= 0) zoneFlash = null;
    ouroT = Math.max(0, ouroT - dtReal);
    if (mega && (mega.life -= dtReal) <= 0) mega = null;
    invertFlash = Math.max(0, invertFlash - dtReal * 3);
    shockT += dtReal;
    bigK += ((power.big > 0 && state === 'play' ? 1 : 0) - bigK) * Math.min(1, dtReal * 6);
    if (buildK > 0) shake = Math.max(shake, buildK * buildK * 5);

    if (state === 'play') {
      updatePlay(dt);
      if (state === 'play') updateWorld(dt, true);
      snakeVsFliers();
    } else if (state === 'respawn') {
      updateExplosion(dt);
      updateWorld(dt, false);
      if (deathT > 1.3) respawnSnake();
    } else if (state === 'dying') {
      updateExplosion(dt);
      updateWorld(dt, false);
      if (deathT > 1.6) {
        state = 'over';
        overAt = time;
      }
    } else if (state === 'countdown') {
      countT -= dtReal;
      if (countT <= 0) state = 'play';
    } else if (state !== 'paused') {
      idleAcc += dtReal;
      if (idleAcc >= 0.15) {
        idleAcc -= 0.15;
        idleStep++;
        audio('step', idleStep, 0.15, 1, false, true, idleAcc);
        if (idleStep % 4 === 0 && !AudioFX.trackActive()) beat = 0.6;
      }
    }

    if (state === 'title') {
      titlePts = titleSnakePts();
      if (Math.random() < dtReal * 30) burst(titlePts[0].x, titlePts[0].y, 1, hue + 180, 60);
    }

    if (state !== 'paused') {
      const sv = (state === 'title' ? 0.35 : 0.15 + sk * 1.3) * dtReal;
      for (const s of stars) {
        s.d += sv * s.s;
        if (s.d > 1) { s.d = 0.02; s.a = Math.random() * TAU; }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      const d = Math.max(0, 1 - 2.2 * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      r.r = Math.max(0, r.r + r.vr * dt);
      if (r.life <= 0) rings.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dtReal;
      p.y -= 40 * dtReal;
      if (p.life <= 0) popups.splice(i, 1);
    }
    if (toast && (toast.life -= dtReal) <= 0) toast = null;
    if (banner && (banner.life -= dtReal) <= 0) banner = null;
  }

  // ---------- drawing: shapes ----------
  function circle(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }

  function drawOrb(c, S) {
    const h = (hue * 2) % 360;
    const R = S * 0.3 * (1 + 0.12 * Math.sin(time * 6));
    c.save();
    c.rotate(time * 1.8);
    c.lineWidth = Math.max(1.5, S * 0.06);
    c.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      const l = R * (1.35 + 0.35 * Math.sin(time * 8 + k));
      c.strokeStyle = `hsla(${(h + k * 45) % 360},100%,65%,0.9)`;
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1);
      c.lineTo(Math.cos(a) * l, Math.sin(a) * l);
      c.stroke();
    }
    c.restore();
    const g = c.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, `hsl(${h},100%,65%)`);
    g.addColorStop(1, `hsl(${(h + 60) % 360},100%,40%)`);
    c.fillStyle = g;
    circle(c, 0, 0, R);
  }

  function drawCrumb(c, S) {
    const R = S * 0.17 * (1 + 0.15 * Math.sin(time * 9));
    c.fillStyle = `hsl(${(hue * 3) % 360},100%,68%)`;
    circle(c, 0, 0, R);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    circle(c, -R * 0.3, -R * 0.3, R * 0.35);
  }

  function drawMushroom(c, S) {
    const R = S * 0.42;
    c.save();
    c.rotate(Math.sin(time * 3) * 0.2);
    c.fillStyle = '#ffe9c7';
    c.beginPath();
    c.roundRect(-R * 0.28, -R * 0.05, R * 0.56, R * 0.8, R * 0.2);
    c.fill();
    c.fillStyle = `hsl(${(hue + 330) % 360},100%,55%)`;
    c.beginPath();
    c.ellipse(0, 0, R, R * 0.8, 0, Math.PI, 0);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    circle(c, -R * 0.5, -R * 0.3, R * 0.14);
    circle(c, 0, -R * 0.55, R * 0.16);
    circle(c, R * 0.5, -R * 0.3, R * 0.14);
    c.restore();
  }

  function drawCrystal(c, S) {
    const R = S * 0.42;
    c.save();
    c.scale(Math.cos(time * 3) || 0.01, 1);
    c.beginPath();
    c.moveTo(0, -R);
    c.lineTo(R * 0.6, 0);
    c.lineTo(0, R);
    c.lineTo(-R * 0.6, 0);
    c.closePath();
    c.fillStyle = `hsl(${190 + 25 * Math.sin(time * 4)},100%,65%)`;
    c.fill();
    c.lineWidth = Math.max(1, S * 0.05);
    c.strokeStyle = '#fff';
    c.stroke();
    c.beginPath();
    c.moveTo(-R * 0.6, 0);
    c.lineTo(R * 0.6, 0);
    c.moveTo(0, -R);
    c.lineTo(0, R);
    c.stroke();
    c.restore();
  }

  function drawGhostItem(c, S) {
    const R = S * 0.36;
    c.save();
    c.translate(0, Math.sin(time * 4) * S * 0.06);
    c.fillStyle = `hsla(${(hue + 200) % 360},80%,92%,0.92)`;
    c.beginPath();
    c.moveTo(-R, R * 0.75);
    c.lineTo(-R, 0);
    c.arc(0, 0, R, Math.PI, 0);
    c.lineTo(R, R * 0.75);
    for (let k = 1; k <= 4; k++) {
      c.lineTo(R - (k * 2 * R) / 4, R * 0.75 - (k % 2 ? R * 0.25 : 0) + Math.sin(time * 10 + k) * R * 0.08);
    }
    c.closePath();
    c.fill();
    c.fillStyle = '#1a0033';
    c.beginPath();
    c.ellipse(-R * 0.35, -R * 0.1, R * 0.16, R * 0.24, 0, 0, TAU);
    c.ellipse(R * 0.35, -R * 0.1, R * 0.16, R * 0.24, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  function drawStar(c, S) {
    const R = S * 0.44, r = R * 0.45;
    c.save();
    c.rotate(time * 1.2);
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r : R;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = `hsl(${48 + 10 * Math.sin(time * 10)},100%,${60 + 10 * Math.sin(time * 7)}%)`;
    c.fill();
    c.lineWidth = Math.max(1, S * 0.05);
    c.strokeStyle = '#fff';
    c.stroke();
    c.restore();
  }

  function drawMoth(c, S) {
    const R = S * 0.42, flap = 0.35 + 0.65 * Math.abs(Math.sin(time * 14));
    const h = (hue + 90) % 360;
    for (const s of [-1, 1]) {
      c.save();
      c.scale(s * flap, 1);
      c.fillStyle = `hsla(${h},100%,60%,0.95)`;
      c.beginPath();
      c.ellipse(R * 0.45, -R * 0.25, R * 0.5, R * 0.38, -0.5, 0, TAU);
      c.fill();
      c.fillStyle = `hsla(${(h + 60) % 360},100%,65%,0.95)`;
      c.beginPath();
      c.ellipse(R * 0.35, R * 0.3, R * 0.32, R * 0.26, 0.6, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      circle(c, R * 0.5, -R * 0.3, R * 0.12);
      c.restore();
    }
    c.fillStyle = '#1a0a00';
    c.beginPath();
    c.ellipse(0, 0, R * 0.1, R * 0.45, 0, 0, TAU);
    c.fill();
  }

  function drawEye(c, S, look = time) {
    const R = S * 0.42;
    c.fillStyle = 'rgba(255,40,60,0.35)';
    circle(c, 0, 0, R * 1.2);
    const g = c.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.7, '#f3e6ea');
    g.addColorStop(1, '#d07080');
    c.fillStyle = g;
    circle(c, 0, 0, R);
    c.strokeStyle = 'rgba(200,0,30,0.7)';
    c.lineWidth = Math.max(1, S * 0.03);
    for (let k = 0; k < 5; k++) {
      const a = (k * TAU) / 5 + 0.3;
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
      c.lineTo(Math.cos(a + 0.2) * R * 0.6, Math.sin(a + 0.2) * R * 0.6);
      c.stroke();
    }
    const ix = Math.cos(look) * R * 0.35, iy = Math.sin(look) * R * 0.35;
    c.fillStyle = `hsl(${(hue + 120) % 360},100%,45%)`;
    circle(c, ix, iy, R * 0.45);
    c.fillStyle = '#000';
    circle(c, ix, iy, R * 0.22 * (1 + 0.2 * Math.sin(time * 7)));
    c.fillStyle = 'rgba(255,255,255,0.9)';
    circle(c, ix - R * 0.12, iy - R * 0.12, R * 0.08);
  }

  function drawSpike(c, S) {
    const R = S * 0.46, r = R * 0.45, n = 8;
    c.save();
    c.rotate(time * 6);
    c.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const a = (k * Math.PI) / n, rr = k % 2 ? r : R;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = `hsl(${(350 + 20 * Math.sin(time * 12) + 360) % 360},100%,55%)`;
    c.fill();
    c.strokeStyle = '#ffd0d0';
    c.lineWidth = Math.max(1, S * 0.04);
    c.stroke();
    c.fillStyle = '#200';
    circle(c, 0, 0, r * 0.6);
    c.restore();
  }

  function drawVoid(c, S, arm = 1) {
    if (arm < 1) {
      c.save();
      c.rotate(time * 4);
      c.setLineDash([S * 0.12, S * 0.1]);
      c.strokeStyle = `rgba(255,60,120,${0.5 + 0.5 * Math.sin(time * 25)})`;
      c.lineWidth = Math.max(1.5, S * 0.07);
      c.beginPath();
      c.arc(0, 0, S * 0.5 * (1.4 - 0.4 * arm), 0, TAU);
      c.stroke();
      c.restore();
      c.save();
      c.globalAlpha *= 0.4 + 0.5 * arm;
      c.scale(0.3 + 0.7 * arm, 0.3 + 0.7 * arm);
    }
    const R = S * 0.5;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.15);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, `hsla(${(hue + 270) % 360},100%,45%,0.95)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    circle(c, 0, 0, R * 1.15);
    c.save();
    c.rotate(-time * 3);
    c.strokeStyle = `hsla(${(hue + 300) % 360},100%,65%,0.85)`;
    c.lineWidth = Math.max(1, S * 0.05);
    for (let k = 0; k < 3; k++) {
      c.rotate(TAU / 3);
      c.beginPath();
      c.arc(R * 0.25, 0, R * 0.45, Math.PI * 0.9, Math.PI * 1.9);
      c.stroke();
    }
    c.restore();
    if (arm < 1) c.restore();
  }

  function drawGlitch(c, S) {
    const R = S * 0.36, j = () => (Math.random() - 0.5) * S * 0.12;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const [col, ox] of [['rgba(255,0,80,0.85)', -S * 0.06], ['rgba(0,255,200,0.85)', S * 0.06], ['rgba(80,80,255,0.85)', 0]]) {
      c.fillStyle = col;
      c.fillRect(-R + ox + j(), -R + j(), R * 2, R * 2);
    }
    c.restore();
    c.fillStyle = '#000';
    c.fillRect(-R * 0.55, -R * 0.22, R * 1.1, R * 0.44);
    c.fillStyle = '#fff';
    c.fillRect(-R * 0.12 + Math.sin(time * 20) * R * 0.3, -R * 0.14, R * 0.28, R * 0.28);
  }

  function drawPulsar(c, S) {
    const R = S * 0.45 * (1 + 0.15 * beat);
    c.save();
    c.rotate(time * 1.5);
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6;
      c.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    c.closePath();
    c.fillStyle = `hsl(${30 + 20 * Math.sin(time * 8)},100%,55%)`;
    c.fill();
    c.strokeStyle = '#fff3c0';
    c.lineWidth = Math.max(1, S * 0.05);
    c.stroke();
    c.restore();
    c.fillStyle = '#2a0010';
    circle(c, 0, 0, R * 0.45);
    c.fillStyle = `hsl(${(hue + 300) % 360},100%,70%)`;
    circle(c, 0, 0, R * 0.22 * (1 + 0.5 * beat));
  }

  function drawWormHead(c, x, y, ang, S) {
    c.fillStyle = '#3a0a50';
    circle(c, x, y, S * 0.42);
    c.strokeStyle = `hsl(${300 + 20 * Math.sin(time * 9)},100%,60%)`;
    c.lineWidth = Math.max(1, S * 0.06);
    c.beginPath();
    c.arc(x, y, S * 0.42, 0, TAU);
    c.stroke();
    const fx0 = Math.cos(ang), fy0 = Math.sin(ang), px0 = -fy0, py0 = fx0;
    c.fillStyle = '#ff2040';
    for (const s of [-1, 1]) circle(c, x + fx0 * S * 0.14 + px0 * S * 0.17 * s, y + fy0 * S * 0.14 + py0 * S * 0.17 * s, S * 0.09);
    c.strokeStyle = '#fff';
    c.lineWidth = Math.max(1, S * 0.05);
    c.beginPath();
    for (const s of [-1, 1]) {
      const x1 = x + fx0 * S * 0.32 + px0 * S * 0.11 * s, y1 = y + fy0 * S * 0.32 + py0 * S * 0.11 * s;
      c.moveTo(x1, y1);
      c.lineTo(x1 + fx0 * S * 0.18, y1 + fy0 * S * 0.18);
    }
    c.stroke();
  }

  function drawWormBody(c, pts, S) {
    for (let k = pts.length - 1; k >= 0; k--) {
      c.fillStyle = `hsl(${280 + k * 8},70%,${42 - k * 2}%)`;
      circle(c, pts[k].x, pts[k].y, S * (0.36 - k * 0.025));
      c.fillStyle = 'rgba(255,60,200,0.6)';
      circle(c, pts[k].x, pts[k].y, S * 0.07);
    }
  }

  // УПЫРЬ: a fat wobbling blob with too many eyes
  function drawGhoul(c, S) {
    const R = S * 0.85;
    c.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k * TAU) / 24, rr = R * (1 + 0.08 * Math.sin(a * 5 + time * 6) + 0.05 * Math.sin(a * 3 - time * 4));
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    const g = c.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#b6ff6a');
    g.addColorStop(0.6, '#3f8a2a');
    g.addColorStop(1, '#2a0a40');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = `hsla(${(hue + 100) % 360},100%,60%,0.8)`;
    c.lineWidth = Math.max(1.5, S * 0.06);
    c.stroke();
    for (const [ex, ey, er] of [[-0.35, -0.3, 0.2], [0.3, -0.35, 0.16], [0.02, -0.55, 0.12]]) {
      c.fillStyle = '#fff6c0';
      circle(c, ex * R, ey * R, er * R);
      c.fillStyle = '#c00010';
      circle(c, ex * R + Math.sin(time * 3) * er * R * 0.3, ey * R, er * R * 0.5);
    }
    c.fillStyle = '#1a0010';
    c.beginPath();
    c.ellipse(0, R * 0.3, R * 0.5, R * 0.22 * (1 + 0.3 * Math.abs(Math.sin(time * 5))), 0, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(k * R * 0.17 - R * 0.06, R * 0.16);
      c.lineTo(k * R * 0.17 + R * 0.06, R * 0.16);
      c.lineTo(k * R * 0.17, R * 0.34);
      c.fill();
    }
  }

  function drawWorm(c, S) {
    const pts = [];
    for (let k = 1; k <= 4; k++) pts.push({ x: S * 0.5 - k * S * 0.3, y: Math.sin(time * 6 - k) * S * 0.15 });
    drawWormBody(c, pts, S);
    drawWormHead(c, S * 0.5, Math.sin(time * 6) * S * 0.15, 0, S);
  }

  const SHAPES = {
    orb: drawOrb, crumb: drawCrumb, mushroom: drawMushroom, crystal: drawCrystal, ghost: drawGhostItem, star: drawStar,
    moth: drawMoth, eye: drawEye, spike: drawSpike, void: drawVoid, glitch: drawGlitch, pulsar: drawPulsar, worm: drawWorm, ghoul: drawGhoul,
    well: (c, S) => {
      for (let i = 0; i < 3; i++) {
        const a0 = time * (3 - i * 0.6) + i * 2;
        c.strokeStyle = `hsla(${(hue + 200 + i * 50) % 360},100%,62%,0.8)`;
        c.lineWidth = Math.max(1.5, S * 0.1);
        c.beginPath();
        c.arc(0, 0, S * (0.35 + i * 0.17), a0, a0 + Math.PI * 1.2);
        c.stroke();
      }
      c.fillStyle = '#000';
      circle(c, 0, 0, S * 0.25);
    },
  };

  // Draws a shape centered at (x, y); frac = remaining lifetime ring (0..1) or null; extra = shape-specific arg
  function drawShape(c, type, x, y, S, scale = 1, frac = null, extra) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    SHAPES[type](c, S, extra);
    if (frac != null) {
      c.strokeStyle = 'rgba(255,255,255,0.75)';
      c.lineWidth = Math.max(1.5, S * 0.06);
      c.beginPath();
      c.arc(0, 0, S * 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      c.stroke();
    }
    c.restore();
  }

  const spawnScale = born => {
    const age = gameTime - born;
    return age < 0.35 ? Math.max(0.01, easeOutBack(age / 0.35)) : 1;
  };

  // ---------- drawing: snake ----------
  function titleSnakePts() {
    const pts = [];
    for (let i = 0; i < 46; i++) {
      const u = time * 0.55 - i * 0.045;
      pts.push({
        x: W * 0.5 + Math.sin(u * 1.3) * W * 0.4 + Math.sin(u * 3.1) * W * 0.05,
        y: H * 0.5 + Math.sin(u * 2.1 + 1) * H * 0.36,
      });
    }
    return pts;
  }

  function drawHead(c, x, y, ang, r, alpha, big = 0, H0 = hue, angry = false) {
    const fxv = Math.cos(ang), fyv = Math.sin(ang);
    const pxv = -fyv, pyv = fxv;
    c.fillStyle = `hsla(${((H0 % 360) + 360) % 360},100%,62%,${alpha})`;
    if (big > 0.3) {
      // chomping pac-man maw, opening wider on the beat
      const m = (0.15 + 0.45 * Math.max(Math.abs(Math.sin(time * 12)), beat)) * Math.min(1, big * 1.4);
      c.beginPath();
      c.moveTo(x, y);
      c.arc(x, y, r, ang + m, ang - m + TAU);
      c.closePath();
      c.fill();
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      for (const s of [-1, 1]) {
        for (let k = 1; k <= 3; k++) {
          const a = ang + s * m, d0 = (r * k) / 3.6, d1 = (r * (k + 0.7)) / 3.6;
          c.beginPath();
          c.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0);
          c.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1);
          c.lineTo(x + Math.cos(a) * ((d0 + d1) / 2) + Math.cos(a - s * Math.PI / 2) * r * 0.13, y + Math.sin(a) * ((d0 + d1) / 2) + Math.sin(a - s * Math.PI / 2) * r * 0.13);
          c.fill();
        }
      }
    } else {
      circle(c, x, y, r);
    }
    if (big > 0.3) {
      // no tongue while chomping
    } else if (mouthOpen > 0) {
      c.fillStyle = `rgba(20,0,10,${alpha})`;
      circle(c, x + fxv * r * 0.6, y + fyv * r * 0.6, r * 0.38);
    } else if (time % 1.7 < 0.22) {
      const sx = x + fxv * r * 0.8, sy = y + fyv * r * 0.8;
      const ex = x + fxv * r * 1.9, ey = y + fyv * r * 1.9;
      c.strokeStyle = `rgba(255,40,90,${alpha})`;
      c.lineWidth = Math.max(1.5, r * 0.14);
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ex, ey);
      c.lineTo(ex + Math.cos(ang + 0.5) * r * 0.4, ey + Math.sin(ang + 0.5) * r * 0.4);
      c.moveTo(ex, ey);
      c.lineTo(ex + Math.cos(ang - 0.5) * r * 0.4, ey + Math.sin(ang - 0.5) * r * 0.4);
      c.stroke();
    }
    for (const s of [-1, 1]) {
      const ex = x + fxv * r * 0.3 + pxv * r * 0.48 * s;
      const ey = y + fyv * r * 0.3 + pyv * r * 0.48 * s;
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      circle(c, ex, ey, r * 0.34);
      c.fillStyle = angry ? `rgba(255,30,30,${alpha})` : `hsla(${(hue + 180) % 360},100%,50%,${alpha})`;
      circle(c, ex + fxv * r * 0.1, ey + fyv * r * 0.1, r * (0.2 + 0.08 * tripSmooth));
      c.fillStyle = `rgba(0,0,0,${alpha})`;
      circle(c, ex + fxv * r * 0.12, ey + fyv * r * 0.12, r * (0.1 + 0.08 * tripSmooth));
    }
  }

  // o: { w, alpha, head, off (hue index offset), gap (max px between joined points), dir, wrap: [bw, bh] }
  function drawSnake(c, pts, o) {
    const n = pts.length;
    if (!n) return;
    const alpha = o.alpha ?? 1, w0 = o.w, off = o.off || 0, gap = o.gap || Infinity, wrap = o.wrap;
    const total = n + off;
    const H0 = o.hue ?? hue;
    const hueStep = o.hueStep ?? 13 * (1 + tripSmooth * 1.5);
    c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = n - 1; i >= 1; i--) {
        const a = pts[i], b = pts[i - 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        let segs;
        if (Math.abs(dx) > gap || Math.abs(dy) > gap) {
          // segment crosses a portal: draw it on both sides, the board clip trims the overflow
          if (!wrap) continue;
          const ox = Math.abs(dx) > gap ? -Math.sign(dx) * wrap[0] : 0;
          const oy = Math.abs(dy) > gap ? -Math.sign(dy) * wrap[1] : 0;
          segs = [[a.x, a.y, b.x + ox, b.y + oy], [a.x - ox, a.y - oy, b.x, b.y]];
        } else {
          segs = [[a.x, a.y, b.x, b.y]];
        }
        const k = i + off;
        const h = (((H0 + k * hueStep) % 360) + 360) % 360;
        const w = w0 * (1 - (k / total) * 0.45) * (1 + 0.1 * Math.sin(time * 9 - k * 0.7)) * (1 + 0.2 * beat * Math.exp(-k * 0.08));
        if (pass === 0) {
          c.strokeStyle = `hsla(${h},100%,55%,${0.22 * alpha})`;
          c.lineWidth = w * 1.7;
        } else {
          c.strokeStyle = `hsla(${h},100%,${58 + 12 * Math.sin(k * 0.9 + time * 6)}%,${alpha})`;
          c.lineWidth = w;
        }
        for (const s of segs) {
          c.beginPath();
          c.moveTo(s[0], s[1]);
          c.lineTo(s[2], s[3]);
          c.stroke();
        }
      }
    }
    for (let i = 2; i < n; i += 2) {
      const p = pts[i], k = i + off;
      c.fillStyle = `hsla(${(((H0 + 180 + k * hueStep) % 360) + 360) % 360},100%,75%,${0.85 * alpha})`;
      circle(c, p.x, p.y, w0 * 0.13 * (1 - (k / total) * 0.4));
    }
    if (o.head === false) return;

    const hd = pts[0], p1 = pts[1];
    let ang;
    if (p1 && Math.abs(p1.x - hd.x) <= gap && Math.abs(p1.y - hd.y) <= gap && (p1.x !== hd.x || p1.y !== hd.y)) {
      ang = Math.atan2(hd.y - p1.y, hd.x - p1.x);
    } else {
      ang = Math.atan2(o.dir ? o.dir.y : 0, o.dir ? o.dir.x : 1);
    }
    const big = o.big || 0;
    const r = w0 * 0.62 * (1 + 0.12 * beat) * (1 + 1.6 * big);
    const offs = [[0, 0]];
    if (wrap) {
      if (hd.x - bx < r) offs.push([bw, 0]); else if (bx + bw - hd.x < r) offs.push([-bw, 0]);
      if (hd.y - by < r) offs.push([0, bh]); else if (by + bh - hd.y < r) offs.push([0, -bh]);
    }
    if (o.charged) {
      c.save();
      c.translate(hd.x, hd.y);
      c.rotate(time * 3);
      c.lineCap = 'round';
      c.lineWidth = 2;
      for (let k = 0; k < 12; k++) {
        const a = (k * TAU) / 12, l = r * (1.6 + 0.4 * Math.sin(time * 14 + k * 2));
        c.strokeStyle = `hsla(${(45 + k * 30) % 360},100%,65%,0.8)`;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
        c.lineTo(Math.cos(a) * l, Math.sin(a) * l);
        c.stroke();
      }
      c.restore();
    }
    for (const [ox, oy] of offs) drawHead(c, hd.x + ox, hd.y + oy, ang, r, alpha, big, H0, o.angry);
    if (o.shield) {
      c.strokeStyle = `hsla(${(hue + 180) % 360},100%,75%,0.8)`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(hd.x, hd.y, r * (1.8 + 0.15 * Math.sin(time * 12)), 0, TAU);
      c.stroke();
    }
  }

  // ---------- render: game layer ----------
  function drawStars(c) {
    const sk = state === 'title' ? 0.3 : speedK();
    const n = Math.round(25 + sk * 85);
    const R = Math.hypot(W, H) / 2, ox = W / 2, oy = H / 2;
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = stars[i];
      const r0 = s.d * s.d * R, len = (6 + sk * 70) * s.d;
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      c.strokeStyle = `hsla(${(hue + s.a * 57) % 360},100%,72%,${Math.min(1, s.d * 3) * (0.25 + 0.5 * sk)})`;
      c.lineWidth = 1 + 2 * s.d;
      c.beginPath();
      c.moveTo(ox + ca * r0, oy + sa * r0);
      c.lineTo(ox + ca * (r0 + len), oy + sa * (r0 + len));
      c.stroke();
    }
  }

  function renderFX(sx, sy, zoom) {
    const c = fctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, fx.width, fx.height);
    c.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    const zx = state === 'title' ? W / 2 : bx + bw / 2, zy = state === 'title' ? H / 2 : by + bh / 2;
    c.translate(zx, zy);
    c.scale(zoom[0], zoom[1]);
    c.translate(-zx, -zy);
    if (!hasGL) {
      c.fillStyle = `hsl(${hue},60%,6%)`;
      c.fillRect(-50, -50, W + 100, H + 100);
    }

    if (state === 'title') {
      drawStars(c);
      drawSnake(c, titlePts, { w: Math.min(W, H) * 0.035 });
    } else {
      c.save();
      c.beginPath();
      c.rect(-50, -50, W + 100, H + 100);
      c.rect(bx, by, bw, bh);
      c.clip('evenodd');
      drawStars(c);
      c.restore();

      c.save();
      c.beginPath();
      c.rect(bx, by, bw, bh);
      c.clip();
      if (zone) {
        const k = 1 - zone.beatsLeft / zone.total;
        const [zx, zy, zw, zh] = zoneRect(zone);
        c.save();
        c.beginPath();
        c.rect(zx, zy, zw, zh);
        c.clip();
        c.fillStyle = `rgba(255,${Math.round(40 - 40 * k)},${Math.round(80 - 60 * k)},${0.12 + 0.25 * k + 0.15 * beat})`;
        c.fillRect(zx, zy, zw, zh);
        c.strokeStyle = `rgba(255,220,0,${0.2 + 0.35 * k})`;
        c.lineWidth = cell * 0.35;
        const off = (time * 60) % (cell * 2);
        for (let x = zx - zh - cell * 2 + off; x < zx + zw; x += cell * 2) {
          c.beginPath();
          c.moveTo(x, zy + zh);
          c.lineTo(x + zh, zy);
          c.stroke();
        }
        c.restore();
      }
      if (zoneFlash) {
        const [zx, zy, zw, zh] = zoneRect(zoneFlash);
        c.fillStyle = `rgba(255,250,235,${zoneFlash.t / 0.6})`;
        c.fillRect(zx, zy, zw, zh);
      }
      if (ouroT > 0 && ouroPoly) {
        c.beginPath();
        ouroPoly.forEach((p, i) => (i ? c.lineTo(ux(p.x), uy(p.y)) : c.moveTo(ux(p.x), uy(p.y))));
        c.closePath();
        c.fillStyle = `hsla(${(hue + 60) % 360},100%,60%,${ouroT * 0.6})`;
        c.fill('evenodd');
      }
      for (const v of voids) drawShape(c, 'void', cx(v.x), cy(v.y), cell, spawnScale(v.born), null, voidArm(v));
      for (const it of items) {
        const left = it.life - (gameTime - it.born);
        const timed = Number.isFinite(it.life);
        c.globalAlpha = timed && left < 2 && Math.floor(time * 10) % 2 === 0 ? 0.35 : 1;
        drawShape(c, it.type, cx(it.x), cy(it.y), cell, spawnScale(it.born), timed && it.type !== 'crumb' ? clamp(left / it.life, 0, 1) : null);
      }
      c.globalAlpha = 1;
      for (const p of pickups) drawShape(c, p.type, ux(p.x), uy(p.y), cell, 0.85);
      const head = curCells[0];
      for (const f of fliers) {
        const age = gameTime - f.born, F = FLIER[f.kind];
        c.globalAlpha = age < 0.7 ? 0.3 + 0.4 * (Math.floor(time * 12) % 2) : clamp((F.life - age) / 0.5, 0, 1);
        const look = head ? Math.atan2(head.y - f.y, head.x - f.x) : time;
        if (f.kind === 'worm') {
          drawWormBody(c, f.trail.map(s => ({ x: ux(s.x), y: uy(s.y) })), cell);
          drawWormHead(c, ux(f.x), uy(f.y), Math.atan2(f.vy, f.vx), cell);
        } else {
          drawShape(c, f.kind, ux(f.x), uy(f.y), cell, 1, null, look);
        }
        if (F.hp > 1 && F.bad) {
          // hp bar over anything that takes more than one hit
          const bw0 = cell * Math.max(0.9, F.r * 2), bx0 = ux(f.x) - bw0 / 2, by0 = uy(f.y) - cell * (F.r + 0.45);
          c.fillStyle = 'rgba(0,0,0,0.6)';
          c.fillRect(bx0 - 1, by0 - 1, bw0 + 2, 6);
          c.fillStyle = `hsl(${120 * clamp(f.hp / F.hp, 0, 1)},100%,50%)`;
          c.fillRect(bx0, by0, bw0 * clamp(f.hp / F.hp, 0, 1), 4);
        }
        if (f.kind === 'glitch') {
          c.save();
          c.setLineDash([4, 4]);
          c.strokeStyle = `rgba(255,0,140,${0.4 + 0.4 * Math.sin(time * 20)})`;
          c.lineWidth = 2;
          c.strokeRect(ux(f.tx) - cell * 0.4, uy(f.ty) - cell * 0.4, cell * 0.8, cell * 0.8);
          c.restore();
        }
        if (f.kind === 'pulsar' && f.ringAge != null) {
          const k = f.ringAge / f.beatSec;
          c.strokeStyle = `hsla(${30 + 30 * k},100%,60%,${clamp(1.2 - k, 0, 1)})`;
          c.lineWidth = cell * 0.3;
          c.beginPath();
          c.arc(ux(f.x), uy(f.y), k * 4 * cell, 0, TAU);
          c.stroke();
        }
        if (f.hit > 0) {
          c.fillStyle = 'rgba(255,255,255,0.8)';
          circle(c, ux(f.x), uy(f.y), cell * F.r);
        }
      }
      c.globalAlpha = 1;

      for (const w of wells) {
        const k = clamp(Math.min((gameTime - w.born) / 0.6, (w.life - (gameTime - w.born)) / 0.8), 0, 1);
        const x = ux(w.x), y = uy(w.y);
        c.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const sp = 3 - i * 0.5, a0 = time * sp + i * 1.7;
          c.strokeStyle = `hsla(${(hue + 200 + i * 40) % 360},100%,62%,${0.65 * k})`;
          c.lineWidth = cell * 0.12;
          c.beginPath();
          c.arc(x, y, cell * (0.6 + i * 0.38) * k, a0, a0 + Math.PI * 1.2);
          c.stroke();
        }
        for (let i = 0; i < 12; i++) {
          const a = (i * TAU) / 12 + time * 0.5, d = (time * 1.4 + i * 0.37) % 1, r0 = cell * 2.6 * (1 - d) * k;
          c.strokeStyle = `rgba(255,255,255,${0.5 * d * k})`;
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
          c.lineTo(x + Math.cos(a + 0.3) * r0 * 0.7, y + Math.sin(a + 0.3) * r0 * 0.7);
          c.stroke();
        }
        c.fillStyle = '#000';
        circle(c, x, y, cell * 0.45 * k);
        c.strokeStyle = `hsla(${(hue + 40) % 360},100%,75%,${k})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, cell * 0.47 * k, 0, TAU);
        c.stroke();
      }

      if (boss && state !== 'over') {
        drawSnake(c, boss.cells.map(p => ({ x: ux(p.x), y: uy(p.y) })), {
          w: cell * 0.8, gap: cell * 1.5, dir: boss.dir, wrap: [bw, bh],
          hue: 345 + 15 * Math.sin(time * 6), hueStep: 2.5, angry: true,
        });
      }
      c.globalCompositeOperation = 'lighter';
      for (const b of bossBullets) {
        c.fillStyle = 'rgba(255,40,40,0.9)';
        circle(c, ux(b.x), uy(b.y), cell * 0.2);
        c.fillStyle = 'rgba(255,230,200,0.95)';
        circle(c, ux(b.x), uy(b.y), cell * 0.09);
      }
      if (beam) {
        const k = beam.t / 0.5;
        c.strokeStyle = beam.hit ? `hsla(${(hue + 40) % 360},100%,75%,${k})` : `rgba(160,160,180,${k})`;
        c.lineWidth = cell * 0.5 * k;
        c.beginPath();
        c.moveTo(ux(beam.x0), uy(beam.y0));
        c.lineTo(ux(beam.x1), uy(beam.y1));
        c.stroke();
        c.strokeStyle = `rgba(255,255,255,${k})`;
        c.lineWidth = cell * 0.15 * k;
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';

      if (state !== 'over') {
        const pts = curCells.map(p => ({ x: ux(p.x), y: uy(p.y) }));
        const exploding = state === 'dying' || state === 'respawn';
        let alpha = 1;
        if (power.ghost > 0) alpha = power.ghost < 1.5 && Math.floor(time * 10) % 2 === 0 ? 0.25 : 0.65;
        if (shield > 0) alpha = Math.floor(time * 14) % 2 === 0 ? 0.4 : 1;
        drawSnake(c, exploding ? pts.slice(exploded) : pts, {
          w: cell * 0.8,
          alpha,
          head: !exploding,
          off: exploding ? exploded : 0,
          gap: cell * 1.5,
          dir,
          wrap: [bw, bh],
          shield: shield > 0,
          charged: state === 'play' && superCharge >= 1,
          big: bigK,
        });
      }

      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (const b of bullets) {
        const x = ux(b.x), y = uy(b.y), tx = x - b.vx * cell * 0.025, ty = y - b.vy * cell * 0.025;
        c.strokeStyle = `hsla(${(b.h + time * 400) % 360},100%,60%,0.9)`;
        c.lineWidth = cell * 0.28;
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(x, y);
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.95)';
        c.lineWidth = cell * 0.1;
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
    }

    c.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      c.strokeStyle = `hsla(${((r.h % 360) + 360) % 360},100%,65%,${clamp(r.life / r.max, 0, 1)})`;
      c.lineWidth = r.w;
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, TAU);
      c.stroke();
    }
    for (const p of particles) {
      c.fillStyle = `hsla(${((p.h % 360) + 360) % 360},100%,62%,${clamp(p.life / p.max, 0, 1)})`;
      circle(c, p.x, p.y, p.size);
    }
    c.globalCompositeOperation = 'source-over';

    if (!hasGL && flash > 0) {
      c.fillStyle = `rgba(255,240,255,${flash * 0.6})`;
      c.fillRect(-50, -50, W + 100, H + 100);
    }
  }

  // ---------- render: UI layer ----------
  function label(c, text, x, y, font, fill, align = 'center', glow = null) {
    c.font = font;
    c.textAlign = align;
    c.lineJoin = 'round';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(0,0,0,0.8)';
    c.strokeText(text, x, y);
    if (glow) {
      c.shadowColor = glow;
      c.shadowBlur = 14 * dpr;
    }
    c.fillStyle = fill;
    c.fillText(text, x, y);
    c.shadowBlur = 0;
  }

  function textW(c, text, font) {
    c.font = font;
    return c.measureText(text).width;
  }

  function drawBorder(c) {
    const g = c.createLinearGradient(bx, by, bx + bw, by + bh);
    for (let k = 0; k <= 6; k++) g.addColorStop(k / 6, `hsl(${(hue + k * 60) % 360},100%,60%)`);
    c.save();
    c.strokeStyle = g;
    c.lineWidth = 3;
    c.setLineDash([14, 10]);
    c.lineDashOffset = -time * (40 + speed * 25);
    c.shadowColor = `hsl(${hue},100%,60%)`;
    c.shadowBlur = 16 * dpr;
    c.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
    c.restore();
  }

  function drawHUD(c) {
    const scoreTxt = String(Math.round(shownScore));
    label(c, 'СЧЁТ', bx, 18, `700 12px ${FONT}`, 'rgba(255,255,255,0.75)', 'left');
    label(c, scoreTxt, bx, 44, `900 30px ${FONT_HEAVY}`, `hsl(${hue},100%,78%)`, 'left', `hsl(${hue},100%,60%)`);
    if (combo >= 2) {
      const x = bx + textW(c, scoreTxt, `900 30px ${FONT_HEAVY}`) + 14;
      const ch = (hue + 120) % 360;
      label(c, `x${combo}`, x, 42, `900 ${20 + Math.min(combo, 8) * 1.5}px ${FONT_HEAVY}`, `hsl(${ch},100%,70%)`, 'left');
      c.fillStyle = `hsl(${ch},100%,60%)`;
      c.fillRect(x, 58, 56 * clamp(comboTimer / 3, 0, 1), 3);
    }

    label(c, `УРОВЕНЬ ${level}`, W / 2, 18, `700 12px ${FONT}`, 'rgba(255,255,255,0.75)');
    if (toast) {
      c.globalAlpha = clamp(toast.life / 0.4, 0, 1);
      label(c, toast.text, W / 2, 42, `900 19px ${FONT_HEAVY}`, `hsl(${toast.h},100%,75%)`, 'center', `hsl(${toast.h},100%,55%)`);
      c.globalAlpha = 1;
    } else {
      label(c, LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], W / 2, 42, `800 19px ${FONT}`, `hsl(${(hue + 60) % 360},100%,75%)`);
    }

    // groove meter: 8 diamonds under the level name
    for (let i = 0; i < 8; i++) {
      const gx = W / 2 + (i - 3.5) * 13, gy = 60, on = fever > 0 ? Math.floor(time * 10 + i) % 2 === 0 : i < Math.floor(groove);
      c.fillStyle = on ? `hsl(${(45 + i * 20 + (fever > 0 ? hue : 0)) % 360},100%,62%)` : 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.moveTo(gx, gy - 4);
      c.lineTo(gx + 4, gy);
      c.lineTo(gx, gy + 4);
      c.lineTo(gx - 4, gy);
      c.fill();
    }

    label(c, 'РЕКОРД', bx + bw, 18, `700 12px ${FONT}`, 'rgba(255,255,255,0.75)', 'right');
    label(c, String(best), bx + bw, 44, `900 30px ${FONT_HEAVY}`, '#fff', 'right');

    // bottom bar: lives · speed meter · power-ups ··· hints
    const yb = by + bh + 22;
    let x = bx;
    const lv = Number.isFinite(lives) ? (lives <= 5 ? '♥'.repeat(Math.max(0, lives)) : `♥ x${lives}`) : '♥ ∞';
    const lvFont = `900 17px ${FONT}`;
    label(c, lv || '—', x, yb, lvFont, `hsl(${340 + 10 * Math.sin(time * 6)},100%,65%)`, 'left');
    x += textW(c, lv || '—', lvFont) + 16;

    const sh = speedHue(speed);
    for (let i = 0; i < 9; i++) {
      const on = i < speed;
      c.fillStyle = on ? `hsl(${speedHue(i + 1)},100%,${i === speed - 1 ? 60 + 15 * Math.sin(time * 12) : 55}%)` : 'rgba(255,255,255,0.15)';
      const h = 6 + i * 1.6;
      c.fillRect(x + i * 7, yb + 7 - h, 5, h);
    }
    x += 70;
    const spTxt = `x${speed} ${SPEED_NAMES[speed - 1]}`;
    label(c, spTxt, x, yb, `800 12px ${FONT}`, `hsl(${sh},100%,75%)`, 'left');
    x += textW(c, spTxt, `800 12px ${FONT}`) + 16;

    {
      const w = 118, ph = 20, ready = superCharge >= 1;
      c.fillStyle = 'rgba(255,200,40,0.2)';
      c.beginPath();
      c.roundRect(x, yb - ph / 2, w, ph, ph / 2);
      c.fill();
      const fw = w * superCharge;
      if (fw > 2) {
        c.fillStyle = ready ? `hsla(${45 + 15 * Math.sin(time * 10)},100%,${55 + 10 * Math.sin(time * 10)}%,0.95)` : 'hsla(45,100%,50%,0.6)';
        c.beginPath();
        c.roundRect(x, yb - ph / 2, fw, ph, Math.min(ph / 2, fw / 2));
        c.fill();
      }
      label(c, ready ? 'SHIFT · ЗАРЯД!' : `ЗАРЯД ${Math.floor(superCharge * 100)}%`, x + w / 2, yb + 1, `800 11px ${FONT}`, '#fff');
      x += w + 10;
    }
    {
      const w = 104, ph = 20, ready = aimCharge >= 1;
      c.fillStyle = 'rgba(120,255,220,0.18)';
      c.beginPath();
      c.roundRect(x, yb - ph / 2, w, ph, ph / 2);
      c.fill();
      const fw = w * aimCharge;
      if (fw > 2) {
        c.fillStyle = ready ? `hsla(${160 + 20 * Math.sin(time * 10)},100%,45%,0.95)` : 'hsla(165,100%,40%,0.6)';
        c.beginPath();
        c.roundRect(x, yb - ph / 2, fw, ph, Math.min(ph / 2, fw / 2));
        c.fill();
      }
      label(c, ready ? 'Q · ПРИЦЕЛ' : `ПРИЦЕЛ ${Math.floor(aimCharge * 100)}%`, x + w / 2, yb + 1, `800 11px ${FONT}`, '#fff');
      x += w + 10;
    }

    const pills = [];
    if (dropT > 0) pills.push(['ДРОП x2', dropT, DROP_DUR, (hue + 30) % 360]);
    if (fever > 0) pills.push(['ГРУВ x2', fever, FEVER_DUR, 50]);
    for (const k of ['big', 'trip', 'slow', 'ghost']) if (power[k] > 0) pills.push([POWER_INFO[k].name, power[k], POWER_DUR[k], POWER_INFO[k].h]);
    if (shield > 0) pills.push(['ЩИТ', shield, 2.5, 180]);
    for (const [name, left, dur, h] of pills) {
      const w = 104, ph = 20;
      c.fillStyle = `hsla(${h},100%,50%,0.25)`;
      c.beginPath();
      c.roundRect(x, yb - ph / 2, w, ph, ph / 2);
      c.fill();
      const fw = (w * left) / dur;
      if (fw > 2) {
        c.fillStyle = `hsla(${h},100%,55%,0.85)`;
        c.beginPath();
        c.roundRect(x, yb - ph / 2, fw, ph, Math.min(ph / 2, fw / 2));
        c.fill();
      }
      label(c, `${name} ${left.toFixed(1)}`, x + w / 2, yb + 1, `800 11px ${FONT}`, '#fff');
      x += w + 6;
    }

    const np = nowPlaying();
    const hint = np || `ПРОБЕЛ огонь · R тройной · SHIFT заряд · 1-9 скорость · T свой трек · M звук${AudioFX.isMuted() ? ' (выкл)' : ''} · P пауза`;
    const hf = np ? `800 13px ${FONT}` : `600 12px ${FONT}`;
    if (x + textW(c, hint, hf) < bx + bw - 8) label(c, hint, bx + bw, yb, hf, np ? `hsl(${(hue + 150) % 360},100%,75%)` : 'rgba(255,255,255,0.6)', 'right');
  }

  function drawMega(c) {
    if (!mega) return;
    const t = 1 - mega.life / mega.max;
    const s = t < 0.12 ? Math.max(0.01, easeOutBack(t / 0.12)) : 1 + 0.03 * Math.sin(time * 20);
    const size = Math.min(bw / (mega.text.length * 0.7), 150);
    const font = `900 ${Math.round(size)}px ${FONT_HEAVY}`;
    c.save();
    c.globalAlpha = clamp(mega.life / 0.5, 0, 1);
    c.translate(bx + bw / 2, by + bh * 0.42);
    c.scale(s, s);
    c.font = font;
    const chars = [...mega.text], widths = chars.map(ch => c.measureText(ch).width);
    let x = -widths.reduce((a, b) => a + b, 0) / 2;
    chars.forEach((ch, i) => {
      const h = (hue + i * 40) % 360;
      label(c, ch, x + widths[i] / 2, Math.sin(time * 8 + i * 0.6) * size * 0.08, font, `hsl(${h},100%,65%)`, 'center', `hsl(${h},100%,55%)`);
      x += widths[i];
    });
    if (mega.sub) label(c, mega.sub, 0, size * 0.75, `900 ${Math.round(Math.max(16, size * 0.18))}px ${FONT}`, '#fff');
    c.restore();
  }

  function drawAim(c) {
    if (!aim) return;
    const px = cx(aim.x), py = cy(aim.y), R = cell * 3.2;
    const locked = aimHits(aim);
    c.save();
    c.fillStyle = 'rgba(0,0,12,0.72)';
    c.beginPath();
    c.rect(0, 0, W, H);
    c.arc(px, py, R, 0, TAU);
    c.fill('evenodd');
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(px, py, R, 0, TAU);
    c.stroke();
    c.strokeStyle = 'hsl(0,100%,60%)';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(px, py, R + 7, -Math.PI / 2, -Math.PI / 2 + TAU * (aim.t / AIM_TIME));
    c.stroke();
    c.strokeStyle = locked ? 'rgba(255,60,80,0.9)' : 'rgba(140,255,210,0.9)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      c.moveTo(px + dx * cell * 0.7, py + dy * cell * 0.7);
      c.lineTo(px + dx * R, py + dy * R);
    }
    c.stroke();
    c.translate(px, py);
    c.rotate(time * (locked ? 6 : 1.5));
    c.lineWidth = 3;
    const s = cell * (0.75 + (locked ? 0.1 * Math.sin(time * 30) : 0));
    for (let k = 0; k < 4; k++) {
      c.rotate(Math.PI / 2);
      c.beginPath();
      c.moveTo(s, s * 0.45);
      c.lineTo(s, s);
      c.lineTo(s * 0.45, s);
      c.stroke();
    }
    c.restore();
    label(c, locked ? 'ЗАХВАТ! Q / ПРОБЕЛ / КЛИК — ОГОНЬ' : 'НАВЕДИ НА ВРАГА: СТРЕЛКИ ИЛИ МЫШЬ · МИМО = ВРАГОВ x2',
      px, py + R + 28, `900 16px ${FONT_HEAVY}`, locked ? '#ff5070' : '#9fffe0');
  }

  function drawBossBar(c) {
    if (!boss) return;
    const w = Math.min(360, bw * 0.5), x = W / 2 - w / 2, y = by + 14;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(x - 4, y - 4, w + 8, 16);
    c.fillStyle = `hsl(${350 + 10 * Math.sin(time * 8)},100%,55%)`;
    c.fillRect(x, y, w * clamp(boss.life / BOSS_LIFE, 0, 1), 8);
    label(c, `БОСС · АНТИ-ЗМЕЙ · ДЛИНА ${boss.segs.length} · В ГОЛОВУ!`, W / 2, y + 24, `900 13px ${FONT_HEAVY}`, '#ff8090');
  }

  function drawZoneCountdown(c) {
    if (!zone) return;
    const [zx, zy, zw, zh] = zoneRect(zone);
    const k = 1 - zone.beatsLeft / zone.total;
    label(c, String(zone.beatsLeft), zx + zw / 2, zy + zh / 2 - 10, `900 ${Math.round(60 + 30 * beat)}px ${FONT_HEAVY}`, `hsl(${50 - 50 * k},100%,62%)`, 'center', '#ff2040');
    label(c, 'АННИГИЛЯЦИЯ', zx + zw / 2, zy + zh / 2 + 40, `900 18px ${FONT_HEAVY}`, '#fff');
  }

  function nowPlaying() {
    const tr = Tracks.current();
    if (!tr) return '';
    const name = tr.name.length > 32 ? tr.name.slice(0, 31) + '…' : tr.name;
    return `♪ ${name} · ${Math.round(tr.bpm)} BPM`;
  }

  function drawPopups(c) {
    for (const p of popups) {
      c.globalAlpha = clamp((p.life / p.max) * 1.5, 0, 1);
      label(c, p.text, p.x, p.y, `900 ${p.size}px ${FONT_HEAVY}`, `hsl(${((p.h % 360) + 360) % 360},100%,75%)`);
      if (p.sub) label(c, p.sub, p.x, p.y + p.size * 0.9, `800 ${Math.round(p.size * 0.7)}px ${FONT}`, '#fff');
    }
    c.globalAlpha = 1;
  }

  function drawBanner(c) {
    if (!banner) return;
    const t = 1 - banner.life / banner.max;
    const s = t < 0.15 ? Math.max(0.01, easeOutBack(t / 0.15)) : 1;
    const size = Math.min(60, bw / 11);
    c.save();
    c.globalAlpha = 0.75 * clamp(Math.min(banner.life / 0.5, t / 0.05), 0, 1);
    c.translate(bx + bw / 2, by + bh * 0.2);
    c.scale(s, s);
    label(c, banner.title, 0, 0, `900 ${size}px ${FONT_HEAVY}`, `hsl(${hue},100%,75%)`, 'center', `hsl(${hue},100%,60%)`);
    label(c, banner.sub, 0, size * 0.8, `800 ${Math.round(Math.min(22, bw / 30))}px ${FONT}`, '#fff');
    c.restore();
  }

  function drawChip(c, key, text, x, y, h) {
    const kf = `900 13px ${FONT_HEAVY}`, tf = `800 14px ${FONT}`;
    const kw = textW(c, key, kf) + 14, tw = textW(c, text, tf);
    const w = kw + tw + 18;
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.beginPath();
    c.roundRect(x, y - 15, w, 30, 15);
    c.fill();
    c.strokeStyle = `hsla(${h},100%,65%,0.8)`;
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = `hsl(${h},100%,65%)`;
    c.beginPath();
    c.roundRect(x + 4, y - 11, kw, 22, 11);
    c.fill();
    c.font = kf;
    c.textAlign = 'center';
    c.fillStyle = '#000';
    c.fillText(key, x + 4 + kw / 2, y + 1);
    c.font = tf;
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(text, x + kw + 11, y + 1);
    return w;
  }

  function drawSettings(c, y) {
    const chips = [
      ['1-9', `СКОРОСТЬ ${speed} · ${SPEED_NAMES[speed - 1]} · очки x${speed}`, speedHue(speed)],
      ['L', `ЖИЗНИ: ${livesLabel(LIVES_OPTS[livesIdx])}`, 340],
      ['V', `ТРИП: ${TRIP[tripLevel].name}`, 300],
    ];
    const kf = `900 13px ${FONT_HEAVY}`, tf = `800 14px ${FONT}`;
    const widths = chips.map(([k, t]) => textW(c, k, kf) + 14 + textW(c, t, tf) + 18);
    let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + 12 * (chips.length - 1)) / 2;
    chips.forEach(([k, t, h], i) => { drawChip(c, k, t, x, y, h); x += widths[i] + 12; });
  }

  function drawTitle(c) {
    const size = Math.min(W / 6.5, H / 5.5, 140);
    const txt = 'VIBESNAKE';
    c.font = `900 ${size}px ${FONT_HEAVY}`;
    const widths = [...txt].map(ch => c.measureText(ch).width);
    let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    const y0 = H * 0.17;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      c.save();
      c.translate(x + widths[i] / 2, y0 + Math.sin(time * 3 + i * 0.7) * size * 0.08);
      c.rotate(Math.sin(time * 2 + i) * 0.08);
      c.scale(1 + 0.06 * Math.sin(time * 5 + i), 1 + 0.06 * Math.cos(time * 5 + i));
      c.font = `900 ${size}px ${FONT_HEAVY}`;
      c.textAlign = 'center';
      const off = 3 + 4 * intensity;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,0,80,0.8)';
      c.fillText(ch, -off, 0);
      c.fillStyle = 'rgba(0,200,255,0.8)';
      c.fillText(ch, off, 0);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `hsl(${(hue + i * 35) % 360},100%,65%)`;
      c.fillText(ch, 0, 0);
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.strokeText(ch, 0, 0);
      c.restore();
      x += widths[i];
    }

    label(c, 'ПСИХОДЕЛИЧЕСКАЯ ЗМЕЙКА', W / 2, y0 + size * 0.68, `800 ${Math.round(size * 0.17)}px ${FONT}`, `hsl(${(hue + 180) % 360},100%,80%)`);
    if (Math.sin(time * 5) > -0.4) {
      label(c, 'ENTER / ПРОБЕЛ — НАЧАТЬ ТРИП', W / 2, H * 0.39, `900 ${Math.round(Math.min(28, W / 32))}px ${FONT_HEAVY}`, '#fff', 'center', `hsl(${hue},100%,60%)`);
    }

    LEGEND.forEach((row, ri) => {
      const colW = Math.min(150, (W * 0.94) / row.length);
      const ly = H * (0.465 + ri * 0.115);
      const S = Math.min(30, colW * 0.28, H * 0.045);
      row.forEach(([type, name, desc], i) => {
        const lx = W / 2 + (i - (row.length - 1) / 2) * colW;
        drawShape(c, type, lx, ly, S);
        label(c, name, lx, ly + S * 0.95, `800 13px ${FONT}`, ri ? `hsl(${350 + 10 * Math.sin(time * 4)},100%,75%)` : '#fff');
        label(c, desc, lx, ly + S * 0.95 + 16, `600 11px ${FONT}`, 'rgba(255,255,255,0.8)');
      });
    });

    drawSettings(c, H * 0.69);

    label(c, 'Стрелки / WASD — рулить  ·  ПРОБЕЛ — огонь  ·  R — тройной  ·  SHIFT / E — сверхзаряд (10 с)  ·  Q — прицел: мимо — врагов x2',
      W / 2, H * 0.78, `600 14px ${FONT}`, 'rgba(255,255,255,0.9)');
    label(c, 'Каждый 2-й дроп — БОСС: кто первым попадёт в голову  ·  укуси себя за хвост — УРОБОРОС  ·  в долю — ГРУВ  ·  светится половина — вали',
      W / 2, H * 0.83, `600 13px ${FONT}`, `hsl(${(hue + 90) % 360},100%,80%)`);
    const np = nowPlaying();
    label(c, np ? `${np}  ·  N — следующий  ·  B — встроенный бит  ·  Del — убрать` : 'T — добавь свой трек (или кинь файл в окно): змея пойдёт в долю, визуал — под бит',
      W / 2, H * 0.875, `800 14px ${FONT}`, `hsl(${(hue + 150) % 360},100%,78%)`);
    if (best > 0) label(c, `РЕКОРД: ${best}`, W / 2, H * 0.93, `900 20px ${FONT_HEAVY}`, `hsl(${(hue + 40) % 360},100%,75%)`);
    label(c, 'Сквозь себя можно, края — порталы  ·  P — пауза, ESC — меню  ·  M — звук  ·  F11 — фуллскрин  ·  ⚠ много мигания: V → ЧИЛЛ', W / 2, H * 0.975, `600 11px ${FONT}`, 'rgba(255,255,255,0.6)');
  }

  function drawPaused(c) {
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(bx, by, bw, bh);
    label(c, 'ПАУЗА', W / 2, by + bh / 2 - 20, `900 ${Math.round(Math.min(64, bw / 10))}px ${FONT_HEAVY}`, `hsl(${hue},100%,75%)`, 'center', `hsl(${hue},100%,60%)`);
    label(c, 'P / ENTER — ПРОДОЛЖИТЬ  ·  1-9 — скорость', W / 2, by + bh / 2 + 36, `700 18px ${FONT}`, '#fff');
    label(c, 'ESC — ВЫЙТИ В ГЛАВНОЕ МЕНЮ', W / 2, by + bh / 2 + 70, `900 18px ${FONT_HEAVY}`, `hsl(${(hue + 180) % 360},100%,75%)`);
  }

  function drawCountdown(c) {
    const n = Math.max(1, Math.ceil(countT / 0.3));
    const f = (countT % 0.3) / 0.3;
    label(c, String(n), W / 2, by + bh / 2, `900 ${Math.round(80 + 40 * f)}px ${FONT_HEAVY}`, `hsl(${hue},100%,75%)`, 'center', `hsl(${hue},100%,60%)`);
  }

  function drawOver(c) {
    const t = time - overAt;
    c.fillStyle = `rgba(0,0,0,${Math.min(0.6, t * 1.5)})`;
    c.fillRect(bx, by, bw, bh);
    const size = Math.round(Math.min(96, bw / 7.5));
    const y0 = by + bh * 0.24;
    const j = Math.random() < 0.15 ? (Math.random() * 2 - 1) * 12 : 0;
    c.font = `900 ${size}px ${FONT_HEAVY}`;
    c.textAlign = 'center';
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,0,90,0.9)';
    c.fillText('ЭГО-СМЕРТЬ', W / 2 - 5 + j, y0);
    c.fillStyle = 'rgba(0,220,255,0.9)';
    c.fillText('ЭГО-СМЕРТЬ', W / 2 + 5 - j, y0);
    c.globalCompositeOperation = 'source-over';
    label(c, 'ЭГО-СМЕРТЬ', W / 2, y0, `900 ${size}px ${FONT_HEAVY}`, '#fff');

    let y = y0 + size * 0.7;
    label(c, deathCause, W / 2, y, `700 16px ${FONT}`, 'rgba(255,255,255,0.85)');
    y += 50;
    label(c, `СЧЁТ: ${score}`, W / 2, y, `900 38px ${FONT_HEAVY}`, `hsl(${hue},100%,75%)`, 'center', `hsl(${hue},100%,60%)`);
    y += 40;
    if (newBest) label(c, '★ НОВЫЙ РЕКОРД ★', W / 2, y, `900 24px ${FONT_HEAVY}`, `hsl(${(hue * 3) % 360},100%,70%)`);
    else label(c, `РЕКОРД: ${best}`, W / 2, y, `800 20px ${FONT}`, '#fff');
    y += 30;
    label(c, `скорость ${speed} · уровень ${level} · жизней было ${livesLabel(LIVES_OPTS[livesIdx])}`, W / 2, y, `600 15px ${FONT}`, 'rgba(255,255,255,0.7)');
    y += 46;
    if (t > 0.4 && Math.sin(time * 6) > -0.3) {
      label(c, 'ENTER / ПРОБЕЛ — РЕИНКАРНАЦИЯ', W / 2, y, `900 24px ${FONT_HEAVY}`, '#fff', 'center', `hsl(${hue},100%,60%)`);
    }
    drawSettings(c, y + 44);
    label(c, 'ESC — в меню', W / 2, y + 84, `600 14px ${FONT}`, 'rgba(255,255,255,0.7)');
  }

  function renderUI(sx, sy, zoom) {
    const c = uctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, ui.width, ui.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.textBaseline = 'middle';
    if (state === 'title') {
      drawTitle(c);
      if (toast) {
        c.globalAlpha = clamp(toast.life / 0.4, 0, 1);
        label(c, toast.text, W / 2, H * 0.05, `900 22px ${FONT_HEAVY}`, `hsl(${toast.h},100%,75%)`, 'center', `hsl(${toast.h},100%,55%)`);
        c.globalAlpha = 1;
      }
      return;
    }
    c.save();
    c.translate(sx + bx + bw / 2, sy + by + bh / 2);
    c.scale(zoom[0], zoom[1]);
    c.translate(-(bx + bw / 2), -(by + bh / 2));
    drawBorder(c);
    c.restore();
    drawHUD(c);
    drawZoneCountdown(c);
    drawBossBar(c);
    drawPopups(c);
    drawBanner(c);
    drawMega(c);
    drawAim(c);
    if (buildK > 0 && state === 'play') {
      const n = Math.ceil(beatsToDrop);
      const txt = beatsToDrop <= 4 ? `ДРОП ЧЕРЕЗ ${n}` : '▲ ДРОП БЛИЗКО ▲';
      const f = beatsToDrop <= 4 ? 1 - (n - beatsToDrop) : 0;
      c.globalAlpha = 0.45 + 0.5 * buildK;
      label(c, txt, W / 2, by + bh * 0.1, `900 ${Math.round(20 + 22 * buildK + 10 * f)}px ${FONT_HEAVY}`, `hsl(${(hue + 180 * buildK) % 360},100%,72%)`, 'center', `hsl(${hue},100%,60%)`);
      c.fillStyle = `hsl(${hue},100%,65%)`;
      c.fillRect(W / 2 - 120, by + bh * 0.1 + 26, 240 * buildK, 4);
      c.globalAlpha = 1;
    }
    if (state === 'paused') drawPaused(c);
    if (state === 'countdown') drawCountdown(c);
    if (state === 'over') drawOver(c);
  }

  // ---------- main loop ----------
  reset();
  titlePts = titleSnakePts();
  let lastMs = performance.now();
  function frame(now) {
    const dt = clamp((now - lastMs) / 1000, 0, 0.05);
    lastMs = now;
    update(dt);
    const sx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    // the board breathes with the music: kick on every beat, squash & stretch alternating every bar
    const rk = [0.4, 0.85, 1.2][tripLevel];
    const z0 = 1 + 0.03 * pulse + 0.035 * beat * rk + 0.05 * buildK * buildK;
    const st = 0.045 * barPulse * rk;
    const zoom = [z0 * (1 + (barAxis ? st : -st * 0.6)), z0 * (1 + (barAxis ? -st * 0.6 : st))];
    renderFX(sx, sy, zoom);
    renderUI(sx, sy, zoom);
    if (hasGL) {
      GFX.render(fx, {
        time, int: intensity, beat, pulse, trip: tripSmooth, hue: hue / 360, flash, zoom,
        speed: state === 'title' ? 0.3 : speedK(),
        drop: clamp(dropT, 0, 1), invert: invertFlash, shock: shockT, build: buildK, aim: aimK,
        grav: (() => {
          const g = new Float32Array(12);
          wells.slice(0, 4).forEach((w, i) => {
            const k = clamp(Math.min((gameTime - w.born) / 0.6, (w.life - (gameTime - w.born)) / 0.8), 0, 1);
            g[i * 3] = (bx + w.x * cell) * dpr;
            g[i * 3 + 1] = glCanvas.height - (by + w.y * cell) * dpr;
            g[i * 3 + 2] = state === 'title' ? 0 : k;
          });
          return g;
        })(),
        shake: [sx * dpr, -sy * dpr],
        board: state === 'title' ? [-1, -1, 0, 0] : [bx * dpr, glCanvas.height - (by + bh) * dpr, bw * dpr, bh * dpr],
        cell: cell * dpr,
        decay: 0.86 + 0.1 * Math.min(1, intensity),
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hook: open index.html#debug to poke the game from devtools / automation.
  if (location.hash === '#debug') {
    window.vsDebug = {
      get: () => ({
        state, score, level, lives, speed, length: snake.length, items: items.map(i => i.type), voids: voids.length,
        fliers: fliers.map(f => f.kind), bullets: bullets.length, pickups: pickups.length, power: { ...power }, shield,
      }),
      give: type => { if (state === 'play') eat(type, cx(snake[0].x), cy(snake[0].y)); },
      levelUp: () => { if (state === 'play') levelUp(); },
      flier: kind => spawnFlier(kind),
      crash: () => { if (state === 'play') crash('ТЕСТ'); },
      drop: () => triggerDrop(true),
      boss: () => spawnBoss(),
      well: () => spawnWell(),
      aim: () => startAim(),
      forceAim: () => { aimCharge = 1; startAim(); },
      aimAt: (x, y) => { if (aim) { aim.x = x; aim.y = y; } },
      fireAim: () => fireAim(),
      bossInfo: () => boss && { len: boss.segs.length, head: boss.segs[0], life: boss.life },
      hp: () => fliers.map(f => [f.kind, f.hp]),
      fliersAt: () => fliers.map(f => ({ k: f.kind, x: Math.floor(f.x), y: Math.floor(f.y) })),
      big: () => { power.big = POWER_DUR.big; },
      fx: () => ({ aimCharge, aimOn: !!aim, dropT, buildK, beatsToDrop, bigK, invertFlash, shockT, stepCount, hordeLeft, zone, groove, fever, mega: mega && mega.text }),
      zone: () => { if (state === 'play') startZone(); },
      // lay the snake out as a ring (head right behind the tail) so the next step bites the tail
      ring: () => {
        if (state !== 'play') return;
        const x0 = 4, y0 = 4, w = 5, h = 4, loop = [];
        for (let x = x0; x < x0 + w; x++) loop.push({ x, y: y0 });
        for (let y = y0; y < y0 + h; y++) loop.push({ x: x0 + w, y });
        for (let x = x0 + w; x > x0; x--) loop.push({ x, y: y0 + h });
        for (let y = y0 + h; y > y0; y--) loop.push({ x: x0, y });
        snake = loop.reverse();
        prevSnake = snake.map(s => ({ ...s }));
        dir = { x: snake[0].x - snake[1].x, y: snake[0].y - snake[1].y };
        dirQueue = [];
        grow = 0;
        fliers.push({ kind: 'eye', x: x0 + 2.5, y: y0 + 2.5, vx: 0, vy: 0, born: gameTime - 1, hp: 1, ph: 0, hit: 0 });
      },
    };
  }
})();
