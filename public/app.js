const stage = document.querySelector('#replay-stage');
const pause = document.querySelector('#pause-replay');
const restart = document.querySelector('#restart-replay');
let step = 0, timer, paused = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderReplay() { stage.dataset.stage = String(step); }
function tick() { step = step >= 9 ? 0 : step + 1; renderReplay(); }
function startReplay() { clearInterval(timer); if (!reduced && !paused) timer = setInterval(tick, 3600); }
pause?.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Play' : 'Pause'; pause.setAttribute('aria-pressed', String(paused)); startReplay(); });
restart?.addEventListener('click', () => { step = 0; renderReplay(); startReplay(); });
if (reduced) { step = 9; renderReplay(); } else startReplay();
