# Textora – Extract Any Text

A powerful, premium Chrome Extension (Manifest V3) that allows you to copy text from difficult sources on the web, including **images (OCR)**, **hyperlinks**, and specific **visual areas** regardless of the underlying DOM structure.

## 🚀 Features

### 1. ✂️ Selected Area
Draw a selection box around *any* part of the screen to copy only the text inside that area.
- Works by spatially analyzing text nodes (using `TreeWalker`) relative to your selection box.
- Great for copying columns, sidebars, or specific data points without grabbing surrounding clutter.

### 2. 🔍 Copy from Image
Draw a selection box around any image area on the screen to extract its text using a dual-engine approach:
- **Gemini 2.5 Flash API**: High-accuracy, high-speed multimodal AI engine (requires a Gemini API key).
- **Tesseract.js**: Offline fallback engine running fully locally in the browser if no API key is set.

### 3. 🔗 Copy from Link
Enables a selection mode where you can hover over and click any hyperlink on the page to instantly copy its text content to your clipboard without triggering navigation.

### 4. ⏳ Popup Copy History
A compact, slide-over panel embedded directly inside the extension popup window.
- Real-time search matches text content, badge label, or webpage title.
- Copy and delete actions directly on each history card.
- Persisted locally in `chrome.storage.local`.

---

## 🛠️ Installation

1. **Clone or Download** this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** by toggling the switch in the top-right corner.
4. Click the **Load unpacked** button.
5. Select the folder containing `manifest.json` (the root of this project).

## 🖥️ Usage

1. Pin the extension to your browser toolbar for easy access.
2. Click the extension icon to open the modern UI popup.
3. Choose your desired action:
   - **Selected Area**: Click, then click-and-drag on the page to draw a selection box.
   - **Copy from Image**: Scans all images on the page for text.
   - **Copy from Link**: Hover and click a link to extract its text content.
4. Toggle Settings (gear icon) to configure and **test** your Gemini API Key in real time.

## 💡 Usage Tips & Tricks

- **Escape Selection**: Press `Esc` key at any time to cancel active selection modes (drawing visual boxes or clicking links).
- **Direct Copy Highlighted Text**: If you already have text highlighted natively on a webpage, clicking the **Selected Area** button in the popup copies it immediately without requiring you to draw a box.
- **Save Navigation in Copy Link Mode**: Use **Copy from Link** to extract specific URLs or button anchor texts without navigating away from your active tab.
- **Leverage Gemini 2.5 Flash**: Set up your Gemini API key in settings for faster, higher-accuracy handwriting, coding syntax, and multi-language OCR scans.
- **Search History**: Use the search input inside the history drawer to quickly retrieve copied code fragments, emails, and links by matching keywords.

## ⚙️ Technical Details

- **Manifest V3**: Uses the latest Chrome Extension standard.
- **Dynamic Injection**: Injects content scripts dynamically if they are missing (e.g., if the extension was reloaded while a tab was open), preventing script errors.
- **CSP Bypass Service Worker**: Routes Gemini API requests through the background service worker (`background.js`) to bypass webpage Content Security Policy (CSP) blocks.

## 📂 Project Structure

- `manifest.json`: Extension configuration.
- `background.js`: Service worker to bypass CSP restrictions for Gemini 2.5 Flash API calls and run tests.
- `popup.html` / `popup.js` / `popup.css`: The main extension popup interface, settings, and embedded history panel.
- `content.js`: Main logic for selection drawing, coordinate checking, and link highlighting/click interception.
- `ocr.js`: Logic for handling image OCR via Gemini 2.5 Flash API or local Tesseract.js.
- `lib/`: Contains Tesseract.js library.
- `icons/`: Contains extension icons (16/32/48/128px PNG files).

## 🔒 Permissions

- `activeTab`: To access the current page when clicked.
- `scripting`: To inject scripts dynamically.
- `clipboardWrite`: To save extracted text to your clipboard.
- `storage`: To save settings and copy history locally.
