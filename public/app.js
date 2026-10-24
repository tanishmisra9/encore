const $ = s => document.querySelector(s);
const STOCKS = ['red', 'mustard', 'green', 'cobalt'];
const PRESETS = {
  us: { name: '', born: 1946, anchors: ['Frank Sinatra', 'Elvis Presley'] },
  mexico: { name: '', born: 1950, anchors: ['Vicente Fernández', 'José José'] },
  greece: { name: '', born: 1947, anchors: ['Nana Mouskouri', 'Mikis Theodorakis'] },
  india: { name: '', born: 1948, anchors: ['Lata Mangeshkar', 'Kishore Kumar'] },
};
const LABEL = { smiled: 'Smiled', neutral: 'Okay', upset: 'Upset' };
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>', STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let session = null, audio = null, playingId = null, busy = false;
const who = () => session?.name || 'they';

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function stopAudio() { audio?.pause(); audio = null; playingId = null; }
function stripHtml(item, index) {
  const stock = STOCKS[index % STOCKS.length], song = item.kind === 'song', was = session.name ? 'was' : 'were', person = session.name || 'They';
  // Found songs carry no per-song year, so they show no meta line rather than a repeated vague one.
  const meta = song ? (item.ages[0] === item.ages[1] ? `${item.year}. ${person} ${was} ${item.age}` : '') : `${item.kind === 'film' ? 'Film' : 'Show'}, ${item.year}. ${person} ${was} ${item.age}`;
  const side = !song ? `<button class="play rate" data-rate aria-label="Rate ${esc(item.title)}">Rate</button>` : item.previewUrl ? `<button class="play" data-play="${esc(item.id)}" aria-label="Play ${esc(item.title)} by ${esc(item.by)}">${PLAY}</button>` : '<span class="nopreview">No preview</span>';
  const react = ['smiled', 'neutral', 'upset'].map(r => `<button data-react="${r}" data-item="${esc(item.id)}" aria-pressed="${item.reaction === r}">${LABEL[r]}</button>`).join('');
  const open = item.reaction ? 'open' : '';
  return `<article class="strip s-${stock} ${open}" style="--i:${index}" data-id="${esc(item.id)}">
    <div class="code" aria-hidden="true">${esc(item.code)}</div>
    <div class="text"><h3 class="title"><button class="toggle" aria-expanded="${!!open}">${esc(item.title)}</button></h3>${item.by ? `<p class="by">${esc(item.by)}</p>` : ''}${meta ? `<p class="meta">${meta}</p>` : ''}</div>
    ${side}<div class="react" role="group" aria-label="How did ${esc(item.title)} land?">${react}</div><div class="bar" aria-hidden="true"></div></article>`;
}
function render(animate = true) {
  $('#wall').classList.toggle('still', !animate);
  $('#wall').innerHTML = session.plan.map(stripHtml).join('');
  $('#prompts').innerHTML = session.prompts.map(p => `<li>${esc(p)}</li>`).join('');
  $('#trace').innerHTML = session.trace.map(t => `<li>${esc(t.text)}${t.kept !== undefined ? ` Kept ${t.kept}${t.dropped ? `, set aside ${t.dropped}` : ''}.` : ''}</li>`).join('');
  $('#summary-link').href = `/summary.html?id=${session.id}`;
  $('#after').hidden = false;
}
function blank(text) {
  $('#wall').innerHTML = `<article class="strip blank"><div class="code" aria-hidden="true">--</div><div class="text">${esc(text)}</div></article>`;
  $('#after').hidden = true;
}
function title(heading, sub) { $('#wall-title').textContent = heading; $('#wall-sub').textContent = sub; $('#wall-sub').dataset.sub = sub; }
const era = born => `${born + 10} to ${born + 30}`;

async function build(input, heading, sub) {
  if (busy) return; busy = true; stopAudio();
  $('#session').setAttribute('aria-busy', 'true'); title(heading, sub);
  blank(`Looking for songs from ${era(input.born)}`);
  try {
    session = await api('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    render(); history.replaceState(null, '', `#${session.id}`);
    if (session.unresolved.length) $('#error').textContent = `Qloo could not find ${session.unresolved.join(', ')}; the rest was used.`;
    return true;
  } catch (error) { blank(error.message); $('#error').textContent = error.message; return false; }
  finally { busy = false; $('#session').setAttribute('aria-busy', 'false'); }
}

document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', async () => {
  document.querySelectorAll('.preset').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  const p = PRESETS[button.dataset.preset];
  await build(p, `Example, born ${p.born}`, `Loved ${p.anchors.join(' and ')}`);
}));

$('#wall').addEventListener('click', async event => {
  const toggle = event.target.closest('.toggle') || (event.target.closest('[data-rate]') && event.target.closest('.strip').querySelector('.toggle')), play = event.target.closest('[data-play]'), react = event.target.closest('[data-react]');
  if (toggle) { const strip = toggle.closest('.strip'); const open = strip.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); }
  if (play) {
    const id = play.dataset.play, item = session.plan.find(i => i.id === id), same = playingId === id;
    document.querySelectorAll('.strip.playing').forEach(s => { s.classList.remove('playing'); s.querySelector('.play').innerHTML = PLAY; s.querySelector('.bar').style.transform = 'scaleX(0)'; });
    stopAudio(); $('#wall-sub').textContent = $('#wall-sub').dataset.sub || ''; if (same) return;
    audio = new Audio(item.previewUrl); playingId = id;
    const strip = play.closest('.strip'); strip.classList.add('playing', 'open'); strip.querySelector('.toggle').setAttribute('aria-expanded', 'true'); play.innerHTML = STOP;
    audio.addEventListener('timeupdate', () => { if (audio) strip.querySelector('.bar').style.transform = `scaleX(${audio.currentTime / (audio.duration || 30)})`; });
    audio.addEventListener('ended', () => { strip.classList.remove('playing'); play.innerHTML = PLAY; strip.querySelector('.bar').style.transform = 'scaleX(0)'; playingId = null; });
    audio.play().catch(() => { $('#wall-sub').textContent = 'The browser could not play that preview. Tap it again.'; });
  }
  if (react && !busy) {
    busy = true; stopAudio();
    try { session = { ...session, ...await api(`/api/sessions/${session.id}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: react.dataset.item, reaction: react.dataset.react }) }) }; render(false); }
    catch (error) { $('#error').textContent = error.message; }
    finally { busy = false; }
  }
});

$('#delete').addEventListener('click', async () => {
  await api(`/api/sessions/${session.id}`, { method: 'DELETE' }).catch(() => {});
  stopAudio(); session = null; history.replaceState(null, '', location.pathname); title('Deleted', 'This session is gone.'); blank('Session deleted'); 
});

// Maker form
let shelves = {};
api('/api/shelf').then(data => { shelves = data; $('#shelf').insertAdjacentHTML('beforeend', Object.entries(data).map(([key, s]) => `<option value="${key}">${esc(s.label)}</option>`).join('')); });
$('#shelf').addEventListener('change', event => {
  const s = shelves[event.target.value]; if (!s) return;
  ['a1', 'a2', 'a3'].forEach((id, i) => { $('#' + id).value = s.artists[i] || ''; });
  if (!$('#born').value) $('#born').value = Math.round((s.born[0] + s.born[1]) / 2);
});
let timer;
document.querySelectorAll('#a1,#a2,#a3').forEach(input => input.addEventListener('input', () => {
  clearTimeout(timer); const q = input.value.trim(); if (q.length < 2) return;
  timer = setTimeout(async () => { const list = await api(`/api/artists?q=${encodeURIComponent(q)}`).catch(() => []); $('#artists').innerHTML = list.map(a => `<option value="${esc(a.name)}"></option>`).join(''); }, 250);
}));
$('#form').addEventListener('submit', async event => {
  event.preventDefault(); $('#error').textContent = '';
  const born = Number($('#born').value), anchors = ['a1', 'a2', 'a3'].map(id => $('#' + id).value.trim()).filter(Boolean), name = $('#name').value.trim();
  if (!Number.isInteger(born) || born < 1920 || born > 1975) { $('#error').textContent = 'Enter a birth year from 1920 to 1975.'; $('#born').focus(); return; }
  if (!anchors.length) { $('#error').textContent = 'Name at least one artist they loved.'; $('#a1').focus(); return; }
  document.querySelectorAll('.preset').forEach(b => b.setAttribute('aria-pressed', 'false'));
  $('#submit').disabled = true;
  const ok = await build({ born, name, anchors }, name ? `${name}, born ${born}` : `Born ${born}`, `Loved ${anchors.join(', ')}`);
  $('#submit').disabled = false;
  if (ok) $('#session').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});

// Open a saved session from the URL, or start on the first example so the page is never empty.
(async () => {
  const id = location.hash.slice(1);
  if (/^[a-f0-9-]{36}$/.test(id)) {
    try { session = await api(`/api/sessions/${id}`); title(session.name ? `${session.name}, born ${session.born}` : `Born ${session.born}`, 'Your saved session'); render(); return; } catch {}
  }
  document.querySelector('[data-preset="us"]').click();
})();
