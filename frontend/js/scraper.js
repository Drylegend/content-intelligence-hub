document.addEventListener("DOMContentLoaded", () => {
  const scraperRoot = document.getElementById("scraperPage");
  if (!scraperRoot) {
    return;
  }

  if (!window.CIH.requireAuth()) {
    return;
  }

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const urlInput = document.getElementById("sourceUrl");
  const urlForm = document.getElementById("urlScrapeForm");
  const scrapeSubmitButton = document.getElementById("scrapeSubmitButton");
  const fileInput = document.getElementById("sourceFile");
  const fileMeta = document.getElementById("fileMeta");
  const progressPanel = document.getElementById("scrapeProgress");
  const progressFill = document.getElementById("scrapeProgressFill");
  const progressStatus = document.getElementById("scrapeStatus");
  const resultPanel = document.getElementById("scrapeResult");
  const previewText = document.getElementById("previewText");
  const wordCount = document.getElementById("wordCountBadge");
  const openSummaryButton = document.getElementById("openSummaryButton");
  const openAudioButton = document.getElementById("openAudioButton");
  const sourceTabs = document.querySelectorAll("[data-source-switch]");
  const sourcePanels = document.querySelectorAll("[data-source-panel]");

  function setTab(tabName) {
    sourceTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.sourceSwitch === tabName);
    });
    sourcePanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.sourcePanel === tabName);
    });
  }

  function updateProgress(statusText, width) {
    progressPanel.classList.remove("hidden");
    resultPanel.classList.remove("hidden");
    progressStatus.textContent = statusText;
    progressFill.style.width = `${width}%`;
  }

  function cacheContentSession(payload) {
    const snapshot = {
      contentId: payload.contentId,
      title: payload.title || "",
      sourceUrl: payload.sourceUrl || "",
      fileName: payload.fileName || "",
      sourceType: payload.sourceType || "",
      wordCount: payload.wordCount || 0,
      preview: payload.preview || "",
      createdAt: payload.createdAt || new Date().toISOString()
    };

    window.CIH.storeContentId(payload.contentId);
    sessionStorage.setItem("contentSnapshot", JSON.stringify(snapshot));
  }

  function seedAudioPreferences(mode = "full") {
    sessionStorage.setItem("audioMode", mode);
    if (!sessionStorage.getItem("audioVoice")) {
      sessionStorage.setItem("audioVoice", "en-US-AriaNeural");
    }
  }

  async function extractPDF(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];

    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(" ");
      pages.push(text);
    }

    return pages.join("\n");
  }

  async function extractDOCX(file) {
    const buffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  async function saveParsedText({ rawText, fileName, sourceType, title }) {
    const payload = await window.CIH.apiFetch("/api/content/save", {
      method: "POST",
      body: JSON.stringify({
        sourceType,
        fileName,
        title,
        rawText
      })
    });

    cacheContentSession({
      ...payload,
      sourceType,
      fileName
    });

    previewText.textContent = payload.preview || rawText.slice(0, 500);
    wordCount.textContent = `Estimated words: ${payload.wordCount.toLocaleString()}`;
    return payload;
  }

  sourceTabs.forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.sourceSwitch));
  });

  fileInput?.addEventListener("click", () => {
    fileInput.value = "";
    const errorNode = document.querySelector('[data-error-for="sourceFile"]');
    if (errorNode) {
      errorNode.textContent = "";
    }
  });

  openSummaryButton?.addEventListener("click", () => {
    seedAudioPreferences("summary");
    window.CIH.showLoader("Opening summary workspace");
  });

  openAudioButton?.addEventListener("click", () => {
    seedAudioPreferences("full");
    window.CIH.showLoader("Opening audio settings");
  });

  urlInput?.addEventListener("input", () => {
    const message = window.CIH.validateURL(urlInput.value);
    const node = document.querySelector('[data-error-for="sourceUrl"]');
    if (node) {
      node.textContent = message;
    }
  });

  urlForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = window.CIH.validateURL(urlInput.value);
    const node = document.querySelector('[data-error-for="sourceUrl"]');
    if (node) {
      node.textContent = message;
    }
    if (message) {
      return;
    }

    try {
      window.CIH.setButtonLoading(scrapeSubmitButton, true);
      window.CIH.showLoader("Scraping source");
      updateProgress("Scraping URL...", 28);

      const payload = await window.CIH.apiFetch("/api/scrape", {
        method: "POST",
        body: JSON.stringify({ url: urlInput.value.trim() })
      });

      updateProgress("Extracting readable text...", 76);
      cacheContentSession({
        ...payload,
        sourceType: "url",
        sourceUrl: urlInput.value.trim()
      });

      previewText.textContent = payload.preview;
      wordCount.textContent = `Estimated words: ${payload.wordCount.toLocaleString()}`;
      updateProgress("Done", 100);
      window.CIH.showToast("URL scraped successfully.");
    } catch (error) {
      updateProgress("Scrape failed", 100);
      previewText.textContent = error.message;
      wordCount.textContent = "Estimated words: 0";
      window.CIH.showToast(error.message);
    } finally {
      window.CIH.setButtonLoading(scrapeSubmitButton, false);
      window.CIH.hideLoader();
    }
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    const error = window.CIH.validateFile(file);
    const errorNode = document.querySelector('[data-error-for="sourceFile"]');
    if (errorNode) {
      errorNode.textContent = error;
    }
    if (error || !file) {
      fileMeta.textContent = "Accepted: PDF, DOCX, TXT up to 50MB.";
      return;
    }

    try {
      fileMeta.textContent = `${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      window.CIH.showLoader("Preparing file");
      updateProgress("Reading file...", 24);

      let rawText = "";
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".pdf")) {
        rawText = await extractPDF(file);
      } else if (lowerName.endsWith(".docx")) {
        rawText = await extractDOCX(file);
      } else {
        rawText = await file.text();
      }

      updateProgress("Saving extracted content...", 82);
      const title = file.name.replace(/\.[^.]+$/, "");
      await saveParsedText({
        rawText,
        fileName: file.name,
        sourceType: "file",
        title
      });

      updateProgress("Done", 100);
      window.CIH.showToast("File parsed and saved.");
    } catch (uploadError) {
      updateProgress("File processing failed", 100);
      previewText.textContent = uploadError.message;
      wordCount.textContent = "Estimated words: 0";
      window.CIH.showToast(uploadError.message);
    } finally {
      window.CIH.hideLoader();
    }
  });
});
