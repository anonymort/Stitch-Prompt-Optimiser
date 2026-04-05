document.addEventListener('DOMContentLoaded', () => {
  const setupView = document.getElementById('setup-view');
  const savedView = document.getElementById('saved-view');
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  const keyDisplay = document.getElementById('key-display');
  const maskedKey = document.getElementById('masked-key');
  const toggleKeyBtn = document.getElementById('toggle-key');
  const updateBtn = document.getElementById('update-btn');
  const removeBtn = document.getElementById('remove-btn');
  const actionStatus = document.getElementById('action-status');

  let fullKey = '';
  let keyVisible = false;

  function maskKey(key) {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }

  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = 'status ' + type;
    setTimeout(() => { el.className = 'status'; }, 3000);
  }

  function showSavedView(key) {
    fullKey = key;
    setupView.style.display = 'none';
    savedView.style.display = 'block';
    keyDisplay.style.display = 'block';
    maskedKey.textContent = maskKey(key);
    keyVisible = false;
    toggleKeyBtn.textContent = 'Show';
  }

  function showSetupView() {
    setupView.style.display = 'block';
    savedView.style.display = 'none';
    apiKeyInput.value = '';
  }

  // Load existing key
  chrome.storage.local.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      showSavedView(result.geminiApiKey);
    }
  });

  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus(saveStatus, 'Please enter an API key.', 'error');
      return;
    }
    if (key.length < 20) {
      showStatus(saveStatus, 'That doesn\'t look like a valid API key.', 'error');
      return;
    }
    chrome.storage.local.set({ geminiApiKey: key }, () => {
      showStatus(saveStatus, 'Key saved successfully.', 'success');
      setTimeout(() => showSavedView(key), 500);
    });
  });

  toggleKeyBtn.addEventListener('click', () => {
    keyVisible = !keyVisible;
    maskedKey.textContent = keyVisible ? fullKey : maskKey(fullKey);
    toggleKeyBtn.textContent = keyVisible ? 'Hide' : 'Show';
  });

  updateBtn.addEventListener('click', () => {
    showSetupView();
    apiKeyInput.focus();
  });

  removeBtn.addEventListener('click', () => {
    chrome.storage.local.remove('geminiApiKey', () => {
      showStatus(actionStatus, 'Key removed.', 'info');
      setTimeout(showSetupView, 500);
    });
  });

  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
});
