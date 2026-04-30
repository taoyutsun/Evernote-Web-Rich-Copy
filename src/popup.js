const DEFAULT_OPTIONS = {
  cleanHtml: true,
  embedImages: true
};

const EVERNOTE_HOST_RE = /(^|\.)evernote\.com$/i;

const elements = {
  pageState: document.getElementById("pageState"),
  result: document.getElementById("result"),
  copySelection: document.getElementById("copySelection"),
  copyNote: document.getElementById("copyNote"),
  embedImages: document.getElementById("embedImages"),
  cleanHtml: document.getElementById("cleanHtml")
};

init().catch((error) => {
  renderResult(error.message || String(error), "error");
});

async function init() {
  const options = await loadOptions();
  elements.embedImages.checked = options.embedImages;
  elements.cleanHtml.checked = options.cleanHtml;

  elements.embedImages.addEventListener("change", saveOptionsFromUi);
  elements.cleanHtml.addEventListener("change", saveOptionsFromUi);
  elements.copySelection.addEventListener("click", () => copy("selection"));
  elements.copyNote.addEventListener("click", () => copy("note"));

  const tab = await getActiveTab();
  const isEvernote = tab && isEvernoteUrl(tab.url || "");
  elements.pageState.textContent = isEvernote
    ? "Ready on Evernote Web."
    : "Open an Evernote Web note first.";
  setActionsEnabled(Boolean(isEvernote));
}

async function copy(mode) {
  setBusy(true);
  renderResult("Preparing rich clipboard content...", "");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !isEvernoteUrl(tab.url || "")) {
      throw new Error("This extension only runs on Evernote Web pages.");
    }

    const options = await loadOptions();
    const result = await sendCopyMessage(tab.id, mode, options);
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Copy failed.");
    }

    const imageText = result.imageStats && result.imageStats.total
      ? ` Images embedded: ${result.imageStats.embedded}/${result.imageStats.total}.`
      : "";
    const sourceText = result.source === "selection" ? "Selection copied." : "Active note copied.";
    renderResult(`${sourceText}${imageText} Paste into Word, Outlook, or Excel.`, "success");
  } catch (error) {
    renderResult(error.message || String(error), "error");
  } finally {
    setBusy(false);
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

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isEvernoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && EVERNOTE_HOST_RE.test(url.hostname);
  } catch (_error) {
    return false;
  }
}

async function loadOptions() {
  const { copyOptions } = await chrome.storage.local.get("copyOptions");
  return { ...DEFAULT_OPTIONS, ...(copyOptions || {}) };
}

async function saveOptionsFromUi() {
  await chrome.storage.local.set({
    copyOptions: {
      embedImages: elements.embedImages.checked,
      cleanHtml: elements.cleanHtml.checked
    }
  });
}

function setBusy(isBusy) {
  elements.copySelection.disabled = isBusy;
  elements.copyNote.disabled = isBusy;
}

function setActionsEnabled(enabled) {
  elements.copySelection.disabled = !enabled;
  elements.copyNote.disabled = !enabled;
}

function renderResult(message, state) {
  elements.result.textContent = message;
  elements.result.className = state ? `result ${state}` : "result";
}
