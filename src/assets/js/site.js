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

  /* ---------------- key visual ---------------- */
  // The hero still is the base layer and the fallback. Over it sits a muted,
  // looping video of the same artwork; its first frame matches the still, so the
  // fade-in is seamless. Nothing is fetched until it is worth fetching: no bytes
  // for reduced motion, Save-Data, phones, or a hero that never comes into view.
  const saveData = navigator.connection && navigator.connection.saveData;
  const kvVideo = $('video[data-kv-video]');
  if (kvVideo && !reduce && !saveData && innerWidth >= 768) {
    const box = kvVideo.closest('.hero__kv');
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      const add = (src, type) => {
        if (!src) return;
        const s = document.createElement('source');
        s.src = src; s.type = type; kvVideo.appendChild(s);
      };
      add(kvVideo.dataset.webm, 'video/webm');
      add(kvVideo.dataset.mp4, 'video/mp4');
      kvVideo.load();
      const p = kvVideo.play();
      if (p) p.catch(() => {});   // autoplay refused: the still simply stays
    };
    kvVideo.addEventListener('playing', () => {
      kvVideo.classList.add('is-playing');
      if (box) box.classList.add('has-video');
    }, { once: true });
    kvVideo.addEventListener('error', () => {
      kvVideo.classList.remove('is-playing');
      if (box) box.classList.remove('has-video');
    });
    // wait for the page to finish loading, then for an idle moment: the video is
    // decoration and must never compete with the still, the fonts or the first paint
    const whenIdle = (fn) => {
      const go = () => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400));
      if (document.readyState === 'complete') go();
      else addEventListener('load', go, { once: true });
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { whenIdle(start); io.disconnect(); }
      }, { threshold: 0.05 });
      io.observe(kvVideo);
    } else whenIdle(start);
    document.addEventListener('visibilitychange', () => {
      if (!started) return;
      if (document.hidden) kvVideo.pause();
      else { const p = kvVideo.play(); if (p) p.catch(() => {}); }
    });
  } else if (kvVideo) {
    kvVideo.remove();
  }

  /* ---------------- external links ---------------- */
  $$('a[href^="http"]').forEach((a) => {
    if (a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
  });

  /* ---------------- FAQ: only one open at a time ---------------- */
  $$('[data-accordion]').forEach((group) => {
    group.addEventListener('toggle', (e) => {
      if (e.target.open) $$('details[open]', group).forEach((d) => { if (d !== e.target) d.open = false; });
    }, true);
  });
})();
