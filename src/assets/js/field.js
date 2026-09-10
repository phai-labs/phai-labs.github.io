/* PhAI Labs -- the field.
 *
 * A quiet computational substrate under every page: two very dim density
 * decks in blue-ink and violet-blue drifting over the near-black ground, a
 * sparse population of breathing motes, and, on the pages that carry the key
 * visual, a pass of ingress streaks and orbiting dust that continues the
 * image. Each chapter re-tunes the field as it reaches the centre of the
 * viewport (data-field="calm | flow | grid | still | hero | off").
 *
 * Cost: the decks are two pre-rendered noise tiles drawn as patterns into a
 * 320px-wide canvas that the browser upscales (the upscale is the blur), so
 * a frame is a handful of fills and ~100 small arcs. 30 fps on desktop, 24 on
 * phones, nothing at all when the tab is hidden, when the visitor prefers
 * reduced motion (one static frame), when Save-Data is on, or when
 * --field-max is 0.
 */
(() => {
  const html = document.documentElement;
  const css = getComputedStyle(html);
  const max = parseFloat(css.getPropertyValue('--field-max')) || 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('field') === 'static';
  const saveData = navigator.connection && navigator.connection.saveData;
  const main = document.querySelector('main');
  // ?field=off compares a page without the substrate; ?field=static freezes it
  const query = new URLSearchParams(location.search).get('field');
  if (query === 'off') return;
  if (!(max > 0) || saveData || html.dataset.field === 'off') return;
  // article pages: the substrate stays off, only the click response remains
  const fieldOff = !!(main && main.dataset.field === 'off');

  const colour = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const BG = colour('--bg', '#0a0a0b');
  const INK = colour('--blue-ink', '#3a45a8');
  const DEEP = colour('--blue-deep', '#5d6bd6');
  const BLUE = colour('--blue', '#9ba7ff');
  const BLUE2 = colour('--blue-2', '#aab4ff');

  /* ---------------- canvases ---------------- */
  const clouds = document.createElement('canvas');
  const fx = document.createElement('canvas');
  clouds.className = 'field field--clouds';
  fx.className = 'field field--fx';
  clouds.setAttribute('aria-hidden', 'true'); fx.setAttribute('aria-hidden', 'true');
  document.body.prepend(fx); document.body.prepend(clouds);
  const cg = clouds.getContext('2d');
  const fg = fx.getContext('2d');

  let W = 0, H = 0, S = 1, phone = false;
  const size = () => {
    W = html.clientWidth; H = innerHeight; phone = W < 900;
    S = Math.min(devicePixelRatio || 1, 1.5) * (phone ? 0.7 : 0.8);
    clouds.width = 320; clouds.height = Math.max(90, Math.round(320 * H / W));
    fx.width = Math.round(W * S); fx.height = Math.round(H * S);
    cg.imageSmoothingEnabled = true;
  };

  /* ---------------- noise tiles ---------------- */
  // seamless value-noise tile, 3 octaves, tinted; alpha carries the density
  const hexToRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const seeded = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const tile = (n, hex, gain, seed) => {
    const r = seeded(seed), c = document.createElement('canvas'); c.width = c.height = n;
    const ctx = c.getContext('2d'), img = ctx.createImageData(n, n), d = img.data, [R, G, B] = hexToRgb(hex);
    const octs = [[6, 1], [12, 0.5], [24, 0.25]].map(([cells, amp]) => {
      const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = r();
      return { cells, amp, g };
    });
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = 0, norm = 0;
      for (const { cells, amp, g } of octs) {
        const fx_ = x / n * cells, fy = y / n * cells, x0 = Math.floor(fx_), y0 = Math.floor(fy);
        const sx = smooth(fx_ - x0), sy = smooth(fy - y0);
        const at = (i, j) => g[((j % cells) + cells) % cells * cells + ((i % cells) + cells) % cells];
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        v += (a + (b - a) * sy) * amp; norm += amp;
      }
      v /= norm;                                   // 0..1, mostly near .5
      const dens = Math.max(0, (v - 0.42) / 0.58);  // keep the top of the range only: clouds, not fog
      const k = (y * n + x) * 4;
      d[k] = R; d[k + 1] = G; d[k + 2] = B; d[k + 3] = Math.round(255 * Math.pow(dens, 1.5) * gain);
    }
    ctx.putImageData(img, 0, 0);
    return cg.createPattern(c, 'repeat');
  };
  const deckA = { pat: tile(256, INK, 1, 11), scale: 1.9, drift: [0.55, 0.16], alpha: 0.24, ox: 40, oy: 10 };
  const deckB = { pat: tile(256, DEEP, 1, 29), scale: 1.25, drift: [-0.32, 0.36], alpha: 0.18, ox: 120, oy: 60 };

  /* ---------------- states ---------------- */
  // what a chapter asks of the field; the live parameters ease toward these
  const STATES = {
    hero:  { drift: 1.0, dx: 0.010, dy: -0.004, speed: 1.0, alpha: 0.9,  lattice: 0 },
    calm:  { drift: 1.0, dx: 0.010, dy: -0.006, speed: 1.0, alpha: 1.0,  lattice: 0 },
    flow:  { drift: 2.4, dx: 0.055, dy:  0.000, speed: 2.2, alpha: 1.15, lattice: 0 },
    grid:  { drift: 0.6, dx: 0.004, dy: -0.002, speed: 0.5, alpha: 0.8,  lattice: 1 },
    still: { drift: 0.25, dx: 0.003, dy: -0.002, speed: 0.15, alpha: 0.7, lattice: 0 },
    off:   { drift: 0.0, dx: 0, dy: 0, speed: 0, alpha: 0, lattice: 0 },
  };
  const live = Object.assign({}, fieldOff ? STATES.off : STATES.calm);
  let target = fieldOff ? STATES.off : STATES[document.querySelector('.hero--home, .hero--program') ? 'hero' : 'calm'];
  const tuned = fieldOff ? [] : document.querySelectorAll('[data-field]');
  if (tuned.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) target = STATES[e.target.dataset.field] || STATES.calm; });
    }, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
    tuned.forEach((el) => io.observe(el));
  }

  /* ---------------- motes ---------------- */
  const N = () => (phone ? 26 : 64);
  let motes = [];
  const seedMotes = () => {
    const r = seeded(7); motes = [];
    for (let i = 0; i < N(); i++) motes.push({ x: r(), y: r(), r: 0.9 + r() * 1.1, ph: r() * 6.28, v: r() < 0.25 ? BLUE2 : BLUE, ix: 0, iy: 0 });
  };

  /* ---------------- touch ---------------- */
  // A click is answered once, quietly: one thin ring widens from the point and
  // fades, and the motes within reach are nudged aside before the flow takes
  // them back. Nothing on reduced motion.
  let taps = [];
  addEventListener('pointerdown', (e) => {
    if (reduce || e.button > 0) return;
    taps.push({ x: e.clientX, y: e.clientY, t: 0 });
    for (const m of motes) {
      const dx = m.x * W - e.clientX, dy = m.y * H - e.clientY, d = Math.hypot(dx, dy) || 1;
      if (d < 150) { const k = (1 - d / 150) * 0.11; m.ix += (dx / d) * k; m.iy += (dy / d) * k; }
    }
    if (!running && !reduce) start();
  }, { passive: true });

  /* ---------------- copy shelter ---------------- */
  // the decks thin out under display headings so the type reads
  const shelter = Array.from(document.querySelectorAll('.display, .display-2, .feature__title, .hero__copy .lede'));
  const visible = new Set();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { threshold: 0 });
    shelter.forEach((el) => io.observe(el));
  }

  /* ---------------- loop ---------------- */
  let t = 0, last = 0, raf = 0, running = false;
  const frameMs = () => (phone ? 41 : 33);

  const update = (dt) => {
    t += dt;
    const k = 1 - Math.exp(-dt / 0.9);
    for (const key of ['drift', 'dx', 'dy', 'speed', 'alpha', 'lattice']) live[key] += (target[key] - live[key]) * k;
    // decks drift in low-res canvas pixels per second
    deckA.ox += deckA.drift[0] * live.drift * dt; deckA.oy += deckA.drift[1] * live.drift * dt;
    deckB.ox += deckB.drift[0] * live.drift * dt; deckB.oy += deckB.drift[1] * live.drift * dt;
    // motes ride a slow flow; in the grid state they settle toward a 96px lattice
    const cell = 96 / W, cellY = 96 / H;
    for (const m of motes) {
      const vx = live.dx + 0.028 * Math.sin(m.y * 9.4 + t * 0.09 + m.ph);
      const vy = live.dy + 0.020 * Math.cos(m.x * 6.3 + t * 0.07 + m.ph);
      m.x += vx * live.speed * dt + m.ix * dt; m.y += vy * live.speed * dt + m.iy * dt * (W / H);
      const decay = Math.exp(-dt / 0.55); m.ix *= decay; m.iy *= decay;
      if (live.lattice > 0.02) {
        const gx = Math.round(m.x / cell) * cell, gy = Math.round(m.y / cellY) * cellY;
        m.x += (gx - m.x) * live.lattice * 0.9 * dt; m.y += (gy - m.y) * live.lattice * 0.9 * dt;
      }
      if (m.x < -0.02) m.x += 1.04; if (m.x > 1.02) m.x -= 1.04;
      if (m.y < -0.02) m.y += 1.04; if (m.y > 1.02) m.y -= 1.04;
    }
    taps.forEach((tp) => (tp.t += dt)); taps = taps.filter((tp) => tp.t < 0.75);
  };

  const drawClouds = () => {
    const w = clouds.width, h = clouds.height;
    cg.clearRect(0, 0, w, h);
    if (live.alpha < 0.01) return;
    const breathe = 0.85 + 0.15 * Math.sin(t / 9);
    for (const d of [deckA, deckB]) {
      cg.globalAlpha = Math.min(1, d.alpha * max * live.alpha * breathe);
      d.pat.setTransform(new DOMMatrix().translate(d.ox, d.oy).scale(d.scale * w / 256 / 1.6));
      cg.fillStyle = d.pat; cg.fillRect(0, 0, w, h);
    }
    cg.globalAlpha = 1;
    // shelter: cut the decks away under the headings in view
    if (visible.size) {
      cg.globalCompositeOperation = 'destination-out';
      const sx = w / W, sy = h / H;
      for (const el of visible) {
        const r = el.getBoundingClientRect();
        const cx = (r.left + r.width / 2) * sx, cy = (r.top + r.height / 2) * sy;
        const rx = (r.width / 2 + 60) * sx, ry = (r.height / 2 + 60) * sy;
        const g = cg.createRadialGradient(cx, cy, 0, cx, cy, 1);
        g.addColorStop(0, 'rgba(0,0,0,.8)'); g.addColorStop(0.55, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        cg.save(); cg.translate(cx, cy); cg.scale(rx, ry); cg.translate(-cx, -cy);
        cg.fillStyle = g; cg.fillRect(cx - 1, cy - 1, 2, 2); cg.restore();
      }
      cg.globalCompositeOperation = 'source-over';
    }
  };

  const drawFx = () => {
    const w = fx.width, h = fx.height;
    fg.clearRect(0, 0, w, h);
    // motes
    for (const m of motes) {
      const a = (0.16 + 0.16 * Math.sin(t * 0.5 + m.ph)) * live.alpha * max;
      if (a <= 0.005) continue;
      fg.globalAlpha = a; fg.fillStyle = m.v;
      fg.beginPath(); fg.arc(m.x * w, m.y * h, m.r * S, 0, 6.2832); fg.fill();
    }
    // the click ring
    for (const tp of taps) {
      const u = tp.t / 0.75, x = tp.x * S, y = tp.y * S;
      fg.globalAlpha = 0.5 * (1 - u) * (1 - u); fg.strokeStyle = BLUE2; fg.lineWidth = 1 * S;
      fg.beginPath(); fg.arc(x, y, (3 + 46 * (1 - Math.pow(1 - u, 3))) * S, 0, 6.2832); fg.stroke();
      if (u < 0.35) { fg.globalAlpha = 0.6 * (1 - u / 0.35); fg.fillStyle = BLUE2; fg.beginPath(); fg.arc(x, y, 1.6 * S, 0, 6.2832); fg.fill(); }
    }
    fg.globalAlpha = 1;
  };

  // ?field=bench prints the mean cost of a frame after 150 frames
  const bench = query === 'bench';
  let benchT = 0, benchN = 0, benchMax = 0;
  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < frameMs()) return;
    const dt = Math.min((now - last) / 1000, 0.05) || 0.033;
    last = now;
    const t0 = bench ? performance.now() : 0;
    update(dt); drawClouds(); drawFx();
    if (bench) {
      const c = performance.now() - t0; benchT += c; benchN++; benchMax = Math.max(benchMax, c);
      if (benchN === 150) {
        const msg = 'field bench: mean ' + (benchT / benchN).toFixed(2) + ' ms/frame, max ' + benchMax.toFixed(2) + ' ms, canvases ' + fx.width + 'x' + fx.height + ' + ' + clouds.width + 'x' + clouds.height;
        console.log(msg); document.title = msg;
      }
    }
  };
  const start = () => { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  /* ---------------- boot ---------------- */
  size(); seedMotes();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); seedMotes(); if (reduce) { drawClouds(); drawFx(); } }, 120); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  requestAnimationFrame(() => {
    clouds.classList.add('is-on'); fx.classList.add('is-on');
    if (reduce) { update(0); drawClouds(); drawFx(); } else start();
  });
})();
