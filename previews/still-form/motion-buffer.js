window.sfCreateMotionBuffer = ({
  video,
  toggle,
  message,
  labels,
  canAutoplay,
}) => {
  const source = video.querySelector("source[src]");
  if (
    !source ||
    !window.fetch ||
    !window.AbortController ||
    !URL.createObjectURL
  )
    return null;
  const original = new URL(source.getAttribute("src"), location.href);
  const expected = Number(video.dataset.sfBytes);
  if (
    original.origin !== location.origin ||
    !/^https?:$/.test(original.protocol) ||
    !Number.isSafeInteger(expected) ||
    expected < 1 ||
    expected > 1024 * 1024
  )
    return null;
  const action = document.createElement("button");
  action.type = "button";
  action.textContent = "Unload motion";
  action.dataset.sfBufferAction = "";
  action.hidden = true;
  const fallback = document.createElement("button");
  fallback.type = "button";
  fallback.dataset.sfBufferAction = "";
  fallback.textContent = "Use original player";
  fallback.hidden = true;
  toggle.after(action, fallback);
  let generation = 0,
    controller = null,
    objectURL = null,
    phase = "idle",
    timer = null;
  const status = video
    .closest("[data-sf-video]")
    .querySelector(".sf-video-status");
  status.id ||= "sf-motion-load-status";
  video.setAttribute(
    "aria-describedby",
    [video.getAttribute("aria-describedby"), status.id]
      .filter(Boolean)
      .join(" "),
  );
  const reset = (text) => {
    generation++;
    controller?.abort();
    controller = null;
    clearTimeout(timer);
    video.pause();
    video.removeAttribute("src");
    source.remove();
    video.load();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null;
    phase = "idle";
    toggle.disabled = false;
    video.controls = false;
    action.hidden = true;
    fallback.hidden = true;
    status.setAttribute("aria-busy", "false");
    if (text) message(text);
    labels();
  };
  const fail = () => {
    reset(
      "This motion study could not be loaded. Press Play motion to retry, use the original player, or open the video source below. Seeking may be unavailable in the original player.",
    );
    fallback.hidden = false;
  };
  reset();
  action.addEventListener("click", () => {
    reset(
      phase === "loading"
        ? "Loading canceled. Press Play motion when ready."
        : "Motion unloaded. Press Play motion when ready.",
    );
    toggle.focus();
  });
  fallback.addEventListener("click", () => {
    reset();
    phase = "original";
    source.src = original.href;
    video.prepend(source);
    video.controls = true;
    video.load();
    message(
      "Original player enabled. Seeking may be unavailable on this host. Open the video source or read the visual description if playback fails.",
    );
    toggle.focus();
  });
  video.addEventListener("error", () => {
    if (phase === "ready") fail();
  });
  window.addEventListener("pagehide", () => reset());
  return {
    cancel: () => reset(),
    async play(manual = false) {
      if (phase === "loading") return false;
      const job = generation;
      try {
        if (phase === "original") {
          await video.play();
          return job === generation;
        }
        if (phase !== "ready") {
          phase = "loading";
          const request = new AbortController();
          controller = request;
          timer = setTimeout(() => request.abort(), 45000);
          toggle.disabled = true;
          action.textContent = "Cancel loading";
          action.hidden = false;
          fallback.hidden = true;
          status.setAttribute("aria-busy", "true");
          message("Loading motion… You can cancel.");
          const response = await fetch(original.href, {
            signal: request.signal,
            credentials: "same-origin",
            redirect: "error",
          });
          if (
            !response.ok ||
            !/^video\/mp4(?:;|$)/i.test(
              response.headers.get("content-type") || "",
            )
          )
            throw new Error("Motion response unavailable");
          const length = Number(response.headers.get("content-length"));
          if (length && length !== expected)
            throw new Error("Motion size changed");
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Motion streaming unavailable");
          const chunks = [];
          let total = 0,
            announcement = -1;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > expected) {
              await reader.cancel();
              throw new Error("Motion size exceeded");
            }
            chunks.push(value);
            const progress = Math.floor((total / expected) * 10) * 10;
            if (job === generation && progress !== announcement) {
              announcement = progress;
              message(`Loading motion… ${progress}%. You can cancel.`);
            }
          }
          if (total !== expected) throw new Error("Motion download incomplete");
          if (job !== generation || request.signal.aborted) return false;
          const blob = new Blob(chunks, { type: "video/mp4" });
          chunks.length = 0;
          objectURL = URL.createObjectURL(blob);
          await new Promise((resolve, reject) => {
            const clean = () => {
              clearTimeout(readyTimer);
              video.removeEventListener("loadedmetadata", ready);
              video.removeEventListener("error", error);
              request.signal.removeEventListener("abort", error);
            };
            const ready = () => {
              clean();
              resolve();
            };
            const error = () => {
              clean();
              reject(new Error("Motion unavailable"));
            };
            const readyTimer = setTimeout(error, 10000);
            video.addEventListener("loadedmetadata", ready, { once: true });
            video.addEventListener("error", error, { once: true });
            request.signal.addEventListener("abort", error, { once: true });
            video.src = objectURL;
            video.load();
          });
          if (job !== generation || request.signal.aborted) return false;
          clearTimeout(timer);
          controller = null;
          phase = "ready";
          toggle.disabled = false;
          video.controls = true;
          action.textContent = "Unload motion";
          status.setAttribute("aria-busy", "false");
        }
        if (!manual && !canAutoplay()) {
          message("Motion is ready. Press Play motion if you choose.");
          return false;
        }
        await video.play();
        return job === generation;
      } catch {
        if (job === generation) fail();
        return false;
      }
    },
  };
};
