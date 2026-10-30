(() => {
  const init = (root = document) =>
    root.querySelectorAll("[data-sf-video]").forEach((figure) => {
      if (figure.dataset.ready) return;
      figure.dataset.ready = "true";
      const status = figure.querySelector(".sf-video-status");
      const message = (text) => {
        status.hidden = false;
        status.textContent = text;
      };
      const video = figure.querySelector("video");
      video?.addEventListener("error", () =>
        message(
          "This video cannot be played. Open the video file below, or read the visual description.",
        ),
      );
      video
        ?.querySelector("source")
        ?.addEventListener("error", () =>
          message(
            "This video source is unavailable. Use the source link below.",
          ),
        );
      if (video?.dataset.sfDecorative === "true") {
        const toggle = figure.querySelector("[data-sf-motion-toggle]");
        const reduced = matchMedia("(prefers-reduced-motion: reduce)");
        video.muted = true;
        video.defaultMuted = true;
        const labels = () => {
          toggle.textContent = video.paused ? "Play motion" : "Pause motion";
        };
        const buffer =
          video.dataset.sfBuffered === "true"
            ? window.sfCreateMotionBuffer?.({
                video,
                toggle,
                message,
                labels,
                canAutoplay: () => !reduced.matches && !document.hidden,
              })
            : null;
        const play = (manual = false) =>
          (buffer ? buffer.play(manual) : video.play())
            .then((played) => {
              if (played !== false) status.hidden = true;
              labels();
            })
            .catch(() => {
              if (!buffer)
                message(
                  "Automatic playback is unavailable. Press Play motion to start.",
                );
              labels();
            });
        video.addEventListener("play", labels);
        video.addEventListener("pause", labels);
        video.addEventListener("ended", labels);
        toggle.addEventListener("click", () => {
          if (video.paused) play(true);
          else video.pause();
        });
        const preference = () => {
          if (reduced.matches) {
            buffer?.cancel();
            video.autoplay = false;
            video.pause();
            message(
              "Automatic motion is off because reduced motion is enabled. Play is available if you choose.",
            );
            labels();
          }
        };
        reduced.addEventListener("change", preference);
        if (reduced.matches) preference();
        else if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) {
                observer.disconnect();
                if (!reduced.matches) {
                  play();
                }
              }
            },
            { threshold: 0.25 },
          );
          observer.observe(video);
        }
        // Without observer support, manual playback remains available.
        labels();
      }
      figure
        .querySelector("[data-sf-video-load]")
        ?.addEventListener("click", () => {
          const frame = figure.querySelector("iframe");
          // Only server-normalized, approved provider URLs reach this attribute.
          if (
            !/^https:\/\/(www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}|player\.vimeo\.com\/video\/[0-9]+)(?:\?|$)/.test(
              frame.dataset.sfVideoSrc || "",
            )
          ) {
            message(
              "This video source is not supported. Use the source link below.",
            );
            return;
          }
          figure.querySelector(".sf-video-consent").hidden = true;
          frame.hidden = false;
          const timer = setTimeout(
            () =>
              message(
                "The video provider has not responded. Open the source below and check privacy or embedding permissions.",
              ),
            12000,
          );
          frame.addEventListener(
            "load",
            () => {
              clearTimeout(timer);
              message(
                "If playback is private, removed or restricted, open the source below and check its permissions.",
              );
            },
            { once: true },
          );
          frame.src = frame.dataset.sfVideoSrc;
          frame.focus();
        });
    });
  window.sfInitProjectVideo = init;
  init();
})();
