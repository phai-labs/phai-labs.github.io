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
  if (!(max > 0) || saveData || html.dataset.field === 'off' || (main && main.dataset.field === 'off')) return;

  const colour = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const BG = colour('--bg', '#0a0a0b');
  const INK = colour('--blue-ink', '#3a45a8');
  const DEEP = colour('--blue-deep', '#5d6bd6');
  const BLUE = colour('--blue', '#9ba7ff');
  const BLUE2 = colour('--blue-2', '#aab4ff');
  const AMBER = colour('--amber', '#d29c52');

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
    if (kc) remap();
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
  const live = Object.assign({}, STATES.calm);
  let target = STATES[document.querySelector('.hero--home, .hero--program') ? 'hero' : 'calm'];
  const tuned = document.querySelectorAll('[data-field]');
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
    for (let i = 0; i < N(); i++) motes.push({ x: r(), y: r(), r: 0.9 + r() * 1.1, ph: r() * 6.28, v: r() < 0.25 ? BLUE2 : BLUE });
  };

  /* ---------------- copy shelter ---------------- */
  // the decks thin out under display headings so the type reads
  const shelter = Array.from(document.querySelectorAll('.display, .display-2, .feature__title, .hero__copy .lede'));
  const visible = new Set();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { threshold: 0 });
    shelter.forEach((el) => io.observe(el));
  }

  /* ---------------- the key visual, alive ---------------- */
  // A canvas laid over the KV image inside .hero__kv. The geometry is the
  // image's own (site.json kv.geometry: hubs and nodes detected from the still,
  // the ingress lines, the dome's edge arc, the convergence point), mapped
  // through the image's object-fit box so it stays true at any size. Hubs
  // breathe; blue signals run the ingress lines into the focus and travel
  // between hubs along the dome's concentric arcs; an amber ring marks each
  // arrival; a shimmer runs the dome's edge now and then.
  const kv = document.querySelector('.hero__kv');
  const kvImg = kv && kv.querySelector('img');
  const geoEl = document.getElementById('kv-geometry');
  const geo = geoEl ? JSON.parse(geoEl.textContent) : null;
  const rs = seeded(3);
  let kvSeen = !!kv, kc = null, kg = null, map = null;
  let hubs = [], lines = [], packets = [], rings = [], focusFlash = 0;
  const shimmer = { t: -1, wait: 3 };
  const pol = (hb) => { const [fx0, fy0] = geo.focus; return [Math.hypot((hb.x - fx0) * 1.6, hb.y - fy0), Math.atan2(hb.y - fy0, (hb.x - fx0) * 1.6)]; };
  const newPacket = () => {   // a signal to a hub: along a concentric arc from a neighbour, or a ray out of the focus
    const a = hubs[Math.floor(rs() * hubs.length)];
    if (rs() < 0.4) return { kind: 'ray', to: a, t: -rs() * 0.6, sp: 0.32 + rs() * 0.2 };
    const [ra, ta] = pol(a);
    const cands = hubs.filter((b) => { if (b === a) return false; const [rb, tb] = pol(b); return Math.abs(rb - ra) < 0.09 && Math.abs(tb - ta) < 1.1; });
    if (!cands.length) return { kind: 'ray', to: a, t: -rs() * 0.6, sp: 0.4 };
    return { kind: 'arc', from: cands[Math.floor(rs() * cands.length)], to: a, t: -rs() * 0.6, sp: 0.26 + rs() * 0.16 };
  };
  if (kv && kvImg && geo) {
    kc = document.createElement('canvas'); kc.className = 'kv__fx'; kc.setAttribute('aria-hidden', 'true');
    kv.appendChild(kc); kg = kc.getContext('2d');
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { kvSeen = es.some((e) => e.isIntersecting); }, { threshold: 0.02 }).observe(kv);
    hubs = geo.hubs.map(([x, y, s]) => ({ x, y, s, ph: rs() * 6.28, w: 0.7 + rs() * 0.7 }));
    lines = geo.lines.map((y) => ({ y, packets: [{ t: rs(), sp: 0.12 + rs() * 0.05 }, { t: -rs(), sp: 0.12 + rs() * 0.05 }] }));
    for (let i = 0; i < (phone ? 4 : 8); i++) packets.push(newPacket());
    kvImg.addEventListener('load', () => remap());
  }
  function remap() {   // image fractions -> canvas pixels, through object-fit: cover and object-position
    if (!kc) return;
    const kr = kv.getBoundingClientRect(), ir = kvImg.getBoundingClientRect();
    const nw = kvImg.naturalWidth || 1586, nh = kvImg.naturalHeight || 992;
    const sc = Math.max(ir.width / nw, ir.height / nh), dw = nw * sc, dh = nh * sc;
    const op = (getComputedStyle(kvImg).objectPosition || '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
    const px = isNaN(op[0]) ? 0.5 : op[0], py = isNaN(op[1]) ? 0.5 : op[1];
    kc.width = Math.round(kr.width * S); kc.height = Math.round(kr.height * S);
    map = { ox: ir.left - kr.left + (ir.width - dw) * px, oy: ir.top - kr.top + (ir.height - dh) * py, dw, dh, il: ir.left - kr.left, it: ir.top - kr.top, iw: ir.width, ih: ir.height };
  }
  const P = (x, y) => [(map.ox + x * map.dw) * S, (map.oy + y * map.dh) * S];
  // the image's own CSS mask, so nothing drawn outlives the picture: an ellipse
  // (78% x 82% at 58% 46% of the image box, solid to 34%, gone at 78%) and a vertical fade
  const maskAt = (x, y) => {
    const bx = (map.ox + x * map.dw - map.il) / map.iw, by = (map.oy + y * map.dh - map.it) / map.ih;
    const v = Math.max(0, Math.min(1, by < 0.12 ? by / 0.12 : by > 0.66 ? (1 - by) / 0.34 : 1));
    if (phone) return v;
    const r = Math.hypot((bx - 0.58) / 0.78, (by - 0.46) / 0.82);
    return v * (r < 0.34 ? 1 : r > 0.78 ? 0 : 1 - (r - 0.34) / 0.44);
  };
  const bez = (p0, p1, p2, u) => { const v = 1 - u; return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]]; };
  // an ingress line: straight from the left edge, then bending into the focus
  const linePt = (y, u) => (u < 0.75 ? [(u / 0.75) * 0.27, y] : bez([0.27, y], [0.325, y], geo.focus, (u - 0.75) / 0.25));
  const arcPt = (u) => bez(geo.arc[0], geo.arc[1], geo.arc[2], u);
  const packetPt = (p) => {
    const [fx0, fy0] = geo.focus, u = Math.max(0, p.t);
    if (p.kind === 'ray') return [fx0 + (p.to.x - fx0) * u, fy0 + (p.to.y - fy0) * u];
    const [r1, t1] = pol(p.from), [r2, t2] = pol(p.to);
    const r = r1 + (r2 - r1) * u, th = t1 + (t2 - t1) * u;
    return [fx0 + Math.cos(th) * r / 1.6, fy0 + Math.sin(th) * r];
  };

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
      m.x += vx * live.speed * dt; m.y += vy * live.speed * dt;
      if (live.lattice > 0.02) {
        const gx = Math.round(m.x / cell) * cell, gy = Math.round(m.y / cellY) * cellY;
        m.x += (gx - m.x) * live.lattice * 0.9 * dt; m.y += (gy - m.y) * live.lattice * 0.9 * dt;
      }
      if (m.x < -0.02) m.x += 1.04; if (m.x > 1.02) m.x -= 1.04;
      if (m.y < -0.02) m.y += 1.04; if (m.y > 1.02) m.y -= 1.04;
    }
    if (kc && kvSeen) {
      for (const l of lines) for (const q of l.packets) { q.t += q.sp * dt; if (q.t > 1) { q.t = -0.2 - rs() * 0.8; focusFlash = 0.6; } }
      focusFlash = Math.max(0, focusFlash - dt);
      packets.forEach((p, i) => { p.t += p.sp * dt; if (p.t >= 1) { rings.push({ x: p.to.x, y: p.to.y, t: 0 }); packets[i] = newPacket(); } });
      rings.forEach((r) => (r.t += dt)); rings = rings.filter((r) => r.t < 1.3);
      shimmer.t += dt; if (shimmer.t > shimmer.wait + 1.6) { shimmer.t = 0; shimmer.wait = 4 + rs() * 5; }
    }
  };

  const drawKv = () => {
    if (!kg || !map) return;
    const w = kc.width, h = kc.height;
    kg.clearRect(0, 0, w, h);
    if (!kvSeen) return;
    kg.globalCompositeOperation = 'lighter';
    // hubs breathe, each at its own pace
    for (const hb of hubs) {
      const m = maskAt(hb.x, hb.y); if (m < 0.03) continue;
      const sn = 0.5 + hb.s, [x, y] = P(hb.x, hb.y);
      const a = (0.12 + 0.30 * (0.5 + 0.5 * Math.sin(t * hb.w + hb.ph))) * sn * m * max;
      const rad = (8 + 13 * sn) * S;
      const g = kg.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,214,150,' + a.toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(210,156,82,' + (a * 0.45).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(210,156,82,0)');
      kg.fillStyle = g; kg.beginPath(); kg.arc(x, y, rad, 0, 6.2832); kg.fill();
    }
    // the small blue nodes on the ingress lines
    geo.nodes.forEach(([nx, ny], i) => {
      const [x, y] = P(nx, ny);
      kg.globalAlpha = (0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.3 + i))) * maskAt(nx, ny) * max;
      kg.fillStyle = BLUE2; kg.beginPath(); kg.arc(x, y, 1.7 * S, 0, 6.2832); kg.fill();
    });
    kg.globalAlpha = 1;
    if (!reduce) {
      kg.lineCap = 'round';
      const trail = (pt, u1, u2, rgb, alpha, width) => {   // a short gradient segment along a path, sampled in five pieces
        const [ax, ay] = P(...pt(u1)), [bx, by] = P(...pt(u2));
        const g = kg.createLinearGradient(ax, ay, bx, by);
        g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(1, 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')');
        kg.strokeStyle = g; kg.lineWidth = width * S; kg.beginPath();
        for (let k = 0; k <= 5; k++) { const [px, py] = P(...pt(u1 + (u2 - u1) * k / 5)); k ? kg.lineTo(px, py) : kg.moveTo(px, py); }
        kg.stroke();
      };
      // signals run the ingress lines into the focus
      for (const l of lines) for (const q of l.packets) {
        if (q.t <= 0) continue;
        const [mx, my] = linePt(l.y, q.t);
        // the left scrim sits over this canvas, so the ingress signals run brighter to survive it
        trail((u) => linePt(l.y, u), Math.max(0, q.t - 0.08), Math.min(1, q.t), '205,214,255', 0.85 * maskAt(mx, my) * max, 1.7);
      }
      if (focusFlash > 0) {
        const [x, y] = P(...geo.focus), a = 0.45 * Math.min(1, focusFlash / 0.6) * max, rad = 26 * S;
        const g = kg.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(220,226,255,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(155,167,255,0)');
        kg.fillStyle = g; kg.beginPath(); kg.arc(x, y, rad, 0, 6.2832); kg.fill();
      }
      // signals between hubs, and the ring where one arrives
      for (const p of packets) {
        if (p.t <= 0) continue;
        const [mx, my] = packetPt(p);
        trail((u) => packetPt(Object.assign({}, p, { t: u })), Math.max(0, p.t - 0.07), p.t, '175,186,255', 0.72 * maskAt(mx, my) * max, 1.5);
      }
      for (const r of rings) {
        const u = r.t / 1.3, [x, y] = P(r.x, r.y);
        kg.globalAlpha = 0.6 * (1 - u) * maskAt(r.x, r.y) * max; kg.strokeStyle = AMBER; kg.lineWidth = 1 * S;
        kg.beginPath(); kg.arc(x, y, (3 + 26 * u) * S, 0, 6.2832); kg.stroke();
      }
      kg.globalAlpha = 1;
      // a shimmer along the dome's edge
      if (shimmer.t >= 0 && shimmer.t < 1.6) {
        const u = shimmer.t / 1.6, [mx, my] = arcPt(u);
        trail(arcPt, Math.max(0, u - 0.09), u, '255,214,150', 0.5 * maskAt(mx, my) * max, 2);
      }
    }
    kg.globalCompositeOperation = 'source-over';
  };

  const drawClouds = () => {
    const w = clouds.width, h = clouds.height;
    cg.clearRect(0, 0, w, h);
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
    update(dt); drawClouds(); drawFx(); drawKv();
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
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); seedMotes(); if (reduce) { drawClouds(); drawFx(); drawKv(); } }, 120); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  requestAnimationFrame(() => {
    clouds.classList.add('is-on'); fx.classList.add('is-on');
    if (reduce) { update(0); drawClouds(); drawFx(); drawKv(); } else start();
  });
})();
