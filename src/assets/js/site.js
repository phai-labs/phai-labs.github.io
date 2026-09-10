/* PhAI Labs -- site behaviour. No dependencies.
 *
 *  progress   top bar bound to scroll position
 *  mast       compact header after scrolling; mobile drawer
 *  reveal     full-page scroll reveal: every heading, paragraph, figure and
 *             list steps in as it enters the viewport, per-section stagger
 *  spy        in-page sub-navigation active state (Collaborate, Tech)
 *  kv         swap the static key visual for its animated version once it is
 *             on screen, only when motion is allowed
 *  links      external links open safely in a new tab
 */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- progress ---------------- */
  const bar = $('.progress i');
  let ticking = false;
  const paint = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(scrollY / max, 1) : 0;
    if (bar) bar.style.transform = `scaleX(${p})`;
    document.body.classList.toggle('is-scrolled', scrollY > 24);
    ticking = false;
  };
  const onScroll = () => { if (!ticking) { requestAnimationFrame(paint); ticking = true; } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  paint();

  /* ---------------- mast / drawer ---------------- */
  const menu = $('[data-menu]'), drawer = $('[data-drawer]');
  if (menu && drawer) {
    const set = (open) => {
      menu.setAttribute('aria-expanded', String(open));
      drawer.hidden = !open;
      document.body.classList.toggle('drawer-open', open);
    };
    menu.addEventListener('click', () => set(menu.getAttribute('aria-expanded') !== 'true'));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) set(false); });
  }

  /* ---------------- reveal ---------------- */
  // Everything that carries meaning steps in: not only cards. Elements opt out
  // with data-no-reveal on themselves or an ancestor; whole blocks can opt in
  // as one unit with data-reveal.
  const SEL = 'h1,h2,h3,h4,p,li,figure,blockquote,table,dl,.eyebrow,.btn,.kv,[data-reveal]';
  const targets = $$('.main ' + SEL.split(',').join(',.main ') + ',.foot [data-reveal],.foot p,.foot a')
    .filter((el) => !el.closest('[data-no-reveal]'))
    .filter((el) => !el.closest('[data-reveal]') || el.hasAttribute('data-reveal'))
    .filter((el) => !(el.tagName === 'LI' && el.closest('[data-reveal]')));

  // stagger within each section so a block reads top-to-bottom, then reset
  let section = null, k = 0;
  targets.forEach((el) => {
    const host = el.closest('section, header, footer, article') || document.body;
    if (host !== section) { section = host; k = 0; }
    el.classList.add('rv');
    el.style.setProperty('--d', `${Math.min(k, 9) * 70}ms`);
    k += 1;
  });

  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -7% 0px' });
    targets.forEach((el) => io.observe(el));
    // anything already above the fold on load should not wait
    requestAnimationFrame(() => targets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9 && r.bottom > 0) el.classList.add('in');
    }));
  }

  /* ---------------- chapters ---------------- */
  // a section learns it is on stage: its top hairline draws, its strip's bead runs
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); so.unobserve(e.target); }
    }), { threshold: 0.04 });
    $$('.sec, .hero').forEach((s) => so.observe(s));
  } else $$('.sec, .hero').forEach((s) => s.classList.add('is-in'));

  /* ---------------- news timeline: fills as you read ---------------- */
  const tl = $('.timeline--nodes');
  if (tl) {
    const entries = $$('.entry', tl);
    const fill = () => {
      const r = tl.getBoundingClientRect(), line = innerHeight * 0.62;
      const p = Math.min(1, Math.max(0, (line - r.top) / r.height));
      tl.style.setProperty('--p', reduce ? 1 : p.toFixed(3));
      entries.forEach((en) => en.classList.toggle('is-lit', reduce || en.getBoundingClientRect().top + 24 < line));
    };
    let tk = false;
    addEventListener('scroll', () => { if (!tk) { requestAnimationFrame(() => { fill(); tk = false; }); tk = true; } }, { passive: true });
    addEventListener('resize', fill); fill();
  }

  /* ---------------- scroll-spy ---------------- */
  const subnav = $('[data-subnav]');
  if (subnav) {
    const links = $$('a[href^="#"]', subnav);
    const ids = links.map((a) => a.getAttribute('href').slice(1));
    const secs = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const activate = (id) => links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    const spy = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) activate(vis.target.id);
    }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.2, 0.5] });
    secs.forEach((s) => spy.observe(s));
    links.forEach((a) => a.addEventListener('click', (e) => {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', a.getAttribute('href'));
    }));
  }

  /* ---------------- external links ---------------- */
  $$('a[href^="http"]').forEach((a) => {
    if (a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
  });

  /* ---------------- lit buttons ---------------- */
  // The cursor is a light source and an outlined button catches a specular on
  // the border arc nearest it. The light itself is entirely CSS; this only
  // says where it is.
  // Hover does the proximity test, so nothing is measured until a button is
  // actually under the pointer -- and nothing at all on a page with no buttons.
  // That matters on home and collaborate, where orb.js's own pointermove
  // already forces a layout flush beside a 2300-mote loop; a second rect read
  // per move is the cost the hero cannot carry. It is also why the set is never
  // measured up front: a .btn inside a closed <details> has a zero rect, and a
  // hover-driven read can never see one.
  // The gate mirrors the stylesheet's query rather than its complement, so
  // there is no state where the script writes properties no rule consumes.
  // Reduced motion is deliberately NOT read here: the media query is the whole
  // policy, so an OS toggle takes effect without a reload and without a change
  // listener, and the two properties written into the void cost nothing.
  const LIT = '.btn:not(.btn--primary)';
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let lit = null, box = null, cx = 0, cy = 0, queued = false;

    // one rect per hover session, not per frame; a cached box makes the move
    // path two subtractions and two divides with no layout read at all
    const write = () => {
      queued = false;
      if (!lit) return;
      if (!box) box = lit.getBoundingClientRect();
      if (!box.width || !box.height) return;
      lit.style.setProperty('--lx', (((cx - box.left) / box.width) * 100).toFixed(2) + '%');
      lit.style.setProperty('--ly', (((cy - box.top) / box.height) * 100).toFixed(2) + '%');
    };
    const draw = () => { if (!queued) { requestAnimationFrame(write); queued = true; } };
    // every .btn is in the reveal set, and .rv holds transform:translateY(12px)
    // for up to 1430ms after load -- a rect cached mid-reveal is twelve pixels
    // low for the whole hover. The same listener also catches .btn:hover's own
    // translateY(-1px), so the box is right once the button has settled.
    const settled = (e) => { if (e.propertyName === 'transform') { box = null; draw(); } };
    const dark = () => {
      if (!lit) return;
      lit.removeEventListener('transitionend', settled);
      lit.classList.remove('is-under');
      lit = null; box = null;
    };

    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest(LIT);
      if (!t || t === lit) return;          // crossing into a child is not a new surface
      dark();
      lit = t; box = t.getBoundingClientRect();
      cx = e.clientX; cy = e.clientY;
      write();                              // placed before the class, so the light
      t.addEventListener('transitionend', settled);
      t.classList.add('is-under');          // arrives where the pointer is, not where it was
    }, { passive: true });

    document.addEventListener('pointerout', (e) => {
      // contains(null) is false, so leaving the window unlights correctly
      if (lit && !lit.contains(e.relatedTarget)) dark();
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
      if (!lit) return;                     // this effect's entire cost when nothing is lit
      cx = e.clientX; cy = e.clientY;
      draw();
    }, { passive: true });

    // a scrolled or resized box has moved under the pointer. Captured on
    // document because scroll does not bubble to window.
    const stale = () => { box = null; };
    document.addEventListener('scroll', stale, { capture: true, passive: true });
    addEventListener('resize', stale);

    // @view-transition{navigation:auto} captures the outgoing page at pageswap,
    // which is before pagehide and before any transition of ours could finish
    // -- so the light is cut on that frame, not faded. pagehide covers the
    // bfcache case, where nothing would ever unlight it.
    addEventListener('pageswap', () => { document.documentElement.classList.add('is-leaving'); dark(); });
    addEventListener('pagehide', dark);
    addEventListener('pageshow', () => document.documentElement.classList.remove('is-leaving'));
  }

  /* ---------------- FAQ: only one open at a time ---------------- */
  $$('[data-accordion]').forEach((group) => {
    group.addEventListener('toggle', (e) => {
      if (e.target.open) $$('details[open]', group).forEach((d) => { if (d !== e.target) d.open = false; });
    }, true);
  });
})();
