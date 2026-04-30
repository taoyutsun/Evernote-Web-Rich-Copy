(() => {
  if (globalThis.__evernoteWebRichCopyInstalled) {
    return;
  }
  globalThis.__evernoteWebRichCopyInstalled = true;

  const MESSAGE_TYPE = "EWR_COPY";
  const MAX_TOTAL_IMAGE_BYTES = 32 * 1024 * 1024;
  const MAX_SINGLE_IMAGE_BYTES = 12 * 1024 * 1024;

  const DEFAULT_OPTIONS = {
    cleanHtml: true,
    embedImages: true
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPE) {
      return false;
    }

    handleCopy(message)
      .then(sendResponse)
      .catch((error) => {
        const messageText = error && error.message ? error.message : String(error);
        showToast(messageText, "error");
        sendResponse({ ok: false, error: messageText });
      });

    return true;
  });

  async function handleCopy(message) {
    const mode = message.mode || "selection";
    const options = { ...DEFAULT_OPTIONS, ...(message.options || {}) };
    const captures = captureContent(mode);

    if (!captures.length) {
      throw new Error("No Evernote content found. Select note content first, or use Copy active note.");
    }

    for (const capture of captures) {
      const imageStats = normalizeAndClean(capture.box, capture.baseUrl, options);
      const text = toPlainText(capture.box);
      const hasImages = capture.box.querySelectorAll("img").length > 0;

      if (!text.trim() && !hasImages) {
        continue;
      }

      const embedStats = options.embedImages
        ? await embedImages(capture.box, capture.baseUrl)
        : { total: imageStats.total, embedded: 0, failed: 0, skipped: imageStats.total };
      const html = buildClipboardHtml(capture.box.innerHTML);
      const method = await writeRichClipboard(html, text);
      const result = {
        ok: true,
        source: capture.source,
        method,
        textLength: text.length,
        imageStats: embedStats
      };

      showToast(formatSuccessMessage(result), "success");
      return result;
    }

    if (mode === "note") {
      throw new Error("Active note body could not be detected. Click inside the note body, or select content and use Copy Selection.");
    }

    throw new Error("The captured Evernote content is empty.");
  }

  function captureContent(mode) {
    if (mode !== "note") {
      const selectionCapture = captureSelection();
      if (selectionCapture) {
        return [selectionCapture];
      }
    }

    return captureActiveNoteCandidates();
  }

  function captureSelection() {
    for (const doc of collectDocuments(document)) {
      const selection = getDocumentSelection(doc);
      if (!selection || !selection.rangeCount || selection.isCollapsed) {
        continue;
      }

      const box = doc.createElement("div");
      for (let index = 0; index < selection.rangeCount; index += 1) {
        const range = selection.getRangeAt(index);
        if (range.collapsed) {
          continue;
        }
        box.appendChild(range.cloneContents());
      }

      if (box.textContent.trim() || box.querySelector("img")) {
        return {
          source: "selection",
          baseUrl: doc.location.href,
          box
        };
      }
    }

    return null;
  }

  function collectDocuments(rootDoc) {
    const docs = [rootDoc];
    const frames = rootDoc.querySelectorAll("iframe, frame");

    for (const frame of frames) {
      try {
        if (frame.contentDocument) {
          docs.push(...collectDocuments(frame.contentDocument));
        }
      } catch (_error) {
        // Cross-origin frames cannot be inspected. Evernote note editors are usually same-origin.
      }
    }

    return docs;
  }

  function getDocumentSelection(doc) {
    try {
      if (typeof doc.getSelection === "function") {
        return doc.getSelection();
      }
      if (doc.defaultView && typeof doc.defaultView.getSelection === "function") {
        return doc.defaultView.getSelection();
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  function captureActiveNoteCandidates() {
    return findContentRoots()
      .slice(0, 12)
      .map((noteRoot) => {
        const doc = noteRoot.ownerDocument || document;
        const box = doc.createElement("div");
        box.appendChild(noteRoot.cloneNode(true));

        return {
          source: "active-note",
          baseUrl: doc.location.href,
          box
        };
      });
  }

  function findContentRoots() {
    const selectors = [
      "[contenteditable='true']",
      "[role='textbox']",
      "[aria-label*='body' i]",
      "[aria-label*='editor' i]",
      "[data-testid*='editor' i]",
      "[data-testid*='note' i]",
      "[aria-label*='note' i]",
      "[class*='ProseMirror']",
      "[class*='ql-editor']",
      "[class*='editor' i]",
      "[class*='note-content' i]",
      "article",
      "main"
    ];

    const candidates = new Set();
    for (const root of collectSearchRoots(document)) {
      for (const selector of selectors) {
        try {
          root.querySelectorAll(selector).forEach((element) => candidates.add(element));
        } catch (_error) {
          // Ignore selectors that are unsupported in older Chromium builds.
        }
      }

      const activeElement = root.activeElement;
      if (activeElement && typeof activeElement.closest === "function") {
        const activeEditable = activeElement.closest("[contenteditable='true'], [role='textbox'], article, main");
        if (activeEditable) {
          candidates.add(activeEditable);
        }
      }

      addContentAncestors(root, candidates);
    }

    const scored = [];
    for (const candidate of candidates) {
      const score = scoreCandidate(candidate);
      if (score > -Infinity) {
        scored.push({ element: candidate, score });
      }
    }

    scored.sort((left, right) => right.score - left.score);
    const roots = [];
    for (const item of scored) {
      if (!roots.some((root) => root === item.element || root.contains(item.element))) {
        roots.push(item.element);
      }
    }

    const fallback = document.querySelector("main") || document.body;
    if (fallback && !roots.includes(fallback)) {
      roots.push(fallback);
    }

    return roots;
  }

  function collectSearchRoots(rootDoc) {
    const roots = [];
    const seen = new Set();

    function visit(root) {
      if (!root || seen.has(root)) {
        return;
      }

      seen.add(root);
      roots.push(root);

      let elements = [];
      try {
        elements = [...root.querySelectorAll("*")];
      } catch (_error) {
        return;
      }

      for (const element of elements) {
        if ((element.tagName === "IFRAME" || element.tagName === "FRAME") && element.contentDocument) {
          try {
            visit(element.contentDocument);
          } catch (_error) {
            // Cross-origin frames cannot be inspected.
          }
        }

        if (element.shadowRoot) {
          visit(element.shadowRoot);
        }
      }
    }

    visit(rootDoc);
    return roots;
  }

  function addContentAncestors(root, candidates) {
    let added = 0;
    let elements = [];

    try {
      elements = [...root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,pre,blockquote,img,div")];
    } catch (_error) {
      return;
    }

    for (const element of elements) {
      if (added > 320) {
        return;
      }

      if (!hasDirectContent(element) || !isVisible(element)) {
        continue;
      }

      let current = element;
      for (let depth = 0; current && depth < 7; depth += 1) {
        if (current.nodeType !== Node.ELEMENT_NODE) {
          break;
        }
        candidates.add(current);
        added += 1;

        if (current.matches("[contenteditable='true'], [role='textbox'], article, main")) {
          break;
        }

        current = current.parentElement;
      }
    }
  }

  function hasDirectContent(element) {
    if (element.tagName === "IMG") {
      return Boolean(element.getAttribute("src") || element.currentSrc);
    }

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
        return true;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "IMG") {
        return true;
      }
    }

    return false;
  }

  function scoreCandidate(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return -Infinity;
    }

    const tag = element.tagName.toLowerCase();
    if (["script", "style", "nav", "aside", "header", "footer"].includes(tag)) {
      return -Infinity;
    }

    if (!isVisible(element)) {
      return -Infinity;
    }

    const text = getReadableText(element);
    const textLength = text.replace(/\s+/g, " ").trim().length;
    const imageCount = element.querySelectorAll("img").length;
    const tableCount = element.querySelectorAll("table").length;
    const interactiveCount = element.querySelectorAll("button, input, select, textarea").length;
    const className = typeof element.className === "string" ? element.className : "";
    const signature = `${element.id || ""} ${className} ${element.getAttribute("data-testid") || ""} ${element.getAttribute("aria-label") || ""}`;

    if (!textLength && !imageCount && !tableCount) {
      return -Infinity;
    }

    let score = textLength + imageCount * 350 + tableCount * 300 - interactiveCount * 30;

    if (element.isContentEditable || element.getAttribute("role") === "textbox") {
      score += 900;
    }
    if (/editor|note|prosemirror|content/i.test(signature)) {
      score += 600;
    }
    if (/sidebar|toolbar|nav|menu|modal|dialog|search/i.test(signature)) {
      score -= 900;
    }
    if (tag === "main") {
      score -= 250;
    }
    if (tag === "body") {
      score -= 1000;
    }

    const rect = element.getBoundingClientRect();
    const view = element.ownerDocument.defaultView || window;
    const viewportArea = Math.max(1, view.innerWidth * view.innerHeight);
    const elementArea = rect.width * rect.height;
    if (elementArea > viewportArea * 0.9 && !(element.isContentEditable || element.getAttribute("role") === "textbox")) {
      score -= 700;
    }

    return score;
  }

  function isVisible(element) {
    const doc = element.ownerDocument;
    const view = doc.defaultView || window;
    const style = view.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function getReadableText(element) {
    if ("innerText" in element) {
      return element.innerText || "";
    }
    return element.textContent || "";
  }

  function normalizeAndClean(box, baseUrl, options) {
    replaceCheckboxes(box);

    if (options.cleanHtml) {
      box.querySelectorAll("script, style, link, meta, title, svg, canvas, iframe, object, embed").forEach((node) => {
        node.remove();
      });
      box.querySelectorAll("nav, aside, header, footer, [aria-hidden='true'], [hidden]").forEach((node) => {
        node.remove();
      });
    }

    let imageCount = 0;
    box.querySelectorAll("*").forEach((element) => {
      cleanAttributes(element, baseUrl);
      normalizeElementStyle(element);

      if (element.tagName === "IMG") {
        imageCount += 1;
        normalizeImage(element, baseUrl);
      }

      if (element.tagName === "TABLE") {
        appendStyle(element, "border-collapse:collapse;width:auto;");
      }

      if (element.tagName === "TD" || element.tagName === "TH") {
        appendStyle(element, "border:1px solid #d1d5db;padding:4px 6px;vertical-align:top;");
      }

      if (element.tagName === "PRE") {
        appendStyle(element, "white-space:pre-wrap;font-family:Consolas,monospace;background:#f6f8fa;padding:8px;");
      }

      if (element.tagName === "CODE") {
        appendStyle(element, "font-family:Consolas,monospace;");
      }
    });

    return { total: imageCount };
  }

  function replaceCheckboxes(box) {
    box.querySelectorAll("input[type='checkbox']").forEach((input) => {
      const marker = input.ownerDocument.createElement("span");
      marker.textContent = input.checked ? "[x] " : "[ ] ";
      input.replaceWith(marker);
    });
  }

  function cleanAttributes(element, baseUrl) {
    const allowedAttributes = new Set([
      "alt",
      "colspan",
      "href",
      "rowspan",
      "src",
      "style",
      "title"
    ]);

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name.startsWith("data-") || name.startsWith("aria-")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (["contenteditable", "draggable", "spellcheck", "tabindex", "role", "class", "id"].includes(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (!allowedAttributes.has(name)) {
        element.removeAttribute(attribute.name);
      }
    }

    if (element.tagName === "A") {
      const href = element.getAttribute("href");
      if (href) {
        element.setAttribute("href", resolveUrl(href, baseUrl));
      }
    }
  }

  function normalizeElementStyle(element) {
    const originalStyle = element.getAttribute("style");
    if (!originalStyle) {
      return;
    }

    const declarations = originalStyle
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !/^(position|left|right|top|bottom|z-index|transform|transition|animation|cursor|user-select|pointer-events)\s*:/i.test(item));

    if (declarations.length) {
      element.setAttribute("style", `${declarations.join(";")};`);
    } else {
      element.removeAttribute("style");
    }
  }

  function normalizeImage(img, baseUrl) {
    const source = img.currentSrc || img.getAttribute("src") || "";
    if (source) {
      img.setAttribute("src", resolveUrl(source, baseUrl));
    }

    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.removeAttribute("loading");
    img.removeAttribute("decoding");
    appendStyle(img, "max-width:100%;height:auto;");
  }

  async function embedImages(box, baseUrl) {
    const imgs = [...box.querySelectorAll("img")];
    const stats = {
      total: imgs.length,
      embedded: 0,
      failed: 0,
      skipped: 0
    };
    let totalBytes = 0;

    for (const img of imgs) {
      const src = img.getAttribute("src") || "";
      if (!src) {
        stats.skipped += 1;
        continue;
      }

      if (src.startsWith("data:")) {
        stats.embedded += 1;
        continue;
      }

      try {
        const url = resolveUrl(src, baseUrl);
        const response = await fetch(url, {
          credentials: "include",
          cache: "force-cache"
        });

        if (!response.ok) {
          throw new Error(`Image request failed: ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob.size || blob.size > MAX_SINGLE_IMAGE_BYTES || totalBytes + blob.size > MAX_TOTAL_IMAGE_BYTES) {
          stats.skipped += 1;
          continue;
        }

        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute("src", dataUrl);
        totalBytes += blob.size;
        stats.embedded += 1;
      } catch (_error) {
        stats.failed += 1;
      }
    }

    return stats;
  }

  function resolveUrl(value, baseUrl) {
    try {
      return new URL(value, baseUrl || location.href).href;
    } catch (_error) {
      return value;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Unable to read image data."));
      reader.readAsDataURL(blob);
    });
  }

  function appendStyle(element, styleText) {
    const current = element.getAttribute("style") || "";
    element.setAttribute("style", `${current}${current && !current.endsWith(";") ? ";" : ""}${styleText}`);
  }

  function buildClipboardHtml(innerHtml) {
    return [
      "<!doctype html>",
      "<html>",
      "<head><meta charset=\"utf-8\"></head>",
      "<body>",
      "<div style=\"font-family:Calibri,Arial,Microsoft JhengHei,sans-serif;font-size:11pt;line-height:1.45;color:#111;\">",
      innerHtml,
      "</div>",
      "</body>",
      "</html>"
    ].join("");
  }

  function toPlainText(root) {
    const blockTags = new Set([
      "ADDRESS",
      "ARTICLE",
      "ASIDE",
      "BLOCKQUOTE",
      "BR",
      "DD",
      "DIV",
      "DL",
      "DT",
      "FIGCAPTION",
      "FIGURE",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "LI",
      "P",
      "PRE",
      "SECTION",
      "TABLE",
      "TR"
    ]);
    const parts = [];

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue || "");
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tag = node.tagName;
      if (tag === "IMG") {
        const alt = node.getAttribute("alt");
        if (alt) {
          parts.push(`[Image: ${alt}]`);
        } else {
          parts.push("[Image]");
        }
        return;
      }

      if (tag === "BR") {
        parts.push("\n");
        return;
      }

      if (tag === "LI") {
        parts.push("\n- ");
      } else if (blockTags.has(tag)) {
        parts.push("\n");
      }

      node.childNodes.forEach(walk);

      if (blockTags.has(tag)) {
        parts.push("\n");
      }
    }

    root.childNodes.forEach(walk);

    return parts
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function writeRichClipboard(html, text) {
    if (navigator.clipboard && globalThis.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })
        ]);
        return "clipboard-api";
      } catch (_error) {
        // Fallback below handles stricter focus or activation policies.
      }
    }

    if (copyWithExecCommand(html, text)) {
      return "exec-command";
    }

    throw new Error("Clipboard write failed. Click inside the Evernote page and try again.");
  }

  function copyWithExecCommand(html, text) {
    let copied = false;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;";
    document.body.appendChild(textarea);

    const listener = (event) => {
      event.preventDefault();
      event.clipboardData.setData("text/html", html);
      event.clipboardData.setData("text/plain", text);
      copied = true;
    };

    document.addEventListener("copy", listener, true);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
    } catch (_error) {
      copied = false;
    }

    document.removeEventListener("copy", listener, true);
    textarea.remove();

    return copied;
  }

  function formatSuccessMessage(result) {
    const imageText = result.imageStats.total
      ? ` Images: ${result.imageStats.embedded}/${result.imageStats.total} embedded.`
      : "";
    const sourceText = result.source === "selection" ? "Selection copied." : "Active note copied.";
    return `${sourceText}${imageText}`;
  }

  function showToast(message, type) {
    const existing = document.getElementById("ewr-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.id = "ewr-toast";
    toast.textContent = message;
    toast.style.cssText = [
      "position:fixed",
      "right:18px",
      "top:18px",
      "z-index:2147483647",
      "max-width:360px",
      "padding:10px 12px",
      "border-radius:8px",
      "font:13px/1.4 Arial,Microsoft JhengHei,sans-serif",
      "box-shadow:0 10px 30px rgba(15,23,42,.22)",
      "border:1px solid rgba(15,23,42,.16)",
      type === "error" ? "background:#fee2e2;color:#7f1d1d" : "background:#ecfdf5;color:#064e3b"
    ].join(";");

    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 3800);
  }
})();
