/* PhAI Labs · minimal landing
   Two small jobs: type the accent word and reveal on scroll. Neither is
   required for the page to read: with JS off the word is already in the
   markup and everything is visible. */
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

  /* ---------------- entrance never leaves a blank page ---------------- */
  const anim = $$('.ap, .mask > span');
  anim.forEach((el) => el.addEventListener('animationend', () => el.classList.add('is-in'), { once: true }));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const running = anim.some((el) => (el.getAnimations ? el.getAnimations() : [])
      .some((a) => a.playState === 'running' || a.playState === 'finished'));
    if (!running) anim.forEach((el) => el.classList.add('is-in'));
  }));

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
})();
