/* PhAI Labs · minimal landing
   Three small jobs: type the accent word, reveal on scroll, and swap in the
   hero video once the page is settled. Nothing here is required for the page
   to read: with JS off, the word is already in the markup, everything is
   visible, and the still stands in for the video. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- the accent word types itself ---------------- */
  const type = $('.type');
  if (type) {
    const word = type.dataset.type || '';
    const out = $('.type__out', type);
    if (reduce || !out) {
      if (out) out.textContent = word;
    } else {
      out.textContent = '';
      // start after the second headline line has finished rising
      const begin = 1250;
      const step = 110;
      let i = 0;
      const tick = () => {
        out.textContent = word.slice(0, ++i);
        if (i < word.length) setTimeout(tick, step);
      };
      setTimeout(tick, begin);
    }
  }

  /* ---------------- reveal on scroll ---------------- */
  const rv = $$('.rv');
  if (reduce || !('IntersectionObserver' in window)) {
    rv.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    rv.forEach((el) => io.observe(el));
  }

  /* ---------------- the hero video ---------------- */
  const v = $('video[data-kv-video]');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (!v) return;
  if (reduce || saveData || innerWidth < 768) { v.remove(); return; }

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const add = (src, t) => {
      if (!src) return;
      const s = document.createElement('source');
      s.src = src; s.type = t; v.appendChild(s);
    };
    add(v.dataset.webm, 'video/webm');
    add(v.dataset.mp4, 'video/mp4');
    v.load();
    const p = v.play();
    if (p) p.catch(() => {});
  };
  v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });

  const whenIdle = (fn) => {
    const go = () => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400));
    if (document.readyState === 'complete') go();
    else addEventListener('load', go, { once: true });
  };
  whenIdle(start);

  document.addEventListener('visibilitychange', () => {
    if (!started) return;
    if (document.hidden) v.pause();
    else { const p = v.play(); if (p) p.catch(() => {}); }
  });
})();
