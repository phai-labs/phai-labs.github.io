/* The product films on /products/. The markup is a plain <video controls>, so
   the film plays with no script at all. With the script, the native controls
   step aside until the reader asks for the film: the still carries one play
   mark, and a click anywhere on it starts playback in place, sound on, with
   the browser's own controls from then on. Loaded only where `player` is set. */
(() => {
  const players = document.querySelectorAll('[data-player]');
  if (!players.length) return;

  players.forEach((fig) => {
    const video = fig.querySelector('video');
    const start = fig.querySelector('[data-play]');
    if (!video || !start) return;

    video.controls = false;
    fig.classList.add('is-ready');

    const reveal = () => {
      fig.classList.add('is-playing');
      video.controls = true;
    };
    start.addEventListener('click', () => {
      reveal();
      const p = video.play();
      if (p && p.catch) p.catch(() => {}); // a refused autoplay leaves the controls to the reader
      video.focus({ preventScroll: true });
    });
    // Played some other way (keyboard shortcut, picture-in-picture): same result.
    video.addEventListener('play', () => {
      reveal();
      // one film at a time: starting this one pauses any other on the page
      players.forEach((other) => {
        const v = other.querySelector('video');
        if (v && v !== video && !v.paused) v.pause();
      });
    });
  });
})();
