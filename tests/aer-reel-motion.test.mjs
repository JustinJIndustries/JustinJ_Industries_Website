import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  process.env.JJI_REEL_SOURCE ||
    new URL("../previews/aer-field/site.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture({ reduced = false } = {}) {
  const motion = new EventTarget();
  motion.matches = reduced;
  const data = new EventTarget();
  data.matches = false;
  const mobile = new EventTarget();
  mobile.matches = false;
  const toggle = new EventTarget();
  toggle.hidden = true;
  toggle.textContent = "Pause film previews";
  const videos = Array.from({ length: 3 }, () => {
    const classes = new Set();
    return {
      dataset: { src: "/film.mp4" },
      src: "",
      paused: true,
      pending: [],
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      play() {
        this.paused = false;
        return new Promise((resolve, reject) =>
          this.pending.push({ resolve, reject }),
        );
      },
      pause() {
        this.paused = true;
      },
    };
  });
  const document = new EventTarget();
  document.hidden = false;
  document.querySelector = (selector) =>
    selector === "[data-reel-motion]" ? toggle : null;
  document.querySelectorAll = (selector) =>
    selector === ".film-video[data-src]" ? videos : [];
  let intersect;
  class IntersectionObserver {
    constructor(callback) {
      intersect = callback;
    }
    observe() {}
  }
  const window = {
    IntersectionObserver,
    matchMedia: (query) =>
      query.includes("reduced-motion")
        ? motion
        : query.includes("reduced-data")
          ? data
          : mobile,
  };
  vm.runInNewContext(source, {
    window,
    document,
    navigator: { connection: { saveData: false } },
    IntersectionObserver,
  });
  return {
    motion,
    toggle,
    videos,
    document,
    visible: () =>
      intersect(videos.map((target) => ({ target, isIntersecting: true }))),
    settle: async (reject = false) => {
      for (const video of videos)
        for (const pending of video.pending.splice(0))
          reject
            ? pending.reject(new Error("play interrupted"))
            : pending.resolve();
      await flush();
    },
  };
}

function assertStopped(f) {
  assert.ok(
    f.videos.every((video) => video.paused),
    "every reel is paused",
  );
  assert.ok(
    f.videos.every((video) => !video.classList.contains("is-playing")),
    "no paused reel claims to be playing",
  );
}

test("intersection reconciliation hides a stale control when policy disallows motion", () => {
  const f = fixture();
  assert.equal(f.toggle.hidden, false);
  // Policy can change before its change notification is delivered.
  f.motion.matches = true;
  f.visible();
  assertStopped(f);
  assert.equal(
    f.toggle.hidden,
    true,
    "paused reels must not leave a visible control",
  );
});

test("pending play completion reflects new reduced-motion policy", async () => {
  const f = fixture();
  f.visible();
  assert.ok(f.videos.every((video) => !video.paused));
  f.motion.matches = true;
  await f.settle();
  assertStopped(f);
  assert.equal(f.toggle.hidden, true);
});

test("play rejection also reconciles policy and control", async () => {
  const f = fixture();
  f.visible();
  f.motion.matches = true;
  await f.settle(true);
  assertStopped(f);
  assert.equal(f.toggle.hidden, true);
});

test("allowing motion reconciles a hidden control and actual playback", async () => {
  const f = fixture({ reduced: true });
  assert.equal(f.toggle.hidden, true);
  f.motion.matches = false;
  f.visible();
  await f.settle();
  assert.equal(f.toggle.hidden, false);
  assert.ok(f.videos.every((video) => !video.paused));
  assert.ok(f.videos.every((video) => video.classList.contains("is-playing")));
});

test("repeated policy notifications preserve the user's pause choice", async () => {
  const f = fixture();
  f.visible();
  await f.settle();
  f.toggle.dispatchEvent(new Event("click"));
  assertStopped(f);
  for (let n = 0; n < 3; n++) {
    f.motion.matches = true;
    f.motion.dispatchEvent(new Event("change"));
    assert.equal(f.toggle.hidden, true);
    f.motion.matches = false;
    f.motion.dispatchEvent(new Event("change"));
    assert.equal(f.toggle.hidden, false);
    assert.equal(f.toggle.textContent, "Play film previews");
    assertStopped(f);
  }
  f.toggle.dispatchEvent(new Event("click"));
  await f.settle();
  assert.equal(f.toggle.textContent, "Pause film previews");
  assert.ok(f.videos.every((video) => !video.paused));
});

test("hidden documents stay paused through pending completion and resume when visible", async () => {
  const f = fixture();
  f.visible();
  f.document.hidden = true;
  f.document.dispatchEvent(new Event("visibilitychange"));
  await f.settle();
  assertStopped(f);
  assert.equal(f.toggle.hidden, false, "visibility is not a motion preference");
  f.document.hidden = false;
  f.document.dispatchEvent(new Event("visibilitychange"));
  await f.settle();
  assert.ok(f.videos.every((video) => !video.paused));
  assert.ok(f.videos.every((video) => video.classList.contains("is-playing")));
});

test("pending playback cannot override a subsequent user pause", async () => {
  const f = fixture();
  f.visible();
  f.toggle.dispatchEvent(new Event("click"));
  await f.settle();
  assertStopped(f);
  assert.equal(f.toggle.hidden, false);
  assert.equal(f.toggle.textContent, "Play film previews");
});

test("pending completion uses the latest policy after rapid transitions", async () => {
  const f = fixture();
  f.visible();
  f.motion.matches = true;
  f.motion.matches = false;
  await f.settle();
  assert.equal(f.toggle.hidden, false);
  assert.ok(f.videos.every((video) => !video.paused));
  assert.ok(f.videos.every((video) => video.classList.contains("is-playing")));
});
