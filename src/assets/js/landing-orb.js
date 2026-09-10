/* PhAI Labs · the orb
   A dark sphere with a luminous ring of orbiting motes, drawn on a canvas.
   Our own drawing, in the site's two accents, not an image: a few KB, sharp at
   any size, and the ring can pass behind the sphere on the far side and in
   front of it on the near side, which is the whole trick.

   ?bg=video swaps this out for the particle key visual instead. */
(() => {
  const cv = document.querySelector('canvas[data-orb]');
  if (!cv) return;
  const box = cv.closest('[data-kv]');
  const wantVideo = new URLSearchParams(location.search).get('bg') === 'video';
  if (wantVideo) {
    // the particle key visual instead: the still becomes the poster and the
    // fallback, exactly as it is on the main site
    if (box) box.dataset.bg = 'video';
    const img = box && box.querySelector('.stage__still');
    if (img) img.hidden = false;
    cv.remove();
    return;
  }

  const still = box && box.querySelector('.stage__still');
  const vid = box && box.querySelector('video');
  if (still) still.hidden = true;
  if (vid) vid.remove();          // the orb is the background now

  const g = cv.getContext('2d', { alpha: true });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // deterministic scatter, so the picture is the same every load
  let seed = 20260915;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  const BLUE = [155, 167, 255];
  const AMBER = [210, 156, 82];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // one mote per orbit slot: angle, radius band, size, brightness, hue mix
  const N = 1500;
  const motes = [];
  for (let i = 0; i < N; i++) {
    const band = rnd();
    motes.push({
      a: rnd() * Math.PI * 2,
      r: 1.12 + Math.pow(band, 0.75) * 1.15,  // in sphere radii, packed near the rim
      sp: 0.13 + (1 - band) * 0.17,           // inner motes run faster
      sz: 0.3 + rnd() * rnd() * 2.2,
      br: (0.3 + rnd() * 0.7) * (1 - band * 0.45),
      hue: Math.min(1, Math.max(0, band * 1.25 + (rnd() - 0.5) * 0.3)),
      ph: rnd() * Math.PI * 2,
    });
  }

  let W = 0, H = 0, S = 1, cx = 0, cy = 0, R = 1;
  const TILT = 0.34;                          // how flat the ring looks
  const ROLL = -0.17;                         // ring tipped off horizontal

  const size = () => {
    const r = cv.getBoundingClientRect();
    S = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * S));
    H = Math.max(1, Math.round(r.height * S));
    cv.width = W; cv.height = H;
    // the sphere sits right of centre, clear of the headline
    cx = W * (r.width < 760 ? 0.60 : 0.68);
    cy = H * (r.width < 760 ? 0.34 : 0.46);
    R = Math.min(W, H) * (r.width < 760 ? 0.18 : 0.185);
  };

  // a mote's position: circle in the ring plane, tilted, then rolled
  const place = (m, t) => {
    const a = m.a + t * m.sp;
    const x0 = Math.cos(a) * m.r * R;
    const y0 = Math.sin(a) * m.r * R * TILT;
    const c = Math.cos(ROLL), s = Math.sin(ROLL);
    return { x: cx + x0 * c - y0 * s, y: cy + x0 * s + y0 * c, far: Math.sin(a) < 0, a };
  };

  const sphere = () => {
    // body: barely lighter than the page, so it reads as mass rather than a hole
    const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
    body.addColorStop(0, '#101220');
    body.addColorStop(0.5, '#0a0b11');
    body.addColorStop(1, '#060608');
    g.fillStyle = body;
    g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.fill();

    // rim light on the side the ring passes in front of
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rim = g.createRadialGradient(cx, cy, R * 0.88, cx, cy, R * 1.02);
    rim.addColorStop(0, 'rgba(155,167,255,0)');
    rim.addColorStop(1, 'rgba(155,167,255,.24)');
    g.fillStyle = rim;
    g.beginPath(); g.arc(cx, cy, R * 1.02, 0, 6.2832); g.fill();
    g.restore();
  };

  const halo = () => {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const h = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 2.5);
    h.addColorStop(0, 'rgba(155,167,255,.055)');
    h.addColorStop(0.45, 'rgba(210,156,82,.035)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h;
    g.fillRect(0, 0, W, H);
    g.restore();
  };

  // the disc itself: concentric elliptical strokes, additive, brightest at the rim
  const band = (half, t) => {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(cx, cy); g.rotate(ROLL);
    const start = half ? Math.PI : 0;
    for (let i = 0; i < 26; i++) {
      const u = i / 25;
      const rr = R * (1.12 + Math.pow(u, 0.75) * 1.15);
      const c = mix(AMBER, BLUE, Math.min(1, u * 1.25));
      const a = (half ? 0.030 : 0.062) * (1 - u * 0.55) * (0.9 + 0.1 * Math.sin(t * 1.3 + i));
      g.strokeStyle = rgba(c, a);
      g.lineWidth = Math.max(1, R * 0.055);
      g.beginPath();
      g.ellipse(0, 0, rr, rr * TILT, 0, start, start + Math.PI);
      g.stroke();
    }
    g.restore();
  };

  const arc = (half, t) => {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      const p = place(m, t);
      if (p.far !== half) continue;
      // motes dim as they round the back, and breathe a little
      const depth = half ? 0.62 : 1;
      const pulse = 0.8 + 0.2 * Math.sin(t * 1.7 + m.ph);
      const a = m.br * depth * pulse * 0.9;
      const c = mix(AMBER, BLUE, m.hue);
      const rr = m.sz * S * (half ? 0.85 : 1);
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 4.5);
      gr.addColorStop(0, rgba(c, a));
      gr.addColorStop(0.4, rgba(c, a * 0.28));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, rr * 4.5, 0, 6.2832); g.fill();
    }
    g.restore();
  };

  const frame = (t) => {
    g.clearRect(0, 0, W, H);
    halo();
    band(true, t); arc(true, t);     // the far half of the disc, behind the sphere
    sphere();
    band(false, t); arc(false, t);   // and the near half, in front of it
  };

  let raf = 0, t0 = 0;
  const loop = (now) => {
    if (!t0) t0 = now;
    frame((now - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    size();
    if (reduce) { frame(0); return; }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };

  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(start, 160); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce) { t0 = 0; raf = requestAnimationFrame(loop); }
  });

  start();
})();
