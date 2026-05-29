// ─── State ─────────────────────────────────────────────────────────────────
let copyCount = parseInt(localStorage.getItem('textora_copies_today') || '0');
const today = new Date().toDateString();
if (localStorage.getItem('textora_reset_date') !== today) {
  copyCount = 0;
  localStorage.setItem('textora_copies_today', '0');
  localStorage.setItem('textora_reset_date', today);
}

// Initialize default Gemini key and OCR engine mode if not present
chrome.storage.local.get(['textora_google_api_key', 'textora_use_google_ocr'], (res) => {
  if (res.textora_google_api_key === undefined) {
    chrome.storage.local.set({
      textora_google_api_key: '',
      textora_use_google_ocr: false
    });
  }
});

// ─── DOM refs ──────────────────────────────────────────────────────────────
const charCountEl = document.getElementById('charCount');
const wordCountEl = document.getElementById('wordCount');
const copyCountEl = document.getElementById('copyCount');
const statusDot = document.getElementById('statusDot');
const ocrArrow = document.getElementById('ocrArrow');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

// Panels & Triggers
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const openHistoryBtn = document.getElementById('openHistory');
const historyPanel = document.getElementById('historyPanel');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const openTipsBtn = document.getElementById('openTips');
const tipsPanel = document.getElementById('tipsPanel');
const tipsCloseBtn = document.getElementById('tipsCloseBtn');

// Inputs & Buttons
const useGoogleOcrToggle = document.getElementById('useGoogleOcr');
const googleApiKeyInput = document.getElementById('googleApiKey');
const toggleApiKeyVisBtn = document.getElementById('toggleApiKeyVis');
const testApiKeyBtn = document.getElementById('testApiKeyBtn');
const testApiStatus = document.getElementById('testApiStatus');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// History items DOM refs
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historySearch = document.getElementById('historySearch');
const clearAllBtn = document.getElementById('clearAllBtn');
const historySubtitle = document.getElementById('historySubtitle');
const exportActions = document.getElementById('exportActions');

if (copyCountEl) copyCountEl.textContent = copyCount;

// ─── Button Bindings ───────────────────────────────────────────────────────
document.getElementById('selectArea').onclick = () => handleAction('SELECT_AREA');
document.getElementById('bulkOCR').onclick = () => handleAction('BULK_OCR');
document.getElementById('copyLink').onclick = () => handleAction('COPY_LINK');

// Panel Openers
openHistoryBtn.onclick = () => {
  loadHistoryAndRender();
  historyPanel.classList.add('open');
};

historyCloseBtn.onclick = () => {
  historyPanel.classList.remove('open');
};

openTipsBtn.onclick = () => {
  tipsPanel.classList.add('open');
};

tipsCloseBtn.onclick = () => {
  tipsPanel.classList.remove('open');
};

settingsBtn.onclick = () => {
  chrome.storage.local.get(['textora_google_api_key', 'textora_use_google_ocr'], (res) => {
    googleApiKeyInput.value = res.textora_google_api_key || '';
    useGoogleOcrToggle.checked = !!res.textora_use_google_ocr;
    testApiStatus.style.display = 'none';
    settingsPanel.classList.add('open');
  });
};

settingsCloseBtn.onclick = () => {
  settingsPanel.classList.remove('open');
};

// API Key Eye visibility toggle
toggleApiKeyVisBtn.onclick = () => {
  const isPass = googleApiKeyInput.type === 'password';
  googleApiKeyInput.type = isPass ? 'text' : 'password';
};

// API Key Test Functionality
testApiKeyBtn.onclick = () => {
  const apiKey = googleApiKeyInput.value.trim();
  if (!apiKey) {
    showTestStatus('Please enter an API Key first', true);
    return;
  }

  testApiKeyBtn.disabled = true;
  testApiKeyBtn.textContent = 'Testing…';
  showTestStatus('Testing Gemini API connection…', false, '#4f6ef7', 'rgba(79,110,247,0.08)');

  chrome.runtime.sendMessage({ action: 'TEST_GEMINI_API', apiKey }, (response) => {
    testApiKeyBtn.disabled = false;
    testApiKeyBtn.textContent = 'Test API Key';

    if (response && response.success) {
      showTestStatus('API Key is working! ✓', false, 'var(--green)', '#f0fdf4');
    } else {
      const err = response?.error || 'Unknown API error';
      showTestStatus(`Failed: ${err}`, true);
    }
  });
};

function showTestStatus(msg, isError, color, bg) {
  testApiStatus.style.display = 'block';
  testApiStatus.textContent = msg;
  if (isError) {
    testApiStatus.style.color = 'var(--red)';
    testApiStatus.style.background = '#fff5f5';
    testApiStatus.style.border = '1px solid rgba(239,68,68,0.2)';
  } else {
    testApiStatus.style.color = color || 'var(--text2)';
    testApiStatus.style.background = bg || 'var(--surface2)';
    testApiStatus.style.border = `1px solid ${color ? 'rgba(79,110,247,0.1)' : 'var(--border)'}`;
  }
}

// Save Settings
saveSettingsBtn.onclick = () => {
  const keyVal = googleApiKeyInput.value.trim();
  const useGoogleVal = useGoogleOcrToggle.checked;

  chrome.storage.local.set({
    textora_google_api_key: keyVal,
    textora_use_google_ocr: useGoogleVal
  }, () => {
    settingsPanel.classList.remove('open');
    showToast('Settings saved!');
  });
};

// Clear All History Confirmation Logic
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmCancel = document.getElementById('confirmCancel');
const confirmYes = document.getElementById('confirmYes');

clearAllBtn.onclick = () => {
  confirmOverlay.classList.add('show');
};

confirmCancel.onclick = () => {
  confirmOverlay.classList.remove('show');
};

confirmYes.onclick = () => {
  confirmOverlay.classList.remove('show');
  chrome.storage.local.get(['textora_history'], (result) => {
    const history = result.textora_history || [];
    const pinnedOnly = history.filter(e => e.pinned);
    chrome.storage.local.set({ textora_history: pinnedOnly }, () => {
      updateHistorySubtitle();
      loadHistoryAndRender();
      showToast('History cleared (pinned kept)!');
    });
  });
};

confirmOverlay.onclick = (e) => {
  if (e.target === confirmOverlay) {
    confirmOverlay.classList.remove('show');
  }
};


// Live search in history
historySearch.addEventListener('input', () => {
  loadHistoryAndRender();
});

// ─── Load history on open ──────────────────────────────────────────────────
updateHistorySubtitle();

// ─── Core Action Handler ───────────────────────────────────────────────────
async function handleAction(action) {
  setStatus('busy');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    setStatus('error');
    showToast('No active tab found', true);
    return;
  }

  if (action === 'BULK_OCR') ocrArrow.innerHTML = '<div class="spinner"></div>';

  // Animate clicked button
  const buttons = document.querySelectorAll('.btn');
  const actionMap = { SELECT_AREA: 0, BULK_OCR: 1, COPY_LINK: 2 };
  const clickedBtn = buttons[actionMap[action]];
  if (clickedBtn) {
    clickedBtn.classList.add('clicked');
    setTimeout(() => clickedBtn.classList.remove('clicked'), 400);
  }

  try {
    const response = await sendMessage(tab.id, { action });
    handleResponse(action, response);
  } catch (err) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/tesseract.min.js', 'ocr.js', 'content.js'] });
      await new Promise(r => setTimeout(r, 150));
      const response = await sendMessage(tab.id, { action });
      handleResponse(action, response);
    } catch (e) {
      setStatus('error');
      showToast('Cannot run on this page', true);
      resetOcrBtn();
    }
  }
}

function handleResponse(action, response) {
  setStatus('ready');
  resetOcrBtn();

  if (action === 'SELECT_AREA') {
    showToast('Draw a box on the page ✦', false, 2500);
    window.close();
    return;
  }
  if (action === 'COPY_LINK') {
    showToast('Hover & click a link 🔗', false, 2500);
    window.close();
    return;
  }
  if (action === 'BULK_OCR') {
    showToast('Draw a box on the image ✦', false, 2500);
    window.close();
    return;
  }

  if (response && response.charCount !== undefined) updateStats(response.charCount);
  showToast('Copied to clipboard!');
  incrementCopyCount();
  setTimeout(updateHistorySubtitle, 400);
}

// ─── History Logic ─────────────────────────────────────────────────────────
function updateHistorySubtitle() {
  chrome.storage.local.get(['textora_history'], (result) => {
    const history = result.textora_history || [];
    if (history.length === 0) {
      historySubtitle.textContent = 'Empty';
    } else if (history.length === 1) {
      historySubtitle.textContent = '1 entry saved';
    } else {
      historySubtitle.textContent = `${history.length} entries saved`;
    }
  });
}

function loadHistoryAndRender() {
  chrome.storage.local.get(['textora_history'], (result) => {
    const history = result.textora_history || [];
    const query = historySearch.value.trim().toLowerCase();

    let filtered = history;
    if (query) {
      filtered = history.filter(entry =>
        entry.text.toLowerCase().includes(query) ||
        (entry.label || '').toLowerCase().includes(query) ||
        (entry.title || '').toLowerCase().includes(query)
      );
    }

    // Sort pinned items to the top, then descending by id (creation time)
    filtered.sort((a, b) => {
      const aPinned = !!a.pinned;
      const bPinned = !!b.pinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.id - a.id;
    });

    renderHistory(filtered);
  });
}

function renderHistory(history) {
  // Clear list
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyEmpty.style.display = 'flex';
    clearAllBtn.style.display = 'none';
    exportActions.style.display = 'none';
    return;
  }

  historyEmpty.style.display = 'none';
  clearAllBtn.style.display = 'flex';
  exportActions.style.display = 'flex';

  history.forEach(entry => {
    const card = buildHistoryItem(entry);
    historyList.appendChild(card);
  });
}

function buildHistoryItem(entry) {
  const card = document.createElement('div');
  card.className = 'hi-card' + (entry.pinned ? ' pinned' : '');
  card.dataset.id = entry.id;

  const timeStr = formatTime(entry.time);

  card.innerHTML = `
    <div class="hi-card-top">
      <span class="hi-card-label">${escHtml(entry.label || 'Copied')}</span>
      <span class="hi-card-time">${timeStr}</span>
    </div>
    <div class="hi-card-text">${escHtml(entry.text)}</div>
    <div class="hi-card-actions">
      <span class="hi-card-chars">${entry.chars} chars</span>
      <div class="hi-card-btns">
        <button class="hi-card-btn btn-pin${entry.pinned ? ' active' : ''}" title="${entry.pinned ? 'Unpin item' : 'Pin item'}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24z"/></svg>
        </button>
        <button class="hi-card-btn btn-copy" title="Copy text">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="hi-card-btn btn-delete" title="Delete entry">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>
  `;

  // Pin button
  card.querySelector('.btn-pin').onclick = () => {
    chrome.storage.local.get(['textora_history'], (result) => {
      const history = result.textora_history || [];
      const item = history.find(e => e.id === entry.id);
      if (item) {
        item.pinned = !item.pinned;
        chrome.storage.local.set({ textora_history: history }, () => {
          loadHistoryAndRender();
        });
      }
    });
  };

  // Copy button
  card.querySelector('.btn-copy').onclick = () => {
    navigator.clipboard.writeText(entry.text)
      .then(() => showToast('Copied!'))
      .catch(() => showToast('Failed to copy', true));
  };

  // Delete button
  card.querySelector('.btn-delete').onclick = () => {
    card.classList.add('removing');
    setTimeout(() => {
      card.remove();
      chrome.storage.local.get(['textora_history'], (result) => {
        const history = (result.textora_history || []).filter(e => e.id !== entry.id);
        chrome.storage.local.set({ textora_history: history }, () => {
          updateHistorySubtitle();
          loadHistoryAndRender();
        });
      });
    }, 250);
  };

  return card;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function sendMessage(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(response);
    });
  });
}

function setStatus(state) {
  statusDot.className = 'status-dot';
  if (state === 'busy') { statusDot.classList.add('busy'); statusDot.title = 'Working…'; }
  else if (state === 'error') { statusDot.classList.add('error'); statusDot.title = 'Error'; setTimeout(() => setStatus('ready'), 2000); }
  else { statusDot.title = 'Ready'; }
}

let toastTimer;
function showToast(msg, isError = false, duration = 2000) {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  const icon = toast.querySelector('.toast-icon');
  icon.innerHTML = isError
    ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
    : '<polyline points="20 6 9 17 4 12"/>';
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function updateStats(chars) {
  const words = chars > 0 ? Math.round(chars / 5) : 0;
  if (charCountEl) charCountEl.textContent = chars > 999 ? (chars / 1000).toFixed(1) + 'k' : chars;
  if (wordCountEl) wordCountEl.textContent = words > 999 ? (words / 1000).toFixed(1) + 'k' : words;
}

function incrementCopyCount() {
  copyCount++;
  if (copyCountEl) {
    copyCountEl.textContent = copyCount;
    copyCountEl.style.color = 'var(--accent)';
    setTimeout(() => { copyCountEl.style.color = ''; }, 600);
  }
  localStorage.setItem('textora_copies_today', copyCount);
}

function resetOcrBtn() {
  ocrArrow.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const diffH = Math.floor(diff / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Rotating Tips ─────────────────────────────────────────────────────────
const tips = [
  "First select the text natively on any webpage to copy it instantly.",
  "Use the Selected Area tool and draw a box to copy any page text block.",
  "Use the Copy from Link tool to click any hyperlink and copy its text.",
  "Use the Copy from Image tool to draw a box over any image area to extract text.",
  "To copy video text: pause the video, click Copy from Image, and draw a box over it.",
  "If the API limit is reached, obtain a new key from Google AI Studio and update it in Settings."
];
const tipTextEl = document.getElementById('tipText');
if (tipTextEl) {
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  tipTextEl.textContent = randomTip;
}

// ─── Export History Logic ──────────────────────────────────────────────────
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('exportTxt').onclick = () => {
  chrome.storage.local.get(['textora_history'], (result) => {
    const history = result.textora_history || [];
    if (!history.length) return;
    let content = '';
    history.forEach(e => {
      const time = new Date(e.time).toLocaleString();
      content += `[${e.label}] - ${time}\nSource URL: ${e.url}\nTitle: ${e.title || 'N/A'}\nText:\n${e.text}\n\n${'='.repeat(50)}\n\n`;
    });
    downloadFile(content, 'textora_history.txt', 'text/plain');
  });
};

document.getElementById('exportJson').onclick = () => {
  chrome.storage.local.get(['textora_history'], (result) => {
    const history = result.textora_history || [];
    if (!history.length) return;
    const content = JSON.stringify(history, null, 2);
    downloadFile(content, 'textora_history.json', 'application/json');
  });
};

document.getElementById('exportCsv').onclick = () => {
  chrome.storage.local.get(['textora_history'], (result) => {
    const history = result.textora_history || [];
    if (!history.length) return;
    let content = '"ID","Time","Source URL","Page Title","Label","Length","Text"\n';
    history.forEach(e => {
      const cleanText = e.text.replace(/"/g, '""');
      const cleanTitle = (e.title || '').replace(/"/g, '""');
      const cleanLabel = (e.label || '').replace(/"/g, '""');
      content += `"${e.id}","${e.time}","${e.url}","${cleanTitle}","${cleanLabel}","${e.chars}","${cleanText}"\n`;
    });
    downloadFile(content, 'textora_history.csv', 'text/csv');
  });
};


