const $ = selector => document.querySelector(selector);
let plan;
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
  $('#share-url').value = location.origin + '/?plan=' + plan.id;
  $('#source').textContent = plan.source === 'qloo' ? 'QLOO-POWERED' : 'PROVISIONAL DEMO';
  $('#notice').textContent = plan.source === 'qloo' ? 'Taste suggestions use Qloo. Confirm opening hours, prices, and availability before leaving.' : 'Prototype mode uses fictional places and provisional taste reasoning. Opening hours and availability are unconfirmed.';
  $('#members').innerHTML = plan.members.map(m => `<span class="member">${escape(m.name)} · ${escape(m.tastes.join(', '))}</span>`).join('');
  const voteCount = id => Object.values(plan.votes).filter(v => v === id).length;
  $('#options').innerHTML = plan.options.length ? plan.options.map(option => `<article class="option ${plan.winner?.id === option.id ? 'winner' : ''}"><div class="kind">${escape(option.category)}</div><h3>${escape(option.name)}</h3><p>${escape(option.reason)}</p><p class="facts">${option.distanceKm.toFixed(1)} km away · ${option.price ? '$'+option.price+' estimated' : 'Price unconfirmed'}<br>Hours: ${escape(option.hours || 'Unconfirmed')} · ${voteCount(option.id)} vote(s)</p><div class="vote-row"><select aria-label="Vote as"><option value="">Vote as...</option>${plan.members.map(m => `<option value="${escape(m.id)}">${escape(m.name)}</option>`).join('')}</select><button data-option="${escape(option.id)}">Vote</button></div></article>`).join('') : '<div class="empty">Add a group preference to see options. If your constraints are too tight, try increasing the radius or budget.</div>';
  $('#revise-form').elements.radiusKm.value = plan.radiusKm;
  $('#revise-form').elements.budget.value = plan.budget ?? '';
}
$('#start-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { const form = new FormData(event.target); plan = await api('/api/plans', { artist: form.get('artist'), venue: form.get('venue') }); history.replaceState(null, '', '?plan=' + plan.id); render(); }); });
$('#member-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { const form = new FormData(event.target); plan = await api(`/api/plans/${plan.id}/members`, { name: form.get('name'), tastes: String(form.get('tastes')).split(',').map(s => s.trim()) }); event.target.reset(); render(); }); });
$('#revise-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { const form = new FormData(event.target); plan = await api(`/api/plans/${plan.id}/revise`, { note: form.get('note'), budget: form.get('budget'), radiusKm: form.get('radiusKm') }); render(); }); });
$('#options').addEventListener('click', event => { const button = event.target.closest('button[data-option]'); if (!button) return; const memberId = button.previousElementSibling.value; if (!memberId) { $('#error').textContent = 'Choose a member first.'; return; } run(async () => { plan = await api(`/api/plans/${plan.id}/vote`, { memberId, optionId: button.dataset.option }); render(); }); });
$('#copy-link').addEventListener('click', () => run(async () => { await navigator.clipboard.writeText($('#share-url').value); $('#copy-link').textContent = 'Copied'; }));
const planId = new URLSearchParams(location.search).get('plan');
if (planId) run(async () => { plan = await api('/api/plans/' + encodeURIComponent(planId)); render(); });
