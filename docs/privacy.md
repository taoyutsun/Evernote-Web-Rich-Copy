# Privacy

Evernote Web Rich Copy runs locally in Chrome or Edge.

## Data Handling

- The extension reads content only from Evernote Web pages opened by the user.
- Copied note content is written to the local system clipboard.
- The extension does not send note content, account information, image data, or clipboard data to any external server.
- The extension stores only two local preferences:
  - whether to embed images;
  - whether to clean page chrome from copied HTML.

## Permissions

- `clipboardWrite`: required to write rich HTML and plain text to the system clipboard.
- `activeTab`: used to work with the active Evernote tab when the user invokes the extension.
- `scripting`: used to inject the content script if Chrome has not already loaded it.
- `storage`: used to save local copy options.
- `https://evernote.com/*` and `https://*.evernote.com/*`: limit operation to Evernote Web pages.

## Network Access

When Embed images is enabled, the extension asks the browser to fetch image URLs already present in the Evernote note so those images can be placed into the clipboard as embedded data. Those requests use the user's existing browser session and are not routed through any third-party service.
