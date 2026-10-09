/* =========================================================
   New Architect — v2 · animations (Lenis + GSAP ScrollTrigger)
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);

  const root = document.documentElement;
  // Le site reste animé même si le système demande de « réduire les animations » (choix du client) :
  // l'intro et le scroll fluide font partie de l'expérience.
  const reduce = false;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Mode allégé pour les machines modestes ----------
     Activé d'emblée si la carte graphique est émulée (accélération matérielle coupée)
     ou si la machine est très petite, puis en cours de route si les images/s chutent. */
  const setLite = () => {
    if (window.__naLite) return;
    window.__naLite = true;
    root.classList.add('perf-lite');
    window.dispatchEvent(new Event('na:perf-lite'));
  };
  (() => {
    let slowGL = false;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
      if (!gl) slowGL = true;
      else {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
        slowGL = /swiftshader|llvmpipe|software|basic render|softpipe/i.test(name);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { slowGL = true; }
    const small = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
    const save = navigator.connection && navigator.connection.saveData;
    if (slowGL || small || save) setLite();
  })();
  // Surveillance : si la moyenne passe sous ~36 images/s deux fois de suite, on allège
  (() => {
    let last = performance.now(), sum = 0, n = 0, strikes = 0, windowStart = last;
    const stopAt = last + 60000;
    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (window.__naLite || now > stopAt) return;
      if (!document.hidden && dt < 250) { sum += dt; n++; } // onglet en arrière-plan : ignoré
      if (now - windowStart > 2000) {
        if (n >= 40) strikes = sum / n > 28 ? strikes + 1 : 0;
        if (strikes >= 2) { setLite(); return; }
        sum = 0; n = 0; windowStart = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();

  // Sans GSAP (CDN indisponible) : on affiche simplement tout le contenu.
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  /* ---------- Scroll fluide ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.095, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const debug = new URLSearchParams(location.search).has('debug');
  window.__na = Object.assign(window.__na || {}, {
    lenis,
    // Débogage (onglet masqué = images ralenties) : termine toutes les animations en cours
    finish() { gsap.globalTimeline.getChildren(false, true, true).forEach((t) => { if (!t.scrollTrigger) t.progress(1); }); },
    // Va instantanément à une position de scroll puis termine les animations
    go(y) {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      ScrollTrigger.update();
      this.finish();
      ScrollTrigger.update();
      this.finish();
    },
  });

  /* ---------- Découpage en mots (jamais de mot coupé) ---------- */
  function wrapWords(el) {
    if (el.__words) return el.__words;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/([ \t\n\r]+)/);
          if (parts.every((p) => !p.trim())) {
            if (child.textContent.length) child.textContent = ' ';
            return;
          }
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) frag.appendChild(document.createTextNode(' '));
            else {
              const s = document.createElement('span');
              s.className = 'w';
              s.textContent = p;
              frag.appendChild(s);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          if (child.hasAttribute('data-keep')) child.classList.add('w');
          else if (child.tagName !== 'BR' && !child.classList.contains('st-slot')) walk(child);
        }
      });
    };
    walk(el);
    el.__words = $$('.w', el).filter((w) => !w.parentElement.closest('.w'));
    return el.__words;
  }
  // Index de ligne de chaque mot (pour révéler ligne par ligne)
  function lineIndex(words) {
    const tops = [];
    return words.map((w) => {
      const t = w.offsetTop;
      let i = tops.findIndex((v) => Math.abs(v - t) < 8);
      if (i < 0) { tops.push(t); i = tops.length - 1; }
      return i;
    });
  }

  /* ---------- Préchargement puis intro du hero ---------- */
  const loader = $('.loader');
  const heroTitle = $('[data-hero-title]');
  const heroWords = heroTitle ? wrapWords(heroTitle) : [];

  function heroIntro() {
    if (heroWords.length) gsap.fromTo(heroWords, { y: 0, yPercent: 38, opacity: 0 }, { y: 0, yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: .075 });
    const sub = $('[data-hero-sub]');
    const cta = $('[data-hero-cta]');
    if (sub) gsap.fromTo(sub, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', delay: .35 });
    if (cta) gsap.fromTo(cta, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', delay: .5 });
    window.__naIntro = true;
    window.dispatchEvent(new Event('na:intro'));
    // Arrivée depuis une autre page avec une ancre (ex. index.html#tarifs)
    let target = null;
    try { target = location.hash && document.querySelector(decodeURIComponent(location.hash)); } catch (e) { target = null; }
    if (target) {
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
        else target.scrollIntoView();
      });
    }
  }

  function runLoader() {
    const t0 = performance.now();
    if (!loader || reduce || debug) {
      loader && loader.classList.add('is-done');
      heroIntro();
      return;
    }
    lenis && lenis.stop();
    root.style.overflow = 'hidden';
    buildBlueprint();
    window.__naLoaderT0 = t0;
    requestAnimationFrame(() => requestAnimationFrame(() => loader.classList.add('is-in')));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.__naLoader = 'gone';
      loader.classList.add('is-done');
      root.style.overflow = '';
      lenis && lenis.start();
      heroIntro();
      ScrollTrigger.refresh();
    };
    // three-scenes.js « réserve » l'intro (état « claimed »), construit le logo en 3D
    // par-dessus le plan, puis donne le signal de sortie
    window.__naLoader = 'waiting';
    addEventListener('na:logo3d-start', () => {
      if (window.__naLoader !== 'claimed') return;
      window.__naLoader = '3d';
      loader.classList.add('is-3d');
    });
    addEventListener('na:logo3d-reveal', finish);
    // Sans 3D (connexion lente, pas de WebGL) : le plan se remplit d'encre, puis sortie classique
    setTimeout(() => {
      if (window.__naLoader !== 'waiting') return;
      window.__naLoader = 'leaving';
      loader.classList.add('is-fill');
      setTimeout(() => loader.classList.add('is-out'), 650);
      setTimeout(finish, 1150);
    }, Math.max(0, 3200 - (performance.now() - t0)));
    setTimeout(finish, 9000); // sécurité
  }

  // Plan d'architecte du logo, tracé pendant le chargement
  function buildBlueprint() {
    const svg = $('.loader__bp', loader);
    const src = [...document.querySelectorAll('#logo path')];
    if (!svg || !src.length) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, cls) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      n.setAttribute('class', cls);
      svg.appendChild(n);
      return n;
    };
    const W = 1053.33, B = 113.96;
    const k = W / Math.max(1, svg.getBoundingClientRect().width); // unités du plan par pixel
    const px = (v) => +(v * k).toFixed(2);
    const draw = (n, width, delay) => {
      n.style.strokeWidth = px(width);
      n.style.transitionDelay = `${delay}s`;
      n.style.setProperty('--len', (n.getTotalLength ? n.getTotalLength() : 2000) + 1);
    };
    // Lignes de construction : capitales, hauteur d'x, ligne de base, bords
    [[-90, 0, W + 90, 0], [-90, 38.5, W + 90, 38.5], [-90, B, W + 90, B], [0, -55, 0, B + 55], [W, -55, W, B + 55]]
      .forEach(([x1, y1, x2, y2], i) => draw(el('line', { x1, y1, x2, y2 }, 'bp-guide'), .8, i * .07));
    // Repères en croix aux angles
    [[0, 0], [W, 0], [0, B], [W, B]].forEach(([x, y], i) => {
      draw(el('path', { d: `M${x - px(8)} ${y}H${x + px(8)}M${x} ${y - px(8)}V${y + px(8)}` }, 'bp-mark'), 1, .4 + i * .05);
    });
    // Cote sous le mot
    const dy = B + px(30);
    draw(el('path', { d: `M0 ${dy}H${W}M0 ${dy - px(5)}V${dy + px(5)}M${W} ${dy - px(5)}V${dy + px(5)}` }, 'bp-dim'), .8, .3);
    const label = (x, y, anchor, text) => {
      const t = el('text', { x, y, 'text-anchor': anchor, 'font-size': px(10.5) }, 'bp-label');
      t.textContent = text;
    };
    label(0, -px(14), 'start', 'NEW ARCHITECT — PLAN N° 01');
    label(W, -px(14), 'end', 'ÉCH. 1:1');
    label(W / 2, dy + px(17), 'middle', '1053 × 115');
    // Contours des lettres, de gauche à droite
    const minX = (d) => Math.min(...d.match(/-?[\d.]+/g).filter((_, i) => i % 2 === 0).map(Number));
    src.map((p) => ({ d: p.getAttribute('d'), x: minX(p.getAttribute('d')) }))
      .sort((a, b) => a.x - b.x)
      .forEach(({ d }, i) => draw(el('path', { d, 'fill-rule': 'evenodd' }, 'bp-line'), 1.15, .12 + i * .05));
  }

  /* ---------- En-tête : compact au scroll + menu ---------- */
  const hdr = $('.hdr');
  const toggle = $('.hdr__toggle');
  const onScrollHeader = (y) => hdr && hdr.classList.toggle('is-compact', y > 60);
  if (lenis) lenis.on('scroll', (l) => onScrollHeader(l.scroll));
  else addEventListener('scroll', () => onScrollHeader(scrollY), { passive: true });

  function setMenu(open) {
    if (!hdr) return;
    hdr.classList.toggle('is-open', open);
    root.classList.toggle('is-menu', open);
    toggle && toggle.setAttribute('aria-expanded', String(open));
    const sr = toggle && $('.sr-only', toggle);
    if (sr) sr.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
  }
  toggle && toggle.addEventListener('click', () => setMenu(!hdr.classList.contains('is-open')));
  $('.veil') && $('.veil').addEventListener('click', () => setMenu(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Ancres : défilement doux
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') { e.preventDefault(); return; }
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- Curseur à étiquette ---------- */
  const cursor = $('.cursor');
  const cursorLabel = $('.cursor__label');
  if (finePointer && cursor) {
    let cx = -100, cy = -100, tx = -100, ty = -100;
    const updateZone = (target) => {
      const zone = target && target.closest && target.closest('[data-cursor]');
      if (zone) {
        if (cursorLabel.textContent !== zone.dataset.cursor) cursorLabel.textContent = zone.dataset.cursor;
        cursor.classList.add('is-on');
      } else cursor.classList.remove('is-on');
    };
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; updateZone(e.target); }, { passive: true });
    // Au scroll, la zone sous le pointeur change sans mouvement de souris
    const onScrollCursor = () => { if (tx > 0) updateZone(document.elementFromPoint(tx, ty)); };
    if (lenis) lenis.on('scroll', onScrollCursor);
    else addEventListener('scroll', onScrollCursor, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    gsap.ticker.add(() => {
      cx += (tx - cx) * .24;
      cy += (ty - cy) * .24;
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    });
  } else if (cursor) cursor.remove();

  /* ---------- Révélations ---------- */
  $$('[data-split]').forEach((el) => {
    const words = wrapWords(el);
    if (!words.length) return;
    gsap.set(words, { y: 14, opacity: 0 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () => {
        const li = lineIndex(words);
        words.forEach((w, i) => gsap.to(w, { y: 0, opacity: 1, duration: 1.15, ease: 'expo.out', delay: li[i] * .085 }));
      },
    });
  });

  $$('[data-reveal]').forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const delay = siblings.length > 1 ? siblings.indexOf(el) * .09 : 0;
    gsap.set(el, { y: 40, opacity: 0 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 1.35, ease: 'expo.out', delay, clearProps: 'transform' }),
    });
  });

  // Logos du bandeau : glissent depuis le bas
  const tks = $$('.ticker__set .tk');
  if (tks.length) {
    gsap.set(tks, { y: 30, opacity: 0 });
    ScrollTrigger.create({
      trigger: '.ticker__viewport',
      start: 'top 94%',
      once: true,
      onEnter: () => gsap.to(tks, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .035 }),
    });
  }

  // Animations CSS en boucle : seulement quand c'est visible
  const statementEl = $('.statement');
  statementEl && statementEl.setAttribute('data-anim', '');
  const visIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('is-visible', en.isIntersecting));
  }, { rootMargin: '15% 0px' });
  $$('[data-anim]').forEach((el) => visIO.observe(el));

  /* =========================================================
     3. Manifeste : mots qui s'allument + tuiles qui volent
     ========================================================= */
  const st = $('[data-statement]');
  if (st) {
    const words = wrapWords(st);
    const slots = $$('.st-slot', st);
    const tiles = $$('[data-tile]');
    const seq = $$('.w, .st-slot', st);
    const slotWord = slots.map((s) => {
      for (let k = seq.indexOf(s) - 1; k >= 0; k--) if (seq[k].classList.contains('w')) return words.indexOf(seq[k]);
      return 0;
    });
    const hues = words.map((_, i) => 205 + ((i * 41) % 130));
    const rot = [-7, 5, -4, 8, -6];
    const ink = [15, 15, 15];
    let wordP = 0, flyP = 0, geo = [];

    const hsl = (h, s, l) => {
      s /= 100; l /= 100;
      const k = (n) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      return [f(0) * 255, f(8) * 255, f(4) * 255];
    };
    const wordT = (i) => clamp(wordP * (words.length + 5) - i, 0, 5) / 5;

    function renderWords() {
      words.forEach((w, i) => {
        const t = wordT(i);
        const blur = Math.pow(1 - t, 2) * 12;
        const m = smooth(clamp((t - .25) / .75));
        const from = hsl(hues[i], 92, 68);
        const c = from.map((v, k) => Math.round(lerp(v, ink[k], m)));
        w.style.opacity = clamp(t * 3).toFixed(3);
        w.style.filter = blur > .05 ? `blur(${blur.toFixed(2)}px)` : 'none';
        w.style.color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      });
    }
    function measure() {
      geo = tiles.map((t, i) => {
        const a = slots[i].getBoundingClientRect();
        const b = t.parentElement.getBoundingClientRect();
        if (!b.width) return null;
        return {
          dx: a.left + a.width / 2 - (b.left + b.width / 2),
          dy: a.top + a.height / 2 - (b.top + b.height / 2),
          s: a.width / b.width,
        };
      });
    }
    function renderTiles() {
      tiles.forEach((t, i) => {
        const g = geo[i];
        if (!g) return;
        const appear = easeOut(clamp(wordT(slotWord[i]) * 1.5));
        const q = clamp((flyP - i * .07) / (1 - 4 * .07));
        const e = easeInOut(q);
        const x = g.dx * (1 - e);
        const y = g.dy * (1 - e) - Math.sin(Math.PI * e) * 40;
        const s = lerp(g.s, 1, e) * lerp(.35, 1, appear);
        const r = Math.sin(Math.PI * e) * rot[i];
        t.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        t.style.opacity = Math.max(appear, q > 0 ? 1 : 0).toFixed(3);
      });
    }

    ScrollTrigger.create({
      trigger: st,
      start: 'top 84%',
      end: 'bottom 46%',
      scrub: .35,
      onUpdate: (s) => { wordP = s.progress; renderWords(); renderTiles(); },
    });
    ScrollTrigger.create({
      trigger: '.statement__top',
      start: 'center 40%',
      endTrigger: '.tl',
      end: 'center 58%',
      scrub: .6,
      onUpdate: (s) => { flyP = s.progress; renderTiles(); },
    });
    ScrollTrigger.addEventListener('refresh', () => { measure(); renderWords(); renderTiles(); });
    measure(); renderWords(); renderTiles();
    window.__na.statement = { measure, renderTiles };
  }

  /* ---------- Tuile « trame » (canvas) ---------- */
  const A_PATH = 'M423.41 2.13L424.55 1.29L425.78 3.13L459.33 71.13L458.55 71.54L440.55 71.53L439.01 71.13L424.55 43.71L423.55 44.38L421.17 49.13L389.99 113.13L388.55 113.97L369.55 113.96L368.38 113.13ZM450.46 94.13L451.55 93.13L470.55 93.37L471.79 95.13L480.23 113.13L479.55 113.95L460.55 113.74L458.35 110.13Z';
  $$('[data-halftone]').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    const N = 30;
    const off = document.createElement('canvas');
    off.width = off.height = N;
    const octx = off.getContext('2d', { willReadFrequently: true });
    const pathA = new Path2D(A_PATH);
    let size = 0, running = false, raf = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      size = Math.max(60, Math.round(canvas.clientWidth * dpr)) || 240;
      canvas.width = canvas.height = size;
    };
    const draw = (t) => {
      octx.fillStyle = '#fff';
      octx.fillRect(0, 0, N, N);
      const g = octx.createRadialGradient(N * .3, N * .25, 0, N * .5, N * .5, N * .8);
      g.addColorStop(0, '#fff');
      g.addColorStop(1, '#d6d6d6');
      octx.fillStyle = g;
      octx.fillRect(0, 0, N, N);
      const sx = Math.cos(t * .8);
      const shade = Math.round(30 + 150 * (1 - Math.abs(sx)) + 40 * Math.max(0, -sx));
      octx.save();
      octx.translate(N / 2, N / 2);
      octx.scale((sx * .72 * N) / 113, (.72 * N) / 113);
      octx.translate(-424.3, -57.6);
      octx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 10})`;
      octx.fill(pathA);
      octx.restore();
      const data = octx.getImageData(0, 0, N, N).data;
      const cell = size / N;
      ctx.fillStyle = '#e7e8ff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#1f2bff';
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const lum = data[(j * N + i) * 4] / 255;
          const wave = .5 + .5 * Math.sin(i * .38 + j * .24 - t * 2.2);
          const dark = Math.max(1 - lum, .05 + .14 * wave);
          const r = cell * .52 * Math.sqrt(dark);
          if (r > .35) {
            ctx.beginPath();
            ctx.arc((i + .5) * cell, (j + .5) * cell, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
    const loop = (now) => {
      if (!running) return;
      draw(now / 1000);
      raf = requestAnimationFrame(loop);
    };
    resize();
    draw(0);
    new ResizeObserver(() => { resize(); draw(performance.now() / 1000); }).observe(canvas);
    const scope = canvas.closest('[data-anim]') || canvas;
    new IntersectionObserver(([en]) => {
      running = en.isIntersecting && !reduce;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(loop);
    }, { rootMargin: '10% 0px' }).observe(scope);
  });

  /* =========================================================
     4. Bloc pour chaque idée : effets au survol des tuiles
     ========================================================= */
  const fx = $('[data-fx]');
  if (fx) {
    const title = $('.fx__title:not(.fx__halftone)', fx);
    const focusWord = $('.fx__word', fx);
    const cells = $$('.lib__cell');
    const effects = ['inflate', 'glow', 'focus', 'halftone'];
    const setEffect = (name) => {
      effects.forEach((n) => fx.classList.remove('effect-' + n));
      cells.forEach((c) => c.classList.toggle('is-on', c.dataset.effect === name));
      if (!name) return;
      if (name === 'focus') {
        const words = wrapWords(title);
        const fr = focusWord.getBoundingClientRect();
        const fcx = fr.left + fr.width / 2;
        const fcy = fr.top + fr.height / 2;
        words.forEach((w) => {
          const r = w.getBoundingClientRect();
          const d = Math.hypot((r.left + r.width / 2 - fcx) * .85, (r.top + r.height / 2 - fcy) * 1.7);
          w.style.setProperty('--blur', clamp((d - fr.width * .9) / 34, 0, 9).toFixed(2) + 'px');
        });
      }
      fx.classList.add('effect-' + name);
    };
    cells.forEach((c) => {
      c.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setEffect(c.dataset.effect); });
      c.addEventListener('focus', () => setEffect(c.dataset.effect));
      c.addEventListener('click', () => setEffect(fx.classList.contains('effect-' + c.dataset.effect) && matchMedia('(hover: none)').matches ? null : c.dataset.effect));
    });
    const grid = $('.lib__grid');
    grid.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') setEffect(null); });
    grid.addEventListener('focusout', (e) => { if (!grid.contains(e.relatedTarget)) setEffect(null); });
  }

  /* =========================================================
     5. Personnalisable : mots qui se colorent + panneau de réglages
     ========================================================= */
  $$('[data-words]').forEach((el) => {
    const words = wrapWords(el);
    const from = [201, 184, 184];
    const render = (p) => {
      const n = words.length;
      words.forEach((w, i) => {
        const t = clamp(p * (n + 3) - i, 0, 3) / 3;
        w.style.color = `rgb(${from.map((f, k) => Math.round(lerp(f, 15, t))).join(',')})`;
      });
    };
    render(0);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      end: 'bottom 50%',
      scrub: .5,
      onUpdate: (s) => { render(s.progress); el.classList.toggle('is-wiggle', s.progress > .6); },
    });
  });

  const tweak = $('.tweak');
  if (tweak) {
    const emit = (param, value) => window.dispatchEvent(new CustomEvent('na:tweak', { detail: { param, value } }));
    $$('.tw__slider', tweak).forEach((sl) => {
      const out = $('b', sl);
      const set = (v) => {
        v = Math.round(clamp(v, 0, 100));
        sl.dataset.value = v;
        sl.style.setProperty('--v', v);
        out.textContent = v;
        sl.setAttribute('aria-valuenow', v);
        emit(sl.dataset.param, v);
      };
      set(+sl.dataset.value);
      const fromEvent = (e) => {
        const r = sl.getBoundingClientRect();
        set(((e.clientX - r.left) / r.width) * 100);
      };
      sl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sl.setPointerCapture(e.pointerId);
        fromEvent(e);
        const move = (ev) => fromEvent(ev);
        const up = () => {
          sl.removeEventListener('pointermove', move);
          sl.removeEventListener('pointerup', up);
          sl.removeEventListener('pointercancel', up);
        };
        sl.addEventListener('pointermove', move);
        sl.addEventListener('pointerup', up);
        sl.addEventListener('pointercancel', up);
      });
      sl.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
        if (d) { e.preventDefault(); set(+sl.dataset.value + d); }
      });
    });
    const mats = [['silver', 'Argent brillant'], ['gold', 'Or poli'], ['black', 'Noir laqué'], ['copper', 'Cuivre']];
    let mi = 0;
    const sel = $('.tw__select', tweak);
    sel.addEventListener('click', () => {
      mi = (mi + 1) % mats.length;
      $('.tw__val', sel).textContent = mats[mi][1];
      emit('material', mats[mi][0]);
    });
    const segs = $$('.tw__segs button', tweak);
    segs.forEach((b) => b.addEventListener('click', () => {
      segs.forEach((x) => x.classList.toggle('is-on', x === b));
      emit('finish', b.dataset.v);
    }));
  }

  /* =========================================================
     6. Kit de marque : section épinglée, l'appli glisse par-dessus
     ========================================================= */
  const kit = $('.kit');
  if (kit) {
    const app = $('.kit__app', kit);
    const text = $('.kit__text', kit);
    const rows = $$('[data-kit-row]', kit);
    const mobile = () => innerWidth < 768;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: kit,
        start: 'top top',
        end: () => '+=' + Math.round(innerHeight * 1.7),
        pin: true,
        scrub: .7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    tl.fromTo(app, { x: () => (mobile() ? innerWidth : innerWidth * .5) }, { x: 0, ease: 'none' }, 0)
      .fromTo(text, { x: 0, opacity: 1 }, { x: () => (mobile() ? 0 : -innerWidth * .38), opacity: () => (mobile() ? 1 : 0), ease: 'none' }, 0)
      .fromTo(rows[0], { x: 0 }, { x: () => -innerWidth * .06, ease: 'none' }, 0)
      .fromTo(rows[1], { x: 0 }, { x: () => -innerWidth * .18, ease: 'none' }, 0);
  }

  /* =========================================================
     8. Trois façons : onglets + volet balayé
     ========================================================= */
  const ways = $$('.way');
  const wm = $$('.wm');
  if (ways.length) {
    let wi = 0, timer = 0, inView = false, hoverT = 0;
    const typeEl = $('[data-type]');
    const typeText = typeEl ? typeEl.textContent : '';
    const describe = $('.wm--describe');
    const codeBox = $('.wm--code');
    const codeEl = $('[data-code]');
    let typeTimer = 0, codeTimer = 0;
    const CODE = [
      '<span class="tk-com">&lt;!-- Accueil · Le Rivage --&gt;</span>',
      '<span class="tk-tag">&lt;section</span> <span class="tk-attr">class</span>=<span class="tk-str">"hero"</span><span class="tk-tag">&gt;</span>',
      '  <span class="tk-tag">&lt;h1</span> <span class="tk-attr">class</span>=<span class="tk-str">"titre"</span><span class="tk-tag">&gt;</span>Le Rivage<span class="tk-tag">&lt;/h1&gt;</span>',
      '  <span class="tk-tag">&lt;a</span> <span class="tk-attr">href</span>=<span class="tk-str">"#reserver"</span><span class="tk-tag">&gt;</span>Réserver<span class="tk-tag">&lt;/a&gt;</span>',
      '<span class="tk-tag">&lt;/section&gt;</span>',
      '',
      '<span class="tk-key">gsap</span>.from(<span class="tk-str">".titre"</span>, {',
      '  y: <span class="tk-key">40</span>, opacity: <span class="tk-key">0</span>,',
      '  scrollTrigger: <span class="tk-str">".hero"</span>,',
      '});',
    ];
    const startTyping = () => {
      if (!typeEl) return;
      clearInterval(typeTimer);
      describe.classList.remove('is-sent');
      typeEl.textContent = '';
      let i = 0;
      typeTimer = setInterval(() => {
        i++;
        typeEl.textContent = typeText.slice(0, i);
        if (i >= typeText.length) {
          clearInterval(typeTimer);
          setTimeout(() => describe.classList.add('is-sent'), 380);
        }
      }, 40);
    };
    const startCode = () => {
      if (!codeEl) return;
      clearInterval(codeTimer);
      codeBox.classList.remove('is-built');
      codeEl.innerHTML = '';
      let i = 0;
      codeTimer = setInterval(() => {
        codeEl.innerHTML += (i ? '\n' : '') + CODE[i];
        i++;
        if (i >= CODE.length) {
          clearInterval(codeTimer);
          setTimeout(() => codeBox.classList.add('is-built'), 260);
        }
      }, 230);
    };
    const restart = () => {
      clearTimeout(timer);
      if (inView && !reduce) timer = setTimeout(() => setWay((wi + 1) % ways.length), 7000);
    };
    const setWay = (i) => {
      wi = i;
      ways.forEach((w, k) => { w.classList.toggle('is-active', k === i); w.setAttribute('aria-selected', String(k === i)); });
      wm.forEach((m, k) => m.classList.toggle('is-active', k === i));
      if (i === 1) startTyping();
      if (i === 2) startCode();
      restart();
    };
    ways.forEach((w, i) => {
      w.addEventListener('click', () => { if (wi !== i) setWay(i); });
      w.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(hoverT);
        hoverT = setTimeout(() => { if (wi !== i) setWay(i); }, 140);
      });
      w.addEventListener('pointerleave', () => clearTimeout(hoverT));
    });
    ScrollTrigger.create({
      trigger: '.ways',
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (s) => { inView = s.isActive; restart(); },
    });
  }

  /* =========================================================
     9. Carrousel infini (défilement auto + glisser)
     ========================================================= */
  const gv = $('.gal__viewport');
  const gt = $('.gal__track');
  if (gv && gt) {
    const originals = Array.from(gt.children);
    originals.forEach((n) => {
      const c = n.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      gt.appendChild(c);
    });
    const cards = Array.from(gt.children);
    let x = 0, half = 0, vel = 0, drag = false, lastX = 0, hover = false, inView = false;
    const measureTrack = () => { half = gt.scrollWidth / 2; };
    measureTrack();
    addEventListener('resize', measureTrack);
    document.fonts && document.fonts.ready.then(measureTrack);
    gv.addEventListener('pointerenter', () => { hover = true; });
    gv.addEventListener('pointerleave', () => { hover = false; });
    gv.addEventListener('pointerdown', (e) => {
      drag = true;
      lastX = e.clientX;
      vel = 0;
      gv.setPointerCapture(e.pointerId);
      gv.classList.add('is-drag');
    });
    gv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      x += dx;
      vel = dx;
    });
    const end = () => { drag = false; gv.classList.remove('is-drag'); };
    gv.addEventListener('pointerup', end);
    gv.addEventListener('pointercancel', end);
    gsap.ticker.add((time, dt) => {
      if (!inView) return;
      if (!drag) {
        vel *= .94;
        const auto = reduce ? 0 : (hover ? -.22 : -.7);
        x += vel + auto * (dt / 16.67);
      }
      if (half > 0) {
        while (x <= -half) x += half;
        while (x > 0) x -= half;
      }
      gt.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    });
    ScrollTrigger.create({ trigger: gv, start: 'top bottom', end: 'bottom top', onToggle: (s) => { inView = s.isActive; } });
    gsap.set(cards, { y: 70, opacity: 0 });
    ScrollTrigger.create({
      trigger: gv,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(cards, { y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: .05 }),
    });
  }

  /* =========================================================
     10. Déclinaisons : langues + formats
     ========================================================= */
  const vScreen = $('.var__screen');
  if (vScreen) {
    const vWord = $('[data-var-word]');
    const vLang = $('[data-var-lang]');
    const variants = [['Bienvenue', 'FR'], ['Willkommen', 'DE'], ['Benvenuti', 'IT'], ['Welcome', 'EN'], ['Bainvegni', 'RM']];
    let vi = 0, vTimer = 0;
    const next = () => {
      vi = (vi + 1) % variants.length;
      vScreen.dataset.variant = vi;
      vWord.innerHTML = `<span>${variants[vi][0]}</span>`;
      vLang.textContent = variants[vi][1];
    };
    ScrollTrigger.create({
      trigger: '.var__stage',
      start: 'top 82%',
      end: 'bottom 18%',
      onToggle: (s) => { clearInterval(vTimer); if (s.isActive && !reduce) vTimer = setInterval(next, 2100); },
    });
  }

  /* =========================================================
     11. Double bloc : texte « slit-scan » + jauges
     ========================================================= */
  $$('[data-slit]').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, colorSrc = null, whiteSrc = null, running = false, raf = 0;
    const build = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = Math.max(2, Math.round(r.width * dpr));
      h = Math.max(2, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
      const mk = (fill) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const s = c.getContext('2d');
        s.font = `800 ${Math.round(h * .3)}px "Inter Tight", sans-serif`;
        s.textAlign = 'center';
        s.textBaseline = 'middle';
        s.fillStyle = fill(s);
        s.fillText('New', w / 2, h * .32);
        s.fillText('Architect', w / 2, h * .64);
        return c;
      };
      colorSrc = mk((s) => {
        const g = s.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#1dff9a');
        g.addColorStop(.3, '#2b7bff');
        g.addColorStop(.55, '#ff4fd8');
        g.addColorStop(.8, '#ffde3b');
        g.addColorStop(1, '#1dff9a');
        return g;
      });
      whiteSrc = mk(() => '#ffffff');
    };
    const draw = (t) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      const sw = Math.max(2, Math.round(3 * dpr));
      const K = 9;
      for (let k = K; k >= 0; k--) {
        const src = k === 0 ? whiteSrc : colorSrc;
        ctx.globalAlpha = k === 0 ? 1 : (1 - k / (K + 1)) * .95;
        for (let x = 0; x < w; x += sw) {
          const u = x / w;
          const wave = Math.sin(u * 7 + t * 1.5) * h * .05 + Math.sin(u * 17 - t * 1.1) * h * .02;
          ctx.drawImage(src, x, 0, sw, h, x, wave + k * h * .028, sw, h);
        }
      }
      ctx.globalAlpha = 1;
    };
    const loop = (now) => {
      if (!running) return;
      draw(now / 1000);
      raf = requestAnimationFrame(loop);
    };
    const init = () => { build(); draw(0); };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(init);
    new ResizeObserver(() => init()).observe(canvas);
    new IntersectionObserver(([en]) => {
      running = en.isIntersecting && !reduce;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(loop);
    }, { rootMargin: '10% 0px' }).observe(canvas);
  });

  const perf = $('[data-perf]');
  if (perf) {
    const run = () => {
      perf.classList.remove('is-run');
      void perf.offsetWidth;
      perf.classList.add('is-run');
      $$('[data-count]', perf).forEach((b) => {
        const o = { v: 0 };
        gsap.to(o, { v: +b.dataset.count, duration: 1.9, ease: 'expo.out', onUpdate: () => { b.textContent = Math.round(o.v); } });
      });
    };
    ScrollTrigger.create({ trigger: perf, start: 'top 82%', once: true, onEnter: run });
    let last = 0;
    perf.closest('.dcard').addEventListener('pointerenter', () => {
      if (performance.now() - last > 2500 && perf.classList.contains('is-run')) { last = performance.now(); run(); }
    });
  }

  /* =========================================================
     12. Trouvez votre style
     ========================================================= */
  const lrows = $$('.lrow');
  const posters = $$('.poster');
  if (lrows.length) {
    const setLook = (i) => {
      lrows.forEach((r, k) => r.classList.toggle('is-active', k === i));
      posters.forEach((p, k) => p.classList.toggle('is-active', k === i));
    };
    lrows.forEach((r, i) => {
      r.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setLook(i); });
      $('.lrow__name', r).addEventListener('click', () => setLook(i));
    });
  }

  /* =========================================================
     13. Tarifs : formulaire « glass »
     ========================================================= */
  const quote = $('[data-quote]');
  const qform = $('[data-quote-form]');
  if (quote && qform) {
    // Les formes irisées derrière le verre suivent doucement la souris
    const glow = $('.quote__glow', quote);
    if (finePointer && glow) {
      quote.addEventListener('pointermove', (e) => {
        const r = quote.getBoundingClientRect();
        glow.style.setProperty('--gx', (((e.clientX - r.left) / r.width - .5) * 70).toFixed(1) + 'px');
        glow.style.setProperty('--gy', (((e.clientY - r.top) / r.height - .5) * 50).toFixed(1) + 'px');
      });
      quote.addEventListener('pointerleave', () => { glow.style.setProperty('--gx', '0px'); glow.style.setProperty('--gy', '0px'); });
    }

    // Cases à cocher des budgets (classe de secours si :has() n'est pas pris en charge)
    $$('.qbud__opt input', qform).forEach((input) => {
      const opt = input.closest('.qbud__opt');
      input.addEventListener('change', () => opt.classList.toggle('is-checked', input.checked));
      input.addEventListener('focus', () => opt.classList.add('is-focus'));
      input.addEventListener('blur', () => opt.classList.remove('is-focus'));
    });

    const note = $('[data-quote-note]', qform);
    const defaultNote = note.textContent;
    $$('.qf input, .qf textarea', qform).forEach((f) => f.addEventListener('input', () => f.closest('.qf').classList.remove('is-invalid')));

    // Pas de serveur : la demande est préparée dans la messagerie du visiteur
    qform.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = $$('.qf input, .qf textarea', qform);
      let firstBad = null;
      fields.forEach((f) => {
        const bad = !f.checkValidity();
        f.closest('.qf').classList.toggle('is-invalid', bad);
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) {
        note.textContent = 'Merci de compléter les champs marqués d’un astérisque.';
        note.className = 'quote__note is-error';
        firstBad.focus();
        return;
      }
      const d = new FormData(qform);
      const budgets = d.getAll('budget');
      const body = [
        `Nom : ${d.get('nom')}`,
        d.get('societe') ? `Société : ${d.get('societe')}` : '',
        `E-mail : ${d.get('email')}`,
        d.get('telephone') ? `Téléphone : ${d.get('telephone')}` : '',
        `Budget : ${budgets.length ? budgets.join(', ') : 'à définir'}`,
        '',
        String(d.get('projet')),
      ].filter((l, i) => l || i === 5).join('\n');
      const subject = `Demande de devis — ${d.get('nom')}`;
      window.location.href = `mailto:hello@newarchitect.ch?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      note.textContent = 'Merci ! Votre messagerie s’ouvre avec votre demande prête à envoyer.';
      note.className = 'quote__note is-ok';
      setTimeout(() => { note.textContent = defaultNote; note.className = 'quote__note'; }, 9000);
    });
  }

  /* =========================================================
     Pied de page : logo à extrusion irisée (scroll + souris)
     ========================================================= */
  const stack = $('.ftr__stack');
  if (stack) {
    const st2 = { ey: -1, ex: 0 };
    const apply = () => {
      stack.style.setProperty('--ey', st2.ey.toFixed(3));
      stack.style.setProperty('--ex', st2.ex.toFixed(3));
    };
    const toEy = gsap.quickTo(st2, 'ey', { duration: .9, ease: 'power3.out', onUpdate: apply });
    const toEx = gsap.quickTo(st2, 'ex', { duration: 1.1, ease: 'power3.out', onUpdate: apply });
    apply();
    ScrollTrigger.create({
      trigger: '.ftr',
      start: 'top bottom',
      end: 'bottom bottom',
      onUpdate: (s) => toEy(lerp(-1, 1, s.progress)),
    });
    if (finePointer) {
      addEventListener('pointermove', (e) => {
        if (stack.getBoundingClientRect().top > innerHeight) return;
        toEx((e.clientX / innerWidth - .5) * 1.6);
      }, { passive: true });
    }
  }

  /* ---------- Lancement ---------- */
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  addEventListener('load', refresh);
  runLoader();
})();
