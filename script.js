/* ==========================================================
   GALAXIA DE AMOR — lógica
   1) Contenido de la órbita (girasoles, ramos y frases)
   2) Rotación con Pointer Events + inercia angular
   3) Canvas 2D: estrellas, polvo dorado, pétalos y corazón
   ========================================================== */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  /* ---------------- Configuración ---------------- */
  const CFG = {
    autoSpeed: 0.045,    // rad/s: giro automático lento cuando nadie interactúa
    friction: 0.9,       // 1/s: qué tan rápido se frena la inercia (menor = desliza más)
    maxVel: 14,          // rad/s: límite de velocidad angular
    minRadiusPx: 28,     // zona muerta cerca del núcleo (ahí el ángulo es inestable)
    keepUpright: true,   // true: textos y flores giran de posición pero quedan derechos
    intro: 2.6,          // giro de bienvenida (rad/s) que se frena solo
    dust: 720, stars: 380, petals: 34, heartParticles: 1700, sparks: 70
  };

  /* Para usar tus propias imágenes PNG (fondo transparente), colócalas en /assets
     y anota aquí las rutas. Si un archivo no existe se mantiene el dibujo SVG.
     Ejemplo: ['assets/ramo1.png', 'assets/ramo2.png']                        */
  const ASSET_IMAGES = { bouquets: [], sunflowers: [] };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { CFG.autoSpeed = 0.012; CFG.intro = 0; }

  const container = document.getElementById('galaxy-container');
  const orbit = document.getElementById('galaxy-orbit');
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');

  /* ==========================================================
     1) CONTENIDO DE LA ÓRBITA
     ========================================================== */
  function mulberry32(a) {           // aleatorio con semilla: mismo diseño siempre
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Un girasoles en SVG (pétalos traseros + delanteros + centro con semillas) */
  function sunflowerG(x, y, R, rot) {
    const n = 15, f = v => v.toFixed(2);
    let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})">`;
    for (let i = 0; i < n; i++)
      g += `<ellipse cy="${f(-R * .66)}" rx="${f(R * .21)}" ry="${f(R * .42)}" fill="url(#gPetalD)" transform="rotate(${f(i * 360 / n)})"/>`;
    for (let i = 0; i < n; i++)
      g += `<ellipse cy="${f(-R * .6)}" rx="${f(R * .2)}" ry="${f(R * .37)}" fill="url(#gPetal)" transform="rotate(${f(i * 360 / n + 180 / n)})"/>`;
    g += `<circle r="${f(R * .45)}" fill="url(#gCore)"/>`;
    for (let i = 0; i < 20; i++) {   // semillas en espiral áurea
      const a = i * 2.39996, r = R * .39 * Math.sqrt((i + .5) / 20);
      g += `<circle cx="${f(Math.cos(a) * r)}" cy="${f(Math.sin(a) * r)}" r="${f(R * .03)}" fill="#f3b53a" opacity=".45"/>`;
    }
    return g + '</g>';
  }

  function sunflowerSVG() {
    return `<svg viewBox="-50 -50 100 100">${sunflowerG(0, 0, 46, 0)}</svg>`;
  }

  /* Presets de ramos: [x, y, radio, rotación] de cada girasol */
  const PRESETS = {
    big:   { f: [[50,40,19,10],[27,52,14,-20],[73,53,14,25],[36,24,11,0],[65,25,11,15],[50,62,10,0],[18,36,9,-10],[82,38,9,8]], leaves: 9, fill: 26 },
    med:   { f: [[50,42,18,0],[28,54,13,-15],[72,55,13,20],[40,26,11,10],[62,27,11,-8]], leaves: 7, fill: 14 },
    small: { f: [[50,44,20,0],[30,56,14,-20],[70,57,14,20]], leaves: 5, fill: 8 }
  };

  function bouquetSVG(kind, seed, paper, ribbon) {
    const P = PRESETS[kind], rnd = mulberry32(seed);
    let s = '<svg viewBox="0 0 100 134">';
    // hojas en abanico
    for (let i = 0; i < P.leaves; i++) {
      const a = -78 + (156 * i) / (P.leaves - 1);
      s += `<ellipse cx="50" cy="58" rx="7" ry="23" fill="url(#gLeaf)" transform="rotate(${a.toFixed(1)} 50 84)"/>`;
    }
    // tallos
    P.f.forEach(([x, y, R]) => {
      s += `<path d="M${x} ${y + R * .4} Q${(x + 50) / 2} ${(y + 108) / 2 + 6} 50 108" stroke="#3a862d" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    });
    // florecillas de relleno (gypsophila y flores rosas/moradas)
    const cols = ['#ffffff', '#ffffff', '#ffd6e6', '#e58ac8', '#c58be0'];
    for (let i = 0; i < P.fill; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd());
      const x = 50 + Math.cos(a) * r * 44, y = 48 + Math.sin(a) * r * 34;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.3 + rnd() * 1.4).toFixed(1)}" fill="${cols[(rnd() * cols.length) | 0]}" opacity=".95"/>`;
    }
    // girasoles: del más pequeño (atrás) al más grande (adelante)
    [...P.f].sort((a, b) => a[2] - b[2]).forEach(([x, y, R, rot]) => { s += sunflowerG(x, y, R, rot); });

    if (paper) {                        // papel kraft cónico
      s += `<path d="M22 84 Q50 94 78 84 L57 126 L43 126 Z" fill="url(#gPaper)" stroke="#b98a5c" stroke-width=".6"/>`;
      s += `<path d="M50 90 L50 124 M35 87 L46 123 M65 87 L54 123" stroke="#b98a5c" stroke-width=".5" fill="none" opacity=".7"/>`;
      s += `<path d="M46 126 L44 132 M50 126 L50 133 M54 126 L56 132" stroke="#3a862d" stroke-width="2" stroke-linecap="round"/>`;
    } else {
      s += `<path d="M46 108 L44 130 M50 108 L50 132 M54 108 L56 130" stroke="#3a862d" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    const by = paper ? 100 : 112;       // moño
    s += `<path d="M50 ${by} C34 ${by-14} 26 ${by} 38 ${by+6} Z M50 ${by} C66 ${by-14} 74 ${by} 62 ${by+6} Z" fill="${ribbon}"/>`;
    s += `<path d="M50 ${by} L43 ${by+20} L48 ${by+17} L50 ${by+22} Z M50 ${by} L57 ${by+20} L52 ${by+17} L50 ${by+22} Z" fill="${ribbon}" opacity=".9"/>`;
    s += `<circle cx="50" cy="${by}" r="3.4" fill="${ribbon}" stroke="rgba(0,0,0,.15)" stroke-width=".5"/>`;
    return s + '</svg>';
  }

  /* Posiciones polares: r en "u" (1u = 1% del lado menor), a en grados (0° = derecha, horario).
     Todo cabe dentro de un radio de 50u, así nada se corta al girar. */
  const ITEMS = [
    // ramos grandes y medianos
    { t:'bq', k:'big',   r:28, a:222, s:16, seed:1, paper:false, rib:'#f4b3a2' },
    { t:'bq', k:'big',   r:37, a:338, s:15, seed:2, paper:false, rib:'#ffd23a' },
    { t:'bq', k:'med',   r:39, a:96,  s:12, seed:3, paper:true,  rib:'#f2b8a4' },
    { t:'bq', k:'small', r:26, a:40,  s:8,  seed:4, paper:true,  rib:'#f2b8a4' },
    { t:'bq', k:'med',   r:44, a:255, s:7,  seed:5, paper:true,  rib:'#f2b8a4' },
    { t:'bq', k:'med',   r:40, a:135, s:10, seed:6, paper:false, rib:'#ffd23a' },
    { t:'bq', k:'small', r:42, a:292, s:8,  seed:7, paper:true,  rib:'#f2b8a4' },
    { t:'bq', k:'small', r:19, a:340, s:6,  seed:8, paper:true,  rib:'#f2b8a4' },
    { t:'bq', k:'small', r:19, a:172, s:6,  seed:9, paper:false, rib:'#ffd23a' },
    // girasoles sueltos
    { t:'sf', r:46, a:318, s:4 }, { t:'sf', r:44, a:32,  s:3.5 }, { t:'sf', r:30, a:120, s:3.5 },
    { t:'sf', r:45, a:228, s:4 }, { t:'sf', r:20, a:78,  s:3 },   { t:'sf', r:24, a:270, s:5 },
    // frases
    { t:'tx', r:36, a:186, fs:3.6, txt:'Eres mi sol ☀️' },
    { t:'tx', r:38, a:12,  fs:3.9, txt:'Mi Amor 💛' },
    { t:'tx', r:22, a:322, fs:2.6, txt:'Mi persona 💛' },
    { t:'tx', r:33, a:302, fs:3.1, txt:'Mi felicidad 💛' },
    { t:'tx', r:40, a:65,  fs:3.3, txt:'Mi bendición 💛' },
    { t:'tx', r:36, a:156, fs:3.3, txt:'Eres único/a 💛' },
    { t:'tx', r:27, a:248, fs:2.5, txt:'Amor todo el tiempo 💛' },
    { t:'tx', r:43, a:115, fs:3.1, txt:'Siempre juntos 💛' }
  ];

  function buildOrbit() {
    const rnd = mulberry32(99);
    let html = '';
    ITEMS.forEach((it, i) => {
      const x = (it.r * Math.cos(it.a * DEG)).toFixed(2);
      const y = (it.r * Math.sin(it.a * DEG)).toFixed(2);
      const dur = (6 + rnd() * 4).toFixed(2), del = (-rnd() * 8).toFixed(2);
      let inner;
      if (it.t === 'tx') inner = `<span class="phrase" style="--fs:${it.fs}">${it.txt}</span>`;
      else {
        const svg = it.t === 'bq' ? bouquetSVG(it.k, it.seed, it.paper, it.rib) : sunflowerSVG();
        inner = `<div class="art" data-kind="${it.t}" data-i="${i}" style="--w:${it.s}">${svg}</div>`;
      }
      html += `<div class="item" style="transform:translate(calc(var(--u)*${x}),calc(var(--u)*${y}))">` +
              `<div class="upright"><div class="float" style="--d:${dur}s;--del:${del}s">${inner}</div></div></div>`;
    });
    orbit.innerHTML = html;
    orbit.classList.toggle('keep-upright', CFG.keepUpright);

    // Reemplazo opcional por imágenes PNG del usuario (si existen)
    orbit.querySelectorAll('.art').forEach(el => {
      const list = el.dataset.kind === 'bq' ? ASSET_IMAGES.bouquets : ASSET_IMAGES.sunflowers;
      if (!list.length) return;
      const src = list[+el.dataset.i % list.length], img = new Image();
      img.onload = () => { el.innerHTML = ''; el.appendChild(img); };
      img.alt = ''; img.draggable = false; img.src = src;
    });
  }

  /* ==========================================================
     2) ROTACIÓN: Pointer Events + inercia angular
     ----------------------------------------------------------
     · angle: ángulo acumulado de la galaxia (rad, sin límites).
     · Al arrastrar se mide el ángulo del puntero respecto al
       centro. La diferencia entre dos mediciones (delta) se suma
       al ángulo de la galaxia → el gesto sigue una trayectoria
       circular real (no un simple movimiento horizontal).
     · El delta se normaliza a [-π, π] para no saltar al cruzar
       de 180° a -180°.
     · vel: velocidad angular (rad/s). Al soltar, vel se acerca
       exponencialmente a la velocidad automática lenta, así la
       inercia se apaga suavemente y el giro ambiental continúa.
     ========================================================== */
  let angle = 0;
  let vel = CFG.intro;
  let autoDir = 1;
  let dragging = false, pointerId = null;
  let lastPtrAngle = 0, lastMoveT = 0;

  const centerX = () => container.clientWidth / 2;
  const centerY = () => container.clientHeight / 2;

  // Ángulo del puntero respecto al núcleo (radianes)
  function pointerAngle(e) {
    return Math.atan2(e.clientY - centerY(), e.clientX - centerX());
  }
  // Lleva una diferencia angular al rango [-π, π]
  function wrap(d) {
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return d;
  }

  function onDown(e) {
    if (dragging) return;                       // ignora dedos adicionales
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    try { container.setPointerCapture(pointerId); } catch (_) {}
    container.classList.add('dragging');
    hint.classList.add('hidden');
    lastPtrAngle = pointerAngle(e);
    lastMoveT = performance.now();
    vel = 0;                                    // el usuario toma el control
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - centerX(), dy = e.clientY - centerY();
    if (Math.hypot(dx, dy) < CFG.minRadiusPx) return;   // demasiado cerca del centro

    const a = Math.atan2(dy, dx);
    const d = wrap(a - lastPtrAngle);           // giro real desde la última medición
    lastPtrAngle = a;
    angle += d;                                 // la galaxia sigue al puntero

    // Velocidad angular suavizada (para la inercia al soltar)
    const now = performance.now();
    const dt = Math.max(now - lastMoveT, 4) / 1000;
    lastMoveT = now;
    const inst = Math.max(-CFG.maxVel, Math.min(CFG.maxVel, d / dt));
    vel = vel * 0.55 + inst * 0.45;
    e.preventDefault();
  }

  function onUp(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    try { container.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
    container.classList.remove('dragging');
    // Si el dedo/mouse estuvo quieto antes de soltar, no hay inercia
    if (performance.now() - lastMoveT > 90) vel = 0;
    if (Math.abs(vel) > 0.2) autoDir = vel < 0 ? -1 : 1;   // el giro lento sigue esa dirección
  }

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);
  container.addEventListener('lostpointercapture', onUp);
  container.addEventListener('contextmenu', e => e.preventDefault());
  container.addEventListener('dragstart', e => e.preventDefault());

  // Accesibilidad: flechas del teclado dan un impulso
  addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { vel -= 1.6; autoDir = -1; hint.classList.add('hidden'); }
    if (e.key === 'ArrowRight') { vel += 1.6; autoDir = 1;  hint.classList.add('hidden'); }
  });

  /* ==========================================================
     3) CANVAS: estrellas, polvo, pétalos, corazón y chispas
     ========================================================== */
  let W = 0, H = 0, dpr = 1, U = 1, cx = 0, cy = 0, maxR = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth; H = container.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    U = Math.min(W, H) / 100;                  // igual que --u en CSS
    cx = W / 2; cy = H / 2;
    maxR = Math.hypot(W, H) / 2;
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);
  resize();

  const rnd = Math.random;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;

  // Sprite de brillo suave, dibujado una vez y reutilizado
  const glowSprite = document.createElement('canvas');
  glowSprite.width = glowSprite.height = 64;
  { const g = glowSprite.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,236,150,1)'); gr.addColorStop(.35, 'rgba(255,196,40,.45)'); gr.addColorStop(1, 'rgba(255,170,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }

  const GOLDS = ['#ffe27a', '#ffd23a', '#ffc21a', '#fff1b0', '#ffb800'];

  // Estrellas de fondo (coordenadas polares normalizadas; giran muy poco = paralaje)
  const stars = Array.from({ length: CFG.stars }, () => ({
    r: Math.sqrt(rnd()), th: rnd() * TAU, sz: .4 + rnd() * 1.1,
    sp: .8 + rnd() * 2.6, ph: rnd() * TAU, c: rnd() < .25 ? '#ffe9a0' : '#ffffff'
  }));

  // Polvo dorado: brazos espirales que rotan junto con la galaxia
  const dust = Array.from({ length: CFG.dust }, () => {
    const r = Math.pow(rnd(), 1.25), arm = ((rnd() * 3) | 0) * TAU / 3;
    return {
      r, th: arm + r * 5 + gauss() * .55, sz: .6 + rnd() * 2.1,
      bokeh: rnd() < .035, sp: .5 + rnd() * 2, ph: rnd() * TAU,
      c: GOLDS[(rnd() * GOLDS.length) | 0], drift: (rnd() - .5) * .02
    };
  });

  // Pétalos que derivan lentamente (también giran con la órbita)
  const petals = Array.from({ length: CFG.petals }, () => ({
    r: .12 + rnd() * .85, th: rnd() * TAU, dth: (rnd() - .5) * .05,
    sz: 3 + rnd() * 5, spin: rnd() * TAU, ds: (rnd() - .5) * 1.4,
    ph: rnd() * TAU, sp: .3 + rnd() * .5, a: .55 + rnd() * .45
  }));

  // Corazón de partículas (en unidades del corazón paramétrico, punta en el núcleo)
  const heart = [];
  for (let i = 0; i < CFG.heartParticles; i++) {
    const t = rnd() * TAU, s = Math.sin(t);
    const hx = 16 * s * s * s;
    const hf = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const halo = rnd() < .12, spread = (halo ? 2.6 : .55) * Math.abs(gauss()) + .05, a = rnd() * TAU;
    heart.push({
      x: hx + Math.cos(a) * spread, y: -hf - 17 + Math.sin(a) * spread,
      sz: halo ? .5 + rnd() * .8 : .5 + rnd() * 1.3, base: halo ? .35 : .55 + rnd() * .45,
      sp: 1 + rnd() * 3, ph: rnd() * TAU, c: GOLDS[(rnd() * GOLDS.length) | 0]
    });
  }

  // Chispas que suben desde el núcleo hacia el corazón
  const sparks = Array.from({ length: CFG.sparks }, () => ({
    p: rnd(), sp: .12 + rnd() * .2, x: gauss() * 2.2, sz: .6 + rnd() * 1.4, sway: rnd() * TAU
  }));

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // --- Estrellas (giran al 12 % de la galaxia)
    const sa = angle * .12;
    for (const s of stars) {
      const a = .25 + .75 * (.5 + .5 * Math.sin(t * s.sp + s.ph));
      const rr = s.r * maxR, th = s.th + sa;
      ctx.globalAlpha = a; ctx.fillStyle = s.c;
      ctx.fillRect(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, s.sz, s.sz);
    }

    // --- Polvo dorado (gira con la galaxia completa)
    for (const p of dust) {
      const rr = p.r * maxR, th = p.th + angle + t * p.drift;
      const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
      const a = .5 + .5 * Math.sin(t * p.sp + p.ph);
      if (p.bokeh) {
        const sz = U * (1.2 + p.sz * 1.1);
        ctx.globalAlpha = .18 + .5 * a;
        ctx.drawImage(glowSprite, x - sz, y - sz, sz * 2, sz * 2);
      } else {
        ctx.globalAlpha = .12 + .88 * a * (1 - p.r * .35);
        ctx.fillStyle = p.c;
        if (p.sz > 1.5) { ctx.beginPath(); ctx.arc(x, y, p.sz * .6, 0, TAU); ctx.fill(); }
        else ctx.fillRect(x, y, p.sz, p.sz);
      }
    }

    // --- Pétalos flotantes
    for (const p of petals) {
      p.th += p.dth * dt; p.spin += p.ds * dt;
      const rr = (p.r + .015 * Math.sin(t * p.sp + p.ph)) * maxR * .82, th = p.th + angle;
      const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
      const sz = p.sz * Math.max(.8, U / 7);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(p.spin);
      ctx.scale(1, .45 + .55 * Math.abs(Math.cos(t * p.sp + p.ph)));
      ctx.globalAlpha = p.a * .85;
      ctx.fillStyle = '#ffc81e';
      ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * .5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,150,.55)';
      ctx.beginPath(); ctx.ellipse(-sz * .15, -sz * .1, sz * .6, sz * .22, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // --- Corazón de partículas (fijo, con pulsación tipo latido)
    const hs = U * 1.35;
    const pulse = 1 + .028 * Math.sin(t * 2.4) + .014 * Math.sin(t * 4.8 + 1);
    for (const p of heart) {
      const a = p.base * (.45 + .55 * Math.sin(t * p.sp + p.ph));
      if (a <= .02) continue;
      const hx = p.x * pulse, hy = (p.y + 14) * pulse - 14;   // pulsa desde el centro del corazón
      ctx.globalAlpha = a; ctx.fillStyle = p.c;
      const sz = p.sz * Math.max(.9, U / 6);
      ctx.fillRect(cx + hx * hs, cy + hy * hs, sz, sz);
    }
    // halo suave sobre el corazón
    ctx.globalAlpha = .07 + .03 * Math.sin(t * 2.4);
    const hg = U * 26;
    ctx.drawImage(glowSprite, cx - hg * 1.1, cy - U * 42, hg * 2.2, hg * 2.2);

    // --- Chispas ascendentes desde el núcleo
    for (const s of sparks) {
      s.p += s.sp * dt; if (s.p > 1) { s.p = 0; s.x = gauss() * 2.2; }
      const y = cy - s.p * U * 24, x = cx + (s.x + Math.sin(t * 2 + s.sway) * 1.2) * U * (.4 + s.p * 1.6) * .6;
      ctx.globalAlpha = (1 - s.p) * .9; ctx.fillStyle = '#fff1b0';
      ctx.fillRect(x, y, s.sz * 1.4, s.sz * 1.4);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- Bucle principal ---------------- */
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;

    if (!dragging) {
      // Inercia: la velocidad decae exponencialmente hacia el giro automático lento.
      // (la interacción manual siempre tiene prioridad porque dragging anula este bloque)
      const target = autoDir * CFG.autoSpeed;
      vel += (target - vel) * (1 - Math.exp(-CFG.friction * dt));
      angle += vel * dt;
    }

    // Se aplica a la órbita; el módulo evita números enormes sin crear saltos visuales
    const deg = ((angle * 180 / Math.PI) % 360).toFixed(3);
    orbit.style.setProperty('--rot', deg + 'deg');

    draw(now / 1000, dt);
    requestAnimationFrame(tick);
  }

  buildOrbit();
  requestAnimationFrame(tick);
})();