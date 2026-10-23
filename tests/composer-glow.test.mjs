import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Deterministic controller contract tests, not a DOM renderer. Visual acceptance
// runs separately against the real DSH input.overlay slot in the browser.
const source = fs.readFileSync(new URL("../client.js", import.meta.url), "utf8");
const start = source.indexOf("    function glowOutline(");
const end = source.indexOf("    function ComposerGlow(");
assert(start >= 0 && end > start);
const controllerSource = source.slice(start, end);

function harness({ reduced = false, canvasAvailable = true } = {}) {
  let now = 0, nextId = 0, observer, clears = 0, strokes = 0;
  const frames = new Map(), mediaListeners = new Set(), visibilityListeners = new Set();
  const root = { dataset: {}, style: { setProperty() {} } };
  const card = { width: 712, height: 114, getBoundingClientRect() { return { width: this.width, height: this.height }; } };
  const context = {
    clearRect() { clears++; }, setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() { strokes++; }, fillRect() {}, createRadialGradient() { return { addColorStop() {} }; },
  };
  const canvas = { style: {}, getContext: () => canvasAvailable ? context : null };
  const media = { matches: reduced, addEventListener: (_, f) => mediaListeners.add(f), removeEventListener: (_, f) => mediaListeners.delete(f) };
  const doc = { hidden: false, addEventListener: (_, f) => visibilityListeners.add(f), removeEventListener: (_, f) => visibilityListeners.delete(f) };
  const sandbox = {
    window: { matchMedia: () => media, devicePixelRatio: 1 }, document: doc,
    performance: { now: () => now }, getComputedStyle: () => ({ borderTopLeftRadius: "20px" }),
    requestAnimationFrame(f) { const id = ++nextId; frames.set(id, f); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class { constructor(f) { observer = this; this.callback = f; } observe() {} disconnect() { this.disconnected = true; } },
  };
  const api = vm.runInNewContext(`${controllerSource}\n({glowOutline,mountComposerGlow})`, sandbox);
  const controller = api.mountComposerGlow(root, canvas, card);
  return {
    ...api, controller, root, card, canvas, frames,
    counts: () => ({ clears, strokes, media: mediaListeners.size, visibility: visibilityListeners.size, disconnected: !!observer.disconnected }),
    advance(ms) { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(f => f(now)); },
    resize(width, height) { card.width = width; card.height = height; observer.callback(); },
    hide(value) { doc.hidden = value; visibilityListeners.forEach(f => f()); },
    reduce(value) { media.matches = value; mediaListeners.forEach(f => f()); },
  };
}

test("outline starts at top center and meets at bottom center across input sizes", () => {
  const h = harness();
  for (const [width, height, radius] of [[712,114,20],[335,162,16],[952,300,24]]) {
    const shape = h.glowOutline(width,height,radius);
    const top = shape.point(shape.origin), bottom = shape.point(shape.origin + shape.length / 2);
    assert(Math.abs(top[0] - width/2) < 1e-8 && Math.abs(top[1]) < 1e-8);
    assert(Math.abs(bottom[0] - width/2) < 1e-8 && Math.abs(bottom[1]-height) < 1e-8);
  }
  h.controller.dispose();
});

test("real selection has intro then 350 ms quiet then ambient; refresh does not replay", () => {
  const h = harness(); h.controller.select("standard"); h.controller.select("ultracode");
  assert.equal(h.root.dataset.phase,"intro"); h.advance(900); assert(h.counts().strokes > 0);
  h.advance(900); assert.equal(h.root.dataset.phase,"quiet");
  h.advance(349); assert.equal(h.root.dataset.phase,"quiet");
  h.advance(1); assert.equal(h.root.dataset.phase,"ambient"); assert.equal(h.frames.size,0);
  h.controller.select("ultracode"); assert.equal(h.frames.size,0);
  h.controller.dispose();
  const restored=harness(); restored.controller.select(undefined); restored.controller.select("ultracode");
  assert.equal(restored.root.dataset.phase,"ambient"); assert.equal(restored.frames.size,0); restored.controller.dispose();
});

test("switching off cancels intro and quiet without delayed relighting", () => {
  for (const time of [200,1900]) {
    const h=harness(); h.controller.select("standard"); h.controller.select("ultracode"); h.advance(time);
    h.controller.select("standard"); assert.equal(h.root.dataset.phase,"off"); assert.equal(h.frames.size,0);
    h.advance(5000); assert.equal(h.root.dataset.phase,"off");
    h.controller.select("ultracode"); assert.equal(h.root.dataset.phase,"intro"); h.controller.dispose();
  }
});

test("reduced motion skips intro, and changing preference cancels an in-flight animation", () => {
  const h=harness({reduced:true}); h.controller.select("standard"); h.controller.select("ultracode");
  assert.equal(h.root.dataset.phase,"ambient"); assert.equal(h.frames.size,0); h.controller.dispose();
  const changing=harness(); changing.controller.select("standard"); changing.controller.select("ultracode");
  changing.advance(200); changing.reduce(true); assert.equal(changing.root.dataset.phase,"ambient");
  assert.equal(changing.frames.size,0); changing.reduce(false); assert.equal(changing.frames.size,0); changing.controller.dispose();
});

test("hidden page freezes intro time; resize stays aligned; unmount releases all resources", () => {
  const h=harness(); h.controller.select("standard"); h.controller.select("ultracode"); h.advance(500);
  h.hide(true); assert.equal(h.frames.size,0); h.advance(8000); assert.equal(h.root.dataset.phase,"intro");
  h.resize(335,162); assert.equal(h.root.style.height,"162px"); assert.equal(h.canvas.width,383);
  h.hide(false); h.advance(1300); assert.equal(h.root.dataset.phase,"quiet");
  h.controller.dispose(); assert.equal(h.frames.size,0);
  assert.deepEqual({media:h.counts().media,visibility:h.counts().visibility,disconnected:h.counts().disconnected},{media:0,visibility:0,disconnected:true});
});

test("missing canvas context preserves static indication and does not break the input", () => {
  const h=harness({canvasAvailable:false}); h.controller.select("standard"); h.controller.select("ultracode");
  assert.equal(h.root.dataset.phase,"ambient"); assert.equal(h.frames.size,0); h.controller.dispose();
});
