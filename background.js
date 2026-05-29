chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_TAB') {
    const windowId = sender.tab ? sender.tab.windowId : null;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then(dataUrl => {
        sendResponse({ success: true, dataUrl });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open
  }
  
  else if (request.action === 'GEMINI_OCR') {
    const { apiKey, base64Content } = request;
    
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Extract all text from this image. Output only the extracted text. Do not add any introduction, explanation, or commentary." },
            { inlineData: { mimeType: "image/png", data: base64Content } }
          ]
        }]
      })
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(text => {
          throw new Error(parseErrorResponse(res.status, text));
        });
      }
      return res.json();
    })
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === 'TEST_GEMINI_API') {
    const { apiKey } = request;
    
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Hello" }]
        }]
      })
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(text => {
          throw new Error(parseErrorResponse(res.status, text));
        });
      }
      return res.json();
    })
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
  }
});

chrome.commands.onCommand.addListener((command) => {
  console.log('Witcopy command received:', command);
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) {
      console.warn('Witcopy: No active tab found in last focused window.');
      return;
    }
    console.log('Witcopy targeting tab:', activeTab.id, activeTab.url);
    
    let action = '';
    if (command === 'run_select_area') {
      action = 'SELECT_AREA';
    } else if (command === 'run_copy_image') {
      action = 'BULK_OCR';
    } else if (command === 'run_copy_link') {
      action = 'COPY_LINK';
    }
    
    if (action) {
      const sendMsg = () => {
        chrome.tabs.sendMessage(activeTab.id, { action }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Witcopy: Error sending message to content script:', chrome.runtime.lastError.message);
          } else {
            console.log('Witcopy: Command sent successfully:', action);
          }
        });
      };

      // Ping tab to check if content script is loaded
      chrome.tabs.sendMessage(activeTab.id, { action: 'PING' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.log('Witcopy: Content script not loaded. Injecting scripts...', chrome.runtime.lastError.message);
          // If not loaded, inject libraries and content script
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['lib/tesseract.min.js', 'ocr.js', 'content.js']
          }).then(() => {
            console.log('Witcopy: Scripts injected successfully.');
            setTimeout(sendMsg, 120);
          }).catch((err) => {
            console.error('Witcopy: Script injection failed:', err);
          });
        } else {
          // If loaded, send command immediately
          console.log('Witcopy: Content script is responsive (PING received PONG).');
          sendMsg();
        }
      });
    }
  });
});


function parseErrorResponse(status, text) {
  let errMsg = `Gemini API error (Status ${status})`;
  if (status === 429) {
    return 'Gemini API limit reached. Please wait or try again later.';
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed.error) {
      const statusText = parsed.error.status || '';
      const msgText = parsed.error.message || '';
      if (statusText === 'RESOURCE_EXHAUSTED' || msgText.toLowerCase().includes('limit') || msgText.toLowerCase().includes('quota')) {
        return 'Gemini API limit reached. Please wait or try again later.';
      }
      return msgText || errMsg;
    }
  } catch (e) {}
  return errMsg;
}

