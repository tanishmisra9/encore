const button = document.querySelector('#share-location');
const status = document.querySelector('#location-status');
const handoff = new URLSearchParams(location.search).get('handoff');
function message(value, error = false) { status.textContent = value; status.style.color = error ? '#a00037' : ''; }
async function submit(position) {
  const { latitude: lat, longitude: lon } = position.coords;
  const response = await fetch(`/api/location-handoffs/${encodeURIComponent(handoff)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lon }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Encore could not use that location.');
  button.hidden = true;
  message('Location shared. Encore is posting the plan in Discord.');
}
if (!handoff || !/^[a-f0-9-]{36}$/i.test(handoff)) { button.hidden = true; message('This location link is invalid or has expired.', true); }
button?.addEventListener('click', () => {
  if (!navigator.geolocation) return message('This browser cannot share its location. Open the link on a phone or in a browser with location access.', true);
  button.disabled = true; button.textContent = 'Getting your location…'; message('');
  navigator.geolocation.getCurrentPosition(position => submit(position).catch(error => { button.disabled = false; button.textContent = 'Try location again'; message(error.message, true); }), error => { button.disabled = false; button.textContent = 'Try location again'; message(error.code === error.PERMISSION_DENIED ? 'Location permission was not granted. Encore cannot infer your location.' : 'Encore could not get a location. Try again somewhere with location access.', true); }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
});
