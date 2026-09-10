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
  const DEEP = [74, 85, 183];
  const HOT = [231, 236, 247], ICE = [201, 211, 236];
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
      const col = i === HOTI ? HOT : mix(mix(ICE, BLUE, Math.min(1, i / 5)), DEEP, Math.max(0, (i - 5) / 6));
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
        br: (0.4 + rnd() * 0.6) * (1 - band * 0.12),
        hue: Math.min(STEPS - 1, Math.max(0, Math.round((band + (rnd() - 0.5) * 0.09) * (STEPS - 1)))),
        ph: rnd() * Math.PI * 2,
        streak: band < 0.3 && rnd() < 0.16,           // a few smear along the orbit
        ex: 0,                                        // excitation from the pointer
      });
    }
    /* ---------------- the field behind it ----------------
       Three depths, not one. The far layer barely answers the pointer, the near
       one moves most, and the counts fall away as the field comes forward,
       because a sky is mostly distance. Size and colour carry the depth too, so
       it still reads when nothing is moving.
         par   how far the pointer carries the layer, in CSS px
         sz    the square's side, in CSS px
         gain  the layer's brightness, with the old 0.55 ceiling folded in
         base/amp/rate  the twinkle. base >= amp always: a globalAlpha outside
               0..1 is silently ignored and the star would inherit the previous
               one's, which blotches the field. So "nearer twinkles more" is a
               faster rate, not a deeper swing.
         pad   a little overscan, so a layer never runs dry along the edge the
               pointer drags it away from
       Still five rnd() draws a star and 230 stars in total, so the field is the
       same deterministic field -- only its depth is new. */
    const LAYERS = [
      { n: 120, par: 3,  sz: 1,   gain: 0.34, base: 0.62, amp: 0.18, rate: 0.45, pad: 0.012, col: '#aeb6f2', pts: [] },
      { n: 74,  par: 8,  sz: 1.5, gain: 0.55, base: 0.50, amp: 0.50, rate: 0.70, pad: 0.028, col: '#cad0ee', pts: [] },
      { n: 36,  par: 16, sz: 2.2, gain: 0.78, base: 0.50, amp: 0.50, rate: 0.95, pad: 0.050, col: '#e6e9ff', pts: [] },
    ];
    if (o.stars) for (const L of LAYERS) {
      const q = 1 + L.pad * 2;
      for (let i = 0; i < L.n; i++) {
        L.pts.push({
          x: rnd() * q - L.pad,
          y: rnd() * q - L.pad,
          b: (0.16 + rnd() * rnd() * 0.85) * L.gain,
          ph: rnd() * 6.28,
        });
      }
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


    /* ---------------- pieces ---------------- */
    const starfield = (t) => {
      if (!o.stars) return;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const L of LAYERS) {
        /* a layer at a time: one parallax, one size, one colour. The brightness
           rides globalAlpha the way the motes' does, so no rgba() string is
           built and no colour is parsed per star. */
        const dx = P.px * L.par * S, dy = P.py * L.par * S;
        const w = L.sz * S, ph = t * L.rate;
        g.fillStyle = L.col;
        for (const s of L.pts) {
          g.globalAlpha = s.b * (L.base + L.amp * Math.sin(ph + s.ph));
          g.fillRect(s.x * W + dx, s.y * H + dy, w, w);
        }
      }
      g.globalAlpha = 1;
      g.restore();
    };

    const halo = (t) => {
      g.save(); g.globalCompositeOperation = 'lighter';
      const pulse = 1 + 0.05 * Math.sin(t * 0.5) + P.str * 0.35;
      const k = o.glow;
      const h = g.createRadialGradient(OX, OY, R * 0.8, OX, OY, R * 3.4 * pulse);
      h.addColorStop(0, rgba(BLUE, (0.105 * k * (1 + P.str * 0.8)).toFixed(3)));
      h.addColorStop(0.34, rgba([75, 86, 192], (0.075 * k).toFixed(3)));
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
      rg.addColorStop(0.16, rgba(ICE, (0.085 * k).toFixed(4)));
      rg.addColorStop(0.5, rgba(mix(DEEP, BLUE, 0.7), (0.055 * k).toFixed(4)));
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
        const c = mix(mix(HOT, BLUE, Math.min(1, u * 2.6)), DEEP, Math.max(0, u * 1.6 - 0.5));
        const a = (half ? 0.026 : 0.062) * dens(Math.pow(u, 0.8)) * (1 - u * 0.42)
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
        g.strokeStyle = rgba(HOT, (0.15 * o.alpha * boost).toFixed(3));
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
      bg.addColorStop(0, '#282848');
      bg.addColorStop(0.42, '#1c1c31');
      bg.addColorStop(0.82, '#141524');
      bg.addColorStop(1, '#11121d');
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
        g.strokeStyle = 'rgba(5,5,14,' + (0.52 * dens(u * 0.9)).toFixed(3) + ')';
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
      lg.addColorStop(0, rgba(HOT, (0.62 + P.str * 0.22).toFixed(3)));
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

    /* ---------------- the motes, staged then drawn ----------------
       One placement pass a frame. Where a mote lands, how bright it is, how big
       and which sprite it wears are all worked out once and parked in a flat
       buffer, split into the half that goes behind the body and the half that
       goes in front of it. The two halves are then drawn either side of the
       body from that buffer.

       This used to run the loop once per half, which meant the trigonometry ran
       for every mote twice and half of it was thrown away on the `continue`.
       Measured on 2300 motes: 1.8ms -> 1.5ms a frame, with nothing on screen
       changing.

       Stride 7: x, y, alpha, size, sprite, is-streak, streak rotation.        */
    const STRIDE = 7;
    const FAR = new Float64Array(o.motes * STRIDE);
    const NEAR = new Float64Array(o.motes * STRIDE);
    let nFar = 0, nNear = 0;

    const stage = (t, sweep) => {
      nFar = 0; nNear = 0;
      const reach = R * 0.85, reach2 = reach * reach;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        const a = m.a + t * m.sp;
        const sa = Math.sin(a), ca = Math.cos(a);
        const x0 = ca * m.r * R, y0 = sa * m.r * R * TL;
        let x = OX + x0 * RC - y0 * RS;
        let y = OY + x0 * RS + y0 * RC;
        const far = sa < 0;

        /* the pointer excites whatever it is near; the excitement decays and
           pulls the mote a little way toward the cursor while it lasts. Only
           the near half answers -- the far half is behind the body. */
        if (P.has && !far) {
          const dx = x - P.x, dy = y - P.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < reach2) m.ex = Math.min(1, m.ex + (1 - Math.sqrt(d2) / reach) * 0.2);
        }
        m.ex *= 0.955;
        if (m.ex > 0.01) {
          const k = m.ex * m.ex * 0.22;
          x += (P.x - x) * k; y += (P.y - y) * k;
        }

        /* a click sends a pulse round the ring */
        let rip = 0;
        for (const q of ripples) {
          const da = Math.abs(((a - q.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const w = Math.abs(da - q.t * 3.4);
          if (w < 0.34) rip = Math.max(rip, (1 - w / 0.34) * (1 - q.t));
        }
        /* and the slow sweep keeps one arc lit at all times */
        const dsw = Math.abs(((a - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const sw = dsw < 0.75 ? (1 - dsw / 0.75) * 0.55 : 0;

        const depth = far ? 0.58 : 1;
        const pulse = 0.82 + 0.18 * Math.sin(t * 1.7 + m.ph);
        const al = Math.min(1, m.br * depth * pulse * (1 + m.ex * 3 + rip * 2.4 + sw) * o.alpha);
        if (al < 0.004) continue;

        const buf = far ? FAR : NEAR;
        const k = (far ? nFar++ : nNear++) * STRIDE;
        buf[k] = x;
        buf[k + 1] = y;
        buf[k + 2] = al;
        buf[k + 3] = m.sz * S * (far ? 0.85 : 1) * (1 + m.ex * 0.9 + rip * 0.8 + sw * 0.3) * 5.4;
        buf[k + 4] = m.ex > 0.22 || rip > 0.25 ? HOTI : m.hue;
        buf[k + 5] = m.streak ? 1 : 0;
        if (m.streak) {
          /* the tangent to the orbit, in screen space -- worked out here where
             the sine and cosine are already to hand */
          const tx = -sa * RC - ca * TL * RS;
          const ty = -sa * RS + ca * TL * RC;
          buf[k + 6] = Math.atan2(ty, tx);
        }
      }
    };

    const drawHalf = (buf, n) => {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let j = 0; j < n; j++) {
        const k = j * STRIDE;
        const s = buf[k + 3];
        g.globalAlpha = buf[k + 2];
        const img = sprite[buf[k + 4]];
        if (buf[k + 5]) {
          g.save();
          g.translate(buf[k], buf[k + 1]);
          g.rotate(buf[k + 6]);
          g.drawImage(img, -s * 1.5, -s * 0.36, s * 3, s * 0.72);
          g.restore();
        } else {
          g.drawImage(img, buf[k] - s / 2, buf[k + 1] - s / 2, s, s);
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
      cg.addColorStop(0.4, rgba(HOT, (0.045 * P.str).toFixed(3)));
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
      stage(t, sweep);
      haze(true); band(true, t); drawHalf(FAR, nFar);      // far half, behind the body
      body();
      haze(false); band(false, t); drawHalf(NEAR, nNear);  // near half, in front of it
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
