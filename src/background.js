const EVERNOTE_HOST_RE = /(^|\.)evernote\.com$/i;

const DEFAULT_COPY_OPTIONS = {
  cleanHtml: true,
  embedImages: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const { copyOptions } = await chrome.storage.local.get("copyOptions");
  if (!copyOptions) {
    await chrome.storage.local.set({ copyOptions: DEFAULT_COPY_OPTIONS });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "copy-rich-selection") {
    await copyFromActiveTab("selection");
    return;
  }

  if (command === "copy-active-note") {
    await copyFromActiveTab("note");
  }
});

async function copyFromActiveTab(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return;
  }

  if (!isEvernoteUrl(tab.url || "")) {
    await showTemporaryBadge(tab.id, "!");
    return;
  }

  const { copyOptions = DEFAULT_COPY_OPTIONS } = await chrome.storage.local.get("copyOptions");
  try {
    await sendCopyMessage(tab.id, mode, copyOptions);
    await showTemporaryBadge(tab.id, "OK");
  } catch (_error) {
    await showTemporaryBadge(tab.id, "ERR");
  }
}

async function sendCopyMessage(tabId, mode, options) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "EWR_COPY",
      mode,
      options
    });
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content.js"]
    });

    return chrome.tabs.sendMessage(tabId, {
      type: "EWR_COPY",
      mode,
      options
    });
  }
}

async function showTemporaryBadge(tabId, text) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }, 1800);
}

function isEvernoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && EVERNOTE_HOST_RE.test(url.hostname);
  } catch (_error) {
    return false;
  }
}
