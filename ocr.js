async function executeImageOCR(dataUrl) {
  if (window.showStatus) {
    window.showStatus('Analyzing image text…');
  }

  // Load settings from extension storage
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get(['textora_google_api_key', 'textora_use_google_ocr'], resolve);
  });

  const apiKey = (settings.textora_google_api_key || '').trim();
  const useGoogle = !!settings.textora_use_google_ocr;

  try {
    if (useGoogle && apiKey) {
      // Run Gemini 2.5 Flash OCR by routing request through background service worker
      const base64Content = dataUrl.split(',')[1];
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'GEMINI_OCR', apiKey, base64Content },
          resolve
        );
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Gemini API request failed');
      }

      const data = response.data;
      const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (extractedText && extractedText.trim()) {
        if (window.copyToClipboard) {
          window.copyToClipboard(extractedText.trim(), 'Image OCR');
        } else {
          navigator.clipboard.writeText(extractedText.trim());
          alert('Copied to clipboard');
        }
      } else {
        if (window.showStatus) {
          window.showStatus('No text detected in selected area', true);
        } else {
          alert('No text detected in selected area');
        }
      }
    } else {
      // Fallback to offline Tesseract OCR
      if (window.showStatus) {
        window.showStatus('Analyzing text locally (Tesseract)…');
      }
      const res = await Tesseract.recognize(dataUrl, "eng");
      if (res.data.text.trim()) {
        if (window.copyToClipboard) {
          window.copyToClipboard(res.data.text.trim(), 'Image OCR');
        } else {
          navigator.clipboard.writeText(res.data.text.trim());
          alert('Copied to clipboard');
        }
      } else {
        if (window.showStatus) {
          window.showStatus('No text detected in selected area', true);
        } else {
          alert('No text detected in selected area');
        }
      }
    }
  } catch (e) {
    console.error("OCR Error:", e);
    if (window.showStatus) {
      window.showStatus(e.message || 'OCR extraction failed', true);
    } else {
      alert('OCR extraction failed: ' + e.message);
    }
  }
}

window.executeImageOCR = executeImageOCR;
