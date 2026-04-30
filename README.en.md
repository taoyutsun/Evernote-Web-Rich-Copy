# Evernote Web Rich Copy

[繁體中文 README](README.md)

Evernote Web Rich Copy is a Chrome / Edge extension that copies selected Evernote Web note content as rich HTML so it can be pasted into Word, Outlook, Excel, Google Docs, and other rich-text editors with formatting and images preserved as much as the browser allows.

If you use Evernote Desktop, see [Evernote Desktop Rich Copy](https://github.com/taoyutsun/Evernote-Desktop-Rich-Copy).

## Features

- Copies the current Evernote Web selection as `text/html` and `text/plain`.
- Can copy the active note body when no selection is available.
- Tries to embed note images as `data:` URLs so Word and Outlook can paste them without needing Evernote session access.
- Cleans obvious Evernote page chrome such as scripts, hidden UI, sidebars, toolbars, iframes, and event attributes.
- Provides toolbar popup buttons and keyboard shortcuts.
- Shows author and GitHub project links at the bottom of the popup.
- Runs locally in the browser. It does not send note content to any server.

## Install

1. Go to [GitHub Releases](https://github.com/taoyutsun/Evernote-Web-Rich-Copy/releases/latest).
2. Download the latest ZIP file, for example `Evernote-Web-Rich-Copy-v0.1.0.zip`.
3. Extract the ZIP file into a stable folder. If you move or delete that folder later, the unpacked extension in the browser will stop working.
4. Open Chrome or Edge.
5. Go to `chrome://extensions` or `edge://extensions`.
6. Enable Developer mode.
7. Click Load unpacked.
8. Select the extracted folder that contains `manifest.json`.
9. Open Evernote Web and sign in.
10. Open a note and select the content you want to copy.
11. Click the extension icon and choose Copy Selection.
12. Paste into Word, Outlook, Excel, or another editor.

You can also get the source code with Git:

```bash
git clone https://github.com/taoyutsun/Evernote-Web-Rich-Copy.git
```

When using Git, choose the cloned project folder that contains `manifest.json` for Load unpacked.

The bottom of the extension popup includes author and GitHub project links for source reference and updates.

## Usage

### Copy Selection

Copies the content currently selected in Evernote Web. This is the primary workflow for copying a paragraph, table, image, or mixed note content.

### Copy Active Note

Copies the currently active note body. This is a fallback workflow for cases where you have not selected content first or want to copy the whole note body.

Evernote Web is a single-page app, so Active Note uses DOM heuristics to find the area most likely to be the note body. If extra UI is copied, use Copy Selection instead.

## Keyboard Shortcuts

- `Alt+Shift+C`: Copy Selection.
- `Alt+Shift+N`: Copy Active Note.

If a shortcut does not work, open `chrome://extensions/shortcuts` or `edge://extensions/shortcuts` and confirm that it is assigned. Chrome / Edge may skip manifest shortcuts when they conflict with another browser, extension, or operating system shortcut.

## Current Limitations

- Evernote Web is a single-page app and its internal DOM can change. Copy Active Note uses conservative heuristics.
- Image embedding depends on whether the browser can fetch the image URL with the current Evernote session. If an image cannot be fetched, the extension leaves the original URL in the HTML.
- Very large images are skipped instead of embedded to avoid oversized clipboard payloads.
- This extension is built for Evernote Web. It cannot inspect Evernote Desktop app internals.

## Project Layout

```text
.
|-- manifest.json
|-- icons/
|-- src/
|   |-- background.js
|   |-- content.js
|   |-- popup.css
|   |-- popup.html
|   `-- popup.js
`-- docs/
    `-- privacy.md
```

## Development Checks

Run these from the project root:

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null
```
