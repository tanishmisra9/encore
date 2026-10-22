const $ = selector => document.querySelector(selector);
let plan;
const demoMembers = [['Alex', 'quiet cafes, jazz'], ['Sam', 'late-night food'], ['Jo', 'conversation']];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
async function api(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function run(action) { $('#error').textContent = ''; try { await action(); } catch(error) { $('#error').textContent = error.message; } }
function render() {
  $('#start').hidden = true; $('#plan').hidden = false;
  $('#show-title').textContent = `${plan.artist} · ${plan.venue}`;
  $('#plan-summary').textContent = plan.members.length ? `${plan.members.length} voice${plan.members.length === 1 ? '' : 's'} in the room. One clear next move.` : 'Add a few voices, then make the call.';
  $('#member-count').textContent = `${plan.members.length} voice${plan.members.length === 1 ? '' : 's'}`;
  $('#share-url').value = location.origin + '/?plan=' + plan.id;
  $('#source').textContent = plan.source === 'qloo' ? 'Qloo powered' : 'Provisional demo';
  $('#notice').textContent = plan.source === 'qloo' ? 'Taste suggestions use Qloo. Confirm opening hours, prices, and availability before leaving.' : 'Prototype mode uses fictional places and provisional taste reasoning. Opening hours and availability are unconfirmed.';
  $('#members').innerHTML = plan.members.map(m => `<span class="member"><strong>${escape(m.name)}</strong><span>${escape(m.tastes.join(', '))}</span></span>`).join('');
  const voteCount = id => Object.values(plan.votes).filter(v => v === id).length;
  $('#options').innerHTML = plan.options.length ? plan.options.map((option, index) => `<article class="option ${plan.winner?.id === option.id ? 'winner' : ''}"><div class="option-top"><span class="option-number">0${index + 1}</span><span class="kind">${escape(option.category)}</span></div><h3>${escape(option.name)}</h3><p>${escape(option.reason)}</p><p class="facts"><strong>${option.distanceKm.toFixed(1)} km</strong> away · ${option.price ? '$'+option.price+' estimated' : 'Price unconfirmed'}<br>Hours: ${escape(option.hours || 'Unconfirmed')} · ${voteCount(option.id)} vote(s)</p><div class="vote-row"><select aria-label="Vote as"><option value="">Vote as...</option>${plan.members.map(m => `<option value="${escape(m.id)}">${escape(m.name)}</option>`).join('')}</select><button data-option="${escape(option.id)}">Vote</button></div></article>`).join('') : '<div class="empty">Add a group preference to see options. If the constraints are too tight, increase the radius or budget.</div>';
  $('#revise-form').elements.radiusKm.value = plan.radiusKm;
  $('#revise-form').elements.budget.value = plan.budget ?? '';
}
async function createPlan(artist, venue) { plan = await api('/api/plans', { artist, venue }); history.replaceState(null, '', '?plan=' + plan.id); render(); }
$('#start-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { const form = new FormData(event.target); await createPlan(form.get('artist'), form.get('venue')); }); });
$('#run-demo').addEventListener('click', () => run(async () => {
  const button = $('#run-demo');
  button.disabled = true; button.textContent = 'Building the group plan...';
  try { await createPlan('The Marías', 'Brooklyn Steel'); for (const [name, tastes] of demoMembers) plan = await api(`/api/plans/${plan.id}/members`, { name, tastes: tastes.split(', ') }); render(); $('#plan').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
  finally { button.disabled = false; button.textContent = 'Run the guided demo'; }
}));
$('#member-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { const form = new FormData(event.target); plan = await api(`/api/plans/${plan.id}/members`, { name: form.get('name'), tastes: String(form.get('tastes')).split(',').map(s => s.trim()) }); event.target.reset(); render(); }); });
$('#revise-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { const form = new FormData(event.target); plan = await api(`/api/plans/${plan.id}/revise`, { note: form.get('note'), budget: form.get('budget'), radiusKm: form.get('radiusKm') }); render(); }); });
$('#options').addEventListener('click', event => { const button = event.target.closest('button[data-option]'); if (!button) return; const memberId = button.previousElementSibling.value; if (!memberId) { $('#error').textContent = 'Choose a member before voting.'; return; } run(async () => { plan = await api(`/api/plans/${plan.id}/vote`, { memberId, optionId: button.dataset.option }); render(); }); });
$('#copy-link').addEventListener('click', () => run(async () => { await navigator.clipboard.writeText($('#share-url').value); $('#copy-link').textContent = 'Copied'; }));
const planId = new URLSearchParams(location.search).get('plan');
if (planId) run(async () => { plan = await api('/api/plans/' + encodeURIComponent(planId)); render(); });
