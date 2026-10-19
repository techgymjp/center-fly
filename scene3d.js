'use strict';
// センターフライ — 3D 描画(野手の背中越しにホームを見る視点)
// ワールド座標 (x, y, z-up) は three.js の (x, z, -y) に対応させる。
window.Scene3D = (() => {
  const H = 640;
  let W = 960;
  const FENCE = 122;
  const MOUND = { x: 0, y: 18.44 };
  const BASE = 27.43 / Math.SQRT2; // 塁間を45°回転したときの座標
  const BALL_R = 0.12;             // 見やすさのため実物の約3倍

  let renderer, scene, camera, ready = false;
  let fielderRig, ballMesh, ballShadow, fielderShadow, trailLine, trailPts = [];
  let batter, pitcher, scoreboard, fenceMat, navRing, navDot;
  const cam = { fx: 0, fy: -1, pitch: 0.12, init: false };

  const V = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

  // ---------- テクスチャ ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }

  // 地面のフィールド描画範囲
  const GX0 = -112, GX1 = 112, GY0 = -30, GY1 = 140, GK = 9.2;

  function groundTexture() {
    const w = Math.round((GX1 - GX0) * GK), h = Math.round((GY1 - GY0) * GK);
    return canvasTex(w, h, (g) => {
      const tx = (x) => (x - GX0) * GK, ty = (y) => (GY1 - y) * GK, m = (v) => v * GK;
      // ファウルゾーンの芝
      g.fillStyle = '#2d6a2c';
      g.fillRect(0, 0, w, h);
      // フェアゾーン(扇形)
      const wedge = () => {
        g.beginPath();
        g.moveTo(tx(0), ty(0));
        for (let a = -Math.PI / 4; a <= Math.PI / 4 + 1e-6; a += Math.PI / 90) g.lineTo(tx(Math.sin(a) * FENCE), ty(Math.cos(a) * FENCE));
        g.closePath();
      };
      g.save();
      wedge(); g.clip();
      g.fillStyle = '#3a8a36';
      g.fillRect(0, 0, w, h);
      // チェック模様の芝刈り跡
      const band = 7;
      for (let x = -140; x < 140; x += band * 2) {
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(tx(x), 0, m(band), h);
      }
      for (let y = -10; y < 140; y += band * 2) {
        g.fillStyle = 'rgba(0,0,0,0.06)';
        g.fillRect(0, ty(y + band), w, m(band));
      }
      g.restore();
      // 芝のざらつき
      for (let i = 0; i < 90000; i++) {
        const v = Math.random();
        g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,230,0.05)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // ウォーニングトラック
      g.save();
      wedge(); g.clip();
      g.beginPath();
      g.arc(tx(0), ty(0), m(FENCE + 2), 0, Math.PI * 2);
      g.arc(tx(0), ty(0), m(FENCE - 5), 0, Math.PI * 2, true);
      g.fillStyle = '#a8794a';
      g.fill();
      g.restore();
      // 内野の土
      g.save();
      g.beginPath();
      g.moveTo(tx(0), ty(-3));
      g.lineTo(tx(-60), ty(57)); g.lineTo(tx(60), ty(57));
      g.closePath(); g.clip();
      g.beginPath();
      g.arc(tx(MOUND.x), ty(MOUND.y), m(29), 0, Math.PI * 2);
      g.fillStyle = '#b5814f';
      g.fill();
      g.restore();
      // 内野の芝
      const ins = 2.2;
      g.beginPath();
      g.moveTo(tx(0), ty(ins * 1.4));
      g.lineTo(tx(BASE - ins), ty(BASE));
      g.lineTo(tx(0), ty(BASE * 2 - ins * 1.4));
      g.lineTo(tx(-BASE + ins), ty(BASE));
      g.closePath();
      g.fillStyle = '#3a8a36';
      g.fill();
      // マウンドとホーム周り
      g.fillStyle = '#b5814f';
      g.beginPath(); g.arc(tx(MOUND.x), ty(MOUND.y), m(2.8), 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(tx(0), ty(0), m(4.2), 0, Math.PI * 2); g.fill();
      // ファウルライン
      g.strokeStyle = '#f4f4f0';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(tx(0), ty(0)); g.lineTo(tx(-FENCE), ty(FENCE));
      g.moveTo(tx(0), ty(0)); g.lineTo(tx(FENCE), ty(FENCE));
      g.stroke();
      // バッターボックス
      g.lineWidth = 2;
      g.strokeRect(tx(-1.75), ty(0.9), m(1.2), m(1.8));
      g.strokeRect(tx(0.55), ty(0.9), m(1.2), m(1.8));
      // ベース
      g.fillStyle = '#ffffff';
      for (const [x, y] of [[BASE, BASE], [0, BASE * 2], [-BASE, BASE]]) {
        g.save(); g.translate(tx(x), ty(y)); g.rotate(Math.PI / 4);
        g.fillRect(-m(0.2), -m(0.2), m(0.4), m(0.4)); g.restore();
      }
      g.beginPath();
      g.moveTo(tx(-0.22), ty(0.22)); g.lineTo(tx(0.22), ty(0.22)); g.lineTo(tx(0.22), ty(0));
      g.lineTo(tx(0), ty(-0.22)); g.lineTo(tx(-0.22), ty(0)); g.closePath(); g.fill();
      g.fillRect(tx(-0.3), ty(MOUND.y + 0.1), m(0.6), m(0.15));
    });
  }

  function crowdTexture() {
    return canvasTex(512, 512, (g, w, h) => {
      const rows = 16, rh = h / rows;
      const shirts = ['#e53935', '#fdd835', '#1e88e5', '#ffffff', '#43a047', '#fb8c00', '#8e24aa', '#212121', '#f06292', '#90caf9'];
      for (let r = 0; r < rows; r++) {
        g.fillStyle = r % 2 ? '#24324a' : '#2b3b57';
        g.fillRect(0, r * rh, w, rh);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(0, r * rh + rh - 4, w, 4);
        for (let x = 2; x < w; x += 9) {
          if (Math.random() < 0.18) continue;
          const sx = x + (Math.random() - 0.5) * 3;
          g.fillStyle = shirts[(Math.random() * shirts.length) | 0];
          g.fillRect(sx, r * rh + rh * 0.45, 7, rh * 0.45);
          g.fillStyle = Math.random() < 0.8 ? '#e8bf9a' : '#6d4c41';
          g.beginPath(); g.arc(sx + 3.5, r * rh + rh * 0.32, 3, 0, Math.PI * 2); g.fill();
        }
      }
    }, true);
  }

  function skyTexture() {
    return canvasTex(2048, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#060a1f');
      gr.addColorStop(0.35, '#16224f');
      gr.addColorStop(0.48, '#3a3a78');
      gr.addColorStop(0.5, '#7a5a7c');
      gr.addColorStop(0.52, '#1a1a2a');
      gr.addColorStop(1, '#0a0a12');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }

  function glowTexture() {
    return canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,240,1)');
      gr.addColorStop(0.2, 'rgba(255,250,220,0.8)');
      gr.addColorStop(0.5, 'rgba(255,240,200,0.18)');
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }

  // ---------- 球場 ----------
  // 観客席の内側の輪郭(ホームからの極座標、φ=0 がセンター)
  function innerR(phi) {
    const a = Math.abs(phi);
    const PMIN = 54.1 * Math.PI / 180;
    if (a <= Math.PI / 4) return FENCE;
    if (a < PMIN) {
      const r1 = 16 / Math.sin(PMIN - Math.PI / 4);
      const u = (a - Math.PI / 4) / (PMIN - Math.PI / 4);
      return FENCE + (r1 - FENCE) * u;
    }
    return Math.max(20, 16 / Math.sin(a - Math.PI / 4));
  }

  function buildStadium() {
    const N = 240;
    const ring = [];
    for (let i = 0; i <= N; i++) {
      const phi = -Math.PI + (2 * Math.PI) * i / N;
      const r = innerR(phi);
      ring.push({ phi, r, x: Math.sin(phi) * r, y: Math.cos(phi) * r });
    }
    // 累積距離(テクスチャの u)
    let acc = 0;
    ring.forEach((p, i) => { if (i) acc += Math.hypot(p.x - ring[i - 1].x, p.y - ring[i - 1].y); p.s = acc; });

    // フェンス/ラバー
    {
      const pos = [], uv = [], idx = [];
      const wallH = 3.0;
      ring.forEach((p, i) => {
        pos.push(p.x, 0, -p.y, p.x, wallH, -p.y);
        uv.push(p.s / 4, 0, p.s / 4, 1);
        if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const tex = canvasTex(128, 64, (g, w, h) => {
        g.fillStyle = '#1d4a2b'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, 4, h);
        g.fillStyle = '#f2d23c'; g.fillRect(0, 0, w, 5);
      }, true);
      fenceMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
      scene.add(new THREE.Mesh(geo, fenceMat));
    }

    // 観客席(すり鉢状)
    {
      const D = 46, RISE = 30, BASEH = 3.0, STEPS = 10;
      const pos = [], uv = [], idx = [];
      const cols = STEPS + 1;
      ring.forEach((p, i) => {
        const nx = Math.sin(p.phi), ny = Math.cos(p.phi);
        const depth = Math.abs(p.phi) < Math.PI / 4 ? 26 : D;
        const rise = Math.abs(p.phi) < Math.PI / 4 ? 14 : RISE;
        for (let j = 0; j <= STEPS; j++) {
          const u = j / STEPS;
          const gap = Math.abs(p.phi) < Math.PI / 4 ? 9 : 1; // 外野はフェンス裏に通路
          const d = gap + depth * u, hgt = BASEH + 0.5 + rise * u;
          pos.push(p.x + nx * d, hgt, -(p.y + ny * d));
          uv.push(p.s / 22, u * 3);
        }
        if (i) {
          for (let j = 0; j < STEPS; j++) {
            const a = (i - 1) * cols + j, b = i * cols + j;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ map: crowdTexture(), side: THREE.DoubleSide, emissive: 0x222838 });
      scene.add(new THREE.Mesh(geo, mat));

      // 最上段の壁と屋根のふち
      const top = [], tidx = [];
      ring.forEach((p, i) => {
        const nx = Math.sin(p.phi), ny = Math.cos(p.phi);
        const outfield = Math.abs(p.phi) < Math.PI / 4;
        const d = (outfield ? 9 + 26 : 1 + D), hgt = BASEH + 0.5 + (outfield ? 14 : RISE);
        top.push(p.x + nx * d, hgt, -(p.y + ny * d), p.x + nx * d, hgt + (outfield ? 4 : 9), -(p.y + ny * d));
        if (i) { const k = i * 2; tidx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
      });
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
      tg.setIndex(tidx);
      tg.computeVertexNormals();
      scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: 0x3a4660, side: THREE.DoubleSide })));
    }

    // ポール
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 8), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
      pole.position.copy(V(sx * FENCE * Math.SQRT1_2, FENCE * Math.SQRT1_2, 15));
      scene.add(pole);
    }

    // 照明塔
    const glow = glowTexture();
    glowTex = glow;
    const towers = [-150, -112, -70, 70, 112, 150, -25, 25];
    for (const deg of towers) {
      const phi = deg * Math.PI / 180;
      const outfield = Math.abs(phi) < Math.PI / 4;
      const r = innerR(phi) + (outfield ? 30 : 50);
      const x = Math.sin(phi) * r, y = Math.cos(phi) * r;
      const h = outfield ? 40 : 52;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, h, 6), new THREE.MeshLambertMaterial({ color: 0x555b66 }));
      post.position.copy(V(x, y, h / 2));
      scene.add(post);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.6), new THREE.MeshBasicMaterial({ color: 0xfffbe6 }));
      panel.position.copy(V(x, y, h + 2));
      panel.lookAt(V(0, 60, 0));
      scene.add(panel);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.position.copy(V(x, y, h + 2));
      sp.scale.set(36, 36, 1);
      scene.add(sp);
    }

    // バックスクリーン代わりのオーロラビジョン(ホーム後方スタンド上)
    {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 192;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), new THREE.MeshBasicMaterial({ map: tex }));
      const r = innerR(Math.PI) + 52;
      mesh.position.copy(V(0, -r, 42));
      mesh.lookAt(V(0, 60, 30));
      scene.add(mesh);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 1), new THREE.MeshLambertMaterial({ color: 0x20242c }));
      frame.position.copy(V(0, -r - 0.8, 42));
      frame.lookAt(V(0, 60, 30));
      scene.add(frame);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 30, 3), new THREE.MeshLambertMaterial({ color: 0x30343c }));
      leg.position.copy(V(0, -r - 1, 21));
      scene.add(leg);
      scoreboard = { canvas: c, tex, key: '' };
    }
  }

  function updateScoreboard(state) {
    const key = `${state.phase}|${state.index}|${state.catches}|${state.misses}`;
    if (key === scoreboard.key) return;
    scoreboard.key = key;
    const g = scoreboard.canvas.getContext('2d');
    g.fillStyle = '#05070c'; g.fillRect(0, 0, 512, 192);
    g.fillStyle = '#ffd54f';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.fillText('CENTER FLY', 256, 52);
    g.font = 'bold 36px sans-serif';
    g.fillStyle = '#ffffff';
    const n = Math.min(state.index + 1, 100);
    g.fillText(`第${n}球`, 140, 118);
    g.fillStyle = '#7fe0ff';
    g.fillText(`捕球 ${state.catches}`, 370, 118);
    g.fillStyle = '#ff8a80';
    g.font = 'bold 28px sans-serif';
    g.fillText(`落球 ${state.misses}`, 370, 166);
    g.fillStyle = '#b0bec5';
    g.fillText('/ 100', 140, 166);
    scoreboard.tex.needsUpdate = true;
  }

  // ---------- 人物 ----------
  function numberTexture(num, bg, fg) {
    return canvasTex(128, 160, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg;
      g.font = 'bold 110px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(num, w / 2, h / 2 + 8);
    });
  }

  // 前方 = ローカル +Z
  function makePlayer(opt) {
    const uni = new THREE.MeshLambertMaterial({ color: opt.uniform });
    const dark = new THREE.MeshLambertMaterial({ color: opt.cap });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0b48c });
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const body = new THREE.Group(); // 体全体(ダイブで傾ける)
    root.add(body);

    const legGeo = new THREE.BoxGeometry(0.17, 0.85, 0.2);
    legGeo.translate(0, -0.42, 0);
    const legL = new THREE.Mesh(legGeo, uni), legR = new THREE.Mesh(legGeo, uni);
    legL.position.set(0.13, 0.92, 0); legR.position.set(-0.13, 0.92, 0);
    const sockGeo = new THREE.BoxGeometry(0.18, 0.3, 0.21); sockGeo.translate(0, -0.7, 0);
    legL.add(new THREE.Mesh(sockGeo, dark)); legR.add(new THREE.Mesh(sockGeo, dark));
    body.add(legL, legR);

    const torsoMats = [uni, uni, uni, uni, uni, opt.back ? new THREE.MeshLambertMaterial({ map: numberTexture(opt.back, '#' + opt.uniform.toString(16).padStart(6, '0'), opt.numColor || '#1d2f6f') }) : uni];
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), torsoMats);
    torso.position.set(0, 1.25, 0);
    body.add(torso);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.06, 0.29), dark);
    belt.position.set(0, 0.95, 0);
    body.add(belt);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
    head.position.set(0, 1.7, 0);
    body.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    cap.position.set(0, 1.72, 0);
    body.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), dark);
    brim.position.set(0, 1.73, 0.15);
    body.add(brim);

    const armGeo = new THREE.BoxGeometry(0.12, 0.6, 0.13);
    armGeo.translate(0, -0.28, 0);
    const armL = new THREE.Mesh(armGeo, uni), armR = new THREE.Mesh(armGeo, uni);
    armL.position.set(0.31, 1.52, 0); armR.position.set(-0.31, 1.52, 0);
    body.add(armL, armR);
    let glove = null;
    if (opt.glove) {
      glove = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9a6430 }));
      glove.scale.set(1, 1.2, 0.7);
      glove.position.set(0, -0.62, 0.02);
      armL.add(glove);
    }
    return { root, body, legL, legR, armL, armR, torso, glove };
  }

  function buildPlayers() {
    fielderRig = makePlayer({ uniform: 0xf4f4f4, cap: 0x1d2f6f, back: '8', glove: true });
    fielderRig.root.scale.setScalar(1.05);
    scene.add(fielderRig.root);

    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false });
    fielderShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), shadowMat);
    fielderShadow.rotation.x = -Math.PI / 2;
    scene.add(fielderShadow);

    // 内野の登場人物(遠景)
    const scale = 1.15; // 遠くでも見えるよう少し大きめ
    pitcher = makePlayer({ uniform: 0xf4f4f4, cap: 0x1d2f6f, glove: true });
    pitcher.root.position.copy(V(MOUND.x, MOUND.y, 0.25));
    pitcher.root.rotation.y = 0; // ホーム方向(-y)を向く
    pitcher.root.scale.setScalar(scale);
    scene.add(pitcher.root);

    batter = makePlayer({ uniform: 0x9e9e9e, cap: 0xc62828 });
    batter.root.position.copy(V(-0.95, 0.1, 0));
    batter.root.rotation.y = Math.PI / 2; // ホーム方向を見て +x 向き
    batter.root.scale.setScalar(scale);
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.9, 6), new THREE.MeshLambertMaterial({ color: 0xd7b98e }));
    bat.geometry.translate(0, 0.45, 0);
    batter.bat = new THREE.Group();
    batter.bat.add(bat);
    batter.bat.position.set(0, 1.35, 0.1);
    batter.root.add(batter.bat);
    scene.add(batter.root);

    const catcher = makePlayer({ uniform: 0x37474f, cap: 0x1d2f6f });
    catcher.root.position.copy(V(0, -1.3, 0));
    catcher.root.scale.set(scale, scale * 0.6, scale);
    scene.add(catcher.root);
    const ump = makePlayer({ uniform: 0x1b1b1b, cap: 0x1b1b1b });
    ump.root.position.copy(V(0, -2.3, 0));
    ump.root.scale.set(scale, scale * 0.85, scale);
    scene.add(ump.root);
  }

  function buildBall() {
    ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(ballMesh);
    ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2;
    scene.add(ballShadow);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 40), 3));
    trailLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    trailLine.frustumCulled = false;
    scene.add(trailLine);
  }

  // ---------- 花火(ホーム後方のスタンド上空) ----------
  const ROCKET_T = 0.9;
  const FW_COLORS = [0xff5252, 0xffd740, 0x69f0ae, 0x40c4ff, 0xe040fb, 0xffffff, 0xff9100];
  let clock = 0, glowTex = null;
  const pendingFw = [], rockets = [], bursts = [];

  function firework(delay, big) { pendingFw.push({ at: clock + delay, big }); }

  function spawnRocket(big) {
    const x = (Math.random() - 0.5) * 120, y = -40 - Math.random() * 35;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.set(3, 3, 1);
    scene.add(sp);
    rockets.push({ sp, x, y, z0: 35, z1: (big ? 75 : 62) + Math.random() * 22, t: 0, big });
  }

  function spawnBurst(x, y, z, big) {
    const n = big ? 320 : 220;
    const pos = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3);
    const c1 = new THREE.Color(FW_COLORS[(Math.random() * FW_COLORS.length) | 0]);
    const c2 = new THREE.Color(FW_COLORS[(Math.random() * FW_COLORS.length) | 0]);
    const speed = big ? 36 : 28;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sv = speed * (0.85 + Math.random() * 0.3);
      vel.push(new THREE.Vector3(r * Math.cos(a) * sv, u * sv, r * Math.sin(a) * sv));
      const p = V(x, y, z);
      pos.set([p.x, p.y, p.z], i * 3);
      const c = i % 3 === 0 ? c2 : c1;
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: big ? 4.5 : 3.6, map: glowTex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    // 破裂の瞬間の閃光
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c1, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    flash.position.copy(V(x, y, z));
    flash.scale.set(90, 90, 1);
    scene.add(flash);
    bursts.push({ pts, vel, flash, t: 0, life: 2.4 });
  }

  function updateFireworks(dt) {
    clock += dt;
    for (let i = pendingFw.length - 1; i >= 0; i--) {
      if (pendingFw[i].at <= clock) { spawnRocket(pendingFw[i].big); pendingFw.splice(i, 1); }
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt;
      const u = Math.min(1, r.t / ROCKET_T);
      const z = r.z0 + (r.z1 - r.z0) * (1 - (1 - u) * (1 - u));
      r.sp.position.copy(V(r.x + Math.sin(r.t * 20) * 0.3, r.y, z));
      if (u >= 1) {
        scene.remove(r.sp); r.sp.material.dispose();
        spawnBurst(r.x, r.y, z, r.big);
        rockets.splice(i, 1);
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const bu = bursts[i];
      bu.t += dt;
      const arr = bu.pts.geometry.attributes.position.array;
      const drag = Math.exp(-1.6 * dt);
      for (let k = 0; k < bu.vel.length; k++) {
        const v = bu.vel[k];
        v.multiplyScalar(drag);
        v.y -= 5 * dt;
        arr[k * 3] += v.x * dt; arr[k * 3 + 1] += v.y * dt; arr[k * 3 + 2] += v.z * dt;
      }
      bu.pts.geometry.attributes.position.needsUpdate = true;
      const fade = 1 - bu.t / bu.life;
      bu.pts.material.opacity = Math.max(0, fade < 0.4 ? fade / 0.4 * (0.6 + 0.4 * Math.random()) : 1);
      bu.flash.material.opacity = Math.max(0, 1 - bu.t * 4);
      if (bu.t >= bu.life) {
        scene.remove(bu.pts); scene.remove(bu.flash);
        bu.pts.geometry.dispose(); bu.pts.material.dispose(); bu.flash.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  function buildNav() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false });
    navRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), mat);
    navRing.rotation.x = -Math.PI / 2;
    navDot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), mat.clone());
    navDot.rotation.x = -Math.PI / 2;
    navRing.renderOrder = navDot.renderOrder = 2;
    scene.add(navRing, navDot);
  }

  // 着地点ナビ: 最初は大きな輪で、落下が近づくほど落下点に絞られる
  function updateNav(state) {
    const b = state.ball;
    const on = state.nav && state.phase === 'flight' && b && b.nav && !b.waiting && !b.caught && !b.landed && b.t > 0.25;
    navRing.visible = navDot.visible = !!on;
    if (!on) return;
    const n = b.nav;
    const u = Math.max(0, Math.min(1, (n.t - b.t) / n.t));
    const r = 1.1 + 9 * u * u;
    navRing.position.copy(V(n.x, n.y, 0.07));
    navRing.scale.setScalar(r);
    navDot.position.copy(V(n.x, n.y, 0.08));
    const pulse = 0.65 + 0.3 * Math.sin(state.time * 10);
    navRing.material.opacity = pulse;
    navDot.material.opacity = 0.35 + 0.5 * (1 - u);
    navRing.material.color.setHex(n.jump ? 0xff7043 : 0xffe14d);
    navDot.material.color.copy(navRing.material.color);
  }

  // ---------- 初期化 ----------
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d1c);
    scene.fog = new THREE.Fog(0x141a33, 180, 520);
    camera = new THREE.PerspectiveCamera(64, W / H, 0.1, 1200);

    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }));
    scene.add(sky);
    const starPos = [];
    for (let i = 0; i < 500; i++) {
      const az = Math.random() * Math.PI * 2, el = 0.12 + Math.random() * 1.4;
      starPos.push(Math.cos(el) * Math.cos(az) * 700, Math.sin(el) * 700, Math.cos(el) * Math.sin(az) * 700);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));

    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a3a20, 1.6));
    const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
    key.position.set(30, 80, 40);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd0dcff, 0.8);
    fill.position.set(-40, 60, -80);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GX1 - GX0, GY1 - GY0),
      new THREE.MeshLambertMaterial({ map: groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.copy(V((GX0 + GX1) / 2, (GY0 + GY1) / 2, 0));
    scene.add(ground);
    // 観客席の下を埋める地面
    const under = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: 0x1a1f2a }));
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.05;
    scene.add(under);

    buildStadium();
    buildPlayers();
    buildBall();
    buildNav();
    ready = true;
  }

  function resize(cssW, cssH, logicalW) {
    if (!ready) return;
    W = logicalW;
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    renderer.setSize(cssW, cssH, false);
  }

  // ---------- 毎フレーム ----------
  function poseFielder(f, jumpH, time, b) {
    const r = fielderRig;
    r.root.position.copy(V(f.x, f.y, jumpH));
    r.root.rotation.y = Math.PI - f.face;
    const speed = Math.hypot(f.vx, f.vy);
    r.body.rotation.x = 0;
    r.body.position.set(0, 0, 0);
    r.armL.rotation.set(0, 0, 0); r.armR.rotation.set(0, 0, 0);
    if (f.mode === 'dive' || f.mode === 'down') {
      const t = f.mode === 'dive' ? Math.min(1, f.t / 0.2) : 1;
      r.body.rotation.x = 1.45 * t;
      r.body.position.set(0, -0.15 * t, 0);
      r.armL.rotation.x = -2.9 * t; r.armR.rotation.x = -2.6 * t;
      r.legL.rotation.x = 0.2; r.legR.rotation.x = -0.1;
    } else if (f.mode === 'jump') {
      r.armL.rotation.x = -3.0; r.armL.rotation.z = 0.2;
      r.armR.rotation.x = -0.6;
      r.legL.rotation.x = -0.5; r.legR.rotation.x = 0.3;
    } else {
      const swing = Math.min(1, speed / 6) * 0.9;
      const ph = time * (6 + speed * 1.3);
      r.legL.rotation.x = Math.sin(ph) * swing;
      r.legR.rotation.x = -Math.sin(ph) * swing;
      r.armL.rotation.x = -Math.sin(ph) * swing * 0.8 - (speed < 1 ? 0.3 : 0);
      r.armR.rotation.x = Math.sin(ph) * swing * 0.8;
      r.body.rotation.x = Math.min(0.35, speed * 0.03);
      r.body.position.y = Math.abs(Math.sin(ph)) * 0.05 * swing;
    }
    // 捕ったらグラブを高く掲げる
    if (b && b.caught && f.mode !== 'dive' && f.mode !== 'down') {
      r.armL.rotation.x = -2.9; r.armL.rotation.z = 0.15;
    }
    // ボールが近づいたらグラブを差し出す
    if (b && !b.waiting && !b.landed && !b.caught && f.mode !== 'dive' && f.mode !== 'down') {
      const dx = b.x - f.x, dy = b.y - f.y, dh = Math.hypot(dx, dy);
      if (dh < 4.5 && b.z < 6 && b.vz < 0) {
        const sf = Math.sin(f.face), cf = Math.cos(f.face);
        const fwd = dx * sf + dy * cf, right = dx * cf - dy * sf;
        const elev = Math.atan2(b.z - 1.5 - jumpH * 0.5, Math.max(0.3, fwd));
        const w = Math.min(1, (4.5 - dh) / 2);
        r.armL.rotation.x = r.armL.rotation.x * (1 - w) + Math.max(-3.1, Math.min(-0.4, -(Math.PI / 2 + elev))) * w;
        r.armL.rotation.z = Math.max(-1.0, Math.min(1.0, -Math.atan2(right, 1.2))) * w;
      }
    }
    fielderShadow.position.copy(V(f.x, f.y, 0.03));
    const s = 1 - Math.min(0.5, jumpH * 0.3);
    fielderShadow.scale.setScalar(f.mode === 'down' || f.mode === 'dive' ? 1.5 : s);
  }

  function render(state, dt, info) {
    if (!ready) return;
    const f = state.fielder;
    const b = state.ball;
    updateScoreboard(state);

    poseFielder(f, info.jumpHeight(f), state.time, b);
    updateFireworks(dt);
    updateNav(state);

    // ピッチャーとバッター
    const pt = state.phase === 'ready' ? state.phaseT : 9;
    pitcher.armR.rotation.x = pt < 1.3 ? -Math.min(1, pt / 1.0) * 3.0 : -0.5;
    const sw = state.phase === 'flight' || state.phase === 'result' ? Math.min(1, (b && !b.waiting ? b.t : 0) / 0.15) : 0;
    batter.bat.rotation.set(-0.4 - sw * 1.0, 0, 0.6 - sw * 3.4);

    // ボール
    const show = b && !b.waiting;
    ballMesh.visible = show;
    ballShadow.visible = show && !b.caught;
    if (show) {
      if (b.caught) {
        fielderRig.root.updateMatrixWorld(true);
        fielderRig.glove.getWorldPosition(ballMesh.position);
        ballMesh.position.y += 0.12; // グラブからのぞかせる
      } else {
        ballMesh.position.copy(V(b.x, b.y, b.z + BALL_R * 0.5));
      }
      ballShadow.position.copy(V(b.x, b.y, 0.04));
      const s = Math.max(0.6, 1 - b.z * 0.012);
      ballShadow.scale.setScalar(s);
      ballShadow.material.opacity = Math.max(0.3, 0.6 - b.z * 0.01);
      if (!b.caught && !b.landed) {
        const last = trailPts[trailPts.length - 1];
        if (!last || Math.hypot(last.x - b.x, last.y - b.y, last.z - b.z) > 1.2) {
          trailPts.push({ x: b.x, y: b.y, z: b.z });
          if (trailPts.length > 40) trailPts.shift();
        }
      }
    }
    if (!show || (b && b.t < 0.05)) trailPts = [];
    const arr = trailLine.geometry.attributes.position.array;
    for (let i = 0; i < 40; i++) {
      const p = trailPts[Math.min(i, trailPts.length - 1)];
      if (p) { arr[i * 3] = p.x; arr[i * 3 + 1] = p.z; arr[i * 3 + 2] = -p.y; }
    }
    trailLine.geometry.attributes.position.needsUpdate = true;
    trailLine.geometry.setDrawRange(0, trailPts.length);
    trailLine.visible = trailPts.length > 1 && !(b && b.caught);

    // カメラ: 野手の背中越しにホームを見る
    const F = info.forward(f);
    const k = 1 - Math.exp(-5 * dt);
    if (!cam.init) { cam.fx = F.x; cam.fy = F.y; cam.init = true; }
    cam.fx += (F.x - cam.fx) * k; cam.fy += (F.y - cam.fy) * k;
    const fl = Math.hypot(cam.fx, cam.fy); cam.fx /= fl; cam.fy /= fl;
    // フェンス際ではカメラがフェンスの外(通路の上)に出るので、少し高くしてフェンスを半透明にする
    const back = 7.5;
    const cx = f.x - cam.fx * back, cy = f.y - cam.fy * back;
    const out = Math.max(0, Math.hypot(cx, cy) - (FENCE - 1));
    const camH = 3.0 + Math.min(3.5, out * 0.6);
    fenceMat.opacity += ((out > 0.5 ? 0.3 : 1) - fenceMat.opacity) * k;
    fenceMat.transparent = fenceMat.opacity < 0.99;
    fenceMat.depthWrite = !fenceMat.transparent;
    // 野手の上半身が画面から切れない範囲でボールを追って見上げる
    const halfV = camera.fov * Math.PI / 360;
    const maxPitch = halfV - Math.atan2(camH - 0.9, back) - 0.05;
    let pitch = Math.min(state.phase === 'result' && b && b.caught ? 0.3 : 0.08, maxPitch);
    if (show && !b.caught) {
      const along = (b.x - cx) * cam.fx + (b.y - cy) * cam.fy;
      const elev = Math.atan2(b.z - camH, Math.max(0.5, along));
      pitch = Math.min(maxPitch, Math.max(pitch, elev - halfV * 0.6));
    }
    cam.pitch += (pitch - cam.pitch) * (1 - Math.exp(-3 * dt));
    camera.position.copy(V(cx, cy, camH));
    const look = 40;
    camera.lookAt(V(cx + cam.fx * look, cy + cam.fy * look, camH + Math.tan(cam.pitch) * look));

    renderer.render(scene, camera);
  }

  const tmp = new THREE.Vector3();
  function project(x, y, z) {
    tmp.copy(V(x, y, z)).project(camera);
    return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, behind: tmp.z > 1 };
  }

  return { init, render, resize, project, firework, ROCKET_T };
})();
