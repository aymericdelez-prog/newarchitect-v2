/* =========================================================
   New Architect — v2 · scènes 3D (Three.js r170)
   1. Intro du logo (plan → volumes → NA) puis monogramme NA noir en 3D (hero)
   2. Lettres N/A chromées du panneau « personnalisable »
   ========================================================= */
// Script classique (pas de module) : il fonctionne aussi quand le site est ouvert
// directement depuis l'explorateur (file://), où les modules locaux sont bloqués.
(async () => {
let THREE, RoomEnvironment;
try {
  THREE = await import('three');
  ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
} catch (e) {
  console.warn('[New Architect] Three.js indisponible', e);
  return;
}

const N_D = 'M0.17 57.13L0.55 56.71L2.3 58.13L18.19 73.13L18.8 74.13L18.88 113.13L17.55 113.95L1.55 113.96L0.55 113.88L0 113.13ZM77.4 0.13L92.55 0L93.55 0.21L94.07 1.13L94.04 112.13L93.55 112.95L1.55 28.3L0.04 26.13L0.03 2.13L0.55 1.08L75.55 69.87L76.08 68.13L76.75 1.13Z';
const A_D = 'M423.41 2.13L424.55 1.29L425.78 3.13L459.33 71.13L458.55 71.54L440.55 71.53L439.01 71.13L424.55 43.71L423.55 44.38L421.17 49.13L389.99 113.13L388.55 113.97L369.55 113.96L368.38 113.13ZM450.46 94.13L451.55 93.13L470.55 93.37L471.79 95.13L480.23 113.13L479.55 113.95L460.55 113.74L458.35 110.13Z';

// Animé quel que soit le réglage « Réduire les animations » du système (choix du client)
const reduce = false;

// Définition adaptative : 1,5× au mieux (1× en mode allégé), puis baisse par paliers
// si les images/s chutent, pour rester fluide sur les machines modestes
const baseDPR = () => Math.min(devicePixelRatio || 1, window.__naLite ? 1 : 1.5);
function initQuality(o) {
  o.q = 1;
  o.qSum = 0;
  o.qN = 0;
  o.renderer.setPixelRatio(baseDPR());
  window.addEventListener('na:perf-lite', () => { o.renderer.setPixelRatio(baseDPR() * o.q); o.resize(); });
}
function adaptQuality(o, dt) {
  if (dt <= 0 || dt > .25) return; // onglet en arrière-plan : ignoré
  o.qSum += dt;
  o.qN++;
  if (o.qN < 90) return;
  const avg = o.qSum / o.qN;
  o.qSum = 0;
  o.qN = 0;
  if (avg > .022 && o.q > .55) {
    o.q = Math.max(.55, o.q - .15);
    o.renderer.setPixelRatio(baseDPR() * o.q);
    o.resize();
  }
}
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/* ---------- Géométrie : tracés du logo → volumes ---------- */
function parsePolys(d) {
  const polys = [];
  let cur = null;
  const re = /([MLZ])([^MLZ]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === 'M') { cur = []; polys.push(cur); }
    if (cmd !== 'Z') for (let i = 0; i + 1 < nums.length; i += 2) cur.push([nums[i], nums[i + 1]]);
  }
  return polys;
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  let idx = -1, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = len < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps);
    const r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}
function simplifyClosed(pts, eps) {
  if (pts.length < 6) return pts;
  let k = 0, dmax = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > dmax) { dmax = d; k = i; }
  }
  const a = rdp(pts.slice(0, k + 1), eps);
  const b = rdp(pts.slice(k).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
function letterGeometry(d, height, depth, bevel) {
  const polys = parsePolys(d).map((p) => simplifyClosed(p, .6));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach((p) => p.forEach(([x, y]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }));
  const s = height / (maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const shapes = polys.map((p) => {
    const sh = new THREE.Shape();
    p.forEach(([x, y], i) => {
      const X = (x - cx) * s, Yv = -(y - cy) * s;
      if (i) sh.lineTo(X, Yv); else sh.moveTo(X, Yv);
    });
    sh.closePath();
    return sh;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .75, bevelSegments: 4, curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  return { geo, w: (maxX - minX) * s, h: height };
}
function studioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), .035).texture;
  pmrem.dispose();
  return tex;
}

/* =========================================================
   1. Intro du logo + monogramme NA noir (hero)
   Le plan « New Architect » est tracé (écran de chargement), puis les
   lettres se construisent en 3D noir brillant. Les autres lettres sont
   aspirées par le N et le A, qui se rejoignent en « NA » et s'envolent
   jusqu'à leur place dans le hero.
   Ensuite, le NA noir suit la souris et fait un tour quand on clique dessus.
   ========================================================= */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const spring = (s, target, k, c, dt) => { s.v += ((target - s.x) * k - s.v * c) * dt; s.x += s.v * dt; };
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t) => Math.pow(clamp01(t), 3);
const easeOutBack = (t) => { t = clamp01(t); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// Repères du logo complet (#logo, viewBox 1053.33 × 115.38) ; 1 unité = hauteur des capitales
const WORD_U = 1 / 113.96, WORD_CX = 1053.33 / 2, WORD_CY = 115.38 / 2, WORD_W = 1053.33 * WORD_U;
const NA_GAP = .16;
const BLUEPRINT_MS = 950; // durée du tracé du plan (main.js) avant que la 3D prenne le relais

function radialTex(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Monogramme NA (géométries partagées)
function naGeometries() {
  const n = letterGeometry(N_D, 1, .3, .045);
  const a = letterGeometry(A_D, 1, .3, .045);
  const total = n.w + NA_GAP + a.w;
  return { n: n.geo, a: a.geo, nx: -total / 2 + n.w / 2, ax: total / 2 - a.w / 2, total };
}

// Une lettre du logo complet, à sa place dans le mot (trous des lettres gérés)
function pointInPoly([px, py], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}
function wordLetter(d) {
  const polys = parsePolys(d).map((p) => simplifyClosed(p, .6));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach((p) => p.forEach(([x, y]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const isHole = polys.map((p, i) => polys.some((q, j) => j !== i && polyArea(q) > polyArea(p) && pointInPoly(p[0], q)));
  const toV = ([x, y]) => new THREE.Vector2((x - cx) * WORD_U, -(y - cy) * WORD_U);
  const shapes = polys.filter((p, i) => !isHole[i]).map((p) => {
    const s = new THREE.Shape(p.map(toV));
    polys.forEach((h, i) => { if (isHole[i] && pointInPoly(h[0], p)) s.holes.push(new THREE.Path(h.map(toV))); });
    return s;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: .3, bevelEnabled: true, bevelThickness: .045, bevelSize: .034, bevelSegments: 4, curveSegments: 6 });
  geo.translate(0, 0, -.15);
  return { geo, x: (cx - WORD_CX) * WORD_U, y: -(cy - WORD_CY) * WORD_U };
}

class LogoIntro {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    initQuality(this);
    this.scene = new THREE.Scene();
    this.scene.environment = studioEnvironment(r);
    this.camera = new THREE.PerspectiveCamera(30, 1, .5, 100);
    this.D = 9;
    this.G = naGeometries();

    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-3, 5, 6);
    // Contre-jours chauds : reflets orangés sur le noir
    this.rimL = new THREE.PointLight(0xff8a4a, 0, 0, 2);
    this.rimR = new THREE.PointLight(0xffc29a, 0, 0, 2);
    this.scene.add(key, this.rimL, this.rimR);

    this.mat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, metalness: .55, roughness: .2, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.25 });
    this.na = new THREE.Group();
    this.N = new THREE.Mesh(this.G.n, this.mat);
    this.A = new THREE.Mesh(this.G.a, this.mat);
    this.na.add(this.N, this.A);
    this.na.visible = false;
    this.scene.add(this.na);
    this.resetNA();
    // Ombre douce sous le logo (toujours face à la caméra)
    this.naShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: radialTex([[0, 'rgba(40,25,15,.55)'], [.45, 'rgba(40,25,15,.22)'], [1, 'rgba(40,25,15,0)']]),
      transparent: true, depthWrite: false, toneMapped: false,
    }));
    this.naShadow.visible = false;
    this.scene.add(this.naShadow);

    this.mouse = new THREE.Vector2(0, 0);
    this.inside = false;
    this.time = 0;
    this.acc = 0;
    this.lastScroll = window.scrollY;
    this.spin = { x: 0, v: 0 };
    this.spinTarget = 0;
    this.yaw = { x: 0, v: 0 };
    this.pitch = { x: 0, v: 0 };
    this.appear = { x: 0, v: 0 };
    this.mode = 'idle';
    this.resize();
    this.bind();
  }

  resetNA() {
    this.N.position.set(this.G.nx, 0, 0);
    this.A.position.set(this.G.ax, 0, 0);
    this.N.scale.setScalar(1);
    this.A.scale.setScalar(1);
    this.N.rotation.set(0, 0, 0);
    this.A.rotation.set(0, 0, 0);
  }

  /* ---------- Le mot complet, lettre par lettre ---------- */
  buildWord() {
    const ds = [...document.querySelectorAll('#logo path')].map((p) => p.getAttribute('d'));
    const nIdx = ds.indexOf(N_D), aIdx = ds.indexOf(A_D);
    // Le N et le A du monogramme, placés comme dans le logo complet
    const nBox = { x: (47.035 - WORD_CX) * WORD_U, y: -(56.98 - WORD_CY) * WORD_U };
    const aBox = { x: (424.305 - WORD_CX) * WORD_U, y: -(57.63 - WORD_CY) * WORD_U };
    this.nStart = nBox;
    this.aStart = aBox;
    this.aFit = 112.68 / 113.96; // le A du monogramme est normalisé sur sa propre hauteur
    this.rest = [];
    const letters = [];
    ds.forEach((d, i) => {
      if (i === nIdx) letters.push({ mesh: this.N, x: nBox.x, core: true });
      else if (i === aIdx) letters.push({ mesh: this.A, x: aBox.x, core: true });
      else {
        const L = wordLetter(d);
        const mesh = new THREE.Mesh(L.geo, this.mat);
        mesh.position.set(L.x, L.y, 0);
        this.na.add(mesh);
        const item = { mesh, x: L.x, y: L.y, to: L.x < aBox.x ? 'N' : 'A' };
        this.rest.push(item);
        letters.push(item);
      }
    });
    // Ordre de construction : de gauche à droite (comme le tracé du plan)
    letters.sort((a, b) => a.x - b.x).forEach((l, i) => { l.build = i * .04; });
    this.letters = letters;
    // Ordre d'aspiration : les plus proches d'abord, en alternant N et A
    const tx = (it) => (it.to === 'N' ? nBox.x : aBox.x);
    [...this.rest].sort((a, b) => Math.abs(a.x - tx(a)) - Math.abs(b.x - tx(b))).forEach((it, i) => {
      it.start = 1 + i * .075;
      it.lift = .35 + (i % 3) * .14;
      it.sign = it.x < tx(it) ? -1 : 1;
      it.done = false;
    });
    this.pulseN = { x: 0, v: 0 };
    this.pulseA = { x: 0, v: 0 };
  }
  clearWord() {
    (this.rest || []).forEach((it) => { this.na.remove(it.mesh); it.mesh.geometry.dispose(); });
    this.rest = [];
    this.letters = [];
    this.resetNA();
  }

  /* ---------- Interaction ---------- */
  bind() {
    const c = this.canvas;
    this.label = document.querySelector('.cursor__label');
    addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      this.inside = e.clientY >= r.top && e.clientY <= r.bottom;
      this.mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.mpx = e.clientX - r.left;
      this.mpy = e.clientY - r.top;
      this.kick();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { this.inside = false; });
    c.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'hero') return;
      const r = c.getBoundingClientRect();
      if (!this.overNA(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch' ? 1.6 : 1.1)) return;
      // Un clic : le logo fait un tour complet
      this.spinTarget = Math.round(this.spin.x / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2;
      this.kick();
    });

    new ResizeObserver(() => this.resize()).observe(c);
    this.visible = true;
    new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; this.kick(); }).observe(c);
    document.addEventListener('visibilitychange', () => this.kick());

    // L'écran de chargement trace le plan : la 3D prend le relais ensuite
    if (window.__naLoader === 'waiting') {
      window.__naLoader = 'claimed';
      this.playIntro();
      return;
    }
    const start = () => this.showHero();
    if (window.__naIntro) start();
    else window.addEventListener('na:intro', start, { once: true });
    setTimeout(start, 4000);
  }

  overNA(x, y, pad = 1.1) {
    if (!this.heroPx) return false;
    const { cx, cy, h } = this.heroPx;
    return Math.abs(x - cx) < h * this.G.total * .5 * pad && Math.abs(y - cy) < h * .5 * pad;
  }

  setLabel(text) {
    if (text === this.labelText) return;
    this.labelText = text;
    const c = this.canvas;
    if (text) c.dataset.cursor = text;
    else delete c.dataset.cursor;
    c.style.cursor = text ? 'pointer' : '';
    if (!this.label) return;
    if (text) {
      this.label.textContent = text;
      this.label.parentElement.classList.add('is-on');
    } else this.label.parentElement.classList.remove('is-on');
  }

  // Sans intro (accès direct, mouvement réduit) : le logo noir apparaît simplement
  showHero() {
    if (this.mode !== 'idle') return;
    this.mode = 'hero';
    this.na.visible = true;
    this.naShadow.visible = true;
    this.appear.x = 0;
    this.spin.x = -Math.PI;
    this.spinTarget = 0;
    this.kick();
  }

  playIntro() {
    this.clearWord();
    this.buildWord();
    this.mode = 'intro';
    // Le plan est tracé pendant BLUEPRINT_MS depuis l'ouverture de la page
    const t0 = window.__naLoaderT0;
    const wait = t0 ? Math.max(0, t0 + BLUEPRINT_MS - performance.now()) / 1000 : 0;
    this.t0 = this.time + wait;
    this.started = false;
    this.revealed = false;
    this.na.visible = false;
    this.naShadow.visible = false;
    // La page est sous l'écran de chargement : la toile passe au premier plan
    const c = this.canvas;
    if (!this.home) {
      this.home = { parent: c.parentNode, next: c.nextSibling };
      c.style.width = c.clientWidth + 'px';
      c.style.height = c.clientHeight + 'px';
      c.classList.add('is-intro');
      document.body.appendChild(c);
    }
    this.kick();
  }
  endIntro() {
    const c = this.canvas;
    if (this.home) this.home.parent.insertBefore(c, this.home.next);
    this.home = null;
    c.classList.remove('is-intro');
    c.style.width = '';
    c.style.height = '';
  }

  /* ---------- Cadrage ---------- */
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const portrait = w / h < .8;
    const wpp = 2 * this.D * Math.tan(THREE.MathUtils.degToRad(15)) / h; // unités par pixel (plan z = 0)
    // Place et taille du logo dans le hero
    const cy = h * (portrait ? .25 : .225);
    const naHpx = portrait ? Math.min(w * .19, h * .1) : Math.min(h * .17, w * .1);
    this.heroPx = { cx: w / 2, cy, h: naHpx };
    this.heroPos = new THREE.Vector3(0, (h / 2 - cy) * wpp, 0);
    this.naH = naHpx * wpp;
    // Intro : même place et même taille que le plan tracé dans l'écran de chargement
    const wordPx = Math.min(1100, w * (w <= 767 ? .86 : .7));
    const wcy = Math.min(h, window.innerHeight) / 2;
    this.wordPos = new THREE.Vector3(0, (h / 2 - wcy) * wpp, 0);
    this.wordS = wordPx * wpp / WORD_W;
    this.camera.position.set(0, 0, this.D);
    this.camera.lookAt(0, 0, 0);
    this.render();
  }

  kick() {
    if (this.raf || !this.visible || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  loop(now) {
    this.raf = 0;
    if (!this.visible || document.hidden) return;
    const raw = (now - this.last) / 1000;
    const dt = Math.max(0, Math.min(.1, raw)); // l'intro garde sa durée même à faible cadence
    this.last = now;
    adaptQuality(this, raw);
    this.frame(dt);
    this.render();
    if (this.mode !== 'idle') this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // Débogage : avance de n images (onglet ralenti)
  advance(n = 60) {
    for (let i = 0; i < n; i++) this.frame(1 / 60);
    this.render();
  }

  frame(dt) {
    this.time += dt;
    if (!this.heroPos) return; // pas encore de taille (onglet masqué)
    if (this.mode === 'intro') this.introFrame(dt);
    else if (this.mode === 'hero') this.heroFrame(dt);
  }

  /* ---------- Intro ---------- */
  introFrame(dt) {
    const e = this.time - this.t0;
    if (e < 0) return;
    if (!this.started) {
      this.started = true;
      this.na.visible = true;
      window.dispatchEvent(new Event('na:logo3d-start'));
    }
    const N = this.N, A = this.A;

    // 1. Construction : chaque lettre prend son épaisseur, de gauche à droite
    this.letters.forEach((l) => {
      const k = easeOutBack((e - l.build) / .55);
      l.mesh.visible = e >= l.build;
      l.k = Math.max(.03, k);
    });
    // Le mot s'incline pour montrer le volume, puis se remet de face
    const tilt = easeIO((e - .1) / .9) * (1 - easeIO((e - 1.75) / .8));

    // 2. Aspiration : les autres lettres décollent, tournent et filent dans le N ou le A
    this.rest.forEach((it) => {
      const u = clamp01((e - it.start) / .62);
      const m = it.mesh;
      if (u >= 1) {
        if (!it.done) {
          it.done = true;
          (it.to === 'N' ? this.pulseN : this.pulseA).v += 4.2;
        }
        m.visible = false;
        return;
      }
      const tgt = it.to === 'N' ? N.position : A.position;
      const p = easeIn(u);
      m.position.set(lerp(it.x, tgt.x, p), lerp(it.y, tgt.y, p) + Math.sin(u * Math.PI) * it.lift, Math.sin(u * Math.PI) * .9);
      m.rotation.set(Math.sin(u * Math.PI) * .5, it.sign * u * Math.PI * 1.3, it.sign * u * .7);
      const s = 1 - p * .96;
      m.scale.set(s, s, s * it.k);
    });

    // 3. Le N et le A se rejoignent en monogramme
    const sl = easeIO((e - 1.85) / .8);
    spring(this.pulseN, 0, 220, 11, dt);
    spring(this.pulseA, 0, 220, 11, dt);
    const nk = this.letters.find((l) => l.mesh === N).k, ak = this.letters.find((l) => l.mesh === A).k;
    const pn = 1 + this.pulseN.x * .1, pa = (1 + this.pulseA.x * .1) * lerp(this.aFit, 1, sl);
    N.position.set(lerp(this.nStart.x, this.G.nx, sl), lerp(this.nStart.y, 0, sl), 0);
    A.position.set(lerp(this.aStart.x, this.G.ax, sl), lerp(this.aStart.y, 0, sl), 0);
    N.scale.set(pn, pn, pn * nk);
    A.scale.set(pa, pa, pa * ak);

    // 4. Le NA s'envole jusqu'à sa place dans le hero, en faisant un tour
    const fly = easeIO((e - 2.5) / 1.25);
    this.na.scale.setScalar(lerp(this.wordS, this.naH, fly));
    this.na.position.copy(this.wordPos).lerp(this.heroPos, fly);
    this.na.position.z += Math.sin(fly * Math.PI) * this.naH * .7;
    this.na.rotation.set(tilt * .16, -tilt * .34 + Math.PI * 2 * easeIO((e - 2.45) / 1.35), 0);
    this.naShadow.visible = true;
    this.naShadow.material.opacity = smoothstep(.55, 1, fly);
    this.placeShadow();
    this.rimL.intensity = 22;
    this.rimR.intensity = 15;
    this.placeRims(this.na.position, this.na.scale.x);

    if (!this.revealed && e > 3.1) {
      this.revealed = true;
      window.dispatchEvent(new Event('na:logo3d-reveal'));
    }
    // Le fondu de l'écran de chargement (1 s) est terminé : la toile retourne dans le hero
    if (e > 4.2) {
      this.clearWord();
      this.endIntro();
      this.mode = 'hero';
      this.appear.x = 1;
      this.spin.x = 0;
      this.spin.v = 0;
      this.spinTarget = 0;
      this.yaw.x = 0;
      this.pitch.x = 0;
    }
  }

  placeRims(p, s) {
    this.rimL.position.set(p.x - s * 2.6, p.y + s * .6, p.z - s * 1.2);
    this.rimR.position.set(p.x + s * 2.6, p.y - s * .2, p.z - s * 1.1);
  }
  placeShadow() {
    const s = this.naH;
    this.naShadow.position.set(this.heroPos.x, this.heroPos.y - s * .78, this.heroPos.z - s * .3);
    this.naShadow.scale.set(s * this.G.total * 1.25, s * .34, 1);
  }

  /* ---------- Le logo noir du hero ---------- */
  heroFrame(dt) {
    const t = this.time;
    const m = this.mouse;
    const over = this.inside && this.mpx != null && this.overNA(this.mpx, this.mpy);
    this.setLabel(over ? 'Cliquez' : null);
    const sy = window.scrollY;
    const vel = dt > 0 ? (sy - this.lastScroll) / dt : 0;
    this.lastScroll = sy;
    this.acc += dt;
    const h = 1 / 120;
    let n = 0;
    while (this.acc >= h && n < 10) {
      spring(this.appear, 1, 60, 11, h);
      spring(this.yaw, this.inside ? Math.max(-1, Math.min(1, m.x)) * .55 : Math.sin(t * .5) * .22, 22, 7, h);
      spring(this.pitch, this.inside ? -Math.max(-1, Math.min(1, m.y - .4)) * .3 : Math.sin(t * .37) * .05 + Math.max(-.25, Math.min(.25, vel * .0004)), 22, 7, h);
      spring(this.spin, this.spinTarget, 34, 8.5, h);
      this.acc -= h;
      n++;
    }
    if (n === 10) this.acc = 0;
    const s = this.naH * Math.max(0, this.appear.x);
    this.na.scale.setScalar(Math.max(s, 1e-4));
    this.na.position.copy(this.heroPos);
    this.na.position.y += Math.sin(t * 1.2) * this.naH * .035;
    this.na.rotation.set(this.pitch.x, this.yaw.x + this.spin.x, 0);
    this.placeShadow();
    this.naShadow.material.opacity = clamp01(this.appear.x) * (1 - Math.sin(t * 1.2) * .08);
    this.rimL.intensity = 22;
    this.rimR.intensity = 15;
    this.placeRims(this.heroPos, this.naH);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

/* =========================================================
   2. Lettres chromées réglables
   ========================================================= */
const MATS = {
  silver: { color: 0xffffff, metalness: 1, clearcoat: .3 },
  gold: { color: 0xffc66e, metalness: 1, clearcoat: .3 },
  black: { color: 0x141414, metalness: .25, clearcoat: 1 },
  copper: { color: 0xf0986a, metalness: 1, clearcoat: .3 },
};
const FINISH = { mirror: .05, satin: .28, matte: .56 };

class ChromeTile {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    initQuality(this);
    this.scene = new THREE.Scene();
    this.scene.environment = studioEnvironment(r);
    this.camera = new THREE.PerspectiveCamera(28, 1, .1, 40);
    this.camera.position.set(0, 0, 6.4);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-3, 4, 5);
    this.scene.add(key);

    this.mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .05, envMapIntensity: 1.4, clearcoat: .3 });
    this.group = new THREE.Group();
    const n = letterGeometry(N_D, 1.08, .34, .05);
    const a = letterGeometry(A_D, 1.08, .34, .05);
    this.n = new THREE.Mesh(n.geo, this.mat);
    this.a = new THREE.Mesh(a.geo, this.mat);
    this.n.position.y = .64;
    this.a.position.y = -.64;
    this.group.add(this.n, this.a);
    this.scene.add(this.group);

    this.params = { speed: 78, tilt: 28, material: 'silver', finish: 'mirror' };
    document.querySelectorAll('.tw__slider').forEach((s) => { this.params[s.dataset.param] = +s.dataset.value; });
    window.addEventListener('na:tweak', (e) => this.set(e.detail.param, e.detail.value));
    this.applyMaterial();

    this.rot = .4;
    this.hoverX = 0;
    this.hoverY = 0;
    this.tx = 0;
    this.ty = 0;
    const tile = canvas.parentElement;
    tile.addEventListener('pointermove', (e) => {
      const b = tile.getBoundingClientRect();
      this.tx = ((e.clientX - b.left) / b.width - .5) * 2;
      this.ty = ((e.clientY - b.top) / b.height - .5) * 2;
    });
    tile.addEventListener('pointerleave', () => { this.tx = 0; this.ty = 0; });

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.visible = false;
    new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; this.kick(); }, { rootMargin: '10% 0px' }).observe(canvas);
    this.resize();
  }
  set(param, value) {
    this.params[param] = value;
    if (param === 'material' || param === 'finish') this.applyMaterial();
    this.kick();
  }
  applyMaterial() {
    const m = MATS[this.params.material] || MATS.silver;
    this.mat.color.setHex(m.color);
    this.mat.metalness = m.metalness;
    this.mat.clearcoat = m.clearcoat;
    this.mat.roughness = (FINISH[this.params.finish] ?? .05) + (this.params.material === 'black' ? .05 : 0);
    this.mat.needsUpdate = true;
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  kick() {
    if (this.raf || !this.visible) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  loop(now) {
    this.raf = 0;
    if (!this.visible) return;
    const raw = (now - this.last) / 1000;
    const dt = Math.max(0, Math.min(.05, raw));
    this.last = now;
    adaptQuality(this, raw);
    const t = now / 1000;
    const speed = reduce ? 0 : .25 + (this.params.speed / 100) * 2.8;
    this.rot += dt * speed;
    this.hoverX += (this.tx - this.hoverX) * .06;
    this.hoverY += (this.ty - this.hoverY) * .06;
    this.n.rotation.y = this.rot + this.hoverX * .6;
    this.a.rotation.y = this.rot + .6 + this.hoverX * .6;
    this.group.rotation.x = (this.params.tilt / 100 - .5) * 1.1 + this.hoverY * .25 + Math.sin(t * .8) * .03;
    this.group.position.y = Math.sin(t * 1.1) * .03;
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  }
}

/* ---------- Démarrage ---------- */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

if (webglOK()) {
  const heroCanvas = document.querySelector('.hero__gl');
  if (heroCanvas) {
    try {
      const li = new LogoIntro(heroCanvas);
      window.__na = Object.assign(window.__na || {}, { logo: li });
    } catch (e) {
      console.warn('[New Architect] intro 3D indisponible', e);
      heroCanvas.remove();
    }
  }
  const tileCanvas = document.querySelector('.tweak__gl');
  if (tileCanvas) {
    try {
      const ct = new ChromeTile(tileCanvas);
      window.__na = Object.assign(window.__na || {}, { chrome: ct });
      // Les lettres 3D remplacent le « NA » de secours en CSS
      tileCanvas.parentElement.classList.add('is-3d');
    } catch (e) {
      console.warn('[New Architect] lettres 3D indisponibles', e);
    }
  }
}
})();
