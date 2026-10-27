(() => {
  if (!window.fetch || !window.AbortController || !URL.createObjectURL) return;
  const limit = 12 * 1024 * 1024;
  let releaseActive = null;
  document.querySelectorAll("video[data-short-film]").forEach((video) => {
    const panel = video.closest(".detail-media")?.nextElementSibling;
    const source = video.querySelector("source[src]");
    if (!panel?.matches("[data-film-loader]") || !source) return;
    const original = new URL(source.getAttribute("src"), location.href);
    const expectedBytes = Number(video.dataset.filmBytes);
    if (
      original.origin !== location.origin ||
      !/^https?:$/.test(original.protocol) ||
      !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > limit
    )
      return;
    const status = panel.querySelector("[role=status]");
    const load = panel.querySelector("[data-film-load]");
    const cancel = panel.querySelector("[data-film-cancel]");
    const release = panel.querySelector("[data-film-release]");
    const fallback = panel.querySelector("[data-film-original]");
    let phase = "idle",
      generation = 0,
      controller = null,
      objectURL = null,
      timer = null;
    const say = (text) => {
      status.textContent = text;
    };
    const detach = () => {
      video.pause();
      video.removeAttribute("src");
      source.removeAttribute("src");
      video.load();
      if (objectURL) URL.revokeObjectURL(objectURL);
      objectURL = null;
    };
    const reset = (
      message = "Load this short film before playback to enable seeking.",
    ) => {
      generation++;
      controller?.abort();
      controller = null;
      clearTimeout(timer);
      timer = null;
      detach();
      phase = "idle";
      panel.setAttribute("aria-busy", "false");
      load.disabled = false;
      load.hidden = false;
      load.textContent = "Load film";
      cancel.hidden = true;
      release.hidden = true;
      fallback.hidden = false;
      video.controls = false;
      say(message);
      if (releaseActive === reset) releaseActive = null;
    };
    const fail = () => {
      reset(
        "The film could not be loaded. Retry, use the original player, or read the visual description below. Seeking may be unavailable in the original player.",
      );
      phase = "error";
      load.textContent = "Retry loading";
    };
    reset();
    panel.hidden = false;
    video.setAttribute(
      "aria-describedby",
      [video.getAttribute("aria-describedby"), status.id]
        .filter(Boolean)
        .join(" "),
    );
    load.addEventListener("click", async () => {
      if (phase === "ready") {
        const playGeneration = generation;
        try {
          await video.play();
        } catch {
          if (playGeneration === generation && phase === "ready") {
            say("The film is ready. Use its Play control to start playback.");
          }
        }
        return;
      }
      if (phase === "loading") return;
      releaseActive?.();
      reset();
      releaseActive = reset;
      phase = "loading";
      const job = generation,
        request = new AbortController();
      controller = request;
      panel.setAttribute("aria-busy", "true");
      load.disabled = true;
      cancel.hidden = false;
      say("Loading film… You can cancel.");
      timer = setTimeout(() => request.abort(), 45000);
      try {
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
          throw new Error("Film response unavailable");
        const length = Number(response.headers.get("content-length"));
        if (length && length !== expectedBytes)
          throw new Error("Film size changed");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Film streaming unavailable");
        const chunks = [];
        let total = 0,
          announcement = -1;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > expectedBytes || total > limit) {
            await reader.cancel();
            throw new Error("Film size exceeded");
          }
          chunks.push(value);
          const progress = Math.floor((total / expectedBytes) * 10) * 10;
          if (progress !== announcement && job === generation) {
            announcement = progress;
            say(`Loading film… ${progress}%. You can cancel.`);
          }
        }
        if (total !== expectedBytes)
          throw new Error("Film download incomplete");
        if (job !== generation || request.signal.aborted) return;
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
            reject(new Error("Film could not be prepared"));
          };
          const readyTimer = setTimeout(error, 10000);
          video.addEventListener("loadedmetadata", ready, { once: true });
          video.addEventListener("error", error, { once: true });
          request.signal.addEventListener("abort", error, { once: true });
          video.src = objectURL;
          video.load();
        });
        if (job !== generation || request.signal.aborted) return;
        phase = "ready";
        video.controls = true;
        load.disabled = false;
        load.textContent = "Play film";
        cancel.hidden = true;
        release.hidden = false;
        panel.setAttribute("aria-busy", "false");
        say(
          "Film ready. Press Play film or use the video controls. Seeking is available.",
        );
      } catch {
        if (job === generation) fail();
      } finally {
        if (job === generation) {
          clearTimeout(timer);
          timer = null;
          controller = null;
        }
      }
    });
    cancel.addEventListener("click", () => {
      reset("Loading canceled. You can load the film when ready.");
      load.focus();
    });
    release.addEventListener("click", () => {
      reset("Film unloaded. Load it again when ready.");
      load.focus();
    });
    fallback.addEventListener("click", () => {
      reset();
      phase = "original";
      source.src = original.href;
      video.controls = true;
      video.load();
      load.textContent = "Try enhanced player";
      fallback.hidden = true;
      say(
        "Original player enabled. Seeking may be unavailable on this host. If playback fails, read the visual description or open the video file.",
      );
      video.focus();
    });
    video.addEventListener("error", () => {
      if (phase === "ready") fail();
    });
    window.addEventListener("pagehide", () => reset());
  });
})();
