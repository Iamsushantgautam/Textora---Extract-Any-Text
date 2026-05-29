if (window.lastChromeRuntime === chrome.runtime) {
  // Already loaded
} else {
  window.lastChromeRuntime = chrome.runtime;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('Textora content script received message:', msg);
    if (msg.action === 'PING') {
      sendResponse({ status: 'pong' });
    }
    else if (msg.action === 'SELECT_AREA') {
      console.log('Textora: Triggering SELECT_AREA selection mode.');
      enableSelection();
      sendResponse({ status: 'started' });
    }
    else if (msg.action === 'BULK_OCR') {
      console.log('Textora: Triggering BULK_OCR ocr selection mode.');
      enableOcrSelection();
      sendResponse({ status: 'started' });
    }
    else if (msg.action === 'COPY_LINK') {
      console.log('Textora: Triggering COPY_LINK link copy mode.');
      enableLinkCopy();
      sendResponse({ status: 'started' });
    }
    return true;
  });

  // ─── Save to history ───────────────────────────────────────────────────
  function saveToHistory(text, label) {
    if (!text || !text.trim()) return;
    const MAX = 30;
    chrome.storage.local.get(['textora_history'], (result) => {
      const history = result.textora_history || [];
      const entry = {
        id: Date.now(),
        text: text.trim(),
        label: label || 'Copied text',
        url: location.href,
        title: document.title,
        time: new Date().toISOString(),
        chars: text.trim().length
      };
      // Avoid exact duplicates in a row
      if (history.length > 0 && history[0].text === entry.text) return;
      history.unshift(entry);
      while (history.length > MAX) {
        let lastUnpinnedIdx = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (!history[i].pinned) {
            lastUnpinnedIdx = i;
            break;
          }
        }
        if (lastUnpinnedIdx !== -1) {
          history.splice(lastUnpinnedIdx, 1);
        } else {
          break;
        }
      }
      chrome.storage.local.set({ textora_history: history });
    });
  }

  // ─── Clipboard Helper ──────────────────────────────────────────────────
  function copyToClipboard(text, label) {
    if (!text || !text.trim()) {
      showStatus('No text found', true);
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => {
        showStatus(`Copied ${text.length.toLocaleString()} chars ✓`);
        saveToHistory(text, label);
      })
      .catch(err => {
        console.error(err);
        showStatus('Clipboard access denied', true);
      });
  }

  // ─── Status Toast ──────────────────────────────────────────────────────
  function showStatus(msg, isError = false) {
    document.querySelectorAll('.__tl_toast').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = '__tl_toast';
    el.style.cssText = `
      position:fixed;top:20px;right:20px;padding:9px 16px;
      background:${isError ? '#fef2f2' : '#f0fdf4'};
      color:${isError ? '#ef4444' : '#16a34a'};
      border:1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'};
      border-radius:100px;z-index:2147483647;
      font-family:'Inter',system-ui,sans-serif;font-size:13px;font-weight:600;
      box-shadow:0 4px 16px rgba(0,0,0,0.1);
      transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1);
      transform:translateY(-8px);opacity:0;white-space:nowrap;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    }));
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 400);
    }, 2500);
  }

  // ─── Helper: Show Selection Hint ──────────────────────────────────────
  function showSelectionHint(text) {
    const oldHint = document.getElementById('__tl_hint');
    if (oldHint) oldHint.remove();

    const hint = document.createElement('div');
    hint.id = '__tl_hint';
    hint.style.cssText = `
      position:fixed;top:20px;left:50%;transform:translateX(-50%);
      padding:8px 16px;background:rgba(79,110,247,0.95);color:white;
      border-radius:100px;z-index:2147483647;
      font-family:'Inter',system-ui,sans-serif;font-size:12px;font-weight:600;
      box-shadow:0 4px 16px rgba(79,110,247,0.4);pointer-events:none;white-space:nowrap;
    `;
    hint.textContent = text;
    document.body.appendChild(hint);
  }

  // ─── Area Selection (DOM-based text extraction) ─────────────────────────
  let startX, startY, selBox, overlay;

  function enableSelection() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      copyToClipboard(selectedText, 'Selected text');
      return;
    }

    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;';
    document.body.appendChild(overlay);
    showSelectionHint('✦ Draw a box to extract text  ·  Esc to cancel');
    overlay.addEventListener('mousedown', startSelect);
    overlay.addEventListener('contextmenu', cancelSelection);
    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) { if (e.key === 'Escape') cancelSelection(); }

  function cancelSelection() {
    if (overlay) overlay.remove();
    const hint = document.getElementById('__tl_hint');
    if (hint) hint.remove();
    if (selBox) selBox.remove();
    document.removeEventListener('keydown', onKeyDown);
  }

  function startSelect(e) {
    e.preventDefault();
    startX = e.clientX; startY = e.clientY;
    selBox = document.createElement('div');
    selBox.style.cssText = `
      position:fixed;border:2px solid #4f6ef7;background:rgba(79,110,247,0.08);
      z-index:2147483647;pointer-events:none;border-radius:4px;
      box-shadow:0 0 0 1px rgba(79,110,247,0.2);
    `;
    document.body.appendChild(selBox);
    overlay.addEventListener('mousemove', drawBox);
    overlay.addEventListener('mouseup', endSelect, { once: true });
  }

  function drawBox(e) {
    selBox.style.left   = Math.min(startX, e.clientX) + 'px';
    selBox.style.top    = Math.min(startY, e.clientY) + 'px';
    selBox.style.width  = Math.abs(e.clientX - startX) + 'px';
    selBox.style.height = Math.abs(e.clientY - startY) + 'px';
  }

  function endSelect(e) {
    overlay.removeEventListener('mousemove', drawBox);
    const hint = document.getElementById('__tl_hint');
    if (hint) hint.remove();
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
    const rect = selBox.getBoundingClientRect();
    selBox.remove();
    if (rect.width < 5 || rect.height < 5) return;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
    const textParts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el || skipTags.has(el.tagName)) continue;
      const range = document.createRange();
      range.selectNode(node);
      const r = range.getBoundingClientRect();
      const overlaps = !(r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom);
      if (overlaps) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0')
          textParts.push(node.nodeValue.trim());
      }
    }
    copyToClipboard(textParts.join('\n'), 'Selected area');
  }

  // ─── Image OCR Selection (Visual Screenshot-based) ─────────────────────────
  let ocrStartX, ocrStartY, ocrSelBox, ocrOverlay;

  function enableOcrSelection() {
    ocrOverlay = document.createElement('div');
    ocrOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;';
    document.body.appendChild(ocrOverlay);
    showSelectionHint('✦ Draw a box around the image to extract text  ·  Esc to cancel');
    ocrOverlay.addEventListener('mousedown', startOcrSelect);
    ocrOverlay.addEventListener('contextmenu', cancelOcrSelection);
    document.addEventListener('keydown', onOcrKeyDown);
  }

  function onOcrKeyDown(e) { if (e.key === 'Escape') cancelOcrSelection(); }

  function cancelOcrSelection() {
    if (ocrOverlay) ocrOverlay.remove();
    const hint = document.getElementById('__tl_hint');
    if (hint) hint.remove();
    if (ocrSelBox) ocrSelBox.remove();
    document.removeEventListener('keydown', onOcrKeyDown);
  }

  function startOcrSelect(e) {
    e.preventDefault();
    ocrStartX = e.clientX; ocrStartY = e.clientY;
    ocrSelBox = document.createElement('div');
    ocrSelBox.style.cssText = `
      position:fixed;border:2px solid #ef4444;background:rgba(239,68,68,0.08);
      z-index:2147483647;pointer-events:none;border-radius:4px;
      box-shadow:0 0 0 1px rgba(239,68,68,0.2);
    `;
    document.body.appendChild(ocrSelBox);
    ocrOverlay.addEventListener('mousemove', drawOcrBox);
    ocrOverlay.addEventListener('mouseup', endOcrSelect, { once: true });
  }

  function drawOcrBox(e) {
    ocrSelBox.style.left   = Math.min(ocrStartX, e.clientX) + 'px';
    ocrSelBox.style.top    = Math.min(ocrStartY, e.clientY) + 'px';
    ocrSelBox.style.width  = Math.abs(e.clientX - ocrStartX) + 'px';
    ocrSelBox.style.height = Math.abs(e.clientY - ocrStartY) + 'px';
  }

  function endOcrSelect(e) {
    ocrOverlay.removeEventListener('mousemove', drawOcrBox);
    const rect = ocrSelBox.getBoundingClientRect();
    
    // Clean up selection overlay so it doesn't get captured in the screenshot
    cancelOcrSelection();
    
    if (rect.width < 5 || rect.height < 5) return;
    
    // Wait for the overlay elements to fully unmount/repainted out
    setTimeout(() => {
      captureAndCropOcr(rect);
    }, 60);
  }

  function captureAndCropOcr(rect) {
    showStatus('Capturing screen…');
    
    chrome.runtime.sendMessage({ action: 'CAPTURE_TAB' }, (response) => {
      if (!response || !response.success) {
        showStatus('Failed to capture screen', true);
        return;
      }
      
      const dataUrl = response.dataUrl;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          rect.left * dpr,
          rect.top * dpr,
          rect.width * dpr,
          rect.height * dpr,
          0,
          0,
          canvas.width,
          canvas.height
        );
        
        const croppedDataUrl = canvas.toDataURL('image/png');
        
        // Execute the OCR method in ocr.js
        if (window.executeImageOCR) {
          window.executeImageOCR(croppedDataUrl);
        } else {
          showStatus('OCR module not loaded', true);
        }
      };
      img.src = dataUrl;
    });
  }

  // ─── Link Text Copying Mode ──────────────────────────────────────────
  let hoveredLink = null;

  function enableLinkCopy() {
    showSelectionHint('✦ Click any link on the page to copy its text  ·  Esc to cancel');
    document.addEventListener('mousemove', onLinkMouseMove);
    document.addEventListener('click', onLinkClick, true);
    document.addEventListener('keydown', onLinkKeyDown);
  }

  function onLinkMouseMove(e) {
    const link = e.target.closest('a');
    if (link) {
      if (hoveredLink && hoveredLink !== link) {
        hoveredLink.style.outline = '';
      }
      hoveredLink = link;
      hoveredLink.style.outline = '2px dashed #4f6ef7';
      hoveredLink.style.outlineOffset = '2px';
    } else {
      if (hoveredLink) {
        hoveredLink.style.outline = '';
        hoveredLink = null;
      }
    }
  }

  function onLinkClick(e) {
    const link = e.target.closest('a');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      const text = link.textContent.trim();
      copyToClipboard(text, 'Link text');
      disableLinkCopy();
    }
  }

  function onLinkKeyDown(e) {
    if (e.key === 'Escape') {
      disableLinkCopy();
    }
  }

  function disableLinkCopy() {
    document.removeEventListener('mousemove', onLinkMouseMove);
    document.removeEventListener('click', onLinkClick, true);
    document.removeEventListener('keydown', onLinkKeyDown);
    
    if (hoveredLink) {
      hoveredLink.style.outline = '';
      hoveredLink = null;
    }
    const hint = document.getElementById('__tl_hint');
    if (hint) hint.remove();
  }

  // Expose helper functions globally
  window.copyToClipboard = copyToClipboard;
  window.showStatus = showStatus;
}
