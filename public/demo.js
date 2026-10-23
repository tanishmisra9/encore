const $ = selector => document.querySelector(selector);
let plan;
const fixture = new URLSearchParams(location.search).get('fixture') === '1' ? '?fixture=1' : '';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
async function api(path, body) { const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data; }
function render() {
  $('#demo-start').hidden = true; $('#demo-plan').hidden = false;
  $('#demo-request').textContent = plan.request;
  $('#demo-source').textContent = plan.source === 'qloo' ? 'QLOO-POWERED' : 'LOCAL TEST FIXTURE';
  $('#demo-notice').textContent = plan.source === 'qloo' ? 'Qloo ranked these options from stated group signals. Confirm real-world details before leaving.' : 'This local test uses fixture data. Production uses Qloo and does not substitute a generic ranking.';
  const count = id => Object.values(plan.votes).filter(vote => vote === id).length;
  $('#demo-options').innerHTML = plan.options.map((option, index) => `<article class="demo-option ${plan.winner?.id === option.id ? 'winner' : ''}"><span>0${index + 1}</span><h3>${escape(option.name)}</h3><p>${escape(option.reason)}</p><p class="facts">${option.distanceKm.toFixed(1)} km · ${option.price ? '$' + option.price + ' estimated' : 'Price unconfirmed'}<br>Hours: ${escape(option.hours || 'Unconfirmed')}</p><button class="vote-button" data-option="${escape(option.id)}">Choose this · ${count(option.id)} vote${count(option.id) === 1 ? '' : 's'}</button></article>`).join('');
}
async function run(action) { $('#demo-error').textContent = ''; $('#start-error').textContent = ''; try { await action(); } catch (error) { const message = error instanceof Error ? error.message : 'Request failed'; $('#demo-error').textContent = message; $('#start-error').textContent = message; } }
$('#start-demo').addEventListener('click', () => run(async () => { $('#start-demo').disabled = true; $('#start-demo').textContent = 'Asking Qloo…'; try { plan = await api('/api/demo' + fixture, {}); render(); } finally { $('#start-demo').disabled = false; $('#start-demo').textContent = 'Start the Friday-night plan'; } }));
$('#demo-options').addEventListener('click', event => { const button = event.target.closest('button[data-option]'); if (!button) return; run(async () => { plan = await api(`/api/plans/${plan.id}/vote`, { memberId: 'alex', optionId: button.dataset.option }); render(); }); });
$('#replan-demo').addEventListener('click', () => run(async () => { plan = await api(`/api/plans/${plan.id}/revise`, { note: 'Quieter, still under $35', budget: 35, radiusKm: 2 }); render(); }));
