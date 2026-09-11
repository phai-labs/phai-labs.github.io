/* The key visual on the pages that have one (home, collaborate).
   The canvas carries its own settings in data-cfg, so each hero can place and
   size the body without a second script. Loaded on every page; costs one failed
   querySelector where there is no hero. */
(() => {
  const cv = document.querySelector('.hero__kv canvas[data-orb], .stage__kv canvas[data-orb]');
  if (!cv || !window.PhAIOrb) return;
  let cfg = {};
  try { cfg = JSON.parse(cv.dataset.cfg || '{}'); } catch (e) { /* keep the defaults */ }
  PhAIOrb(cv, Object.assign({
    cx: 0.72, cy: 0.40, r: 0.30,
    cxSm: 0.56, cySm: 0.34, rSm: 0.22,
    tilt: 0.30, roll: -0.15,
    motes: 2300,
    inner: 1.07, reach: 1.5,
    stars: false,          // the ambient field already carries points behind it
    interactive: true,
  }, cfg));
})();
