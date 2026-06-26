'use strict';
const input = document.getElementById('key');
const status = document.getElementById('status');

window.settingsAPI.getKeyStatus().then((s) => {
  if (s === 'set') { input.placeholder = '•••••••• (a key is already saved)'; status.textContent = 'A key is currently saved.'; }
});

document.getElementById('save').addEventListener('click', async () => {
  await window.settingsAPI.saveKey(input.value);
  status.textContent = input.value.trim() ? 'Saved.' : 'Key removed.';
  setTimeout(() => window.close(), 350);
});
document.getElementById('cancel').addEventListener('click', () => window.close());
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('save').click(); });
