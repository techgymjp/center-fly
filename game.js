'use strict';
// センターフライ — 100球のセンターフライを全部捕れるか?
// 座標系: ホームベースが原点、+y がセンター方向、+x がライト方向、z が高さ。単位はメートル。
// 画面は野手の背中越しにホームを見る視点(描画は scene3d.js)。
(() => {
  // ---------- 定数 ----------
  const H = 640;
  let W = 960; // 画面の横幅に合わせて変わる(高さ 640 基準の論理座標)
  const G = 9.8;
  const FENCE = 122;      // フェンスまでの距離
  const WALL_H = 3.0;     // フェンスの高さ
  const HOME_POS = { x: 0, y: 92 };
  const TOTAL = 100;

  const WALK = 6.0, DASH = 8.6, ACC = 24;
  const STAMINA_MAX = 5.0, STAMINA_REGEN = 0.35;
  const REACH = 2.3, CATCH_R = 1.1;
  const JUMP_T = 0.6, JUMP_H = 1.5;
  const DIVE_T = 0.4, DIVE_V = 10.5, DOWN_T = 0.9;
  const DT = 1 / 120;
  const t = (k, v) => I18N.t(k, v);

  // Android アプリ（Capacitor）で動いているか。Web 版では Capacitor がないので何もしない
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = (name) => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- 乱数 ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry32(Date.now());
  const rand = (a, b) => a + (b - a) * rng();

  // ---------- 保存 ----------
  function loadBest() {
    try { return JSON.parse(localStorage.getItem('centerfly.best')) || null; } catch (e) { return null; }
  }
  function saveBest(b) {
    try { localStorage.setItem('centerfly.best', JSON.stringify(b)); } catch (e) { /* 保存できない環境 */ }
  }

  // ---------- サウンド(sound.js) ----------
  function audio() { Sound.init(); }

  // ---------- 入力 ----------
  const keys = new Set();
  const input = { mx: 0, my: 0, sx: 0, sy: 0, dash: false, jump: false, dive: false };
  const pressed = { jump: false, dive: false, start: false };
  let bot = null; // テスト用: (state) => input を返す関数

  const RING = { x: 125, y: 510, r: 95, dead: 14 };
  const BTN = {
    dash: { x: 860, y: 548, r: 54, label: 'btn.dash', key: 'Shift' },
    jump: { x: 740, y: 590, r: 38, label: 'btn.jump', key: 'Z' },
    dive: { x: 790, y: 470, r: 38, label: 'btn.dive', key: 'X' },
  };
  const MUTE = { x: 596, y: 36, r: 20 };
  const NAVBTN = { x: 660, y: 36, w: 76, h: 30 };
  const pointers = new Map(); // pointerId -> 'ring' | 'dash' | 'jump' | 'dive' | 'none'
  const ringInput = { active: false, mx: 0, my: 0 };

  window.addEventListener('keydown', (e) => {
    audio();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys.has(k)) {
      if (k === 'z' || k === 'j') pressed.jump = true;
      if (k === 'x' || k === 'k') pressed.dive = true;
      if (k === ' ' || k === 'Enter') pressed.start = true;
      if (k === 'p' || k === 'Escape') togglePause();
      if (k === 'm') Sound.setMuted(!Sound.muted);
      if (k === 'n') toggleNav();
    }
    keys.add(k);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  window.addEventListener('blur', () => keys.clear());

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  function hitButton(p) {
    for (const [name, b] of Object.entries(BTN)) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 10) return name;
    }
    return null;
  }
  function setRing(p) {
    const dx = p.x - RING.x, dy = p.y - RING.y;
    const d = Math.hypot(dx, dy);
    if (d < RING.dead) { ringInput.mx = 0; ringInput.my = 0; return; }
    // 円の方角合わせ: 16方位にスナップ
    const step = Math.PI / 8;
    const ang = Math.round(Math.atan2(dx, -dy) / step) * step;
    const mag = Math.min(1, (d - RING.dead) / (RING.r * 0.6));
    ringInput.mx = Math.sin(ang) * mag;
    ringInput.my = Math.cos(ang) * mag;
  }
  canvas.addEventListener('pointerdown', (e) => {
    audio();
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = canvasPos(e);
    if (Math.hypot(p.x - MUTE.x, p.y - MUTE.y) <= MUTE.r + 6) {
      Sound.setMuted(!Sound.muted);
      pointers.set(e.pointerId, 'none');
      return;
    }
    if (Math.abs(p.x - NAVBTN.x) <= NAVBTN.w / 2 + 4 && Math.abs(p.y - NAVBTN.y) <= NAVBTN.h / 2 + 6) {
      toggleNav();
      pointers.set(e.pointerId, 'none');
      return;
    }
    if (state.phase === 'title' || state.phase === 'over') {
      if (state.phase !== 'over' || state.overT > 1.0) pressed.start = true;
      pointers.set(e.pointerId, 'none');
      return;
    }
    if (state.paused) { togglePause(); pointers.set(e.pointerId, 'none'); return; }
    if (Math.hypot(p.x - RING.x, p.y - RING.y) <= RING.r + 30) {
      pointers.set(e.pointerId, 'ring');
      ringInput.active = true;
      setRing(p);
      return;
    }
    const b = hitButton(p);
    if (b === 'jump') pressed.jump = true;
    if (b === 'dive') pressed.dive = true;
    pointers.set(e.pointerId, b || 'none');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.get(e.pointerId) === 'ring') setRing(canvasPos(e));
  });
  function releasePointer(e) {
    if (pointers.get(e.pointerId) === 'ring') {
      ringInput.active = false; ringInput.mx = 0; ringInput.my = 0;
    }
    pointers.delete(e.pointerId);
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  // カメラの前方(野手からホームへ向かう方向)
  function forward(f) {
    const d = Math.hypot(f.x, f.y) || 1;
    return { x: -f.x / d, y: -f.y / d };
  }
  function toWorld(mx, my, f) {
    const F = forward(f);
    // 画面の右 = 前方を時計回りに90°回した方向
    return { x: my * F.x + mx * F.y, y: my * F.y - mx * F.x };
  }

  function readInput() {
    if (bot) {
      const b = bot(state);
      input.mx = b.mx || 0; input.my = b.my || 0; input.dash = !!b.dash;
      input.jump = !!b.jump; input.dive = !!b.dive;
      return;
    }
    let mx = 0, my = 0;
    // テンキー 1-9 の8方向 + 矢印/WASD
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('8') || keys.has('7') || keys.has('9')) my += 1;
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('2') || keys.has('1') || keys.has('3')) my -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('6') || keys.has('9') || keys.has('3')) mx += 1;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('4') || keys.has('7') || keys.has('1')) mx -= 1;
    if (mx || my) {
      const m = Math.hypot(mx, my);
      mx /= m; my /= m;
    } else if (ringInput.active) {
      mx = ringInput.mx; my = ringInput.my;
    }
    let dash = keys.has('Shift') || keys.has(' ') || keys.has('c');
    for (const v of pointers.values()) if (v === 'dash') dash = true;
    // 画面基準(上=ホーム方向)の入力をワールド方向へ
    const w = toWorld(mx, my, state.fielder);
    input.mx = w.x; input.my = w.y; input.sx = mx; input.sy = my; input.dash = dash;
    input.jump = pressed.jump; input.dive = pressed.dive;
  }

  // ---------- ゲーム状態 ----------
  const state = {
    phase: 'title', // title | ready | flight | result | over
    paused: false,
    index: 0,
    catches: 0, misses: 0, score: 0, streak: 0, bestStreak: 0,
    tech: { dive: 0, jump: 0, hr: 0, running: 0 },
    phaseT: 0, overT: 0,
    ball: null, fielder: newFielder(),
    popups: [],
    lastResult: null,
    best: loadBest(),
    nav: loadNav(),
    time: 0,
    newRecord: false,
  };

  function newFielder() {
    return {
      x: HOME_POS.x, y: HOME_POS.y, vx: 0, vy: 0,
      face: Math.PI, // ホーム側を向いて構える
      mode: 'run', t: 0, stamina: STAMINA_MAX,
      dir: { x: 0, y: -1 },
      dashing: false,
    };
  }

  function newGame(seed) {
    rng = mulberry32(seed != null ? seed : (Date.now() ^ (Math.random() * 1e9)));
    Object.assign(state, {
      phase: 'ready', paused: false, index: 0, catches: 0, misses: 0, score: 0,
      streak: 0, bestStreak: 0, tech: { dive: 0, jump: 0, hr: 0, running: 0 },
      phaseT: 0, overT: 0, ball: null, popups: [], lastResult: null, newRecord: false, navUsed: false, redoUsed: 0,
    });
    startBall();
  }

  function pickType(i) {
    if (i < 3) return 'easy';
    const lv = i / (TOTAL - 1);
    const w = {
      easy: 1 - 0.75 * lv,
      run: 0.7,
      deep: 0.2 + 0.6 * lv,
      dive: i >= 6 ? 0.15 + 0.6 * lv : 0,
      wall: i >= 12 ? 0.1 + 0.45 * lv : 0,
    };
    let sum = 0;
    for (const v of Object.values(w)) sum += v;
    let r = rng() * sum;
    for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; }
    return 'run';
  }

  function genBall(i) {
    const lv = i / (TOTAL - 1);
    const type = pickType(i);
    const wind = (i >= 20 && rng() < 0.15 + 0.4 * lv) ? (rng() < 0.5 ? -1 : 1) * rand(0.6, 1.6 + lv) : 0;
    const z0 = 1.0;
    const s = HOME_POS;
    const around = (d, a) => ({ x: s.x + Math.sin(a) * d, y: s.y + Math.cos(a) * d });
    let T, L, hang;

    if (type === 'wall') {
      const a = rand(-0.22, 0.22);
      const tc = rand(5.0, 5.6);
      const zf = rand(3.2, 3.4 + 0.15 * lv);
      const C = { x: Math.sin(a) * FENCE, y: Math.cos(a) * FENCE };
      const v = {
        x: (C.x - 0.5 * wind * tc * tc) / tc,
        y: C.y / tc,
        z: (zf - z0 + 0.5 * G * tc * tc) / tc,
      };
      // 着地時刻(フェンスの向こう)
      hang = (v.z + Math.sqrt(v.z * v.z + 2 * G * z0)) / G;
      return makeBall(type, v, wind, z0, hang);
    }

    switch (type) {
      case 'easy':
        T = rand(4.2, 5.0);
        L = around(rand(0, 4.5 * (T - 1.0)), rand(0, Math.PI * 2));
        break;
      case 'run':
        T = rand(3.8, 4.8);
        L = around(rand(5.5 * (T - 0.8), 7.4 * (T - 0.9)), rand(0, Math.PI * 2));
        break;
      case 'deep':
        T = rand(4.4, 5.4);
        L = around(rand(6.2 * (T - 1.0), 7.6 * (T - 1.0)), rand(-1.0, 1.0));
        break;
      case 'dive':
        T = rand(2.9, 3.6);
        // 前方〜横への低いライナー
        L = around(DASH * (T - 0.68) + 1.1 + rand(-2.2, 0.2), Math.PI + rand(-1.4, 1.4));
        break;
    }
    // フェンス手前・フェアゾーン内に収める
    const dh = Math.hypot(L.x, L.y);
    if (dh > 118.5) { L.x *= 118.5 / dh; L.y *= 118.5 / dh; }
    L.x = Math.max(-55, Math.min(55, L.x));
    const v = {
      x: (L.x - 0.5 * wind * T * T) / T,
      y: L.y / T,
      z: (0.5 * G * T * T - z0) / T,
    };
    return makeBall(type, v, wind, z0, T);
  }

  function makeBall(type, v, wind, z0, hang) {
    return {
      type, v, a: { x: wind, y: 0, z: -G }, wind, hang,
      p0: { x: 0, y: 0, z: z0 },
      x: 0, y: 0, z: z0, t: 0,
      vx: v.x, vy: v.y, vz: v.z,
      landed: false, caught: false, overFence: false,
      trail: [],
    };
  }

  function startBall(replay) {
    state.phase = 'ready';
    state.phaseT = 0;
    state.fielder = newFielder();
    // やり直し(リワード広告)のときは同じ打球をもう一度
    if (!replay) state.ballSpec = JSON.stringify(genBall(state.index));
    state.ball = JSON.parse(state.ballSpec);
    state.ball.waiting = true;
    pressed.jump = pressed.dive = false;
  }

  function launch() {
    state.phase = 'flight';
    state.phaseT = 0;
    state.ball.waiting = false;
    state.ball.nav = predictNav(state.ball);
    if (state.nav) state.navUsed = true;
    Sound.crack();
  }

  // 着地点ナビ: 捕球する高さ(約1m)まで落ちてくる地点。フェンス際の打球はフェンスを越える地点
  function predictNav(b) {
    const at = (t) => ({
      x: b.p0.x + b.v.x * t + 0.5 * b.a.x * t * t,
      y: b.p0.y + b.v.y * t,
    });
    if (b.type === 'wall') {
      let t = 0;
      while (t < 10) {
        const p = at(t);
        if (Math.hypot(p.x, p.y) >= FENCE - 0.6) return { ...p, t, jump: true };
        t += 0.01;
      }
    }
    const zt = 1.0;
    const t = (b.v.z + Math.sqrt(b.v.z * b.v.z - 2 * G * (zt - b.p0.z))) / G;
    return { ...at(t), t, jump: false };
  }

  function loadNav() {
    try { return localStorage.getItem('centerfly.nav') !== '0'; } catch (e) { return true; }
  }
  function toggleNav() {
    state.nav = !state.nav;
    try { localStorage.setItem('centerfly.nav', state.nav ? '1' : '0'); } catch (e) { /* 保存できない環境 */ }
  }

  // ---------- 野手 ----------
  function setMode(f, m) { f.mode = m; f.t = 0; }

  function updateFielder(f, inp, dt, canMove) {
    f.t += dt;
    let mx = canMove ? inp.mx : 0, my = canMove ? inp.my : 0;
    let mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; mag = 1; }

    if (f.mode === 'land' && f.t > 0.12) setMode(f, 'run');

    if (f.mode === 'run' || f.mode === 'land') {
      const dashing = inp.dash && mag > 0.1 && f.stamina > 0 && canMove;
      f.dashing = dashing;
      const top = dashing ? DASH : WALK;
      const tvx = mx * top, tvy = my * top;
      const dvx = tvx - f.vx, dvy = tvy - f.vy;
      const dv = Math.hypot(dvx, dvy);
      const maxd = ACC * dt;
      if (dv <= maxd) { f.vx = tvx; f.vy = tvy; } else { f.vx += dvx / dv * maxd; f.vy += dvy / dv * maxd; }
      if (dashing) f.stamina = Math.max(0, f.stamina - dt);
      else f.stamina = Math.min(STAMINA_MAX, f.stamina + STAMINA_REGEN * dt);
      if (mag > 0.1) { f.face = Math.atan2(mx, my); }

      if (f.mode === 'run' && canMove) {
        if (inp.jump) {
          setMode(f, 'jump');
          f.vx *= 0.6; f.vy *= 0.6;
          Sound.jump();
        } else if (inp.dive) {
          const d = mag > 0.2 ? { x: mx / mag, y: my / mag } : { x: Math.sin(f.face), y: Math.cos(f.face) };
          f.dir = d;
          f.face = Math.atan2(d.x, d.y);
          setMode(f, 'dive');
          Sound.dive();
        }
      }
    } else if (f.mode === 'jump') {
      if (f.t >= JUMP_T) { setMode(f, 'land'); f.vx *= 0.3; f.vy *= 0.3; }
    } else if (f.mode === 'dive') {
      f.vx = f.dir.x * DIVE_V; f.vy = f.dir.y * DIVE_V;
      if (f.t >= DIVE_T) setMode(f, 'down');
    } else if (f.mode === 'down') {
      const k = Math.exp(-6 * dt);
      f.vx *= k; f.vy *= k;
      if (f.t >= DOWN_T) setMode(f, 'run');
    }

    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // フェンスと外野の範囲
    const d = Math.hypot(f.x, f.y);
    const maxD = FENCE - 0.5;
    if (d > maxD) {
      f.x *= maxD / d; f.y *= maxD / d;
      const nx = f.x / maxD, ny = f.y / maxD;
      const vr = f.vx * nx + f.vy * ny;
      if (vr > 0) { f.vx -= vr * nx; f.vy -= vr * ny; }
    }
    if (f.x < -60) { f.x = -60; f.vx = Math.max(0, f.vx); }
    if (f.x > 60) { f.x = 60; f.vx = Math.min(0, f.vx); }
    if (f.y < 45) { f.y = 45; f.vy = Math.max(0, f.vy); }
  }

  function jumpHeight(f) {
    if (f.mode !== 'jump') return 0;
    const u = Math.min(1, f.t / JUMP_T);
    return 4 * JUMP_H * u * (1 - u);
  }

  function catchZone(f) {
    switch (f.mode) {
      case 'jump': {
        const h = jumpHeight(f);
        return { x: f.x, y: f.y, r: 1.0, top: REACH + h, bot: h * 0.5 };
      }
      case 'dive':
        return { x: f.x + f.dir.x * 1.0, y: f.y + f.dir.y * 1.0, r: 1.5, top: 1.4, bot: 0 };
      case 'down':
        if (f.t < 0.25) return { x: f.x + f.dir.x * 1.0, y: f.y + f.dir.y * 1.0, r: 1.5, top: 1.4, bot: 0 };
        return null;
      default:
        return { x: f.x, y: f.y, r: CATCH_R, top: REACH, bot: 0 };
    }
  }

  // ---------- ボール ----------
  function updateBall(b, dt) {
    if (b.waiting) return;
    if (b.caught) {
      const f = state.fielder;
      b.x = f.x + Math.sin(f.face + 0.6) * 0.5;
      b.y = f.y + Math.cos(f.face + 0.6) * 0.5;
      b.z = 1.2 + jumpHeight(f);
      return;
    }
    if (!b.landed) {
      b.t += dt;
      const t = b.t;
      b.x = b.p0.x + b.v.x * t + 0.5 * b.a.x * t * t;
      b.y = b.p0.y + b.v.y * t;
      b.z = b.p0.z + b.v.z * t + 0.5 * b.a.z * t * t;
      b.vx = b.v.x + b.a.x * t;
      b.vy = b.v.y;
      b.vz = b.v.z + b.a.z * t;
      if (Math.hypot(b.x, b.y) > FENCE + 0.6) b.overFence = true;
      if (b.z <= 0) {
        b.z = 0;
        b.landed = true;
        b.vz = -b.vz * 0.3;
        b.vx *= 0.55; b.vy *= 0.55;
        onLand(b);
      }
    } else {
      // バウンド・転がり
      b.vz -= G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (Math.abs(b.vz) > 1) { b.vz = -b.vz * 0.35; b.vx *= 0.7; b.vy *= 0.7; } else b.vz = 0;
        const k = Math.exp(-1.2 * dt);
        b.vx *= k; b.vy *= k;
      }
      const d = Math.hypot(b.x, b.y);
      if (!b.overFence && d > FENCE - 0.2) {
        // フェンスで跳ね返る
        const nx = b.x / d, ny = b.y / d;
        const vr = b.vx * nx + b.vy * ny;
        if (vr > 0) { b.vx -= 1.4 * vr * nx; b.vy -= 1.4 * vr * ny; }
        b.x = nx * (FENCE - 0.2); b.y = ny * (FENCE - 0.2);
      }
    }
  }

  function tryCatch() {
    const b = state.ball, f = state.fielder;
    if (b.waiting || b.caught || b.landed || b.overFence) return;
    const z = catchZone(f);
    if (!z) return;
    if (b.z > z.top || b.z < z.bot) return;
    if (Math.hypot(b.x - z.x, b.y - z.y) > z.r) return;
    onCatch(b, f);
  }

  function onCatch(b, f) {
    b.caught = true;
    const speed = Math.hypot(f.vx, f.vy);
    const ballDist = Math.hypot(b.x, b.y);
    let label, pts, kind;
    if (f.mode === 'jump' && b.z > WALL_H && ballDist > FENCE - 1.5) {
      label = t('catch.hr'); pts = 500; kind = 'hr'; state.tech.hr++;
    } else if (f.mode === 'jump') {
      label = t('catch.jump'); pts = 250; kind = 'jump'; state.tech.jump++;
    } else if (f.mode === 'dive' || f.mode === 'down') {
      label = t('catch.dive'); pts = 300; kind = 'dive'; state.tech.dive++;
    } else if (speed > 7.0) {
      label = t('catch.running'); pts = 150; kind = 'running'; state.tech.running++;
    } else {
      label = t('catch.normal'); pts = 100; kind = 'normal';
    }
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const bonus = Math.min(state.streak - 1, 20) * 5;
    pts += bonus;
    state.catches++;
    state.score += pts;
    state.lastResult = { ok: true, kind };
    popup(label, kind === 'normal' ? '#ffffff' : '#ffe14d', kind === 'normal' ? 40 : 52);
    popup('+' + pts, '#9fe8ff', 26, 0.25);
    celebrate(kind);
    endFlight();
  }

  function onLand(b) {
    const d = Math.hypot(b.x, b.y);
    state.misses++;
    state.redoStreak = state.streak;
    state.streak = 0;
    const hr = d > FENCE;
    state.lastResult = { ok: false, kind: hr ? 'hr' : 'hit' };
    offerRedo();
    popup(t(hr ? 'miss.hr' : 'miss.hit'), '#ff6b6b', 46);
    Sound.sigh(hr ? 1.3 : 1);
    endFlight();
  }

  // アウトを取ったら花火と大歓声。難しい捕り方ほど派手に
  function celebrate(kind) {
    const great = kind === 'dive' || kind === 'jump' || kind === 'hr';
    const milestone = state.streak > 0 && state.streak % 10 === 0;
    Sound.glove();
    Sound.cheer(great ? 1.5 : 1.1, great ? 4.5 : 3.2);
    if (great || milestone) Sound.horn();
    let n = kind === 'hr' ? 7 : great ? 5 : 3;
    if (milestone) {
      n += 3;
      popup(t('streak', { n: state.streak }), '#ff8a65', 34, 0.5);
    }
    fireworks(n, great);
  }

  function fireworks(n, big, gap = 0.3) {
    for (let i = 0; i < n; i++) {
      const t = 0.1 + i * gap + Math.random() * 0.15;
      Scene3D.firework(t, big);
      Sound.launch(t);
      Sound.boom(t + Scene3D.ROCKET_T);
    }
  }

  function endFlight() {
    state.phase = 'result';
    state.phaseT = 0;
  }

  function popup(text, color, size, delay = 0) {
    state.popups.push({ text, color, size, t: -delay, life: 1.5, idx: state.popups.length });
  }

  // スマホは横画面で遊ぶ。縦向きの間は案内を出して一時停止する
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const portraitMQ = window.matchMedia('(orientation: portrait)');
  const isPortrait = () => isTouch && portraitMQ.matches;

  // スタートのタップで全画面+横向き固定を試す(Android Chrome など。iPhone は非対応なので何もしない)
  function goLandscape() {
    if (!isTouch || NATIVE) return; // アプリは AndroidManifest で横画面に固定している
    const el = document.documentElement;
    const lock = () => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    };
    try {
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
      else lock();
    } catch (e) { /* 非対応 */ }
  }
  canvas.addEventListener('pointerup', () => { if (state.phase === 'title' || state.phase === 'over') goLandscape(); });

  function togglePause() {
    if (state.phase === 'title' || state.phase === 'over') return;
    state.paused = !state.paused;
  }

  // ---------- 更新 ----------
  function update(dt) {
    state.time += dt;
    if (state.phase === 'title') {
      if (pressed.start) { pressed.start = false; newGame(); }
      return;
    }
    if (state.phase === 'over') {
      state.overT += dt;
      if (pressed.start && state.overT > 1.0) { pressed.start = false; retry(); }
      pressed.start = false;
      return;
    }
    pressed.start = false;
    if (isPortrait()) { if (!state.paused) state.paused = true; return; }
    if (state.paused) return;

    readInput();
    pressed.jump = pressed.dive = false;

    state.phaseT += dt;
    updateRedo(dt);
    const f = state.fielder, b = state.ball;
    const canMove = state.phase === 'flight' || state.phase === 'result';
    updateFielder(f, input, dt, canMove);
    updateBall(b, dt);
    if (state.phase === 'flight') tryCatch();

    if (!b.waiting && !b.caught) {
      b.trailT = (b.trailT || 0) + dt;
      if (b.trailT > 0.06 && !b.landed) {
        b.trailT = 0;
        b.trail.push({ x: b.x, y: b.y, z: b.z });
        if (b.trail.length > 14) b.trail.shift();
      }
    }

    for (const p of state.popups) p.t += dt;
    state.popups = state.popups.filter((p) => p.t < p.life);

    if (state.phase === 'ready' && state.phaseT >= 1.3) launch();
    if (state.phase === 'result' && state.phaseT >= 1.6 && !redo.active) {
      state.index++;
      if (state.index >= TOTAL) gameOver();
      else startBall();
    }
  }

  function gameOver() {
    state.phase = 'over';
    state.overT = 0;
    const best = state.best;
    if (!best || state.catches > best.catches || (state.catches === best.catches && state.score > best.score)) {
      state.best = { catches: state.catches, score: state.score };
      state.newRecord = true;
      saveBest(state.best);
    }
    const perfect = state.catches === TOTAL;
    Sound.fanfare(perfect);
    Sound.cheer(perfect ? 1.6 : 0.8, perfect ? 6 : 3);
    if (perfect) { Sound.horn(); fireworks(16, true, 0.35); } else if (state.catches >= 85) fireworks(6, false, 0.4);
  }

  // ---------- 描画(2D オーバーレイ) ----------
  // 3D 画面の外にあるボールの方向を示す
  function drawBallIndicator() {
    const b = state.ball;
    if (!b || b.waiting || b.caught || b.landed) return;
    const p = Scene3D.project(b.x, b.y, b.z);
    const inside = !p.behind && p.x > 0 && p.x < W && p.y > 0 && p.y < H;
    if (inside) return;
    ctx.save();
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    if (p.behind) {
      // 頭上を越えて背後へ
      const ax = W / 2;
      ctx.beginPath();
      ctx.moveTo(ax, H - 8); ctx.lineTo(ax - 14, H - 30); ctx.lineTo(ax + 14, H - 30);
      ctx.closePath(); ctx.fill();
      ctx.fillText(t('ind.over'), ax, H - 36);
    } else {
      const ax = Math.max(20, Math.min(W - 20, p.x));
      const ay = Math.max(20, Math.min(H - 20, p.y));
      const ang = Math.atan2(p.y - H / 2, p.x - W / 2);
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10);
      ctx.closePath(); ctx.fill();
      ctx.rotate(-ang);
      ctx.fillText(Math.round(b.z) + 'm', 0, p.y < 0 ? 28 : -16);
    }
    ctx.restore();
  }

  // ミニマップ(画面と同じ向き: ホームが上)
  function drawMinimap() {
    const mx = W - 168, my = 12, mw = 156, mh = 136;
    const ms = mh / 132;
    const tx = (x) => mx + mw / 2 - x * ms;
    const ty = (y) => my + 4 + y * ms;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    // フェアゾーン
    ctx.beginPath();
    ctx.moveTo(tx(0), ty(0));
    for (let a = -Math.PI / 4; a <= Math.PI / 4 + 1e-6; a += Math.PI / 40) ctx.lineTo(tx(Math.sin(a) * FENCE), ty(Math.cos(a) * FENCE));
    ctx.closePath();
    ctx.fillStyle = '#3c8a3f'; ctx.fill();
    ctx.strokeStyle = '#f2d23c'; ctx.lineWidth = 1; ctx.stroke();
    // 内野
    ctx.fillStyle = '#b98a56';
    ctx.beginPath();
    ctx.moveTo(tx(0), ty(0)); ctx.lineTo(tx(19.4), ty(19.4)); ctx.lineTo(tx(0), ty(38.8)); ctx.lineTo(tx(-19.4), ty(19.4));
    ctx.closePath(); ctx.fill();
    const f = state.fielder;
    if (f) {
      ctx.fillStyle = '#9fe8ff';
      ctx.beginPath(); ctx.arc(tx(f.x), ty(f.y), 3, 0, Math.PI * 2); ctx.fill();
    }
    const b = state.ball;
    if (state.nav && b && b.nav && state.phase === 'flight' && !b.caught && !b.landed) {
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tx(b.nav.x), ty(b.nav.y), 4, 0, Math.PI * 2); ctx.stroke();
    }
    if (b && !b.waiting) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.arc(tx(b.x), ty(b.y), 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(tx(b.x), ty(b.y) - b.z * ms * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12, 250, 100);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(t('hud.pitch', { n: Math.min(state.index + 1, TOTAL), t: TOTAL }), 24, 40);
    ctx.font = 'bold 16px sans-serif';
    // 捕球・落球・連続を横に並べる(言語で文字幅が変わるので測って詰める)
    let hx = 24;
    for (const [key, n, col] of [['hud.catches', state.catches, '#9fe8ff'], ['hud.misses', state.misses, '#ff8b8b'], ['hud.streak', state.streak, '#ffe14d']]) {
      const label = t(key, { n });
      ctx.fillStyle = col;
      ctx.fillText(label, hx, 64);
      hx += Math.max(72, ctx.measureText(label).width + 14);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE ${state.score}`, 24, 86);

    // スタミナ
    const f = state.fielder;
    const st = f ? f.stamina / STAMINA_MAX : 1;
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 94, 226, 8);
    ctx.fillStyle = st > 0.3 ? '#6be37a' : '#ff9a3c';
    ctx.fillRect(24, 94, 226 * st, 8);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.textAlign = 'right';
    ctx.fillText(t('hud.dash'), 250, 90);
    ctx.textAlign = 'left';

    // 風
    const b = state.ball;
    if (b && b.wind) {
      ctx.font = 'bold 16px sans-serif';
      const strong = t(Math.abs(b.wind) > 1.5 ? 'hud.windStrong' : 'hud.windWeak');
      const label = t('hud.wind', { d: b.wind < 0 ? '←' : '→', s: strong });
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(272, 12, Math.max(128, tw + 64), 34);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 284, 35);
      // 吹き流し
      const fxp = Math.max(372, 284 + tw + 28), fyp = 29;
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fxp, fyp - 10); ctx.lineTo(fxp, fyp + 10); ctx.stroke();
      ctx.fillStyle = '#ff7043';
      const len = 10 + Math.abs(b.wind) * 6, wave = Math.sin(state.time * 8) * 2;
      const dir = Math.sign(b.wind);
      ctx.beginPath();
      ctx.moveTo(fxp, fyp - 9); ctx.lineTo(fxp + dir * len, fyp - 5 + wave); ctx.lineTo(fxp, fyp - 1);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawControls() {
    // 方角リング
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(RING.x, RING.y, RING.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const mx = input.sx, my = input.sy;
    const mag = Math.hypot(mx, my);
    const cur = mag > 0.1 ? Math.atan2(mx, my) : null;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      const major = i % 2 === 0;
      let diff = cur == null ? 9 : Math.abs(((a - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const lit = diff < 0.2;
      ctx.fillStyle = lit ? '#ffe14d' : (major ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)');
      const rr = RING.r - 12;
      ctx.beginPath();
      ctx.arc(RING.x + Math.sin(a) * rr, RING.y - Math.cos(a) * rr, lit ? 7 : (major ? 4.5 : 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('ring.fwd'), RING.x, RING.y - RING.r - 6);
    ctx.fillText(t('ring.back'), RING.x, RING.y + RING.r + 15);
    // ノブ
    const kx = RING.x + mx * RING.r * 0.6, ky = RING.y - my * RING.r * 0.6;
    ctx.fillStyle = mag > 0.1 ? '#ffe14d' : 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(kx, ky, 16, 0, Math.PI * 2); ctx.fill();

    // ボタン
    for (const [name, b] of Object.entries(BTN)) {
      let on = false;
      for (const v of pointers.values()) if (v === name) on = true;
      if (name === 'dash' && input.dash) on = true;
      ctx.fillStyle = on ? 'rgba(255,225,77,0.85)' : 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = on ? '#222' : '#fff';
      ctx.font = `bold ${name === 'dash' ? 16 : 13}px sans-serif`;
      ctx.fillText(t(b.label), b.x, b.y + 3);
      ctx.font = '10px sans-serif';
      if (!isTouch) ctx.fillText(b.key, b.x, b.y + 17);
    }
    ctx.restore();
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    let line = 0;
    for (const p of state.popups) {
      if (p.t < 0) continue;
      const a = Math.min(1, (p.life - p.t) / 0.4);
      const sc = 1 + Math.max(0, 0.25 - p.t) * 1.5;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, 200 + line * 56 - p.t * 14);
      ctx.scale(sc, sc);
      ctx.font = `900 ${p.size}px sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
      line++;
    }
  }

  function centerText(text, y, size, color = '#fff', weight = 'bold') {
    ctx.font = `${weight} ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  function drawTitle() {
    ctx.fillStyle = 'rgba(8,14,20,0.55)';
    ctx.fillRect(0, 0, W, H);
    centerText(t('title.name'), 150, 76, '#ffe14d', '900');
    centerText(t('title.sub'), 205, 26);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#e6e6e6';
    // タッチ操作(アプリ・スマホ)ではキー名ではなくボタン名で案内する
    const lines = [1, 2, 3, 4, 5, 6].map((i) => t(`help.${isTouch ? 'touch' : 'key'}.${i}`));
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 262 + i * 30));
    if (state.best) centerText(t('title.best', { c: state.best.catches, t: TOTAL, s: state.best.score }), 470, 20, '#9fe8ff');
    if (Math.floor(state.time * 2) % 2 === 0) centerText(t(isTouch ? 'title.start.touch' : 'title.start.key'), 540, 30, '#ffffff');
    if (!NATIVE) centerText(t('title.sound'), 590, 15, '#cfd8dc', 'normal');
  }

  function rankOf(c) {
    if (c >= 100) return [t('rank.5'), '#ffe14d'];
    if (c >= 95) return [t('rank.4'), '#ffd54f'];
    if (c >= 85) return [t('rank.3'), '#9fe8ff'];
    if (c >= 70) return [t('rank.2'), '#b9f6ca'];
    if (c >= 50) return [t('rank.1'), '#e0e0e0'];
    return [t('rank.0'), '#bdbdbd'];
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(8,14,20,0.68)';
    ctx.fillRect(0, 0, W, H);
    // 下の方(y 約 300〜500)は HTML のシェア・もう一度ボタン、さらに下はバナー広告(アプリ)なので上に詰める
    centerText(t('over.title'), 84, 32, '#ffffff', '900');
    centerText(t('over.catches', { c: state.catches, t: TOTAL }), 130, 40, state.catches === TOTAL ? '#ffe14d' : '#9fe8ff', '900');
    if (state.catches === TOTAL) centerText(t('over.perfect'), 160, 18, '#ffe14d');
    const [rank, col] = rankOf(state.catches);
    centerText(t('over.rank', { r: rank }), 190, 22, col);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#e6e6e6';
    ctx.textAlign = 'center';
    ctx.fillText(t('over.line1', { s: state.score, k: state.bestStreak, nav: navLabel() }), W / 2, 216);
    ctx.fillText(t('over.line2', { d: state.tech.dive, j: state.tech.jump, h: state.tech.hr, r: state.tech.running }), W / 2, 238);
    if (state.newRecord) centerText(t('over.new'), 268, 20, '#ff8a65');
    else if (state.best) centerText(t('over.best', { c: state.best.catches, s: state.best.score }), 268, 17, '#9fe8ff');
  }

  // ---------- シェア(結果画面) ----------
  // 対応端末では成績画像つきで共有シートを開き、だめなら X・LINE・コピーで共有する
  const SHARE_URL = 'https://techgym.jp/column/claude-code-game-center-fly/';
  const shareEl = document.getElementById('share');
  const $id = (id) => document.getElementById(id);

  const navLabel = () => t(state.navUsed ? 'nav.on' : 'nav.off') + (state.redoUsed ? t('nav.redo', { n: state.redoUsed }) : '');

  function shareText() {
    const [rank] = rankOf(state.catches);
    return t('share.text', {
      c: state.catches, t: TOTAL, p: state.catches === TOTAL ? t('share.perfect') : '', r: rank,
      s: state.score, nav: navLabel(), d: state.tech.dive, h: state.tech.hr, k: state.bestStreak,
    });
  }

  function prepareShare() {
    const text = shareText();
    $id('shareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL);
    $id('shareLine').href = 'https://line.me/R/share?text=' + encodeURIComponent(text + '\n' + SHARE_URL);
    $id('shareMsg').textContent = t(NATIVE ? 'share.msg.native' : navigator.share ? 'share.msg.image' : 'share.msg.links');
    $id('retryBtn').textContent = t('over.retryBtn') + (isTouch ? '' : ' (SPACE)');
  }

  // 成績カード画像(1200x630)
  function makeShareImage() {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 630);
    bg.addColorStop(0, '#060a1f'); bg.addColorStop(0.6, '#1d2b5c'); bg.addColorStop(1, '#2d6a2c');
    g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; g.fillRect(Math.random() * 1200, Math.random() * 300, 2, 2); }
    for (const [x, y, col] of [[150, 140, '#ff5252'], [1060, 120, '#ffd740'], [990, 320, '#40c4ff'], [210, 380, '#e040fb']]) {
      g.strokeStyle = col; g.lineWidth = 3;
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2;
        g.beginPath(); g.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); g.lineTo(x + Math.cos(a) * 80, y + Math.sin(a) * 80); g.stroke();
      }
    }
    g.fillStyle = '#3a8a36'; g.fillRect(0, 560, 1200, 70);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const font = (w, sz) => `${w} ${sz}px "Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif`;
    g.fillStyle = '#9fd8ff'; g.font = font(800, 36); g.fillText(t('card.head', { nav: navLabel() }), 600, 70);
    const gold = g.createLinearGradient(0, 120, 0, 280);
    gold.addColorStop(0, '#fff6c4'); gold.addColorStop(0.5, '#ffd000'); gold.addColorStop(1, '#ff8a00');
    g.fillStyle = gold; g.font = font(900, 140); g.fillText(t('card.catches', { c: state.catches, t: TOTAL }), 600, 200, 1100);
    const [rank] = rankOf(state.catches);
    g.fillStyle = '#ff9d3c'; g.font = font(900, 52); g.fillText(t('card.rank', { r: rank }), 600, 330, 1100);
    g.fillStyle = '#ffffff'; g.font = font(800, 40);
    g.fillText(t('card.line1', { s: state.score, k: state.bestStreak }), 600, 415, 1100);
    g.fillText(t('card.line2', { d: state.tech.dive, j: state.tech.jump, h: state.tech.hr }), 600, 485, 1100);
    g.fillStyle = '#eef6e8'; g.font = font(700, 28); g.fillText(t('card.tags'), 600, 595);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  async function shareResult() {
    const text = shareText();
    // アプリでは Android の共有メニューを出す
    const nativeShare = plugin('Share');
    if (nativeShare) {
      try { await nativeShare.share({ title: t('share.title'), text, url: SHARE_URL, dialogTitle: t('share.dialog') }); } catch (e) { /* キャンセル */ }
      return;
    }
    if (navigator.share) {
      try {
        const blob = await makeShareImage();
        const file = blob && new File([blob], 'center-fly-result.png', { type: 'image/png' });
        const data = { title: t('share.title'), text: text + '\n' + SHARE_URL };
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
        await navigator.share(data);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 共有シートを閉じただけ
      }
    }
    copyResult();
  }

  async function copyResult() {
    const text = shareText() + '\n' + SHARE_URL;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* 非対応 */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta);
        ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (e) { /* 非対応 */ }
    }
    $id('shareMsg').textContent = t(ok ? 'share.copied' : 'share.copyFail');
  }

  $id('shareBtn').addEventListener('click', () => { audio(); shareResult(); });
  $id('shareCopy').addEventListener('click', copyResult);
  // シェア欄の操作でゲームが再スタートしないようにする
  for (const ev of ['pointerdown', 'pointerup', 'keydown']) shareEl.addEventListener(ev, (e) => e.stopPropagation());

  function updateShareVisibility() {
    const show = state.phase === 'over' && state.overT > 0.6;
    if (show !== !shareEl.hidden) {
      shareEl.hidden = !show;
      if (show) prepareShare();
    }
  }

  function draw() {
    ctx.setTransform(overlayScale, 0, 0, overlayScale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const b = state.ball;
    if (state.phase !== 'title') {
      drawBallIndicator();
      drawNavHint();
      drawMinimap();
      drawHUD();
      drawControls();
      drawPopups();
      if (state.phase === 'ready') {
        centerText(t('ready.pitch', { n: state.index + 1 }), 250, 44, '#ffffff', '900');
        if (b && b.wind) centerText(t('ready.wind', { d: t(b.wind < 0 ? 'ready.left' : 'ready.right') }), 292, 20, '#ffcc80');
      }
      if (state.paused && !isPortrait()) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        centerText('PAUSE', H / 2, 56);
        centerText(t('pause.resume'), H / 2 + 44, 20);
      }
    }
    if (state.phase === 'title') drawTitle();
    if (state.phase === 'over') drawOver();
    updateShareVisibility();
    updateLegalVisibility();
    updateBanner();
    drawMute();
    drawNavButton();
  }

  function drawNavButton() {
    const { x, y, w, h } = NAVBTN;
    ctx.save();
    ctx.fillStyle = state.nav ? 'rgba(255,225,77,0.9)' : 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = state.nav ? '#222' : '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('nav.btn', { s: state.nav ? 'ON' : 'OFF' }), x, y + 5);
    ctx.restore();
  }

  // 着地点ナビの技ヒント(ジャンプ!/ダイブ!)
  function drawNavHint() {
    const b = state.ball, f = state.fielder;
    if (!state.nav || state.phase !== 'flight' || !b || !b.nav || b.caught || b.landed) return;
    const n = b.nav, rem = n.t - b.t;
    if (rem < 0) return;
    const d = Math.hypot(n.x - f.x, n.y - f.y);
    let hint = null;
    if (n.jump && d < 3 && rem < 1.2) hint = t('hint.jump');
    else if (!n.jump && rem < 0.9 && d - CATCH_R > DASH * rem + 0.2 && d - 2.5 <= DASH * rem + 0.6) hint = t('hint.dive');
    if (!hint) return;
    const p = Scene3D.project(n.x, n.y, 2.5);
    if (p.behind) return;
    const blink = Math.floor(state.time * 8) % 2 === 0;
    ctx.save();
    ctx.font = '900 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const px = Math.max(80, Math.min(W - 80, p.x)), py = Math.max(60, Math.min(H - 40, p.y));
    ctx.strokeText(hint, px, py);
    ctx.fillStyle = blink ? '#ffe14d' : '#ff7043';
    ctx.fillText(hint, px, py);
    ctx.restore();
  }

  function drawMute() {
    const { x, y, r } = MUTE;
    ctx.save();
    if (!Sound.muted && !Sound.ready && state.phase !== 'title' && state.phase !== 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - 84, y + 26, 168, 24);
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('sound.tap'), x, y + 43);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 4); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 2, y - 10);
    ctx.lineTo(x + 2, y + 10); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x - 9, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    if (Sound.muted) {
      ctx.beginPath(); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x + 12, y + 5); ctx.moveTo(x + 12, y - 5); ctx.lineTo(x + 5, y + 5); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x + 3, y, 6, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, y, 11, -0.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- アプリ(Android)向け ----------
  // 「もう一度」の前に毎回、全画面広告を出す(Android アプリのみ)
  let retryBusy = false;
  async function retry() {
    if (retryBusy) return;
    if (Ads.available) {
      retryBusy = true;
      await Ads.showInterstitial(3000);
      retryBusy = false;
    }
    newGame();
  }

  // アプリが裏に回ったら一時停止して音を止める
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.phase === 'ready' || state.phase === 'flight' || state.phase === 'result') state.paused = true;
      Sound.suspend();
    } else if (!Ads.showing) {
      Sound.resume();
    }
  });
  // Android の戻るボタン:プレイ中はポーズ切替、タイトル・結果画面ではアプリを閉じる
  if (plugin('App')) {
    plugin('App').addListener('backButton', () => {
      if (state.phase === 'title' || state.phase === 'over') plugin('App').exitApp();
      else togglePause();
    });
  }

  // 結果画面の「もう一度」ボタン
  $id('retryBtn').addEventListener('click', () => { audio(); if (state.phase === 'over') retry(); });

  // ---------- リワード広告で落球をやり直す(アプリのみ・1 ゲーム 1 回) ----------
  // 打球を落としたら「広告を見てこの球をやり直す」を出す。見終わると落球を取り消し、同じ打球をもう一度
  const REDO_WAIT = 6;
  const redo = { active: false, busy: false, t: 0 };
  const redoEl = $id('redo');
  for (const ev of ['pointerdown', 'pointerup']) redoEl.addEventListener(ev, (e) => e.stopPropagation());
  function offerRedo() {
    if (!Ads.available || state.redoUsed) return;
    Object.assign(redo, { active: true, busy: false, t: REDO_WAIT });
    $id('redoWatch').disabled = false;
    $id('redoWatch').textContent = t('redo.watch');
    $id('redoNote').textContent = t('redo.note');
    redoEl.hidden = false;
  }
  function closeRedo() {
    redo.active = false;
    redoEl.hidden = true;
  }
  function updateRedo(dt) {
    if (!redo.active || redo.busy || state.paused) return;
    redo.t -= dt;
    $id('redoNext').textContent = t('redo.next', { s: Math.max(0, Math.ceil(redo.t)) });
    if (redo.t <= 0) closeRedo();
  }
  $id('redoNext').addEventListener('click', closeRedo);
  $id('redoWatch').addEventListener('click', async () => {
    if (!redo.active || redo.busy) return;
    redo.busy = true;
    $id('redoWatch').disabled = true;
    $id('redoWatch').textContent = t('redo.loading');
    const result = await Ads.showRewarded();
    if (!redo.active) return;
    if (result === 'unavailable') {
      $id('redoNote').textContent = t('redo.fail');
      setTimeout(closeRedo, 2000);
      return;
    }
    closeRedo();
    if (result !== 'rewarded') return;
    // 落球を取り消して、同じ打球をもう一度
    state.misses--;
    state.streak = state.redoStreak || 0;
    state.redoUsed++;
    state.popups = [];
    startBall(true);
  });

  // バナー広告はタイトル画面・結果画面・ポーズ画面だけ(プレイ中は操作ボタンと重なるので出さない)
  function updateBanner() {
    const paused = state.paused && state.phase !== 'title' && state.phase !== 'over';
    Ads.setBanner((state.phase === 'title' || state.phase === 'over' || paused) && !isPortrait());
  }

  // タイトル画面の下に、バージョン(アプリ版)・プライバシーポリシー・広告の設定(EU など)を出す
  const legalEl = document.getElementById('legal');
  if (window.APP_VERSION && window.APP_VERSION !== 'dev') document.getElementById('buildInfo').textContent = window.APP_VERSION;
  Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) document.getElementById('adPrivacy').hidden = false; });
  document.getElementById('adPrivacyLink').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });
  for (const ev of ['pointerdown', 'pointerup']) legalEl.addEventListener(ev, (e) => e.stopPropagation());
  // タイトル画面の言語切り替え
  const langEl = document.getElementById('langSel');
  document.querySelectorAll('[data-lang]').forEach((el) => el.addEventListener('click', () => I18N.setLang(el.dataset.lang)));
  for (const ev of ['pointerdown', 'pointerup']) langEl.addEventListener(ev, (e) => e.stopPropagation());
  I18N.onChange(() => { if (!shareEl.hidden) prepareShare(); });
  I18N.apply();

  function updateLegalVisibility() {
    const show = state.phase === 'title';
    if (show === legalEl.hidden) { legalEl.hidden = !show; langEl.hidden = !show; }
  }

  // ---------- メインループ ----------
  let overlayScale = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // 2D の表示は描画解像度を抑えめに(スマホは 1.5 倍まで)
    const dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
    W = Math.round(H * r.width / r.height);
    // 右側のボタン類は右端に合わせる
    BTN.dash.x = W - 100; BTN.jump.x = W - 220; BTN.dive.x = W - 170;
    MUTE.x = W / 2 + 116;
    NAVBTN.x = MUTE.x + 64;
    overlayScale = (r.height / H) * dpr;
    canvas.width = Math.round(W * overlayScale);
    canvas.height = Math.round(H * overlayScale);
    Scene3D.resize(r.width, r.height, W);
  }
  Scene3D.init(document.getElementById('view'));
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now(), acc = 0;
  function frame(now) {
    const frameDt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    acc += frameDt;
    if (api.hold) acc = 0; // テスト用: シミュレーションを止めて描画だけ行う
    while (acc >= DT) { update(DT); acc -= DT; }
    Scene3D.render(state, frameDt, { jumpHeight, forward });
    Sound.update(state);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // テスト・デバッグ用フック
  const api = window.CenterFly = {
    hold: false,
    state, newGame, update, DT, TOTAL,
    setBot(fn) { bot = fn; },
    consts: { G, FENCE, WALL_H, REACH, CATCH_R, JUMP_T, JUMP_H, DIVE_T, DIVE_V, WALK, DASH, HOME_POS },
  };
})();
