const form = document.getElementById('runner-form');
const urlInput = document.getElementById('url-input');
const addFlagBtn = document.getElementById('add-flag-btn');
const flagList = document.getElementById('flag-list');
const runBtn = document.getElementById('run-btn');
const statusMessage = document.getElementById('status-message');
const statusLogs = document.getElementById('status-logs');

function createFlagRow(flagName = '', flagValue = '') {
  const row = document.createElement('div');
  row.className = 'flag-row';

  const flagInput = document.createElement('input');
  flagInput.type = 'text';
  flagInput.placeholder = '--limit';
  flagInput.value = flagName;
  flagInput.className = 'flag-key';

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'value';
  valueInput.value = flagValue;
  valueInput.className = 'flag-value';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(flagInput, valueInput, removeBtn);
  flagList.appendChild(row);
}

addFlagBtn.addEventListener('click', () => createFlagRow());
createFlagRow('--limit', '3');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const flags = Array.from(document.querySelectorAll('.flag-row')).map((row) => ({
    flag: row.querySelector('.flag-key').value.trim(),
    value: row.querySelector('.flag-value').value.trim(),
  })).filter(({ flag }) => flag);

  if (!url) {
    setStatus('fail', 'A valid target URL is required.');
    statusLogs.textContent = 'Please enter a URL before running the backend flow.';
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = 'Running...';
  setStatus('neutral', 'Starting SpiderTester...');
  statusLogs.textContent = 'Launching backend...';

  try {
    const result = await window.electronAPI.runSpiderTester({ url, flags });

    if (result.ok) {
      setStatus('success', result.message);
    } else {
      setStatus('fail', result.message);
    }

    statusLogs.textContent = result.logs || 'No backend output captured.';
  } catch (error) {
    setStatus('fail', 'Failed to communicate with the Electron process.');
    statusLogs.textContent = error?.message || String(error);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Run SpiderTester';
  }
});

function setStatus(type, text) {
  statusMessage.className = `status-message ${type}`;
  statusMessage.textContent = text;
}
