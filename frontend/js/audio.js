document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("audioPage");
  if (!root) {
    return;
  }

  if (!window.CIH.requireAuth()) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    window.CIH.showToast("Web Audio is not supported in this browser.");
    return;
  }

  const contentId = window.CIH.getContentId();
  if (!contentId) {
    window.CIH.showToast("Start from the scraper page first.");
    window.location.href = "scraper.html";
    return;
  }

  const playButton = document.getElementById("playToggle");
  const playIcon = document.getElementById("playIcon");
  const playLabel = document.getElementById("playLabel");
  const generationFill = document.getElementById("generationFill");
  const generationStatus = document.getElementById("generationStatus");
  const timelineFill = document.getElementById("timelineFill");
  const currentTime = document.getElementById("currentTime");
  const totalTime = document.getElementById("totalTime");
  const chunkTime = document.getElementById("chunkTime");
  const activeChunkLabel = document.getElementById("activeChunkLabel");
  const modeValue = document.getElementById("nowPlayingMode");
  const voiceValue = document.getElementById("nowPlayingVoice");
  const titleValue = document.getElementById("nowPlayingTitle");
  const chunksReadyCount = document.getElementById("chunksReadyCount");
  const saveAudioButton = document.getElementById("saveAudioButton");
  const downloadAudioButton = document.getElementById("downloadAudioButton");
  const speedSelect = document.getElementById("speedSelect");
  const volumeRange = document.getElementById("volumeRange");
  const timeline = document.querySelector(".timeline");
  const voiceSelect = document.getElementById("audioVoiceSelect");
  const fullCard = document.getElementById("audioModeFullCard");
  const summaryCard = document.getElementById("audioModeSummaryCard");
  const fullInput = document.getElementById("audioModeFullInput");
  const summaryInput = document.getElementById("audioModeSummaryInput");
  const fullWordCount = document.getElementById("audioFullWordCount");
  const fullDuration = document.getElementById("audioFullDuration");
  const summaryWordCount = document.getElementById("audioSummaryWordCount");
  const summaryDuration = document.getElementById("audioSummaryDuration");
  const configStatus = document.getElementById("audioConfigStatus");
  const playbackSourceTitle = document.getElementById("playbackSourceTitle");
  const chunkQueueList = document.getElementById("chunkQueueList");

  let currentMode = sessionStorage.getItem("audioMode") || "summary";
  let currentVoice = sessionStorage.getItem("audioVoice") || "en-US-AriaNeural";

  const audioContext = new AudioContextClass();
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);
  gainNode.gain.value = Number(volumeRange.value) / 100;

  let ws;
  let keepAlive;
  let sessionId = String(Date.now());
  let hasStartedStream = false;
  let generationComplete = false;
  let expectedChunks = 0;
  let isPlaying = false;
  let playheadOffset = 0;
  let playbackStartedAt = null;
  let nextAudibleAt = null;
  let nextAudibleProgramTime = 0;
  let scheduledUntil = 0;
  let uiTimer;
  let totalDurationSeconds = 0;
  let content = null;

  const audioBuffers = [];
  const rawChunkBytes = [];
  const chunkStartTimes = [];
  const scheduledSources = [];

  function persistAudioPreferences() {
    sessionStorage.setItem("audioMode", currentMode);
    sessionStorage.setItem("audioVoice", currentVoice);
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function hasSummary() {
    return Boolean(content?.summary && content.summary.trim());
  }

  function getSummaryWordCount() {
    return (content?.summary || "").split(/\s+/).filter(Boolean).length;
  }

  function getModeLabel(mode = currentMode) {
    return mode === "full" ? "Full text" : "Summary";
  }

  function estimateDurationSeconds(mode = currentMode) {
    const words =
      mode === "full"
        ? Number(content?.wordCount || 0)
        : getSummaryWordCount();

    return window.CIH.estimateReadDuration(words) * 60;
  }

  function getPlaybackRate() {
    return Number(String(speedSelect.value).replace("x", "")) || 1;
  }

  function updatePlayerIcon(iconName) {
    if (iconName === "pause") {
      playIcon.textContent = "❚❚";
      playButton.setAttribute("aria-label", "Pause audio");
      return;
    }

    playIcon.textContent = "▶";
    playButton.setAttribute("aria-label", "Play audio");
  }

  function setButtonAvailability(button, disabled, opacity) {
    button.disabled = disabled;
    button.style.opacity = opacity;
  }

  function getAvailableChunkCount() {
    let count = 0;
    while (audioBuffers[count]) {
      count += 1;
    }
    return count;
  }

  function recomputeTimings() {
    const rate = getPlaybackRate();
    chunkStartTimes.length = 0;
    totalDurationSeconds = 0;

    for (let index = 0; index < audioBuffers.length; index += 1) {
      if (!audioBuffers[index]) {
        break;
      }

      chunkStartTimes[index] = totalDurationSeconds;
      totalDurationSeconds += audioBuffers[index].duration / rate;
    }

    totalTime.textContent = window.CIH.formatDuration(totalDurationSeconds);
  }

  function getCurrentProgramTime() {
    if (!isPlaying) {
      return playheadOffset;
    }

    if (playbackStartedAt === null) {
      if (Number.isFinite(nextAudibleAt) && audioContext.currentTime >= nextAudibleAt) {
        playbackStartedAt = nextAudibleAt - nextAudibleProgramTime;
        playLabel.textContent = "Streaming audio playback active";
      } else {
        return playheadOffset;
      }
    }

    return Math.min(totalDurationSeconds || scheduledUntil, audioContext.currentTime - playbackStartedAt);
  }

  function clearScheduledSources() {
    while (scheduledSources.length) {
      const source = scheduledSources.pop();
      try {
        source.stop();
      } catch {
        // Ignore stop errors for already-ended sources.
      }
    }
  }

  function scheduleAvailableChunks() {
    if (!isPlaying) {
      return;
    }

    const rate = getPlaybackRate();
    const currentProgramTime = getCurrentProgramTime();

    for (let index = 0; index < getAvailableChunkCount(); index += 1) {
      const buffer = audioBuffers[index];
      const chunkStart = chunkStartTimes[index];
      const chunkEnd = chunkStart + buffer.duration / rate;

      if (chunkEnd <= scheduledUntil + 0.01) {
        continue;
      }

      const bufferOffset = Math.max(0, (scheduledUntil - chunkStart) * rate);
      const when = audioContext.currentTime + Math.max(0, chunkStart - currentProgramTime);
      const programStart = chunkStart + bufferOffset / rate;

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.__chunkIndex = index;
      source.__programStart = programStart;
      source.__programEnd = chunkEnd;
      source.connect(gainNode);
      source.start(when, bufferOffset);
      source.onended = () => {
        const sourceIndex = scheduledSources.indexOf(source);
        if (sourceIndex >= 0) {
          scheduledSources.splice(sourceIndex, 1);
        }
      };

      if (playbackStartedAt === null && (nextAudibleAt === null || when < nextAudibleAt)) {
        nextAudibleAt = when;
        nextAudibleProgramTime = programStart;
      }

      scheduledSources.push(source);
      scheduledUntil = chunkEnd;
    }
  }

  function getChunkInfoAt(programTime) {
    for (let index = 0; index < getAvailableChunkCount(); index += 1) {
      const buffer = audioBuffers[index];
      const chunkStart = chunkStartTimes[index] || 0;
      const chunkDuration = buffer.duration / getPlaybackRate();
      const chunkEnd = chunkStart + chunkDuration;

      if (programTime >= chunkStart && programTime <= chunkEnd + 0.05) {
        return {
          index,
          elapsed: Math.max(0, Math.min(programTime - chunkStart, chunkDuration)),
          duration: chunkDuration
        };
      }
    }

    return null;
  }

  function renderQueue(activeChunkIndex = -1) {
    if (!chunkQueueList) {
      return;
    }

    const availableChunks = getAvailableChunkCount();
    const totalChunks = expectedChunks || availableChunks;
    const rows = [];
    const firstVisible = Math.max(0, activeChunkIndex >= 0 ? activeChunkIndex - 1 : 0);
    const lastVisible = Math.min(totalChunks, Math.max(availableChunks + 2, firstVisible + 3));

    for (let index = firstVisible; index < lastVisible; index += 1) {
      let badgeClass = "warn";
      let badgeLabel = "Pending";
      let copy = "Waiting for generation.";

      if (index === activeChunkIndex && playbackStartedAt !== null && isPlaying) {
        badgeClass = "good";
        badgeLabel = "Live";
        copy = "Currently playing in the live stream.";
      } else if (index < availableChunks) {
        badgeClass = "file";
        badgeLabel = "Ready";
        copy = "Buffered and ready for playback.";
      } else if (index < totalChunks) {
        badgeClass = "warn";
        badgeLabel = "Queued";
        copy = "Still generating on the server.";
      }

      rows.push(`
        <div class="chapter-item ${index === activeChunkIndex && isPlaying ? "is-live" : ""}">
          <div>
            <strong>Chunk ${index + 1}</strong>
            <p>${copy}</p>
          </div>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </div>
      `);
    }

    chunkQueueList.innerHTML = rows.length
      ? rows.join("")
      : `
        <div class="chapter-item">
          <div>
            <strong>No chunks yet</strong>
            <p>Press play to start live generation.</p>
          </div>
          <span class="badge warn">Idle</span>
        </div>
      `;
  }

  function renderPlaybackProgress() {
    const current = getCurrentProgramTime();
    currentTime.textContent = window.CIH.formatDuration(current);
    const ratio = totalDurationSeconds ? Math.min(current / totalDurationSeconds, 1) : 0;
    timelineFill.style.width = `${ratio * 100}%`;
    const chunkInfo = getChunkInfoAt(current);

    if (playbackStartedAt === null) {
      activeChunkLabel.textContent = getAvailableChunkCount() > 0 ? "Buffered, waiting to start" : "Waiting for first chunk";
      chunkTime.textContent = "00:00 / 00:00";
      renderQueue(-1);
    } else if (chunkInfo) {
      activeChunkLabel.textContent = `Chunk ${chunkInfo.index + 1}${expectedChunks ? ` of ${expectedChunks}` : ""}`;
      chunkTime.textContent = `${window.CIH.formatDuration(chunkInfo.elapsed)} / ${window.CIH.formatDuration(chunkInfo.duration)}`;
      renderQueue(chunkInfo.index);
    }

    if (generationComplete && isPlaying && current >= totalDurationSeconds - 0.1) {
      pausePlayback(true);
      playheadOffset = 0;
      currentTime.textContent = "00:00";
      timelineFill.style.width = "0%";
      playLabel.textContent = "Playback completed";
      activeChunkLabel.textContent = expectedChunks ? `Completed ${expectedChunks} chunks` : "Playback complete";
      chunkTime.textContent = "00:00 / 00:00";
    }
  }

  function startUiTimer() {
    window.clearInterval(uiTimer);
    uiTimer = window.setInterval(renderPlaybackProgress, 200);
  }

  async function startPlayback(fromTime = playheadOffset) {
    await audioContext.resume();
    isPlaying = true;
    playheadOffset = fromTime;
    playbackStartedAt = null;
    nextAudibleAt = null;
    nextAudibleProgramTime = playheadOffset;
    scheduledUntil = playheadOffset;
    clearScheduledSources();
    scheduleAvailableChunks();
    startUiTimer();
    updatePlayerIcon("pause");
    playLabel.textContent =
      getAvailableChunkCount() > 0 ? "Buffered. Waiting for playback to begin..." : "Waiting for first audio chunk...";
  }

  function pausePlayback(isNaturalEnd = false) {
    playheadOffset = isNaturalEnd ? totalDurationSeconds : getCurrentProgramTime();
    isPlaying = false;
    clearScheduledSources();
    scheduledUntil = playheadOffset;
    window.clearInterval(uiTimer);
    updatePlayerIcon("play");
    if (!isNaturalEnd) {
      playLabel.textContent = "Playback paused";
    }
  }

  function updateGenerationUi(progress, statusText) {
    generationFill.style.width = `${progress}%`;
    generationStatus.textContent = statusText;
    chunksReadyCount.textContent = getAvailableChunkCount().toLocaleString();
    renderQueue(getChunkInfoAt(getCurrentProgramTime())?.index ?? -1);
  }

  function syncPreferenceUI() {
    const summaryAvailable = hasSummary();

    if (currentMode === "summary" && !summaryAvailable) {
      currentMode = "full";
      persistAudioPreferences();
    }

    fullInput.checked = currentMode === "full";
    summaryInput.checked = currentMode === "summary";
    summaryInput.disabled = !summaryAvailable;
    fullCard.classList.toggle("is-selected", fullInput.checked);
    summaryCard.classList.toggle("is-selected", summaryInput.checked);
    summaryCard.classList.toggle("is-disabled", !summaryAvailable);

    voiceSelect.value = currentVoice;
    modeValue.textContent = getModeLabel();
    voiceValue.textContent = currentVoice;
    playbackSourceTitle.textContent = `${getModeLabel()} Playback`;

    if (content) {
      fullWordCount.textContent = `${Number(content.wordCount || 0).toLocaleString()} words`;
      fullDuration.textContent = `Estimated duration: ${window.CIH.estimateReadDuration(content.wordCount)} minutes`;

      if (summaryAvailable) {
        const summaryWords = getSummaryWordCount();
        summaryWordCount.textContent = `${summaryWords.toLocaleString()} words`;
        summaryDuration.textContent = `Estimated duration: ${window.CIH.estimateReadDuration(summaryWords)} minutes`;
      } else {
        summaryWordCount.textContent = "Summary not available yet";
        summaryDuration.textContent = "Generate summary first";
      }

      configStatus.textContent = summaryAvailable || currentMode === "full"
        ? `Ready to generate ${getModeLabel().toLowerCase()} audio using ${currentVoice}.`
        : "Generate a summary first or switch to full text audio.";
    }
  }

  function setCurrentMode(nextMode) {
    if (nextMode === "summary" && !hasSummary()) {
      window.CIH.showToast("Generate a summary first before switching to summary audio.");
      configStatus.textContent = "Summary audio becomes available after you generate a summary.";
      currentMode = "full";
    } else {
      currentMode = nextMode;
    }

    persistAudioPreferences();
    syncPreferenceUI();
    resetAudioState(`Audio mode set to ${getModeLabel().toLowerCase()}. Press play to generate.`);
  }

  function resetAudioState(statusText) {
    window.clearInterval(uiTimer);
    if (isPlaying) {
      pausePlayback();
    } else {
      clearScheduledSources();
      updatePlayerIcon("play");
    }

    hasStartedStream = false;
    generationComplete = false;
    expectedChunks = 0;
    sessionId = String(Date.now());
    playheadOffset = 0;
    playbackStartedAt = null;
    nextAudibleAt = null;
    nextAudibleProgramTime = 0;
    scheduledUntil = 0;
    totalDurationSeconds = 0;
    audioBuffers.length = 0;
    rawChunkBytes.length = 0;
    chunkStartTimes.length = 0;
    currentTime.textContent = "00:00";
    totalTime.textContent = "00:00";
    activeChunkLabel.textContent = "Waiting for first chunk";
    chunkTime.textContent = "00:00 / 00:00";
    timelineFill.style.width = "0%";
    playLabel.textContent = "Ready to start streaming";
    setButtonAvailability(downloadAudioButton, true, "0.55");
    setButtonAvailability(saveAudioButton, true, "0.7");
    saveAudioButton.textContent = "Save Audio";
    updateGenerationUi(0, statusText || `Ready to generate ${getModeLabel().toLowerCase()} audio.`);
    renderQueue(-1);
  }

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.addEventListener("open", () => {
      keepAlive = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    });

    ws.addEventListener("message", async (event) => {
      const data = JSON.parse(event.data);
      if (data.sessionId && data.sessionId !== sessionId) {
        return;
      }

      if (data.type === "start") {
        expectedChunks = data.total;
        updateGenerationUi(2, `Generating ${data.total} chunks for ${getModeLabel().toLowerCase()} audio...`);
        return;
      }

      if (data.type === "chunk") {
        const bytes = base64ToUint8Array(data.audio);
        rawChunkBytes[data.index] = bytes;
        const decoded = await audioContext.decodeAudioData(bytes.buffer.slice(0));
        audioBuffers[data.index] = decoded;
        recomputeTimings();
        updateGenerationUi(data.progress, `Generating chunk ${data.index + 1} of ${data.total}...`);
        if (isPlaying) {
          scheduleAvailableChunks();
        }
        return;
      }

      if (data.type === "done") {
        generationComplete = true;
        expectedChunks = data.completed;
        updateGenerationUi(100, `All ${data.completed} chunks are ready.`);
        setButtonAvailability(downloadAudioButton, false, "1");
        setButtonAvailability(saveAudioButton, false, "1");
        return;
      }

      if (data.type === "chunk-error" || data.type === "error") {
        updateGenerationUi(Number(generationFill.style.width.replace("%", "")) || 0, data.message || "Audio generation failed.");
        playLabel.textContent = data.message || "Audio generation failed.";
        window.CIH.showToast(data.message || "Audio generation failed.");
      }
    });

    ws.addEventListener("close", () => {
      window.clearInterval(keepAlive);
      keepAlive = null;
      ws = null;
    });
  }

  function requestAudioStream() {
    if (currentMode === "summary" && !hasSummary()) {
      window.CIH.showToast("Generate a summary first or switch to full text.");
      return "blocked";
    }

    if (hasStartedStream) {
      return "ready";
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      ws.addEventListener(
        "open",
        () => {
          requestAudioStream();
        },
        { once: true }
      );
      return "pending";
    }

    hasStartedStream = true;
    persistAudioPreferences();
    updateGenerationUi(4, `Starting ${getModeLabel().toLowerCase()} audio generation...`);
    ws.send(
      JSON.stringify({
        type: "generate",
        contentId,
        mode: currentMode,
        voice: currentVoice,
        sessionId
      })
    );

    return "ready";
  }

  function buildAudioBlob() {
    const contiguousChunks = rawChunkBytes.filter(Boolean);
    if (!contiguousChunks.length || !generationComplete) {
      throw new Error("Audio is not ready to save yet.");
    }

    const merged = window.CIH.joinUint8Arrays(contiguousChunks);
    return new Blob([merged], { type: "audio/mpeg" });
  }

  async function loadContent() {
    try {
      window.CIH.showLoader("Loading audio session");
      content = await window.CIH.apiFetch(`/api/content/${contentId}`);
      titleValue.textContent = content.title || content.fileName || content.sourceUrl || "Current content session";

      if (currentMode === "summary" && !hasSummary()) {
        currentMode = "full";
        persistAudioPreferences();
        window.CIH.showToast("Summary not available yet. Switched to full text audio.");
      }

      syncPreferenceUI();
      resetAudioState(`Ready to generate ${getModeLabel().toLowerCase()} audio with ${currentVoice}.`);
    } catch (error) {
      playLabel.textContent = error.message;
      configStatus.textContent = error.message;
    } finally {
      window.CIH.hideLoader();
    }
  }

  playButton.addEventListener("click", async () => {
    try {
      const streamState = requestAudioStream();
      if (streamState === "blocked") {
        return;
      }

      if (!isPlaying) {
        await startPlayback();
      } else {
        pausePlayback();
      }
    } catch (error) {
      playLabel.textContent = error.message;
      window.CIH.showToast(error.message);
    }
  });

  voiceSelect.addEventListener("change", () => {
    currentVoice = voiceSelect.value;
    persistAudioPreferences();
    syncPreferenceUI();
    resetAudioState(`Voice changed to ${currentVoice}. Press play to generate fresh audio.`);
  });

  [fullInput, summaryInput].forEach((input) => {
    input.addEventListener("change", () => {
      setCurrentMode(input.value);
    });
  });

  fullCard.addEventListener("click", (event) => {
    event.preventDefault();
    if (currentMode !== "full") {
      setCurrentMode("full");
    }
  });

  summaryCard.addEventListener("click", (event) => {
    event.preventDefault();
    if (currentMode !== "summary") {
      setCurrentMode("summary");
    } else if (!hasSummary()) {
      setCurrentMode("summary");
    }
  });

  volumeRange.addEventListener("input", () => {
    gainNode.gain.value = Number(volumeRange.value) / 100;
  });

  speedSelect.addEventListener("change", async () => {
    const resumeFrom = getCurrentProgramTime();
    recomputeTimings();
    if (isPlaying) {
      pausePlayback();
      await startPlayback(resumeFrom);
    } else {
      playheadOffset = Math.min(resumeFrom, totalDurationSeconds);
      renderPlaybackProgress();
    }
  });

  timeline?.addEventListener("click", async (event) => {
    if (!totalDurationSeconds) {
      return;
    }

    const rect = timeline.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const targetTime = Math.max(0, Math.min(totalDurationSeconds * ratio, totalDurationSeconds));

    if (isPlaying) {
      pausePlayback();
      await startPlayback(targetTime);
    } else {
      playheadOffset = targetTime;
      renderPlaybackProgress();
    }
  });

  downloadAudioButton.addEventListener("click", () => {
    try {
      const blob = buildAudioBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(content?.title || "content-audio").replace(/[^\w-]+/g, "-")}-${currentMode}.mp3`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.CIH.showToast(error.message);
    }
  });

  saveAudioButton.addEventListener("click", async () => {
    try {
      window.CIH.setButtonLoading(saveAudioButton, true);
      window.CIH.showLoader("Saving audio");
      const blob = buildAudioBlob();
      const buffer = await blob.arrayBuffer();
      const audioBase64 = window.CIH.arrayBufferToBase64(buffer);

      const payload = await window.CIH.apiFetch(`/api/audio/${contentId}/save`, {
        method: "POST",
        body: JSON.stringify({
          audioBase64,
          audioMode: currentMode,
          mimeType: "audio/mpeg"
        })
      });

      saveAudioButton.textContent = payload.audioMode === "full" ? "Saved Full Audio" : "Saved Summary Audio";
      window.CIH.showToast("Audio uploaded successfully.");
    } catch (error) {
      window.CIH.showToast(error.message);
    } finally {
      window.CIH.setButtonLoading(saveAudioButton, false);
      window.CIH.hideLoader();
    }
  });

  resetAudioState(`Ready to generate ${getModeLabel().toLowerCase()} audio.`);
  connectWebSocket();
  loadContent();
});
