/* The landing page's background: the orb, large and interactive. */
(() => {
  const cv = document.querySelector('canvas[data-orb]');
  if (!cv || !window.PhAIOrb) return;

  PhAIOrb(cv, {
    cx: 0.70, cy: 0.40, r: 0.345,         // big: the body is the page's subject
    cxSm: 0.56, cySm: 0.30, rSm: 0.24,
    tilt: 0.30, roll: -0.16,
    motes: 3000,
    inner: 1.07, reach: 1.6,
    interactive: true,
    stars: true,
    glow: 1.15,
  });
})();
