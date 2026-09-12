/* Copy-to-clipboard for the citation and BibTeX blocks on a paper page.
   The label reverts on its own, so a reader who copies twice sees it work
   twice. Loaded only where `papersCss` is set. */
(() => {
  const blocks = document.querySelectorAll('[data-copy]');
  if (!blocks.length) return;

  const write = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // http:// previews and older Safari never get the async API.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  };

  blocks.forEach((block) => {
    const src = block.querySelector('[data-copy-src]');
    const btn = block.querySelector('[data-copy-btn]');
    if (!src || !btn) return;
    const idle = btn.textContent;
    let t = 0;
    btn.addEventListener('click', async () => {
      try {
        await write(src.textContent);
      } catch (e) {
        return; // clipboard refused: leave the text selectable and say nothing
      }
      btn.textContent = btn.dataset.done || idle;
      btn.classList.add('is-done');
      clearTimeout(t);
      t = setTimeout(() => {
        btn.textContent = idle;
        btn.classList.remove('is-done');
      }, 1800);
    });
  });
})();
