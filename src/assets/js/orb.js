/* PhAI Labs · orb
   A dark body inside a luminous ring, drawn on a canvas. Ours, not an image or
   a video: a few KB, sharp at any size, and the ring passes behind the body on
   the far side and in front of it on the near side, which is what carries the
   depth. The body catches a rim light and wears the ring's shadow; the ring has
   divisions, differential rotation and a slow luminous sweep, so it reads as a
   structure in orbit rather than a glow.

   Two pages use it with different settings, so it lives here once:
     PhAIOrb(canvas, { cx, cy, r, tilt, roll, motes, reach, interactive, ... })

   Speed: every mote is one drawImage of a pre-rendered sprite, not a gradient
   built per frame, so a few thousand of them stay cheap and leave headroom for
   the pointer work.

   Pointer: the listeners go on window, not on the canvas's parent -- the KV box
   is pointer-events:none so the copy above it stays selectable, and a listener
   there would never fire. Coordinates come from the canvas rect instead.      */
(() => {
  const BLUE = [155, 167, 255];
  const AMBER = [210, 156, 82];
  const HOT = [255, 240, 219];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

  /* one sprite per hue step, drawn once, tinted, reused for every mote;
     the last one is the hot white the pointer excites motes into */
  const STEPS = 12;
  const HOTI = STEPS;
  let sprites = null;
  const buildSprites = () => {
    if (sprites) return sprites;
    sprites = [];
    const S = 64;
    for (let i = 0; i <= STEPS; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const x = c.getContext('2d');
      const col = i === HOTI ? HOT : mix(AMBER, BLUE, i / (STEPS - 1));
      const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, rgba(col, 1));
      g.addColorStop(0.14, rgba(col, 0.62));
      g.addColorStop(0.34, rgba(col, 0.2));
      g.addColorStop(0.62, rgba(col, 0.045));
      g.addColorStop(1, rgba(col, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, S, S);
      sprites.push(c);
    }
    return sprites;
  };

  window.PhAIOrb = function (cv, opts) {
    const o = Object.assign({
      cx: 0.68, cy: 0.46, r: 0.19,        // fractions of the box / of min(w,h)
      cxSm: 0.60, cySm: 0.34, rSm: 0.18,  // under 760px wide
      tilt: 0.32, roll: -0.17,
      motes: 2200,
      inner: 1.08, reach: 1.45,           // ring runs inner -> inner+reach, in body radii
      interactive: true,
      stars: true,
      spin: 1,
      alpha: 1,
      glow: 1,
    }, opts || {});

    const g = cv.getContext('2d', { alpha: true });
    if (!g) return { destroy() {} };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const sprite = buildSprites();

    let seed = 20260915;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

    /* the ring is not solid: two dark divisions carve it into three bands.
       1 = full density, 0 = swept clean. */
    const dens = (u) => {
      const a = (u - 0.31) / 0.055, b = (u - 0.70) / 0.045;
      return Math.max(0.04, 1 - 0.86 * Math.exp(-a * a) - 0.66 * Math.exp(-b * b));
    };

    /* ---------------- the ring ---------------- */
    const motes = [];
    let guard = o.motes * 6;
    while (motes.length < o.motes && guard-- > 0) {
      const band = Math.pow(rnd(), 0.7);              // packed toward the inner rim
      if (rnd() > dens(band)) continue;               // this one fell in a division
      const r = o.inner + band * o.reach;
      motes.push({
        a: rnd() * Math.PI * 2,
        band: band,
        r: r,
        sp: (0.42 / Math.pow(r, 1.2)) * o.spin,       // differential: inner runs faster
        sz: 0.5 + rnd() * rnd() * 3.6,
        br: (0.3 + rnd() * 0.7) * (1 - band * 0.34),
        hue: Math.min(STEPS - 1, Math.max(0, Math.round((band * 1.25 + (rnd() - 0.5) * 0.4) * (STEPS - 1)))),
        ph: rnd() * Math.PI * 2,
        streak: band < 0.3 && rnd() < 0.16,           // a few smear along the orbit
        ex: 0,                                        // excitation from the pointer
      });
    }
    const stars = [];
    if (o.stars) for (let i = 0; i < 230; i++) {
      stars.push({ x: rnd(), y: rnd(), b: 0.16 + rnd() * rnd() * 0.85, ph: rnd() * 6.28 });
    }
    let sparks = [];

    /* ---------------- geometry ---------------- */
    let W = 0, H = 0, S = 1, cx = 0, cy = 0, R = 1, small = false;
    const size = () => {
      const b = cv.getBoundingClientRect();
      if (!b.width || !b.height) return false;
      S = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(b.width * S));
      H = Math.max(1, Math.round(b.height * S));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      small = b.width < 760;
      cx = W * (small ? o.cxSm : o.cx);
      cy = H * (small ? o.cySm : o.cy);
      R = Math.min(W, H) * (small ? o.rSm : o.r);
      return true;
    };

    /* pointer: a smoothed parallax nudge, plus a hot spot that follows the
       cursor and a "near the ring" strength that drives the glow */
    const P = { x: -1e5, y: -1e5, has: false, px: 0, py: 0, tx: 0, ty: 0, str: 0, tstr: 0 };
    let ripples = [];
    let flash = 0;

    const rollNow = () => o.roll + P.px * 0.055;
    const tiltNow = () => o.tilt + P.py * 0.05;
    const ox = () => cx + P.px * R * 0.12;
    const oy = () => cy + P.py * R * 0.12;

    /* the frame's geometry, resolved once: the ring's roll and tilt are the same
       for every mote, and there are a few thousand of them */
    let RL = 0, RC = 1, RS = 0, TL = 0.3, OX = 0, OY = 0;
    const resolve = () => { RL = rollNow(); RC = Math.cos(RL); RS = Math.sin(RL); TL = tiltNow(); OX = ox(); OY = oy(); };

    const place = (m, t, out) => {
      const a = m.a + t * m.sp;
      const sa = Math.sin(a), ca = Math.cos(a);
      const x0 = ca * m.r * R;
      const y0 = sa * m.r * R * TL;
      out.x = OX + x0 * RC - y0 * RS;
      out.y = OY + x0 * RS + y0 * RC;
      out.far = sa < 0;
      out.a = a;
      return out;
    };

    /* ---------------- pieces ---------------- */
    const starfield = (t) => {
      if (!o.stars) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        const a = s.b * (0.5 + 0.5 * Math.sin(t * 0.7 + s.ph)) * 0.55;
        g.fillStyle = 'rgba(202,208,238,' + a.toFixed(3) + ')';
        const w = s.b > 0.75 ? S * 2 : S;
        g.fillRect(s.x * W + P.px * 8, s.y * H + P.py * 8, w, w);
      }
      g.restore();
    };

    const halo = (t) => {
      g.save(); g.globalCompositeOperation = 'lighter';
      const pulse = 1 + 0.05 * Math.sin(t * 0.5) + P.str * 0.35;
      const k = o.glow;
      const h = g.createRadialGradient(OX, OY, R * 0.8, OX, OY, R * 3.4 * pulse);
      h.addColorStop(0, rgba(BLUE, (0.10 * k * (1 + P.str * 0.8)).toFixed(3)));
      h.addColorStop(0.34, rgba(AMBER, (0.055 * k).toFixed(3)));
      h.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = h; g.fillRect(0, 0, W, H);
      g.restore();
    };

    /* the ring's mass: an elliptical haze, one half at a time */
    const haze = (half) => {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(OX, OY);
      g.rotate(RL);
      g.scale(1, TL);
      g.beginPath();
      g.rect(-R * 6, half ? -R * 6 : 0, R * 12, R * 6);
      g.clip();
      const k = (half ? 0.5 : 1) * o.alpha * (1 + P.str * 0.5);
      const rg = g.createRadialGradient(0, 0, R * o.inner * 0.95, 0, 0, R * (o.inner + o.reach));
      rg.addColorStop(0, rgba(HOT, (0.10 * k).toFixed(4)));
      rg.addColorStop(0.16, rgba(AMBER, (0.085 * k).toFixed(4)));
      rg.addColorStop(0.5, rgba(mix(AMBER, BLUE, 0.7), (0.055 * k).toFixed(4)));
      rg.addColorStop(1, rgba(BLUE, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, R * (o.inner + o.reach), 0, 6.2832);
      g.arc(0, 0, R * o.inner * 0.97, 0, 6.2832, true);
      g.fill();
      g.restore();
    };

    /* the grooves: concentric strokes, thinned where the divisions are */
    const band = (half, t) => {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(OX, OY);
      g.rotate(RL);
      const start = half ? Math.PI : 0;
      const tilt = TL;
      const boost = 1 + P.str * 0.7;
      for (let i = 0; i < 26; i++) {
        const u = i / 25;
        const rr = R * (o.inner + Math.pow(u, 0.8) * o.reach);
        const c = mix(mix(HOT, AMBER, Math.min(1, u * 2.6)), BLUE, Math.max(0, u * 1.6 - 0.5));
        const a = (half ? 0.026 : 0.062) * dens(u) * (1 - u * 0.42)
          * (0.9 + 0.1 * Math.sin(t * 1.3 + i)) * o.alpha * boost;
        if (a < 0.002) continue;
        g.strokeStyle = rgba(c, a.toFixed(4));
        g.lineWidth = Math.max(1, R * 0.052);
        g.beginPath();
        g.ellipse(0, 0, rr, rr * tilt, 0, start, start + Math.PI);
        g.stroke();
      }
      /* the inner rim catches the light: one bright, tight ellipse */
      if (!half) {
        const rr = R * o.inner * 1.02;
        g.strokeStyle = rgba(HOT, (0.20 * o.alpha * boost).toFixed(3));
        g.lineWidth = Math.max(1, R * 0.012);
        g.beginPath();
        g.ellipse(0, 0, rr, rr * tilt, 0, 0, Math.PI);
        g.stroke();
      }
      g.restore();
    };

    const body = () => {
      const px = OX, py = OY;
      /* the sphere, lit from the upper left */
      const bg = g.createRadialGradient(px - R * 0.38, py - R * 0.44, R * 0.03, px, py, R * 1.02);
      bg.addColorStop(0, '#151827');
      bg.addColorStop(0.42, '#0a0c13');
      bg.addColorStop(0.82, '#06060a');
      bg.addColorStop(1, '#040406');
      g.fillStyle = bg;
      g.beginPath(); g.arc(px, py, R, 0, 6.2832); g.fill();

      /* the ring's shadow, laid across the body away from the light */
      g.save();
      g.beginPath(); g.arc(px, py, R * 0.995, 0, 6.2832); g.clip();
      g.translate(px + R * 0.34, py + R * 0.3);
      g.rotate(RL);
      const tilt = TL;
      for (let i = 0; i < 12; i++) {
        const u = i / 11;
        const rr = R * (o.inner * 0.86 + u * o.reach * 0.9);
        g.strokeStyle = 'rgba(2,3,6,' + (0.42 * dens(u * 0.9)).toFixed(3) + ')';
        g.lineWidth = Math.max(1, R * 0.1);
        g.beginPath();
        g.ellipse(0, 0, rr, rr * tilt, 0, 0, Math.PI);
        g.stroke();
      }
      g.restore();

      g.save(); g.globalCompositeOperation = 'lighter';
      /* a faint rim all round, so the body never dissolves into the page */
      const amb = g.createRadialGradient(px, py, R * 0.9, px, py, R * 1.02);
      amb.addColorStop(0, rgba(BLUE, 0));
      amb.addColorStop(1, rgba(BLUE, (0.16 + P.str * 0.18).toFixed(3)));
      g.fillStyle = amb;
      g.beginPath(); g.arc(px, py, R * 1.02, 0, 6.2832); g.fill();

      /* and a bright crescent on the lit side */
      const L = -2.3;                                   // upper left
      const lg = g.createLinearGradient(px + Math.cos(L) * R, py + Math.sin(L) * R,
        px - Math.cos(L) * R, py - Math.sin(L) * R);
      lg.addColorStop(0, rgba([196, 206, 255], (0.72 + P.str * 0.25).toFixed(3)));
      lg.addColorStop(0.34, rgba(BLUE, 0.1));
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = lg;
      g.lineWidth = Math.max(1.2, R * 0.022);
      g.beginPath(); g.arc(px, py, R * 0.99, 0, 6.2832); g.stroke();

      /* the atmosphere hugging the limb */
      const at2 = g.createRadialGradient(px, py, R * 0.98, px, py, R * 1.2);
      at2.addColorStop(0, rgba(BLUE, (0.13 * o.glow).toFixed(3)));
      at2.addColorStop(1, rgba(BLUE, 0));
      g.fillStyle = at2;
      g.beginPath(); g.arc(px, py, R * 1.2, 0, 6.2832); g.fill();
      g.restore();
    };

    const disc = (half, t, sweep) => {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const depth = half ? 0.58 : 1;
      const rr2 = R * 0.85, rad2 = rr2 * rr2;
      const rollC = RC, rollS = RS, tilt = TL;
      const p = { x: 0, y: 0, far: false, a: 0 };
      for (const m of motes) {
        place(m, t, p);
        if (p.far !== half) continue;

        /* the pointer excites whatever it is near; the excitement decays and
           pulls the mote a little way toward the cursor while it lasts */
        if (P.has && !half) {
          const dx = p.x - P.x, dy = p.y - P.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < rad2) m.ex = Math.min(1, m.ex + (1 - Math.sqrt(d2) / rr2) * 0.2);
        }
        m.ex *= 0.955;
        let x = p.x, y = p.y;
        if (m.ex > 0.01) {
          const k = m.ex * m.ex * 0.22;
          x += (P.x - x) * k; y += (P.y - y) * k;
        }

        /* a click sends a pulse round the ring */
        let rip = 0;
        for (const q of ripples) {
          const da = Math.abs(((p.a - q.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const w = Math.abs(da - q.t * 3.4);
          if (w < 0.34) rip = Math.max(rip, (1 - w / 0.34) * (1 - q.t));
        }
        /* and the slow sweep keeps one arc lit at all times */
        const dsw = Math.abs(((p.a - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const sw = dsw < 0.75 ? (1 - dsw / 0.75) * 0.55 : 0;

        const pulse = 0.82 + 0.18 * Math.sin(t * 1.7 + m.ph);
        const a = Math.min(1, m.br * depth * pulse * (1 + m.ex * 3 + rip * 2.4 + sw) * o.alpha);
        if (a < 0.004) continue;
        const s = m.sz * S * (half ? 0.85 : 1) * (1 + m.ex * 0.9 + rip * 0.8 + sw * 0.3) * 5.4;
        const img = sprite[m.ex > 0.22 || rip > 0.25 ? HOTI : m.hue];
        g.globalAlpha = a;
        if (m.streak) {
          const tx = -Math.sin(p.a) * rollC - Math.cos(p.a) * tilt * rollS;
          const ty = -Math.sin(p.a) * rollS + Math.cos(p.a) * tilt * rollC;
          g.save();
          g.translate(x, y);
          g.rotate(Math.atan2(ty, tx));
          g.drawImage(img, -s * 1.5, -s * 0.36, s * 3, s * 0.72);
          g.restore();
        } else {
          g.drawImage(img, x - s / 2, y - s / 2, s, s);
        }
      }
      g.globalAlpha = 1;
      g.restore();
    };

    /* the cursor's own bloom, and the sparks a click throws off */
    const cursor = () => {
      if (!P.has || P.str < 0.05) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      const rr = R * 0.5;
      const cg = g.createRadialGradient(P.x, P.y, 0, P.x, P.y, rr);
      cg.addColorStop(0, rgba(HOT, (0.13 * P.str).toFixed(3)));
      cg.addColorStop(0.4, rgba(AMBER, (0.05 * P.str).toFixed(3)));
      cg.addColorStop(1, rgba(BLUE, 0));
      g.fillStyle = cg;
      g.beginPath(); g.arc(P.x, P.y, rr, 0, 6.2832); g.fill();
      g.restore();
    };

    const drawSparks = (dt) => {
      if (!sparks.length) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      const tilt = TL, c = RC, s = RS;
      for (const k of sparks) {
        k.life -= dt * 0.85;
        k.a += k.va * dt; k.r += k.vr * dt; k.vr *= 0.97;
        if (k.life <= 0) continue;
        const x0 = Math.cos(k.a) * k.r * R, y0 = Math.sin(k.a) * k.r * R * tilt;
        const x = OX + x0 * c - y0 * s, y = OY + x0 * s + y0 * c;
        const sz = 9 * S * k.life;
        g.globalAlpha = Math.min(1, k.life * 1.1);
        g.drawImage(sprite[HOTI], x - sz / 2, y - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;
      g.restore();
      sparks = sparks.filter((k) => k.life > 0);
    };

    const veil = () => {
      if (flash < 0.01) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      const fg = g.createRadialGradient(OX, OY, R * o.inner, OX, OY, R * (o.inner + o.reach) * 1.1);
      fg.addColorStop(0, rgba(HOT, (0.06 * flash).toFixed(3)));
      fg.addColorStop(1, rgba(HOT, 0));
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
      g.restore();
    };

    const frame = (t, dt) => {
      /* the pointer arrives smoothed, so nothing snaps */
      P.px += (P.tx - P.px) * Math.min(1, dt * 3.4);
      P.py += (P.ty - P.py) * Math.min(1, dt * 3.4);
      P.str += (P.tstr - P.str) * Math.min(1, dt * 4.5);
      const sweep = t * 0.42;
      resolve();

      g.clearRect(0, 0, W, H);
      starfield(t);
      halo(t);
      haze(true); band(true, t); disc(true, t, sweep);     // far half, behind the body
      body();
      haze(false); band(false, t); disc(false, t, sweep);  // near half, in front of it
      drawSparks(dt);
      cursor();
      veil();

      ripples = ripples.filter((q) => (q.t += dt * 0.62) < 1);
      flash *= Math.pow(0.05, dt);
    };

    /* ---------------- run ---------------- */
    let raf = 0, t0 = 0, prev = 0, dead = false;
    const loop = (now) => {
      if (dead) return;
      if (!t0) { t0 = now; prev = now; }
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      frame((now - t0) / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!size()) return;
      cancelAnimationFrame(raf);
      if (reduce) { frame(0, 0.016); return; }
      t0 = 0;
      raf = requestAnimationFrame(loop);
    };

    /* The pointer lives on window: the KV box is pointer-events:none so the
       copy over it stays live, and a listener there would never fire. */
    const at = (e) => {
      const b = cv.getBoundingClientRect();
      return { b: b, x: (e.clientX - b.left) * S, y: (e.clientY - b.top) * S };
    };
    const onMove = (e) => {
      const q = at(e);
      const b = q.b;
      if (!b.width || !b.height) return;
      const inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
      P.x = q.x; P.y = q.y; P.has = inside;
      P.tx = Math.max(-1.4, Math.min(1.4, ((e.clientX - b.left) / b.width - 0.5) * 2));
      P.ty = Math.max(-1.4, Math.min(1.4, ((e.clientY - b.top) / b.height - 0.5) * 2));
      if (!inside) { P.tstr = 0; return; }
      /* how close the cursor is to the ring, in ring coordinates */
      const rr = rollNow(), c = Math.cos(rr), s = Math.sin(rr);
      const dx = q.x - ox(), dy = q.y - oy();
      const u = (dx * c + dy * s) / R, v = (-dx * s + dy * c) / (R * (tiltNow() || 1));
      const d = Math.hypot(u, v);
      P.tstr = d < o.inner * 0.75 ? 0.22 : d < (o.inner + o.reach) * 1.15 ? 1 : 0.12;
    };
    const onLeave = () => { P.has = false; P.tx = 0; P.ty = 0; P.tstr = 0; };
    const onDown = (e) => {
      const q = at(e);
      const b = q.b;
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) return;
      const rr = rollNow(), c = Math.cos(rr), s = Math.sin(rr);
      const dx = q.x - ox(), dy = q.y - oy();
      const u = dx * c + dy * s, v = (-dx * s + dy * c) / (tiltNow() || 1);
      const a = Math.atan2(v, u);
      ripples.push({ a: a, t: 0 });
      if (ripples.length > 3) ripples.shift();
      const rad = Math.max(o.inner, Math.min(o.inner + o.reach, Math.hypot(u, v) / R));
      for (let i = 0; i < 26; i++) {
        sparks.push({
          a: a + (rnd() - 0.5) * 0.3,
          r: rad + (rnd() - 0.5) * 0.14,
          va: (rnd() - 0.5) * 1.5,
          vr: (rnd() - 0.4) * 0.5,
          life: 0.55 + rnd() * 0.5,
        });
      }
      if (sparks.length > 120) sparks = sparks.slice(-120);
      P.str = 1; P.tstr = 1;
      flash = 1;
    };
    if (o.interactive && !reduce && !coarse) {
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerdown', onDown, { passive: true });
      document.addEventListener('pointerleave', onLeave, { passive: true });
    }

    let rz;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(start, 150); };
    addEventListener('resize', onResize, { passive: true });
    let ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(onResize); ro.observe(cv); }
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce && !dead) { t0 = 0; raf = requestAnimationFrame(loop); }
    };
    document.addEventListener('visibilitychange', onVis);

    start();

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        removeEventListener('resize', onResize);
        if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerdown', onDown);
        document.removeEventListener('pointerleave', onLeave);
      },
    };
  };
})();
