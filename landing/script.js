/* ==========================================================================
   Textora Landing Page - Interactive Simulator & Scripts
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {



  // --- 1. NAVBAR SCROLL EFFECT ---
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // --- 2. FAQ ACCORDION COLLAPSE/EXPAND ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      // Toggle current item
      const isActive = item.classList.contains('active');
      
      // Close all items
      faqItems.forEach(i => i.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // --- 3. TOAST NOTIFICATION UTILITY ---
  const showToast = (message) => {
    // Remove existing toast if present
    const existingToast = document.querySelector('.toast-msg');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);

    // Trigger reflow to apply transition
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2500);
  };

  // Helper to copy text to system clipboard
  const copyToSystemClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied to clipboard!'))
        .catch(() => showToast('Clipboard write blocked by browser'));
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('Copied to clipboard!');
      } catch (err) {
        showToast('Failed to copy text');
      }
      document.body.removeChild(textarea);
    }
  };


  // --- 4. INTERACTIVE PLAYGROUND SIMULATOR ---
  const toolButtons = document.querySelectorAll('.tool-btn:not(.reset-btn)');
  const contentPanes = document.querySelectorAll('.sandbox-page-content > div');
  const simScreen = document.getElementById('sim-screen');
  const selectionBox = document.getElementById('selection-box');
  const screenInstructions = document.getElementById('instruction-text');
  const historyList = document.getElementById('history-items-list');
  const emptyState = document.getElementById('history-empty-state');
  const historyCounter = document.getElementById('history-counter');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const searchInput = document.getElementById('search-history-input');
  
  // State variables
  let currentMode = 'area'; // area, ocr, link
  let clipboardHistory = [];
  let isDragging = false;
  let startX = 0, startY = 0;

  // Mode Instructions
  const modeInstructions = {
    area: 'Click and drag to draw a box around elements to extract text.',
    ocr: 'Draw a selection box over the image or click it to run AI OCR scanning.',
    link: 'Hover and click any hyperlink to copy its link anchor text.'
  };

  // Switch modes
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentMode = btn.getAttribute('data-mode');
      screenInstructions.textContent = modeInstructions[currentMode];

      // Update active content pane
      contentPanes.forEach(pane => pane.classList.remove('active-content'));
      const activePane = document.getElementById(`content-${currentMode}-pane`);
      if (activePane) {
        activePane.classList.add('active-content');
      }

      // Reset selection box and states
      resetSelectionBox();
      clearHighlights();
    });
  });

  // Reset Button
  const resetBtn = document.getElementById('tool-reset');
  resetBtn.addEventListener('click', () => {
    resetSelectionBox();
    clearHighlights();
    const ocrScanBar = document.getElementById('ocr-scan-bar');
    if (ocrScanBar) ocrScanBar.style.display = 'none';
    showToast('Sandbox reset successfully');
  });

  const resetSelectionBox = () => {
    selectionBox.style.display = 'none';
    isDragging = false;
  };

  const clearHighlights = () => {
    const highlighted = document.querySelectorAll('.sandbox-grid-item, .sandbox-sim-link');
    highlighted.forEach(el => el.classList.remove('highlighted'));
  };

  // --- DRAW BOX SELECTION LOGIC (For Selected Area & OCR Modes) ---
  simScreen.addEventListener('mousedown', (e) => {
    if (currentMode === 'link') return; // Selection box not allowed in link mode
    
    // Check if clicking inside OCR container or scrollbars
    const ocrContainer = document.getElementById('ocr-img-container');
    if (currentMode === 'ocr' && ocrContainer && !ocrContainer.contains(e.target) && e.target !== ocrContainer) {
      // Allow drag anywhere in OCR container, but if clicking outside it in OCR mode, let's keep it clean
    }

    isDragging = true;
    const rect = simScreen.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    
    clearHighlights();
    e.preventDefault();
  });

  simScreen.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const rect = simScreen.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Boundaries check
    const width = currentX - startX;
    const height = currentY - startY;

    selectionBox.style.left = `${width < 0 ? currentX : startX}px`;
    selectionBox.style.top = `${height < 0 ? currentY : startY}px`;
    selectionBox.style.width = `${Math.abs(width)}px`;
    selectionBox.style.height = `${Math.abs(height)}px`;
  });

  simScreen.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    const boxRect = selectionBox.getBoundingClientRect();
    selectionBox.style.display = 'none';

    // If box width and height are small, treat as a single click
    if (boxRect.width < 10 || boxRect.height < 10) {
      handleSingleClick(e);
      return;
    }

    if (currentMode === 'area') {
      processAreaSelection(boxRect);
    } else if (currentMode === 'ocr') {
      triggerOCRSimulation();
    }
  });

  // Handle mousedown and drag cancellation when cursor leaves simulator
  simScreen.addEventListener('mouseleave', () => {
    if (isDragging) {
      selectionBox.style.display = 'none';
      isDragging = false;
    }
  });

  // Process Area Selection Coordinates
  const processAreaSelection = (boxRect) => {
    const gridItems = document.querySelectorAll('.sandbox-grid-item');
    const paragraph = document.querySelector('.sandbox-desc');
    let extractedText = [];

    // Check overlaps
    gridItems.forEach(item => {
      const itemRect = item.getBoundingClientRect();
      if (isOverlapping(boxRect, itemRect)) {
        item.classList.add('highlighted');
        const text = item.getAttribute('data-text') || item.innerText;
        extractedText.push(text);
      }
    });

    // Check paragraph overlap
    if (paragraph) {
      const paraRect = paragraph.getBoundingClientRect();
      if (isOverlapping(boxRect, paraRect)) {
        extractedText.push(paragraph.getAttribute('data-text') || paragraph.innerText);
      }
    }

    if (extractedText.length > 0) {
      const finalString = extractedText.join('\n');
      addToHistory('area', finalString);
      copyToSystemClipboard(finalString);
    } else {
      showToast('No text found in selected area. Try again!');
    }
  };

  const isOverlapping = (rect1, rect2) => {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
  };

  // Handle single click (failsafe / ease of use)
  const handleSingleClick = (e) => {
    if (currentMode === 'ocr') {
      const ocrContainer = document.getElementById('ocr-img-container');
      if (ocrContainer && ocrContainer.contains(e.target)) {
        triggerOCRSimulation();
      }
    }
  };

  // --- OCR SIMULATION LOGIC ---
  const triggerOCRSimulation = () => {
    const scanBar = document.getElementById('ocr-scan-bar');
    const prevText = screenInstructions.textContent;
    
    if (scanBar) {
      scanBar.style.display = 'block';
      scanBar.style.animation = 'scan 1.5s ease-in-out infinite';
    }
    
    screenInstructions.textContent = '🤖 Scanning image with Gemini AI...';

    setTimeout(() => {
      if (scanBar) {
        scanBar.style.display = 'none';
      }
      screenInstructions.textContent = prevText;
      
      const ocrText = 'TEXTORA OCR\nFAST MULTIMODAL EXTRACTION\n100% RELIABLE TEXT CAPTURE';
      addToHistory('ocr', ocrText);
      copyToSystemClipboard(ocrText);
    }, 1500);
  };

  // --- LINK SELECTION MODE ---
  const simLinks = document.querySelectorAll('.sandbox-sim-link');
  simLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentMode !== 'link') return;

      clearHighlights();
      link.classList.add('highlighted');
      
      const linkText = link.getAttribute('data-text') || link.innerText;
      addToHistory('link', linkText);
      copyToSystemClipboard(linkText);
    });
  });

  // --- CLIPBOARD HISTORY DRAWER SYSTEM ---
  const addToHistory = (mode, text) => {
    const id = Date.now().toString();
    const item = { id, mode, text, timestamp: new Date().toLocaleTimeString() };
    
    clipboardHistory.unshift(item); // Prepend
    renderHistory();
  };

  const deleteHistoryItem = (id) => {
    clipboardHistory = clipboardHistory.filter(item => item.id !== id);
    renderHistory();
  };

  const renderHistory = () => {
    const filterQuery = searchInput.value.toLowerCase().trim();
    
    // Clear items list
    historyList.innerHTML = '';

    const filteredItems = clipboardHistory.filter(item => {
      return item.text.toLowerCase().includes(filterQuery) || item.mode.toLowerCase().includes(filterQuery);
    });

    if (filteredItems.length === 0) {
      emptyState.style.display = 'flex';
      if (clipboardHistory.length > 0) {
        emptyState.querySelector('p').textContent = 'No matching history items found.';
      } else {
        emptyState.querySelector('p').textContent = 'Clipboard history is empty. Try extracting text on the left!';
      }
      historyList.appendChild(emptyState);
    } else {
      emptyState.style.display = 'none';
      
      filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.setAttribute('data-id', item.id);
        
        card.innerHTML = `
          <div class="history-card-header">
            <span class="badge-sim ${item.mode}">${item.mode === 'area' ? 'Selected Area' : item.mode === 'ocr' ? 'Gemini OCR' : 'Link Copy'}</span>
            <div class="history-card-actions">
              <i class="fas fa-copy icon-copy-btn" title="Copy snippet to clipboard" aria-label="Copy snippet"></i>
              <i class="fas fa-trash-alt icon-delete-btn" title="Delete snippet" aria-label="Delete snippet"></i>
            </div>
          </div>
          <div class="history-card-body" title="${item.text.replace(/"/g, '&quot;')}">${item.text.replace(/\n/g, '<br>')}</div>
        `;

        // Bind events
        card.querySelector('.icon-copy-btn').addEventListener('click', () => {
          copyToSystemClipboard(item.text);
        });

        card.querySelector('.icon-delete-btn').addEventListener('click', () => {
          deleteHistoryItem(item.id);
        });

        historyList.appendChild(card);
      });
    }

    // Update Counter
    historyCounter.textContent = `${clipboardHistory.length} Item${clipboardHistory.length === 1 ? '' : 's'}`;
  };

  // Clear History
  clearHistoryBtn.addEventListener('click', () => {
    if (clipboardHistory.length > 0) {
      clipboardHistory = [];
      renderHistory();
      showToast('Clipboard log cleared');
    }
  });

  // Search History Input
  searchInput.addEventListener('input', () => {
    renderHistory();
  });

});
